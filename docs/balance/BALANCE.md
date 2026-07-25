# Balance: the economy and combat numbers

This document explains the current state of the two coupled gameplay loops — **the economy** (gold, renown, XP) and **damage** (outgoing, incoming, and recovery) — with every number as it exists in the code today. The source of truth is `shared/sim.js`; the prototype (`prototype/guild-idle.jsx`) carries identical values per the cardinal rule in CLAUDE.md. If a number here disagrees with the sim, the sim wins and this file needs updating.

> **The combat rework is in flight** (v0.1.31 = Phase 1 of `COMBAT-REWORK.md (this folder)`:
> class triangle, mercy removal, threat targeting, universal cleaves). Measured
> bands quoted in prose below predate it where noted; the current measured
> numbers live in `baselines/ (this folder)` (regenerate with `npm run sweep`).

## Threat: the axis everything hangs from

`stage` restarts at 1 with every chapter while heroes keep their levels, gear,
and legacy ranks, so on its own it stops describing how hard anything is. Every
enemy is therefore built from **threat**, not stage:

```
depth  = stage + chaptersCompleted × 8
threat = clamp( topPartyLevel,  stage,  min(depth, topPartyLevel) + 10 )
```

Threat is **the party's own level**, floored at the stage and capped a little
above whichever is smaller: how deep the guild has told, and how strong it
actually is. The floor is the old boss-only level floor generalised to every
enemy — a chapter reset can no longer hand out twenty free stages, because the
heroes walking into it kept everything they earned.

Both halves of the cap are load-bearing, and each was learned by breaking
something:

- **Capped by depth**, or the level floor feeds back on itself: a party that
  wipes still earns XP from what it did kill, levels up, and so raises the
  very threat that just beat it. Measured as a solo hero spiralling to level
  211 and 1,154 wipes inside one chapter.
- **Capped by the party's own level**, or a long-lived world explodes. The
  live guild had told **1,757 chapters** — the game was previously so trivial
  that it burned through a whole tale every few minutes — and depth alone
  asked for threat 14,058, which made the world unplayable the instant it
  shipped. Nothing a guild has already survived should demand more than the
  heroes standing in it can answer.

Bulk and bite both follow `threat^1.18` rather than a straight line, because
heroes gain level growth *and* gear power at once. Rewards ride threat too —
loot power, XP, and `everBest` — so progression can't flatline the way it did
when gear reset to chapter-1 power every twenty stages.

The party's size is the other input. Enemies arrive in bigger packs
(`ceiling = ceil(members × 1.5)`, hard cap 8, so a lone hero meets a pair and
never a mob) and carry `1 + 0.22 × (members − 1) + 0.025 × (members − 1)²` bulk,
while per-enemy bite rises only `1 + 0.05 × (members − 1)` — a bigger guild
brings more tanks to spread the autos over and more healers to mend them. The
squared term is small and exists for the top end: guild throughput climbs about
linearly with headcount *and* carries the Chorus multiplier, so a purely linear
bulk bump loses the race at depth. Measured to level 146, nine heroes had
settled into 3-second King fights for 6% of their health while a trio still
spent 12–17%; the term barely moves a duo and firms the full guild back up.
A **King's ×9 HP** scales down for small parties
(`×9 × clamp(0.58 + 0.14 × members, 0.58, 1)`), because a King is one body that
the whole party focuses — no amount of extra heroes splits its attention the
way a pack does, and a flat ×9 made Kings simply unkillable solo.

The old **mercy discount** (×0.6 enemy damage for a lone hero, ×0.9 for any
no-healer party) is gone as of v0.1.31: it made solo play the *safest* shape in
the game, the exact inverse of the rework's goal. Solo danger is real now, and
each class answers it by its own route (see the class triangle below).

Measured over **24 chapters**, to heroes at level 156 — the live guild's own
scale, not just the first few tales. Normal fights run 3–10s, Kings 4–25s, a
stage costs 5–28% of the party's health, and after the first chapter wipes are
rare. None of it decays with depth, which was the whole problem before.

Chapter 1 is the sharp end everywhere: a solo hero spends it wiping and
relearning, then goes essentially untroubled for the next twenty-three
chapters.

## Who turns up: class assignment

New characters are assigned **the class the party is most short of**, read off
who is actually standing there. Roles are covered first, in the order a party
needs them — a tank to hold the line, someone who can kill, then someone to
mend — and after that the scarcest class fills, ties breaking toward tank then
healer. The resulting shapes, which the band above was measured against:

| Party | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|
| T/D/H | 1/0/0 | 1/1/0 | 1/1/1 | 2/1/1 | 2/1/2 | 2/2/2 | 3/2/2 | 3/2/3 | 3/3/3 |

This replaced `CLASS_ORDER[joinCount % 3]`, which was wrong twice over. It read
a lifetime join tally rather than the party, so a guild whose healers all left
kept being handed whatever the counter said next and could never recover.
And cycling tank→dps→healer gave a party of five two tanks, two DPS and a
single healer — the most damage-dense shape in the game, and one of the
softest at 8.1% of party health per stage. It also meant a **duo never got a
healer at all**, which tripped the no-healer mercy discount and made a pair of
heroes the easiest party in the game at 6.0%.

The role-coverage step is not decoration: assigning purely by "fewest" hands a
duo a tank and a healer and no damage whatsoever, measured at 32.6% per stage
because that pair simply cannot finish a fight.

Measured across nine party sizes, five campaigns each, warm-up chapters
discarded, the band is now **6.7–18.2%** of party health per stage with no
structural outlier — against 6.0–16.5% before, where both ends were assignment
artefacts. Note that class is fixed per character for life, so **this only
shapes new heroes**; an existing guild keeps whatever it already rolled.

## The shape of the loop

Damage throughput drives everything downstream: kills pay gold and XP, gold buys potions (survival) and cosmetics (vanity), XP buys levels and skill points (more damage), and loot drops raise gear power (more damage again). That inner loop runs inside a chapter, and the chapter ends itself: felling the stage-20 King (the fourth King, one full tour of the four zones) triggers the feast, pays a fixed chapter renown, and restarts the world — heroes keep everything. The outer loop is personal prestige: a hero at level 21+ may "Retell their Tale," converting their level into **renown** for the guild pool, the only permanent currency, which buys **legacy upgrades** that multiply gold, XP, damage, and HP for every hero forever.

```
damage → kills → gold + XP → gear/skills/potions → more damage   (per chapter; heroes carry over)
stage 20 King falls → chapter ends → feast + fixed renown drip           (automatic)
hero level → personal retell → renown → legacy upgrades → everything ↑   (each player's choice)
```

## What persists and what resets

| Event | Resets | Survives |
|---|---|---|
| Party wipe | stage −1, party revives at 60% HP | everything else (no gold loss) |
| Chapter end (automatic at stage 20) | stage → 1 + 2×(Veteran Paths rank) | **every character** (levels, gear, skills), gold, renown, legacy ranks, cosmetics, Hall of Legends, daily quests, `everBest`; potion stock is topped **up** to base + 2×(Stipend rank), never down |
| Personal retell (level 21+, per player) | that hero → level 1, no gear, no skills, no XP | everyone else entirely; the hero's cosmetics, style, autoSkill, and retelling count |
| Server restart | nothing (SQLite) | everything |

The practical consequence: **gold and characters now flow across chapters.** Nothing evaporates at a chapter end — the only reset a player ever loses progress to is the one they choose for their own hero, priced in renown.

## Gold

### Sources

- **Kills** — every enemy carries `(10 + threat×4) × tier` gold, tier being **×8 boss / ×3.5 elite / ×1 normal**. Gold is the one reward left on plain threat rather than the `threat^1.18` curve, so late chapters pay better without drowning the cosmetics sink. On the kill it is further multiplied by `(1 + 0.15 × Merchant Contacts rank)` and the killer's **gold find** affix total. The Gilded Road mutator multiplies base enemy gold by 1.4.
- **Salvage** — a drop that doesn't beat the receiver's equipped power converts to `power × 2.5` gold.
- **Quests** — each completed daily contract pays `(120 + everBest×22) × kind multiplier` (kill ×1, gold ×1.2, level-up ×1.3, elite ×1.6, boss ×2.2). Because it scales on `everBest` — now the deepest **threat** the guild has ever faced, not the stage number, which saturated at 20 the moment any chapter was cleared — quest income grows permanently as the guild pushes deeper.
- **World start** — a brand-new world opens with 150g; chapter ends no longer touch gold.

### Sinks

- **Potions** (the tactical sink): Healing Potion 30g, Poison Vial 40g, Armor Elixir 45g, Phoenix Draught 140g. All are auto-consumed (toggleable per type).
- **Cosmetics** (the long-horizon sink): prices run from 60g accents to the 4,000g Golden Aura — hats to 1,600g, capes to 1,400g, pets to 2,000g, auras 1,800–4,000g, weapon skins to 680g, plus outfits, hairstyles, colors, and accessories. Purchases are per-character and permanent.

There is no gold cost on respec, skill points, or style changes — builds are free to experiment with; gold buys consumables and looks only. Skill points auto-assign at random by default (idle-first); resetting reclaims every rank and switches that character to manual assignment until auto is turned back on.

## Renown

- **Earned at each chapter end**: `floor((stage − 1)^1.12 / 3)` at the fixed finale stage 20 = **9 renown**, multiplied by the chapter mutator's bonus (×1.25 or ×1.5; chapter 1 has no mutator) — a steady drip per 20-stage cycle.
- **Earned at a personal retell**: the same curve on the hero's level — `floor((level − 1)^1.12 / 3)`, mutator-multiplied (level 21 → 9, level 40 → 20, level 60 → 32). The superlinear exponent rewards leveling higher before cashing in; since heroes persist across chapters, level — not stage — is now the unbounded axis.
- **Earned from quests**: +2 (kill/gold/level-up), +3 (elite), +4 (boss) per completed contract — a slow drip that matters early.
- **Spent on legacy upgrades**, costing `(rank + 1) × 2` renown per rank (2, 4, 6, 8, 10 — 30 total to max a 5-rank track):

| Upgrade | Effect per rank | Max |
|---|---|---|
| Battle Hymns | +10% damage and healing | 5 |
| Stalwart Banners | +10% party max HP | 5 |
| Merchant Contacts | +15% gold earned | 5 |
| Scholars' Guild | +15% XP earned | 5 |
| Veteran Paths | new campaigns start 2 stages further | 3 |
| Alchemist Stipend | campaigns start with +2 of every potion | 3 |

## XP and levels

- Enemy XP: `(9 + threat^1.18 × 3.2) × tier` (×6 boss / ×2.5 elite / ×1 normal). Riding the same curve as enemy bulk keeps kills-per-level roughly flat against the `level^1.35` cost.
- On a kill, **every living member** receives `(XP ÷ aliveCount + XP × 0.4) × (1 + 0.15 × Scholars' Guild rank)`. Note the split: 40% of the enemy's XP is granted flat per member, so total XP awarded grows with party size while the per-head share shrinks only partially — big parties level everyone faster in aggregate.
- Level cost: `xpNeed(level) = 26 × level^1.35`.
- A level-up grants +1 skill point and heals 30% of max HP mid-fight.

## Outgoing damage

### The stat pipeline (`stats()`)

A member's damage starts from class base + per-level growth, then multiplies through style, skills, gear, and party/world buffs:

| Class | HP (base +/lvl) | Dmg (base +/lvl) | Attack period | Armor | Crit | Heal (base +/lvl) | Final mul (HP / Dmg) | Extra |
|---|---|---|---|---|---|---|---|---|
| Tank | 130 +26 | 6 +1.6 | 1.5s | 6 | 5% | — | ×1.30 / ×0.75 | +20% innate damage reduction |
| DPS | 72 +12 | 14 +3.4 | 0.85s | 0 | 15% | — | ×0.80 / ×1.15 | — |
| Healer | 88 +15 | 5 +1.2 | 1.25s | 1 | 5% | 15 +3 | ×1.00 / ×0.55 | radiant bolt: +heal×0.35 damage |

The **final multipliers are the class triangle** (v0.1.31): they apply to the
finished hp/dmg numbers *after* gear, because gear power dominates both within
a few chapters and used to wash class identity out — at live scale a tank hit
only ~25% softer than a DPS. The tank's innate 20% damage reduction (stacking
with Bulwark, capped at 60%) exists because share-based armor thins against the
threat-scaled soak and can't carry the tank identity alone. The healer's
**radiant bolt** term is structural, not flavor: without damage that scales
with their real stat, a solo healer's fights never end (measured pre-rework: a
live-scale solo healer stuck in a single elite fight for six sim-hours against
the Dire Bat's drain).

| Style (class) | Dmg | Speed | Crit | Armor |
|---|---|---|---|---|
| Paladin (tank) | ×1.0 | ×1.0 | +0 | +2 |
| Warrior (tank) | ×1.25 | ×0.95 | +5 | −1 |
| Archer (dps) | ×1.1 | ×1.05 | +5 | — |
| Rogue (dps) | ×1.0 | ×0.85 | +10 | — |
| Chainblade (dps) | ×1.2 | ×1.1 | +0 | — |
| Mystic (healer) | ×1.0 | ×1.0 | +0 | — |

(Attack period is seconds between swings — lower is faster, so the Rogue's ×0.85 is a buff.)

Skills (5 ranks each): tanks take +8% HP / +4% damage reduction / +6% stun-on-hit per rank; DPS take +8% damage / +6% attack speed / +5% crit per rank; healers take +10% healing / 15% heal splash to party / +4% party max-HP aura per rank (aura uses the highest rank among living healers).

Gear feeds in by slot: **weapon** adds its full power to damage (and ×0.8 to healing), **armor** adds power×4 to HP and power×0.25 to armor, **trinket** adds power×0.5 damage, power×2 HP, and crit **capped at +25**. That cap matters: uncapped at power×0.35 a single trinket pinned the 60% crit ceiling on its own, which quietly made Precision, the Rogue's +10 and the Archer/Warrior +5 worth exactly nothing.

World-level multipliers stack on top: Battle Hymns (+10%/rank), the **Chorus of Courage** presence buff (+4% damage/healing and +3% HP per voice in the party beyond the first, capped at 9 stacks), and mutators (Chapter of Glass: ×1.35 damage / ×0.75 HP for both sides; Racing Moon: everyone attacks 20% faster).

### The attack roll

Each swing rolls `damage × rand(0.85–1.15)`. Crit chance is capped at **60%**; a crit multiplies by `2 + crit-damage affix total` (so +90% crit damage from Sunsplitter makes crits ×2.9). Style shapes: the Rogue hits twice at 55% each (second hit rerolls crit), the Chainblade lands its full hit on a 0.17s delay, the Archer fires a projectile. The healer heals the lowest-HP ally when someone sits below **75%**, and fights otherwise — the old <99.9% threshold kept a solo healer casting heals on every scratch and never attacking, half of how their fights became infinite.

### Ultimates

Ults charge passively while alive over `ULT_CD` seconds (Rogue 22, Warrior/Chain 24, Archer 25, Paladin/Mystic 26; Storm Chorus mutator charges 30% faster) and fire automatically in combat:

- **Judgment** (Paladin): ×3 damage guaranteed crit + 1.5s stun.
- **Whirlwind** (Warrior): ×1.8 to every enemy.
- **Arrow Storm** (Archer): 6 arrows at ×0.9 to random enemies.
- **Shadow Flurry** (Rogue): 5 strikes at ×0.7 with +15 crit chance.
- **Dragging Hooks** (Chainblade): ×1.5 to all + knockback and 0.5s stun.
- **Sanctuary** (Mystic): heals the whole party for ×2.5 of heal power; only casts if someone is below 95% HP.

### Damage-adjacent affixes and uniques

Random affixes (value scales up with rarity): Vampiric 3–8% lifesteal, Bristling reflects 8–22%, Savage +15–45% crit damage, Gilded +8–28% gold find. Six teal **Uniques** carry fixed oversized affixes (e.g. Sunsplitter +90% crit damage, Midas Coil +50% gold find, Bristleking's Bulwark 45% thorns) at a 3.4× power multiplier.

The Poison Vial adds `2 + threat^1.18 × 0.7` damage per second for 8s to the whole enemy pack at combat start.

## Incoming damage

- Enemy damage: `(4 + threat^1.18 × 2.2) × tier × crowdBite` (tier ×1.9 boss / ×1.4 elite / ×1 normal), swung every `spd` seconds (boss 2.0, elite 1.8, normal 1.5–2.1). See the threat section for `crowdBite`; the mercy multiplier is gone as of v0.1.31.
- **Threat targeting**: autos pick a random living tank; with **no tank standing they turn on the hardest hitter** by stat sheet (damage ÷ attack period, so a fast Rogue reads as the threat it is). Tanks are the aggro system, and an unprotected DPS eats the autos their glass-cannon build invites — which is also why pack size can scale with party size, since tank count scales alongside it.
- Mitigation: `raw × (1 − armor/(armor + 30 + 4.5×threat)) × (1 − damage reduction)`, the share capped at 75% and the result floored at 1. Armor **soaks a share**; it does not subtract a flat amount. The old `max(1, raw − armor×0.6)` became outright immunity the moment gear power outran the stage's damage — at gear power ~104 a party took literally nothing from a stage-10 normal, and measured runs showed whole chapters at 0.0% health lost. The soak constant rises with threat so armor keeps its worth at every depth without ever reaching a wall. The Armor Elixir still adds +6 armor for 12s at combat start.
- **One incoming-damage path.** Autos, cleaves, and boss specials all run through `hurtMember`, which owns mitigation, thorns, and the death rites and returns what actually landed. The enemy auto-attack used to inline its own copy of that logic, which is exactly the kind of duplication that drifts.
- **Cleaves** are the sustain check: any non-boss enemy — at **any party size** as of v0.1.31, a lone hero included — winds up (0.4s, 0.5s elite — a visible telegraph) and hits the *entire party* for ×0.5 of its damage (×0.7 elite). The per-enemy cooldown (~4–9s) is stretched by `1 + 0.5 × (packSize − 2)` so a large warband doesn't carpet the party; the party-wide cleave rate stays roughly fixed however many bodies turn up.
- **Boss Kings** telegraph a special every ~4.5–10s with a 1.4–1.8s windup that a tank stun **interrupts** (delaying it 6s): Royal Slam ×1.5 to all, Screech ×0.9 to all + attack delay, Grave Call summons 2 skeletons at 60% HP, meteor fire ×1.1 to all. Each King also has HP-threshold phases (Slime splits off spawn, Bat frenzies, Skeleton gains 8-charge bone armor halving hits, Imp ignites for ×1.25 damage and faster swings).
- Elites have their own turns: the Elder Slime death-splits into two 65%-HP slimes, the Bone Captain raises an ally at 60% HP, the Imp Warlord enrages at 50% (×1.5 damage, much faster), and Dire Bats drain 60% of damage dealt as self-healing.

## Recovery

- Between fights (advance phase) everyone regenerates 8% max HP per second.
- Healer throughput: `(15 + 3/level) × (1 + 0.1×Mending) × hymn/chorus multipliers`, splashing 15%/rank of Radiance to the rest of the party.
- Healing Potion: auto-sips when anyone drops below 40%, restoring 45% max HP (1s internal cooldown between sips).
- Phoenix Draught: auto-revives a member at 60% HP after 2.5s down.
- Lifesteal returns its percentage of all damage dealt.
- A full wipe costs one stage and 4 seconds, then revives everyone at 60%.

## The difficulty and reward curve

- Enemy HP: `(28 + threat^1.18 × 15) × tier × crowdMul × rand(0.9–1.1)` — tier ×3.6 elite / ×1 normal, and bosses `×9 × clamp(0.58 + 0.14 × members, 0.58, 1)`. Packs run 2–4 normals plus one per two extra members, capped at 8 and additionally ceilinged at `ceil(members × 1.5)`; elite stages field the elite plus that many normals; stage %5==0 is a lone King. Endless Horde still adds one more (at 80% HP each) while the pack is under the cap. The line is spread across the enemy band's ~180px however many turn up, rather than marching the tail off a 640px stage.
- Loot power: `(4 + threat×1.25) × rarity multiplier × rand(0.9–1.12)`, rarity multipliers 1.0 / 1.35 / 1.75 / 2.35 / 3.2 (unique 3.4). Drop odds: bosses always drop (plus a 60% second drop) at 10% unique chance each; elites always drop at 5% unique; normals drop 13% of the time at 1% unique.
- Rarity weights start at 54/26/12/6/2 (common→legendary) and shift with threat: common loses `threat×0.4` weight (the shift caps at 20, leaving common at weight 34) while each higher tier gains a quarter of the shift — deep tales steadily favor rare+ gear.
- Member damage still grows multiplicatively (level × style × skills × gear power × legacy × chorus), which is why enemy bulk grows on `threat^1.18` instead of a straight line, and why threat — not stage — is what enemies are built from. The intended wall is still the King's special-phase check; it now stands at every depth instead of dissolving after the first tale.

## Daily quests

Three contracts roll at UTC midnight from five kinds. Targets: slay 40–80 foes, defeat 2–4 elites, fell 1–2 Kings, gain 4–8 level-ups, or earn `(300 + everBest×45)` gold (rounded to 10s; kill gold *and* salvage both count). Rewards are the gold/renown formulas in the Gold and Renown sections. Quests complete automatically and survive the chapter end — the automatic reset mid-quest loses nothing.

## Tuning knobs, by location

All in `shared/sim.js` (mirror any change into `prototype/guild-idle.jsx`): the difficulty axis in `threatOf` (`CHAPTER_DEPTH`, `FLOOR_SLACK`), its curve in `DIFF_EXP`/`threatCurve`, and the party-size responses in `crowdMul`, `crowdBite`, `bossTier`; class/style tables at the top (`CLASSES` — including the triangle's `mul`/`drBase`/`healBolt` fields — `STYLES`, `SKILLS`); prices in `POTIONS` and the cosmetics lists; `LEGACY` and `legacyCost`; `renownEarn`; `MUTATORS`; enemy scaling in `makeEnemy` and pack size in `spawnEncounter` (`PACK_CAP`); incoming mitigation in `mitigate`; kill rewards in `killEnemy`; loot scaling in `genLoot`/`rollAffixes`; XP curve in `xpNeed`; quest scaling in `rollQuests`; ult coefficients in `castUlt` and charge times in `ULT_CD`; cleave pacing in the enemy-actions block of `tick`.

To re-measure after any of these, drive the sim headlessly: build a world,
`joinVoice` N members, `tick` at 1/20s, and record per cleared stage the combat
seconds, the share of party HP lost, and wipes — the sweep that produced the
numbers above ran party sizes 1/2/3/5/9 across five chapters each.
