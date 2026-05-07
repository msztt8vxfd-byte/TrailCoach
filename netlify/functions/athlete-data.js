// netlify/functions/athlete-data.js
// Base de données athlètes via Netlify Blobs — lecture par PIN, écriture par COACH_TOKEN

const { getStore } = require('@netlify/blobs');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-Coach-Token',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
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

    // Ne jamais renvoyer le PIN au client
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
      await store.setJSON(`athlete-${id}`, { ...body, updatedAt: new Date().toISOString() });
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
