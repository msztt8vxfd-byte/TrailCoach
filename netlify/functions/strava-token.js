// netlify/functions/strava-token.js
// Échange le code OAuth Strava contre un token — le Client Secret ne quitte jamais le serveur
// Si athId + pin sont fournis → stocke les tokens dans Netlify Blobs (flux athlète)

const { getStore } = require('@netlify/blobs');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const CLIENT_ID     = process.env.STRAVA_CLIENT_ID;
  const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({
      error: 'STRAVA_CLIENT_ID et STRAVA_CLIENT_SECRET manquants dans les variables Netlify.',
    }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { code, grant_type, refresh_token, athId, pin } = body;
  if (!grant_type) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'grant_type requis' }) };
  }

  const payload = { client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type };
  if (grant_type === 'authorization_code') {
    if (!code) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'code requis' }) };
    payload.code = code;
  } else if (grant_type === 'refresh_token') {
    if (!refresh_token) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'refresh_token requis' }) };
    payload.refresh_token = refresh_token;
  } else {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'grant_type invalide' }) };
  }

  // Échange avec Strava
  let data;
  try {
    const resp = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    data = await resp.json();
    if (!resp.ok) {
      return { statusCode: resp.status, headers: CORS, body: JSON.stringify({
        error: data.message || 'Erreur Strava', details: data,
      }) };
    }
  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Erreur réseau: ' + err.message }) };
  }

  // ── Stockage côté athlète (si athId + pin fournis) ──────────
  if (athId && pin && data.access_token) {
    try {
      const store      = getStore('athletes');
      const indexStore = getStore('strava-index');
      const athData    = await store.get(`athlete-${athId}`, { type: 'json' }).catch(() => null);
      if (athData && String(athData.pin) === String(pin)) {
        athData.strava = {
          accessToken:  data.access_token,
          refreshToken: data.refresh_token,
          expiresAt:    data.expires_at,
          athleteId:    data.athlete?.id || athData.strava?.athleteId,
          connectedAt:  new Date().toISOString(),
        };
        await store.setJSON(`athlete-${athId}`, athData);
        // Met à jour l'index stravaAthleteId → athId pour les webhooks
        if (data.athlete?.id) {
          await indexStore.setJSON(`sid-${data.athlete.id}`, { athId: String(athId) });
        }
      }
    } catch { /* non bloquant */ }
  }

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({
      access_token:  data.access_token,
      refresh_token: data.refresh_token,
      expires_at:    data.expires_at,
      athlete: data.athlete ? {
        id:       data.athlete.id,
        firstname:data.athlete.firstname,
        lastname: data.athlete.lastname,
        city:     data.athlete.city,
        profile:  data.athlete.profile_medium,
      } : null,
    }),
  };
};
