// netlify/functions/strava-webhook.js
// GET  → validation de l'abonnement webhook Strava (hub.challenge)
// POST → réception des événements (activité créée/mise à jour)
//        Récupère l'activité, la stocke dans le blob athlète, auto-match séance

const { getStore } = require('@netlify/blobs');

const CORS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
const resp = (s, b) => ({ statusCode: s, headers: CORS, body: JSON.stringify(b) });

exports.handler = async (event) => {

  // ── Validation Strava (GET) ──────────────────────────────────
  if (event.httpMethod === 'GET') {
    const p = event.queryStringParameters || {};
    if (p['hub.mode'] !== 'subscribe') return resp(400, { error: 'hub.mode manquant' });
    const VERIFY_TOKEN = process.env.STRAVA_VERIFY_TOKEN;
    if (!VERIFY_TOKEN || p['hub.verify_token'] !== VERIFY_TOKEN) {
      return resp(403, { error: 'hub.verify_token invalide' });
    }
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ 'hub.challenge': p['hub.challenge'] }) };
  }

  // ── Événement webhook (POST) ─────────────────────────────────
  if (event.httpMethod === 'POST') {
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { return resp(400, { error: 'JSON invalide' }); }

    const { object_type, object_id, aspect_type, owner_id } = body;

    // On ne traite que les créations d'activité running/trail
    if (object_type !== 'activity' || (aspect_type !== 'create' && aspect_type !== 'update')) {
      return resp(200, { ok: true, skipped: true });
    }

    let store, indexStore;
    try {
      store = getStore('athletes');
      indexStore = getStore('strava-index');
    } catch { return resp(503, { error: 'Blobs indisponibles' }); }

    // Résoudre stravaAthleteId → athId via l'index
    let athId;
    try {
      const idx = await indexStore.get(`sid-${owner_id}`, { type: 'json' });
      athId = idx?.athId;
    } catch {}
    if (!athId) return resp(200, { ok: true, skipped: 'athlete not indexed' });

    // Charger les données athlète
    let athData;
    try { athData = await store.get(`athlete-${athId}`, { type: 'json' }); } catch {}
    if (!athData?.strava?.accessToken) return resp(200, { ok: true, skipped: 'no token' });

    // Rafraîchir le token si nécessaire
    let accessToken = athData.strava.accessToken;
    if (athData.strava.expiresAt && Date.now() / 1000 > athData.strava.expiresAt - 300) {
      accessToken = await refreshAccessToken(athData) || accessToken;
      if (athData.strava.accessToken !== accessToken) {
        athData.strava.accessToken = accessToken;
      }
    }

    // Récupérer l'activité depuis Strava
    let activity;
    try {
      const actResp = await fetch(`https://www.strava.com/api/v3/activities/${object_id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!actResp.ok) return resp(200, { ok: true, skipped: 'strava fetch failed ' + actResp.status });
      activity = await actResp.json();
    } catch (e) { return resp(200, { ok: true, skipped: 'fetch error: ' + e.message }); }

    const norm = normalizeActivity(activity);
    const isSport = ['Run', 'TrailRun', 'Hike'].includes(norm.t);
    if (!isSport) return resp(200, { ok: true, skipped: 'not running' });

    // Dédupliquer + ajouter/mettre à jour dans la liste
    const activities = athData.activities || [];
    const existIdx = activities.findIndex(a => a.id === norm.id);
    if (existIdx >= 0) activities[existIdx] = norm;
    else { activities.unshift(norm); activities.splice(50); }
    athData.activities = activities;

    // Auto-match avec une séance planifiée du même jour
    const actDate = norm.d.slice(0, 10);
    let matched = null;
    const session = (athData.sessions || []).find(s =>
      !s.ok && s.d && s.d.slice(0, 10) === actDate
    );
    if (session) {
      session.ok = true;
      session.stravaId = norm.id;
      matched = session.id;
    }

    athData.updatedAt = new Date().toISOString();
    try { await store.setJSON(`athlete-${athId}`, athData); } catch (e) {
      return resp(500, { error: 'Erreur sauvegarde: ' + e.message });
    }

    return resp(200, { ok: true, activityId: norm.id, matchedSession: matched });
  }

  return resp(405, { error: 'Méthode non autorisée' });
};

async function refreshAccessToken(athData) {
  const CLIENT_ID     = process.env.STRAVA_CLIENT_ID;
  const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
  if (!CLIENT_ID || !CLIENT_SECRET || !athData.strava?.refreshToken) return null;
  try {
    const r = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
        grant_type: 'refresh_token', refresh_token: athData.strava.refreshToken,
      }),
    });
    const d = await r.json();
    if (d.access_token) {
      athData.strava.accessToken  = d.access_token;
      athData.strava.refreshToken = d.refresh_token;
      athData.strava.expiresAt    = d.expires_at;
      return d.access_token;
    }
  } catch {}
  return null;
}

function normalizeActivity(a) {
  return {
    id:   a.id,
    n:    a.name,
    t:    normalizeType(a.sport_type || a.type),
    d:    a.start_date_local,
    km:   Math.round(a.distance),
    sec:  a.moving_time,
    dp:   Math.round(a.total_elevation_gain || 0),
    al:   a.distance > 0 ? a.moving_time / a.distance : null,
    fc:   a.average_heartrate  ? Math.round(a.average_heartrate)  : null,
    fcMax:a.max_heartrate      ? Math.round(a.max_heartrate)      : null,
    cad:  a.average_cadence    ? Math.round(a.average_cadence * 2): null,
    url:  `https://www.strava.com/activities/${a.id}`,
  };
}

function normalizeType(t) {
  t = (t || '').toLowerCase();
  if (t.includes('trail')) return 'TrailRun';
  if (t.includes('run'))   return 'Run';
  if (t.includes('hike') || t.includes('walk')) return 'Hike';
  if (t.includes('ride') || t.includes('bike')) return 'Ride';
  return 'Run';
}
