/* OPENING ACT - a game module for the XYZ Quarks Mobile engine.
   The It's When You... band reskin. Design: Rob Huber (Rattlebox, 2018).

   The judge is booking a show and asks for a band. Everyone combines two cards
   from their hand into a band name and pitches the sound out loud. The judge
   books the one they like best. The pitching happens at the table or over the
   call; the app never touches it.

   The spotlight seat is the BOOKER here. The engine stores it in G.spotId.

   ⚖️ CONTENT PROVENANCE: the 96 word cards are transcribed verbatim from the
   printed print-and-play deck (IWY PnP.pdf, pages 1/3/5/7/9/11, 16 per sheet).
   The Kickstarter copy is right that the list contains nothing unsayable, so it
   carries into the booking frame untouched. Two words appear TWICE in the
   printed deck (Rebound, Daylight) and both are kept, because the physical deck
   is the authority and a duplicate is a real card, not a transcription error.
   "Tube State" and "Skido" are odd but are what the cards say.

   🔴 The BOOKING PROMPTS below are NOT from the original game. The printed
   "That's it!" backs carry adult-frame categories (Body Part Below Waist,
   Kitchen Utensil, Type of Car) that do not survive the reskin. These are
   DRAFTS written to unblock the build and are Adam's call to replace. */

/* 96 word cards, verbatim from the printed deck. */
const OA_DECK = [
  "Freeform", "Fish Hook", "Midsummer", "Ostrich", "Ice Pick", "Thunder Clap",
  "Bloody", "Penguin", "Backhand", "Welding Mask", "Corsage", "Istanbul",
  "Shoelace", "Shower Cap", "Bankrupt", "Red Eye", "Rolling Pin", "Bull's Eye",
  "Rebound", "Daylight", "Spotlight", "Flapjack", "Boomerang", "Roadside",
  "Barstool", "Back Alley", "Deep Sea", "Top Shelf", "Chopping Block", "Curling Iron",
  "Bowling Ball", "Major League", "Tool Box", "Panic Button", "Rebound", "Tea Spoon",
  "Firstborn", "Locomotive", "Carnival", "Hubcap", "Texarkana", "Transcontinental",
  "Altoona", "Bow Tie", "Punch Card", "Tax Deductible", "Blow Torch", "Cast Iron",
  "Gently Used", "Flashlight", "Biplane", "Daylight", "Munich", "Rainbow",
  "Werewolf", "Volcano", "Paris", "Hobnob", "Power Plant", "Hand Grenade",
  "Moscow", "Red Hot", "Church Pew", "Nail Clipper", "Billboard", "Blindfold",
  "Piping Hot", "Newspaper", "Recycled", "Vape Pen", "Burlap", "Dial up",
  "Hashtag", "Feather Duster", "Skido", "New Wave", "24 Hour", "Chicago",
  "Rocky Mountain", "Tube State", "Silk Purse", "Fishtank", "Outback", "Fire Sale",
  "Catapult", "Cowbell", "Tramp Stamp", "Equatorial", "Plantain", "Ypsilanti",
  "Rib Tickler", "Stolen", "Fish Stick", "Leprechaun", "Pudding Cup", "Past Due"
];

/* 🔑 THERE IS NO PROMPT. Adam, 8/16: "the prompt is always the same - here are
   words, combine them and tell me what your band would be."
   I had built a whole prompt-picking phase with 16 drafted gig questions. The
   printed game never had one either: the judge SPEAKS a mandatory element and
   the card backs are only inspiration. So the round opens straight into the
   cards, the booker's only job is picking a winner, and the ask lives in the
   room rather than on a screen. One phase and one wait removed. */
const OA_ASK = "Combine two cards. Tell us what your band is.";

const OA_BOT_NAMES = ["Roadie","Soundcheck","Backline","Encore","Setlist","Monitor"];
const HAND_SIZE = 7;

function oaNewState(code){
  return {
    phase: "lobby",       // lobby | pick | choose | score | end
    code: code,
    players: [],
    spotId: null,
    round: 0, totalRounds: 0,
    submittedIds: [],
    picks: [],            // [{ansId, name, cards}] anonymised for the booker
    winnerId: null,
    paused:false, pausedAt:0,
    gameStartedAt:0, gamePausedMs:0, roundStartedAt:0, roundPausedMs:0,
    lastScores: [],
    winners: []
  };
}

/* ---------- deck and hands (host only) ---------- */
let oaDeck = [], oaDiscard = [], oaHands = {};

function oaShuffleDeck(){
  oaDeck = OA_DECK.slice();
  for(let i = oaDeck.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [oaDeck[i], oaDeck[j]] = [oaDeck[j], oaDeck[i]];
  }
  oaDiscard = [];
}
/* 96 cards against 8 players holding 7 is comfortable, but a long timed game
   will still run the deck out, so the discard reshuffles rather than dead-ends. */
function oaDrawCard(){
  if(!oaDeck.length){
    if(!oaDiscard.length) return OA_DECK[Math.floor(Math.random()*OA_DECK.length)];
    oaDeck = oaDiscard; oaDiscard = [];
    for(let i = oaDeck.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [oaDeck[i], oaDeck[j]] = [oaDeck[j], oaDeck[i]];
    }
  }
  return oaDeck.pop();
}
function oaTopUp(){
  G.players.forEach(p => {
    if(!oaHands[p.id]) oaHands[p.id] = [];
    while(oaHands[p.id].length < HAND_SIZE) oaHands[p.id].push(oaDrawCard());
  });
}

function oaNextRound(){
  oaClearBots();
  /* Round 1 builds the draw pile. Without this the deck stayed EMPTY and every
     hand was filled by oaDrawCard's last-resort random pick, which draws WITH
     replacement: players could hold the same card twice and two people could
     hold the same card. check-flow.js caught it by counting the pile. */
  if(!G.round) oaShuffleDeck();
  G.round++;
  if(lengthGameOver(G)){ oaEndGame(); return; }
  let next = G.players.find(p => !p.judged && p.online && !p.bot);
  if(!next){
    G.players.forEach(p => p.judged = false);
    next = G.players.find(p => p.online && !p.bot);
  }
  if(!next){ oaEndGame(); return; }
  G.spotId = next.id;
  next.judged = true;
  G.picks = []; G.submittedIds = []; G.winnerId = null; G.lastScores = [];
  G.phase = "pick";
  G.roundStartedAt = Date.now(); G.roundPausedMs = 0;
  oaTopUp();
  oaScheduleBots();
}

function oaScoreRound(){
  const win = G.picks.find(p => p.ansId === G.winnerId);
  G.lastScores = G.players.map(p => {
    const d = (win && p.id === win.ansId) ? 1 : 0;
    p.score += d;
    return { name:p.name, color:p.color, delta:d, total:p.score,
             judge: p.id === G.spotId, bot: !!p.bot };
  }).sort((a,b) => b.total - a.total);
  G.phase = "score";
}

function oaEndGame(){
  oaClearBots(); clearHostSession();
  G.phase = "end";
  const top = Math.max(...G.players.map(p => p.score));
  G.winners = G.players.filter(p => p.score === top).map(p => p.name);
  G.lastScores = G.players.map(p => ({name:p.name, color:p.color, delta:0, total:p.score}))
    .sort((a,b) => b.total - a.total);
}

/* Everyone still connected has pitched: go. */
function oaMaybeChoose(){
  if(G.phase !== "pick" || G.submittedIds.length === 0) return;
  const waiting = offSpot().filter(t => t.online && !G.submittedIds.includes(t.id));
  if(waiting.length) return;
  G.picks = G.submittedIds.map(id => {
    const s = oaSubs[id]; const who = player(id);
    return { ansId:id, name:s.name, cards:s.cards,
             who: who ? who.name : "?", color: who ? who.color : null, bot: !!(who && who.bot) };
  });
  shuffleSeeded(G.picks, G.round);
  G.phase = "choose";
}

let oaSubs = {};   // pid -> {cards:[a,b], name} held back until everyone is in

/* ---------- AI players ----------
   Seat-fillers. They pick two cards from their hand and never book, because
   choosing the funniest band IS the game. */
let oaBotTimers = [];
function oaClearBots(){ oaBotTimers.forEach(clearTimeout); oaBotTimers = []; }
function oaAddBot(){
  if(!isHost || !G || G.phase !== "lobby") return;
  const taken = G.players.map(p => p.name);
  const name = OA_BOT_NAMES.find(n => !taken.includes(n));
  if(!name) return;
  G.players.push({ id:"bot-"+Math.random().toString(36).slice(2,8), name:name,
    color:COLORS[G.players.length % COLORS.length], score:0, judged:false, online:true, bot:true });
  pushState();
}
function oaScheduleBots(){
  oaClearBots();
  if(!isHost || !G || G.phase !== "pick" || G.paused) return;
  const round = G.round;
  offSpot().filter(p => p.bot && !G.submittedIds.includes(p.id)).forEach(b => {
    oaBotTimers.push(setTimeout(() => {
      if(!isHost || !G || G.phase !== "pick" || G.round !== round) return;
      if(G.submittedIds.includes(b.id)) return;
      const hand = oaHands[b.id] || [];
      if(hand.length < 2) return;
      const i = Math.floor(Math.random()*hand.length);
      let j = i; while(j === i) j = Math.floor(Math.random()*hand.length);
      oaInput({ type:"submitBand", id:b.id, cards:[hand[i], hand[j]] });
    /* Adam, 8/16: "we need more time to select the cards." The AI players were
       landing in 2.5 to 9.5 seconds, so the "3 of 4 have pitched" counter filled
       almost immediately and made a phase with no timer FEEL like it had one.
       Nothing was ever cutting anyone off; the pressure was entirely the bots
       being inhumanly fast. They now take their time. */
    }, 7000 + Math.random()*12000));
  });
}

/* ---------- host: inputs ---------- */
function oaInput(m){
  if(m.type === "submitBand" && G.phase === "pick"){
    const p = player(m.id);
    if(!p || m.id === G.spotId || G.submittedIds.includes(m.id)) return;
    const hand = oaHands[m.id] || [];
    const cards = (m.cards||[]).filter(c => hand.includes(c));
    if(cards.length !== 2 || cards[0] === cards[1]) return;
    oaSubs[m.id] = { cards:cards, name: cards.join(" ") };
    G.submittedIds.push(m.id);
    /* Reset, from the rules: "discard any played cards and may ALSO discard any
       number of cards from their hand that they would like. All players draw
       back up to 7." The optional dump was missing entirely, which quietly
       removed the game's only hand-management decision. */
    const dump = (m.dump||[]).filter(c => hand.includes(c) && !cards.includes(c));
    const gone = cards.concat(dump);
    oaHands[m.id] = hand.filter(c => !gone.includes(c));
    oaDiscard.push(...gone);
    while(oaHands[m.id].length < HAND_SIZE) oaHands[m.id].push(oaDrawCard());
    oaMaybeChoose();
    pushState(); return;
  }
  if(m.type === "dumpOnly" && G.phase === "pick" && m.id === G.spotId){
    const hand = oaHands[m.id] || [];
    const dump = (m.dump||[]).filter(c => hand.includes(c));
    if(!dump.length) return;
    oaHands[m.id] = hand.filter(c => !dump.includes(c));
    oaDiscard.push(...dump);
    while(oaHands[m.id].length < HAND_SIZE) oaHands[m.id].push(oaDrawCard());
    pushState(); return;
  }
  if(m.type === "book" && G.phase === "choose" && m.id === G.spotId){
    if(!G.picks.some(p => p.ansId === m.target)) return;
    G.winnerId = m.target;
    oaScoreRound();
    pushState(); return;
  }
  if(m.type === "nextRound" && G.phase === "score" && m.id === G.spotId){
    oaNextRound(); pushState(); return;
  }
}

function oaForce(){
  if(!isHost || !G) return;
  oaClearBots();
  if(G.phase === "pick"){
    if(G.submittedIds.length){
      G.picks = G.submittedIds.map(id => {
        const s = oaSubs[id]; const who = player(id);
        return { ansId:id, name:s.name, cards:s.cards, who: who?who.name:"?", color: who?who.color:null, bot: !!(who&&who.bot) };
      });
      shuffleSeeded(G.picks, G.round);
      G.phase = "choose";
    }
  }
  else if(G.phase === "choose"){
    // booker is gone or stuck: the first band on the board gets the gig
    if(G.picks.length){ G.winnerId = G.picks[0].ansId; oaScoreRound(); }
  }
  else if(G.phase === "score"){ oaNextRound(); }
  pushState();
}

/* ---------- player: local render state ---------- */
let oaSelected = [];   // cards this device has tapped, max 2
let oaDump = [];       // cards this device wants rid of at the reset
function oaTapDump(card){
  if(oaDump.includes(card)) oaDump = oaDump.filter(c => c !== card);
  else oaDump = oaDump.concat([card]);
  oaSelected = oaSelected.filter(c => c !== card);   // cannot both play it and bin it
  play("select");
  renderPlayer(lastState);
}

function oaTapCard(card){
  oaDump = oaDump.filter(c => c !== card);           // playing it un-bins it
  if(oaSelected.includes(card)) oaSelected = oaSelected.filter(c => c !== card);
  else if(oaSelected.length < 2) oaSelected = oaSelected.concat([card]);
  else oaSelected = [oaSelected[1], card];   // a third tap replaces the oldest
  play("select");
  renderPlayer(lastState);
}
function oaSubmit(){
  if(oaSelected.length !== 2) return;
  play("confirm");
  sendInput({ type:"submitBand", id:pid, cards:oaSelected.slice(), dump:oaDump.slice() });
  oaSelected = []; oaDump = [];
}
function oaBook(id){ play("confirm"); sendInput({ type:"book", id:pid, target:id }); }

/* ---------- player: phase renders ---------- */
function oaRenderPhase(S, M, me, isSpot){
  const booker = player2name(S, S.spotId);
  const myHand = (S.hands && S.hands[pid]) || [];

  if(S.phase === "pick"){
    if(isSpot){
      const n = S.submittedIds.length, t = S.players.filter(p => p.id !== S.spotId && p.online).length;
      M.innerHTML = `<h2>You're booking</h2>
        <div class="status">Everyone else is naming a band. Then they pitch, and you give the gig to your favourite.</div>
        ${waitBlock("No rush, it waits for everyone", waitingLine(S, S.submittedIds, true, "choosing"))}
        <div class="status">You can swap cards out while you wait. Tap any you'd rather be rid of.</div>
        <div class="hand">${myHand.map(c => { const q = esc(c).replace(/'/g,"\\'");
          return `<div class="wcard ${oaDump.includes(c)?"dump":""}" onclick="oaTapDump('${q}')">${esc(c)}</div>`; }).join("")}</div>
        <button class="btn ghost" ${oaDump.length?"":"disabled"}
          onclick="sendInput({type:'dumpOnly', id:pid, dump:oaDump.slice()}); oaDump=[];">
          ${oaDump.length ? "Dump "+oaDump.length : "Nothing selected"}</button>`;
      return;
    }
    const done = S.submittedIds.includes(pid);
    if(done){
      M.innerHTML = `<div class="askline">${esc(booker)} is booking</div>
        ${waitBlock("You're in", waitingLine(S, S.submittedIds, true, "choosing"))}`;
      return;
    }
    M.innerHTML = `<div class="askline">${esc(booker)} is booking</div>
      <div class="prompt-view">${esc(OA_ASK)}</div>
      <div class="status">Pick <b>two</b> cards. That's your band. Then pitch the sound out loud.<br>
      <b>Take your time.</b> Nothing happens until everyone has locked one in.</div>
      <div class="hand">${myHand.map(c => { const q = esc(c).replace(/'/g,"\\'");
        return `<div class="wcard ${oaSelected.includes(c)?"sel":""} ${oaDump.includes(c)?"dump":""}"
          onclick="oaTapCard('${q}')">${esc(c)}
          <span class="dumpx" title="Dump this card at the end of the round"
            onclick="event.stopPropagation();oaTapDump('${q}')">${oaDump.includes(c)?"↺":"✕"}</span></div>`; }).join("")}</div>
      <div class="bandname">${oaSelected.length ? esc(oaSelected.join(" ")) : "Your band name shows up here"}</div>
      <div class="status">Tap ✕ on anything you'd rather be rid of. Dumped cards are replaced
      at the end of the round.${oaDump.length ? ` <b>${oaDump.length} to dump.</b>` : ""}</div>
      <button class="btn" ${oaSelected.length===2?"":"disabled"} onclick="oaSubmit()">
        ${oaSelected.length===2 ? "Book us" : "Pick two cards"}</button>`;
    return;
  }

  if(S.phase === "choose"){
    if(!isSpot){
      M.innerHTML = `<div class="askline">${esc(booker)} is booking</div>
        <div class="status">Every band is on the table. Pitch yours out loud when it's your turn.</div>
        <div class="bandlist">${S.picks.map(p =>
          `<div class="band ${p.ansId===pid?"mine":""}">${esc(p.name)}${p.ansId===pid?' <span class="tag">yours</span>':""}</div>`).join("")}</div>
        ${waitBlock(esc(booker) + " is deciding", "They book the one they like best.")}`;
      return;
    }
    M.innerHTML = `<h2>Book one</h2>
      <div class="status">Let everyone pitch, then give the gig to the one you want. Tap it.</div>
      <div class="bandlist">${S.picks.map(p =>
        `<div class="band pickable" onclick="oaBook('${p.ansId}')">${esc(p.name)}</div>`).join("")}</div>`;
    return;
  }

  if(S.phase === "score"){
    const win = S.picks.find(p => p.ansId === S.winnerId);
    M.innerHTML = `<h2>Round ${S.round}</h2>
      ${win ? `<div class="booked"><div class="lvl">You're booked!</div>
        <div class="winner-big">${esc(win.name)}</div>
        <div class="who"><span class="cdot" style="background:${win.color||"#8a93a8"}"></span>${esc(win.who)}${win.bot?' <span class="botmark">AI</span>':""}</div></div>` : ""}
      <div class="scorelist">${S.lastScores.map(s =>
        `<div class="scorerow"><span><span class="cdot" style="background:${s.color||"#8a93a8"}"></span>${esc(s.name)}${s.bot?' <span class="botmark">AI</span>':""}${s.judge?' <span class="tag judge">booker</span>':""}</span>
         <span>${s.delta?`<span class="delta">+${s.delta}</span> `:""}<b>${s.total}</b></span></div>`).join("")}</div>
      ${isSpot ? `<button class="btn" onclick="sendInput({type:'nextRound', id:pid})">Next round</button>`
               : waitBlock("Waiting on the booker", "They start the next round.")}`;
    return;
  }

  if(S.phase === "end"){
    if(!confettiFired){ confettiFired = true; confettiBurst(); }
    const topScore = S.lastScores.length ? S.lastScores[0].total : 0;
    M.innerHTML = `<div class="center"><div class="winner-label">Headliner</div>
      <div class="winner-big">${esc((S.winners||[]).join(" & "))}</div></div>
      <div class="scorelist">${S.lastScores.map(s =>
        `<div class="scorerow" ${s.total===topScore?'style="background:rgba(251,191,36,.16);border-radius:8px"':""}>
         <span><span class="cdot" style="background:${s.color||"#8a93a8"}"></span>${esc(s.name)}</span><b>${s.total}</b></div>`).join("")}</div>
      <button class="btn ghost" onclick="location.reload()">Back to the games</button>`;
    return;
  }
}

function oaLobbyExtras(S, isHost){
  return `${isHost ? `<button class="btn ghost" onclick="oaAddBot()">Add an AI player</button>
      <div class="status">Tap a player to remove them. AI players fill seats and name bands,
      but they never book, because picking the funniest band is the game.</div>` : ""}
    <div class="status" style="text-align:left; margin-top:16px; line-height:1.5"><b>How Opening Act works:</b><br>
    Everyone gets seven word cards. Each round you combine <b>two</b> of them into a band name,
    then pitch the sound out loud, in as much or as little detail as you like.<br><br>
    One player each round is the <b>Booker</b>. They don't name a band, they just listen and
    give the gig to their favourite.<br><br>
    The Booker gives the gig to their favourite. That's <b>1 point</b>.
    Most gigs at the end headlines the festival.</div>`;
}

/* Sounds fire off a state diff, same as Galaxy Brain, so no renderer can forget. */
let oaSndPrev = null;
function oaSoundForState(S){
  const prev = oaSndPrev;
  oaSndPrev = { phase:S.phase, round:S.round };
  if(!prev) return;
  if(prev.round !== S.round && S.phase === "pick"){ play("turn-start"); return; }
  if(prev.phase === "lobby" && S.phase !== "lobby"){ play("game-start"); return; }
  if(prev.phase !== S.phase){
    if(S.phase === "score") play("wow");
    else if(S.phase === "end") play("game-win");
    else if(S.phase === "pick" || S.phase === "choose") play("whoosh", .6);
  }
}

/* ---------- gallery ---------- */
const OA_SCREENS = {
  "oa-lobby":   "Opening Act, lobby",
  "oa-booker":  "Booker waits on the bands",
  "oa-pick":    "Pick two cards, name the band",
  "oa-picked":  "Pitched, waiting on the rest",
  "oa-choose":  "Booker picks the band",
  "oa-score":   "You're booked",
  "oa-end":     "Festival headliner"
};

function oaFixture(key){
  const mk = (id,name,color,score) => ({id,name,color,score,online:true});
  const players = [ mk("me","Adam","#3769BE",2), mk("p2","Noah","#e74c3c",1),
                    mk("p3","Jordan","#2e9e5b",3), mk("p4","Brendan","#8e44ad",0) ];
  const picks = [
    {ansId:"me", name:"Welding Mask Corsage", cards:["Welding Mask","Corsage"], who:"Adam",   color:"#3769BE"},
    {ansId:"p3", name:"Pudding Cup Boomerang", cards:["Pudding Cup","Boomerang"], who:"Jordan", color:"#2e9e5b"},
    {ansId:"p4", name:"Ypsilanti Red Eye",     cards:["Ypsilanti","Red Eye"],     who:"Brendan",color:"#8e44ad"}
  ];
  const S = { gameId:"opening-act", code:"WXYZ", players, round:2, spotId:"p2",
    submittedIds:["me","p3"], picks, winnerId:"me",
    lenMode:"rotations", totalRounds:4, lastRound:false,
    hands:{ me:["Freeform","Fish Hook","Midsummer","Ostrich","Ice Pick","Thunder Clap","Bloody"] },
    judgeDraw:["What's the band that only plays county fairs?",
               "What's the band the barista will not stop talking about?"],
    lastScores:[
      {name:"Jordan", color:"#2e9e5b", delta:0, total:3},
      {name:"Adam",   color:"#3769BE", delta:1, total:3},
      {name:"Noah",   color:"#e74c3c", delta:0, total:1, judge:true},
      {name:"Brendan",color:"#8e44ad", delta:0, total:0}
    ], phase:"lobby" };

  pid = "me"; myName = "Adam"; isHost = false; oaSelected = [];
  const cfg = {
    "oa-lobby":  () => { isHost = true; S.phase = "lobby"; },
    "oa-booker": () => { pid = "p2"; myName = "Noah"; S.phase = "pick"; S.submittedIds = ["p3"]; },
    "oa-pick":   () => { S.phase = "pick"; S.submittedIds = ["p3"]; oaSelected = ["Ostrich","Bloody"]; },
    "oa-picked": () => { S.phase = "pick"; S.submittedIds = ["me","p3"]; },
    "oa-choose": () => { pid = "p2"; myName = "Noah"; S.phase = "choose"; },
    "oa-score":  () => { S.phase = "score"; },
    "oa-end":    () => { S.phase = "end"; S.winners = ["Jordan","Adam"]; }
  }[key];
  if(!cfg) return null;
  cfg();
  return S;
}

registerGame({
  id: "opening-act",
  title: "Opening Act",
  /* No art yet. Deliberately no logo/icon: the launcher draws an honest
     initials placeholder rather than borrowing or inventing a mark. */
  minPlayers: 3,
  maxPlayers: 8,
  blurb: "The booker wants a band. Combine two cards from your hand into a band name, pitch the sound out loud, and try to get the gig. Most gigs headlines the festival.",
  roles: { spot:"BOOKER", other:"BAND", verb:"booking" },
  defaultRotations: () => 1,

  newState:      oaNewState,
  start:         oaNextRound,
  handleInput:   oaInput,
  force:         oaForce,
  cleanup:       oaClearBots,
  onPresence:    oaMaybeChoose,
  onResume:      oaScheduleBots,
  /* ⚠️ HANDS ARE BROADCAST. One state goes to every device, so every hand is in
     it and each client renders only its own. Same leak class the Galaxy Brain
     board already has, and it needs the same host-side redaction. Fine for a
     private room of five; not fine for anything wider. Carried in FIXLIST. */
  publish: (pub) => { pub.hands = oaHands; },
  phaseWhat:     (S) => ({pick:"waiting on bands", choose:"picking a band",
                          score:"scoring"}[S.phase] || ""),
  renderPhase:   oaRenderPhase,
  lobbyExtras:   oaLobbyExtras,
  soundForState: oaSoundForState,
  screens:       OA_SCREENS,
  fixture:       oaFixture
});

/* Test hook, same reason as engine.js qmDebug: top-level let bindings in a
   classic script are not window properties, so check-flow.js cannot see the
   dealt hands without an accessor. */
function oaDebug(){ return { get hands(){return oaHands;}, get deck(){return oaDeck;}, get subs(){return oaSubs;} }; }
