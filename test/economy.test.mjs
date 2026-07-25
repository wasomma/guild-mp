// Phase 6 regression tests: Chronicle Crates, Gold Keys, Encores, pity,
// and the Eternal Saga ascension track.
import { describe, it, expect } from "vitest";
import * as sim from "../shared/sim.js";
import { buildWorld, seedRandom, COMPS } from "../scripts/balance/harness.mjs";

describe("the rarity ladder", () => {
  it("every cosmetic is either tiered crate loot or spawn stock — never neither", () => {
    const ids = sim.COS_TIERS.map((t) => t.id);
    /* what every hero owns the moment they spawn (mirrors makeMember; the
       class outfits 1-3 are cross-class crate loot, so they carry tiers) */
    const spawnStock = {
      hat: ["none"], hair: [0, 1, 2, 3], hairstyle: sim.FREE_HAIRSTYLES,
      outfit: [0], weapon: ["steel"], accessory: ["none"],
      cape: ["none"], pet: ["none"], aura: ["none"],
    };
    for (const [kind, list] of Object.entries(sim.COSMETIC_LISTS)) {
      list.forEach((item, idx) => {
        const key = item.id !== undefined ? item.id : idx;
        if (item.tier !== undefined) {
          expect(ids, `${kind}:${item.name}`).toContain(item.tier);
        } else {
          expect(spawnStock[kind], `${kind}:${item.name} is unwinnable and not spawn stock`).toContain(key);
        }
      });
    }
  });

  it("every tier has items to win and the odds sum to 100", () => {
    expect(sim.COS_TIERS.reduce((s, t) => s + t.w, 0)).toBe(100);
    for (const t of sim.COS_TIERS) expect(sim.tierItems(t.id).length, t.id).toBeGreaterThan(0);
  });

  it("the launch chase lives in Myth: kitsune set, top auras, and the three new pieces", () => {
    const myth = sim.tierItems("myth").map((e) => String(e.key));
    for (const k of ["kitsune", "foxmarks", "ninetails", "golden", "starfire", "aurora", "phoenix", "starweave", "8"]) {
      expect(myth, k).toContain(k); // "8" = Foxfire hair index
    }
  });
});

describe("gold keys", () => {
  it("escalate on a permanent world counter", () => {
    expect(sim.keyPrice(0)).toBe(250);
    for (let n = 0; n < 300; n += 25) expect(sim.keyPrice(n + 1)).toBeGreaterThan(sim.keyPrice(n));
    expect(sim.keyPrice(500) % 10).toBe(0);
  });

  it("the openCrate intent needs a crate and the gold, and spends both", () => {
    const restore = seedRandom(61);
    try {
      const g = buildWorld(COMPS["trinity"]);
      const m = g.members[0];
      sim.applyIntent(g, { a: "openCrate", memberId: m.id, pay: "key" });
      expect(g.keysCut).toBe(0);                       // no crate: refused
      m.crates = 1; g.gold = 100;
      sim.applyIntent(g, { a: "openCrate", memberId: m.id, pay: "key" });
      expect(g.keysCut).toBe(0);                       // no gold: refused
      g.gold = 1000;
      const ownedBefore = Object.values(m.owned).reduce((s, l) => s + l.length, 0);
      sim.applyIntent(g, { a: "openCrate", memberId: m.id, pay: "key" });
      expect(g.keysCut).toBe(1);
      expect(m.crates).toBe(0);
      expect(g.gold).toBe(1000 - 250);
      const ownedAfter = Object.values(m.owned).reduce((s, l) => s + l.length, 0);
      expect(ownedAfter + (m.encores > 0 ? 1 : 0)).toBeGreaterThan(ownedBefore); // won a piece (or a full-tier conversion)
    } finally { restore(); }
  });
});

describe("pity", () => {
  it("a run of mythless opens guarantees the next is Myth, then resets", () => {
    const restore = seedRandom(62);
    try {
      const g = buildWorld(COMPS["trinity"]);
      const m = g.members[0];
      m.pity = sim.PITY_AT;
      m.crates = 1; g.gold = 10000;
      const mythBefore = sim.tierItems("myth").filter((e) => (m.owned[e.kind] || []).includes(e.key)).length;
      sim.applyIntent(g, { a: "openCrate", memberId: m.id, pay: "key" });
      const mythAfter = sim.tierItems("myth").filter((e) => (m.owned[e.kind] || []).includes(e.key)).length;
      expect(mythAfter).toBe(mythBefore + 1);
      expect(m.pity).toBe(0);
    } finally { restore(); }
  });

  it("a fully-told tier converts to Encores instead of a dupe", () => {
    const restore = seedRandom(63);
    try {
      const g = buildWorld(COMPS["trinity"]);
      const m = g.members[0];
      for (const e of sim.tierItems("myth")) if (!m.owned[e.kind].includes(e.key)) m.owned[e.kind].push(e.key);
      m.pity = sim.PITY_AT; m.crates = 1; g.gold = 10000; m.encores = 0;
      sim.applyIntent(g, { a: "openCrate", memberId: m.id, pay: "key" });
      expect(m.encores).toBe(sim.COS_TIERS.find((t) => t.id === "myth").enc);
    } finally { restore(); }
  });
});

describe("encores", () => {
  it("a commission needs 40 and rolls without a held crate", () => {
    const restore = seedRandom(64);
    try {
      const g = buildWorld(COMPS["trinity"]);
      const m = g.members[0];
      m.encores = sim.COMMISSION_ENC - 1;
      sim.applyIntent(g, { a: "commissionCrate", memberId: m.id });
      expect(m.encores).toBe(sim.COMMISSION_ENC - 1);  // refused
      m.encores = sim.COMMISSION_ENC;
      sim.applyIntent(g, { a: "commissionCrate", memberId: m.id });
      expect(m.encores).toBeLessThan(sim.COMMISSION_ENC); // spent (maybe +dupe refund, still < 40)
    } finally { restore(); }
  });

  it("a retell pays the teller the same figure the guild pool receives", () => {
    const restore = seedRandom(65);
    try {
      const g = buildWorld(COMPS["trinity"]);
      const m = g.members[0];
      m.level = 40; m.encores = 0;
      const renownBefore = g.renown;
      sim.applyIntent(g, { a: "retell", memberId: m.id });
      const earned = g.renown - renownBefore;
      expect(earned).toBeGreaterThan(0);
      expect(m.encores).toBe(earned);
      expect(m.level).toBe(1);                          // the cost is real
    } finally { restore(); }
  });

  it("a King's fall leaves a crate for every hero and the day's first pays Encores", () => {
    const restore = seedRandom(66);
    try {
      const g = buildWorld(COMPS["trinity"]);
      g.stage = 5; g.phase = "advance"; g.advanceT = 0.05;
      for (let i = 0; i < 20000; i++) {
        sim.tick(g, 1 / 20);
        g.events.length = 0;
        if (g.enemies.length && g.enemies.some((e) => e.boss)) break;
      }
      const king = g.enemies.find((e) => e.boss);
      expect(king).toBeTruthy();
      king.hp = 1;
      for (let i = 0; i < 20000 && g.enemies.some((e) => e.hp > 0); i++) { sim.tick(g, 1 / 20); g.events.length = 0; }
      for (const m of g.members) {
        expect(m.crates).toBe(1);
        expect(m.encores).toBeGreaterThanOrEqual(sim.KING_DAY_ENC);
      }
    } finally { restore(); }
  });
});

describe("the Eternal Saga", () => {
  it("opens only past maxed legacies, costs superlinearly, and lifts final stats", () => {
    const g = buildWorld(COMPS["trinity"]);
    g.renown = 100000;
    sim.applyIntent(g, { a: "ascend" });
    expect(g.ascension).toBe(0);                        // legacies not maxed: refused
    for (const u of sim.LEGACY) g.legacy[u.id] = u.max;
    const c0 = sim.ascendCost(0);
    sim.applyIntent(g, { a: "ascend" });
    expect(g.ascension).toBe(1);
    expect(g.renown).toBe(100000 - c0);
    for (let n = 1; n < 60; n++) {
      expect(sim.ascendCost(n) - sim.ascendCost(n - 1)).toBeGreaterThanOrEqual(sim.ascendCost(n - 1) - sim.ascendCost(n - 2) || 0);
    }
    const m = g.members[0];
    const base = sim.stats(m, { ...g, ascension: 0 }).hp;
    g.ascension = 100;                                   // +50%
    const lifted = sim.stats(m, g).hp;
    expect(lifted / base).toBeCloseTo(1.5, 1);
  });
});

describe("persistence", () => {
  it("crates, encores, pity, and the king-day stamp survive the round-trip", () => {
    const g = buildWorld(COMPS["trinity"]);
    const m = g.members[0];
    m.crates = 7; m.encores = 123; m.pity = 12; m.kingDay = 20661;
    const d = sim.dehydrateMember(m);
    const back = sim.rehydrateMember(g, d);
    expect(back.crates).toBe(7);
    expect(back.encores).toBe(123);
    expect(back.pity).toBe(12);
    expect(back.kingDay).toBe(20661);
  });

  it("the wardrobe shop is closed: the cosmetic intent no longer sells", () => {
    const g = buildWorld(COMPS["trinity"]);
    const m = g.members[0];
    g.gold = 100000;
    sim.applyIntent(g, { a: "cosmetic", memberId: m.id, kind: "hat", key: "crown" });
    expect(m.owned.hat).not.toContain("crown");
    expect(g.gold).toBe(100000);
  });
});
