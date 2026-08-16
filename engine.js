/* XYZ Quarks Mobile - SESSION ENGINE
   Everything here is game-agnostic: rooms, presence, transport, the host session,
   audio playback, the top bar, clocks, the lobby, and how long a game runs.
   Nothing in this file knows what Galaxy Brain is.

   A game lives in games/<id>.js and calls registerGame({...}). See the seam list
   at the bottom of this header for what a game must provide.

   Host-authoritative: the host screen owns all game state, player devices send
   inputs and render whatever the host broadcasts.

   THE SPOTLIGHT. Every game in this app rotates one player through a special seat
   and ends when everyone has held it. Galaxy Brain and Opening Act call that seat
   the Judge; Simpatico calls it the Wordsmith. The engine calls it the SPOTLIGHT
   and stores it in G.spotId, so no game's vocabulary leaks into shared code.

   A game module provides:
     id, title, logo, minPlayers, roles:{spot,other,verb}
     defaultRotations(playerCount) - Simpatico's printed rule is 2 at 3-4 players
     newState(code)        initial host state
     start()               host pressed Start
     handleInput(m)        host: apply one input, return true if handled
     force()               host: unstick the current phase
     onResume()            host: re-arm timers after a refresh
     cleanup()             clear any timers
     phaseWhat(S)          top bar tail text for the current phase
     renderPhase(S,M,me,isSpot)   everything except lobby
     lobbyExtras(S,isHost)        game-specific lobby blocks
     soundForState(S)      fire sounds off a state diff
     screens, fixture()    gallery harness                                      */

/* ---------- game registry ---------- */
const GAMES = {};
let GAME = null;
function registerGame(g){ GAMES[g.id] = g; if(g.sounds) Object.assign(SND, g.sounds); if(!GAME) GAME = g; }
/* Planned but unbuilt. Kept apart from GAMES so nothing can accidentally try to
   host one, and so the launcher can show the real shape of the shelf now. */
const SOON = [];
function registerSoon(g){ if(!GAMES[g.id]) SOON.push(g); }
/* Joiners never pick a game. They inherit whatever the room is running, which
   arrives in broadcast state, so the picker is a host-only concept. */
function useGame(id){
  if(id && GAMES[id] && GAMES[id] !== GAME){
    GAME = GAMES[id];
    setTitle(GAME.title);   // a joiner never called openGame, so the bar would
  }                         // otherwise still read XYZ Quarks all game long
  return GAME;
}

/* ---------- how long a game runs ----------
   Exactly one limit is ever active (Adam, 8/15). Rounds mode counts full
   rotations of the spotlight, so the count is always fair by construction and
   the default comes from the game: Simpatico's printed rule is two rotations at
   3-4 players. Timed mode runs unlimited rotations against a clock, and the
   clock expiring marks the CURRENT round as the last rather than cutting it off
   mid-answer. You cannot set both. */
const LEN_ROTATIONS = [1,2,3];
const LEN_MINUTES  = [5,10,15];
let lobbyLen = { mode:"rotations", value:1 };

function lobbyLenDefault(){
  const n = G ? G.players.filter(p => !p.bot).length : 0;
  lobbyLen = { mode:"rotations", value: (GAME && GAME.defaultRotations) ? GAME.defaultRotations(n) : 1 };
}
/* The picker has to repaint from whatever state this device actually has. In a
   real room that is the host's G, pushed to everyone. In the gallery preview
   there is no G at all, only a fixture, and a picker that silently does nothing
   when you click it is worse than not shipping one. */
function lenChanged(){
  if(isHost && G) pushState();
  else if(lastState) renderPlayer(lastState);
}
function setLenMode(m){ play("select");
  lobbyLen.mode = m;
  lobbyLen.value = m === "rotations"
    ? ((GAME && GAME.defaultRotations) ? GAME.defaultRotations(G ? G.players.filter(p=>!p.bot).length : 0) : 1)
    : 10;
  lenChanged();
}
function setLenValue(v){ play("select"); lobbyLen.value = v; lenChanged(); }

function lengthApply(G){
  G.lenMode = lobbyLen.mode;
  G.lastRound = false;
  if(lobbyLen.mode === "rotations"){
    const eligible = G.players.filter(p => !p.bot).length;
    G.rotations = lobbyLen.value;
    G.totalRounds = Math.max(1, lobbyLen.value * eligible);
    G.timeLimitMs = 0;
  } else {
    G.rotations = 0;
    G.totalRounds = 0;                       // unlimited rotations
    G.timeLimitMs = lobbyLen.value * 60000;
  }
}
function timeUp(G){
  if(G.lenMode !== "timed" || !G.timeLimitMs || !G.gameStartedAt) return false;
  return (Date.now() - G.gameStartedAt - (G.gamePausedMs || 0)) >= G.timeLimitMs;
}
/* Games call this at the top of their round advance. */
function lengthGameOver(G){
  if(G.lenMode === "timed") return !!G.lastRound;
  return G.round > G.totalRounds;
}
/* Host-side tick. The clock crossing has to change STATE, not just the display,
   or only the host would know the game was about to end. */
setInterval(() => {
  if(!isHost || !G || G.paused) return;
  if(G.phase === "lobby" || G.phase === "end") return;
  if(G.lenMode === "timed" && !G.lastRound && timeUp(G)){ G.lastRound = true; pushState(); }
}, 1000);
const SUPA_URL = "https://ingppffghqsajdrgahcm.supabase.co";
const SUPA_KEY = "sb_publishable__41r1k47DJnKmtbmVNqYKQ_yOL98eTd";

const sb = supabase.createClient(SUPA_URL, SUPA_KEY);
let channel = null;
let isHost = false;
let pid = sessionStorage.getItem("qm_pid");
if(!pid){ pid = Math.random().toString(36).slice(2,10); sessionStorage.setItem("qm_pid", pid); }
let myName = "";
let roomCode = "";

/* player colors */
const COLORS = ["#e74c3c","#e67e22","#e8a91c","#2e9e5b","#1abc9c","#3769BE","#8e44ad","#e84393"];
let myColor = COLORS[Math.floor(Math.random() * COLORS.length)];
function renderDots(){
  ["h-dots","j-dots"].forEach(id => {
    const box = el(id); if(!box) return;
    box.innerHTML = COLORS.map(c =>
      `<div class="dot ${c===myColor?"sel":""}" style="background:${c}" onclick="pickColor('${c}')"></div>`).join("");
  });
}
function pickColor(c){ myColor = c; renderDots(); }
document.addEventListener("DOMContentLoaded", renderDots);
document.addEventListener("DOMContentLoaded", renderMute);
document.addEventListener("DOMContentLoaded", () => {
  if(new URLSearchParams(location.search).get("screen")) return;  // gallery preview
  resumeHostSession();
});
function nameSpan(p){ return `<span class="cdot" style="background:${p.color||"#8a93a8"}"></span>${esc(p.name)}${p.bot?' <span class="botmark">AI</span>':""}`; }

/* ---------- host state ---------- */
let G = null; // full game state, host only
let hostAnswers = {}; // per-player private submissions, shape is the game's, never broadcast raw

/* ---------- transport ---------- */
function setConn(ok){
  const el = document.getElementById("conn");
  el.textContent = ok ? "" : "reconnecting";
  el.className = ok ? "conn" : "conn bad";
}

function openChannel(code, onReady){
  /* 🔑 Tear down any channel we already hold before opening another. Without
     this, a second openChannel on the same room throws outright:
       "cannot add presence callbacks for realtime:qm-XXXX after subscribe()"
     and the player is stuck on a dead screen with no way back.
     Real ways to hit it: host a room, then reload and join someone else's;
     or open the app in a second tab on the same device, where localStorage is
     shared so resumeHostSession fires and grabs the room before you join. */
  if(channel){ try{ sb.removeChannel(channel); }catch(e){} channel = null; }
  channel = sb.channel("qm-" + code, {
    config: { broadcast: { self: false }, presence: { key: pid } }
  });
  channel.on("broadcast", { event: "input" }, (msg) => { if(isHost) handleInput(msg.payload); });
  channel.on("broadcast", { event: "state" }, (msg) => { if(!isHost) renderPlayer(msg.payload); });
  channel.on("presence", { event: "sync" }, () => { if(isHost) syncPresence(); });
  channel.subscribe((status) => {
    setConn(status === "SUBSCRIBED");
    if(status === "SUBSCRIBED"){
      channel.track({ name: myName, host: isHost });
      if(onReady){ onReady(); onReady = null; }
      if(!isHost) sendInput({ type: "hello", id: pid, name: myName, color: myColor });
    }
  });
}

function sendInput(payload){
  if(isHost){ handleInput(payload); return; }
  channel.send({ type: "broadcast", event: "input", payload });
}

function pushState(){
  if(!isHost || !G) return;
  // public copy: strip host-private bits
  const pub = JSON.parse(JSON.stringify(G));
  delete pub.draw;
  /* Everything else a phase needs to expose is the game's call. Private host data
     is opt-in: it has to be added here deliberately, so nothing leaks by default. */
  if(GAME.publish) GAME.publish(pub, G, hostAnswers);
  /* No channel means the gallery preview or a push that beat the subscribe. Render
     locally rather than throwing: a state push should never be able to take the
     screen down just because the pipe is not open yet. */
  if(channel) channel.send({ type: "broadcast", event: "state", payload: pub });
  saveHostSession();
  lastState = pub;
  renderSelf(pub);
}

/* ---------- helpers ---------- */
function shuffleSeeded(arr, seed){
  let s = seed * 2654435761 % 4294967296;
  for(let i = arr.length - 1; i > 0; i--){
    s = (s * 1103515245 + 12345) % 4294967296;
    const j = s % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
function roomCodeGen(){
  const A = "ABCDEFGHJKMNPQRSTVWXYZ"; let c = "";
  for(let i=0;i<4;i++) c += A[Math.floor(Math.random()*A.length)];
  return c;
}
function el(id){ return document.getElementById(id); }
function show(id){ el(id).classList.remove("hidden"); }
function hide(id){ el(id).classList.add("hidden"); }
function esc(s){ const d = document.createElement("div"); d.textContent = s; return d.innerHTML; }

/* ---------- audio ----------
   Same engine shape as ArchRavels Digital (js/audio.js): one shared AudioContext,
   SFX decoded to buffers and played through a master GainNode, because iOS
   WKWebView ignores HTMLMediaElement.volume. Files are lifted from the AR set on
   purpose. These are becoming the XYZ house sounds, so they should be the same
   sounds across our games rather than a fresh pack per title. */
const SND = {
  "game-start":"game-start.mp3", "turn-start":"turn-start.mp3", "select":"select.mp3",
  "confirm":"confirm.mp3", "card-flip":"card-flip.mp3", "whoosh":"whoosh.mp3",
  "points":"points.mp3", "climb":"climb.mp3", "wow":"wow.mp3",
  "game-win":"game-win.mp3"
};
/* House sounds are above and mean the same thing in every game, which is the
   point of them. A game adds its own through its sounds map. */
let sndMuted = false;
try{ sndMuted = localStorage.getItem("qm-muted") === "1"; }catch(e){}
let _ctx = null, _gain = null, _buf = {}, _ctxTried = false;
function sndCtx(){
  if(_ctx || _ctxTried) return _ctx;
  _ctxTried = true;
  try{ const AC = window.AudioContext || window.webkitAudioContext; if(AC) _ctx = new AC(); }catch(e){ _ctx = null; }
  return _ctx;
}
function play(key, vol){
  if(sndMuted) return;
  const file = SND[key]; if(!file) return;
  const c = sndCtx(); if(!c) return;
  try{ if(c.state === "suspended") c.resume(); }catch(e){}
  const go = buf => {
    if(!buf || sndMuted) return;
    try{
      const src = c.createBufferSource(); src.buffer = buf;
      if(!_gain){ _gain = c.createGain(); _gain.gain.value = .85; _gain.connect(c.destination); }
      if(vol != null && vol !== 1){ const g = c.createGain(); g.gain.value = vol; src.connect(g); g.connect(_gain); }
      else src.connect(_gain);
      src.start(0);
    }catch(e){}
  };
  if(_buf[file]) return go(_buf[file]);
  fetch("audio/" + file).then(r => r.arrayBuffer())
    .then(ab => c.decodeAudioData(ab, b => { _buf[file] = b; go(b); }, () => {}))
    .catch(() => {});
}
function toggleMute(){
  sndMuted = !sndMuted;
  try{ localStorage.setItem("qm-muted", sndMuted ? "1" : "0"); }catch(e){}
  renderMute();
  if(!sndMuted) play("select");
}
function renderMute(){
  const b = el("tb-mute"); if(b) b.textContent = sndMuted ? "🔇" : "🔊";
}
// browsers will not start audio without a gesture, so wake the context on the first one
document.addEventListener("pointerdown", function wake(){
  const c = sndCtx(); if(c && c.state === "suspended"){ try{ c.resume(); }catch(e){} }
  document.removeEventListener("pointerdown", wake);
}, {once:true});

/* Who a phase is actually still waiting on. Naming them turns "3 of 4 have
   pitched" from a countdown into a room: you can see it is Noah thinking, not a
   clock running out. Adam, 8/16: "it's open until each person has said they are
   ready... both require some thought first." Nothing here has ever had a timer;
   the screens just failed to say so. */
function stillOut(S, doneIds, skipSpot){
  return S.players.filter(p => p.online && !p.bot &&
    (!skipSpot || p.id !== S.spotId) && !(doneIds||[]).includes(p.id)).map(p => p.name);
}
function waitingLine(S, doneIds, skipSpot, verb){
  const out = stillOut(S, doneIds, skipSpot);
  const bots = S.players.filter(p => p.bot && !(doneIds||[]).includes(p.id)).length;
  if(!out.length) return bots ? `Just the AI players ${verb}.` : "Everyone's in.";
  const names = out.length === 1 ? out[0]
    : out.length === 2 ? out[0] + " and " + out[1]
    : out.slice(0,-1).join(", ") + " and " + out.slice(-1);
  return `Still ${verb}: <b>${esc(names)}</b>`;
}

/* Big spinner block for screens whose only job is waiting on other people. */
function waitBlock(msg, sub){
  return `<div class="waiting"><div class="spinner"></div>
    <div class="wmsg">${msg}</div>${sub ? `<div class="wsub">${sub}</div>` : ""}</div>`;
}

function fmt(ms){
  if(ms < 0) ms = 0;
  const t = Math.floor(ms/1000), m = Math.floor(t/60), sec = t%60;
  return m + ":" + String(sec).padStart(2,"0");
}
/* Clocks tick locally off timestamps the host put in state, rather than the host
   pushing a new state every second. Paused time is subtracted, so a long pause
   does not inflate the turn. */
function elapsed(startedAt, pausedMs){
  if(!startedAt) return 0;
  const S = lastState || {};
  const end = S.paused && S.pausedAt ? S.pausedAt : Date.now();
  return end - startedAt - (pausedMs || 0);
}
function renderClock(){
  const S = lastState;
  const box = el("tb-clock"); if(!box) return;
  if(!S || !S.gameStartedAt || S.phase === "lobby"){ box.innerHTML = ""; return; }
  box.innerHTML = fmt(elapsed(S.roundStartedAt, S.roundPausedMs)) +
    "<small>" + fmt(elapsed(S.gameStartedAt, S.gamePausedMs)) + " total</small>";
}
setInterval(renderClock, 1000);

function sendPause(){ play("select"); sendInput({ type:"togglePause", id:pid }); }

/* Top bar turn readout. Kept out of the phase renderers so every screen
   reports the same way and none of them can forget to. */
function renderTopbar(S){
  const pb = el("tb-pause");
  if(pb){
    // only the host can stop the world, and only once a game is running
    pb.classList.toggle("hidden", !(isHost && S && S.phase !== "lobby" && S.phase !== "end"));
    pb.innerHTML = S && S.paused ? "&#9654;" : "&#9208;";
    pb.title = S && S.paused ? "Resume" : "Pause the game";
  }
  let bar = el("paused-bar");
  if(S && S.paused){
    if(!bar){ bar = document.createElement("div"); bar.id = "paused-bar";
      bar.className = "paused-bar"; bar.textContent = "Paused"; document.body.appendChild(bar); }
  } else if(bar){ bar.remove(); }
  renderClock();
  const box = el("tb-turn"); if(!box) return;
  if(!S){ box.innerHTML = ""; return; }
  const spot = player2name(S, S.spotId);
  const mine = S.spotId === pid;
  if(S.phase === "lobby"){
    box.innerHTML = `<b>Lobby</b>${S.players.length} ${S.players.length === 1 ? "player" : "players"}`;
  } else if(S.phase === "end"){
    box.innerHTML = `<b>Game over</b>${S.players.length} played`;
  } else {
    const what = GAME.phaseWhat ? (GAME.phaseWhat(S) || "") : "";
    const verb = GAME.roles.verb;
    const last = S.lastRound ? " &middot; last round" : "";
    /* A game may have a setup phase that runs ONCE before the rotation starts,
       which is how Simpatico works: everyone builds a chain before anyone is the
       Wordsmith. There is no spotlight and no round number yet, and saying
       "Round 0, Someone wordsmithing" is worse than saying nothing. */
    if(!S.spotId){
      box.innerHTML = `<b>Setting up</b>${what || "everyone is getting ready"}`;
    } else {
      box.innerHTML = `<b>Round ${S.round}${last}</b>${mine ? "you are " + verb : esc(spot) + " " + verb}${what ? ", " + what : ""}`;
    }
  }
}

function hostPid(){ return pid; }
function player(id){ return G.players.find(p => p.id === id); }
/* Everyone who is not currently in the spotlight. */
function offSpot(){ return G.players.filter(p => p.id !== G.spotId); }
/* A seat carries the engine's fields plus whatever the game needs on a player. */
function newSeat(id, name, color){
  const p = { id, name, color, score:0, judged:false, online:true };
  if(GAME.newSeat) Object.assign(p, GAME.newSeat());
  return p;
}

/* ---------- host session survival ----------
   The room lives in the host's tab, so a refresh used to end the game for
   everyone in it. The whole host state, including the private answers that are
   deliberately kept out of broadcast, is mirrored to localStorage on every push
   and restored on load. A reload now costs a few seconds instead of the session. */
const HOST_KEY = "qm-host-session";
const HOST_TTL = 6 * 60 * 60 * 1000;   // don't resurrect yesterday's room

function saveHostSession(){
  if(!isHost || !G) return;
  try{
    localStorage.setItem(HOST_KEY, JSON.stringify({
      ts: Date.now(), code: roomCode, name: myName, pid: pid, color: myColor,
      G: G, answers: hostAnswers
    }));
  }catch(e){}
}
function clearHostSession(){ try{ localStorage.removeItem(HOST_KEY); }catch(e){} }

function hostRoomLine(){
  return "Room " + roomCode + " &middot; you are hosting &middot; " +
    '<a href="#" onclick="gameForce();return false" style="color:var(--dim)">force next phase</a>' +
    ' &middot; <a href="#" onclick="endRoom();return false" style="color:var(--dim)">end room</a>';
}
function endRoom(){
  if(!confirm("End this room for everyone?")) return;
  if(GAME.cleanup) GAME.cleanup();
  clearHostSession();
  location.reload();
}

function resumeHostSession(){
  let s = null;
  try{ s = JSON.parse(localStorage.getItem(HOST_KEY) || "null"); }catch(e){}
  if(!s || !s.G){ return false; }
  if(Date.now() - s.ts > HOST_TTL || s.G.phase === "end"){ clearHostSession(); return false; }
  isHost = true;
  G = s.G;
  useGame(s.G.gameId); roomCode = s.code; myName = s.name; myColor = s.color || myColor;
  pid = s.pid; hostAnswers = s.answers || {};
  try{ sessionStorage.setItem("qm_pid", pid); }catch(e){}
  setTitle(GAME.title);
  hide("v-home"); hide("v-game"); show("v-play");
  el("p-name").textContent = myName;
  el("p-room").innerHTML = hostRoomLine();
  openChannel(roomCode, () => {
    pushState();  // everyone re-syncs off this
    // anything that was mid-flight (a rolling reveal, a phase timer) re-arms here
    if(GAME.onResume) GAME.onResume();
  });
  return true;
}

function hostGame(){ play("confirm");
  const nm = el("h-name").value.trim();
  if(!nm){ el("h-name").focus(); return; }
  clearHostSession();          // a new room replaces any old one
  isHost = true;
  myName = nm;
  roomCode = roomCodeGen();
  G = GAME.newState(roomCode);
  G.gameId = GAME.id;
  lobbyLenDefault();
  G.players.push(newSeat(pid, nm, myColor));
  setTitle(GAME.title);
  hide("v-home"); hide("v-game"); show("v-play");
  el("p-name").textContent = nm;
  el("p-room").innerHTML = hostRoomLine();
  openChannel(roomCode, () => pushState());
}

function joinGame(){
  const code = el("j-code").value.trim().toUpperCase();
  const name = el("j-name").value.trim();
  if(code.length !== 4 || !name){ el("j-status").textContent = "Enter a 4 letter code and a name."; return; }
  /* Deliberately joining somebody's room means you are not hosting one, whatever
     a stale localStorage session says. Leaving isHost true here would make this
     device answer inputs for a room it is not running.
     🔑 And mint a FRESH pid. resumeHostSession adopts the saved host's id, so a
     second tab on the same browser silently becomes the host AND takes their
     identity; joining from that tab then arrives at the real host as a "hello"
     from a pid it already has a seat for, and RENAMES the host's own seat. Watched
     it happen: the host's player list showed only the joiner. Different devices
     cannot collide this way, but one device with two tabs can. */
  if(isHost){
    isHost = false; G = null; clearHostSession();
    pid = Math.random().toString(36).slice(2,10);
    try{ sessionStorage.setItem("qm_pid", pid); }catch(e){}
  }
  myName = name; roomCode = code; isHost = false;
  hide("v-home"); hide("v-game"); show("v-play");
  el("p-name").textContent = name;
  el("p-room").textContent = "Room " + code;
  openChannel(code, null);
}

function syncPresence(){
  if(!G) return;
  const present = Object.keys(channel.presenceState());
  let changed = false;
  G.players.forEach(p => {
    if(p.bot) return;                       // bots have no presence to sync
    const on = present.includes(p.id);
    if(p.online !== on){ p.online = on; changed = true; }
  });
  if(changed){ if(GAME.onPresence) GAME.onPresence(); pushState(); }
}

/* ---------- player: render ---------- */
let lastState = null;

function player2name(S, id){ const p = S.players.find(x => x.id === id); return p ? p.name : "Someone"; }


let confettiFired = false;
function confettiBurst(){
  const colors = ["#a855f7","#ec4899","#38bdf8","#fbbf24","#f0abfc","#818cf8"];
  for(let i = 0; i < 90; i++){
    const d = document.createElement("div");
    d.className = "confetti";
    d.style.left = (Math.random() * 100) + "vw";
    d.style.background = colors[i % colors.length];
    d.style.animationDuration = (2.2 + Math.random() * 2.5) + "s";
    d.style.animationDelay = (Math.random() * 0.9) + "s";
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 6000);
  }
}

function renderPlayer(S){
  useGame(S.gameId);
  lastState = S;
  renderSelf(S);
}

function renderSelf(S){
  const me = S.players.find(p => p.id === pid);
  const isSpot = S.spotId === pid;
  renderTopbar(S);
  if(GAME.soundForState) GAME.soundForState(S);
  el("p-score").textContent = me ? (me.score + " pts") : "";
  const role = el("p-role");
  /* No badge in the lobby, and none during a setup phase that runs before the
     rotation starts: with no spotlight yet, calling everyone GUESSER during
     Simpatico's build phase names a role nobody is playing. */
  if(S.phase !== "lobby" && S.spotId && me){
    role.classList.remove("hidden");
    role.textContent = isSpot ? GAME.roles.spot : GAME.roles.other;
    role.className = "tag " + (isSpot ? "judge" : "");
  } else role.classList.add("hidden");
  renderPhase(S, el("p-main"), me, isSpot);
}
/* ---------- launcher ----------
   The grid is built from the registry. A new game shows up here by calling
   registerGame, not by anyone editing this function. */
function initials(t){
  return t.replace(/[^A-Za-z ]/g,"").split(/\s+/).filter(Boolean).slice(0,2)
          .map(w => w[0].toUpperCase()).join("");
}
function appTile(g, soon){
  const art = g.icon || g.logo;
  const face = art ? `<img class="appart" src="${art}" alt="">`
                   : `<div class="appph">${esc(initials(g.title))}</div>`;
  return `<div class="app ${soon?"soon":""}" ${soon?"":`onclick="openGame('${g.id}')"`}>
    ${face}
    <div class="appname">${esc(g.title)}</div>
    <div class="appmeta">${esc(g.meta || ((g.minPlayers||3) + "-" + (g.maxPlayers||8) + " players"))}</div>
    ${soon ? '<div class="soonbadge">Coming soon</div>' : ""}
  </div>`;
}
function renderLauncher(){
  const box = el("v-grid"); if(!box) return;
  box.innerHTML = Object.values(GAMES).map(g => appTile(g, false)).join("")
                + SOON.map(g => appTile(g, true)).join("");
}
function setTitle(t){ const b = el("tb-title"); if(b) b.textContent = t; }

function openGame(id){
  if(!GAMES[id]) return;
  play("select");
  GAME = GAMES[id];
  setTitle(GAME.title);
  const art = el("g-art");
  const nameOnly = el("g-name");
  if(GAME.logo){ art.src = GAME.logo; art.alt = GAME.title; art.style.display = ""; nameOnly.style.display = "none"; }
  else { art.style.display = "none"; nameOnly.style.display = ""; nameOnly.textContent = GAME.title; }
  el("g-sub").textContent = "An XYZ Quarks Mobile game, prototype";
  el("g-about").innerHTML = `<h2>About ${esc(GAME.title)}</h2>
    <div class="sub" style="line-height:1.5">${GAME.blurb || ""}</div>`;
  hide("v-home"); show("v-game");
}
function backToLauncher(){
  play("select");
  setTitle("XYZ Quarks");
  hide("v-game"); show("v-home");
}
document.addEventListener("DOMContentLoaded", renderLauncher);

/* ---------- lobby ----------
   The lobby belongs to the engine because that is where the room code, the seats
   and the length setting live. Each game contributes its own blocks through
   lobbyExtras rather than getting its own lobby. */
function renderLenPicker(S){
  const n = S.players.filter(p => !p.bot).length;
  const rot = lobbyLen.mode === "rotations";
  const chip = (on,label,fn) => `<button class="lenchip ${on?"on":""}" onclick="${fn}">${label}</button>`;
  const rounds = LEN_ROTATIONS.map(v => chip(rot && lobbyLen.value===v,
      v===1 ? "Everyone once" : (v===2 ? "Everyone twice" : "Everyone 3x"), `setLenValue(${v})`)).join("");
  const mins = LEN_MINUTES.map(v => chip(!rot && lobbyLen.value===v, v+" min", `setLenValue(${v})`)).join("");
  const est = rot ? `${lobbyLen.value * n} round${lobbyLen.value*n===1?"":"s"}` : "unlimited rounds";
  return `<div class="lenbox">
    <div class="lvl">Game length</div>
    <div class="lentabs">
      ${chip(rot,"Rounds",`setLenMode('rotations')`)}${chip(!rot,"Timed",`setLenMode('timed')`)}
    </div>
    <div class="lenrow ${rot?"":"off"}">${rounds}</div>
    <div class="lenrow ${rot?"off":""}">${mins}</div>
    <div class="status">${rot
      ? `No time limit. ${est}, and everyone takes the ${esc(GAME.roles.spot.toLowerCase())} seat the same number of times.`
      : `Unlimited rounds. The clock ending marks the round in progress as the last one, so nobody gets cut off mid-answer.`}</div>
  </div>`;
}

function renderPhase(S, M, me, isSpot){
  if(!me){
    M.innerHTML = S.phase === "lobby"
      ? waitBlock("Joining the room", "Hang tight, finding your seat.")
      : `<div class="status">This game already started without you. Wait for the next one!</div>`;
    return;
  }

  if(S.phase === "lobby"){
    const n = S.players.length;
    const min = GAME.minPlayers || 3;
    M.innerHTML = `${isHost ? `<div class="center">
        <div class="sub">Tell everyone to join with this code:</div>
        <div class="code-big">${esc(S.code)}</div></div>
        ${renderLenPicker(S)}
        <button class="btn" ${n<min?"disabled":""} onclick="hostStart()">
          ${n<min ? `Start game (need ${min}+ players, have ${n})` : "Start game with "+n+" players"}</button>`
      : `<div class="center"><h2>You're in!</h2></div>
        ${waitBlock("Waiting for the host", "They kick it off when everyone has landed.")}`}
      <div class="status">Players so far:</div>
      <div class="players" style="justify-content:center">${S.players.map(p =>
        `<span class="pchip ${p.online?"":"gone"}" ${isHost && p.id!==pid ? `onclick="dropSeat('${p.id}')" style="cursor:pointer"` : ""}>${nameSpan(p)}${isHost && p.id!==pid ? " ✕" : ""}</span>`).join("")}</div>
      ${GAME.lobbyExtras ? GAME.lobbyExtras(S, isHost) : ""}`;
    return;
  }

  GAME.renderPhase(S, M, me, isSpot);
}

function hostStart(){
  G.players = G.players.filter(p => p.online || p.bot);   // ghosts don't get seats, bots do
  if(G.players.length < (GAME.minPlayers || 3)){ pushState(); return; }
  lengthApply(G);
  G.gameStartedAt = Date.now(); G.gamePausedMs = 0;
  G.round = 0;
  GAME.start();
  pushState();
}
function gameForce(){ if(isHost && G && GAME.force) GAME.force(); }
function dropSeat(id){ sendInput({ type:"drop", id:pid, target:id }); }

/* ---------- host: engine-level inputs ----------
   Anything every game needs lands here; everything else is the game's. */
function handleInput(m){
  if(!G) return;
  if(m.type === "hello"){
    let p = player(m.id);
    if(p){ p.online = true; p.name = m.name || p.name; if(m.color) p.color = m.color; }
    else {
      // same name as an offline seat reclaims it, so a new window can rejoin a game in progress
      const seat = G.players.find(x => !x.online && x.name.toLowerCase() === (m.name||"").toLowerCase());
      if(seat){ seat.id = m.id; seat.online = true; if(m.color) seat.color = m.color; }
      else if(G.phase === "lobby"){
        G.players.push(newSeat(m.id, m.name, m.color));
      }
    }
    pushState(); return;
  }
  if(m.type === "drop" && G.phase === "lobby" && m.id === pid){
    G.players = G.players.filter(p => p.id !== m.target || p.id === pid);
    pushState(); return;
  }
  if(m.type === "togglePause" && (m.id === G.spotId || m.id === hostPid())){
    if(G.paused){
      const held = Date.now() - (G.pausedAt || Date.now());
      G.gamePausedMs += held; G.roundPausedMs += held;
      G.paused = false; G.pausedAt = 0;
      pushState();
      if(GAME.onResume) GAME.onResume();
    } else {
      G.paused = true; G.pausedAt = Date.now();
      if(GAME.cleanup) GAME.cleanup();
      pushState();
    }
    return;
  }
  if(GAME.handleInput) GAME.handleInput(m);
}

/* reconnect on tab wake */
document.addEventListener("visibilitychange", () => {
  if(!document.hidden && channel && !isHost){
    sendInput({ type:"hello", id:pid, name:myName });
  }
});

/* ---------- screen gallery harness ----------
   Renders one screen from a canned state so any surface can be looked at without
   hosting a room or touching the network. Runs ONLY with ?screen=<key>; a real
   game never reaches this code. Every screen is drawn by the real render
   functions against the real stylesheet, so the gallery cannot drift from the
   build. Screens and their fixture come from the game module. */
function galleryKeys(){
  const out = {};
  Object.values(GAMES).forEach(g => Object.entries(g.screens || {}).forEach(([k,v]) => out[k] = v));
  out["home"] = "Home, before anything starts";
  return out;
}
document.addEventListener("DOMContentLoaded", function previewHarness(){
  const key = new URLSearchParams(location.search).get("screen");
  if(!key) return;
  const owner = Object.values(GAMES).find(g => g.screens && g.screens[key]);
  if(key !== "home" && !owner) return;
  if(owner) GAME = owner;
  if(key === "home") return;   // the page already shows it

  const S = GAME.fixture(key);
  if(!S) return;
  hide("v-home"); show("v-play");
  el("p-name").textContent = myName;
  el("p-room").textContent = "Room " + S.code + "  ·  gallery preview";
  el("conn").style.display = "none";
  renderPlayer(S);
});

/* Test hook. Top-level let/const in a classic script are NOT window properties,
   so a headless harness cannot reach G, GAME or lobbyLen without an accessor.
   Functions are, which is why this is one. Costs nothing at runtime. */
function qmDebug(){
  return {
    get G(){return G;},                set G(v){G=v;},
    get isHost(){return isHost;},      set isHost(v){isHost=v;},
    get pid(){return pid;},            set pid(v){pid=v;},
    get GAME(){return GAME;},
    get lobbyLen(){return lobbyLen;},  set lobbyLen(v){lobbyLen=v;},
    get channel(){return channel;},    set channel(v){channel=v;},
    get hostAnswers(){return hostAnswers;}
  };
}
