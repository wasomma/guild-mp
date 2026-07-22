// Build a feast view with six members, one of each pet, for the
// prototype/pet-preview.html dev harness (animated pet-corner review).
// Run from the repo root, then bundle render and serve prototype/ —
// same workflow as qa-kitsune-preview.mjs (see QA-STATUS.md soak command).
import { writeFileSync } from "node:fs";
const sim = await import("./shared/sim.js");
const { newWorld, joinVoice, tick, snapshot, endChapter } = sim;

const g = newWorld();
const pets = ["cat", "pup", "drake", "slimelet", "owl", "wisp"];
const classes = ["tank", "dps", "healer", "dps", "tank", "dps"];
for (let i = 0; i < 6; i++) joinVoice(g, "u" + i, "Hero" + i, null);
g.members.forEach((m, i) => { m.cls = classes[i]; m.cos.pet = pets[i]; });
for (let s = 0; s < 60 && !(g.phase === "combat"); s++) tick(g, 0.05);
endChapter(g);
for (let s = 0; s < 80; s++) tick(g, 0.05); /* let everyone reach their spots */
const snap = JSON.parse(JSON.stringify(snapshot(g, [])));
const view = { ...snap, time: g.time, shake: 0, connected: true, particles: [], floaters: [] };
writeFileSync("prototype/feast-pets-view.json", JSON.stringify(view));
console.log("view written: phase", g.phase, "members", g.members.length, "pets", g.members.map((m) => m.cos.pet).join(","));
