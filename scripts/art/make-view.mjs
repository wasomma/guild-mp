// Write prototype/kitsune-view.json for a given stage, with the party
// settled in formation and enemies alive. Run from the guild-mp root:
//   node scripts/art/make-view.mjs <stage> [scenario]
// scenario "tanks" = Phase 7D judge party (three HD warrior-tank combos +
// one paperdoll DPS for the density comparison); default = kitsune party.
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const sim = await import(pathToFileURL(process.cwd() + "/shared/sim.js"));
const { newWorld, joinVoice, tick, snapshot, HAIRS } = sim;
const foxHair = HAIRS.findIndex((h) => h.name === "Foxfire");
const g = newWorld();
const scenario = process.argv[3] || "kitsune";
if (scenario === "tanks") {
  joinVoice(g, "u0", "IronM", null);
  joinVoice(g, "u1", "GoldF", null);
  joinVoice(g, "u2", "DuskM", null);
  joinVoice(g, "u3", "Scout", null);
  const combos = [
    { cls: "tank", style: "warrior", cos: { body: "m", hairstyle: "short", hair: 0, outfit: 0, weapon: "steel" } },
    { cls: "tank", style: "warrior", cos: { body: "f", hairstyle: "pony", hair: 2, outfit: 4, weapon: "gold" } },
    { cls: "tank", style: "warrior", cos: { body: "m", hairstyle: "bob", hair: 1, outfit: 3, weapon: "obsidian" } },
    { cls: "dps", style: "rogue", cos: {} },
  ];
  g.members.forEach((m, i) => {
    const c = combos[i];
    m.cls = c.cls; m.style = c.style;
    Object.assign(m.cos, { hat: "none", accessory: "none", cape: "none", pet: "none", aura: "none" }, c.cos);
  });
} else {
  joinVoice(g, "u0", "Kitsune", null);
  joinVoice(g, "u1", "Hero1", null);
  joinVoice(g, "u2", "Hero2", null);
  g.members[0].cls = "dps"; g.members[1].cls = "tank"; g.members[2].cls = "healer";
  for (const m of g.members) {
    m.cos.hairstyle = "kitsune"; m.cos.hair = foxHair; m.cos.accessory = "foxmarks";
    m.cos.cape = "ninetails"; m.cos.aura = "starfire"; m.cos.body = "f";
  }
}
const stage = Number(process.argv[2]) || 2;
g.stage = stage; g.best = Math.max(g.best, g.stage); g.enemies = []; g.phase = "advance"; g.advanceT = 0.01;
for (let s = 0; s < 400 && !(g.phase === "combat" && g.enemies.length); s++) tick(g, 0.05);
let settled = 0;
for (let s = 0; s < 200 && g.phase === "combat" && g.enemies.length; s++) {
  tick(g, 0.05);
  const tank = g.members.find((m) => m.cls === "tank");
  if (Math.abs(tank.x - 250) < 3) { settled++; if (settled >= 4) break; }
}
const snap = JSON.parse(JSON.stringify(snapshot(g, [])));
const view = { ...snap, time: g.time, shake: 0, connected: true, particles: [], floaters: [] };
writeFileSync("prototype/kitsune-view.json", JSON.stringify(view));
console.log("stage", stage, "phase", g.phase, "enemies", g.enemies.map(e => e.kind + "@" + Math.round(e.x)).join(","));
