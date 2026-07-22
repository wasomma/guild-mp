import React, { useRef, useState, useEffect } from "react";

/* =====================================================================
   GUILD OF THE OPEN MIC : a voice-channel idle dungeon crawler
   Prototype with a simulated Discord layer. Game logic is isolated so a
   real bot (discord.js voiceStateUpdate) can drive joinVoice/leaveVoice.
   ===================================================================== */

const P = 3;                 // pixel size
const W = 640, H = 300;      // internal canvas resolution
const GROUND = 244;

const CLASSES = {
  tank:   { name: "Tank",   color: "#5aa9e6", icon: "🛡️", base: { hp: 130, hpL: 26, dmg: 6,  dmgL: 1.6, spd: 1.5,  armor: 4, crit: 5 } },
  dps:    { name: "DPS",    color: "#ef6461", icon: "⚔️", base: { hp: 72,  hpL: 12, dmg: 14, dmgL: 3.4, spd: 0.85, armor: 0, crit: 15 } },
  healer: { name: "Healer", color: "#7fd069", icon: "💚", base: { hp: 88,  hpL: 15, dmg: 5,  dmgL: 1.2, spd: 1.25, armor: 1, crit: 5, heal: 15, healL: 3 } },
};
const CLASS_ORDER = ["tank", "dps", "healer"];

const STYLES = {
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
const styleOf = (m) => STYLES[m.cls].find((s) => s.id === m.style) || STYLES[m.cls][0];

const SKILLS = {
  tank: [
    { id: "fort",  name: "Fortitude",     desc: "+8% max HP per rank" },
    { id: "bulw",  name: "Bulwark",       desc: "+4% damage reduction per rank" },
    { id: "bash",  name: "Shield Bash",   desc: "+6% stun chance on hit per rank" },
  ],
  dps: [
    { id: "leth",  name: "Lethality",     desc: "+8% damage per rank" },
    { id: "swft",  name: "Swiftness",     desc: "+6% attack speed per rank" },
    { id: "prec",  name: "Precision",     desc: "+5% crit chance per rank" },
  ],
  healer: [
    { id: "mend",  name: "Mending",       desc: "+10% healing per rank" },
    { id: "radi",  name: "Radiance",      desc: "Heals splash 15% to the party per rank" },
    { id: "bles",  name: "Blessing",      desc: "+4% party max HP aura per rank" },
  ],
};
const MAX_RANK = 5;

const HATS = [
  { id: "none",   name: "Bare Head",   price: 0 },
  { id: "hood",   name: "Rogue Hood",  price: 200 },
  { id: "helm",   name: "Knight Helm", price: 350 },
  { id: "wizard", name: "Wizard Hat",  price: 450 },
  { id: "horns",  name: "Demon Horns", price: 700 },
  { id: "crown",  name: "Royal Crown", price: 1200 },
  { id: "halo",   name: "Saint Halo",  price: 1600 },
  { id: "ribbon",  name: "Silk Ribbon",  price: 180 },
  { id: "flower",  name: "Flower Crown", price: 260 },
  { id: "witch",   name: "Witch Hat",    price: 480 },
  { id: "catears", name: "Cat Ears",     price: 550 },
  { id: "circlet", name: "Gold Circlet", price: 650 },
];
const BODIES = [
  { id: "m", name: "Male" },
  { id: "f", name: "Female" },
];
const HAIRSTYLES = [
  { id: "short", name: "Short Crop",   price: 0 },
  { id: "pixie", name: "Pixie Cut",    price: 60 },
  { id: "bob",   name: "Sleek Bob",    price: 90 },
  { id: "pony",  name: "Ponytail",     price: 120 },
  { id: "long",  name: "Long Flow",    price: 150 },
  { id: "bun",   name: "War Bun",      price: 180 },
  { id: "twin",  name: "Twintails",    price: 220 },
  { id: "braid", name: "Battle Braid", price: 260 },
  { id: "kitsune", name: "Kitsune Crown", price: 320 },
];
const ACCESSORIES = [
  { id: "none",     name: "None",          price: 0 },
  { id: "freckles", name: "Freckles",      price: 60 },
  { id: "warpaint", name: "Warpaint",      price: 120 },
  { id: "earrings", name: "Gold Earrings", price: 140 },
  { id: "scarf",    name: "Silk Scarf",    price: 200 },
  { id: "pendant",  name: "Ruby Pendant",  price: 220 },
  { id: "foxmarks", name: "Fox Markings",  price: 180 },
];
const CAPES = [
  { id: "none",     name: "No Cape",        price: 0 },
  { id: "traveler", name: "Traveler Cloak", price: 300,  c: "#4d5a8a", lining: "#33304f" },
  { id: "crimson",  name: "Crimson Cape",   price: 450,  c: "#93384a", lining: "#5e2430" },
  { id: "forest",   name: "Forest Cloak",   price: 450,  c: "#3f6d4a", lining: "#2a4a33" },
  { id: "shadow",   name: "Shadow Cloak",   price: 700,  c: "#26232b", lining: "#141221" },
  { id: "royal",    name: "Royal Cape",     price: 950,  c: "#6a4a9e", trim: "#f2c14e", lining: "#4e3675" },
  { id: "gilded",   name: "Gilded Cape",    price: 1400, c: "#f2c14e", trim: "#fff1c9", lining: "#c78a3b" },
  { id: "ninetails", name: "Nine-Tails",    price: 1600, c: "#5cc94a", tip: "#e05aa8", lining: "#3a7a35" },
];
const PETS = [
  { id: "none",     name: "No Pet",       price: 0 },
  { id: "wisp",     name: "Glimmer Wisp", price: 600 },
  { id: "slimelet", name: "Slimelet",     price: 750 },
  { id: "cat",      name: "Alley Cat",    price: 900 },
  { id: "pup",      name: "Loyal Pup",    price: 900 },
  { id: "owl",      name: "Moon Owl",     price: 1200 },
  { id: "drake",    name: "Drakeling",    price: 2000 },
];
const AURAS = [
  { id: "none",    name: "No Aura",      price: 0 },
  { id: "ember",   name: "Ember Aura",   price: 1800, c: "#ff8a4a" },
  { id: "frost",   name: "Frost Aura",   price: 1800, c: "#8fe3ff" },
  { id: "verdant", name: "Verdant Aura", price: 1800, c: "#8fd069" },
  { id: "arcane",  name: "Arcane Aura",  price: 2600, c: "#b07fe0" },
  { id: "golden",  name: "Golden Aura",  price: 4000, c: "#f2c14e" },
  { id: "starfire", name: "Starfire Aura", price: 4200, c: "#f2c14e" },
];
const HAIRS = [
  { name: "Chestnut", c: "#6b4a32", price: 0 },
  { name: "Raven",    c: "#26232b", price: 60 },
  { name: "Gold",     c: "#e8c15a", price: 60 },
  { name: "Ember",    c: "#c94f3d", price: 90 },
  { name: "Arcane",   c: "#8a6fe0", price: 150 },
  { name: "Seafoam",  c: "#69d2c8", price: 150 },
  { name: "Rose",     c: "#e77fb3", price: 150 },
  { name: "Lime",     c: "#a6e34d", price: 150 },
  { name: "Foxfire",  c: "#5cc94a", c2: "#e05aa8", price: 260 },
];
const OUTFITS = [
  { name: "Traveler",  c: "#4d5a8a", price: 0 },
  { name: "Forest",    c: "#3f6d4a", price: 80,  trim: "#8fd069" },
  { name: "Crimson",   c: "#93384a", price: 120, trim: "#f2c14e" },
  { name: "Midnight",  c: "#33304f", price: 120, trim: "#8d87a3" },
  { name: "Royal",     c: "#6a4a9e", price: 220, trim: "#f2c14e", sash: "#f2c14e" },
  { name: "Sunburst",  c: "#c78a3b", price: 220, trim: "#fff1c9", sash: "#93384a" },
  { name: "Ivory",     c: "#c9c3b8", price: 300, trim: "#f2c14e", sash: "#5aa9e6" },
  { name: "Lavender",  c: "#9a86c9", price: 160, trim: "#efeaff" },
  { name: "Blush",     c: "#d98aa3", price: 160, trim: "#fff1c9" },
  { name: "Mint",      c: "#8fd0b0", price: 160, trim: "#efeaff" },
  { name: "Wine",      c: "#7a2f45", price: 200, trim: "#f2c14e", sash: "#33304f" },
];
const WEAPON_SKINS = [
  { id: "steel",    name: "Steel",    c: "#cfd6e0", cD: "#7f8aa0", cL: "#eef2f8", edge: "#ffffff", price: 0 },
  { id: "gold",     name: "Gilded",   c: "#f2c14e", cD: "#a06b24", cL: "#ffe08a", edge: "#fff6d8", price: 280 },
  { id: "obsidian", name: "Obsidian", c: "#5b4d7d", cD: "#2e2742", cL: "#8a77b8", edge: "#cdbcff", price: 420 },
  { id: "blood",    name: "Bloodrot", c: "#d0455a", cD: "#6e1f30", cL: "#f27d8d", edge: "#ffb3bd", price: 520 },
  { id: "crystal",  name: "Crystal",  c: "#8fe3ff", cD: "#4a9cc9", cL: "#d1f4ff", edge: "#ffffff", price: 680 },
];

const RARITIES = [
  { id: "common",    name: "Common",    color: "#b6b3c7", mult: 1.0, w: 54, pre: ["Worn", "Plain", "Simple"] },
  { id: "uncommon",  name: "Uncommon",  color: "#7fd069", mult: 1.35, w: 26, pre: ["Sturdy", "Keen", "Trusty"] },
  { id: "rare",      name: "Rare",      color: "#5aa9e6", mult: 1.75, w: 12, pre: ["Runed", "Gleaming", "Tempered"] },
  { id: "epic",      name: "Epic",      color: "#b07fe0", mult: 2.35, w: 6,  pre: ["Sorcerous", "Dread", "Storming"] },
  { id: "legendary", name: "Legendary", color: "#f2a94e", mult: 3.2, w: 2,  pre: ["Mythic", "Ancient", "Sunforged"] },
];
const SLOT_NOUNS = {
  weapon:  ["Blade", "Edge", "Fang", "Scepter", "Cleaver"],
  armor:   ["Plate", "Guard", "Mail", "Vestment", "Aegis"],
  trinket: ["Charm", "Ring", "Idol", "Talisman", "Locket"],
};
const SLOTS = ["weapon", "armor", "trinket"];

const POTIONS = {
  heal:   { name: "Healing Potion",  icon: "🧪", price: 30,  desc: "Auto sips when an ally drops below 40% HP. Restores 45%." },
  armor:  { name: "Armor Elixir",    icon: "🛡️", price: 45,  desc: "Auto used at the start of combat. Party gains armor for 12s." },
  poison: { name: "Poison Vial",     icon: "☠️", price: 40,  desc: "Auto thrown at the start of combat. Poisons all enemies for 8s." },
  res:    { name: "Phoenix Draught", icon: "🔥", price: 140, desc: "Auto revives a fallen ally at 60% HP after a few seconds." },
};

const LEGACY = [
  { id: "hymn",     name: "Battle Hymns",      desc: "+10% damage and healing per rank", max: 5 },
  { id: "banner",   name: "Stalwart Banners",  desc: "+10% party max HP per rank", max: 5 },
  { id: "merchant", name: "Merchant Contacts", desc: "+15% gold earned per rank", max: 5 },
  { id: "scholar",  name: "Scholars' Guild",   desc: "+15% XP earned per rank", max: 5 },
  { id: "head",     name: "Veteran Paths",     desc: "New campaigns begin 2 stages further per rank", max: 3 },
  { id: "stipend",  name: "Alchemist Stipend", desc: "Campaigns start with +2 of every potion per rank", max: 3 },
];
const legacyCost = (rank) => (rank + 1) * 2;

/* Chapter mutators: every chapter after the first is told under one of
   these, twisting the rules and paying bonus renown at the retelling. */
const MUTATORS = [
  { id: "iron", name: "Chapter of the Iron Kings", desc: "Bosses and elites +50% HP · renown ×1.5", c: "#9aa3b5", renownMult: 1.5 },
  { id: "gilded", name: "Chapter of the Gilded Road", desc: "+40% gold · foes hit 15% harder · renown ×1.25", c: "#f2c14e", renownMult: 1.25 },
  { id: "moon", name: "Chapter of the Racing Moon", desc: "All attacks 20% faster, foes too · renown ×1.25", c: "#8fe3ff", renownMult: 1.25 },
  { id: "horde", name: "Chapter of the Endless Horde", desc: "+1 foe per pack, each 20% frailer · renown ×1.25", c: "#7fd069", renownMult: 1.25 },
  { id: "glass", name: "Chapter of Glass", desc: "All damage +35%, all HP -25% · renown ×1.5", c: "#e77fb3", renownMult: 1.5 },
  { id: "storm", name: "Chapter of the Storm Chorus", desc: "Ultimates charge 30% faster · renown ×1.25", c: "#b07fe0", renownMult: 1.25 },
];
const mutatorOf = (g) => MUTATORS.find((mu) => mu.id === g.mutator) || null;
const renownEarn = (stage) => Math.max(0, Math.floor(Math.pow(Math.max(0, stage - 1), 1.12) / 3));

const ZONES = [
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
const zoneOf = (g) => ZONES[Math.floor((g.stage - 1) / 5) % ZONES.length];

const SKIN = "#e8b98a", SKIN_D = "#c99465";
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = (n) => (n >= 10000 ? (n / 1000).toFixed(1) + "k" : Math.round(n).toLocaleString());

let UID = 1;

/* ---------------- game state ---------------- */
function newGame() {
  return {
    members: [], enemies: [], floaters: [], log: [],
    stage: 1, best: 1, gold: 150, joinCount: 0,
    renown: 0, prestiges: 0, everBest: 1, prestigeT: 0,
    legacy: { hymn: 0, banner: 0, merchant: 0, scholar: 0, head: 0, stipend: 0 },
    phase: "advance", advanceT: 1.6, wipeT: 0, scroll: 0,
    particles: [], projectiles: [], pending: [], shake: 0, bossT: 0,
    stock: { heal: 3, armor: 1, poison: 1, res: 1 },
    auto: { heal: true, armor: true, poison: true, res: true },
    healCd: 0, buffT: 0, simT: 8, time: 0, mutator: null,
    hall: [], chapter: { kills: 0, gold: 0, uniques: [] },
    quests: [], questDay: 0,
    users: [
      { name: "Pixel_Pete",    color: "#e8743b", inVoice: false },
      { name: "LunaMoth",      color: "#8a6fe0", inVoice: false },
      { name: "Sir_Buckets",   color: "#5aa9e6", inVoice: false },
      { name: "TeaWitch",      color: "#7fd069", inVoice: false },
      { name: "CtrlAltDefeat", color: "#e77fb3", inVoice: false },
    ],
  };
}

function addLog(g, text, color) {
  g.log.unshift({ text, color: color || "#cfc9e8", t: Date.now() });
  if (g.log.length > 40) g.log.pop();
}

function makeMember(name, cls) {
  const defaults = { tank: 3, dps: 2, healer: 1 };
  const fem = Math.random() < 0.5;
  const startHair = fem ? pick(["pony", "long", "bob"]) : pick(["short", "short", "pixie"]);
  const m = {
    id: UID++, name, cls, level: 1, xp: 0, sp: 0,
    style: pick(STYLES[cls]).id, swing: 0, shootT: 0, castT: 0, chainT: 0, chainTgt: null,
    skills: {}, autoSkill: true, retellings: 0, gear: { weapon: null, armor: null, trinket: null },
    cos: { body: fem ? "f" : "m", hat: "none", hair: Math.floor(Math.random() * 4) % 4, hairstyle: startHair, outfit: defaults[cls], weapon: "steel", accessory: "none", cape: "none", pet: "none", aura: "none" },
    owned: { hat: ["none"], hair: [0, 1, 2, 3], hairstyle: Array.from(new Set(["short", startHair])), outfit: [0, defaults[cls]], weapon: ["steel"], accessory: ["none"], cape: ["none"], pet: ["none"], aura: ["none"] },
    hp: 1, alive: true, atkT: rand(0.3, 1.2), lunge: 0, deadT: 0, hop: 0,
    ult: 0, ultT: 0,
    x: -40, y: 0, walking: true, kills: 0, dmgDone: 0, healDone: 0, bubble: 0, seed: Math.random() * 10,
  };
  m._st = stats(m, null); m.hp = m._st.hp;
  return m;
}

function stats(m, g) {
  const b = CLASSES[m.cls].base, L = m.level - 1, sk = m.skills;
  let hp = b.hp + b.hpL * L, dmg = b.dmg + b.dmgL * L, spd = b.spd;
  let armor = b.armor, crit = b.crit, heal = (b.heal || 0) + (b.healL || 0) * L;
  let dr = 0, stun = 0, splash = 0, ls = 0, thorns = 0, critDmg = 0, goldF = 0, chorus = 0;
  const sm = styleOf(m);
  dmg *= sm.dmgMul; spd *= sm.spdMul; crit += sm.critAdd; armor += sm.armorAdd || 0;
  if (m.cls === "tank") { hp *= 1 + 0.08 * (sk.fort || 0); dr = 0.04 * (sk.bulw || 0); stun = 0.06 * (sk.bash || 0); }
  if (m.cls === "dps") { dmg *= 1 + 0.08 * (sk.leth || 0); spd /= 1 + 0.06 * (sk.swft || 0); crit += 5 * (sk.prec || 0); }
  if (m.cls === "healer") { heal *= 1 + 0.1 * (sk.mend || 0); splash = 0.15 * (sk.radi || 0); }
  for (const s of SLOTS) {
    const it = m.gear[s]; if (!it) continue;
    if (s === "weapon") { dmg += it.power; heal += it.power * 0.8; }
    if (s === "armor") { hp += it.power * 4; armor += it.power * 0.25; }
    if (s === "trinket") { dmg += it.power * 0.5; crit += it.power * 0.35; hp += it.power * 2; }
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
    chorus = Math.min(Math.max(0, g.members.length - 1), 9);
    if (chorus > 0) {
      dmg *= 1 + 0.04 * chorus;
      heal *= 1 + 0.04 * chorus;
      hp *= 1 + 0.03 * chorus;
    }
  }
  return { hp: Math.round(hp), dmg, spd, armor, crit: clamp(crit, 0, 60), heal, dr, stun, splash, ls, thorns, critDmg, goldF, chorus };
}

const xpNeed = (lvl) => Math.round(26 * Math.pow(lvl, 1.35));

/* ===== chiptune audio engine (Web Audio, no dependencies) ===== */
const AUDIO = { ctx: null, master: null, sfxMuted: false, musicMuted: false, inMusic: false, musicT: 0 };
const gated = () => (AUDIO.inMusic ? AUDIO.musicMuted : AUDIO.sfxMuted);
function audioInit() {
  if (AUDIO.ctx) return true;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    AUDIO.ctx = new AC();
    AUDIO.master = AUDIO.ctx.createGain();
    AUDIO.master.gain.value = 0.5;
    const comp = AUDIO.ctx.createDynamicsCompressor();
    AUDIO.master.connect(comp); comp.connect(AUDIO.ctx.destination);
    return true;
  } catch { return false; }
}
function audioResume() { if (AUDIO.ctx && AUDIO.ctx.state === "suspended") AUDIO.ctx.resume(); }
function setSfxMuted(m) { AUDIO.sfxMuted = m; }
function setMusicMuted(m) { AUDIO.musicMuted = m; }
function tone(freq, dur, type, vol, slide, delay) {
  if (!AUDIO.ctx || gated()) return;
  const t0 = AUDIO.ctx.currentTime + (delay || 0);
  const o = AUDIO.ctx.createOscillator();
  const gn = AUDIO.ctx.createGain();
  o.type = type || "square";
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t0 + dur);
  gn.gain.setValueAtTime(0, t0);
  gn.gain.linearRampToValueAtTime(vol || 0.15, t0 + 0.005);
  gn.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
  o.connect(gn); gn.connect(AUDIO.master);
  o.start(t0); o.stop(t0 + dur + 0.02);
}
function noiseHit(dur, vol, delay, hp) {
  if (!AUDIO.ctx || gated()) return;
  const t0 = AUDIO.ctx.currentTime + (delay || 0);
  const len = Math.max(1, Math.floor(AUDIO.ctx.sampleRate * dur));
  const buf = AUDIO.ctx.createBuffer(1, len, AUDIO.ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = AUDIO.ctx.createBufferSource(); src.buffer = buf;
  const f = AUDIO.ctx.createBiquadFilter(); f.type = hp ? "highpass" : "lowpass"; f.frequency.value = hp ? 2000 : 900;
  const gn = AUDIO.ctx.createGain();
  gn.gain.setValueAtTime(vol || 0.1, t0);
  gn.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
  src.connect(f); f.connect(gn); gn.connect(AUDIO.master);
  src.start(t0);
}
const sfx = {
  hit() { tone(rand(190, 230), 0.07, "square", 0.10, 120); noiseHit(0.04, 0.05, 0, true); },
  crit() { tone(340, 0.09, "square", 0.13, 180); tone(510, 0.12, "square", 0.11, 260, 0.05); },
  hurt() { tone(140, 0.09, "sawtooth", 0.06, 90); },
  kill() { tone(300, 0.16, "triangle", 0.12, 60); },
  coin() { tone(988, 0.07, "square", 0.06); tone(1319, 0.16, "square", 0.06, undefined, 0.07); },
  loot() { tone(660, 0.08, "triangle", 0.1); tone(880, 0.1, "triangle", 0.1, undefined, 0.08); tone(1100, 0.14, "triangle", 0.1, undefined, 0.16); },
  level() { [523, 659, 784, 1047].forEach((f2, i) => tone(f2, 0.12, "square", 0.1, undefined, i * 0.08)); },
  heal() { tone(700, 0.16, "sine", 0.07, 1050); },
  shoot() { noiseHit(0.08, 0.06, 0, true); tone(900, 0.05, "sine", 0.03, 500); },
  fall() { [392, 311, 233, 155].forEach((f2, i) => tone(f2, 0.15, "triangle", 0.11, undefined, i * 0.1)); },
  res() { [261, 392, 523, 784].forEach((f2, i) => tone(f2, 0.14, "triangle", 0.1, undefined, i * 0.07)); },
  boss() { tone(65, 0.9, "sawtooth", 0.15, 55); tone(98, 0.7, "sawtooth", 0.09, 82, 0.1); noiseHit(0.5, 0.05); },
  elite() { tone(110, 0.4, "sawtooth", 0.11, 90); },
  potion() { tone(500, 0.05, "sine", 0.07, 700); tone(760, 0.07, "sine", 0.06, 900, 0.06); },
  stun() { tone(600, 0.18, "square", 0.06, 300); },
  enrage() { tone(180, 0.3, "sawtooth", 0.11, 320); noiseHit(0.2, 0.05); },
  rise() { tone(220, 0.35, "sawtooth", 0.08, 110); },
  split() { tone(420, 0.1, "sine", 0.08, 240); tone(360, 0.1, "sine", 0.08, 200, 0.07); },
  prestige() { [523, 659, 784, 659, 784, 1047].forEach((f2, i) => tone(f2, 0.16, "square", 0.1, undefined, i * 0.11)); },
  wipe() { tone(200, 0.6, "sawtooth", 0.09, 60); },
  clink() { tone(1250, 0.09, "triangle", 0.07); tone(1180, 0.12, "triangle", 0.06, undefined, 0.015); noiseHit(0.03, 0.03, 0, true); },
  cheer() { [262, 330, 392, 523].forEach((f2) => tone(f2, 0.22, "square", 0.045)); noiseHit(0.18, 0.05, 0, true); tone(392, 0.3, "triangle", 0.05, 300, 0.05); },
  warn() { tone(440, 0.09, "square", 0.08, 660); tone(660, 0.12, "square", 0.08, 990, 0.1); },
  slam() { tone(70, 0.35, "sawtooth", 0.16, 40); noiseHit(0.3, 0.12); },
  screech() { tone(1600, 0.45, "sawtooth", 0.07, 500); tone(1900, 0.3, "square", 0.04, 700, 0.05); },
  meteor() { noiseHit(0.4, 0.09); tone(900, 0.35, "sine", 0.06, 120); tone(700, 0.3, "sine", 0.05, 90, 0.12); },
  ult() { tone(392, 0.1, "square", 0.1, 784); tone(784, 0.2, "square", 0.09, undefined, 0.09); noiseHit(0.08, 0.04, 0, true); },
  unique() { [784, 988, 1319, 1568].forEach((f2, i) => tone(f2, 0.12, "triangle", 0.09, undefined, i * 0.06)); tone(392, 0.5, "sine", 0.05, undefined, 0.12); },
  chorus() { tone(523, 0.28, "triangle", 0.06); tone(659, 0.28, "triangle", 0.06, undefined, 0.03); tone(784, 0.34, "triangle", 0.05, undefined, 0.07); },
  quest() { tone(659, 0.12, "square", 0.07); tone(784, 0.12, "square", 0.07, undefined, 0.1); tone(1047, 0.28, "square", 0.08, undefined, 0.2); },
};
/* a sparse generative music box, tuned per zone, silent when the world sleeps */
const ZONE_SCALES = [
  [392, 440, 494, 587, 659, 784],
  [330, 392, 440, 494, 587, 659],
  [294, 349, 392, 440, 523, 587],
  [262, 311, 349, 392, 466, 523],
];
function musicTick(g, dt) {
  if (!AUDIO.ctx || AUDIO.musicMuted) return;
  AUDIO.inMusic = true;
  try { musicStep(g, dt); } finally { AUDIO.inMusic = false; }
}
function musicStep(g, dt) {
  if (!g.members || !g.members.length) return;
  AUDIO.musicT -= dt;
  if (AUDIO.musicT > 0) return;
  if (g.phase === "feast") {
    /* a bouncy mead-hall jig */
    AUDIO.musicT = 0.21;
    AUDIO.step = (AUDIO.step || 0) + 1;
    const TUNE = [392, 494, 587, 494, 659, 587, 494, 440, 392, 494, 587, 659, 784, 659, 587, 494];
    const n = TUNE[AUDIO.step % TUNE.length];
    tone(n, 0.18, "square", 0.05);
    if (AUDIO.step % 4 === 0) tone(n / 2, 0.34, "triangle", 0.05);
    if (AUDIO.step % 8 === 6) tone(n * 1.5, 0.12, "square", 0.03);
    return;
  }
  AUDIO.musicT = 0.42;
  if (Math.random() < 0.45) return;
  const scale = ZONE_SCALES[Math.floor((g.stage - 1) / 5) % ZONE_SCALES.length];
  const n = scale[Math.floor(Math.random() * scale.length)];
  tone(n * (Math.random() < 0.25 ? 2 : 1), 0.5, "triangle", 0.026);
  if (Math.random() < 0.18) tone(n / 2, 0.9, "sine", 0.018);
}

function gainXp(g, m, amt) {
  m.xp += amt;
  while (m.xp >= xpNeed(m.level)) {
    m.xp -= xpNeed(m.level);
    m.level++; m.sp++;
    const s = stats(m, g);
    m.hp = Math.min(s.hp, m.hp + s.hp * 0.3);
    addLog(g, `${m.name} reached level ${m.level}! (+1 skill point)`, "#f2c14e");
    addFloat(g, m.x, m.y - 80, "LEVEL UP!", "#f2c14e");
    sfx.level();
    if (g.session) { g.session.levelUps++; if (!g.session.topLevel || m.level > g.session.topLevel.level) g.session.topLevel = { name: m.name, level: m.level }; }
    questProg(g, "levelup", 1);
    burst(g, m.x, m.y - 26, "#f2c14e", 14, 1.8);
  }
}

function addFloat(g, x, y, text, color, big) {
  g.floaters.push({ x, y, text, color, life: 1.1, big: !!big, vx: rand(-0.35, 0.35) });
}

const ENEMY_COLORS = { slime: "#6fbf5e", bat: "#5d4a7a", skeleton: "#d8d3c0", imp: "#c9503f" };

function burst(g, x, y, color, n, spd, grav) {
  if (g.particles.length > 240) return;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = rand(0.3, 1) * (spd || 1.2);
    g.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (spd || 1.2) * 0.35,
      life: rand(0.35, 0.8), color, size: rand(2, 4), grav: grav || 0 });
  }
}

function sparkle(g, x, y, color, n) {
  if (g.particles.length > 240) return;
  for (let i = 0; i < n; i++) {
    g.particles.push({ x: x + rand(-11, 11), y: y - rand(4, 32), vx: 0, vy: -rand(0.4, 0.9),
      life: rand(0.5, 0.95), color, size: 2, grav: 0 });
  }
}

/* ---------------- affixes and uniques ---------------- */
const AFFIXES = [
  { id: "ls", min: 3, max: 8 },
  { id: "thorns", min: 8, max: 22 },
  { id: "critdmg", min: 15, max: 45 },
  { id: "goldf", min: 8, max: 28 },
];
const AFFIX_DEFS = {
  ls: { name: "Vampiric", fmt: (v) => v + "% lifesteal" },
  thorns: { name: "Bristling", fmt: (v) => "reflects " + v + "% damage" },
  critdmg: { name: "Savage", fmt: (v) => "+" + v + "% crit damage" },
  goldf: { name: "Gilded", fmt: (v) => "+" + v + "% gold find" },
};
const UNIQUE_COLOR = "#59e0c8";
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
  const stage = g.stage;
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
    sfx.unique();
    if (g.session) g.session.uniques.push(item.name + " (" + m.name + ")");
    if (g.chapter) g.chapter.uniques.push(item.name);
  }
  const cur = m.gear[item.slot];
  let kept = false;
  if (!cur || item.power > cur.power) {
    m.gear[item.slot] = item;
    kept = true;
    sfx.loot();
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

function makeEnemy(g, tier) {
  const zone = zoneOf(g);
  const s = g.stage;
  const boss = tier === "boss", elite = tier === "elite";
  const hp = Math.round((28 + s * 15) * (boss ? 9 : elite ? 3.6 : 1) * rand(0.9, 1.1));
  const e = {
    id: UID++, kind: zone.enemy, boss, elite,
    scale: boss ? 1.8 : elite ? 1.35 : 1,
    name: boss ? `${zone.label} King` : elite ? zone.eliteLabel : zone.label,
    hp, maxHp: hp,
    dmg: (4 + s * 1.5) * (boss ? 1.9 : elite ? 1.4 : 1),
    spd: boss ? 2.0 : elite ? 1.8 : rand(1.5, 2.1),
    xp: Math.round((9 + s * 3.2) * (boss ? 6 : elite ? 2.5 : 1)),
    gold: Math.round((10 + s * 4) * (boss ? 8 : elite ? 3.5 : 1)),
    x: 0, y: 0, atkT: rand(0.8, 1.8), lunge: 0, stunT: 0,
    poison: 0, poisonT: 0, seed: Math.random() * 10,
  };
  if (g.mutator === "iron" && (boss || elite)) e.hp = e.maxHp = Math.round(e.hp * 1.5);
  if (g.mutator === "gilded") { e.dmg *= 1.15; e.gold = Math.round(e.gold * 1.4); }
  if (g.mutator === "moon") e.spd *= 0.8;
  if (g.mutator === "horde") e.hp = e.maxHp = Math.round(e.hp * 0.8);
  if (g.mutator === "glass") { e.dmg *= 1.35; e.hp = e.maxHp = Math.round(e.hp * 0.75); }
  return e;
}

function spawnEncounter(g) {
  g.enemies = [];
  const boss = g.stage % 5 === 0;
  const elite = !boss && g.stage % 5 === 3;
  const tiers = boss ? ["boss"] : elite ? ["elite", "normal"] : Array(2 + Math.floor(Math.random() * 3)).fill("normal");
  if (g.mutator === "horde" && !boss) tiers.push("normal");
  tiers.forEach((tier, i) => {
    const e = makeEnemy(g, tier);
    e.x = 440 + i * 56;
    e.y = GROUND - (i % 2) * 10;
    g.enemies.push(e);
  });
  g.phase = "combat";
  if (elite) {
    addLog(g, `${g.enemies[0].name} guards the road ahead!`, "#e77463");
    sfx.elite();
    g.shake = Math.max(g.shake, 3);
  }
  if (boss) {
    addLog(g, `Boss encounter! ${g.enemies[0].name} blocks the path.`, "#ef6461");
    g.bossT = 2; g.shake = Math.max(g.shake, 5);
    sfx.boss();
  }
  if (g.auto.armor && g.stock.armor > 0) {
    g.stock.armor--; g.buffT = 12;
    addLog(g, "Armor Elixir shatters. The party hardens! (+armor 12s)", "#5aa9e6");
    sfx.potion();
  }
  if (g.auto.poison && g.stock.poison > 0) {
    g.stock.poison--;
    for (const e of g.enemies) { e.poison = 2 + g.stage * 0.7; e.poisonT = 8; }
    addLog(g, "Poison Vial hisses across the enemy line.", "#7fd069");
    sfx.potion();
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

/* ---------------- tick ---------------- */



/* ---------------- guild quests: daily contracts ---------------- */
const QUEST_KINDS = ["kill", "elite", "boss", "gold", "levelup"];
function questLabel(q) {
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
      sfx.quest();
      if (g.members.length) addFloat(g, g.members[0].x, g.members[0].y - 108, "QUEST COMPLETE!", "#c9a24b", true);
      if (g.session) g.session.quests = (g.session.quests || 0) + 1;
    }
  }
}

/* ---------------- fighting-style ultimates ---------------- */
const ULT_CD = { paladin: 26, warrior: 24, archer: 25, rogue: 22, chain: 24, mystic: 26 };
function castUlt(g, m, foes, alive) {
  if (!foes.length && m.style !== "mystic") return false;
  const st = m._st;
  const big = (txt, col) => addFloat(g, m.x, m.y - 92, txt, col, true);
  if (m.style === "paladin") {
    const tgt = foes[0];
    m.ultT = 0.7;
    m.ultTgt = { x: tgt.x, y: tgt.y };
    big("JUDGMENT!", "#f2c14e");
    addLog(g, `${m.name} calls down JUDGMENT!`, "#f2c14e");
    sfx.ult(); g.shake = Math.max(g.shake, 5);
    burst(g, tgt.x, tgt.y - 20 * (tgt.scale || 1), "#f7e28b", 22, 2.4);
    sparkle(g, tgt.x, tgt.y, "#fff1c9", 10);
    hitEnemy(g, m, tgt, st.dmg * 3, true);
    if (tgt.hp > 0) tgt.stunT = Math.max(tgt.stunT, 1.5);
  } else if (m.style === "warrior") {
    m.ultT = 0.55;
    big("WHIRLWIND!", "#e77463");
    addLog(g, `${m.name} becomes a WHIRLWIND of steel!`, "#e77463");
    sfx.ult(); g.shake = Math.max(g.shake, 6);
    for (const e of [...foes]) if (e.hp > 0) hitEnemy(g, m, e, st.dmg * 1.8 * rand(0.9, 1.1), Math.random() * 100 < st.crit);
  } else if (m.style === "archer") {
    m.ultT = 0.4;
    big("ARROW STORM!", "#7fd069");
    addLog(g, `${m.name} looses an ARROW STORM!`, "#7fd069");
    sfx.ult();
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
    sfx.ult();
    for (let k = 0; k < 5; k++) g.pending.push({ t: 0.05 + k * 0.07, srcId: m.id, tgtId: tgt.id, dmg: st.dmg * 0.7 * rand(0.9, 1.1), crit: Math.random() * 100 < st.crit + 15 });
  } else if (m.style === "chain") {
    m.ultT = 0.5;
    m.ultTgts = foes.map((e) => ({ x: e.x, y: e.y - 26 * (e.scale || 1) }));
    big("DRAGGING HOOKS!", "#9aa3b5");
    addLog(g, `${m.name} hurls DRAGGING HOOKS into the enemy line!`, "#9aa3b5");
    sfx.ult(); g.shake = Math.max(g.shake, 5);
    for (const e of [...foes]) if (e.hp > 0) {
      hitEnemy(g, m, e, st.dmg * 1.5 * rand(0.9, 1.1), false);
      if (e.hp > 0) { e.x = Math.max(300, e.x - 46); e.stunT = Math.max(e.stunT, 0.5); }
    }
  } else {
    if (!alive.some((a) => a.hp / a._st.hp < 0.95)) return false;
    m.ultT = 0.8;
    big("SANCTUARY!", "#9fe88c");
    addLog(g, `${m.name} raises a SANCTUARY of light!`, "#7fd069");
    sfx.ult();
    for (const a of alive) if (a.alive) { applyHeal(g, m, a, st.heal * 2.5); sparkle(g, a.x, a.y - 20, "#fff1c9", 8); }
  }
  return true;
}

/* ---------------- boss kings: specials and phases ---------------- */
function hurtMember(g, m, rawDmg, src) {
  const armor = m._st.armor + (g.buffT > 0 ? 6 : 0);
  const dmg = Math.max(1, rawDmg - armor * 0.6) * (1 - m._st.dr);
  m.hp -= dmg;
  addFloat(g, m.x, m.y - 70, "-" + fmt(dmg), "#ef6461");
  if (src && src.hp > 0 && m._st.thorns > 0) {
    const ref = dmg * m._st.thorns;
    src.hp -= ref;
    if (Math.random() < 0.5) addFloat(g, src.x, src.y - 60 * (src.scale || 1), "-" + fmt(ref), "#e77463");
    if (src.hp <= 0) killEnemy(g, m, src);
  }
  sfx.hurt();
  if (m.hp <= 0) {
    m.alive = false; m.hp = 0; m.deadT = g.time;
    burst(g, m.x, m.y - 24, "#7a7490", 14, 1.6);
    g.shake = Math.max(g.shake, 4);
    addLog(g, `${m.name} has fallen!`, "#ef6461");
    sfx.fall();
    if (g.session) g.session.deaths++;
  }
}
function bossSpecial(g, e, alive) {
  const s = e.scale || 1;
  if (e.kind === "slime") {
    e.slamT = 0.45;
    g.shake = Math.max(g.shake, 10);
    sfx.slam();
    addLog(g, "ROYAL SLAM! The ground heaves beneath the party!", "#ef6461");
    for (const m of alive) if (m.alive) { hurtMember(g, m, e.dmg * 1.5, e); burst(g, m.x, m.y - 8, "#6fbf5e", 10, 1.8, 2); }
    burst(g, e.x, e.y - 10, "#6fbf5e", 24, 2.6, 2);
  } else if (e.kind === "bat") {
    e.screechT = 0.6;
    g.shake = Math.max(g.shake, 6);
    sfx.screech();
    addLog(g, "A deafening SCREECH staggers the party!", "#b07fe0");
    for (const m of alive) if (m.alive) { hurtMember(g, m, e.dmg * 0.9, e); m.atkT += 1.1; addFloat(g, m.x, m.y - 84, "DAZED", "#b07fe0"); }
  } else if (e.kind === "skeleton") {
    sfx.rise();
    g.shake = Math.max(g.shake, 5);
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
    sfx.meteor();
    g.shake = Math.max(g.shake, 8);
    addLog(g, "Fire rains from the deeps of Emberdeep!", "#ef6461");
    for (const m of alive) if (m.alive) {
      hurtMember(g, m, e.dmg * 1.1, e);
      burst(g, m.x, m.y - 30, "#ff6a3a", 12, 2, 1);
      sparkle(g, m.x, m.y - 10, "#f2a94e", 5);
    }
  }
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
    sfx.split();
  } else if (e.kind === "bat") {
    e.frenzy = true;
    e.spd *= 0.75;
    addLog(g, "The Bat King enters a BLOOD FRENZY!", "#c9506d");
    addFloat(g, e.x, e.y - 66 * s - 14, "BLOOD FRENZY", "#c9506d", true);
    sfx.enrage();
  } else if (e.kind === "skeleton") {
    e.shell = 8;
    addLog(g, "The Skeleton King wraps itself in BONE ARMOR!", "#d8d3c0");
    addFloat(g, e.x, e.y - 66 * s - 14, "BONE ARMOR", "#d8d3c0", true);
    sfx.rise();
  } else {
    e.enraged = true;
    e.dmg *= 1.25; e.spd *= 0.85;
    addLog(g, "The Imp King IGNITES, burning ever hotter!", "#ef6461");
    addFloat(g, e.x, e.y - 66 * s - 14, "IGNITE", "#ff4a3a", true);
    burst(g, e.x, e.y - 26, "#ff6a3a", 16, 2);
    sfx.enrage();
  }
}
// Non-boss whole-party AOE. Autos stay tank-focused; this is the healer check.
function enemyCleave(g, e, party) {
  const s = e.scale || 1;
  if (g.session) g.session.cleaves = (g.session.cleaves || 0) + 1;
  g.shake = Math.max(g.shake, e.elite ? 5 : 3);
  sfx.slam();
  const mult = e.elite ? 0.7 : 0.5;
  if (e.elite) addLog(g, `The ${e.name} sweeps the party with a brutal cleave!`, "#ef6461");
  for (const m of party) if (m.alive) {
    hurtMember(g, m, e.dmg * mult, e);
    burst(g, m.x, m.y - 24, "#ff7a3a", 8, 1.6);
  }
  burst(g, e.x, e.y - 12 * s, "#ffb24a", 16, 2.2);
}

function autoSpendSkills(g, m) {
  let spent = 0, last = null;
  while (m.sp > 0) {
    const open = SKILLS[m.cls].filter((s) => (m.skills[s.id] || 0) < MAX_RANK);
    if (!open.length) break;
    last = pick(open);
    m.skills[last.id] = (m.skills[last.id] || 0) + 1; m.sp--; spent++;
  }
  if (spent === 1) addLog(g, `${m.name} instinctively hones ${last.name} (rank ${m.skills[last.id]})`, "#8b84ad");
  else if (spent > 1) addLog(g, `${m.name} instinctively spends ${spent} skill points`, "#8b84ad");
}

function tick(g, dt) {
  g.time += dt;
  const qday = Math.floor(Date.now() / 86400000);
  if (g.questDay !== qday) rollQuests(g);
  g.healCd = Math.max(0, g.healCd - dt);
  g.buffT = Math.max(0, g.buffT - dt);
  g.shake = Math.max(0, g.shake - dt * 26);
  g.bossT = Math.max(0, g.bossT - dt);
  g.prestigeT = Math.max(0, g.prestigeT - dt);
  for (let i = g.particles.length - 1; i >= 0; i--) {
    const p = g.particles[i];
    p.life -= dt; p.x += p.vx * 60 * dt; p.y += p.vy * 60 * dt; p.vy += (p.grav || 0) * dt * 8;
    if (p.life <= 0) g.particles.splice(i, 1);
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
      Math.random() < 0.55 ? sfx.clink() : sfx.cheer();
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
    if (m.alive) m.ult = Math.min(1, (m.ult || 0) + dt / ((ULT_CD[m.style] || 24) * (g.mutator === "storm" ? 0.7 : 1)));
    m.castT = Math.max(0, m.castT - dt);
    m.chainT = Math.max(0, m.chainT - dt);
    if (m.alive && Math.random() < dt * 0.03) m.bubble = 1.6;
    if (m.alive && m.cos.aura !== "none" && Math.random() < dt * 7 && g.particles.length < 240) {
      const auraDef = AURAS.find((a) => a.id === m.cos.aura);
      if (auraDef && auraDef.c) g.particles.push({ x: m.x + rand(-9, 9), y: m.y - rand(0, 6), vx: 0, vy: -rand(0.4, 0.8), life: rand(0.5, 0.9), color: auraDef.c, size: 2, grav: 0 });
    }
    const dx = m.tx - m.x;
    m.walking = Math.abs(dx) > 2 || g.phase === "advance";
    if (Math.abs(dx) > 2) m.x += clamp(dx, -1, 1) * 90 * dt;
  }

  if (g.phase === "advance") {
    g.scroll += dt * 85;
    g.advanceT -= dt;
    for (const m of g.members) if (m.alive) m.hp = Math.min(m._st.hp, m.hp + m._st.hp * 0.08 * dt);
    if (g.advanceT <= 0 && g.members.some((m) => m.alive)) spawnEncounter(g);
    return;
  }

  if (g.phase === "wipe") {
    g.wipeT -= dt;
    if (g.wipeT <= 0) {
      g.stage = Math.max(1, g.stage - 1);
      for (const m of g.members) { m.alive = true; m.hp = m._st.hp * 0.6; }
      g.phase = "advance"; g.advanceT = 2.2; g.enemies = [];
      addLog(g, `The party regroups and retreats to stage ${g.stage}.`, "#8b84ad");
    }
    return;
  }

  /* combat */
  const alive = g.members.filter((m) => m.alive);
  const foes = g.enemies.filter((e) => e.hp > 0);

  if (!alive.length) {
    if (g.members.length) { g.phase = "wipe"; g.wipeT = 4; g.projectiles = []; g.pending = []; addLog(g, "The party has been wiped out!", "#ef6461"); sfx.wipe(); }
    else { g.phase = "advance"; g.advanceT = 2; }
    return;
  }
  if (!foes.length) {
    if (g.stage % 20 === 0) { endChapter(g); return; }
    g.stage++; g.best = Math.max(g.best, g.stage);
    g.everBest = Math.max(g.everBest, g.stage);
    if (g.session) g.session.best = Math.max(g.session.best, g.stage);
    g.phase = "advance"; g.advanceT = 2.4; g.enemies = [];
    g.projectiles = []; g.pending = [];
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
      sfx.potion();
    }
  }
  if (g.auto.res && g.stock.res > 0) {
    const dead = g.members.find((m) => !m.alive && g.time - m.deadT > 2.5);
    if (dead) {
      g.stock.res--; dead.alive = true; dead.hp = dead._st.hp * 0.6;
      addLog(g, `A Phoenix Draught returns ${dead.name} to the fight!`, "#f2a94e");
      sfx.res();
      addFloat(g, dead.x, dead.y - 80, "REVIVED", "#f2a94e", true);
      burst(g, dead.x, dead.y - 24, "#f2a94e", 18, 2);
    }
  }

  /* member actions */
  for (const m of alive) {
    if ((m.ult || 0) >= 1 && castUlt(g, m, foes, alive)) { m.ult = 0; m.atkT = Math.max(m.atkT, 0.35); continue; }
    m.atkT -= dt;
    if (m.atkT > 0) continue;
    m.atkT = m._st.spd;
    if (m.cls === "healer") {
      const hurt = [...alive].sort((a, b) => a.hp / a._st.hp - b.hp / b._st.hp)[0];
      m.castT = 0.32;
      if (hurt && hurt.hp / hurt._st.hp < 0.999) {
        const amt = m._st.heal * rand(0.9, 1.1);
        g.projectiles.push({ kind: "heal", x: m.x + 18, y: m.y - 66, tgtKind: "member", tgtId: hurt.id, spd: 260, amt, srcId: m.id });
        continue;
      }
      const zap = foes.find((e) => e.hp > 0);
      if (!zap) continue;
      const rb = rollDmg(m);
      sfx.shoot();
      g.projectiles.push({ kind: "bolt", x: m.x + 18, y: m.y - 66, tgtKind: "enemy", tgtId: zap.id, spd: 340, dmg: rb.dmg, crit: rb.crit, srcId: m.id, tint: WEAPON_SKINS.find((w) => w.id === m.cos.weapon).c });
      continue;
    }
    const tgt = foes.find((e) => e.hp > 0);
    if (!tgt) continue;
    const { dmg, crit } = rollDmg(m);
    if (m.style === "archer") {
      m.shootT = 0.25;
      sfx.shoot();
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
      if (m.style === "warrior") g.shake = Math.max(g.shake, 1.4);
    }
  }

  /* delayed strikes (rogue combos, chain apex) */
  for (let i = g.pending.length - 1; i >= 0; i--) {
    const q = g.pending[i]; q.t -= dt;
    if (q.t > 0) continue;
    g.pending.splice(i, 1);
    const src = g.members.find((mm) => mm.id === q.srcId);
    const tgt = g.enemies.find((e) => e.id === q.tgtId && e.hp > 0) || g.enemies.find((e) => e.hp > 0);
    if (src && src.alive && tgt) hitEnemy(g, src, tgt, q.dmg, q.crit);
  }

  /* projectiles: arrows, magic bolts, heal orbs */
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
    if (p.kind !== "arrow" && Math.random() < dt * 40 && g.particles.length < 240)
      g.particles.push({ x: p.x, y: p.y, vx: 0, vy: -0.2, life: 0.35, color: p.kind === "heal" ? "#9fe88c" : (p.tint || "#b07fe0"), size: 2, grav: 0 });
  }

  /* enemy actions */
  for (const e of g.enemies) {
    e.hitT = Math.max(0, (e.hitT || 0) - dt);
    e.slamT = Math.max(0, (e.slamT || 0) - dt);
    e.screechT = Math.max(0, (e.screechT || 0) - dt);
    if (e.hp <= 0) continue;
    e.lunge = Math.max(0, e.lunge - dt);
    if (e.elite && e.kind === "skeleton" && !e.raised && e.hp <= e.maxHp * 0.6) {
      e.raised = true; e.atkT += 1.2;
      const sk = makeEnemy(g, "normal");
      sk.x = e.x + 34; sk.y = clamp(e.y + 8, GROUND - 10, GROUND);
      sk.hp = sk.maxHp = Math.round(sk.maxHp * 0.8);
      g.enemies.push(sk);
      addLog(g, "The Bone Captain raises a fallen warrior from the dust!", "#8a6fe0");
      sfx.rise();
      addFloat(g, e.x, e.y - 66 * (e.scale || 1) - 14, "RISE!", "#8a6fe0", true);
      burst(g, sk.x, sk.y - 12, "#8a6fe0", 14, 1.6);
      sparkle(g, sk.x, sk.y, "#c8d4ff", 8);
      g.shake = Math.max(g.shake, 3);
    }
    if (e.elite && e.kind === "imp" && !e.enraged && e.hp <= e.maxHp * 0.5) {
      e.enraged = true;
      e.dmg *= 1.5; e.spd *= 0.65;
      addFloat(g, e.x, e.y - 66 * (e.scale || 1) - 14, "ENRAGED!", "#ff4a3a", true);
      addLog(g, "The Imp Warlord flies into a burning rage!", "#ef6461");
      sfx.enrage();
      burst(g, e.x, e.y - 26, "#ff6a3a", 16, 2);
      g.shake = Math.max(g.shake, 4);
    }
    if (e.boss) {
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
            bossSpecial(g, e, alive);
            e.specT = rand(7, 10);
          }
        }
      } else {
        e.specT = (e.specT == null ? rand(4.5, 7) : e.specT) - dt;
        if (e.specT <= 0 && alive.length) {
          e.windupMax = { slime: 1.6, bat: 1.4, skeleton: 1.8, imp: 1.7 }[e.kind];
          e.windup = e.windupMax;
          const names = { slime: "gathers itself for a ROYAL SLAM", bat: "draws breath for a SCREECH", skeleton: "raises its blade in a GRAVE CALL", imp: "calls fire from the deep" };
          addLog(g, `The ${e.name} ${names[e.kind]}!`, "#e77463");
          sfx.warn();
        }
      }
    }

    if (e.enraged && Math.random() < dt * 10 && g.particles.length < 240)
      g.particles.push({ x: e.x + rand(-10, 10), y: e.y - rand(8, 34), vx: rand(-0.2, 0.2), vy: -rand(0.6, 1.1), life: 0.5, color: "#ff8a4a", size: 2, grav: 0 });
    if (e.poisonT > 0) {
      e.poisonT -= dt;
      e.hp -= e.poison * dt;
      if (e.hp <= 0) { killEnemy(g, null, e); continue; }
    }
    if (e.stunT > 0) { e.stunT -= dt; continue; }
    if (!e.boss) {
      const party = alive.filter((m) => m.alive);
      if (e.cleaveWind > 0) {
        e.cleaveWind -= dt;
        e.atkT = Math.max(e.atkT, 0.4);
        if (Math.random() < dt * 30) sparkle(g, e.x, e.y - 24 * (e.scale || 1), "#ffb24a", 2);
        if (e.cleaveWind <= 0) { enemyCleave(g, e, party); e.cleaveT = rand(6, 9); }
      } else if (party.length >= 2) {
        e.cleaveT = (e.cleaveT == null ? rand(4, 7) : e.cleaveT) - dt;
        if (e.cleaveT <= 0) {
          e.cleaveWind = e.elite ? 0.5 : 0.4;
          sfx.warn();
          burst(g, e.x, e.y - 24 * (e.scale || 1), "#ffb24a", 7, 1.5);
        }
      }
    }
    e.atkT -= dt;
    if (e.atkT > 0) continue;
    e.atkT = e.spd; e.lunge = 0.22;
    const tanks = alive.filter((m) => m.cls === "tank" && m.alive);
    const tgt = tanks.length ? pick(tanks) : pick(alive.filter((m) => m.alive));
    if (!tgt) continue;
    const armor = tgt._st.armor + (g.buffT > 0 ? 6 : 0);
    let dmg = Math.max(1, e.dmg * rand(0.85, 1.15) - armor * 0.6) * (1 - tgt._st.dr);
    tgt.hp -= dmg;
    burst(g, tgt.x + 4, tgt.y - 30, "#ef6461", 4, 1.1);
    if ((e.elite || e.frenzy) && e.kind === "bat") {
      const drain = dmg * (e.frenzy ? 0.4 : 0.6);
      e.hp = Math.min(e.maxHp, e.hp + drain);
      addFloat(g, e.x, e.y - 66 * (e.scale || 1), "+" + fmt(drain), "#c9506d");
      sparkle(g, e.x, e.y - 8, "#c9506d", 4);
      if (!e.drained) { e.drained = true; addLog(g, "The Dire Bat drinks deep of the party's blood!", "#c9506d"); }
    }
    if (e.boss) g.shake = Math.max(g.shake, 3);
    addFloat(g, tgt.x, tgt.y - 70, "-" + fmt(dmg), "#ef6461");
    sfx.hurt();
    if (tgt.hp <= 0) {
      tgt.alive = false; tgt.hp = 0; tgt.deadT = g.time;
      burst(g, tgt.x, tgt.y - 24, "#7a7490", 14, 1.6);
      g.shake = Math.max(g.shake, 4);
      addLog(g, `${tgt.name} has fallen!`, "#ef6461");
      sfx.fall();
    if (g.session) g.session.deaths++;
    }
    if (tgt._st.thorns > 0 && e.hp > 0) {
      const ref = dmg * tgt._st.thorns;
      e.hp -= ref;
      if (Math.random() < 0.3) addFloat(g, e.x, e.y - 60 * (e.scale || 1), "-" + fmt(ref), "#e77463");
      if (e.hp <= 0) killEnemy(g, tgt, e);
    }
  }
}

function killEnemy(g, killer, e) {
  e.hp = 0;
  if (killer) killer.kills++;
  const goldGain = Math.round(e.gold * (1 + 0.15 * g.legacy.merchant) * (1 + ((killer && killer._st && killer._st.goldF) || 0)));
  g.gold += goldGain;
  sfx.kill(); sfx.coin();
  if (g.session) { g.session.kills++; g.session.gold += goldGain; if (e.boss) g.session.bossKills.push(e.name); else if (e.elite) g.session.eliteKills++; }
  if (g.chapter) { g.chapter.kills++; g.chapter.gold += goldGain; }
  questProg(g, "kill", 1);
  if (e.elite) questProg(g, "elite", 1);
  if (e.boss) questProg(g, "boss", 1);
  questProg(g, "gold", goldGain);
  burst(g, e.x, e.y - 22 * (e.scale || 1), ENEMY_COLORS[e.kind] || "#fff", e.boss ? 30 : e.elite ? 20 : 12, e.boss ? 2.4 : e.elite ? 2 : 1.5);
  for (let i = 0; i < (e.boss ? 12 : e.elite ? 8 : 5); i++) {
    g.particles.push({ x: e.x, y: e.y - 20, vx: rand(-1.1, 1.1), vy: -rand(1, 2.2), life: rand(0.7, 1), color: "#f2c14e", size: 3, grav: 6 });
  }
  g.shake = Math.max(g.shake, e.boss ? 8 : e.elite ? 4 : 1.5);
  addFloat(g, e.x, e.y - 50, `+${goldGain}g`, "#f2c14e");
  if (e.elite && e.kind === "slime") {
    for (let k = 0; k < 2; k++) {
      const sp = makeEnemy(g, "normal");
      sp.x = e.x + (k ? 30 : -26);
      sp.y = clamp(e.y + (k ? 8 : -8), GROUND - 10, GROUND);
      sp.hp = sp.maxHp = Math.round(sp.maxHp * 0.65);
      g.enemies.push(sp);
      burst(g, sp.x, sp.y - 10, "#6fbf5e", 8, 1.4);
    }
    addLog(g, "The Elder Slime bursts apart into two smaller slimes!", "#7fd069");
    sfx.split();
  }
  const alive = g.members.filter((m) => m.alive);
  const share = Math.round((e.xp / Math.max(1, alive.length) + e.xp * 0.4) * (1 + 0.15 * g.legacy.scholar));
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
  return { dmg: m._st.dmg * rand(0.85, 1.15) * (crit ? 2 + (m._st.critDmg || 0) : 1), crit };
}

function hitEnemy(g, m, tgt, dmg, crit) {
  if (!tgt || tgt.hp <= 0) return;
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
  tgt.hitT = 0.15;
  sfx[crit ? "crit" : "hit"]();
  burst(g, tgt.x - 6, tgt.y - 28 * (tgt.scale || 1), crit ? "#f2a94e" : "#ffffff", crit ? 10 : 5, crit ? 2 : 1.2);
  if (crit) g.shake = Math.max(g.shake, 3.5);
  addFloat(g, tgt.x, tgt.y - 66 * (tgt.scale || 1), fmt(dmg) + (crit ? "!" : ""), crit ? "#f2a94e" : "#fff", crit);
  if (m && m._st.stun > 0 && Math.random() < m._st.stun) { tgt.stunT = 1.1; addFloat(g, tgt.x, tgt.y - 84, "STUNNED", "#5aa9e6"); sfx.stun(); }
  if (tgt.hp <= 0) killEnemy(g, m, tgt);
}

function applyHeal(g, m, ally, amt) {
  if (!ally.alive) return;
  ally.hp = Math.min(ally._st.hp, ally.hp + amt);
  if (m) m.healDone += amt;
  addFloat(g, ally.x, ally.y - 74, `+${fmt(amt)}`, "#7fd069");
  sparkle(g, ally.x, ally.y, "#9fe88c", 6);
}


const FEAST_DUR = 22;
function setupFeast(g) {
  const ms = [...g.members];
  for (let i = ms.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ms[i], ms[j]] = [ms[j], ms[i]]; }
  const table = [316, 354, 392, 430, 462], bar = [96, 128], dance = [214, 252];
  let ti = 0, bi = 0, di = 0, si = 0, idx = 0;
  const assign = (m, act, tx, extra) => { m.feast = { act, seed: Math.random() * 10, face: 1, ...(extra || {}) }; m.tx = tx; };
  if (ms.length >= 2) {
    const ps = Math.random() * 10;
    assign(ms[0], "wrestle", 522, { midX: 545, pairSeed: ps });
    assign(ms[1], "wrestle", 568, { face: -1, midX: 545, pairSeed: ps });
    idx = 2;
  }
  const acts = ["drink_bar", "eat", "sing", "dance", "drink", "eat", "dance", "drink_bar"];
  for (; idx < ms.length; idx++) {
    const a = acts[(idx - 2 + acts.length * 2) % acts.length];
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

function resetChar(g, m) {
  m.level = 1; m.xp = 0; m.sp = 0; m.skills = {};
  m.gear = { weapon: null, armor: null, trinket: null };
  m.kills = 0; m.dmgDone = 0; m.healDone = 0;
  m.ult = 0; m.ultT = 0;
  m.alive = true; m._st = stats(m, g); m.hp = m._st.hp;
}

function endChapter(g) {
  const mu = mutatorOf(g);
  const earn = Math.round(renownEarn(g.stage) * (mu ? mu.renownMult : 1));
  g.renown += earn; g.prestiges++;
  sfx.prestige();
  if (g.session) g.session.chapters++;
  if (g.session) g.session.best = Math.max(g.session.best, g.stage);
  g.everBest = Math.max(g.everBest, g.stage);
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
  /* the feast restocks the pantry: top potions up to the stipend baseline */
  const st = g.legacy.stipend * 2;
  const refill = { heal: 3 + st, armor: 1 + st, poison: 1 + st, res: 1 + st };
  for (const k of Object.keys(refill)) g.stock[k] = Math.max(g.stock[k] || 0, refill[k]);
  g.enemies = []; g.projectiles = []; g.pending = []; g.floaters = []; g.buffT = 0;
  g.prestigeT = 3;
  if (g.members.length) { g.phase = "feast"; setupFeast(g); }
  else { g.phase = "advance"; g.advanceT = 2.5; }
  addLog(g, `The tale is told! The guild earns ${earn} renown${mu ? ` (×${mu.renownMult} for braving the ${mu.name})` : ""} and begins Chapter ${g.prestiges + 1}.`, "#f2c14e");
  addLog(g, `The next tale is a ${next.name}: ${next.desc}`, next.c);
}

function retellMember(g, m) {
  if (!m || m.level < 21 || g.phase === "feast") return;
  const mu = mutatorOf(g);
  const earn = Math.round(renownEarn(m.level) * (mu ? mu.renownMult : 1));
  g.renown += earn;
  m.retellings = (m.retellings || 0) + 1;
  if (g.session) g.session.retellings = (g.session.retellings || 0) + 1;
  resetChar(g, m);
  sfx.prestige();
  addLog(g, `${m.name} retells their tale! The guild gains ${earn} renown, and a hero is born anew.`, "#b07fe0");
}

/* ---------------- drawing ---------------- */
function px(ctx, ox, oy, x, y, w, h, c) {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(ox + x * P), Math.round(oy + y * P), w * P, h * P);
}

const hexA = (h, a) => {
  const n = parseInt(h.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

function getLayer(g, key) {
  if (!g[key]) { const c = document.createElement("canvas"); c.width = W; c.height = H; g[key] = c; }
  return g[key];
}

/* Generated background plates, keyed by zone name (docs/ART-PIPELINE.md).
   Registered at startup by the client shell; a missing plate falls back to
   the procedural sky and mountain ranges. Plates replace sky+ranges only —
   the sun, god ray, ambient motes, clouds, and fog stay live on top.
   (The standalone prototype registers none and keeps the procedural look.) */
const BG_PLATES = {};
function registerBgPlate(zoneName, img) { BG_PLATES[zoneName] = img; }

function drawRange(c, off, baseY, amp, wgap, color) {
  c.fillStyle = color;
  for (let i = -1; i < Math.ceil(W / wgap) + 2; i++) {
    const x = i * wgap - off;
    c.beginPath();
    c.moveTo(x, baseY);
    c.lineTo(x + wgap * 0.5, baseY - amp - ((i * 37) % 23));
    c.lineTo(x + wgap, baseY);
    c.fill();
  }
}

function drawScene(ctx, g) {
  const zone = zoneOf(g);
  const t = g.time;

  /* ---- far layer: painted offscreen, blitted with heavy blur ---- */
  const bg = getLayer(g, "_bg"), b = bg.getContext("2d");
  b.clearRect(0, 0, W, H);
  const plate = BG_PLATES[zone.name];
  if (plate) {
    b.drawImage(plate, 0, 0, W, H);
  } else {
    const grad = b.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, zone.sky[0]); grad.addColorStop(0.55, zone.sky[1]); grad.addColorStop(1, zone.sky[2]);
    b.fillStyle = grad; b.fillRect(0, 0, W, H);
  }
  const mg = b.createRadialGradient(552, 52, 4, 552, 52, 46);
  mg.addColorStop(0, `rgba(${zone.ray},0.85)`); mg.addColorStop(0.25, `rgba(${zone.ray},0.30)`); mg.addColorStop(1, `rgba(${zone.ray},0)`);
  b.fillStyle = mg; b.fillRect(500, 0, 110, 110);
  b.fillStyle = "#f4ecd0"; b.beginPath(); b.arc(552, 52, 11, 0, Math.PI * 2); b.fill();
  if (zone.ambient === "dust") {
    b.fillStyle = "rgba(230,235,255,0.8)";
    for (let i = 0; i < 26; i++) b.fillRect((i * 97.3) % W, (i * 53.7) % 120, (i % 3) === 0 ? 2 : 1, (i % 3) === 0 ? 2 : 1);
  }
  b.fillStyle = "rgba(255,255,255,0.10)";
  for (let i = 0; i < 4; i++) {
    const cx = ((i * 210 + t * 4) % (W + 140)) - 70;
    b.fillRect(cx, 36 + i * 22, 90 + i * 18, 8);
    b.fillRect(cx + 16, 30 + i * 22, 50, 8);
  }
  if (!plate) drawRange(b, (g.scroll * 0.12) % 190, 208, 66, 190, zone.far);
  const fog = b.createLinearGradient(0, 150, 0, 214);
  fog.addColorStop(0, `rgba(${zone.fogC},0)`); fog.addColorStop(1, `rgba(${zone.fogC},0.30)`);
  b.fillStyle = fog; b.fillRect(0, 150, W, 64);
  if (!plate) drawRange(b, (g.scroll * 0.22) % 150, 216, 88, 150, zone.near);
  ctx.save(); ctx.filter = "blur(2.2px)"; ctx.drawImage(bg, 0, 0); ctx.restore();

  /* ---- mid props: light blur ---- */
  const md = getLayer(g, "_mid"), mm = md.getContext("2d");
  mm.clearRect(0, 0, W, H);
  const off2 = (g.scroll * 0.55) % 150;
  for (let i = -1; i < 6; i++) {
    const x = i * 150 - off2 + 26;
    if (zone.enemy === "slime") {
      mm.fillStyle = "#33261d"; mm.fillRect(x + 11, 170, 7, 64);
      mm.fillStyle = zone.midDark; mm.fillRect(x - 10, 126, 48, 34);
      mm.fillStyle = zone.mid; mm.fillRect(x - 4, 112, 36, 30); mm.fillRect(x - 14, 140, 24, 18);
    } else if (zone.enemy === "bat") {
      mm.fillStyle = zone.midDark; mm.fillRect(x + 4, 96, 12, 138);
      mm.fillStyle = zone.mid; mm.fillRect(x + 4, 96, 4, 138);
      mm.fillStyle = zone.midDark; mm.fillRect(x - 26, 88, 70, 14);
      mm.fillStyle = zone.mid;
      for (let v = 0; v < 3; v++) mm.fillRect(x - 20 + v * 22, 102, 2, 26 + ((v * 13) % 18));
    } else if (zone.enemy === "skeleton") {
      mm.fillStyle = zone.mid; mm.fillRect(x + 6, 132, 16, 102);
      mm.fillStyle = zone.midDark; mm.fillRect(x + 6, 132, 5, 102);
      mm.fillStyle = zone.mid; mm.fillRect(x, 124, 28, 10); mm.fillRect(x + 2, 226, 24, 10);
      const cd = mm.createRadialGradient(x + 14, 120, 1, x + 14, 120, 13);
      cd.addColorStop(0, "rgba(255,190,110,0.7)"); cd.addColorStop(1, "rgba(255,190,110,0)");
      mm.fillStyle = cd; mm.fillRect(x + 1, 107, 26, 26);
      mm.fillStyle = "#ffdf9e"; mm.fillRect(x + 13, 118, 2, 4);
    } else {
      mm.fillStyle = zone.mid;
      mm.beginPath(); mm.moveTo(x - 6, 234); mm.lineTo(x + 10, 128); mm.lineTo(x + 26, 234); mm.fill();
      mm.fillStyle = zone.midDark;
      mm.beginPath(); mm.moveTo(x + 10, 128); mm.lineTo(x + 26, 234); mm.lineTo(x + 10, 234); mm.fill();
      const lg = mm.createRadialGradient(x + 10, 232, 1, x + 10, 232, 20);
      lg.addColorStop(0, "rgba(255,120,40,0.5)"); lg.addColorStop(1, "rgba(255,120,40,0)");
      mm.fillStyle = lg; mm.fillRect(x - 12, 212, 44, 26);
    }
  }
  ctx.save(); ctx.filter = "blur(1px)"; ctx.drawImage(md, 0, 0); ctx.restore();

  /* ---- sharp playfield: the crisp miniature band ---- */
  ctx.fillStyle = zone.top; ctx.fillRect(0, GROUND - 12, W, 5);
  ctx.fillStyle = zone.ground; ctx.fillRect(0, GROUND - 7, W, H - GROUND + 7);
  ctx.fillStyle = zone.band; ctx.fillRect(0, GROUND - 7, W, 12);
  ctx.fillStyle = "rgba(0,0,0,0.20)"; ctx.fillRect(0, GROUND + 18, W, H - GROUND - 18);
  const off3 = g.scroll % 46;
  for (let i = -1; i < 16; i++) {
    const dx = i * 46 - off3, dy = GROUND + 3 + (i % 3) * 8;
    if (zone.ambient === "ember") { ctx.fillStyle = "rgba(255,140,60,0.5)"; ctx.fillRect(dx, dy, 3, 2); }
    else if (zone.ambient === "dust") { ctx.fillStyle = "rgba(220,215,200,0.35)"; ctx.fillRect(dx, dy, 4, 2); }
    else { ctx.fillStyle = hexA(zone.top, 0.55); ctx.fillRect(dx, dy, 2, 4); ctx.fillRect(dx + 3, dy + 1, 2, 3); }
  }
  /* dappled light pools on the ground */
  ctx.save(); ctx.globalCompositeOperation = "overlay";
  for (let i = 0; i < 3; i++) {
    const lx = (((i * 260 - g.scroll * 0.9) % (W + 160)) + W + 160) % (W + 160) - 80;
    const ly = GROUND + 8;
    const lg2 = ctx.createRadialGradient(lx, ly, 2, lx, ly, 60);
    lg2.addColorStop(0, `rgba(${zone.ray},0.35)`); lg2.addColorStop(1, `rgba(${zone.ray},0)`);
    ctx.fillStyle = lg2;
    ctx.save(); ctx.translate(lx, ly); ctx.scale(1, 0.35); ctx.translate(-lx, -ly);
    ctx.beginPath(); ctx.arc(lx, ly, 60, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  drawAmbient(ctx, g, zone);
}

function drawAmbient(ctx, g, zone) {
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 22; i++) {
    const sp = 4 + (i % 5) * 2.5;
    let x = (i * 151.7 + g.time * sp - g.scroll * (0.3 + (i % 3) * 0.18)) % (W + 30);
    if (x < 0) x += W + 30;
    x -= 15;
    let y, a, r;
    if (zone.ambient === "ember") {
      y = H - ((i * 61.3 + g.time * 26) % (H - 60)) - 20; a = 0.5; r = 1.5 + (i % 3);
    } else {
      y = 34 + ((i * 71.3) % (H - 90)) + Math.sin(g.time * 0.6 + i * 1.7) * 9;
      r = 1 + (i % 3) * 0.8;
      a = zone.ambient === "firefly" ? 0.22 + 0.34 * Math.max(0, Math.sin(g.time * 1.8 + i * 2.3)) : 0.30;
    }
    const gg = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
    gg.addColorStop(0, hexA(zone.amb, a)); gg.addColorStop(1, hexA(zone.amb, 0));
    ctx.fillStyle = gg; ctx.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
  }
  ctx.restore();
}

function drawForeground(ctx, g) {
  const zone = zoneOf(g);
  const fgc = getLayer(g, "_fg"), f = fgc.getContext("2d");
  f.clearRect(0, 0, W, H);
  f.globalCompositeOperation = "source-over";
  const off = (g.scroll * 1.7) % 120;
  f.fillStyle = zone.fg;
  for (let i = -1; i < 7; i++) {
    const x = i * 120 - off;
    for (let k = 0; k < 5; k++) {
      const bx = x + k * 9 + ((i * 13 + k * 7) % 6);
      const hgt = 16 + ((i * 17 + k * 29) % 18);
      f.beginPath(); f.moveTo(bx, H); f.lineTo(bx + 4, H - hgt); f.lineTo(bx + 8, H); f.fill();
    }
  }
  f.fillRect(0, H - 12, W, 12);
  /* bokeh: big soft light dots drifting in the blurred near field */
  f.globalCompositeOperation = "lighter";
  for (let i = 0; i < 6; i++) {
    const x = (((i * 197.7 + g.time * 7 - g.scroll * 0.9) % (W + 60)) + W + 60) % (W + 60) - 30;
    const y = H - 55 + ((i * 31) % 40) + Math.sin(g.time * 0.5 + i) * 6;
    const r = 6 + (i % 3) * 4;
    const gg = f.createRadialGradient(x, y, 0, x, y, r);
    gg.addColorStop(0, hexA(zone.amb, 0.34)); gg.addColorStop(1, hexA(zone.amb, 0));
    f.fillStyle = gg; f.beginPath(); f.arc(x, y, r, 0, Math.PI * 2); f.fill();
  }
  ctx.save(); ctx.filter = "blur(3px)"; ctx.drawImage(fgc, 0, 0); ctx.restore();
}

function drawLighting(ctx, g) {
  const zone = zoneOf(g);
  const t = g.time;
  /* tilt-shift bands: re-blur the top and bottom of the frame */
  ctx.save();
  ctx.filter = "blur(1.6px)";
  ctx.drawImage(ctx.canvas, 0, 0, W, 64, 0, 0, W, 64);
  ctx.drawImage(ctx.canvas, 0, H - 28, W, 28, 0, H - 28, W, 28);
  ctx.restore();
  ctx.save();
  /* volumetric god rays */
  ctx.globalCompositeOperation = "screen";
  for (let i = 0; i < 3; i++) {
    const sway = Math.sin(t * 0.25 + i * 1.9) * 30;
    const x0 = 130 + i * 190 + sway;
    const a = Math.max(0.02, 0.055 + 0.03 * Math.sin(t * 0.5 + i * 2.1));
    const grd = ctx.createLinearGradient(x0, 0, x0 - 130, H);
    grd.addColorStop(0, `rgba(${zone.ray},${a})`);
    grd.addColorStop(1, `rgba(${zone.ray},0)`);
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.moveTo(x0, -10); ctx.lineTo(x0 + 46, -10); ctx.lineTo(x0 - 100, H); ctx.lineTo(x0 - 170, H);
    ctx.closePath(); ctx.fill();
  }
  /* painterly color grade */
  ctx.globalCompositeOperation = "soft-light";
  const cg = ctx.createLinearGradient(0, 0, 0, H);
  cg.addColorStop(0, `rgba(${zone.gradeTop},0.55)`);
  cg.addColorStop(1, `rgba(${zone.gradeBot},0.45)`);
  ctx.fillStyle = cg; ctx.fillRect(0, 0, W, H);
  /* vignette */
  ctx.globalCompositeOperation = "source-over";
  const vg = ctx.createRadialGradient(W / 2, H * 0.42, H * 0.35, W / 2, H * 0.55, H * 0.95);
  vg.addColorStop(0, "rgba(8,6,18,0)"); vg.addColorStop(1, "rgba(8,6,18,0.50)");
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function drawShadow(ctx, x, y, w) {
  const sg = ctx.createRadialGradient(x, y, 1, x, y, w * 0.7);
  sg.addColorStop(0, "rgba(0,0,0,0.42)"); sg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.32); ctx.translate(-x, -y);
  ctx.fillStyle = sg;
  ctx.beginPath(); ctx.arc(x, y, w * 0.7, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function hpBar(ctx, x, y, w, ratio, color) {
  ctx.fillStyle = "#141221"; ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, 6);
  ctx.fillStyle = "#3a3550"; ctx.fillRect(x - w / 2, y, w, 4);
  ctx.fillStyle = color; ctx.fillRect(x - w / 2, y, Math.max(0, w * ratio), 4);
}

/* ===== high-detail character rendering on a 2px texel grid ===== */
const P2 = 2;
function px2(ctx, ox, oy, x, y, w, h, c) {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(ox + x * P2), Math.round(oy + y * P2), Math.round(w * P2), Math.round(h * P2));
}
function shade(hex, f) {
  if (typeof hex !== "string" || hex[0] !== "#") return hex;
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${ch((n >> 16) & 255)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}
const SKIN_L = "#f6d4a6";

function drawHat(ctx, ox, oy, hat, outfit, tint, hairC, t) {
  const oD = shade(outfit, 0.7), oL = shade(outfit, 1.28);
  const tt = t || 0;
  if (hat === "helm") {
    px2(ctx, ox, oy, -5, -33, 10, 2, "#aeb7c9");
    px2(ctx, ox, oy, -6, -31, 12, 3, "#9aa3b5");
    px2(ctx, ox, oy, -6, -28, 2, 6, "#9aa3b5");
    px2(ctx, ox, oy, 4, -28, 2, 5, "#9aa3b5");
    px2(ctx, ox, oy, -4, -32, 4, 1, "#e3e8f2");
    px2(ctx, ox, oy, -5, -33.5, 10, 0.5, "#f2f6fc");
    px2(ctx, ox, oy, -6, -29, 12, 1, "#6f7890");
    px2(ctx, ox, oy, -6, -27, 1, 1, "#e3e8f2");
    px2(ctx, ox, oy, 5, -25, 1, 1, "#6f7890");
    const pw = Math.round(Math.sin(tt * 3) * 0.5);
    px2(ctx, ox, oy, -1, -37, 2, 4, "#d0455a");
    px2(ctx, ox, oy, -2, -35, 1, 2, "#a83648");
    px2(ctx, ox, oy, -1 + pw, -38, 2, 1, "#e77463");
    if (((tt * 22) % 90) < 6) px2(ctx, ox, oy, -3, -32.5, 1, 1, "#ffffff");
  } else if (hat === "wizard") {
    const ws = Math.round(Math.sin(tt * 1.7) * 0.5);
    px2(ctx, ox, oy, -10, -30, 20, 2, "#6a4a9e");
    px2(ctx, ox, oy, -10, -28, 20, 1, "#4e3675");
    px2(ctx, ox, oy, -10, -30.5, 20, 0.5, "#8a6fe0");
    px2(ctx, ox, oy, -6, -34, 12, 4, "#6a4a9e");
    px2(ctx, ox, oy, -3, -38, 7, 4, "#6a4a9e");
    px2(ctx, ox, oy, -1 + ws, -41, 4, 3, "#6a4a9e");
    px2(ctx, ox, oy, 1 + ws, -43, 3, 2, "#5a3f87");
    px2(ctx, ox, oy, -6, -34, 1, 4, "#8a6fe0");
    px2(ctx, ox, oy, -3, -38, 1, 4, "#8a6fe0");
    px2(ctx, ox, oy, -6, -31, 12, 1, "#8a6fe0");
    px2(ctx, ox, oy, -4, -33, 1, 1, "#c8d4ff");
    px2(ctx, ox, oy, 2, -36, 2, 2, "#f2c14e");
    px2(ctx, ox, oy, 3, -37, 1, 1, Math.floor(tt * 3) % 2 ? "#fff1c9" : "#f2c14e");
    if (Math.floor(tt * 3) % 2) px2(ctx, ox, oy, 2.5 + ws, -44.5, 1, 1, "#fff1c9");
  } else if (hat === "hood") {
    px2(ctx, ox, oy, -6, -32, 12, 3, outfit);
    px2(ctx, ox, oy, -7, -29, 2, 10, outfit);
    px2(ctx, ox, oy, 5, -29, 2, 6, outfit);
    px2(ctx, ox, oy, -5, -32, 4, 1, oL);
    px2(ctx, ox, oy, -5, -32.5, 8, 0.5, oL);
    px2(ctx, ox, oy, -4, -29, 9, 1, oD);
    px2(ctx, ox, oy, 2, -28, 3, 1, shade(outfit, 0.5));
    px2(ctx, ox, oy, -9, -25, 2, 7, oD);
    px2(ctx, ox, oy, -8, -19, 2, 2, oD);
    px2(ctx, ox, oy, -3, -29.5, 0.5, 0.5, oL);
    px2(ctx, ox, oy, 0.5, -29.5, 0.5, 0.5, oL);
  } else if (hat === "crown") {
    px2(ctx, ox, oy, -5, -33, 10, 3, "#f2c14e");
    px2(ctx, ox, oy, -5, -33.5, 10, 0.5, "#fff1c9");
    px2(ctx, ox, oy, -5, -31, 10, 1, "#c78a3b");
    px2(ctx, ox, oy, -5, -36, 2, 3, "#f2c14e");
    px2(ctx, ox, oy, -1, -37, 2, 4, "#f2c14e");
    px2(ctx, ox, oy, 3, -36, 2, 3, "#f2c14e");
    px2(ctx, ox, oy, -1, -37, 1, 1, "#fff1c9");
    px2(ctx, ox, oy, -4, -32, 1, 1, "#d0455a");
    px2(ctx, ox, oy, 0, -32, 2, 1, "#5aa9e6");
    px2(ctx, ox, oy, 4, -32, 1, 1, "#d0455a");
    const gsel = Math.floor(tt * 2) % 3;
    const gpos = [[-4, -32.5], [0.5, -32.5], [4, -32.5]][gsel];
    px2(ctx, ox, oy, gpos[0], gpos[1], 0.5, 0.5, "#ffffff");
  } else if (hat === "horns") {
    px2(ctx, ox, oy, -7, -32, 2, 3, "#d0455a");
    px2(ctx, ox, oy, -9, -35, 2, 3, "#e77463");
    px2(ctx, ox, oy, -10, -37, 1, 2, "#f2a08c");
    px2(ctx, ox, oy, -8, -34, 1, 1, "#a83648");
    px2(ctx, ox, oy, 5, -32, 2, 3, "#d0455a");
    px2(ctx, ox, oy, 7, -35, 2, 3, "#e77463");
    px2(ctx, ox, oy, 9, -37, 1, 2, "#f2a08c");
    px2(ctx, ox, oy, 6, -34, 1, 1, "#a83648");
    const emb = 0.25 + 0.15 * Math.sin(tt * 4);
    px2(ctx, ox, oy, -10, -37.5, 1, 1, `rgba(255,138,74,${emb})`);
    px2(ctx, ox, oy, 9, -37.5, 1, 1, `rgba(255,138,74,${emb})`);
  } else if (hat === "halo") {
    const hb = Math.sin(tt * 1.8) * 0.5;
    const ha = 0.3 + 0.18 * Math.sin(tt * 2.5);
    px2(ctx, ox, oy, -4, -37 + hb, 8, 1, "#f7e28b");
    px2(ctx, ox, oy, -5, -36 + hb, 1, 1, "#f7e28b");
    px2(ctx, ox, oy, 4, -36 + hb, 1, 1, "#f7e28b");
    px2(ctx, ox, oy, -2, -37.5 + hb, 4, 0.5, "#fff6d8");
    px2(ctx, ox, oy, -3, -38 + hb, 6, 1, `rgba(247,226,139,${ha})`);
    px2(ctx, ox, oy, -3, -35 + hb, 6, 1, `rgba(247,226,139,${ha})`);
  } else if (hat === "flower") {
    px2(ctx, ox, oy, -5, -31, 10, 1, "#3f6d4a");
    px2(ctx, ox, oy, -6, -32, 1, 1, "#5a8f5f");
    px2(ctx, ox, oy, 5, -32, 1, 1, "#5a8f5f");
    px2(ctx, ox, oy, -4, -33, 2, 2, "#e77fb3");
    px2(ctx, ox, oy, -4, -33, 1, 1, "#f2a8ce");
    px2(ctx, ox, oy, 0, -33, 2, 2, "#efeaff");
    px2(ctx, ox, oy, 0, -32, 1, 1, "#f2c14e");
    px2(ctx, ox, oy, 3, -32, 2, 2, "#f2c14e");
    px2(ctx, ox, oy, 4, -32, 1, 1, "#c78a3b");
    px2(ctx, ox, oy, -2, -33.5, 1, 0.5, "#f2a8ce");
    const fp = (tt * 1.6) % 7;
    if (fp < 4) px2(ctx, ox, oy, 6, -30 + fp * 2.2, 0.5, 0.5, "#f2a8ce");
  } else if (hat === "ribbon") {
    const rs = Math.round(Math.sin(tt * 2.2) * 1);
    px2(ctx, ox, oy, 2, -34, 3, 3, "#e77fb3");
    px2(ctx, ox, oy, 6, -34, 3, 3, "#e77fb3");
    px2(ctx, ox, oy, 5, -33, 1, 2, "#c9506d");
    px2(ctx, ox, oy, 2, -34, 1, 1, "#f2a8ce");
    px2(ctx, ox, oy, 6, -34, 1, 1, "#f2a8ce");
    px2(ctx, ox, oy, 6 + rs * 0.5, -31, 1, 3, "#e77fb3");
    px2(ctx, ox, oy, 8 + rs, -30, 1, 2, "#c9506d");
    px2(ctx, ox, oy, 8 + rs, -28.5, 1, 1, "#f2a8ce");
  } else if (hat === "witch") {
    const ws = Math.round(Math.sin(tt * 1.5) * 1);
    px2(ctx, ox, oy, -12, -29, 24, 2, "#33304f");
    px2(ctx, ox, oy, -12, -27, 24, 1, "#242138");
    px2(ctx, ox, oy, -12, -29.5, 24, 0.5, "#4c4763");
    px2(ctx, ox, oy, -11, -30, 6, 1, "#4c4763");
    px2(ctx, ox, oy, -6, -33, 12, 4, "#33304f");
    px2(ctx, ox, oy, -3, -37, 7, 4, "#33304f");
    px2(ctx, ox, oy, -1, -40, 4, 3, "#33304f");
    px2(ctx, ox, oy, 1 + ws * 0.5, -42, 4, 2, "#2b2740");
    px2(ctx, ox, oy, 4 + ws, -43, 2, 1, "#2b2740");
    px2(ctx, ox, oy, -6, -33, 1, 4, "#4c4763");
    px2(ctx, ox, oy, -6, -30, 12, 1, "#4c4763");
    px2(ctx, ox, oy, -1, -30, 3, 1, "#f2c14e");
    px2(ctx, ox, oy, 0, -30, 1, 1, "#7a6326");
    px2(ctx, ox, oy, -5, -30.5, 1, 1, "#c8d4ff");
    if (((tt * 20) % 80) < 5) px2(ctx, ox, oy, -0.5, -30.5, 1, 1, "#ffffff");
  } else if (hat === "circlet") {
    px2(ctx, ox, oy, -5, -27, 10, 1, "#f2c14e");
    px2(ctx, ox, oy, -5, -27.5, 10, 0.5, "#fff1c9");
    px2(ctx, ox, oy, 0, -27, 2, 1, "#8fe3ff");
    px2(ctx, ox, oy, -4, -27, 1, 1, "#fff1c9");
    if (((tt * 20) % 70) < 5) px2(ctx, ox, oy, 0.5, -27.5, 1, 1, "#ffffff");
  } else if (hat === "catears") {
    const cc = hairC || "#3a3550", ccD = shade(cc, 0.7);
    const twk = ((tt * 0.9) % 5) < 0.25 ? -1 : 0;
    px2(ctx, ox, oy, -6, -33 + twk, 3, 2, cc);
    px2(ctx, ox, oy, -5, -35 + twk, 2, 2, cc);
    px2(ctx, ox, oy, -4, -33 + twk, 1, 1, "#e77fb3");
    px2(ctx, ox, oy, -3, -33 + twk, 1, 2, ccD);
    px2(ctx, ox, oy, -5, -35.5 + twk, 1, 0.5, shade(cc, 1.3));
    px2(ctx, ox, oy, 3, -33, 3, 2, cc);
    px2(ctx, ox, oy, 4, -35, 2, 2, cc);
    px2(ctx, ox, oy, 4, -33, 1, 1, "#e77fb3");
    px2(ctx, ox, oy, 5, -33, 1, 2, ccD);
    px2(ctx, ox, oy, 4, -35.5, 1, 0.5, shade(cc, 1.3));
  }
}

function drawHair(ctx, ox, oy, style, c, c2) {
  const cD = shade(c, 0.68), cL = shade(c, 1.3);
  /* base cap over the scalp */
  px2(ctx, ox, oy, -5, -31, 10, 2, c);
  px2(ctx, ox, oy, -6, -30, 2, 4, c);
  px2(ctx, ox, oy, -5, -29, 2, 2, cD);
  px2(ctx, ox, oy, -3, -31, 4, 1, cL);
  px2(ctx, ox, oy, 1, -29, 4, 1, c);       /* fringe over the brow */
  px2(ctx, ox, oy, 3, -28, 2, 1, cD);
  if (style === "short") {
    px2(ctx, ox, oy, -6, -27, 1, 4, c);
    px2(ctx, ox, oy, -6, -24, 1, 1, cD);
  } else if (style === "pixie") {
    px2(ctx, ox, oy, -6, -33, 2, 2, c);
    px2(ctx, ox, oy, -2, -33, 3, 2, cL);
    px2(ctx, ox, oy, 2, -33, 2, 2, c);
    px2(ctx, ox, oy, -4, -32, 2, 1, cD);
    px2(ctx, ox, oy, -6, -27, 1, 3, c);
  } else if (style === "bob") {
    px2(ctx, ox, oy, -7, -29, 2, 9, c);
    px2(ctx, ox, oy, 5, -29, 2, 9, c);
    px2(ctx, ox, oy, -6, -21, 2, 1, c);
    px2(ctx, ox, oy, 5, -21, 2, 1, c);
    px2(ctx, ox, oy, -6, -28, 1, 7, cD);
    px2(ctx, ox, oy, -7, -29, 1, 3, cL);
  } else if (style === "long") {
    px2(ctx, ox, oy, -8, -29, 3, 17, c);
    px2(ctx, ox, oy, -7, -12, 2, 2, c);
    px2(ctx, ox, oy, -6, -28, 1, 14, cD);
    px2(ctx, ox, oy, -8, -27, 1, 10, cL);
    px2(ctx, ox, oy, 5, -29, 2, 6, c);
    px2(ctx, ox, oy, 5, -23, 1, 2, cD);
  } else if (style === "pony") {
    px2(ctx, ox, oy, -8, -28, 2, 5, c);
    px2(ctx, ox, oy, -8, -27, 1, 1, "#f2c14e");
    px2(ctx, ox, oy, -11, -25, 3, 8, c);
    px2(ctx, ox, oy, -10, -17, 2, 3, c);
    px2(ctx, ox, oy, -9, -14, 1, 2, cD);
    px2(ctx, ox, oy, -11, -24, 1, 6, cL);
    px2(ctx, ox, oy, -9, -22, 1, 6, cD);
  } else if (style === "twin") {
    px2(ctx, ox, oy, -9, -27, 3, 9, c);
    px2(ctx, ox, oy, -10, -18, 2, 3, c);
    px2(ctx, ox, oy, -9, -28, 3, 1, "#f2c14e");
    px2(ctx, ox, oy, -9, -24, 1, 6, cL);
    px2(ctx, ox, oy, 7, -27, 3, 9, c);
    px2(ctx, ox, oy, 8, -18, 2, 3, c);
    px2(ctx, ox, oy, 7, -28, 3, 1, "#f2c14e");
    px2(ctx, ox, oy, 9, -24, 1, 6, cD);
  } else if (style === "bun") {
    px2(ctx, ox, oy, -9, -35, 4, 4, c);
    px2(ctx, ox, oy, -8, -36, 2, 1, c);
    px2(ctx, ox, oy, -8, -32, 3, 1, cD);
    px2(ctx, ox, oy, -9, -34, 1, 2, cL);
    px2(ctx, ox, oy, -6, -31, 2, 1, "#f2c14e");
  } else if (style === "braid") {
    px2(ctx, ox, oy, -8, -27, 3, 3, c);
    px2(ctx, ox, oy, -10, -24, 3, 3, cD);
    px2(ctx, ox, oy, -8, -21, 3, 3, c);
    px2(ctx, ox, oy, -10, -18, 3, 3, cD);
    px2(ctx, ox, oy, -8, -15, 3, 3, c);
    px2(ctx, ox, oy, -9, -12, 2, 2, cD);
    px2(ctx, ox, oy, -9, -10, 2, 1, "#f2c14e");
  } else if (style === "kitsune") {
    const cT = c2 || cD;                          /* fall/tip color: gradient hairs supply c2 */
    px2(ctx, ox, oy, -5, -32, 3, 1, c);           /* fox ears: tapered, flicked outward */
    px2(ctx, ox, oy, -5, -34, 2, 2, c);
    px2(ctx, ox, oy, -6, -35, 1, 1, cL);
    px2(ctx, ox, oy, -4, -33, 1, 2, "#d87aa8");   /* inner */
    px2(ctx, ox, oy, 2, -32, 3, 1, c);
    px2(ctx, ox, oy, 3, -34, 2, 2, c);
    px2(ctx, ox, oy, 5, -35, 1, 1, cL);
    px2(ctx, ox, oy, 3, -33, 1, 2, "#d87aa8");
    px2(ctx, ox, oy, -3, -31, 1, 1, "#f2c14e");   /* star stud at the ear base */
    px2(ctx, ox, oy, -8, -29, 3, 12, c);          /* long fall, fading into the tip color */
    px2(ctx, ox, oy, -8, -17, 3, 6, cT);
    px2(ctx, ox, oy, -7, -11, 2, 2, shade(cT, 0.8));
    px2(ctx, ox, oy, -6, -28, 1, 10, cD);
    px2(ctx, ox, oy, -8, -27, 1, 8, cL);
    px2(ctx, ox, oy, 5, -29, 2, 9, c);
    px2(ctx, ox, oy, 5, -20, 2, 4, cT);
    px2(ctx, ox, oy, 5, -23, 1, 2, cD);
    px2(ctx, ox, oy, 4, -27, 1, 6, c);            /* front lock with star clasp */
    px2(ctx, ox, oy, 4, -21, 1, 3, cT);
    px2(ctx, ox, oy, 4, -22, 1, 1, "#f2c14e");
  }
}

function drawCape(ctx, ox, oy, capeId, t, walking) {
  if (!capeId || capeId === "none") return;
  const cape = CAPES.find((c) => c.id === capeId);
  if (!cape) return;
  const c = cape.c, cD = shade(c, 0.66), cL = shade(c, 1.25);
  const trim = cape.trim || cD;
  const lin = cape.lining || shade(c, 0.5);
  if (cape.id === "ninetails") {
    /* a fan of fox tails in the cape slot: nearest tails longest, pink-tipped */
    const tipC = cape.tip || "#e05aa8";
    for (let i = 4; i >= 0; i--) {
      const ph = t * (walking ? 6 : 2.2) + i * 1.3;
      const sw = Math.round(Math.sin(ph) * (walking ? 1.5 : 0.8));
      const bx = -7 - i * 2, by = -8 - i;
      const col = i % 2 ? cD : c;
      px2(ctx, ox, oy, bx, by, 2, 4, col);                    /* root, tucked at the back */
      px2(ctx, ox, oy, bx - 1 + sw * 0.5, by - 3, 2, 3, col); /* mid, curling out */
      px2(ctx, ox, oy, bx - 1 + sw * 0.5, by - 2, 1, 2, cL);  /* rim */
      px2(ctx, ox, oy, bx - 2 + sw, by - 5, 2, 2, tipC);      /* pink tip, up and out */
      px2(ctx, ox, oy, bx - 2 + sw, by - 5, 1, 1, shade(tipC, 1.25));
    }
    return;
  }
  const sway = walking ? Math.sin(t * 9) * 2 : Math.sin(t * 2) * 0.8;
  const s1 = Math.round(sway * 0.5), s2 = Math.round(sway);
  const w1 = Math.round(Math.sin(t * (walking ? 11 : 2.6) + 1.3) * (walking ? 1 : 0.5));
  px2(ctx, ox, oy, -6, -18, 2, 1, trim);                 /* shoulder clasp */
  px2(ctx, ox, oy, -5, -18, 1, 1, "#f2c14e");
  px2(ctx, ox, oy, -8, -17.5, 3, 1, cL);                 /* collar roll */
  px2(ctx, ox, oy, -8, -17, 3, 13, c);                   /* inner panel */
  px2(ctx, ox, oy, -8, -17, 1, 4, cL);
  px2(ctx, ox, oy, -6, -8, 1, 4, lin);                   /* lining glimpse */
  px2(ctx, ox, oy, -10 - s1, -15, 2, 11, c);             /* mid fold */
  px2(ctx, ox, oy, -9 - s1, -14, 1, 9, cD);
  px2(ctx, ox, oy, -12 - s2, -12, 2, 8, c);              /* outer fold */
  px2(ctx, ox, oy, -11 - s2, -11, 1, 6, cD);
  px2(ctx, ox, oy, -11 - s2, -7, 1, 2, lin);             /* lining at the lifted edge */
  px2(ctx, ox, oy, -8, -5, 3, 1, trim);                  /* hem, rippled by the wave */
  px2(ctx, ox, oy, -10 - s1, -5 + w1 * 0.5, 2, 1, trim);
  px2(ctx, ox, oy, -12 - s2, -5 + w1, 2, 1, trim);
  px2(ctx, ox, oy, -7, -4.5, 1, 0.5, shade(trim, 1.25)); /* stitch dots */
  px2(ctx, ox, oy, -10 - s1, -4.5 + w1 * 0.5, 1, 0.5, shade(trim, 1.25));
}

function drawPet(ctx, m, t) {
  const id = m.cos.pet;
  if (!id || id === "none") return;
  const bx = m.x - 26, by = m.y + 7;
  const hover = Math.sin(t * 3 + m.seed) * 1.5;
  const f = m.walking ? Math.floor(t * 8 + m.seed) % 2 : 0;
  drawShadow(ctx, bx, by, 12);
  if (id === "wisp") {
    const yy = by - 24 + hover * 2;
    const gg = ctx.createRadialGradient(bx, yy, 1, bx, yy, 10);
    gg.addColorStop(0, "rgba(143,227,255,0.8)"); gg.addColorStop(1, "rgba(143,227,255,0)");
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = gg; ctx.fillRect(bx - 10, yy - 10, 20, 20);
    ctx.restore();
    px(ctx, bx, yy, -1, -1, 2, 2, "#eafaff");
  } else if (id === "slimelet") {
    const sq = Math.sin(t * 5 + m.seed);
    px(ctx, bx, by, -3, -4 + sq * 0.5, 6, 4 - sq * 0.5, "#6fbf5e");
    px(ctx, bx, by, -4, -2, 8, 2, "#6fbf5e");
    px(ctx, bx, by, -2, -3, 1, 1, "#26232b"); px(ctx, bx, by, 1, -3, 1, 1, "#26232b");
  } else if (id === "cat") {
    const c = "#7a7490";
    px(ctx, bx, by, -4, -4, 7, 3, c);
    px(ctx, bx, by, 2, -7, 4, 4, c);
    px(ctx, bx, by, 2, -8, 1, 1, c); px(ctx, bx, by, 5, -8, 1, 1, c);
    px(ctx, bx, by, 4, -6, 1, 1, "#f2c14e");
    px(ctx, bx, by, -5, -7 + Math.round(Math.sin(t * 4 + m.seed)), 1, 3, c);
    px(ctx, bx, by, -3, -1, 1, 1, c); px(ctx, bx, by, f ? 0 : 1, -1, 1, 1, c);
  } else if (id === "pup") {
    const c = "#8a6b48";
    px(ctx, bx, by, -4, -4, 7, 3, c);
    px(ctx, bx, by, 2, -7, 4, 4, c);
    px(ctx, bx, by, 5, -7, 1, 2, "#6b4a32");
    px(ctx, bx, by, 4, -6, 1, 1, "#26232b");
    px(ctx, bx, by, -5, -5 + Math.round(Math.sin(t * 12)), 2, 1, c);
    px(ctx, bx, by, -3, -1, 1, 1, c); px(ctx, bx, by, f ? 0 : 1, -1, 1, 1, c);
  } else if (id === "owl") {
    const yy = by - 22 + hover * 2;
    const fl = Math.floor(t * 6 + m.seed) % 2;
    const c = "#9a8f7a";
    px(ctx, bx, yy, -2, -5, 5, 6, c);
    px(ctx, bx, yy, fl ? -5 : -6, fl ? -6 : -3, 3, 2, c); px(ctx, bx, yy, fl ? 3 : 4, fl ? -6 : -3, 3, 2, c);
    px(ctx, bx, yy, -1, -4, 1, 1, "#f7e28b"); px(ctx, bx, yy, 1, -4, 1, 1, "#f7e28b");
    px(ctx, bx, yy, 0, -3, 1, 1, "#e8a13b");
  } else if (id === "drake") {
    const yy = by - 18 + hover * 2;
    const fl = Math.floor(t * 7 + m.seed) % 2;
    px(ctx, bx, yy, -3, -4, 7, 4, "#c9503f");
    px(ctx, bx, yy, 3, -6, 3, 3, "#e0654f");
    px(ctx, bx, yy, -5, -3, 2, 1, "#c9503f");
    px(ctx, bx, yy, fl ? -2 : -1, fl ? -8 : -6, 3, 3, "#8a2f24");
    px(ctx, bx, yy, 4, -5, 1, 1, "#f7e28b");
    if (Math.floor(t * 2 + m.seed) % 5 === 0) px(ctx, bx, yy, 7, -5, 1, 1, "#ff8a4a");
  }
}

function drawAccessory(ctx, ox, oy, acc) {
  if (acc === "earrings") {
    px2(ctx, ox, oy, -5, -23, 1, 1, "#f2c14e");
    px2(ctx, ox, oy, -5, -22, 1, 2, "#c78a3b");
    px2(ctx, ox, oy, -5, -20, 1, 1, "#d0455a");
  } else if (acc === "pendant") {
    px2(ctx, ox, oy, -3, -19, 1, 1, "#caa53d");
    px2(ctx, ox, oy, 2, -19, 1, 1, "#caa53d");
    px2(ctx, ox, oy, -2, -18, 4, 1, "#caa53d");
    px2(ctx, ox, oy, -1, -17, 2, 2, "#d0455a");
    px2(ctx, ox, oy, -1, -17, 1, 1, "#f2a0a8");
  } else if (acc === "scarf") {
    px2(ctx, ox, oy, -5, -20, 10, 2, "#c9506d");
    px2(ctx, ox, oy, -5, -18, 10, 1, "#93384a");
    px2(ctx, ox, oy, -7, -18, 2, 5, "#c9506d");
    px2(ctx, ox, oy, -6, -17, 1, 4, "#a84358");
    px2(ctx, ox, oy, -7, -13, 2, 1, "#93384a");
  } else if (acc === "warpaint") {
    px2(ctx, ox, oy, 0, -25, 2, 1, "rgba(208,69,90,0.8)");
    px2(ctx, ox, oy, 3, -25, 2, 1, "rgba(208,69,90,0.8)");
    px2(ctx, ox, oy, -1, -28, 4, 1, "rgba(208,69,90,0.8)");
  } else if (acc === "freckles") {
    px2(ctx, ox, oy, 0, -24, 1, 1, "rgba(150,90,60,0.85)");
    px2(ctx, ox, oy, 3, -24, 1, 1, "rgba(150,90,60,0.85)");
    px2(ctx, ox, oy, 2, -23, 1, 1, "rgba(150,90,60,0.7)");
    px2(ctx, ox, oy, 4, -23, 1, 1, "rgba(150,90,60,0.7)");
  } else if (acc === "foxmarks") {
    px2(ctx, ox, oy, -1, -25, 2, 0.5, "rgba(178,72,40,0.85)"); /* whisker stripes */
    px2(ctx, ox, oy, -1, -24, 2, 0.5, "rgba(178,72,40,0.6)");
    px2(ctx, ox, oy, 3, -25, 2, 0.5, "rgba(178,72,40,0.85)");
    px2(ctx, ox, oy, 3, -24, 2, 0.5, "rgba(178,72,40,0.6)");
  }
}

function swingAngle(m, start, end, dur) {
  if (m.lunge <= 0) return start;
  const p = 1 - m.lunge / dur;
  return start + (end - start) * Math.sin(Math.min(1, p) * Math.PI * 0.5);
}

/* Warrior axe models: a distinct silhouette and material ramp per weapon skin.
   Drawn in hand-local space: the grip is at the origin, the haft runs up to
   about y=-30, and the head hangs off the +x side of its top. Poses: "rest"
   (held upright), "swing" (wide horizontal cleave), "back" (slung across the
   back, small). */
function drawWarriorAxe(ctx, wk, pose, t, seed) {
  const id = wk.id;
  const c = wk.c, cD = wk.cD || shade(wk.c, 0.55), cL = wk.cL || shade(wk.c, 1.3), edge = wk.edge || "#f2f6fc";
  const R = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
  const haft = id === "obsidian" ? "#3a3050" : id === "blood" ? "#4a3b2c" : id === "crystal" ? "#7f95ad" : "#6b4a32";
  const haftD = id === "obsidian" ? "#262038" : id === "blood" ? "#2e2517" : id === "crystal" ? "#5d7085" : "#513723";

  if (pose === "back") {
    R(-1, -18, 3, 18, haft); R(-1, -10, 3, 1, haftD);
    if (id === "gold") { R(-1, -14, 3, 1, "#f2c14e"); R(-1, -6, 3, 1, "#f2c14e"); }
    R(0, -24, 9, 8, cD); R(0, -23, 8, 6, c);
    if (id === "obsidian") { R(6, -24, 3, 2, cL); R(5, -20, 3, 2, cL); R(7, -22, 1, 1, edge); }
    else if (id === "blood") { R(6, -23, 2, 2, cL); R(6, -19, 2, 1, cL); R(7, -21, 1, 1, cD); R(5, -17, 3, 2, c); }
    else if (id === "crystal") { R(1, -22, 2, 3, "#ffffff"); R(3, -26, 2, 3, hexA(c, 0.8)); R(6, -22, 2, 5, hexA(edge, 0.8)); }
    else if (id === "gold") { R(-4, -22, 4, 5, cD); R(-3, -21, 2, 3, c); R(6, -22, 2, 5, cL); R(7, -21, 1, 3, edge); R(0, -21, 2, 2, "#d0455a"); }
    else { R(6, -23, 2, 6, cL); R(7, -22, 1, 4, edge); }
    R(1, -23, 6, 1, cL);
    return;
  }

  /* haft, shared by rest and swing */
  R(-2, -30, 4, 28, haft);
  R(-2, -24, 4, 1, haftD); R(-2, -16, 4, 1, haftD);
  R(-2, -8, 4, 5, haftD); R(-2, -7, 4, 1, shade(haft, 1.35)); R(-2, -5, 4, 1, shade(haft, 1.35));
  if (id === "gold") { R(-2, -26, 4, 1, "#f2c14e"); R(-2, -18, 4, 1, "#f2c14e"); R(-2, -3, 4, 2, "#f2c14e"); R(-2, -3, 1, 1, "#fff1c9"); }

  if (pose === "rest") {
    if (id === "steel") {
      R(-6, -31, 3, 3, "#7f8aa0"); R(-6, -31, 3, 1, "#aeb7c9");
      R(-3, -32, 6, 4, "#7f8aa0"); R(-3, -32, 6, 1, "#aeb7c9");
      R(-1, -36, 12, 13, cD);
      R(0, -35, 10, 11, c);
      R(4, -24, 6, 3, c); R(4, -22, 6, 1, cD);
      R(3, -33, 1, 8, cD);
      R(8, -35, 3, 11, cL); R(10, -33, 1, 8, edge);
      R(8, -24, 3, 2, cL); R(10, -23, 1, 2, edge);
      R(0, -33, 1, 1, "#6f7890"); R(0, -29, 1, 1, "#6f7890"); R(0, -25, 1, 1, "#6f7890");
    } else if (id === "gold") {
      R(-1, -40, 2, 4, "#f2c14e"); R(-1, -40, 1, 2, "#fff1c9");
      R(-7, -35, 6, 10, cD); R(-6, -34, 4, 8, c);
      R(-7, -34, 1, 8, cL); R(-7, -32, 1, 4, edge);
      R(1, -37, 10, 14, cD); R(2, -36, 8, 12, c);
      R(8, -36, 2, 12, cL); R(9, -33, 1, 6, edge);
      R(8, -36, 2, 2, cD); R(8, -26, 2, 2, cD);
      R(2, -31, 6, 1, shade(c, 0.75)); R(-6, -31, 3, 1, shade(c, 0.75));
      R(-1, -33, 3, 3, "#d0455a"); R(-1, -33, 1, 1, "#ff9fae"); R(-1, -31, 3, 1, "#8e2436");
    } else if (id === "obsidian") {
      ctx.fillStyle = "rgba(138,92,255,0.16)"; ctx.fillRect(-3, -40, 17, 18);
      R(1, -40, 3, 2, cD); R(2, -40, 1, 2, c);
      R(-1, -38, 12, 15, cD); R(0, -37, 10, 13, c);
      R(2, -35, 1, 3, cL); R(3, -32, 1, 3, cL); R(4, -29, 1, 3, cL);
      R(9, -37, 3, 3, cL); R(9, -32, 2, 3, cL); R(9, -27, 3, 3, cL);
      R(11, -36, 1, 1, edge); R(10, -31, 1, 1, edge); R(11, -26, 1, 1, edge);
      if (Math.sin(t * 5 + seed) > 0.3) R(10, -33, 1, 4, edge);
    } else if (id === "blood") {
      R(-3, -32, 6, 3, "#5b4a3a"); R(-3, -32, 6, 1, "#7a6248");
      R(-1, -34, 13, 11, cD); R(0, -33, 11, 9, c);
      R(9, -33, 2, 9, cL); R(10, -33, 1, 3, edge);
      R(9, -30, 3, 2, cD); R(9, -26, 3, 1, cD);
      R(6, -24, 5, 2, c); R(9, -23, 2, 2, c); R(10, -21, 1, 2, cD);
      R(6, -24, 4, 1, cL);
      R(2, -31, 1, 1, "#6e1f30"); R(5, -27, 2, 1, "#6e1f30"); R(3, -25, 1, 1, "#3a1810");
      R(1, -30, 2, 2, "#8e2436");
      const dp = (t * 5 + seed * 3) % 6;
      if (dp < 4) R(10, -20 + dp * 1.5, 1, 2, "#8e0f24");
    } else if (id === "crystal") {
      const pl = 0.12 + 0.07 * Math.sin(t * 3 + seed);
      ctx.fillStyle = `rgba(143,227,255,${pl})`; ctx.fillRect(-3, -42, 17, 21);
      R(-3, -32, 6, 3, haftD); R(-3, -32, 6, 1, "#9fb8cc");
      R(1, -42, 2, 4, hexA(c, 0.8)); R(4, -41, 2, 3, hexA(cL, 0.8)); R(7, -40, 2, 2, hexA(c, 0.7));
      R(-1, -39, 13, 16, hexA(c, 0.35));
      R(0, -38, 11, 14, hexA(c, 0.55));
      R(2, -37, 3, 5, hexA(cL, 0.7)); R(5, -33, 3, 5, hexA(cL, 0.7)); R(2, -29, 3, 4, hexA(cL, 0.6));
      R(3, -33, 2, 4, "#ffffff");
      R(10, -38, 1, 14, hexA("#ffffff", 0.8));
      const sp = Math.floor(t * 4 + seed) % 3;
      const spp = [[2, -36], [7, -31], [4, -26]][sp];
      R(spp[0] - 1, spp[1], 3, 1, "#ffffff"); R(spp[0], spp[1] - 1, 1, 3, "#ffffff");
    }
    if (id === "steel" || id === "gold") {
      const gp = ((t * 24 + seed * 37) % 110) / 10;
      if (gp < 3) {
        const gy = -35 + gp * 3.4;
        R(id === "gold" ? 8 : 9, gy, 2, 2, "rgba(255,255,255,0.85)");
        R(id === "gold" ? 7 : 8, gy + 1, 1, 1, "rgba(255,255,255,0.5)");
      }
    }
    return;
  }

  /* swing: the blade sweeps wide and horizontal */
  if (id === "crystal") {
    const pl = 0.1 + 0.06 * Math.sin(t * 3 + seed);
    ctx.fillStyle = `rgba(143,227,255,${pl})`; ctx.fillRect(-13, -39, 26, 15);
    R(-11, -37, 22, 11, hexA(c, 0.35));
    R(-10, -36, 20, 9, hexA(c, 0.55));
    R(-8, -35, 4, 6, hexA(cL, 0.7)); R(-1, -34, 4, 6, hexA(cL, 0.7)); R(6, -35, 4, 6, hexA(cL, 0.6));
    R(-2, -33, 3, 3, "#ffffff");
    R(-10, -28, 20, 1, hexA("#ffffff", 0.8));
    return;
  }
  R(-11, -37, 22, 11, cD);
  R(-10, -36, 20, 9, c);
  if (id === "steel") {
    R(-10, -36, 3, 9, cL); R(7, -36, 3, 9, cL);
    R(-10, -29, 20, 1, cL); R(-10, -28, 20, 1, edge);
    R(-1, -36, 2, 9, "#7f8aa0");
  } else if (id === "gold") {
    R(-10, -36, 2, 2, cD); R(8, -36, 2, 2, cD);
    R(-10, -30, 3, 3, cL); R(7, -30, 3, 3, cL);
    R(-10, -28, 20, 1, cL);
    R(-7, -36, 1, 8, shade(c, 0.75)); R(6, -36, 1, 8, shade(c, 0.75));
    R(-1, -34, 3, 3, "#d0455a"); R(-1, -34, 1, 1, "#ff9fae");
  } else if (id === "obsidian") {
    ctx.fillStyle = "rgba(138,92,255,0.16)"; ctx.fillRect(-12, -38, 24, 14);
    R(-8, -28, 3, 2, cL); R(-2, -28, 3, 2, cL); R(4, -28, 3, 2, cL); R(9, -28, 2, 2, cL);
    R(-7, -26, 1, 1, edge); R(-1, -26, 1, 1, edge); R(5, -26, 1, 1, edge);
    R(-6, -35, 1, 3, cL); R(0, -34, 1, 3, cL); R(6, -35, 1, 3, cL);
  } else if (id === "blood") {
    R(-11, -28, 3, 3, c); R(-12, -26, 2, 2, cD);
    R(-10, -28, 20, 1, cL);
    R(-4, -28, 3, 1, cD); R(3, -28, 3, 1, cD);
    R(-8, -33, 2, 1, "#6e1f30"); R(2, -31, 2, 1, "#6e1f30");
  }
}

/* Shared guard/fitting metals per weapon skin, used by every style's painter. */
const FITTINGS = {
  steel:    { m: "#9aa3b5", hi: "#e3e8f2" },
  gold:     { m: "#f2c14e", hi: "#fff1c9", gem: "#d0455a", gemHi: "#ff9fae" },
  obsidian: { m: "#3a3050", hi: "#8a77b8", gem: "#8a5cff", gemHi: "#cdbcff" },
  blood:    { m: "#5b3a2a", hi: "#7a6248", gem: "#8e0f24", gemHi: "#f27d8d" },
  crystal:  { m: "#9fb8cc", hi: "#d1f4ff", gem: "#ffffff", gemHi: "#ffffff" },
};
function wkRamp(wk) {
  return {
    id: wk.id, c: wk.c,
    cD: wk.cD || shade(wk.c, 0.55), cL: wk.cL || shade(wk.c, 1.3),
    edge: wk.edge || "#f2f6fc", F: FITTINGS[wk.id] || FITTINGS.steel,
    grip: wk.id === "obsidian" ? "#3a3050" : wk.id === "blood" ? "#4a3b2c" : wk.id === "crystal" ? "#7f95ad" : "#6b4a32",
    gripD: wk.id === "obsidian" ? "#262038" : wk.id === "blood" ? "#2e2517" : wk.id === "crystal" ? "#5d7085" : "#513723",
  };
}

/* Paladin longsword, hand-local rotated space: blade up to y=-38, guard at
   y=-8, grip below, pommel at the bottom. */
function drawPaladinBlade(ctx, wk, t, seed) {
  const { id, c, cD, cL, edge, F, grip, gripD } = wkRamp(wk);
  const R = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
  if (id === "obsidian") { ctx.fillStyle = "rgba(138,92,255,0.14)"; ctx.fillRect(-6, -40, 12, 36); }
  if (id === "crystal") {
    const pl = 0.1 + 0.06 * Math.sin(t * 3 + seed);
    ctx.fillStyle = `rgba(143,227,255,${pl})`; ctx.fillRect(-6, -41, 12, 37);
    R(-4, -36, 8, 30, hexA(c, 0.35));
    R(-3, -35, 6, 28, hexA(c, 0.55));
    R(-2, -38, 4, 3, hexA(cL, 0.7));
    R(-1, -33, 1, 22, "#ffffff");
    R(1, -35, 2, 28, hexA("#ffffff", 0.7));
    const sp = Math.floor(t * 4 + seed) % 3;
    const spy = [-32, -22, -14][sp];
    R(-1, spy, 3, 1, "#ffffff"); R(0, spy - 1, 1, 3, "#ffffff");
  } else {
    R(-4, -36, 8, 30, cD);
    R(-3, -35, 6, 28, c);
    R(-2, -38, 4, 3, c); R(-1, -38, 2, 2, cL);
    R(-1, -33, 1, 24, cD);
    R(1, -35, 2, 28, cL); R(2, -33, 1, 24, edge);
    if (id === "gold") { R(-3, -30, 4, 1, shade(c, 0.75)); R(-3, -22, 4, 1, shade(c, 0.75)); R(-3, -14, 4, 1, shade(c, 0.75)); }
    if (id === "obsidian") {
      R(1, -33, 2, 3, cL); R(1, -26, 2, 3, cL); R(1, -19, 2, 3, cL);
      R(3, -32, 1, 1, edge); R(3, -25, 1, 1, edge); R(3, -18, 1, 1, edge);
      if (Math.sin(t * 5 + seed) > 0.3) R(2, -29, 1, 5, edge);
    }
    if (id === "blood") {
      R(1, -28, 2, 2, cD); R(1, -18, 2, 2, cD);
      R(-2, -31, 1, 1, "#6e1f30"); R(0, -24, 1, 1, "#6e1f30"); R(-2, -16, 1, 1, "#3a1810");
      const dp = (t * 5 + seed * 3) % 7;
      if (dp < 4.5) R(-1, -38 + dp * 1.6, 1, 2, "#8e0f24");
    }
    if (id === "steel" || id === "gold") {
      const gp = ((t * 24 + seed * 37) % 120) / 10;
      if (gp < 3) R(1, -35 + gp * 8, 2, 2, "rgba(255,255,255,0.85)");
    }
  }
  R(-8, -8, 16, 4, F.m); R(-8, -8, 16, 1, F.hi); R(-8, -5, 16, 1, shade(F.m, 0.6));
  if (id === "gold") { R(-9, -10, 3, 3, F.m); R(6, -10, 3, 3, F.m); R(-9, -10, 1, 1, F.hi); R(8, -10, 1, 1, F.hi); }
  if (F.gem) { R(-1, -7, 2, 2, F.gem); R(-1, -7, 1, 1, F.gemHi); } else { R(-1, -7, 2, 2, "#d0455a"); }
  R(-2, -4, 4, 9, grip);
  R(-2, -1, 4, 1, gripD); R(-2, 2, 4, 1, gripD);
  R(-3, 5, 6, 3, F.m); R(-3, 5, 6, 1, F.hi);
  if (F.gem && id !== "steel") R(-1, 6, 2, 1, F.gem);
}

/* Rogue dagger, hand-local rotated space; front daggers are a touch longer
   and carry the living effects. */
function drawRogueDagger(ctx, wk, front, t, seed) {
  const { id, c, cD, cL, edge, F } = wkRamp(wk);
  const R = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
  const top = front ? -17 : -15, bh = front ? 14 : 12, ih = bh - 2;
  if (id === "crystal") {
    const pl = 0.1 + 0.05 * Math.sin(t * 3.5 + seed);
    ctx.fillStyle = `rgba(143,227,255,${pl})`; ctx.fillRect(-4.5, top - 2, 9, bh + 4);
    R(-2.5, top, 5, bh, hexA(c, 0.35));
    R(-1.5, top + 1, 3, ih, hexA(c, 0.6));
    R(0, top + 1, 1.5, ih, hexA("#ffffff", 0.75));
    R(-0.5, top + 3, 1, 3, "#ffffff");
    if (front) { const sp = Math.floor(t * 5 + seed) % 2; R(-1, top + 3 + sp * 6, 3, 1, "#ffffff"); }
  } else {
    R(-2.5, top, 5, bh, cD);
    R(-1.5, top + 1, 3, ih, c);
    R(0, top + 1, 1.5, ih, cL);
    R(0.5, top + 2, 1, ih - 2, edge);
    if (id === "gold") R(-1.5, top + 4, 1, ih - 6, shade(c, 0.75));
    if (id === "obsidian") {
      R(0, top + 2, 1.5, 2, cL); R(0, top + 6, 1.5, 2, cL);
      if (front && Math.sin(t * 5 + seed) > 0.35) R(1, top + 3, 0.8, 4, edge);
    }
    if (id === "blood") {
      R(0, top + 5, 1.5, 1.5, cD); R(-1.5, top + 3, 1, 1, "#6e1f30");
      if (front) { const dp = (t * 6 + seed * 3) % 5; if (dp < 3) R(-0.5, top + dp * 1.4, 1, 1.6, "#8e0f24"); }
    }
    if ((id === "steel" || id === "gold") && front) {
      const gp = ((t * 26 + seed * 31) % 100) / 10;
      if (gp < 2.5) R(0, top + 2 + gp * 3.6, 1.2, 1.6, "rgba(255,255,255,0.85)");
    }
  }
  R(front ? -4 : -3.5, front ? -5 : -4, front ? 8 : 7, front ? 3 : 2, F.m);
  R(front ? -4 : -3.5, front ? -5 : -4, front ? 8 : 7, 1, F.hi);
  R(-1.5, -2, 3, front ? 7 : 6, id === "obsidian" ? "#262038" : id === "blood" ? "#2e2517" : "#26232b");
  if (front) { R(-1.5, 0, 3, 1, "#3a3550"); R(-1.5, 3, 3, 1, "#3a3550"); }
  if (F.gem && front) { R(-1, 4.5, 2, 2, F.gem); R(-1, 4.5, 1, 1, F.gemHi); }
}

/* Archer bow, absolute coords centered on (bx, by) with radius r. The string
   and nocked arrow stay with the caller (they track draw progress). */
function drawArcherBow(ctx, wk, bx, by, r, t, seed) {
  const { id, c, cD, cL, edge, F } = wkRamp(wk);
  const R = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
  if (id === "crystal") {
    const pl = 0.1 + 0.05 * Math.sin(t * 3 + seed);
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = `rgba(143,227,255,${pl + 0.15})`; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(bx, by, r, -Math.PI / 2, Math.PI / 2); ctx.stroke();
    ctx.restore();
  }
  ctx.strokeStyle = cD; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(bx, by, r, -Math.PI / 2, Math.PI / 2); ctx.stroke();
  ctx.strokeStyle = id === "crystal" ? hexA(c, 0.75) : c; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(bx, by, r, -Math.PI / 2, Math.PI / 2); ctx.stroke();
  ctx.strokeStyle = cL; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(bx - 1, by, r, -Math.PI / 2 + 0.35, Math.PI / 2 - 0.35); ctx.stroke();
  R(bx - 2, by - r - 3, 4, 4, c); R(bx - 2, by + r - 1, 4, 4, c);
  if (id === "steel") { R(bx - 2, by - r - 3, 4, 1, cL); R(bx - 2, by + r - 1, 4, 1, cL); }
  else if (id === "gold") {
    R(bx - 1, by - r - 5, 2, 2, F.m); R(bx - 1, by + r + 3, 2, 2, F.m);
    R(bx - 1, by - r - 5, 1, 1, F.hi); R(bx - 1, by + r + 3, 1, 1, F.hi);
  } else if (id === "obsidian") {
    R(bx + 1, by - r - 5, 2, 3, cD); R(bx + 1, by + r + 2, 2, 3, cD);
    R(bx + 2, by - r - 4, 1, 1, cL); R(bx + 2, by + r + 3, 1, 1, cL);
    if (Math.sin(t * 5 + seed) > 0.35) R(bx + 2, by - r - 5, 1, 2, edge);
  } else if (id === "blood") {
    R(bx - 2, by - r + 2, 4, 1, "#2e2517"); R(bx - 2, by + r - 3, 4, 1, "#2e2517");
    const dp = (t * 5 + seed * 3) % 7;
    if (dp < 4) R(bx, by + r + 3 + dp, 1, 2, "#8e0f24");
  } else if (id === "crystal") {
    R(bx - 2, by - r - 3, 4, 1, "#ffffff"); R(bx - 2, by + r + 2, 4, 1, "#ffffff");
  }
  R(bx - 2, by - 2, 3, 5, F.m); R(bx - 2, by - 2, 3, 1, F.hi);
  if (F.gem) { R(bx - 1, by, 2, 2, F.gem); R(bx - 1, by, 1, 1, F.gemHi); }
  if (id === "steel" || id === "gold") {
    const gp = ((t * 20 + seed * 29) % 90) / 10;
    if (gp < 3) {
      const a = -Math.PI / 2 + (gp / 3) * Math.PI;
      R(bx + Math.cos(a) * r - 1, by + Math.sin(a) * r - 1, 2, 2, "rgba(255,255,255,0.85)");
    }
  } else if (id === "crystal") {
    const sp = Math.floor(t * 4 + seed) % 3;
    const a = -Math.PI / 2 + (sp + 0.5) * (Math.PI / 3);
    R(bx + Math.cos(a) * r, by + Math.sin(a) * r, 1.5, 1.5, "#ffffff");
  }
}

/* Chainblade head. mode "held": local to the hand, resting at the hip.
   mode "tip": local to the flying whip tip, rotated by the caller. */
function drawChainBlade(ctx, wk, mode, t, seed) {
  const { id, c, cD, cL, edge, F } = wkRamp(wk);
  const R = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
  if (mode === "tip") {
    if (id === "crystal") {
      R(-3, -4, 12, 8, hexA(c, 0.4)); R(-2, -3, 10, 6, hexA(c, 0.6));
      R(6, -3, 2, 6, hexA("#ffffff", 0.8)); R(8, -5, 2, 3, hexA(cL, 0.8));
      R(1, -2, 3, 2, "#ffffff");
    } else {
      R(-3, -4, 12, 8, cD); R(-2, -3, 10, 6, c);
      R(6, -3, 2, 6, cL); R(7, -2, 1, 4, edge); R(8, -5, 2, 3, c);
      if (id === "gold") R(0, -2, 2, 2, F.gem);
      if (id === "obsidian") { R(4, -4, 2, 1, cL); R(4, 2, 2, 1, cL); }
      if (id === "blood") R(2, 2, 2, 1, "#6e1f30");
    }
    return;
  }
  if (id === "crystal") {
    const pl = 0.1 + 0.05 * Math.sin(t * 3 + seed);
    ctx.fillStyle = `rgba(143,227,255,${pl})`; ctx.fillRect(0, -9, 16, 13);
    R(1, -3, 12, 6, hexA(c, 0.4)); R(2, -2, 10, 4, hexA(c, 0.6));
    R(2, -2, 10, 1, hexA("#ffffff", 0.7)); R(10, -6, 3, 7, hexA(cL, 0.75));
    R(5, -1, 3, 2, "#ffffff");
    if (Math.floor(t * 5 + seed) % 2) R(11, -7, 1, 3, "#ffffff");
  } else {
    R(1, -3, 12, 6, cD); R(2, -2, 10, 4, c); R(2, -2, 10, 1, cL);
    R(10, -6, 3, 7, c); R(12, -8, 2, 3, cD);
    R(10, -6, 1, 6, cL); R(11, -5, 1, 4, edge);
    if (id === "gold") { R(4, -2, 1, 4, F.hi); R(6, -1, 2, 2, F.gem); R(6, -1, 1, 1, F.gemHi); }
    if (id === "obsidian") { R(8, -7, 2, 2, cL); if (Math.sin(t * 5 + seed) > 0.35) R(11, -5, 1, 4, edge); }
    if (id === "blood") {
      R(5, 2, 2, 1, "#6e1f30"); R(8, -2, 1, 1, "#3a1810");
      const dp = (t * 6 + seed * 3) % 6;
      if (dp < 3.5) R(12, 1 + dp, 1, 1.6, "#8e0f24");
    }
    if (id === "steel" || id === "gold") {
      const gp = ((t * 24 + seed * 33) % 100) / 10;
      if (gp < 2.5) R(3 + gp * 3, -2, 1.6, 1.4, "rgba(255,255,255,0.85)");
    }
  }
}

/* Mystic staff, drawn on the px2 grid at (ox, oy) like the caller's body. */
function drawMysticStaff(ctx, wk, ox, oy, casting, t, seed) {
  const { id, c, cD, cL, edge, F } = wkRamp(wk);
  const shaft = id === "obsidian" ? "#3a3050" : id === "blood" ? "#4a3b2c" : id === "crystal" ? "#7f95ad" : "#6b4a32";
  const shaftD = id === "obsidian" ? "#262038" : id === "blood" ? "#2e2517" : id === "crystal" ? "#5d7085" : "#513723";
  px2(ctx, ox, oy, 9, -36, 1.5, 26, shaft);
  px2(ctx, ox, oy, 9, -30, 1.5, 1, shaftD);
  px2(ctx, ox, oy, 9, -20, 1.5, 1, shaftD);
  px2(ctx, ox, oy, 7.5, -38, 4.5, 2, F.m);
  px2(ctx, ox, oy, 6, -41, 1.5, 4, F.m);
  px2(ctx, ox, oy, 12, -41, 1.5, 4, F.m);
  px2(ctx, ox, oy, 6, -42, 1, 1, F.hi);
  px2(ctx, ox, oy, 12.5, -42, 1, 1, F.hi);
  if (id === "gold") px2(ctx, ox, oy, 7.5, -38.5, 4.5, 0.8, shade(c, 0.75));
  if (id === "obsidian") { px2(ctx, ox, oy, 5, -40, 1, 1, cL); px2(ctx, ox, oy, 13.5, -40, 1, 1, cL); }
  const glow = casting ? 1 : 0.6 + Math.sin(t * 4 + seed) * 0.3;
  if (id === "crystal") {
    px2(ctx, ox, oy, 7.5, -42, 4.5, 4.5, hexA(c, 0.6));
    px2(ctx, ox, oy, 8, -44, 1.5, 2, hexA(cL, 0.8));
    px2(ctx, ox, oy, 10.5, -43.5, 1, 1.5, hexA(c, 0.7));
    px2(ctx, ox, oy, 8.5, -41, 1.5, 1.5, "#ffffff");
  } else {
    px2(ctx, ox, oy, 7.5, -42, 4.5, 4.5, c);
    px2(ctx, ox, oy, 7.5, -42, 4.5, 1, cL);
    px2(ctx, ox, oy, 8.5, -41, 1.5, 1.5, "#ffffff");
    if (id === "obsidian" && Math.sin(t * 5 + seed) > 0.3) px2(ctx, ox, oy, 11, -42, 1, 1, edge);
    if (id === "blood") { const dp = (t * 5 + seed * 3) % 7; if (dp < 4) px2(ctx, ox, oy, 9.5, -37.5 + dp, 0.8, 1, "#8e0f24"); }
  }
  ctx.fillStyle = `rgba(255,255,255,${glow * 0.45})`;
  const pad = casting ? 3 : 0;
  ctx.fillRect(ox + 15 - pad, oy - 84 - pad, 9 + pad * 2, 9 + pad * 2);
  if (id === "crystal" && Math.floor(t * 4 + seed) % 2) {
    ctx.fillStyle = "#ffffff"; ctx.fillRect(ox + 14 + ((seed * 7) % 1) * 8, oy - 88, 2, 2);
  }
}

function drawAdventurer(ctx, m, t) {
  if (m.feast) { drawFeaster(ctx, m, t); return; }
  let oy = m.y;
  if (m.alive && !m.walking && m.lunge <= 0) oy += Math.round(Math.sin(t * 2.5 + m.seed) * 1.4);
  if (m.hop > 0) oy -= Math.round(Math.abs(Math.sin(((0.7 - m.hop) / 0.7) * Math.PI * 2)) * 6);
  const ox = m.x + (m.lunge > 0 ? Math.sin(((0.25 - m.lunge) / 0.25) * Math.PI) * 13 : 0);

  if (!m.alive) {
    drawShadow(ctx, m.x, m.y, 26);
    px2(ctx, m.x, m.y, -6, -13, 12, 13, "#7a7490");
    px2(ctx, m.x, m.y, -5, -15, 10, 2, "#7a7490");
    px2(ctx, m.x, m.y, -4, -16, 8, 1, "#8d87a3");
    px2(ctx, m.x, m.y, -6, -13, 1, 13, "#8d87a3");
    px2(ctx, m.x, m.y, 4, -13, 2, 13, "#5f5a75");
    px2(ctx, m.x, m.y, -1, -12, 2, 7, "#4c4763");
    px2(ctx, m.x, m.y, -3, -10, 6, 2, "#4c4763");
    px2(ctx, m.x, m.y, 2, -7, 1, 1, "#4c4763");
    px2(ctx, m.x, m.y, 3, -6, 1, 2, "#4c4763");
    px2(ctx, m.x, m.y, -6, -2, 3, 2, "#5a8f5f");
    px2(ctx, m.x, m.y, -4, -14, 3, 1, "#5a8f5f");
    px2(ctx, m.x, m.y, -8, 0, 2, 1, "#4d8f45");
    px2(ctx, m.x, m.y, 6, 0, 2, 1, "#4d8f45");
    drawPet(ctx, m, t); /* the pet keeps vigil by the fallen */
    hpBar(ctx, m.x, m.y + 5, 20, 0, "#7fd069");
    return;
  }

  const f = m.walking ? Math.floor(t * 8 + m.seed) % 2 : 0;
  const hair = HAIRS[m.cos.hair].c, hair2 = HAIRS[m.cos.hair].c2;
  const outfit = OUTFITS[m.cos.outfit].c;
  const wskin = WEAPON_SKINS.find((w) => w.id === m.cos.weapon);
  const tint = wskin.c;
  const sty = m.style;
  const oD = shade(outfit, 0.7), oL = shade(outfit, 1.28);
  const tintD = shade(tint, 0.55);
  const fem = m.cos.body === "f";
  const hx = ox + 8 * P2, hy = oy - 13 * P2;

  drawShadow(ctx, ox, oy, 26);
  if (m.cos.aura !== "none") {
    const auraDef = AURAS.find((a) => a.id === m.cos.aura);
    if (auraDef && auraDef.c) {
      const pl = 0.16 + 0.08 * Math.sin(t * 3 + m.seed);
      const ag = ctx.createRadialGradient(ox, oy, 2, ox, oy, 20);
      ag.addColorStop(0, hexA(auraDef.c, pl)); ag.addColorStop(1, hexA(auraDef.c, 0));
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      ctx.translate(ox, oy); ctx.scale(1, 0.35); ctx.translate(-ox, -oy);
      ctx.fillStyle = ag; ctx.beginPath(); ctx.arc(ox, oy, 20, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      if (auraDef.id === "starfire") {
        /* rising four-point star twinkles */
        ctx.save(); ctx.globalCompositeOperation = "lighter";
        for (let i = 0; i < 4; i++) {
          const ph = t * 1.6 + i * 1.57 + m.seed;
          const sx = ox + Math.sin(ph) * 14;
          const sy = oy - 8 - ((ph * 5) % 22);
          const tw = 0.4 + 0.6 * Math.abs(Math.sin(ph * 3));
          ctx.fillStyle = hexA("#ffe9a0", tw);
          ctx.fillRect(sx - 1, sy, 3, 1); ctx.fillRect(sx, sy - 1, 1, 3);
        }
        ctx.restore();
      }
    }
  }

  /* chainblade whip, behind the body */
  if (sty === "chain" && m.chainT > 0 && m.chainTgt) {
    const dur = 0.34;
    const prog = 1 - m.chainT / dur;
    const HND = { x: hx, y: hy };
    const TGT = { x: m.chainTgt.x, y: m.chainTgt.y };
    const APEX = { x: (HND.x + TGT.x) / 2, y: Math.min(HND.y, TGT.y) - 62 };
    const qp = (a, b, c, tt) => ({
      x: (1 - tt) * (1 - tt) * a.x + 2 * (1 - tt) * tt * b.x + tt * tt * c.x,
      y: (1 - tt) * (1 - tt) * a.y + 2 * (1 - tt) * tt * b.y + tt * tt * c.y,
    });
    let tip, ta;
    if (prog <= 0.5) {
      const s = Math.min(1, prog / 0.5);
      tip = qp(HND, APEX, TGT, s);
      const ahead = qp(HND, APEX, TGT, Math.min(1, s + 0.05));
      ta = Math.atan2(ahead.y - tip.y, ahead.x - tip.x);
      const t0 = Math.max(0, s - 0.35);
      ctx.strokeStyle = "rgba(255,255,255,0.28)"; ctx.lineWidth = 3;
      ctx.beginPath();
      const first = qp(HND, APEX, TGT, t0);
      ctx.moveTo(first.x, first.y);
      for (let k = t0 + 0.06; k <= s; k += 0.06) { const pt = qp(HND, APEX, TGT, k); ctx.lineTo(pt.x, pt.y); }
      ctx.lineTo(tip.x, tip.y);
      ctx.stroke();
    } else {
      const r = (prog - 0.5) / 0.5;
      const rr = r * r;
      tip = { x: TGT.x + (HND.x - TGT.x) * rr, y: TGT.y + (HND.y - TGT.y) * rr };
      ta = Math.atan2(tip.y - HND.y, tip.x - HND.x);
    }
    const bow = prog <= 0.5 ? 26 + 20 * (prog / 0.5) : -8 + 18 * (1 - (prog - 0.5) / 0.5);
    const MID = { x: (HND.x + tip.x) / 2, y: Math.min(HND.y, tip.y) - bow };
    const dist = Math.hypot(tip.x - HND.x, tip.y - HND.y);
    const links = Math.max(2, Math.floor(dist / 8));
    for (let i = 1; i <= links; i++) {
      const pt = qp(HND, MID, tip, i / links);
      ctx.fillStyle = i % 2 ? "#9aa3b5" : "#6f7890";
      ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
      if (i % 2) { ctx.fillStyle = "#c6cddb"; ctx.fillRect(pt.x - 2, pt.y - 2, 2, 2); }
    }
    ctx.save(); ctx.translate(tip.x, tip.y); ctx.rotate(ta);
    drawChainBlade(ctx, wskin, "tip", t, m.seed);
    ctx.restore();
  }

  drawCape(ctx, ox, oy, m.cos.cape, t, m.walking);

  /* back arm (behind the torso) */
  const armSw = m.walking ? (f ? 1 : 0) : 0;
  const backSleeve = sty === "paladin" ? "#7f8aa0" : sty === "warrior" ? SKIN_D : sty === "mystic" ? outfit : oD;
  px2(ctx, ox, oy, -7, -17, 2, 5, backSleeve);
  px2(ctx, ox, oy, -7, -12 + armSw, 2, 2, SKIN);

  /* back-mounted gear, behind the torso */
  if (sty === "archer") {
    px2(ctx, ox, oy, -11, -23, 3, 9, "#6b4a32");
    px2(ctx, ox, oy, -11, -23, 3, 1, "#8a6b48");
    px2(ctx, ox, oy, -11, -22, 1, 8, "#513723");
    px2(ctx, ox, oy, -10, -27, 1, 4, "#a3835c");
    px2(ctx, ox, oy, -9, -28, 1, 5, "#a3835c");
    px2(ctx, ox, oy, -8, -27, 1, 4, "#a3835c");
    px2(ctx, ox, oy, -10, -28, 1, 1, tint);
    px2(ctx, ox, oy, -9, -30, 1, 2, "#d0455a");
    px2(ctx, ox, oy, -8, -28, 1, 1, "#e8e2d0");
  }
  if (sty === "warrior") {
    ctx.save(); ctx.translate(ox - 8, oy - 26); ctx.rotate(-2.3);
    drawWarriorAxe(ctx, wskin, "back", t, m.seed);
    ctx.restore();
  }

  /* legs and boots (the mystic robe covers them) */
  if (sty !== "mystic") {
    const pants = "#3a3550", pantsD = "#2a2740", boot = "#4a3b2c", bootL = "#5d4a36", sole = "#26232b";
    const legB = m.walking && f ? 1 : 0;
    const legF = m.walking && !f ? 1 : 0;
    px2(ctx, ox, oy, -4, -8, 3, 5 - legB, pants);
    px2(ctx, ox, oy, -2, -8, 1, 5 - legB, pantsD);
    px2(ctx, ox, oy, -4, -3 - legB, 3, 3, boot);
    px2(ctx, ox, oy, -4, -3 - legB, 3, 1, bootL);
    px2(ctx, ox, oy, -4, -1 - legB, 4, 1, sole);
    px2(ctx, ox, oy, 1, -8, 3, 5 - legF, pants);
    px2(ctx, ox, oy, 3, -8, 1, 5 - legF, pantsD);
    px2(ctx, ox, oy, 1, -3 - legF, 3, 3, boot);
    px2(ctx, ox, oy, 1, -3 - legF, 3, 1, bootL);
    px2(ctx, ox, oy, 1, -1 - legF, 4, 1, sole);
  }

  /* torso per fighting style */
  if (sty === "paladin") {
    const pl = "#9aa3b5", plL = "#c6cddb", plD = "#6f7890";
    px2(ctx, ox, oy, -6, -19, 12, 8, pl);
    px2(ctx, ox, oy, -5, -19, 10, 1, plL);
    px2(ctx, ox, oy, -6, -19, 1, 8, plD);
    px2(ctx, ox, oy, -4, -15, 9, 1, plD);
    px2(ctx, ox, oy, -2, -19, 4, 10, outfit);
    px2(ctx, ox, oy, -3, -19, 1, 10, "#f2c14e");
    px2(ctx, ox, oy, 2, -19, 1, 10, "#f2c14e");
    px2(ctx, ox, oy, -2, -9, 4, 1, oD);
    px2(ctx, ox, oy, -1, -16, 2, 2, oL);
    px2(ctx, ox, oy, -9, -20, 4, 2, plL);
    px2(ctx, ox, oy, -9, -18, 4, 3, pl);
    px2(ctx, ox, oy, -9, -16, 4, 1, plD);
    px2(ctx, ox, oy, -8, -19, 1, 1, "#f2c14e");
  } else if (sty === "warrior") {
    px2(ctx, ox, oy, -6, -19, 12, 8, SKIN);
    px2(ctx, ox, oy, -5, -19, 10, 1, SKIN_L);
    px2(ctx, ox, oy, -6, -19, 1, 8, SKIN_D);
    px2(ctx, ox, oy, -4, -16, 9, 1, SKIN_D);
    px2(ctx, ox, oy, -1, -14, 1, 3, SKIN_D);
    px2(ctx, ox, oy, -3, -13, 2, 1, SKIN_D);
    px2(ctx, ox, oy, 1, -13, 2, 1, SKIN_D);
    for (let i = 0; i < 6; i++) px2(ctx, ox, oy, -6 + i * 2, -19 + i * 1.5, 2, 1.5, outfit);
    px2(ctx, ox, oy, -10, -22, 6, 4, "#6b4a32");
    px2(ctx, ox, oy, -10, -23, 1, 1, "#8a6b48");
    px2(ctx, ox, oy, -8, -24, 1, 2, "#8a6b48");
    px2(ctx, ox, oy, -6, -23, 1, 1, "#8a6b48");
    px2(ctx, ox, oy, -9, -21, 1, 1, "#a3835c");
    px2(ctx, ox, oy, -7, -22, 1, 1, "#a3835c");
    px2(ctx, ox, oy, 5, -14, 3, 2, "#8a6b48");
  } else if (sty === "archer") {
    px2(ctx, ox, oy, -6, -19, 12, 8, outfit);
    px2(ctx, ox, oy, -5, -19, 10, 1, oL);
    px2(ctx, ox, oy, -6, -19, 1, 8, oD);
    px2(ctx, ox, oy, 0, -18, 1, 5, oD);
    px2(ctx, ox, oy, -1, -17, 1, 1, oD);
    px2(ctx, ox, oy, 1, -16, 1, 1, oD);
    px2(ctx, ox, oy, -6, -12, 12, 1, oD);
    for (let i = 0; i < 5; i++) px2(ctx, ox, oy, 4 - i * 2, -19 + i * 2, 2, 2, "#513723");
  } else if (sty === "rogue") {
    px2(ctx, ox, oy, -6, -19, 12, 8, outfit);
    px2(ctx, ox, oy, -5, -19, 10, 1, oL);
    px2(ctx, ox, oy, -6, -19, 1, 8, oD);
    px2(ctx, ox, oy, -2, -19, 2, 3, oD);
    px2(ctx, ox, oy, 1, -19, 2, 3, oD);
    px2(ctx, ox, oy, 0, -19, 1, 2, SKIN_D);
    for (let i = 0; i < 6; i++) px2(ctx, ox, oy, -5 + i * 2, -18 + i * 1.5, 2, 1.5, "#26232b");
    px2(ctx, ox, oy, -1, -15, 2, 2, "#9aa3b5");
    px2(ctx, ox, oy, -4, -9, 3, 2, "#4a3b2c");
    px2(ctx, ox, oy, -4, -9, 3, 1, "#5d4a36");
    px2(ctx, ox, oy, 2, -9, 2, 2, "#4a3b2c");
    px2(ctx, ox, oy, 5, -20, 4, 2, oD);
  } else if (sty === "chain") {
    px2(ctx, ox, oy, -6, -19, 12, 8, outfit);
    px2(ctx, ox, oy, -5, -19, 10, 1, oL);
    px2(ctx, ox, oy, -6, -19, 1, 8, oD);
    px2(ctx, ox, oy, -5, -18, 10, 1, "#9aa3b5");
    px2(ctx, ox, oy, -5, -15, 10, 1, "#9aa3b5");
    px2(ctx, ox, oy, -5, -12, 10, 1, "#9aa3b5");
    px2(ctx, ox, oy, -5, -18, 1, 1, "#6f7890");
    px2(ctx, ox, oy, 4, -15, 1, 1, "#6f7890");
    px2(ctx, ox, oy, -5, -12, 1, 1, "#6f7890");
    px2(ctx, ox, oy, -1, -15, 2, 1, "#f2c14e");
    px2(ctx, ox, oy, -9, -20, 4, 3, oD);
    px2(ctx, ox, oy, 5, -21, 4, 2, "#c6cddb");
    px2(ctx, ox, oy, 5, -19, 4, 2, "#9aa3b5");
    px2(ctx, ox, oy, 5, -17, 4, 1, "#6f7890");
    px2(ctx, ox, oy, -7, -10, 3, 3, "#9aa3b5");
    px2(ctx, ox, oy, -6, -9, 1, 1, "#6f7890");
  } else {
    /* mystic robe */
    px2(ctx, ox, oy, -5, -19, 10, 7, outfit);
    px2(ctx, ox, oy, -4, -19, 8, 1, oL);
    px2(ctx, ox, oy, -5, -19, 1, 7, oD);
    px2(ctx, ox, oy, -1, -19, 2, 7, "#f2c14e");
    px2(ctx, ox, oy, -2, -19, 1, 7, "#c78a3b");
    px2(ctx, ox, oy, -5, -12, 10, 2, "#f2c14e");
    px2(ctx, ox, oy, 3, -12, 2, 3, "#c78a3b");
    px2(ctx, ox, oy, -6, -10, 12, 4, outfit);
    px2(ctx, ox, oy, -7, -6, 14, 6, outfit);
    px2(ctx, ox, oy, -3, -10, 1, 10, oD);
    px2(ctx, ox, oy, 2, -9, 1, 9, oD);
    px2(ctx, ox, oy, -7, -6, 1, 6, oD);
    px2(ctx, ox, oy, 6, -9, 1, 9, oL);
    px2(ctx, ox, oy, -7, -1, 14, 1, "#f2c14e");
    px2(ctx, ox, oy, -4, -3, 1, 1, "#efeaff");
    px2(ctx, ox, oy, 0, -3, 1, 1, "#efeaff");
    px2(ctx, ox, oy, 4, -3, 1, 1, "#efeaff");
  }

  /* belt (mystic wears a sash instead) */
  if (sty !== "mystic") {
    px2(ctx, ox, oy, -5, -11, 10, 2, "#26232b");
    px2(ctx, ox, oy, 0, -11, 2, 2, "#f2c14e");
    px2(ctx, ox, oy, 0, -10, 1, 1, "#8a6b26");
  }

  /* body silhouette: masc breadth vs fem taper */
  if (!fem) {
    const padC = sty === "warrior" ? SKIN_D : oD;
    const padL = sty === "warrior" ? SKIN : oL;
    px2(ctx, ox, oy, -7.5, -19, 2, 3, padC);
    px2(ctx, ox, oy, 5.5, -19, 2, 3, padC);
    px2(ctx, ox, oy, -7.5, -19, 2, 1, padL);
    px2(ctx, ox, oy, 5.5, -19, 2, 1, padL);
  } else {
    if (sty === "warrior") {
      px2(ctx, ox, oy, -6, -18.5, 12, 3, outfit);
      px2(ctx, ox, oy, -6, -18.5, 12, 1, oL);
      px2(ctx, ox, oy, -6, -16.5, 12, 1, oD);
    }
    const side = shade(sty === "warrior" ? SKIN : outfit, 0.5);
    px2(ctx, ox, oy, -6, -15.5, 1.5, 3, side);
    px2(ctx, ox, oy, 4.5, -15.5, 1.5, 3, side);
    px2(ctx, ox, oy, -5, -13, 1, 2, "rgba(16,14,26,0.30)");
    px2(ctx, ox, oy, 4, -13, 1, 2, "rgba(16,14,26,0.30)");
    if (sty !== "mystic") {
      px2(ctx, ox, oy, -5.5, -12.5, 11, 0.5, oL);
      px2(ctx, ox, oy, -5.5, -12, 11, 1, oD);
    }
    px2(ctx, ox, oy, -3, -18.5, 2, 1, oL);
    px2(ctx, ox, oy, 1.5, -18.5, 2, 1, oL);
  }

  /* outfit construction: collar, hem, cuff trim and a sash on finer cloth */
  const oDef = OUTFITS[m.cos.outfit];
  if (oDef.trim && !(sty === "warrior" && !fem)) {
    if (sty === "mystic") {
      px2(ctx, ox, oy, -7, -1.5, 14, 0.5, oDef.trim);
      px2(ctx, ox, oy, -1, -19, 2, 0.5, oDef.trim);
      px2(ctx, ox, oy, -5, -12.5, 10, 0.5, oDef.trim);
    } else {
      if (sty !== "warrior") px2(ctx, ox, oy, -4, -19, 8, 0.5, oDef.trim);
      px2(ctx, ox, oy, -5, -12.5, 10, 0.5, oDef.trim);
      px2(ctx, ox, oy, -7, -13, 2, 0.5, oDef.trim);
    }
  }
  if (oDef.sash && sty !== "mystic" && !(sty === "warrior" && !fem)) {
    for (let i = 0; i < 5; i++) px2(ctx, ox, oy, 4 - i * 2, -19 + i * 1.6, 2, 1.6, oDef.sash);
    px2(ctx, ox, oy, 4, -19, 2, 0.5, shade(oDef.sash, 1.3));
    px2(ctx, ox, oy, -4.5, -11.5, 2.5, 2, oDef.sash);
    px2(ctx, ox, oy, -4.5, -11.5, 2.5, 0.5, shade(oDef.sash, 1.3));
    px2(ctx, ox, oy, -4, -9.5, 1, 2, shade(oDef.sash, 0.7));
  }

  /* earned gear rendered on the body: armor tiers on the shoulders and chest */
  const grA = m.gear && m.gear.armor;
  if (grA) {
    const gtier = grA.unique ? 5 : ["common", "uncommon", "rare", "epic", "legendary"].indexOf((grA.rarity && grA.rarity.id) || "common");
    const grc = grA.unique ? "#a8f2e2" : (grA.rarity && grA.rarity.color) || "#b6b3c7";
    if (gtier >= 1) {
      px2(ctx, ox, oy, -8, -20, 3, 2.5, "#8b95a8");
      px2(ctx, ox, oy, -8, -20, 3, 1, "#c6cddb");
      px2(ctx, ox, oy, -8, -18, 3, 0.5, "#6f7890");
    }
    if (gtier >= 2) {
      px2(ctx, ox, oy, 5, -20, 3, 2.5, "#8b95a8");
      px2(ctx, ox, oy, 5, -20, 3, 1, "#c6cddb");
      px2(ctx, ox, oy, 5, -18, 3, 0.5, "#6f7890");
      px2(ctx, ox, oy, -8, -20, 3, 0.5, grc);
      px2(ctx, ox, oy, 5, -20, 3, 0.5, grc);
    }
    if (gtier >= 3) {
      px2(ctx, ox, oy, -3.5, -17.5, 7, 2.5, "#9aa3b5");
      px2(ctx, ox, oy, -3.5, -17.5, 7, 1, "#c6cddb");
      px2(ctx, ox, oy, -3.5, -15.5, 7, 0.5, "#6f7890");
      px2(ctx, ox, oy, -0.5, -17, 1.5, 1.5, grc);
    }
    if (gtier >= 4) {
      px2(ctx, ox, oy, -8, -20.5, 3, 0.5, grA.unique ? "#a8f2e2" : "#f2a94e");
      px2(ctx, ox, oy, 5, -20.5, 3, 0.5, grA.unique ? "#a8f2e2" : "#f2a94e");
      const gpl = 0.12 + 0.08 * Math.sin(t * 3.2 + m.seed);
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = hexA(grA.unique ? "#a8f2e2" : "#f2a94e", gpl);
      ctx.fillRect(ox - 17, oy - 42, 34, 12);
      ctx.restore();
    }
  }

  /* head and face */
  px2(ctx, ox, oy, -4, -31, 8, 1, SKIN);
  px2(ctx, ox, oy, -5, -30, 10, 9, SKIN);
  px2(ctx, ox, oy, -4, -21, 8, 1, SKIN_D);
  px2(ctx, ox, oy, -3, -31, 6, 1, SKIN_L);
  px2(ctx, ox, oy, -5, -29, 1, 8, SKIN_D);
  px2(ctx, ox, oy, -4, -22, 8, 1, SKIN_D);
  px2(ctx, ox, oy, -5, -26, 2, 3, SKIN);
  px2(ctx, ox, oy, -4, -25, 1, 1, SKIN_D);
  px2(ctx, ox, oy, -1, -20, 4, 1, SKIN_D);
  const browC = shade(hair, 0.6);
  px2(ctx, ox, oy, 0, -27, 2, 1, browC);
  px2(ctx, ox, oy, 3, -27, 2, 1, browC);
  if (!fem) {
    px2(ctx, ox, oy, -0.5, -27.5, 3, 1, browC);
    px2(ctx, ox, oy, 2.5, -27.5, 3, 1, browC);
    px2(ctx, ox, oy, -4.5, -26, 1, 3, shade(hair, 0.8));
    px2(ctx, ox, oy, -4, -21.5, 1, 1, SKIN_D);
    px2(ctx, ox, oy, 3.5, -21.5, 1, 1, SKIN_D);
  } else {
    px2(ctx, ox, oy, -1, -26.5, 1, 1, "#2b2436");
    px2(ctx, ox, oy, 5, -26.5, 1, 1, "#2b2436");
  }
  px2(ctx, ox, oy, 0, -26, 2, 2, "#f7f4ff");
  px2(ctx, ox, oy, 3, -26, 2, 2, "#f7f4ff");
  px2(ctx, ox, oy, 1, -26, 1, 2, "#2b2436");
  px2(ctx, ox, oy, 4, -26, 1, 2, "#2b2436");
  px2(ctx, ox, oy, 5, -24, 1, 2, SKIN_D);
  if (fem) {
    px2(ctx, ox, oy, 1, -22, 3, 1, "#c96a7a");
    px2(ctx, ox, oy, 2, -22, 1, 1, "#a84f60");
    px2(ctx, ox, oy, -1, -23, 1, 1, "rgba(224,122,110,0.5)");
    px2(ctx, ox, oy, 4, -23, 1, 1, "rgba(224,122,110,0.5)");
  } else {
    px2(ctx, ox, oy, 1, -22, 3, 1, "#8a5a44");
  }
  if (sty === "warrior") {
    px2(ctx, ox, oy, 0, -25, 2, 1, "rgba(208,69,90,0.75)");
    px2(ctx, ox, oy, 3, -25, 2, 1, "rgba(208,69,90,0.75)");
  }
  drawHair(ctx, ox, oy, m.cos.hairstyle, hair, hair2);

  /* trinket charm at the throat, and the weapon-quality glow at the hand */
  const grT = m.gear && m.gear.trinket;
  if (grT) {
    const trc = grT.unique ? "#a8f2e2" : (grT.rarity && grT.rarity.color) || "#b6b3c7";
    px2(ctx, ox, oy, -1, -20, 3, 0.5, "#513723");
    px2(ctx, ox, oy, -0.5, -19.5, 1.5, 1.5, trc);
    if (grT.unique || (grT.rarity && (grT.rarity.id === "epic" || grT.rarity.id === "legendary"))) px2(ctx, ox, oy, -0.5, -19.5, 0.5, 0.5, "#ffffff");
  }
  const grW = m.gear && m.gear.weapon;
  if (grW && (grW.unique || (grW.rarity && (grW.rarity.id === "rare" || grW.rarity.id === "epic" || grW.rarity.id === "legendary")))) {
    const wrc = grW.unique ? "#a8f2e2" : grW.rarity.color;
    const wpl = 0.1 + 0.06 * Math.sin(t * 3.6 + m.seed * 2);
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    const wg = ctx.createRadialGradient(hx, hy, 1, hx, hy, 14);
    wg.addColorStop(0, hexA(wrc, wpl + 0.12));
    wg.addColorStop(1, hexA(wrc, 0));
    ctx.fillStyle = wg; ctx.beginPath(); ctx.arc(hx, hy, 14, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  /* weapons and the near arm */
  if (sty === "paladin") {
    px2(ctx, ox, oy, 4, -16, 3, 3, "#7f8aa0");
    px2(ctx, ox, oy, 5, -14, 3, 3, SKIN);
    const ang = m.lunge > 0 ? swingAngle(m, -1.7, 1.3, 0.25) : 0.45;
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(ang);
    drawPaladinBlade(ctx, wskin, t, m.seed);
    ctx.restore();
    if (m.lunge > 0.05) {
      ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(hx, hy, 27, ang - 1.0, ang - 0.1); ctx.stroke();
    }
    px2(ctx, ox, oy, 7, -19, 5, 9, "#aeb7c9");
    px2(ctx, ox, oy, 7, -19, 5, 1, "#e3e8f2");
    px2(ctx, ox, oy, 7, -18, 1, 8, "#6f7890");
    px2(ctx, ox, oy, 8, -10, 4, 2, "#aeb7c9");
    px2(ctx, ox, oy, 9, -8, 2, 1, "#6f7890");
    px2(ctx, ox, oy, 9, -15, 2, 2, "#f2c14e");
    if (m.ultT > 0 && m.ultTgt) {
      const ua = Math.min(1, m.ultT / 0.7);
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      const bw = 16 + 10 * (1 - ua);
      const lg = ctx.createLinearGradient(0, 0, 0, m.ultTgt.y);
      lg.addColorStop(0, "rgba(255,241,201,0)");
      lg.addColorStop(0.25, `rgba(255,241,201,${0.5 * ua})`);
      lg.addColorStop(1, `rgba(242,193,78,${0.75 * ua})`);
      ctx.fillStyle = lg;
      ctx.fillRect(m.ultTgt.x - bw / 2, 0, bw, m.ultTgt.y);
      ctx.restore();
    }
  } else if (sty === "warrior") {
    px2(ctx, ox, oy, 5, -16, 2, 3, SKIN);
    const ang = m.lunge > 0 ? swingAngle(m, -2.1, 1.4, 0.25) : 0.6;
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(ang);
    drawWarriorAxe(ctx, wskin, m.swing ? "swing" : "rest", t, m.seed);
    ctx.restore();
    if (m.lunge > 0.05) {
      ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(hx, hy, 30, ang - 1.1, ang - 0.15); ctx.stroke();
    }
    if (m.ultT > 0) {
      const spin = (0.55 - m.ultT) * 25;
      ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(ox, oy - 26, 30, spin, spin + 2.2); ctx.stroke();
      ctx.beginPath(); ctx.arc(ox, oy - 26, 22, spin + Math.PI, spin + Math.PI + 2.2); ctx.stroke();
    }
  } else if (sty === "archer") {
    px2(ctx, ox, oy, 5, -18, 2, 4, SKIN);
    px2(ctx, ox, oy, 5, -16, 3, 3, "#6b4a32");
    px2(ctx, ox, oy, 6, -15, 1, 1, "#9aa3b5");
    const bx = ox + 12 * P2, by = oy - 16 * P2, r = 17;
    const pull = m.shootT > 0 ? 0 : clamp(1 - m.atkT / Math.max(0.4, m._st ? m._st.spd : 1), 0, 1);
    drawArcherBow(ctx, wskin, bx, by, r, t, m.seed);
    ctx.strokeStyle = "#e8e2d0"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(bx, by - r); ctx.lineTo(bx - pull * 9, by); ctx.lineTo(bx, by + r); ctx.stroke();
    if (pull > 0.35) {
      ctx.fillStyle = "#8a6b48"; ctx.fillRect(bx - pull * 9, by - 1, 15 + pull * 9, 2);
      ctx.fillStyle = "#d0455a"; ctx.fillRect(bx - pull * 9 - 2, by - 3, 3, 2); ctx.fillRect(bx - pull * 9 - 2, by + 1, 3, 2);
      ctx.fillStyle = tint; ctx.fillRect(bx + 15, by - 2, 5, 4);
    }
  } else if (sty === "rogue") {
    px2(ctx, ox, oy, 4, -16, 3, 3, oD);
    px2(ctx, ox, oy, 5, -14, 3, 3, SKIN);
    const aF = m.lunge > 0 && m.swing ? swingAngle(m, -0.6, 1.2, 0.2) : 0.7;
    const aB = m.lunge > 0 && !m.swing ? swingAngle(m, 2.2, 0.6, 0.2) : 2.6;
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(aF);
    drawRogueDagger(ctx, wskin, true, t, m.seed);
    ctx.restore();
    ctx.save(); ctx.translate(ox - 7 * P2, oy - 13 * P2); ctx.rotate(aB);
    drawRogueDagger(ctx, wskin, false, t, m.seed);
    ctx.restore();
    if (m.lunge > 0.08) {
      ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 3; ctx.beginPath();
      if (m.swing) { ctx.moveTo(ox + 18, oy - 44); ctx.lineTo(ox + 34, oy - 24); }
      else { ctx.moveTo(ox + 18, oy - 24); ctx.lineTo(ox + 34, oy - 44); }
      ctx.stroke();
    }
    if (m.ultT > 0 && m.ultTgt) {
      const uk = Math.floor(t * 24) % 3;
      ctx.strokeStyle = "rgba(220,190,255,0.85)"; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(m.ultTgt.x - 16 + uk * 6, m.ultTgt.y - 16);
      ctx.lineTo(m.ultTgt.x + 16 - uk * 4, m.ultTgt.y + 14);
      ctx.moveTo(m.ultTgt.x + 14 - uk * 5, m.ultTgt.y - 15);
      ctx.lineTo(m.ultTgt.x - 15 + uk * 5, m.ultTgt.y + 13);
      ctx.stroke();
    }
  } else if (sty === "chain") {
    px2(ctx, ox, oy, 4, -16, 3, 3, oD);
    px2(ctx, ox, oy, 5, -14, 3, 3, "#9aa3b5");
    px2(ctx, ox, oy, 7, -13, 1, 1, "#c6cddb");
    if (m.chainT <= 0) {
      ctx.save(); ctx.translate(hx, hy);
      drawChainBlade(ctx, wskin, "held", t, m.seed);
      ctx.restore();
    }
    if (m.ultT > 0 && m.ultTgts) {
      for (const tg of m.ultTgts) {
        const links = Math.max(2, Math.floor(Math.hypot(tg.x - hx, tg.y - hy) / 10));
        for (let i = 1; i <= links; i++) {
          const lx = hx + ((tg.x - hx) * i) / links;
          const ly = hy + ((tg.y - hy) * i) / links + Math.sin(i * 1.3 + t * 20) * 2;
          ctx.fillStyle = i % 2 ? "#9aa3b5" : "#6f7890";
          ctx.fillRect(lx - 2, ly - 2, 4, 4);
        }
      }
    }
  } else {
    /* mystic staff */
    const casting = m.castT > 0;
    px2(ctx, ox, oy, 4, -17, 2, 3, outfit);
    if (casting) px2(ctx, ox, oy, 5, -19, 2, 5, SKIN); else px2(ctx, ox, oy, 5, -15, 2, 4, SKIN);
    drawMysticStaff(ctx, wskin, ox, oy, casting, t, m.seed);
    if (m.ultT > 0) {
      const ua = Math.min(1, m.ultT / 0.8);
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = `rgba(159,232,140,${0.7 * ua})`; ctx.lineWidth = 3;
      ctx.translate(ox, oy); ctx.scale(1, 0.35);
      ctx.beginPath(); ctx.arc(0, 0, 60 * (1.3 - ua), 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      const lg2 = ctx.createLinearGradient(0, 0, 0, oy);
      lg2.addColorStop(0, "rgba(255,241,201,0)");
      lg2.addColorStop(1, `rgba(159,232,140,${0.4 * ua})`);
      ctx.fillStyle = lg2; ctx.fillRect(ox - 20, 0, 40, oy);
      ctx.restore();
    }
  }

  drawHat(ctx, ox, oy, m.cos.hat, outfit, tint, hair, t);
  drawAccessory(ctx, ox, oy, m.cos.accessory);
  px2(ctx, ox, oy, -4, -31, 8, 1, "rgba(255,232,190,0.4)");
  px2(ctx, ox, oy, 3, -30, 1, 4, "rgba(255,232,190,0.3)");
  px2(ctx, ox, oy, 4, -19, 1, 6, "rgba(255,232,190,0.2)");
  px2(ctx, ox, oy, -6, -18, 1, 9, "rgba(15,12,45,0.32)");
  if (m.gear && SLOTS.some((sl) => m.gear[sl] && m.gear[sl].unique)) {
    const tw = Math.floor(t * 7 + m.seed * 3) % 5;
    if (tw < 2) {
      const sxp = ox + (tw ? 14 : -10) + Math.sin(t * 3 + m.seed) * 3;
      const syp = oy - 30 - (tw ? 14 : 4);
      ctx.fillStyle = "#a8f2e2";
      ctx.fillRect(sxp - 1, syp, 3, 1);
      ctx.fillRect(sxp, syp - 1, 1, 3);
    }
  }
  drawPet(ctx, m, t); /* pets walk the front-left lane, never lost behind the cape */
  if (m.noBars) return; /* inspect portraits draw the sprite without HUD */
  /* compact ground-plate HUD below the feet, clear of cosmetics and neighbors */
  hpBar(ctx, ox, oy + 5, 20, m.hp / Math.max(1, m._st ? m._st.hp : m.hp), CLASSES[m.cls].color);
  if (m.ult != null) {
    const uw = 20, ur = clamp(m.ult, 0, 1);
    ctx.fillStyle = "#141221"; ctx.fillRect(ox - uw / 2 - 1, oy + 11, uw + 2, 4);
    ctx.fillStyle = "#3a3550"; ctx.fillRect(ox - uw / 2, oy + 12, uw, 2);
    ctx.fillStyle = ur >= 1 ? (Math.floor(t * 6) % 2 ? "#fff1c9" : "#f2c14e") : "#c78a3b";
    ctx.fillRect(ox - uw / 2, oy + 12, uw * ur, 2);
  }
  if (m.bubble > 0) {
    ctx.fillStyle = "#efeaff"; ctx.fillRect(ox + 10, oy - 106, 26, 15);
    ctx.fillRect(ox + 12, oy - 91, 6, 4);
    ctx.fillStyle = "#33304f";
    for (let i = 0; i < 3; i++) ctx.fillRect(ox + 14 + i * 7, oy - 101, 4, 4);
  }
}

function drawEnemy(ctx, e, t) {
  if (e.hp <= 0) return;
  const s = e.scale || 1;
  const ox = e.x - (e.lunge > 0 ? Math.sin(((0.22 - e.lunge) / 0.22) * Math.PI) * 12 : 0)
           + (e.hitT > 0 ? (e.hitT / 0.15) * 5 : 0)
           + (e.enraged ? Math.sin(t * 30 + e.seed) * 1.2 : 0);
  let oy = e.y;
  if (e.slamT > 0) oy -= Math.round(Math.sin(Math.min(1, (0.45 - e.slamT) / 0.45) * Math.PI) * 34);
  drawShadow(ctx, e.x, e.y, 26 * s);
  if (e.cleaveWind > 0) {
    const cwMax = e.elite ? 0.5 : 0.4;
    const p = clamp(1 - e.cleaveWind / cwMax, 0, 1);
    const rr = (16 + 46 * p) * s;
    ctx.save();
    ctx.translate(e.x, e.y); ctx.scale(1, 0.35); ctx.translate(-e.x, -e.y);
    ctx.globalCompositeOperation = "lighter";
    const rg = ctx.createRadialGradient(e.x, e.y, 2, e.x, e.y, rr);
    rg.addColorStop(0, `rgba(255,120,50,${0.05 + 0.14 * p})`);
    rg.addColorStop(0.7, `rgba(255,150,60,${0.04 + 0.1 * p})`);
    rg.addColorStop(1, "rgba(255,150,60,0)");
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(e.x, e.y, rr, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(255,${Math.round(170 - 90 * p)},70,${0.5 + 0.4 * p})`;
    ctx.lineWidth = 2 + 2 * p;
    ctx.beginPath(); ctx.arc(e.x, e.y, rr, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  if (e.elite) {
    const ar = e.enraged ? 38 : 30;
    const pulse = (e.enraged ? 0.42 : 0.22) + (e.enraged ? 0.2 : 0.12) * Math.sin(t * (e.enraged ? 7 : 3) + e.seed);
    const ag = ctx.createRadialGradient(e.x, e.y, 2, e.x, e.y, ar);
    ag.addColorStop(0, `rgba(${e.enraged ? "255,90,50" : "231,116,99"},${pulse})`);
    ag.addColorStop(1, "rgba(231,116,99,0)");
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.translate(e.x, e.y); ctx.scale(1, 0.35); ctx.translate(-e.x, -e.y);
    ctx.fillStyle = ag; ctx.beginPath(); ctx.arc(e.x, e.y, ar, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.save();
  ctx.translate(ox, oy); ctx.scale(s, s); ctx.translate(-ox, -oy);
  let top = -21;
  if (e.kind === "slime") {
    top = -13;
    const sq = Math.sin(t * 5 + e.seed);
    const c = "#6fbf5e", cd = "#4d8f45", cD = "#3a6e37", cl = "#a8e08c", core = "#d9f7c2";
    px2(ctx, ox, oy, -11, -2, 22, 2, cd);
    px2(ctx, ox, oy, -10, -5, 20, 3, c);
    px2(ctx, ox, oy, -9, -9 + sq, 18, 4, c);
    px2(ctx, ox, oy, -6, -12 + sq, 12, 3, c);
    px2(ctx, ox, oy, -4, -14 + sq, 8, 2, c);
    px2(ctx, ox, oy, 6, -8, 3, 6, cd);
    px2(ctx, ox, oy, 4, -11 + sq, 3, 3, cd);
    px2(ctx, ox, oy, -6, -12 + sq, 4, 2, cl);
    px2(ctx, ox, oy, -7, -10 + sq, 2, 2, cl);
    px2(ctx, ox, oy, -5, -11 + sq, 2, 1, core);
    px2(ctx, ox, oy, 2, -6, 2, 2, cD);
    px2(ctx, ox, oy, -4, -4, 1, 1, cD);
    px2(ctx, ox, oy, 6, -4, 1, 1, cD);
    px2(ctx, ox, oy, -3, -8, 2, 3, "#f4faee");
    px2(ctx, ox, oy, 3, -8, 2, 3, "#f4faee");
    px2(ctx, ox, oy, -3, -7, 2, 2, "#26232b");
    px2(ctx, ox, oy, 3, -7, 2, 2, "#26232b");
    px2(ctx, ox, oy, -3, -8, 1, 1, "#ffffff");
    px2(ctx, ox, oy, 3, -8, 1, 1, "#ffffff");
    px2(ctx, ox, oy, 0, -4, 3, 2, "#2e5b2a");
    px2(ctx, ox, oy, 1, -3, 1, 1, "#e77fb3");
    px2(ctx, ox, oy, -9, -1, 2, 1, cd);
    px2(ctx, ox, oy, 8, -1, 2, 1, cd);
  } else if (e.kind === "bat") {
    top = -25;
    const fl = Math.floor(t * 8 + e.seed) % 2;
    const hov = Math.sin(t * 3 + e.seed) * 4;
    const c = "#5d4a7a", cd = "#463659", cl = "#7a659c", mem = "#3a2d4a";
    const wy = (fl ? -28 : -23) + hov;
    /* back wing */
    px2(ctx, ox, oy, -13, wy, 8, 2, cd);
    px2(ctx, ox, oy, -12, wy + 2, 7, 2, mem);
    px2(ctx, ox, oy, -11, wy + 4, 5, 2, mem);
    px2(ctx, ox, oy, -10, wy, 1, 6, cd);
    px2(ctx, ox, oy, -7, wy, 1, 5, cd);
    /* front wing */
    px2(ctx, ox, oy, 5, wy, 8, 2, cd);
    px2(ctx, ox, oy, 5, wy + 2, 7, 2, mem);
    px2(ctx, ox, oy, 6, wy + 4, 5, 2, mem);
    px2(ctx, ox, oy, 9, wy, 1, 6, cd);
    px2(ctx, ox, oy, 6, wy, 1, 5, cd);
    /* body */
    px2(ctx, ox, oy, -5, -25 + hov, 10, 9, c);
    px2(ctx, ox, oy, -4, -25 + hov, 8, 1, cl);
    px2(ctx, ox, oy, -5, -24 + hov, 1, 7, cd);
    px2(ctx, ox, oy, -3, -20 + hov, 5, 3, cl);
    /* ears */
    px2(ctx, ox, oy, -4, -28 + hov, 2, 3, c);
    px2(ctx, ox, oy, -3, -27 + hov, 1, 2, "#e77fb3");
    px2(ctx, ox, oy, 2, -28 + hov, 2, 3, c);
    px2(ctx, ox, oy, 3, -27 + hov, 1, 2, "#e77fb3");
    /* face */
    px2(ctx, ox, oy, -3, -23 + hov, 7, 1, cd);
    px2(ctx, ox, oy, -2, -22 + hov, 2, 2, "#ff5a5a");
    px2(ctx, ox, oy, 2, -22 + hov, 2, 2, "#ff5a5a");
    px2(ctx, ox, oy, -2, -22 + hov, 1, 1, "#ffd0d0");
    px2(ctx, ox, oy, 2, -22 + hov, 1, 1, "#ffd0d0");
    px2(ctx, ox, oy, -1, -17 + hov, 1, 2, "#ffffff");
    px2(ctx, ox, oy, 2, -17 + hov, 1, 2, "#ffffff");
    /* dangling feet */
    px2(ctx, ox, oy, -2, -16 + hov, 1, 2, cd);
    px2(ctx, ox, oy, 2, -16 + hov, 1, 2, cd);
  } else if (e.kind === "skeleton") {
    top = -28;
    const bone = "#e8e4d4", boneD = "#b8b2a0", boneDD = "#8f8a78", cav = "#1c1a26";
    const f = Math.floor(t * 6 + e.seed) % 2;
    /* legs */
    px2(ctx, ox, oy, -4, -6, 3, 6 - (f ? 1 : 0), bone);
    px2(ctx, ox, oy, -3, -3, 1, 1, boneD);
    px2(ctx, ox, oy, 1, -6, 3, 6 - (f ? 0 : 1), bone);
    px2(ctx, ox, oy, 2, -3, 1, 1, boneD);
    /* pelvis */
    px2(ctx, ox, oy, -5, -9, 10, 3, bone);
    px2(ctx, ox, oy, -3, -8, 2, 1, boneDD);
    px2(ctx, ox, oy, 2, -8, 2, 1, boneDD);
    /* ribcage over a dark cavity */
    px2(ctx, ox, oy, -5, -16, 11, 7, cav);
    px2(ctx, ox, oy, -5, -15, 11, 1, bone);
    px2(ctx, ox, oy, -5, -13, 11, 1, bone);
    px2(ctx, ox, oy, -5, -11, 11, 1, boneD);
    px2(ctx, ox, oy, 0, -16, 2, 7, bone);
    px2(ctx, ox, oy, -6, -17, 12, 2, bone);
    px2(ctx, ox, oy, -6, -16, 12, 1, boneD);
    /* back arm */
    px2(ctx, ox, oy, -7, -16, 2, 5, boneD);
    px2(ctx, ox, oy, -7, -11, 2, 2, bone);
    /* skull */
    px2(ctx, ox, oy, -5, -27, 10, 8, bone);
    px2(ctx, ox, oy, -4, -28, 8, 1, "#f6f3e6");
    px2(ctx, ox, oy, 3, -26, 2, 6, boneD);
    px2(ctx, ox, oy, -4, -25, 3, 3, cav);
    px2(ctx, ox, oy, 1, -25, 3, 3, cav);
    px2(ctx, ox, oy, -3, -24, 1, 1, "#ef6461");
    px2(ctx, ox, oy, 2, -24, 1, 1, "#ef6461");
    px2(ctx, ox, oy, 4, -22, 1, 1, cav);
    px2(ctx, ox, oy, -2, -28, 1, 1, boneDD);
    px2(ctx, ox, oy, -1, -27, 1, 1, boneDD);
    px2(ctx, ox, oy, -1, -26, 1, 1, boneDD);
    /* jaw with teeth gaps */
    px2(ctx, ox, oy, -4, -20, 8, 2, boneD);
    px2(ctx, ox, oy, -3, -20, 1, 1, bone);
    px2(ctx, ox, oy, -1, -20, 1, 1, bone);
    px2(ctx, ox, oy, 1, -20, 1, 1, bone);
    px2(ctx, ox, oy, 3, -20, 1, 1, bone);
    /* sword arm with a rusty notched blade */
    px2(ctx, ox, oy, 5, -15, 2, 4, boneD);
    px2(ctx, ox, oy, 5, -11, 2, 2, bone);
    px2(ctx, ox, oy, 7, -24, 2, 10, "#9aa3b5");
    px2(ctx, ox, oy, 7, -24, 1, 10, "#c9d2de");
    px2(ctx, ox, oy, 8, -21, 1, 1, "#5f6673");
    px2(ctx, ox, oy, 7, -17, 1, 1, "#5f6673");
    px2(ctx, ox, oy, 7, -23, 1, 2, "#7a6a4a");
    px2(ctx, ox, oy, 5, -14, 6, 2, "#6b4a32");
    px2(ctx, ox, oy, 7, -12, 2, 3, "#513723");
  } else {
    top = -21;
    const c = "#c9503f", cl = "#e0654f", cd = "#96382c", belly = "#efa08c";
    const f = Math.floor(t * 7 + e.seed) % 2;
    const eyeC = e.enraged ? "#ff4a3a" : "#f7e28b";
    const sw = Math.round(Math.sin(t * 3 + e.seed) * 1.5);
    /* tail, behind the body */
    px2(ctx, ox, oy, -7, -8, 2, 2, c);
    px2(ctx, ox, oy, -9, -7 + sw, 2, 2, c);
    px2(ctx, ox, oy, -11, -5 + sw, 2, 2, cd);
    px2(ctx, ox, oy, -13, -7 + sw, 2, 3, cd);
    px2(ctx, ox, oy, -14, -6 + sw, 1, 1, cd);
    /* legs with dark hooves */
    px2(ctx, ox, oy, -3, f ? -5 : -6, 3, f ? 5 : 6, c);
    px2(ctx, ox, oy, -3, -1, 3, 1, "#4a2a24");
    px2(ctx, ox, oy, 1, f ? -6 : -5, 3, f ? 6 : 5, c);
    px2(ctx, ox, oy, 1, -1, 3, 1, "#4a2a24");
    /* body */
    px2(ctx, ox, oy, -5, -13, 10, 7, c);
    px2(ctx, ox, oy, -5, -13, 1, 7, cd);
    px2(ctx, ox, oy, 3, -13, 2, 7, cd);
    px2(ctx, ox, oy, -3, -12, 5, 4, belly);
    px2(ctx, ox, oy, -3, -10, 5, 1, "#d98a74");
    /* arms with claws */
    px2(ctx, ox, oy, -7, -12, 2, 4, c);
    px2(ctx, ox, oy, -8, -8, 1, 2, "#e8e2d0");
    px2(ctx, ox, oy, -6, -8, 1, 2, "#e8e2d0");
    px2(ctx, ox, oy, 5, -12, 2, 4, c);
    px2(ctx, ox, oy, 5, -8, 1, 2, "#e8e2d0");
    px2(ctx, ox, oy, 7, -8, 1, 2, "#e8e2d0");
    /* head */
    px2(ctx, ox, oy, -5, -21, 10, 8, cl);
    px2(ctx, ox, oy, -4, -21, 8, 1, "#eb7a62");
    px2(ctx, ox, oy, -5, -20, 1, 7, cd);
    px2(ctx, ox, oy, -4, -18, 9, 1, cd);
    px2(ctx, ox, oy, -3, -17, 2, 2, eyeC);
    px2(ctx, ox, oy, 2, -17, 2, 2, eyeC);
    if (!e.enraged) { px2(ctx, ox, oy, -3, -17, 1, 1, "#fff7d0"); px2(ctx, ox, oy, 2, -17, 1, 1, "#fff7d0"); }
    px2(ctx, ox, oy, 4, -16, 3, 3, cl);
    px2(ctx, ox, oy, 5, -15, 1, 1, cd);
    px2(ctx, ox, oy, 6, -14, 1, 1, cd);
    px2(ctx, ox, oy, -2, -14, 1, 2, "#ffffff");
    px2(ctx, ox, oy, 2, -14, 1, 2, "#ffffff");
    /* horns */
    px2(ctx, ox, oy, -6, -23, 2, 2, "#8a2f24");
    px2(ctx, ox, oy, -7, -26, 2, 3, "#a8443a");
    px2(ctx, ox, oy, -8, -29, 2, 3, "#8a2f24");
    px2(ctx, ox, oy, -7, -25, 1, 1, "#6e251c");
    px2(ctx, ox, oy, 4, -23, 2, 2, "#8a2f24");
    px2(ctx, ox, oy, 5, -26, 2, 3, "#a8443a");
    px2(ctx, ox, oy, 6, -29, 2, 3, "#8a2f24");
    px2(ctx, ox, oy, 6, -25, 1, 1, "#6e251c");
  }
  if (e.boss) {
    px2(ctx, ox, oy, -4, top - 4, 8, 2, "#f2c14e");
    px2(ctx, ox, oy, -4, top - 5, 8, 1, "#c78a3b");
    px2(ctx, ox, oy, -4, top - 6, 2, 2, "#f2c14e");
    px2(ctx, ox, oy, -1, top - 7, 2, 3, "#f2c14e");
    px2(ctx, ox, oy, 2, top - 6, 2, 2, "#f2c14e");
    px2(ctx, ox, oy, -1, top - 7, 1, 1, "#fff1c9");
    px2(ctx, ox, oy, -3, top - 4, 1, 1, "#d0455a");
    px2(ctx, ox, oy, 1, top - 4, 1, 1, "#5aa9e6");
  }
  px2(ctx, ox, oy, -4, top, 8, 1, "rgba(255,232,190,0.22)");
  if (e.elite) {
    px2(ctx, ox, oy, -3, top - 2, 1, 2, "#d0455a");
    px2(ctx, ox, oy, 0, top - 3, 1, 3, "#e77463");
    px2(ctx, ox, oy, 2, top - 2, 1, 2, "#d0455a");
  }
  ctx.restore();
  if (e.windup > 0) {
    const wp = clamp(1 - e.windup / (e.windupMax || 1), 0, 1);
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    const cc = e.kind === "skeleton" ? "138,111,224" : e.kind === "bat" ? "180,120,255" : e.kind === "slime" ? "127,208,105" : "255,120,60";
    const cg = ctx.createRadialGradient(e.x, e.y - 24 * s, 2, e.x, e.y - 24 * s, 30 * s);
    cg.addColorStop(0, `rgba(${cc},${0.12 + wp * 0.30})`); cg.addColorStop(1, `rgba(${cc},0)`);
    ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(e.x, e.y - 24 * s, 30 * s, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (Math.floor(t * 8) % 2) {
      ctx.font = "14px 'Press Start 2P', monospace"; ctx.textAlign = "center";
      ctx.fillStyle = "#141221"; ctx.fillText("!", e.x + 1, e.y - 66 * s - 13);
      ctx.fillStyle = "#ff5a4a"; ctx.fillText("!", e.x, e.y - 66 * s - 14);
    }
  }
  if (e.screechT > 0) {
    const pr = 1 - e.screechT / 0.6;
    ctx.strokeStyle = `rgba(200,160,255,${0.7 * (1 - pr)})`; ctx.lineWidth = 2;
    ctx.save(); ctx.translate(e.x, e.y - 26 * s); ctx.scale(1, 0.6);
    for (let k = 0; k < 3; k++) {
      ctx.beginPath(); ctx.arc(0, 0, Math.max(1, pr * 110 + k * 16), 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }
  if (e.shell > 0) {
    for (let k = 0; k < 4; k++) {
      const a = t * 2.2 + (k * Math.PI) / 2;
      ctx.fillStyle = k % 2 ? "#b8b2a0" : "#e8e4d4";
      ctx.fillRect(e.x + Math.cos(a) * 24 * s - 2, e.y - 26 * s + Math.sin(a) * 10 * s - 3, 4, 7);
    }
  }
  if (e.stunT > 0) {
    for (let i = 0; i < 3; i++) {
      const a = t * 5 + (i * Math.PI * 2) / 3;
      ctx.fillStyle = "#f7e28b";
      ctx.fillRect(e.x + Math.cos(a) * 12 - 2, e.y - 62 * s + Math.sin(a) * 4, 4, 4);
    }
  }
  if (e.poisonT > 0) {
    ctx.fillStyle = "rgba(127,208,105,0.85)";
    ctx.fillRect(ox - 2, oy - 60 * s - Math.sin(t * 6 + e.seed) * 4, 4, 4);
  }
  hpBar(ctx, e.x, e.y - 54 * s, e.boss ? 60 : e.elite ? 40 : 26, e.hp / e.maxHp, "#ef6461");
  if (e.elite) {
    ctx.font = "7px 'Press Start 2P', monospace"; ctx.textAlign = "center";
    ctx.fillStyle = "#e77463"; ctx.fillText(e.name, e.x, e.y - 54 * s - 8);
  }
}


/* ===== the feast: a Nordic mead hall for successful prestiges ===== */
function drawMugAt(ctx, x, y, tilt) {
  ctx.save();
  ctx.translate(x, y);
  if (tilt) ctx.rotate(tilt);
  ctx.fillStyle = "#6b4a32"; ctx.fillRect(-4, -5, 9, 11);
  ctx.fillStyle = "#8a6b48"; ctx.fillRect(-4, -3, 9, 2); ctx.fillRect(-4, 2, 9, 2);
  ctx.fillStyle = "#513723"; ctx.fillRect(4, -5, 1, 11);
  ctx.fillStyle = "#6b4a32"; ctx.fillRect(5, -3, 3, 2); ctx.fillRect(5, 1, 3, 2); ctx.fillRect(7, -2, 2, 4);
  ctx.fillStyle = "#f7f2e2"; ctx.fillRect(-4, -8, 9, 3);
  ctx.fillStyle = "#ffffff"; ctx.fillRect(-3, -9, 3, 2); ctx.fillRect(2, -9, 2, 2);
  ctx.restore();
}
function drawTurkeyLegAt(ctx, x, y, rot) {
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  ctx.fillStyle = "#8a4f26"; ctx.fillRect(-6, -4, 10, 9);
  ctx.fillStyle = "#a3622f"; ctx.fillRect(-5, -3, 8, 6);
  ctx.fillStyle = "#c9803f"; ctx.fillRect(-5, -3, 6, 2);
  ctx.fillStyle = "#efe9d8"; ctx.fillRect(4, -1, 5, 3);
  ctx.fillStyle = "#ffffff"; ctx.fillRect(8, -3, 3, 2); ctx.fillRect(8, 2, 3, 2);
  ctx.restore();
}
function drawWindowN(ctx, cx, wy, ww, wh, t, moon) {
  const x0 = cx - ww / 2;
  ctx.fillStyle = "#241812";
  ctx.fillRect(x0 - 4, wy - 4, ww + 8, wh + 10);
  ctx.fillRect(x0 + 4 - 4, wy - 10, ww - 8 + 8, 8);
  ctx.fillRect(x0 + 10 - 4, wy - 15, ww - 20 + 8, 6);
  /* night sky */
  ctx.fillStyle = "#0c1424";
  ctx.fillRect(x0, wy, ww, wh);
  ctx.fillRect(x0 + 4, wy - 6, ww - 8, 6);
  ctx.fillRect(x0 + 10, wy - 11, ww - 20, 5);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, wy - 11, ww, wh + 11);
  ctx.clip();
  /* stars */
  ctx.fillStyle = "rgba(230,235,255,0.9)";
  for (let i = 0; i < 8; i++) {
    const sx = x0 + ((i * 37 + cx) % ww);
    const sy = wy - 6 + ((i * 23) % (wh - 6));
    const tw = 0.5 + 0.5 * Math.sin(t * 2 + i * 2.2 + cx);
    ctx.globalAlpha = 0.3 + 0.6 * tw;
    ctx.fillRect(sx, sy, 2, 2);
  }
  ctx.globalAlpha = 1;
  if (moon) {
    ctx.fillStyle = "#e8ecf4"; ctx.fillRect(cx + 8, wy + 8, 10, 10);
    ctx.fillStyle = "#c4ccdc"; ctx.fillRect(cx + 11, wy + 11, 3, 3); ctx.fillRect(cx + 15, wy + 9, 2, 2);
  }
  /* aurora */
  ctx.globalCompositeOperation = "lighter";
  for (let k = 0; k < 3; k++) {
    const col = k === 1 ? "143,227,255" : "127,208,105";
    for (let sx = 0; sx < ww; sx += 4) {
      const yy = wy + 10 + k * 12 + Math.sin(t * 0.6 + (x0 + sx) * 0.05 + k * 1.7) * 7;
      const a = 0.10 + 0.08 * Math.sin(t * 0.9 + sx * 0.08 + k);
      ctx.fillStyle = `rgba(${col},${Math.max(0.03, a)})`;
      ctx.fillRect(x0 + sx, yy, 4, 9 - k * 2);
    }
  }
  ctx.restore();
  ctx.globalCompositeOperation = "source-over";
  /* mullions and sill */
  ctx.fillStyle = "#3a2a1c";
  ctx.fillRect(cx - 1, wy - 8, 3, wh + 8);
  ctx.fillRect(x0, wy + wh / 2 - 1, ww, 3);
  ctx.fillStyle = "#4a3626";
  ctx.fillRect(x0 - 6, wy + wh, ww + 12, 4);
}
function drawFlame(ctx, x, y, s, t, seed) {
  const fl = Math.floor(t * 9 + seed) % 2;
  ctx.fillStyle = "#e8642c"; ctx.fillRect(x - 2 * s, y - 3 * s, 4 * s, 4 * s);
  ctx.fillStyle = "#f2a94e"; ctx.fillRect(x - 1 * s, y - (4 + fl) * s, 2 * s, 3 * s);
  ctx.fillStyle = "#ffe9a0"; ctx.fillRect(x - 0.5 * s, y - (2 + fl) * s, s, 2 * s);
}
function drawInnkeep(ctx, x, y, t) {
  const polish = Math.floor(t * 2.2) % 2;
  const bob = Math.round(Math.sin(t * 2.1) * 1);
  /* a broad-shouldered barkeep, visible from the waist up behind the counter */
  ctx.fillStyle = "#7a2f45"; ctx.fillRect(x - 12, y - 26 + bob, 24, 20);         /* tunic */
  ctx.fillStyle = "#93384a"; ctx.fillRect(x - 12, y - 26 + bob, 24, 3);
  ctx.fillStyle = "#e8dcc0"; ctx.fillRect(x - 8, y - 16 + bob, 16, 12);          /* apron */
  ctx.fillStyle = "#c9bda2"; ctx.fillRect(x - 8, y - 16 + bob, 16, 2);
  ctx.fillStyle = SKIN; ctx.fillRect(x - 6, y - 38 + bob, 13, 12);               /* head */
  ctx.fillStyle = SKIN_D; ctx.fillRect(x - 6, y - 28 + bob, 13, 2);
  ctx.fillStyle = "#c94f3d"; ctx.fillRect(x - 7, y - 40 + bob, 15, 4);           /* red hair */
  ctx.fillStyle = "#a83b2c"; ctx.fillRect(x + 3, y - 43 + bob, 5, 4);            /* top knot */
  ctx.fillStyle = "#c94f3d"; ctx.fillRect(x - 7, y - 32 + bob, 4, 12);           /* beard sides */
  ctx.fillRect(x - 5, y - 27 + bob, 11, 7);
  ctx.fillStyle = "#a83b2c"; ctx.fillRect(x - 3, y - 22 + bob, 3, 3); ctx.fillRect(x + 2, y - 22 + bob, 3, 3); /* braids */
  ctx.fillStyle = "#f2c14e"; ctx.fillRect(x - 3, y - 20 + bob, 3, 2); ctx.fillRect(x + 2, y - 20 + bob, 3, 2);
  ctx.fillStyle = "#2b2436"; ctx.fillRect(x - 2, y - 35 + bob, 2, 2); ctx.fillRect(x + 3, y - 35 + bob, 2, 2); /* eyes */
  ctx.fillStyle = SKIN; ctx.fillRect(x - 16, y - 24 + bob, 5, 4 + polish * 2);   /* arms */
  ctx.fillRect(x + 11, y - 24 + bob, 5, 4);
  drawMugAt(ctx, x + 18, y - 24 + bob - polish * 3, polish ? -0.4 : 0);
}
function drawFeastBack(ctx, g) {
  const t = g.time;
  const plate = BG_PLATES["Feast Hall"];
  if (plate) {
    ctx.drawImage(plate, 0, 0, W, H);
  } else {
    /* gable and rafters */
    ctx.fillStyle = "#16100b"; ctx.fillRect(0, 0, W, 48);
    ctx.fillStyle = "#241812";
    ctx.fillRect(0, 8, W, 4); ctx.fillRect(0, 24, W, 4); ctx.fillRect(0, 40, W, 5);
    ctx.fillStyle = "#2e2118";
    for (let i = 0; i < 8; i++) { ctx.fillRect(40 + i * 80, 0, 6, 46); }
    /* walls: horizontal plank courses */
    for (let y = 46; y < GROUND - 6; y += 16) {
      ctx.fillStyle = ((y / 16) | 0) % 2 ? "#33251b" : "#2b1f16";
      ctx.fillRect(0, y, W, 16);
      ctx.fillStyle = "#1f1710";
      ctx.fillRect(((y * 7) % 160) + 40, y + 2, 2, 12);
      ctx.fillRect(((y * 7) % 160) + 240, y + 2, 2, 12);
      ctx.fillRect(((y * 7) % 160) + 440, y + 2, 2, 12);
    }
  }
  /* windows with aurora night */
  drawWindowN(ctx, 80, 78, 52, 74, t, true);
  drawWindowN(ctx, 415, 78, 52, 74, t, false);
  drawWindowN(ctx, 592, 78, 44, 74, t, false);
  /* hanging banner with the guild sigil */
  ctx.fillStyle = "#7a2f45"; ctx.fillRect(330, 56, 30, 48);
  ctx.fillStyle = "#5c2434";
  ctx.fillRect(330, 96, 10, 8); ctx.fillRect(350, 96, 10, 8);
  ctx.fillStyle = "#f2c14e";
  ctx.fillRect(330, 56, 30, 3); ctx.fillRect(330, 92, 30, 2);
  ctx.fillRect(342, 70, 6, 6); ctx.fillRect(344, 66, 2, 14); ctx.fillRect(338, 72, 14, 2);
  /* wall shields */
  for (const sx of [220, 480]) {
    ctx.fillStyle = "#4a3626"; ctx.fillRect(sx - 12, 66, 24, 24);
    ctx.fillStyle = "#93384a"; ctx.fillRect(sx - 10, 68, 20, 10);
    ctx.fillStyle = "#c9a24b"; ctx.fillRect(sx - 10, 78, 20, 10);
    ctx.fillStyle = "#6f7890"; ctx.fillRect(sx - 3, 75, 6, 6);
    ctx.fillStyle = "#2b1f16"; ctx.fillRect(sx - 12, 66, 24, 2);
  }
  /* antlers above the bar */
  ctx.fillStyle = "#d8cfae";
  ctx.fillRect(70, 56, 40, 3);
  ctx.fillRect(74, 50, 3, 8); ctx.fillRect(66, 46, 3, 6); ctx.fillRect(82, 48, 3, 8);
  ctx.fillRect(103, 50, 3, 8); ctx.fillRect(111, 46, 3, 6); ctx.fillRect(95, 48, 3, 8);
  /* hearth with living fire */
  ctx.fillStyle = "#5a5347";
  ctx.fillRect(196, 132, 84, GROUND - 138);
  ctx.fillStyle = "#6b6354";
  for (let i = 0; i < 5; i++) { ctx.fillRect(200 + (i % 2) * 8, 138 + i * 20, 34 - (i % 2) * 8, 16); ctx.fillRect(240 + ((i + 1) % 2) * 8, 138 + i * 20, 34 - ((i + 1) % 2) * 8, 16); }
  ctx.fillStyle = "#3f3a32"; ctx.fillRect(196, 128, 84, 6);
  ctx.fillStyle = "#14100c"; ctx.fillRect(210, 168, 56, GROUND - 174);
  ctx.fillStyle = "#3a2a1c"; ctx.fillRect(216, GROUND - 18, 20, 8); ctx.fillRect(238, GROUND - 14, 22, 7);
  drawFlame(ctx, 230, GROUND - 18, 3, t, 0);
  drawFlame(ctx, 248, GROUND - 16, 2.4, t, 3);
  /* pillars with torches */
  for (const pxl of [186, 470]) {
    ctx.fillStyle = "#3a2a1c"; ctx.fillRect(pxl - 7, 46, 14, GROUND - 46);
    ctx.fillStyle = "#241812"; ctx.fillRect(pxl + 4, 46, 3, GROUND - 46);
    ctx.fillStyle = "#4a3626"; ctx.fillRect(pxl - 7, 96, 14, 4); ctx.fillRect(pxl - 7, 176, 14, 4);
    ctx.fillStyle = "#6f7890"; ctx.fillRect(pxl - 2, 108, 4, 8);
    drawFlame(ctx, pxl, 108, 2, t, pxl);
  }
  /* chandelier */
  ctx.fillStyle = "#2b1f16"; ctx.fillRect(318, 0, 3, 26);
  ctx.fillStyle = "#241812"; ctx.fillRect(276, 26, 88, 6);
  ctx.fillStyle = "#3a2a1c"; ctx.fillRect(276, 26, 88, 2);
  for (let i = 0; i < 5; i++) {
    const cxx = 284 + i * 18;
    ctx.fillStyle = "#e8dcc0"; ctx.fillRect(cxx, 18, 4, 8);
    drawFlame(ctx, cxx + 2, 18, 1.4, t, i * 1.7);
  }
  /* the bar: shelves, bottles, counter */
  ctx.fillStyle = "#221812"; ctx.fillRect(24, 92, 128, 84);
  for (const sy of [104, 132, 160]) { ctx.fillStyle = "#4a3626"; ctx.fillRect(26, sy, 124, 5); }
  const bottleCols = ["#5a8f5f", "#5aa9e6", "#c94f3d", "#c9a24b", "#8a6fe0", "#5a8f5f"];
  bottleCols.forEach((bc, i) => {
    const bx = 34 + i * 19;
    ctx.fillStyle = bc; ctx.fillRect(bx, 88, 7, 15);
    ctx.fillStyle = shade(bc, 0.65); ctx.fillRect(bx + 5, 88, 2, 15);
    ctx.fillStyle = "#2b1f16"; ctx.fillRect(bx + 2, 84, 3, 5);
  });
  for (let i = 0; i < 4; i++) drawMugAt(ctx, 42 + i * 28, 126, 0);
  ctx.fillStyle = "#5a4028"; ctx.fillRect(34, 142, 22, 17); ctx.fillRect(66, 142, 22, 17);
  ctx.fillStyle = "#6f7890"; ctx.fillRect(34, 146, 22, 2); ctx.fillRect(66, 146, 22, 2); ctx.fillRect(34, 153, 22, 2); ctx.fillRect(66, 153, 22, 2);
  drawInnkeep(ctx, 88, 208, t);
  ctx.fillStyle = "#6b4f33"; ctx.fillRect(20, 176, 136, 9);
  ctx.fillStyle = "#8a6b48"; ctx.fillRect(20, 176, 136, 2);
  ctx.fillStyle = "#4a3626"; ctx.fillRect(24, 185, 128, GROUND - 179);
  ctx.fillStyle = "#3a2a1c";
  for (let i = 0; i < 5; i++) ctx.fillRect(34 + i * 26, 188, 2, GROUND - 186);
  drawMugAt(ctx, 40, 172, 0);
  drawMugAt(ctx, 132, 172, 0);
  /* big barrels beside the bar */
  ctx.fillStyle = "#5a4028"; ctx.fillRect(158, 196, 26, GROUND - 190);
  ctx.fillStyle = "#6e5033"; ctx.fillRect(162, 196, 8, GROUND - 190);
  ctx.fillStyle = "#6f7890"; ctx.fillRect(158, 202, 26, 3); ctx.fillRect(158, GROUND - 12, 26, 3);
  /* floor and rug */
  ctx.fillStyle = "#3a2a1c"; ctx.fillRect(0, GROUND - 6, W, H - GROUND + 6);
  ctx.fillStyle = "#33251b";
  for (let i = 0; i < 10; i++) ctx.fillRect(0, GROUND + i * 8, W, 2);
  ctx.fillStyle = "#6e2b3e"; ctx.fillRect(190, GROUND + 4, 290, H - GROUND - 12);
  ctx.fillStyle = "#f2c14e";
  ctx.fillRect(190, GROUND + 4, 290, 2); ctx.fillRect(190, H - 10, 290, 2);
  ctx.fillStyle = "#8a3b52";
  for (let i = 0; i < 6; i++) ctx.fillRect(215 + i * 48, GROUND + 18, 10, 10);
}
function drawFeastFront(ctx, g) {
  const t = g.time;
  /* the long table, in front of the diners */
  ctx.fillStyle = "#6b4f33"; ctx.fillRect(296, GROUND - 30, 182, 8);
  ctx.fillStyle = "#8a6b48"; ctx.fillRect(296, GROUND - 30, 182, 2);
  ctx.fillStyle = "#4a3626"; ctx.fillRect(300, GROUND - 22, 174, 34);
  ctx.fillStyle = "#3a2a1c";
  for (let i = 0; i < 6; i++) ctx.fillRect(310 + i * 28, GROUND - 20, 2, 30);
  ctx.fillStyle = "#2b1f16"; ctx.fillRect(304, GROUND + 12, 12, 6); ctx.fillRect(458, GROUND + 12, 12, 6);
  /* spread on the table */
  ctx.fillStyle = "#c9c3b8"; ctx.fillRect(360, GROUND - 38, 46, 8);
  ctx.fillStyle = "#a3622f"; ctx.fillRect(368, GROUND - 48, 30, 13);
  ctx.fillStyle = "#c9803f"; ctx.fillRect(370, GROUND - 48, 26, 4);
  ctx.fillStyle = "#efe9d8"; ctx.fillRect(364, GROUND - 52, 4, 6); ctx.fillRect(398, GROUND - 52, 4, 6);
  drawMugAt(ctx, 330, GROUND - 34, 0);
  drawMugAt(ctx, 434, GROUND - 34, 0);
  ctx.fillStyle = "#e8c15a"; ctx.fillRect(414, GROUND - 38, 16, 8);
  ctx.fillStyle = "#c78a3b"; ctx.fillRect(414, GROUND - 38, 16, 2); ctx.fillRect(418, GROUND - 34, 3, 2);
  ctx.fillStyle = "#e8dcc0"; ctx.fillRect(344, GROUND - 36, 4, 6);
  drawFlame(ctx, 346, GROUND - 36, 1.2, t, 5);
  /* the arm-wrestling table */
  ctx.fillStyle = "#6b4f33"; ctx.fillRect(526, GROUND - 26, 40, 6);
  ctx.fillStyle = "#8a6b48"; ctx.fillRect(526, GROUND - 26, 40, 2);
  ctx.fillStyle = "#4a3626"; ctx.fillRect(542, GROUND - 20, 8, 22);
  ctx.fillStyle = "#3a2a1c"; ctx.fillRect(536, GROUND, 20, 4);
  /* music notes from singers and dancers */
  ctx.font = "10px monospace";
  for (const m of g.members) {
    if (!m.feast || m.walking) continue;
    if (m.feast.act !== "sing" && m.feast.act !== "dance") continue;
    const nN = m.feast.act === "sing" ? 3 : 1;
    for (let k = 0; k < nN; k++) {
      const ph = ((t * 0.8 + m.feast.seed + k * 0.55) % 1.6) / 1.6;
      if (ph > 0.9) continue;
      const nx = m.x + Math.sin(ph * 5 + k * 2) * 9 + (k - 1) * 7;
      const ny = m.y - 70 - ph * 34;
      ctx.globalAlpha = 1 - ph;
      const nc = k % 2 ? "#8fe3ff" : "#f2c14e";
      ctx.fillStyle = nc;
      ctx.fillRect(nx, ny, 5, 4);
      ctx.fillRect(nx + 4, ny - 8, 2, 10);
      ctx.fillRect(nx + 4, ny - 8, 4, 2);
      ctx.globalAlpha = 1;
    }
  }
  /* names over heads: this party earned them */
  ctx.font = "7px 'Press Start 2P', monospace"; ctx.textAlign = "center";
  for (const m of g.members) {
    ctx.fillStyle = "#14122188"; ctx.fillText(m.name, m.x + 1, m.y - 63);
    ctx.fillStyle = "#efeaff"; ctx.fillText(m.name, m.x, m.y - 64);
  }
}
function drawFeastLight(ctx, g) {
  const t = g.time;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const glow = (x, y, r, col, a) => {
    const gg = ctx.createRadialGradient(x, y, 2, x, y, r);
    gg.addColorStop(0, `rgba(${col},${a})`); gg.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = gg; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  const fl = 0.9 + 0.1 * Math.sin(t * 8);
  glow(238, GROUND - 24, 90, "255,150,60", 0.22 * fl);
  glow(186, 110, 44, "255,170,80", 0.16 * fl);
  glow(470, 110, 44, "255,170,80", 0.16 * fl);
  glow(320, 24, 70, "255,200,120", 0.12);
  glow(346, GROUND - 38, 26, "255,200,120", 0.12 * fl);
  glow(88, 176, 50, "255,180,90", 0.10);
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = "soft-light";
  const cg = ctx.createLinearGradient(0, 0, 0, H);
  cg.addColorStop(0, "rgba(200,120,50,0.5)");
  cg.addColorStop(1, "rgba(90,45,25,0.5)");
  ctx.fillStyle = cg; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = "source-over";
  const vg = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.3, W / 2, H * 0.55, H * 0.95);
  vg.addColorStop(0, "rgba(10,6,4,0)"); vg.addColorStop(1, "rgba(10,6,4,0.55)");
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  ctx.restore();
}
function drawFeastBanner(ctx, g) {
  ctx.fillStyle = "rgba(12,10,20,0.55)";
  ctx.fillRect(0, 0, W, 22);
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fillRect(0, 22, W, 1);
  ctx.font = "8px 'Press Start 2P', monospace"; ctx.textAlign = "center";
  const txt = "THE FEAST OF CHAPTER " + (g.prestiges + 1);
  ctx.fillStyle = "#f2c14e";
  ctx.fillText(txt, W / 2, 15);
  const tw = ctx.measureText(txt).width;
  drawMugAt(ctx, W / 2 - tw / 2 - 18, 12, -0.15);
  drawMugAt(ctx, W / 2 + tw / 2 + 18, 12, 0.15);
  ctx.font = "7px 'Press Start 2P', monospace"; ctx.textAlign = "right";
  ctx.fillStyle = "#cfc9e8";
  ctx.fillText(Math.ceil(Math.max(0, g.feastT || 0)) + "s", W - 8, 15);
}
function drawFeaster(ctx, m, t) {
  drawPet(ctx, m, t);
  const fs = m.feast || {};
  const act = fs.act || "dance";
  let oy = m.y;
  if (act === "dance" && !m.walking) oy -= Math.round(Math.abs(Math.sin(t * 6 + fs.seed)) * 5);
  else if (!m.walking) oy += Math.round(Math.sin(t * 2.5 + m.seed) * 1.2);
  const ox = m.x;
  let face = fs.face || 1;
  if (act === "dance" && !m.walking) face = Math.sin(t * 1.6 + fs.seed) > 0 ? 1 : -1;
  drawShadow(ctx, ox, m.y, 26);
  ctx.save();
  if (face === -1) { ctx.translate(ox, 0); ctx.scale(-1, 1); ctx.translate(-ox, 0); }
  const f = m.walking ? Math.floor(t * 8 + m.seed) % 2 : 0;
  const hair = HAIRS[m.cos.hair].c, hair2 = HAIRS[m.cos.hair].c2;
  const outfit = OUTFITS[m.cos.outfit].c;
  const oD = shade(outfit, 0.7), oL = shade(outfit, 1.28);
  const fem = m.cos.body === "f";
  drawCape(ctx, ox, oy, m.cos.cape, t, m.walking);
  /* legs: dancers kick, everyone else stands */
  const pants = "#3a3550", pantsD = "#2a2740", boot = "#4a3b2c", bootL = "#5d4a36", sole = "#26232b";
  let legB = m.walking && f ? 1 : 0, legF = m.walking && !f ? 1 : 0;
  if (act === "dance" && !m.walking) { const db = Math.floor(t * 6 + fs.seed) % 2; legB = db; legF = 1 - db; }
  px2(ctx, ox, oy, -4, -8, 3, 5 - legB, pants);
  px2(ctx, ox, oy, -2, -8, 1, 5 - legB, pantsD);
  px2(ctx, ox, oy, -4, -3 - legB, 3, 3, boot);
  px2(ctx, ox, oy, -4, -3 - legB, 3, 1, bootL);
  px2(ctx, ox, oy, -4, -1 - legB, 4, 1, sole);
  px2(ctx, ox, oy, 1, -8, 3, 5 - legF, pants);
  px2(ctx, ox, oy, 3, -8, 1, 5 - legF, pantsD);
  px2(ctx, ox, oy, 1, -3 - legF, 3, 3, boot);
  px2(ctx, ox, oy, 1, -3 - legF, 3, 1, bootL);
  px2(ctx, ox, oy, 1, -1 - legF, 4, 1, sole);
  /* off-duty tunic for everyone */
  px2(ctx, ox, oy, -6, -19, 12, 8, outfit);
  px2(ctx, ox, oy, -5, -19, 10, 1, oL);
  px2(ctx, ox, oy, -6, -19, 1, 8, oD);
  px2(ctx, ox, oy, 0, -18, 1, 4, oD);
  px2(ctx, ox, oy, -5, -11, 10, 2, "#26232b");
  px2(ctx, ox, oy, 0, -11, 2, 2, "#f2c14e");
  if (fem) {
    px2(ctx, ox, oy, -5, -13, 1, 2, "rgba(16,14,26,0.30)");
    px2(ctx, ox, oy, 4, -13, 1, 2, "rgba(16,14,26,0.30)");
  }
  /* head */
  px2(ctx, ox, oy, -4, -31, 8, 1, SKIN);
  px2(ctx, ox, oy, -5, -30, 10, 9, SKIN);
  px2(ctx, ox, oy, -4, -21, 8, 1, SKIN_D);
  px2(ctx, ox, oy, -3, -31, 6, 1, SKIN_L);
  px2(ctx, ox, oy, -5, -29, 1, 8, SKIN_D);
  px2(ctx, ox, oy, -4, -22, 8, 1, SKIN_D);
  px2(ctx, ox, oy, -5, -26, 2, 3, SKIN);
  px2(ctx, ox, oy, -1, -20, 4, 1, SKIN_D);
  const browC = shade(hair, 0.6);
  const merry = act === "sing" || act === "dance" || (act === "drink" && ((t * 0.8 + fs.seed) % 3) < 0.7);
  px2(ctx, ox, oy, 0, -27, 2, 1, browC);
  px2(ctx, ox, oy, 3, -27, 2, 1, browC);
  if (merry) {
    /* happy closed eyes */
    px2(ctx, ox, oy, 0, -25, 2, 1, "#2b2436");
    px2(ctx, ox, oy, 3, -25, 2, 1, "#2b2436");
  } else {
    px2(ctx, ox, oy, 0, -26, 2, 2, "#f7f4ff");
    px2(ctx, ox, oy, 3, -26, 2, 2, "#f7f4ff");
    px2(ctx, ox, oy, 1, -26, 1, 2, "#2b2436");
    px2(ctx, ox, oy, 4, -26, 1, 2, "#2b2436");
  }
  px2(ctx, ox, oy, 5, -24, 1, 2, SKIN_D);
  /* feast-flushed cheeks for all */
  px2(ctx, ox, oy, -1, -23, 1, 1, "rgba(224,122,110,0.55)");
  px2(ctx, ox, oy, 4, -23, 1, 1, "rgba(224,122,110,0.55)");
  if (act === "sing") {
    px2(ctx, ox, oy, 1, -23, 3, 2, "#5a2f35");
    px2(ctx, ox, oy, 2, -22, 1, 1, "#e77fb3");
  } else if (act === "wrestle") {
    px2(ctx, ox, oy, 1, -22, 3, 1, "#f7f4ff");
  } else if (fem) {
    px2(ctx, ox, oy, 1, -22, 3, 1, "#c96a7a");
  } else {
    px2(ctx, ox, oy, 1, -22, 3, 1, "#8a5a44");
  }
  drawHair(ctx, ox, oy, m.cos.hairstyle, hair, hair2);
  /* activity arms and props */
  if (act === "drink") {
    px2(ctx, ox, oy, -7, -17, 2, 5, oD);
    px2(ctx, ox, oy, -7, -12, 2, 2, SKIN);
    const swig = ((t * 0.8 + fs.seed) % 3) < 0.7;
    if (swig) {
      px2(ctx, ox, oy, 4, -20, 2, 3, oD);
      px2(ctx, ox, oy, 5, -23, 2, 3, SKIN);
      drawMugAt(ctx, ox + 15, oy - 48, -0.7);
      if (Math.floor(t * 6 + fs.seed) % 3 === 0) { px2(ctx, ox, oy, 9, -21, 1, 1, "#f7f2e2"); }
    } else {
      px2(ctx, ox, oy, 4, -16, 3, 3, oD);
      px2(ctx, ox, oy, 5, -14, 3, 2, SKIN);
      drawMugAt(ctx, ox + 15, oy - 26, 0);
    }
  } else if (act === "eat") {
    px2(ctx, ox, oy, -7, -17, 2, 5, oD);
    px2(ctx, ox, oy, -7, -12, 2, 2, SKIN);
    const bite = ((t * 1.1 + fs.seed) % 2) < 0.55;
    if (bite) {
      px2(ctx, ox, oy, 4, -20, 2, 3, oD);
      px2(ctx, ox, oy, 5, -23, 2, 3, SKIN);
      drawTurkeyLegAt(ctx, ox + 17, oy - 46, -0.5);
      if (Math.floor(t * 8 + fs.seed) % 4 === 0) px2(ctx, ox, oy, 8, -19 + (Math.floor(t * 10) % 3), 1, 1, "#c9803f");
    } else {
      px2(ctx, ox, oy, 4, -16, 3, 3, oD);
      px2(ctx, ox, oy, 5, -14, 3, 2, SKIN);
      drawTurkeyLegAt(ctx, ox + 17, oy - 26, 0.2);
    }
  } else if (act === "sing") {
    px2(ctx, ox, oy, -8, -21, 2, 4, oD);
    px2(ctx, ox, oy, -9, -23, 2, 2, SKIN);
    px2(ctx, ox, oy, 6, -21, 2, 4, oD);
    px2(ctx, ox, oy, 7, -23, 2, 2, SKIN);
  } else if (act === "dance") {
    const a = Math.floor(t * 6 + fs.seed) % 2;
    if (a) {
      px2(ctx, ox, oy, -8, -22, 2, 4, oD);
      px2(ctx, ox, oy, -9, -24, 2, 2, SKIN);
      px2(ctx, ox, oy, 5, -15, 3, 2, oD);
      px2(ctx, ox, oy, 7, -14, 2, 2, SKIN);
    } else {
      px2(ctx, ox, oy, -7, -15, 3, 2, oD);
      px2(ctx, ox, oy, -9, -14, 2, 2, SKIN);
      px2(ctx, ox, oy, 6, -22, 2, 4, oD);
      px2(ctx, ox, oy, 7, -24, 2, 2, SKIN);
    }
  } else if (act === "wrestle") {
    px2(ctx, ox, oy, -7, -17, 2, 5, oD);
    px2(ctx, ox, oy, -7, -12, 2, 2, SKIN);
    if (m.walking) {
      /* still striding to the table: arms at the sides, no reach yet */
      px2(ctx, ox, oy, 6, -17, 2, 5, oD);
      px2(ctx, ox, oy, 6, -12, 2, 2, SKIN);
    } else {
      const wob = Math.sin(t * 7 + (fs.pairSeed || 0)) * 2;
      const yo = Math.round((fs.face === -1 ? -wob : wob));
      const reach = Math.min(16, Math.max(6, Math.round(Math.abs((fs.midX || (m.x + 22)) - m.x) / 2)));
      px2(ctx, ox, oy, 4, -17, 3, 2, oD);
      px2(ctx, ox, oy, 6, -17 + yo * 0.5, reach - 6, 2, SKIN);
      px2(ctx, ox, oy, reach - 1, -18 + yo, 3, 3, SKIN);
      px2(ctx, ox, oy, reach, -18 + yo, 1, 1, SKIN_D);
      if (Math.abs(wob) > 1.6) px2(ctx, ox, oy, 3, -28, 1, 1, "#8fe3ff");
    }
  }
  drawHat(ctx, ox, oy, m.cos.hat, outfit, WEAPON_SKINS.find((w) => w.id === m.cos.weapon).c, hair, t);
  drawAccessory(ctx, ox, oy, m.cos.accessory);
  px2(ctx, ox, oy, -4, -31, 8, 1, "rgba(255,232,190,0.28)");
  ctx.restore();
}

function drawBossTelegraphs(ctx, g) {
  const t = g.time;
  for (const e of g.enemies) {
    if (!e.boss || e.hp <= 0 || !(e.windup > 0)) continue;
    const p = clamp(1 - e.windup / (e.windupMax || 1), 0, 1);
    const puls = 0.5 + 0.5 * Math.sin(t * 10);
    if (e.kind === "imp") {
      for (const m of g.members) {
        if (!m.alive) continue;
        ctx.strokeStyle = `rgba(255,80,50,${0.25 + 0.45 * p * puls})`;
        ctx.lineWidth = 2;
        ctx.save(); ctx.translate(m.x, m.y); ctx.scale(1, 0.35);
        ctx.beginPath(); ctx.arc(0, 0, 16 + 6 * (1 - p), 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(22, 0); ctx.moveTo(0, -22); ctx.lineTo(0, 22); ctx.stroke();
        ctx.restore();
      }
    } else if (e.kind === "slime") {
      const xs = g.members.filter((m) => m.alive).map((m) => m.x);
      const cx = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 150;
      ctx.strokeStyle = `rgba(127,208,105,${0.3 + 0.4 * p * puls})`;
      ctx.lineWidth = 3;
      ctx.save(); ctx.translate(cx, GROUND); ctx.scale(1, 0.35);
      ctx.beginPath(); ctx.arc(0, 0, 80 * (0.4 + 0.6 * p), 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 56 * (0.4 + 0.6 * p), 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    } else if (e.kind === "skeleton") {
      ctx.save(); ctx.translate(e.x, e.y); ctx.scale(1, 0.35);
      ctx.strokeStyle = `rgba(138,111,224,${0.35 + 0.35 * puls})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = `rgba(180,160,255,${0.5 + 0.4 * puls})`;
      for (let k = 0; k < 5; k++) {
        const a = t * 1.5 + (k * Math.PI * 2) / 5;
        ctx.fillRect(Math.cos(a) * 34 - 2, Math.sin(a) * 34 - 2, 5, 5);
      }
      ctx.restore();
    } else if (e.kind === "bat") {
      ctx.strokeStyle = `rgba(200,160,255,${0.25 + 0.4 * p * puls})`; ctx.lineWidth = 2;
      ctx.save(); ctx.translate(e.x, e.y - 26 * (e.scale || 1)); ctx.scale(1, 0.5);
      for (let k = 1; k <= 2; k++) { ctx.beginPath(); ctx.arc(0, 0, 18 * k * (0.5 + 0.5 * p), 0, Math.PI * 2); ctx.stroke(); }
      ctx.restore();
    }
  }
}

function drawTimeline(ctx, g) {
  const y = 13, x0 = 110, right = W - 14;
  const sp = (W - 150) / 10;
  /* progress through the current stage: walk-in, then enemy HP burned down */
  let p = 0;
  if (g.phase === "advance") p = clamp(1 - (g.advanceT || 0) / 2.4, 0, 1) * 0.35;
  else if (g.phase === "combat") {
    let hp = 0, mx = 0;
    for (const e of g.enemies) { hp += Math.max(0, e.hp); mx += e.maxHp; }
    if (mx > 0) p = 0.35 + 0.55 * clamp(1 - hp / mx, 0, 1);
  }
  /* backing band */
  ctx.fillStyle = "rgba(12,10,20,0.55)";
  ctx.fillRect(0, 0, W, 22);
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fillRect(0, 22, W, 1);
  /* track */
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.fillRect(92, y, right - 92, 2);
  ctx.font = "7px 'Press Start 2P', monospace";
  ctx.textAlign = "left";
  const ready = g.stage % 20 === 0;
  ctx.fillStyle = ready ? ("rgba(242,193,78," + (0.7 + 0.3 * Math.sin(g.time * 4)).toFixed(3) + ")") : "#f2c14e";
  ctx.fillText("STAGE " + g.stage, 6, 16);
  const hits = [];
  /* pulsing tome beside the label on the chapter's finale stage */
  if (ready) {
    const bx = 6 + ctx.measureText("STAGE " + g.stage).width + 7;
    if (bx < 76) {
      ctx.globalAlpha = 0.7 + 0.3 * Math.sin(g.time * 4);
      ctx.fillStyle = "#6a4a9e"; ctx.fillRect(bx, 6, 8, 9);
      ctx.fillStyle = "#4e3675"; ctx.fillRect(bx, 6, 2, 9);
      ctx.fillStyle = "#efeaff"; ctx.fillRect(bx + 7, 7, 1, 7);
      ctx.fillStyle = "#f2c14e"; ctx.fillRect(bx + 3, 8, 3, 1); ctx.fillRect(bx + 3, 12, 3, 1);
      ctx.globalAlpha = 1;
      hits.push({ x: bx + 4, kind: "ready" });
    }
  }
  /* upcoming encounters scroll beneath the fixed party marker */
  for (let i = 0; i < 12; i++) {
    const st = g.stage + i;
    const x = Math.round(x0 + (i - p) * sp);
    if (x < 96 || x > right - 4) continue;
    const zc = ZONES[Math.floor((st - 1) / 5) % ZONES.length].top;
    ctx.globalAlpha = x < x0 ? 0.35 : 1;
    if (st % 20 === 0 && st !== g.stage) {
      /* the chapter finale ahead: a purple tome on the road */
      ctx.fillStyle = "rgba(176,127,224," + (0.2 + 0.12 * Math.sin(g.time * 3)).toFixed(3) + ")";
      ctx.fillRect(x - 7, 1, 14, 15);
      ctx.fillStyle = "#6a4a9e"; ctx.fillRect(x - 4, 3, 8, 9);
      ctx.fillStyle = "#4e3675"; ctx.fillRect(x - 4, 3, 2, 9);
      ctx.fillStyle = "#efeaff"; ctx.fillRect(x + 3, 4, 1, 7);
      ctx.fillStyle = "#f2c14e"; ctx.fillRect(x - 1, 5, 3, 1); ctx.fillRect(x - 1, 9, 3, 1);
      ctx.fillRect(x - 1, 12, 2, 3);
      hits.push({ x, st, kind: "tale" });
    } else if (st % 5 === 0) {
      /* boss: crown */
      ctx.fillStyle = "#f2c14e";
      ctx.fillRect(x - 4, 4, 2, 2); ctx.fillRect(x - 1, 3, 2, 3); ctx.fillRect(x + 2, 4, 2, 2);
      ctx.fillRect(x - 4, 6, 8, 3);
      ctx.fillStyle = "#d0455a"; ctx.fillRect(x - 1, 7, 2, 1);
      ctx.fillStyle = "#f2c14e"; ctx.fillRect(x - 1, 10, 2, 5);
      hits.push({ x, st, kind: "boss" });
    } else if (st % 5 === 3) {
      /* elite: war spikes */
      ctx.fillStyle = "#e77463";
      ctx.fillRect(x - 4, 8, 2, 4); ctx.fillRect(x - 1, 5, 2, 7); ctx.fillRect(x + 2, 8, 2, 4);
      ctx.fillRect(x - 1, 12, 2, 3);
      hits.push({ x, st, kind: "elite" });
    } else {
      /* normal pack, tinted by its zone */
      ctx.fillStyle = zc;
      ctx.fillRect(x - 2, 11, 4, 4);
      hits.push({ x, st, kind: "normal" });
    }
    ctx.globalAlpha = 1;
  }
  /* the party: a banner pointing at the road, with a pulsing position */
  const pulse = 0.55 + 0.45 * Math.sin(g.time * 5);
  ctx.fillStyle = "#f2c14e";
  ctx.fillRect(x0 - 3, 2, 6, 2);
  ctx.fillRect(x0 - 2, 4, 4, 2);
  ctx.fillRect(x0 - 1, 6, 2, 3);
  ctx.fillStyle = "rgba(242,193,78," + pulse.toFixed(3) + ")";
  ctx.fillRect(x0 - 3, 10, 6, 6);
  ctx.fillStyle = "#100e1a";
  ctx.fillRect(x0 - 1, 12, 2, 2);
  hits.push({ x: x0, kind: "party" });
  /* hover tooltips */
  if (g.mx == null || g.my == null || g.my > 24) return;
  let best = null;
  for (const h of hits) {
    const d = Math.abs(g.mx - h.x);
    const rr = h.kind === "party" ? 8 : 11;
    if (d <= rr && (!best || d < best.d)) best = { ...h, d };
  }
  if (!best) return;
  const ELITE_HINTS = { slime: "splits in two on death", bat: "drains life from its prey", skeleton: "raises a fallen warrior", imp: "enrages at half health" };
  let l1 = "", l2 = "", c1 = "#cfc9e8";
  if (best.kind === "party") {
    l1 = "YOUR PARTY"; c1 = "#f2c14e";
    l2 = "Stage " + g.stage + " · " + zoneOf(g).name;
  } else if (best.kind === "ready") {
    l1 = "CHAPTER FINALE"; c1 = "#b07fe0";
    l2 = "Fell the King to end the chapter";
  } else {
    const z = ZONES[Math.floor((best.st - 1) / 5) % ZONES.length];
    if (best.kind === "tale") {
      l1 = "STAGE " + best.st + " · CHAPTER FINALE"; c1 = "#b07fe0";
      l2 = "The tale ends here: feast and renown";
    } else if (best.kind === "boss") {
      l1 = "STAGE " + best.st + " · BOSS"; c1 = "#f2c14e";
      l2 = z.label + " King · rich loot awaits";
    } else if (best.kind === "elite") {
      l1 = "STAGE " + best.st + " · ELITE"; c1 = "#e77463";
      l2 = z.eliteLabel + ": " + ELITE_HINTS[z.enemy];
    } else {
      l1 = "STAGE " + best.st; c1 = z.top;
      l2 = z.label + " pack · " + z.name;
    }
  }
  ctx.font = "7px 'Press Start 2P', monospace";
  const tw = Math.max(ctx.measureText(l1).width, ctx.measureText(l2).width) + 14;
  const tx = clamp(best.x - tw / 2, 4, W - tw - 4);
  ctx.fillStyle = c1; ctx.fillRect(best.x - 2, 23, 4, 2);
  ctx.fillStyle = "rgba(16,14,26,0.94)"; ctx.fillRect(tx, 25, tw, 27);
  ctx.fillStyle = c1; ctx.fillRect(tx, 25, tw, 1);
  ctx.textAlign = "left";
  ctx.fillStyle = c1; ctx.fillText(l1, tx + 7, 36);
  ctx.fillStyle = "#8b84ad"; ctx.fillText(l2, tx + 7, 47);
}

function draw(ctx, g) {
  ctx.imageSmoothingEnabled = false;
  const t = g.time;
  ctx.save();
  if (g.shake > 0.2) ctx.translate(rand(-1, 1) * g.shake, rand(-1, 1) * g.shake * 0.6);
  if (g.phase === "feast") drawFeastBack(ctx, g); else drawScene(ctx, g);
  drawBossTelegraphs(ctx, g);
  const units = [...g.members.map((m) => ({ y: m.y, d: () => drawAdventurer(ctx, m, t) })),
                 ...g.enemies.filter((e) => e.hp > 0).map((e) => ({ y: e.y, d: () => drawEnemy(ctx, e, t) }))];
  units.sort((a, b) => a.y - b.y).forEach((u) => u.d());
  for (const pr of g.projectiles) {
    if (pr.kind === "arrow") {
      ctx.save(); ctx.translate(pr.x, pr.y); ctx.rotate(pr.a || 0);
      ctx.fillStyle = "#8a6b48"; ctx.fillRect(-9, -1, 15, 2);
      ctx.fillStyle = "#e8e2d0"; ctx.fillRect(-11, -3, 3, 2); ctx.fillRect(-11, 1, 3, 2);
      ctx.fillStyle = pr.tint || "#cfd6e0"; ctx.fillRect(6, -3, 6, 6);
      ctx.restore();
    } else {
      ctx.fillStyle = pr.kind === "heal" ? "#7fd069" : (pr.tint || "#b07fe0");
      ctx.fillRect(pr.x - 3, pr.y - 3, 6, 6);
      ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.fillRect(pr.x - 1, pr.y - 1, 3, 3);
    }
  }
  for (const p of g.particles) {
    ctx.globalAlpha = clamp(p.life * 2, 0, 1);
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
  }
  ctx.globalAlpha = 1;
  for (let i = g.floaters.length - 1; i >= 0; i--) {
    const f = g.floaters[i];
    f.life -= 1 / 60; f.y -= 0.7; f.x += f.vx || 0;
    if (f.life <= 0) { g.floaters.splice(i, 1); continue; }
    ctx.globalAlpha = Math.min(1, f.life * 1.6);
    const pop = 1 + Math.max(0, f.life - 0.95) * 5;
    ctx.font = `${Math.round((f.big ? 13 : 9) * pop)}px 'Press Start 2P', monospace`;
    ctx.textAlign = "center";
    ctx.fillStyle = "#14122188"; ctx.fillText(f.text, f.x + 1, f.y + 1);
    ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
    ctx.globalAlpha = 1;
  }
  if (g.phase === "feast") { drawFeastFront(ctx, g); drawFeastLight(ctx, g); }
  else { drawForeground(ctx, g); drawLighting(ctx, g); }
  /* bloom: an additive, blurred self-copy — bright emissives (glints, auras,
     ult beams, feast candles) spill soft light; dark pixels barely add. */
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.14;
  ctx.filter = "blur(5px) saturate(1.35) brightness(1.1)";
  ctx.drawImage(ctx.canvas, 0, 0);
  ctx.restore();
  ctx.restore();
  if (g.phase === "feast") drawFeastBanner(ctx, g); else drawTimeline(ctx, g);
  if (g.bossT > 0) {
    ctx.fillStyle = `rgba(190,50,50,${Math.min(0.22, g.bossT * 0.12)})`;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = ((Math.sin(t * 12) + 1) / 2) * 0.85 + 0.15;
    ctx.font = "14px 'Press Start 2P', monospace"; ctx.textAlign = "center";
    ctx.fillStyle = "#ef6461"; ctx.fillText("A MIGHTY FOE APPROACHES", W / 2, 78);
    ctx.globalAlpha = 1;
  }
  const boss = g.enemies.find((e) => e.boss && e.hp > 0);
  if (boss && g.phase === "combat") {
    ctx.font = "10px 'Press Start 2P', monospace"; ctx.textAlign = "center";
    ctx.fillStyle = "#141221cc"; ctx.fillRect(W / 2 - 130, 26, 260, 26);
    ctx.fillStyle = "#f2a94e"; ctx.fillText(boss.name.toUpperCase(), W / 2, 44);
  }
  if (g.phase === "wipe") {
    ctx.fillStyle = "rgba(16,14,26,0.65)"; ctx.fillRect(0, 0, W, H);
    ctx.font = "14px 'Press Start 2P', monospace"; ctx.textAlign = "center";
    ctx.fillStyle = "#ef6461"; ctx.fillText("PARTY WIPED", W / 2, H / 2 - 8);
    ctx.font = "10px 'Press Start 2P', monospace"; ctx.fillStyle = "#cfc9e8";
    ctx.fillText("Regrouping at the last camp...", W / 2, H / 2 + 16);
  }
  if (g.prestigeT > 0) {
    ctx.fillStyle = `rgba(16,14,26,${Math.min(0.55, g.prestigeT * 0.3)})`; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = Math.min(1, g.prestigeT * 1.2);
    ctx.font = "16px 'Press Start 2P', monospace"; ctx.textAlign = "center";
    ctx.fillStyle = "#f2c14e"; ctx.fillText(`CHAPTER ${g.prestiges + 1}`, W / 2, H / 2 - 8);
    ctx.font = "9px 'Press Start 2P', monospace"; ctx.fillStyle = "#cfc9e8";
    ctx.fillText("The legend grows...", W / 2, H / 2 + 16);
    ctx.globalAlpha = 1;
  }
  if (!g.members.length) {
    ctx.font = "10px 'Press Start 2P', monospace"; ctx.textAlign = "center";
    ctx.fillStyle = "#cfc9e8";
    ctx.fillText("The road is empty.", W / 2, H / 2 - 10);
    ctx.fillText("Join the voice channel to muster the party!", W / 2, H / 2 + 12);
  }
}

/* ===================== UI ===================== */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap');
.gi-root { font-family: 'VT323', monospace; font-size: 19px; color: #cfc9e8; background: #100e1a; }
.gi-h { font-family: 'Press Start 2P', monospace; }
.gi-btn { font-family: 'VT323', monospace; font-size: 18px; cursor: pointer; border: 2px solid #2e2947;
  background: #262138; color: #cfc9e8; padding: 2px 10px; transition: filter .1s; }
.gi-btn:hover { filter: brightness(1.25); }
.gi-btn:disabled { opacity: .45; cursor: default; filter: none; }
.gi-btn:focus-visible { outline: 2px solid #f2c14e; outline-offset: 1px; }
.gi-scroll::-webkit-scrollbar { width: 8px; }
.gi-scroll::-webkit-scrollbar-thumb { background: #2e2947; }
@keyframes gi-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(127,208,105,.7);} 50% { box-shadow: 0 0 0 4px rgba(127,208,105,0);} }
@media (prefers-reduced-motion: reduce) { .gi-speak { animation: none !important; } }
`;

const nextClass = (g) => CLASS_ORDER[g.joinCount % 3];

/* Zoomed, animated inspect view of one adventurer: the same drawAdventurer
   that renders the world, at 4x, minus the HUD bars. This is where earned
   gear and cosmetics are meant to be admired. */
function Portrait({ m }) {
  const cvRef = useRef(null);
  const mRef = useRef(m);
  mRef.current = m;
  useEffect(() => {
    const cv = cvRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    let raf;
    const t0 = performance.now();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const src = mRef.current;
      if (!src) return;
      const t = (performance.now() - t0) / 1000;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "#141221";
      ctx.fillRect(0, 0, cv.width, cv.height);
      const grd = ctx.createRadialGradient(cv.width * 0.42, cv.height * 0.62, 10, cv.width * 0.42, cv.height * 0.62, 170);
      grd.addColorStop(0, "rgba(63,58,96,0.55)");
      grd.addColorStop(1, "rgba(63,58,96,0)");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.imageSmoothingEnabled = false;
      const Z = 4;
      ctx.setTransform(Z, 0, 0, Z, Math.round(cv.width * 0.42), cv.height - 6 * Z);
      const mp = {
        ...src, x: 0, y: 0, walking: false, lunge: 0, hop: 0, shootT: 0, castT: 0,
        chainT: 0, ultT: 0, ult: null, feast: 0, bubble: 0, alive: true, atkT: 999, noBars: true,
      };
      drawAdventurer(ctx, mp, t);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={cvRef} width={300} height={400}
    style={{ width: 190, height: "auto", imageRendering: "pixelated", border: "1px solid #2e2947", borderRadius: 10 }} />;
}

export default function GuildIdle() {
  const cvsRef = useRef(null);
  const gRef = useRef(null);
  const autoSimRef = useRef(false);
  const [, force] = useState(0);
  const [selId, setSelId] = useState(null);
  const [tab, setTab] = useState("party");
  const [subTab, setSubTab] = useState("style");
  const [nameInput, setNameInput] = useState("");
  const [autoSim, setAutoSim] = useState(false);
  const [sfxOff, setSfxOffUI] = useState(false);
  const [musicOff, setMusicOffUI] = useState(false);
  const [confirmP, setConfirmP] = useState(false); // member id awaiting retell confirm

  useEffect(() => { autoSimRef.current = autoSim; }, [autoSim]);

  useEffect(() => {
    const g = newGame();
    gRef.current = g;
    joinVoice(g, g.users[0]); // seed one adventurer so the road is not empty
    let raf, last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      tick(g, dt);
      musicTick(g, dt);
      if (autoSimRef.current) {
        g.simT -= dt;
        if (g.simT <= 0) {
          g.simT = rand(9, 18);
          const u = pick(g.users);
          u.inVoice ? leaveVoice(g, u) : joinVoice(g, u);
        }
      }
      const ctx = cvsRef.current && cvsRef.current.getContext("2d");
      if (ctx) draw(ctx, g);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const ui = setInterval(() => force((v) => v + 1), 250);
    const cvs = cvsRef.current;
    const onMove = (ev) => {
      const r = cvs.getBoundingClientRect();
      g.mx = (ev.clientX - r.left) * (W / r.width);
      g.my = (ev.clientY - r.top) * (H / r.height);
    };
    const onLeave = () => { g.mx = null; g.my = null; };
    if (cvs) { cvs.addEventListener("mousemove", onMove); cvs.addEventListener("mouseleave", onLeave); }
    const onDown = () => { audioInit(); audioResume(); };
    window.addEventListener("pointerdown", onDown);
    return () => {
      cancelAnimationFrame(raf); clearInterval(ui);
      if (cvs) { cvs.removeEventListener("mousemove", onMove); cvs.removeEventListener("mouseleave", onLeave); }
      window.removeEventListener("pointerdown", onDown);
    };
  }, []);

  const g = gRef.current;

  /* ------- discord-layer actions (a real bot would call these) ------- */
  function joinVoice(game, u) {
    if (u.inVoice) return;
    u.inVoice = true;
    const m = makeMember(u.name, nextClass(game));
    game.joinCount++;
    game.members.push(m);
    addLog(game, `${u.name} joined voice and enters as a ${styleOf(m).name} (${CLASSES[m.cls].name})!`, CLASSES[m.cls].color);
    const chorusN = Math.min(game.members.length - 1, 9);
    if (chorusN > 0) {
      addLog(game, `The Chorus of Courage swells: ${game.members.length} voices, +${chorusN * 4}% might!`, "#8fe3ff");
      sfx.chorus();
    }
  }
  function leaveVoice(game, u) {
    if (!u.inVoice) return;
    u.inVoice = false;
    game.members = game.members.filter((m) => m.name !== u.name);
    addLog(game, `${u.name} left voice. Their adventurer fades from the party.`, "#8b84ad");
    if (game.members.length >= 2) addLog(game, `The chorus quiets: ${game.members.length} voices remain.`, "#8b84ad");
    else if (game.members.length === 1) addLog(game, `The chorus falls silent. ${game.members[0].name} fights on alone.`, "#8b84ad");
    if (selId && !game.members.find((m) => m.id === selId)) setSelId(null);
  }
  function addUser() {
    const name = nameInput.trim().slice(0, 16);
    if (!name || !g || g.users.find((u) => u.name === name)) return;
    g.users.push({ name, color: pick(["#e8743b", "#8a6fe0", "#5aa9e6", "#7fd069", "#e77fb3", "#f2c14e"]), inVoice: false });
    setNameInput("");
  }

  if (!g) return <div className="gi-root" style={{ minHeight: 400 }} />;

  const sel = g.members.find((m) => m.id === selId);
  const zone = ZONES[Math.floor((g.stage - 1) / 5) % ZONES.length];

  const chip = (txt, color) => (
    <span style={{ border: `1px solid ${color}`, color, padding: "0 6px", fontSize: 15, borderRadius: 3 }}>{txt}</span>
  );

  /* ------- panels ------- */
  const memberCard = (m) => {
    const s = m._st || stats(m, g);
    return (
      <button key={m.id} className="gi-btn" onClick={() => { setSelId(m.id); setSubTab("style"); }}
        style={{ display: "flex", flexDirection: "column", gap: 3, padding: 8, textAlign: "left",
          borderColor: CLASSES[m.cls].color, background: "#1f1b30", width: "100%", opacity: m.alive ? 1 : 0.55 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: CLASSES[m.cls].color }}>{CLASSES[m.cls].icon} {m.name}</span>
          <span style={{ color: "#8b84ad" }}>Lv {m.level}{m.sp > 0 ? <span style={{ color: "#f2c14e" }}> +{m.sp}sp</span> : null}</span>
        </div>
        <div style={{ height: 8, background: "#141221", border: "1px solid #2e2947" }}>
          <div style={{ height: "100%", width: `${clamp((m.hp / s.hp) * 100, 0, 100)}%`, background: CLASSES[m.cls].color }} />
        </div>
        <div style={{ fontSize: 15, color: "#8b84ad", display: "flex", gap: 10 }}>
          <span style={{ color: CLASSES[m.cls].color }}>{styleOf(m).name}</span>
          <span>{m.alive ? `${fmt(m.hp)}/${fmt(s.hp)} HP` : "Fallen"}</span>
          <span>{m.cls === "healer" ? `${fmt(s.heal)} heal` : `${fmt(s.dmg)} dmg`}</span>
          <span>{m.kills} kills</span>
        </div>
      </button>
    );
  };

  const gearRow = (m, slot) => {
    const it = m.gear[slot];
    return (
      <div key={slot} style={{ display: "flex", justifyContent: "space-between", padding: "6px 8px", background: "#1f1b30", border: "1px solid #2e2947" }}>
        <span style={{ color: "#8b84ad", textTransform: "capitalize" }}>{slot}</span>
        {it ? <span style={{ textAlign: "right" }}>
                <span style={{ color: it.rarity.color }}>{it.unique ? "✦ " : ""}{it.name} · +{it.power} ({it.rarity.name})</span>
                {it.affixes && it.affixes.map((a) => (
                  <span key={a.id} style={{ display: "block", fontSize: 15, color: "#8fd0b0" }}>{AFFIX_DEFS[a.id].name}: {AFFIX_DEFS[a.id].fmt(a.v)}</span>
                ))}
              </span>
            : <span style={{ color: "#4c4763" }}>Empty (drops equip automatically)</span>}
      </div>
    );
  };

  const cosmeticGrid = (m, title, list, kind) => (
    <div style={{ marginBottom: 10 }}>
      <div className="gi-h" style={{ fontSize: 10, color: "#8b84ad", margin: "6px 0" }}>{title}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {list.map((item, idx) => {
          const key = item.id !== undefined ? item.id : idx;
          const owned = m.owned[kind].includes(key);
          const equipped = m.cos[kind] === key;
          const swatch = item.c ? <span style={{ display: "inline-block", width: 12, height: 12, background: item.c, border: "1px solid #100e1a", marginRight: 5, verticalAlign: "middle" }} /> : null;
          return (
            <button key={String(key)} className="gi-btn"
              style={{ borderColor: equipped ? "#f2c14e" : owned ? "#5aa9e6" : "#2e2947", fontSize: 16 }}
              disabled={!owned && g.gold < item.price}
              onClick={() => {
                if (owned) { m.cos[kind] = key; }
                else if (g.gold >= item.price) {
                  g.gold -= item.price; m.owned[kind].push(key); m.cos[kind] = key;
                  addLog(g, `${m.name} bought the ${item.name} style for ${item.price}g. Looking sharp!`, "#f2c14e");
                }
                force((v) => v + 1);
              }}>
              {swatch}{item.name}{owned ? (equipped ? " ✓" : "") : ` · ${item.price}g`}
            </button>
          );
        })}
      </div>
    </div>
  );

  const skillPanel = (m) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ color: "#8b84ad" }}>Skill points: <span style={{ color: "#f2c14e" }}>{m.sp}</span> (earn 1 per level)</div>
      <div style={{ background: "#1f1b30", border: "1px solid #2e2947", padding: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div>
          <div>🎲 Auto-assign</div>
          <div style={{ fontSize: 15, color: "#8b84ad" }}>{m.autoSkill ? "Points spend themselves as they are earned." : "Off — spend your points below."}</div>
        </div>
        <button className="gi-btn" onClick={() => { m.autoSkill = !m.autoSkill; force((v) => v + 1); }}>{m.autoSkill ? "turn off" : "turn on"}</button>
      </div>
      <div style={{ background: "#1f1b30", border: "1px solid #2e2947", padding: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div>
          <div>↺ Reset points</div>
          <div style={{ fontSize: 15, color: "#8b84ad" }}>Reclaim all spent points and assign them yourself (turns auto off).</div>
        </div>
        <button className="gi-btn" onClick={() => { m.sp += Object.values(m.skills).reduce((a, b) => a + b, 0); m.skills = {}; m.autoSkill = false; force((v) => v + 1); }}>reset</button>
      </div>
      {SKILLS[m.cls].map((sk) => {
        const r = m.skills[sk.id] || 0;
        return (
          <div key={sk.id} style={{ background: "#1f1b30", border: "1px solid #2e2947", padding: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <div>
              <div style={{ color: CLASSES[m.cls].color }}>{sk.name}</div>
              <div style={{ fontSize: 15, color: "#8b84ad" }}>{sk.desc}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span>{Array.from({ length: MAX_RANK }).map((_, i) => (
                <span key={i} style={{ color: i < r ? "#f2c14e" : "#4c4763" }}>■</span>
              ))}</span>
              <button className="gi-btn" disabled={m.sp <= 0 || r >= MAX_RANK}
                onClick={() => { m.skills[sk.id] = r + 1; m.sp--; force((v) => v + 1); }}>+</button>
            </div>
          </div>
        );
      })}
      <div style={{ borderTop: "1px solid #2e2947", paddingTop: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ color: "#8b84ad" }}>Respec class:</span>
        {CLASS_ORDER.map((c) => (
          <button key={c} className="gi-btn" style={{ borderColor: CLASSES[c].color, color: CLASSES[c].color }}
            disabled={m.cls === c}
            onClick={() => {
              m.cls = c; m.skills = {}; m.sp = m.level - 1;
              m.style = pick(STYLES[c]).id;
              m._st = stats(m, g); m.hp = m._st.hp;
              addLog(g, `${m.name} respecs into ${CLASSES[c].name}!`, CLASSES[c].color);
              force((v) => v + 1);
            }}>{CLASSES[c].icon} {CLASSES[c].name}</button>
        ))}
      </div>
    </div>
  );

  const shopPanel = () => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 8 }}>
      {Object.entries(POTIONS).map(([k, p]) => (
        <div key={k} style={{ background: "#1f1b30", border: "1px solid #2e2947", padding: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{p.icon} {p.name}</span>
            <span style={{ color: "#8b84ad" }}>x{g.stock[k]}</span>
          </div>
          <div style={{ fontSize: 15, color: "#8b84ad", minHeight: 40 }}>{p.desc}</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
            <button className="gi-btn" disabled={g.gold < p.price}
              onClick={() => { g.gold -= p.price; g.stock[k]++; force((v) => v + 1); }}>
              Buy · {p.price}g
            </button>
            <label style={{ fontSize: 15, color: g.auto[k] ? "#7fd069" : "#8b84ad", cursor: "pointer" }}>
              <input type="checkbox" checked={g.auto[k]} onChange={() => { g.auto[k] = !g.auto[k]; force((v) => v + 1); }} /> auto
            </label>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="gi-root" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <style>{CSS}</style>
      <div style={{ display: "flex", flex: 1, minHeight: 0, flexWrap: "wrap" }}>

        {/* ============ simulated Discord sidebar ============ */}
        <aside style={{ width: 250, minWidth: 220, background: "#191627", borderRight: "2px solid #2e2947", display: "flex", flexDirection: "column", padding: 10, gap: 8 }}>
          <div className="gi-h" style={{ fontSize: 11, color: "#f2c14e", padding: "4px 0 8px", borderBottom: "1px solid #2e2947" }}>
            ⚔️ ADVENTURERS GUILD
          </div>
          <div style={{ fontSize: 15, color: "#8b84ad", letterSpacing: 1 }}>VOICE · SIMULATED</div>
          <div style={{ background: "#1f1b30", border: "1px solid #2e2947", padding: 8 }}>
            <div style={{ color: "#cfc9e8", marginBottom: 6 }}>🔊 Dungeon Party ({g.users.filter((u) => u.inVoice).length})</div>
            {g.users.filter((u) => u.inVoice).map((u) => {
              const m = g.members.find((mm) => mm.name === u.name);
              const speaking = m && m.bubble > 0;
              return (
                <div key={u.name} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 0" }}>
                  <span className={speaking ? "gi-speak" : ""} style={{
                    width: 20, height: 20, borderRadius: "50%", background: u.color, flexShrink: 0,
                    display: "grid", placeItems: "center", color: "#100e1a", fontWeight: "bold", fontSize: 13,
                    border: speaking ? "2px solid #7fd069" : "2px solid transparent",
                    animation: speaking ? "gi-pulse 1s infinite" : "none",
                  }}>{u.name[0]}</span>
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</span>
                  {m && chip(CLASSES[m.cls].name, CLASSES[m.cls].color)}
                  <button className="gi-btn" style={{ fontSize: 14, padding: "0 6px" }} onClick={() => { leaveVoice(g, u); force((v) => v + 1); }}>✕</button>
                </div>
              );
            })}
            {!g.users.some((u) => u.inVoice) && <div style={{ color: "#4c4763", fontSize: 15 }}>Nobody is connected.</div>}
          </div>
          <div style={{ fontSize: 15, color: "#8b84ad", letterSpacing: 1 }}>ONLINE</div>
          <div className="gi-scroll" style={{ overflowY: "auto", maxHeight: 180 }}>
            {g.users.filter((u) => !u.inVoice).map((u) => (
              <div key={u.name} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 0", opacity: 0.85 }}>
                <span style={{ width: 20, height: 20, borderRadius: "50%", background: u.color, display: "grid", placeItems: "center", color: "#100e1a", fontWeight: "bold", fontSize: 13, flexShrink: 0 }}>{u.name[0]}</span>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</span>
                <button className="gi-btn" style={{ fontSize: 14, padding: "0 6px", borderColor: "#7fd069", color: "#7fd069" }}
                  onClick={() => { joinVoice(g, u); force((v) => v + 1); }}>Join</button>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <input value={nameInput} onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addUser()}
              placeholder="Add a member..."
              style={{ flex: 1, minWidth: 0, background: "#141221", border: "1px solid #2e2947", color: "#cfc9e8", fontFamily: "'VT323', monospace", fontSize: 17, padding: "2px 6px" }} />
            <button className="gi-btn" onClick={addUser}>+</button>
          </div>
          <label style={{ fontSize: 16, color: autoSim ? "#7fd069" : "#8b84ad", cursor: "pointer" }}>
            <input type="checkbox" checked={autoSim} onChange={(e) => setAutoSim(e.target.checked)} /> Simulate voice traffic
          </label>
          <div style={{ marginTop: "auto", fontSize: 14, color: "#4c4763", lineHeight: 1.3 }}>
            Prototype note: a real Discord bot would call joinVoice and leaveVoice from voiceStateUpdate events. Ask me for the bot scaffold when you are ready.
          </div>
        </aside>

        {/* ============ main game column ============ */}
        <main style={{ flex: 1, minWidth: 320, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <header style={{ display: "flex", alignItems: "center", gap: 14, padding: "8px 14px", borderBottom: "2px solid #2e2947", flexWrap: "wrap" }}>
            <span className="gi-h" style={{ fontSize: 11, color: zone.top }}>{zone.name.toUpperCase()}</span>
            <span style={{ color: "#8b84ad" }}>Stage <b style={{ color: "#cfc9e8" }}>{g.stage}</b>{g.stage % 5 === 0 ? " · BOSS" : g.stage % 5 === 3 ? " · ELITE" : ""} · Best {g.best}</span>
            <span style={{ marginLeft: "auto", color: "#f2c14e" }}>◈ {fmt(g.gold)}g</span>
            {(g.renown > 0 || g.prestiges > 0) && <span style={{ color: "#b07fe0" }}>✦ {fmt(g.renown)}</span>}
            {MUTATORS.filter((x) => x.id === g.mutator).map((mu) => (
              <span key={mu.id} style={{ color: mu.c }} title={mu.desc}>📖 {mu.name.replace("Chapter of ", "")}</span>
            ))}
            <span style={{ color: "#8b84ad", fontSize: 16 }}>🧪{g.stock.heal} 🛡️{g.stock.armor} ☠️{g.stock.poison} 🔥{g.stock.res}</span>
            {g.members.length >= 2 && <span style={{ color: "#8fe3ff", fontSize: 16 }} title={`Chorus of Courage: every voice past the first grants +4% damage and healing and +3% max HP`}>🎵 +{Math.min(g.members.length - 1, 9) * 4}%</span>}
            <button className="gi-btn" style={{ fontSize: 14, padding: "2px 8px" }} title={sfxOff ? "unmute sounds" : "mute sounds"}
              onClick={() => { audioInit(); audioResume(); setSfxMuted(!sfxOff); setSfxOffUI(!sfxOff); }}>{sfxOff ? "🔇" : "🔊"}</button>
            <button className="gi-btn" style={{ fontSize: 14, padding: "2px 8px", opacity: musicOff ? 0.35 : 1 }} title={musicOff ? "unmute music" : "mute music"}
              onClick={() => { audioInit(); audioResume(); setMusicMuted(!musicOff); setMusicOffUI(!musicOff); }}>🎵</button>
          </header>

          <div style={{ background: "#100e1a", padding: "6px 10px" }}>
            <canvas ref={cvsRef} width={W} height={H}
              style={{ width: "100%", maxWidth: 900, display: "block", margin: "0 auto", imageRendering: "pixelated", border: "2px solid #2e2947", background: "#141221" }} />
          </div>

          <nav style={{ display: "flex", gap: 6, padding: "6px 12px" }}>
            {[["party", "Party"], ["legacy", "Guild Hall"], ["shop", "Alchemist"], ["log", "Chronicle"]].map(([id, label]) => (
              <button key={id} className="gi-btn gi-h"
                style={{ fontSize: 9, padding: "6px 12px", borderColor: tab === id ? "#f2c14e" : "#2e2947", color: tab === id ? "#f2c14e" : "#8b84ad" }}
                onClick={() => { setTab(id); setSelId(null); }}>{label}</button>
            ))}
          </nav>

          <section className="gi-scroll" style={{ flex: 1, overflowY: "auto", padding: "4px 12px 16px", minHeight: 200 }}>
            {tab === "party" && !sel && (
              g.members.length
                ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
                    {g.members.map(memberCard)}
                  </div>
                : <div style={{ color: "#8b84ad", padding: 12 }}>No adventurers yet. Use the Join buttons in the voice channel on the left.</div>
            )}

            {tab === "party" && sel && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                  <button className="gi-btn" onClick={() => setSelId(null)}>← Party</button>
                  <span className="gi-h" style={{ fontSize: 11, color: CLASSES[sel.cls].color }}>{sel.name}</span>
                  {chip(`${CLASSES[sel.cls].name} · Lv ${sel.level}`, CLASSES[sel.cls].color)}
                  <span style={{ color: "#8b84ad", fontSize: 16 }}>
                    XP {fmt(sel.xp)}/{fmt(xpNeed(sel.level))} · {fmt(sel.dmgDone)} dmg dealt · {fmt(sel.healDone)} healed
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
                  <Portrait m={sel} />
                </div>
                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                  {[["style", "Wardrobe"], ["gear", "Equipment"], ["skills", "Skills"]].map(([id, label]) => (
                    <button key={id} className="gi-btn"
                      style={{ borderColor: subTab === id ? "#f2c14e" : "#2e2947", color: subTab === id ? "#f2c14e" : "#8b84ad" }}
                      onClick={() => setSubTab(id)}>{label}</button>
                  ))}
                </div>
                {subTab === "gear" && <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{SLOTS.map((s) => gearRow(sel, s))}</div>}
                {subTab === "skills" && skillPanel(sel)}
                {subTab === "style" && (
                  <div>
                    <div style={{ marginBottom: 10 }}>
                      <div className="gi-h" style={{ fontSize: 10, color: "#8b84ad", margin: "6px 0" }}>FIGHTING STYLE</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {STYLES[sel.cls].map((s) => (
                          <button key={s.id} className="gi-btn"
                            style={{ borderColor: sel.style === s.id ? "#f2c14e" : "#2e2947", fontSize: 16, textAlign: "left" }}
                            onClick={() => {
                              if (sel.style !== s.id) {
                                sel.style = s.id;
                                addLog(g, `${sel.name} takes up the ways of the ${s.name}!`, CLASSES[sel.cls].color);
                              }
                              force((v) => v + 1);
                            }}>
                            {s.name}{sel.style === s.id ? " ✓" : ""}
                            <span style={{ color: "#8b84ad" }}> · {s.blurb}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <div className="gi-h" style={{ fontSize: 10, color: "#8b84ad", margin: "6px 0" }}>BODY</div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {BODIES.map((b) => (
                          <button key={b.id} className="gi-btn"
                            style={{ borderColor: sel.cos.body === b.id ? "#f2c14e" : "#2e2947", fontSize: 16 }}
                            onClick={() => { sel.cos.body = b.id; force((v) => v + 1); }}>
                            {b.name}{sel.cos.body === b.id ? " ✓" : ""}
                          </button>
                        ))}
                      </div>
                    </div>
                    {cosmeticGrid(sel, "HAIRSTYLE", HAIRSTYLES, "hairstyle")}
                    {cosmeticGrid(sel, "HAIR DYE", HAIRS, "hair")}
                    {cosmeticGrid(sel, "HATS", HATS, "hat")}
                    {cosmeticGrid(sel, "ACCESSORIES", ACCESSORIES, "accessory")}
                    {cosmeticGrid(sel, "OUTFIT", OUTFITS, "outfit")}
                    {cosmeticGrid(sel, "WEAPON FINISH", WEAPON_SKINS, "weapon")}
                    {cosmeticGrid(sel, "CAPES", CAPES, "cape")}
                    {cosmeticGrid(sel, "PETS", PETS, "pet")}
                    {cosmeticGrid(sel, "AURAS", AURAS, "aura")}
                  </div>
                )}
              </div>
            )}

            {tab === "legacy" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
                  <span className="gi-h" style={{ fontSize: 11, color: "#b07fe0" }}>✦ {fmt(g.renown)} RENOWN</span>
                  <span style={{ color: "#8b84ad" }}>Chapter {g.prestiges + 1} · Best stage ever {g.everBest}</span>
                </div>
                <div style={{ background: "#1f1b30", border: "1px solid #2e2947", padding: 10 }}>
                  <div style={{ color: "#f2c14e", marginBottom: 4 }}>Chapter {g.prestiges + 1}</div>
                  <div style={{ fontSize: 16, color: "#8b84ad", marginBottom: 8 }}>
                    When the Stage 20 King falls, the chapter ends on its own: the guild feasts and earns ✦ {Math.round(renownEarn(20) * (mutatorOf(g) ? mutatorOf(g).renownMult : 1))}. Heroes keep their levels and gear.
                  </div>
                  <div style={{ height: 5, background: "#141221" }}>
                    <div style={{ height: "100%", width: `${Math.min(100, (g.stage / 20) * 100)}%`, background: "#b07fe0" }} />
                  </div>
                  <div style={{ color: "#8b84ad", fontSize: 16, marginTop: 4 }}>Stage {g.stage} of 20</div>
                </div>
                <div style={{ background: "#1f1b30", border: "1px solid #2e2947", padding: 10 }}>
                  <div style={{ color: "#b07fe0", marginBottom: 4 }}>🔄 Retell your Tale</div>
                  <div style={{ fontSize: 16, color: "#8b84ad", marginBottom: 8 }}>
                    A hero of level 21+ may retell their own tale: back to level 1, and their gear, skills, and XP become renown for the guild. Cosmetics, styles, and renown endure.
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {g.members.map((m) => {
                      const earn = Math.round(renownEarn(m.level) * (mutatorOf(g) ? mutatorOf(g).renownMult : 1));
                      const ready = m.level >= 21 && g.phase !== "feast";
                      return (
                        <div key={m.id} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <span style={{ color: CLASSES[m.cls].color, minWidth: 110 }}>{m.name}</span>
                          <span style={{ color: "#8b84ad", fontSize: 16 }}>Lv {m.level}{m.retellings ? ` · retold ×${m.retellings}` : ""}</span>
                          <span style={{ color: ready ? "#7fd069" : "#8b84ad", fontSize: 16 }}>{m.level >= 21 ? `worth ✦ ${earn}` : "ready at level 21"}</span>
                          {confirmP === m.id
                            ? <>
                                <button className="gi-btn" style={{ borderColor: "#ef6461", color: "#ef6461" }} disabled={!ready}
                                  onClick={() => { retellMember(g, m); setConfirmP(false); force((v) => v + 1); }}>
                                  Confirm: ✦ {earn}
                                </button>
                                <button className="gi-btn" onClick={() => setConfirmP(false)}>Cancel</button>
                              </>
                            : <button className="gi-btn" style={{ borderColor: "#b07fe0", color: "#b07fe0" }} disabled={!ready}
                                onClick={() => setConfirmP(m.id)}>Retell</button>}
                        </div>
                      );
                    })}
                    {!g.members.length && <span style={{ color: "#8b84ad", fontSize: 16 }}>The hall stands empty; heroes must gather first.</span>}
                  </div>
                </div>
                <div className="gi-h" style={{ fontSize: 10, color: "#c9a24b" }}>📜 QUEST BOARD · new contracts at daybreak</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {(g.quests || []).map((q) => (
                    <div key={q.id} style={{ background: "#1f1b30", border: "1px solid #2e2947", padding: "6px 10px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ color: q.done ? "#7fd069" : "#efeaff" }}>{q.done ? "✓ " : ""}{questLabel(q)}</span>
                        <span style={{ color: "#8b84ad", fontSize: 16 }}>{q.done ? "complete" : `${fmt(Math.floor(q.progress))} / ${fmt(q.target)}`} · {q.gold}g ✦{q.renown}</span>
                      </div>
                      <div style={{ height: 5, background: "#141221", marginTop: 4 }}>
                        <div style={{ height: "100%", width: `${Math.min(100, (q.progress / q.target) * 100)}%`, background: q.done ? "#7fd069" : "#c9a24b" }} />
                      </div>
                    </div>
                  ))}
                  {!(g.quests || []).length && <span style={{ color: "#8b84ad", fontSize: 16 }}>The board refreshes at daybreak.</span>}
                </div>
                <div className="gi-h" style={{ fontSize: 10, color: "#8b84ad" }}>GUILD UPGRADES</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 8 }}>
                  {LEGACY.map((u) => {
                    const r = g.legacy[u.id], cost = legacyCost(r);
                    return (
                      <div key={u.id} style={{ background: "#1f1b30", border: "1px solid #2e2947", padding: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "#cfc9e8" }}>{u.name}</span>
                          <span>{Array.from({ length: u.max }).map((_, i) => (
                            <span key={i} style={{ color: i < r ? "#f2c14e" : "#4c4763" }}>■</span>
                          ))}</span>
                        </div>
                        <div style={{ fontSize: 15, color: "#8b84ad", minHeight: 34 }}>{u.desc}</div>
                        <button className="gi-btn" disabled={r >= u.max || g.renown < cost}
                          onClick={() => { g.renown -= cost; g.legacy[u.id]++; addLog(g, `Guild upgrade: ${u.name} rank ${g.legacy[u.id]}!`, "#b07fe0"); force((v) => v + 1); }}>
                          {r >= u.max ? "Maxed" : `Improve · ✦ ${cost}`}
                        </button>
                      </div>
                    );
                  })}
                </div>
                {(g.hall || []).length > 0 && <>
                  <div className="gi-h" style={{ fontSize: 10, color: "#8b84ad", marginTop: 10 }}>🏛️ HALL OF LEGENDS</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {[...g.hall].reverse().map((rr) => {
                      const rmu = MUTATORS.find((x) => x.id === rr.mutator);
                      return (
                        <div key={rr.chapter} style={{ background: "#1f1b30", border: "1px solid #2e2947", padding: 8 }}>
                          <div style={{ color: "#cfc9e8" }}>Chapter {rr.chapter} · reached stage {fmt(rr.stage)}
                            {rmu && <span style={{ color: rmu.c }}> · {rmu.name}</span>}</div>
                          <div style={{ fontSize: 15, color: "#8b84ad" }}>
                            {fmt(rr.kills)} foes · {fmt(rr.gold)}g · ✦{fmt(rr.renown)}
                            {rr.mvp ? ` · MVP ${rr.mvp.name} (${fmt(rr.mvp.dmg)} dmg)` : ""}
                            {rr.uniques && rr.uniques.length ? ` · ★ ${rr.uniques.join(", ")}` : ""}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>}
              </div>
            )}

            {tab === "shop" && shopPanel()}

            {tab === "log" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {g.log.map((l, i) => (
                  <div key={i} style={{ color: l.color, fontSize: 17, opacity: i === 0 ? 1 : 0.85 }}>› {l.text}</div>
                ))}
                {!g.log.length && <div style={{ color: "#8b84ad" }}>The chronicle is blank. Adventure awaits.</div>}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

