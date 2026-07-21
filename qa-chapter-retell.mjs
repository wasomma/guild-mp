// QA: automatic chapter end at the stage-20 finale + personal "retell" prestige.
// Headless: drives shared/sim.js directly and asserts on world state.

import { newWorld, joinVoice, tick, applyIntent, snapshot, dehydrateMember, rehydrateMember, renownEarn } from "./shared/sim.js";

let checks = 0, failures = [];
function assert(cond, name) {
  if (cond) { checks++; }
  else { failures.push(name); console.log("FAIL  " + name); }
}

function makeWorld(nMembers = 3) {
  const g = newWorld();
  const classes = ["tank", "dps", "healer", "dps"];
  for (let i = 0; i < nMembers; i++) joinVoice(g, "u" + i, "Hero" + i, null);
  g.members.forEach((m, i) => { m.cls = classes[i % classes.length]; });
  return g;
}
function tickUntil(g, pred, maxSec = 120) {
  for (let s = 0; s < maxSec * 20; s++) { tick(g, 0.05); if (pred(g)) return true; }
  return false;
}

/* ---------- 1. clearing stage 20 ends the chapter automatically ---------- */
{
  const g = makeWorld(3);
  for (const m of g.members) { m.level = 30; m.gear.weapon = { slot: "weapon", name: "Test Blade", power: 20, rarity: { id: "rare", name: "Rare", color: "#5aa9e6", mult: 1.6 } }; }
  g.stage = 20; g.best = 20;
  g.enemies = []; g.phase = "advance"; g.advanceT = 0.01;
  assert(tickUntil(g, (w) => w.phase === "combat" && w.enemies.length > 0, 60), "reaches combat at stage 20");
  for (const e of g.enemies) e.hp = 0;
  g.stock.heal = 0; g.stock.armor = 10;
  const goldBefore = g.gold;
  tick(g, 0.05);
  assert(g.prestiges === 1, "chapter ended automatically (prestiges === 1)");
  assert(g.phase === "feast", "feast follows the finale (phase === feast)");
  assert(g.hall.length === 1 && g.hall[0].stage === 20, "Hall of Legends plaque enshrined at stage 20");
  assert(g.stage === 1 + g.legacy.head * 2, "world stage reset");
  assert(g.members.every((m) => m.level === 30), "characters keep their levels");
  assert(g.members.every((m) => m.gear.weapon && m.gear.weapon.name === "Test Blade"), "characters keep their gear");
  assert(g.gold === goldBefore, "shared gold persists through the chapter end");
  assert(g.stock.heal >= 3, "feast restocks empty potions");
  assert(g.stock.armor === 10, "restock never lowers an ample stock");
  assert(g.mutator !== null, "a mutator was rolled for the new chapter");
  assert(g.renown === Math.round(renownEarn(20)), "chapter renown earned at the stage-20 rate");
  assert(g.session && g.session.chapters === 1, "session ledger counts the chapter");
  const s = snapshot(g, []);
  assert(!("vote" in s), "snapshot no longer ships a vote field");
}

/* ---------- 2. personal retell resets only that member ---------- */
{
  const g = makeWorld(3);
  const [A, B] = g.members;
  A.level = 25; A.sp = 4; A.skills = { fort: 2 };
  A.gear.weapon = { slot: "weapon", name: "Old Blade", power: 12, rarity: { id: "fine", name: "Fine", color: "#7fd069", mult: 1.25 } };
  B.level = 22;
  const cosBefore = JSON.stringify(A.cos), styleBefore = A.style, autoBefore = A.autoSkill;
  const renownBefore = g.renown;
  const expected = Math.round(renownEarn(25)); // fresh world: no mutator, mult 1
  applyIntent(g, { a: "retell", memberId: A.id });
  assert(g.renown === renownBefore + expected, "retell pays renownEarn(level) into the shared pool");
  assert(A.level === 1 && A.xp === 0 && A.sp === 0, "retold hero returns to level 1");
  assert(!A.gear.weapon && !A.gear.armor && !A.gear.trinket, "retold hero loses gear");
  assert(Object.keys(A.skills).length === 0, "retold hero loses skills");
  assert(A.retellings === 1, "retellings counter increments");
  assert(JSON.stringify(A.cos) === cosBefore && A.style === styleBefore && A.autoSkill === autoBefore, "cosmetics, style, and autoSkill endure");
  assert(B.level === 22 && B.retellings === 0, "other members are untouched");
  assert(g.session && g.session.retellings === 1, "session ledger counts the retelling");
}

/* ---------- 3. gates: level, feast, bad member ---------- */
{
  const g = makeWorld(2);
  const [A] = g.members;
  A.level = 20;
  const renownBefore = g.renown;
  applyIntent(g, { a: "retell", memberId: A.id });
  assert(A.level === 20 && g.renown === renownBefore, "retell is a no-op below level 21");
  A.level = 25;
  g.phase = "feast";
  applyIntent(g, { a: "retell", memberId: A.id });
  assert(A.level === 25 && g.renown === renownBefore, "retell is a no-op during the feast");
  g.phase = "combat";
  applyIntent(g, { a: "retell", memberId: 99999 });
  assert(g.renown === renownBefore, "retell with an unknown memberId is a no-op");
}

/* ---------- 4. retellings survives dehydrate/rehydrate ---------- */
{
  const g = makeWorld(1);
  const A = g.members[0];
  A.level = 30; A.retellings = 3;
  const d = dehydrateMember(A);
  assert(d.retellings === 3, "dehydrateMember carries retellings");
  const m2 = rehydrateMember(g, d);
  assert(m2.retellings === 3, "rehydrateMember restores retellings");
  const old = dehydrateMember(A);
  delete old.retellings; // a row saved before the retellings column existed
  const m3 = rehydrateMember(g, old);
  assert(m3.retellings === 0, "old rows default retellings to 0");
}

console.log("\n==== RESULT: " + checks + " checks passed, " + failures.length + " failed ====");
process.exit(failures.length ? 1 : 0);
