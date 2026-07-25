/* =====================================================================
   ONE-TIME alpha economy reset for COMBAT-REWORK Phase 6 (v0.1.37).

   Owner decision (2026-07-25): full fresh start. Every hero returns to
   level 1 with no gear and a spawn-default wardrobe; gold, renown, and
   legacy ranks reset to a new world's values. What SURVIVES is history
   and identity: the Hall of Legends, the chapter count, retelling
   counts, lifetime-deed counters' owners (the characters themselves),
   and every free identity pick (race, skin, body, undergarments).

   Run ON THE SERVER with the service STOPPED:
     systemctl stop guild
     node scripts/reset-alpha.mjs            # backs up, then resets
     systemctl start guild

   The script refuses to run twice (it stamps worlds.ascension = 0 and
   checks for an existing backup marker) — delete the marker row check
   below only if you truly mean to reset again.
   ===================================================================== */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const repo = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
/* better-sqlite3 lives in server/node_modules — resolve from there so the
   script runs from any cwd on the box */
const Database = createRequire(path.join(repo, "server", "package.json"))("better-sqlite3");
const DB_PATH = process.argv[2] || path.join(repo, "server", "guild.db");
if (!fs.existsSync(DB_PATH)) {
  console.error(`No database at ${DB_PATH}`);
  process.exit(1);
}

/* 1. Backup — the reset is destructive; the copy is the undo button. */
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backup = `${DB_PATH}.pre-phase6-${stamp}`;
fs.copyFileSync(DB_PATH, backup);
console.log(`Backup written: ${backup}`);

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

/* spawn-default wardrobe (mirrors makeMember in shared/sim.js) */
const CLASS_OUTFIT = { tank: 3, dps: 2, healer: 1 };
const FREE_HAIRSTYLES = ["short", "pixie", "bob", "pony", "long"];

const reset = db.transaction(() => {
  const worlds = db.prepare("SELECT guild_id, prestiges, gold, renown FROM worlds").all();
  for (const w of worlds) {
    console.log(`World ${w.guild_id}: ${w.gold}g / ${w.renown} renown / ${w.prestiges} chapters -> fresh (chapters kept)`);
    db.prepare(`UPDATE worlds SET
        stage = 1, best = 1, ever_best = 1, gold = 150, renown = 0,
        legacy = '{"hymn":0,"banner":0,"merchant":0,"scholar":0,"head":0,"stipend":0}',
        stock = '{"heal":3,"armor":1,"poison":1,"res":1}',
        quests = '[]', quest_day = 0,
        chapter = '{"kills":0,"gold":0,"uniques":[]}',
        keys_cut = 0, ascension = 0
      WHERE guild_id = ?`).run(w.guild_id);
  }
  const chars = db.prepare("SELECT guild_id, user_key, name, class, cos, owned FROM characters").all();
  for (const c of chars) {
    const cos = JSON.parse(c.cos || "{}");
    const fit = CLASS_OUTFIT[c.class] ?? 0;
    /* identity endures; earned looks return to the crates */
    cos.hat = "none"; cos.outfit = fit; cos.weapon = "steel";
    cos.accessory = "none"; cos.cape = "none"; cos.pet = "none"; cos.aura = "none";
    if (!FREE_HAIRSTYLES.includes(cos.hairstyle)) cos.hairstyle = "short";
    if (typeof cos.hair !== "number" || cos.hair > 3) cos.hair = 0;
    const owned = {
      hat: ["none"], hair: [0, 1, 2, 3], hairstyle: [...FREE_HAIRSTYLES],
      outfit: [0, fit], weapon: ["steel"], accessory: ["none"],
      cape: ["none"], pet: ["none"], aura: ["none"],
    };
    db.prepare(`UPDATE characters SET
        level = 1, xp = 0, sp = 0, skills = '{}', path = NULL,
        gear = '{"weapon":null,"armor":null,"trinket":null}',
        kills = 0, dmg_done = 0, heal_done = 0,
        crates = 0, encores = 0, pity = 0, king_day = 0,
        cos = ?, owned = ?
      WHERE guild_id = ? AND user_key = ?`)
      .run(JSON.stringify(cos), JSON.stringify(owned), c.guild_id, c.user_key);
    console.log(`  ${c.name} (${c.class}) -> level 1, fresh wardrobe`);
  }
});
reset();
db.close();
console.log("Alpha reset complete. Hall of Legends, chapter count, retellings, and identities kept.");
