# QA handoff: "party no longer appears" investigation (in progress)

## Reported bug
The party stopped rendering. Location not yet confirmed: chat artifact paste, or local MP run on the owner's Windows PC. STILL THE FIRST QUESTION for the owner: where did you see it, and are there errors in the browser console (F12)?

## Verified clean so far
1. All syntax gates pass (server files, client bundle, prototype bundle).
2. prototype/guild-idle.jsx is byte-identical to the shipped artifact (verified before the fix below; the artifact now needs re-shipping).
3. 60+ sim-minute soak with invariants: member x/y/hp stay finite and on-screen through advance/combat/feast, 18 prestige+feast cycles, join/leave churn in every phase.
4. DONE: mock-canvas render soak (qa-render-soak.mjs). Stubs a 2D context and document.createElement("canvas"), drives the real sim through every scenario, and calls the real client draw() on JSON round-tripped snapshots: normal combat, elite stage, all four Kings mid-windup and mid-special (slamT, screechT, shell, enraged), active vote overlay, the feast with a wrestle pair and all five activities, all six style ults mid-cast, a unique wearer (shimmer path), wipe and prestige overlays, empty world, plus a 10 sim-minute mixed tick+draw soak. 24 of 24 scenarios pass after the fix below.
5. DONE: server + WebSocket smoke (qa-ws-smoke.mjs). Boots the real server, joins via ws intents, checks every snapshot for all render fields (x, y, hp, cls, cos, gear, seed, alive, ult, ultT, level, name, id, key, _st) with finiteness checks, and probes the connect-time race with 25 tightly timed connects during join/leave churn. All clean after the fix below.

## Bug found and fixed: unguarded m._st in drawAdventurer
- drawAdventurer's HP bar read m.hp / m._st.hp with no guard (client/src/render.js and the identical line in prototype/guild-idle.jsx). The other _st read in the same function (bow pull) was guarded; this one was not.
- _st (cached stats) was only assigned inside tick(). A member that joined but had not yet been ticked had no _st. The WS smoke proved this reaches the wire: the immediate snapshot sent on socket connect can contain a just-joined member without _st (reproduced 1 in 25 tries under churn). Result: draw() throws for those frames. The rAF loop survives (requestAnimationFrame is re-armed before draw), so in the live MP build this is a transient glitch of roughly one broadcast, not a permanent vanish. It is a real defect either way.
- Fix, applied to BOTH codebases per the cardinal rule:
  a. Render guard: hpBar(..., m.hp / Math.max(1, m._st ? m._st.hp : m.hp), ...) in client/src/render.js and prototype/guild-idle.jsx (lines stay textually identical).
  b. Source fix: every site that recomputed stats for hp now also stores it: m._st = stats(m, X); m.hp = m._st.hp. Sites: makeMember, rehydrateMember, joinVoice (returning member), doPrestige resetChar, setClass intent (sim) and the respec button (prototype). No snapshot with members can now lack _st (re-verified by the smoke test: 0 occurrences).
- dehydrateMember never persisted _st, so the DB schema is unaffected.
- The shipped artifact must be re-pasted from the updated prototype/guild-idle.jsx.

## Open: is this THE reported bug?
Unclear. The confirmed defect is transient in the MP build, and the prototype sets _st on its first tick, so a persistent "party never renders" is not fully explained by it. Everything else render-side and wire-side is verified clean, which keeps the environment hypotheses alive:
- stale artifact paste in chat (re-paste the updated prototype),
- stale client bundle or browser cache locally (hard refresh Ctrl+Shift+R, npm run build),
- stale server/guild.db (delete to rule out),
- a server crash stack in the terminal.

## Remaining QA steps
6. Owner input: where was it seen, browser console errors, and if local: hard refresh, rebuild client, delete server/guild.db, check the server terminal for a crash stack. If the console shows a different exception than the _st one fixed above, that is the next lead.

## Test assets added
- qa-render-soak.mjs: run with `npx esbuild client/src/render.js --bundle --format=esm --outfile=/tmp/render.bundle.mjs --loader:.jsx=jsx --alias:@shared=./shared` then `node qa-render-soak.mjs`.
- qa-ws-smoke.mjs: `node qa-ws-smoke.mjs` (boots the server on port 8791 with GUILD_ID=qa-smoke; delete server/guild.db afterward to avoid leaving QA state).

## Recent changes most worth suspecting (last three features)
Presence buffs touched stats(); guild quests touched tick() top (daily reroll), killEnemy, gainXp, dropLoot, newWorld/newGame, db.js (guarded ALTER TABLE migration), App copy list, both Guild Hall UIs. Loot affixes earlier touched hitEnemy/hurtMember/killEnemy and drawAdventurer (shimmer block using SLOTS). stats() was re-read during this pass and is null-safe for the makeMember stats(m, null) call.
