// functions/api/strava-activities.js
// Cloudflare Pages Function — proxy sécurisé vers l'API Strava activités

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

function normalizeType(stravaType) {
  const t = (stravaType || '').toLowerCase();
  if (t.includes('trail')) return 'TrailRun';
  if (t.includes('run'))   return 'Run';
  if (t.includes('hike') || t.includes('walk')) return 'Hike';
  if (t.includes('ride') || t.includes('bike')) return 'Ride';
  return stravaType || 'Run';
}

export async function onRequest(context) {
  const { request } = context;

  if (request.method === 'OPTIONS') return new Response('', { status: 200, headers: CORS });
  if (request.method !== 'GET')     return json({ error: 'Method not allowed' }, 405);

  const authHeader  = request.headers.get('authorization') || '';
  const accessToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!accessToken) return json({ error: 'Authorization header requis (Bearer <token>)' }, 401);

  const url    = new URL(request.url);
  const perPage = Math.min(parseInt(url.searchParams.get('per_page') || '30'), 100);
  const page    = parseInt(url.searchParams.get('page') || '1');
  const before  = url.searchParams.get('before') || '';
  const after   = url.searchParams.get('after')  || '';

  let stravaUrl = `https://www.strava.com/api/v3/athlete/activities?per_page=${perPage}&page=${page}`;
  if (before) stravaUrl += `&before=${before}`;
  if (after)  stravaUrl += `&after=${after}`;

  try {
    const resp = await fetch(stravaUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (resp.status === 401) {
      return json({ error: 'Token Strava expiré ou invalide — refresh nécessaire' }, 401);
    }
    if (!resp.ok) {
      const err = await resp.text();
      return json({ error: 'Erreur API Strava', details: err }, resp.status);
    }

    const activities = await resp.json();
    const normalized = activities.map(a => ({
      id:        a.id,
      nom:       a.name,
      type:      normalizeType(a.sport_type || a.type),
      date:      a.start_date_local,
      distanceM: Math.round(a.distance),
      dureeSec:  a.moving_time,
      denivele:  Math.round(a.total_elevation_gain || 0),
      alluRaw:   a.distance > 0 ? a.moving_time / a.distance : null,
      fc:        a.average_heartrate ? Math.round(a.average_heartrate) : null,
      fcMax:     a.max_heartrate     ? Math.round(a.max_heartrate)     : null,
      cadence:   a.average_cadence   ? Math.round(a.average_cadence * 2) : null,
      kudos:     a.kudos_count || 0,
      stravaUrl: `https://www.strava.com/activities/${a.id}`,
      map:       a.map?.summary_polyline || null,
    }));

    return json(normalized);
  } catch (err) {
    return json({ error: 'Erreur réseau: ' + err.message }, 500);
  }
}
