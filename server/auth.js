/* =====================================================================
   Discord OAuth2 for the web client.

   Flow: the browser hits GET /auth/login on this server, which redirects
   to Discord's consent screen (scope: identify only). Discord redirects
   back to GET /auth/callback, the server exchanges the code for the
   user's identity, mints a random session token stored in SQLite, and
   bounces the browser back to the client with the token in the URL
   fragment. The client then presents that token over the WebSocket
   ({a:"auth", token}) and the socket becomes bound to a Discord user.

   Authorization policy (enforced in authorizeIntent, used by index.js):
   - When OAuth is NOT configured, everything is open (local dev mode).
   - When configured: acting on a Discord-owned character requires being
     that character's owner. Guild-wide actions (potions, prestige,
     legacy) and the dev sidebar require any authenticated user.
     Spectating never requires login.

   Configuration (server/.env):
     DISCORD_CLIENT_ID      application client ID
     DISCORD_CLIENT_SECRET  application client secret
     OAUTH_REDIRECT_URI     default http://localhost:8787/auth/callback
     CLIENT_URL             default http://localhost:5173
   ===================================================================== */

import crypto from "crypto";
import { createSession, deleteSession } from "./db.js";

const PORT = process.env.PORT || 8787;
const clientId = () => process.env.DISCORD_CLIENT_ID;
const clientSecret = () => process.env.DISCORD_CLIENT_SECRET;
const redirectUri = () => process.env.OAUTH_REDIRECT_URI || `http://localhost:${PORT}/auth/callback`;
const clientUrl = () => process.env.CLIENT_URL || "http://localhost:5173";

export const oauthConfigured = () => !!(clientId() && clientSecret());

/* short-lived anti-forgery states for the redirect roundtrip */
const pendingStates = new Map();
function newState() {
  const s = crypto.randomBytes(16).toString("hex");
  pendingStates.set(s, Date.now());
  for (const [k, t] of pendingStates) if (Date.now() - t > 5 * 60 * 1000) pendingStates.delete(k);
  return s;
}

function redirect(res, url) {
  res.writeHead(302, { Location: url });
  res.end();
}
function text(res, code, body) {
  res.writeHead(code, { "Content-Type": "text/plain" });
  res.end(body);
}

/* Returns true if this module handled the request. */
export function handleAuthHttp(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === "/auth/login") {
    if (!oauthConfigured()) return text(res, 503, "Discord OAuth is not configured on this server."), true;
    const q = new URLSearchParams({
      client_id: clientId(),
      redirect_uri: redirectUri(),
      response_type: "code",
      scope: "identify",
      state: newState(),
      prompt: "none",
    });
    redirect(res, `https://discord.com/oauth2/authorize?${q}`);
    return true;
  }

  if (url.pathname === "/auth/callback") {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !pendingStates.delete(state)) return text(res, 400, "Invalid OAuth state. Please try logging in again."), true;
    (async () => {
      try {
        const tr = await fetch("https://discord.com/api/oauth2/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: clientId(),
            client_secret: clientSecret(),
            grant_type: "authorization_code",
            code,
            redirect_uri: redirectUri(),
          }),
        });
        const tok = await tr.json();
        if (!tok.access_token) throw new Error(tok.error_description || "token exchange failed");
        const ur = await fetch("https://discord.com/api/users/@me", {
          headers: { Authorization: `Bearer ${tok.access_token}` },
        });
        const u = await ur.json();
        if (!u.id) throw new Error("could not fetch identity");
        const session = crypto.randomBytes(32).toString("hex");
        const name = (u.global_name || u.username || "adventurer").slice(0, 16);
        const avatar = u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=64` : null;
        createSession(session, u.id, name, avatar);
        redirect(res, `${clientUrl()}/#token=${session}`);
      } catch (err) {
        console.error("OAuth callback failed:", err.message);
        text(res, 500, "Login failed: " + err.message);
      }
    })();
    return true;
  }

  if (url.pathname === "/auth/logout") {
    deleteSession(url.searchParams.get("token"));
    text(res, 200, "ok");
    return true;
  }

  return false;
}

/* ---- intent authorization ---- */
const MEMBER_INTENTS = new Set(["skillUp", "setClass", "setStyle", "setBody", "cosmetic"]);
const GUILD_INTENTS = new Set(["buyPotion", "toggleAuto", "prestige", "vote", "legacyUp", "joinVoice", "leaveVoice", "autoSim"]);

export function authorizeIntent(sock, msg, world) {
  if (!oauthConfigured()) return true; // local dev mode: everything open
  if (MEMBER_INTENTS.has(msg.a)) {
    const m = world.members.find((x) => x.id === msg.memberId);
    if (!m) return false;
    const owner = world.users.find((u) => u.key === m.key);
    if (owner && owner.discord) return !!sock.user && sock.user.key === m.key;
    return !!sock.user; // dev-sidebar characters: any logged-in user may manage them
  }
  if (GUILD_INTENTS.has(msg.a)) return !!sock.user;
  return true; // auth/logout and unknown intents fall through to the normal handlers
}
