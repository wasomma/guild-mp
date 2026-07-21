// QA step 4: mock-canvas render soak.
// Drives shared/sim.js into every visual scenario and calls the real client
// draw() (bundled render.js) against a stubbed 2D context. Any exception
// identifies a broken draw path.

/* ---------- mock canvas / 2D context ---------- */
const gradient = { addColorStop() {} };
function mockCtx() {
  const store = {};
  return new Proxy(store, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === "createLinearGradient" || k === "createRadialGradient") return () => gradient;
      if (k === "measureText") return () => ({ width: 10 });
      if (k === "canvas") return { width: 640, height: 300 };
      return (..._args) => {};
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}
globalThis.document = {
  createElement(tag) {
    if (tag !== "canvas") throw new Error("unexpected createElement: " + tag);
    return { width: 0, height: 0, getContext: () => mockCtx() };
  },
};

/* ---------- imports (after document mock) ---------- */
const render = await import("/tmp/render.bundle.mjs");
const sim = await import("./shared/sim.js");
const { newWorld, joinVoice, tick, applyIntent, endChapter, snapshot, STYLES, GROUND } = sim;

let scenarios = 0, failures = [];
function runDraw(name, g, frames = 30) {
  // Build a view like App.jsx does: snapshot fields + client-local visual state.
  const snap = JSON.parse(JSON.stringify(snapshot(g, [])));
  const v = {
    ...snap,
    time: g.time, shake: 3, connected: true,
    particles: [
      { x: 100, y: 200, vx: 0.5, vy: -0.5, life: 1, size: 2, color: "#fff", grav: 1 },
      { x: 300, y: 180, vx: -0.3, vy: 0.2, life: 0.4, size: 3, color: "#f2c14e" },
    ],
    floaters: [
      { x: 200, y: 150, text: "123", color: "#fff", life: 1.1 },
      { x: 420, y: 140, text: "CRIT!", color: "#ef6461", life: 0.5, big: true, vx: 0.2 },
    ],
  };
  const ctx = mockCtx();
  try {
    for (let i = 0; i < frames; i++) { v.time += 1 / 60; render.draw(ctx, v, 1 / 60); }
    scenarios++;
    console.log("PASS  " + name);
  } catch (e) {
    failures.push({ name, e });
    console.log("FAIL  " + name + "  ->  " + e.stack.split("\n").slice(0, 4).join(" | "));
  }
}

function makeWorld(nMembers = 4) {
  const g = newWorld();
  const classes = ["tank", "dps", "healer", "dps", "tank", "dps"];
  for (let i = 0; i < nMembers; i++) joinVoice(g, "u" + i, "Hero" + i, null);
  g.members.forEach((m, i) => { m.cls = classes[i % classes.length]; });
  return g;
}
function tickUntil(g, pred, maxSec = 300) {
  for (let s = 0; s < maxSec * 20; s++) { tick(g, 0.05); if (pred(g)) return true; }
  return false;
}
function forceStage(g, stage) {
  g.stage = stage; g.best = Math.max(g.best, stage);
  g.enemies = []; g.phase = "advance"; g.advanceT = 0.01;
  tickUntil(g, (w) => w.enemies.length > 0 && w.phase === "combat", 60);
}

/* ---------- 1. plain combat, normal stage ---------- */
{
  const g = makeWorld(4);
  tickUntil(g, (w) => w.phase === "combat" && w.enemies.length, 60);
  runDraw("combat: normal stage", g, 60);
}

/* ---------- 2. elite stage (stage % 5 === 3) ---------- */
{
  const g = makeWorld(4);
  forceStage(g, 8);
  runDraw("combat: elite stage 8", g, 60);
}

/* ---------- 3. the four Kings: windup + special/phase fields ---------- */
const KINGS = [
  { stage: 5,  kind: "slime",    fields: (e) => { e.slamT = 0.4; } },
  { stage: 10, kind: "bat",      fields: (e) => { e.screechT = 0.5; e.frenzy = true; } },
  { stage: 15, kind: "skeleton", fields: (e) => { e.shell = 6; } },
  { stage: 20, kind: "imp",      fields: (e) => { e.enraged = true; } },
];
for (const K of KINGS) {
  const g = makeWorld(4);
  forceStage(g, K.stage);
  const boss = g.enemies.find((e) => e.boss);
  if (!boss) { failures.push({ name: "setup king " + K.kind, e: new Error("no boss spawned at stage " + K.stage) }); continue; }
  if (boss.kind !== K.kind) console.log("note: stage " + K.stage + " boss kind is " + boss.kind + " (expected " + K.kind + ")");
  boss.windup = 0.7; boss.windupMax = 1.6;
  runDraw("boss " + boss.kind + " King mid-windup (stage " + K.stage + ")", g, 40);
  boss.windup = 0; K.fields(boss);
  runDraw("boss " + boss.kind + " King mid-special/phase", g, 40);
}

/* ---------- 4. chapter finale: stage-20 timeline tome + finale pulse ---------- */
{
  const g = makeWorld(3);
  forceStage(g, 20);
  runDraw("stage 20 finale timeline", g, 40);
}

/* ---------- 5. feast, six members incl. wrestle pair, all activities ---------- */
{
  const g = makeWorld(6);
  tickUntil(g, (w) => w.phase === "combat", 30);
  g.stage = 20; g.best = 20;
  endChapter(g);
  if (g.phase !== "feast") failures.push({ name: "feast setup", e: new Error("endChapter did not enter feast; phase=" + g.phase) });
  const acts = new Set(g.members.map((m) => m.feast && m.feast.act));
  console.log("note: feast activities present: " + [...acts].join(", "));
  for (let i = 0; i < 60; i++) tick(g, 0.05); // let feast animate a bit
  runDraw("feast hall with wrestle pair", g, 80);
}

/* ---------- 6. each of the six style ults mid-cast ---------- */
for (const cls of Object.keys(STYLES)) {
  for (const st of STYLES[cls]) {
    const g = makeWorld(3);
    tickUntil(g, (w) => w.phase === "combat" && w.enemies.length, 60);
    const m = g.members[0];
    m.cls = cls; m.style = st.id; m.ult = 1;
    const tgt = g.enemies[0];
    m.ultT = 0.5;
    m.ultTgt = { x: tgt.x, y: tgt.y - 26 };
    m.ultTgts = g.enemies.map((e) => ({ x: e.x, y: e.y - 26 }));
    runDraw("ult mid-cast: " + cls + "/" + st.id, g, 40);
  }
}

/* ---------- 7. unique wearer shimmer ---------- */
{
  const g = makeWorld(3);
  tickUntil(g, (w) => w.phase === "combat", 30);
  const m = g.members[0];
  m.gear = m.gear || {};
  m.gear.weapon = { slot: "weapon", name: "Fangdrinker", unique: true,
    rarity: { id: "unique", name: "Unique", color: "#4ed8c6", mult: 3.4 },
    power: 40, affixes: [{ id: "ls", v: 12 }] };
  runDraw("unique wearer shimmer (weapon)", g, 60);
}

/* ---------- 8. wipe + prestige flash + empty world + disconnected ---------- */
{
  const g = makeWorld(2);
  tickUntil(g, (w) => w.phase === "combat", 30);
  g.phase = "wipe";
  runDraw("wipe overlay", g, 20);
  g.phase = "combat"; g.prestigeT = 1.5;
  runDraw("prestige flash overlay", g, 20);
}
{
  const g = newWorld();
  runDraw("empty world (no members)", g, 20);
}
{
  const g = makeWorld(2);
  const snap = JSON.parse(JSON.stringify(snapshot(g, [])));
  const v = { ...snap, time: 1, shake: 0, connected: false, particles: [], floaters: [] };
  try { render.draw(mockCtx(), v, 1 / 60); scenarios++; console.log("PASS  disconnected overlay"); }
  catch (e) { failures.push({ name: "disconnected overlay", e }); }
}

/* ---------- 9. long mixed soak: real ticks + draw every frame ---------- */
{
  const g = makeWorld(5);
  const snapView = () => {
    const s = JSON.parse(JSON.stringify(snapshot(g, [])));
    return { ...s, time: g.time, shake: Math.random() * 4, connected: true, particles: [], floaters: [] };
  };
  const ctx = mockCtx();
  try {
    for (let i = 0; i < 20 * 60 * 10; i++) { // 10 sim-minutes at 20Hz
      tick(g, 0.05);
      if (i % 2 === 0) render.draw(ctx, snapView(), 0.05);
      if (i === 4000) { g.stage = 20; g.best = 20; endChapter(g); }
      if (i === 8000 && g.members.length > 2) sim.leaveVoice(g, "u4");
      if (i === 9000) joinVoice(g, "u9", "Latecomer", null);
    }
    scenarios++;
    console.log("PASS  10-minute mixed soak (tick + draw every snapshot), final stage " + g.stage + ", phase " + g.phase);
  } catch (e) { failures.push({ name: "mixed soak", e }); console.log("FAIL  mixed soak -> " + e.stack.split("\n").slice(0, 5).join(" | ")); }
}

console.log("\n==== RESULT: " + scenarios + " scenarios passed, " + failures.length + " failed ====");
for (const f of failures) { console.log("\n--- " + f.name + " ---\n" + f.e.stack); }
process.exit(failures.length ? 1 : 0);
