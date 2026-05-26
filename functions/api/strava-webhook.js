// functions/api/strava-webhook.js
// Cloudflare Pages Function — réception des événements Strava
// GET  : validation de l'abonnement (hub.challenge)
// POST : traitement des activités créées/mises à jour

const CORS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

function normalizeType(t) {
  t = (t || '').toLowerCase();
  if (t.includes('trail')) return 'TrailRun';
  if (t.includes('run'))   return 'Run';
  if (t.includes('hike') || t.includes('walk')) return 'Hike';
  if (t.includes('ride') || t.includes('bike')) return 'Ride';
  return 'Run';
}

function normalizeActivity(a) {
  return {
    id:    a.id,
    n:     a.name,
    t:     normalizeType(a.sport_type || a.type),
    d:     a.start_date_local,
    km:    Math.round(a.distance),
    sec:   a.moving_time,
    dp:    Math.round(a.total_elevation_gain || 0),
    al:    a.distance > 0 ? a.moving_time / a.distance : null,
    fc:    a.average_heartrate ? Math.round(a.average_heartrate)  : null,
    fcMax: a.max_heartrate     ? Math.round(a.max_heartrate)      : null,
    cad:   a.average_cadence   ? Math.round(a.average_cadence * 2): null,
    url:   `https://www.strava.com/activities/${a.id}`,
  };
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // ── Validation Strava (GET hub.challenge) ─────────────────────
  if (request.method === 'GET') {
    const mode        = url.searchParams.get('hub.mode');
    const verifyToken = url.searchParams.get('hub.verify_token');
    const challenge   = url.searchParams.get('hub.challenge');

    if (mode !== 'subscribe') return json({ error: 'hub.mode manquant' }, 400);
    const VERIFY_TOKEN = env.COACH_TOKEN;
    if (!VERIFY_TOKEN || verifyToken !== VERIFY_TOKEN) {
      return json({ error: 'hub.verify_token invalide' }, 403);
    }
    return json({ 'hub.challenge': challenge });
  }

  // ── Événement webhook (POST) ──────────────────────────────────
  if (request.method === 'POST') {
    let body;
    try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }

    const { object_type, object_id, aspect_type, owner_id } = body;

    if (object_type !== 'activity' || (aspect_type !== 'create' && aspect_type !== 'update')) {
      return json({ ok: true, skipped: true });
    }

    const KV = env.ATHLETES_KV;
    if (!KV) return json({ error: 'KV non configuré' }, 503);

    // Résoudre stravaAthleteId → athId
    let athId;
    try {
      const idx = await KV.get(`sid-${owner_id}`, { type: 'json' });
      athId = idx?.athId;
    } catch {}
    if (!athId) return json({ ok: true, skipped: 'athlete not indexed' });

    let athData;
    try { athData = await KV.get(`athlete-${athId}`, { type: 'json' }); } catch {}
    if (!athData?.strava?.accessToken) return json({ ok: true, skipped: 'no token' });

    // Rafraîchir le token si nécessaire
    let accessToken = athData.strava.accessToken;
    if (athData.strava.expiresAt && Date.now() / 1000 > athData.strava.expiresAt - 300) {
      const refreshed = await refreshToken(athData, env);
      if (refreshed) {
        accessToken = refreshed;
        await KV.put(`athlete-${athId}`, JSON.stringify(athData));
      }
    }

    // Récupérer l'activité depuis Strava
    let activity;
    try {
      const actResp = await fetch(`https://www.strava.com/api/v3/activities/${object_id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!actResp.ok) return json({ ok: true, skipped: 'strava fetch failed ' + actResp.status });
      activity = await actResp.json();
    } catch (e) { return json({ ok: true, skipped: 'fetch error: ' + e.message }); }

    const norm    = normalizeActivity(activity);
    const isSport = ['Run', 'TrailRun', 'Hike'].includes(norm.t);
    if (!isSport) return json({ ok: true, skipped: 'not running' });

    const activities = athData.activities || [];
    const existIdx   = activities.findIndex(a => a.id === norm.id);
    if (existIdx >= 0) activities[existIdx] = norm;
    else { activities.unshift(norm); activities.splice(50); }
    athData.activities = activities;

    // Auto-match séance planifiée du même jour
    const actDate = norm.d.slice(0, 10);
    let matched   = null;
    const session = (athData.sessions || []).find(s => !s.ok && s.d && s.d.slice(0, 10) === actDate);
    if (session) { session.ok = true; session.stravaId = norm.id; matched = session.id; }

    athData.updatedAt = new Date().toISOString();
    try {
      await KV.put(`athlete-${athId}`, JSON.stringify(athData));
    } catch (e) {
      return json({ error: 'Erreur sauvegarde: ' + e.message }, 500);
    }

    return json({ ok: true, activityId: norm.id, matchedSession: matched });
  }

  return json({ error: 'Méthode non autorisée' }, 405);
}

async function refreshToken(athData, env) {
  const CLIENT_ID     = env.STRAVA_CLIENT_ID;
  const CLIENT_SECRET = env.STRAVA_CLIENT_SECRET;
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
