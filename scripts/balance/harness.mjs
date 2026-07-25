/* =====================================================================
   Balance measurement harness (COMBAT-REWORK.md Phase 0).

   Drives shared/sim.js headlessly with forced class compositions and
   records per-stage combat metrics: time-to-kill (Kings especially),
   share of party HP lost, and wipes. Two fixtures:

   - fresh: a brand-new world, chapter 1 onward.
   - live:  the live guild's scale (levels 73-162, 1,757 chapters told,
            maxed legacy, 62M gold) — the v0.1.27 lesson: balance must
            be measured against the world players actually inhabit.

   Determinism: seedRandom() swaps Math.random for a seeded mulberry32
   so a (seed, comp, fixture) triple always reproduces its numbers.
   Mutators are stripped at each chapter end (measurement noise); the
   baseline JSON records that choice.
   ===================================================================== */
import * as sim from "../../shared/sim.js";

/* ---------------- deterministic RNG ---------------- */
export function seedRandom(seed) {
  const orig = Math.random;
  let a = seed >>> 0;
  Math.random = function seeded() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return () => { Math.random = orig; };
}

/* ---------------- fixtures ---------------- */
/* One fixed style per class: style multipliers differ by up to 25%, so a
   reproducible baseline pins them. Recorded in the output meta. */
export const STYLE_FOR = { tank: "paladin", dps: "archer", healer: "mystic" };

/* The live guild's scale (memory + BALANCE.md, 2026-07). Gear is fabricated
   at epic-grade power with no affixes — real heroes carry affixes (lifesteal,
   crit damage), so live runs read slightly weaker than reality; consistent
   across measurements, which is what a baseline needs. */
export const LIVE = {
  prestiges: 1757,
  gold: 62_000_000,
  legacy: { hymn: 5, banner: 5, merchant: 5, scholar: 5, head: 3, stipend: 3 },
  levels: [73, 162],
  gearRarityMult: 2.35,
};

/* The sweep matrix. five/nine follow the class-assignment table shapes
   (2/1/2 and 3/3/3); solo-dps, solo-healer and the duo are shapes the
   auto-assigner never produces — the harness forces them. */
export const COMPS = {
  "solo-tank": ["tank"],
  "solo-dps": ["dps"],
  "solo-healer": ["healer"],
  "duo-td": ["tank", "dps"],
  "trinity": ["tank", "dps", "healer"],
  "five": ["tank", "dps", "healer", "tank", "healer"],
  "nine": ["tank", "dps", "healer", "tank", "healer", "dps", "tank", "dps", "healer"],
};

export function buildWorld(comp, opts = {}) {
  const g = sim.newWorld();
  comp.forEach((_, i) => sim.joinVoice(g, `H${i + 1}`, `Hero${i + 1}`));
  g.members.forEach((m, i) => {
    m.cls = comp[i];
    m.style = STYLE_FOR[comp[i]];
    m.skills = {};
    m.sp = 0;
  });
  if (opts.live) {
    Object.assign(g.legacy, LIVE.legacy);
    g.prestiges = LIVE.prestiges;
    g.gold = LIVE.gold;
    g.stage = g.best = 1 + g.legacy.head * 2; // Veteran Paths start
    const [lo, hi] = LIVE.levels;
    g.members.forEach((m, i) => {
      m.level = comp.length === 1
        ? Math.round((lo + hi) / 2)
        : Math.round(lo + ((hi - lo) * i) / (comp.length - 1));
      m.xp = 0;
      m.sp = m.level - 1; // autoSkill spends these over the first ticks
    });
    const T = sim.threatOf(g);
    g.everBest = Math.max(g.everBest, T);
    const rar = { id: "epic", name: "Epic", color: "#b07fe0", mult: LIVE.gearRarityMult };
    const power = Math.round((4 + T * 1.25) * rar.mult);
    for (const m of g.members) {
      m.gear = {
        weapon: { slot: "weapon", rarity: { ...rar }, power, name: "Baseline Blade" },
        armor: { slot: "armor", rarity: { ...rar }, power, name: "Baseline Plate" },
        trinket: { slot: "trinket", rarity: { ...rar }, power, name: "Baseline Charm" },
      };
    }
    const st = g.legacy.stipend * 2;
    g.stock = { heal: 3 + st, armor: 1 + st, poison: 1 + st, res: 1 + st };
  }
  for (const m of g.members) { m._st = sim.stats(m, g); m.hp = m._st.hp; }
  return g;
}

/* Keep potions topped up to the stipend baseline the way an attentive
   player would — the auto-consume toggles are already on by default. */
function restock(g) {
  const st = g.legacy.stipend * 2;
  const base = { heal: 3 + st, armor: 1 + st, poison: 1 + st, res: 1 + st };
  for (const k of Object.keys(base)) {
    while (g.stock[k] < base[k] && g.gold >= sim.POTIONS[k].price) {
      sim.applyIntent(g, { a: "buyPotion", k });
    }
  }
}

/* ---------------- the measured run ---------------- */
export function runMeasured(g, opts = {}) {
  const dt = opts.dt ?? 1 / 20;
  const targetChapters = opts.chapters ?? 3;
  const maxSimSec = opts.maxSimSec ?? 6 * 3600;
  const stripMutators = opts.stripMutators !== false;

  const partyHp = () => g.members.reduce((a, m) => a + (m.alive ? m.hp : 0), 0);
  const partyMax = () => g.members.reduce((a, m) => a + (m._st ? m._st.hp : 0), 0);

  const stages = []; // every combat ENTRY: {chapter, stage, tier, dur?, hpLostPct?, wiped?}
  let cur = null;
  let prevPhase = g.phase;
  const p0 = g.prestiges;
  const t0 = g.time;
  const deaths0 = g.session ? g.session.deaths : 0;
  let simSteps = 0;

  while (g.prestiges - p0 < targetChapters && g.time - t0 < maxSimSec) {
    sim.tick(g, dt);
    simSteps++;
    g.events.length = 0; // drained by the server in real play; must not grow here
    if (g.phase === "feast") g.feastT = Math.min(g.feastT, dt); // fast-forward
    if (opts.restock !== false) restock(g);

    if (g.phase === "combat" && prevPhase !== "combat") {
      cur = {
        chapter: g.prestiges - p0 + 1,
        stage: g.stage,
        tier: g.stage % 5 === 0 ? "king" : g.stage % 5 === 3 ? "elite" : "normal",
        _t0: g.time, _hp0: partyHp(), _max0: partyMax(),
      };
      stages.push(cur);
    }
    if (prevPhase === "combat" && g.phase !== "combat" && cur) {
      if (g.phase === "wipe") {
        cur.wiped = true; // stage will be re-entered (one stage lower)
      } else {
        cur.dur = round2(g.time - cur._t0);
        cur.hpLostPct = round2(Math.max(0, ((cur._hp0 - partyHp()) / (cur._max0 || 1)) * 100));
      }
      delete cur._t0; delete cur._hp0; delete cur._max0;
      cur = null;
    }
    if (stripMutators && g.mutator) g.mutator = null;
    prevPhase = g.phase;
  }

  const cleared = stages.filter((s) => s.dur != null);
  const byTier = (tier) => summarize(cleared.filter((s) => s.tier === tier));
  const attempts = (tier) => stages.filter((s) => s.tier === tier).length;
  return {
    chaptersCompleted: g.prestiges - p0,
    simSeconds: round2(g.time - t0),
    simSteps,
    timedOut: g.prestiges - p0 < targetChapters,
    wipes: stages.filter((s) => s.wiped).length,
    deaths: (g.session ? g.session.deaths : 0) - deaths0,
    kings: { ...byTier("king"), attempts: attempts("king") },
    elites: { ...byTier("elite"), attempts: attempts("elite") },
    normals: { ...byTier("normal"), attempts: attempts("normal") },
    hpLostPctPerStage: round2(avg(cleared.map((s) => s.hpLostPct))),
    finalThreat: sim.threatOf(g),
    finalLevels: g.members.map((m) => m.level),
    stages,
  };
}

const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const round2 = (x) => Math.round(x * 100) / 100;
function summarize(list) {
  const durs = list.map((s) => s.dur);
  return {
    cleared: list.length,
    ttkAvg: round2(avg(durs)),
    ttkMin: durs.length ? round2(Math.min(...durs)) : 0,
    ttkMax: durs.length ? round2(Math.max(...durs)) : 0,
    hpLostPctAvg: round2(avg(list.map((s) => s.hpLostPct))),
  };
}

/* One full measured run: seed → world → metrics. */
export function measure(compName, { live = false, chapters = 3, seed = 20260725, maxSimSec } = {}) {
  const comp = COMPS[compName];
  if (!comp) throw new Error(`unknown comp: ${compName}`);
  // fold the comp name and fixture into the seed so runs are independent
  let h = seed >>> 0;
  for (const c of `${compName}|${live ? "live" : "fresh"}`) h = (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0;
  const restore = seedRandom(h);
  try {
    const g = buildWorld(comp, { live });
    const startThreat = sim.threatOf(g);
    const result = runMeasured(g, { chapters, maxSimSec });
    return { comp: compName, fixture: live ? "live" : "fresh", seed: h, startThreat, ...result };
  } finally {
    restore();
  }
}
