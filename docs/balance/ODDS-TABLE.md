# Chronicle Crates: the odds table

Player-and-designer reference for the Phase 6 loot mechanic (v0.1.37): how
crates are earned, what a Gold Key costs, every way to open one, the full
rarity table with the pity system, and where each number lives in the code.
The source of truth is `shared/sim.js` (`COS_TIERS`, `keyPrice`,
`doOpenCrate`, and the `tier` field on every cosmetic); the prototype carries
identical copies per the cardinal rule. If a number here disagrees with the
sim, the sim wins and this file needs updating. Design rationale is in
`COMBAT-REWORK.md` (Phase 6); the wider economy in `BALANCE.md`.

## Earning crates

- **Every fallen King** leaves one Chronicle Crate for **each hero in the
  party** — solo or nine-strong, everyone present gets their own. That is
  4 crates per player per chapter (Kings stand at stages 5, 10, 15, 20).
- A player holds at most **12 crates**; drops past the cap convert to
  **3 ♪ Encores** each, so a full Trove still pays.
- The **day's first King** (UTC) also pays every player **+3 Encores**.

Crates are per-player and permanent: they survive chapter ends, retells, and
server restarts (`characters.crates`).

## Opening a crate

Three ways, all through the same roll (`doOpenCrate`):

| Action | Costs | Needs a held crate? |
|---|---|---|
| 🔑 **Open with a Gold Key** | gold from the **shared guild coffers** at the escalating key price | yes |
| ♪ **Open with Encores** | **30 Encores** (yours alone) | yes |
| ♪ **Commission a crate** | **40 Encores** — the crate is conjured and opened in one act | no |

**The Gold Key price** rises with every key the world has *ever* cut and
never resets — this is the game's permanent gold sink:

```
price(n) = round( 250 × (n+1)^1.5 / 10 ) × 10        n = keys ever cut
```

| Key # | 1 | 5 | 10 | 25 | 50 | 100 | 200 |
|---|---|---|---|---|---|---|---|
| Price | 250g | 2,800g | 7,910g | 31,250g | 88,390g | 250,000g | 707,110g |

The curve is polynomial, not exponential, on purpose: kill gold scales with
threat, so a growing guild can always still afford the next key — the sink
throttles, it never walls off. (Pacing model:
`node scripts/balance/economy-model.mjs`.)

**Encores** are the per-player currency: a retell pays the teller
`renownEarn(level) × mutator` — the exact figure the guild pool receives
(level 21 → 9, level 40 → 20, level 60 → 32); each completed daily contract
pays +2 to every player in voice; the day's first King +3.

## The odds table

Every open rolls a **tier** first, then an item within it:

| Tier | Color | Odds | Items at launch | Chance per specific item* |
|---|---|---|---|---|
| **Folk** | gray | **50%** | 18 | ~2.8% |
| **Ballad** | green | **26%** | 18 | ~1.4% |
| **Saga** | blue | **15%** | 8 | ~1.9% |
| **Legend** | orange | **7%** | 9 | ~0.8% |
| **Myth** | pink | **2%** | 9 | ~0.2% |

\* for a fresh wardrobe: tier odds ÷ unowned items in the tier. The
per-item chance *rises* as a tier fills, because…

- **No wasted rolls**: the roll only picks among items you *don't* own in
  the rolled tier. Dupes are impossible while a tier holds anything new.
- **A fully-collected tier converts to Encores** instead: Folk 2 · Ballad 4
  · Saga 8 · Legend 15 · Myth 30.

### The pity system

**35 opens without a Myth make your next open a guaranteed Myth.**

- The counter (`pity`, shown as a meter in the Trove) ticks +1 on every
  non-Myth open and resets to 0 on **any** Myth — natural roll or pity.
- It is per-player and persisted, spanning sessions, chapters, and retells.
- The math: a Myth lands naturally 1-in-50, but with the pity ceiling the
  *expected* rate is one Myth per **~26 opens**, and the worst case is
  exactly the 36th. About half of all Myths arrive via pity — the ceiling
  is load-bearing, not decorative.

### What lives in each tier

- **Folk** — Rogue Hood, Silk Ribbon · Arcane/Seafoam/Rose/Lime hair dyes ·
  War Bun · Freckles, Warpaint, Gold Earrings, Silk Scarf · Forest,
  Crimson, Midnight, Lavender, Blush, Mint, Wine outfits.
- **Ballad** — Knight Helm, Wizard Hat, Flower Crown, Witch Hat, Cat Ears ·
  Twintails, Battle Braid · Ruby Pendant · Traveler Cloak, Crimson Cape,
  Forest Cloak · Glimmer Wisp · Gilded/Obsidian/Bloodrot weapon finishes ·
  Royal, Sunburst, Ivory outfits.
- **Saga** — Demon Horns, Gold Circlet · Shadow Cloak, Royal Cape ·
  Slimelet, Alley Cat, Loyal Pup · Crystal weapon finish.
- **Legend** — Royal Crown, Saint Halo · Gilded Cape · Moon Owl, Drakeling ·
  Ember, Frost, Verdant, and Arcane Auras.
- **Myth** — the chase: **Kitsune Crown, Foxfire hair, Fox Markings,
  Nine-Tails** (the kitsune set), **Golden Aura, Starfire Aura**, and the
  three v0.1.37 originals — **Aurora Veil** (borealis curtains on a turning
  hue), **Emberling** (a fledgling firebird), **Starweave Mantle** (a cape
  carrying its own night sky).

Spawn stock (the free identity picks, starter hairstyles, hair dyes 1–4,
your class outfit, Steel) is tierless and never drops — crates only ever
hold something worth winning.

## Tuning knobs

All in `shared/sim.js`, mirrored in `prototype/guild-idle.jsx`: tier odds,
colors, and dupe conversions in `COS_TIERS`; the guarantee threshold in
`PITY_AT`; the key curve in `keyPrice`; Encore prices in `OPEN_ENC` /
`COMMISSION_ENC`; drips in `DAILY_ENC` / `KING_DAY_ENC`; crate cap in
`CRATE_CAP` / `CRATE_OVERFLOW_ENC`; item→tier assignment as the `tier`
field on each catalog entry. One invariant guards it all: **crate RNG fires
at intent time only, never inside `tick`** — seeded balance sweeps must stay
byte-comparable (v0.1.37's sweep matches v0.1.36's exactly). The regression
suite is `test/economy.test.mjs`.
