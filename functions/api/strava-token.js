// functions/api/strava-token.js
// Cloudflare Pages Function — échange OAuth Strava + stockage token dans KV

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') return new Response('', { status: 200, headers: CORS });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const CLIENT_ID     = env.STRAVA_CLIENT_ID;
  const CLIENT_SECRET = env.STRAVA_CLIENT_SECRET;
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return json({ error: 'STRAVA_CLIENT_ID et STRAVA_CLIENT_SECRET manquants dans les variables Cloudflare.' }, 500);
  }

  let body;
  try { body = await request.json(); } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { code, grant_type, refresh_token, athId, pin } = body;
  if (!grant_type) return json({ error: 'grant_type requis' }, 400);

  const payload = { client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type };
  if (grant_type === 'authorization_code') {
    if (!code) return json({ error: 'code requis' }, 400);
    payload.code = code;
  } else if (grant_type === 'refresh_token') {
    if (!refresh_token) return json({ error: 'refresh_token requis' }, 400);
    payload.refresh_token = refresh_token;
  } else {
    return json({ error: 'grant_type invalide' }, 400);
  }

  let data;
  try {
    const resp = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    data = await resp.json();
    if (!resp.ok) {
      return json({ error: data.message || 'Erreur Strava', details: data }, resp.status);
    }
  } catch (err) {
    return json({ error: 'Erreur réseau: ' + err.message }, 500);
  }

  // ── Stockage token côté athlète dans KV ──────────────────────
  if (athId && pin && data.access_token && env.ATHLETES_KV) {
    try {
      const KV     = env.ATHLETES_KV;
      const athData = await KV.get(`athlete-${athId}`, { type: 'json' }).catch(() => null);
      if (athData && String(athData.pin) === String(pin)) {
        athData.strava = {
          accessToken:  data.access_token,
          refreshToken: data.refresh_token,
          expiresAt:    data.expires_at,
          athleteId:    data.athlete?.id || athData.strava?.athleteId,
          connectedAt:  new Date().toISOString(),
        };
        await KV.put(`athlete-${athId}`, JSON.stringify(athData));
        // Index stravaAthleteId → athId pour les webhooks
        if (data.athlete?.id) {
          await KV.put(`sid-${data.athlete.id}`, JSON.stringify({ athId: String(athId) }));
        }
      }
    } catch { /* non bloquant */ }
  }

  return json({
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
}
