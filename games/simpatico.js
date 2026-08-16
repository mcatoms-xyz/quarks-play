/* SIMPATICO! - a game module for the XYZ Quarks Mobile engine.
   Design: Rob Huber and Brendan Riley (Rattlebox). Rules v0.4.1.

   Everyone secretly builds a four word chain: a prompt word, then three
   Transformation cards turning each word into the next. Then, one at a time,
   each player is the WORDSMITH and reveals only the prompt, the result and
   which three cards they used. Everyone else guesses the two hidden middles.

   The spotlight seat is the WORDSMITH. The engine stores it in G.spotId.

   🔑 TWO ROTATIONS AT 3-4 PLAYERS is a printed rule, not a preference:
   "For games with 3 or 4 players: the game ends after each player has been
   Wordsmith twice." That is what defaultRotations encodes, and it is the reason
   the engine asks the game for a rotation count instead of assuming one.

   ⚖️ CARD PROVENANCE: the 40 Transformation cards below are read off the
   printed sheet (S! Cards.pdf, pages 2/4/6/8), which is image-only, so they
   were transcribed from the rendered pages rather than extracted as text.
   ⚠️ THE RULES AND THE CARDS DISAGREE ON THE COUNT. Rules v0.4.1 says
   "32 Transformation cards - 8 each in four colors". The printed sheet has TEN
   per colour, 40 in total, plus 8 blanks for players to write their own. The
   artifact wins, so 40 ship. Worth Rob and Brendan confirming which is current.
   The blanks are not implemented; writing your own card is a table thing.

   🔴 ONE ADAPTATION CALL THAT IS NOT MINE TO MAKE ALONE: at the table, whether
   a guess counts is settled by the group looking at it. Here, guesses are
   auto-matched on a normalised string and THE WORDSMITH CAN OVERRIDE ANY OF
   THEM before scoring. That keeps the human judgement the printed game relies
   on while not making everyone adjudicate every round. Rob and Brendan own this
   game's rules and should sign off on it. */

/* Four suits. Shape rides along with colour so the suit is not colour-only. */
const S_SUITS = [
  { id:"black", label:"Black", shape:"●", hex:"#1b1630" },
  { id:"red",   label:"Red",   shape:"■", hex:"#d0342c" },
  { id:"blue",  label:"Blue",  shape:"▲", hex:"#3fa9f5" },
  { id:"green", label:"Green", shape:"◀", hex:"#3fa663" }
];

const S_CARDS = {
  black: [
    ["Synonym","Another word for it"], ["Cousin","Similar but different"],
    ["Person","Related to / Reminds of"], ["Place","Related to / Reminds of"],
    ["Object","Related to / Reminds of"], ["Gift","Version or aspect happily given"],
    ["Black","A dark demeanor"], ["Frustrating","A source of botheration"],
    ["Futuristic","A far flung time"], ["Fantastic","As told in tales and lore"]
  ],
  red: [
    ["Rhyme","Time to Rhyme"], ["Same First Two Letters","Starts with the same first two"],
    ["Change One Letter","The others stay"], ["-1 Letter","No repeats, any order"],
    ["+1 Letter","No repeats, any order"], ["Fashion","Snazzy couture"],
    ["Red","A scarlet semblance"], ["Change the Middle","Keep the first and last letter"],
    ["Starts With the Last Letter","Begin as it ended"], ["Celebrity","Reminds or relates to a famous"]
  ],
  blue: [
    ["Worse","A worse version"], ["Better","A better version"],
    ["Fancier","More intricate or eloquent"], ["Bigger","On a grander scale"],
    ["Smaller","On a more modest scale"], ["Funnier","Cause more guffaws"],
    ["Blue","An azul appearance"], ["Innocent","A version free from evil or guilt"],
    ["Weaponize","A martial connection or version"], ["Slang","How we say it in the streets"]
  ],
  green: [
    ["Opposite","Mutually exclusive"], ["Color","The hue you construe"],
    ["Often With","A word often used with it"], ["Same Letters","No new. May repeat"],
    ["Evil","A wicked version"], ["Helpful","Is an aid in some way"],
    ["Green","A verdant visage"], ["Smell","The stink do you think"],
    ["Food","Fare that it reminds of or relates to"], ["Emotion","The feeling it inspires"]
  ]
};

/* Sample prompts, off the printed player boards. */
const S_PROMPTS = [
  "Average","Bag","City","Death","Edge","File","Gear","Heart","Index","Jolt",
  "Kernel","Light","Master","Neon","Ocean","People","Quilt","Round","Spark",
  "Team","Uniform","Voice","Wing","Yak","Zoo","Apricot","Color","Dozen","Egg",
  "Friend","Glass","Horse","Impact","Knife","Money","Nurse","Plant","Reach",
  "Wheel","Youth","Zone","Banana","Cell","Deer","Fang","Garden","Kettle","Land",
  "Object","Pair","Resort","Tool","Valley","Yacht"
];

const S_BOT_NAMES = ["Lexicon","Thesaurus","Etymon","Syllable","Consonant","Verbatim"];

function sNewState(code){
  return {
    phase: "lobby",   // lobby | build | guess | reveal1 | revise | reveal2 | score | end
    code: code,
    players: [], spotId: null,
    round: 0, totalRounds: 0,
    builtIds: [],        // who has finished their chain
    board: null,         // the wordsmith's public puzzle this round
    guessIds: [],        // who has locked a guess this round
    reveal: null,        // {link1, link2, rows:[...]} built at reveal time
    paused:false, pausedAt:0,
    gameStartedAt:0, gamePausedMs:0, roundStartedAt:0, roundPausedMs:0,
    lastScores: [], winners: []
  };
}

/* ---------- host-private ---------- */
let sChains = {};   // pid -> {prompt, cards:[3 ids], link1, link2, result}
let sHands  = {};   // pid -> [4 card ids, one per suit]
let sGuesses = {};  // pid -> {link1, link2, simpatico, firstLink2, revised}
let sBotTimers = [];

function sCardById(id){
  const [suit, i] = id.split(":");
  const c = (S_CARDS[suit]||[])[+i];
  return c ? { id:id, suit:suit, name:c[0], hint:c[1] } : null;
}
/* Setup: "Sort the Transformation cards into decks by colour and shuffle each
   deck. Deal one card of each colour to each player." That is dealing WITHOUT
   replacement. Picking a random index per player independently let two people
   hold the same card, which cannot happen at a table, and would have made a
   guesser's job strange without ever looking like a bug. Ten cards per suit is
   the printed sheet, so eight players deal cleanly. */
function sDealHands(){
  sHands = {};
  const decks = {};
  S_SUITS.forEach(su => {
    const d = S_CARDS[su.id].map((c,i) => su.id + ":" + i);
    for(let i = d.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [d[i], d[j]] = [d[j], d[i]];
    }
    decks[su.id] = d;
  });
  G.players.forEach(p => {
    sHands[p.id] = S_SUITS.map(su => decks[su.id].pop() || (su.id + ":0"));
  });
}
function sNorm(x){
  return String(x||"").toLowerCase().trim()
    .replace(/[^a-z0-9 ]/g,"").replace(/\s+/g," ");
}

function sClearBots(){ sBotTimers.forEach(clearTimeout); sBotTimers = []; }
function sAddBot(){
  if(!isHost || !G || G.phase !== "lobby") return;
  const taken = G.players.map(p => p.name);
  const name = S_BOT_NAMES.find(n => !taken.includes(n));
  if(!name) return;
  G.players.push({ id:"bot-"+Math.random().toString(36).slice(2,8), name:name,
    color:COLORS[G.players.length % COLORS.length], score:0, judged:false, online:true, bot:true });
  pushState();
}
/* Bots build a chain and guess. They are deliberately BAD guessers: landing a
   Simpatico off a coin flip would feel like the game cheating, so they never
   claim it and they guess from the word pool rather than from the answer. */
function sBotWord(){ return S_PROMPTS[Math.floor(Math.random()*S_PROMPTS.length)]; }
function sScheduleBots(){
  sClearBots();
  if(!isHost || !G || G.paused) return;
  const round = G.round, phase = G.phase;
  if(phase === "build"){
    G.players.filter(p => p.bot && !G.builtIds.includes(p.id)).forEach(b => {
      sBotTimers.push(setTimeout(() => {
        if(!isHost || !G || G.phase !== "build") return;
        const hand = sHands[b.id] || [];
        sInput({ type:"buildChain", id:b.id, prompt:sBotWord(), cards:hand.slice(0,3),
                 link1:sBotWord(), link2:sBotWord(), result:sBotWord() });
      }, 2000 + Math.random()*5000));
    });
    return;
  }
  if(phase === "guess"){
    G.players.filter(p => p.bot && p.id !== G.spotId && !G.guessIds.includes(p.id)).forEach(b => {
      sBotTimers.push(setTimeout(() => {
        if(!isHost || !G || G.phase !== "guess" || G.round !== round) return;
        sInput({ type:"lockGuess", id:b.id, link1:sBotWord(), link2:sBotWord(), simpatico:false });
      }, 2500 + Math.random()*6000));
    });
  }
}

/* ---------- rounds ---------- */
function sNextRound(){
  sClearBots();
  if(!G.round){                       // first call: everyone builds before anyone reveals
    sDealHands(); sChains = {}; G.builtIds = [];
    G.phase = "build"; G.round = 0;
    G.roundStartedAt = Date.now(); G.roundPausedMs = 0;
    sScheduleBots();
    return;
  }
  G.round++;
  if(lengthGameOver(G)){ sEndGame(); return; }
  let next = G.players.find(p => !p.judged && p.online && !p.bot);
  if(!next){
    G.players.forEach(p => p.judged = false);
    next = G.players.find(p => p.online && !p.bot);
  }
  if(!next){ sEndGame(); return; }
  G.spotId = next.id;
  next.judged = true;
  sGuesses = {}; G.guessIds = []; G.reveal = null; G.lastScores = [];
  const ch = sChains[next.id];
  G.board = ch ? { prompt:ch.prompt, result:ch.result, cards:ch.cards } : null;
  G.phase = "guess";
  G.roundStartedAt = Date.now(); G.roundPausedMs = 0;
  sScheduleBots();
}

/* Everyone still connected has locked a guess. */
function sMaybeReveal(){
  if(G.phase !== "guess" || G.guessIds.length === 0) return;
  const waiting = offSpot().filter(t => t.online && !G.guessIds.includes(t.id));
  if(waiting.length) return;
  sBuildReveal();
  G.phase = "reveal1";
}
function sBuildReveal(){
  const ch = sChains[G.spotId] || {};
  G.reveal = { link1:ch.link1, link2:ch.link2, rows: G.guessIds.map(id => {
    const g = sGuesses[id] || {}; const who = player(id);
    return { id:id, name: who?who.name:"?", color: who?who.color:null, bot: !!(who&&who.bot),
      link1:g.link1||"", link2:g.link2||"", firstLink2:g.firstLink2||"",
      simpatico: !!g.simpatico, revised: false,
      ok1: sNorm(g.link1) === sNorm(ch.link1) && sNorm(ch.link1) !== "",
      ok2: false, pts: 0 };
  })};
}

/* ---------- scoring, straight off the printed rules ---------- */
function sScoreRound(){
  const ch = sChains[G.spotId] || {};
  const rows = G.reveal.rows;
  rows.forEach(r => {
    r.ok2 = sNorm(r.link2) === sNorm(ch.link2) && sNorm(ch.link2) !== "";
    // "correct on their FIRST guess for both links" is what the bonuses key off,
    // so a revised link two can still score its point but never the bonus.
    /* "Any Guesser who was correct on their FIRST guess for both links earns one
       extra point (for a total of three)." The total-of-three wording ties the
       bonus to also holding both link points, so this needs ok1 AND ok2 AND the
       first link-two guess having been right. Keying off r.revised instead was
       wrong two ways: revising to the SAME correct word lost the bonus, and it
       described the button rather than the answer. */
    const firstBoth = r.ok1 && r.ok2 && sNorm(r.firstLink2) === sNorm(ch.link2) && sNorm(ch.link2) !== "";
    r.firstBoth = firstBoth;
    if(r.simpatico){
      // claimed and nailed it without revising = 6. Claimed and missed = nothing.
      r.pts = firstBoth ? 6 : 0;
      r.note = firstBoth ? "SIMPATICO!" : "Simpatico missed";
    } else {
      r.pts = (r.ok1?1:0) + (r.ok2?1:0) + (firstBoth?1:0);
      r.note = firstBoth ? "both, first try" : (r.pts ? "on the board" : "");
    }
  });
  const scorers = rows.filter(r => r.pts > 0);
  const simpHits = rows.filter(r => r.simpatico && r.pts > 0).length;
  let wordsmith = 0, antipatico = false;
  if(!scorers.length){
    // "If no Guessers scored points, the Wordsmith was Antipatico!"
    antipatico = true;
    rows.forEach(r => { r.pts = 1; r.note = "Antipatico"; });
    wordsmith = 0;
  } else if(scorers.length === rows.length){
    wordsmith = 0;                       // everybody got it, too easy
  } else {
    wordsmith = scorers.length + simpHits * 2;
  }
  G.reveal.antipatico = antipatico;
  G.reveal.wordsmithPts = wordsmith;
  const delta = {}; G.players.forEach(p => delta[p.id] = 0);
  rows.forEach(r => delta[r.id] = r.pts);
  delta[G.spotId] = wordsmith;
  G.lastScores = G.players.map(p => {
    const d = delta[p.id] || 0;
    p.score += d;
    p.wsPoints = (p.wsPoints||0) + (p.id === G.spotId ? d : 0);   // tiebreak 1
    if(rows.find(r => r.id === p.id && r.simpatico && r.pts > 0)) p.simps = (p.simps||0) + 1;
    return { name:p.name, color:p.color, delta:d, total:p.score,
             judge: p.id === G.spotId, bot: !!p.bot };
  }).sort((a,b) => b.total - a.total);
  G.phase = "score";
}

function sEndGame(){
  sClearBots(); clearHostSession();
  G.phase = "end";
  /* Printed tiebreak: most points scored during your own Wordsmith turn, then
     most successful Simpatico!s. */
  /* Printed tiebreak: most points scored during your own Wordsmith turn, then
     most successful Simpatico!s. Beyond that the rules stop, so the win is
     shared rather than handed to whoever happened to sort first. */
  const rank = (a,b) => (b.score - a.score)
    || ((b.wsPoints||0) - (a.wsPoints||0))
    || ((b.simps||0) - (a.simps||0));
  const best = G.players.slice().sort(rank);
  G.winners = best.filter(p => rank(best[0], p) === 0).map(p => p.name);
  G.lastScores = best.map(p => ({name:p.name, color:p.color, delta:0, total:p.score}));
}

/* ---------- host: inputs ---------- */
function sInput(m){
  if(m.type === "buildChain" && G.phase === "build"){
    const p = player(m.id); if(!p || G.builtIds.includes(m.id)) return;
    const hand = sHands[m.id] || [];
    const cards = (m.cards||[]).filter(c => hand.includes(c));
    if(cards.length !== 3 || new Set(cards).size !== 3) return;
    const cut = s => String(s||"").trim().slice(0,40);
    if(!cut(m.prompt) || !cut(m.link1) || !cut(m.link2) || !cut(m.result)) return;
    sChains[m.id] = { prompt:cut(m.prompt), cards:cards,
                      link1:cut(m.link1), link2:cut(m.link2), result:cut(m.result) };
    G.builtIds.push(m.id);
    const waiting = G.players.filter(p2 => p2.online && !G.builtIds.includes(p2.id));
    if(!waiting.length){ G.round = 0; sNextRoundFromBuild(); }
    pushState(); if(G.phase === "guess") sScheduleBots(); return;
  }
  if(m.type === "lockGuess" && G.phase === "guess"){
    const p = player(m.id);
    if(!p || m.id === G.spotId || G.guessIds.includes(m.id)) return;
    sGuesses[m.id] = { link1:String(m.link1||"").trim().slice(0,40),
                       link2:String(m.link2||"").trim().slice(0,40),
                       firstLink2:String(m.link2||"").trim().slice(0,40),
                       simpatico: !!m.simpatico };
    G.guessIds.push(m.id);
    sMaybeReveal();
    pushState(); return;
  }
  if(m.type === "toRevise" && G.phase === "reveal1" && m.id === G.spotId){
    // anyone who claimed Simpatico is locked out of revising, by the rules
    G.phase = G.reveal.rows.some(r => !r.simpatico) ? "revise" : "reveal2";
    if(G.phase === "reveal2") sScoreRound();
    pushState(); return;
  }
  if(m.type === "revise" && G.phase === "revise"){
    const row = G.reveal.rows.find(r => r.id === m.id);
    if(!row || row.simpatico) return;
    row.link2 = String(m.link2||"").trim().slice(0,40);
    row.revised = true;
    pushState(); return;
  }
  if(m.type === "toReveal2" && G.phase === "revise" && m.id === G.spotId){
    sScoreRound(); pushState(); return;
  }
  /* The wordsmith can overturn the string match either way before scoring. */
  if(m.type === "override" && G.phase === "reveal1" && m.id === G.spotId){
    const row = G.reveal.rows.find(r => r.id === m.target);
    if(row){ row.ok1 = !row.ok1; row.judged1 = true; }
    pushState(); return;
  }
  if(m.type === "nextRound" && G.phase === "score" && m.id === G.spotId){
    sNextRound(); pushState(); return;
  }
}
/* Build finished: hand off to the first wordsmith. */
function sNextRoundFromBuild(){ G.round = 0; sNextRound2(); }
function sNextRound2(){ G.round = 1; 
  let next = G.players.find(p => !p.judged && p.online && !p.bot);
  if(!next){ sEndGame(); return; }
  G.spotId = next.id; next.judged = true;
  sGuesses = {}; G.guessIds = []; G.reveal = null; G.lastScores = [];
  const ch = sChains[next.id];
  G.board = ch ? { prompt:ch.prompt, result:ch.result, cards:ch.cards } : null;
  G.phase = "guess";
  G.roundStartedAt = Date.now(); G.roundPausedMs = 0;
}

function sForce(){
  if(!isHost || !G) return;
  sClearBots();
  if(G.phase === "build"){
    // fill anyone missing so one idle player cannot hold the table
    G.players.filter(p => !G.builtIds.includes(p.id)).forEach(p => {
      const hand = sHands[p.id] || [];
      sChains[p.id] = { prompt:sBotWord(), cards:hand.slice(0,3),
                        link1:sBotWord(), link2:sBotWord(), result:sBotWord() };
      G.builtIds.push(p.id);
    });
    sNextRoundFromBuild();
  }
  else if(G.phase === "guess"){ if(G.guessIds.length){ sBuildReveal(); G.phase = "reveal1"; } }
  else if(G.phase === "reveal1"){ G.phase = "reveal2"; sScoreRound(); }
  else if(G.phase === "revise"){ sScoreRound(); }
  else if(G.phase === "score"){ sNextRound(); }
  pushState();
}

/* ---------- player: local state ---------- */
let sSel = [];        // card ids this device picked, in order
/* 🔴 THE WORDS LIVE HERE, NOT IN THE DOM. Tapping a Transformation card
   re-renders the whole panel, which destroys the <input> elements and wipes
   whatever you had typed. Adam hit this immediately: "the fields are clearing
   when I select the transformations." Values are mirrored here on every
   keystroke and rendered back in, so a re-render is lossless. */
let sDraft = { prompt:"", l1:"", l2:"", res:"" };
function sType(k, v){ sDraft[k] = v; sLiveChain(); }
/* Updates the always-visible chain in place, WITHOUT a re-render, so typing
   never rebuilds the field you are typing in. */
function sLiveChain(){
  const box = el("s-live"); if(!box) return;
  const w = t => t ? `<b>${esc(t)}</b>` : `<span class="blank">?</span>`;
  box.innerHTML = `${w(sDraft.prompt)}<span class="ar">&rarr;</span>${w(sDraft.l1)}` +
    `<span class="ar">&rarr;</span>${w(sDraft.l2)}<span class="ar">&rarr;</span>${w(sDraft.res)}`;
}
/* "Choose any word that strikes your fancy, or pick one from the back of your
   board." The board's sample words existed in this file but only the bots ever
   saw them, so a player staring at an empty box had nothing to lean on. */
function sPickSuggestions(){
  const pool = S_PROMPTS.slice();
  const out = [];
  while(out.length < 4 && pool.length) out.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
  return out;
}
let sSuggest = sPickSuggestions();
function sReroll(){ sSuggest = sPickSuggestions(); play("select"); renderPlayer(lastState); }
function sUseWord(w){ sDraft.prompt = w; const i = el("s-prompt"); if(i) i.value = w;
  play("select"); sLiveChain(); }
function sTapCard(id){
  if(sSel.includes(id)) sSel = sSel.filter(c => c !== id);
  else if(sSel.length < 3) sSel = sSel.concat([id]);
  /* At three, a tap on a fourth card used to do NOTHING, silently. You would tap,
     watch nothing happen, and have to work out that you must first un-tap one.
     Same behaviour Opening Act already had: the oldest pick drops off. */
  else sSel = sSel.slice(1).concat([id]);
  play("select"); renderPlayer(lastState);
}
function sBuild(){
  if(sSel.length !== 3) return;
  const d = { prompt:sDraft.prompt.trim(), l1:sDraft.l1.trim(),
              l2:sDraft.l2.trim(), res:sDraft.res.trim() };
  if(!d.prompt || !d.l1 || !d.l2 || !d.res) return;
  play("confirm");
  sendInput({ type:"buildChain", id:pid, prompt:d.prompt, cards:sSel.slice(),
              link1:d.l1, link2:d.l2, result:d.res });
  sSel = []; sDraft = { prompt:"", l1:"", l2:"", res:"" };
}
let sClaim = false;
function sToggleClaim(){ sClaim = !sClaim; play("select"); renderPlayer(lastState); }
function sLock(){
  const a = el("s-g1").value.trim(), b = el("s-g2").value.trim();
  if(!a || !b) return;
  play("confirm");
  sendInput({ type:"lockGuess", id:pid, link1:a, link2:b, simpatico:sClaim });
  sClaim = false;
}
function sRevise(){
  const b = el("s-r2").value.trim(); if(!b) return;
  play("confirm"); sendInput({ type:"revise", id:pid, link2:b });
}
/* Name the card that produces each box. Without this the picker and the three
   inputs are two unrelated lists and nothing on screen says card ONE makes link
   ONE. That is the whole mechanic, and it was left implicit. */
function sStep(n){
  const id = sSel[n-1];
  const c = id ? sCardById(id) : null;
  const suit = c ? (S_SUITS.find(x => x.id === c.suit) || {}) : {};
  return `<div class="chainstep">
    <span class="stepnum">${n}</span>
    ${c ? `<span style="color:${suit.hex}">${suit.shape}</span> <b>${esc(c.name)}</b>
           <span class="thint">${esc(c.hint)}</span>`
        : `<span class="dimprompt">pick your ${n===1?"first":n===2?"second":"third"} card above</span>`}
    <span class="arrow">turns it into &darr;</span></div>`;
}
function sCardChip(id, n){
  const c = sCardById(id); if(!c) return "";
  const suit = S_SUITS.find(s => s.id === c.suit) || {};
  return `<div class="tcard" style="border-color:${suit.hex}">
    ${n?`<span class="tnum">${n}</span>`:""}
    <span class="tsuit" style="color:${suit.hex}">${suit.shape}</span>
    <span class="tname">${esc(c.name)}</span>
    <span class="thint">${esc(c.hint)}</span></div>`;
}

function sRenderPhase(S, M, me, isSpot){
  const smith = player2name(S, S.spotId);
  const myHand = (S.hands && S.hands[pid]) || [];

  if(S.phase === "build"){
    if(S.builtIds.includes(pid)){
      M.innerHTML = `<h2>Chain locked</h2>
        ${waitBlock("You're in", waitingLine(S, S.builtIds, false, "building"))}`;
      return;
    }
    M.innerHTML = `<h2>Build your chain</h2>
      <div class="status">Pick a starting word, then <b>three</b> of your four cards, in the order
      you'll use them. Each card turns the word before it into the next one. Keep the middles secret.<br>
      <b>Take your time.</b> Nobody reveals anything until everyone has locked a chain.</div>
      <div class="livewrap"><div class="livechain" id="s-live"></div></div>
      <input type="text" id="s-prompt" maxlength="40" placeholder="Starting word" autocomplete="off"
        value="${esc(sDraft.prompt)}" oninput="sType('prompt',this.value)">
      <div class="eg">Like this: <b>ROCK</b> + <i>Better</i> &rarr; <b>DIAMOND</b>,
        then <b>DIAMOND</b> + <i>Color</i> &rarr; <b>WHITE</b>. Only the first and last word get shown.</div>
      <div class="status">Stuck? ${sSuggest.map(w =>
        `<a href="#" class="sugg" onclick="sUseWord('${esc(w)}');return false">${esc(w)}</a>`).join(" ")}
        <a href="#" class="sugg more" onclick="sReroll();return false">more</a></div>
      <div class="tlist">${myHand.map(id => `<div class="tpick ${sSel.includes(id)?"sel":""}"
        onclick="sTapCard('${id}')">${sCardChip(id, sSel.indexOf(id)+1 || "")}</div>`).join("")}</div>
      <div class="status">${sSel.length}/3 cards chosen${sSel.length===3?", in that order":""}</div>
      ${sStep(1)}<input type="text" id="s-l1" maxlength="40" placeholder="Link one (hidden)" autocomplete="off"
        value="${esc(sDraft.l1)}" oninput="sType('l1',this.value)">
      ${sStep(2)}<input type="text" id="s-l2" maxlength="40" placeholder="Link two (hidden)" autocomplete="off"
        value="${esc(sDraft.l2)}" oninput="sType('l2',this.value)">
      ${sStep(3)}<input type="text" id="s-res" maxlength="40" placeholder="Result (everyone sees this)" autocomplete="off"
        value="${esc(sDraft.res)}" oninput="sType('res',this.value)">
      <button class="btn" onclick="sBuild()">Lock my chain</button>`;
    sLiveChain();
    return;
  }

  const board = S.board || {};
  /* Shown as an actual chain with the gaps in it. Prompt and Result on separate
     rows made you infer that the three cards bridge them in order, which is the
     one thing a guesser needs to see immediately. */
  const puzzle = `<div class="puzzle">
    <div class="chain"><b>${esc(board.prompt||"?")}</b>
      <span class="link">?</span><span class="link">?</span>
      <b>${esc(board.result||"?")}</b></div>
    <div class="status" style="margin-top:2px">Start, two hidden words, end. These three cards made it, in this order:</div>
    <div class="tlist small">${(board.cards||[]).map((c,i) => sCardChip(c, i+1)).join("")}</div></div>`;

  if(S.phase === "guess"){
    if(isSpot){
      M.innerHTML = `<h2>You're the Wordsmith</h2>${puzzle}
        ${waitBlock("No rush, it waits for everyone", waitingLine(S, S.guessIds, true, "guessing"))}`;
      return;
    }
    if(S.guessIds.includes(pid)){
      M.innerHTML = `<h2>Guess locked</h2>${puzzle}${waitBlock("You're in", waitingLine(S, S.guessIds, true, "guessing"))}`;
      return;
    }
    M.innerHTML = `<h2>${esc(smith)}'s chain</h2>${puzzle}
      <div class="status">Work out the two hidden words. Sure about both? Claim Simpatico for
      <b>6</b>, but you can't revise and a miss scores you nothing.<br>
      <b>Take your time.</b> Nothing is revealed until everyone has locked a guess.</div>
      <input type="text" id="s-g1" maxlength="40" placeholder="Link one" autocomplete="off">
      <input type="text" id="s-g2" maxlength="40" placeholder="Link two" autocomplete="off">
      <button class="btn ${sClaim?"gold":"ghost"}" onclick="sToggleClaim()">
        ${sClaim ? "SIMPATICO! claimed" : "Claim Simpatico!"}</button>
      <button class="btn" onclick="sLock()">Lock it in</button>`;
    return;
  }

  if(S.phase === "reveal1"){
    const rows = (S.reveal && S.reveal.rows) || [];
    M.innerHTML = `<h2>Link one</h2>${puzzle}
      <div class="bigword">${esc((S.reveal||{}).link1 || "")}</div>
      <div class="guesslist">${rows.map(r => `<div class="grow ${r.ok1?"hit":"miss"}">
        <span><span class="cdot" style="background:${r.color||"#8a93a8"}"></span>${esc(r.name)}
        ${r.simpatico?'<span class="tag judge">SIMPATICO</span>':""}</span>
        <span>${esc(r.link1||"-")} ${r.ok1?"✓":"✗"}
        ${isSpot?`<a href="#" onclick="sendInput({type:'override',id:pid,target:'${r.id}'});return false" class="ovr">flip</a>`:""}</span>
      </div>`).join("")}</div>
      ${isSpot ? `<div class="status">Auto-matched on spelling. Tap <b>flip</b> on anything you'd
        count differently, then move on.</div>
        <button class="btn" onclick="sendInput({type:'toRevise', id:pid})">Reveal link two next</button>`
        : `<div class="status">${esc(smith)} is checking the answers.</div>`}`;
    return;
  }

  if(S.phase === "revise"){
    const mine = ((S.reveal||{}).rows || []).find(r => r.id === pid);
    if(isSpot){
      M.innerHTML = `<h2>Second chances</h2>${puzzle}
        <div class="status">Anyone who didn't claim Simpatico can change their link two.
        Give them a few seconds.</div>
        <button class="btn" onclick="sendInput({type:'toReveal2', id:pid})">Reveal link two</button>`;
      return;
    }
    if(!mine){ M.innerHTML = `<div class="status">Sit this one out.</div>`; return; }
    if(mine.simpatico){
      M.innerHTML = `<h2>You claimed Simpatico</h2>${puzzle}
        <div class="status">No revising for you. That was the deal.</div>
        ${waitBlock("Waiting on the reveal","")}`;
      return;
    }
    M.innerHTML = `<h2>Change your link two?</h2>${puzzle}
      <div class="status">You guessed <b>${esc(mine.link2||"-")}</b>. You can change it now,
      but only a first-try answer earns the both-links bonus.</div>
      <input type="text" id="s-r2" maxlength="40" value="${esc(mine.link2||"")}" autocomplete="off">
      <button class="btn" onclick="sRevise()">${mine.revised?"Change again":"Change it"}</button>
      ${mine.revised?'<div class="status">Changed.</div>':""}`;
    return;
  }

  if(S.phase === "score" || S.phase === "reveal2"){
    const rv = S.reveal || {}; const rows = rv.rows || [];
    M.innerHTML = `<h2>Round ${S.round}</h2>
      <div class="puzzle"><div class="prow"><span class="plab">Prompt</span><b>${esc(board.prompt||"")}</b></div>
        <div class="prow"><span class="plab">Link one</span><b>${esc(rv.link1||"")}</b></div>
        <div class="prow"><span class="plab">Link two</span><b>${esc(rv.link2||"")}</b></div>
        <div class="prow"><span class="plab">Result</span><b>${esc(board.result||"")}</b></div></div>
      ${rv.antipatico ? `<div class="booked"><div class="lvl">Antipatico!</div>
        <div class="status">Nobody got it, so the Wordsmith scores nothing and everyone else takes a point.</div></div>` : ""}
      <div class="guesslist">${rows.map(r => `<div class="grow ${r.pts?"hit":"miss"}">
        <span><span class="cdot" style="background:${r.color||"#8a93a8"}"></span>${esc(r.name)}
        ${r.note?`<span class="gnote">${esc(r.note)}</span>`:""}</span>
        <span>${esc(r.link1||"-")} / ${esc(r.link2||"-")} <b>+${r.pts}</b></span></div>`).join("")}</div>
      <div class="scorelist">${(S.lastScores||[]).map(s =>
        `<div class="scorerow"><span><span class="cdot" style="background:${s.color||"#8a93a8"}"></span>${esc(s.name)}${s.bot?' <span class="botmark">AI</span>':""}${s.judge?' <span class="tag judge">wordsmith</span>':""}</span>
         <span>${s.delta?`<span class="delta">+${s.delta}</span> `:""}<b>${s.total}</b></span></div>`).join("")}</div>
      ${isSpot ? `<button class="btn" onclick="sendInput({type:'nextRound', id:pid})">Next round</button>`
               : waitBlock("Waiting on the Wordsmith","They start the next round.")}`;
    return;
  }

  if(S.phase === "end"){
    if(!confettiFired){ confettiFired = true; confettiBurst(); }
    const top = S.lastScores.length ? S.lastScores[0].total : 0;
    M.innerHTML = `<div class="center"><div class="winner-label">Most Simpatico</div>
      <div class="winner-big">${esc((S.winners||[]).join(" & "))}</div></div>
      <div class="scorelist">${S.lastScores.map(s =>
        `<div class="scorerow" ${s.total===top?'style="background:rgba(251,191,36,.16);border-radius:8px"':""}>
         <span><span class="cdot" style="background:${s.color||"#8a93a8"}"></span>${esc(s.name)}</span><b>${s.total}</b></div>`).join("")}</div>
      <button class="btn ghost" onclick="location.reload()">Back to the games</button>`;
    return;
  }
}

function sLobbyExtras(S, isHost){
  return `${isHost ? `<button class="btn ghost" onclick="sAddBot()">Add an AI player</button>
      <div class="status">Tap a player to remove them. AI players build chains and guess,
      but they guess badly on purpose and never claim Simpatico.</div>` : ""}
    <div class="status" style="text-align:left; margin-top:16px; line-height:1.5"><b>How Simpatico! works:</b><br>
    First, everyone secretly builds a chain of four words: a starting word, then three
    Transformation cards turning each word into the next.<br><br>
    Then one at a time you're the <b>Wordsmith</b>. You show your first word, your last word and
    the three cards you used. Everyone else guesses the two hidden middles.<br><br>
    <b>1 point</b> per link you get, <b>1 more</b> for getting both first try. Sure about both?
    Claim <b>Simpatico!</b> before the reveal for <b>6</b>, but you can't revise and a miss scores nothing.
    The Wordsmith scores a point per guesser who got something, so make it findable, not impossible.
    If nobody gets it you were <b>Antipatico!</b> and score zero.</div>`;
}

let sSndPrev = null;
function sSoundForState(S){
  const prev = sSndPrev;
  sSndPrev = { phase:S.phase, round:S.round };
  if(!prev) return;
  if(prev.round !== S.round && S.phase === "guess"){ play("turn-start"); return; }
  if(prev.phase === "lobby" && S.phase !== "lobby"){ play("game-start"); return; }
  if(prev.phase !== S.phase){
    if(S.phase === "reveal1") play("card-flip");
    else if(S.phase === "score") play("wow");
    else if(S.phase === "end") play("game-win");
    else if(S.phase === "guess" || S.phase === "revise") play("whoosh", .6);
  }
}

/* ---------- gallery ---------- */
const S_SCREENS = {
  "s-lobby":   "Simpatico, lobby",
  "s-build":   "Build your chain",
  "s-built":   "Chain locked, waiting",
  "s-guess":   "Guess the hidden middles",
  "s-smith":   "Wordsmith waits on guesses",
  "s-reveal1": "Link one revealed",
  "s-revise":  "Second chance at link two",
  "s-score":   "Round scored",
  "s-anti":    "Antipatico, nobody got it",
  "s-end":     "Most Simpatico wins"
};

function sFixture(key){
  const mk = (id,name,color,score) => ({id,name,color,score,online:true});
  const players = [ mk("me","Adam","#3769BE",5), mk("p2","Noah","#e74c3c",3),
                    mk("p3","Jordan","#2e9e5b",7), mk("p4","Brendan","#8e44ad",2) ];
  const cards = ["black:0","blue:1","green:1"];
  const rows = [
    {id:"me", name:"Adam", color:"#3769BE", link1:"Stone", link2:"Emerald", firstLink2:"Emerald",
     simpatico:false, revised:false, ok1:true, ok2:true, firstBoth:true, pts:3, note:"both, first try"},
    {id:"p3", name:"Jordan", color:"#2e9e5b", link1:"Pebble", link2:"Jade", firstLink2:"Jade",
     simpatico:true, revised:false, ok1:false, ok2:false, firstBoth:false, pts:0, note:"Simpatico missed"},
    {id:"p4", name:"Brendan", color:"#8e44ad", link1:"Stone", link2:"Olive", firstLink2:"Grass",
     simpatico:false, revised:true, ok1:true, ok2:false, firstBoth:false, pts:1, note:"on the board"}
  ];
  const S = { gameId:"simpatico", code:"SMPT", players, round:2, spotId:"p2",
    builtIds:["me","p3"], guessIds:["me","p3","p4"],
    board:{ prompt:"Rock", result:"Green", cards:cards },
    reveal:{ link1:"Stone", link2:"Emerald", rows:rows, antipatico:false, wordsmithPts:2 },
    lenMode:"rotations", totalRounds:8, lastRound:false,
    hands:{ me:["black:0","red:3","blue:1","green:1"] },
    lastScores:[
      {name:"Jordan", color:"#2e9e5b", delta:0, total:7},
      {name:"Adam",   color:"#3769BE", delta:3, total:8},
      {name:"Noah",   color:"#e74c3c", delta:2, total:5, judge:true},
      {name:"Brendan",color:"#8e44ad", delta:1, total:3}
    ], phase:"lobby" };

  pid = "me"; myName = "Adam"; isHost = false; sSel = []; sClaim = false;
  const cfg = {
    "s-lobby":   () => { isHost = true; S.phase = "lobby"; },
    "s-build":   () => { S.phase = "build"; S.round = 0; S.spotId = null;
                         S.builtIds = ["p3"]; sSel = ["black:0","blue:1"]; },
    "s-built":   () => { S.phase = "build"; S.round = 0; S.spotId = null; S.builtIds = ["me","p3"]; },
    "s-guess":   () => { S.phase = "guess"; S.guessIds = ["p3"]; },
    "s-smith":   () => { pid = "p2"; myName = "Noah"; S.phase = "guess"; S.guessIds = ["me","p3"]; },
    "s-reveal1": () => { pid = "p2"; myName = "Noah"; S.phase = "reveal1"; },
    "s-revise":  () => { pid = "p4"; myName = "Brendan"; S.phase = "revise"; },
    "s-score":   () => { S.phase = "score"; },
    "s-anti":    () => { S.phase = "score"; S.reveal = JSON.parse(JSON.stringify(S.reveal));
                         S.reveal.antipatico = true;
                         S.reveal.rows.forEach(r => { r.pts = 1; r.note = "Antipatico"; }); },
    "s-end":     () => { S.phase = "end"; S.winners = ["Jordan"]; }
  }[key];
  if(!cfg) return null;
  cfg();
  return S;
}

registerGame({
  id: "simpatico",
  title: "Simpatico!",
  minPlayers: 3,
  maxPlayers: 8,
  blurb: "Secretly turn one word into another, and another, and another, using Transformation cards. Then show only where you started and where you landed, and watch everyone try to work out the steps in between.",
  roles: { spot:"WORDSMITH", other:"GUESSER", verb:"wordsmithing" },
  /* Printed rule: 3 and 4 player games run TWO rotations. */
  defaultRotations: (n) => (n <= 4 ? 2 : 1),

  newState:      sNewState,
  start:         sNextRound,
  handleInput:   sInput,
  force:         sForce,
  cleanup:       sClearBots,
  onPresence:    sMaybeReveal,
  onResume:      sScheduleBots,
  newSeat:       () => ({ wsPoints:0, simps:0 }),
  /* 🔑 THE REDACTION THAT MATTERS: link two is inside G.reveal from the moment
     the reveal is built, and G is broadcast. Publishing it during reveal1 or
     revise would hand every guesser the answer they are about to be asked to
     revise. Stripped until scoring. Hands carry the same broadcast caveat as
     Opening Act. */
  publish: (pub, G) => {
    pub.hands = sHands;
    if(pub.reveal && (G.phase === "reveal1" || G.phase === "revise")){
      pub.reveal = JSON.parse(JSON.stringify(pub.reveal));
      delete pub.reveal.link2;
      pub.reveal.rows.forEach(r => { delete r.firstLink2; });
    }
  },
  phaseWhat: (S) => ({build:"everyone building", guess:"guessing", reveal1:"revealing link one",
                      revise:"second chances", reveal2:"revealing link two", score:"scoring"}[S.phase] || ""),
  renderPhase:   sRenderPhase,
  lobbyExtras:   sLobbyExtras,
  soundForState: sSoundForState,
  screens:       S_SCREENS,
  fixture:       sFixture
});

/* Test hook, same reason as the others. */
function sDebug(){ return { get chains(){return sChains;}, get hands(){return sHands;}, get guesses(){return sGuesses;} }; }
