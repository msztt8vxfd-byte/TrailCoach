// netlify/functions/strava-token.js
// Échange le code OAuth contre un token — le Client Secret ne quitte jamais le serveur

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Preflight CORS
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const CLIENT_ID     = process.env.STRAVA_CLIENT_ID;
  const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'STRAVA_CLIENT_ID et STRAVA_CLIENT_SECRET manquants dans les variables d\'environnement Netlify.' }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { code, grant_type, refresh_token } = body;

  if (!grant_type) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'grant_type requis (authorization_code ou refresh_token)' }) };
  }

  // Prépare le payload pour Strava
  const payload = {
    client_id:     CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type,
  };

  if (grant_type === 'authorization_code') {
    if (!code) return { statusCode: 400, headers, body: JSON.stringify({ error: 'code requis pour authorization_code' }) };
    payload.code = code;
  } else if (grant_type === 'refresh_token') {
    if (!refresh_token) return { statusCode: 400, headers, body: JSON.stringify({ error: 'refresh_token requis' }) };
    payload.refresh_token = refresh_token;
  } else {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'grant_type invalide' }) };
  }

  try {
    const resp = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await resp.json();

    if (!resp.ok) {
      return {
        statusCode: resp.status,
        headers,
        body: JSON.stringify({ error: data.message || 'Erreur Strava', details: data }),
      };
    }

    // Retourne le token au client (sans jamais exposer le client_secret)
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        access_token:  data.access_token,
        refresh_token: data.refresh_token,
        expires_at:    data.expires_at,
        athlete:       data.athlete ? {
          id:         data.athlete.id,
          firstname:  data.athlete.firstname,
          lastname:   data.athlete.lastname,
          city:       data.athlete.city,
          profile:    data.athlete.profile_medium,
          sex:        data.athlete.sex,
        } : null,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Erreur réseau vers Strava : ' + err.message }),
    };
  }
};
