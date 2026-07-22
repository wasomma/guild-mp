# Kitsune character (owner's hero look)

The owner's original character, driven by the references in `docs/art-refs/Kitsune-Refs/` (gitignored), rendered under the game's locked art style (ART-BIBLE.md). Implemented 2026-07-21 as a five-piece cosmetic set in the paperdoll systems — the identity kit carries over; outfits stay the game's own gear/OUTFITS systems.

**Status: v1 accepted as a good starting point (owner, 2026-07-21). Deliberately NOT iterating further on the sprite art until the overall aesthetic work (ART-PIPELINE Phase 2+, fidelity-study pick) settles — revisit the set after the style stabilizes.** Iterate with: `qa-kitsune-preview.mjs` + `prototype/kitsune-preview.html`, regression via `qa-kitsune-set.mjs`.

## Identity kit (from the references)

- Long hair, **green fading to magenta-pink** at the falls and tips
- Large **fox ears** with pink inners, star/ring ornaments
- **Gold eyes with star pupils** (portrait-scale detail; a future inspect-portrait pass)
- **Rust-red whisker markings** on the cheeks (plus arm/leg tattoos in the refs — too fine for sprite scale, portrait-pass candidate)
- **Multi-tail fan**, green with pink tips
- **Star motif** on every accessory; gold star sparkles

## The set (both sims' catalogs + both renderers, per the cardinal rule)

| Piece | System | Entry | Price |
|---|---|---|---|
| Kitsune Crown | HAIRSTYLES | `kitsune` — fox ears (pink inner, star stud), long falls, front lock w/ star clasp | 320 |
| Foxfire | HAIRS | green `#5cc94a` with `c2: #e05aa8` gradient tips (first two-tone hair; `c2` optional, other styles ignore it) | 260 |
| Fox Markings | ACCESSORIES | `foxmarks` — rust whisker stripes `rgba(178,72,40,…)` | 180 |
| Nine-Tails | CAPES | `ninetails` — 5-tail fan in the cape slot, pink tips, per-tail sway phase | 1600 |
| Starfire Aura | AURAS | `starfire` — golden ground glow + rising 4-point star twinkles | 4200 |

Mix-and-match works by design: Kitsune Crown with any hair color (tips fall back to a darker shade without `c2`), Nine-Tails with any outfit, etc. The full look is Crown + Foxfire + Markings + Nine-Tails + Starfire.

## Style conformance notes

- All pieces on the P2 grid; ear/tail colors derive from the catalog entry via `shade()` ramps like every other cosmetic.
- Star accents use the game's canonical gold `#f2c14e`; sparkles `#ffe9a0` additive ("lighter"), consistent with the bloom pipeline.
- Tail sway mirrors cape sway timing (walk 6Hz-ish, idle drift) so it inherits the game's motion language.
- Judging: run the ART-BIBLE checklist — native scale, 4x portrait, all four zones (the green/pink is loudest in Emberdeep; check it doesn't fight the red grade).

## Future passes (not yet built)

- Star-pupil gold eyes at portrait scale (needs an eye-color/portrait-detail system).
- Arm-band tattoo variant of Fox Markings.
- A fox pet ("foxling") in the PETS lane to complete the set.
