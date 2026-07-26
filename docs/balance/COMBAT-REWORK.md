# Combat & Damage Rework — Design Plan

Status: **ALL PHASES SHIPPED** — Phases 0–5 (2026-07-25, v0.1.31–v0.1.36)
and Phase 6, the economy endgame (2026-07-25, v0.1.37). The rework is
complete. This document is the source of truth for the rework's goals,
decisions, and phase plan; numbers live in BALANCE.md.

## Goal

Combat should reward playing together and make progression feel earned:

- **Solo play in any class is viable but slow.** Each class survives alone by a
  different route, and each is dramatically slower than a party.
- **The trinity (tank + DPS + healer) is the fast, rewarding way to play.**
  Composition — not headcount — is what pays.
- **Bosses are a genuine challenge** with a real chance of wiping and a real cost
  to it.

## Why combat is currently unrewarding (diagnosis)

Measured band today: 6.7–18.2% of party HP lost per stage, wipes rare after
chapter 1 — safe by design. The mechanisms:

1. **Solo is coddled**: ×0.6 mercy discount (`mercyMul`), pack ceiling of 2,
   cleaves require 2+ members so a soloist never sees the healer-check, King HP
   shrinks to ~×6.5 solo.
2. **Class barely matters**: nothing tests each class's weakness; every class
   clears comfortably.
3. **No attrition**: 8% max HP/s regen between fights means every fight starts
   fresh; the healer's core job doesn't exist.
4. **Potions erase danger**: auto-sipped, gold-priced — and the live world holds
   62M gold, so sustain is infinite.
5. **Wiping costs nothing**: stage −1, revive at 60%, 4 seconds.
6. **Chorus of Courage rewards headcount, not teamwork** (+4% dmg / +3% HP per
   voice, composition-blind).
7. **Structural blocker**: class is auto-assigned by party need (tank first), so
   a solo player's first hero is always a tank — solo DPS/healer cannot exist.

Framing constraint: this is an idle game. Challenge = composition, builds,
preparation (potion charges, economy), and pacing decisions — never execution
skill — plus a small set of light tactical intents (see decisions).

## Owner decisions (locked 2026-07-25)

1. **Class choice**: free pick in the character creator; party-need suggestion
   shown as a hint.
2. **Wipe stakes**: stage set-back — a wipe returns the party to just after the
   last defeated King (up to 4 stages lost, refought through re-rolled packs).
3. **Pacing targets (King TTK)**: full trinity ~30–45s; solo DPS ~1.5–2 min with
   real death risk; solo tank ~4–5 min; solo healer ~8–10 min. Normal fights
   scale proportionally.
4. **Live rollout**: new rules ramp in over the first ~3 chapters after deploy,
   framed in-fiction (a "world sharpens" mutator arc). Potion stock converts to
   charges at the first chapter end post-deploy.
5. **Idle purity**: light tactical intents allowed — party-voted "retreat from
   boss" and possibly a manual ult trigger toggle. Combat stays auto.
6. **Party bonus**: **Chorus of Courage is removed entirely**, replaced by
   role-coverage buffs. Consequence: crowd scaling (`crowdMul`/`crowdBite`) was
   tuned assuming Chorus and must be retuned so large parties don't get worse
   per head; the trinity momentum bonus is the reward for stacking past three.
7. **Skills**: **full talent-tree rework** — branching per-style trees with
   mutually exclusive choices and keystone nodes. Cooldown abilities (taunt,
   shield-wall, execute, HoT…) ship as keystones inside the trees, not as a
   separate system. Scheduled last so it doesn't block the difficulty work.
8. **Encounters before bosses**: more encounters, delivered **inside the
   existing 20-stage / boss-every-5 skeleton** (which is load-bearing across
   renown, Veteran Paths, the timeline UI and its King queue, quests, mutators):
   - Every pre-King stage (stage % 5 == 4) becomes a **multi-wave gauntlet**
     (2–3 back-to-back waves, no advance-phase regen between waves), themed as
     the King's honor guard.
   - A **herald elite** in the gauntlet carries a weak preview of its King's
     mechanic, teaching the fight.
   - **Ambushes** during the advance phase: a small chance (mutator-scalable)
     that a pack jumps the party between stages.
   - The attrition change (Phase 3) is the multiplier that makes the existing
     4 stages before each King matter at all.

## Design pillars

### 1. Class triangle (asymmetric stats)

| | Tank | DPS | Healer |
|---|---|---|---|
| Durability | Very high (HP ~2.5–3× DPS, high armor/DR) | Very low — dies if fights drag | Low armor, self-sustaining |
| Damage | Low (solo TTK ~4–6× DPS) | High | Very low (solo TTK ~6–10× DPS) |
| Solo route | Outlast everything, slowly | Kill fast or die — a race | Nearly unkillable but glacial |

### 2. Aggro rework

- Delete `mercyMul` (solo/no-healer discounts) entirely.
- Threat-table targeting: tanks generate high threat; with no tank standing,
  enemies prefer the highest damage-dealer.
- Cleaves fire at any party size.

### 3. Role coverage replaces Chorus

- **Vanguard** (tank stands): backline takes −40–50% from autos and is off the
  threat table.
- **Lifeward** (healer stands): restores meaningful between-fight recovery and
  counters attrition effects.
- **Warpath** (DPS stands): pack-wide kill-speed bonus (e.g. execute damage
  below 20% HP).
- **Trinity momentum**: all three roles present → momentum stacks on fast
  clears (bonus loot/gold/XP), so a coordinated trio visibly out-earns three
  soloists and extra members past three still feel valuable.

### 4. Attrition, scarcity, stakes

- Between-fight regen cut from 8%/s to a trickle; HP is a resource across a
  zone. Camp scenes (roadmap) become rest nodes.
- Potions become **per-chapter charges** (Alchemist Stipend raises the cap);
  gold's sink stays cosmetics.
- Wipe = set-back to just after the last King.

### 5. Bosses as tri-fold checks

Each King checks all three roles; composition decides which route you fight:

- **Enrage clock** (DPS check): damage ramps after T seconds — soft, so a solo
  tank can out-mitigate it and a solo healer can out-sustain it, slowly.
- **Crusher special** (tank check): telegraphed hit non-tanks cannot reasonably
  eat; soaked by a tank or interrupted by stun (existing interrupt machinery).
- **Affliction** (healer check): a DoT that outpaces potion cadence — trivial
  with a healer, a charge-management problem without.

### 6. Talent trees

Branching per-style trees, keystone auto-cast cooldown abilities, free respec
retained, and a sane auto-assign path for idle players. New Skills UI in both
codebases.

## Phase plan

- **Phase 0 — Measurement harness. ✅ DONE (2026-07-25).** Vitest + headless
  sweeps: party sizes 1/2/3/5/9 × class compositions × fresh world **and** a
  live-scale fixture (levels 73–162, deep chapter count — the v0.1.27 lesson:
  always test against the live world's scale). Baseline snapshot of today's
  numbers including per-composition King TTK. Every later phase re-runs the
  sweep against the pacing targets in decision 3.
  Shipped: `scripts/balance/harness.mjs` (seeded RNG, forced comps, live
  fixture), `qa/balance-sweep.mjs` (`npm run sweep`), vitest at the repo root
  (`npm test`, `test/balance-harness.test.mjs`), baselines in
  `docs/balance/baselines/`. See "Baseline findings" below.
- **Phase 1 — Class triangle + aggro. ✅ DONE (core v0.1.31, creator class pick v0.1.32 — both 2026-07-25).**
  Shipped in both sims: `CLASSES` triangle (final-stat `mul` per class so
  identity survives gear: tank ×1.30 hp / ×0.75 dmg + 20% innate DR, dps
  ×0.80 / ×1.15, healer ×1.00 / ×0.55 + radiant bolt `dmg += heal×0.35`);
  `mercyMul` deleted; threat targeting (tanks first, else hardest hitter by
  `dmg/spd`); cleaves at any party size; healer AI heals below 75% and fights
  otherwise. Measured v0.1.31 vs the v0.1.30 baseline (fresh/live King TTK):
  solo healer **finite everywhere** (was impossible; 93s/81s Kings, brutal
  fresh chapter 1 at 136 wipes — Phase 3 wipe redesign revisits), solo DPS
  dies on a fresh world (4 wipes; still untouched at live scale — closes in
  Phases 2–4), solo tank at 3.7–5.6× solo-DPS King time (target band),
  every comp now loses 1.9–10.9% HP per stage (was 0.2–1.4% for groups).
  The creator class pick (decision 1) shipped in v0.1.32: a "Calling" row in
  both creators, free while `cos.fresh`, party-need hint via `classNeed`,
  starter outfit re-dressed on pick; validated in `applyAppearance`
  (browser-verified end-to-end + qa-creator regressions).
- **Phase 2 — Role coverage. ✅ DONE (v0.1.33, 2026-07-25).**
  Shipped in both sims: Chorus of Courage removed (no headcount stat buff);
  Vanguard (living tank → non-tanks take ×0.55 of all enemy damage, in
  `hurtMember`), Warpath (living DPS → everyone ×1.5 vs foes <20% HP, in
  `hitEnemy`), Lifeward (living healer → 8%/s advance regen, else 2.5%/s),
  trinity momentum (`g.momentum` 0–5, +8% gold/XP per stack, reset on wipe /
  non-trinity clear / chapter end, 🔥 pill in both UIs); `crowdMul` retuned
  to `1 + 0.17(n−1) + 0.012(n−1)²`. Measured v0.1.33: nine-member Kings now
  FASTER than trinity (7.3s vs 8.9s live — group scaling fixed, was inverted),
  solo DPS bleeds 11.7% HP/stage live and wipes 8× fresh (Lifeward attrition),
  trinity out-earns via momentum. Solo DPS raw King TTK is still the fastest;
  the inversion lands with Phase 4's enrage clocks and enemy retuning, as
  planned. Lifeward's regen split front-loads a slice of Phase 3's attrition.
- **Phase 3 — Stakes. ✅ DONE (v0.1.34, 2026-07-25).**
  Shipped in both sims: potions are per-chapter charges (`buyPotion` intent
  removed, feast SETS stock to base + 2×stipend — the live hoard converts
  automatically at its first feast; Alchemist panels show charges, not
  prices); wipe = set-back to just after the last defeated King, clamped to
  the Veteran Paths chapter start; the regen trickle had already shipped as
  Phase 2's Lifeward split (8%/s with a living healer, 2.5%/s without).
  Measured v0.1.34: solo runs now carry real stakes (fresh: tank 24 / dps 11
  / healer 71 wipes across 3 chapters; live solo healer 47) while covered
  groups stay smooth (0 wipes trinity+); the set-back re-farm pays XP, so
  walls self-correct by strengthening the hero. **Ramp-in disposition
  (decision 4):** the planned "world sharpens" mutator arc was not built —
  the rework itself shipped as three separate live releases (v0.1.31/33/34),
  which staged the difficulty in practice, and Phase 3's remaining cuts only
  bite on wipes or at the feast conversion. Revisit only if the live guild
  reports whiplash.
- **Phase 4 — Bosses + encounters. ✅ DONE (v0.1.35, 2026-07-25).**
  Shipped in both sims across five tuning rounds (the sweep drove every
  number): tri-fold King checks — Crusher first-and-alternating at the aggro
  holder (threat-scaled ×1.5→×3), enrage clock (45s + 90s ramp to ×1.6,
  soft/capped, recomputed so Soothe can unwind it), Rend bleed (unmitigated,
  10% King dmg/s, staunched 3s per heal) — with each class countering its
  own check: tanks soak the Crusher and gained **Grit** (2%/s combat regen,
  the sustain that makes solo sieges winnable), healers **Soothe** the clock
  with bolts and staunch Rend, and got the **weave** AI (2 mends then a
  bolt) + healL 3→3.5; `bossTier` rides threat (cap 30, ×0.75 solo relief).
  Honor-guard gauntlets at %5==4 (2–3 waves, Herald above threat 8 with weak
  Rend, exempt from kind-elite tricks — an elite-bat Herald recreated the
  infinite-sustain stalemate), advance-phase ambushes (toll fights), camps
  after fallen Kings (10%/s), majority-vote retreat intent + world-bar
  button (manual-ult toggle deferred to Phase 5's trees).
  **Measured v0.1.35 (live)**: trinity Kings 29.2s (target 30–45 ✓), solo
  tank 55.5s sieges at 0 wipes, solo DPS 9.1s knife-edge vs the Crusher
  (1 wipe/9 Kings), solo healer VIABLE at 70.8s Kings / 19 wipes (was
  0-for-127 before Soothe+weave), five 27.7s / nine 21.2s. **First-hour
  guardrail**: fresh tank 142s/0 deaths and trinity 76s/0 to the first King
  (Herald gated below threat 8); fresh solo DPS is 423s/16 — the deliberate
  hard mode, documented, with the creator's need-hint steering newcomers.
  **Exit criterion — the first hour (added 2026-07-25):** the rework made a
  fresh world's chapter 1 sharp (24 wipes, solo tank), and Phase 4 adds
  gauntlets and ambushes on top. The sweep now reports `firstHour` (sim-time
  to the first King clear + wipes before it, fresh fixture); Phase 4 must not
  regress a fresh solo party's first King materially, and should improve it —
  a brand-new player's first session decides whether they reach month two.
- **Phase 5 — Talent trees. ✅ DONE (v0.1.36, 2026-07-25).**
  **Owner decisions (2026-07-25, one-at-a-time sign-off):** (1) bigger trees —
  trunk 15 / gate 6 / path 9 + keystone + 11 deep, keystone at 16 pts
  (level 17, before the retell gate), full build 36 (level ~37), extras bank,
  mastery sink deferred to Phase 6; (2) hard path lock with free respec;
  (3) keystone roster approved as proposed; (4) auto-assign walks Path A
  everywhere (Sentinel/Juggernaut/Sharpshooter/Assassin/Impaler/Renewal).
  Shipped in both sims: `TALENTS` per-style trees (trunk = the pre-5 class
  skills, ids unchanged — migration-free for the live guild; banked veteran
  points flow into the new tiers at first tick as a "new powers awaken"
  moment); path passives on FINAL stats; twelve keystones (taunt +
  shield-wall tanks, execute + burst DPS, HoT + cleanse healer) as auto-cast
  answers wired into Phase 4's checks (Shield Wall meets the Crusher windup,
  Bloom/Cleanse staunch Rend, Purity's Soothe ranks calm the clock, executes
  stack with Warpath); scripted `talentPlan` auto-assign replacing random
  spending; `choosePath`/`setUltMode`/`fireUlt` intents (owner-gated); the
  manual-ult "on my mark" toggle (decision 5's deferred item); style changes
  refund path points and keep the trunk; new tree Skills UI in both
  codebases; `path`/`ult_mode` character columns via guarded ALTER.
  **Tuning (the sweep drove it, multi-seed after the single-seed scare):**
  execute/crit-dmg talents cut a notch (exec 6→4%/3%, critDmg 8→6%/4%,
  Deathmark 25→15%), then `bossTier` cap 30 → 36 — a finished build is a
  permanent power step for a capped veteran world, so the wall grows with
  the ceiling. Fresh worlds (threat ≤35 → tier ≤22.5) never touch the cap.
  **Measured v0.1.36 (live, 4-seed means):** trinity Kings 27.2s (v0.1.35:
  27.4 — restored), five 29.7s / nine 20.7s (unchanged), solo tank 93s
  sieges at 0 wipes (was 63s — slower but safe; the Crusader path is the
  player's faster trade), solo healer 80.8s and the catastrophic seeds GONE
  (v0.1.35 multi-seed hid 150+-wipe tails; Renewal's sustain closed them),
  solo DPS 8.8s knife-edge with the same seed-swingy wipes (1–37 across
  seeds in v0.1.35, 7–24 now — the baseline's famous "1 wipe" was a lucky
  seed, now documented). **First-hour guardrail:** fresh solo tank 142s/0
  IDENTICAL, trinity 79s vs 76s, solo DPS 431s/17 vs 423s/16 (noise), solo
  healer improved 1441s → 327s to the first King. Keystones arrive at level
  ~17, so hour one is untouched by design.
- **Phase 6 — Economy endgame. ✅ DONE (v0.1.37, 2026-07-25).** Fixes
  long-horizon currency saturation: the live guild had maxed every legacy
  (renown a dead drip) and gold's only sink was a finite cosmetics catalog
  (87.9M banked at design time — read live off the DB, ahead of the 62M
  the docs recorded).
  **Owner decisions (2026-07-25, one-at-a-time sign-off):**
  1. **Rarity tiers: Folk / Ballad / Saga / Legend / Myth** — story-form
     names over reusing the gear ladder, keeping the two ladders visually
     and verbally distinct.
  2. **Full alpha fresh start at deploy** (`scripts/reset-alpha.mjs`):
     heroes to level 1, gear/currencies/wardrobes cleared; the Hall of
     Legends, chapter count, retelling counts, and identity picks kept.
     Chosen over currency-only resets so drop-rate experimentation runs
     against an empty catalog (the live DB showed the three most active
     vets already owned essentially every showpiece). Seeding: existing
     catalog reclassified across all five tiers (showpieces — the kitsune
     set, Nine-Tails, Golden/Starfire auras — to Myth) PLUS three new
     hand-drawn Myth pieces in both renderers (Aurora Veil aura, Emberling
     pet, Starweave Mantle cape).
  3. **Premium currency: "Encores"**, per-player. A retell pays the teller
     `renownEarn(level) × mutator` — the exact figure the guild pool gets
     (one curve, legible). Dailies +2 per player in voice; the day's first
     King +3. Spends: open a held crate 30, commission a crate 40.
     (Renown as the premium currency was considered and REJECTED — shared
     pool, buys guild power, three-currencies legibility wins.)
  4. **Key curve `250 × (n+1)^1.5`** (world-lifetime counter, polynomial so
     income growth keeps late keys attainable); **odds 50/26/15/7/2** with
     **Myth pity at 35** (per-player, persisted).
  **Shipped in both sims**: `COS_TIERS` + per-item `tier` fields;
  `doOpenCrate` (the single roll path — pity, weighted tier roll, unowned-
  first grant, full-tier Encore conversion; ALL rolls at intent time, never
  in tick, so seeded sweeps stay comparable); King kills drop a crate per
  member (cap 12, overflow → Encores); the cosmetics shop CLOSED (the
  `cosmetic` intent equips only); the Eternal Saga ascension track
  (`ascend` intent, gated on maxed legacies, `ceil(2×(n+1)^1.9)` renown,
  +0.5% dmg/heal/HP per rank in `stats()`); Trove UI in both wardrobes
  (crates, key price, odds table, pity meter) and the Saga row in both
  guild halls; `openCrate`/`commissionCrate` (member) + `ascend` (guild)
  gated in auth.js; persistence via guarded ALTERs (characters: crates,
  encores, pity, king_day; worlds: keys_cut, ascension) + snapshot fields
  `keysCut`/`ascension` on the App.jsx copy list. The parked **mastery
  talent sink stays deferred** (owner-ratified): three new infinite sinks
  are enough for one release, and mastery would perturb the fresh Phase 5
  combat tuning.
  **Measured v0.1.37**: the sweep is numerically IDENTICAL to v0.1.36
  (same seed, both fixtures — combat provably untouched at ascension 0);
  13 new economy tests (55 total); `scripts/balance/economy-model.mjs`
  models the key drain — fresh trinity: ~11k gold/chapter 1 (first key
  250g inside the first session) growing to ~94k/chapter by chapter 8
  against a 35k next-key, the sink absorbing all surplus while crates
  (4 Kings/chapter) stay the true rate limiter. Neither an afternoon nor
  a no-op.

Every phase honors the cardinal rule (identical diffs into
`prototype/guild-idle.jsx`), re-runs the sweep, gets a doc sweep
(docs/balance/BALANCE.md / TUTORIAL.md / ARCHITECTURE.md), and a version bump + tag before
deploy.

## Baseline findings (v0.1.30, seed 20260725, 3 chapters/comp)

Full data: `docs/balance/baselines/v0.1.30-fresh.json` and `-live.json`.
Method: fixed styles (paladin/archer/mystic), mutators stripped, potions
auto-restocked, feast fast-forwarded. King TTK = seconds of combat per King
stage; %HP/stg = net party HP lost per cleared stage.

| Comp | King TTK fresh | King TTK live | %HP/stg fresh | %HP/stg live | Wipes (fr/lv) |
|---|---|---|---|---|---|
| solo-tank | 31.2s | 14.9s | 6.0 | 7.4 | 1 / 0 |
| solo-dps | 7.4s | 4.4s | 4.3 | 2.7 | 0 / 0 |
| solo-healer | **never** | **never** | — | — | 19 / 0 |
| duo-td | 8.4s | 8.3s | 4.7 | 4.6 | 0 / 0 |
| trinity | 16.4s | 11.5s | 1.4 | 0.8 | 0 / 0 |
| five | 21.3s | 12.1s | 0.4 | 0.2 | 0 / 0 |
| nine | 12.3s | 8.9s | 0.5 | 0.9 | 0 / 0 |

What the numbers say (the rework's targets, quantified):

1. **Grouping is currently a kill-speed PENALTY.** A trinity takes 2.2–2.6×
   longer to fell a King than a solo DPS, and a five-stack is slower still —
   party size scales enemy bulk (`crowdMul`, `bossTier`) while adding mostly
   non-damage roles. Together buys only safety, and nobody needs safety.
2. **Solo DPS is untouchable.** Zero wipes, zero deaths across both fixtures;
   Kings die in 4–7s — before any mechanic can matter. The glass cannon has
   no glass.
3. **Parties of 3+ are statistically invulnerable**: 0.2–1.4% of party HP per
   stage. The measured "danger band" exists only for soloists.
4. **Solo healer is not slow — it is impossible.** Fresh: perma-walls on the
   first King (18 attempts, 19 wipes, 0 clears in 6 sim-hours). Live: entered
   a stage-8 **elite** fight at t=27s and was still in it at 6 sim-hours —
   enemy sustain (elite self-heal) exceeds healer damage output, an infinite
   stalemate with no wipe and no kill. The rework's "viable but very slow"
   for healers requires *new capability* (real damage floor or sustain-
   breaking mechanics), not just retuning.
5. Solo tank is the only comp that resembles the intended feel today: slow
   Kings (up to 92s), occasional wipes, real attrition.

Deltas vs the decision-3 targets: trinity needs Kings ~3× harder/longer than
today; solo DPS needs ~15–25× (and real lethality); solo tank ~5–10×; solo
healer needs to become *finite* first, then land at ~8–10 min.
