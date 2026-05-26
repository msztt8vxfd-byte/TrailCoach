// functions/api/athlete-data.js
// Cloudflare Pages Function — stockage athlètes via Cloudflare KV
// GET  : lecture par PIN (athlète)
// POST : écriture complète par COACH_TOKEN (coach)
// PATCH: marquer séance réalisée/non réalisée par PIN (athlète)
// DELETE: suppression par COACH_TOKEN (coach)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-Coach-Token',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Content-Type': 'application/json',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response('', { status: 200, headers: CORS });
  }

  const KV = env.ATHLETES_KV;
  if (!KV) {
    return json({ error: 'Cloudflare KV non configuré. Ajoute le binding ATHLETES_KV dans le dashboard Cloudflare → Workers & Pages → Settings → KV Namespace Bindings.' }, 503);
  }

  const url = new URL(request.url);

  // ── GET : athlète lit ses données (auth par PIN) ──────────────
  if (request.method === 'GET') {
    const id  = url.searchParams.get('id');
    const pin = url.searchParams.get('pin');
    if (!id || !pin) return json({ error: 'id et pin requis' }, 400);

    let data;
    try {
      data = await KV.get(`athlete-${id}`, { type: 'json' });
    } catch (e) {
      return json({ error: 'Erreur lecture: ' + e.message }, 500);
    }

    if (!data) return json({ error: 'Athlète introuvable' }, 404);
    if (String(data.pin) !== String(pin)) return json({ error: 'PIN incorrect' }, 401);

    const { pin: _pin, ...publicData } = data;
    return json(publicData);
  }

  // ── POST : coach sauvegarde données complètes ─────────────────
  if (request.method === 'POST') {
    const coachToken = request.headers.get('x-coach-token') || '';
    const COACH_TOKEN = env.COACH_TOKEN;

    if (!COACH_TOKEN) {
      return json({ error: 'COACH_TOKEN manquant dans les variables Cloudflare', hint: 'Ajoute COACH_TOKEN dans Workers & Pages → Settings → Environment Variables' }, 503);
    }
    if (coachToken !== COACH_TOKEN) return json({ error: 'Token coach invalide' }, 401);

    let body;
    try { body = await request.json(); } catch {
      return json({ error: 'JSON invalide' }, 400);
    }

    const { id } = body;
    if (!id) return json({ error: 'id requis' }, 400);

    try {
      // Préserve les statuts "réalisé" déjà confirmés par l'athlète
      const existing = await KV.get(`athlete-${id}`, { type: 'json' }).catch(() => null);
      if (existing) {
        const doneByAthlete = {};
        (existing.sessions || []).forEach(s => { if (s.ok) doneByAthlete[s.id] = true; });
        body.sessions = (body.sessions || []).map(s => ({
          ...s,
          ok: s.ok || doneByAthlete[s.id] || false,
        }));
      }

      await KV.put(`athlete-${id}`, JSON.stringify({ ...body, updatedAt: new Date().toISOString() }));
      return json({ ok: true });
    } catch (e) {
      return json({ error: 'Erreur sauvegarde: ' + e.message }, 500);
    }
  }

  // ── PATCH : athlète marque une séance réalisée/non réalisée ───
  if (request.method === 'PATCH') {
    let body;
    try { body = await request.json(); } catch {
      return json({ error: 'JSON invalide' }, 400);
    }

    const { id, pin, sessId, done } = body;
    if (!id || !pin || sessId == null || done == null) {
      return json({ error: 'id, pin, sessId et done requis' }, 400);
    }

    let data;
    try {
      data = await KV.get(`athlete-${id}`, { type: 'json' });
    } catch (e) {
      return json({ error: 'Erreur lecture: ' + e.message }, 500);
    }

    if (!data) return json({ error: 'Athlète introuvable' }, 404);
    if (String(data.pin) !== String(pin)) return json({ error: 'PIN incorrect' }, 401);

    const found = (data.sessions || []).some(s => s.id === sessId);
    if (!found) return json({ error: 'Séance introuvable' }, 404);

    data.sessions = data.sessions.map(s =>
      s.id === sessId ? { ...s, ok: Boolean(done) } : s
    );
    data.updatedAt = new Date().toISOString();

    try {
      await KV.put(`athlete-${id}`, JSON.stringify(data));
      return json({ ok: true });
    } catch (e) {
      return json({ error: 'Erreur sauvegarde: ' + e.message }, 500);
    }
  }

  // ── DELETE : coach supprime un athlète ────────────────────────
  if (request.method === 'DELETE') {
    const coachToken = request.headers.get('x-coach-token') || '';
    if (coachToken !== env.COACH_TOKEN) return json({ error: 'Token coach invalide' }, 401);

    const id = url.searchParams.get('id');
    if (!id) return json({ error: 'id requis' }, 400);

    try {
      await KV.delete(`athlete-${id}`);
      return json({ ok: true });
    } catch (e) {
      return json({ error: 'Erreur suppression: ' + e.message }, 500);
    }
  }

  return json({ error: 'Méthode non autorisée' }, 405);
}
