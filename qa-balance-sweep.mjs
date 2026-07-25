// Balance baseline sweep (COMBAT-REWORK.md Phase 0).
// Runs the harness matrix — 7 compositions x {fresh, live} — and writes a
// baseline JSON per fixture to docs/balance/baselines/. Run it before and
// after every rework phase; the JSON diff is the evidence.
//
//   node qa-balance-sweep.mjs [--fixture=fresh|live|both] [--chapters=3]
//                             [--seed=20260725] [--comps=trinity,solo-dps]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { COMPS, STYLE_FOR, LIVE, measure } from "./scripts/balance/harness.mjs";
import { VERSION } from "./shared/version.js";

const args = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => {
    const [k, v] = a.slice(2).split("=");
    return [k, v ?? true];
  })
);
const fixtures = args.fixture === "fresh" ? ["fresh"] : args.fixture === "live" ? ["live"] : ["fresh", "live"];
const chapters = Number(args.chapters) || 3;
const seed = Number(args.seed) || 20260725;
const compNames = args.comps ? String(args.comps).split(",") : Object.keys(COMPS);

const root = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(root, "docs", "balance", "baselines");
fs.mkdirSync(outDir, { recursive: true });

const pad = (s, n) => String(s).padEnd(n);
const num = (x, n) => String(x).padStart(n);

for (const fixture of fixtures) {
  const live = fixture === "live";
  const runs = [];
  console.log(`\n=== ${fixture.toUpperCase()} fixture — ${chapters} chapters per comp, seed ${seed} ===`);
  console.log(
    pad("comp", 12) + num("ch", 3) + num("king TTK", 10) + num("king rng", 14) + num("king tries", 11) +
    num("norm TTK", 9) + num("%HP/stg", 8) + num("wipes", 6) + num("deaths", 7) + num("threat", 7) + "  note"
  );
  for (const comp of compNames) {
    const r = measure(comp, { live, chapters, seed });
    runs.push(r);
    const kings = r.kings;
    console.log(
      pad(comp, 12) +
      num(r.chaptersCompleted, 3) +
      num(kings.ttkAvg + "s", 10) +
      num(`${kings.ttkMin}-${kings.ttkMax}s`, 14) +
      num(`${kings.attempts}/${kings.cleared}`, 11) +
      num(r.normals.ttkAvg + "s", 9) +
      num(r.hpLostPctAvg ?? r.hpLostPctPerStage, 8) +
      num(r.wipes, 6) +
      num(r.deaths, 7) +
      num(r.finalThreat, 7) +
      (r.timedOut ? "  TIMED OUT" : "")
    );
  }
  const meta = {
    version: VERSION,
    generatedAt: new Date().toISOString(),
    node: process.version,
    seed, chapters, fixture,
    notes: [
      "Styles fixed per class: " + JSON.stringify(STYLE_FOR),
      "Mutators stripped each chapter (measurement noise).",
      "Potions auto-restocked to the stipend baseline whenever gold allows.",
      live ? "Live fixture: " + JSON.stringify({ ...LIVE, gearNote: "epic-grade fabricated gear, no affixes" }) : "Fresh world from newWorld().",
      "kings.attempts counts combat entries at king stages; attempts > cleared means wipes forced re-fights.",
    ],
  };
  /* A version's baseline is written once, at release. Mid-tuning sweeps run
     BEFORE the version bump and would silently overwrite the previous
     release's numbers (this happened twice) — so an existing file is
     protected unless --force is passed. */
  const file = path.join(outDir, `v${VERSION}-${fixture}.json`);
  if (fs.existsSync(file) && !args.force) {
    console.log(`baseline EXISTS, not overwritten (tuning sweep? bump VERSION first, or pass --force): ${path.relative(root, file)}`);
  } else {
    fs.writeFileSync(file, JSON.stringify({ meta, runs }, null, 1));
    console.log(`baseline written: ${path.relative(root, file)}`);
  }
}
