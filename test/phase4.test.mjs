// Phase 4 regression tests: King checks, gauntlets, ambushes, camps, retreat.
import { describe, it, expect } from "vitest";
import * as sim from "../shared/sim.js";
import { buildWorld, seedRandom, COMPS } from "../scripts/balance/harness.mjs";

const clearFoes = (g) => { for (const e of g.enemies) e.hp = 0; sim.tick(g, 1 / 20); g.events.length = 0; };

describe("bossTier", () => {
  it("scales with threat and no longer shrinks Kings away for soloists", () => {
    const fresh = buildWorld(COMPS["trinity"]);
    const live = buildWorld(COMPS["trinity"], { live: true });
    expect(sim.bossTier(live)).toBe(36);              // capped wall at veteran scale (30→36 with Phase 5's talent power)
    expect(sim.bossTier(fresh)).toBeLessThan(12);     // stern, not lethal, fresh
    const solo = buildWorld(COMPS["solo-dps"], { live: true });
    expect(sim.bossTier(solo)).toBeCloseTo(27, 1);    // 25% relief, not the old 28% + crowd discount
  });
});

describe("honor-guard gauntlet", () => {
  it("stage %5==4 fights in waves without stage progress between them", () => {
    const restore = seedRandom(31);
    try {
      const g = buildWorld(COMPS["trinity"], { live: true });
      g.stage = 9; g.phase = "advance"; g.advanceT = 0.01; g.camp = true; // camp: no ambush roll
      sim.tick(g, 1 / 20); g.events.length = 0;
      expect(g.phase).toBe("combat");
      expect(g.wave).toBe(1);
      expect(g.waveMax).toBe(2);
      clearFoes(g);
      expect(g.stage).toBe(9);          // still the gauntlet stage
      expect(g.wave).toBe(2);           // next wave, no advance phase
      expect(g.enemies.length).toBeGreaterThan(0);
      expect(g.enemies.some((e) => e.herald)).toBe(true); // the Herald leads the final wave
      clearFoes(g);
      expect(g.stage).toBe(10);         // now the stage clears
    } finally { restore(); }
  });

  it("no Herald in the true first hour (threat < 8)", () => {
    const restore = seedRandom(32);
    try {
      const g = buildWorld(COMPS["solo-tank"]);
      g.stage = 4; g.phase = "advance"; g.advanceT = 0.01; g.camp = true;
      sim.tick(g, 1 / 20); g.events.length = 0;
      clearFoes(g);
      expect(g.enemies.some((e) => e.herald)).toBe(false);
    } finally { restore(); }
  });
});

describe("ambush", () => {
  it("clearing an ambush resumes the road without moving the stage", () => {
    const restore = seedRandom(33);
    try {
      const g = buildWorld(COMPS["trinity"]);
      g.stage = 2; g.phase = "combat"; g.ambush = true; g.momentum = 2;
      g.enemies = [];
      sim.tick(g, 1 / 20); g.events.length = 0;
      expect(g.stage).toBe(2);
      expect(g.phase).toBe("advance");
      expect(g.ambush).toBe(false);
      expect(g.momentum).toBe(2); // an ambush neither stokes nor snuffs momentum
    } finally { restore(); }
  });
});

describe("camp", () => {
  it("a fallen King earns a camp with full recovery for the healer-less", () => {
    const restore = seedRandom(34);
    try {
      const g = buildWorld(COMPS["duo-td"], { live: true }); // no healer
      g.stage = 10; g.phase = "combat"; g.enemies = [];
      sim.tick(g, 1 / 20); g.events.length = 0;
      expect(g.stage).toBe(11);
      expect(g.camp).toBe(true);
      expect(g.advanceT).toBeGreaterThan(4);
      const m = g.members[0];
      m.hp = m._st.hp * 0.3;
      const before = m.hp / m._st.hp;
      for (let i = 0; i < 20; i++) sim.tick(g, 1 / 20), (g.events.length = 0);
      expect(m.hp / m._st.hp - before).toBeGreaterThan(0.08); // ~10%/s, not the 2.5% trickle
    } finally { restore(); }
  });
});

describe("retreat", () => {
  it("a majority vote abandons the King on the party's feet", () => {
    const restore = seedRandom(35);
    try {
      const g = buildWorld(COMPS["trinity"], { live: true });
      g.stage = 15; g.phase = "advance"; g.advanceT = 0.01; g.camp = true;
      sim.tick(g, 1 / 20); g.events.length = 0; // spawns the King
      expect(g.enemies.some((e) => e.boss)).toBe(true);
      g.members[1].alive = false; g.members[1].hp = 0; // one hero already down
      const deaths0 = g.session ? g.session.deaths : 0;
      sim.applyIntent(g, { a: "retreat", key: "H1" });
      expect(g.retreatV.keys.length).toBe(1);
      expect(g.stage).toBe(15); // one vote is not a majority of three
      sim.applyIntent(g, { a: "retreat", key: "H1" }); // dupes don't count
      expect(g.retreatV.keys.length).toBe(1);
      sim.applyIntent(g, { a: "retreat", key: "H3" });
      expect(g.stage).toBe(11);                       // back past the last King
      expect(g.phase).toBe("advance");
      expect(g.members[1].alive).toBe(true);          // the fallen rise
      expect(g.members[1].hp).toBeGreaterThan(0);
      expect((g.session ? g.session.deaths : 0)).toBe(deaths0); // no deaths added
      expect(g.momentum).toBe(0);
    } finally { restore(); }
  });

  it("retreat is only heard during a King fight", () => {
    const g = buildWorld(COMPS["trinity"]);
    g.phase = "advance";
    sim.applyIntent(g, { a: "retreat", key: "H1" });
    expect(g.retreatV).toBeNull();
  });
});

describe("rend", () => {
  it("bleeds drain through armor and clear when the field is won", () => {
    const restore = seedRandom(36);
    try {
      const g = buildWorld(COMPS["solo-tank"], { live: true });
      const m = g.members[0];
      g.phase = "combat"; g.enemies = [{ id: 1, hp: 1, maxHp: 100, dmg: 10, spd: 99, atkT: 99, x: 400, y: 244, lunge: 0, stunT: 0, hitT: 0, poison: 0, poisonT: 0, seed: 1 }];
      m.bleedT = 8; m.bleedDps = 1000; // must outpace the tank's own Grit (2%/s)
      const hp0 = m.hp;
      sim.tick(g, 1 / 20); g.events.length = 0;
      expect(m.hp).toBeLessThan(hp0); // ticked despite tank armor
      clearFoes(g);
      expect(m.bleedT).toBe(0);
    } finally { restore(); }
  });
});
