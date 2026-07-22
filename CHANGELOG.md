# Changelog

Every version that has gone live, newest first. The version lives in `shared/version.js` and every release is also a git tag (`git tag -n` is the short form of this file; `git show vX.Y.Z` inspects any release). Per the release procedure in CLAUDE.md, this file is updated in the same commit as the version bump — if a version is live, its entry is here.

## v0.1.9 — 2026-07-21

**Generated background art and the Kitsune cosmetic set.** The first fruits of the new AI-assisted art pipeline (see docs/ART-PIPELINE.md).

- **Every scene has a painted backdrop** — all four zones (a sunlit pine valley for Verdant Fields, a glowing root-tunnel for Gloomwood, a moonlit vaulted colonnade for the Forgotten Crypt, a molten lava valley for Emberdeep) and the mead hall's timber wall are now pixel-art plates generated to each zone's palette, sitting under the engine's live sun, god rays, fog, and depth blur. Plates load from `assets/zones/` with the old procedural backgrounds as automatic fallback (the standalone prototype keeps the procedural look).
- **The Kitsune set** — five new cosmetics that compose into a fox-spirit hero: Kitsune Crown hairstyle (tapered fox ears with a star stud), Foxfire hair (the first two-tone dye, green fading to magenta), Fox Markings whisker stripes, the Nine-Tails cape (a fan of swaying pink-tipped tails), and the Starfire Aura (golden glow with rising star twinkles).
- New art-direction docs (ART-BIBLE.md, ART-PIPELINE.md, KITSUNE-CHARACTER.md) and dev tools: a cosmetic/biome preview harness (`qa-kitsune-preview.mjs` + `prototype/kitsune-preview.html`) and a kitsune render regression check (`qa-kitsune-set.mjs`).

## v0.1.8 — 2026-07-21

Fixed the "fast forward" burst after returning to a backgrounded tab: while hidden, snapshots kept queuing visual effects (floaters, particle bursts, screen shake, sounds) that the paused render loop never drained, so refocusing replayed the whole backlog at once. Effects are now skipped while the tab is hidden — the world state itself was always current — and a background tab is now fully silent, matching the music.

## v0.1.7 — 2026-07-21

Fixed the feast's arm-wrestling pair drawing their reach across the whole hall: the arm was anchored to the table while the wrestlers were still walking to it, stretching until they arrived. Wrestlers now walk with arms at their sides and only lock hands once seated (plus a sanity cap on arm length).

## v0.1.6 — 2026-07-21

**The prestige split: chapters end themselves, retelling is personal.** The party vote is gone.

- **Automatic chapter endings** — felling the stage-20 King (the fourth King, one full tour of the four zones) now ends the chapter on its own: the mead-hall feast plays, the guild earns a fixed 9 renown (× the chapter mutator's bonus), a Hall of Legends plaque is enshrined, a new mutator rolls, and the world resets to stage 1.
- **Heroes persist** — characters are no longer reset by the world. Levels, gear, and skills carry across chapters; shared gold persists; the feast tops potion stock up to the stipend baseline (never down).
- **Retell your Tale** — prestige is now each player's own choice: at level 21+ a hero can reset to level 1, converting their progress into `renownEarn(level)` × mutator renown for the shared guild pool. Owner-gated online; per-hero retelling counts are persisted and shown in the Guild Hall.
- The Guild Hall panel gained a chapter-progress box (stage X of 20) and per-member retell rows; the timeline's purple tome now marks the chapter finale; the chronicle counts tales retold anew.
- Migration note for worlds saved beyond stage 20 under the old rules: the chapter ends at the next multiple of 20 (a one-time renown windfall), then normalizes to 20-stage cycles.

## v0.1.5 — 2026-07-20

Removed the vestigial frame borders; the layout fits the viewport exactly with no scrollbar.

## v0.1.4 — 2026-07-20

Fixed the side-rail height caps so the rails account for the header and the page no longer scrolls.

## v0.1.3 — 2026-07-20

Viewport-filling layout: the frame fills the browser height with the world bar and tabs anchored at the bottom.

## v0.1.2 — 2026-07-20

The Guild Hall, Alchemist, and Chronicle tabs open as right-side panels, matching the character window.

## v0.1.1 — 2026-07-20

Header declutter: world state moved to a world bar under the canvas, and the Chorus of Courage indicator into the sidebar.

## v0.1.0 — 2026-07-20

First versioned release: the full production deployment. Discord bot presence + OAuth live, party sidebar, boss timeline rail, stats panel, auto-assigned skill points, boss spoils in the chronicle, split sfx/music toggles, and the player tutorial.
