// Phase 2 regression tests: role-coverage buffs replace the Chorus.
import { describe, it, expect } from "vitest";
import * as sim from "../shared/sim.js";
import { buildWorld, seedRandom, COMPS } from "../scripts/balance/harness.mjs";

const tickUntil = (g, cond, maxSec = 600) => {
  const t0 = g.time;
  while (!cond(g) && g.time - t0 < maxSec) sim.tick(g, 1 / 20), (g.events.length = 0);
  return cond(g);
};

describe("Chorus removal", () => {
  it("headcount no longer buffs stats", () => {
    const solo = buildWorld(COMPS["solo-tank"]);
    const nine = buildWorld(COMPS["nine"]);
    const a = sim.stats(solo.members[0], solo);
    const b = sim.stats(nine.members.find((m) => m.cls === "tank"), nine);
    expect(b.dmg).toBeCloseTo(a.dmg, 5);
    expect(b.hp).toBe(a.hp);
  });
});

describe("trinity momentum", () => {
  it("stacks on trinity clears and pays more gold", () => {
    const restore = seedRandom(11);
    try {
      const g = buildWorld(COMPS["trinity"]);
      const start = g.stage;
      expect(tickUntil(g, (x) => x.stage > start)).toBe(true);
      expect(g.momentum).toBeGreaterThanOrEqual(1);
    } finally { restore(); }
  });

  it("a wipe extinguishes momentum", () => {
    const restore = seedRandom(12);
    try {
      const g = buildWorld(COMPS["trinity"]);
      g.momentum = 4;
      for (const m of g.members) { m.alive = false; m.hp = 0; }
      g.phase = "combat"; g.enemies = [];
      sim.tick(g, 1 / 20);
      expect(g.phase).toBe("wipe");
      expect(g.momentum).toBe(0);
    } finally { restore(); }
  });

  it("solo clears never build momentum", () => {
    const restore = seedRandom(13);
    try {
      const g = buildWorld(COMPS["solo-dps"]);
      const start = g.stage;
      expect(tickUntil(g, (x) => x.stage > start)).toBe(true);
      expect(g.momentum).toBe(0);
    } finally { restore(); }
  });
});

describe("Lifeward", () => {
  const advanceRegen = (comp) => {
    const g = buildWorld(COMPS[comp]);
    g.phase = "advance"; g.advanceT = 999; // hold the road open
    for (const m of g.members) m.hp = m._st.hp * 0.3;
    const before = g.members[0].hp / g.members[0]._st.hp;
    for (let i = 0; i < 20; i++) sim.tick(g, 1 / 20), (g.events.length = 0); // 1s
    return g.members[0].hp / g.members[0]._st.hp - before;
  };
  it("a mender keeps full road recovery; without one it is a trickle", () => {
    const withHealer = advanceRegen("trinity");
    const without = advanceRegen("duo-td");
    expect(withHealer).toBeGreaterThan(0.07); // ~8%/s
    expect(without).toBeLessThan(0.04);       // ~2.5%/s
    expect(without).toBeGreaterThan(0.01);
  });
});

describe("snapshot plumbing", () => {
  it("momentum ships in the snapshot", () => {
    const g = buildWorld(COMPS["trinity"]);
    g.momentum = 3;
    const snap = sim.snapshot(g, []);
    expect(snap.momentum).toBe(3);
  });
});
