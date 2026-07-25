// Headless creator-feature test (run from guild-mp root, then delete).
import {
  newWorld, joinVoice, tick, applyIntent, applyAppearance,
  dehydrateMember, rehydrateMember,
  RACES, SKINS, UNDERGARMENTS, UNDER_COLORS, FREE_HAIRSTYLES, raceOf,
  STYLES, CLASS_OUTFIT,
} from "./shared/sim.js";

let fails = 0;
const ok = (cond, name) => { console.log((cond ? "PASS" : "FAIL") + " " + name); if (!cond) fails++; };

const g = newWorld();
joinVoice(g, "u1", "Testa", null);
const m = g.members[0];

// spawn defaults
ok(RACES.some((r) => r.id === m.cos.race), "spawn race is a catalog id");
ok(Number.isInteger(m.cos.skin) && m.cos.skin >= 0 && m.cos.skin < SKINS.length, "spawn skin in range");
ok(UNDERGARMENTS.some((u) => u.id === m.cos.under), "spawn undergarment valid");
ok(m.cos.fresh === true, "fresh flag set on new character");
ok(FREE_HAIRSTYLES.every((h) => m.owned.hairstyle.includes(h)), "all five starter hairstyles owned");

// invalid payloads rejected
ok(applyAppearance(g, m, { race: "dragon", body: "m", skin: 0, under: "wrap", underC: 0, hair: 0, hairstyle: "short" }) === false, "unknown race rejected");
ok(applyAppearance(g, m, { race: "elf", body: "x", skin: 0, under: "wrap", underC: 0, hair: 0, hairstyle: "short" }) === false, "unknown body rejected");
ok(applyAppearance(g, m, { race: "elf", body: "f", skin: 99, under: "wrap", underC: 0, hair: 0, hairstyle: "short" }) === false, "skin out of range rejected");
ok(applyAppearance(g, m, { race: "elf", body: "f", skin: 2, under: "wrap", underC: 0, hair: 8, hairstyle: "short" }) === false, "unowned hair color rejected");
ok(applyAppearance(g, m, { race: "elf", body: "f", skin: 2, under: "wrap", underC: 0, hair: 0, hairstyle: "kitsune" }) === false, "unowned premium hairstyle rejected");
ok(m.cos.fresh === true, "fresh flag survives rejected payloads");

// valid commit through the intent layer
applyIntent(g, { a: "appearance", memberId: m.id, race: "dwarf", body: "m", skin: 3, under: "vest", underC: 2, hair: 1, hairstyle: "bob" });
ok(m.cos.race === "dwarf" && m.cos.skin === 3 && m.cos.under === "vest" && m.cos.underC === 2 && m.cos.hair === 1 && m.cos.hairstyle === "bob", "appearance intent applies all fields");
ok(!("fresh" in m.cos), "fresh flag cleared on commit");
ok(raceOf(m).beard === true, "raceOf resolves the dwarf");
ok(g.log.some((l) => l.text.includes("Dwarf")), "first-join log line mentions the race");

// re-edit is free and logged differently
applyIntent(g, { a: "appearance", memberId: m.id, race: "tiefling", body: "f", skin: 7, under: "wrap", underC: 4, hair: 2, hairstyle: "long" });
ok(m.cos.race === "tiefling", "free re-edit applies");
ok(g.log.some((l) => l.text.includes("outfitter")), "re-edit log line used");

// class pick at the first commit (COMBAT-REWORK decision 1)
joinVoice(g, "u2", "Testb", null);
const mc = g.members.find((x) => x.key === "u2");
ok(mc.cos.fresh === true, "second hero arrives fresh");
ok(applyAppearance(g, mc, { race: "elf", body: "f", skin: 1, under: "wrap", underC: 0, hair: 0, hairstyle: "short", cls: "wizard" }) === false, "unknown class rejected");
ok(mc.cos.fresh === true, "fresh flag survives rejected class");
applyIntent(g, { a: "appearance", memberId: mc.id, race: "elf", body: "f", skin: 1, under: "wrap", underC: 0, hair: 0, hairstyle: "short", cls: "healer" });
ok(mc.cls === "healer", "class pick applies on the first commit");
ok(STYLES.healer.some((s) => s.id === mc.style), "style re-rooted to the new class");
ok(mc.cos.outfit === CLASS_OUTFIT.healer && mc.owned.outfit.includes(CLASS_OUTFIT.healer), "class starter outfit granted and equipped");
ok(mc._st.heal > 0 && mc.hp === mc._st.hp, "stats recomputed for the new class");
ok(applyAppearance(g, mc, { race: "elf", body: "f", skin: 1, under: "wrap", underC: 0, hair: 0, hairstyle: "short", cls: "tank" }) === false, "class change rejected once through the doors");
ok(mc.cls === "healer", "class untouched by the rejected commit");
ok(applyAppearance(g, mc, { race: "elf", body: "f", skin: 1, under: "wrap", underC: 0, hair: 0, hairstyle: "short", cls: "healer" }) === true, "re-sending the current class is fine");
ok(applyAppearance(g, mc, { race: "elf", body: "m", skin: 2, under: "vest", underC: 1, hair: 1, hairstyle: "bob" }) === true, "cls-less mirror commit still works");

// persistence round-trip
const d = JSON.parse(JSON.stringify(dehydrateMember(m)));
const g2 = newWorld();
const m2 = rehydrateMember(g2, d);
ok(m2.cos.race === "tiefling" && m2.cos.skin === 7 && m2.cos.under === "wrap" && m2.cos.underC === 4, "identity survives dehydrate/rehydrate");
ok(!("fresh" in m2.cos), "fresh does not resurrect on rehydrate");

// pre-creator character backfill (grandfathering)
const legacy = { key: "old", name: "Oldtimer", cls: "tank", style: "warrior", level: 5, xp: 0, sp: 0, skills: {}, gear: { weapon: null, armor: null, trinket: null },
  cos: { body: "m", hat: "none", hair: 0, hairstyle: "short", outfit: 3, weapon: "steel", accessory: "none", cape: "none", pet: "none", aura: "none" },
  owned: { hat: ["none"], hair: [0, 1, 2, 3], hairstyle: ["short"], outfit: [0, 3], weapon: ["steel"], accessory: ["none"], cape: ["none"], pet: ["none"], aura: ["none"] },
  kills: 0, dmgDone: 0, healDone: 0, retellings: 0 };
const m3 = rehydrateMember(g2, legacy);
ok(m3.cos.race === "human" && m3.cos.skin === 0 && m3.cos.under === "wrap", "legacy character backfilled with defaults");
ok(!m3.cos.fresh, "legacy character does not get the creator forced on them");
ok(FREE_HAIRSTYLES.every((h) => m3.owned.hairstyle.includes(h)), "legacy character grandfathered the free hairstyles");

// world still ticks with the new fields
for (let i = 0; i < 200; i++) tick(g, 0.05);
ok(g.members.length === 2 && g.members.every((x) => x.alive !== undefined), "world ticks cleanly");

console.log(fails === 0 ? "ALL CREATOR TESTS PASS" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
