// Run from the repo root after bundling render (see QA-STATUS.md soak command),
// then copy /tmp/render.bundle.mjs to prototype/ and open /kitsune-preview.html.
// Build a view snapshot with every member in the full Kitsune set, for the
// kitsune-preview.html dev harness.
// Optional arg: a stage number (e.g. 6 = Gloomwood, 11 = Crypt, 16 = Emberdeep)
// or "feast" for the mead hall.
import { writeFileSync } from "node:fs";
const sim = await import("./shared/sim.js");
const { newWorld, joinVoice, tick, snapshot, HAIRS, endChapter } = sim;

const foxHair = HAIRS.findIndex((h) => h.name === "Foxfire");
const g = newWorld();
joinVoice(g, "u0", "Kitsune", null);
joinVoice(g, "u1", "Hero1", null);
joinVoice(g, "u2", "Hero2", null);
g.members[0].cls = "dps"; g.members[1].cls = "tank"; g.members[2].cls = "healer";
for (const m of g.members) {
  m.cos.hairstyle = "kitsune";
  m.cos.hair = foxHair;
  m.cos.accessory = "foxmarks";
  m.cos.cape = "ninetails";
  m.cos.aura = "starfire";
  m.cos.body = "f";
}
const arg = process.argv[2];
if (arg === "feast") {
  endChapter(g);
  for (let s = 0; s < 40; s++) tick(g, 0.05);
} else {
  if (arg) { g.stage = Number(arg); g.best = Math.max(g.best, g.stage); g.enemies = []; g.phase = "advance"; g.advanceT = 0.01; }
  for (let s = 0; s < 400 && !(g.phase === "combat" && g.enemies.length); s++) tick(g, 0.05);
}
const snap = JSON.parse(JSON.stringify(snapshot(g, [])));
const view = { ...snap, time: g.time, shake: 0, connected: true, particles: [], floaters: [] };
writeFileSync("prototype/kitsune-view.json", JSON.stringify(view));
console.log("view written: phase", g.phase, "enemies", g.enemies.length, "members", g.members.length);
