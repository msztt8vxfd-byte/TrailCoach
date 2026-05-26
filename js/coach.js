// coach.js — TrailCoach Pro dashboard logic + hash router

// ── Config & Constants ────────────────────────────────────────

const RACE_DATE = new Date('2026-07-18T05:00:00');
const SITE_URL  = window.location.origin + window.location.pathname.replace(/\/$/, '');
const API       = { token: '/api/strava-token', activities: '/api/strava-activities' };

const PROGRAMME = [
  {sem:'S1',  dates:'6–12 avr.',       phase:'charge',     label:'Base aérobie',        dp:490,  seances:'EF · PISTE · LONGUE',     done:true},
  {sem:'S2',  dates:'13–19 avr.',      phase:'charge',     label:'Base aérobie',        dp:680,  seances:'EF · PISTE · LONGUE',     done:true},
  {sem:'S3',  dates:'20–26 avr.',      phase:'charge',     label:'Base aérobie',        dp:900,  seances:'EF · PISTE · LONGUE',     done:true},
  {sem:'S4',  dates:'27 avr.–3 mai',   phase:'recup',      label:'Récupération',        dp:180,  seances:'RÉCUP · LONGUE légère',   done:true},
  {sem:'S5',  dates:'4–10 mai',        phase:'charge',     label:'Lissage',             dp:680,  seances:'TEMPO · FRAC · LONGUE',   done:false},
  {sem:'S6',  dates:'11–17 mai',       phase:'contrainte', label:'Recharge contrainte', dp:200,  seances:'EF douce · Marche',       done:false},
  {sem:'S7',  dates:'18–24 mai',       phase:'charge',     label:'Spécifique',          dp:900,  seances:'TEMPO · FRAC · LONGUE',   done:false},
  {sem:'S8',  dates:'25–31 mai',       phase:'charge',     label:'Spécifique',          dp:1100, seances:'TEMPO · FRAC · LONGUE',   done:false},
  {sem:'S9',  dates:'1–7 juin',        phase:'pic',        label:'B2B 🔑',              dp:1400, seances:'TEMPO · B2B J1 · B2B J2', done:false},
  {sem:'S10', dates:'8–14 juin',       phase:'recup',      label:'Récup post-B2B',      dp:430,  seances:'RÉCUP · EF · LONGUE',     done:false},
  {sem:'S11', dates:'15–21 juin',      phase:'contrainte', label:'Recharge contrainte', dp:150,  seances:'EF douce · LONGUE dim.',  done:false},
  {sem:'S12', dates:'22–28 juin',      phase:'pic',        label:'🔑 PIC ABSOLU',       dp:1450, seances:'TEMPO · FRAC · LONGUE',   done:false},
  {sem:'S13', dates:'29 juin–5 juil.', phase:'charge',     label:'Consolidation',       dp:1100, seances:'TEMPO · FRAC · LONGUE',   done:false},
  {sem:'S14', dates:'6–12 juil.',      phase:'affutage',   label:'Affûtage',            dp:480,  seances:'EF · FRAC courtes',       done:false},
  {sem:'S15', dates:'13–19 juil.',     phase:'affutage',   label:'Affûtage final 🏁',   dp:210,  seances:'EF · Activation · RACE',  done:false},
];

const PHASE_BADGES = {
  charge:    '<span class="phase-badge ph-charge">Charge</span>',
  recup:     '<span class="phase-badge ph-recup">Récup ♻</span>',
  pic:       '<span class="phase-badge ph-pic">PIC 🔑</span>',
  contrainte:'<span class="phase-badge ph-contrainte">Recharge ⚠</span>',
  affutage:  '<span class="phase-badge ph-affutage">Affûtage</span>',
};
const TYPE_CLASS = { EF:'ef', FRAC:'frac', TRAIL:'trail', TEMPO:'tempo', RECUP:'recup' };
const TYPE_PILL  = { EF:'tp-ef', FRAC:'tp-frac', TRAIL:'tp-trail', TEMPO:'tp-tempo', RECUP:'tp-recup' };
const TYPE_ICONS = { EF:'🏃', FRAC:'🔥', TRAIL:'🏔', TEMPO:'⚡', RECUP:'♻' };

// ── State ─────────────────────────────────────────────────────

const S = {
  stravaClientId: '',
  coachToken: '',
  athletes: [],
  sessions: [],
  activities: [],
  notes: [],
  currentAthlete: 0,
  analyseAthlete: 0,
  weekOffset: 0,
  progFilter: 'all',
  nextId: 200,
};

let _pickedColor = '#e8ff47';

function save() { try { localStorage.setItem('trailcoach_pro_v2', JSON.stringify(S)); } catch(e){} }
function load() {
  try {
    const d = JSON.parse(localStorage.getItem('trailcoach_pro_v2') || 'null');
    if (d) { Object.assign(S, d); return true; }
  } catch(e){}
  return false;
}
function uid() { return ++S.nextId; }

// ── Demo data ─────────────────────────────────────────────────

function loadDemoData() {
  S.athletes = [
    {id:1,prenom:'Lucas',  nom:'Martin', email:'lucas@ex.com',  disc:'Trail',  niv:'Semi-Pro',    obj:'UTMB 2026',      color:'#e8ff47',token:null,refreshToken:null,expiresAt:0,stravaId:null},
    {id:2,prenom:'Camille',nom:'Renard', email:'cam@ex.com',    disc:'CAP',    niv:'Compétition', obj:'10km en 40min',  color:'#ff6b35',token:null,refreshToken:null,expiresAt:0,stravaId:null},
    {id:3,prenom:'Thomas', nom:'Blanc',  email:'thomas@ex.com', disc:'Trail',  niv:'Amateur',     obj:'GTVO 2026',      color:'#4da6ff',token:null,refreshToken:null,expiresAt:0,stravaId:null},
    {id:4,prenom:'Sarah',  nom:'Klein',  email:'sarah@ex.com',  disc:'CAP',    niv:'Loisir',      obj:'Marathon Paris', color:'#a78bfa',token:null,refreshToken:null,expiresAt:0,stravaId:null},
    {id:5,prenom:'Marc',   nom:'Dumont', email:'marc@ex.com',   disc:'Trail',  niv:'Semi-Pro',    obj:'GTVO Top 50',    color:'#2ecc8a',token:null,refreshToken:null,expiresAt:0,stravaId:null},
  ];
  const now = new Date();
  const mon = new Date(now); mon.setDate(now.getDate()-now.getDay()+1); mon.setHours(9,0,0,0);
  const d = (delta,h=9) => { const x=new Date(mon); x.setDate(x.getDate()+delta); x.setHours(h,0,0,0); return x.toISOString(); };

  S.sessions = [
    {id:101,athId:1,date:d(0), titre:'Endurance fondamentale',  type:'EF',   dur:60, dist:12,  dp:80,   allure:'5:00/km',desc:'EF Z2 allure facile.',done:true},
    {id:102,athId:1,date:d(1), titre:'Fractionné 6×1000m',      type:'FRAC', dur:75, dist:14,  dp:null, allure:'3:55/km',desc:'6×1000m R:90s',       done:false},
    {id:103,athId:1,date:d(3), titre:'Tempo 30min seuil',        type:'TEMPO',dur:50, dist:11,  dp:null, allure:'4:15/km',desc:'',                    done:false},
    {id:104,athId:1,date:d(5), titre:'Sortie longue trail',      type:'TRAIL',dur:180,dist:32,  dp:850,  allure:null,     desc:'Ravi tous 45min.',    done:false},
    {id:105,athId:2,date:d(0), titre:'Fractionné 4×1500m',       type:'FRAC', dur:65, dist:12,  dp:null, allure:'4:05/km',desc:'',                    done:true},
    {id:106,athId:2,date:d(2), titre:'EF 1h',                    type:'EF',   dur:60, dist:11,  dp:null, allure:'5:15/km',desc:'',                    done:true},
    {id:107,athId:2,date:d(6), titre:'Trail 2h',                 type:'TRAIL',dur:120,dist:22,  dp:400,  allure:null,     desc:'',                    done:false},
    {id:108,athId:3,date:d(1), titre:'EF 45min',                 type:'EF',   dur:45, dist:8.5, dp:null, allure:'5:45/km',desc:'',                    done:true},
    {id:109,athId:3,date:d(5), titre:'Trail 3h +600m D+',        type:'TRAIL',dur:180,dist:26,  dp:600,  allure:null,     desc:'Marche en montée.',   done:false},
    {id:110,athId:4,date:d(0), titre:'EF 50min',                 type:'EF',   dur:50, dist:8.5, dp:null, allure:'6:00/km',desc:'',                    done:true},
    {id:111,athId:5,date:d(0), titre:'Récup active',             type:'RECUP',dur:30, dist:5,   dp:null, allure:'6:30/km',desc:'',                    done:true},
    {id:112,athId:5,date:d(5), titre:'Sortie trail 4h',          type:'TRAIL',dur:240,dist:40,  dp:1200, allure:null,     desc:'Bâtons obligatoires.',done:false},
  ];
  S.activities = [
    {id:501,athId:1,stravaId:null,nom:'EF matin',          type:'Run',     date:d(0,7), distM:12800,sec:3720, dp:85, fc:142,allur:0.2906},
    {id:502,athId:1,stravaId:null,nom:'Trail du dimanche', type:'TrailRun',date:d(-2,8),distM:32400,sec:10680,dp:860,fc:155,allur:0.3296},
    {id:503,athId:2,stravaId:null,nom:'Fractionné 4×1500m',type:'Run',     date:d(0,17),distM:12200,sec:4200, dp:42, fc:168,allur:0.3443},
    {id:504,athId:3,stravaId:null,nom:'EF 45min',          type:'Run',     date:d(1,6), distM:8200, sec:2820, dp:60, fc:145,allur:0.344},
    {id:505,athId:4,stravaId:null,nom:'EF mardi',          type:'Run',     date:d(0,7), distM:8700, sec:3300, dp:40, fc:140,allur:0.3793},
    {id:506,athId:5,stravaId:null,nom:'Récup légère',      type:'Run',     date:d(0,8), distM:5200, sec:2100, dp:30, fc:132,allur:0.4038},
  ];
  S.notes = [
    {id:301,athId:1,date:new Date().toISOString(),txt:'Belle sortie trail ! Bien géré l\'allure. Attention hydratation.'},
    {id:302,athId:2,date:new Date().toISOString(),txt:'Super fractionné, allures sous la cible. À confirmer vendredi.'},
  ];
  save();
}

// ── Helpers ───────────────────────────────────────────────────

const initials  = a => (a.prenom[0]+a.nom[0]).toUpperCase();
const fmtAllur  = a => fmtPace(a) || '—';
const fmtDateL  = iso => new Date(iso).toLocaleString('fr-FR',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});

function getWeekNum(d) {
  const jan = new Date(d.getFullYear(),0,1);
  return Math.ceil((((d-jan)/86400000)+jan.getDay()+1)/7);
}

function getCurrentSem() {
  const now=new Date();
  const r=[
    ['2026-04-06','2026-04-12','S1'],['2026-04-13','2026-04-19','S2'],
    ['2026-04-20','2026-04-26','S3'],['2026-04-27','2026-05-03','S4'],
    ['2026-05-04','2026-05-10','S5'],['2026-05-11','2026-05-17','S6'],
    ['2026-05-18','2026-05-24','S7'],['2026-05-25','2026-05-31','S8'],
    ['2026-06-01','2026-06-07','S9'],['2026-06-08','2026-06-14','S10'],
    ['2026-06-15','2026-06-21','S11'],['2026-06-22','2026-06-28','S12'],
    ['2026-06-29','2026-07-05','S13'],['2026-07-06','2026-07-12','S14'],
    ['2026-07-13','2026-07-19','S15'],
  ];
  for(const [s,e,sem] of r) if(now>=new Date(s)&&now<=new Date(e)) return sem;
  return now<new Date('2026-04-06')?'S1':'S15';
}

function getAthlete(id) { return S.athletes.find(a=>a.id===id)||S.athletes[0]; }
function getAthleteSessions(athId) {
  const mon=getMon(S.weekOffset), sun=new Date(mon); sun.setDate(mon.getDate()+7);
  return S.sessions.filter(s=>s.athId===athId&&new Date(s.date)>=mon&&new Date(s.date)<sun);
}

// ── Strava OAuth ──────────────────────────────────────────────

function getStravaAuthUrl(athId) {
  const redirect = encodeURIComponent(SITE_URL + '/?strava_callback=1');
  return `https://www.strava.com/oauth/authorize`
    + `?client_id=${S.stravaClientId}`
    + `&redirect_uri=${redirect}`
    + `&response_type=code`
    + `&approval_prompt=auto`
    + `&scope=read,activity:read_all`
    + `&state=${athId}`;
}

async function exchangeCode(code, athId) {
  showToast('⟳ Connexion Strava en cours…', 'info');
  try {
    const resp = await fetch(API.token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, grant_type: 'authorization_code' }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Erreur Strava');
    const ath = S.athletes.find(a => a.id === parseInt(athId));
    if (ath && data.access_token) {
      ath.token        = data.access_token;
      ath.refreshToken = data.refresh_token;
      ath.expiresAt    = data.expires_at;
      if (data.athlete) {
        ath.stravaId      = data.athlete.id;
        ath.stravaProfile = data.athlete.profile;
        ath.stravaCity    = data.athlete.city;
      }
      save();
      showToast(`⚡ Strava connecté pour ${ath.prenom} !`, 'ok');
      await fetchActivities(ath);
      renders[currentView]?.();
    }
  } catch(e) {
    showToast('❌ ' + e.message, 'err');
  }
}

async function refreshToken(ath) {
  if (!ath.refreshToken) return false;
  try {
    const resp = await fetch(API.token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grant_type: 'refresh_token', refresh_token: ath.refreshToken }),
    });
    const data = await resp.json();
    if (data.access_token) {
      ath.token        = data.access_token;
      ath.refreshToken = data.refresh_token;
      ath.expiresAt    = data.expires_at;
      save();
      return true;
    }
  } catch(e) {}
  return false;
}

async function fetchActivities(ath) {
  if (!ath.token) return;
  if (ath.expiresAt && Date.now()/1000 > ath.expiresAt - 300) {
    const ok = await refreshToken(ath);
    if (!ok) { showToast(`Token expiré pour ${ath.prenom} — reconnexion requise`, 'err'); return; }
  }
  try {
    const after = Math.floor(new Date('2026-03-01').getTime() / 1000);
    const resp = await fetch(`${API.activities}?per_page=50&after=${after}`, {
      headers: { 'Authorization': `Bearer ${ath.token}` },
    });
    if (!resp.ok) { if(resp.status===401) { ath.token=null; save(); } return; }
    const acts = await resp.json();
    acts.forEach(a => {
      const exists = S.activities.find(x => x.stravaId === a.id && x.athId === ath.id);
      if (!exists) {
        S.activities.push({
          id:uid(), athId:ath.id, stravaId:a.id,
          nom:a.nom, type:a.type, date:a.date,
          distM:a.distanceM, sec:a.dureeSec, dp:a.denivele,
          fc:a.fc, fcMax:a.fcMax, allur:a.alluRaw, stravaUrl:a.stravaUrl,
        });
      } else {
        Object.assign(exists, { nom:a.nom, distM:a.distanceM, sec:a.dureeSec, dp:a.denivele, fc:a.fc, allur:a.alluRaw });
      }
    });
    save();
    return acts.length;
  } catch(e) {
    console.error('fetchActivities error:', e);
  }
}

async function syncAllStrava() {
  const connected = S.athletes.filter(a => a.token);
  if (!connected.length) { showToast('Aucun athlète connecté à Strava', 'info'); return; }
  document.getElementById('sync-btn').innerHTML = '<span class="spin">⟳</span> Sync…';
  let total = 0;
  for (const a of connected) { const n = await fetchActivities(a); if (n) total += n; }
  document.getElementById('sync-btn').innerHTML = '⚡ Sync Strava';
  showToast(`✅ ${total} nouvelles activités chargées`, 'ok');
  renders[currentView]?.();
}

async function syncCurrentAthlete() {
  const a = S.athletes[S.currentAthlete];
  if (!a?.token) { showToast('Athlète non connecté à Strava', 'err'); return; }
  document.getElementById('ath-sync-btn').innerHTML = '<span class="spin">⟳</span>';
  const n = await fetchActivities(a);
  document.getElementById('ath-sync-btn').innerHTML = 'Sync';
  showToast(n ? `✅ ${n} activités chargées` : 'Déjà à jour', 'ok');
  if(n) syncAthleteToCloud(a.id);
  updateAthletePanel();
}

function connectAthleteStrava(athId) {
  const id = athId || S.athletes[S.currentAthlete]?.id;
  if (!id) return;
  if (!S.stravaClientId) {
    showToast('Configure ton Client ID Strava dans Setup', 'err');
    document.getElementById('setup').style.display='flex';
    return;
  }
  const url = getStravaAuthUrl(id);
  document.getElementById('strava-connect-url').textContent = url;
  openModal('stravaConnect');
}

function copyStravaUrl() {
  navigator.clipboard.writeText(document.getElementById('strava-connect-url').textContent)
    .then(() => showToast('✓ Lien copié !', 'ok'));
}

function saveManualToken() {
  const token = document.getElementById('manual-token').value.trim();
  const a = S.athletes[S.currentAthlete];
  if (token && a) {
    a.token = token; a.expiresAt = Date.now()/1000 + 21600;
    save(); closeModal('stravaConnect');
    showToast(`⚡ Token enregistré pour ${a.prenom}`, 'ok');
    fetchActivities(a).then(() => renders[currentView]?.());
  }
}

// ── Setup ─────────────────────────────────────────────────────

function saveSetup() {
  const cid = document.getElementById('setup-cid').value.trim();
  S.stravaClientId = cid;
  save();
  document.getElementById('setup').style.display = 'none';
  showToast(cid ? '✅ Client ID Strava enregistré !' : 'Mode démo activé', 'ok');
}

function skipSetup() {
  document.getElementById('setup').style.display = 'none';
  showToast('Mode démo — données exemple chargées', 'info');
}

// ── View switching + hash router ──────────────────────────────

let currentView = 'dashboard';
const renders = {};

function showView(id, tabEl, sideEl) {
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('.top-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.getElementById('view-'+id).classList.add('active');
  if (tabEl) tabEl.classList.add('active');
  else { const t = document.querySelector(`.top-tab[data-view="${id}"]`); if(t) t.classList.add('active'); }
  if (sideEl) sideEl.classList.add('active');
  else { const n = document.querySelector(`.nav-item[data-view="${id}"]`); if(n) n.classList.add('active'); }
  currentView = id;
  history.replaceState(null, '', '/#/' + id);
  renders[id]?.();
}

// ── Render Dashboard ──────────────────────────────────────────

renders.dashboard = function() {
  const now = new Date();
  const days = Math.ceil((RACE_DATE - now) / 86400000);
  document.getElementById('countdown-top').innerHTML = `J−<strong>${days>0?days:'🏁'}</strong>`;
  document.getElementById('dash-date').textContent = now.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});

  const mon=getMon(), sun=new Date(mon); sun.setDate(mon.getDate()+7);
  const weekSess = S.sessions.filter(s=>new Date(s.date)>=mon&&new Date(s.date)<sun);
  const doneCount = weekSess.filter(s=>s.done).length;
  const weekActs = S.activities.filter(a=>new Date(a.date)>=mon&&new Date(a.date)<sun);
  const totalKm = weekActs.reduce((acc,a)=>acc+(a.distM/1000),0);
  const comp = weekSess.length ? Math.round(doneCount/weekSess.length*100) : 0;

  // Previous week metrics for trend comparison
  const prevMon=getMon(-1), prevSun=new Date(prevMon); prevSun.setDate(prevMon.getDate()+7);
  const prevWeekSess = S.sessions.filter(s=>new Date(s.date)>=prevMon&&new Date(s.date)<prevSun);
  const prevDoneCount = prevWeekSess.filter(s=>s.done).length;
  const prevWeekActs = S.activities.filter(a=>new Date(a.date)>=prevMon&&new Date(a.date)<prevSun);
  const prevTotalKm = prevWeekActs.reduce((acc,a)=>acc+(a.distM/1000),0);
  const prevComp = prevWeekSess.length ? Math.round(prevDoneCount/prevWeekSess.length*100) : 0;

  document.getElementById('kpi-ath').textContent = S.athletes.length;
  document.getElementById('kpi-sess').textContent = weekSess.length;
  document.getElementById('kpi-sess-sub').textContent = `${doneCount} réalisées · ${weekSess.length-doneCount} à venir`;
  document.getElementById('kpi-km').textContent = totalKm ? Math.round(totalKm)+'km' : '—';
  document.getElementById('kpi-comp').textContent = weekSess.length ? comp+'%' : '—';

  // Render trend indicators
  document.getElementById('kpi-sess-trend').innerHTML = renderTrend(weekSess.length, prevWeekSess.length);
  document.getElementById('kpi-km-trend').innerHTML = renderTrend(totalKm, prevTotalKm);
  document.getElementById('kpi-comp-trend').innerHTML = renderTrend(comp, prevComp, 'pp');

  document.getElementById('athletes-grid').innerHTML = S.athletes.map(a => {
    const aSess=getAthleteSessions(a.id);
    const aActs=S.activities.filter(x=>x.athId===a.id&&new Date(x.date)>=mon&&new Date(x.date)<sun);
    const km=aActs.reduce((acc,x)=>acc+(x.distM/1000),0);
    const done=aSess.filter(s=>s.done).length;
    const c=aSess.length?Math.round(done/aSess.length*100):0;

    // Previous week comparison
    const prevMon=getMon(-1), prevSun=new Date(prevMon); prevSun.setDate(prevMon.getDate()+7);
    const prevSess=S.sessions.filter(s=>s.athId===a.id&&new Date(s.date)>=prevMon&&new Date(s.date)<prevSun);
    const prevDone=prevSess.filter(s=>s.done).length;
    const prevC=prevSess.length?Math.round(prevDone/prevSess.length*100):0;
    const delta=c-prevC, trendArrow=delta>2?'↑':delta<-2?'↓':'→', trendColor=delta>2?'var(--green)':delta<-2?'var(--red)':'var(--text3)';

    const avgA=aActs.length?aActs.reduce((acc,x)=>acc+(x.allur||0),0)/aActs.length:null;
    const target=aSess.reduce((acc,s)=>acc+(s.dist||0),0);
    const pct=target?Math.min(Math.round(km/target*100),100):0;
    const status=c>=80?'ok':c>=50?'warn':'rest';
    return `<div class="ath-card" style="--ath-color:${a.color}" onclick="selectAthAndGo(${a.id})">
      <div class="ath-card-top">
        <div class="avatar av-md" style="background:${a.color}">${initials(a)}</div>
        <div class="ath-info"><div class="ath-name">${a.prenom} ${a.nom}</div><div class="ath-meta">${a.disc} · ${a.niv}</div>${a.token?'<div class="strava-tag">⚡ Strava</div>':''}</div>
        <div class="status-dot ${status}"></div>
      </div>
      <div class="ath-metrics">
        <div class="ath-metric"><div class="ath-metric-val">${km.toFixed(1)}km</div><div class="ath-metric-lbl">Cette sem.</div></div>
        <div class="ath-metric"><div class="ath-metric-val">${fmtAllur(avgA)}</div><div class="ath-metric-lbl">Allure</div></div>
        <div class="ath-metric"><div class="ath-metric-row"><span class="ath-metric-val">${c}%</span><span style="font-size:11px;font-weight:700;color:${trendColor}">${trendArrow}</span></div><div class="ath-metric-lbl">Complétion</div></div>
      </div>
      <div class="ath-prog">
        <div class="prog-row"><span>Volume hebdo</span><span>${km.toFixed(1)} / ${target}km</span></div>
        <div class="prog-track"><div class="prog-fill" style="width:${pct}%;background:${a.color}"></div></div>
      </div>
    </div>`;
  }).join('');

  const upcoming = S.sessions.filter(s=>!s.done&&new Date(s.date)>=now).sort((a,b)=>new Date(a.date)-new Date(b.date)).slice(0,5);
  document.getElementById('upcoming-sessions').innerHTML = upcoming.length
    ? upcoming.map(s=>{
        const a=getAthlete(s.athId); const d=new Date(s.date);
        return `<div class="session-item">
          <div class="sess-date-col"><div class="sess-day">${d.getDate()}</div><div class="sess-mon">${d.toLocaleString('fr',{month:'short'})}</div></div>
          <div class="sess-divider"></div>
          <div class="sess-info"><div class="sess-title">${TYPE_ICONS[s.type]||'🏃'} ${s.titre}</div><div class="sess-detail"><span style="color:${a.color};font-weight:600">${a.prenom}</span> · ${s.dur?s.dur+'min':'—'} · ${s.dist?s.dist+'km':'—'}</div></div>
          <div class="type-pill ${TYPE_PILL[s.type]||'tp-recup'}">${s.type}</div>
        </div>`;
      }).join('')
    : '<div class="empty-state"><div class="empty-icon">📅</div>Aucune séance à venir</div>';
};

// ── Render Planning ───────────────────────────────────────────

renders.planning = function() {
  const mon=getMon(S.weekOffset);
  const today=new Date(); today.setHours(0,0,0,0);
  const days=['LUN','MAR','MER','JEU','VEN','SAM','DIM'];
  const endDay=new Date(mon); endDay.setDate(mon.getDate()+6);
  document.getElementById('planning-week').textContent = `SEM ${getWeekNum(mon)}`;
  document.getElementById('planning-dates').textContent = `${mon.getDate()} ${mon.toLocaleString('fr',{month:'short'})} — ${endDay.getDate()} ${endDay.toLocaleString('fr',{month:'short'})} ${mon.getFullYear()}`;

  let html='<div class="week-strip">';
  html += '<div class="ws-header" style="background:var(--bg2)"></div>';
  for(let i=0;i<7;i++){
    const day=new Date(mon); day.setDate(mon.getDate()+i);
    const isT=day.getTime()===today.getTime();
    html+=`<div class="ws-header"><div class="ws-day-name">${days[i]}</div><div class="ws-day-num${isT?' today':''}">${day.getDate()}</div></div>`;
  }
  S.athletes.forEach(a=>{
    html+=`<div class="ws-ath-header"><div class="nav-dot" style="background:${a.color}"></div>${a.prenom}</div>`;
    for(let i=0;i<7;i++){
      const day=new Date(mon); day.setDate(mon.getDate()+i); day.setHours(0,0,0,0);
      const ds=S.sessions.filter(s=>{ const sd=new Date(s.date); sd.setHours(0,0,0,0); return s.athId===a.id&&sd.getTime()===day.getTime(); });
      const pills=ds.map(s=>`<div class="ws-pill wp-${TYPE_CLASS[s.type]||'recup'}${s.done?' wp-done':''}">${s.titre.slice(0,15)}${s.titre.length>15?'…':''}${s.done?' ✓':''}</div>`).join('');
      html+=`<div class="ws-cell">${pills}<div class="ws-add" onclick="openModal('addSession')">+</div></div>`;
    }
  });
  html+='</div>';
  document.getElementById('planning-grid').innerHTML=html;
};

function changeWeek(d) { S.weekOffset+=d; renders.planning(); }

// ── Render Programme ──────────────────────────────────────────

renders.programme = function() {
  const curSem=getCurrentSem();
  const doneCount=PROGRAMME.filter(p=>p.done).length;
  document.getElementById('prog-done-count').textContent=doneCount;

  const curProg=PROGRAMME.find(p=>p.sem===curSem);
  const alertMap={
    contrainte:`<div class="alert alert-warn">⚠ ${curSem} — Semaine recharge : volume minimal.</div>`,
    pic:       `<div class="alert alert-crit">🔑 ${curSem} — SEMAINE PIC : charge maximale. Soignez la récup nocturne.</div>`,
    recup:     `<div class="alert alert-ok">♻ ${curSem} — Semaine récup. EF douce uniquement.</div>`,
  };
  document.getElementById('prog-alert-box').innerHTML = alertMap[curProg?.phase] ||
    `<div class="alert alert-info">📅 ${curSem} en cours — ${curProg?.label||''}. ${curProg?.seances||''}</div>`;

  let tbody='';
  PROGRAMME.forEach(p=>{
    if(S.progFilter==='todo'&&p.done) return;
    if(S.progFilter==='done'&&!p.done&&p.sem!==curSem) return;
    const isCur=p.sem===curSem;
    const rowClass=(p.done?'done-week ':''+(isCur?'current-week ':''));
    const status=isCur
      ? '<span class="current-tag">▶ EN COURS</span>'
      : p.done
        ? '<span style="background:var(--green-dim);color:var(--green);font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px;font-family:var(--font-m)">✓ Réalisé</span>'
        : '<span style="color:var(--text3);font-size:10px">—</span>';
    tbody+=`<tr class="${rowClass.trim()}">
      <td><span class="sem-tag" style="color:${isCur?'var(--accent)':'var(--text2)'}">${p.sem}</span></td>
      <td style="font-size:11px;color:var(--text3)">${p.dates}</td>
      <td>${PHASE_BADGES[p.phase]||''}</td>
      <td style="font-family:var(--font-m);font-size:11px">${p.dp}m</td>
      <td style="font-size:11px;color:var(--text3)">${p.seances}</td>
      <td>${status}</td>
    </tr>`;
  });
  document.getElementById('prog-tbody').innerHTML=tbody;
};

function filterProg(f,el) {
  S.progFilter=f;
  document.querySelectorAll('.tab-inner-btn').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
  renders.programme();
}

// ── Render Analyse ────────────────────────────────────────────

renders.analyse = function() {
  document.getElementById('analyse-selector').innerHTML = S.athletes.map((a,i)=>
    `<div style="display:flex;align-items:center;gap:8px;padding:7px 12px;border-radius:8px;border:1px solid ${i===S.analyseAthlete?'rgba(232,255,71,.3)':'var(--border)'};background:${i===S.analyseAthlete?'var(--accent-dim)':'var(--surface)'};cursor:pointer;transition:all .15s" onclick="pickAnalyseAth(${i})">
      <div class="avatar av-sm" style="background:${a.color}">${initials(a)}</div>
      <div><div style="font-size:12px;font-weight:600">${a.prenom}</div><div style="font-size:10px;color:var(--text3)">${a.token?'⚡ Strava':a.disc}</div></div>
    </div>`).join('');
  updateAnalyseData();
};

function pickAnalyseAth(i) { S.analyseAthlete=i; renders.analyse(); }

function updateAnalyseData() {
  const a=S.athletes[S.analyseAthlete]; if(!a) return;
  const mon=getMon(), sun=new Date(mon); sun.setDate(mon.getDate()+7);
  const sess=S.sessions.filter(s=>s.athId===a.id&&new Date(s.date)>=mon&&new Date(s.date)<sun);
  const acts=S.activities.filter(x=>x.athId===a.id&&new Date(x.date)>=mon&&new Date(x.date)<sun);

  const pKm=sess.reduce((acc,s)=>acc+(s.dist||0),0);
  const rKm=acts.reduce((acc,x)=>acc+(x.distM/1000),0);
  const pDur=sess.reduce((acc,s)=>acc+(s.dur||0),0);
  const rDur=acts.reduce((acc,x)=>acc+(x.sec/60),0);
  const pDp=sess.reduce((acc,s)=>acc+(s.dp||0),0);
  const rDp=acts.reduce((acc,x)=>acc+(x.dp||0),0);

  const cbar=(label,pv,rv,unit)=>{
    const mx=Math.max(pv||.01,rv||.01);
    return `<div class="compare-section">
      <div class="compare-label">${label}</div>
      <div class="cbar-row"><div class="cbar-name">Prévu</div><div class="cbar-track"><div class="cbar-fill cf-plan" style="width:${pv?Math.round(pv/mx*100):0}%"></div></div><div class="cbar-val">${pv||0}${unit}</div></div>
      <div class="cbar-row"><div class="cbar-name">Réalisé</div><div class="cbar-track"><div class="cbar-fill cf-real" style="width:${rv?Math.round(rv/mx*100):0}%"></div></div><div class="cbar-val">${rv?rv.toFixed(1):0}${unit}</div></div>
    </div>`;
  };
  document.getElementById('compare-bars').innerHTML=
    cbar('Distance',pKm,rKm,'km')+cbar('Durée',pDur,rDur,'min')+(pDp||rDp?cbar('D+ Trail',pDp,rDp,'m'):'');

  const wls=[];
  for(let i=-5;i<=0;i++) wls.push({lbl:`S${getWeekNum(getMon(i))}`,mon:getMon(i)});
  const allSessForAth=S.sessions.filter(s=>s.athId===a.id);
  const allActsForAth=S.activities.filter(x=>x.athId===a.id);
  const maxDp=Math.max(200,...wls.map(w=>{
    const we=new Date(w.mon.getTime()+7*86400000);
    return allSessForAth.filter(s=>new Date(s.date)>=w.mon&&new Date(s.date)<we).reduce((acc,s)=>acc+(s.dp||0),0);
  }));
  document.getElementById('dp-bar-chart').innerHTML=wls.map(w=>{
    const we=new Date(w.mon.getTime()+7*86400000);
    const wSess=allSessForAth.filter(s=>new Date(s.date)>=w.mon&&new Date(s.date)<we);
    const wActs=allActsForAth.filter(x=>new Date(x.date)>=w.mon&&new Date(x.date)<we);
    const plan=wSess.reduce((acc,s)=>acc+(s.dp||0),0);
    const real=wActs.reduce((acc,x)=>acc+(x.dp||0),0);
    const hP=plan?Math.max(4,Math.round(plan/maxDp*100)):2;
    const hR=real?Math.max(4,Math.round(real/maxDp*100)):0;
    return `<div class="bar-group">
      <div class="bar-pair">
        <div class="bar" style="height:${hP}%;background:var(--border2)" title="${plan}m prévu"></div>
        <div class="bar" style="height:${hR}%;background:var(--orange)" title="${real}m réalisé"></div>
      </div>
      <div class="bar-lbl">${w.lbl}</div>
    </div>`;
  }).join('');

  const withZ=S.sessions.filter(s=>s.athId===a.id&&s.zone);
  if(withZ.length){
    const zc={Z1:0,Z2:0,Z3:0,Z4:0,Z5:0};
    withZ.forEach(s=>{if(zc[s.zone]!==undefined)zc[s.zone]++;});
    const tot=Object.values(zc).reduce((a,b)=>a+b,0);
    [1,2,3,4,5].forEach(n=>{ const pct=Math.round((zc['Z'+n]||0)/tot*100); document.getElementById('zpct-'+n).textContent=pct+'%'; });
    const z3p=(zc.Z3+zc.Z4+zc.Z5)/tot*100;
    document.getElementById('zone-alert').innerHTML=z3p>25
      ?`<div class="alert alert-warn">⚠ Z3+ = ${Math.round(z3p)}% — au-dessus de la règle 80/20.</div>`
      :`<div class="alert alert-ok">✅ Règle 80/20 respectée — Z3+ = ${Math.round(z3p)}%</div>`;
  }

  const allSess=allSessForAth.sort((x,y)=>new Date(y.date)-new Date(x.date));
  document.getElementById('all-sessions-list').innerHTML=allSess.length
    ? allSess.map(s=>`<div class="session-item">
        <div class="sess-date-col"><div class="sess-day" style="font-size:18px">${new Date(s.date).getDate()}</div><div class="sess-mon">${new Date(s.date).toLocaleString('fr',{month:'short'})}</div></div>
        <div class="sess-divider"></div>
        <div class="sess-info"><div class="sess-title">${TYPE_ICONS[s.type]||'🏃'} ${s.titre} ${s.done?'<span style="color:var(--green);font-size:10px">✓</span>':''}</div><div class="sess-detail">${s.dur?s.dur+'min':''} · ${s.dist?s.dist+'km':''} · ${s.dp?'+'+s.dp+'m D+':'—'}</div></div>
        <div class="type-pill ${TYPE_PILL[s.type]||'tp-recup'}">${s.type}</div>
      </div>`).join('')
    : '<div class="empty-state"><div class="empty-icon">📊</div>Aucune séance</div>';
}

// ── Render Athlete ────────────────────────────────────────────

renders.athlete = function() {
  document.getElementById('ath-selector').innerHTML = S.athletes.map((a,i)=>
    `<div style="display:flex;align-items:center;gap:8px;padding:7px 12px;border-radius:8px;border:1px solid ${i===S.currentAthlete?'rgba(232,255,71,.3)':'var(--border)'};background:${i===S.currentAthlete?'var(--accent-dim)':'var(--surface)'};cursor:pointer;transition:all .15s;flex:1;min-width:120px" onclick="pickAthlete(${i})">
      <div class="avatar av-sm" style="background:${a.color}">${initials(a)}</div>
      <div><div style="font-size:12px;font-weight:600">${a.prenom}</div><div style="font-size:10px;color:var(--text3)">${a.token?'⚡ Strava':a.niv}</div></div>
    </div>`).join('');
  updateAthletePanel();
};

function pickAthlete(i) { S.currentAthlete=i; updateAthletePanel(); }

function updateAthletePanel() {
  const a=S.athletes[S.currentAthlete]; if(!a) return;
  const mon=getMon(), sun=new Date(mon); sun.setDate(mon.getDate()+7);
  const wActs=S.activities.filter(x=>x.athId===a.id&&new Date(x.date)>=mon&&new Date(x.date)<sun);
  const km=wActs.reduce((acc,x)=>acc+(x.distM/1000),0);
  const sess=getAthleteSessions(a.id);
  const done=sess.filter(s=>s.done).length;
  const comp=sess.length?Math.round(done/sess.length*100):0;

  document.getElementById('ath-hero').style.setProperty('--hero-color',a.color+'22');
  document.getElementById('ath-hero-av').textContent=initials(a);
  document.getElementById('ath-hero-av').style.background=a.color;
  document.getElementById('ath-hero-name').textContent=`${a.prenom} ${a.nom}`;
  document.getElementById('ath-hero-meta').textContent=`${a.disc} · ${a.niv} · ${a.obj} · ${a.token?'⚡ Strava connecté':'Strava non connecté'}`;
  document.getElementById('ath-kpi-km').textContent=km.toFixed(1);
  document.getElementById('ath-kpi-comp').textContent=comp+'%';
  document.getElementById('ath-kpi-sess').textContent=sess.length;

  const btn=document.getElementById('ath-strava-btn');
  btn.textContent=a.token?'⚡ Strava connecté':'⚡ Connecter Strava';
  btn.onclick=()=>connectAthleteStrava(a.id);

  const statusEl=document.getElementById('ath-strava-status');
  if(a.token){
    const exp=a.expiresAt?new Date(a.expiresAt*1000):null;
    const expStr=exp?exp.toLocaleDateString('fr',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'—';
    const totalActs=S.activities.filter(x=>x.athId===a.id).length;
    statusEl.innerHTML=`<div class="strava-status-panel"><span class="sc-chip sc-on">⚡ Connecté</span><div class="sc-meta">${totalActs} activité${totalActs>1?'s':''} synchronisée${totalActs>1?'s':''} · Expire le ${expStr}</div><button class="btn btn-ghost btn-sm" onclick="disconnectStrava(${a.id})" style="font-size:10px;color:var(--text3)">Déconnecter</button></div>`;
  } else {
    statusEl.innerHTML=`<div class="strava-status-panel"><span class="sc-chip sc-off">Non connecté</span><div class="sc-meta">Envoie le lien OAuth à l'athlète pour connecter Strava</div><button class="btn btn-strava btn-sm" onclick="connectAthleteStrava(${a.id})">⚡ Connecter</button></div>`;
  }

  const today=new Date(); today.setHours(0,0,0,0);
  const dayNames=['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
  document.getElementById('ath-week-title').textContent=`Programme S${getWeekNum(mon)} — ${a.prenom}`;
  let rows='';
  for(let i=0;i<7;i++){
    const day=new Date(mon); day.setDate(mon.getDate()+i); day.setHours(0,0,0,0);
    const isT=day.getTime()===today.getTime();
    const ds=S.sessions.filter(s=>{ const sd=new Date(s.date); sd.setHours(0,0,0,0); return s.athId===a.id&&sd.getTime()===day.getTime(); });
    if(ds.length){
      ds.forEach(s=>{
        const sc=s.done?'sp-done':isT?'sp-today':day<today?'sp-miss':'sp-plan';
        const sl=s.done?'✓ Réalisé':isT?'Aujourd\'hui':day<today?'Non réalisé':'Prévu';
        rows+=`<tr class="${isT?'today-row':''}">
          <td><div class="day-lbl">${dayNames[i]}</div><div class="day-date">${day.getDate()} ${day.toLocaleString('fr',{month:'short'})}</div></td>
          <td><div style="font-size:13px;font-weight:600">${TYPE_ICONS[s.type]||'🏃'} ${s.titre}</div><div style="font-size:11px;color:var(--text3);margin-top:2px">${[s.dur?s.dur+'min':null,s.dist?s.dist+'km':null,s.dp?'+'+s.dp+'m D+':null,s.allure].filter(Boolean).join(' · ')}</div>${s.desc?`<div style="font-size:10px;color:var(--text3);font-style:italic;margin-top:2px">${s.desc}</div>`:''}</td>
          <td><div class="sess-pill ${sc}" onclick="toggleSession(${s.id})">${sl}</div></td>
        </tr>`;
      });
    } else {
      rows+=`<tr class="${isT?'today-row':''}"><td><div class="day-lbl">${dayNames[i]}</div><div class="day-date">${day.getDate()} ${day.toLocaleString('fr',{month:'short'})}</div></td><td style="color:var(--text3);font-style:italic;font-size:12px">— Repos</td><td></td></tr>`;
    }
  }
  document.getElementById('ath-week-body').innerHTML=rows;

  const allActs=S.activities.filter(x=>x.athId===a.id).sort((x,y)=>new Date(y.date)-new Date(x.date)).slice(0,6);
  document.getElementById('ath-strava-feed').innerHTML=allActs.length
    ? allActs.map(act=>`<div class="strava-act" ${act.stravaUrl?`onclick="window.open('${act.stravaUrl}','_blank')"`:''}>
        <div class="act-title">${act.type==='TrailRun'?'🏔':'🏃'} ${act.nom}</div>
        <div class="act-date">${fmtDateL(act.date)}</div>
        <div class="act-metrics">
          <div class="act-metric"><span>${fmtDist(act.distM)}</span></div>
          <div class="act-metric"><span>${fmtDur(act.sec)}</span></div>
          ${act.dp?`<div class="act-metric"><span>+${Math.round(act.dp)}m</span></div>`:''}
          <div class="act-metric"><span>${fmtAllur(act.allur)}</span></div>
          ${act.fc?`<div class="act-metric"><span>${act.fc}bpm</span></div>`:''}
        </div>
      </div>`).join('')
    : `<div style="padding:14px 16px;font-size:12px;color:var(--text3)">
        ${a.token?'Sync en cours…':'<button class="btn btn-strava btn-sm" onclick="connectAthleteStrava('+a.id+')">⚡ Connecter Strava</button>'}
      </div>`;

  const aNotes=S.notes.filter(n=>n.athId===a.id).sort((x,y)=>new Date(y.date)-new Date(x.date));
  document.getElementById('ath-notes').innerHTML=aNotes.length
    ? aNotes.map(n=>`<div class="note-item"><div class="note-meta">${fmtDate(n.date)}</div><div class="note-body">${n.txt}</div></div>`).join('')
    : '<div style="font-size:12px;color:var(--text3)">Aucune note</div>';
}

function selectAthAndGo(id) {
  const idx=S.athletes.findIndex(a=>a.id===id);
  if(idx>=0){ S.currentAthlete=idx; showView('athlete'); }
}

// ── Sidebar ───────────────────────────────────────────────────

function renderSidebar() {
  document.getElementById('sidebar-aths').innerHTML = S.athletes.map(a=>
    `<div class="nav-item" onclick="selectAthAndGo(${a.id})">
      <div class="nav-dot" style="background:${a.color}"></div>${a.prenom} ${a.nom[0]}.${a.token?' ⚡':''}
    </div>`).join('');
}

// ── Modals ────────────────────────────────────────────────────

function openModal(id) {
  if(id==='addSession'){
    document.getElementById('sess-ath').innerHTML=S.athletes.map(a=>`<option value="${a.id}">${a.prenom} ${a.nom}</option>`).join('');
    document.getElementById('sess-date').value=new Date().toISOString().split('T')[0];
  }
  if(id==='addAthlete') genPin();
  if(id==='settings'){
    const el=document.getElementById('coach-token-display');
    if(el) el.textContent=S.coachToken||'—';
    checkWebhookStatus();
  }
  document.getElementById('modal-'+id).classList.add('open');
}

function closeModal(id) { document.getElementById('modal-'+id).classList.remove('open'); }

document.querySelectorAll('.overlay').forEach(o=>o.addEventListener('click',e=>{if(e.target===o)o.classList.remove('open');}));

function doSaveSession(){
  const athId=parseInt(document.getElementById('sess-ath').value);
  const titre=document.getElementById('sess-title').value.trim();
  if(!titre){showToast('Titre requis','err');return;}
  S.sessions.push({
    id:uid(), athId,
    date:new Date(document.getElementById('sess-date').value+'T09:00:00').toISOString(),
    titre, type:document.getElementById('sess-type').value,
    dur:parseInt(document.getElementById('sess-dur').value)||null,
    dist:parseFloat(document.getElementById('sess-dist').value)||null,
    dp:parseInt(document.getElementById('sess-dp').value)||null,
    allure:document.getElementById('sess-allure').value||null,
    desc:document.getElementById('sess-desc').value||'',
    done:false,
  });
  save(); closeModal('addSession'); showToast('Séance programmée ✓','ok');
  ['sess-title','sess-dur','sess-dist','sess-dp','sess-allure','sess-desc'].forEach(id=>{document.getElementById(id).value='';});
  syncAthleteToCloud(athId);
  renders[currentView]?.();
}

function pickColor(c,el) {
  _pickedColor=c;
  document.querySelectorAll('.color-swatch').forEach(s=>s.classList.remove('selected'));
  el.classList.add('selected');
}

function doSaveAthlete(){
  const prenom=document.getElementById('ath-prenom').value.trim();
  const nom=document.getElementById('ath-nom').value.trim();
  if(!prenom||!nom){showToast('Prénom et nom requis','err');return;}
  const pin=document.getElementById('ath-pin').value.trim()||String(Math.floor(1000+Math.random()*9000));
  const ath={
    id:uid(), prenom, nom,
    email:document.getElementById('ath-email').value,
    disc:document.getElementById('ath-disc').value,
    niv:document.getElementById('ath-niveau').value,
    obj:document.getElementById('ath-obj').value,
    color:_pickedColor, token:null, refreshToken:null, expiresAt:0, stravaId:null,
    pin,
  };
  S.athletes.push(ath);
  save(); closeModal('addAthlete'); showToast('Athlète ajouté ✓','ok');
  ['ath-prenom','ath-nom','ath-email','ath-obj'].forEach(id=>{document.getElementById(id).value='';});
  syncAthleteToCloud(ath.id);
  renderSidebar(); renders[currentView]?.();
}

function doSaveNote(){
  const txt=document.getElementById('note-txt').value.trim(); if(!txt)return;
  const a=S.athletes[S.currentAthlete];
  S.notes.push({id:uid(),athId:a.id,date:new Date().toISOString(),txt});
  save(); closeModal('addNote'); showToast('Note enregistrée ✓','ok');
  document.getElementById('note-txt').value='';
  updateAthletePanel();
}

// ── OAuth callback ────────────────────────────────────────────

(function handleCallback(){
  const params=new URLSearchParams(window.location.search);
  const code=params.get('code');
  const state=params.get('state');
  const error=params.get('error');
  if(error){ showToast('⚠️ Autorisation Strava refusée','err'); history.replaceState({},'',window.location.pathname); return; }
  if(code&&state){ history.replaceState({},'',window.location.pathname); setTimeout(()=>exchangeCode(code,state),500); }
})();

// ── Coach token & settings ────────────────────────────────────

async function checkWebhookStatus(){
  const badge=document.getElementById('webhook-badge');
  const msg=document.getElementById('webhook-msg');
  const btn=document.getElementById('webhook-btn');
  if(!badge)return;
  if(!S.coachToken){badge.style.background='var(--surface2)';badge.style.color='var(--text3)';badge.textContent='—';return;}
  badge.textContent='…';
  try{
    const res=await fetch('/api/strava-webhook-setup',{headers:{'X-Coach-Token':S.coachToken}});
    if(!res.ok){badge.textContent='—';return;}
    const d=await res.json();
    const subs=d.subscriptions||[];
    if(subs.length>0){
      badge.style.background='var(--green-dim)';badge.style.color='var(--green)';badge.textContent='✓ Actif';
      if(msg)msg.innerHTML=`<span style="color:var(--green)">Webhook actif — ID ${subs[0].id} · ${subs[0].callback_url}</span>`;
      if(btn)btn.textContent='⚡ Reconfigurer le webhook';
    }else{
      badge.style.background='var(--orange-dim)';badge.style.color='var(--orange)';badge.textContent='Non configuré';
      if(msg)msg.innerHTML='<span style="color:var(--text3)">Clique sur le bouton pour activer la synchronisation automatique.</span>';
    }
  }catch{badge.textContent='—';}
}

async function setupWebhook(){
  if(!S.coachToken){showToast('Configure d\'abord le COACH_TOKEN dans Netlify','err');return;}
  if(!S.stravaClientId){showToast('Configure d\'abord ton Client ID Strava','err');return;}
  const btn=document.getElementById('webhook-btn');
  const badge=document.getElementById('webhook-badge');
  const msg=document.getElementById('webhook-msg');
  btn.disabled=true;btn.textContent='⟳ Configuration en cours…';
  if(msg)msg.textContent='';
  try{
    const res=await fetch('/api/strava-webhook-setup',{
      method:'POST',
      headers:{'Content-Type':'application/json','X-Coach-Token':S.coachToken},
      body:JSON.stringify({siteUrl:window.location.origin}),
    });
    const d=await res.json();
    if(!res.ok)throw new Error(d.error||'Erreur '+res.status);
    badge.style.background='var(--green-dim)';badge.style.color='var(--green)';badge.textContent='✓ Actif';
    const subId=d.subscription?.id;
    if(msg)msg.innerHTML=`<span style="color:var(--green)">✓ ${d.already?'Déjà configuré':'Webhook activé'} — ID ${subId}.</span>`;
    showToast('Webhook Strava activé ✓','ok');
  }catch(e){
    badge.style.background='var(--red-dim)';badge.style.color='var(--red)';badge.textContent='Erreur';
    if(msg)msg.innerHTML=`<span style="color:var(--red)">✗ ${e.message}</span>`;
    showToast('Erreur: '+e.message,'err');
  }finally{
    btn.disabled=false;btn.textContent='⚡ Reconfigurer le webhook';
  }
}

function generateCoachToken(){
  S.coachToken=Array.from(crypto.getRandomValues(new Uint8Array(20))).map(b=>b.toString(16).padStart(2,'0')).join('');
  save();
  const el=document.getElementById('coach-token-display');
  if(el) el.textContent=S.coachToken;
  showToast('Nouveau token généré — mets à jour COACH_TOKEN dans Netlify','info');
}

function copyCoachToken(){
  navigator.clipboard.writeText(S.coachToken||'').then(()=>showToast('Token copié ✓','ok'));
}

function genPin(){
  const el=document.getElementById('ath-pin');
  if(el) el.value=String(Math.floor(1000+Math.random()*9000));
}

// ── Sync athlete → Netlify Blobs ──────────────────────────────

async function syncAthleteToCloud(athId){
  const a=S.athletes.find(x=>x.id===athId);
  if(!a||!S.coachToken) return;
  const today=new Date(); today.setHours(0,0,0,0);
  const past7=new Date(today); past7.setDate(today.getDate()-7);
  const in30=new Date(today); in30.setDate(today.getDate()+30);
  const sessions=S.sessions
    .filter(s=>s.athId===athId&&new Date(s.date)>=past7&&new Date(s.date)<=in30)
    .map(s=>({id:s.id,d:s.date,t:s.type,ti:s.titre,dur:s.dur,dist:s.dist,dp:s.dp,al:s.allure,de:s.desc,ok:s.done}));
  const activities=S.activities
    .filter(x=>x.athId===athId)
    .sort((x,y)=>new Date(y.date)-new Date(x.date))
    .slice(0,20)
    .map(x=>({n:x.nom,d:x.date,t:x.type,km:x.distM,sec:x.sec,dp:x.dp,al:x.allur,fc:x.fc}));
  try {
    const res=await fetch('/api/athlete-data',{
      method:'POST',
      headers:{'Content-Type':'application/json','X-Coach-Token':S.coachToken},
      body:JSON.stringify({id:a.id,pin:a.pin||'0000',prenom:a.prenom,nom:a.nom,color:a.color,niv:a.niv,obj:a.obj,disc:a.disc,sessions,activities,stravaClientId:S.stravaClientId||''})
    });
    if(!res.ok){const e=await res.json();showToast('Cloud: '+e.error,'err');}
  } catch(e){}
}

// ── Pull done statuses from cloud ─────────────────────────────

async function pullFromCloud(){
  const a=S.athletes[S.currentAthlete]; if(!a||!a.pin) return;
  const btn=document.getElementById('btn-pull-cloud');
  if(btn){btn.disabled=true;btn.textContent='⟳...';}
  try{
    const res=await fetch(`/api/athlete-data?id=${a.id}&pin=${encodeURIComponent(a.pin)}`);
    if(!res.ok){const e=await res.json();showToast('Sync: '+e.error,'err');return;}
    const data=await res.json();
    const cloudDone={};
    (data.sessions||[]).forEach(s=>{if(s.ok)cloudDone[s.id]=true;});
    let changed=0;
    S.sessions.forEach(s=>{
      if(s.athId!==a.id)return;
      if(cloudDone[s.id]&&!s.done){s.done=true;changed++;}
    });
    if(changed){save();renders.athlete();}
    showToast(changed?`${changed} séance(s) sync. ✓`:'Déjà à jour ✓','ok');
  }catch(e){showToast('Erreur sync: '+e.message,'err');}
  finally{if(btn){btn.disabled=false;btn.textContent='↙ Sync statuts';}}
}

// ── Athlete link ──────────────────────────────────────────────

async function openAthleteLink(){
  const a=S.athletes[S.currentAthlete]; if(!a) return;

  // Generate PIN if athlete has none (demo athletes, legacy records)
  if(!a.pin){
    a.pin=String(Math.floor(1000+Math.random()*9000));
    save();
  }

  // Sync athlete data to cloud so the link actually works
  if(S.coachToken) await syncAthleteToCloud(a.id);

  const url=SITE_URL+'/athlete.html?id='+a.id;
  document.getElementById('share-ath-name').textContent=`${a.prenom} ${a.nom}`;
  const el=document.getElementById('share-link-url');
  el.textContent=url; el.setAttribute('data-url',url);
  document.getElementById('share-ath-pin').textContent=a.pin;
  openModal('shareLink');
}

function copyShareLink(){
  const url=document.getElementById('share-link-url').getAttribute('data-url')||'';
  if(!url) return;
  navigator.clipboard.writeText(url)
    .then(()=>showToast('Lien copié ✓','ok'))
    .catch(()=>{
      const ta=document.createElement('textarea');ta.value=url;
      document.body.appendChild(ta);ta.select();document.execCommand('copy');
      document.body.removeChild(ta);showToast('Lien copié ✓','ok');
    });
}

// ── Athlete mode ──────────────────────────────────────────────

function enterAthleteMode(){
  const a=S.athletes[S.currentAthlete]; if(!a) return;
  document.body.classList.add('athlete-mode');
  document.getElementById('ath-mode-name').textContent=`👤 ${a.prenom} ${a.nom}`;
  showView('athlete');
}

function exitAthleteMode(){ document.body.classList.remove('athlete-mode'); }

// ── Delete athlete ────────────────────────────────────────────

function confirmDeleteAthlete(){
  const a=S.athletes[S.currentAthlete]; if(!a) return;
  document.getElementById('delete-ath-name').textContent=`${a.prenom} ${a.nom}`;
  openModal('deleteAthlete');
}

function doDeleteAthlete(){
  const a=S.athletes[S.currentAthlete]; if(!a) return;
  const id=a.id, name=`${a.prenom} ${a.nom}`;
  S.athletes.splice(S.currentAthlete,1);
  S.sessions=S.sessions.filter(s=>s.athId!==id);
  S.activities=S.activities.filter(x=>x.athId!==id);
  S.notes=S.notes.filter(n=>n.athId!==id);
  S.currentAthlete=Math.min(S.currentAthlete,Math.max(0,S.athletes.length-1));
  save(); closeModal('deleteAthlete');
  if(S.coachToken) fetch('/api/athlete-data?id='+id,{method:'DELETE',headers:{'X-Coach-Token':S.coachToken}}).catch(()=>{});
  showToast(`${name} supprimé(e) ✓`,'ok');
  renderSidebar(); renders[currentView]?.();
}

// ── Strava disconnect ─────────────────────────────────────────

function disconnectStrava(athId){
  const a=S.athletes.find(x=>x.id===athId); if(!a) return;
  Object.assign(a,{token:null,refreshToken:null,expiresAt:0,stravaId:null,stravaProfile:null,stravaCity:null});
  save(); showToast('Strava déconnecté ✓','ok');
  renderSidebar(); updateAthletePanel();
}

// ── Session toggle (coach view) ───────────────────────────────

function toggleSession(sessId){
  const s=S.sessions.find(x=>x.id===sessId); if(!s) return;
  s.done=!s.done; save();
  syncAthleteToCloud(s.athId);
  updateAthletePanel();
}

// ── Init ──────────────────────────────────────────────────────

(function init(){
  const hasData=load();
  if(!hasData||!S.athletes.length) loadDemoData();

  if(!S.coachToken){
    S.coachToken=Array.from(crypto.getRandomValues(new Uint8Array(20))).map(b=>b.toString(16).padStart(2,'0')).join('');
    save();
  }

  if(!S.stravaClientId){ document.getElementById('setup').style.display='flex'; }
  else { document.getElementById('setup').style.display='none'; }

  renderSidebar();

  const days=Math.ceil((RACE_DATE-new Date())/86400000);
  document.getElementById('countdown-top').innerHTML=`J−<strong>${days>0?days:'🏁'}</strong>`;

  // Hash-based routing
  const hash = window.location.hash;
  const view = hash.replace('#/','').split('/')[0];
  const valid = ['dashboard','planning','programme','analyse','athlete'];
  if (valid.includes(view)) showView(view);
  else showView('dashboard');
})();
