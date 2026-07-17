/* =====================================================================
   SQLite persistence for Guild of the Open Mic.
   Two tables, exactly as in ARCHITECTURE.md:

   worlds      one row per Discord guild: campaign and guild-wide state
   characters  one row per (guild, player): the durable character record

   user_key is the player's display name today and becomes their Discord
   snowflake ID when the bot lands (step 4); nothing else changes.
   Every function takes a guildId so multiple guilds can share one server
   process later, even though index.js runs a single world for now.
   ===================================================================== */

import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { newWorld, dehydrateMember, rehydrateMember } from "../shared/sim.js";

const DB_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "guild.db");
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS worlds (
    guild_id   TEXT PRIMARY KEY,
    stage      INTEGER NOT NULL,
    best       INTEGER NOT NULL,
    ever_best  INTEGER NOT NULL,
    gold       INTEGER NOT NULL,
    renown     INTEGER NOT NULL,
    prestiges  INTEGER NOT NULL,
    join_count INTEGER NOT NULL,
    auto_sim   INTEGER NOT NULL DEFAULT 0,
    legacy     TEXT NOT NULL,
    stock      TEXT NOT NULL,
    auto       TEXT NOT NULL,
    users      TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS characters (
    guild_id   TEXT NOT NULL,
    user_key   TEXT NOT NULL,
    name       TEXT NOT NULL,
    class      TEXT NOT NULL,
    style      TEXT NOT NULL,
    level      INTEGER NOT NULL,
    xp         REAL NOT NULL,
    sp         INTEGER NOT NULL,
    kills      INTEGER NOT NULL DEFAULT 0,
    dmg_done   REAL NOT NULL DEFAULT 0,
    heal_done  REAL NOT NULL DEFAULT 0,
    skills     TEXT NOT NULL,
    gear       TEXT NOT NULL,
    cos        TEXT NOT NULL,
    owned      TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (guild_id, user_key)
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_key   TEXT NOT NULL,
    name       TEXT NOT NULL,
    avatar     TEXT,
    created_at INTEGER NOT NULL
  );
`);

/* sessions older than 30 days expire on boot */
db.prepare("DELETE FROM sessions WHERE created_at < ?").run(Date.now() - 30 * 24 * 3600 * 1000);
const insSession = db.prepare("INSERT OR REPLACE INTO sessions (token, user_key, name, avatar, created_at) VALUES (@token, @user_key, @name, @avatar, @created_at)");
const selSession = db.prepare("SELECT * FROM sessions WHERE token = ?");
const delSession = db.prepare("DELETE FROM sessions WHERE token = ?");

export function createSession(token, key, name, avatar) {
  insSession.run({ token, user_key: key, name, avatar: avatar || null, created_at: Date.now() });
}
export function getSession(token) {
  const r = selSession.get(String(token || ""));
  return r ? { key: r.user_key, name: r.name, avatar: r.avatar } : null;
}
export function deleteSession(token) {
  delSession.run(String(token || ""));
}

/* additive migrations for columns introduced after launch */
for (const ddl of [
  "ALTER TABLE worlds ADD COLUMN quests TEXT",
  "ALTER TABLE worlds ADD COLUMN quest_day INTEGER",
  "ALTER TABLE worlds ADD COLUMN mutator TEXT",
]) { try { db.exec(ddl); } catch { /* column already exists */ } }

const upsertWorld = db.prepare(`
  INSERT INTO worlds (guild_id, stage, best, ever_best, gold, renown, prestiges,
                      join_count, auto_sim, legacy, stock, auto, users, quests, quest_day, mutator, updated_at)
  VALUES (@guild_id, @stage, @best, @ever_best, @gold, @renown, @prestiges,
          @join_count, @auto_sim, @legacy, @stock, @auto, @users, @quests, @quest_day, @mutator, @updated_at)
  ON CONFLICT(guild_id) DO UPDATE SET
    stage=@stage, best=@best, ever_best=@ever_best, gold=@gold, renown=@renown,
    prestiges=@prestiges, join_count=@join_count, auto_sim=@auto_sim,
    legacy=@legacy, stock=@stock, auto=@auto, users=@users, quests=@quests, quest_day=@quest_day, mutator=@mutator, updated_at=@updated_at
`);

const upsertChar = db.prepare(`
  INSERT INTO characters (guild_id, user_key, name, class, style, level, xp, sp,
                          kills, dmg_done, heal_done, skills, gear, cos, owned, updated_at)
  VALUES (@guild_id, @user_key, @name, @class, @style, @level, @xp, @sp,
          @kills, @dmg_done, @heal_done, @skills, @gear, @cos, @owned, @updated_at)
  ON CONFLICT(guild_id, user_key) DO UPDATE SET
    name=@name, class=@class, style=@style, level=@level, xp=@xp, sp=@sp,
    kills=@kills, dmg_done=@dmg_done, heal_done=@heal_done,
    skills=@skills, gear=@gear, cos=@cos, owned=@owned, updated_at=@updated_at
`);

const selWorld = db.prepare("SELECT * FROM worlds WHERE guild_id = ?");
const selChars = db.prepare("SELECT * FROM characters WHERE guild_id = ?");
const countChars = db.prepare("SELECT COUNT(*) AS n FROM characters WHERE guild_id = ?");

function charRow(guildId, key, d, now) {
  return {
    guild_id: guildId, user_key: key,
    name: d.name, class: d.cls, style: d.style,
    level: d.level, xp: d.xp, sp: d.sp,
    kills: d.kills, dmg_done: d.dmgDone, heal_done: d.healDone,
    skills: JSON.stringify(d.skills), gear: JSON.stringify(d.gear),
    cos: JSON.stringify(d.cos), owned: JSON.stringify(d.owned),
    updated_at: now,
  };
}

export const saveWorld = db.transaction((guildId, g) => {
  const now = Date.now();
  upsertWorld.run({
    guild_id: guildId,
    stage: g.stage, best: g.best, ever_best: g.everBest,
    gold: Math.round(g.gold), renown: g.renown, prestiges: g.prestiges,
    join_count: g.joinCount, auto_sim: g.autoSim ? 1 : 0,
    legacy: JSON.stringify(g.legacy), stock: JSON.stringify(g.stock),
    auto: JSON.stringify(g.auto), users: JSON.stringify(g.users),
    quests: JSON.stringify(g.quests || []), quest_day: g.questDay || 0,
    mutator: g.mutator || null,
    updated_at: now,
  });
  // characters in the active party and characters waiting in the roster
  for (const m of g.members) upsertChar.run(charRow(guildId, m.key || m.name, dehydrateMember(m), now));
  for (const [key, m] of Object.entries(g.roster)) upsertChar.run(charRow(guildId, key, dehydrateMember(m), now));
});

export function saveCharacter(guildId, key, m) {
  upsertChar.run(charRow(guildId, key, dehydrateMember(m), Date.now()));
}

export function loadWorld(guildId) {
  const row = selWorld.get(guildId);
  if (!row) return null;
  const g = newWorld();
  g.stage = row.stage; g.best = row.best; g.everBest = row.ever_best;
  g.gold = row.gold; g.renown = row.renown; g.prestiges = row.prestiges;
  g.joinCount = row.join_count; g.autoSim = !!row.auto_sim;
  g.legacy = JSON.parse(row.legacy); g.stock = JSON.parse(row.stock);
  g.auto = JSON.parse(row.auto); g.users = JSON.parse(row.users);
  g.quests = row.quests ? JSON.parse(row.quests) : [];
  g.questDay = row.quest_day || 0;
  g.mutator = row.mutator || null;
  g.users.forEach((u) => (u.inVoice = false)); // nobody is in voice after a cold boot
  for (const c of selChars.all(guildId)) {
    g.roster[c.user_key] = rehydrateMember(g, {
      key: c.user_key, name: c.name, cls: c.class, style: c.style,
      level: c.level, xp: c.xp, sp: c.sp,
      kills: c.kills, dmgDone: c.dmg_done, healDone: c.heal_done,
      skills: JSON.parse(c.skills), gear: JSON.parse(c.gear),
      cos: JSON.parse(c.cos), owned: JSON.parse(c.owned),
    });
  }
  return g;
}

export function characterCount(guildId) {
  return countChars.get(guildId).n;
}

export function close() {
  db.close();
}
