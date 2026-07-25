// Phase 3 regression tests: potion charges and the wipe set-back.
import { describe, it, expect } from "vitest";
import * as sim from "../shared/sim.js";
import { buildWorld, seedRandom, COMPS } from "../scripts/balance/harness.mjs";

const wipeAt = (g, stage) => {
  g.stage = stage;
  for (const m of g.members) { m.alive = false; m.hp = 0; }
  g.phase = "combat"; g.enemies = [];
  sim.tick(g, 1 / 20);           // enters the wipe phase
  g.events.length = 0;
  g.wipeT = 0.01;
  sim.tick(g, 1 / 20);           // resolves it
  g.events.length = 0;
  return g.stage;
};

describe("wipe set-back", () => {
  it("falls back to just after the last defeated King", () => {
    const restore = seedRandom(21);
    try {
      const g = buildWorld(COMPS["trinity"]);
      expect(wipeAt(g, 13)).toBe(11);  // last King was 10
      expect(wipeAt(g, 10)).toBe(6);   // wiping ON a King costs back to 6
      expect(wipeAt(g, 3)).toBe(1);    // chapter opening: back to the start
    } finally { restore(); }
  });

  it("never falls behind the Veteran Paths chapter start", () => {
    const restore = seedRandom(22);
    try {
      const g = buildWorld(COMPS["trinity"], { live: true }); // head 3 → start 7
      expect(wipeAt(g, 8)).toBe(7);
      expect(wipeAt(g, 14)).toBe(11);
    } finally { restore(); }
  });
});

describe("potion charges", () => {
  it("the buyPotion intent is gone — gold cannot restock the satchel", () => {
    const g = buildWorld(COMPS["trinity"]);
    g.gold = 100000;
    const before = { ...g.stock };
    sim.applyIntent(g, { a: "buyPotion", k: "heal" });
    expect(g.stock).toEqual(before);
    expect(g.gold).toBe(100000);
  });

  it("the feast SETS stock to the stipend baseline — hoards convert down, empties refill up", () => {
    const restore = seedRandom(23);
    try {
      const g = buildWorld(COMPS["trinity"], { live: true }); // stipend 3 → base+6
      g.stage = 20;
      g.stock = { heal: 500, armor: 0, poison: 2, res: 999 };
      sim.endChapter(g);
      expect(g.stock).toEqual({ heal: 9, armor: 7, poison: 7, res: 7 });
    } finally { restore(); }
  });

  it("POTIONS carry no prices", () => {
    for (const p of Object.values(sim.POTIONS)) expect(p.price).toBeUndefined();
  });
});
