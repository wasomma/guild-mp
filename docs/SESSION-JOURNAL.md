# Session journal — machine-oriented, for future Claude sessions

Terse decision log of the 2026-07-17/18 owner+Claude working session. Not user documentation.
Read CLAUDE.md first (conventions, roadmap); this file records WHY/HOW beyond what code shows.
Format: commit :: what :: decisions/rationale/gotchas.

## commit log (oldest→newest)

- 71573fe :: baseline transfer :: pre-session state. History was identity-rewritten once (author WesF <wasomma@gmail.com>, filter-branch, force-pushed); never reintroduce the old identity.
- c1a3610 :: splash/cleave AOE :: owner goal: make healers matter (autos already tank-only). Design chosen via owner Q&A: periodic whole-party cleave (not passive splash), quick 0.4s/0.5s tell, NOT interruptible (pure healer check), non-boss only, fires only with 2+ members alive so solo play unchanged. mult 0.5x/elite 0.7x; cleaveT rand(4,7) first then rand(6,9). enemyCleave routes through hurtMember (armor/DR/thorns apply). cleaveWind in LERP_KEYS. session.cleaves + chronicle line "cleaves weathered".
- c84ac2b :: weapons pass 1 :: WEAPON_SKINS gained cD/cL/edge ramps (additive; .c untouched — projectile tints etc. depend on it). drawWarriorAxe: 5 distinct silhouettes x 3 poses (rest/swing/back). Rim light strengthened (head-top + right-edge columns). Judged on concept-sheet artifact before commit.
- 54698d4 :: weapons pass 2 :: rollout to all styles: drawPaladinBlade/drawRogueDagger/drawArcherBow/drawChainBlade/drawMysticStaff + shared FITTINGS metals + wkRamp. Bow string/arrow and all ult effects stayed in callers (track gameplay state). KNOWN GAP: drawFeaster's weapon drawing was NOT restyled (feast poses still old inline code) — acceptable cut, revisit if feast detail pass happens.
- 8bffd96 :: cosmetics phase A :: rarity gear visible on sprite (armor tiers strap→pauldrons→chestplate+gem→legendary glow→unique teal; trinket charm; rare+ weapon hand-glow) — render-only, reads m.gear rarity objects off the wire, zero sim changes. Body dimorphism parametrized inside drawAdventurer (masc pads/brows/sideburns/jaw; fem taper/hip/lashes/warrior chest wrap). Portrait component both UIs: 4x, m.noBars flag skips HUD; render.js exports drawAdventurer (allowed systematic difference).
- bfc7647 :: cosmetics phase B :: OUTFITS trim/sash fields (warrior masc excluded — bare chest; fem warrior wrap takes trim; mystic robe-hem accents). CAPES lining + hem ripple w1. drawHat gained t param (BOTH call sites incl. drawFeaster) — every hat has one motion accent. 42-combination matrix test.
- efa4a46 :: HUD + pets + formation :: bars moved BELOW feet (old: hp bar at oy-72 covered tall hats, ult bar at oy-65 sat on forehead). 20 wide, ult under hp (convention preserved). Pets: x-26,y+7 front-left lane, drawn AFTER body (over cape), kept for dead owners. formation(): staggered double rank tx=178-floor(i/2)*50-(i%2)*25, y stagger 12. 50px pitch is load-bearing: pet lane [x-34,x-18] vs neighbor body [nx-16,nx+16] — 46px clipped by 4px (caught by geometry test). Renderer already y-sorts units (render.js draw()), so rows layer for free. 8 members now fully on-screen.
- f782f3d :: bloom :: CORRECTION recorded: layer depth-blur (2.2/1/3px), tilt-shift band blur, and vignette ALREADY EXISTED in drawScene/drawForeground/drawLighting — earlier "Tier 4 unbuilt" claim was wrong (grep-only reading). Only bloom was missing: additive blurred self-copy after lighting/feast-light, before HUD text (alpha 0.14, blur 5px, saturate 1.35, brightness 1.1) — same self-copy technique drawLighting uses. Tune = those 3 numbers.
- 8a9fb5a :: chapter mutators (roadmap #4) :: 6 mutators (iron/gilded/moon/horde/glass/storm), rolled at doPrestige BEFORE resetChar (so glass hp applies to reset stats), never repeating back-to-back, chapter 1 none. Renown mult applies to the chapter being COMPLETED. Hooks check g.mutator id string directly (no lookup in hot paths). Three-edit snapshot rule followed (snapshot() + App copy list + consumers). worlds.mutator column (guarded ALTER pattern). Header pill both UIs; chronicle tail line; GuildHall earn preview multiplied.
- ef05245 :: Hall of Legends (roadmap #5) :: g.chapter accumulator (kills/gold/uniques; fed by killEnemy/dropLoot) + record built in doPrestige before resets (mvp = top dmgDone+healDone, valid per-chapter because heroes reset each prestige). Persistence = worlds.hall + worlds.chapter JSON columns (chapter column exists so a server restart never loses mid-chapter tally). Snapshot ships slice(-25) ONLY — 10Hz bandwidth; SQLite keeps full history. Plaques in both Guild Hall UIs. NOTE: the owner's chapter-3 end predated this code, so hall started empty — first plaque at next retell (owner informed; a wrong "plaque should exist" claim was made and corrected against DB evidence).
- 6c90f12 :: CLAUDE.md roadmap update :: next-up cleared; someday list = camp scenes, pet detail pass, Discord Activity packaging.

## verification methodology (reuse this)

- Gates: node --check shared/sim.js server/*.js; esbuild bundle checks (client App with --alias:@shared=./shared, prototype standalone).
- Cardinal-rule enforcement: awk-extract shared functions from both files and diff (e.g. awk '/^function drawHat\(/,/^}$/'); drawAdventurer differs only by leading "export".
- qa-render-soak.mjs needs the bundle at C:/tmp/render.bundle.mjs on Windows (node resolves /tmp -> C:\tmp; Git Bash /tmp is elsewhere).
- Headless suites written per feature as throwaway repo-root scratchpad-*.mjs (Windows ESM can't import absolute C:/ paths without file://; relative from repo root works), deleted after run.
- Owner loop: build → verify → rebuild client → owner judges localhost:8787 (hard refresh) → commit+push to main on owner's word. Direct-to-main is deliberate (solo repo).

## environment facts

- server/guild.db (world save incl. hall/roster) and server/.env are gitignored — NOT in repo; migrating PCs needs a copy of guild.db if the saga matters. Backup = copy one file.
- Dev server runs as a Claude-session background task; dies on machine sleep. Recovery: probe 8787, kill orphaned node PID (npm's child survives TaskStop), npm start in server/. Restart the server after db.js/sim changes — migrations run at boot.
- Concept-sheet artifact (owner's claude.ai, favicon 🪓): https://claude.ai/code/artifact/ee1e60cc-5445-435d-9cd1-47cd7d1154c0 — see memory note; character sections render via an esbuild GameKit bundle of the real render.js (template sheet-template.html + /*__GAMEKIT__*/ inject); weapon close-ups are hand-copied pass-2 painters that need manual refresh if painters change.
- Owner: git/terminal novice — run commands for them; identity WesF <wasomma@gmail.com> global.

## open threads

- drawFeaster weapon drawing still pre-model-pass (see 54698d4 note).
- Enemy HP bars still float above enemies (party bars moved; owner offered move, not requested).
- QA-STATUS.md's original "party no longer appears" mystery: fixed defect was the unguarded m._st; environment hypotheses never confirmed by owner; artifact re-paste of prototype was pending at the time.
- Someday list: camp scenes, pet detail pass, Discord Activity packaging (CLAUDE.md).
