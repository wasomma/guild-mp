/* =====================================================================
   The Discord bot: presence as the input device.

   Runs inside the game server process and calls joinVoice / leaveVoice
   on the world directly, keyed by the Discord user ID (snowflake), with
   the member's current display name as the character name. Characters
   therefore survive nickname changes, device switches, and disconnects.

   Configuration (environment variables, or server/.env):
     DISCORD_TOKEN        bot token from the Discord developer portal
     VOICE_CHANNEL_ID     the voice channel that hosts the party
     ANNOUNCE_CHANNEL_ID  optional text channel for milestone posts

   If DISCORD_TOKEN or VOICE_CHANNEL_ID is missing, the bot stays off and
   the game runs exactly as before with the dev sidebar.
   ===================================================================== */

import { joinVoice, leaveVoice, MUTATORS } from "../shared/sim.js";

/* Compose the session chronicle from world.session. Exported for tests. */
export function formatChronicle(world) {
  const s2 = world.session;
  if (!s2 || !s2.names.length) return null;
  const mins = Math.max(1, Math.round((Date.now() - s2.startedAt) / 60000));
  const dur = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
  const lines = [];
  lines.push("📜 **The Chronicle of the Latest Tale**");
  lines.push(`⏳ ${dur} in Chapter ${s2.startChapter} · Stage ${s2.startStage} to ${s2.best}`);
  lines.push(`🛡️ Adventurers: ${s2.names.join(", ")}`);
  const foes = [`⚔️ ${s2.kills} foes slain`];
  if (s2.eliteKills) foes.push(`${s2.eliteKills} elite${s2.eliteKills > 1 ? "s" : ""}`);
  if (s2.bossKills.length) {
    const tally = {};
    for (const b of s2.bossKills) tally[b] = (tally[b] || 0) + 1;
    foes.push(`👑 ${Object.entries(tally).map(([n, c]) => c > 1 ? `${n} ×${c}` : n).join(", ")}`);
  }
  lines.push(foes.join(" · "));
  const spoils = [`🪙 ${Math.round(s2.gold).toLocaleString()} gold earned`];
  if (s2.levelUps) spoils.push(`⬆️ ${s2.levelUps} level-up${s2.levelUps > 1 ? "s" : ""}${s2.topLevel ? ` (${s2.topLevel.name} reached ${s2.topLevel.level})` : ""}`);
  lines.push(spoils.join(" · "));
  if (s2.uniques.length) lines.push(`★ Uniques claimed: ${s2.uniques.join(", ")}`);
  if (s2.bossLoot && s2.bossLoot.length) {
    for (const d of s2.bossLoot) lines.push(`👑 ${d.boss} dropped ${d.item} (${d.rarity}) → ${d.to}${d.kept ? "" : " (salvaged)"}`);
  }
  if (s2.quests) lines.push(`📜 ${s2.quests} guild quest${s2.quests > 1 ? "s" : ""} fulfilled`);
  if (s2.deaths) lines.push(`💀 ${s2.deaths} fall${s2.deaths > 1 ? "s" : ""} in battle`);
  if (s2.cleaves) lines.push(`🌀 ${s2.cleaves} cleave${s2.cleaves > 1 ? "s" : ""} weathered`);
  if (s2.chapters) lines.push(`📖 ${s2.chapters} chapter${s2.chapters > 1 ? "s" : ""} closed at the feast`);
  if (s2.retellings) lines.push(`🔄 ${s2.retellings} tale${s2.retellings > 1 ? "s" : ""} retold anew`);
  const mu = MUTATORS.find((x) => x.id === world.mutator);
  if (mu) lines.push(`🌗 The tale continues under the ${mu.name} (${mu.desc})`);
  lines.push("_The world sleeps until the party gathers again._");
  return lines.join("\n");
}

export async function startBot({ world, save }) {
  const token = process.env.DISCORD_TOKEN;
  const channelId = process.env.VOICE_CHANNEL_ID;
  const announceId = process.env.ANNOUNCE_CHANNEL_ID;
  if (!token || !channelId) {
    console.log("Discord bot disabled. Set DISCORD_TOKEN and VOICE_CHANNEL_ID to enable it.");
    return null;
  }

  let discord;
  try {
    discord = await import("discord.js");
  } catch {
    console.error("discord.js is not installed. Run: npm install discord.js");
    return null;
  }
  const { Client, GatewayIntentBits, Events } = discord;
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
  const GRACE = parseInt(process.env.CHRONICLE_GRACE_MS || "60000", 10);
  let sleepTimer = null;
  const scheduleChronicle = () => {
    clearTimeout(sleepTimer);
    sleepTimer = setTimeout(async () => {
      if (world.members.length) return;
      const post = formatChronicle(world);
      world.session = null;
      save();
      if (post && announceId) {
        try {
          const ch = await client.channels.fetch(announceId);
          await ch.send(post);
        } catch (err) { console.error("Chronicle post failed:", err.message); }
      }
      console.log("The world sleeps." + (post ? " Chronicle recorded." : ""));
    }, GRACE);
  };

  const displayName = (member) => (member.displayName || member.user.username).slice(0, 16);

  client.once(Events.ClientReady, async (c) => {
    console.log(`Discord bot online as ${c.user.tag}, watching voice channel ${channelId}.`);
    // sync anyone already sitting in the channel when the server boots
    try {
      const ch = await c.channels.fetch(channelId);
      let synced = 0;
      for (const [, member] of ch.members) {
        if (member.user.bot) continue;
        joinVoice(world, member.id, displayName(member), true);
        synced++;
      }
      if (synced) { save(); console.log(`Synced ${synced} member(s) already in voice. The world wakes.`); }
    } catch (err) {
      console.error("Could not sync the voice channel on boot:", err.message);
    }
  });

  client.on(Events.VoiceStateUpdate, (oldState, newState) => {
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;
    const was = oldState.channelId === channelId;
    const is = newState.channelId === channelId;
    if (!was && is) {
      clearTimeout(sleepTimer);
      joinVoice(world, member.id, displayName(member), true);
    } else if (was && !is) {
      leaveVoice(world, member.id);
      save(); // a departure is a natural moment to persist the character
      if (!world.members.length) scheduleChronicle();
    }
  });

  // milestone announcer: boss and elite kills, chapter transitions
  if (announceId) {
    let lastT = Date.now();
    const worthy = (l) => l.text.includes("defeated!") || l.text.includes("slain!") || l.text.includes("The tale is told") || l.text.includes("retells their tale");
    setInterval(async () => {
      const fresh = world.log.filter((l) => l.t > lastT && worthy(l));
      if (!fresh.length) return;
      lastT = Math.max(lastT, ...fresh.map((l) => l.t));
      try {
        const ch = await client.channels.fetch(announceId);
        for (const l of fresh.reverse()) {
          await ch.send(`⚔️ ${l.text} (Chapter ${world.prestiges + 1}, Stage ${world.stage})`);
        }
      } catch { /* announcements are best-effort */ }
    }, 5000);
  }

  client.on("error", (err) => console.error("Discord client error:", err.message));
  await client.login(token).catch((err) => console.error("Discord login failed:", err.message));
  return client;
}
