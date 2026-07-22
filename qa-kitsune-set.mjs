// Headless check: force a member into the full Kitsune cosmetic set and run
// the real draw code (combat + feast) through the soak's mock canvas.
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
const sim = await import("./shared/sim.js");
const { newWorld, joinVoice, tick, snapshot, HAIRS, HAIRSTYLES, ACCESSORIES, CAPES, AURAS } = sim;

// sanity: the new catalog entries exist
const foxHair = HAIRS.findIndex((h) => h.name === "Foxfire");
if (foxHair < 0) throw new Error("Foxfire hair missing");
for (const [cat, id] of [[HAIRSTYLES, "kitsune"], [ACCESSORIES, "foxmarks"], [CAPES, "ninetails"], [AURAS, "starfire"]]) {
  if (!cat.find((e) => e.id === id)) throw new Error(id + " missing from catalog");
}
console.log("catalog entries present: Foxfire idx", foxHair);

const g = newWorld();
for (let i = 0; i < 3; i++) joinVoice(g, "u" + i, "Hero" + i, null);
for (const m of g.members) {
  m.cos.hairstyle = "kitsune";
  m.cos.hair = foxHair;
  m.cos.accessory = "foxmarks";
  m.cos.cape = "ninetails";
  m.cos.aura = "starfire";
}
for (let s = 0; s < 200; s++) tick(g, 0.05); // into combat

function drawFrames(name) {
  const snap = JSON.parse(JSON.stringify(snapshot(g, [])));
  const v = { ...snap, time: g.time, shake: 0, connected: true, particles: [], floaters: [] };
  const ctx = mockCtx();
  for (let i = 0; i < 60; i++) { v.time += 1 / 60; render.draw(ctx, v, 1 / 60); }
  console.log("PASS  " + name);
}
drawFrames("kitsune set, combat walking/fighting (" + g.phase + ")");
g.phase = "feast"; g.feastT = 10;
for (const m of g.members) m.walking = false;
drawFrames("kitsune set, feast hall");
console.log("==== kitsune render check: all pass ====");
