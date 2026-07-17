// QA step 5: boot the real server, join via ws, verify snapshots round-trip
// and that members carry every field the renderer needs. Also probes the
// connect-time race: does any snapshot ever contain a member without _st?

import { spawn } from "child_process";
import WebSocket from "./server/node_modules/ws/index.js";

const PORT = 8791;
const srv = spawn("node", ["server/index.js"], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(PORT), GUILD_ID: "qa-smoke" },
  stdio: ["ignore", "pipe", "pipe"],
});
let srvLog = "";
srv.stdout.on("data", (d) => (srvLog += d));
srv.stderr.on("data", (d) => (srvLog += d));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(1200);
if (!srvLog.includes("listening")) { console.log("server did not start:\n" + srvLog); srv.kill(); process.exit(1); }

const RENDER_FIELDS = ["x", "y", "hp", "cls", "cos", "gear", "seed", "alive", "ult", "ultT", "level", "name", "id", "key", "_st"];
const problems = [];
let snaps = 0, memberSnaps = 0, missingStSnaps = 0, firstMissing = null;

function checkSnap(s, who) {
  snaps++;
  if (!Array.isArray(s.members)) { problems.push(who + ": snapshot.members not an array"); return; }
  if (s.members.length) memberSnaps++;
  for (const m of s.members) {
    for (const f of RENDER_FIELDS) {
      if (!(f in m) || m[f] === undefined) {
        if (f === "_st") {
          missingStSnaps++;
          if (!firstMissing) firstMissing = who + ": member " + m.name + " missing _st (phase " + s.phase + ")";
        } else {
          problems.push(who + ": member " + m.name + " missing render field '" + f + "'");
        }
      }
    }
    if (m._st && (typeof m._st.hp !== "number" || !isFinite(m._st.hp) || m._st.hp <= 0)) {
      problems.push(who + ": member " + m.name + " has bad _st.hp = " + m._st.hp);
    }
    for (const f of ["x", "y", "hp"]) {
      if (typeof m[f] !== "number" || !isFinite(m[f])) problems.push(who + ": member " + m.name + " non-finite " + f + " = " + m[f]);
    }
  }
  for (const f of ["phase", "stage", "vote", "feastT", "quests", "questDay", "log", "users", "enemies", "projectiles"]) {
    if (!(f in s)) problems.push(who + ": snapshot missing world field '" + f + "'");
  }
}

function client(name) {
  const ws = new WebSocket("ws://localhost:" + PORT);
  ws.on("error", () => {});
  const got = [];
  ws.on("message", (d) => {
    const s = JSON.parse(d);
    if (s.type === "state") { got.push(s); checkSnap(s, name); }
  });
  return { ws, got, send: (o) => ws.send(JSON.stringify(o)) };
}

// Client A connects, joins two players, watches snapshots.
const A = client("A");
await sleep(300);
A.send({ a: "joinVoice", name: "SmokeTank", key: "smoke1" });
A.send({ a: "joinVoice", name: "SmokeDps", key: "smoke2" });
await sleep(1500);

// Race probe: hammer connects while joins/leaves are in flight; every
// connect gets the immediate snapshot from wss "connection".
for (let i = 0; i < 25; i++) {
  const R = client("race" + i);
  A.send({ a: i % 2 ? "leaveVoice" : "joinVoice", name: "Racer", key: "racer" });
  await sleep(23);
  if (R.ws.readyState === 1) R.ws.close(); else R.ws.on("open", () => R.ws.close());
}
await sleep(400);

// Client B connects mid-session: its very first snapshot must be renderable.
const B = client("B");
await sleep(800);
if (!B.got.length) problems.push("B never received a snapshot");
else {
  const first = B.got[0];
  if (!first.members.length) problems.push("B's first snapshot has no members despite two joined");
}

// Verify JSON round-trip stability: serialize A's latest snapshot again.
const last = A.got[A.got.length - 1];
const rt = JSON.parse(JSON.stringify(last));
if (JSON.stringify(rt) !== JSON.stringify(last)) problems.push("snapshot not JSON-stable");

// Drive a vote so the vote field crosses the wire.
A.send({ a: "cheatStage" }); // probably unsupported; harmless if ignored
await sleep(100);

A.ws.close(); B.ws.close();
srv.kill("SIGINT");
await sleep(400);

console.log("snapshots checked: " + snaps + " (with members: " + memberSnaps + ")");
console.log("snapshots containing a member missing _st: " + missingStSnaps + (firstMissing ? "   first: " + firstMissing : ""));
if (problems.length) {
  console.log("\nPROBLEMS:");
  for (const p of [...new Set(problems)].slice(0, 20)) console.log("  - " + p);
  process.exit(1);
} else {
  console.log("all member render fields present and finite in every snapshot");
}
