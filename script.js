let codeSecret = "";
let jeuEnCours = false;
let gagnant = "";
let historiqueHTML = "";
let recordNom = localStorage.getItem("recordNom") || "Aucun";
let recordScore = parseInt(localStorage.getItem("recordScore") || "0");
let finPartieMillis = 0;
const DUREE_MANCHE = 60 * 1000;

const el = {
  legend: document.getElementById('legend'),
  init: document.getElementById('init'),
  jeu: document.getElementById('jeu'),
  verrou: document.getElementById('verrou'),
  remain: document.getElementById('remain'),
  statusTxt: document.getElementById('statusTxt'),
  codeTxt: document.getElementById('codeTxt'),
  flux: document.getElementById('flux'),
  btnSolo: document.getElementById('btnSolo'),
  formMulti: document.getElementById('formMulti'),
  formDeviner: document.getElementById('formDeviner'),
  btnReset: document.getElementById('btnReset'),
};

function majUI() {
  el.legend.textContent = `${recordNom} (${recordScore}s)`;
  if (jeuEnCours) {
    el.init.style.display = 'none';
    el.verrou.style.display = 'none';
    el.jeu.style.display = 'block';
    let remain = Math.max(0, Math.floor((finPartieMillis - Date.now())/1000));
    el.remain.textContent = `${remain}s`;
    if(remain <= 0) {
      jeuEnCours = false;
      historiqueHTML = `<div class='item red'>⌛ TEMPS ÉCOULÉ ! Code : ${codeSecret}</div>` + historiqueHTML;
    }
  } else {
    el.jeu.style.display = 'none';
    if(codeSecret === "") {
      el.init.style.display = 'block';
      el.verrou.style.display = 'none';
    } else {
      el.init.style.display = 'none';
      el.verrou.style.display = 'block';
      el.statusTxt.textContent = (gagnant === "") ? "SYSTÈME VERROUILLÉ" : "ACCÈS ACCORDÉ";
      el.codeTxt.textContent = codeSecret;
    }
  }
  el.flux.innerHTML = historiqueHTML;
}

function startSolo() {
  codeSecret = "";
  for(let i=0;i<4;i++) codeSecret += Math.floor(Math.random()*10);
  jeuEnCours = true;
  finPartieMillis = Date.now() + DUREE_MANCHE;
  historiqueHTML = "";
  majUI();
}

function startMulti(code) {
  if(code.length === 4) {
    codeSecret = code;
    jeuEnCours = true;
    finPartieMillis = Date.now() + DUREE_MANCHE;
    historiqueHTML = "";
    majUI();
  }
}

function deviner(nom, tent) {
  if(!jeuEnCours) return;
  finPartieMillis = Date.now() + DUREE_MANCHE;
  let bp=0, mp=0;
  let sU=[0,0,0,0], tU=[0,0,0,0];
  for(let i=0;i<4;i++) {
    if(tent[i]===codeSecret[i]) { bp++; sU[i]=tU[i]=true; }
  }
  for(let i=0;i<4;i++) {
    if(!tU[i]) {
      for(let j=0;j<4;j++) {
        if(!sU[j] && tent[i]===codeSecret[j]) { mp++; sU[j]=true; break; }
      }
    }
  }
  let style = (bp===4) ? "item green" : "item blue";
  let res = `<div class='${style}'><b>${nom}</b> : ${tent} <span class='bp'>${bp} BP</span> | <span class='mp'>${mp} MP</span></div>`;
  historiqueHTML = res + historiqueHTML;
  if(bp===4) {
    jeuEnCours=false; gagnant=nom;
    let scoreFinal=Math.floor((finPartieMillis-Date.now())/1000);
    if(scoreFinal>recordScore) {
      recordScore=scoreFinal; recordNom=nom;
      localStorage.setItem("recordScore", recordScore);
      localStorage.setItem("recordNom", recordNom);
    }
  }
  majUI();
}
function resetGame() {
  codeSecret = "";
  jeuEnCours = false;
  gagnant = "";
  historiqueHTML = "";
  majUI();
}

// 🎮 Événements
el.btnSolo.addEventListener('click', startSolo);

el.formMulti.addEventListener('submit', e => {
  e.preventDefault();
  const code = new FormData(el.formMulti).get('c');
  startMulti(code);
});

el.formDeviner.addEventListener('submit', e => {
  e.preventDefault();
  const fd = new FormData(el.formDeviner);
  deviner(fd.get('n'), fd.get('t'));
});

el.btnReset.addEventListener('click', resetGame);

// ⏱️ Rafraîchissement du timer
setInterval(majUI, 1000);

// 🚀 Initialisation
majUI();
