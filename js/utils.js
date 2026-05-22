// utils.js — shared constants and helpers for both coach and athlete interfaces

const ICONS   = { EF:'🏃', FRAC:'🔥', TRAIL:'🏔', TEMPO:'⚡', RECUP:'♻' };
const PILLS   = { EF:'tp-ef', FRAC:'tp-frac', TRAIL:'tp-trail', TEMPO:'tp-tempo', RECUP:'tp-recup' };
const LABELS  = { EF:'EF', FRAC:'FRAC', TRAIL:'TRAIL', TEMPO:'TEMPO', RECUP:'RÉCUP' };
const DAYS_SHORT = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
const DAYS_LONG  = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
const MONTHS     = ['jan','fév','mars','avr','mai','juin','juil','août','sep','oct','nov','déc'];

function fmtDist(m) {
  return m >= 1000 ? (m/1000).toFixed(1)+' km' : m+'m';
}

function fmtDur(s) {
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60);
  return h ? `${h}h${String(m).padStart(2,'0')}` : `${m}min`;
}

function fmtPace(secPerM) {
  if (!secPerM) return null;
  const mpm = secPerM * 1000 / 60;
  const m = Math.floor(mpm);
  const s = Math.round((mpm - m) * 60);
  return `${m}:${String(s).padStart(2,'0')}/km`;
}

function fmtDate(iso) {
  const dt = new Date(iso);
  return `${dt.getDate()} ${MONTHS[dt.getMonth()]}`;
}

function getMon(offset = 0) {
  const d = new Date(); d.setHours(0,0,0,0);
  const dw = d.getDay();
  d.setDate(d.getDate() - (dw === 0 ? 6 : dw - 1) + (offset * 7));
  return d;
}

function dayIdx(d) {
  return d.getDay() === 0 ? 6 : d.getDay() - 1;
}

function showToast(msg, type = '', dur = 2800) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast ' + (type || '');
  void t.offsetWidth;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), dur);
}
