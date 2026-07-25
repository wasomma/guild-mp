/* Phase 6 economy model: gold income vs. the Gold Key curve.
   Drives the real sim (like the harness) and reports, per chapter: gold
   earned, Kings felled (= crates per player), and how many keys a greedy
   "open everything affordable" guild cuts along price(n) = 250·(n+1)^1.5.

   Usage: node scripts/balance/economy-model.mjs [chapters] [--live]
   The guardrail this answers: keys must be neither an afternoon's trifle
   nor a no-op as income grows. */

import * as sim from "../../shared/sim.js";
import { buildWorld, seedRandom, COMPS } from "./harness.mjs";

const chapters = Number(process.argv[2]) || 6;
const live = process.argv.includes("--live");
const restore = seedRandom(20260725);

const g = buildWorld(COMPS["trinity"], live ? { live: true } : {});
const rows = [];
let keysCut = 0, unopened = 0, chapterGold = 0, chapterKings = 0, lastGold = g.gold, spentOnKeys = 0;
const startCh = g.prestiges;

while (g.prestiges - startCh < chapters) {
  sim.tick(g, 1 / 20);
  for (const e of g.events) if (e.t === "sfx" && e.k === "kill") { /* counted below via gold */ }
  g.events.length = 0;
  if (g.gold > lastGold) chapterGold += g.gold - lastGold;
  lastGold = g.gold;
  const kingsNow = g.members[0] ? g.members[0].crates || 0 : 0;
  if (kingsNow > chapterKings) { unopened += (kingsNow - chapterKings) * g.members.length; chapterKings = kingsNow; }
  /* greedy key policy: cut a key whenever the coffers cover it and a crate waits */
  while (unopened > 0 && g.gold >= sim.keyPrice(keysCut)) {
    const p = sim.keyPrice(keysCut);
    g.gold -= p; spentOnKeys += p; keysCut++; unopened--;
    lastGold = g.gold;
  }
  if (g.prestiges - startCh > rows.length) {
    rows.push({ chapter: rows.length + 1, gold: Math.round(chapterGold), kings: chapterKings, keys: keysCut, keyPrice: sim.keyPrice(keysCut), banked: Math.round(g.gold) });
    chapterGold = 0; chapterKings = 0;
    for (const m of g.members) m.crates = 0;
  }
  if (g.time > 3600 * 24) break; // safety: a sim-day
}
restore();

console.log(`fixture=${live ? "live" : "fresh"} comp=trinity seed=20260725`);
console.log("ch | gold earned | kings | keys cut (cum) | next key | gold banked");
for (const r of rows) console.log(
  String(r.chapter).padStart(2), "|", String(r.gold).padStart(11), "|", String(r.kings).padStart(5), "|",
  String(r.keys).padStart(14), "|", String(r.keyPrice).padStart(8), "|", String(r.banked).padStart(11));
console.log(`total spent on keys: ${spentOnKeys}g across ${keysCut} keys`);
