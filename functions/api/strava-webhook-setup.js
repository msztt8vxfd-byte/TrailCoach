// functions/api/strava-webhook-setup.js
// Cloudflare Pages Function — gestion de l'abonnement webhook Strava
// GET    : état des abonnements actifs
// POST   : créer/remplacer l'abonnement (body: { siteUrl })
// DELETE : supprimer l'abonnement (?id=xxx)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-Coach-Token',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Content-Type': 'application/json',
};
const STRAVA = 'https://www.strava.com/api/v3';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') return new Response('', { status: 200, headers: CORS });

  const CLIENT_ID     = env.STRAVA_CLIENT_ID;
  const CLIENT_SECRET = env.STRAVA_CLIENT_SECRET;
  const COACH_TOKEN   = env.COACH_TOKEN;

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return json({ error: 'STRAVA_CLIENT_ID et STRAVA_CLIENT_SECRET manquants dans les variables Cloudflare.' }, 503);
  }
  if (!COACH_TOKEN) {
    return json({ error: 'COACH_TOKEN manquant dans les variables Cloudflare.' }, 503);
  }

  // Auth coach requise sur toutes les méthodes
  const token = request.headers.get('x-coach-token') || '';
  if (token !== COACH_TOKEN) return json({ error: 'Token coach invalide' }, 401);

  const creds = `client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`;
  const url   = new URL(request.url);

  // ── GET : état actuel ─────────────────────────────────────────
  if (request.method === 'GET') {
    try {
      const r    = await fetch(`${STRAVA}/push_subscriptions?${creds}`);
      const subs = await r.json();
      return json({ subscriptions: Array.isArray(subs) ? subs : [] });
    } catch (e) {
      return json({ error: 'Erreur Strava: ' + e.message }, 500);
    }
  }

  // ── POST : créer ou remplacer ─────────────────────────────────
  if (request.method === 'POST') {
    let body;
    try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }

    const { siteUrl } = body;
    if (!siteUrl) return json({ error: 'siteUrl requis' }, 400);

    const callbackUrl = siteUrl.replace(/\/$/, '') + '/api/strava-webhook';

    try {
      const listRes  = await fetch(`${STRAVA}/push_subscriptions?${creds}`);
      const existing = await listRes.json();

      if (Array.isArray(existing)) {
        for (const sub of existing) {
          if (sub.callback_url === callbackUrl) {
            return json({ ok: true, already: true, subscription: sub });
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
        return json({ error: data.message || 'Erreur Strava', details: data }, createRes.status);
      }
      return json({ ok: true, already: false, subscription: data });
    } catch (e) {
      return json({ error: 'Erreur: ' + e.message }, 500);
    }
  }

  // ── DELETE : supprimer un abonnement ─────────────────────────
  if (request.method === 'DELETE') {
    const id = url.searchParams.get('id');
    if (!id) return json({ error: 'id requis' }, 400);
    try {
      await fetch(`${STRAVA}/push_subscriptions/${id}?${creds}`, { method: 'DELETE' });
      return json({ ok: true });
    } catch (e) {
      return json({ error: 'Erreur: ' + e.message }, 500);
    }
  }

  return json({ error: 'Méthode non autorisée' }, 405);
}
