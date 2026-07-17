/* =====================================================================
   Guild of the Open Mic : authoritative game server.
   One world instance (single guild for now), 20Hz tick, 10Hz broadcast,
   SQLite persistence (see db.js), presence-gated hibernation.

   Later steps plug in here:
   - The Discord bot calls joinVoice / leaveVoice instead of the client,
     and user_key becomes the Discord user ID.
   - Intents get bound to authenticated Discord user IDs (OAuth2).
   ===================================================================== */

import { WebSocketServer } from "ws";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { newWorld, tick, applyIntent, snapshot, rehydrateMember } from "../shared/sim.js";
import { saveWorld, loadWorld, characterCount, close as closeDb } from "./db.js";
import { startBot } from "./bot.js";
import { getSession, deleteSession } from "./db.js";
import { handleAuthHttp, authorizeIntent, oauthConfigured } from "./auth.js";

/* tiny .env loader so tokens never live in the code or shell history */
const ENV_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), ".env");
if (fs.existsSync(ENV_PATH)) {
  for (const line of fs.readFileSync(ENV_PATH, "utf8").split("\n")) {
    const m2 = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m2 && !(m2[1] in process.env)) process.env[m2[1]] = m2[2].replace(/^["']|["']$/g, "");
  }
}

const GUILD_ID = process.env.GUILD_ID || "default";
const PORT = process.env.PORT || 8787;
const TICK_MS = 50;          // 20Hz simulation
const BROADCAST_EVERY = 2;   // every 2nd tick = 10Hz state to clients
const SAVE_EVERY_MS = 20000; // crash-safety snapshot cadence
// intents worth persisting the moment they happen
const SAVE_ON = new Set(["leaveVoice", "prestige", "cosmetic", "legacyUp", "buyPotion", "skillUp", "setClass"]);

/* ---- one-time migration from the old JSON save ---- */
const LEGACY_JSON = path.join(path.dirname(fileURLToPath(import.meta.url)), "world.json");
function migrateLegacyJson() {
  if (!fs.existsSync(LEGACY_JSON) || loadWorld(GUILD_ID)) return;
  try {
    const raw = JSON.parse(fs.readFileSync(LEGACY_JSON, "utf8"));
    const g = Object.assign(newWorld(), raw);
    g.events = [];
    g.users.forEach((u) => (u.inVoice = false));
    for (const m of g.members) g.roster[m.name] = m;
    g.members = [];
    // rebuild roster members through rehydrate so old saves gain any new fields
    for (const key of Object.keys(g.roster)) g.roster[key] = rehydrateMember(g, g.roster[key]);
    saveWorld(GUILD_ID, g);
    fs.renameSync(LEGACY_JSON, LEGACY_JSON + ".imported");
    console.log("Migrated world.json into guild.db (old file kept as world.json.imported).");
  } catch (err) {
    console.error("Could not migrate world.json:", err.message);
  }
}

/* ---- load or create the world ---- */
migrateLegacyJson();
let world = loadWorld(GUILD_ID);
if (world) {
  world.enemies = []; world.projectiles = []; world.pending = [];
  world.phase = "advance"; world.advanceT = 2;
  console.log(`Loaded world "${GUILD_ID}": chapter ${world.prestiges + 1}, stage ${world.stage}, ${characterCount(GUILD_ID)} characters in the roster.`);
} else {
  world = newWorld();
  saveWorld(GUILD_ID, world);
  console.log(`No save found for "${GUILD_ID}". A new legend begins.`);
}

const save = () => { try { saveWorld(GUILD_ID, world); } catch (err) { console.error("Save failed:", err.message); } };

/* ---- static serving of the built client (client/dist), if present ----
   In production this makes the game a single service on a single port:
   the same origin serves the page, the OAuth endpoints, and the WebSocket. */
const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "client", "dist");
const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon",
  ".map": "application/json", ".woff2": "font/woff2", ".json": "application/json",
};
function serveStatic(req, res) {
  if (!fs.existsSync(DIST)) return false;
  let p = new URL(req.url, "http://localhost").pathname;
  if (p === "/") p = "/index.html";
  const file = path.normalize(path.join(DIST, p));
  if (!file.startsWith(DIST)) return false;
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return false;
  res.writeHead(200, {
    "Content-Type": MIME[path.extname(file)] || "application/octet-stream",
    "Cache-Control": p.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache",
  });
  fs.createReadStream(file).pipe(res);
  return true;
}

/* ---- http server (OAuth endpoints + static client) + websocket fan-out ---- */
const httpServer = http.createServer((req, res) => {
  if (handleAuthHttp(req, res)) return;
  if (serveStatic(req, res)) return;
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Guild of the Open Mic game server. Build the client (cd client && npm run build) to serve it from here.");
});
const wss = new WebSocketServer({ server: httpServer });
httpServer.listen(PORT, () => {
  console.log(`Game server listening on ws://localhost:${PORT}`);
  console.log(oauthConfigured()
    ? "Discord OAuth is ON: member actions require login and ownership."
    : "Discord OAuth is off (open dev mode). Set DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET to enable.");
});

function stamp(payload) {
  payload.authConfigured = oauthConfigured();
  return payload;
}

wss.on("connection", (sock) => {
  console.log(`Client connected (${wss.clients.size} total).`);
  sock.send(JSON.stringify(stamp(snapshot(world, []))));
  sock.on("message", (data) => {
    let msg;
    try { msg = JSON.parse(data); } catch { return; }
    /* session binding */
    if (msg.a === "auth") {
      const user = getSession(msg.token);
      sock.user = user || null;
      sock.send(JSON.stringify({ type: "auth", ok: !!user, user: user || null }));
      return;
    }
    if (msg.a === "logout") {
      if (msg.token) deleteSession(msg.token);
      sock.user = null;
      sock.send(JSON.stringify({ type: "auth", ok: false, user: null }));
      return;
    }
    /* bind ballots and vote calls to the authenticated identity */
    if (sock.user) msg.voter = sock.user.key;
    else if (oauthConfigured()) delete msg.voter;
    /* authorization, then application */
    if (!authorizeIntent(sock, msg, world)) {
      sock.send(JSON.stringify({ type: "denied", a: msg.a }));
      return;
    }
    try {
      applyIntent(world, msg);
      if (SAVE_ON.has(msg.a)) save();
    } catch (err) { console.error("Bad intent:", err.message); }
  });
});

function broadcast(payload) {
  const data = JSON.stringify(payload);
  for (const sock of wss.clients) if (sock.readyState === 1) sock.send(data);
}

/* ---- the loop: presence-gated tick, steady broadcast ---- */
let tickCount = 0;
let emptySince = null;
const CHRONICLE_GRACE = parseInt(process.env.CHRONICLE_GRACE_MS || "60000", 10);
setInterval(() => {
  const awake = world.members.length > 0 || world.autoSim;
  if (awake) tick(world, TICK_MS / 1000);
  /* without the bot, the session ledger still expires when the world sleeps */
  if (!world.members.length) {
    if (emptySince == null) emptySince = Date.now();
    if (!botActive && world.session && Date.now() - emptySince > CHRONICLE_GRACE) world.session = null;
  } else emptySince = null;
  tickCount++;
  if (tickCount % BROADCAST_EVERY === 0) {
    broadcast(stamp(snapshot(world, world.events.splice(0))));
  }
}, TICK_MS);

setInterval(save, SAVE_EVERY_MS);
let botActive = false;
startBot({ world, save }).then((c) => { botActive = !!c; }).catch(() => {});
const shutdown = () => { save(); closeDb(); console.log("\nWorld saved to guild.db. Farewell."); process.exit(0); };
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
