# Guild of the Open Mic (multiplayer)

A shared, persistent, voice-channel-driven idle RPG. One authoritative game world runs on the server; every browser is a live window into the same fight. See ARCHITECTURE.md for the full design.

For putting this on the internet so friends can connect remotely, see DEPLOY.md.

## Running it

You need Node 18 or newer and two terminals.

Terminal 1, the game server:

```
cd server
npm install
npm start
```

Terminal 2, the web client:

```
cd client
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173). Open it in two browser windows side by side to see the shared world: join a user from one window and watch them walk into frame in both.

## What is where

`shared/sim.js` holds every game rule and no rendering. The server ticks it; a future Discord bot calls its `joinVoice` and `leaveVoice` functions directly.

`server/index.js` runs the world at 20Hz, broadcasts snapshots at 10Hz over WebSockets, validates every client intent, and freezes the simulation whenever nobody is in the party (the hibernation rule). `server/db.js` persists everything to SQLite (`server/guild.db`): every 20 seconds, on shutdown, and instantly whenever a purchase, skill point, prestige, or departure happens.

`client/` renders snapshots on a canvas with interpolation, turns server events into particles and floating numbers locally, and sends every button press to the server as an intent. The voice panel in the sidebar is a development stand-in; users who arrive through the real Discord bot show a "discord" badge there instead of Join and Leave buttons, since only real voice presence may control them.

`server/bot.js` is the Discord bot. It runs inside the game server process and turns voice-channel presence into party membership, keyed by Discord user IDs.

## Connecting Discord

1. Create an application at https://discord.com/developers/applications, add a Bot to it, and copy the bot token.
2. Invite the bot to your server with this URL (replace CLIENT_ID with your application's client ID): `https://discord.com/oauth2/authorize?client_id=CLIENT_ID&scope=bot&permissions=3072`. Permission 3072 is View Channels plus Send Messages, which is only needed if you want milestone announcements.
3. In Discord, enable Developer Mode (Settings, Advanced), then right-click your voice channel and Copy Channel ID. Do the same for a text channel if you want announcements.
4. Create `server/.env` with:

```
DISCORD_TOKEN=your-bot-token
VOICE_CHANNEL_ID=your-voice-channel-id
ANNOUNCE_CHANNEL_ID=optional-text-channel-id
```

5. Start the server. It logs "Discord bot online" and from then on, joining that voice channel is joining the game. If someone is already sitting in the channel when the server boots, they are synced in immediately.

Characters are keyed by Discord user ID, so nickname changes, device switches, and disconnects never lose a character. Without a `.env`, the bot stays off and everything works exactly as before.

## Locking the web client to Discord identities (OAuth)

By default the web client runs in open dev mode: anyone connected can manage any character. To require login and ownership:

1. In your Discord application (the same one as the bot), open OAuth2 and add a redirect: `http://localhost:8787/auth/callback` (or your server's public equivalent).
2. Copy the Client ID and Client Secret from that page into `server/.env`:

```
DISCORD_CLIENT_ID=your-client-id
DISCORD_CLIENT_SECRET=your-client-secret
OAUTH_REDIRECT_URI=http://localhost:8787/auth/callback
CLIENT_URL=http://localhost:5173
```

3. Restart the server. It logs "Discord OAuth is ON".

From then on a "Log in with Discord" button appears in the client header. Anyone can spectate without logging in, but acting requires identity: your own character's wardrobe, skills, and respec are yours alone; guild-wide actions (potions, prestige, legacy upgrades) require any logged-in member; characters created from the dev sidebar are manageable by any logged-in user. Locked panels say who owns the character. Sessions are stored server-side in SQLite and survive restarts; the logout link revokes them.

## Persistence

Stop the server with Ctrl+C (or crash it, that works too) and start it again: the campaign resumes at the same stage, and every character (level, gear, skills, wardrobe) is waiting in the roster for its owner to rejoin voice. State lives in two SQLite tables, `worlds` and `characters`, inside `server/guild.db`. A `world.json` from the earlier version migrates into the database automatically on first boot. Delete `guild.db` to start a fresh legend.
