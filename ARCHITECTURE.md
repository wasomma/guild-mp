# Guild of the Open Mic: Multiplayer Architecture

This document describes the architecture for running the game as a shared, persistent, voice-channel-driven multiplayer experience. It also records which parts are implemented in this repository today and which are planned.

## Design goals

The game is one ongoing campaign per Discord server. Everyone in the designated voice channel plays in the same world at the same time. The simulation only advances while at least one person is present; when the channel empties, the world freezes exactly where it is. Characters belong to people, keyed by their Discord identity, and survive any number of disconnects, reconnects, and campaign resets. No client is ever trusted with game state; a single authoritative server decides everything.

## System overview

```
Discord voice channel
        |
        |  voiceStateUpdate events
        v
  Discord Bot (discord.js)
        |
        |  joinVoice / leaveVoice calls
        v
  Game Server (Node.js)  <----->  Database (SQLite / Postgres)
   - one world instance            - worlds table
     per Discord guild             - characters table
   - authoritative tick loop
   - intent validation
        ^
        |  WebSockets: snapshots down, intents up
        v
  Browser clients (React + canvas)
   - rendering and UI only
   - no simulation authority
```

The critical property is that the simulation lives in exactly one place. Browsers are windows into the world, not copies of it. Two people watching the same fight are seeing the same server-side entities, which is what makes the experience genuinely shared rather than two parallel single-player games that happen to look similar.

## The shared simulation module

All game rules live in `shared/sim.js`: classes, fighting styles, combat resolution, loot generation, the automatic chapter cycle and personal retelling (prestige) system, the cosmetic catalog, and the `tick(world, dt)` function that advances one frame of the world. The module has no rendering code and no I/O. It runs identically under Node on the server and could run in the browser for local prototyping.

The simulation communicates visual moments through an event queue rather than by mutating visual state. When a crit lands, the sim pushes `{t: "burst", x, y, color, ...}` and `{t: "float", text: "142!", ...}` onto `world.events`. The server drains this queue into each broadcast, and clients translate events into particles, floating numbers, and screen shake locally. This keeps the wire format small (events describe moments, not every particle) and keeps rendering at full frame rate even though state arrives at only 10Hz. Bigger moments ride the same queue: opening a Chronicle Crate emits `{t: "crate", tier, label, color, name | enc, hero}`, which the client turns into the full crate-opening cinematic (`drawCrateCeremony` in both renderers).

## The game server

`server/index.js` owns the world. Its responsibilities are the tick loop, the WebSocket fan-out, intent validation, and persistence.

The tick loop runs at 20Hz. It is gated on presence: if no members are in the party (and traffic simulation is off), the loop skips the tick entirely, which is the hibernation rule. The world does not decay, earn, or fight while nobody is there; it simply waits.

State snapshots broadcast at 10Hz to every connected socket. A snapshot contains the authoritative scalar state (stage, gold, renown, phase, timers), the entity lists (members, enemies, projectiles), the recent log, and the drained event queue. Clients interpolate entity positions between snapshots so movement renders smoothly despite the low state rate.

Everything a player can do arrives as an intent message, for example `{a: "cosmetic", memberId: 3, kind: "hat", key: "witch"}`. The server validates every intent against the world (does the guild have the gold, is the rank below max, does the item exist) and applies it or silently drops it. Clients never mutate shared state directly, so a modified client can request things but cannot take them.

The character creator commits through the owner-gated `appearance` intent (`{a: "appearance", memberId, race, body, skin, hairstyle, hair, under, underC, cls?}`), validated in `applyAppearance` against the free identity catalogs (RACES, SKINS, UNDERGARMENTS, UNDER_COLORS; hairstyles and hair colors must be free-tier or owned). The optional `cls` is the class pick (v0.1.32): accepted freely while `cos.fresh` — it re-roots the fighting style to the class's first style, resets skills, banks the skill points, and grants + equips the class's starter outfit (`CLASS_OUTFIT`) — and rejected after the first commit except as an idempotent re-send of the current class (later class changes go through the Skills tab's free respec). The creator shows the party's scarcest class (`classNeed`) as a hint. New characters spawn with `cos.fresh = true`, which the client uses to auto-open the creator on first join; the flag clears on the first successful commit and persists inside `cos` (no schema change — `cos` is a JSON column). Characters that predate the creator are backfilled to Human defaults on rehydrate and granted the five starter hairstyles.

## Instance lifecycle

Wake: the voice channel is empty and someone joins. The bot calls `joinVoice`. If the world is not in memory, the server loads it from the database, restores the person's character from the roster, and the tick loop resumes mid-stage, exactly where the campaign froze.

Live: people come and go. Each join adds their persistent character to the party (walking in from off-screen); each leave removes the character from the party and files it back into the roster. The world runs as long as one person remains.

Sleep: the last person leaves. After a short grace period to forgive network hiccups, the server writes a final snapshot and unloads the instance. While asleep, the world consumes nothing and changes nothing.

Crash safety comes from periodic snapshots (every 20 seconds while awake), a save on shutdown signal, and immediate write-through of significant intents such as purchases, skill points, retellings, and departures, so a hard crash loses seconds of idle progress at most and no deliberate player action.

## Identity and character persistence

A character is keyed by the player's Discord user ID (their snowflake), which is permanent and globally unique. The database's `user_key` column holds it. The same person always gets the same character regardless of device, browser, or how many times they disconnect. With the bot wired in, `user_key` holds the real snowflake; characters created in open dev mode (no bot) fall back to display names as keys and remain manageable by any logged-in user.

The persistent character record contains: name, class, fighting style, body type, level, XP, skill points and allocations, the three equipment slots, lifetime combat totals, the retelling count, the crate economy fields (held Chronicle Crates, Encore balance, Myth pity counter, first-King-of-the-day stamp), and the full cosmetic wardrobe (both owned and equipped, across all nine cosmetic categories). The persistent world record contains: stage, best stage, gold, renown, chapter (prestige) count, legacy upgrade ranks, the lifetime Gold Key counter and Eternal Saga rank, potion stock and auto-use settings, the user roster, daily quests, the active mutator, the Hall of Legends, and the running chapter accumulators.

The data model is three tables (see `server/db.js`; columns added after launch arrive via guarded `ALTER TABLE` migrations):

```
worlds
  guild_id (pk)   stage   best   ever_best   gold   renown   prestiges
  join_count   auto_sim   legacy (json)   stock (json)   auto (json)
  users (json)   quests (json)   quest_day   mutator   hall (json)
  chapter (json)   keys_cut   ascension   updated_at
  -- keys_cut = Gold Keys ever cut (drives the escalating price, never resets)
  -- ascension = Eternal Saga rank

characters
  guild_id + user_key (pk, user_key = Discord snowflake)
  name  class  style  level  xp  sp  kills  dmg_done  heal_done  retellings
  path  ult_mode  crates  encores  pity  king_day
  skills (json)  gear (json)  cos (json)  owned (json)  updated_at
  -- path = chosen talent path id (null until picked); ult_mode = auto|manual
  -- crates/encores/pity = the Phase 6 crate economy; king_day = UTC-day stamp
  --   of the last first-King Encore payout

sessions
  token (pk)   user_key   name   avatar   created_at   -- web OAuth sessions
```

SQLite is sufficient for a single community and keeps operations at zero. A `world.json` from the earliest builds migrates into the database automatically on first boot.

## The Discord bot

A discord.js client with the `Guilds` and `GuildVoiceStates` intents (neither is privileged) runs inside the game server process (`server/bot.js`) and watches the designated channel. On `voiceStateUpdate` it calls `joinVoice(world, discordUserId, displayName, true)` and `leaveVoice(world, discordUserId)` directly, the same functions the development sidebar drives through intents. On boot it fetches the channel and syncs anyone already sitting in it, so restarting the server mid-session wakes the world correctly. Users created by the bot carry a discord flag, and the intent layer refuses join and leave requests from web clients for those users, so browser buttons can never contradict real voice presence; the autoSim traffic generator skips them for the same reason. The bot also acts as an optional announcer, posting boss kills, elite kills, and chapter transitions into a text channel. Configuration lives in environment variables or `server/.env` (DISCORD_TOKEN, VOICE_CHANNEL_ID, optional ANNOUNCE_CHANNEL_ID); without them the bot stays off and the game runs unchanged.

## The listening party

`server/music.js` runs a synchronized YouTube listening session beside the simulation — deliberately outside it. Like voting and presence before it, music is a multiplayer nicety, not game state: it lives in memory only, never enters `shared/sim.js`, the snapshot, or SQLite, and the single-player prototype has no trace of it. This keeps it clear of the prototype-sync cardinal rule and of the seeded balance sweeps.

Clients send `{a: "music", op}` messages (`play`, `queue`, `skip`, `pause`, `resume`, `stop`, `join`, `leave`, `ended`), which `server/index.js` routes to the music module before `applyIntent` ever sees them. Every change broadcasts a dedicated `{type: "music", ...}` message carrying the current song, its shared clock (`epochStartMs` — wall-clock epoch milliseconds, because the snapshot's `now` is sim-seconds and freezes when the world hibernates), the queue, the listener roster, and `serverNow` so clients can correct for clock skew. Titles are fetched server-side from YouTube's keyless oEmbed endpoint.

The client (a header 🎧 pill plus a docked panel in `App.jsx`) embeds the official YouTube IFrame Player — visible at 320×200, per YouTube's terms of service, never hidden or audio-only — and keeps it on the shared clock: one precise seek when playback starts, then a drift check every five seconds that re-seeks any player more than ~2 seconds off (ad breaks served to some listeners are the usual cause). Song-end advancement is reported by the players themselves: every listening client sends `ended` with the id its player finished, and the server accepts the first report that matches the current song (stale and too-early reports are ignored), so the queue advances exactly once. When a party plays, the client's generative music box yields and the game's Web Audio output ducks under the song. Listening is open to spectators; mutating ops require login when OAuth is configured, the same bar as guild intents.

## Web client authentication

Spectating requires nothing. Acting on a character (spending gold, allocating skill points) requires proving which Discord user you are, which is solved with "Log in with Discord" OAuth2, implemented in `server/auth.js`. The game server doubles as a small HTTP server: `/auth/login` redirects to Discord's consent screen with only the identify scope, `/auth/callback` exchanges the code, fetches the user's identity, mints a random session token stored in the SQLite sessions table, and bounces the browser back to the client with the token in the URL fragment. The client stores it and presents it over the WebSocket, binding the socket to that Discord user.

Enforcement happens per intent before the simulation ever sees it. When OAuth is configured: intents targeting a Discord-owned character (skills and talents — `skillUp`, `choosePath`, `respecSkills`, `setAutoSkill`, the manual-ultimate pair `setUltMode`/`fireUlt` — wardrobe, crate opening `openCrate`/`commissionCrate`, retelling their tale) require the socket to be bound to that exact snowflake; guild-wide intents (potion auto-toggles, legacy upgrades, Eternal Saga `ascend`, retreat votes — the `retreat` intent is per-user-keyed and needs a majority of the party within 25s) require any authenticated user; characters not owned by a Discord identity (from open dev mode) remain manageable by any logged-in user; spectating stays open. Denied intents get an explicit denial message so the client can react. When OAuth is not configured, everything is open, which is the local development mode. Sessions survive server restarts and expire after 30 days; logout revokes them immediately.

An alternative packaging is a Discord Activity, where the game runs in an iframe inside the voice channel itself and identity arrives from the Activities SDK for free. Everything server-side stays the same; only the client shell and auth flow change. The standalone web client should be built first because the Activity can be layered on top of the identical backend later.

## Deployment shape

In production the game is a single Node process on a single port: it runs the simulation, exposes the OAuth endpoints, serves the built web client from `client/dist`, and accepts the WebSocket, all on the same origin. A reverse proxy (Caddy in the provided configuration) terminates HTTPS in front of it, and the client automatically upgrades to wss:// when the page is served over https://. State remains one SQLite file, so backup is file copy. DEPLOY.md walks through a complete VPS setup with systemd and Caddy.

## Scaling notes

One idle simulation is computationally trivial, so a single Node process comfortably hosts hundreds of guild instances by keeping a map of guild ID to world and ticking the awake ones. Snapshot fan-out is the first real cost and is bounded by voice channel sizes, which are small. If it ever matters, instances shard cleanly across processes by guild ID because worlds share nothing with each other.

## Roadmap and current status

Step 1, extract the simulation into a shared module: done in this repository (`shared/sim.js`).

Step 2, authoritative server with WebSocket broadcast and a thin rendering client: done in this repository (`server/index.js`, `client/`). The client's early dev stand-in sidebar (manual join/leave buttons) has since been retired; the sidebar now shows the live party, and presence flows only through the bot's intents.

Step 3, persistence and the wake/sleep lifecycle: done in this repository. SQLite (`server/guild.db`) holds the worlds and characters tables, the tick loop is presence-gated, characters survive departure in the roster, and important intents persist immediately. The old JSON save migrates automatically.

Step 4, the Discord bot driving membership from real voice events: done in this repository (`server/bot.js`). It runs inside the server process, syncs the channel on boot, keys characters by snowflake, and optionally announces milestones. The sidebar remains for local development and cannot act on Discord-controlled users.

Step 5, Discord OAuth2 binding browser actions to Discord identities: done in this repository (`server/auth.js`, sessions table in `server/db.js`). Configure DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET to turn enforcement on; without them the server runs in open dev mode.

Step 6, optional Discord Activity packaging: future work on top of the same backend.
