// api/strava-token.js
// Échange le code OAuth Strava contre un token — le Client Secret ne quitte jamais le serveur

const { kv } = require('@vercel/kv');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

module.exports = async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const CLIENT_ID     = process.env.STRAVA_CLIENT_ID;
  const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return res.status(500).json({
      error: 'STRAVA_CLIENT_ID et STRAVA_CLIENT_SECRET manquants dans les variables Vercel.',
    });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const { code, grant_type, refresh_token, athId, pin } = body;

  if (!grant_type) return res.status(400).json({ error: 'grant_type requis' });

  const payload = { client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type };
  if (grant_type === 'authorization_code') {
    if (!code) return res.status(400).json({ error: 'code requis' });
    payload.code = code;
  } else if (grant_type === 'refresh_token') {
    if (!refresh_token) return res.status(400).json({ error: 'refresh_token requis' });
    payload.refresh_token = refresh_token;
  } else {
    return res.status(400).json({ error: 'grant_type invalide' });
  }

  // Échange avec Strava
  let data;
  try {
    const r = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data.message || 'Erreur Strava', details: data });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur réseau: ' + err.message });
  }

  // Stocke les tokens Strava dans Vercel KV (si athId + pin fournis)
  if (athId && pin && data.access_token) {
    try {
      const athData = await kv.get(`athlete-${athId}`);
      if (athData && String(athData.pin) === String(pin)) {
        athData.strava = {
          accessToken:  data.access_token,
          refreshToken: data.refresh_token,
          expiresAt:    data.expires_at,
          athleteId:    data.athlete?.id || athData.strava?.athleteId,
          connectedAt:  new Date().toISOString(),
        };
        await kv.set(`athlete-${athId}`, athData);
        if (data.athlete?.id) {
          await kv.set(`sid-${data.athlete.id}`, { athId: String(athId) });
        }
      }
    } catch { /* non bloquant */ }
  }

  return res.status(200).json({
    access_token:  data.access_token,
    refresh_token: data.refresh_token,
    expires_at:    data.expires_at,
    athlete: data.athlete ? {
      id:        data.athlete.id,
      firstname: data.athlete.firstname,
      lastname:  data.athlete.lastname,
      city:      data.athlete.city,
      profile:   data.athlete.profile_medium,
    } : null,
  });
};
