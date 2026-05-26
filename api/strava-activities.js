// api/strava-activities.js
// Proxy sécurisé vers l'API Strava — récupère les activités d'un athlète

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers['authorization'] || '';
  const accessToken = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!accessToken) {
    return res.status(401).json({ error: 'Authorization header requis (Bearer <token>)' });
  }

  const { per_page = '30', page = '1', before = '', after = '' } = req.query || {};
  let url = `https://www.strava.com/api/v3/athlete/activities?per_page=${Math.min(parseInt(per_page), 100)}&page=${parseInt(page)}`;
  if (before) url += `&before=${before}`;
  if (after)  url += `&after=${after}`;

  try {
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (r.status === 401) {
      return res.status(401).json({ error: 'Token Strava expiré ou invalide — refresh nécessaire' });
    }
    if (!r.ok) {
      return res.status(r.status).json({ error: 'Erreur API Strava', details: await r.text() });
    }

    const activities = await r.json();
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

    return res.status(200).json(normalized);
  } catch (err) {
    return res.status(500).json({ error: 'Erreur réseau : ' + err.message });
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
