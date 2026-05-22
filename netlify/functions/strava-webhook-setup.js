// netlify/functions/strava-webhook-setup.js
// Configure automatiquement l'abonnement webhook Strava
// GET  → état de l'abonnement (déjà configuré ?)
// POST → créer/remplacer l'abonnement (callback_url = siteUrl/api/strava-webhook)
// DELETE → supprimer l'abonnement

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-Coach-Token',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Content-Type': 'application/json',
};
const resp = (s, b) => ({ statusCode: s, headers: CORS, body: JSON.stringify(b) });
const STRAVA = 'https://www.strava.com/api/v3';

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  const CLIENT_ID     = process.env.STRAVA_CLIENT_ID;
  const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
  const COACH_TOKEN   = process.env.COACH_TOKEN;

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return resp(503, { error: 'STRAVA_CLIENT_ID et STRAVA_CLIENT_SECRET manquants dans les variables Netlify.' });
  }
  if (!COACH_TOKEN) {
    return resp(503, { error: 'COACH_TOKEN manquant dans les variables Netlify.' });
  }

  // Auth coach sur toutes les méthodes
  const token = event.headers['x-coach-token'] || '';
  if (token !== COACH_TOKEN) return resp(401, { error: 'Token coach invalide' });

  const creds = `client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`;

  // ── GET : état actuel ─────────────────────────────────────────
  if (event.httpMethod === 'GET') {
    try {
      const r = await fetch(`${STRAVA}/push_subscriptions?${creds}`);
      const subs = await r.json();
      return resp(200, { subscriptions: Array.isArray(subs) ? subs : [] });
    } catch (e) {
      return resp(500, { error: 'Erreur Strava: ' + e.message });
    }
  }

  // ── POST : créer ou remplacer ─────────────────────────────────
  if (event.httpMethod === 'POST') {
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { return resp(400, { error: 'JSON invalide' }); }

    const { siteUrl } = body;
    if (!siteUrl) return resp(400, { error: 'siteUrl requis' });

    const callbackUrl = siteUrl.replace(/\/$/, '') + '/api/strava-webhook';

    try {
      // Vérifie les abonnements existants
      const listRes = await fetch(`${STRAVA}/push_subscriptions?${creds}`);
      const existing = await listRes.json();

      if (Array.isArray(existing)) {
        for (const sub of existing) {
          // Déjà configuré sur ce callback → rien à faire
          if (sub.callback_url === callbackUrl) {
            return resp(200, { ok: true, already: true, subscription: sub });
          }
          // Supprime l'ancien abonnement pour en créer un nouveau
          await fetch(`${STRAVA}/push_subscriptions/${sub.id}?${creds}`, { method: 'DELETE' });
        }
      }

      // Crée le nouvel abonnement — Strava va valider notre endpoint (GET hub.challenge)
      const createRes = await fetch(`${STRAVA}/push_subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id:     CLIENT_ID,
          client_secret: CLIENT_SECRET,
          callback_url:  callbackUrl,
          verify_token:  COACH_TOKEN,   // réutilise COACH_TOKEN, pas de variable en plus
        }),
      });

      const data = await createRes.json();
      if (!createRes.ok) {
        return resp(createRes.status, { error: data.message || 'Erreur Strava', details: data });
      }
      return resp(200, { ok: true, already: false, subscription: data });
    } catch (e) {
      return resp(500, { error: 'Erreur: ' + e.message });
    }
  }

  // ── DELETE : supprimer l'abonnement ──────────────────────────
  if (event.httpMethod === 'DELETE') {
    const { id } = event.queryStringParameters || {};
    if (!id) return resp(400, { error: 'id requis' });
    try {
      await fetch(`${STRAVA}/push_subscriptions/${id}?${creds}`, { method: 'DELETE' });
      return resp(200, { ok: true });
    } catch (e) {
      return resp(500, { error: 'Erreur: ' + e.message });
    }
  }

  return resp(405, { error: 'Méthode non autorisée' });
};
