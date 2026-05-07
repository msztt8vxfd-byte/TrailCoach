// netlify/functions/strava-activities.js
// Proxy sécurisé vers l'API Strava — récupère les activités d'un athlète

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Récupère le Bearer token depuis le header Authorization
  const authHeader = event.headers['authorization'] || event.headers['Authorization'] || '';
  const accessToken = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!accessToken) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Authorization header requis (Bearer <token>)' }) };
  }

  // Paramètres de pagination
  const params = event.queryStringParameters || {};
  const per_page = Math.min(parseInt(params.per_page || '30'), 100);
  const page     = parseInt(params.page || '1');
  const before   = params.before || '';   // timestamp unix optionnel
  const after    = params.after  || '';   // timestamp unix optionnel (ex: début de prépa)

  let url = `https://www.strava.com/api/v3/athlete/activities?per_page=${per_page}&page=${page}`;
  if (before) url += `&before=${before}`;
  if (after)  url += `&after=${after}`;

  try {
    const resp = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (resp.status === 401) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Token Strava expiré ou invalide — refresh nécessaire' }) };
    }

    if (!resp.ok) {
      const err = await resp.text();
      return { statusCode: resp.status, headers, body: JSON.stringify({ error: 'Erreur API Strava', details: err }) };
    }

    const activities = await resp.json();

    // Normalise les données pour TrailCoach
    const normalized = activities.map(a => ({
      id:        a.id,
      nom:       a.name,
      type:      normalizeType(a.sport_type || a.type),
      date:      a.start_date_local,
      distanceM: Math.round(a.distance),
      dureeSec:  a.moving_time,
      denivele:  Math.round(a.total_elevation_gain || 0),
      alluRaw:   a.distance > 0 ? a.moving_time / a.distance : null,  // sec/m → × 1000 = min/km
      fc:        a.average_heartrate ? Math.round(a.average_heartrate) : null,
      fcMax:     a.max_heartrate     ? Math.round(a.max_heartrate)     : null,
      cadence:   a.average_cadence   ? Math.round(a.average_cadence * 2) : null,  // doublé = SPM
      kudos:     a.kudos_count || 0,
      stravaUrl: `https://www.strava.com/activities/${a.id}`,
      map:       a.map?.summary_polyline || null,
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(normalized),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Erreur réseau : ' + err.message }),
    };
  }
};

function normalizeType(stravaType) {
  const t = (stravaType || '').toLowerCase();
  if (t.includes('trail')) return 'TrailRun';
  if (t.includes('run'))   return 'Run';
  if (t.includes('hike') || t.includes('walk')) return 'Hike';
  if (t.includes('ride') || t.includes('bike')) return 'Ride';
  return stravaType || 'Run';
}
