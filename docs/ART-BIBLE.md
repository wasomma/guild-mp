# Art Bible

The single source of truth for how Guild of the Open Mic looks. Every art change — procedural code in the renderers or generated assets from the pipeline (see ART-PIPELINE.md) — is judged against this document. When a visual decision isn't covered here, make the call, then record it here in the same commit.

Status: **style locked 2026-07-21** from the owner's reference picks. Remaining open item: the formal character-fidelity-study selection (see Direction).

## Direction (owner's picks, 2026-07-21)

- **Backgrounds & battle VFX: Octopath Traveler II.** The diorama look — strong single key light with god rays, terraced depth planes, dense clustered natural detail, tilt-shift + depth blur + bloom (already in the engine's post pipeline). Battle VFX are big, luminous, additive, and legible against a darkened scene.
- **Characters: Star Renegades.** Painterly-cinematic sprite treatment: strong rim light from the scene's key light, environment bounce color in the shadows, saturated color instead of black outlines, confident dynamic silhouettes. NOT pixel-realism (Norco lane) and NOT gothic grime (Blasphemous lane) — both explicitly rejected, along with Eastward's flat amber-wash look.
- This maps closest to the **"painted realism"** lane of the four pending fidelity studies; the formal study pick is still the owner's call, but generation and procedural work should lean painted-cinematic until then.
- The reward loop is *seeing* the rare thing you earned: rarity, gear, and cosmetics must be legible on the sprite at native scale and gorgeous at 4x in the inspect portrait.

## Hard constraints (from the engine)

- World canvas: **640 × 300**, ground line at y=244.
- Two pixel grids: background props on **P=3** (`px` helper), characters/enemies on **P2=2** (`px2` helper). Generated assets must land on one of these grids — no off-grid pixels, no anti-aliasing, no partial-alpha edges.
- Characters are **procedural paperdolls** (class × hair × outfit × weapon skin × cape × aura, composed at draw time). Characters stay code-drawn; see ART-PIPELINE.md for what gets generated instead.
- Scene layers: `_bg` (blurred 2.2px), `_mid`, `_fg`, then lighting/bloom passes. A generated background must be authored knowing the bg layer gets depth blur — fine detail there is wasted.
- THE CARDINAL RULE applies to art: any rendering change lands identically in `client/src/render.js` and `prototype/guild-idle.jsx`.

## Palette

Zone palettes are canon and live in `shared/sim.js` (ZONES). Generated assets for a zone must derive from its ramp:

| Zone | Sky ramp | Far / near ranges | Ground/top | Ambient |
|---|---|---|---|---|
| Verdant Fields | `#2c3a6b → #5b7bb0 → #a9c19b` | `#4b608f` / `#33486f` | `#3f6247` / `#8fce6b` | pollen, warm ray `255,225,160` |
| Gloomwood | `#12101f → #262147 → #3a3462` | `#2a2547` / `#1f1b38` | `#2c3b41` / `#5f8a6a` | firefly, cool ray `180,240,200` |
| Forgotten Crypt | `#0d0b16 → #1c1830 → #2b2440` | `#221d36` / `#191529` | `#3b3450` / `#7a6f96` | dust, pale ray `150,175,255` |
| Emberdeep | `#1c0d12 → #4a1c18 → #7a3520` | `#3a1a16` / `#2a1210` | `#4a2a24` / `#d07a45` | ember, hot ray `255,150,90` |

- Skin tones: `#e8b98a` base, `#c99465` shade. Weapon materials use the FITTINGS ramps (cD/cL/edge) in the sims.
- Rarity colors are gameplay-legible UI: never reuse rarity hues for environmental art in a way that reads as loot.
- Color budget per generated asset: ≤ 24 colors per background layer, ≤ 12 per prop or enemy sprite — keeps generated art cohesive with its procedural neighbors.

## Style rules (locked 2026-07-21)

**Backgrounds (Octopath II lane)** — judge every generated background against `background-diorama-octopath2.jpg`:
- One dominant key light per scene, angled from the zone's `ray` position; visible god-ray shafts through gaps (trees, arches, cave mouths).
- Terraced depth: at least three overlapping planes (far silhouette / mid detail / near frame), each a step darker and cooler than the one in front. Near-frame foliage/rock may crop the bottom corners like a diorama edge.
- Detail lives in clusters (stone courses, leaf clumps), never uniform noise. The blurred `_bg` layer carries shape and value only — no fine texture there.
- Value plan: bright focal band around the action line (GROUND), darkened corners; the engine's vignette and tilt-shift finish the job — don't bake them in.

**Characters & enemies (Star Renegades lane)**:
- Rim light on the key-light side of every sprite; shadow side picks up environment bounce color (zone `amb`), never plain darkened base color and never black outlines — separation comes from value contrast against the scene.
- Saturated mid-tones, confident readable silhouettes, slight pose dynamism (weight shift, weapon angle) over stiff symmetry.
- Generated enemies must sit on the P2 grid at the same texel density as the procedural party or they will read as pasted-in.
- **Scale rule (adventurers are ~70px tall):** ground fauna ankle-to-knee height (14–26px — a rabbit must never out-scale a hero), small flora/rocks knee-to-chest (40–58px), midground anchor trees/pillars ~2× character height (~150px). Generated small fauna is halved in resolution before the 2× texel upscale so its pixel density matches the P2 world instead of reading as fine-grained miniatures.

**Battle VFX (Octopath II lane)** — judge against `battle-vfx-night-octopath2.jpg`:
- Additive, bloom-carried effects: white-hot core, colored falloff, particle debris. Ultimates may briefly darken the scene grade for contrast; standard hits must not.
- Effects never obscure HP bars, telegraphs, or the ground-plate HUD — legibility beats spectacle.

## Reference images (curated set, `docs/art-refs/`)

| File | Governs |
|---|---|
| `background-diorama-octopath2.jpg` | Background canon: key light, terraces, diorama framing |
| `battle-vfx-night-octopath2.jpg` | Spell/ult VFX, night grade, bloom budget |
| `battle-cinematic-light-starrenegades.jpg` | Character lighting canon: rim + bounce, painterly grade |
| `background-cave-starrenegades.jpg` | Dark-zone (Gloomwood/Crypt) value structure |
| `battle-formation-boss-chainedechoes.jpg` | Side-view party-vs-boss composition sanity check |
| `background-night-camp-seaofstars.jpg` | Secondary night-palette reference |
| `portrait-dialogue-seaofstars.jpg` | Conservative bound for portrait detail |
| `realism-interior-norco.jpg` | Kept as the REJECTED far bound — do not drift here |

Rejected lanes (references deleted): Blasphemous 2 (gothic grime, anatomical realism), Eastward (flat single-temperature wash). `Kitsune-Refs/` holds the owner's original character references — they drive the Kitsune cosmetic set (see KITSUNE-CHARACTER.md), which still renders under this document's style rules.

## Judging checklist (every art change)

1. Screenshot at native 640×300 — is the change readable without zooming?
2. Screenshot at 4x (inspect portrait scale for characters) — does it hold up?
3. All four zones — does it sit correctly under each palette and lighting pass?
4. Does it read on the pixel grid (no off-grid pixels, no AA halos)?
5. Prototype and multiplayer renderers both updated?
