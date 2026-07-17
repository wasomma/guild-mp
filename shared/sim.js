/* =====================================================================
   shared/sim.js : the authoritative Guild of the Open Mic simulation.
   No rendering, no I/O. Runs under Node (server) or the browser.
   Visual moments are emitted as events in world.events; clients turn
   them into particles, floaters, and screen shake locally.
   ===================================================================== */

export const P = 3;
export const W = 640, H = 300, GROUND = 244;

export const CLASSES = {
  tank:   { name: "Tank",   color: "#5aa9e6", icon: "🛡️", base: { hp: 130, hpL: 26, dmg: 6,  dmgL: 1.6, spd: 1.5,  armor: 4, crit: 5 } },
  dps:    { name: "DPS",    color: "#ef6461", icon: "⚔️", base: { hp: 72,  hpL: 12, dmg: 14, dmgL: 3.4, spd: 0.85, armor: 0, crit: 15 } },
  healer: { name: "Healer", color: "#7fd069", icon: "💚", base: { hp: 88,  hpL: 15, dmg: 5,  dmgL: 1.2, spd: 1.25, armor: 1, crit: 5, heal: 15, healL: 3 } },
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
export const HAIRSTYLES = [
  { id: "short", name: "Short Crop", price: 0 },
  { id: "pixie", name: "Pixie Cut", price: 60 },
  { id: "bob", name: "Sleek Bob", price: 90 },
  { id: "pony", name: "Ponytail", price: 120 },
  { id: "long", name: "Long Flow", price: 150 },
  { id: "bun", name: "War Bun", price: 180 },
  { id: "twin", name: "Twintails", price: 220 },
  { id: "braid", name: "Battle Braid", price: 260 },
];
export const ACCESSORIES = [
  { id: "none", name: "None", price: 0 },
  { id: "freckles", name: "Freckles", price: 60 },
  { id: "warpaint", name: "Warpaint", price: 120 },
  { id: "earrings", name: "Gold Earrings", price: 140 },
  { id: "scarf", name: "Silk Scarf", price: 200 },
  { id: "pendant", name: "Ruby Pendant", price: 220 },
];
export const CAPES = [
  { id: "none", name: "No Cape", price: 0 },
  { id: "traveler", name: "Traveler Cloak", price: 300, c: "#4d5a8a", lining: "#33304f" },
  { id: "crimson", name: "Crimson Cape", price: 450, c: "#93384a", lining: "#5e2430" },
  { id: "forest", name: "Forest Cloak", price: 450, c: "#3f6d4a", lining: "#2a4a33" },
  { id: "shadow", name: "Shadow Cloak", price: 700, c: "#26232b", lining: "#141221" },
  { id: "royal", name: "Royal Cape", price: 950, c: "#6a4a9e", trim: "#f2c14e", lining: "#4e3675" },
  { id: "gilded", name: "Gilded Cape", price: 1400, c: "#f2c14e", trim: "#fff1c9", lining: "#c78a3b" },
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
];
export const HAIRS = [
  { name: "Chestnut", c: "#6b4a32", price: 0 },
  { name: "Raven", c: "#26232b", price: 60 },
  { name: "Gold", c: "#e8c15a", price: 60 },
  { name: "Ember", c: "#c94f3d", price: 90 },
  { name: "Arcane", c: "#8a6fe0", price: 150 },
  { name: "Seafoam", c: "#69d2c8", price: 150 },
  { name: "Rose", c: "#e77fb3", price: 150 },
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

export const POTIONS = {
  heal: { name: "Healing Potion", icon: "🧪", price: 30, desc: "Auto sips when an ally drops below 40% HP. Restores 45%." },
  armor: { name: "Armor Elixir", icon: "🛡️", price: 45, desc: "Auto used at the start of combat. Party gains armor for 12s." },
  poison: { name: "Poison Vial", icon: "☠️", price: 40, desc: "Auto thrown at the start of combat. Poisons all enemies for 8s." },
  res: { name: "Phoenix Draught", icon: "🔥", price: 140, desc: "Auto revives a fallen ally at 60% HP after a few seconds." },
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
    stage: 1, best: 1, gold: 150, joinCount: 0,
    renown: 0, prestiges: 0, everBest: 1, prestigeT: 0,
    legacy: { hymn: 0, banner: 0, merchant: 0, scholar: 0, head: 0, stipend: 0 },
    phase: "advance", advanceT: 1.6, wipeT: 0, scroll: 0, bossT: 0,
    stock: { heal: 3, armor: 1, poison: 1, res: 1 },
    auto: { heal: true, armor: true, poison: true, res: true },
    healCd: 0, buffT: 0, time: 0, mutator: null,
    hall: [], chapter: { kills: 0, gold: 0, uniques: [] },
    autoSim: false, simT: 8,
    vote: null,
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

export function makeMember(g, key, name, cls) {
  const defaults = { tank: 3, dps: 2, healer: 1 };
  const fem = Math.random() < 0.5;
  const startHair = fem ? pick(["pony", "long", "bob"]) : pick(["short", "short", "pixie"]);
  const m = {
    id: g.uid++, key, name, cls, level: 1, xp: 0, sp: 0,
    style: pick(STYLES[cls]).id, swing: 0, shootT: 0, castT: 0, chainT: 0, chainTgt: null,
    skills: {}, gear: { weapon: null, armor: null, trinket: null },
    cos: { body: fem ? "f" : "m", hat: "none", hair: Math.floor(Math.random() * 4) % 4, hairstyle: startHair, outfit: defaults[cls], weapon: "steel", accessory: "none", cape: "none", pet: "none", aura: "none" },
    owned: { hat: ["none"], hair: [0, 1, 2, 3], hairstyle: Array.from(new Set(["short", startHair])), outfit: [0, defaults[cls]], weapon: ["steel"], accessory: ["none"], cape: ["none"], pet: ["none"], aura: ["none"] },
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

/* Persistence helpers: a character's durable identity, without transient
   combat fields. The database stores this; rehydrate rebuilds a live member. */
export function dehydrateMember(m) {
  return {
    key: m.key, name: m.name, cls: m.cls, style: m.style,
    level: m.level, xp: m.xp, sp: m.sp,
    skills: m.skills, gear: m.gear, cos: m.cos, owned: m.owned,
    kills: m.kills, dmgDone: m.dmgDone, healDone: m.healDone,
  };
}

export function rehydrateMember(g, d) {
  const m = makeMember(g, d.key || d.name, d.name, d.cls);
  Object.assign(m, {
    style: d.style, level: d.level, xp: d.xp, sp: d.sp,
    skills: d.skills || {}, gear: d.gear, cos: d.cos, owned: d.owned,
    kills: d.kills || 0, dmgDone: d.dmgDone || 0, healDone: d.healDone || 0,
  });
  m._st = stats(m, g); m.hp = m._st.hp;
  return m;
}

const nextClass = (g) => CLASS_ORDER[g.joinCount % 3];

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
  if (!g.session) g.session = { startedAt: Date.now(), startStage: g.stage, startChapter: g.prestiges + 1, names: [], kills: 0, bossKills: [], eliteKills: 0, gold: 0, levelUps: 0, topLevel: null, uniques: [], deaths: 0, cleaves: 0, chapters: 0, best: g.stage };
  if (!g.session.names.includes(name)) g.session.names.push(name);
  let m = g.roster[key];
  if (m) {
    delete g.roster[key];
    m.name = name;
    m.alive = true; m.x = -40; m._st = stats(m, g); m.hp = m._st.hp;
    g.members.push(m);
    addLog(g, `${name} returns to the fray as a ${styleOf(m).name} (level ${m.level})!`, CLASSES[m.cls].color);
  } else {
    m = makeMember(g, key, name, nextClass(g));
    g.joinCount++;
    g.members.push(m);
    addLog(g, `${name} joined voice and enters as a ${styleOf(m).name} (${CLASSES[m.cls].name})!`, CLASSES[m.cls].color);
  }
  const chorusN = Math.min(g.members.length - 1, 9);
  if (chorusN > 0) {
    addLog(g, `The Chorus of Courage swells: ${g.members.length} voices, +${chorusN * 4}% might!`, "#8fe3ff");
    sfxEv(g, "chorus");
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
    if (g.members.length >= 2) addLog(g, `The chorus quiets: ${g.members.length} voices remain.`, "#8b84ad");
    else if (g.members.length === 1) addLog(g, `The chorus falls silent. ${g.members[0].name} fights on alone.`, "#8b84ad");
    if (!g.members.length) g.vote = null;
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
    sfxEv(g, "unique");
    if (g.session) g.session.uniques.push(item.name + " (" + m.name + ")");
    if (g.chapter) g.chapter.uniques.push(item.name);
  }
  const cur = m.gear[item.slot];
  if (!cur || item.power > cur.power) {
    m.gear[item.slot] = item;
    sfxEv(g, "loot");
    addLog(g, `${m.name} equipped ${item.name} (${item.rarity.name}, +${item.power})`, item.rarity.color);
    addFloat(g, m.x, m.y - 92, item.name, item.rarity.color);
  } else {
    const val = Math.round(item.power * 2.5);
    g.gold += val;
    questProg(g, "gold", val);
    addLog(g, `${m.name} salvaged ${item.name} for ${val}g`, "#8b84ad");
  }
}

function makeEnemy(g, tier) {
  const zone = zoneOf(g);
  const s = g.stage;
  const boss = tier === "boss", elite = tier === "elite";
  const hp = Math.round((28 + s * 15) * (boss ? 9 : elite ? 3.6 : 1) * rand(0.9, 1.1));
  const e = {
    id: g.uid++, kind: zone.enemy, boss, elite,
    scale: boss ? 1.8 : elite ? 1.35 : 1,
    name: boss ? `${zone.label} King` : elite ? zone.eliteLabel : zone.label,
    hp, maxHp: hp,
    dmg: (4 + s * 1.5) * (boss ? 1.9 : elite ? 1.4 : 1),
    spd: boss ? 2.0 : elite ? 1.8 : rand(1.5, 2.1),
    xp: Math.round((9 + s * 3.2) * (boss ? 6 : elite ? 2.5 : 1)),
    gold: Math.round((10 + s * 4) * (boss ? 8 : elite ? 3.5 : 1)),
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
    for (const e of g.enemies) { e.poison = 2 + g.stage * 0.7; e.poisonT = 8; }
    addLog(g, "Poison Vial hisses across the enemy line.", "#7fd069");
    sfxEv(g, "potion");
  }
}

function formation(g) {
  const order = [...g.members].sort((a, b) => CLASS_ORDER.indexOf(a.cls) - CLASS_ORDER.indexOf(b.cls));
  order.forEach((m, i) => {
    m.tx = 178 - Math.floor(i / 2) * 50 - (i % 2) * 25;
    m.y = GROUND - (i % 2) * 12;
  });
}

function killEnemy(g, killer, e) {
  e.hp = 0;
  if (killer) killer.kills++;
  const goldGain = Math.round(e.gold * (1 + 0.15 * g.legacy.merchant) * (1 + ((killer && killer._st && killer._st.goldF) || 0)));
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
    sfxEv(g, "split");
  }
  const alive = g.members.filter((m) => m.alive);
  const share = Math.round((e.xp / Math.max(1, alive.length) + e.xp * 0.4) * (1 + 0.15 * g.legacy.scholar));
  for (const m of alive) gainXp(g, m, share);
  if (e.boss) { dropLoot(g, 0.10); if (Math.random() < 0.6) dropLoot(g, 0.10); addLog(g, `${e.name} defeated! The path ahead opens.`, "#f2a94e"); }
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
  sfxEv(g, crit ? "crit" : "hit");
  burst(g, tgt.x - 6, tgt.y - 28 * (tgt.scale || 1), crit ? "#f2a94e" : "#ffffff", crit ? 10 : 5, crit ? 2 : 1.2);
  if (crit) shakeFx(g, 3.5);
  addFloat(g, tgt.x, tgt.y - 66 * (tgt.scale || 1), fmt(dmg) + (crit ? "!" : ""), crit ? "#f2a94e" : "#fff", crit);
  if (m && m._st.stun > 0 && Math.random() < m._st.stun) { tgt.stunT = 1.1; addFloat(g, tgt.x, tgt.y - 84, "STUNNED", "#5aa9e6"); sfxEv(g, "stun"); }
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

export function doPrestige(g) {
  const mu = mutatorOf(g);
  const earn = Math.round(renownEarn(g.stage) * (mu ? mu.renownMult : 1));
  g.renown += earn; g.prestiges++;
  sfxEv(g, "prestige");
  if (g.session) g.session.chapters++;
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
  g.gold = 150;
  const st = g.legacy.stipend * 2;
  g.stock = { heal: 3 + st, armor: 1 + st, poison: 1 + st, res: 1 + st };
  g.enemies = []; g.projectiles = []; g.pending = []; g.buffT = 0;
  g.prestigeT = 3;
  if (g.members.length) { g.phase = "feast"; setupFeast(g); }
  else { g.phase = "advance"; g.advanceT = 2.5; }
  const resetChar = (m) => {
    m.level = 1; m.xp = 0; m.sp = 0; m.skills = {};
    m.gear = { weapon: null, armor: null, trinket: null };
    m.kills = 0; m.dmgDone = 0; m.healDone = 0;
    m.ult = 0; m.ultT = 0;
    m.alive = true; m._st = stats(m, g); m.hp = m._st.hp;
  };
  for (const m of g.members) resetChar(m);
  for (const name of Object.keys(g.roster)) resetChar(g.roster[name]);
  addLog(g, `The tale is told! The guild earns ${earn} renown${mu ? ` (×${mu.renownMult} for braving the ${mu.name})` : ""} and begins Chapter ${g.prestiges + 1}.`, "#f2c14e");
  addLog(g, `The next tale is a ${next.name}: ${next.desc}`, next.c);
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
  sfxEv(g, "hurt");
  if (m.hp <= 0) {
    m.alive = false; m.hp = 0; m.deadT = g.time;
    burst(g, m.x, m.y - 24, "#7a7490", 14, 1.6);
    shakeFx(g, 4);
    addLog(g, `${m.name} has fallen!`, "#ef6461");
    sfxEv(g, "fall");
    if (g.session) g.session.deaths++;
  }
}
function bossSpecial(g, e, alive) {
  const s = e.scale || 1;
  if (e.kind === "slime") {
    e.slamT = 0.45;
    shakeFx(g, 10);
    sfxEv(g, "slam");
    addLog(g, "ROYAL SLAM! The ground heaves beneath the party!", "#ef6461");
    for (const m of alive) if (m.alive) { hurtMember(g, m, e.dmg * 1.5, e); burst(g, m.x, m.y - 8, "#6fbf5e", 10, 1.8, 2); }
    burst(g, e.x, e.y - 10, "#6fbf5e", 24, 2.6, 2);
  } else if (e.kind === "bat") {
    e.screechT = 0.6;
    shakeFx(g, 6);
    sfxEv(g, "screech");
    addLog(g, "A deafening SCREECH staggers the party!", "#b07fe0");
    for (const m of alive) if (m.alive) { hurtMember(g, m, e.dmg * 0.9, e); m.atkT += 1.1; addFloat(g, m.x, m.y - 84, "DAZED", "#b07fe0"); }
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

/* ---------------- the tick ---------------- */
export function tick(g, dt) {
  g.time += dt;
  const qday = Math.floor(Date.now() / 86400000);
  if (g.questDay !== qday) rollQuests(g);
  g.healCd = Math.max(0, g.healCd - dt);
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
  if (g.vote) {
    g.vote.t -= dt;
    const keys = [...new Set(g.members.map((m) => m.key))];
    const yes = g.vote.yes.filter((k) => keys.includes(k)).length;
    const no = g.vote.no.filter((k) => keys.includes(k)).length;
    const n = Math.max(1, keys.length);
    if (yes * 2 > n) {
      addLog(g, `The vote passes (${yes} of ${n})! The tale shall be retold.`, "#b07fe0");
      g.vote = null;
      doPrestige(g);
    } else if (no * 2 >= n) {
      addLog(g, `The vote fails (${no} of ${n} against). The tale goes on.`, "#8b84ad");
      g.vote = null;
    } else if (g.vote.t <= 0) {
      addLog(g, "The vote to retell the tale expires. The tale goes on.", "#8b84ad");
      g.vote = null;
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
    if (g.members.length) { g.phase = "wipe"; g.wipeT = 4; g.projectiles = []; g.pending = []; addLog(g, "The party has been wiped out!", "#ef6461"); sfxEv(g, "wipe"); }
    else { g.phase = "advance"; g.advanceT = 2; }
    return;
  }
  if (!foes.length) {
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
    if (e.hp <= 0) continue;
    e.lunge = Math.max(0, e.lunge - dt);
    if (e.elite && e.kind === "skeleton" && !e.raised && e.hp <= e.maxHp * 0.6) {
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
    if (e.elite && e.kind === "imp" && !e.enraged && e.hp <= e.maxHp * 0.5) {
      e.enraged = true;
      e.dmg *= 1.5; e.spd *= 0.65;
      addFloat(g, e.x, e.y - 66 * (e.scale || 1) - 14, "ENRAGED!", "#ff4a3a", true);
      addLog(g, "The Imp Warlord flies into a burning rage!", "#ef6461");
      sfxEv(g, "enrage");
      burst(g, e.x, e.y - 26, "#ff6a3a", 16, 2);
      shakeFx(g, 4);
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
      if (e.cleaveWind > 0) {
        e.cleaveWind -= dt;
        e.atkT = Math.max(e.atkT, 0.4);
        if (Math.random() < dt * 30) sparkle(g, e.x, e.y - 24 * (e.scale || 1), "#ffb24a", 2);
        if (e.cleaveWind <= 0) { enemyCleave(g, e, party); e.cleaveT = rand(6, 9); }
      } else if (party.length >= 2) {
        e.cleaveT = (e.cleaveT == null ? rand(4, 7) : e.cleaveT) - dt;
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
    if (e.boss) shakeFx(g, 3);
    addFloat(g, tgt.x, tgt.y - 70, "-" + fmt(dmg), "#ef6461");
    sfxEv(g, "hurt");
    if (tgt.hp <= 0) {
      tgt.alive = false; tgt.hp = 0; tgt.deadT = g.time;
      burst(g, tgt.x, tgt.y - 24, "#7a7490", 14, 1.6);
      shakeFx(g, 4);
      addLog(g, `${tgt.name} has fallen!`, "#ef6461");
      sfxEv(g, "fall");
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
    case "buyPotion": {
      const p = POTIONS[msg.k];
      if (p && g.gold >= p.price) { g.gold -= p.price; g.stock[msg.k]++; }
      break;
    }
    case "toggleAuto": if (msg.k in g.auto) g.auto[msg.k] = !g.auto[msg.k]; break;
    case "skillUp": {
      const m = byId(msg.memberId);
      if (!m) break;
      const sk = SKILLS[m.cls].find((s) => s.id === msg.skillId);
      if (sk && m.sp > 0 && (m.skills[sk.id] || 0) < MAX_RANK) { m.skills[sk.id] = (m.skills[sk.id] || 0) + 1; m.sp--; }
      break;
    }
    case "setClass": {
      const m = byId(msg.memberId);
      if (m && CLASSES[msg.cls] && m.cls !== msg.cls) {
        m.cls = msg.cls; m.skills = {}; m.sp = m.level - 1;
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
        m.style = s.id;
        addLog(g, `${m.name} takes up the ways of the ${s.name}!`, CLASSES[m.cls].color);
      }
      break;
    }
    case "setBody": {
      const m = byId(msg.memberId);
      if (m && BODIES.find((b) => b.id === msg.body)) m.cos.body = msg.body;
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
    case "prestige": {
      if (g.stage < 21 || g.vote) break;
      const keys = [...new Set(g.members.map((m) => m.key))];
      if (keys.length <= 1) { doPrestige(g); break; }
      const starter = keys.includes(msg.voter) ? msg.voter : (keys.includes(msg.key) ? msg.key : null);
      const byName = starter ? (g.members.find((m) => m.key === starter) || {}).name : "The guild";
      g.vote = { kind: "prestige", t: 60, yes: starter ? [starter] : [], no: [], by: starter, byName };
      addLog(g, `${byName} calls a vote to retell the tale! A majority must agree within 60 seconds.`, "#b07fe0");
      break;
    }
    case "vote": {
      if (!g.vote) break;
      const key = msg.voter || msg.key;
      if (!key || !g.members.some((m) => m.key === key)) break;
      g.vote.yes = g.vote.yes.filter((k) => k !== key);
      g.vote.no = g.vote.no.filter((k) => k !== key);
      (msg.v ? g.vote.yes : g.vote.no).push(key);
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
    stage: g.stage, best: g.best, everBest: g.everBest,
    gold: g.gold, renown: g.renown, prestiges: g.prestiges,
    legacy: g.legacy, stock: g.stock, auto: g.auto,
    phase: g.phase, scroll: g.scroll, advanceT: g.advanceT, mutator: g.mutator,
    hall: (g.hall || []).slice(-25),
    bossT: g.bossT, prestigeT: g.prestigeT, buffT: g.buffT,
    autoSim: g.autoSim,
    vote: g.vote,
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

