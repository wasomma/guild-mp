# Balance: the economy and combat numbers

This document explains the current state of the two coupled gameplay loops — **the economy** (gold, renown, XP) and **damage** (outgoing, incoming, and recovery) — with every number as it exists in the code today. The source of truth is `shared/sim.js`; the prototype (`prototype/guild-idle.jsx`) carries identical values per the cardinal rule in CLAUDE.md. If a number here disagrees with the sim, the sim wins and this file needs updating.

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

- **Kills** — every enemy carries `(10 + stage×4) × tier` gold, tier being **×8 boss / ×3.5 elite / ×1 normal**. On the kill it is further multiplied by `(1 + 0.15 × Merchant Contacts rank)` and the killer's **gold find** affix total. The Gilded Road mutator multiplies base enemy gold by 1.4.
- **Salvage** — a drop that doesn't beat the receiver's equipped power converts to `power × 2.5` gold.
- **Quests** — each completed daily contract pays `(120 + everBest×22) × kind multiplier` (kill ×1, gold ×1.2, level-up ×1.3, elite ×1.6, boss ×2.2). Because it scales on `everBest` (best stage ever, across all chapters), quest income grows permanently as the guild's record improves.
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

- Enemy XP: `(9 + stage×3.2) × tier` (×6 boss / ×2.5 elite / ×1 normal).
- On a kill, **every living member** receives `(XP ÷ aliveCount + XP × 0.4) × (1 + 0.15 × Scholars' Guild rank)`. Note the split: 40% of the enemy's XP is granted flat per member, so total XP awarded grows with party size while the per-head share shrinks only partially — big parties level everyone faster in aggregate.
- Level cost: `xpNeed(level) = 26 × level^1.35`.
- A level-up grants +1 skill point and heals 30% of max HP mid-fight.

## Outgoing damage

### The stat pipeline (`stats()`)

A member's damage starts from class base + per-level growth, then multiplies through style, skills, gear, and party/world buffs:

| Class | HP (base +/lvl) | Dmg (base +/lvl) | Attack period | Armor | Crit | Heal (base +/lvl) |
|---|---|---|---|---|---|---|
| Tank | 130 +26 | 6 +1.6 | 1.5s | 4 | 5% | — |
| DPS | 72 +12 | 14 +3.4 | 0.85s | 0 | 15% | — |
| Healer | 88 +15 | 5 +1.2 | 1.25s | 1 | 5% | 15 +3 |

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

Gear feeds in by slot: **weapon** adds its full power to damage (and ×0.8 to healing), **armor** adds power×4 to HP and power×0.25 to armor, **trinket** adds power×0.5 damage, power×0.35 crit, power×2 HP.

World-level multipliers stack on top: Battle Hymns (+10%/rank), the **Chorus of Courage** presence buff (+4% damage/healing and +3% HP per voice in the party beyond the first, capped at 9 stacks), and mutators (Chapter of Glass: ×1.35 damage / ×0.75 HP for both sides; Racing Moon: everyone attacks 20% faster).

### The attack roll

Each swing rolls `damage × rand(0.85–1.15)`. Crit chance is capped at **60%**; a crit multiplies by `2 + crit-damage affix total` (so +90% crit damage from Sunsplitter makes crits ×2.9). Style shapes: the Rogue hits twice at 55% each (second hit rerolls crit), the Chainblade lands its full hit on a 0.17s delay, the Archer fires a projectile, and the healer heals the lowest-HP ally first, only bolting when nobody is hurt.

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

The Poison Vial adds `2 + stage×0.7` damage per second for 8s to the whole enemy pack at combat start.

## Incoming damage

- Enemy damage: `(4 + stage×1.5) × tier` (×1.9 boss / ×1.4 elite / ×1 normal), swung every `spd` seconds (boss 2.0, elite 1.8, normal 1.5–2.1). For **Kings only**, `stage` in this formula is `max(stage, highest level in the party)` — see the boss level floor below.
- **Targeting is tank-focused**: autos pick a random living tank, falling back to anyone only when no tank stands. Tanks are the aggro system.
- Mitigation: `max(1, raw − armor×0.6) × (1 − damage reduction)`. The Armor Elixir adds +6 armor for 12s at combat start.
- **Cleaves** are the healer check: any non-boss enemy, when 2+ members are alive, winds up (0.4s, 0.5s elite — a visible telegraph) every ~4–9s and hits the *entire party* for ×0.5 of its damage (×0.7 elite). Tank-focus keeps autos survivable; cleaves force party-wide healing.
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

- Enemy HP: `(28 + stage×15) × tier × rand(0.9–1.1)` (×9 boss / ×3.6 elite / ×1 normal). Packs are 2–4 normals, or elite + 1 normal at stage %5==3, or a lone King at stage %5==0 (+1 extra normal per pack under Endless Horde, at 80% HP each).
- **Boss level floor** (stopgap pending the formal balance pass): Kings stat their HP and damage using `max(stage, highest level in the party)` instead of the raw stage, so a party that has outleveled the stage (typically right after a chapter reset) still gets a real boss fight. Rewards (XP, gold, loot) stay on the real stage, and elites/normals are unaffected. Note for mixed parties: boss damage tracks the *top* level, so a much lower-level member can be hit hard by party-wide specials.
- Loot power: `(4 + stage×1.25) × rarity multiplier × rand(0.9–1.12)`, rarity multipliers 1.0 / 1.35 / 1.75 / 2.35 / 3.2 (unique 3.4). Drop odds: bosses always drop (plus a 60% second drop) at 10% unique chance each; elites always drop at 5% unique; normals drop 13% of the time at 1% unique.
- Rarity weights start at 54/26/12/6/2 (common→legendary) and shift with stage: common loses `stage×0.4` weight (the shift caps at 20, i.e. stage 50, leaving common at weight 34) while each higher tier gains a quarter of the shift — deep stages steadily favor rare+ gear.
- Because member damage grows multiplicatively (level × style × skills × gear power that itself scales with stage × legacy × chorus) while enemy HP grows linearly in stage with fixed tier multipliers, a well-geared party accelerates until the next King's special-phase check, which is the intended wall. The boss level floor keeps that wall standing across chapter resets; gear/legacy growth still outpaces it over time, which the formal balance pass will address.

## Daily quests

Three contracts roll at UTC midnight from five kinds. Targets: slay 40–80 foes, defeat 2–4 elites, fell 1–2 Kings, gain 4–8 level-ups, or earn `(300 + everBest×45)` gold (rounded to 10s; kill gold *and* salvage both count). Rewards are the gold/renown formulas in the Gold and Renown sections. Quests complete automatically and survive the chapter end — the automatic reset mid-quest loses nothing.

## Tuning knobs, by location

All in `shared/sim.js` (mirror any change into `prototype/guild-idle.jsx`): class/style tables at the top (`CLASSES`, `STYLES`, `SKILLS`); prices in `POTIONS` and the cosmetics lists; `LEGACY` and `legacyCost`; `renownEarn`; `MUTATORS`; enemy scaling in `makeEnemy`; kill rewards in `killEnemy`; loot scaling in `genLoot`/`rollAffixes`; XP curve in `xpNeed`; quest scaling in `rollQuests`; ult coefficients in `castUlt` and charge times in `ULT_CD`; cleave pacing in the enemy-actions block of `tick`.
