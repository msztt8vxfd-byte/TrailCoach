// api/athlete-data.js
// Base de données athlètes via Vercel KV — lecture par PIN, écriture par COACH_TOKEN

const { kv } = require('@vercel/kv');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-Coach-Token',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
};

function resp(res, statusCode, body) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  return res.status(statusCode).json(body);
}

module.exports = async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── GET : l'athlète récupère ses données (lecture par PIN) ──
  if (req.method === 'GET') {
    const { id, pin } = req.query || {};
    if (!id || !pin) return resp(res, 400, { error: 'id et pin requis' });

    let data;
    try {
      data = await kv.get(`athlete-${id}`);
    } catch (e) {
      return resp(res, 500, { error: 'Erreur lecture: ' + e.message });
    }

    if (!data) return resp(res, 404, { error: 'Athlète introuvable' });
    if (String(data.pin) !== String(pin)) return resp(res, 401, { error: 'PIN incorrect' });

    const { pin: _pin, ...publicData } = data;
    return resp(res, 200, publicData);
  }

  // ── POST : le coach sauvegarde les données (écriture par COACH_TOKEN) ──
  if (req.method === 'POST') {
    const coachToken = req.headers['x-coach-token'] || '';
    const COACH_TOKEN = process.env.COACH_TOKEN;

    if (!COACH_TOKEN) {
      return resp(res, 503, { error: 'COACH_TOKEN manquant dans les variables Vercel', hint: 'Ajoute COACH_TOKEN dans Settings → Environment Variables' });
    }
    if (coachToken !== COACH_TOKEN) return resp(res, 401, { error: 'Token coach invalide' });

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { id } = body;
    if (!id) return resp(res, 400, { error: 'id requis' });

    try {
      const existing = await kv.get(`athlete-${id}`).catch(() => null);
      if (existing) {
        const doneByAthlete = {};
        (existing.sessions || []).forEach(s => { if (s.ok) doneByAthlete[s.id] = true; });
        body.sessions = (body.sessions || []).map(s => ({
          ...s,
          ok: s.ok || doneByAthlete[s.id] || false,
        }));
      }

      await kv.set(`athlete-${id}`, { ...body, updatedAt: new Date().toISOString() });
      return resp(res, 200, { ok: true });
    } catch (e) {
      return resp(res, 500, { error: 'Erreur sauvegarde: ' + e.message });
    }
  }

  // ── PATCH : l'athlète marque une séance réalisée/non réalisée (auth par PIN) ──
  if (req.method === 'PATCH') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { id, pin, sessId, done } = body;
    if (!id || !pin || sessId == null || done == null) {
      return resp(res, 400, { error: 'id, pin, sessId et done requis' });
    }

    let data;
    try {
      data = await kv.get(`athlete-${id}`);
    } catch (e) {
      return resp(res, 500, { error: 'Erreur lecture: ' + e.message });
    }

    if (!data) return resp(res, 404, { error: 'Athlète introuvable' });
    if (String(data.pin) !== String(pin)) return resp(res, 401, { error: 'PIN incorrect' });

    const found = (data.sessions || []).some(s => s.id === sessId);
    if (!found) return resp(res, 404, { error: 'Séance introuvable' });

    data.sessions = data.sessions.map(s =>
      s.id === sessId ? { ...s, ok: Boolean(done) } : s
    );
    data.updatedAt = new Date().toISOString();

    try {
      await kv.set(`athlete-${id}`, data);
      return resp(res, 200, { ok: true });
    } catch (e) {
      return resp(res, 500, { error: 'Erreur sauvegarde: ' + e.message });
    }
  }

  // ── DELETE : le coach supprime un athlète ──
  if (req.method === 'DELETE') {
    const coachToken = req.headers['x-coach-token'] || '';
    if (coachToken !== process.env.COACH_TOKEN) return resp(res, 401, { error: 'Token coach invalide' });

    const { id } = req.query || {};
    if (!id) return resp(res, 400, { error: 'id requis' });

    try {
      await kv.del(`athlete-${id}`);
      return resp(res, 200, { ok: true });
    } catch (e) {
      return resp(res, 500, { error: 'Erreur suppression: ' + e.message });
    }
  }

  return resp(res, 405, { error: 'Méthode non autorisée' });
};
