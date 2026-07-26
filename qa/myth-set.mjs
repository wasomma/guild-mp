// Headless check (Phase 6): force members into the three NEW Myth pieces —
// Aurora Veil aura, Emberling pet, Starweave Mantle cape — and run the real
// draw code (combat + feast, where the Emberling has its rug behaviors)
// through the soak's mock canvas. Rebuild the bundle first:
//   npx esbuild client/src/render.js --bundle --format=esm \
//     --outfile=/tmp/render.bundle.mjs --alias:@shared=./shared
const gradient = { addColorStop() {} };
function mockCtx() {
  const store = {};
  return new Proxy(store, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === "createLinearGradient" || k === "createRadialGradient") return () => gradient;
      if (k === "measureText") return () => ({ width: 10 });
      if (k === "canvas") return { width: 640, height: 300 };
      return (..._args) => {};
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}
globalThis.document = {
  createElement(tag) {
    if (tag !== "canvas") throw new Error("unexpected createElement: " + tag);
    return { width: 0, height: 0, getContext: () => mockCtx() };
  },
};

const render = await import("/tmp/render.bundle.mjs");
const sim = await import("../shared/sim.js");
const { newWorld, joinVoice, tick, snapshot, CAPES, PETS, AURAS } = sim;

for (const [cat, id] of [[CAPES, "starweave"], [PETS, "phoenix"], [AURAS, "aurora"]]) {
  const it = cat.find((e) => e.id === id);
  if (!it) throw new Error(id + " missing from catalog");
  if (it.tier !== "myth") throw new Error(id + " is not Myth tier");
}
console.log("catalog entries present: starweave / phoenix / aurora, all Myth");

const g = newWorld();
for (let i = 0; i < 3; i++) joinVoice(g, "u" + i, "Hero" + i, null);
for (const m of g.members) {
  m.cos.cape = "starweave";
  m.cos.pet = "phoenix";
  m.cos.aura = "aurora";
}
for (let s = 0; s < 200; s++) tick(g, 0.05); // into combat

function drawFrames(name) {
  const snap = JSON.parse(JSON.stringify(snapshot(g, [])));
  const v = { ...snap, time: g.time, shake: 0, connected: true, particles: [], floaters: [] };
  const ctx = mockCtx();
  for (let i = 0; i < 60; i++) { v.time += 1 / 60; render.draw(ctx, v, 1 / 60); }
  console.log("PASS  " + name);
}
drawFrames("myth set, combat walking/fighting (" + g.phase + ")");
g.phase = "feast"; g.feastT = 10;
for (const m of g.members) m.walking = false;
drawFrames("myth set, feast hall (Emberling on the rug)");
console.log("==== myth render check: all pass ====");
