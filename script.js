// -------------------------
// État et configuration
// -------------------------
const store = {
  recordNom: localStorage.getItem("recordNom") || "Aucun",
  recordScore: parseInt(localStorage.getItem("recordScore") || "0"),
  achievements: JSON.parse(localStorage.getItem("achievements") || "[]"),
  options: JSON.parse(localStorage.getItem("options") || JSON.stringify({
    difficulty: 4, duration: 60, hints: 1, theme: "ocean"
  })),
};

let state = {
  mode: "—",           // "Solo" | "Multi" | "Daily"
  code: "",            // secret
  length: store.options.difficulty, // 4/6/8
  running: false,
  endAt: 0,            // timestamp
  hintsLeft: store.options.hints,
  revealedDigits: [],  // indices révélés par indices
  winner: "",
  feed: [],
  lastGuessTs: 0,
};

// -------------------------
// Sélecteurs
// -------------------------
const $ = sel => document.querySelector(sel);
const els = {
  legend: $("#legend"),
  modeLabel: $("#modeLabel"),
  diffLabel: $("#diffLabel"),
  timer: $("#timer"),
  progressBar: $("#progressBar"),
  remain: $("#remain"),
  statusTitle: $("#statusTitle"),
  revealed: $("#revealed"),
  feed: $("#feed"),
  playArea: $("#playArea"),
  btnSolo: $("#btnSolo"),
  btnDaily: $("#btnDaily"),
  formMulti: $("#formMulti"),
  formGuess: $("#formGuess"),
  btnReset: $("#btnReset"),
  btnHint: $("#btnHint"),
  difficulty: $("#difficulty"),
  duration: $("#duration"),
  hints: $("#hints"),
  btnSaveOpts: $("#btnSaveOpts"),
  btnClearData: $("#btnClearData"),
  tabs: document.querySelectorAll(".tab"),
  tabPlay: $("#tab-play"),
  tabOptions: $("#tab-options"),
  tabAch: $("#tab-achievements"),
  achList: $("#achList"),
  themeButtons: document.querySelectorAll(".pill"),
  canvas: $("#fxCanvas"),
};

// -------------------------
// Utilitaires
// -------------------------
function randDigit() { return Math.floor(Math.random() * 10); }
function genCode(len) { let s=""; for (let i=0;i<len;i++) s+=randDigit(); return s; }
function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
function fmtLegend() { return `${store.recordNom} (${store.recordScore}s)`; }
function now() { return Date.now(); }
function secondsLeft() { return state.running ? Math.max(0, Math.floor((state.endAt - now())/1000)) : 0; }
function pushFeed(html, cls="") {
  const div = document.createElement("div");
  div.className = "item " + cls;
  div.innerHTML = html;
  els.feed.prepend(div);
}
function saveOptions() {
  localStorage.setItem("options", JSON.stringify(store.options));
}
function award(id, label) {
  if (!store.achievements.includes(id)) {
    store.achievements.push(id);
    localStorage.setItem("achievements", JSON.stringify(store.achievements));
    pushFeed(`🏅 Succès débloqué: <b>${label}</b>`, "hint");
    spark(els.canvas, "accent");
    renderAchievements();
  }
}

// -------------------------
// Effets (sons & particules)
// -------------------------
let audioCtx;
function playTone(freq=440, ms=180, type="sine", gain=0.07) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = type; osc.frequency.value = freq;
    g.gain.value = gain;
    osc.connect(g); g.connect(audioCtx.destination);
    osc.start();
    setTimeout(()=>{ osc.stop(); }, ms);
  } catch {}
}
function successFX() {
  playTone(880, 120, "square", 0.08);
  setTimeout(()=>playTone(1320, 160, "square", 0.08), 120);
  confetti(els.canvas, "accent");
}
function failFX() { playTone(180, 160, "sawtooth", 0.06); }
function tickFX() { playTone(420, 50, "triangle", 0.04); }
function hintFX() { playTone(640, 120, "triangle", 0.06); }

// Particules ultra‑ligères
function spark(canvas, tone="primary") {
  const ctx = canvas.getContext("2d");
  const w = canvas.width = window.innerWidth;
  const h = canvas.height = window.innerHeight;
  const colors = {
    primary: getComputedStyle(document.body).getPropertyValue("--primary"),
    accent:  getComputedStyle(document.body).getPropertyValue("--accent"),
    secondary: getComputedStyle(document.body).getPropertyValue("--secondary"),
  };
  const c = colors[tone] || colors.primary;
  const particles = Array.from({length: 40}, () => ({
    x: w/2 + (Math.random()-0.5)*w*0.2,
    y: h/2 + (Math.random()-0.5)*h*0.2,
    vx: (Math.random()-0.5)*2,
    vy: -Math.random()*2-0.5,
    a: 1
  }));
  let t=0;
  (function loop(){
    t++; ctx.clearRect(0,0,w,h);
    particles.forEach(p=>{
      p.x+=p.vx; p.y+=p.vy; p.a*=0.96;
      ctx.globalAlpha = p.a;
      ctx.fillStyle = c.trim();
      ctx.beginPath(); ctx.arc(p.x,p.y,2.2,0,Math.PI*2); ctx.fill();
    });
    if (t<60) requestAnimationFrame(loop); else ctx.clearRect(0,0,w,h);
  })();
}
function confetti(canvas, tone="primary") {
  const ctx = canvas.getContext("2d");
  const w = canvas.width = window.innerWidth;
  const h = canvas.height = window.innerHeight;
  const base = getComputedStyle(document.body).getPropertyValue("--primary").trim();
  const accent = getComputedStyle(document.body).getPropertyValue("--accent").trim();
  const sec = getComputedStyle(document.body).getPropertyValue("--secondary").trim();
  const cols = [base, accent, sec];
  const parts = Array.from({length: 120}, () => ({
    x: Math.random()*w, y: -10, vy: 2+Math.random()*3, vx: (Math.random()-0.5)*2,
    s: 2+Math.random()*3, c: cols[Math.floor(Math.random()*cols.length)], a: 1
  }));
  let frames=0;
  (function loop(){
    frames++; ctx.clearRect(0,0,w,h);
    parts.forEach(p=>{
      p.x+=p.vx; p.y+=p.vy; p.a*=0.995;
      ctx.globalAlpha = p.a;
      ctx.fillStyle = p.c;
      ctx.fillRect(p.x, p.y, p.s, p.s);
    });
    if (frames<240) requestAnimationFrame(loop); else ctx.clearRect(0,0,w,h);
  })();
}

// -------------------------
// Rendu UI
// -------------------------
function renderHeader() {
  document.body.classList.remove("theme-ocean","theme-amethyst","theme-magma");
  document.body.classList.add(`theme-${store.options.theme}`);
}
function renderStats() {
  els.legend.textContent = fmtLegend();
  els.modeLabel.textContent = state.mode;
  els.diffLabel.textContent = `${state.length} chiffres`;
  const left = secondsLeft();
  els.timer.textContent = state.running ? `${left}s` : "—";
  els.remain.textContent = state.running ? `${left}s` : "—";
  const dur = store.options.duration;
  const done = clamp(((dur - left) / dur) * 100, 0, 100);
  els.progressBar.style.width = `${done}%`;
}
function renderPlayArea() {
  els.playArea.classList.toggle("hidden", !state.running && !state.code);
  if (!state.running && state.code) {
    els.statusTitle.textContent = state.winner ? "ACCÈS ACCORDÉ" : "SYSTÈME VERROUILLÉ";
    els.revealed.textContent = state.code;
  } else if (state.running) {
    els.statusTitle.textContent = "Décryptez. Le Nexus vous observe.";
    els.revealed.textContent = revealMask();
  } else {
    els.statusTitle.textContent = "—";
    els.revealed.textContent = "----";
  }
}
function renderFeed() {
  // déjà rendu via pushFeed à chaque event
}
function renderAchievements() {
  els.achList.innerHTML = "";
  const map = {
    "speed-demon": "Trouvé en moins de 10s",
    "first-blood": "Première victoire",
    "precision-4": "4 BP d’un coup",
    "daily": "Succès du défi du jour",
    "no-hint": "Victoire sans indice",
    "streak-3": "Combo de 3 tentatives en 10s",
  };
  store.achievements.forEach(id=>{
    const li = document.createElement("li");
    li.textContent = "• " + (map[id] || id);
    els.achList.appendChild(li);
  });
}
function revealMask() {
  // Affiche * pour les digits non révélés par indice
  return state.code.split("").map((d,i)=> state.revealedDigits.includes(i) ? d : "•").join("");
}
function renderAll() {
  renderHeader();
  renderStats();
  renderPlayArea();
  renderAchievements();
}

// -------------------------
// Logique du jeu
// -------------------------
function startSolo() {
  state.mode = "Solo";
  state.length = store.options.difficulty;
  state.code = genCode(state.length);
  state.running = true;
  state.endAt = now() + store.options.duration * 1000;
  state.hintsLeft = store.options.hints;
  state.revealedDigits = [];
  state.winner = "";
  state.feed = [];
  els.feed.innerHTML = "";
  pushFeed(`Solo lancé — code de ${state.length} chiffres. Bonne chance.`, "hint");
  spark(els.canvas, "secondary");
  renderAll();
}

function startDaily() {
  state.mode = "Daily";
  const dateSeed = new Date().toISOString().slice(0,10).replace(/-/g,""); // YYYYMMDD
  // simple PRNG basé sur date pour un code “fixe du jour”
  let seed = Number(dateSeed);
  let s = "";
  for (let i=0;i<store.options.difficulty;i++) {
    seed = (seed * 9301 + 49297) % 233280;
    s += (seed % 10);
  }
  state.code = s;
  state.running = true;
  state.endAt = now() + store.options.duration * 1000;
  state.hintsLeft = 1; // daily plus strict
  state.revealedDigits = [];
  state.winner = "";
  state.feed = [];
  els.feed.innerHTML = "";
  pushFeed(`Défi du jour — code fixe. Qui relèvera le défi ?`, "hint");
  award("daily", "Défi du jour");
  spark(els.canvas, "primary");
  renderAll();
}

function startMulti(host, code) {
  state.mode = "Multi";
  code = code.replace(/\D/g, "");
  if (code.length < 4 || code.length > 8) {
    pushFeed(`❗ Le code doit contenir 4 à 8 chiffres.`, "fail");
    failFX(); return;
  }
  state.length = code.length;
  state.code = code;
  state.running = true;
  state.endAt = now() + store.options.duration * 1000;
  state.hintsLeft = store.options.hints;
  state.revealedDigits = [];
  state.winner = "";
  state.feed = [];
  els.feed.innerHTML = "";
  pushFeed(`Partie multi créée par <b>${host}</b>. Décryptez le Nexus.`, "hint");
  spark(els.canvas, "secondary");
  renderAll();
}

function scoreRemaining() {
  return clamp(Math.floor((state.endAt - now())/1000), 0, store.options.duration);
}

function registerRecord(name, score) {
  if (score > store.recordScore) {
    store.recordScore = score;
    store.recordNom = name;
    localStorage.setItem("recordScore", String(score));
    localStorage.setItem("recordNom", name);
    pushFeed(`🏆 Nouveau Legend: <b>${name}</b> (${score}s)`, "win");
    successFX();
  }
}

function evalGuess(player, guess) {
  guess = (guess||"").replace(/\D/g, "");
  if (!state.running) return;
  if (guess.length !== state.length) {
    pushFeed(`❗ <b>${player}</b> — la tentative doit avoir ${state.length} chiffres.`, "fail");
    failFX(); return;
  }

  // Streak tracking
  const ts = now();
  const within10 = (ts - state.lastGuessTs) < 10000;
  state.lastGuessTs = ts;

  let bp=0, mp=0;
  const code = state.code;
  const sU = Array(state.length).fill(false);
  const tU = Array(state.length).fill(false);

  for (let i=0;i<state.length;i++) {
    if (guess[i] === code[i]) { bp++; sU[i]=tU[i]=true; }
  }
  for (let i=0;i<state.length;i++) if (!tU[i]) {
    for (let j=0;j<state.length;j++) if (!sU[j] && guess[i]===code[j]) { mp++; sU[j]=true; break; }
  }

  const cls = (bp===state.length) ? "win" : (bp===0 && mp===0) ? "fail" : "";
  const line = `<b>${player}</b> : ${guess} <span class="bp">${bp} BP</span> | <span class="mp">${mp} MP</span>`;
  pushFeed(line, cls);

  // streak success
  if (within10) award("streak-3", "Combo de 3 tentatives en 10s");

  if (bp === state.length) {
    state.running = false;
    state.winner = player;
    const score = scoreRemaining();
    registerRecord(player, score);
    pushFeed(`🎉 Accès accordé à <b>${player}</b> ! Code: <b>${code}</b>. Score: ${score}s`, "win");
    award("first-blood", "Première victoire");
    if (score >= store.options.duration - 10) award("speed-demon", "Trouvé en moins de 10s");
    if (state.hintsLeft === store.options.hints) award("no-hint", "Victoire sans indice");
    successFX();
  } else {
    tickFX();
    // bonus temps si bonne progression (mini boost)
    if (bp >= Math.floor(state.length/2)) {
      state.endAt += 1500; // +1.5s
    }
  }

  renderAll();
}

function useHint() {
  if (!state.running) return;
  if (state.hintsLeft <= 0) {
    pushFeed(`❗ Plus d’indices disponibles.`, "fail");
    failFX(); return;
  }
  // révèle une position non révélée
  const choices = [];
  for (let i=0;i<state.length;i++) if (!state.revealedDigits.includes(i)) choices.push(i);
  if (choices.length === 0) {
    pushFeed(`ℹ️ Tout est déjà révélé.`, "hint"); return;
  }
  const idx = choices[Math.floor(Math.random()*choices.length)];
  state.revealedDigits.push(idx);
  state.hintsLeft--;
  state.endAt -= 5000; // coût en temps
  pushFeed(`💡 Indice: position ${idx+1} = <b>${state.code[idx]}</b> (–5s)`, "hint");
  hintFX();
  renderAll();
}

function resetGame() {
  const wasRunning = state.running;
  state = {
    mode: "—", code: "", length: store.options.difficulty,
    running: false, endAt: 0, hintsLeft: store.options.hints,
    revealedDigits: [], winner: "", feed: [], lastGuessTs: 0,
  };
  els.feed.innerHTML = "";
  pushFeed(wasRunning ? "♻️ Reboot de la partie." : "⏹️ Réinitialisation.", "hint");
  spark(els.canvas, "secondary");
  renderAll();
}

// -------------------------
// Événements UI
// -------------------------
els.btnSolo.addEventListener("click", startSolo);
els.btnDaily.addEventListener("click", startDaily);
els.formMulti.addEventListener("submit", e=>{
  e.preventDefault();
  const fd = new FormData(els.formMulti);
  const host = (fd.get("host")||"Maître").toString().trim();
  const code = (fd.get("code")||"").toString().trim();
  startMulti(host, code);
});
els.formGuess.addEventListener("submit", e=>{
  e.preventDefault();
  const fd = new FormData(els.formGuess);
  evalGuess((fd.get("player")||"Agent").toString().trim(), (fd.get("guess")||"").toString().trim());
  els.formGuess.reset();
});
els.btnReset.addEventListener("click", resetGame);
els.btnHint.addEventListener("click", useHint);

els.difficulty.value = String(store.options.difficulty);
els.duration.value = String(store.options.duration);
els.hints.value = String(store.options.hints);
els.btnSaveOpts.addEventListener("click", ()=>{
  store.options.difficulty = parseInt(els.difficulty.value);
  store.options.duration = parseInt(els.duration.value);
  store.options.hints = parseInt(els.hints.value);
  saveOptions();
  pushFeed("⚙️ Options sauvegardées.", "hint");
  renderAll();
});
els.btnClearData.addEventListener("click", ()=>{
  localStorage.removeItem("recordNom");
  localStorage.removeItem("recordScore");
  localStorage.removeItem("achievements");
  store.recordNom = "Aucun";
  store.recordScore = 0;
  store.achievements = [];
  pushFeed("🧹 Records et succès réinitialisés.", "hint");
  renderAchievements();
  renderStats();
});

// Tabs
els.tabs.forEach(tab=>{
  tab.addEventListener("click", ()=>{
    els.tabs.forEach(t=>t.classList.remove("active"));
    tab.classList.add("active");
    const tgt = tab.getAttribute("data-tab");
    els.tabPlay.classList.toggle("hidden", tgt!=="play");
    els.tabOptions.classList.toggle("hidden", tgt!=="options");
    els.tabAch.classList.toggle("hidden", tgt!=="achievements");
  });
});

// Themes
function setTheme(theme) {
  store.options.theme = theme;
  saveOptions();
  renderHeader();
  spark(els.canvas, "primary");
}
els.themeButtons.forEach(b=>{
  b.addEventListener("click", ()=> setTheme(b.getAttribute("data-theme")));
});

// -------------------------
// Boucle et init
// -------------------------
function tick() {
  if (state.running) {
    const left = secondsLeft();
    if (left <= 0) {
      state.running = false;
      pushFeed(`⌛ Temps écoulé ! Code: <b>${state.code}</b>`, "fail");
      failFX();
    }
  }
  renderStats();
  requestAnimationFrame(tick);
}
window.addEventListener("keydown", (e)=>{
  if (e.key === "Enter") {
    const playerInput = els.formGuess.querySelector('input[name="player"]');
    const guessInput = els.formGuess.querySelector('input[name="guess"]');
    if (document.activeElement === guessInput) {
      els.formGuess.requestSubmit();
    } else {
      guessInput.focus();
    }
  }
});

renderHeader();
renderAchievements();
renderAll();
tick();
