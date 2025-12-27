/* app.js
   Mastermind autonome pour GitHub Pages
   - Salons via URL (room, type, code)
   - Modes: solo, duo (créateur définit code), group (site génère)
   - Persistance locale: localStorage pour records et historique
*/

(() => {
  // --- CONFIG ---
  const ROUND_DURATION = 60; // secondes (optionnel)
  const ROOM_ID_LEN = 6;

  // --- HELPERS ---
  const $ = id => document.getElementById(id);
  const randInt = (min, max) => Math.floor(Math.random()*(max-min+1))+min;
  const genRoomId = () => Math.random().toString(36).slice(2, 2+ROOM_ID_LEN).toUpperCase();
  const genCode = () => String(randInt(0,9999)).padStart(4,'0');
  const qs = (k) => {
    const u = new URL(location.href);
    return u.searchParams.get(k);
  };
  const setQS = (k,v) => {
    const u = new URL(location.href);
    if (v==null) u.searchParams.delete(k); else u.searchParams.set(k,v);
    history.replaceState(null,'',u.toString());
  };

  // --- STORAGE KEYS ---
  const STORAGE_RECORD = 'nexus_record'; // {name,score}
  const STORAGE_ROOMS_PREFIX = 'nexus_room_'; // room data stored optionally for creator

  // --- UI ---
  const modeSelect = $('modeSelect');
  const codeInput = $('codeInput');
  const nameInput = $('nameInput');
  const createBtn = $('createBtn');
  const createQuickBtn = $('createQuickBtn');
  const linksRow = $('linksRow');
  const linksArea = $('linksArea');
  const copyLinks = $('copyLinks');
  const openPlayer = $('openPlayer');

  const playPanel = $('playPanel');
  const createPanel = $('createPanel');
  const roomTitle = $('roomTitle');
  const statusText = $('statusText');
  const timerRow = $('timerRow');
  const timerEl = $('timer');
  const guessInput = $('guessInput');
  const guessBtn = $('guessBtn');
  const historyEl = $('history');
  const leaveBtn = $('leaveBtn');
  const resetBtn = $('resetBtn');
  const recordEl = $('record');

  // --- STATE ---
  let room = null; // {id, type, code, creatorName, createdAt}
  let isCreator = false;
  let game = { running:false, endAt:0 };
  let timerInterval = null;

  // --- RECORDS ---
  function loadRecord(){
    try {
      const raw = localStorage.getItem(STORAGE_RECORD);
      if(!raw) return null;
      return JSON.parse(raw);
    } catch(e){ return null; }
  }
  function saveRecord(rec){
    localStorage.setItem(STORAGE_RECORD, JSON.stringify(rec));
    renderRecord();
  }
  function renderRecord(){
    const r = loadRecord();
    if(r) recordEl.textContent = `🏆 Record: ${r.name} (${r.score}s)`;
    else recordEl.textContent = `🏆 Record: Aucun`;
  }

  // --- ROOM STORAGE (optionnel) ---
  function saveRoomLocal(roomObj){
    try {
      localStorage.setItem(STORAGE_ROOMS_PREFIX + roomObj.id, JSON.stringify(roomObj));
    } catch(e){}
  }
  function loadRoomLocal(id){
    try {
      const raw = localStorage.getItem(STORAGE_ROOMS_PREFIX + id);
      return raw ? JSON.parse(raw) : null;
    } catch(e){ return null; }
  }

  // --- UI LOGIC ---
  function showCreate(){
    createPanel.style.display = '';
    playPanel.style.display = 'none';
  }
  function showPlay(){
    createPanel.style.display = 'none';
    playPanel.style.display = '';
  }

  function updateTimer(){
    if(!game.running){ timerRow.style.display='none'; timerEl.textContent='00s'; return; }
    const remain = Math.max(0, Math.ceil((game.endAt - Date.now())/1000));
    timerRow.style.display='';
    timerEl.textContent = `${remain}s`;
    if(remain<=0){
      game.running=false;
      clearInterval(timerInterval);
      addHistoryItem({type:'timeout', text:`⌛ TEMPS ÉCOULÉ ! Code : ${room.code}`});
      statusText.textContent = 'Terminé';
    }
  }

  function addHistoryItem(item){
    // item: {type:'guess'|'success'|'timeout'|'info', text, name, guess, bp, mp}
    const div = document.createElement('div');
    div.className = 'item';
    if(item.type==='guess') div.classList.add('blue');
    if(item.type==='success') div.classList.add('green');
    if(item.type==='timeout') div.classList.add('red');
    if(item.type==='info') div.classList.add('glass');
    if(item.type==='guess'){
      div.innerHTML = `<b>${escapeHtml(item.name)}</b> : ${escapeHtml(item.guess)} <span class="bp">${item.bp} BP</span> | <span class="mp">${item.mp} MP</span>`;
    } else {
      div.textContent = item.text;
    }
    historyEl.prepend(div);
  }

  function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

  // --- GAME LOGIC (Mastermind 4 digits) ---
  function scoreGuess(secret, guess){
    // returns {bp, mp}
    const s = secret.split('');
    const g = guess.split('');
    let bp=0, mp=0;
    const usedS=[0,0,0,0], usedG=[0,0,0,0];
    for(let i=0;i<4;i++){
      if(g[i]===s[i]){ bp++; usedS[i]=usedG[i]=1; }
    }
    for(let i=0;i<4;i++){
      if(usedG[i]) continue;
      for(let j=0;j<4;j++){
        if(usedS[j]) continue;
        if(g[i]===s[j]){ mp++; usedS[j]=1; usedG[i]=1; break; }
      }
    }
    return {bp, mp};
  }

  // --- ROOM / URL helpers ---
  function buildLinksForRoom(r){
    // Two links: creator (with code) and player (without code)
    const base = location.origin + location.pathname;
    const creatorUrl = new URL(base);
    creatorUrl.searchParams.set('room', r.id);
    creatorUrl.searchParams.set('type', r.type);
    creatorUrl.searchParams.set('code', r.code);
    creatorUrl.searchParams.set('creator', r.creatorName || 'creator');

    const playerUrl = new URL(base);
    playerUrl.searchParams.set('room', r.id);
    playerUrl.searchParams.set('type', r.type);
    // player link intentionally does NOT include code param (but note: without server, code must be in URL to share state)
    // To allow joining without exposing code in the visible query, we include an encoded token param that contains the code base64.
    // If you want the player to NOT see the code in the URL at all, it's impossible without a server.
    // Here we include a token that is base64 of the code (light obfuscation).
    playerUrl.searchParams.set('token', btoa(r.code));
    return {creator: creatorUrl.toString(), player: playerUrl.toString()};
  }

  function parseRoomFromURL(){
    const id = qs('room');
    const type = qs('type');
    const code = qs('code') || (qs('token') ? atob(qs('token')) : null);
    const creatorName = qs('creator') || '';
    if(!id) return null;
    return { id, type: type || 'duo', code: code || null, creatorName, createdAt: Date.now() };
  }

  // --- EVENTS: create room ---
  createBtn.addEventListener('click', () => {
    const mode = modeSelect.value;
    let code = codeInput.value.trim();
    const name = nameInput.value.trim() || 'Agent';
    if(mode==='duo'){
      if(!/^\d{4}$/.test(code)){
        alert('Pour Duo, entre un code de 4 chiffres (ex: 0427) ou utilise "Créer rapide".');
        return;
      }
    } else if(mode==='group'){
      code = genCode();
    } else if(mode==='solo'){
      code = genCode();
    }
    const id = genRoomId();
    room = { id, type: mode, code, creatorName: name, createdAt: Date.now() };
    isCreator = true;
    saveRoomLocal(room);
    const links = buildLinksForRoom(room);
    linksArea.value = `Lien créateur:\n${links.creator}\n\nLien joueur:\n${links.player}`;
    linksRow.style.display='';
    // open play view for creator
    enterRoom(room, true);
  });

  createQuickBtn.addEventListener('click', () => {
    // quick create: generate code and room
    modeSelect.value = 'group';
    codeInput.value = '';
    createBtn.click();
  });

  copyLinks.addEventListener('click', () => {
    linksArea.select();
    document.execCommand('copy');
    copyLinks.textContent = 'Copié !';
    setTimeout(()=>copyLinks.textContent='Copier les liens',1200);
  });

  openPlayer.addEventListener('click', () => {
    const txt = linksArea.value;
    const match = txt.match(/Lien joueur:\n(https?:\/\/\S+)/);
    if(match) window.open(match[1], '_blank');
  });

  // --- Entering a room (when opening a link) ---
  function enterRoom(r, creator=false){
    room = r;
    isCreator = creator || (qs('creator')? true:false);
    showPlay();
    roomTitle.textContent = `Salon ${room.id} — ${room.type.toUpperCase()}`;
    statusText.textContent = isCreator ? 'Créateur' : 'Joueur';
    historyEl.innerHTML = '';
    // start game
    game.running = true;
    game.endAt = Date.now() + ROUND_DURATION*1000;
    if(timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(updateTimer, 500);
    updateTimer();

    // show code to creator only
    if(isCreator){
      addHistoryItem({type:'info', text:`Code secret: ${room.code} (partage le lien joueur)`});
    } else {
      addHistoryItem({type:'info', text:`Tu as rejoint le salon ${room.id}. Bonne chance !`});
    }
    // store minimal room for creator
    if(isCreator) saveRoomLocal(room);
    // update status
    setQS('room', room.id);
    setQS('type', room.type);
    // do not overwrite code param for player view
    if(isCreator) setQS('code', room.code);
  }

  // --- On page load: check URL for room ---
  function initFromURL(){
    const r = parseRoomFromURL();
    if(r){
      // if code param present -> creator or direct link
      const token = qs('token');
      const codeFromToken = token ? atob(token) : null;
      const code = r.code || codeFromToken;
      r.code = code;
      // if no code, generate one (group)
      if(!r.code){
        r.code = genCode();
      }
      // determine if this browser is creator: if code param present or creator param present
      const creatorParam = qs('creator');
      const creatorFlag = !!qs('code') || !!creatorParam;
      enterRoom(r, creatorFlag);
      // prefill name if provided
      const name = qs('name');
      if(name) nameInput.value = name;
      return true;
    }
    return false;
  }

  // --- Guess handling ---
  guessBtn.addEventListener('click', () => {
    if(!room || !game.running){ alert('Aucun jeu en cours. Crée ou rejoins un salon.'); return; }
    const guess = guessInput.value.trim().padStart(4,'0');
    const name = nameInput.value.trim() || 'Agent';
    if(!/^\d{4}$/.test(guess)){ alert('Proposition invalide : 4 chiffres requis.'); return; }
    const res = scoreGuess(room.code, guess);
    addHistoryItem({type:'guess', name, guess, bp:res.bp, mp:res.mp});
    // extend timer on guess (like sur l'ESP)
    game.endAt = Math.max(game.endAt, Date.now() + 10*1000); // +10s par proposition (ajustable)
    updateTimer();
    if(res.bp===4){
      // victoire
      game.running=false;
      clearInterval(timerInterval);
      addHistoryItem({type:'success', text:`🎉 ${name} a trouvé le code ${room.code} !`});
      statusText.textContent = `Gagnant: ${name}`;
      // compute score = remaining seconds
      const score = Math.max(0, Math.ceil((game.endAt - Date.now())/1000));
      // update record
      const rec = loadRecord();
      if(!rec || score > rec.score){
        saveRecord({name, score});
        addHistoryItem({type:'info', text:`Nouveau record: ${name} (${score}s)`});
      }
    }
    guessInput.value = '';
  });

  // allow Enter key
  guessInput.addEventListener('keydown', (e) => { if(e.key==='Enter') guessBtn.click(); });

  // leave / reset
  leaveBtn.addEventListener('click', () => {
    if(confirm('Quitter le salon ?')) {
      // remove room params
      setQS('room', null); setQS('type', null); setQS('code', null); setQS('token', null);
      room = null; isCreator=false; game.running=false;
      if(timerInterval) clearInterval(timerInterval);
      showCreate();
    }
  });

  resetBtn.addEventListener('click', () => {
    if(!isCreator){ alert('Seul le créateur peut réinitialiser.'); return; }
    if(confirm('Réinitialiser le salon (nouveau code) ?')){
      room.code = genCode();
      saveRoomLocal(room);
      addHistoryItem({type:'info', text:`Salon réinitialisé. Nouveau code: ${room.code}`});
      // update creator link in UI if present
      const links = buildLinksForRoom(room);
      linksArea.value = `Lien créateur:\n${links.creator}\n\nLien joueur:\n${links.player}`;
      setQS('code', room.code);
    }
  });

  // --- Init UI and events ---
  function initUI(){
    renderRecord();
    // show/hide code input depending on mode
    function updateCodeRow(){
      const m = modeSelect.value;
      if(m==='duo') { $('codeRow').style.display=''; codeInput.disabled=false; codeInput.placeholder='Ex: 0427'; }
      else if(m==='group'){ $('codeRow').style.display='none'; codeInput.value=''; }
      else if(m==='solo'){ $('codeRow').style.display='none'; codeInput.value=''; }
    }
    modeSelect.addEventListener('change', updateCodeRow);
    updateCodeRow();

    // If URL contains room -> join
    if(!initFromURL()){
      showCreate();
    } else {
      // already in room
    }
  }

  // --- Start ---
  document.addEventListener('DOMContentLoaded', initUI);
})();
