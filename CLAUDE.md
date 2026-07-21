# Guild of the Open Mic

A Discord voice-channel-driven, 2.5D pixel-art idle RPG. People joining a voice channel become adventurers in one shared, persistent world; the simulation runs only while someone is present. Read ARCHITECTURE.md for the full system design and DEPLOY.md for hosting.

## Repository map

- `shared/sim.js` : the authoritative game simulation. All rules live here: classes, fighting styles, combat, loot, potions, the automatic chapter cycle, personal retellings (prestige), the feast, boss mechanics, ultimates, cosmetics catalog. No rendering, no I/O. Visual moments are emitted as events on `world.events`.
- `server/index.js` : Node game server. 20Hz tick (presence-gated: frozen when the party is empty), 10Hz WebSocket snapshots, intent validation, static serving of `client/dist`.
- `server/db.js` : SQLite persistence (better-sqlite3). Tables: worlds, characters (keyed by guild_id + user_key, where user_key is the Discord snowflake), sessions.
- `server/bot.js` : Discord bot (discord.js, runs in-process). voiceStateUpdate drives joinVoice/leaveVoice. Off unless DISCORD_TOKEN and VOICE_CHANNEL_ID are set (env or server/.env).
- `server/auth.js` : Discord OAuth2 endpoints plus authorizeIntent. Off (open dev mode) unless DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET are set.
- `client/src/App.jsx` : React shell. WebSocket networking, snapshot interpolation, event-to-fx translation, all UI panels, intents. Production layout: full-viewport frame; left sidebar = live party cards (voice presence, no manual join controls — the old dev stand-in panel is gone); center = canvas + Guild Hall/Alchemist/Chronicle tabs; a persistent next-10-bosses rail hugs the game's right edge; clicking a party card opens a sticky far-right detail column with Stats/Equipment/Skills/Wardrobe subtabs (in that order). Header has separate sfx and music mute toggles.
- `client/src/render.js` : all canvas drawing. HD-2D layered scene, characters, enemies, the feast hall, timeline, telegraphs.
- `client/src/audio.js` : chiptune synth on raw Web Audio (no deps). sfx map plus generative music.
- `prototype/guild-idle.jsx` : the single-file playable prototype for claude.ai artifacts. Self-contained sim plus renderer plus UI. Used for quick visual testing in the Claude chat interface.

## THE CARDINAL RULE: two codebases must stay in sync

The prototype (`prototype/guild-idle.jsx`) and the multiplayer build (`shared/sim.js` + `client/src/render.js`) contain parallel copies of the game logic and all drawing code. Any gameplay or rendering change must be applied to BOTH, with these systematic differences:

- Sound: prototype calls `sfx.hit()` etc. directly; shared sim emits `sfxEv(g, "hit")` events that the client plays.
- Screen shake: prototype sets `g.shake = Math.max(g.shake, v)`; shared sim emits `shakeFx(g, v)` events.
- Floaters/particles: prototype pushes them directly via its addFloat/burst/sparkle; shared sim emits events with identical signatures. Call sites are textually identical; only the helper implementations differ.
- The prototype has no intent layer (single human controls everything): `retellMember(g, m)` and `endChapter(g)` are called directly from its UI, where the multiplayer build routes the `retell` intent through the server. Everything else (chapter cycle, feast, bosses, ults, sound triggers) exists in both.
- drawAdventurer, drawEnemy, drawFeast*, drawTimeline, and all sprite functions are textually identical between `prototype/guild-idle.jsx` and `client/src/render.js` (render.js has ESM imports and exports draw). When editing one, apply the identical diff to the other.

## Rendering conventions

- World geometry: W=640, H=300, GROUND=244. Background props use the P=3 grid (`px` helper); all characters and enemies use the fine P2=2 texel grid (`px2` helper) for 1.5x sprite detail. `shade(hex, f)` darkens/lightens.
- Scene pipeline (drawScene/drawForeground/drawLighting) uses offscreen layer canvases cached on the view object (`_bg`, `_mid`, `_fg` via getLayer); the view object must persist across frames.
- The feast (phase === "feast") swaps the entire scene for the mead hall (drawFeastBack/Front/Light/Banner) and routes members through drawFeaster.
- New per-entity numeric timers that should animate smoothly in multiplayer MUST be added to LERP_KEYS in client/src/App.jsx.

## Networking conventions

- Client sends intents `{a: "...", ...}`; server validates (auth.js) then `applyIntent` in the sim. Never trust the client.
- New world-level snapshot fields require THREE edits: add to `snapshot()` in shared/sim.js, add to the authoritative copy list in App.jsx (the `for (const k of [...])` loop in the render loop), and use it. Forgetting the copy list means the canvas never sees the field (this bug happened with `vote`).
- Per-member/enemy fields travel automatically (whole objects are serialized).
- Server stamps `msg.voter = sock.user.key` on intents when OAuth is on; ownership checks rely on it.

## Build, run, verify

- Server: `cd server && npm install && npm start` (ws://localhost:8787, serves client/dist too).
- Client dev: `cd client && npm install && npm run dev` (Vite on :5173, talks to :8787).
- Client production build: `cd client && npm run build` (server serves the result; deployment is single-port).
- Syntax gates after any change: `node --check shared/sim.js server/*.js`, and bundle-check the client and prototype with esbuild:
  `npx esbuild client/src/App.jsx --bundle --outfile=/dev/null --loader:.jsx=jsx --alias:@shared=./shared --external:react --external:react-dom`
  `npx esbuild prototype/guild-idle.jsx --bundle --outfile=/dev/null --loader:.jsx=jsx --external:react --external:react-dom`
- Headless sim tests: `node --input-type=module` scripts importing `./shared/sim.js`, driving `joinVoice`/`applyIntent`/`tick` and asserting on world state and `g.log`. This is the primary test method; there is no test framework yet (adding vitest for sim.js would be a welcome improvement).
- The prototype cannot use localStorage/sessionStorage (claude.ai artifact restriction).
- Standalone HTML build: `prototype/guild-of-the-open-mic.html` is the prototype bundled into one self-contained page — run `node scripts/build-standalone.js` (esbuild: bundle a tiny entry that createRoot-renders the default export, React/react-dom inlined from client/node_modules, minified, `process.env.NODE_ENV` defined to "production", then the JS inlined into a minimal HTML shell with any `</script` escaped as `<\/script`). GitHub Pages serves it publicly at https://wasomma.github.io/guild-mp/ from the `gh-pages` branch, whose sole file `index.html` must stay byte-identical to the build on main. After ANY prototype change: rebuild, commit the file on main, and push the same bytes as `index.html` on gh-pages — otherwise the public demo goes stale.

## Gameplay systems quick reference

- Stages: boss at stage % 5 === 0 (the four Kings), elite at stage % 5 === 3, four zones cycling every 5 stages (ZONES).
- Kings have windup-telegraphed specials (interruptible by tank stuns) and HP-threshold phases; see bossSpecial/bossPhase in the sims.
- Ultimates: per fighting style, ULT_CD seconds to charge, castUlt fires automatically in combat. Charge bar renders under the HP bar.
- Chapters end automatically: clearing a stage divisible by 20 (the 4th King, one full zone cycle) calls `endChapter` — 22s mead-hall feast, fixed renown (`renownEarn(20)` × mutator), Hall of Legends plaque, new mutator, world reset. Characters are NOT reset; gold persists; potion stock tops up to the stipend baseline.
- Personal prestige ("Retell your Tale"): the `retell` intent (owner-gated, MEMBER_INTENTS), gate level >= 21 and not during the feast; resets only that character (via `resetChar`) and pays `renownEarn(level)` × mutator into the shared renown pool; `m.retellings` counts them (persisted).
- Economy: kill gold = (10 + stage*4) * (boss 8 / elite 3.5 / 1); legacy upgrades multiply gold/xp/damage/HP.

## Roadmap (agreed with the owner)

Done: chiptune sound, the chapter/prestige split (v0.1.6 replaced the old prestige-by-vote: `endChapter` fires automatically on clearing a stage-20 finale and no longer resets characters; the per-player `retell` intent resets one hero for `renownEarn(level)` renown; the vote system is gone), feast celebration, boss mechanics, style ultimates, loot affixes (AFFIX_DEFS and UNIQUES in both sims: lifesteal, thorns, crit damage, gold find, plus six teal Uniques with a wearer shimmer), session chronicles (world.session ledger in the sims; formatChronicle in server/bot.js posts to the announce channel after CHRONICLE_GRACE_MS of empty voice; multiplayer-only like voting, the prototype's ledger stays inert), presence buffs (Chorus of Courage in stats(): +4% dmg/heal and +3% HP per voice past the first, capped at 9 stacks; join/leave log lines, chorus chime, header pill), guild quests (daily contracts in both sims: rollQuests/questProg, five kinds, auto-completing with gold and renown; persisted via the quests/quest_day columns added by guarded ALTER TABLE migration in db.js; boards in both Guild Hall UIs; chronicle counts fulfillments), splash damage (enemyCleave in both sims: non-boss mobs telegraph a whole-party cleave via cleaveWind — warning ring in drawEnemy, cleaveWind in LERP_KEYS — only when 2+ members are alive, 0.5x dmg / elite 0.7x; session counts cleaves), chapter mutators (MUTATORS table in both sims; chapters 2+ roll one at each prestige, never repeating; hooks in stats()/makeEnemy/spawnEncounter/ult charge; x1.25–x1.5 renown at the retelling; mutator snapshot field + worlds.mutator column; header pill in both UIs; chronicle closes with the current tale), Hall of Legends (g.chapter accumulator fed by killEnemy/dropLoot; doPrestige enshrines a record — chapter, stage, mutator, kills, gold, renown, MVP, heroes, uniques — into g.hall before resets; snapshot ships the last 25, worlds.hall/chapter columns keep everything; plaques render in both Guild Hall UIs), boss spoils in chronicles (dropLoot returns {item, m, kept}; boss kills push {boss, item, rarity, to, kept} onto g.session.bossLoot in both sims; formatChronicle prints one line per drop), auto-assigned skill points (m.autoSkill, default true and persisted: tick calls autoSpendSkills to randomly spend earned points into unmaxed skills, extras bank when all are maxed; respecSkills intent refunds every rank and flips to manual, setAutoSkill re-arms; both owner-gated in auth.js; controls live in both Skills UIs).

Art direction (Octopath-inspired detail arc, all done): weapon models (drawWarriorAxe/drawPaladinBlade/drawRogueDagger/drawArcherBow/drawChainBlade/drawMysticStaff + shared FITTINGS metals and wkRamp in both renderers; WEAPON_SKINS carry cD/cL/edge material ramps; each skin has a distinct silhouette and a living touch — glint sweeps, edge flicker, drips, facet sparkle), visible rarity gear (armor tiers/trinket charm/weapon hand-glow drawn from m.gear rarity objects, render-only), body dimorphism (masc breadth vs fem taper, parametrized inside drawAdventurer), inspect portraits (Portrait component in both UIs draws the live member at 4x with m.noBars; render.js exports drawAdventurer for it), cosmetics construction (OUTFITS trim/sash fields, CAPES lining, drawHat takes t for per-hat motion), rim light, bloom (additive blurred self-copy in draw(); layer depth blur, tilt-shift band blur, and vignette predate it), ground-plate HUD under the feet, pets in a front-left lane drawn over the cape, class-banded staggered double-rank formation (formation() in both sims: tanks nearest the foe, then DPS, healers rearmost, with a visible gap between class bands; front rank at x=250 with pitch adapting 100px down to 38px via an exact leftmost-slot fit check, so small parties spread across the whole party side of the scene for cosmetic readability and nine stay on screen; verified by headless bounds/ordering tests and the render soak).

Someday (owner-endorsed, no committed order):
- Camp scenes between zones.
- Pet detail pass.
- Discord Activity packaging (see ARCHITECTURE.md step 6).

Owner's visual reference: the animated concept-sheet artifact (claude.ai, owner's account) documents the weapon/cosmetic direction across passes; its character sections are rendered by bundling the real render.js, so it can be regenerated after any character change.

## Versioning and releases

The game version lives in `shared/version.js` (VERSION) and renders in the client title ("ALPHA vX.Y.Z") and browser tab. Alpha scheme 0.MINOR.PATCH: bump the PATCH number for normal releases (0.1.1, 0.1.2, ...), however feature-sized; bump MINOR only when the owner declares a major baseline change. On EVERY deploy to the live server:

1. Bump VERSION in `shared/version.js` in the same commit as (or right after) the change being shipped.
2. Doc sweep: check every `.md` for statements the change just made stale and fix them in the same commit. Player-facing rules → TUTORIAL.md; numbers, formulas, or what-resets-when → BALANCE.md; systems, persistence fields, or intents → ARCHITECTURE.md and the README; conventions, repo map, or roadmap state → this file; hosting steps → DEPLOY.md. A quick `grep -ril` across `*.md` for the feature's old terms (e.g. "vote" after the prestige split) catches most of it.
3. Add a `CHANGELOG.md` entry for the version (newest first, dated, a summary a player could read — bullets for feature releases, a sentence for small fixes) in that same commit.
4. Commit, then tag: `git tag -a vX.Y.Z -m "one-line summary of what shipped"`.
5. Push with tags: `git push --follow-tags`.
6. Deploy (pull, client build, restart) — see DEPLOY.md.

Tags are the version archive: `git tag -n` lists every released version with its summary, GitHub shows them under Tags, and any old version can be inspected (`git show vX.Y.Z:path`) or redeployed by checking out the tag on the server and rebuilding. `CHANGELOG.md` is the human-readable expansion of the tag list — if a version is live, it has an entry. Do not deploy untagged code to live.

## Configuration

`server/.env` (all optional; absent means dev mode):
DISCORD_TOKEN, VOICE_CHANNEL_ID, ANNOUNCE_CHANNEL_ID, DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, OAUTH_REDIRECT_URI, CLIENT_URL, PORT, GUILD_ID, CHRONICLE_GRACE_MS (default 60000).
