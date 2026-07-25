/* =====================================================================
   shared/sim.js : the authoritative Guild of the Open Mic simulation.
   No rendering, no I/O. Runs under Node (server) or the browser.
   Visual moments are emitted as events in world.events; clients turn
   them into particles, floaters, and screen shake locally.
   ===================================================================== */

export const P = 3;
export const W = 640, H = 300, GROUND = 244;

/* The class triangle (COMBAT-REWORK.md Phase 1). Base+level stats set the
   early game, but gear power dominates both damage and HP within a few
   chapters and used to erase class identity entirely — at live scale a tank
   hit only ~25% softer than a DPS. `mul` is applied to the FINAL hp/dmg in
   stats(), after gear, so the triangle holds at every depth: tanks durable
   and slow to kill with, DPS a true glass cannon, healers barely armed but
   self-sustaining (their real damage floor is the heal-scaled radiant bolt
   in stats() — without it a solo healer's fights never end). Tanks also
   carry innate damage reduction: share-based armor thins out against the
   threat-scaled soak, so armor alone can no longer be the tank's identity. */
export const CLASSES = {
  tank:   { name: "Tank",   color: "#5aa9e6", icon: "🛡️", base: { hp: 130, hpL: 26, dmg: 6,  dmgL: 1.6, spd: 1.5,  armor: 6, crit: 5 }, mul: { hp: 1.30, dmg: 0.75 }, drBase: 0.20, regen: 0.02 },
  dps:    { name: "DPS",    color: "#ef6461", icon: "⚔️", base: { hp: 72,  hpL: 12, dmg: 14, dmgL: 3.4, spd: 0.85, armor: 0, crit: 15 }, mul: { hp: 0.80, dmg: 1.15 } },
  healer: { name: "Healer", color: "#7fd069", icon: "💚", base: { hp: 88,  hpL: 15, dmg: 5,  dmgL: 1.2, spd: 1.25, armor: 1, crit: 5, heal: 15, healL: 3.5 }, mul: { hp: 1.00, dmg: 0.55 }, healBolt: 0.35, soothe: 3 },
};
export const CLASS_ORDER = ["tank", "dps", "healer"];

export const STYLES = {
  tank: [
    { id: "paladin", name: "Paladin", blurb: "Sword, kite shield, holy plate", dmgMul: 1.0, spdMul: 1.0, critAdd: 0, armorAdd: 2 },
    { id: "warrior", name: "Warrior", blurb: "Berserker fury, axe and hammer", dmgMul: 1.25, spdMul: 0.95, critAdd: 5, armorAdd: -1 },
  ],
  dps: [
    { id: "archer", name: "Archer", blurb: "Longbow volleys from range", dmgMul: 1.1, spdMul: 1.05, critAdd: 5, armorAdd: 0 },
    { id: "rogue", name: "Rogue", blurb: "Twin daggers, twin strikes", dmgMul: 1.0, spdMul: 0.85, critAdd: 10, armorAdd: 0 },
    { id: "chain", name: "Chainblade", blurb: "Hooked blades that lash out", dmgMul: 1.2, spdMul: 1.1, critAdd: 0, armorAdd: 0 },
  ],
  healer: [
    { id: "mystic", name: "Mystic", blurb: "Channels living light through a staff", dmgMul: 1.0, spdMul: 1.0, critAdd: 0, armorAdd: 0 },
  ],
};
export const styleOf = (m) => STYLES[m.cls].find((s) => s.id === m.style) || STYLES[m.cls][0];

export const SKILLS = {
  tank: [
    { id: "fort", name: "Fortitude", desc: "+8% max HP per rank" },
    { id: "bulw", name: "Bulwark", desc: "+4% damage reduction per rank" },
    { id: "bash", name: "Shield Bash", desc: "+6% stun chance on hit per rank" },
  ],
  dps: [
    { id: "leth", name: "Lethality", desc: "+8% damage per rank" },
    { id: "swft", name: "Swiftness", desc: "+6% attack speed per rank" },
    { id: "prec", name: "Precision", desc: "+5% crit chance per rank" },
  ],
  healer: [
    { id: "mend", name: "Mending", desc: "+10% healing per rank" },
    { id: "radi", name: "Radiance", desc: "Heals splash 15% to the party per rank" },
    { id: "bles", name: "Blessing", desc: "+4% party max HP aura per rank" },
  ],
};
export const MAX_RANK = 5;

/* ---------------- talent trees (COMBAT-REWORK Phase 5) ----------------
   Every fighting style carries its own tree, all sharing one shape: the
   TRUNK is the class's three fundamentals above (same ids — a pre-tree
   hero's spent points simply already live in the trunk), six points of
   trunk investment open the style's two PATHS, and a path runs three
   pre-keystone passives (3 ranks each) into its KEYSTONE — an auto-cast
   cooldown ability — then three deeper post-keystone passives. Paths are
   mutually exclusive: picking one locks the other until a (free) respec.
   Fastest keystone lands at 16 points (level 17), before the level-21
   retell gate; a full build (trunk + one whole path) is 36 (level ~37).

   fx vocabulary, per rank: hp/dmg/heal multiply the FINAL stats (post-
   gear, like the class triangle, so talent identity survives gear
   dominance at live scale); spd divides attack period like Swiftness;
   crit/critDmg/dr/stun/splash/ls/thorns add to those pools; grit adds
   combat regen; exec adds damage vs foes below 35% HP; soothe deepens a
   bolt's calming of a King's fury; ult charges ultimates faster; cd
   shaves seconds off the path's keystone cooldown; amp deepens the
   keystone's own effect (each keystone reads it its own way). */
export const GATE_PTS = 6;
export const TALENTS = {
  paladin: { paths: [
    { id: "sentinel", name: "Sentinel", rec: true, blurb: "The wall that does not break",
      pre: [
        { id: "pal_aegis", name: "Aegis", desc: "+4% max HP per rank", ranks: 3, fx: { hp: 0.04 } },
        { id: "pal_stand", name: "Stand Fast", desc: "+0.5%/s Grit combat regen per rank", ranks: 3, fx: { grit: 0.005 } },
        { id: "pal_ward", name: "Warding Light", desc: "+2% damage reduction per rank", ranks: 3, fx: { dr: 0.02 } },
      ],
      key: { id: "pal_wall", name: "Shield Wall", cd: 30, desc: "The party takes half damage for 6s. Rises to meet a King's Crushing Blow, or a line about to fold." },
      post: [
        { id: "pal_bulwark", name: "Bulwark Unbroken", desc: "+5% max HP per rank", ranks: 4, fx: { hp: 0.05 } },
        { id: "pal_oath", name: "Sentinel's Oath", desc: "Shield Wall recovers 3s sooner per rank", ranks: 4, fx: { cd: 3 } },
        { id: "pal_rampart", name: "Living Rampart", desc: "+2% damage reduction per rank", ranks: 3, fx: { dr: 0.02 } },
      ] },
    { id: "crusader", name: "Crusader", blurb: "The line advances",
      pre: [
        { id: "pal_zeal", name: "Zeal", desc: "+5% damage per rank", ranks: 3, fx: { dmg: 0.05 } },
        { id: "pal_smite", name: "Smite", desc: "+3% stun chance per rank", ranks: 3, fx: { stun: 0.03 } },
        { id: "pal_retrib", name: "Retribution", desc: "+8% thorns per rank", ranks: 3, fx: { thorns: 0.08 } },
      ],
      key: { id: "pal_call", name: "Challenger's Call", cd: 20, desc: "Every foe is forced onto the paladin for 8s, who stands 15% harder while they answer." },
      post: [
        { id: "pal_crusade", name: "Crusade", desc: "+4% damage per rank", ranks: 4, fx: { dmg: 0.04 } },
        { id: "pal_clarion", name: "Clarion", desc: "Challenger's Call recovers 2s sooner per rank", ranks: 4, fx: { cd: 2 } },
        { id: "pal_aftershock", name: "Aftershock", desc: "+6% thorns per rank", ranks: 3, fx: { thorns: 0.06 } },
      ] },
  ] },
  warrior: { paths: [
    { id: "juggernaut", name: "Juggernaut", rec: true, blurb: "Too angry to die",
      pre: [
        { id: "war_hide", name: "Iron Hide", desc: "+4% max HP per rank", ranks: 3, fx: { hp: 0.04 } },
        { id: "war_wind", name: "Second Wind", desc: "+0.5%/s Grit combat regen per rank", ranks: 3, fx: { grit: 0.005 } },
        { id: "war_shrug", name: "Shrug It Off", desc: "+2% damage reduction per rank", ranks: 3, fx: { dr: 0.02 } },
      ],
      key: { id: "war_unbrk", name: "Unbreakable", cd: 30, desc: "At death's door the warrior refuses: 60% less damage taken and triple Grit for 8s." },
      post: [
        { id: "war_colossus", name: "Colossus", desc: "+5% max HP per rank", ranks: 4, fx: { hp: 0.05 } },
        { id: "war_relent", name: "Relentless", desc: "Unbreakable recovers 3s sooner per rank", ranks: 4, fx: { cd: 3 } },
        { id: "war_stone", name: "Heart of Stone", desc: "+2% damage reduction per rank", ranks: 3, fx: { dr: 0.02 } },
      ] },
    { id: "warlord", name: "Warlord", blurb: "The war follows the voice",
      pre: [
        { id: "war_fury", name: "Fury", desc: "+5% damage per rank", ranks: 3, fx: { dmg: 0.05 } },
        { id: "war_over", name: "Overwhelm", desc: "+3% stun chance per rank", ranks: 3, fx: { stun: 0.03 } },
        { id: "war_blood", name: "Bloodlust", desc: "+1.5% lifesteal per rank", ranks: 3, fx: { ls: 0.015 } },
      ],
      key: { id: "war_roar", name: "Battle Roar", cd: 25, desc: "A roar drags every foe onto the warrior for 6s and stirs the party to +20% damage." },
      post: [
        { id: "war_conq", name: "Conqueror", desc: "+4% damage per rank", ranks: 4, fx: { dmg: 0.04 } },
        { id: "war_horn", name: "Horn of War", desc: "Battle Roar recovers 2s sooner per rank", ranks: 4, fx: { cd: 2 } },
        { id: "war_thirst", name: "Blood Thirst", desc: "+1% lifesteal per rank", ranks: 3, fx: { ls: 0.01 } },
      ] },
  ] },
  archer: { paths: [
    { id: "sharpshooter", name: "Sharpshooter", rec: true, blurb: "One arrow, one answer",
      pre: [
        { id: "arc_eye", name: "Deadeye", desc: "+6% crit damage per rank", ranks: 3, fx: { critDmg: 0.06 } },
        { id: "arc_pierce", name: "Piercing Shots", desc: "+4% damage to foes below 35% HP per rank", ranks: 3, fx: { exec: 0.04 } },
        { id: "arc_focus", name: "Focus", desc: "+2% crit chance per rank", ranks: 3, fx: { crit: 2 } },
      ],
      key: { id: "arc_mark", name: "Deathmark", cd: 25, desc: "Marks the mightiest foe: the whole party deals +15% to it for 8s." },
      post: [
        { id: "arc_lethal", name: "Lethal Draw", desc: "+4% crit damage per rank", ranks: 4, fx: { critDmg: 0.04 } },
        { id: "arc_hunter", name: "Hunter's Rhythm", desc: "Deathmark recovers 2s sooner per rank", ranks: 4, fx: { cd: 2 } },
        { id: "arc_cull", name: "The Cull", desc: "+3% damage to foes below 35% HP per rank", ranks: 3, fx: { exec: 0.03 } },
      ] },
    { id: "skirmisher", name: "Skirmisher", blurb: "Never where the blow lands",
      pre: [
        { id: "arc_quick", name: "Quickdraw", desc: "+4% attack speed per rank", ranks: 3, fx: { spd: 0.04 } },
        { id: "arc_barb", name: "Barbed Tips", desc: "+4% damage per rank", ranks: 3, fx: { dmg: 0.04 } },
        { id: "arc_fleet", name: "Fleet", desc: "Ultimate charges 5% faster per rank", ranks: 3, fx: { ult: 0.05 } },
      ],
      key: { id: "arc_rain", name: "Rain of Barbs", cd: 22, desc: "A whistling volley rakes every foe for 120% damage and staggers their attacks." },
      post: [
        { id: "arc_tempo", name: "Tempo", desc: "+3% attack speed per rank", ranks: 4, fx: { spd: 0.03 } },
        { id: "arc_quiver", name: "Endless Quiver", desc: "Rain of Barbs recovers 2s sooner per rank", ranks: 4, fx: { cd: 2 } },
        { id: "arc_keen", name: "Keen Edge", desc: "+3% damage per rank", ranks: 3, fx: { dmg: 0.03 } },
      ] },
  ] },
  rogue: { paths: [
    { id: "assassin", name: "Assassin", rec: true, blurb: "The wound that was always fatal",
      pre: [
        { id: "rog_opp", name: "Opportunist", desc: "+4% damage to foes below 35% HP per rank", ranks: 3, fx: { exec: 0.04 } },
        { id: "rog_cut", name: "Cutthroat", desc: "+6% crit damage per rank", ranks: 3, fx: { critDmg: 0.06 } },
        { id: "rog_grim", name: "Grim Focus", desc: "+2% crit chance per rank", ranks: 3, fx: { crit: 2 } },
      ],
      key: { id: "rog_assn", name: "Assassinate", cd: 18, desc: "A single perfect strike for 400% damage against a foe below 30% HP." },
      post: [
        { id: "rog_venom", name: "Envenomed Steel", desc: "+4% crit damage per rank", ranks: 4, fx: { critDmg: 0.04 } },
        { id: "rog_shadow", name: "Shadowstep", desc: "Assassinate recovers 2s sooner per rank", ranks: 4, fx: { cd: 2 } },
        { id: "rog_reaper", name: "Reaper's Due", desc: "+3% damage to foes below 35% HP per rank", ranks: 3, fx: { exec: 0.03 } },
      ] },
    { id: "tempest", name: "Tempest", blurb: "Steel in every direction at once",
      pre: [
        { id: "rog_flow", name: "Flow", desc: "+4% attack speed per rank", ranks: 3, fx: { spd: 0.04 } },
        { id: "rog_fang", name: "Twin Fangs", desc: "+4% damage per rank", ranks: 3, fx: { dmg: 0.04 } },
        { id: "rog_wind", name: "Wind at the Back", desc: "Ultimate charges 5% faster per rank", ranks: 3, fx: { ult: 0.05 } },
      ],
      key: { id: "rog_dance", name: "Blade Dance", cd: 22, desc: "Eight strikes at 60% damage scattered across the enemy line." },
      post: [
        { id: "rog_gale", name: "Gale Step", desc: "+3% attack speed per rank", ranks: 4, fx: { spd: 0.03 } },
        { id: "rog_edge", name: "Dancing Edge", desc: "Blade Dance recovers 2s sooner per rank", ranks: 4, fx: { cd: 2 } },
        { id: "rog_keen", name: "Whetted Fangs", desc: "+3% damage per rank", ranks: 3, fx: { dmg: 0.03 } },
      ] },
  ] },
  chain: { paths: [
    { id: "impaler", name: "Impaler", rec: true, blurb: "The hook finds the heart",
      pre: [
        { id: "chn_barb", name: "Hooked Barbs", desc: "+4% damage to foes below 35% HP per rank", ranks: 3, fx: { exec: 0.04 } },
        { id: "chn_crush", name: "Crushing Links", desc: "+6% crit damage per rank", ranks: 3, fx: { critDmg: 0.06 } },
        { id: "chn_grip", name: "Iron Grip", desc: "+2% stun chance per rank", ranks: 3, fx: { stun: 0.02 } },
      ],
      key: { id: "chn_impale", name: "Impale", cd: 20, desc: "Drives the hook through a foe below 30% HP: 300% damage and a 1s stun." },
      post: [
        { id: "chn_spike", name: "Spiked Terminus", desc: "+4% crit damage per rank", ranks: 4, fx: { critDmg: 0.04 } },
        { id: "chn_windlass", name: "Windlass", desc: "Impale recovers 2s sooner per rank", ranks: 4, fx: { cd: 2 } },
        { id: "chn_gut", name: "Gutting Stroke", desc: "+3% damage to foes below 35% HP per rank", ranks: 3, fx: { exec: 0.03 } },
      ] },
    { id: "cyclone", name: "Cyclone", blurb: "A storm with edges",
      pre: [
        { id: "chn_mom", name: "Momentum", desc: "+4% attack speed per rank", ranks: 3, fx: { spd: 0.04 } },
        { id: "chn_reach", name: "Long Reach", desc: "+4% damage per rank", ranks: 3, fx: { dmg: 0.04 } },
        { id: "chn_whirl", name: "Whirl", desc: "Ultimate charges 5% faster per rank", ranks: 3, fx: { ult: 0.05 } },
      ],
      key: { id: "chn_cyc", name: "Hook Cyclone", cd: 24, desc: "The chains sweep every foe for 130% damage and hurl them back." },
      post: [
        { id: "chn_gale", name: "Gathering Gale", desc: "+3% attack speed per rank", ranks: 4, fx: { spd: 0.03 } },
        { id: "chn_chains", name: "Singing Chains", desc: "Hook Cyclone recovers 2s sooner per rank", ranks: 4, fx: { cd: 2 } },
        { id: "chn_keen", name: "Honed Hooks", desc: "+3% damage per rank", ranks: 3, fx: { dmg: 0.03 } },
      ] },
  ] },
  mystic: { paths: [
    { id: "renewal", name: "Renewal", rec: true, blurb: "Life answers every wound",
      pre: [
        { id: "mys_blossom", name: "Blossom", desc: "+6% healing per rank", ranks: 3, fx: { heal: 0.06 } },
        { id: "mys_over", name: "Overgrowth", desc: "Heals splash +5% to the party per rank", ranks: 3, fx: { splash: 0.05 } },
        { id: "mys_roots", name: "Deep Roots", desc: "+4% max HP per rank", ranks: 3, fx: { hp: 0.04 } },
      ],
      key: { id: "mys_bloom", name: "Verdant Bloom", cd: 25, desc: "Life floods the party: 4% max HP per second for 8s, and bleeds close twice as fast beneath it." },
      post: [
        { id: "mys_garden", name: "Garden of Light", desc: "+5% healing per rank", ranks: 4, fx: { heal: 0.05 } },
        { id: "mys_evergreen", name: "Evergreen", desc: "Verdant Bloom recovers 2.5s sooner per rank", ranks: 4, fx: { cd: 2.5 } },
        { id: "mys_canopy", name: "Canopy", desc: "Heals splash +4% to the party per rank", ranks: 3, fx: { splash: 0.04 } },
      ] },
    { id: "purity", name: "Purity", blurb: "The light that burns clean",
      pre: [
        { id: "mys_clarity", name: "Clarity", desc: "+6% bolt damage per rank", ranks: 3, fx: { dmg: 0.06 } },
        { id: "mys_calm", name: "Lasting Calm", desc: "Soothe calms 1s more fury per bolt per rank", ranks: 3, fx: { soothe: 1 } },
        { id: "mys_mirror", name: "Mirror Ward", desc: "+2% damage reduction per rank", ranks: 3, fx: { dr: 0.02 } },
      ],
      key: { id: "mys_cleanse", name: "Cleanse", cd: 20, desc: "Strips every bleed from the party and mends each cleansed ally for 150% heal power." },
      post: [
        { id: "mys_radiant", name: "Radiant Wrath", desc: "+5% bolt damage per rank", ranks: 4, fx: { dmg: 0.05 } },
        { id: "mys_still", name: "Stillwater", desc: "Cleanse recovers 2s sooner per rank", ranks: 4, fx: { cd: 2 } },
        { id: "mys_purge", name: "Purity's Reach", desc: "Soothe calms 0.5s more fury per bolt per rank", ranks: 3, fx: { soothe: 0.5 } },
      ] },
  ] },
};

/* tree bookkeeping shared by the intent layer, the auto-assign script,
   stats(), and both Skills UIs */
export const pathOf = (m) => {
  const tree = TALENTS[m.style];
  return tree ? tree.paths.find((p) => p.id === m.path) || null : null;
};
export const spentPts = (m) => Object.values(m.skills).reduce((a, b) => a + b, 0);
export const pathPreDone = (m, p) => p.pre.every((n) => (m.skills[n.id] || 0) >= n.ranks);
export const hasKeystone = (m) => { const p = pathOf(m); return !!(p && (m.skills[p.key.id] || 0) > 0); };
export function findTalent(m, id) {
  for (const s of SKILLS[m.cls]) if (s.id === id) return { node: s, kind: "trunk" };
  const tree = TALENTS[m.style];
  if (tree) for (const p of tree.paths) {
    for (const n of p.pre) if (n.id === id) return { node: n, kind: "pre", path: p };
    if (p.key.id === id) return { node: p.key, kind: "key", path: p };
    for (const n of p.post) if (n.id === id) return { node: n, kind: "post", path: p };
  }
  return null;
}
/* One gatekeeper for every way a point can be spent (the skillUp intent and
   the auto-assign script both come through here): trunk is always open under
   MAX_RANK; path nodes demand the gate met AND that path chosen (the hard
   lock); the keystone demands its three forerunners maxed; the deep passives
   demand the keystone itself. */
export function canBuyTalent(m, id) {
  const t = findTalent(m, id);
  if (!t) return false;
  const r = m.skills[id] || 0;
  if (t.kind === "trunk") return r < MAX_RANK;
  if (spentPts(m) < GATE_PTS || m.path !== t.path.id) return false;
  if (t.kind === "pre") return r < t.node.ranks;
  if (t.kind === "key") return r < 1 && pathPreDone(m, t.path);
  return r < t.node.ranks && (m.skills[t.path.key.id] || 0) > 0;
}

export const HATS = [
  { id: "none", name: "Bare Head", price: 0 },
  { id: "hood", name: "Rogue Hood", price: 200 },
  { id: "helm", name: "Knight Helm", price: 350 },
  { id: "wizard", name: "Wizard Hat", price: 450 },
  { id: "horns", name: "Demon Horns", price: 700 },
  { id: "crown", name: "Royal Crown", price: 1200 },
  { id: "halo", name: "Saint Halo", price: 1600 },
  { id: "ribbon", name: "Silk Ribbon", price: 180 },
  { id: "flower", name: "Flower Crown", price: 260 },
  { id: "witch", name: "Witch Hat", price: 480 },
  { id: "catears", name: "Cat Ears", price: 550 },
  { id: "circlet", name: "Gold Circlet", price: 650 },
];
export const BODIES = [
  { id: "m", name: "Male" },
  { id: "f", name: "Female" },
];
/* Character-creator identity catalogs (all free — identity is not loot).
   Races are cosmetic-only: no stat changes, just features the renderers
   draw (ears, tail, tusks, horns, build scale, dwarf beard). */
export const RACES = [
  { id: "human", name: "Human" },
  { id: "elf", name: "Elf", ears: "point" },
  { id: "kitsunekin", name: "Kitsune-kin", ears: "fox", tail: true },
  { id: "dwarf", name: "Dwarf", build: 0.86, buildW: 1.1, beard: true },
  { id: "orc", name: "Orc", tusks: true },
  { id: "tiefling", name: "Tiefling", horns: true },
];
export const raceOf = (m) => RACES.find((r) => r.id === (m.cos && m.cos.race)) || RACES[0];
/* Skin tones: index 0 is the classic canon ramp; 1-4 natural range; 5+ the
   fantasy tones the orc/tiefling flavors call for (any race may wear any). */
export const SKINS = [
  { name: "Golden", c: "#e8b98a", d: "#c99465", l: "#f6d4a6" },
  { name: "Porcelain", c: "#f4d9bd", d: "#d4b294", l: "#fdeedd" },
  { name: "Olive", c: "#c9a06c", d: "#a67c4e", l: "#e0bc8c" },
  { name: "Umber", c: "#9c6b43", d: "#7a4e2d", l: "#b9855a" },
  { name: "Deep", c: "#6e4a30", d: "#523420", l: "#8a6142" },
  { name: "Jade", c: "#8fae6a", d: "#6d8a4c", l: "#aecb8a" },
  { name: "Ash", c: "#9a94a8", d: "#767085", l: "#b8b2c4" },
  { name: "Lavender", c: "#a98fc9", d: "#846da6", l: "#c4aede" },
  { name: "Crimson", c: "#b56055", d: "#8f4238", l: "#d07f72" },
];
export const UNDERGARMENTS = [
  { id: "wrap", name: "Chest Wrap" },
  { id: "vest", name: "Linen Vest" },
  { id: "singlet", name: "Singlet" },
];
export const UNDER_COLORS = [
  { name: "Linen", c: "#d9cbb0" },
  { name: "Charcoal", c: "#3a3550" },
  { name: "Wine", c: "#7a2f45" },
  { name: "Forest", c: "#3f6d4a" },
  { name: "Sky", c: "#5aa9e6" },
  { name: "Rose", c: "#d98aa3" },
];
/* The five spawn hairstyles are free in the creator; premium styles
   (bun, twin, braid, kitsune) stay wardrobe purchases. */
export const FREE_HAIRSTYLES = ["short", "pixie", "bob", "pony", "long"];
export const HAIRSTYLES = [
  { id: "short", name: "Short Crop", price: 0 },
  { id: "pixie", name: "Pixie Cut", price: 60 },
  { id: "bob", name: "Sleek Bob", price: 90 },
  { id: "pony", name: "Ponytail", price: 120 },
  { id: "long", name: "Long Flow", price: 150 },
  { id: "bun", name: "War Bun", price: 180 },
  { id: "twin", name: "Twintails", price: 220 },
  { id: "braid", name: "Battle Braid", price: 260 },
  { id: "kitsune", name: "Kitsune Crown", price: 320 },
];
export const ACCESSORIES = [
  { id: "none", name: "None", price: 0 },
  { id: "freckles", name: "Freckles", price: 60 },
  { id: "warpaint", name: "Warpaint", price: 120 },
  { id: "earrings", name: "Gold Earrings", price: 140 },
  { id: "scarf", name: "Silk Scarf", price: 200 },
  { id: "pendant", name: "Ruby Pendant", price: 220 },
  { id: "foxmarks", name: "Fox Markings", price: 180 },
];
export const CAPES = [
  { id: "none", name: "No Cape", price: 0 },
  { id: "traveler", name: "Traveler Cloak", price: 300, c: "#4d5a8a", lining: "#33304f" },
  { id: "crimson", name: "Crimson Cape", price: 450, c: "#93384a", lining: "#5e2430" },
  { id: "forest", name: "Forest Cloak", price: 450, c: "#3f6d4a", lining: "#2a4a33" },
  { id: "shadow", name: "Shadow Cloak", price: 700, c: "#26232b", lining: "#141221" },
  { id: "royal", name: "Royal Cape", price: 950, c: "#6a4a9e", trim: "#f2c14e", lining: "#4e3675" },
  { id: "gilded", name: "Gilded Cape", price: 1400, c: "#f2c14e", trim: "#fff1c9", lining: "#c78a3b" },
  { id: "ninetails", name: "Nine-Tails", price: 1600, c: "#5cc94a", tip: "#e05aa8", lining: "#3a7a35" },
];
export const PETS = [
  { id: "none", name: "No Pet", price: 0 },
  { id: "wisp", name: "Glimmer Wisp", price: 600 },
  { id: "slimelet", name: "Slimelet", price: 750 },
  { id: "cat", name: "Alley Cat", price: 900 },
  { id: "pup", name: "Loyal Pup", price: 900 },
  { id: "owl", name: "Moon Owl", price: 1200 },
  { id: "drake", name: "Drakeling", price: 2000 },
];
export const AURAS = [
  { id: "none", name: "No Aura", price: 0 },
  { id: "ember", name: "Ember Aura", price: 1800, c: "#ff8a4a" },
  { id: "frost", name: "Frost Aura", price: 1800, c: "#8fe3ff" },
  { id: "verdant", name: "Verdant Aura", price: 1800, c: "#8fd069" },
  { id: "arcane", name: "Arcane Aura", price: 2600, c: "#b07fe0" },
  { id: "golden", name: "Golden Aura", price: 4000, c: "#f2c14e" },
  { id: "starfire", name: "Starfire Aura", price: 4200, c: "#f2c14e" },
];
export const HAIRS = [
  { name: "Chestnut", c: "#6b4a32", price: 0 },
  { name: "Raven", c: "#26232b", price: 60 },
  { name: "Gold", c: "#e8c15a", price: 60 },
  { name: "Ember", c: "#c94f3d", price: 90 },
  { name: "Arcane", c: "#8a6fe0", price: 150 },
  { name: "Seafoam", c: "#69d2c8", price: 150 },
  { name: "Rose", c: "#e77fb3", price: 150 },
  { name: "Lime", c: "#a6e34d", price: 150 },
  { name: "Foxfire", c: "#5cc94a", c2: "#e05aa8", price: 260 },
];
export const OUTFITS = [
  { name: "Traveler", c: "#4d5a8a", price: 0 },
  { name: "Forest", c: "#3f6d4a", price: 80, trim: "#8fd069" },
  { name: "Crimson", c: "#93384a", price: 120, trim: "#f2c14e" },
  { name: "Midnight", c: "#33304f", price: 120, trim: "#8d87a3" },
  { name: "Royal", c: "#6a4a9e", price: 220, trim: "#f2c14e", sash: "#f2c14e" },
  { name: "Sunburst", c: "#c78a3b", price: 220, trim: "#fff1c9", sash: "#93384a" },
  { name: "Ivory", c: "#c9c3b8", price: 300, trim: "#f2c14e", sash: "#5aa9e6" },
  { name: "Lavender", c: "#9a86c9", price: 160, trim: "#efeaff" },
  { name: "Blush", c: "#d98aa3", price: 160, trim: "#fff1c9" },
  { name: "Mint", c: "#8fd0b0", price: 160, trim: "#efeaff" },
  { name: "Wine", c: "#7a2f45", price: 200, trim: "#f2c14e", sash: "#33304f" },
];
export const WEAPON_SKINS = [
  { id: "steel", name: "Steel", c: "#cfd6e0", cD: "#7f8aa0", cL: "#eef2f8", edge: "#ffffff", price: 0 },
  { id: "gold", name: "Gilded", c: "#f2c14e", cD: "#a06b24", cL: "#ffe08a", edge: "#fff6d8", price: 280 },
  { id: "obsidian", name: "Obsidian", c: "#5b4d7d", cD: "#2e2742", cL: "#8a77b8", edge: "#cdbcff", price: 420 },
  { id: "blood", name: "Bloodrot", c: "#d0455a", cD: "#6e1f30", cL: "#f27d8d", edge: "#ffb3bd", price: 520 },
  { id: "crystal", name: "Crystal", c: "#8fe3ff", cD: "#4a9cc9", cL: "#d1f4ff", edge: "#ffffff", price: 680 },
];
export const COSMETIC_LISTS = {
  hat: HATS, hair: HAIRS, hairstyle: HAIRSTYLES, outfit: OUTFITS,
  weapon: WEAPON_SKINS, accessory: ACCESSORIES, cape: CAPES, pet: PETS, aura: AURAS,
};

export const RARITIES = [
  { id: "common", name: "Common", color: "#b6b3c7", mult: 1.0, w: 54, pre: ["Worn", "Plain", "Simple"] },
  { id: "uncommon", name: "Uncommon", color: "#7fd069", mult: 1.35, w: 26, pre: ["Sturdy", "Keen", "Trusty"] },
  { id: "rare", name: "Rare", color: "#5aa9e6", mult: 1.75, w: 12, pre: ["Runed", "Gleaming", "Tempered"] },
  { id: "epic", name: "Epic", color: "#b07fe0", mult: 2.35, w: 6, pre: ["Sorcerous", "Dread", "Storming"] },
  { id: "legendary", name: "Legendary", color: "#f2a94e", mult: 3.2, w: 2, pre: ["Mythic", "Ancient", "Sunforged"] },
];
const SLOT_NOUNS = {
  weapon: ["Blade", "Edge", "Fang", "Scepter", "Cleaver"],
  armor: ["Plate", "Guard", "Mail", "Vestment", "Aegis"],
  trinket: ["Charm", "Ring", "Idol", "Talisman", "Locket"],
};
export const SLOTS = ["weapon", "armor", "trinket"];

/* Potions are per-chapter CHARGES, not purchases (COMBAT-REWORK Phase 3):
   the feast restocks the satchel to base + 2×(Alchemist Stipend rank) and
   nothing refills it mid-chapter. Gold could always outbuy danger — the
   live guild's 62M made sustain effectively infinite — so scarcity, not
   price, is what makes a potion a decision. Gold's sink is cosmetics. */
export const POTIONS = {
  heal: { name: "Healing Potion", icon: "🧪", desc: "Auto sips when an ally drops below 40% HP. Restores 45%." },
  armor: { name: "Armor Elixir", icon: "🛡️", desc: "Auto used at the start of combat. Party gains armor for 12s." },
  poison: { name: "Poison Vial", icon: "☠️", desc: "Auto thrown at the start of combat. Poisons all enemies for 8s." },
  res: { name: "Phoenix Draught", icon: "🔥", desc: "Auto revives a fallen ally at 60% HP after a few seconds." },
};

export const LEGACY = [
  { id: "hymn", name: "Battle Hymns", desc: "+10% damage and healing per rank", max: 5 },
  { id: "banner", name: "Stalwart Banners", desc: "+10% party max HP per rank", max: 5 },
  { id: "merchant", name: "Merchant Contacts", desc: "+15% gold earned per rank", max: 5 },
  { id: "scholar", name: "Scholars' Guild", desc: "+15% XP earned per rank", max: 5 },
  { id: "head", name: "Veteran Paths", desc: "New campaigns begin 2 stages further per rank", max: 3 },
  { id: "stipend", name: "Alchemist Stipend", desc: "Campaigns start with +2 of every potion per rank", max: 3 },
];
export const legacyCost = (rank) => (rank + 1) * 2;

/* Chapter mutators: every chapter after the first is told under one of
   these, twisting the rules and paying bonus renown at the retelling. */
export const MUTATORS = [
  { id: "iron", name: "Chapter of the Iron Kings", desc: "Bosses and elites +50% HP · renown ×1.5", c: "#9aa3b5", renownMult: 1.5 },
  { id: "gilded", name: "Chapter of the Gilded Road", desc: "+40% gold · foes hit 15% harder · renown ×1.25", c: "#f2c14e", renownMult: 1.25 },
  { id: "moon", name: "Chapter of the Racing Moon", desc: "All attacks 20% faster, foes too · renown ×1.25", c: "#8fe3ff", renownMult: 1.25 },
  { id: "horde", name: "Chapter of the Endless Horde", desc: "+1 foe per pack, each 20% frailer · renown ×1.25", c: "#7fd069", renownMult: 1.25 },
  { id: "glass", name: "Chapter of Glass", desc: "All damage +35%, all HP -25% · renown ×1.5", c: "#e77fb3", renownMult: 1.5 },
  { id: "storm", name: "Chapter of the Storm Chorus", desc: "Ultimates charge 30% faster · renown ×1.25", c: "#b07fe0", renownMult: 1.25 },
];
export const mutatorOf = (g) => MUTATORS.find((mu) => mu.id === g.mutator) || null;
export const renownEarn = (stage) => Math.max(0, Math.floor(Math.pow(Math.max(0, stage - 1), 1.12) / 3));

export const ZONES = [
  { name: "Verdant Fields", enemy: "slime", label: "Slime", eliteLabel: "Elder Slime",
    sky: ["#2c3a6b", "#5b7bb0", "#a9c19b"], far: "#4b608f", near: "#33486f",
    ground: "#3f6247", top: "#8fce6b", band: "#57815a", mid: "#2c5340", midDark: "#22412f",
    ray: "255,225,160", fogC: "169,193,155", ambient: "pollen", amb: "#ffe9c0",
    fg: "#101b12", gradeTop: "80,110,180", gradeBot: "255,190,110" },
  { name: "Gloomwood", enemy: "bat", label: "Cave Bat", eliteLabel: "Dire Bat",
    sky: ["#12101f", "#262147", "#3a3462"], far: "#2a2547", near: "#1f1b38",
    ground: "#2c3b41", top: "#5f8a6a", band: "#3a4f50", mid: "#1c2b30", midDark: "#141f23",
    ray: "180,240,200", fogC: "90,110,130", ambient: "firefly", amb: "#d8f7a0",
    fg: "#0a120d", gradeTop: "60,70,140", gradeBot: "120,220,170" },
  { name: "Forgotten Crypt", enemy: "skeleton", label: "Skeleton", eliteLabel: "Bone Captain",
    sky: ["#0d0b16", "#1c1830", "#2b2440"], far: "#221d36", near: "#191529",
    ground: "#3b3450", top: "#7a6f96", band: "#4a4163", mid: "#332c48", midDark: "#241f35",
    ray: "150,175,255", fogC: "120,120,170", ambient: "dust", amb: "#c8d4ff",
    fg: "#0c0a14", gradeTop: "70,80,190", gradeBot: "150,120,220" },
  { name: "Emberdeep", enemy: "imp", label: "Imp", eliteLabel: "Imp Warlord",
    sky: ["#1c0d12", "#4a1c18", "#7a3520"], far: "#3a1a16", near: "#2a1210",
    ground: "#4a2a24", top: "#d07a45", band: "#61352a", mid: "#4e2a22", midDark: "#381d18",
    ray: "255,150,90", fogC: "200,110,70", ambient: "ember", amb: "#ffb066",
    fg: "#140806", gradeTop: "120,40,60", gradeBot: "255,140,70" },
];
export const zoneOf = (g) => ZONES[Math.floor((g.stage - 1) / 5) % ZONES.length];

export const SKIN = "#e8b98a", SKIN_D = "#c99465";
export const ENEMY_COLORS = { slime: "#6fbf5e", bat: "#5d4a7a", skeleton: "#d8d3c0", imp: "#c9503f" };
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const fmt = (n) => (n >= 10000 ? (n / 1000).toFixed(1) + "k" : Math.round(n).toLocaleString());
export const hexA = (h, a) => {
  const n = parseInt(h.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
export const xpNeed = (lvl) => Math.round(26 * Math.pow(lvl, 1.35));

/* ---------------- fx event emission ---------------- */
const ev = (g, e) => { if (g.events.length < 400) g.events.push(e); };
const addFloat = (g, x, y, text, color, big) => ev(g, { t: "float", x, y, text, color, big: !!big });
const burst = (g, x, y, color, n, spd, grav) => ev(g, { t: "burst", x, y, color, n, spd: spd || 1.2, grav: grav || 0 });
const sparkle = (g, x, y, color, n) => ev(g, { t: "sparkle", x, y, color, n });
const shakeFx = (g, v) => ev(g, { t: "shake", v });
const coinsFx = (g, x, y, n) => ev(g, { t: "coins", x, y, n });
const sfxEv = (g, k) => ev(g, { t: "sfx", k });

export function addLog(g, text, color) {
  g.log.unshift({ text, color: color || "#cfc9e8", t: Date.now() });
  if (g.log.length > 40) g.log.pop();
}

/* ---------------- world and members ---------------- */
export function newWorld() {
  return {
    members: [], enemies: [], projectiles: [], pending: [], events: [], log: [],
    roster: {}, uid: 1,
    stage: 1, best: 1, gold: 150, joinCount: 0, momentum: 0,
    wave: 0, waveMax: 0, camp: false, ambush: false, retreatV: null,
    renown: 0, prestiges: 0, everBest: 1, prestigeT: 0,
    legacy: { hymn: 0, banner: 0, merchant: 0, scholar: 0, head: 0, stipend: 0 },
    phase: "advance", advanceT: 1.6, wipeT: 0, scroll: 0, bossT: 0,
    stock: { heal: 3, armor: 1, poison: 1, res: 1 },
    auto: { heal: true, armor: true, poison: true, res: true },
    healCd: 0, buffT: 0, time: 0, mutator: null,
    hall: [], chapter: { kills: 0, gold: 0, uniques: [] },
    autoSim: false, simT: 8,
    session: null,
    quests: [], questDay: 0,
    users: [
      { key: "Pixel_Pete", name: "Pixel_Pete", color: "#e8743b", inVoice: false },
      { key: "LunaMoth", name: "LunaMoth", color: "#8a6fe0", inVoice: false },
      { key: "Sir_Buckets", name: "Sir_Buckets", color: "#5aa9e6", inVoice: false },
      { key: "TeaWitch", name: "TeaWitch", color: "#7fd069", inVoice: false },
      { key: "CtrlAltDefeat", name: "CtrlAltDefeat", color: "#e77fb3", inVoice: false },
    ],
  };
}

/* each class's starter outfit index in OUTFITS — used at spawn and when the
   creator's class pick re-dresses a fresh hero for their calling */
export const CLASS_OUTFIT = { tank: 3, dps: 2, healer: 1 };

export function makeMember(g, key, name, cls) {
  const defaults = CLASS_OUTFIT;
  const fem = Math.random() < 0.5;
  const startHair = fem ? pick(["pony", "long", "bob"]) : pick(["short", "short", "pixie"]);
  /* spawn identity is a random starting point — the creator (fresh flag)
     opens on first join so the player makes it theirs */
  const race = pick(RACES).id;
  const startSkin = race === "orc" ? 5 : race === "tiefling" ? pick([6, 7, 8]) : Math.floor(Math.random() * 5);
  const m = {
    id: g.uid++, key, name, cls, level: 1, xp: 0, sp: 0,
    style: pick(STYLES[cls]).id, swing: 0, shootT: 0, castT: 0, chainT: 0, chainTgt: null,
    skills: {}, autoSkill: true, path: null, ultMode: "auto", ultFire: false, ksCd: 0, retellings: 0, gear: { weapon: null, armor: null, trinket: null },
    cos: { body: fem ? "f" : "m", race, skin: startSkin, under: pick(UNDERGARMENTS).id, underC: Math.floor(Math.random() * UNDER_COLORS.length), fresh: true, hat: "none", hair: Math.floor(Math.random() * 4) % 4, hairstyle: startHair, outfit: defaults[cls], weapon: "steel", accessory: "none", cape: "none", pet: "none", aura: "none" },
    owned: { hat: ["none"], hair: [0, 1, 2, 3], hairstyle: [...FREE_HAIRSTYLES], outfit: [0, defaults[cls]], weapon: ["steel"], accessory: ["none"], cape: ["none"], pet: ["none"], aura: ["none"] },
    hp: 1, alive: true, atkT: rand(0.3, 1.2), lunge: 0, deadT: 0, hop: 0,
    ult: 0, ultT: 0,
    x: -40, y: 0, walking: true, kills: 0, dmgDone: 0, healDone: 0, bubble: 0, seed: Math.random() * 10,
  };
  m._st = stats(m, null); m.hp = m._st.hp;
  return m;
}

export function stats(m, g) {
  const b = CLASSES[m.cls].base, L = m.level - 1, sk = m.skills;
  let hp = b.hp + b.hpL * L, dmg = b.dmg + b.dmgL * L, spd = b.spd;
  let armor = b.armor, crit = b.crit, heal = (b.heal || 0) + (b.healL || 0) * L;
  let dr = 0, stun = 0, splash = 0, ls = 0, thorns = 0, critDmg = 0, goldF = 0;
  let grit = 0, exec = 0, sootheAdd = 0, ultHaste = 0, cdCut = 0;
  const sm = styleOf(m);
  dmg *= sm.dmgMul; spd *= sm.spdMul; crit += sm.critAdd; armor += sm.armorAdd || 0;
  if (m.cls === "tank") { hp *= 1 + 0.08 * (sk.fort || 0); dr = 0.04 * (sk.bulw || 0); stun = 0.06 * (sk.bash || 0); }
  if (m.cls === "dps") { dmg *= 1 + 0.08 * (sk.leth || 0); spd /= 1 + 0.06 * (sk.swft || 0); crit += 5 * (sk.prec || 0); }
  if (m.cls === "healer") { heal *= 1 + 0.1 * (sk.mend || 0); splash = 0.15 * (sk.radi || 0); }
  for (const s of SLOTS) {
    const it = m.gear[s]; if (!it) continue;
    if (s === "weapon") { dmg += it.power; heal += it.power * 0.8; }
    if (s === "armor") { hp += it.power * 4; armor += it.power * 0.25; }
    /* trinket crit is capped: at power*0.35 uncapped a single trinket pinned
       the 60% ceiling on its own, which quietly made Precision, the Rogue's
       +10 and the Archer/Warrior +5 worth exactly nothing */
    if (s === "trinket") { dmg += it.power * 0.5; crit += Math.min(25, it.power * 0.35); hp += it.power * 2; }
    if (it.affixes) for (const a of it.affixes) {
      if (a.id === "ls") ls += a.v / 100;
      else if (a.id === "thorns") thorns += a.v / 100;
      else if (a.id === "critdmg") critDmg += a.v / 100;
      else if (a.id === "goldf") goldF += a.v / 100;
    }
  }
  if (g) {
    let bless = 0;
    for (const o of g.members) if (o.alive && o.cls === "healer") bless = Math.max(bless, o.skills.bles || 0);
    hp *= 1 + 0.04 * bless;
    if (g.legacy) {
      dmg *= 1 + 0.10 * g.legacy.hymn;
      heal *= 1 + 0.10 * g.legacy.hymn;
      hp *= 1 + 0.10 * g.legacy.banner;
    }
    if (g.mutator === "moon") spd *= 0.8;
    if (g.mutator === "glass") { dmg *= 1.35; hp *= 0.75; }
    /* The Chorus of Courage is gone (COMBAT-REWORK Phase 2): headcount no
       longer buffs stats. What the party brings is ROLES — Vanguard (a tank
       shields the line, hurtMember), Warpath (a killer's presence executes
       wounded foes, hitEnemy), Lifeward (a mender keeps the road's recovery,
       the advance phase in tick), and trinity momentum (killEnemy). */
  }
  /* talent-tree passives (Phase 5) ride the FINAL numbers, like the class
     triangle below: the trunk fundamentals multiply base stats and wash out
     under gear within a few chapters, but a chosen path is the build's
     identity and has to matter as much at live scale as on day one. Paths
     are exclusive, so iterating both is harmless — only bought nodes score. */
  const tree = TALENTS[m.style];
  if (tree) for (const p of tree.paths) for (const n of [...p.pre, ...p.post]) {
    const r = sk[n.id] || 0; if (!r) continue;
    const f = n.fx;
    if (f.hp) hp *= 1 + f.hp * r;
    if (f.dmg) dmg *= 1 + f.dmg * r;
    if (f.heal) heal *= 1 + f.heal * r;
    if (f.spd) spd /= 1 + f.spd * r;
    if (f.crit) crit += f.crit * r;
    if (f.critDmg) critDmg += f.critDmg * r;
    if (f.dr) dr += f.dr * r;
    if (f.stun) stun += f.stun * r;
    if (f.splash) splash += f.splash * r;
    if (f.ls) ls += f.ls * r;
    if (f.thorns) thorns += f.thorns * r;
    if (f.grit) grit += f.grit * r;
    if (f.exec) exec += f.exec * r;
    if (f.soothe) sootheAdd += f.soothe * r;
    if (f.ult) ultHaste += f.ult * r;
    if (f.cd) cdCut += f.cd * r;
  }
  /* the class triangle: applied to the FINAL numbers so gear power can't
     wash class identity out (see the CLASSES comment) */
  const cm = CLASSES[m.cls].mul;
  hp *= cm.hp; dmg *= cm.dmg;
  dr = Math.min(0.6, dr + (CLASSES[m.cls].drBase || 0));
  /* the healer's radiant bolt rides their true stat: without this a solo
     healer literally cannot finish fights whose foes sustain themselves
     (measured: a live-scale solo healer stuck in one elite fight for six
     sim-hours against the Dire Bat's drain) */
  if (CLASSES[m.cls].healBolt) dmg += heal * CLASSES[m.cls].healBolt;
  return { hp: Math.round(hp), dmg, spd, armor, crit: clamp(crit, 0, 60), heal, dr, stun, splash, ls, thorns, critDmg, goldF,
    regen: (CLASSES[m.cls].regen || 0) + grit, exec, sootheAdd, ultHaste, cdCut };
}

/* Persistence helpers: a character's durable identity, without transient
   combat fields. The database stores this; rehydrate rebuilds a live member. */
export function dehydrateMember(m) {
  return {
    key: m.key, name: m.name, cls: m.cls, style: m.style,
    level: m.level, xp: m.xp, sp: m.sp, autoSkill: m.autoSkill,
    path: m.path || null, ultMode: m.ultMode || "auto",
    skills: m.skills, gear: m.gear, cos: m.cos, owned: m.owned,
    kills: m.kills, dmgDone: m.dmgDone, healDone: m.healDone,
    retellings: m.retellings || 0,
  };
}

export function rehydrateMember(g, d) {
  const m = makeMember(g, d.key || d.name, d.name, d.cls);
  Object.assign(m, {
    style: d.style, level: d.level, xp: d.xp, sp: d.sp, autoSkill: d.autoSkill !== false,
    path: d.path || null, ultMode: d.ultMode || "auto",
    skills: d.skills || {}, gear: d.gear, cos: d.cos, owned: d.owned,
    kills: d.kills || 0, dmgDone: d.dmgDone || 0, healDone: d.healDone || 0,
    retellings: d.retellings || 0,
  });
  /* pre-creator characters: backfill identity defaults (no fresh flag — a
     hero who predates the creator keeps their look until they open it) and
     grandfather in the free starter hairstyles */
  m.cos = { race: "human", skin: 0, under: "wrap", underC: 0, ...m.cos };
  m.owned.hairstyle = Array.from(new Set([...(m.owned.hairstyle || []), ...FREE_HAIRSTYLES]));
  m._st = stats(m, g); m.hp = m._st.hp;
  return m;
}

/* The character creator's commit: validates every id against the free
   identity catalogs (paid wardrobe stock still requires ownership) and
   clears the first-join fresh flag. Shared by the multiplayer `appearance`
   intent and the prototype's direct call. */
export function applyAppearance(g, m, p) {
  const race = RACES.find((r) => r.id === p.race);
  const body = BODIES.find((b) => b.id === p.body);
  const skinOk = Number.isInteger(p.skin) && p.skin >= 0 && p.skin < SKINS.length;
  const under = UNDERGARMENTS.find((u) => u.id === p.under);
  const underCOk = Number.isInteger(p.underC) && p.underC >= 0 && p.underC < UNDER_COLORS.length;
  const hairOk = Number.isInteger(p.hair) && (m.owned.hair || []).includes(p.hair);
  const styleOk = FREE_HAIRSTYLES.includes(p.hairstyle) || (m.owned.hairstyle || []).includes(p.hairstyle);
  /* class is a first-commit pick: choose freely while the hero is fresh
     (COMBAT-REWORK decision 1); after stepping through the doors, class
     changes go through the Skills tab's respec instead. Re-sending the
     current class is always fine (idempotent commits from the mirror). */
  const clsOk = p.cls === undefined || p.cls === m.cls || (!!CLASSES[p.cls] && !!m.cos.fresh);
  if (!race || !body || !skinOk || !under || !underCOk || !hairOk || !styleOk || !clsOk) return false;
  const wasFresh = m.cos.fresh;
  Object.assign(m.cos, { race: race.id, body: body.id, skin: p.skin, under: under.id, underC: p.underC, hair: p.hair, hairstyle: p.hairstyle });
  delete m.cos.fresh;
  if (!(m.owned.hairstyle || []).includes(p.hairstyle)) m.owned.hairstyle.push(p.hairstyle);
  if (wasFresh && p.cls && p.cls !== m.cls) {
    m.cls = p.cls;
    m.style = STYLES[p.cls][0].id;
    m.skills = {}; m.path = null; m.sp = m.level - 1;
    const fit = CLASS_OUTFIT[p.cls];
    if (!m.owned.outfit.includes(fit)) m.owned.outfit.push(fit);
    m.cos.outfit = fit;
    m._st = stats(m, g); m.hp = m._st.hp;
    addLog(g, `${m.name} takes up the ${CLASSES[p.cls].name}'s calling!`, CLASSES[p.cls].color);
  }
  addLog(g, wasFresh
    ? `${m.name} the ${race.name} steps through the guild doors for the first time!`
    : `${m.name} returns from the outfitter's mirror with a new look.`, "#f2c14e");
  return true;
}

/* Whichever class the party is most short of, read off who is actually
   standing here rather than a lifetime join tally.

   `CLASS_ORDER[joinCount % 3]` was wrong twice over. It never looked at the
   party, so a guild that lost all its healers kept being handed whatever the
   counter said next and could never recover. And cycling tank→dps→healer left
   a five-hero party at two tanks, two DPS and a single healer — the most
   damage-dense shape in the game, which measured as one of the softest.

   Cover the three roles first, in the order a party actually needs them: a
   tank to hold the line, someone who can kill, then someone to mend. After
   that fill whichever is scarcest, breaking ties toward tank and healer. The
   role-coverage step matters — filling purely by "fewest" hands a duo a tank
   and a healer and no damage at all, which measured at 32.6% of the party's
   health per stage because the pair simply cannot finish a fight. */
export const CLASS_NEED = ["tank", "dps", "healer"];
/* Which callings are actually standing right now — the input to every
   role-coverage buff (Vanguard / Warpath / Lifeward / trinity momentum).
   Alive matters: a fallen tank shields nobody. */
export const rolesAlive = (g) => {
  const r = { tank: false, dps: false, healer: false };
  for (const m of g.members) if (m.alive) r[m.cls] = true;
  return r;
};
export const classNeed = (g) => {
  const have = { tank: 0, dps: 0, healer: 0 };
  for (const m of g.members) have[m.cls]++;
  for (const c of CLASS_NEED) if (!have[c]) return c;
  let best = "tank";
  for (const c of ["tank", "healer", "dps"]) if (have[c] < have[best]) best = c;
  return best;
};

export function joinVoice(g, key, name, discord) {
  name = String(name || key).slice(0, 16);
  let u = g.users.find((x) => x.key === key);
  if (!u) {
    u = { key, name, color: pick(["#e8743b", "#8a6fe0", "#5aa9e6", "#7fd069", "#e77fb3", "#f2c14e"]), inVoice: false };
    g.users.push(u);
  }
  if (discord) u.discord = true;
  u.name = name; // nicknames may change; the key never does
  if (u.inVoice) return;
  u.inVoice = true;
  if (!g.session) g.session = { startedAt: Date.now(), startStage: g.stage, startChapter: g.prestiges + 1, names: [], kills: 0, bossKills: [], eliteKills: 0, gold: 0, levelUps: 0, topLevel: null, uniques: [], bossLoot: [], deaths: 0, cleaves: 0, chapters: 0, retellings: 0, best: g.stage };
  if (!g.session.names.includes(name)) g.session.names.push(name);
  let m = g.roster[key];
  if (m) {
    delete g.roster[key];
    m.name = name;
    m.alive = true; m.x = -40; m._st = stats(m, g); m.hp = m._st.hp;
    g.members.push(m);
    addLog(g, `${name} returns to the fray as a ${styleOf(m).name} (level ${m.level})!`, CLASSES[m.cls].color);
  } else {
    m = makeMember(g, key, name, classNeed(g));
    g.joinCount++;
    g.members.push(m);
    addLog(g, `${name} joined voice and enters as a ${styleOf(m).name} (${CLASSES[m.cls].name})!`, CLASSES[m.cls].color);
  }
  /* headcount no longer buffs stats (Phase 2) — what matters is coverage,
     so the fanfare belongs to the moment the trinity completes */
  const roles = rolesAlive(g);
  if (g.members.length > 1 && roles.tank && roles.dps && roles.healer && CLASS_NEED.includes(m.cls)) {
    const others = { tank: 0, dps: 0, healer: 0 };
    for (const o of g.members) if (o !== m) others[o.cls]++;
    if (!others[m.cls]) {
      addLog(g, "The trinity stands — shield, blade, and mercy. Momentum awaits!", "#8fe3ff");
      sfxEv(g, "chorus");
    }
  }
}

export function leaveVoice(g, key) {
  const u = g.users.find((x) => x.key === key);
  if (!u || !u.inVoice) return;
  u.inVoice = false;
  const m = g.members.find((x) => x.key === key);
  if (m) {
    g.roster[key] = m;
    g.members = g.members.filter((x) => x !== m);
    addLog(g, `${m.name} left voice. Their adventurer will await their return.`, "#8b84ad");
    const roles = rolesAlive(g);
    if (g.members.length && !roles[m.cls]) {
      const gone = { tank: "The shield wall is gone — the line stands open.", dps: "No killer remains — fights will drag.", healer: "No mender remains — wounds will linger on the road." };
      addLog(g, gone[m.cls], "#8b84ad");
    } else if (g.members.length === 1) addLog(g, `${g.members[0].name} fights on alone.`, "#8b84ad");
  }
}

/* ---------------- progression and loot ---------------- */
function gainXp(g, m, amt) {
  m.xp += amt;
  while (m.xp >= xpNeed(m.level)) {
    m.xp -= xpNeed(m.level);
    m.level++; m.sp++;
    const s = stats(m, g);
    m.hp = Math.min(s.hp, m.hp + s.hp * 0.3);
    addLog(g, `${m.name} reached level ${m.level}! (+1 skill point)`, "#f2c14e");
    addFloat(g, m.x, m.y - 80, "LEVEL UP!", "#f2c14e");
    sfxEv(g, "level");
    if (g.session) { g.session.levelUps++; if (!g.session.topLevel || m.level > g.session.topLevel.level) g.session.topLevel = { name: m.name, level: m.level }; }
    questProg(g, "levelup", 1);
    burst(g, m.x, m.y - 26, "#f2c14e", 14, 1.8);
  }
}

/* ---------------- affixes and uniques ---------------- */
const AFFIXES = [
  { id: "ls", min: 3, max: 8 },
  { id: "thorns", min: 8, max: 22 },
  { id: "critdmg", min: 15, max: 45 },
  { id: "goldf", min: 8, max: 28 },
];
export const AFFIX_DEFS = {
  ls: { name: "Vampiric", fmt: (v) => v + "% lifesteal" },
  thorns: { name: "Bristling", fmt: (v) => "reflects " + v + "% damage" },
  critdmg: { name: "Savage", fmt: (v) => "+" + v + "% crit damage" },
  goldf: { name: "Gilded", fmt: (v) => "+" + v + "% gold find" },
};
export const UNIQUE_COLOR = "#59e0c8";
const UNIQUE_RARITY = { id: "unique", name: "Unique", color: UNIQUE_COLOR, mult: 3.4 };
const UNIQUES = [
  { slot: "weapon", name: "Fangdrinker", affixes: [{ id: "ls", v: 12 }, { id: "critdmg", v: 60 }], powerMul: 1.1 },
  { slot: "weapon", name: "Sunsplitter", affixes: [{ id: "critdmg", v: 90 }], powerMul: 1.25 },
  { slot: "armor", name: "Bristleking's Bulwark", affixes: [{ id: "thorns", v: 45 }], powerMul: 1.2 },
  { slot: "armor", name: "Molten Carapace", affixes: [{ id: "thorns", v: 25 }, { id: "goldf", v: 20 }], powerMul: 1.1 },
  { slot: "trinket", name: "Midas Coil", affixes: [{ id: "goldf", v: 50 }], powerMul: 1.0 },
  { slot: "trinket", name: "Heartstone", affixes: [{ id: "ls", v: 8 }, { id: "critdmg", v: 35 }], powerMul: 1.1 },
];
function rollAffixes(rarIdx) {
  let n = 0;
  if (rarIdx === 1) n = Math.random() < 0.3 ? 1 : 0;
  else if (rarIdx === 2) n = 1;
  else if (rarIdx === 3) n = Math.random() < 0.3 ? 2 : 1;
  else if (rarIdx >= 4) n = 2;
  if (!n) return undefined;
  const pool = [...AFFIXES];
  const out = [];
  const scale = 0.75 + rarIdx * 0.12;
  for (let i = 0; i < n && pool.length; i++) {
    const a = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    out.push({ id: a.id, v: Math.max(1, Math.round(rand(a.min, a.max) * scale)) });
  }
  return out;
}
function genLoot(g, uniqueChance) {
  /* loot rides threat, not stage: gear that reset to chapter-1 power every
     twenty stages was why progression flatlined after the first tale */
  const stage = threatOf(g);
  if (uniqueChance && Math.random() < uniqueChance) {
    const u = pick(UNIQUES);
    return {
      slot: u.slot, rarity: UNIQUE_RARITY, unique: true,
      power: Math.round((4 + stage * 1.25) * UNIQUE_RARITY.mult * u.powerMul * rand(0.95, 1.08)),
      name: u.name,
      affixes: u.affixes.map((a) => ({ ...a })),
    };
  }
  const shift = Math.min(stage * 0.4, 20);
  const weights = RARITIES.map((r, i) => (i === 0 ? Math.max(10, r.w - shift) : r.w + shift / 4));
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total, acc = 0, rar = RARITIES[0], rarIdx = 0;
  for (let i = 0; i < RARITIES.length; i++) { acc += weights[i]; if (roll <= acc) { rar = RARITIES[i]; rarIdx = i; break; } }
  const slot = pick(SLOTS);
  const power = Math.round((4 + stage * 1.25) * rar.mult * rand(0.9, 1.12));
  return { slot, rarity: rar, power, name: `${pick(rar.pre)} ${pick(SLOT_NOUNS[slot])}`, affixes: rollAffixes(rarIdx) };
}

function dropLoot(g, uniqueChance) {
  const item = genLoot(g, uniqueChance);
  const alive = g.members.filter((m) => m.alive);
  if (!alive.length) return;
  const m = pick(alive);
  if (item.unique) {
    addLog(g, `★ UNIQUE! ${item.name} falls before ${m.name}!`, UNIQUE_COLOR);
    addFloat(g, m.x, m.y - 100, "★ " + item.name, UNIQUE_COLOR, true);
    sfxEv(g, "unique");
    if (g.session) g.session.uniques.push(item.name + " (" + m.name + ")");
    if (g.chapter) g.chapter.uniques.push(item.name);
  }
  const cur = m.gear[item.slot];
  let kept = false;
  if (!cur || item.power > cur.power) {
    m.gear[item.slot] = item;
    kept = true;
    sfxEv(g, "loot");
    addLog(g, `${m.name} equipped ${item.name} (${item.rarity.name}, +${item.power})`, item.rarity.color);
    addFloat(g, m.x, m.y - 92, item.name, item.rarity.color);
  } else {
    const val = Math.round(item.power * 2.5);
    g.gold += val;
    questProg(g, "gold", val);
    addLog(g, `${m.name} salvaged ${item.name} for ${val}g`, "#8b84ad");
  }
  return { item, m, kept };
}

/* ---------------- threat: the real difficulty axis ----------------
   `stage` restarts at 1 with every chapter while heroes keep their levels,
   gear, and legacy ranks, so after the first tale it stops describing how
   hard anything is. Threat is the number enemies are actually built from:
   how deep the guild has pushed across all its tales, floored by the party's
   own level so a chapter reset can never hand out free stages. The old
   boss-only level floor was the stopgap version of this. */
export const CHAPTER_DEPTH = 8;
export const FLOOR_SLACK = 10;
export function threatOf(g) {
  let top = 0;
  for (const m of g.members) if (m.level > top) top = m.level;
  if (!top) return Math.max(1, g.stage);
  const told = g.stage + (g.prestiges || 0) * CHAPTER_DEPTH;
  /* Threat is the party's own level, floored at the stage and capped a little
     above whichever of the two is SMALLER: how deep the guild has told, and
     how strong it actually is. Both halves of that cap are load-bearing, and
     each was learned the hard way.

     Capping by depth stops the level floor feeding back on itself — a party
     that wipes still earns XP from what it did kill, levels, and would
     otherwise raise the very threat that just beat it (measured: a solo hero
     at level 211 and 1,154 wipes inside one chapter).

     Capping by the party's own level stops a long-lived world exploding. The
     live guild had told 1,757 chapters; depth alone asked for threat 14,058
     and made the world unplayable the instant it shipped. Nothing a guild has
     already survived should ever demand more than the heroes standing in it
     can answer. */
  const cap = Math.min(told, top) + FLOOR_SLACK;
  return Math.max(1, clamp(top, Math.max(1, g.stage), cap));
}
/* Heroes gain level growth AND gear power at once, so their damage climbs
   faster than any straight line. Enemy bulk and bite follow the same gentle
   curve, which is what keeps a King a King forty stages deep. */
const DIFF_EXP = 1.18;
export const threatCurve = (t) => Math.pow(Math.max(1, t), DIFF_EXP);
/* A warband, not a wall: every extra voice adds bodies to the far side
   (see spawnEncounter) plus this sublinear bulk bump. Per-enemy bite rises
   far more gently than bulk, because a bigger guild brings more tanks to
   spread the autos across and more healers to mend them. */
export const crowdMul = (g) => {
  /* a lone hero brings one sword to a pack the curve assumes two will meet,
     so foes come lighter as well as fewer (see the ceiling in spawnEncounter) */
  const n = g.members.length;
  if (n <= 1) return 0.7;
  /* Retuned for the post-Chorus world (Phase 2): with no headcount stat
     buff, guild throughput rises only ~linearly with bodies, so the old
     0.22-linear + 0.025-squared bulk (tuned when every extra voice also
     carried +4% damage) now overtaxes big parties. The remaining squared
     term is a nudge against role-coverage buffs compounding at the top end. */
  return 1 + 0.17 * (n - 1) + 0.012 * (n - 1) ** 2;
};
export const crowdBite = (g) => 1 + 0.05 * Math.max(0, g.members.length - 1);
/* A King no longer shrinks for a small party (COMBAT-REWORK Phase 4): the
   wall stands the same height for everyone — kill it or don't. The bulk
   instead scales with THREAT, so a fresh world's first Kings are merely
   stern while a veteran world's are sieges; solo attempts are meant to be
   long (tank), a razor race against the enrage clock (DPS), or a grind
   (healer). The old party-size discount was Phase 0's measured reason a
   lone DPS deleted Kings before any mechanic could fire. */
export const bossTier = (g) => {
  /* the wall grows with threat, and only mildly relents for the smallest
     parties — enough that a solo tank's siege stays mathematically winnable
     against its own sustain, never enough to hand back the deleted King */
  const relief = clamp(0.75 + 0.125 * (g.members.length - 1), 0.75, 1);
  /* cap 30 -> 36 with Phase 5: a finished talent path is a permanent
     power step for a capped veteran world, and the wall must grow with
     the ceiling or the trinity band collapses (measured 27.4s -> 23.2s
     mean live King TTK). Fresh worlds sit far below the cap (threat 35
     -> tier 22.5) and never feel this. */
  return Math.min(36, 5 + threatOf(g) * 0.5) * relief;
};
/* The enrage clock: seconds a King tolerates being fought before its fury
   mounts, and how long the mounting takes to reach the ×2 cap. Deliberately
   slow and capped — its job is to make DAWDLING unsustainable, not to
   execute the slow classes: a solo tank's razor-margin siege and a solo
   healer's grind must both remain winnable. The hard "kill it fast or die"
   check is the Crusher, which comes FIRST when no tank holds the line. */
export const ENRAGE_AT = 45;
export const ENRAGE_RAMP = 90;
/* The mercy discount is gone (COMBAT-REWORK.md Phase 1). Enemies hit with
   the same hand whoever stands there: solo danger is now real by design —
   each class survives it by its own route (tanks mitigate, DPS kill first,
   healers mend themselves) instead of being handed a pulled punch. The old
   ×0.6 solo / ×0.9 no-healer discounts made a lone hero the safest shape in
   the game, the exact inverse of the design goal. */

function makeEnemy(g, tier) {
  const zone = zoneOf(g);
  const T = threatOf(g), curve = threatCurve(T);
  const boss = tier === "boss", elite = tier === "elite";
  const hp = Math.round((28 + curve * 15) * (boss ? bossTier(g) : elite ? 3.6 : 1) * crowdMul(g) * rand(0.9, 1.1));
  const e = {
    id: g.uid++, kind: zone.enemy, boss, elite,
    scale: boss ? 1.8 : elite ? 1.35 : 1,
    name: boss ? `${zone.label} King` : elite ? zone.eliteLabel : zone.label,
    hp, maxHp: hp,
    dmg: (4 + curve * 2.2) * (boss ? 1.9 : elite ? 1.4 : 1) * crowdBite(g),
    spd: boss ? 2.0 : elite ? 1.8 : rand(1.5, 2.1),
    xp: Math.round((9 + curve * 3.2) * (boss ? 6 : elite ? 2.5 : 1)),
    gold: Math.round((10 + T * 4) * (boss ? 8 : elite ? 3.5 : 1)),
    x: 0, y: 0, atkT: rand(0.8, 1.8), lunge: 0, stunT: 0, hitT: 0,
    poison: 0, poisonT: 0, seed: Math.random() * 10,
  };
  if (g.mutator === "iron" && (boss || elite)) e.hp = e.maxHp = Math.round(e.hp * 1.5);
  if (g.mutator === "gilded") { e.dmg *= 1.15; e.gold = Math.round(e.gold * 1.4); }
  if (g.mutator === "moon") e.spd *= 0.8;
  if (g.mutator === "horde") e.hp = e.maxHp = Math.round(e.hp * 0.8);
  if (g.mutator === "glass") { e.dmg *= 1.35; e.hp = e.maxHp = Math.round(e.hp * 0.75); }
  return e;
}

export const PACK_CAP = 8;
/* Position and field a set of tiers on the enemy side — shared by regular
   stages, honor-guard waves, and ambushes. The enemy side of the stage is
   ~180px wide; spread the line to fit however many turn up. */
function fieldEnemies(g, tiers) {
  const span = tiers.length > 1 ? Math.min(56, 180 / (tiers.length - 1)) : 0;
  tiers.forEach((tier, i) => {
    const e = typeof tier === "string" ? makeEnemy(g, tier) : tier;
    e.x = 440 + i * span;
    e.y = GROUND - (i % 3) * 8;
    g.enemies.push(e);
  });
}
/* The King's honor guard (Phase 4): stage %5==4 is a gauntlet of 2 waves
   (3 for a party of five or more) with NO advance-phase breather between
   them — the party arrives at the King carrying the fight's cost. The
   final wave is led by a Herald whose blows carry a taste of the King's
   Rend, teaching the fight it guards. */
export const gauntletWaves = (g) => (g.members.length >= 5 ? 3 : 2);
function spawnGauntletWave(g) {
  g.enemies = []; g.projectiles = []; g.pending = [];
  const zone = zoneOf(g);
  /* the Herald sits out the true first hour: a brand-new world's first
     honor guards are plain soldiers, so the very first King approach is a
     lesson rather than an execution (the first-hour guardrail) */
  const final = g.wave === g.waveMax && threatOf(g) >= 8;
  const extra = Math.floor(Math.max(0, g.members.length - 1) / 2);
  const ceiling = clamp(Math.ceil(g.members.length * 1.5), 2, PACK_CAP);
  const n = clamp(2 + Math.floor(Math.random() * 2) + extra, 2, ceiling);
  const tiers = Array(final ? Math.max(1, n - 1) : n).fill("normal");
  if (final) {
    const h = makeEnemy(g, "elite");
    h.herald = true;
    h.name = `Herald of the ${zone.label} King`;
    h.hp = h.maxHp = Math.round(h.maxHp * 0.9);
    h.dmg *= 1.15;
    tiers.unshift(h);
  }
  fieldEnemies(g, tiers);
  g.phase = "combat";
  addLog(g, final
    ? `The ${zone.label} King's Herald leads the final wave (${g.wave}/${g.waveMax})!`
    : `The honor guard presses in — wave ${g.wave} of ${g.waveMax}!`, "#e77463");
  if (final) sfxEv(g, "elite");
}
function spawnEncounter(g) {
  g.enemies = [];
  g.camp = false;
  g.retreatV = null;
  const boss = g.stage % 5 === 0;
  const elite = !boss && g.stage % 5 === 3;
  const gaunt = !boss && !elite && g.stage % 5 === 4;
  if (gaunt) {
    g.wave = 1; g.waveMax = gauntletWaves(g);
    spawnGauntletWave(g);
    if (g.auto.armor && g.stock.armor > 0) {
      g.stock.armor--; g.buffT = 12;
      addLog(g, "Armor Elixir shatters. The party hardens! (+armor 12s)", "#5aa9e6");
      sfxEv(g, "potion");
    }
    return;
  }
  g.wave = 0; g.waveMax = 0;
  /* Extra voices bring extra bodies: the party's tanks scale with headcount
     too, so a bigger warband keeps the autos-per-tank ratio honest. */
  const extra = Math.floor(Math.max(0, g.members.length - 1) / 2);
  /* never field more foes than the party could plausibly face — a lone hero
     meets a pair, not a mob */
  const ceiling = clamp(Math.ceil(g.members.length * 1.5), 2, PACK_CAP);
  const pack = clamp(2 + Math.floor(Math.random() * 3) + extra, 2, ceiling);
  const tiers = boss ? ["boss"] : elite ? ["elite", ...Array(clamp(1 + extra, 1, ceiling - 1)).fill("normal")] : Array(pack).fill("normal");
  if (g.mutator === "horde" && !boss && tiers.length < PACK_CAP) tiers.push("normal");
  /* The enemy side of the stage is ~180px wide; spread the line to fit it
     however many turn up, rather than marching the tail off-screen. */
  fieldEnemies(g, tiers);
  g.phase = "combat";
  if (boss) {
    addLog(g, `Boss encounter! ${g.enemies[0].name} blocks the path.`, "#ef6461");
    g.bossT = 2; shakeFx(g, 5);
    sfxEv(g, "boss");
  } else if (elite) {
    addLog(g, `${g.enemies[0].name} guards the road ahead!`, "#e77463");
    shakeFx(g, 3);
    sfxEv(g, "elite");
  }
  if (g.auto.armor && g.stock.armor > 0) {
    g.stock.armor--; g.buffT = 12;
    addLog(g, "Armor Elixir shatters. The party hardens! (+armor 12s)", "#5aa9e6");
    sfxEv(g, "potion");
  }
  if (g.auto.poison && g.stock.poison > 0) {
    g.stock.poison--;
    for (const e of g.enemies) { e.poison = 2 + threatCurve(threatOf(g)) * 0.7; e.poisonT = 8; }
    addLog(g, "Poison Vial hisses across the enemy line.", "#7fd069");
    sfxEv(g, "potion");
  }
}

function formation(g) {
  // Class-banded ranks: tanks nearest the foe, then DPS, healers rearmost.
  // Pitch stretches when the party is small so capes, pets, and auras stay
  // readable, and compresses (never below 38) to keep nine on screen. The
  // fit check measures the exact leftmost slot, so parties of six or fewer
  // keep the full spread.
  const groups = CLASS_ORDER.map((c) => g.members.filter((m) => m.cls === c)).filter((gp) => gp.length);
  const FRONT = 250, LEFT = 18;
  let pitch = 100, gap = 48;
  const minX = () => {
    let x = FRONT, lo = FRONT;
    for (const gp of groups) {
      for (let i = 0; i < gp.length; i++) lo = Math.min(lo, x - Math.floor(i / 2) * pitch - (i % 2) * (pitch / 2));
      x -= (Math.ceil(gp.length / 2) - 1) * pitch + pitch / 2 + gap;
    }
    return lo;
  };
  while (minX() < LEFT && pitch > 38) { pitch -= 4; gap = Math.max(12, gap - 3); }
  let x = FRONT;
  for (const gp of groups) {
    gp.forEach((m, i) => {
      m.tx = x - Math.floor(i / 2) * pitch - (i % 2) * (pitch / 2);
      m.y = GROUND - (i % 2) * 14;
    });
    x -= (Math.ceil(gp.length / 2) - 1) * pitch + pitch / 2 + gap;
  }
}

function killEnemy(g, killer, e) {
  e.hp = 0;
  if (killer) killer.kills++;
  const momMul = 1 + 0.08 * (g.momentum || 0);
  const goldGain = Math.round(e.gold * momMul * (1 + 0.15 * g.legacy.merchant) * (1 + ((killer && killer._st && killer._st.goldF) || 0)));
  g.gold += goldGain;
  sfxEv(g, "kill");
  if (g.session) { g.session.kills++; g.session.gold += goldGain; if (e.boss) g.session.bossKills.push(e.name); else if (e.elite) g.session.eliteKills++; }
  if (g.chapter) { g.chapter.kills++; g.chapter.gold += goldGain; }
  questProg(g, "kill", 1);
  if (e.elite) questProg(g, "elite", 1);
  if (e.boss) questProg(g, "boss", 1);
  questProg(g, "gold", goldGain);
  burst(g, e.x, e.y - 22 * (e.scale || 1), ENEMY_COLORS[e.kind] || "#fff", e.boss ? 30 : e.elite ? 20 : 12, e.boss ? 2.4 : e.elite ? 2 : 1.5);
  coinsFx(g, e.x, e.y - 20, e.boss ? 12 : e.elite ? 8 : 5);
  shakeFx(g, e.boss ? 8 : e.elite ? 4 : 1.5);
  addFloat(g, e.x, e.y - 50, `+${goldGain}g`, "#f2c14e");
  if (e.elite && !e.herald && e.kind === "slime") {
    for (let k = 0; k < 2; k++) {
      const sp = makeEnemy(g, "normal");
      sp.x = e.x + (k ? 30 : -26);
      sp.y = clamp(e.y + (k ? 8 : -8), GROUND - 10, GROUND);
      sp.hp = sp.maxHp = Math.round(sp.maxHp * 0.65);
      g.enemies.push(sp);
      burst(g, sp.x, sp.y - 10, "#6fbf5e", 8, 1.4);
    }
    addLog(g, "The Elder Slime bursts apart into two smaller slimes!", "#7fd069");
    sfxEv(g, "split");
  }
  const alive = g.members.filter((m) => m.alive);
  const share = Math.round((e.xp / Math.max(1, alive.length) + e.xp * 0.4) * momMul * (1 + 0.15 * g.legacy.scholar));
  for (const m of alive) gainXp(g, m, share);
  if (e.boss) {
    const drops = [dropLoot(g, 0.10)];
    if (Math.random() < 0.6) drops.push(dropLoot(g, 0.10));
    if (g.session) for (const d of drops) if (d) (g.session.bossLoot = g.session.bossLoot || []).push({ boss: e.name, item: d.item.name, rarity: d.item.rarity.name, to: d.m.name, kept: d.kept });
    addLog(g, `${e.name} defeated! The path ahead opens.`, "#f2a94e");
  }
  else if (e.elite) { dropLoot(g, 0.05); addLog(g, `${e.name} slain! It drops its prize.`, "#b07fe0"); }
  else if (Math.random() < 0.13) dropLoot(g, 0.01);
}

function rollDmg(m) {
  const crit = Math.random() * 100 < m._st.crit;
  /* Battle Roar (Phase 5): the Warlord's voice carries the whole party */
  const roar = (m.roarT || 0) > 0 ? 1.2 : 1;
  return { dmg: m._st.dmg * rand(0.85, 1.15) * roar * (crit ? 2 + (m._st.critDmg || 0) : 1), crit };
}

function hitEnemy(g, m, tgt, dmg, crit) {
  if (!tgt || tgt.hp <= 0) return;
  /* Warpath: a killer's presence teaches the whole party to finish what it
     starts — everyone's blows land half again as hard on wounded foes. */
  if (tgt.hp / tgt.maxHp < 0.2 && rolesAlive(g).dps) dmg *= 1.5;
  /* execute talents (Phase 5): the killer paths widen the kill window */
  if (m && m._st && m._st.exec > 0 && tgt.hp / tgt.maxHp < 0.35) dmg *= 1 + m._st.exec;
  /* Deathmark (Phase 5): a marked foe is everyone's quarry */
  if ((tgt.markT || 0) > 0) dmg *= 1 + (tgt.markAmp || 0.15);
  /* Soothe (Phase 4): a mender's bolt is a balm even to its target — each
     one calms a King's mounting fury by a few seconds. The healer's answer
     to the enrage clock, and why their weave holds long sieges together.
     Purity talents (Phase 5) deepen the calm. */
  if (m && CLASSES[m.cls].soothe && tgt.boss) {
    tgt.fightT = Math.max(0, (tgt.fightT || 0) - CLASSES[m.cls].soothe - ((m._st && m._st.sootheAdd) || 0));
    if ((tgt.rage || 0) > 0 && Math.random() < 0.4) addFloat(g, tgt.x, tgt.y - 66 * (tgt.scale || 1) - 14, "SOOTHED", "#7fd069");
  }
  if (tgt.shell > 0) {
    dmg *= 0.5;
    tgt.shell--;
    if (tgt.shell === 0) {
      addFloat(g, tgt.x, tgt.y - 66 * (tgt.scale || 1) - 14, "ARMOR SHATTERS", "#d8d3c0", true);
      addLog(g, "The bone armor shatters!", "#d8d3c0");
      burst(g, tgt.x, tgt.y - 26 * (tgt.scale || 1), "#d8d3c0", 14, 1.8);
    }
  }
  tgt.hp -= dmg;
  if (m) m.dmgDone += dmg;
  if (m && m.alive && m._st && m._st.ls > 0) {
    m.hp = Math.min(m._st.hp, m.hp + dmg * m._st.ls);
    if (Math.random() < 0.15) sparkle(g, m.x, m.y - 20, "#9fe88c", 2);
  }
  /* How much of this foe the blow actually took. A chip and a third of a
     King's health used to print the same size number, throw the same sparks
     and kick the camera exactly as hard; now the spectacle tracks the hit. */
  const share = Math.min(1, dmg / Math.max(1, tgt.maxHp));
  const heavy = crit || share > 0.18;
  tgt.hitT = heavy ? 0.22 : 0.15;
  sfxEv(g, crit ? "crit" : "hit");
  burst(g, tgt.x - 6, tgt.y - 28 * (tgt.scale || 1), crit ? "#f2a94e" : "#ffffff", Math.round((crit ? 8 : 4) + 12 * share), crit ? 2 : 1.2);
  if (heavy) shakeFx(g, 2.2 + 4 * share);
  addFloat(g, tgt.x, tgt.y - 66 * (tgt.scale || 1), fmt(dmg) + (crit ? "!" : ""), crit ? "#f2a94e" : "#fff", heavy);
  if (m && m._st.stun > 0 && Math.random() < m._st.stun) { tgt.stunT = 1.1; addFloat(g, tgt.x, tgt.y - 84, "STUNNED", "#5aa9e6"); sfxEv(g, "stun"); }
  if (tgt.hp <= 0) killEnemy(g, m, tgt);
}

function applyHeal(g, m, ally, amt) {
  if (!ally.alive) return;
  ally.hp = Math.min(ally._st.hp, ally.hp + amt);
  /* a mender's touch staunches the King's Rend (Phase 4): each mend closes
     3s of the bleed. This is what makes the healer THE answer to the
     affliction check — and a solo healer's grind survivable at all. */
  if ((ally.bleedT || 0) > 0) ally.bleedT = Math.max(0, ally.bleedT - 3);
  if (m) m.healDone += amt;
  addFloat(g, ally.x, ally.y - 74, `+${fmt(amt)}`, "#7fd069");
  sparkle(g, ally.x, ally.y, "#9fe88c", 6);
}


const FEAST_DUR = 22;
function setupFeast(g) {
  const ms = [...g.members];
  for (let i = ms.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ms[i], ms[j]] = [ms[j], ms[i]]; }
  const table = [316, 354, 392, 430, 462], bar = [96, 128], dance = [214, 252];
  let ti = 0, bi = 0, di = 0, si = 0;
  const assign = (m, act, tx, extra) => { m.feast = { act, seed: Math.random() * 10, face: 1, ...(extra || {}) }; m.tx = tx; };
  /* the old arm-wrestling corner belongs to the pets now (drawFeastPets) */
  const acts = ["drink_bar", "eat", "sing", "dance", "drink", "eat", "dance", "drink_bar"];
  for (let idx = 0; idx < ms.length; idx++) {
    const a = acts[idx % acts.length];
    const m = ms[idx];
    if (a === "drink_bar" && bi < bar.length) assign(m, "drink", bar[bi++], { face: -1 });
    else if (a === "eat" && ti < table.length) assign(m, "eat", table[ti++]);
    else if (a === "sing") assign(m, "sing", 282 + (si++) * 26);
    else if (a === "dance" && di < dance.length) assign(m, "dance", dance[di++]);
    else if (ti < table.length) assign(m, "drink", table[ti++]);
    else assign(m, "dance", 210 + ((di++) % 4) * 26);
  }
  g.feastT = FEAST_DUR;
  addLog(g, "The guild hall doors swing wide. A feast in honor of the tale!", "#f2c14e");
}

/* The sounded retreat (Phase 4, owner decision 5): a majority of the party
   votes to abandon a King rather than die to it. The same ground is lost as
   a wipe — back to the last King's fallen ground — but the party walks out
   on its feet: the living keep their health, the fallen rise at 40%, and no
   deaths are added to the ledger. Momentum still gutters; retreat is a
   choice, not a free reroll. */
export function doRetreat(g) {
  g.stage = Math.max(1 + g.legacy.head * 2, Math.floor((g.stage - 1) / 5) * 5 + 1);
  for (const m of g.members) {
    m.bleedT = 0;
    if (!m.alive) { m.alive = true; m.hp = m._st.hp * 0.4; }
  }
  g.momentum = 0;
  g.retreatV = null;
  g.wave = 0; g.ambush = false;
  g.enemies = []; g.projectiles = []; g.pending = [];
  g.phase = "advance"; g.advanceT = 2.2;
  sfxEv(g, "wipe");
  addLog(g, `The horn sounds. The party retreats in good order to stage ${g.stage} — alive to try again.`, "#f2c14e");
}

export function resetChar(g, m) {
  m.level = 1; m.xp = 0; m.sp = 0; m.skills = {}; m.path = null;
  m.gear = { weapon: null, armor: null, trinket: null };
  m.kills = 0; m.dmgDone = 0; m.healDone = 0;
  m.ult = 0; m.ultT = 0; m.ultFire = false;
  m.ksCd = 0; m.wallT = 0; m.unbrkT = 0; m.callT = 0; m.roarT = 0; m.hotT = 0;
  m.alive = true; m._st = stats(m, g); m.hp = m._st.hp;
}

export function endChapter(g) {
  const mu = mutatorOf(g);
  const earn = Math.round(renownEarn(g.stage) * (mu ? mu.renownMult : 1));
  g.renown += earn; g.prestiges++;
  sfxEv(g, "prestige");
  if (g.session) g.session.chapters++;
  if (g.session) g.session.best = Math.max(g.session.best, g.stage);
  g.everBest = Math.max(g.everBest, threatOf(g));
  /* enshrine the finished chapter in the Hall of Legends */
  const mvp = [...g.members].sort((a, b) => (b.dmgDone + b.healDone) - (a.dmgDone + a.healDone))[0] || null;
  g.hall = g.hall || [];
  g.hall.push({
    chapter: g.prestiges, stage: g.stage, renown: earn,
    mutator: mu ? mu.id : null,
    mvp: mvp ? { name: mvp.name, dmg: Math.round(mvp.dmgDone), heal: Math.round(mvp.healDone) } : null,
    heroes: g.members.map((x) => x.name),
    kills: g.chapter ? g.chapter.kills : 0,
    gold: g.chapter ? Math.round(g.chapter.gold) : 0,
    uniques: g.chapter ? g.chapter.uniques.slice(0, 12) : [],
    endedAt: Date.now(),
  });
  g.chapter = { kills: 0, gold: 0, uniques: [] };
  const pool = MUTATORS.filter((x) => x.id !== g.mutator);
  const next = pool[Math.floor(Math.random() * pool.length)];
  g.mutator = next.id;
  g.stage = 1 + g.legacy.head * 2;
  g.best = g.stage;
  g.momentum = 0;
  /* the feast restocks the satchel to EXACTLY the stipend baseline (Phase 3):
     potions are per-chapter charges now, so leftovers don't bank and the old
     bought hoards convert to charges at the first feast after the change */
  const st = g.legacy.stipend * 2;
  const refill = { heal: 3 + st, armor: 1 + st, poison: 1 + st, res: 1 + st };
  for (const k of Object.keys(refill)) g.stock[k] = refill[k];
  g.enemies = []; g.projectiles = []; g.pending = []; g.buffT = 0;
  g.prestigeT = 3;
  if (g.members.length) { g.phase = "feast"; setupFeast(g); }
  else { g.phase = "advance"; g.advanceT = 2.5; }
  addLog(g, `The tale is told! The guild earns ${earn} renown${mu ? ` (×${mu.renownMult} for braving the ${mu.name})` : ""} and begins Chapter ${g.prestiges + 1}.`, "#f2c14e");
  addLog(g, `The next tale is a ${next.name}: ${next.desc}`, next.c);
}


/* ---------------- taking a hit ---------------- */
/* Armor soaks a share of the blow instead of subtracting a flat amount.
   The old `raw - armor*0.6` turned into outright immunity the moment gear
   power outran the stage's damage — a geared party measured zero damage
   taken for whole chapters. The soak constant climbs with threat, so armor
   holds its worth at every depth and can never reach a wall. */
export function mitigate(g, m, raw) {
  const armor = Math.max(0, m._st.armor + (g.buffT > 0 ? 6 : 0));
  const soak = 30 + 4.5 * threatOf(g);
  const cut = Math.min(0.75, armor / (armor + soak));
  return Math.max(1, raw * (1 - cut) * (1 - m._st.dr));
}
function hurtMember(g, m, rawDmg, src) {
  /* Vanguard: while a tank holds the line, every other calling takes far
     less of the enemy's fury — cleaves and boss specials included. This is
     the mechanical reason damage wants a shield to stand behind. */
  if (m.cls !== "tank" && rolesAlive(g).tank) rawDmg *= 0.55;
  /* keystone guards (Phase 5): the Shield Wall covers everyone beneath it,
     Unbreakable is the warrior's own refusal, the Challenger stands harder
     while the foes they called answer. All BEFORE mitigation, like Vanguard,
     so they stack with armor instead of fighting it. */
  if ((m.wallT || 0) > 0) rawDmg *= 0.5;
  if ((m.unbrkT || 0) > 0) rawDmg *= 0.4;
  if ((m.callT || 0) > 0) rawDmg *= 0.85;
  const dmg = mitigate(g, m, rawDmg);
  m.hp -= dmg;
  addFloat(g, m.x, m.y - 70, "-" + fmt(dmg), "#ef6461");
  if (src && src.hp > 0 && m._st.thorns > 0) {
    const ref = dmg * m._st.thorns;
    src.hp -= ref;
    if (Math.random() < 0.5) addFloat(g, src.x, src.y - 60 * (src.scale || 1), "-" + fmt(ref), "#e77463");
    if (src.hp <= 0) killEnemy(g, m, src);
  }
  sfxEv(g, "hurt");
  if (m.hp <= 0) downMember(g, m);
  return dmg;
}

/* The death rites, shared by every way a hero can drop (hurtMember's blows
   and the Rend bleed alike): one place owns the fall. */
function downMember(g, m) {
  m.alive = false; m.hp = 0; m.deadT = g.time;
  burst(g, m.x, m.y - 24, "#7a7490", 14, 1.6);
  shakeFx(g, 4);
  addLog(g, `${m.name} has fallen!`, "#ef6461");
  sfxEv(g, "fall");
  if (g.session) g.session.deaths++;
}

/* ---------------- boss kings: specials and phases ---------------- */
function bossSpecial(g, e, alive) {
  const s = e.scale || 1;
  const D = e.dmg * (1 + 0.6 * (e.rage || 0)); // specials ride the enrage clock too
  if (e.kind === "slime") {
    e.slamT = 0.45;
    shakeFx(g, 10);
    sfxEv(g, "slam");
    addLog(g, "ROYAL SLAM! The ground heaves beneath the party!", "#ef6461");
    for (const m of alive) if (m.alive) { hurtMember(g, m, D * 1.5, e); burst(g, m.x, m.y - 8, "#6fbf5e", 10, 1.8, 2); }
    burst(g, e.x, e.y - 10, "#6fbf5e", 24, 2.6, 2);
  } else if (e.kind === "bat") {
    e.screechT = 0.6;
    shakeFx(g, 6);
    sfxEv(g, "screech");
    addLog(g, "A deafening SCREECH staggers the party!", "#b07fe0");
    for (const m of alive) if (m.alive) { hurtMember(g, m, D * 0.9, e); m.atkT += 1.1; addFloat(g, m.x, m.y - 84, "DAZED", "#b07fe0"); }
  } else if (e.kind === "skeleton") {
    sfxEv(g, "rise");
    shakeFx(g, 5);
    addLog(g, "GRAVE CALL! Warriors of old claw from the earth!", "#8a6fe0");
    for (let k = 0; k < 2; k++) {
      const sk = makeEnemy(g, "normal");
      sk.x = e.x + (k ? 40 : -36);
      sk.y = clamp(e.y + (k ? 8 : -8), GROUND - 10, GROUND);
      sk.hp = sk.maxHp = Math.round(sk.maxHp * 0.6);
      g.enemies.push(sk);
      burst(g, sk.x, sk.y - 12, "#8a6fe0", 12, 1.6);
      sparkle(g, sk.x, sk.y, "#c8d4ff", 6);
    }
  } else {
    sfxEv(g, "meteor");
    shakeFx(g, 8);
    addLog(g, "Fire rains from the deeps of Emberdeep!", "#ef6461");
    for (const m of alive) if (m.alive) {
      hurtMember(g, m, D * 1.1, e);
      burst(g, m.x, m.y - 30, "#ff6a3a", 12, 2, 1);
      sparkle(g, m.x, m.y - 10, "#f2a94e", 5);
    }
  }
}

/* The CRUSHING BLOW (Phase 4, the tank check): one overwhelming hit at
   whoever holds the King's attention — the same threat logic as its autos.
   A tank's mitigation makes it a survivable slam; anyone else eats a blow
   they were never built for. Vanguard (hurtMember) still softens it for a
   protected backliner if aggro somehow sits on them. */
function bossCrusher(g, e, alive) {
  const s = e.scale || 1;
  const D = e.dmg * (1 + 0.6 * (e.rage || 0));
  const tanks = alive.filter((m) => m.alive && m.cls === "tank");
  let tgt;
  if (tanks.length) tgt = pick(tanks);
  else {
    const standing = alive.filter((m) => m.alive);
    if (!standing.length) return;
    tgt = standing[0];
    for (const m of standing) if (m._st.dmg / m._st.spd > tgt._st.dmg / tgt._st.spd) tgt = m;
  }
  e.slamT = 0.45;
  shakeFx(g, 11);
  sfxEv(g, "slam");
  addLog(g, `CRUSHING BLOW! The ${e.name} brings its full weight down on ${tgt.name}!`, "#ef6461");
  /* the blow grows into its reputation with threat: a fresh world's first
     Kings swing hard but survivably (the first-hour guardrail), a veteran
     world's crushers are the full tank-or-die check */
  hurtMember(g, tgt, D * Math.min(3, 1.5 + threatOf(g) * 0.05), e);
  burst(g, tgt.x, tgt.y - 20, "#ffb24a", 18, 2.4, 2);
  burst(g, e.x, e.y - 10 * s, "#ef6461", 16, 2.2);
}
function bossPhase(g, e) {
  const s = e.scale || 1;
  if (e.kind === "slime") {
    addLog(g, "The Slime King sheds royal offspring!", "#7fd069");
    for (let k = 0; k < 2; k++) {
      const sp = makeEnemy(g, "normal");
      sp.x = e.x + (k ? 34 : -30);
      sp.y = clamp(e.y + (k ? 8 : -8), GROUND - 10, GROUND);
      sp.hp = sp.maxHp = Math.round(sp.maxHp * 0.4);
      sp.scale = 0.85;
      g.enemies.push(sp);
      burst(g, sp.x, sp.y - 10, "#6fbf5e", 8, 1.4);
    }
    sfxEv(g, "split");
  } else if (e.kind === "bat") {
    e.frenzy = true;
    e.spd *= 0.75;
    addLog(g, "The Bat King enters a BLOOD FRENZY!", "#c9506d");
    addFloat(g, e.x, e.y - 66 * s - 14, "BLOOD FRENZY", "#c9506d", true);
    sfxEv(g, "enrage");
  } else if (e.kind === "skeleton") {
    e.shell = 8;
    addLog(g, "The Skeleton King wraps itself in BONE ARMOR!", "#d8d3c0");
    addFloat(g, e.x, e.y - 66 * s - 14, "BONE ARMOR", "#d8d3c0", true);
    sfxEv(g, "rise");
  } else {
    e.enraged = true;
    e.dmg *= 1.25; e.spd *= 0.85;
    addLog(g, "The Imp King IGNITES, burning ever hotter!", "#ef6461");
    addFloat(g, e.x, e.y - 66 * s - 14, "IGNITE", "#ff4a3a", true);
    burst(g, e.x, e.y - 26, "#ff6a3a", 16, 2);
    sfxEv(g, "enrage");
  }
}
// Non-boss whole-party AOE. Autos stay tank-focused; this is the healer check.
function enemyCleave(g, e, party) {
  const s = e.scale || 1;
  if (g.session) g.session.cleaves = (g.session.cleaves || 0) + 1;
  shakeFx(g, e.elite ? 5 : 3);
  sfxEv(g, "slam");
  const mult = e.elite ? 0.7 : 0.5;
  if (e.elite) addLog(g, `The ${e.name} sweeps the party with a brutal cleave!`, "#ef6461");
  for (const m of party) if (m.alive) {
    hurtMember(g, m, e.dmg * mult, e);
    burst(g, m.x, m.y - 24, "#ff7a3a", 8, 1.6);
  }
  burst(g, e.x, e.y - 12 * s, "#ffb24a", 16, 2.2);
}



/* ---------------- guild quests: daily contracts ---------------- */
const QUEST_KINDS = ["kill", "elite", "boss", "gold", "levelup"];
export function questLabel(q) {
  if (q.kind === "kill") return `Slay ${q.target} foes`;
  if (q.kind === "elite") return `Defeat ${q.target} elite foe${q.target > 1 ? "s" : ""}`;
  if (q.kind === "boss") return `Fell ${q.target} King${q.target > 1 ? "s" : ""}`;
  if (q.kind === "gold") return `Earn ${q.target} gold`;
  return `Gain ${q.target} level-up${q.target > 1 ? "s" : ""}`;
}
function rollQuests(g) {
  g.questDay = Math.floor(Date.now() / 86400000);
  const kinds = [...QUEST_KINDS];
  for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
  const RANGES = { kill: [40, 80], elite: [2, 4], boss: [1, 2], levelup: [4, 8] };
  const MULT = { kill: 1, elite: 1.6, boss: 2.2, gold: 1.2, levelup: 1.3 };
  g.quests = kinds.slice(0, 3).map((k, idx) => {
    const target = k === "gold"
      ? Math.round((300 + g.everBest * 45) / 10) * 10
      : Math.floor(rand(RANGES[k][0], RANGES[k][1] + 1));
    return {
      id: "q" + g.questDay + "_" + idx,
      kind: k, target, progress: 0, done: false,
      gold: Math.round((120 + g.everBest * 22) * MULT[k]),
      renown: k === "boss" ? 4 : k === "elite" ? 3 : 2,
    };
  });
  addLog(g, "📜 The quest board is refreshed with new contracts!", "#c9a24b");
}
function questProg(g, kind, amt) {
  if (!g.quests) return;
  for (const q of g.quests) {
    if (q.done || q.kind !== kind) continue;
    q.progress += amt;
    if (q.progress >= q.target) {
      q.progress = q.target;
      q.done = true;
      g.gold += q.gold;
      g.renown += q.renown;
      addLog(g, `📜 QUEST COMPLETE: ${questLabel(q)}! The guild earns ${q.gold}g and ${q.renown} renown.`, "#c9a24b");
      sfxEv(g, "quest");
      if (g.members.length) addFloat(g, g.members[0].x, g.members[0].y - 108, "QUEST COMPLETE!", "#c9a24b", true);
      if (g.session) g.session.quests = (g.session.quests || 0) + 1;
    }
  }
}

/* ---------------- fighting-style ultimates ---------------- */
const ULT_CD = { paladin: 26, warrior: 24, archer: 25, rogue: 22, chain: 24, mystic: 26 };
function castUlt(g, m, foes, alive) {
  /* Re-filter: a teammate earlier in this same tick may already have felled
     the foe this list was built from, and binding foes[0] blind spent a
     26-second Judgment on a corpse for zero damage. */
  foes = foes.filter((e) => e.hp > 0);
  if (!foes.length && m.style !== "mystic") return false;
  const st = m._st;
  const big = (txt, col) => addFloat(g, m.x, m.y - 92, txt, col, true);
  if (m.style === "paladin") {
    const tgt = foes[0];
    m.ultT = 0.7;
    m.ultTgt = { x: tgt.x, y: tgt.y };
    big("JUDGMENT!", "#f2c14e");
    addLog(g, `${m.name} calls down JUDGMENT!`, "#f2c14e");
    sfxEv(g, "ult"); shakeFx(g, 5);
    burst(g, tgt.x, tgt.y - 20 * (tgt.scale || 1), "#f7e28b", 22, 2.4);
    sparkle(g, tgt.x, tgt.y, "#fff1c9", 10);
    hitEnemy(g, m, tgt, st.dmg * 3, true);
    if (tgt.hp > 0) tgt.stunT = Math.max(tgt.stunT, 1.5);
  } else if (m.style === "warrior") {
    m.ultT = 0.55;
    big("WHIRLWIND!", "#e77463");
    addLog(g, `${m.name} becomes a WHIRLWIND of steel!`, "#e77463");
    sfxEv(g, "ult"); shakeFx(g, 6);
    for (const e of [...foes]) if (e.hp > 0) hitEnemy(g, m, e, st.dmg * 1.8 * rand(0.9, 1.1), Math.random() * 100 < st.crit);
  } else if (m.style === "archer") {
    m.ultT = 0.4;
    big("ARROW STORM!", "#7fd069");
    addLog(g, `${m.name} looses an ARROW STORM!`, "#7fd069");
    sfxEv(g, "ult");
    const tint = WEAPON_SKINS.find((w) => w.id === m.cos.weapon).c;
    for (let k = 0; k < 6; k++) {
      const tgt = pick(foes);
      g.projectiles.push({ kind: "arrow", x: tgt.x + rand(-34, 34), y: -12 - k * 16, tgtKind: "enemy", tgtId: tgt.id, spd: 520, dmg: st.dmg * 0.9 * rand(0.85, 1.15), crit: Math.random() * 100 < st.crit, srcId: m.id, tint });
    }
  } else if (m.style === "rogue") {
    const tgt = foes[0];
    m.ultT = 0.5;
    m.ultTgt = { x: tgt.x, y: tgt.y - 26 * (tgt.scale || 1) };
    big("SHADOW FLURRY!", "#b07fe0");
    addLog(g, `${m.name} vanishes into a SHADOW FLURRY!`, "#b07fe0");
    sfxEv(g, "ult");
    for (let k = 0; k < 5; k++) g.pending.push({ t: 0.05 + k * 0.07, srcId: m.id, tgtId: tgt.id, dmg: st.dmg * 0.7 * rand(0.9, 1.1), crit: Math.random() * 100 < st.crit + 15 });
  } else if (m.style === "chain") {
    m.ultT = 0.5;
    m.ultTgts = foes.map((e) => ({ x: e.x, y: e.y - 26 * (e.scale || 1) }));
    big("DRAGGING HOOKS!", "#9aa3b5");
    addLog(g, `${m.name} hurls DRAGGING HOOKS into the enemy line!`, "#9aa3b5");
    sfxEv(g, "ult"); shakeFx(g, 5);
    for (const e of [...foes]) if (e.hp > 0) {
      hitEnemy(g, m, e, st.dmg * 1.5 * rand(0.9, 1.1), false);
      if (e.hp > 0) { e.x = Math.max(300, e.x - 46); e.stunT = Math.max(e.stunT, 0.5); }
    }
  } else {
    if (!alive.some((a) => a.hp / a._st.hp < 0.95)) return false;
    m.ultT = 0.8;
    big("SANCTUARY!", "#9fe88c");
    addLog(g, `${m.name} raises a SANCTUARY of light!`, "#7fd069");
    sfxEv(g, "ult");
    for (const a of alive) if (a.alive) { applyHeal(g, m, a, st.heal * 2.5); sparkle(g, a.x, a.y - 20, "#fff1c9", 8); }
  }
  return true;
}

/* ---------------- talent keystones (Phase 5) ----------------
   Auto-cast cooldown abilities, one per completed path. Like ultimates they
   fire themselves — idle purity holds — but where an ult is a metronome, a
   keystone is an ANSWER: each one watches for the moment its path exists
   for (the Crusher windup, the bleeding line, the wounded quarry) and holds
   its fire otherwise. Returns false when the moment hasn't come, so the
   cooldown is only spent on a cast that mattered. */
function ksCooldown(m, p) { return Math.max(8, p.key.cd - (m._st.cdCut || 0)); }
function castKeystone(g, m, foes, alive) {
  const p = pathOf(m);
  if (!p || !(m.skills[p.key.id] > 0)) return false;
  foes = foes.filter((e) => e.hp > 0);
  const st = m._st;
  const big = (txt, col) => addFloat(g, m.x, m.y - 104, txt, col, true);
  const id = p.key.id;
  const hpFrac = (x) => x.hp / x._st.hp;
  if (id === "pal_wall") {
    /* the Sentinel raises the wall for the Crusher, or for a folding line */
    const crusher = foes.some((e) => e.boss && e.windup > 0 && e.nextSpec === "crusher");
    const avg = alive.reduce((a, x) => a + hpFrac(x), 0) / Math.max(1, alive.length);
    if (!crusher && avg > 0.55) return false;
    for (const a of alive) a.wallT = 6;
    big("SHIELD WALL!", "#5aa9e6");
    addLog(g, `${m.name} plants their shield — SHIELD WALL! The party stands behind it.`, "#5aa9e6");
    sfxEv(g, "ult"); shakeFx(g, 4);
    for (const a of alive) sparkle(g, a.x, a.y - 20, "#9cc9f2", 6);
  } else if (id === "pal_call" || id === "war_roar") {
    const boss = foes.some((e) => e.boss);
    const exposed = alive.some((a) => a.cls !== "tank" && hpFrac(a) < 0.6);
    if (id === "pal_call" ? !(boss || exposed) : !(boss || foes.length >= 2)) return false;
    const dur = id === "pal_call" ? 8 : 6;
    for (const e of foes) { e.tauntId = m.id; e.tauntT = dur; }
    m.callT = dur;
    if (id === "war_roar") { for (const a of alive) a.roarT = 6; }
    big(id === "pal_call" ? "CHALLENGER'S CALL!" : "BATTLE ROAR!", "#f2c14e");
    addLog(g, id === "pal_call"
      ? `${m.name} strikes shield with blade — every foe answers the CHALLENGER'S CALL!`
      : `${m.name} lets loose a BATTLE ROAR — the foes turn, and the party surges!`, "#f2c14e");
    sfxEv(g, "ult"); shakeFx(g, 4);
  } else if (id === "war_unbrk") {
    if (hpFrac(m) > 0.4) return false;
    m.unbrkT = 8;
    big("UNBREAKABLE!", "#e77463");
    addLog(g, `${m.name} plants their feet at death's door — UNBREAKABLE!`, "#e77463");
    sfxEv(g, "ult"); shakeFx(g, 5);
    sparkle(g, m.x, m.y - 24, "#f2a94e", 10);
  } else if (id === "arc_mark") {
    if (!(foes.some((e) => e.boss || e.elite) || foes.length >= 3)) return false;
    const tgt = foes.reduce((a, e) => (e.maxHp > a.maxHp ? e : a), foes[0]);
    if (!tgt) return false;
    tgt.markT = 8; tgt.markAmp = 0.15;
    big("DEATHMARK!", "#ef6461");
    addFloat(g, tgt.x, tgt.y - 66 * (tgt.scale || 1) - 18, "MARKED", "#ef6461", true);
    addLog(g, `${m.name} looses the black arrow — the ${tgt.name} is MARKED for death!`, "#ef6461");
    sfxEv(g, "ult");
  } else if (id === "arc_rain") {
    if (foes.length < 2) return false;
    big("RAIN OF BARBS!", "#7fd069");
    addLog(g, `${m.name} darkens the sky — a RAIN OF BARBS!`, "#7fd069");
    sfxEv(g, "ult");
    const tint = WEAPON_SKINS.find((w) => w.id === m.cos.weapon).c;
    for (const e of [...foes]) if (e.hp > 0) {
      g.projectiles.push({ kind: "arrow", x: e.x + rand(-24, 24), y: -10, tgtKind: "enemy", tgtId: e.id, spd: 500, dmg: st.dmg * 1.2 * rand(0.85, 1.15), crit: Math.random() * 100 < st.crit, srcId: m.id, tint });
      e.atkT = (e.atkT || 0) + 0.8;
    }
  } else if (id === "rog_assn" || id === "chn_impale") {
    const prey = foes.filter((e) => e.hp / e.maxHp < 0.3).sort((a, b) => (b.boss ? 1 : 0) - (a.boss ? 1 : 0) || b.maxHp - a.maxHp)[0];
    if (!prey) return false;
    m.lunge = 0.3;
    big(id === "rog_assn" ? "ASSASSINATE!" : "IMPALE!", "#b07fe0");
    addLog(g, id === "rog_assn"
      ? `${m.name} finds the opening — ASSASSINATE!`
      : `${m.name} drives the hook home — IMPALE!`, "#b07fe0");
    sfxEv(g, "ult"); shakeFx(g, 3);
    hitEnemy(g, m, prey, st.dmg * (id === "rog_assn" ? 4 : 3) * rand(0.9, 1.1), Math.random() * 100 < st.crit);
    if (id === "chn_impale" && prey.hp > 0) prey.stunT = Math.max(prey.stunT, 1);
  } else if (id === "rog_dance") {
    if (!(foes.length >= 2 || foes.some((e) => e.boss))) return false;
    big("BLADE DANCE!", "#b07fe0");
    addLog(g, `${m.name} becomes a BLADE DANCE — steel in every direction!`, "#b07fe0");
    sfxEv(g, "ult");
    for (let k = 0; k < 8; k++) {
      const tgt = pick(foes);
      g.pending.push({ t: 0.05 + k * 0.06, srcId: m.id, tgtId: tgt.id, dmg: st.dmg * 0.6 * rand(0.9, 1.1), crit: Math.random() * 100 < st.crit });
    }
  } else if (id === "chn_cyc") {
    if (foes.length < 2) return false;
    big("HOOK CYCLONE!", "#9aa3b5");
    addLog(g, `${m.name} whirls the chains into a HOOK CYCLONE!`, "#9aa3b5");
    sfxEv(g, "ult"); shakeFx(g, 4);
    for (const e of [...foes]) if (e.hp > 0) {
      hitEnemy(g, m, e, st.dmg * 1.3 * rand(0.9, 1.1), Math.random() * 100 < st.crit);
      if (e.hp > 0) e.x = Math.min(620, e.x + 38);
    }
  } else if (id === "mys_bloom") {
    const low = alive.filter((a) => hpFrac(a) < 0.65).length;
    const bleeding = alive.filter((a) => (a.bleedT || 0) > 0).length;
    if (!(low >= 2 || bleeding >= 2 || (alive.length === 1 && hpFrac(m) < 0.5))) return false;
    for (const a of alive) { a.hotT = 8; a.hotAmp = 0.04; }
    big("VERDANT BLOOM!", "#7fd069");
    addLog(g, `${m.name} calls life itself up through the ground — VERDANT BLOOM!`, "#7fd069");
    sfxEv(g, "ult");
    for (const a of alive) sparkle(g, a.x, a.y - 16, "#9fe88c", 8);
  } else if (id === "mys_cleanse") {
    const bleeders = alive.filter((a) => (a.bleedT || 0) > 1);
    if (!(bleeders.length >= 2 || alive.some((a) => (a.bleedT || 0) > 4))) return false;
    big("CLEANSE!", "#fff1c9");
    addLog(g, `${m.name} burns the wounds clean — CLEANSE!`, "#7fd069");
    sfxEv(g, "ult");
    for (const a of alive) if ((a.bleedT || 0) > 0) {
      a.bleedT = 0; a.bleedDps = 0;
      applyHeal(g, m, a, st.heal * 1.5);
      sparkle(g, a.x, a.y - 22, "#fff1c9", 8);
    }
  } else return false;
  m.ksCd = ksCooldown(m, p);
  return true;
}

/* ---------------- the tick ---------------- */
/* The auto-assign build script (Phase 5): random spending dies with the
   trees — a point wandering into prerequisites it can't meet would strand
   an idle player short of their keystone forever. Each style instead walks
   a deterministic order: two ranks into each fundamental (the six-point
   gate), straight down the recommended path to the keystone, the deep
   passives, then the trunk finished. Points past a full build bank. */
export function talentPlan(m) {
  const order = [];
  const trunk = SKILLS[m.cls];
  for (let r = 0; r < 2; r++) for (const s of trunk) order.push(s.id);
  const tree = TALENTS[m.style];
  if (tree) {
    const p = tree.paths.find((x) => x.id === m.path) || tree.paths.find((x) => x.rec) || tree.paths[0];
    order.push({ pick: p.id });
    for (let r = 0; r < 3; r++) for (const n of p.pre) if (r < n.ranks) order.push(n.id);
    order.push(p.key.id);
    for (let r = 0; r < 4; r++) for (const n of p.post) if (r < n.ranks) order.push(n.id);
  }
  for (let r = 2; r < MAX_RANK; r++) for (const s of trunk) order.push(s.id);
  return order;
}
function autoSpendSkills(g, m) {
  let spent = 0, last = null, guard = 200;
  while (m.sp > 0 && guard-- > 0) {
    const plan = talentPlan(m);
    const want = {};
    let step = null;
    for (const s of plan) {
      if (typeof s === "object") {
        if (!m.path && spentPts(m) >= GATE_PTS) { step = s; break; }
        continue;
      }
      want[s] = (want[s] || 0) + 1;
      if ((m.skills[s] || 0) < want[s]) { step = s; break; }
    }
    if (!step) break; /* the build is complete — further points bank */
    if (typeof step === "object") {
      m.path = step.pick;
      const p = pathOf(m);
      addLog(g, `${m.name} walks the path of the ${p.name}: ${p.blurb}.`, "#c9a24b");
      continue;
    }
    if (!canBuyTalent(m, step)) break; /* never burn points against a wall */
    m.skills[step] = (m.skills[step] || 0) + 1; m.sp--; spent++;
    last = findTalent(m, step).node;
    if (last.cd) addLog(g, `⭐ ${m.name} masters ${last.name}!`, "#f2c14e");
  }
  if (spent === 1 && last && !last.cd) addLog(g, `${m.name} instinctively hones ${last.name} (rank ${m.skills[last.id]})`, "#8b84ad");
  else if (spent > 1) addLog(g, `${m.name} instinctively spends ${spent} skill points`, "#8b84ad");
}

export function tick(g, dt) {
  g.time += dt;
  const qday = Math.floor(Date.now() / 86400000);
  if (g.questDay !== qday) rollQuests(g);
  g.healCd = Math.max(0, g.healCd - dt);
  if (g.retreatV) { g.retreatV.t -= dt; if (g.retreatV.t <= 0) { g.retreatV = null; addLog(g, "The call to retreat fades — the party fights on.", "#8b84ad"); } }
  g.buffT = Math.max(0, g.buffT - dt);
  g.bossT = Math.max(0, g.bossT - dt);
  g.prestigeT = Math.max(0, g.prestigeT - dt);
  if (g.autoSim) {
    g.simT -= dt;
    if (g.simT <= 0) {
      g.simT = rand(9, 18);
      const sims = g.users.filter((u) => !u.discord);
      if (sims.length) {
        const u = pick(sims);
        u.inVoice ? leaveVoice(g, u.key) : joinVoice(g, u.key, u.name);
      }
    }
  }
  if (g.buffT > 0 && Math.random() < dt * 8) {
    const a = g.members.filter((m) => m.alive);
    if (a.length) { const m = pick(a); sparkle(g, m.x, m.y, "#5aa9e6", 1); }
  }
  if (g.phase === "feast") {
    g.feastT -= dt;
    for (const m of g.members) {
      m._st = stats(m, g);
      m.hp = m._st.hp;
      m.bubble = 0; m.lunge = 0; m.hop = Math.max(0, m.hop - dt);
      if (!m.feast) { m.feast = { act: "dance", seed: Math.random() * 10, face: 1 }; m.tx = 210 + Math.random() * 70; }
      const dx = m.tx - m.x;
      m.walking = Math.abs(dx) > 2;
      if (m.walking) m.x += clamp(dx, -1, 1) * 90 * dt;
    }
    g.feastSfxT = (g.feastSfxT || 0) - dt;
    if (g.feastSfxT <= 0) {
      g.feastSfxT = rand(2.5, 5);
      sfxEv(g, Math.random() < 0.55 ? "clink" : "cheer");
    }
    if (g.feastT <= 0) {
      for (const m of g.members) delete m.feast;
      g.phase = "advance"; g.advanceT = 2.5;
      addLog(g, "The feast ends. The road calls once more!", "#f2c14e");
    }
    return;
  }
  formation(g);

  for (const m of g.members) {
    if (m.autoSkill && m.sp > 0) autoSpendSkills(g, m);
    m._st = stats(m, g);
    m.hp = Math.min(m.hp, m._st.hp);
    m.lunge = Math.max(0, m.lunge - dt);
    m.bubble = Math.max(0, m.bubble - dt);
    m.hop = Math.max(0, m.hop - dt);
    m.shootT = Math.max(0, m.shootT - dt);
    m.ultT = Math.max(0, (m.ultT || 0) - dt);
    if (m.alive) m.ult = Math.min(1, (m.ult || 0) + dt * (1 + ((m._st && m._st.ultHaste) || 0)) / ((ULT_CD[m.style] || 24) * (g.mutator === "storm" ? 0.7 : 1)));
    m.castT = Math.max(0, m.castT - dt);
    m.chainT = Math.max(0, m.chainT - dt);
    /* keystone clocks (Phase 5) */
    m.ksCd = Math.max(0, (m.ksCd || 0) - dt);
    m.wallT = Math.max(0, (m.wallT || 0) - dt);
    m.unbrkT = Math.max(0, (m.unbrkT || 0) - dt);
    m.callT = Math.max(0, (m.callT || 0) - dt);
    m.roarT = Math.max(0, (m.roarT || 0) - dt);
    if (m.wallT > 0 && Math.random() < dt * 5) sparkle(g, m.x, m.y - 18, "#9cc9f2", 1);
    if (m.alive && Math.random() < dt * 0.03) m.bubble = 1.6;
    /* Grit (Phase 4): a tank's wounds close even mid-battle — the sustain
       that makes a solo tank's long King sieges winnable at all, and the
       last leg of the class identity (soak, hold, endure). Talent grit
       deepens it, and Unbreakable (Phase 5) triples it while it holds. */
    if (g.phase === "combat" && m.alive && m._st.regen > 0) {
      m.hp = Math.min(m._st.hp, m.hp + m._st.hp * m._st.regen * (m.unbrkT > 0 ? 3 : 1) * dt);
    }
    /* Verdant Bloom (Phase 5): the HoT beneath which bleeds close double */
    if (m.alive && (m.hotT || 0) > 0) {
      m.hotT -= dt;
      m.hp = Math.min(m._st.hp, m.hp + m._st.hp * (m.hotAmp || 0.04) * dt);
      if ((m.bleedT || 0) > 0) m.bleedT = Math.max(0, m.bleedT - dt);
      if (Math.random() < dt * 3) sparkle(g, m.x, m.y - 16, "#9fe88c", 1);
    }
    /* Rend (Phase 4, the healer check): the bleed a King's blows leave
       behind ignores armor — only healing, potions, or time answer it. */
    if (m.alive && (m.bleedT || 0) > 0) {
      m.bleedT -= dt;
      m.hp -= (m.bleedDps || 0) * dt;
      if (Math.random() < dt * 2) sparkle(g, m.x, m.y - 20, "#c9506d", 2);
      if (m.hp <= 0) downMember(g, m);
    }
    const dx = m.tx - m.x;
    m.walking = Math.abs(dx) > 2 || g.phase === "advance";
    if (Math.abs(dx) > 2) m.x += clamp(dx, -1, 1) * 90 * dt;
  }

  if (g.phase === "advance") {
    g.scroll += dt * 85;
    g.advanceT -= dt;
    /* Lifeward: with a mender standing, the road restores the party as it
       always did; without one, wounds knit slowly and stages wear you down.
       This is the healer's out-of-combat half of the trinity's bargain.
       A camp (after a fallen King) restores everyone fully regardless. */
    const mendRate = g.camp ? 0.10 : rolesAlive(g).healer ? 0.08 : 0.025;
    for (const m of g.members) if (m.alive) m.hp = Math.min(m._st.hp, m.hp + m._st.hp * mendRate * dt);
    /* Ambush (Phase 4): the road itself is unsafe — now and then a pack
       jumps the party mid-march. A toll fight: pays kills and gold, moves
       no stage. Never at a camp; the fire keeps the dark honest. */
    if (!g.camp && g.advanceT > 0.6 && g.members.some((m) => m.alive) && Math.random() < dt * 0.045) {
      g.ambush = true;
      const n = clamp(2 + Math.floor(g.members.length / 3), 2, PACK_CAP);
      g.enemies = [];
      fieldEnemies(g, Array(n).fill("normal"));
      for (const e of g.enemies) { e.hp = e.maxHp = Math.round(e.maxHp * 0.8); e.atkT = rand(0.4, 1.0); }
      g.phase = "combat";
      shakeFx(g, 4);
      sfxEv(g, "warn");
      addLog(g, "AMBUSH! Shapes burst from the roadside dark!", "#e77463");
      return;
    }
    if (g.advanceT <= 0 && g.members.some((m) => m.alive)) spawnEncounter(g);
    return;
  }

  if (g.phase === "wipe") {
    g.wipeT -= dt;
    if (g.wipeT <= 0) {
      /* A wipe costs the road back to the last King's fallen ground (Phase 3,
         owner decision 2): up to four stages refought through re-rolled
         packs. Time is the price — clamped to the Veteran Paths start so a
         chapter's opening stages can't be lost to a stage the guild never
         had to clear. */
      g.stage = Math.max(1 + g.legacy.head * 2, Math.floor((g.stage - 1) / 5) * 5 + 1);
      for (const m of g.members) { m.alive = true; m.hp = m._st.hp * 0.6; m.bleedT = 0; }
      g.phase = "advance"; g.advanceT = 2.2; g.enemies = [];
      addLog(g, `Broken, the party falls back to the last King's fallen ground — stage ${g.stage}.`, "#8b84ad");
    }
    return;
  }

  /* combat */
  const alive = g.members.filter((m) => m.alive);
  const foes = g.enemies.filter((e) => e.hp > 0);

  if (!alive.length) {
    if (g.members.length) { g.phase = "wipe"; g.wipeT = 4; g.momentum = 0; g.projectiles = []; g.pending = []; addLog(g, "The party has been wiped out!", "#ef6461"); sfxEv(g, "wipe"); }
    else { g.phase = "advance"; g.advanceT = 2; }
    return;
  }
  if (!foes.length) {
    /* an ambush is a toll, not a stage: clearing it resumes the road */
    if (g.ambush) {
      g.ambush = false;
      g.phase = "advance"; g.advanceT = 1.8; g.enemies = [];
      g.projectiles = []; g.pending = [];
      addLog(g, "The ambushers lie broken. The road goes on.", "#8b84ad");
      return;
    }
    /* the honor guard fights in waves — no breather, no regen between them */
    if (g.wave && g.wave < g.waveMax) {
      g.wave++;
      spawnGauntletWave(g);
      return;
    }
    g.wave = 0;
    for (const m of g.members) m.bleedT = 0; // wounds close when the field is won
    /* Trinity momentum: a stage cleared with shield, blade, and mercy all
       standing stokes the guild's spoils (+8% gold and XP per stack, up to
       5). A clear without the full trinity — or any wipe — lets it gutter. */
    const roles = rolesAlive(g);
    if (roles.tank && roles.dps && roles.healer) {
      const was = g.momentum || 0;
      g.momentum = Math.min(5, was + 1);
      if (g.momentum === 5 && was < 5) addLog(g, "The trinity's momentum peaks — the guild fights as one! (+40% spoils)", "#8fe3ff");
    } else g.momentum = 0;
    if (g.stage % 20 === 0) { endChapter(g); return; }
    const kingFell = g.stage % 5 === 0;
    g.stage++; g.best = Math.max(g.best, g.stage);
    g.everBest = Math.max(g.everBest, threatOf(g));
    if (g.session) g.session.best = Math.max(g.session.best, g.stage);
    g.phase = "advance"; g.advanceT = 2.4; g.enemies = [];
    g.projectiles = []; g.pending = [];
    /* Camp (Phase 4): after a King falls, the party rests before the next
       zone — a real breather at full recovery whatever the composition,
       which is the healer-less soloist's lifeline every five stages. */
    if (kingFell) {
      g.camp = true; g.advanceT = 6;
      addLog(g, "The party makes camp on the King's fallen ground. Wounds knit; the fire crackles.", "#f2c14e");
    }
    for (const m of alive) m.hop = 0.7;
    return;
  }

  /* auto potions */
  if (g.auto.heal && g.stock.heal > 0 && g.healCd <= 0) {
    const hurt = alive.find((m) => m.hp / m._st.hp < 0.4);
    if (hurt) {
      g.stock.heal--; g.healCd = 1;
      const amt = hurt._st.hp * 0.45;
      hurt.hp = Math.min(hurt._st.hp, hurt.hp + amt);
      addFloat(g, hurt.x, hurt.y - 78, `+${fmt(amt)} 🧪`, "#7fd069");
      sfxEv(g, "potion");
    }
  }
  if (g.auto.res && g.stock.res > 0) {
    const dead = g.members.find((m) => !m.alive && g.time - m.deadT > 2.5);
    if (dead) {
      g.stock.res--; dead.alive = true; dead.hp = dead._st.hp * 0.6;
      addLog(g, `A Phoenix Draught returns ${dead.name} to the fight!`, "#f2a94e");
      sfxEv(g, "res");
      addFloat(g, dead.x, dead.y - 80, "REVIVED", "#f2a94e", true);
      burst(g, dead.x, dead.y - 24, "#f2a94e", 18, 2);
    }
  }

  /* member actions */
  for (const m of alive) {
    /* keystones fire ahead of ultimates: an answer beats a metronome */
    if ((m.ksCd || 0) <= 0 && castKeystone(g, m, foes, alive)) { m.atkT = Math.max(m.atkT, 0.3); continue; }
    /* ults auto-cast unless the player asked to call them (Phase 5): in
       manual mode the charge holds at full until the fireUlt intent latches
       ultFire, then the next combat beat looses it */
    if ((m.ult || 0) >= 1 && (m.ultMode !== "manual" || m.ultFire) && castUlt(g, m, foes, alive)) { m.ult = 0; m.ultFire = false; m.atkT = Math.max(m.atkT, 0.35); continue; }
    m.atkT -= dt;
    if (m.atkT > 0) continue;
    m.atkT = m._st.spd;
    if (m.cls === "healer") {
      const hurt = [...alive].sort((a, b) => a.hp / a._st.hp - b.hp / b._st.hp)[0];
      m.castT = 0.32;
      /* The weave: mend when someone genuinely needs it, but never ONLY
         mend — after two mends in a row, if nobody is critical (below
         45%), the third cast is a bolt. Under sustained pressure a healer
         who never attacks can never end the fight (measured: a live-scale
         solo healer at 0 King kills in 127 attempts), and their bolts now
         carry the Soothe, so weaving is also how they hold a King's fury
         down. */
      const ratio = hurt ? hurt.hp / hurt._st.hp : 1;
      if (hurt && ratio < 0.75 && !((m.weave || 0) >= 2 && ratio > 0.45)) {
        m.weave = (m.weave || 0) + 1;
        const amt = m._st.heal * rand(0.9, 1.1);
        g.projectiles.push({ kind: "heal", x: m.x + 18, y: m.y - 66, tgtKind: "member", tgtId: hurt.id, spd: 260, amt, srcId: m.id });
        continue;
      }
      const zap = foes.find((e) => e.hp > 0);
      if (!zap) continue;
      m.weave = 0;
      const rb = rollDmg(m);
      sfxEv(g, "shoot");
      g.projectiles.push({ kind: "bolt", x: m.x + 18, y: m.y - 66, tgtKind: "enemy", tgtId: zap.id, spd: 340, dmg: rb.dmg, crit: rb.crit, srcId: m.id, tint: WEAPON_SKINS.find((w) => w.id === m.cos.weapon).c });
      continue;
    }
    const tgt = foes.find((e) => e.hp > 0);
    if (!tgt) continue;
    const { dmg, crit } = rollDmg(m);
    if (m.style === "archer") {
      m.shootT = 0.25;
      sfxEv(g, "shoot");
      g.projectiles.push({ kind: "arrow", x: m.x + 16, y: m.y - 38, tgtKind: "enemy", tgtId: tgt.id, spd: 430, dmg, crit, srcId: m.id, tint: WEAPON_SKINS.find((w) => w.id === m.cos.weapon).c });
    } else if (m.style === "rogue") {
      m.lunge = 0.2; m.swing = m.swing ^ 1;
      hitEnemy(g, m, tgt, dmg * 0.55, crit);
      if (tgt.hp > 0) g.pending.push({ t: 0.13, srcId: m.id, tgtId: tgt.id, dmg: dmg * 0.55, crit: Math.random() * 100 < m._st.crit });
    } else if (m.style === "chain") {
      m.chainT = 0.34;
      m.chainTgt = { x: tgt.x, y: tgt.y - 26 * (tgt.scale || 1) };
      g.pending.push({ t: 0.17, srcId: m.id, tgtId: tgt.id, dmg, crit });
    } else {
      m.lunge = 0.25; m.swing = m.swing ^ 1;
      hitEnemy(g, m, tgt, dmg, crit);
      if (m.style === "warrior") shakeFx(g, 1.4);
    }
  }

  /* delayed strikes */
  for (let i = g.pending.length - 1; i >= 0; i--) {
    const q = g.pending[i]; q.t -= dt;
    if (q.t > 0) continue;
    g.pending.splice(i, 1);
    const src = g.members.find((mm) => mm.id === q.srcId);
    const tgt = g.enemies.find((e) => e.id === q.tgtId && e.hp > 0) || g.enemies.find((e) => e.hp > 0);
    if (src && src.alive && tgt) hitEnemy(g, src, tgt, q.dmg, q.crit);
  }

  /* projectiles */
  for (let i = g.projectiles.length - 1; i >= 0; i--) {
    const p = g.projectiles[i];
    let tgt, tx, ty;
    if (p.tgtKind === "enemy") {
      tgt = g.enemies.find((e) => e.id === p.tgtId && e.hp > 0) || g.enemies.find((e) => e.hp > 0);
      if (!tgt) { g.projectiles.splice(i, 1); continue; }
      p.tgtId = tgt.id; tx = tgt.x; ty = tgt.y - 26 * (tgt.scale || 1);
    } else {
      tgt = g.members.find((mm) => mm.id === p.tgtId && mm.alive) || alive[0];
      if (!tgt) { g.projectiles.splice(i, 1); continue; }
      p.tgtId = tgt.id; tx = tgt.x; ty = tgt.y - 34;
    }
    const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy) || 1;
    p.a = Math.atan2(dy, dx);
    if (d < 12) {
      g.projectiles.splice(i, 1);
      const src = g.members.find((mm) => mm.id === p.srcId);
      if (p.kind === "heal") {
        if (src) {
          applyHeal(g, src, tgt, p.amt);
          if (src._st && src._st.splash > 0) for (const o of alive) if (o !== tgt && o.alive) o.hp = Math.min(o._st.hp, o.hp + p.amt * src._st.splash);
        }
      } else {
        hitEnemy(g, src, tgt, p.dmg, p.crit);
      }
      continue;
    }
    const mv = p.spd * dt;
    p.x += (dx / d) * mv; p.y += (dy / d) * mv;
  }

  /* enemy actions */
  for (const e of g.enemies) {
    e.hitT = Math.max(0, (e.hitT || 0) - dt);
    e.slamT = Math.max(0, (e.slamT || 0) - dt);
    e.screechT = Math.max(0, (e.screechT || 0) - dt);
    e.tauntT = Math.max(0, (e.tauntT || 0) - dt);
    e.markT = Math.max(0, (e.markT || 0) - dt);
    if (e.hp <= 0) continue;
    e.lunge = Math.max(0, e.lunge - dt);
    if (e.elite && !e.herald && e.kind === "skeleton" && !e.raised && e.hp <= e.maxHp * 0.6) {
      e.raised = true; e.atkT += 1.2;
      const sk = makeEnemy(g, "normal");
      sk.x = e.x + 34; sk.y = clamp(e.y + 8, GROUND - 10, GROUND);
      sk.hp = sk.maxHp = Math.round(sk.maxHp * 0.8);
      g.enemies.push(sk);
      addLog(g, "The Bone Captain raises a fallen warrior from the dust!", "#8a6fe0");
      sfxEv(g, "rise");
      addFloat(g, e.x, e.y - 66 * (e.scale || 1) - 14, "RISE!", "#8a6fe0", true);
      burst(g, sk.x, sk.y - 12, "#8a6fe0", 14, 1.6);
      sparkle(g, sk.x, sk.y, "#c8d4ff", 8);
      shakeFx(g, 3);
    }
    if (e.elite && !e.herald && e.kind === "imp" && !e.enraged && e.hp <= e.maxHp * 0.5) {
      e.enraged = true;
      e.dmg *= 1.5; e.spd *= 0.65;
      addFloat(g, e.x, e.y - 66 * (e.scale || 1) - 14, "ENRAGED!", "#ff4a3a", true);
      addLog(g, "The Imp Warlord flies into a burning rage!", "#ef6461");
      sfxEv(g, "enrage");
      burst(g, e.x, e.y - 26, "#ff6a3a", 16, 2);
      shakeFx(g, 4);
    }
    if (e.boss) {
      /* The enrage clock (Phase 4, the DPS check): a King tolerates being
         fought for so long, then its fury mounts — damage climbs toward ×3
         over the following 40s. Soft on purpose: a solo tank can still
         out-mitigate the early ramp and a solo healer can out-sustain it,
         slowly; a party that dawdles is punished, not executed. */
      e.fightT = (e.fightT || 0) + dt;
      /* recomputed every tick (not latched): the healer's Soothe can wind
         the clock back down, and the fury should recede with it */
      e.rage = e.fightT > ENRAGE_AT ? Math.min(1, (e.fightT - ENRAGE_AT) / ENRAGE_RAMP) : 0;
      if (e.rage > 0) {
        if (Math.random() < dt * 2 * e.rage) sparkle(g, e.x, e.y - 30 * (e.scale || 1), "#ff4a3a", 2);
        if (!e.raged) {
          e.raged = true;
          addLog(g, `The ${e.name}'s fury mounts — end this quickly!`, "#ff4a3a");
          addFloat(g, e.x, e.y - 66 * (e.scale || 1) - 16, "FURY RISES", "#ff4a3a", true);
          sfxEv(g, "enrage");
        }
      } else e.raged = false;
      const PH = { slime: [0.66, 0.33], bat: [0.5], skeleton: [0.5], imp: [0.66, 0.33] }[e.kind] || [];
      e.phaseIdx = e.phaseIdx || 0;
      while (e.phaseIdx < PH.length && e.hp <= e.maxHp * PH[e.phaseIdx]) {
        e.phaseIdx++;
        bossPhase(g, e);
      }
      if (e.windup > 0) {
        if (e.stunT > 0) {
          e.windup = 0; e.specT = 6;
          addFloat(g, e.x, e.y - 66 * (e.scale || 1) - 16, "INTERRUPTED!", "#5aa9e6", true);
          addLog(g, `The ${e.name}'s attack is interrupted!`, "#5aa9e6");
        } else {
          e.windup -= dt;
          e.atkT = Math.max(e.atkT, 0.6);
          if (e.windup <= 0) {
            if (e.nextSpec === "crusher") bossCrusher(g, e, alive); else bossSpecial(g, e, alive);
            e.specT = rand(7, 10);
          }
        }
      } else {
        e.specT = (e.specT == null ? rand(4.5, 7) : e.specT) - dt;
        if (e.specT <= 0 && alive.length) {
          /* every other special is the CRUSHING BLOW (Phase 4, the tank
             check): a single overwhelming hit at whoever holds the King's
             attention. A tank soaks it; anyone else had better not be
             holding aggro. Interruptible like every windup. */
          e.specN = (e.specN || 0) + 1;
          e.nextSpec = e.specN % 2 === 1 ? "crusher" : "kind"; /* the tank check comes FIRST */
          e.windupMax = e.nextSpec === "crusher" ? 1.6 : { slime: 1.6, bat: 1.4, skeleton: 1.8, imp: 1.7 }[e.kind];
          e.windup = e.windupMax;
          const names = { slime: "gathers itself for a ROYAL SLAM", bat: "draws breath for a SCREECH", skeleton: "raises its blade in a GRAVE CALL", imp: "calls fire from the deep" };
          addLog(g, e.nextSpec === "crusher"
            ? `The ${e.name} heaves its whole bulk for a CRUSHING BLOW!`
            : `The ${e.name} ${names[e.kind]}!`, "#e77463");
          sfxEv(g, "warn");
        }
      }
    }

    if (e.poisonT > 0) {
      e.poisonT -= dt;
      e.hp -= e.poison * dt;
      if (e.hp <= 0) { killEnemy(g, null, e); continue; }
    }
    if (e.stunT > 0) { e.stunT -= dt; continue; }
    if (!e.boss) {
      const party = alive.filter((m) => m.alive);
      /* Cleaves are per-enemy, so a big warband would otherwise carpet the
         party non-stop. Stretch each mob's own cooldown by the size of the
         pack it stands in: the party-wide cleave rate stays roughly fixed
         however many bodies turn up. */
      const packT = 1 + 0.5 * Math.max(0, foes.length - 2);
      if (e.cleaveWind > 0) {
        e.cleaveWind -= dt;
        e.atkT = Math.max(e.atkT, 0.4);
        if (Math.random() < dt * 30) sparkle(g, e.x, e.y - 24 * (e.scale || 1), "#ffb24a", 2);
        if (e.cleaveWind <= 0) { enemyCleave(g, e, party); e.cleaveT = rand(6, 9) * packT; }
      } else {
        /* cleaves fire at any party size now (Phase 1): the telegraphed
           sweep is the sustain check, and a lone hero was never taking it —
           which was one more way solo play dodged every mechanic */
        e.cleaveT = (e.cleaveT == null ? rand(4, 7) * packT : e.cleaveT) - dt;
        if (e.cleaveT <= 0) {
          e.cleaveWind = e.elite ? 0.5 : 0.4;
          sfxEv(g, "warn");
          burst(g, e.x, e.y - 24 * (e.scale || 1), "#ffb24a", 7, 1.5);
        }
      }
    }
    e.atkT -= dt;
    if (e.atkT > 0) continue;
    e.atkT = e.spd; e.lunge = 0.22;
    /* threat targeting: tanks hold aggro; with no tank standing, foes turn
       on whoever threatens them most — the hardest hitter by stat sheet
       (damage per second, so a fast Rogue reads as the threat it is). An
       unprotected DPS eats the autos their glass-cannon build invites.
       A taunt (Phase 5) overrides everything while its caller stands. */
    const taunter = (e.tauntT || 0) > 0 ? alive.find((m) => m.id === e.tauntId && m.alive) : null;
    const tanks = alive.filter((m) => m.cls === "tank" && m.alive);
    let tgt;
    if (taunter) tgt = taunter;
    else if (tanks.length) tgt = pick(tanks);
    else {
      const standing = alive.filter((m) => m.alive);
      tgt = standing[0];
      for (const m of standing) if (m._st.dmg / m._st.spd > tgt._st.dmg / tgt._st.spd) tgt = m;
    }
    if (!tgt) continue;
    /* one incoming-damage path for autos, cleaves, and boss specials alike:
       hurtMember owns mitigation, thorns, the death rites, and returns what
       actually landed so the drinkers below know how much to drink */
    const dmg = hurtMember(g, tgt, e.dmg * (1 + 0.6 * (e.rage || 0)) * rand(0.85, 1.15), e);
    burst(g, tgt.x + 4, tgt.y - 30, "#ef6461", 4, 1.1);
    /* Rend: a King's blows — and its Herald's — leave a bleed behind */
    if ((e.boss || e.herald) && tgt.alive) {
      tgt.bleedDps = Math.max(tgt.bleedDps || 0, e.dmg * (e.boss ? 0.10 : 0.05));
      tgt.bleedT = 8;
      if (Math.random() < 0.35) addFloat(g, tgt.x, tgt.y - 86, "REND", "#c9506d");
    }
    if (((e.elite && !e.herald) || e.frenzy) && e.kind === "bat" && e.hp > 0) {
      const drain = dmg * (e.frenzy ? 0.4 : 0.6);
      e.hp = Math.min(e.maxHp, e.hp + drain);
      addFloat(g, e.x, e.y - 66 * (e.scale || 1), "+" + fmt(drain), "#c9506d");
      sparkle(g, e.x, e.y - 8, "#c9506d", 4);
      if (!e.drained) { e.drained = true; addLog(g, "The Dire Bat drinks deep of the party's blood!", "#c9506d"); }
    }
    if (e.boss) shakeFx(g, 3);
  }
}

/* ---------------- intents (all client actions) ---------------- */
export function applyIntent(g, msg) {
  if (!msg || typeof msg !== "object") return;
  const byId = (id) => g.members.find((m) => m.id === id);
  switch (msg.a) {
    case "joinVoice": {
      const name = String(msg.name || "").trim().slice(0, 16);
      if (!name) break;
      const key = String(msg.key || name);
      const u = g.users.find((x) => x.key === key);
      if (u && u.discord) break; // real Discord presence is bot-controlled only
      joinVoice(g, key, name);
      break;
    }
    case "leaveVoice": {
      const key = String(msg.key || msg.name || "");
      const u = g.users.find((x) => x.key === key);
      if (u && u.discord) break;
      leaveVoice(g, key);
      break;
    }
    case "autoSim": g.autoSim = !!msg.on; break;
    case "retreat": {
      /* only a King fight can be abandoned, and only by a majority */
      if (g.phase !== "combat" || !g.enemies.some((e) => e.boss && e.hp > 0)) break;
      const key = String(msg.voter || msg.key || "");
      const m = g.members.find((x) => x.key === key);
      if (!m) break;
      g.retreatV = g.retreatV || { keys: [], t: 0 };
      const need = Math.floor(g.members.length / 2) + 1;
      if (!g.retreatV.keys.includes(key)) {
        g.retreatV.keys.push(key);
        g.retreatV.t = 25;
        addLog(g, `${m.name} calls for retreat! (${g.retreatV.keys.length}/${need})`, "#f2c14e");
      }
      if (g.retreatV.keys.length >= need) doRetreat(g);
      break;
    }
    case "toggleAuto": if (msg.k in g.auto) g.auto[msg.k] = !g.auto[msg.k]; break;
    case "skillUp": {
      const m = byId(msg.memberId);
      if (!m) break;
      const id = String(msg.skillId || "");
      if (m.sp > 0 && canBuyTalent(m, id)) { m.skills[id] = (m.skills[id] || 0) + 1; m.sp--; }
      break;
    }
    case "choosePath": {
      const m = byId(msg.memberId);
      if (!m || m.path) break; /* the hard lock: only a respec walks it back */
      const tree = TALENTS[m.style];
      const p = tree && tree.paths.find((x) => x.id === msg.pathId);
      if (p && spentPts(m) >= GATE_PTS) {
        m.path = p.id;
        addLog(g, `${m.name} walks the path of the ${p.name}: ${p.blurb}.`, "#c9a24b");
      }
      break;
    }
    case "respecSkills": {
      const m = byId(msg.memberId);
      if (!m) break;
      const spent = spentPts(m);
      m.sp += spent; m.skills = {}; m.path = null; m.autoSkill = false;
      m._st = stats(m, g);
      addLog(g, `${m.name} meditates: ${spent} skill point${spent === 1 ? "" : "s"} reclaimed to spend freely.`, "#8fd069");
      break;
    }
    case "setAutoSkill": {
      const m = byId(msg.memberId);
      if (m) m.autoSkill = !!msg.on;
      break;
    }
    case "setUltMode": {
      const m = byId(msg.memberId);
      if (m) { m.ultMode = msg.mode === "manual" ? "manual" : "auto"; m.ultFire = false; }
      break;
    }
    case "fireUlt": {
      /* "on my mark": latches the held charge; the next combat beat looses
         it. Latching outside combat is fine — it fires when battle joins. */
      const m = byId(msg.memberId);
      if (m && m.ultMode === "manual" && (m.ult || 0) >= 1) m.ultFire = true;
      break;
    }
    case "setClass": {
      const m = byId(msg.memberId);
      if (m && CLASSES[msg.cls] && m.cls !== msg.cls) {
        m.cls = msg.cls; m.skills = {}; m.path = null; m.sp = m.level - 1;
        m.style = pick(STYLES[msg.cls]).id;
        m._st = stats(m, g); m.hp = m._st.hp;
        addLog(g, `${m.name} respecs into ${CLASSES[msg.cls].name}!`, CLASSES[msg.cls].color);
      }
      break;
    }
    case "setStyle": {
      const m = byId(msg.memberId);
      if (!m) break;
      const s = STYLES[m.cls].find((x) => x.id === msg.styleId);
      if (s && m.style !== s.id) {
        /* trees are per style: path points come home, the trunk stays */
        let refund = 0;
        const tree = TALENTS[m.style];
        if (tree) for (const p of tree.paths) for (const n of [...p.pre, { ...p.key, ranks: 1 }, ...p.post]) {
          if (m.skills[n.id]) { refund += m.skills[n.id]; delete m.skills[n.id]; }
        }
        m.sp += refund; m.path = null;
        m.style = s.id;
        m._st = stats(m, g); m.hp = Math.min(m.hp, m._st.hp);
        addLog(g, `${m.name} takes up the ways of the ${s.name}!${refund ? ` (${refund} path point${refund === 1 ? "" : "s"} returned)` : ""}`, CLASSES[m.cls].color);
      }
      break;
    }
    case "setBody": {
      const m = byId(msg.memberId);
      if (m && BODIES.find((b) => b.id === msg.body)) m.cos.body = msg.body;
      break;
    }
    case "appearance": {
      const m = byId(msg.memberId);
      if (m) applyAppearance(g, m, msg);
      break;
    }
    case "cosmetic": {
      const m = byId(msg.memberId);
      const list = COSMETIC_LISTS[msg.kind];
      if (!m || !list) break;
      const item = list.find((it) => it.id === msg.key) || (typeof msg.key === "number" ? list[msg.key] : null);
      if (!item) break;
      const key = item.id !== undefined ? item.id : list.indexOf(item);
      if (m.owned[msg.kind].includes(key)) {
        m.cos[msg.kind] = key;
      } else if (g.gold >= item.price) {
        g.gold -= item.price;
        m.owned[msg.kind].push(key);
        m.cos[msg.kind] = key;
        addLog(g, `${m.name} bought the ${item.name} style for ${item.price}g. Looking sharp!`, "#f2c14e");
      }
      break;
    }
    case "retell": {
      const m = byId(msg.memberId);
      if (!m || m.level < 21 || g.phase === "feast") break;
      const mu = mutatorOf(g);
      const earn = Math.round(renownEarn(m.level) * (mu ? mu.renownMult : 1));
      g.renown += earn;
      m.retellings = (m.retellings || 0) + 1;
      if (g.session) g.session.retellings = (g.session.retellings || 0) + 1;
      resetChar(g, m);
      sfxEv(g, "prestige");
      addLog(g, `${m.name} retells their tale! The guild gains ${earn} renown, and a hero is born anew.`, "#b07fe0");
      break;
    }
    case "legacyUp": {
      const u = LEGACY.find((x) => x.id === msg.id);
      if (!u) break;
      const r = g.legacy[u.id], cost = legacyCost(r);
      if (r < u.max && g.renown >= cost) {
        g.renown -= cost; g.legacy[u.id]++;
        addLog(g, `Guild upgrade: ${u.name} rank ${g.legacy[u.id]}!`, "#b07fe0");
      }
      break;
    }
  }
}

/* ---------------- snapshot for the wire ---------------- */
export function snapshot(g, events) {
  return {
    type: "state",
    now: g.time,
    stage: g.stage, best: g.best, everBest: g.everBest, threat: threatOf(g), momentum: g.momentum || 0,
    retreat: g.retreatV ? { n: g.retreatV.keys.length, need: Math.floor(g.members.length / 2) + 1 } : null,
    gold: g.gold, renown: g.renown, prestiges: g.prestiges,
    legacy: g.legacy, stock: g.stock, auto: g.auto,
    phase: g.phase, scroll: g.scroll, advanceT: g.advanceT, mutator: g.mutator,
    hall: (g.hall || []).slice(-25),
    bossT: g.bossT, prestigeT: g.prestigeT, buffT: g.buffT,
    autoSim: g.autoSim,
    feastT: g.feastT || 0,
    session: g.session,
    quests: g.quests,
    questDay: g.questDay,
    users: g.users,
    members: g.members,
    enemies: g.enemies,
    projectiles: g.projectiles,
    log: g.log,
    events: events || [],
  };
}

