# Changelog

Every version that has gone live, newest first. The version lives in `shared/version.js` and every release is also a git tag (`git tag -n` is the short form of this file; `git show vX.Y.Z` inspects any release). Per the release procedure in CLAUDE.md, this file is updated in the same commit as the version bump — if a version is live, its entry is here.

## v0.1.39 — 2026-07-25

**The road and the horizon.** The Upcoming Bosses sidebar is gone — everything it knew now lives on the scrolling timeline, and the world view gets the full width back.

- **Richer road**: gauntlet stages fly the honor guard's **war banner**, elite spikes are tinted by their zone, and every King's crown carries a **gem in its King's color**.
- **The horizon queue**: past a bend at the timeline's right end, the next three Kings beyond the road wait as colored crowns over their wave counts — purple counts mark a **chapter finale**. Hover any of them for the full story, same as the rest of the strip.
- When a King is on the field, a **golden halo** pulses over the party's banner — the old HERE NOW, where your eyes already are.
- Timeline changes land in both renderers, so the public demo gets the same road; the sidebar removal is client-only.

## v0.1.38 — 2026-07-25

**One menu over the world.** The multiplayer client's side panels are gone — everything now lives in a single window that opens over the game.

- The menu overlays the canvas with seven tabs: **📊 Stats, 🗡️ Equipment, 📚 Skills, 👗 Wardrobe** for the selected hero (with the 🪞 Appearance button), and **🏛️ Guild Hall, 🧪 Alchemist, 📜 Chronicle** for the guild.
- Open it with the new **☰ Menu** button on the world bar, or by clicking any party card (which jumps straight to that hero's Stats). Switch heroes by clicking another card; close with ✕ or **Esc**.
- The hero tabs put the portrait beside the sheet instead of above it — more room for skills, talents, and the Trove.
- The old right-side detail column and the three page-bottom buttons are retired; the world view keeps the full width of the screen. Client-only change: the sim, balance, and the public demo are untouched.

## v0.1.37 — 2026-07-25

**The Chronicle Trove.** Phase 6 of the combat rework — the economy endgame — and with it, the rework is complete. Ships with the one-time **alpha fresh start** (owner's call): every hero begins again at level 1 with a fresh wardrobe, and gold, renown, and legacies reset. Your identity, retelling count, and the guild's 1,888-chapter Hall of Legends endure.

- **📦 Chronicle Crates.** Every fallen King leaves a crate for each hero's player. Opening one takes a **🔑 Gold Key**, cut from the guild coffers at a price that rises with every key ever cut, forever — gold finally has a sink that never fills. The wardrobe shop is closed: from now on, looks are *won*.
- **The rarity ladder: Folk · Ballad · Saga · Legend · Myth** (50/26/15/7/2). Crates never waste a roll while a tier holds something you lack, and a fully-told tier pays Encores instead. After 35 opens without a Myth, **your next crate is a sure Myth** — the Trove's pity meter counts it down.
- **Three new Myth treasures**: the **Aurora Veil** (curtains of borealis light on a slow-turning hue), the **Emberling** (a fledgling firebird that flares its crown of fire on the feast rug), and the **Starweave Mantle** (a cape carrying its own night sky). They join the kitsune set, Nine-Tails, and the Golden and Starfire auras as the chase.
- **♪ Encores — the first currency that is yours alone.** Retell your Tale and the applause is personal: you earn Encores equal to the renown the guild receives, scaled to the level you sacrificed. Daily contracts pay a couple to everyone in voice; your first King each day adds more. Spend them to open crates without touching guild gold — or **commission** a crate outright.
- **♾️ The Eternal Saga.** When every legacy is fully told, renown's story continues: an endless ascension track, each rank a permanent +0.5% to the whole guild's damage, healing, and HP, at an ever-steeper price. No currency in the game ever goes dead again.
- The Trove lives in your Wardrobe tab (crates, key price, odds, pity); the Saga sits under the Guild Hall's legacies. Both in the multiplayer client and the public demo.

Measured: the combat sweep is numerically identical to v0.1.36 — the economy touches no fight until the guild *chooses* to ascend. 13 new economy tests (55 total) plus a key-drain model (`scripts/balance/economy-model.mjs`): a fresh guild affords its first key in the first session, and the escalating curve absorbs a matured guild's surplus without ever walling off.

## v0.1.36 — 2026-07-25

**Walk your path.** Phase 5 of the combat rework — every fighting style grows a talent tree, and the biggest single feature of the rework closes its combat arc.

- **Talent trees for all six styles.** Your class's three familiar skills are now the tree's **Fundamentals** — every point you'd already spent still counts. Six points in, your style's two **Paths** open: pick one (the other locks until a free reset) and climb through three path talents to its **⭐ Keystone**, then three deeper talents beyond.
- **Keystones are signature abilities that cast themselves at the right moment.** The Sentinel's **Shield Wall** rises to meet a King's Crushing Blow; the Warlord's **Battle Roar** drags every foe onto the warrior and stirs the party; the Sharpshooter's **Deathmark** singles out the mightiest enemy; the Assassin's **Assassinate** ends a wounded foe in one perfect strike; the Renewal mystic's **Verdant Bloom** floods the party with healing that closes Rend-wounds double-quick; the Purity mystic's **Cleanse** burns every bleed away. Twelve in all — a defensive and an aggressive road for every style.
- **Idle players lose nothing**: auto-assign now walks your style's recommended path — fundamentals, the ★ path, its keystone (around level 17, before your first retell beckons), the deep talents (a build completes near level 37). Veterans' banked points flow in the moment this ships: new powers awaken.
- **⚡ "On my mark."** Prefer to time your ultimate yourself? A new toggle holds the charge at full until you press FIRE — from the Skills tab, with a ready-pip on your party card.
- Style changes now return your path points (the trunk stays); a reset returns everything including the path choice. All still free.
- **The Kings grow with you.** A finished build is real power, so the veteran wall rises to match (boss bulk cap ×30 → ×36). A fresh world's first hours are untouched — measured to the second against the first-hour guardrail.

Measured (live scale, multi-seed): trinity Kings ~27s (the band held), a solo tank's sieges lengthen to ~93s at zero wipes (the Crusader path is your faster trade), the solo healer's nightmare seeds are gone (Renewal sustain), and the solo DPS knife-edge stays exactly as advertised.

## v0.1.35 — 2026-07-25

**The Kings learn to fight back.** Phase 4 of the combat rework — bosses become the wall the whole redesign was building toward, and the road to them earns its name.

- **Every King is a threefold test.** The **CRUSHING BLOW** falls on whoever holds its attention — a Tank shrugs it off, anyone else gets flattened — and it comes *first*, so a party with no shield meets the lesson early. Its blows leave a **bleeding Rend** that armor ignores; a Healer's mending staunches it. And fight too long and its **fury mounts** — damage climbing toward ×1.6 — though a Healer's bolts can *soothe* the clock back down. Bring the trinity and each threat has its answer; go alone and your class decides which two you must survive.
- **Tanks have Grit**: wounds close even mid-battle (2% per second). A lone tank's long King sieges are now winnable on endurance — as they should be.
- **Healers weave**: two mends, then a bolt, whenever nobody's critical. A mender who never strikes can never end a fight.
- **The honor guard bars the way.** The wave before every King is now a gauntlet — waves back-to-back with no breather, led by a **Herald** carrying a taste of its King's Rend. You arrive at the throne already bleeding.
- **The party makes camp** after every fallen King: a real rest that heals everyone fully, whatever the party's shape.
- **Ambushes**: the road itself is unsafe — packs jump the party mid-march for gold and XP, but win no ground.
- **🏳 Retreat**: a King fight you can't win can be abandoned by majority vote — the party falls back to the last King's fallen ground *on its feet*: no deaths, the fallen rise at 40%, momentum lost. Losing costs the same ground and the wounds.
- Kings no longer shrink for small parties. The wall stands the same height for everyone; it merely grows with the guild's legend (threat), so a fresh world's first Kings remain a lesson rather than an execution.

Measured against the plan's targets: a trinity fells a veteran King in ~29s, a solo tank sieges one in ~56s, a solo DPS races the Crusher at ~9s a coin-flip from death, and a solo healer grinds one down in ~71s — every calling viable, none of them safe.

## v0.1.34 — 2026-07-25

**Stakes.** Phase 3 of the combat rework: failure costs something now, and preparation is a real resource.

- **Wiping sends you back to the last King's fallen ground.** A defeated party no longer shrugs off one wave — it falls back to just after the last King it felled, up to four waves refought through fresh packs. Nothing permanent is lost, and the road back pays XP and loot — the wall teaches — but a King you aren't ready for will cost you every attempt.
- **Potions are charges, not purchases.** The Alchemist no longer sells; the satchel holds the chapter's charges and the feast restocks it (Alchemist Stipend deepens every pocket). Gold could always outbuy danger — now scarcity, not price, makes every auto-sip a real spend. Gold's calling is cosmetics.
- Momentum, fittingly, gutters on a wipe — the fire pill goes dark with the party.

Together with Phases 1–2: soloing any class is viable and always was meant to cost blood and time; a covered party barely feels the new stakes, and that's the point.

## v0.1.33 — 2026-07-25

**Roles are the party buff now.** Phase 2 of the combat rework: the Chorus of Courage — +4% might per voice, no questions asked — retires. What empowers a party is *who* stands in it:

- **Vanguard** 🛡️ — while a Tank lives, everyone else takes far less damage from everything: autos, cleaves, and boss slams alike. Damage finally has a mechanical reason to want a shield in front of it.
- **Warpath** ⚔️ — while a DPS lives, the whole party's blows land half again as hard on wounded foes. A killer's presence ends fights.
- **Lifeward** 💚 — while a Healer lives, the road between fights restores you as it always did; without one, wounds knit slowly and every stage wears you down.
- **Trinity Momentum** 🔥 — clear stages with shield, blade, and mercy all standing and the guild's spoils stack: +8% gold and XP per stage, up to +40%. A wipe or a broken trinity snuffs it out. The world bar shows the flame.
- Enemy warbands were retuned for the new math — big guilds no longer face the extra bulk that compensated for a stat buff that no longer exists. A full nine-hero guild now fells Kings *faster* per fight than a trio, instead of slower.

Together this is the promise of the rework made real: soloing any class works but costs blood and time; the trinity is the fast, rich way to play.

**Choose your calling.** The character creator now opens with a class pick — Tank 🛡️, DPS ⚔️, or Healer 💚 — free before your hero first steps through the doors, with the guild's current need marked ★ as a hint. Picking a class re-roots your fighting style, banks your skill points for the new path, and dresses you in that calling's starter outfit. Solo adventurers can finally *be* a lone healer or a glass-cannon DPS from their very first stage; changing your mind later still goes through the free respec in the Skills tab. (Completes Phase 1 of the combat rework.)

## v0.1.31 — 2026-07-25

**The world stops pulling its punches.** First phase of the combat rework (`docs/balance/COMBAT-REWORK.md`): fighting alone is now genuinely dangerous, and each class survives it its own way.

- **The class triangle.** Tanks are truly durable (+30% final HP, innate 20% damage reduction) but slow to kill with (×0.75 damage); DPS are true glass cannons (×1.15 damage, ×0.80 HP); Healers barely swing a weapon (×0.55) but their bolts now channel their healing power — a healer's damage grows with their real stat. Applied after gear, so class identity holds at every depth instead of washing out by chapter three.
- **The mercy discount is gone.** Enemies no longer hit softer at solo or healer-less parties (was ×0.6/×0.9). Solo is viable in any class — but it costs real blood now.
- **Enemies go for the biggest threat.** Tanks hold aggro as before; with no tank standing, foes turn on the hardest hitter instead of a random victim. An unprotected DPS eats what their glass-cannon build invites.
- **Cleaves reach everyone.** The telegraphed party sweep now fires against lone heroes too — solo play no longer dodges the sustain check.
- **Healers fight between mends.** Menders now attack whenever nobody is below 75% HP instead of topping every scratch — which, with the new radiant bolts, fixes a genuine bug-by-numbers: a solo healer could previously get stuck in a literally unwinnable fight against self-healing enemies.
- Dev tooling (not player-facing): vitest at the repo root (`npm test`), and a seeded balance sweep (`npm run sweep`) that measures King kill times, HP loss, and wipes across seven party compositions on fresh- and live-scale worlds, writing baselines to `docs/balance/baselines/`.

## v0.1.30 — 2026-07-25

**The guild fills the gaps.** New adventurers now take up whatever the party is actually short of, instead of following a fixed tank-then-damage-then-healer rota that never looked at who was standing there.

- **Your guild can recover.** If every healer steps away, the next person to walk in is a healer. The old rota couldn't do that — it counted lifetime joins, so a guild could be left with no one to mend it indefinitely.
- **A party of five is no longer damage-heavy.** It used to come out as two tanks, two damage and a single healer — the most damage-dense shape in the game, and one of the easiest. It now settles at two tanks, one damage and two healers, and fights like the rest.
- **A pair finally gets looked after.** Under the old rota a duo *never* got a healer, which quietly made two heroes the easiest party in the game. A pair is also no longer given the same allowance as someone adventuring completely alone — two people end fights in half the time.
- Roles are still covered in the order a party needs them, so every duo has someone who can fight and every trio has someone who can mend.

Class is still chosen once per character and kept for life, so this shapes new heroes rather than reshuffling an existing guild.

## v0.1.29 — 2026-07-25

**Full guilds get a real warband at depth.** The balance was verified over twenty-four chapters this time, out to heroes at level 156 — the scale the live guild actually plays at, rather than the first few tales. It held everywhere except the top end: a nine-strong guild slowly outgrew its foes, settling into three-second King fights that cost 6% of its health while a trio was still spending 12–17%. Enemy bulk now rises a little faster with headcount, which barely touches a duo or a trio and puts a full guild back in a real fight. Nothing else moved.

## v0.1.28 — 2026-07-25

**Hotfix for v0.1.27.** Threat was floored on how many chapters the guild had told — and the live world had told 1,757 of them (the old balance was so slight that a whole tale went by every few minutes). That asked for a threat of fourteen thousand, and the world became unfightable the moment it went up. Threat is now the party's own level, floored at the wave and capped just above whichever is smaller — the tale's depth or the heroes' actual strength. A guild can never be asked for more than the people standing in it can answer. Deep worlds are playable again, and a fresh world plays as v0.1.27 intended.

## v0.1.27 — 2026-07-24

**The damage pass.** The formal balance pass BALANCE.md kept deferring. Fights had quietly stopped being fights: past the first chapter a party took *zero* damage for entire tales, Kings fell in under two seconds, and nine heroes had an easier time than one. All of it is measured, and all of it is fixed.

- **Threat replaces stage as the difficulty axis.** Stage restarts at 1 every chapter while your heroes keep their levels, gear, and legacy ranks — so enemies are now built from how deep the guild has pushed across *every* tale, floored by the party's own level. Each 20-stage chapter starts deeper than the last: the loop is a ladder now, not a victory lap. Loot power and XP ride the same number, so gear no longer resets to chapter-one strength every twenty stages.
- **A warband, not a wall.** Encounters scale to how many of you turn up — more foes for a full guild (up to eight, spread across the line instead of marching off the edge of the screen), fewer and lighter for a lone hero. Kings size themselves to the party too, because a King is one body that everyone focuses; the old flat health pool made them literally unkillable alone.
- **Armor soaks, it no longer nullifies.** Armor used to subtract a flat amount, which turned into total immunity the moment your gear outgrew the stage — the direct cause of those zero-damage chapters. It now reduces a share of each blow, and that share holds its value at any depth.
- **No healer, gentler foes.** A party with nobody to mend it takes noticeably softer hits. Soloing is still the hardest way to play, but it is no longer a wall of wipes.
- **Fixed: a Paladin's Judgment could be spent on a corpse** — if an ally felled the target in the same instant, the ultimate vanished for zero damage after twenty-six seconds of charging.
- **Fixed: crit chance was a dead stat.** A single trinket quietly pinned the 60% ceiling by itself, which made Precision, the Rogue's edge, and the Archer's and Warrior's crit bonuses worth nothing. The trinket's contribution is now capped.
- **Damage reads better.** Numbers scale to how big the hit actually was — sparks, screen kick, and text size all follow the damage rather than looking identical for a scratch and a third of a King's health. Floaters no longer stack on top of each other in a crowded fight, and the big callouts carry a proper outline so they stay legible over a lit background. (Crit text was also rendering at roughly four times its intended size in the multiplayer client; the prototype was right.)
- A **Threat** readout sits beside Stage in both builds.

## v0.1.26 — 2026-07-24

**The feast turns to face you.** A polish release for the character creator and the mead hall:

- **South-facing feast**: feasters now look out at the hall — eyes, smiles, blushes, and race features drawn front-on instead of the combat profile. Orc tusks frame the smile, the dwarf's beard sits square, and whisker marks show on both cheeks.
- **Creator polish**: elves grew their second ear (the portrait view made the missing one obvious), tiefling horns are now proper swept hooks instead of thin stalks, freckles take your skin tone so they show on every shade, and warpaint stays visible on Crimson skin.
- **HD heroes show off their gear**: the HD kitsune now carries the earned-gear glow — legendary/unique armor shimmer, the weapon-quality light at her hand, and the unique twinkle — like every paperdoll hero does.
- Enemy health bars now rise to clear tall heads (and the Kings' crowns) instead of drawing through them.

## v0.1.25 — 2026-07-24

**The character creator.** Your adventurer is now yours to make:

- A creator panel opens over the game the first time you join voice (and any time after from **🪞 Appearance** in your character column): pick your **race**, body, **skin tone**, hairstyle, hair color, and **starter undergarments**, with a live mirror preview.
- **Six races**, all free and purely cosmetic: Human, Elf (pointed ears), Kitsune-kin (fox ears and a swaying tail), Dwarf (short, stout, and bearded), Orc (tusks), and Tiefling (horns) — their features show in combat, at the feast, and in portraits.
- **Nine skin tones** — five natural shades plus Jade, Ash, Lavender, and Crimson for the monstrous and the infernal.
- **Undergarments** (wrap, vest, or singlet in six dyes) show under the warrior's open harness and in the creator's mirror; the fem warrior's chest wrap now wears your chosen color.
- All five starter hairstyles are free in the creator; premium styles and everything else in the wardrobe still come from the shop. Existing heroes keep their look and get the starter styles granted — reopen the mirror whenever you like, changes are free.
- Art-direction note: the HD tank puppets from v0.1.23 have been rolled back to the classic paperdolls while the generated-character style is re-settled (the HD kitsune remains); the creator's identity system is the new foundation the next HD pass will build on.

## v0.1.24 — 2026-07-22

Facing fix: the HD cave bat and crypt skeleton shipped looking away from the party — both sprites are now mirrored to face the heroes, matching every other combatant (same in-place remedy as the v0.1.16 classic-sprite fix).

## v0.1.23 — 2026-07-22

**HD tanks: the wardrobe goes layered.** Phase D of the HD-canvas arc — the first class base bodies with real mix-and-match gear at full detail:

- Tanks (both body types) now render as HD layered puppets: a generated ~123-px base body dressed at draw time with your equipped outfit, hairstyle, and weapon — the paperdoll reward loop at source-native detail.
- Three outfits are HD so far (Traveler, Midnight, Royal — the Royal gown is something to see), plus five hairstyles (Short Crop, Pixie, Bob, Ponytail, Long Flow). Hairstyles are tinted live to all nine hair colors, including two-tone tips.
- The warrior's battle axe is HD art, and every weapon skin (Gilded, Obsidian, Bloodrot, Crystal) applies to it as a true material remap — one axe, five finishes.
- Combos that don't have HD layers yet (hats, capes, accessories, paladins) keep the classic paperdoll look for now; more wardrobe waves and the other classes follow.
- HD heroes now keep their auras and pets (the kitsune included), and walking HD heroes step-bob instead of gliding.

## v0.1.22 — 2026-07-22

**The kitsune arrives in HD.** The first source-native hero: a ~123-px-tall generated kitsune warrior, standing on the action line at full detail — long green-to-pink hair, fox ears, wine-and-gold outfit, golden spear:

- Wearing the **Kitsune Crown hairstyle together with the Nine-Tails cape** now summons the HD kitsune in place of the procedural paperdoll — the cosmetic set you earn is the transformation.
- She is a **layered puppet**: five separately-drawn tail instances fan out behind her, each swaying on its own phase (brisker while walking), driven by the same engine motion language as everything else. Idle bob, attack lunges, and hops carry over automatically.
- The inspect portrait frames HD characters at 3× (procedural stays 4×) so the full figure and tail fan fit — this is where the detail really lands.
- Layer assets live in `assets/heroes/kitsune-e-*.png` (facing-keyed for the future south/north facings); missing files leave the paperdoll untouched, and the standalone prototype stays procedural.

## v0.1.21 — 2026-07-22

**The HD action line.** The game window doubles its pixel density and the four zone enemies are reborn in high-definition art — the first visible payoff of the HD canvas direction:

- The canvas now renders at 1280×600 (2 device pixels per world unit) in both the multiplayer client and the prototype. The diorama keeps its chunky charm; the action line gets fine.
- All four enemies regenerated at HD density (2 art px per logical unit, drawn source-native): a glossy slime with a glowing core, a fuzzy cave bat with webbed wings and amber eyes, a bright-ivory skeleton warrior with sword and shield, and a brick-red imp with golden horns and a trident. Kings are the same art at 1.8× — the Slime King wears his crown well.
- Classic texel sprites remain as fallback (`assets/enemies/<kind>.png`); HD art lives in `assets/enemies/hd/` and wins when present. The standalone prototype keeps its procedural enemies.

## v0.1.20 — 2026-07-22

**The HD canvas foundation (dormant).** Infrastructure for the new character-art direction — source-native hi-res heroes on a 2× canvas — ships in both renderers with zero visible change:

- The renderer now derives a render scale from its canvas: a classic 640×300 canvas draws exactly as before; a 1280×600 canvas draws every logical unit at 2 device pixels. World coordinates, the sim, and networking are untouched.
- Two scale-correctness fixes that only bite on a wide canvas: the bloom self-copy lands 1:1 under an identity transform, and the tilt-shift band reads its source rectangles in device pixels.
- New `HERO_SPRITES`/`registerHeroSprite(key, img, facing)` registry: a registered hi-res character sprite (authored at 2 device px per logical unit) replaces the procedural paperdoll, facing-keyed for the future — "e" for combat, "s"/"n" reserved for feast and camp facings. Nothing registers sprites yet; every character still draws procedurally.
- Dev harness: `prototype/hd-preview.html` renders the 2× and classic canvases side by side with a draw-cost benchmark (measured: 0.74 ms/frame at 2× — comfortably within budget).

## v0.1.19 — 2026-07-22

**The pet corner.** The feast's arm-wrestling pair is retired; where their table stood, every equipped pet now gathers on its own rug to play out the celebration:

- Cats groom — licking their flank clean, scrubbing behind an ear, sitting up smug between passes. Pups roll belly-up with paws paddling, then spring up tail-wagging. Drakelings puff little arcs of embers. Slimelets bounce, stretching tall mid-hop and splatting wide. Moon Owls turn their head clean around and hoot. Glimmer Wisps pulse and throw off orbiting shines.
- The corner has its own rug, water bowl, and ball of yarn; pets spread across it facing the middle, staggered in depth.
- `setupFeast` no longer assigns the wrestle pair — everyone joins the drink/eat/sing/dance rotation; the wrestle activity and its table are gone from both renderers.

## v0.1.18 — 2026-07-22

Boss level floor (balance stopgap): Kings now stat their HP and damage against `max(stage, highest level in the party)` instead of the raw stage, so boss fights stay real after the party outlevels the content (most visibly right after a chapter reset). Rewards still pay on the real stage; elites and normal packs are unchanged. A formal balance pass is planned; this holds the line until then.

## v0.1.17 — 2026-07-22

Smoothed the world scroll in the multiplayer client: the background now interpolates between server snapshots like the characters always did, instead of stepping forward at the 10Hz broadcast rate — the travel between fights no longer stutters.

## v0.1.16 — 2026-07-22

Flipped all four generated enemy sprites to face left, toward the party — the v0.1.15 sprites shipped facing away from the fight (the fit step's mirror was skipped). Asset-only fix; no code changes.

## v0.1.15 — 2026-07-22

**Generated enemies — the monsters join the diorama.** The four zone enemies are now PixelLab-generated sprites in the Star Renegades character lane (docs/ART-PIPELINE.md phase 6):

- The Verdant Fields slime, Gloomwood cave bat, Forgotten Crypt skeleton, and Emberdeep imp replace their procedural drawings via the new ENEMY_SPRITES registry (`assets/enemies/<kind>.png`); the procedural art remains the fallback (and the standalone prototype's look), and the Kings are the same sprites at boss scale with their procedural crown.
- Engine motion animates the static sprites — slime squash-and-stretch, bat hover with flap lift, skeleton and imp step-bob — and enraged enemies flush red. Elite auras, telegraphs, cleave rings, and HP bars stay procedural on top.
- New `scripts/art/fit-enemy.mjs` fits raw generations onto the P2 texel grid (trim → hard-alpha resample to exact texel height → 2× upscale → optional mirror).

## v0.1.14 — 2026-07-22

**The seam polish release — every layer boundary now reads natural.** A round of owner-driven refinements to how the generated layers meet:

- **Regenerated plates** — Emberdeep and Gloomwood backgrounds now carry texture to their bottom edge (their old "corner framing" produced flat bars at the ground seam).
- **The Crypt walks on a road** — the ashlar-block strip (which read as a wall face) is replaced by a worn cobbled path of irregular stones.
- **Gloomwood's floor is a deep-forest trail** — dense moss, roots, and stones with scattered luminous spore patches, replacing the featureless dark gradient.
- **Layer transitions** — strips lost their inpaint-artifact bottom row; the ground below the surface now smears smoothly to the frame edge instead of showing a second-pass seam; a depth-haze feather and an irregular palette-matched clump fringe (grass/moss/rubble/ember nubs per zone) break the ruler-straight line where the midground meets the ground.
- New dev tool: `prototype/biomes.html` renders all four biomes live on one page for art review.

## v0.1.13 — 2026-07-22

Removed the last flat transition band between the midground and the ground: each ground strip's blank top margin (a few near-uniform rows the generator left above the actual surface texture — most visible as a dark bar in Gloomwood) is now trimmed away, so surface texture starts exactly at the walk-surface lip in all four zones.

## v0.1.12 — 2026-07-22

**The ground got its perspective back.** All four ground strips regenerated from a slightly elevated camera — the walkable surface now reads as a foreshortened plane you look down onto (mottled meadow, mossy forest floor, flagstone paving, ember-veined crust) instead of an eye-level cross-section with grass silhouetted against the sky. The strip's surface lip was also raised to overlap the background plate's bottom edge, removing the flat single-color band that sat awkwardly between the midground and the ground.

## v0.1.11 — 2026-07-22

**Generated ground and planted props — the environment pass is complete.** Every layer of the scene (background, midground, ground) is now generated art with procedural fallback.

- **The ground the party walks on is real terrain** — seamlessly tiling generated strips scrolling underfoot: sunlit grass over root-laced earth (Verdant Fields), mossy spore-flecked soil (Gloomwood), worn flagstones over cracked masonry (Forgotten Crypt), charred basalt veined with glowing embers (Emberdeep). The scrolling tufts, ember sparks, and walking light pools still play on top.
- **Props no longer hover** — midground trees, rocks, flora, and fauna now bed into the ground lip (scaled so small critters aren't buried) and cast soft contact shadows, fixing the visible gap under irregular sprite bases.

## v0.1.10 — 2026-07-22

**A living, changing midground.** The second art-pipeline release: the repeating procedural props are replaced by varied generated prop sets.

- **Each zone now has a landscape, not a wallpaper** — a large anchor (oak, twisted glow-tree, candle pillar, lava spire) plus rocks, flora, and biome fauna: a rabbit in Verdant Fields, an owl on a stump in Gloomwood, a rat in the Forgotten Crypt, a fire salamander in Emberdeep. Placement varies as the party marches — different props, shifted positions, mirrored flips, open stretches — while staying deterministic, so every connected player sees the identical world.
- **Everything is scaled to the heroes** — fauna at ankle-to-knee height, flora knee-to-chest, anchor trees about twice a hero's height (the first draft's rabbit was taller than a human; the art bible now has a formal scale rule).
- Procedural props remain as automatic fallback, and the standalone prototype keeps its procedural look.

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
