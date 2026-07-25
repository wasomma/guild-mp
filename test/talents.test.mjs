// Phase 5 regression tests: talent trees, keystones, the scripted
// auto-assign, and the manual-ult latch (COMBAT-REWORK.md Phase 5).
import { describe, it, expect } from "vitest";
import * as sim from "../shared/sim.js";
import {
  TALENTS, SKILLS, MAX_RANK, GATE_PTS,
  spentPts, pathOf, pathPreDone, hasKeystone, findTalent, canBuyTalent, talentPlan,
  newWorld, joinVoice, applyIntent, stats, tick,
} from "../shared/sim.js";

function world() {
  const g = newWorld();
  g.autoSim = false;
  return g;
}
function hero(g, name = "Testa") {
  joinVoice(g, name, name);
  return g.members[g.members.length - 1];
}
function give(m, n) { m.sp += n; }

describe("tree shape", () => {
  it("every style carries two paths of 3+3 nodes and a keystone", () => {
    for (const [style, tree] of Object.entries(TALENTS)) {
      expect(tree.paths.length, style).toBe(2);
      expect(tree.paths.filter((p) => p.rec).length, style).toBe(1);
      for (const p of tree.paths) {
        expect(p.pre.length).toBe(3);
        expect(p.post.length).toBe(3);
        for (const n of p.pre) expect(n.ranks).toBe(3);
        expect(p.key.cd).toBeGreaterThan(0);
        const postPts = p.post.reduce((a, n) => a + n.ranks, 0);
        expect(postPts).toBe(11);
      }
    }
  });

  it("node ids are globally unique across trunk and every tree", () => {
    const seen = new Set();
    for (const cls of Object.keys(SKILLS)) for (const s of SKILLS[cls]) {
      expect(seen.has(s.id), s.id).toBe(false); seen.add(s.id);
    }
    for (const tree of Object.values(TALENTS)) for (const p of tree.paths) {
      for (const n of [...p.pre, p.key, ...p.post]) {
        expect(seen.has(n.id), n.id).toBe(false); seen.add(n.id);
      }
    }
  });

  it("a full build costs 36 points: 15 trunk + 9 pre + 1 keystone + 11 post", () => {
    for (const tree of Object.values(TALENTS)) for (const p of tree.paths) {
      const path = p.pre.reduce((a, n) => a + n.ranks, 0) + 1 + p.post.reduce((a, n) => a + n.ranks, 0);
      expect(15 + path).toBe(36);
    }
  });
});

describe("gatekeeping (canBuyTalent)", () => {
  it("path nodes are closed before the gate, open after choosing", () => {
    const g = world(); const m = hero(g);
    m.autoSkill = false;
    const tree = TALENTS[m.style];
    const p = tree.paths[0];
    expect(canBuyTalent(m, p.pre[0].id)).toBe(false);
    // spend six trunk points
    give(m, 6);
    for (const s of SKILLS[m.cls]) for (let i = 0; i < 2; i++) applyIntent(g, { a: "skillUp", memberId: m.id, skillId: s.id });
    expect(spentPts(m)).toBe(GATE_PTS);
    // gate met but no path chosen yet
    expect(canBuyTalent(m, p.pre[0].id)).toBe(false);
    applyIntent(g, { a: "choosePath", memberId: m.id, pathId: p.id });
    expect(m.path).toBe(p.id);
    expect(canBuyTalent(m, p.pre[0].id)).toBe(true);
    // the other path is hard-locked
    expect(canBuyTalent(m, tree.paths[1].pre[0].id)).toBe(false);
  });

  it("the keystone demands its three forerunners maxed; post nodes demand the keystone", () => {
    const g = world(); const m = hero(g);
    m.autoSkill = false;
    give(m, 40);
    for (const s of SKILLS[m.cls]) for (let i = 0; i < 2; i++) applyIntent(g, { a: "skillUp", memberId: m.id, skillId: s.id });
    const p = TALENTS[m.style].paths[0];
    applyIntent(g, { a: "choosePath", memberId: m.id, pathId: p.id });
    expect(canBuyTalent(m, p.key.id)).toBe(false);
    expect(canBuyTalent(m, p.post[0].id)).toBe(false);
    for (const n of p.pre) for (let i = 0; i < n.ranks; i++) applyIntent(g, { a: "skillUp", memberId: m.id, skillId: n.id });
    expect(pathPreDone(m, p)).toBe(true);
    expect(canBuyTalent(m, p.key.id)).toBe(true);
    expect(canBuyTalent(m, p.post[0].id)).toBe(false);
    applyIntent(g, { a: "skillUp", memberId: m.id, skillId: p.key.id });
    expect(hasKeystone(m)).toBe(true);
    expect(canBuyTalent(m, p.key.id)).toBe(false); // one rank only
    expect(canBuyTalent(m, p.post[0].id)).toBe(true);
  });

  it("choosePath refuses before the gate and refuses a second choice", () => {
    const g = world(); const m = hero(g);
    m.autoSkill = false;
    const tree = TALENTS[m.style];
    applyIntent(g, { a: "choosePath", memberId: m.id, pathId: tree.paths[0].id });
    expect(m.path).toBe(null);
    give(m, 6);
    for (const s of SKILLS[m.cls]) for (let i = 0; i < 2; i++) applyIntent(g, { a: "skillUp", memberId: m.id, skillId: s.id });
    applyIntent(g, { a: "choosePath", memberId: m.id, pathId: tree.paths[1].id });
    expect(m.path).toBe(tree.paths[1].id);
    applyIntent(g, { a: "choosePath", memberId: m.id, pathId: tree.paths[0].id });
    expect(m.path).toBe(tree.paths[1].id); // the hard lock held
  });
});

describe("scripted auto-assign", () => {
  it("reaches the keystone at exactly 16 points (level 17)", () => {
    const g = world(); const m = hero(g);
    m.autoSkill = true;
    give(m, 16);
    tick(g, 0.05);
    const p = pathOf(m);
    expect(p).toBeTruthy();
    expect(p.rec).toBe(true); // the recommended path
    expect(hasKeystone(m)).toBe(true);
    expect(m.sp).toBe(0);
  });

  it("completes the whole build at 36 and banks the rest", () => {
    const g = world(); const m = hero(g);
    m.autoSkill = true;
    give(m, 50);
    tick(g, 0.05);
    expect(spentPts(m)).toBe(36);
    expect(m.sp).toBe(14);
    // trunk maxed, one path complete
    for (const s of SKILLS[m.cls]) expect(m.skills[s.id]).toBe(MAX_RANK);
    const p = pathOf(m);
    for (const n of [...p.pre, ...p.post]) expect(m.skills[n.id]).toBe(n.ranks);
  });

  it("respects a manually chosen non-recommended path", () => {
    const g = world(); const m = hero(g);
    m.autoSkill = false;
    give(m, 7);
    for (const s of SKILLS[m.cls]) for (let i = 0; i < 2; i++) applyIntent(g, { a: "skillUp", memberId: m.id, skillId: s.id });
    const alt = TALENTS[m.style].paths.find((p) => !p.rec);
    applyIntent(g, { a: "choosePath", memberId: m.id, pathId: alt.id });
    m.autoSkill = true;
    give(m, 9);
    tick(g, 0.05);
    expect(m.path).toBe(alt.id);
    expect(m.skills[alt.pre[0].id]).toBeGreaterThan(0);
  });
});

describe("respec and migration", () => {
  it("respec refunds every point including the keystone and clears the path", () => {
    const g = world(); const m = hero(g);
    m.autoSkill = true;
    give(m, 20);
    tick(g, 0.05);
    expect(hasKeystone(m)).toBe(true);
    const total = spentPts(m) + m.sp;
    applyIntent(g, { a: "respecSkills", memberId: m.id });
    expect(m.sp).toBe(total);
    expect(m.path).toBe(null);
    expect(Object.keys(m.skills).length).toBe(0);
    expect(m.autoSkill).toBe(false);
  });

  it("pre-tree characters migrate for free: old trunk ids still count", () => {
    const g = world(); const m = hero(g);
    m.autoSkill = false;
    // a v0.1.35 hero: flat class skills, no path field persisted
    m.skills = Object.fromEntries(SKILLS[m.cls].map((s) => [s.id, 2]));
    delete m.path;
    const d = sim.dehydrateMember(m);
    const g2 = world();
    const m2 = sim.rehydrateMember(g2, d);
    expect(m2.path).toBe(null);
    expect(m2.ultMode).toBe("auto");
    expect(spentPts(m2)).toBe(6);
    expect(canBuyTalent(m2, SKILLS[m2.cls][0].id)).toBe(true);
  });

  it("stats() applies path passives to the final numbers", () => {
    const g = world(); const m = hero(g);
    m.autoSkill = false;
    const before = stats(m, g);
    // grant a full recommended path by hand
    const p = TALENTS[m.style].paths.find((x) => x.rec);
    m.path = p.id;
    for (const n of p.pre) m.skills[n.id] = n.ranks;
    m.skills[p.key.id] = 1;
    for (const n of p.post) m.skills[n.id] = n.ranks;
    const after = stats(m, g);
    // whatever the class, a full path moves the sheet somewhere
    const moved = ["hp", "dmg", "heal", "dr", "critDmg", "regen", "exec", "sootheAdd", "splash", "thorns", "ls", "stun"]
      .some((k) => (after[k] || 0) > (before[k] || 0) + 1e-9);
    expect(moved).toBe(true);
    expect(after.cdCut === undefined).toBe(false);
  });
});

describe("manual ultimate", () => {
  it("holds the charge in manual mode and looses it on fireUlt", () => {
    const g = world(); const m = hero(g);
    applyIntent(g, { a: "setUltMode", memberId: m.id, mode: "manual" });
    expect(m.ultMode).toBe("manual");
    m.ult = 1;
    // drive into combat
    let guard = 4000;
    while (g.phase !== "combat" && guard-- > 0) tick(g, 0.05);
    expect(g.phase).toBe("combat");
    for (let i = 0; i < 40; i++) tick(g, 0.05);
    expect(m.ult).toBe(1); // held
    applyIntent(g, { a: "fireUlt", memberId: m.id });
    expect(m.ultFire).toBe(true);
    let fired = false;
    for (let i = 0; i < 100 && !fired; i++) { tick(g, 0.05); if (m.ult < 1) fired = true; }
    expect(fired).toBe(true);
    expect(m.ultFire).toBe(false);
  });

  it("fireUlt refuses in auto mode or under full charge", () => {
    const g = world(); const m = hero(g);
    m.ult = 1;
    applyIntent(g, { a: "fireUlt", memberId: m.id });
    expect(m.ultFire).toBeFalsy();
    applyIntent(g, { a: "setUltMode", memberId: m.id, mode: "manual" });
    m.ult = 0.5;
    applyIntent(g, { a: "fireUlt", memberId: m.id });
    expect(m.ultFire).toBeFalsy();
  });
});

describe("keystones in combat", () => {
  it("a Sentinel paladin raises the Shield Wall when the line folds", () => {
    const g = world(); const m = hero(g);
    m.autoSkill = false;
    m.cls = "tank"; m.style = "paladin";
    const p = TALENTS.paladin.paths.find((x) => x.id === "sentinel");
    m.path = p.id;
    m.skills = { fort: 2, bulw: 2, bash: 2 };
    for (const n of p.pre) m.skills[n.id] = n.ranks;
    m.skills[p.key.id] = 1;
    m._st = stats(m, g);
    let guard = 4000;
    while (g.phase !== "combat" && guard-- > 0) tick(g, 0.05);
    expect(g.phase).toBe("combat");
    g.stock.heal = 0; // no potion to beat the wall to the rescue
    m.hp = m._st.hp * 0.3; // the line is folding
    m.ksCd = 0;
    let cast = false;
    for (let i = 0; i < 60 && !cast; i++) { tick(g, 0.05); if ((m.wallT || 0) > 0) cast = true; }
    expect(cast).toBe(true);
    expect(m.ksCd).toBeGreaterThan(0);
  });

  it("setStyle refunds path points but keeps the trunk", () => {
    const g = world(); const m = hero(g);
    m.autoSkill = false;
    m.cls = "dps"; m.style = "archer";
    const p = TALENTS.archer.paths.find((x) => x.rec);
    m.path = p.id;
    m.skills = { leth: 2, swft: 2, prec: 2 };
    for (const n of p.pre) m.skills[n.id] = n.ranks;
    m.skills[p.key.id] = 1;
    m.sp = 0;
    applyIntent(g, { a: "setStyle", memberId: m.id, styleId: "rogue" });
    expect(m.style).toBe("rogue");
    expect(m.path).toBe(null);
    expect(m.sp).toBe(10); // 9 pre + 1 keystone came home
    expect(m.skills.leth).toBe(2); // trunk untouched
    expect(m.skills[p.pre[0].id]).toBeUndefined();
  });
});
