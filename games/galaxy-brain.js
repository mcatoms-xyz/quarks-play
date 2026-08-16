/* GALAXY BRAIN - a game module for the XYZ Quarks Mobile engine.
   Design: Rob Huber, Elanor Huber. Development: Brendan Riley. Rules 1.1.

   Everything Galaxy Brain knows about itself lives here: its prompt deck, its
   scoring, its board, its screens and its seat-filling AI. Rooms, presence,
   transport, audio playback, clocks and game length are the engine's and are
   not repeated here.

   The spotlight seat is called the JUDGE in this game. The engine stores it in
   G.spotId and never uses the word. */
/* Prompt deck, transcribed from the printed Galaxy Brain card file.
   A handful of cards from the physical deck are held out of the
   default digital deck pending a content pass. Judges can always
   write their own prompt. */
const PROMPTS = [
"My Current Hyperfixations","Go-to Pickup Lines","Met Gala Themes","Fursonas",
"Things Best Not Seen:","Weird Animals","Don't Go...","Hip Music...","Best Beverage",
"I'd like to Unknow...","They should Make...","Instant Regrets:","Beloved Movies that Suck:",
"Words to Live by:","Best Pizza Topping","Road Trip Stops:","Shakespeare Probably Said:",
"I shouldn't Have to Tell you...","Check the Weather Before...",
"...was as bad as I guessed it would be.","...is my favorite name of a historical figure",
"Rejected Round Table Knights:","Bad Mascots:","Old people...","Young people...","In 100 years...",
"...woulda been better with Nick Cage.","...woulda been better with Janelle Monae.",
"I'd rather be thirsty than drink...","I'd rather starve than eat...","Is it too late to learn...?",
"...would be a nightmare press secretary","You can never have too much...","I wish I understood...",
"As a child, it was a mystery when...","...should have their own horror franchise","With my luck...",
"...would make a better president.","The best thing about the weekend:","...always has a case of the Mondays",
"...always kills the vibe.","...is worse than you'd think.","I should probably be... instead of playing this.",
"Don't let me die...","Science should spend more time studying...","They shouldn't let kids play with...",
"Don't believe what they tell you about...","...is probably true, but I don't believe it.",
"I'll never pierce my...","...should never have been canceled.","...deserves a Nobel Prize.",
"When... speaks, we should all listen.","Give me your tired, your hungry, your...",
"When I die, build a statue of me...","Land of the free, home of the...","My headstone will read:",
"...is the title of my unauthorized biography.","Technology peaked when they invented...",
"Music peaked when...","It's all downhill from...","I can't wait until... and... work together again.",
"There's a reason they call it the...","...would be a nightmare improv partner.",
"I'm glad someone is... 'cuz I sure can't.","...is best done in private.","We don't talk about...",
"I wish someone would knit me a...","It's the future. Why don't we have...?",
"...would be the name of my monster truck.","...isn't invited to my New Year's Eve party.",
"I'd be surprised to be invited to tea with...","...is actually much nicer than you'd think.",
"I left my heart in...","My... romance.","If we shadows have offended...",
"I bet chipmunks get really mad about...","Every equinox, I...","We have nothing to fear but...",
"Can someone make sure... is okay?","...should probably just call it quits.","My life changed the day I...",
"If... calls, tell them I'm not here.","When they say jump, I say...","...proves that newer isn't always better.",
"...is someone I'd follow into battle.","I stan...","...gets me on the dance floor.",
"...has no business where they are.","...needs her own show.","How is... still a thing?",
"In Europe, everyone...","I always misspell...","I bet Germans love...",
"I bet... doesn't believe they're evil.","I'm building a robot that will:","In Russia...",
"Ask not what your country can do for you, but...","Someday soon, with the push of a button:"
];

const LEVELS3 = ["BIG BRAIN","COSMIC BRAIN","GALAXY BRAIN"];
const LEVELS2 = ["BIG BRAIN","GALAXY BRAIN"];

/* ---------- AI players ----------
   Seat-fillers, nothing more. They exist so a small table still gets the full
   three-slot board and still has more answers than spots, which is where the
   pressure in this game lives. Same idea as Hank in ArchRavels: they never take
   the interesting turn. They NEVER judge, because ranking the jokes IS the game.
   Answers are human-written per prompt, indexed alongside PROMPTS. No model
   call, no backend, no cost, and they are funny because a person wrote them. */
const BOT_ANSWERS = [
  ["medieval siege weapons","the guy who mows the highway median","labeling my spice jars"],
  ["I have a laminator","my mother already likes you","wanna split an appetizer and a mortgage"],
  ["Business Casual Cryptid","Sad Victorian Ghost, but denim","Divorced Wizard"],
  ["a raccoon with a law degree","anxious moth","a possum who lifts"],
  ["the inside of a bounce house","my search history at 2am","how the sausage gets funded"],
  ["the pangolin, obviously","a goose with a plan","whatever a tapir is"],
  ["in there without a flashlight","chasing waterfalls, apparently","to the second location"],
  ["is just a guy whispering over a fax machine","hurts my knees now","was better when I was sad"],
  ["gas station coffee at 4am","the last inch of someone else's milkshake","water, cold, but not too cold"],
  ["how hot dogs are shaped","what my voice sounds like recorded","the smell of a rental hot tub"],
  ["a pen that stays where I left it","smaller bananas","a sitcom about the DMV"],
  ["replying all","the fourth taco","getting bangs"],
  ["every one my dad quotes","the one everybody calls a classic","anything three hours long"],
  ["close the tab","nobody is looking at you","drink water, coward"],
  ["more cheese","the pepperoni that curls into little cups","whatever is left in the fridge"],
  ["a gas station with a taxidermy bear","the world's second largest ball of twine","any bathroom, immediately"],
  ["bitch be cool","this is why we cannot have nice things","I will fix it in rehearsal"],
  ["which fork","that is not a load-bearing wall","to wash your hands, Kevin"],
  ["you commit to the hair","arguing outdoors","you promise anybody a boat"],
  ["the group project","my own podcast","hot yoga"],
  ["Ethelred the Unready","Pepin the Short","Vlad, just Vlad"],
  ["Sir Loin","Sir Cumference","Gary"],
  ["the Fighting Accountants","a visibly sad crab","an unlabeled meat"],
  ["have opinions about bread","were right about the sun","know exactly where the scissors are"],
  ["are correct and I hate it","have never smelled a phone book","are fine, actually"],
  ["someone will still be fixing a printer","the raccoons take it from here","this game will be evidence"],
  ["every nature documentary","the safety video","my performance review"],
  ["the entire 90s","my high school","the Constitution"],
  ["warm backwash","anything labeled tonic","a smoothie with a texture"],
  ["a lukewarm boiled egg","gas station sushi","whatever aspic is"],
  ["to swim","the rules of my own religion","to whistle"],
  ["a parrot with a grudge","my mother","any cat"],
  ["tape","leverage","guac, but you will be charged"],
  ["wine","the stock market, or any market","why my knee does that"],
  ["the toilet ran by itself","the adults got quiet","the dog went to live on a farm"],
  ["HOA boards","group texts","the DMV"],
  ["it will be structural","they will spell it wrong on the trophy","the one photo will be blurry"],
  ["a golden retriever","literally a spreadsheet","my aunt Denise"],
  ["canceling","the nap that ruins the night","not knowing what day it is"],
  ["the printer","my lower back","the guy who says that"],
  ["an itemized receipt","somebody's dad","a group photo"],
  ["owning a boat","a rental hot tub","reading your own old texts"],
  ["asleep","answering that email from March","outside, allegedly"],
  ["in a Cracker Barrel","mid-sentence","owing anybody money"],
  ["why toast lands butter down","the guy who is never cold","naps"],
  ["my good scissors","the volume knob","a laser pointer and a cat"],
  ["the second season","hydration","how long it takes"],
  ["the recommended serving size","eight glasses of water","the printer being out of ink"],
  ["septum, said my septum","dignity","gut feeling"],
  ["the show you are thinking of","my flight","brunch"],
  ["whoever invented the rolling suitcase","the snooze button","whoever names paint colors"],
  ["the smoke detector","a nervous dog","someone who has actually read it"],
  ["emotional support spreadsheet","unread group chats","guy who brought a guitar"],
  ["mid-shrug","sitting down, finally","slightly taller"],
  ["unnecessary parking lot","seventeen dollar sandwich","guy with opinions about tires"],
  ["he meant to","asked about the wifi","no notes"],
  ["Probably Fine","Sent From My iPhone","He Had Plans"],
  ["the office chair that goes up","sliced anything","the mute button"],
  ["the CD skipped and you learned to love it","everyone shared one aux cord","you could hear the words"],
  ["the group chat naming itself","the second round","the moment somebody says logistics"],
  ["my knees","the two guys from that thing","my hands and my brain"],
  ["long weekend","waiting room","family plan"],
  ["a court stenographer","my accountant","anyone who says yes, but"],
  ["parallel parking","raising that child","reading the terms"],
  ["eating a whole rotisserie chicken","crying at a commercial","practicing your accent"],
  ["the trip","my fantasy team","what happened to the good scissors"],
  ["personality","hat that fits my enormous head","small forgiving sweater"],
  ["a fitted sheet that folds itself","good bread at the airport","one charger"],
  ["Lease Payment","Emotional Damage","Gluten Free"],
  ["anyone with a resolution","the guy who counts down early","my landlord"],
  ["the Queen of anything","my former dentist","a raccoon"],
  ["Cleveland","a goose, briefly","the DMV lady"],
  ["the parking structure","a rental car","an unfinished spreadsheet"],
  ["microwave","curbside","clearance aisle"],
  ["bitch be cool","we will be at the bar","take it up with the lighting guy"],
  ["portion sizes","the housing market","leaf blowers"],
  ["reorganize the drawer","buy a plant I will kill","apologize to my houseplants"],
  ["the noise the car makes","an unexpected calendar invite","our own group chat"],
  ["the guy who does the weather","my houseplant","whoever designed this"],
  ["my knees","that one band","daylight saving"],
  ["bought the good pillow","muted the group chat","learned you can just leave"],
  ["my dentist","the group project","the number that keeps calling"],
  ["my knees, though","into what","no"],
  ["the can opener","my old phone","the second album"],
  ["a nurse who has had enough","my grandmother","anyone with a laminated plan"],
  ["the guy who fixes the ice machine","whoever holds the door","a well-organized garage"],
  ["an unattended microphone","the song from that ad","free food adjacency"],
  ["a ladybug indoors","that traffic cone","my expectations"],
  ["the woman who yells at the deli counter","my mother's neighbor","the dog from the park"],
  ["the fax machine","daylight saving","cursive"],
  ["is fine with a smaller drink","walks somewhere for bread","seems to just know"],
  ["restaurant","definitely","my own last name"],
  ["a well-labeled bin","our attempts","punctuality as a personality"],
  ["the parking enforcement guy","whoever writes the terms","a goose"],
  ["fold the fitted sheet","say no for me","find the scissors"],
  ["the winter has opinions","you do not check the weather, it checks you","the soup is correct"],
  ["where the bathroom is","who ate my lunch","whether we can leave early"],
  ["the bread will be good","the meeting becomes an email","my knees"],
];
const BOT_FALLBACK = ["a goose with a plan","my knees","an emotional support spreadsheet","whatever is left in the fridge","the guy who fixes the ice machine","a raccoon with a law degree","reading your own old texts","the printer","one charger","closing the tab"];

const BOT_NAMES = ["Cortex","Synapse","Dendrite","Axon","Ganglion","Cerebellum"];

function botAnswerFor(promptText){
  const i = PROMPTS.indexOf(promptText);
  const pool = (i >= 0 && BOT_ANSWERS[i] && BOT_ANSWERS[i].length)
    ? BOT_ANSWERS[i]      // curated for this prompt
    : BOT_FALLBACK;       // judge wrote their own, so fall back to all-purpose
  // Two bots landing on the same line reads as a bug, not a coincidence, so
  // anything already on the board this round is off the table. If the pool runs
  // dry (more bots than curated answers) fall through to the generic set.
  const used = new Set(Object.values(hostAnswers).map(a => a.text));
  let fresh = pool.filter(t => !used.has(t));
  if(!fresh.length) fresh = BOT_FALLBACK.filter(t => !used.has(t));
  if(!fresh.length) fresh = pool;
  return fresh[Math.floor(Math.random() * fresh.length)];
}

function addBot(){
  if(!isHost || !G || G.phase !== "lobby") return;
  const taken = G.players.map(p => p.name);
  const name = BOT_NAMES.find(n => !taken.includes(n));
  if(!name) return;
  G.players.push({ id: "bot-" + Math.random().toString(36).slice(2,8), name: name,
    color: COLORS[G.players.length % COLORS.length], score: 0,
    galacticUsed: false, judged: false, online: true, bot: true });
  pushState();
}

let botTimers = [];
function clearBotTimers(){ botTimers.forEach(clearTimeout); botTimers = []; }

/* Bots answer on a stagger so the count ticks up like people typing rather than
   every seat landing at once. Round is captured so a timer left over from a
   round that already ended cannot submit into the next one. */
function scheduleBotAnswers(){
  clearBotTimers();
  if(!isHost || !G || G.phase !== "write" || G.paused) return;
  const round = G.round;
  offSpot().filter(p => p.bot && !G.submittedIds.includes(p.id)).forEach(b => {
    botTimers.push(setTimeout(() => {
      if(!isHost || !G || G.phase !== "write" || G.round !== round) return;
      if(G.submittedIds.includes(b.id)) return;
      const galactic = !b.galacticUsed && Math.random() < 0.18;
      handleInput({ type:"answer", id:b.id, text: botAnswerFor(G.prompt),
        pred: galactic ? G.slots : (1 + Math.floor(Math.random() * G.slots)),
        galactic: galactic });
    }, 2500 + Math.random() * 7000));
  });
}

function gbNewState(code){
  return {
    phase: "lobby",       // lobby | prompt | write | place | reveal | score | end
    code: code,
    players: [],          // {id, name, score, galacticUsed, judged, online}
    spotId: null,
    round: 0,
    totalRounds: 0,
    prompt: null,
    slots: 0,
    slotLabels: [],
    placement: [],        // index = slot (0=lowest), value = {ansId, text, name, pred, galactic, pts} once placed
    revealedCount: 0,
    revealSummary: false, // reveal runs card by card, then flips to the whole board
    revealAuto: false,    // judge has started the automatic sequence
    revealPaused: false,
    paused: false,        // global pause, host control, freezes clocks and timers
    pausedAt: 0,
    gameStartedAt: 0, gamePausedMs: 0,
    roundStartedAt: 0, roundPausedMs: 0,
    roundDeltas: null,
    submittedIds: [],
    draw: null,           // two drawn prompts, judge device only acts on them
    lastScores: [],       // [{name, delta, total, note}]
    winners: []
  };
}

/* Sounds are fired by diffing state rather than sprinkled through the renderers,
   so a screen can never forget to make a noise and no sound fires twice. */
let sndPrev = null;
function soundForState(S){
  const prev = sndPrev;
  sndPrev = { phase:S.phase, round:S.round, revealedCount:S.revealedCount,
              revealSummary:!!S.revealSummary };
  if(!prev) return;                       // first paint of a session stays quiet
  if(prev.round !== S.round && S.phase === "prompt"){ play("turn-start"); return; }
  if(prev.phase === "lobby" && S.phase !== "lobby"){ play("game-start"); return; }
  if(S.phase === "reveal" && S.revealedCount > prev.revealedCount){
    const idx = S.revealedCount - 1, top = S.slots - 1;
    const e = S.placement[idx];
    if(idx === top){
      play("wow");
      if(e && e.ansId === pid) setTimeout(() => play("galactic"), 420);
    } else {
      play("card-flip");
      if(idx > 0) setTimeout(() => play("climb", .5), 160);
    }
    return;
  }
  if(!prev.revealSummary && S.revealSummary){ play("whoosh"); return; }
  if(prev.phase !== S.phase){
    if(S.phase === "score") play("points");
    else if(S.phase === "end") play("game-win");
    else if(S.phase === "write" || S.phase === "place") play("whoosh", .6);
  }
}

/* Board stage art. Four escalating panels; bottom is always the faint one,
   the top spot is always full galactic. Middle picks the in-between stage. */
const BRAIN_BY_SLOTS = { 2:[1,4], 3:[1,3,4], 4:[1,2,3,4] };
function brainImg(slotIndex, totalSlots){
  const ladder = BRAIN_BY_SLOTS[totalSlots] || BRAIN_BY_SLOTS[3];
  const n = ladder[Math.min(slotIndex, ladder.length - 1)];
  const cls = slotIndex === totalSlots - 1 ? "b2" : (slotIndex === 0 ? "b0" : "b1");
  return `<img class="bstage ${cls}" src="img/brain-${n}.png" alt="">`;
}

/* ---------- host: inputs ---------- */
function gbInput(m){
  if(m.type === "pickPrompt" && G.phase === "prompt" && m.id === G.spotId){
    G.prompt = m.text.trim().slice(0,120);
    G.draw = null;
    G.phase = "write";
    hostAnswers = {}; G.submittedIds = [];
    pushState(); scheduleBotAnswers(); return;
  }
  if(m.type === "redraw" && G.phase === "prompt" && m.id === G.spotId){
    drawPrompts(); pushState(); return;
  }
  if(m.type === "answer" && G.phase === "write"){
    const p = player(m.id);
    if(!p || m.id === G.spotId || G.submittedIds.includes(m.id)) return;
    if(m.galactic && p.galacticUsed) return;
    /* 🔑 Rules 1.1: "If any player or players chose to Go Galactic, fill in the box
       by their name... each player may only Go Galactic once per game." The mark
       goes down when they CHOOSE it. Burning it at scoring instead only burned the
       ones the judge happened to put on the board, so a thinker whose galactic
       answer got cut could go galactic again, every round, forever. */
    if(m.galactic) p.galacticUsed = true;
    hostAnswers[m.id] = { text: m.text.trim().slice(0,80), pred: m.pred, galactic: !!m.galactic };
    G.submittedIds.push(m.id);
    maybeStartPlacement();
    pushState(); return;
  }
  if(m.type === "place" && G.phase === "place" && m.id === G.spotId){
    // m.assign: array of ansId or null, index = slot
    G.placement = m.assign.map(aid => {
      if(!aid || !hostAnswers[aid]) return null;
      const a = hostAnswers[aid];
      const who = player(aid);
      return { ansId: aid, text: a.text, name: who ? who.name : "?", color: who ? who.color : null, bot: !!(who && who.bot), pred: a.pred, galactic: a.galactic };
    });
    if(G.placement.some(x => x === null)) { G.placement = []; pushState(); return; }
    computeRoundPoints();
    G.phase = "reveal"; G.revealedCount = 0; G.revealSummary = false;
    G.revealAuto = false; G.revealPaused = false;
    pushState(); return;
  }
  if(m.type === "startReveal" && G.phase === "reveal" && m.id === G.spotId){
    // first card lands on the tap so the button feels connected, then it runs itself
    G.revealAuto = true; G.revealPaused = false;
    if(G.revealedCount < G.slots) G.revealedCount++;
    pushState(); scheduleReveal(); return;
  }
  if(m.type === "pauseReveal" && G.phase === "reveal" && m.id === G.spotId){
    G.revealPaused = !G.revealPaused;
    pushState();
    if(!G.revealPaused) scheduleReveal(); else clearRevealTimer();
    return;
  }
  if(m.type === "revealNext" && G.phase === "reveal" && m.id === G.spotId){
    if(G.revealedCount < G.slots){ G.revealedCount++; }
    pushState();
    scheduleReveal();  // manual nudge restarts the clock so you get a full beat after it
    return;
  }
  if(m.type === "toBoard" && G.phase === "reveal" && m.id === G.spotId && G.revealedCount >= G.slots){
    G.revealSummary = true; pushState(); return;
  }
  if(m.type === "showScores" && G.phase === "reveal" && m.id === G.spotId && G.revealedCount >= G.slots){
    scoreRound(); pushState(); return;
  }
  if(m.type === "nextRound" && G.phase === "score" && m.id === G.spotId){
    nextRound(); pushState(); return;
  }
}

/* ---------- host: game flow ---------- */

/* ---------- auto reveal (host only) ----------
   The judge starts it and the host drives it. The timer lives on the host and
   moves state, never on the players, because a timer per device would drift and
   people would be looking at different cards. */
const REVEAL_DELAY = 3000;
let revealTimer = null;

function clearRevealTimer(){
  if(revealTimer){ clearTimeout(revealTimer); revealTimer = null; }
}

function scheduleReveal(){
  clearRevealTimer();
  if(!isHost || !G || G.phase !== "reveal") return;
  if(G.paused || G.revealPaused || G.revealedCount >= G.slots) return;
  const round = G.round;
  revealTimer = setTimeout(() => {
    revealTimer = null;
    // A timer queued before a round ended must never touch the new round's board.
    if(!isHost || !G || G.phase !== "reveal" || G.round !== round) return;
    if(G.revealPaused || G.revealedCount >= G.slots) return;
    G.revealedCount++;
    pushState();
    scheduleReveal();
  }, REVEAL_DELAY);
}

function nextRound(){
  clearRevealTimer(); clearBotTimers();
  G.round++;
  if(lengthGameOver(G)){ endGame(); return; }
  // Offline players and bots never hold the gavel. When everyone eligible has had
  // it that rotation is done, so the flags clear and it goes round again. That is
  // what makes "everyone judges twice" and the unlimited timed mode work.
  let next = G.players.find(p => !p.judged && p.online && !p.bot);
  if(!next){
    G.players.forEach(p => p.judged = false);
    next = G.players.find(p => p.online && !p.bot);
  }
  if(!next){ endGame(); return; }
  G.spotId = next.id;
  next.judged = true;
  const t = offSpot().length;
  G.slots = t >= 4 ? 3 : 2;
  G.slotLabels = G.slots === 3 ? LEVELS3 : LEVELS2;
  G.prompt = null; G.placement = []; G.revealedCount = 0;
  G.submittedIds = []; hostAnswers = {}; G.lastScores = [];
  G.phase = "prompt";
  G.roundStartedAt = Date.now(); G.roundPausedMs = 0;
  drawPrompts();
}

function drawPrompts(){
  const a = PROMPTS[Math.floor(Math.random()*PROMPTS.length)];
  let b = a;
  while(b === a) b = PROMPTS[Math.floor(Math.random()*PROMPTS.length)];
  G.draw = [a, b];
}

function startPlacement(){ G.phase = "place"; G.placement = []; }

/* Everyone who is still connected has answered: go. Ghosts don't hold the round hostage. */
function maybeStartPlacement(){
  if(G.phase !== "write" || G.submittedIds.length === 0) return;
  const waitingOn = offSpot().filter(t => t.online && !G.submittedIds.includes(t.id));
  if(waitingOn.length === 0) startPlacement();
}

/* Points are worked out the moment the board is locked, not at scoring time,
   so each card can show what it earned as it is revealed. Nothing is applied
   to anyone's running total here; that still happens once, in scoreRound. */
function computeRoundPoints(){
  const deltas = {};
  G.players.forEach(p => deltas[p.id] = 0);
  let judgeDelta = 0;
  const topSlot = G.slots - 1;
  G.placement.forEach((entry, slot) => {
    if(!entry) return;
    if(!player(entry.ansId)) return;
    let pts = 1; // made the board
    let note = "made the board";
    const predSlot = entry.galactic ? topSlot : (entry.pred - 1);
    if(predSlot === slot){
      if(entry.galactic && slot === topSlot){ pts = 6; note = "WENT GALACTIC"; }
      else { pts = 3; note = "called the spot"; }
      judgeDelta++;
    } else if(entry.galactic){ note = "galactic miss"; }
    deltas[entry.ansId] = pts;
    entry.pts = pts;
    entry.note = note;
  });
  deltas[G.spotId] = judgeDelta;
  G.judgeHits = judgeDelta;
  G.roundDeltas = deltas;
}

function scoreRound(){
  const deltas = G.roundDeltas || {};
  /* Tiebreak bookkeeping, kept here because it is the one place a round is
     actually applied. Rules 1.1 breaks a tie on, in order: points scored in your
     own round as judge, then having scored six on a Go Galactic, then fewest
     rounds with no score at all. */
  G.placement.forEach(entry => {
    if(entry && entry.galactic && entry.pts === 6){
      const p = player(entry.ansId); if(p) p.galacticSix = true;
    }
  });
  G.lastScores = G.players.map(p => {
    const d = deltas[p.id] || 0;
    p.score += d;
    if(p.id === G.spotId) p.judgePoints = (p.judgePoints || 0) + d;
    if(!d) p.blankRounds = (p.blankRounds || 0) + 1;
    return { name: p.name, color: p.color, delta: d, total: p.score,
      judge: p.id === G.spotId, bot: !!p.bot };
  }).sort((a,b) => b.total - a.total);
  G.roundDeltas = null;
  G.phase = "score";
}

/* Rules 1.1, Tie breakers, in order:
     1. the tied player who scored the most points in their round as judge
     2. the tied player who scored six points when they chose to Go Galactic
     3. the tied player who had the fewest rounds with no score
     4. still tied? tied players SHARE the victory.
   Step 4 is why this returns a list rather than picking a single name: an
   unbreakable tie is a printed outcome, not an edge case to round away. */
function gbTiebreak(a, b){
  return (b.score - a.score)
      || ((b.judgePoints||0) - (a.judgePoints||0))
      || ((b.galacticSix?1:0) - (a.galacticSix?1:0))
      || ((a.blankRounds||0) - (b.blankRounds||0));
}
function endGame(){
  clearRevealTimer(); clearHostSession();
  G.phase = "end";
  const ranked = G.players.slice().sort(gbTiebreak);
  const best = ranked[0];
  G.winners = ranked.filter(p => gbTiebreak(best, p) === 0).map(p => p.name);
  G.lastScores = ranked.map(p => ({ name:p.name, color:p.color, delta:0, total:p.score }));
}

function gbForce(){
  if(!isHost || !G) return;
  clearRevealTimer();
  if(G.phase === "write"){ if(G.submittedIds.length > 0){ startPlacement(); } }
  else if(G.phase === "prompt"){ G.prompt = G.draw ? G.draw[0] : PROMPTS[0]; G.draw = null; G.phase = "write"; hostAnswers = {}; G.submittedIds = []; scheduleBotAnswers(); }
  else if(G.phase === "place"){
    // judge is gone or stuck: auto-fill the board from the submitted answers, in submission order
    const ids = G.submittedIds.slice(0, G.slots);
    if(ids.length){
      while(ids.length < G.slots) ids.push(ids[ids.length-1]); // degenerate tiny case, still unblocks
      G.placement = ids.map(aid => {
        const a = hostAnswers[aid]; const who = player(aid);
        return { ansId: aid, text: a.text, name: who ? who.name : "?", color: who ? who.color : null, pred: a.pred, galactic: a.galactic };
      });
      computeRoundPoints();
      G.revealedCount = G.slots; scoreRound();
    }
  }
  else if(G.phase === "reveal"){
    // reveal can be forced from any point, including before points were worked out
    if(!G.roundDeltas) computeRoundPoints();
    G.revealedCount = G.slots; scoreRound();
  }
  else if(G.phase === "score"){ nextRound(); }
  pushState();
}

let judgeAssign = [];   // local judge placement picks: slot index -> ansId
let judgeSelected = null;
let myPred = null, myGalactic = false, predRound = -1;

/* Show each answer inside its prompt, the way the table would say it out loud. */
function combine(prompt, ans){
  const H = '<span class="hl">' + esc(ans) + '</span>';
  if(!prompt) return H;   // a missing prompt should not take the whole board down
  const i = prompt.indexOf("...");
  if(i >= 0) return '<span class="dimprompt">' + esc(prompt.slice(0, i)) + '</span>' + H +
    '<span class="dimprompt">' + esc(prompt.slice(i + 3)) + '</span>';
  return '<span class="dimprompt">' + esc(prompt) + '</span> ' + H;
}

function gbRenderPhase(S, M, me, isSpot){
  if(S.phase === "prompt"){
    if(isSpot && S.judgeDraw){
      M.innerHTML = `<h2>You're the Judge this round</h2>
        <div class="status" style="text-align:left; line-height:1.5">Pick the prompt everyone will answer.
        After the answers come in, you'll arrange your favorites on the board, and your rankings decide the points.
        Pick whichever prompt sounds like the most fun for this group.</div>
        <div class="pickable" onclick="pickPrompt(0)">${esc(S.judgeDraw[0])}</div>
        <div class="pickable" onclick="pickPrompt(1)">${esc(S.judgeDraw[1])}</div>
        <button class="btn ghost" onclick="sendInput({type:'redraw', id:pid})">Draw two new prompts</button>
        <div class="status">or write your own:</div>
        <input type="text" id="ownprompt" maxlength="120" placeholder="Your prompt...">
        <button class="btn" onclick="pickOwn()">Use my prompt</button>`;
    } else {
      M.innerHTML = `<h2>New round</h2>
        ${waitBlock(esc(player2name(S, S.spotId)) + " is picking the prompt",
                    "When it lands you'll write an answer, then secretly bet where it ends up.")}`;
    }
    return;
  }

  if(S.phase === "write"){
    if(isSpot){
      M.innerHTML = `<div class="prompt-view">${esc(S.prompt)}</div>
        ${waitBlock("Thinkers are writing",
          `${S.submittedIds.length} of ${S.players.length-1} answers in`)}`;
      return;
    }
    if(S.submittedIds.includes(pid)){
      M.innerHTML = `<div class="prompt-view">${esc(S.prompt)}</div>
        ${waitBlock("Locked in",
          `Waiting on the others, ${S.submittedIds.length} of ${S.players.length-1} in`)}`;
      return;
    }
    if(predRound !== S.round){ myPred = null; myGalactic = false; predRound = S.round; }
    const canGalactic = !me.galacticUsed;
    /* Predictions are named for the spots on the board, not numbered, and stacked
       top down so this row reads in the same order as the board itself. */
    let preds = "";
    for(let i = S.slots; i >= 1; i--){
      const label = S.slotLabels[i-1] || ("Spot " + i);
      preds += `<button class="predbtn ${myPred===i&&!myGalactic?"sel":""}" onclick="setPred(${i})">
        ${brainImg(i-1, S.slots)}<span>${esc(label)}</span></button>`;
    }
    const galRow = canGalactic
      ? `<div class="predrow galrow"><button class="predbtn galactic ${myGalactic?"sel":""}"
           onclick="setGalactic()">GO GALACTIC</button></div>` : "";
    M.innerHTML = `<h2>Write your answer</h2>
      <div class="prompt-view">${esc(S.prompt)}</div>
      <div class="status" style="text-align:left; line-height:1.5">Write a word or phrase for this prompt.
      You're aiming for the Judge's sense of humor, not the "right" answer.</div>
      <textarea id="myanswer" maxlength="80" placeholder="Your answer..."></textarea>
      <div class="status" style="text-align:left; line-height:1.5"><b>Now the secret bet:</b> the Judge will rank
      the answers from bottom to TOP (the Galaxy Brain spot). Predict where yours ends up.
      Nail it for 3 points; just making the board is 1.</div>
      <div class="predstack">${preds}</div>
      ${galRow}
      <button class="btn" onclick="submitAnswer()">Lock it in</button>
      ${canGalactic ? '<div class="status">GO GALACTIC is your once-per-game shot: 6 points if the Judge puts you on TOP, but no prediction points otherwise.</div>' : ""}`;
    const saved = sessionStorage.getItem("qm_draft_" + S.round);
    if(saved) el("myanswer").value = saved;
    el("myanswer").addEventListener("input", e => sessionStorage.setItem("qm_draft_" + S.round, e.target.value));
    return;
  }

  if(S.phase === "place"){
    if(!isSpot){
      M.innerHTML = `<div class="prompt-view">${esc(S.prompt)}</div>
        ${waitBlock(esc(player2name(S, S.spotId)) + " is building the board",
                    "Every answer is in. This is the part where you find out.")}`;
      return;
    }
    if(judgeAssign.length !== S.slots) judgeAssign = new Array(S.slots).fill(null);
    const used = judgeAssign.filter(x => x);
    let ansHtml = (S.judgeAnswers||[]).map(a =>
      `<div class="pickable ${judgeSelected===a.ansId?"sel":""} ${used.includes(a.ansId)?"used":""}"
        onclick="judgePick('${a.ansId}')">${esc(a.text)}</div>`).join("");
    let slotHtml = "";
    for(let s = S.slots - 1; s >= 0; s--){
      const aid = judgeAssign[s];
      const a = aid ? (S.judgeAnswers||[]).find(x => x.ansId === aid) : null;
      slotHtml += `<div class="slot compact ${a?"filled":""} ${s===S.slots-1?"top":""}" onclick="judgeSlot(${s})">
        ${brainImg(s, S.slots)}
        <div class="slotbody">
          <div class="lvl">${lastState.slotLabels[s]}</div>
          <div class="ans">${a ? esc(a.text) : "tap to place selected answer"}</div>
        </div></div>`;
    }
    const ready = judgeAssign.every(x => x) ;
    M.innerHTML = `<h2>Build the board, Judge</h2>
      <div class="prompt-view">${esc(S.prompt)}</div>
      <div class="status" style="text-align:left; line-height:1.5">The answers are in (shown below, no names).
      Tap an answer, then tap the spot it deserves. Bottom is good, TOP is Galaxy Brain.
      Maximum hilarity is the ideal. Tap a filled spot to clear it.
      ${S.judgeAnswers.length > S.slots ? "<b>There are more answers than spots, so someone gets left off. Cold, but that's the game.</b>" : ""}</div>
      ${ansHtml}<div style="margin-top:14px">${slotHtml}</div>
      <button class="btn" ${ready?"":"disabled"} onclick="judgeLock()">Lock the board</button>`;
    return;
  }

  if(S.phase === "reveal"){
    const topSlot = S.slots - 1;
    const done = S.revealedCount >= S.slots;
    const summary = done && S.revealSummary;

    /* One card at a time, lowest spot first. The card in focus is the one that was
       just turned over; everything already seen sits underneath it, newest first,
       so each reveal reads as the previous card sliding down to make room. */
    const card = (s, cls) => {
      const e = S.placement[s];
      if(!e) return "";
      const mine = e.ansId === pid;
      return `<div class="slot revealed ${s===topSlot?"top":""} ${mine?"mine":""} ${cls||""}">
        ${s===topSlot && cls==="compact" ? '<div class="lasers"></div>' : ""}
        ${brainImg(s, S.slots)}
        <div class="slotbody">
          <div class="lvl">${S.slotLabels[s]}</div>
          <div class="ans">${combine(S.prompt, e.text)}</div>
          <div class="who"><span class="cdot" style="background:${e.color||"#8a93a8"}"></span>${esc(e.name)}${e.bot ? ' <span class="botmark">AI</span>' : ""}${
            mine ? ' <span class="tag">you</span>' : ""}${
            e.galactic && s===topSlot ? ' <span class="tag judge">went galactic</span>' : ""}
            <span class="ptsbadge">+${e.pts != null ? e.pts : 0}</span></div>
        </div></div>`;
    };

    if(!summary){
      const focusIdx = S.revealedCount - 1;
      let body;
      if(focusIdx < 0){
        body = `<div class="slot pending compact">${brainImg(0, S.slots)}
          <div class="slotbody"><div class="lvl">First up</div>
          <div class="ans">${esc(S.slotLabels[0])}</div></div></div>`;
      } else {
        let stack = "";
        for(let s = focusIdx - 1; s >= 0; s--) stack += card(s, "compact");
        body = card(focusIdx, "focus") +
          (stack ? `<div class="seen">${stack}</div>` : "") +
          (done ? "" : `<div class="slot pending compact">${brainImg(S.revealedCount, S.slots)}
            <div class="slotbody"><div class="lvl">Next up</div>
            <div class="ans">${esc(S.slotLabels[S.revealedCount])}</div></div></div>`);
      }
      M.innerHTML = `<div class="prompt-view">${esc(S.prompt)}</div>
        <div class="status">${isSpot
          ? (done ? "That's the board. Let it land."
             : !S.revealAuto ? "Read each one aloud as it lands. Start when the table is ready."
             : S.revealPaused ? "Paused. Take your time." : "Rolling, a card every few seconds.")
          : (done ? "That's the board!"
             : S.revealPaused ? "The Judge paused the reveal..."
             : "The Judge is revealing, bottom to top...")}</div>
        ${body}
        ${isSpot ? (done
          ? `<button class="btn" onclick="sendInput({type:'toBoard', id:pid})">See the whole board</button>`
          : (!S.revealAuto
            ? `<button class="btn gold" onclick="sendInput({type:'startReveal', id:pid})">Start the reveal</button>`
            : `<button class="btn ${S.revealPaused?"gold":"ghost"}" onclick="sendInput({type:'pauseReveal', id:pid})">${
                 S.revealPaused ? "Resume" : "Pause"}</button>
               <button class="btn ghost" onclick="sendInput({type:'revealNext', id:pid})">Skip ahead</button>`)
          ) : ""}`;
      return;
    }

    let full = "";
    for(let s = topSlot; s >= 0; s--) full += card(s, "compact");
    M.innerHTML = `<h2>The board</h2>
      <div class="prompt-view">${esc(S.prompt)}</div>
      ${full}
      ${isSpot ? `<button class="btn" onclick="sendInput({type:'showScores', id:pid})">To the scoreboard</button>`
                : `<div class="status">The Judge sends the scores when the laughing stops.</div>`}`;
    return;
  }

  if(S.phase === "score"){
    judgeAssign = []; judgeSelected = null;
    let rows = S.lastScores.map(s =>
      `<div class="scorerow"><span><span class="cdot" style="background:${s.color||"#8a93a8"}"></span>${esc(s.name)}${s.bot?' <span class="botmark">AI</span>':""}${s.judge?' <span class="tag judge">judge</span>':""}</span>
       <span>${s.delta?`<span class="delta">+${s.delta}</span> `:""}<b>${s.total}</b></span></div>`).join("");
    M.innerHTML = `<h2>Round ${S.round} scores</h2><div class="scorelist">${rows}</div>
      ${isSpot ? '<button class="btn" onclick="sendInput({type:\'nextRound\', id:pid})">Next round</button>'
        : waitBlock("Waiting on the Judge", "They start the next round.")}`;
    return;
  }

  if(S.phase === "end"){
    if(!confettiFired){ confettiFired = true; confettiBurst(); }
    const topScore = S.lastScores.length ? S.lastScores[0].total : 0;
    let rows = S.lastScores.map(s =>
      `<div class="scorerow" ${s.total===topScore?'style="background:rgba(251,191,36,.16);border-radius:8px"':""}>
        <span>${s.total===topScore?"👑 ":""}<span class="cdot" style="background:${s.color||"#8a93a8"}"></span>${esc(s.name)}</span><b>${s.total}</b></div>`).join("");
    M.innerHTML = `<div class="center">
      <div class="winner-label">The most galactic brain in the galaxy</div>
      <div class="winner-big">🏆 ${esc(S.winners.join(" & "))} 🏆</div>
      <div class="sub">certified enormous. Take a bow.</div></div>
      <div class="scorelist" style="margin-top:14px">${rows}</div>
      <button class="btn gold" onclick="confettiBurst()">More confetti</button>
      <div class="status">Thanks for playing! Refresh to start another game.</div>`;
    return;
  }
}

/* ---------- player: actions ---------- */
function pickPrompt(i){ play("confirm"); sendInput({ type:"pickPrompt", id:pid, text:lastState.judgeDraw[i] }); }
function pickOwn(){
  const t = el("ownprompt").value.trim();
  if(t) sendInput({ type:"pickPrompt", id:pid, text:t });
}
function setPred(i){ play("select"); myPred = i; myGalactic = false; renderPlayer(lastState); }
function setGalactic(){ play("select"); myGalactic = true; myPred = null; renderPlayer(lastState); }
function submitAnswer(){ play("confirm");
  const t = el("myanswer").value.trim();
  if(!t){ return; }
  if(!myGalactic && !myPred){ alert("Set your secret prediction first."); return; }
  sessionStorage.removeItem("qm_draft_" + lastState.round);
  sendInput({ type:"answer", id:pid, text:t, pred:myPred||0, galactic:myGalactic });
}
function judgePick(aid){ play("select");
  if(judgeAssign.includes(aid)) return;
  judgeSelected = aid; renderPlayer(lastState);
}
function judgeSlot(s){ play("select");
  if(judgeSelected){ judgeAssign[s] = judgeSelected; judgeSelected = null; }
  else { judgeAssign[s] = null; }
  renderPlayer(lastState);
}
function judgeLock(){ play("confirm");
  if(!judgeAssign.every(x => x)) return;
  sendInput({ type:"place", id:pid, assign:judgeAssign });
}
function dropSeat(id){ sendInput({ type:"drop", id:pid, target:id }); }
/* ---------- lobby block ---------- */
function gbLobbyExtras(S, isHost){
  return `${isHost ? `<button class="btn ghost" onclick="addBot()">Add an AI player</button>
      <div class="status">Tap a player to remove them. AI players fill seats and
      write answers, but they never judge. Four thinkers unlocks the three spot board.</div>` : ""}
    <div class="status" style="text-align:left; margin-top:16px; line-height:1.5"><b>How Galaxy Brain works:</b><br>
    Each round one player is the Judge. The Judge picks a prompt, everyone else writes an answer for it,
    and the Judge arranges the answers on the board from good... to better... to GALAXY BRAIN.<br><br>
    The twist: before the Judge sees anything, you secretly bet on WHERE your answer will land.
    You score <b>1 point</b> for making the board, <b>3</b> if you called your spot,
    and once per game you can GO GALACTIC for <b>6</b> if you're sure you'll take the top.
    Funniest brain wins.</div>`;
}

/* ---------- gallery fixtures ---------- */
const GB_SCREENS = {
  "lobby-host":    "Lobby, host view",
  "lobby-player":  "Lobby, joined player",
  "prompt-judge":  "Judge picks the prompt",
  "prompt-wait":   "Thinker waits for the prompt",
  "write":         "Thinker writes and predicts",
  "write-judge":   "Judge waits on answers",
  "place-wait":    "Thinker waits on the board",
  "arrange":       "Judge builds the board",
  "reveal-start":  "Reveal, first card up",
  "reveal-low":    "Reveal, rolling on the timer",
  "reveal-paused": "Reveal, judge hit pause",
  "reveal-mid":    "Reveal, middle spot turned",
  "reveal-galaxy": "Reveal, GALAXY BRAIN lands",
  "reveal-mine":   "GALAXY BRAIN lands on you",
  "reveal-summary":"The whole board, with points",
  "score":         "Round scoreboard",
  "end":           "Game over, winner and confetti"
};

function gbFixture(key){
  const mk = (id,name,color,score) => ({id,name,color,score,online:true,galacticUsed:false});
  const players = [ mk("me","Adam","#3769BE",7), mk("p2","Noah","#e74c3c",5),
                    mk("p3","Jordan","#2e9e5b",9), mk("p4","Brendan","#8e44ad",4) ];
  const prompt = "The absolute worst thing to whisper during a moment of silence";
  const answers = [ {ansId:"a1", text:"Sorry about the em-dashes"},
                    {ansId:"a2", text:"I think I left the oven on"},
                    {ansId:"a3", text:"Is this thing still recording"} ];
  const placement = [
    {ansId:"p4", name:"Brendan", color:"#8e44ad", text:"I think I left the oven on",   galactic:false, pts:1},
    {ansId:"p3", name:"Jordan",  color:"#2e9e5b", text:"Is this thing still recording", galactic:false, pts:3},
    {ansId:"me", name:"Adam",    color:"#3769BE", text:"Sorry about the em-dashes",     galactic:true,  pts:6}
  ];
  const S = { gameId:"galaxy-brain", code:"HPCD", players, round:2, spotId:"p2", slots:3, slotLabels:LEVELS3,
    prompt, submittedIds:["me","p3"], judgeAnswers:answers, placement, revealedCount:0, revealSummary:false,
    revealAuto:false, revealPaused:false, lenMode:"rotations", totalRounds:4, lastRound:false,
    judgeDraw:["The absolute worst thing to whisper during a moment of silence",
               "A terrible name for a support group"],
    lastScores:[
      {name:"Adam",   color:"#3769BE", delta:6, total:13},
      {name:"Jordan", color:"#2e9e5b", delta:1, total:10},
      {name:"Noah",   color:"#e74c3c", delta:2, total:7, judge:true},
      {name:"Brendan",color:"#8e44ad", delta:0, total:4}
    ], phase:"lobby" };

  pid = "me"; myName = "Adam"; isHost = false;
  const cfg = {
    "lobby-host":   () => { isHost = true;  S.phase = "lobby"; },
    "lobby-player": () => { S.phase = "lobby"; },
    "prompt-judge": () => { pid = "p2"; myName = "Noah"; S.phase = "prompt"; },
    "prompt-wait":  () => { S.phase = "prompt"; },
    "write":        () => { S.phase = "write"; S.submittedIds = ["p3"]; },
    "write-judge":  () => { pid = "p2"; myName = "Noah"; S.phase = "write"; },
    "place-wait":   () => { S.phase = "place"; },
    "arrange":      () => { pid = "p2"; myName = "Noah"; S.phase = "place";
                            judgeAssign = ["a2","a3","a1"]; },
    "reveal-start": () => { pid = "p2"; myName = "Noah"; S.phase = "reveal"; S.revealedCount = 0; },
    "reveal-low":   () => { pid = "p2"; myName = "Noah"; S.phase = "reveal"; S.revealedCount = 1;
                            S.revealAuto = true; },
    "reveal-paused":() => { pid = "p2"; myName = "Noah"; S.phase = "reveal"; S.revealedCount = 1;
                            S.revealAuto = true; S.revealPaused = true; },
    "reveal-mid":   () => { pid = "p2"; myName = "Noah"; S.phase = "reveal"; S.revealedCount = 2;
                            S.revealAuto = true; },
    "reveal-galaxy":() => { pid = "p2"; myName = "Noah"; S.phase = "reveal"; S.revealedCount = 3; },
    "reveal-mine":  () => { S.phase = "reveal"; S.revealedCount = 3; },
    "reveal-summary":()=> { pid = "p2"; myName = "Noah"; S.phase = "reveal"; S.revealedCount = 3;
                            S.revealSummary = true; },
    "score":        () => { S.phase = "score"; },
    "end":          () => { S.phase = "end"; S.winners = ["Adam"]; }
  }[key];
  if(!cfg) return null;
  cfg();
  return S;
}

registerGame({
  id: "galaxy-brain",
  title: "Galaxy Brain",
  logo: "img/gb-logo.jpg",
  icon: "img/gb-icon.png",
  blurb: "One player judges. Everyone else answers the prompt, then secretly bets on where their answer lands: good, better, or GALAXY BRAIN. Call your spot for more points, or go galactic and risk it all.",
  minPlayers: 3,
  maxPlayers: 8,
  roles: { spot:"JUDGE", other:"THINKER", verb:"judging" },
  defaultRotations: () => 1,

  newState:      gbNewState,
  newSeat:       () => ({ galacticUsed:false, judgePoints:0, blankRounds:0, galacticSix:false }),
  sounds:        { "galactic":"galactic.mp3" },   // the one sound only this game has
  /* Host-private data the spotlight player needs, and only in the phase that
     needs it: the shuffled anonymous answers while the Judge builds the board,
     and the two drawn prompt cards while they are choosing. */
  publish: (pub, G, answers) => {
    if(G.phase === "place"){
      pub.judgeAnswers = Object.entries(answers).map(([id,a]) => ({ ansId:id, text:a.text }));
      shuffleSeeded(pub.judgeAnswers, G.round);
    }
    if(G.phase === "prompt" && G.draw) pub.judgeDraw = G.draw;
  },
  start:         nextRound,
  handleInput:   gbInput,
  force:         gbForce,
  cleanup:       () => { clearRevealTimer(); clearBotTimers(); },
  onPresence:    maybeStartPlacement,
  onResume:      () => {
    scheduleBotAnswers();
    if(G.phase === "reveal" && G.revealAuto && !G.revealPaused) scheduleReveal();
  },
  phaseWhat:     (S) => ({prompt:"picking a prompt", write:"waiting on answers",
                          place:"building the board", reveal:"revealing", score:"scoring"}[S.phase] || ""),
  renderPhase:   gbRenderPhase,
  lobbyExtras:   gbLobbyExtras,
  soundForState: soundForState,
  screens:       GB_SCREENS,
  fixture:       gbFixture
});
