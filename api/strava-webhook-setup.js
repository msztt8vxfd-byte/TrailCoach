// api/strava-webhook-setup.js
// Configure automatiquement l'abonnement webhook Strava

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-Coach-Token',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
};
const STRAVA = 'https://www.strava.com/api/v3';

module.exports = async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();

  const CLIENT_ID     = process.env.STRAVA_CLIENT_ID;
  const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
  const COACH_TOKEN   = process.env.COACH_TOKEN;

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return res.status(503).json({ error: 'STRAVA_CLIENT_ID et STRAVA_CLIENT_SECRET manquants dans les variables Vercel.' });
  }
  if (!COACH_TOKEN) {
    return res.status(503).json({ error: 'COACH_TOKEN manquant dans les variables Vercel.' });
  }

  const token = req.headers['x-coach-token'] || '';
  if (token !== COACH_TOKEN) return res.status(401).json({ error: 'Token coach invalide' });

  const creds = `client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`;

  // ── GET : état actuel ──────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const r = await fetch(`${STRAVA}/push_subscriptions?${creds}`);
      const subs = await r.json();
      return res.status(200).json({ subscriptions: Array.isArray(subs) ? subs : [] });
    } catch (e) {
      return res.status(500).json({ error: 'Erreur Strava: ' + e.message });
    }
  }

  // ── POST : créer ou remplacer ──────────────────────────────────
  if (req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { siteUrl } = body;
    if (!siteUrl) return res.status(400).json({ error: 'siteUrl requis' });

    const callbackUrl = siteUrl.replace(/\/$/, '') + '/api/strava-webhook';

    try {
      const listRes = await fetch(`${STRAVA}/push_subscriptions?${creds}`);
      const existing = await listRes.json();

      if (Array.isArray(existing)) {
        for (const sub of existing) {
          if (sub.callback_url === callbackUrl) {
            return res.status(200).json({ ok: true, already: true, subscription: sub });
          }
          await fetch(`${STRAVA}/push_subscriptions/${sub.id}?${creds}`, { method: 'DELETE' });
        }
      }

      const createRes = await fetch(`${STRAVA}/push_subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id:     CLIENT_ID,
          client_secret: CLIENT_SECRET,
          callback_url:  callbackUrl,
          verify_token:  COACH_TOKEN,
        }),
      });

      const data = await createRes.json();
      if (!createRes.ok) {
        return res.status(createRes.status).json({ error: data.message || 'Erreur Strava', details: data });
      }
      return res.status(200).json({ ok: true, already: false, subscription: data });
    } catch (e) {
      return res.status(500).json({ error: 'Erreur: ' + e.message });
    }
  }

  // ── DELETE : supprimer l'abonnement ───────────────────────────
  if (req.method === 'DELETE') {
    const { id } = req.query || {};
    if (!id) return res.status(400).json({ error: 'id requis' });
    try {
      await fetch(`${STRAVA}/push_subscriptions/${id}?${creds}`, { method: 'DELETE' });
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: 'Erreur: ' + e.message });
    }
  }

  return res.status(405).json({ error: 'Méthode non autorisée' });
};
