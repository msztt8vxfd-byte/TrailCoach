// netlify/functions/athlete-data.js
// Base de données athlètes via Netlify Blobs — lecture par PIN, écriture par COACH_TOKEN

const { getStore } = require('@netlify/blobs');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-Coach-Token',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Content-Type': 'application/json',
};

function resp(statusCode, body) {
  return { statusCode, headers: CORS, body: JSON.stringify(body) };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  let store;
  try {
    store = getStore('athletes');
  } catch (e) {
    return resp(503, { error: 'Base de données indisponible. Déploie sur Netlify pour activer.' });
  }

  // ── GET : l'athlète récupère ses données (lecture par PIN) ──
  if (event.httpMethod === 'GET') {
    const { id, pin } = event.queryStringParameters || {};
    if (!id || !pin) return resp(400, { error: 'id et pin requis' });

    let data;
    try {
      data = await store.get(`athlete-${id}`, { type: 'json' });
    } catch (e) {
      return resp(500, { error: 'Erreur lecture: ' + e.message });
    }

    if (!data) return resp(404, { error: 'Athlète introuvable' });
    if (String(data.pin) !== String(pin)) return resp(401, { error: 'PIN incorrect' });

    const { pin: _pin, ...publicData } = data;
    return resp(200, publicData);
  }

  // ── POST : le coach sauvegarde les données (écriture par COACH_TOKEN) ──
  if (event.httpMethod === 'POST') {
    const coachToken = event.headers['x-coach-token'] || '';
    const COACH_TOKEN = process.env.COACH_TOKEN;

    if (!COACH_TOKEN) {
      return resp(503, { error: 'COACH_TOKEN manquant dans les variables Netlify', hint: 'Ajoute COACH_TOKEN dans Site configuration → Environment variables' });
    }
    if (coachToken !== COACH_TOKEN) return resp(401, { error: 'Token coach invalide' });

    let body;
    try { body = JSON.parse(event.body || '{}'); } catch (e) {
      return resp(400, { error: 'JSON invalide' });
    }

    const { id } = body;
    if (!id) return resp(400, { error: 'id requis' });

    try {
      // Préserve les statuts "réalisé" confirmés par l'athlète côté cloud
      const existing = await store.get(`athlete-${id}`, { type: 'json' }).catch(() => null);
      if (existing) {
        const doneByAthlete = {};
        (existing.sessions || []).forEach(s => { if (s.ok) doneByAthlete[s.id] = true; });
        body.sessions = (body.sessions || []).map(s => ({
          ...s,
          ok: s.ok || doneByAthlete[s.id] || false,
        }));
      }

      await store.setJSON(`athlete-${id}`, { ...body, updatedAt: new Date().toISOString() });
      return resp(200, { ok: true });
    } catch (e) {
      return resp(500, { error: 'Erreur sauvegarde: ' + e.message });
    }
  }

  // ── PATCH : l'athlète marque une séance réalisée/non réalisée (auth par PIN) ──
  if (event.httpMethod === 'PATCH') {
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch (e) {
      return resp(400, { error: 'JSON invalide' });
    }

    const { id, pin, sessId, done } = body;
    if (!id || !pin || sessId == null || done == null) {
      return resp(400, { error: 'id, pin, sessId et done requis' });
    }

    let data;
    try {
      data = await store.get(`athlete-${id}`, { type: 'json' });
    } catch (e) {
      return resp(500, { error: 'Erreur lecture: ' + e.message });
    }

    if (!data) return resp(404, { error: 'Athlète introuvable' });
    if (String(data.pin) !== String(pin)) return resp(401, { error: 'PIN incorrect' });

    // Seul le champ `ok` de la séance ciblée est modifiable
    const found = (data.sessions || []).some(s => s.id === sessId);
    if (!found) return resp(404, { error: 'Séance introuvable' });

    data.sessions = data.sessions.map(s =>
      s.id === sessId ? { ...s, ok: Boolean(done) } : s
    );
    data.updatedAt = new Date().toISOString();

    try {
      await store.setJSON(`athlete-${id}`, data);
      return resp(200, { ok: true });
    } catch (e) {
      return resp(500, { error: 'Erreur sauvegarde: ' + e.message });
    }
  }

  // ── DELETE : le coach supprime un athlète ──
  if (event.httpMethod === 'DELETE') {
    const coachToken = event.headers['x-coach-token'] || '';
    if (coachToken !== process.env.COACH_TOKEN) return resp(401, { error: 'Token coach invalide' });

    const { id } = event.queryStringParameters || {};
    if (!id) return resp(400, { error: 'id requis' });

    try {
      await store.delete(`athlete-${id}`);
      return resp(200, { ok: true });
    } catch (e) {
      return resp(500, { error: 'Erreur suppression: ' + e.message });
    }
  }

  return resp(405, { error: 'Méthode non autorisée' });
};
