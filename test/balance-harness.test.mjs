// Phase 0 regression tests for the balance harness (COMBAT-REWORK.md).
// These pin the harness itself — that it drives the real sim to chapter
// completion, forces compositions the auto-assigner never produces, builds
// the live-scale fixture correctly, and reproduces numbers from a seed.
import { describe, it, expect } from "vitest";
import * as sim from "../shared/sim.js";
import { buildWorld, measure, seedRandom, COMPS, LIVE } from "../scripts/balance/harness.mjs";

describe("composition forcing", () => {
  it("builds shapes the auto-assigner never produces", () => {
    const g = buildWorld(COMPS["solo-dps"]);
    expect(g.members.map((m) => m.cls)).toEqual(["dps"]);
    const duo = buildWorld(COMPS["duo-td"]);
    expect(duo.members.map((m) => m.cls)).toEqual(["tank", "dps"]);
  });

  it("nine-member comp matches the 3/3/3 assignment-table shape", () => {
    const g = buildWorld(COMPS["nine"]);
    const count = { tank: 0, dps: 0, healer: 0 };
    for (const m of g.members) count[m.cls]++;
    expect(count).toEqual({ tank: 3, dps: 3, healer: 3 });
  });
});

describe("live-scale fixture", () => {
  it("threat sits at the live band, capped by the party's own level", () => {
    const g = buildWorld(COMPS["trinity"], { live: true });
    const levels = g.members.map((m) => m.level);
    expect(Math.min(...levels)).toBe(LIVE.levels[0]);
    expect(Math.max(...levels)).toBe(LIVE.levels[1]);
    // threat = clamp(topLevel, stage, min(depth, topLevel) + 10) → topLevel here
    expect(sim.threatOf(g)).toBe(LIVE.levels[1]);
    expect(g.prestiges).toBe(LIVE.prestiges);
    expect(g.stage).toBe(1 + LIVE.legacy.head * 2); // Veteran Paths start
  });

  it("members carry gear and banked skill points", () => {
    const g = buildWorld(COMPS["solo-tank"], { live: true });
    const m = g.members[0];
    expect(m.gear.weapon.power).toBeGreaterThan(100);
    expect(m.sp).toBe(m.level - 1);
    expect(m._st.hp).toBeGreaterThan(1000);
  });
});

describe("measured runs", () => {
  it("a fresh trinity completes a chapter and clears all four Kings", () => {
    const r = measure("trinity", { chapters: 1, seed: 1 });
    expect(r.timedOut).toBe(false);
    expect(r.chaptersCompleted).toBe(1);
    expect(r.kings.cleared).toBe(4);
    expect(r.kings.ttkAvg).toBeGreaterThan(0);
    expect(Number.isFinite(r.hpLostPctPerStage)).toBe(true);
    for (const s of r.stages) if (s.dur != null) expect(s.dur).toBeGreaterThan(0);
  });

  it("identical seeds reproduce identical numbers", () => {
    const a = measure("solo-dps", { chapters: 1, seed: 42 });
    const b = measure("solo-dps", { chapters: 1, seed: 42 });
    expect(b.stages).toEqual(a.stages);
    expect(b.kings).toEqual(a.kings);
  });

  it("seedRandom restores Math.random", () => {
    const orig = Math.random;
    const restore = seedRandom(7);
    expect(Math.random).not.toBe(orig);
    restore();
    expect(Math.random).toBe(orig);
  });
});
