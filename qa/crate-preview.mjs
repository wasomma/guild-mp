// Build the crate-preview.html harness inputs: a combat view snapshot plus
// the ceremony sprite pair copied from client assets. Bundle render like the
// kitsune harness (esbuild render.js -> prototype/render.bundle.mjs), then
// open /crate-preview.html on the art-preview server.
import { writeFileSync, copyFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
/* outputs land in prototype/ (where the .html harnesses fetch them), keyed
   off this file rather than the cwd so it runs from anywhere */
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const sim = await import("../shared/sim.js");
const { newWorld, joinVoice, tick, snapshot } = sim;

const g = newWorld();
joinVoice(g, "u0", "Aria", null);
joinVoice(g, "u1", "Bram", null);
joinVoice(g, "u2", "Cleo", null);
g.members[0].cls = "tank"; g.members[1].cls = "dps"; g.members[2].cls = "healer";
for (let s = 0; s < 400 && !(g.phase === "combat" && g.enemies.length); s++) tick(g, 0.05);
const snap = JSON.parse(JSON.stringify(snapshot(g, [])));
const view = { ...snap, time: g.time, shake: 0, connected: true, particles: [], floaters: [] };
writeFileSync(path.join(ROOT, "prototype/crate-view.json"), JSON.stringify(view));
copyFileSync(path.join(ROOT, "client/public/assets/crate/closed.png"), path.join(ROOT, "prototype/crate-closed.png"));
copyFileSync(path.join(ROOT, "client/public/assets/crate/open.png"), path.join(ROOT, "prototype/crate-open.png"));
console.log("harness inputs written: phase", g.phase, "members", g.members.length);
