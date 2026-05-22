// athlete.js — TrailCoach athlete interface logic + tab navigation

const params      = new URLSearchParams(window.location.search);
const ATH_ID      = params.get('id');
const PIN_KEY     = ATH_ID ? `ath_pin_${ATH_ID}` : null;
const STRAVA_CODE  = params.get('code');
const STRAVA_STATE = params.get('state');

// ── Tab navigation ────────────────────────────────────────────

let currentTab = 'programme';

function showTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-item').forEach(el =>
    el.classList.toggle('active', el.id === 'tab-btn-' + tab)
  );
  ['programme','activites','profil'].forEach(s => {
    const el = document.getElementById('section-' + s);
    if (el) el.style.display = s === tab ? '' : 'none';
  });
}

// ── API ───────────────────────────────────────────────────────

async function fetchData(pin) {
  const res = await fetch(`/api/athlete-data?id=${ATH_ID}&pin=${encodeURIComponent(pin)}`);
  if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Erreur ' + res.status); }
  return res.json();
}

// ── PIN screen ────────────────────────────────────────────────

function showPinScreen(errMsg = '', hint = '') {
  document.getElementById('app').innerHTML = `
    <div class="pin-screen">
      <div class="pin-logo">Trail<em>.</em>Coach</div>
      <div class="pin-sub">${hint || 'Entre ton PIN pour accéder à ton programme'}</div>
      <div class="pin-card">
        <div class="pin-title">Code PIN</div>
        <div class="pin-hint">Ton coach t'a communiqué un code à 4 chiffres.</div>
        <input class="pin-input" id="pin-input" type="text" inputmode="numeric" maxlength="4" pattern="[0-9]*" placeholder="• • • •" autocomplete="off">
        <button class="pin-btn" id="pin-btn" onclick="submitPin()">Accéder →</button>
        <div class="pin-err" id="pin-err">${errMsg}</div>
      </div>
    </div>`;
  const inp = document.getElementById('pin-input');
  inp.focus();
  inp.addEventListener('keydown', e => { if(e.key==='Enter') submitPin(); });
  document.getElementById('tab-bar').style.display = 'none';
}

async function submitPin() {
  const inp = document.getElementById('pin-input');
  const btn = document.getElementById('pin-btn');
  const errEl = document.getElementById('pin-err');
  const pin = (inp.value || '').trim();
  if (pin.length !== 4) { errEl.textContent='4 chiffres requis.'; inp.classList.add('err'); setTimeout(()=>inp.classList.remove('err'),500); return; }
  btn.disabled=true; btn.textContent='Vérification…'; errEl.textContent='';
  try {
    const data = await fetchData(pin);
    localStorage.setItem(PIN_KEY, pin);
    const pendingCode = sessionStorage.getItem('pending_strava_code');
    if (pendingCode) {
      sessionStorage.removeItem('pending_strava_code');
      renderApp(data);
      await connectStrava(pendingCode, pin, data);
      return;
    }
    renderApp(data);
  } catch(e) {
    btn.disabled=false; btn.textContent='Accéder →';
    errEl.textContent = e.message==='PIN incorrect' ? 'PIN incorrect. Vérifie auprès de ton coach.' : 'Erreur : '+e.message;
    inp.classList.add('err'); setTimeout(()=>inp.classList.remove('err'),500);
    inp.value=''; inp.focus();
  }
}

// ── Refresh ───────────────────────────────────────────────────

async function refreshData() {
  const btn = document.getElementById('btn-refresh');
  if (btn) btn.textContent = '⟳';
  const pin = localStorage.getItem(PIN_KEY);
  if (!pin) { showPinScreen(); return; }
  try {
    const data = await fetchData(pin);
    renderApp(data);
  } catch(e) {
    if (e.message==='PIN incorrect') { localStorage.removeItem(PIN_KEY); showPinScreen('Session expirée — entre ton PIN.'); }
    else if (btn) { btn.textContent = '↻'; }
  }
}

// ── Strava connect ────────────────────────────────────────────

function startStravaOAuth(clientId) {
  if (!clientId) { showToast('Client ID Strava manquant — contacte ton coach','err'); return; }
  const pin = localStorage.getItem(PIN_KEY);
  if (pin) sessionStorage.setItem('strava_pre_pin', pin);
  const redirectUri = encodeURIComponent(window.location.origin + '/athlete.html?id=' + ATH_ID);
  window.location.href = `https://www.strava.com/oauth/authorize`
    + `?client_id=${clientId}`
    + `&redirect_uri=${redirectUri}`
    + `&response_type=code`
    + `&approval_prompt=auto`
    + `&scope=read,activity:read_all`
    + `&state=${ATH_ID}`;
}

async function connectStrava(code, pin, existingData) {
  showToast('Connexion Strava en cours…', '', 4000);
  try {
    const res = await fetch('/api/strava-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, grant_type: 'authorization_code', athId: ATH_ID, pin }),
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || 'Erreur Strava');
    showToast('⚡ Strava connecté !', 'ok');
    window.history.replaceState({}, '', '/athlete.html?id=' + ATH_ID);
    const fresh = await fetchData(pin);
    renderApp(fresh);
  } catch(e) {
    showToast('Erreur Strava: ' + e.message, 'err');
    window.history.replaceState({}, '', '/athlete.html?id=' + ATH_ID);
    if (existingData) renderApp(existingData);
  }
}

// ── Session toggle ────────────────────────────────────────────

async function toggleSessionDone(pillEl, sessId, currentDone) {
  if (pillEl.classList.contains('loading')) return;
  const pin = localStorage.getItem(PIN_KEY);
  if (!pin) { showPinScreen(); return; }
  const newDone = !currentDone;
  const oldClass = pillEl.className, oldText = pillEl.textContent;
  const scard = pillEl.closest('.scard');
  pillEl.className = 'status-pill loading';
  pillEl.textContent = newDone ? '✓ Réalisé' : 'Prévu';
  try {
    const res = await fetch('/api/athlete-data', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: ATH_ID, pin, sessId, done: newDone }),
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Erreur'); }
    pillEl.className = 'status-pill ' + (newDone ? 'sp-done' : 'sp-plan');
    pillEl.textContent = newDone ? '✓ Réalisé' : 'Prévu';
    pillEl.setAttribute('onclick', `toggleSessionDone(this,${JSON.stringify(sessId)},${newDone})`);
    if (scard) scard.classList.toggle('done', newDone);
    showToast(newDone ? 'Séance validée ✓' : 'Séance non réalisée', 'ok');
  } catch(e) {
    pillEl.className = oldClass;
    pillEl.textContent = oldText;
    showToast('Erreur: ' + e.message, 'err');
  }
}

// ── Strava sync ───────────────────────────────────────────────

async function syncStravaActivities() {
  const pin = localStorage.getItem(PIN_KEY);
  if (!pin) return;
  showToast('Sync Strava…', '', 3000);
  try {
    const data = await fetchData(pin);
    renderApp(data);
    showToast('Activités mises à jour ✓', 'ok');
  } catch(e) { showToast('Erreur: ' + e.message, 'err'); }
}

// ── Render helpers ────────────────────────────────────────────

function renderMatchCard(act, sess) {
  const actDist = act.km || act.distM || 0;
  const planDist = (parseFloat(sess.dist) || 0) * 1000;
  const actDur = act.sec || 0;
  const planDur = (sess.dur ? sess.dur*60 : 0) || (sess.sec || 0);
  const mets = [
    actDist ? fmtDist(actDist) : null,
    actDur  ? fmtDur(actDur)   : null,
    act.dp  ? '+'+act.dp+'m'   : null,
    act.al  ? fmtPace(act.al)  : null,
    act.fc  ? act.fc+' bpm'    : null,
  ].filter(Boolean);
  const showVs = (actDist && planDist) || (actDur && planDur);
  return `<div class="match-card">
    <div class="match-icon">⚡</div>
    <div class="match-body">
      <div class="match-title">
        ${act.n || act.nom || 'Activité Strava'}
        ${(act.url||act.stravaUrl) ? `<a href="${act.url||act.stravaUrl}" target="_blank">↗ Voir</a>` : ''}
      </div>
      <div class="match-metrics">${mets.map(m=>`<span class="match-m">${m}</span>`).join(' · ')}</div>
      ${showVs ? `<div class="match-vs">
        ${actDist&&planDist?`<div class="vs-item"><div class="vs-val actual">${(actDist/1000).toFixed(1)}km</div><div class="vs-lbl">Réalisé</div></div><div class="vs-item"><div class="vs-val planned">${(planDist/1000).toFixed(1)}km</div><div class="vs-lbl">Planifié</div></div>`:''}
        ${actDur&&planDur?`<div class="vs-item"><div class="vs-val actual">${fmtDur(actDur)}</div><div class="vs-lbl">Durée</div></div><div class="vs-item"><div class="vs-val planned">${fmtDur(planDur)}</div><div class="vs-lbl">Cible</div></div>`:''}
      </div>` : ''}
    </div>
  </div>`;
}

// ── Build section HTML ────────────────────────────────────────

function buildProfilHtml(data, kmPlanned, done, weekSess, minPlanned, dpPlanned) {
  const {prenom, nom, color, niv, obj, disc, strava, stravaClientId} = data;
  return `<div class="hero">
    <div class="hero-card" style="--hero-tint:${color}0d">
      <div class="avatar" style="background:${color};width:54px;height:54px;font-size:20px;position:relative;z-index:1">${fmtInitials(prenom,nom)}</div>
      <div class="hero-body">
        <div class="hero-name">${prenom} ${nom}</div>
        <div class="hero-sub">${disc||''} · ${niv||''}<br>${obj||''}</div>
        <div class="hero-kpis">
          <div class="hkpi"><div class="hkpi-val">${kmPlanned.toFixed(0)}km</div><div class="hkpi-lbl">planifiés</div></div>
          <div class="hkpi"><div class="hkpi-val">${done}/${weekSess.length}</div><div class="hkpi-lbl">séances</div></div>
          ${minPlanned?`<div class="hkpi"><div class="hkpi-val">${minPlanned>=60?Math.floor(minPlanned/60)+'h'+(minPlanned%60?String(minPlanned%60).padStart(2,'0'):''):minPlanned+'min'}</div><div class="hkpi-lbl">durée</div></div>`:''}
          ${dpPlanned?`<div class="hkpi"><div class="hkpi-val">${dpPlanned>1000?(dpPlanned/1000).toFixed(1)+'k':dpPlanned}m</div><div class="hkpi-lbl">D+</div></div>`:''}
        </div>
        ${strava?.athleteId
          ? `<div class="strava-badge">⚡ Strava connecté · sync auto</div>`
          : (stravaClientId ? `<div class="strava-badge disconnected" onclick="startStravaOAuth('${stravaClientId}')">⚡ Connecter Strava</div>` : '')}
      </div>
    </div>
  </div>
  <div class="page">
    <div class="footer">Programme établi par ton coach · TrailCoach Pro</div>
  </div>`;
}

function buildProgrammeHtml(data, today, mon) {
  const {sessions=[], activities=[], updatedAt} = data;
  const actBySession = {};
  const actByDate    = {};
  activities.forEach(a => {
    if (a.sessId) actBySession[a.sessId] = a;
    const dk = a.d ? a.d.slice(0,10) : '';
    if (dk && !actByDate[dk]) actByDate[dk] = a;
  });
  sessions.forEach(s => {
    if (s.stravaId) {
      const act = activities.find(a => String(a.id) === String(s.stravaId));
      if (act) actBySession[s.id] = act;
    }
  });

  const weekSess = sessions.filter(x=>{const d=new Date(x.d);d.setHours(0,0,0,0);return d>=mon&&d<new Date(mon.getTime()+7*86400000);});
  const done     = weekSess.filter(x=>x.ok).length;
  const kmPlanned= weekSess.reduce((acc,x)=>acc+(parseFloat(x.dist)||0),0);
  const dpPlanned= weekSess.reduce((acc,x)=>acc+(x.dp||0),0);

  let html = '';
  if (updatedAt) {
    const upd = new Date(updatedAt);
    html += `<div class="page"><div class="updated-at">Mis à jour le ${upd.toLocaleDateString('fr',{day:'numeric',month:'long'})} à ${upd.toLocaleTimeString('fr',{hour:'2-digit',minute:'2-digit'})}</div></div>`;
  }

  // Week strip
  html += `<div class="week-strip"><div class="week-strip-inner">`;
  for (let i=0; i<7; i++) {
    const d=new Date(mon); d.setDate(mon.getDate()+i); d.setHours(0,0,0,0);
    const isT=d.getTime()===today.getTime();
    const isPast=d<today;
    const daySess=sessions.filter(x=>{const sd=new Date(x.d);sd.setHours(0,0,0,0);return sd.getTime()===d.getTime();});
    const hasSess=daySess.length>0;
    html+=`<div class="wday${isT?' today':''}${hasSess?' has-session':''}">
      <div class="wday-name">${DAYS_SHORT[i]}</div>
      <div class="wday-num">${d.getDate()}</div>
      <div class="wday-dots">${hasSess?daySess.map(s=>{
        const cls=s.ok?'done':isT?'today':isPast?'missed':'planned';
        return`<div class="wdot ${cls}"></div>`;
      }).join(''):'<div class="wdot"></div>'}</div>
    </div>`;
  }
  html += `</div></div>`;

  // Week bar
  html += `<div class="week-bar"><div class="week-bar-inner">
    <div class="wstat"><div class="wstat-val">${done}/${weekSess.length}</div><div class="wstat-lbl">Séances</div></div>
    <div class="wstat"><div class="wstat-val">${done>0&&weekSess.length>0?Math.round(done/weekSess.length*100):0}%</div><div class="wstat-lbl">Complétion</div></div>
    <div class="wstat"><div class="wstat-val">${kmPlanned.toFixed(0)} km</div><div class="wstat-lbl">Volume</div></div>
    <div class="wstat"><div class="wstat-val">${dpPlanned?dpPlanned+'m':'—'}</div><div class="wstat-lbl">D+</div></div>
  </div></div>`;

  // 14-day programme
  html += `<div class="page"><div class="sect-row"><div class="sect-title">Programme — 2 semaines</div></div>`;
  for (let i=0; i<14; i++) {
    const day=new Date(mon); day.setDate(mon.getDate()+i); day.setHours(0,0,0,0);
    const isToday=day.getTime()===today.getTime();
    const isPast=day<today;
    const dname=DAYS_LONG[dayIdx(day)];
    const ddate=`${day.getDate()} ${MONTHS[day.getMonth()]}`;
    const daySess=sessions.filter(x=>{const sd=new Date(x.d);sd.setHours(0,0,0,0);return sd.getTime()===day.getTime();});
    const dk=day.toISOString().slice(0,10);
    if (i===7) html+=`<div class="week-label">Semaine prochaine</div>`;
    if (daySess.length) {
      daySess.forEach(sess=>{
        const sc=sess.ok?'sp-done':isToday?'sp-today':isPast?'sp-miss':'sp-plan';
        const sl=sess.ok?'✓ Réalisé':isToday?'Aujourd\'hui':isPast?'Non réalisé':'Prévu';
        const mets=[
          sess.dur?sess.dur+' min':(sess.sec?fmtDur(sess.sec):null),
          sess.dist?sess.dist+' km':null,
          sess.dp?'+'+sess.dp+'m D+':null,
          sess.al?fmtPace(sess.al):null,
        ].filter(Boolean);
        const matchedAct=actBySession[sess.id]||(sess.ok?actByDate[dk]:null);
        html+=`<div class="scard${isToday?' today':''}${sess.ok?' done':''}${matchedAct?' matched':''}">
          <div class="scard-head">
            <span class="scard-day">${dname}${isToday?` <span class="today-tag">Aujourd'hui</span>`:''}</span>
            <span class="scard-date">${ddate}</span>
          </div>
          <div class="scard-body">
            <div class="scard-top">
              <div class="scard-title-row">
                <span class="scard-name">${ICONS[sess.t]||'🏃'} ${sess.ti||sess.n||'Séance'}</span>
                <span class="type-pill ${PILLS[sess.t]||'tp-ef'}">${LABELS[sess.t]||sess.t||'EF'}</span>
              </div>
              <span class="status-pill ${sc}" onclick="toggleSessionDone(this,${JSON.stringify(sess.id)},${sess.ok})">${sl}</span>
            </div>
            ${mets.length?`<div class="scard-metrics">${mets.map(m=>`<span class="metric">${m}</span>`).join('')}</div>`:''}
            ${sess.de?`<div class="scard-desc">${sess.de}</div>`:''}
            ${matchedAct?renderMatchCard(matchedAct,sess):''}
          </div>
        </div>`;
      });
    } else {
      html+=`<div class="rest${isToday?' scard today':''}">
        <span class="rest-day">${dname}${isToday?` <span class="today-tag" style="font-size:10px">Aujourd'hui</span>`:''}</span>
        <span class="rest-date">${ddate}</span>
        <span class="rest-lbl">Repos</span>
      </div>`;
    }
  }
  html += `</div>`;
  return html;
}

function buildActivitesHtml(data) {
  const {activities=[], strava, stravaClientId} = data;
  let html = '<div class="page">';
  if (strava?.athleteId) {
    html += `<div class="sect-row"><div class="sect-title">⚡ Mes activités Strava</div><span class="sect-action" onclick="syncStravaActivities()">↻ Sync</span></div>`;
    if (activities.length) {
      activities.slice(0,20).forEach(act => {
        const mets=[
          act.km?fmtDist(act.km):(act.distM?fmtDist(act.distM):null),
          act.sec?fmtDur(act.sec):null,
          act.dp?'+'+act.dp+'m':null,
          act.al?fmtPace(act.al):null,
          act.fc?act.fc+' bpm':null,
        ].filter(Boolean);
        const icon=act.t==='TrailRun'?'🏔':act.t==='Hike'?'🥾':'🏃';
        html+=`<div class="act">
          <div class="act-icon">${icon}</div>
          <div class="act-info">
            <div class="act-name">${act.n||act.nom||'Activité'}</div>
            <div class="act-date">${fmtDate(act.d||act.date)}</div>
            <div class="act-metrics">${mets.map(m=>`<span class="act-m">${m}</span>`).join('')}</div>
          </div>
          ${(act.url||act.stravaUrl)?`<a class="act-link" href="${act.url||act.stravaUrl}" target="_blank">↗</a>`:''}
        </div>`;
      });
    } else {
      html += `<div style="font-size:12px;color:var(--text3);padding:16px 0">Aucune activité récente — elles apparaîtront après ta prochaine sortie.</div>`;
    }
  } else if (stravaClientId) {
    html += `<div class="sect-row"><div class="sect-title">⚡ Strava</div></div>
    <div class="strava-connect-card">
      <div class="strava-connect-title">⚡ Connecte ton compte Strava</div>
      <div class="strava-connect-desc">Synchronise automatiquement tes activités. Tes séances seront validées dès que tu enregistres une sortie sur Strava, Garmin ou Suunto.</div>
      <button class="strava-connect-btn" onclick="startStravaOAuth('${stravaClientId}')">⚡ Connecter Strava</button>
    </div>`;
  } else {
    html += `<div style="padding:40px 0;text-align:center;font-size:13px;color:var(--text3)">Strava non configuré — contacte ton coach.</div>`;
  }
  html += '</div>';
  return html;
}

// ── Main render ───────────────────────────────────────────────

function fmtInitials(p, n) {
  return ((p||'')[0]||'').toUpperCase() + ((n||'')[0]||'').toUpperCase();
}

function renderApp(data) {
  const {prenom, nom, color, sessions=[], stravaClientId} = data;
  document.getElementById('header-name').textContent = `${prenom} ${nom[0]}.`;
  document.getElementById('btn-refresh').style.display = '';
  document.title = `TrailCoach — ${prenom} ${nom}`;

  const today = new Date(); today.setHours(0,0,0,0);
  const mon   = getMon();
  const sun   = new Date(mon); sun.setDate(mon.getDate()+7);

  const weekSess  = sessions.filter(x=>{const d=new Date(x.d);d.setHours(0,0,0,0);return d>=mon&&d<sun;});
  const done      = weekSess.filter(x=>x.ok).length;
  const kmPlanned = weekSess.reduce((acc,x)=>acc+(parseFloat(x.dist)||0),0);
  const minPlanned= weekSess.reduce((acc,x)=>acc+(x.dur||Math.round((x.sec||0)/60)||0),0);
  const dpPlanned = weekSess.reduce((acc,x)=>acc+(x.dp||0),0);

  document.getElementById('app').innerHTML = `
    <div id="section-programme">${buildProgrammeHtml(data, today, mon)}</div>
    <div id="section-activites" style="display:none">${buildActivitesHtml(data)}</div>
    <div id="section-profil" style="display:none">${buildProfilHtml(data, kmPlanned, done, weekSess, minPlanned, dpPlanned)}</div>
  `;

  document.getElementById('tab-bar').style.display = '';
  showTab(currentTab);
}

function showError(msg) {
  document.getElementById('app').innerHTML = `
    <div class="err-box">
      <div class="err-icon">🏔</div>
      <div class="err-title">Oups</div>
      <div class="err-msg">${msg}</div>
    </div>`;
}

// ── Init ──────────────────────────────────────────────────────

(async function init() {
  if (!ATH_ID) {
    showError('Lien invalide — aucun identifiant athlète.<br><br>Demande à ton coach de te renvoyer le lien.');
    return;
  }

  if (STRAVA_CODE && STRAVA_STATE === ATH_ID) {
    const pin = localStorage.getItem(PIN_KEY) || sessionStorage.getItem('strava_pre_pin');
    if (pin) {
      localStorage.setItem(PIN_KEY, pin);
      sessionStorage.removeItem('strava_pre_pin');
      document.getElementById('app').innerHTML = `<div class="loading-screen"><div class="spin">⟳</div><br>Connexion Strava…</div>`;
      try {
        const data = await fetchData(pin);
        renderApp(data);
        await connectStrava(STRAVA_CODE, pin, data);
      } catch {
        showPinScreen('', 'Entre ton PIN pour finaliser la connexion Strava.');
        sessionStorage.setItem('pending_strava_code', STRAVA_CODE);
      }
    } else {
      showPinScreen('', 'Entre ton PIN pour finaliser la connexion Strava.');
      sessionStorage.setItem('pending_strava_code', STRAVA_CODE);
    }
    return;
  }

  const savedPin = localStorage.getItem(PIN_KEY);
  if (savedPin) {
    try {
      const data = await fetchData(savedPin);
      renderApp(data);
    } catch(e) {
      localStorage.removeItem(PIN_KEY);
      showPinScreen(e.message==='PIN incorrect' ? '' : 'Erreur de connexion. Entre ton PIN.');
    }
  } else {
    showPinScreen();
  }
})();
