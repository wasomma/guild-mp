import React, { useEffect, useRef, useState } from "react";
import {
  W, H, CLASSES, STYLES, styleOf, stats, SKILLS, MAX_RANK,
  BODIES, HATS, HAIRS, HAIRSTYLES, OUTFITS, WEAPON_SKINS, ACCESSORIES, CAPES, PETS, AURAS,
  RARITIES, SLOTS, POTIONS, LEGACY, legacyCost, renownEarn, AFFIX_DEFS, questLabel, MUTATORS,
  AURAS as AURA_LIST, fmt, xpNeed, clamp, hexA, zoneOf, ENEMY_COLORS, ZONES,
} from "@shared/sim.js";
import { VERSION } from "@shared/version.js";
import { draw, drawAdventurer } from "./render.js";
import { audioInit, audioResume, setSfxMuted, setMusicMuted, sfx, musicTick } from "./audio.js";

/* In dev (vite on :5173) talk to the server on :8787; in production the
   page is served by the game server itself, so use the same origin and
   let wss:// follow automatically from https://. */
const DEV = location.port === "5173";
const HTTP_BASE = DEV ? `http://${location.hostname}:8787` : location.origin;
const SERVER_URL = HTTP_BASE.replace(/^http/, "ws");
const AUTH_URL = `${HTTP_BASE}/auth`;
document.title = `Guild of the Open Mic - Alpha v${VERSION}`;
const LERP_KEYS = ["x", "y", "lunge", "hop", "shootT", "castT", "chainT", "hp", "bubble", "stunT", "hitT", "poisonT", "windup", "slamT", "screechT", "cleaveWind", "ult", "ultT"];

function lerpEnts(prev, cur, a, keys) {
  const pm = new Map((prev || []).map((e) => [e.id, e]));
  return cur.map((e) => {
    const p = pm.get(e.id);
    if (!p) return { ...e };
    const o = { ...e };
    for (const k of keys) {
      if (typeof e[k] === "number" && typeof p[k] === "number") o[k] = p[k] + (e[k] - p[k]) * a;
    }
    return o;
  });
}

export default function App() {
  const canvasRef = useRef(null);
  const sockRef = useRef(null);
  const netRef = useRef({ prev: null, cur: null, tPrev: 0, tCur: 0 });
  // persistent view model: authoritative fields copied in, plus local fx state
  const viewRef = useRef({
    members: [], enemies: [], projectiles: [], users: [], log: [],
    floaters: [], particles: [], shake: 0, time: 0, scroll: 0,
    stage: 1, best: 1, everBest: 1, gold: 0, renown: 0, prestiges: 0,
    legacy: { hymn: 0, banner: 0, merchant: 0, scholar: 0, head: 0, stipend: 0 },
    stock: {}, auto: {}, phase: "advance", bossT: 0, prestigeT: 0, buffT: 0,
    autoSim: false, connected: false,
  });
  const [snap, setSnap] = useState(null);       // latest snapshot, drives the React UI
  const [connected, setConnected] = useState(false);
  const [tab, setTab] = useState(null);
  const [selId, setSelId] = useState(null);
  const [wardTab, setWardTab] = useState("wardrobe");
  const [confirmPrestige, setConfirmPrestige] = useState(false);
  const [me, setMe] = useState(null);
  const [sfxOff, setSfxOffUI] = useState(false);
  const [musicOff, setMusicOffUI] = useState(false);
  const [authConfigured, setAuthConfigured] = useState(false);
  const tokenRef = useRef(null);

  /* pick up the session token from the OAuth redirect fragment */
  useEffect(() => {
    const m = location.hash.match(/token=([a-f0-9]+)/);
    if (m) {
      localStorage.setItem("guild_token", m[1]);
      history.replaceState(null, "", location.pathname);
    }
    tokenRef.current = localStorage.getItem("guild_token");
  }, []);

  const logout = () => {
    send({ a: "logout", token: tokenRef.current });
    localStorage.removeItem("guild_token");
    tokenRef.current = null;
    setMe(null);
  };

  const send = (msg) => {
    const s = sockRef.current;
    if (s && s.readyState === 1) s.send(JSON.stringify(msg));
  };

  /* ---- local fx from server events ---- */
  const applyEvents = (events) => {
    const v = viewRef.current;
    for (const e of events) {
      if (e.t === "float") {
        v.floaters.push({ x: e.x + (Math.random() * 16 - 8), y: e.y, text: e.text, color: e.color, life: e.big ? 1.6 : 1.15, big: e.big, vx: (Math.random() - 0.5) * 0.3 });
      } else if (e.t === "burst") {
        for (let i = 0; i < e.n; i++) {
          const a = Math.random() * Math.PI * 2, sp = (e.spd || 1.2) * (0.4 + Math.random());
          v.particles.push({ x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.6, life: 0.5 + Math.random() * 0.4, color: e.color, size: Math.random() < 0.3 ? 4 : 3, grav: e.grav || 0 });
        }
      } else if (e.t === "sparkle") {
        for (let i = 0; i < e.n; i++) {
          v.particles.push({ x: e.x + (Math.random() * 28 - 14), y: e.y - Math.random() * 44, vx: (Math.random() - 0.5) * 0.3, vy: -0.5 - Math.random() * 0.6, life: 0.5 + Math.random() * 0.5, color: e.color, size: 3, grav: 0 });
        }
      } else if (e.t === "sfx") {
        if (sfx[e.k]) sfx[e.k]();
      } else if (e.t === "coins") {
        sfx.coin();
        for (let i = 0; i < e.n; i++) {
          const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
          v.particles.push({ x: e.x, y: e.y, vx: Math.cos(a) * 1.6, vy: Math.sin(a) * 2.2, life: 0.8 + Math.random() * 0.4, color: Math.random() < 0.5 ? "#f2c14e" : "#f7e28b", size: 3, grav: 6 });
        }
      } else if (e.t === "shake") {
        v.shake = Math.max(v.shake, e.v);
      }
    }
  };

  /* ---- websocket with retry ---- */
  useEffect(() => {
    let alive = true, retryT = null;
    const connect = () => {
      if (!alive) return;
      const s = new WebSocket(SERVER_URL);
      sockRef.current = s;
      s.onopen = () => {
        setConnected(true); viewRef.current.connected = true;
        if (tokenRef.current) s.send(JSON.stringify({ a: "auth", token: tokenRef.current }));
      };
      s.onclose = () => {
        setConnected(false); viewRef.current.connected = false;
        retryT = setTimeout(connect, 1500);
      };
      s.onerror = () => s.close();
      s.onmessage = (msg) => {
        let data;
        try { data = JSON.parse(msg.data); } catch { return; }
        if (data.type === "auth") {
          setMe(data.ok ? data.user : null);
          if (!data.ok && tokenRef.current) { localStorage.removeItem("guild_token"); tokenRef.current = null; }
          return;
        }
        if (data.type !== "state") return;
        setAuthConfigured(!!data.authConfigured);
        const net = netRef.current;
        net.prev = net.cur; net.tPrev = net.tCur;
        net.cur = data; net.tCur = performance.now();
        applyEvents(data.events || []);
        setSnap(data);
      };
    };
    connect();
    return () => { alive = false; clearTimeout(retryT); if (sockRef.current) sockRef.current.close(); };
  }, []);

  /* ---- render loop ---- */
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const onMove = (ev) => {
      const r = canvas.getBoundingClientRect();
      viewRef.current.mx = (ev.clientX - r.left) * (W / r.width);
      viewRef.current.my = (ev.clientY - r.top) * (H / r.height);
    };
    const onLeave = () => { viewRef.current.mx = null; viewRef.current.my = null; };
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseleave", onLeave);
    const onDown = () => { audioInit(); audioResume(); };
    window.addEventListener("pointerdown", onDown);
    let raf, last = performance.now();
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const v = viewRef.current;
      const net = netRef.current;
      musicTick(v, dt);
      if (net.cur) {
        const cur = net.cur;
        // copy authoritative scalars
        for (const k of ["stage", "best", "everBest", "gold", "renown", "prestiges", "legacy", "stock", "auto", "phase", "scroll", "bossT", "prestigeT", "buffT", "autoSim", "users", "log", "advanceT", "vote", "feastT", "quests", "questDay", "mutator", "hall"]) v[k] = cur[k];
        // interpolate entities between the last two snapshots (renders one interval behind)
        const span = Math.max(20, net.tCur - net.tPrev);
        const a = net.prev ? clamp((now - net.tCur) / span, 0, 1) : 1;
        v.members = lerpEnts(net.prev ? net.prev.members : null, cur.members, a, LERP_KEYS);
        v.enemies = lerpEnts(net.prev ? net.prev.enemies : null, cur.enemies, a, LERP_KEYS);
        v.projectiles = lerpEnts(net.prev ? net.prev.projectiles : null, cur.projectiles, a, ["x", "y"]);
        // smooth local clock nudged toward server time
        v.time += dt;
        v.time += (cur.now + (now - net.tCur) / 1000 - v.time) * 0.05;
      } else {
        v.time += dt;
      }
      // client-side ambient fx: auras and enrage embers
      for (const m of v.members) {
        if (m.alive && m.cos.aura !== "none" && Math.random() < dt * 7) {
          const def = AURA_LIST.find((x) => x.id === m.cos.aura);
          if (def && def.c) v.particles.push({ x: m.x + (Math.random() * 24 - 12), y: m.y - Math.random() * 6, vx: (Math.random() - 0.5) * 0.2, vy: -0.35 - Math.random() * 0.4, life: 0.7 + Math.random() * 0.5, color: def.c, size: Math.random() < 0.3 ? 3 : 2, grav: 0 });
        }
      }
      for (const e of v.enemies) {
        if (e.hp > 0 && e.enraged && Math.random() < dt * 10) {
          v.particles.push({ x: e.x + (Math.random() * 20 - 10), y: e.y - Math.random() * 10, vx: (Math.random() - 0.5) * 0.3, vy: -0.8 - Math.random() * 0.7, life: 0.4 + Math.random() * 0.4, color: Math.random() < 0.5 ? "#ff6a3a" : "#f2a94e", size: 2, grav: 0 });
        }
      }
      v.shake = Math.max(0, v.shake - dt * 14);
      draw(ctx, v, dt);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("pointerdown", onDown);
    };
  }, []);

  const g = snap;
  const sel = g ? g.members.find((m) => m.id === selId) : null;
  const zone = g ? zoneOf(g) : null;
  /* who may act on a member: open in dev mode; owner-only for Discord characters */
  const lockOf = (m) => {
    if (!authConfigured) return null;
    if (!me) return "Log in with Discord to make changes.";
    const owner = g && g.users.find((u) => u.key === m.key);
    if (owner && owner.discord && me.key !== m.key) return `Only ${owner.name} can change this character.`;
    return null;
  };
  const guildLock = authConfigured && !me ? "Log in with Discord to act." : null;

  return (
    <div className="app">
      <style>{CSS}</style>
      <div className="frame">
        <header>
          <div className="title">⚔️ GUILD OF THE OPEN MIC - ALPHA <span className="ver">v{VERSION}</span></div>
          <div className="hstats">
            <span className={"pill " + (connected ? "ok" : "bad")}>{connected ? "● LIVE" : "○ OFFLINE"}</span>
            <button className="pill sound" title={sfxOff ? "unmute sounds" : "mute sounds"}
              onClick={() => { audioInit(); audioResume(); setSfxMuted(!sfxOff); setSfxOffUI(!sfxOff); }}>{sfxOff ? "🔇" : "🔊"}</button>
            <button className="pill sound" title={musicOff ? "unmute music" : "mute music"} style={{ opacity: musicOff ? 0.35 : 1 }}
              onClick={() => { audioInit(); audioResume(); setMusicMuted(!musicOff); setMusicOffUI(!musicOff); }}>🎵</button>
            <a className="pill login" href="https://github.com/wasomma/guild-mp/blob/main/TUTORIAL.md" target="_blank" rel="noopener" title="open the player guide in a new tab">❓ How to play</a>
            {authConfigured && (me
              ? <span className="pill who">
                  {me.avatar && <img className="pfp" src={me.avatar} alt="" />}
                  {me.name}
                  <button className="linkish" onClick={logout}>logout</button>
                </span>
              : <a className="pill login" href={`${AUTH_URL}/login`}>Log in with Discord</a>)}
          </div>
        </header>
        <div className="main">
          <aside className="voice">
            <div className="vhead">🔊 Voice Channel</div>
            {g && g.members.length >= 2 && (
              <div className="chorusline" title="Chorus of Courage: every voice past the first grants +4% damage and healing and +3% max HP">
                🎵 Chorus +{Math.min(g.members.length - 1, 9) * 4}% dmg/heal · +{Math.min(g.members.length - 1, 9) * 3}% HP
              </div>
            )}
            {g && <PartyList g={g} onSel={(id) => { setSelId(id === selId ? null : id); setWardTab("stats"); setTab(null); }} />}
          </aside>
          <section className="stage">
            <div className="canvaswrap">
              <canvas ref={canvasRef} width={W} height={H} />
            </div>
            {g && (
              <div className="worldbar">
                <div className="wgroup">
                  <span>📖 Chapter {g.prestiges + 1}</span>
                  <span>🏰 Stage {g.stage}{g.stage % 5 === 0 ? " · BOSS" : g.stage % 5 === 3 ? " · ELITE" : ""}</span>
                  <span>🗺️ {zone.name}</span>
                  {MUTATORS.filter((x) => x.id === g.mutator).map((mu) => (
                    <span key={mu.id} style={{ color: mu.c }} title={mu.desc}>📖 {mu.name.replace("Chapter of ", "")}</span>
                  ))}
                </div>
                <div className="wgroup">
                  <span className="wgold">🪙 {fmt(g.gold)}</span>
                  <span className="wrenown">✨ {fmt(g.renown)}</span>
                </div>
              </div>
            )}
            <div className="tabs">
              {["guild", "shop", "log"].map((t2) => (
                <button key={t2} className={"tab" + (tab === t2 ? " on" : "")} onClick={() => { setTab(tab === t2 ? null : t2); setSelId(null); }}>
                  {{ guild: "🏛️ Guild Hall", shop: "🧪 Alchemist", log: "📜 Chronicle" }[t2]}
                </button>
              ))}
            </div>
          </section>
          {g && (
            <aside className="bossrail">
              <div className="vhead">Upcoming Bosses</div>
              {Array.from({ length: 10 }, (_, i) => {
                const bossStage = g.stage + (g.stage % 5 === 0 ? 0 : 5 - (g.stage % 5)) + i * 5;
                const z = ZONES[Math.floor((bossStage - 1) / 5) % ZONES.length];
                const waves = bossStage - g.stage;
                return (
                  <div key={bossStage} className={"bossent" + (i === 0 ? " first" : "")}>
                    <div className="bossicon">👑</div>
                    <div className="bossname" style={{ color: ENEMY_COLORS[z.enemy] }}>{z.label} King</div>
                    <div className="bosswaves">{waves === 0 ? "⚔️ HERE NOW" : `${waves} wave${waves > 1 ? "s" : ""} left`}</div>
                  </div>
                );
              })}
            </aside>
          )}
          {g && sel && (
            <aside className="rightcol">
              <MemberDetail g={g} m={sel} send={send} wardTab={wardTab} setWardTab={setWardTab} onBack={() => setSelId(null)} lock={lockOf(sel)} />
            </aside>
          )}
          {g && !sel && tab && (
            <aside className="rightcol">
              <div className="drow">
                <button className="mini" onClick={() => setTab(null)}>✕ close</button>
                <span>{{ guild: "🏛️ Guild Hall", shop: "🧪 Alchemist", log: "📜 Chronicle" }[tab]}</span>
              </div>
              {tab === "guild" && <GuildHall g={g} send={send} confirm={confirmPrestige} setConfirm={setConfirmPrestige} lock={guildLock} me={me} authConfigured={authConfigured} />}
              {tab === "shop" && <Shop g={g} send={send} lock={guildLock} />}
              {tab === "log" && (
                <div className="logbox">
                  {g.log.map((l, i) => <div key={i} className="logline" style={{ color: l.color }}>{l.text}</div>)}
                  {!g.log.length && <div className="dim pad">The chronicle is empty. Deeds await.</div>}
                </div>
              )}
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}

/* ===================== UI sections ===================== */

/* Zoomed, animated inspect view of one adventurer: the same drawAdventurer
   that renders the world, at 4x, minus the HUD bars. This is where earned
   gear and cosmetics are meant to be admired. */
function Portrait({ m }) {
  const cvRef = useRef(null);
  const mRef = useRef(m);
  mRef.current = m;
  useEffect(() => {
    const cv = cvRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    let raf;
    const t0 = performance.now();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const src = mRef.current;
      if (!src) return;
      const t = (performance.now() - t0) / 1000;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "#141221";
      ctx.fillRect(0, 0, cv.width, cv.height);
      const grd = ctx.createRadialGradient(cv.width * 0.42, cv.height * 0.62, 10, cv.width * 0.42, cv.height * 0.62, 170);
      grd.addColorStop(0, "rgba(63,58,96,0.55)");
      grd.addColorStop(1, "rgba(63,58,96,0)");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.imageSmoothingEnabled = false;
      const Z = 4;
      ctx.setTransform(Z, 0, 0, Z, Math.round(cv.width * 0.42), cv.height - 6 * Z);
      const mp = {
        ...src, x: 0, y: 0, walking: false, lunge: 0, hop: 0, shootT: 0, castT: 0,
        chainT: 0, ultT: 0, ult: null, feast: 0, bubble: 0, alive: true, atkT: 999, noBars: true,
      };
      drawAdventurer(ctx, mp, t);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={cvRef} width={300} height={400} className="portrait" />;
}

function PartyList({ g, onSel }) {
  if (!g.members.length) return <div className="dim">The hall is quiet. Join the Discord voice channel to enter the world.</div>;
  return (
    <div className="plist">
      {g.members.map((m) => {
        const st = m._st || { hp: m.hp };
        return (
          <button key={m.id} className="pcard" onClick={() => onSel(m.id)} style={{ borderColor: hexA(CLASSES[m.cls].color, 0.5) }}>
            <div className="prow">
              <span style={{ color: CLASSES[m.cls].color }}>{CLASSES[m.cls].icon} {m.name}</span>
              <span className="dim">Lv {m.level} {styleOf(m).name}</span>
            </div>
            <div className="bar"><div className="fill" style={{ width: `${clamp((m.hp / st.hp) * 100, 0, 100)}%`, background: CLASSES[m.cls].color }} /></div>
            <div className="prow dim small">
              <span>XP {fmt(m.xp)}/{fmt(xpNeed(m.level))}</span>
              <span>{m.sp > 0 ? `★ ${m.sp} pts` : `${m.kills} kills`}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function MemberDetail({ g, m, send, wardTab, setWardTab, onBack, lock }) {
  return (
    <div className="detail">
      <div className="drow">
        <button className="mini" onClick={onBack}>✕ close</button>
        <span style={{ color: CLASSES[m.cls].color }}>{CLASSES[m.cls].icon} {m.name} · Lv {m.level} {styleOf(m).name}</span>
        <span className="dim small">dmg {fmt(m.dmgDone)} · heal {fmt(m.healDone)} · kills {m.kills}</span>
      </div>
      <div className="inspect">
        <Portrait m={m} />
      </div>
      <div className="subtabs">
        {["stats", "equipment", "skills", "wardrobe"].map((t2) => (
          <button key={t2} className={"tab sm" + (wardTab === t2 ? " on" : "")} onClick={() => setWardTab(t2)}>
            {{ stats: "📊 Stats", equipment: "🗡️ Equipment", skills: "📚 Skills", wardrobe: "👗 Wardrobe" }[t2]}
          </button>
        ))}
      </div>
      {lock && <div className="lockmsg">🔒 {lock}</div>}
      {wardTab === "stats" && <StatsPanel g={g} m={m} />}
      {wardTab === "equipment" && <Equipment m={m} />}
      {wardTab === "skills" && <Skills g={g} m={m} send={send} lock={lock} />}
      {wardTab === "wardrobe" && <Wardrobe g={g} m={m} send={send} lock={lock} />}
    </div>
  );
}

function StatsPanel({ g, m }) {
  const st = stats(m, g);
  const pct = (v) => `${Math.round(v * 100)}%`;
  const rows = [];
  const add = (label, value, color) => rows.push({ label, value, color });
  add("Class", `${CLASSES[m.cls].icon} ${CLASSES[m.cls].name}`, CLASSES[m.cls].color);
  add("Fighting Style", styleOf(m).name);
  add("Level", `${m.level}  (XP ${fmt(m.xp)}/${fmt(xpNeed(m.level))})`);
  add("Health", `${fmt(Math.round(m.hp))} / ${fmt(st.hp)}`);
  add("Damage", fmt(Math.round(st.dmg)));
  add("Attack Speed", `every ${st.spd.toFixed(2)}s`);
  add("Crit Chance", `${Math.round(st.crit)}%`);
  if (st.critDmg > 0) add("Crit Damage", `+${pct(st.critDmg)}`);
  if (st.heal > 0) add("Healing Power", fmt(Math.round(st.heal)));
  add("Armor", fmt(Math.round(st.armor)));
  if (st.dr > 0) add("Damage Reduction", pct(st.dr));
  if (st.stun > 0) add("Stun Chance", pct(st.stun));
  if (st.splash > 0) add("Splash Healing", pct(st.splash));
  if (st.ls > 0) add("Lifesteal", pct(st.ls));
  if (st.thorns > 0) add("Thorns", pct(st.thorns));
  if (st.goldF > 0) add("Gold Find", `+${pct(st.goldF)}`);
  if (st.chorus > 0) add("Chorus of Courage", `${st.chorus} voice${st.chorus > 1 ? "s" : ""} · +${st.chorus * 4}% dmg/heal · +${st.chorus * 3}% HP`, "#8fd069");
  return (
    <div>
      <div className="statgrid">
        {rows.map((r) => (
          <React.Fragment key={r.label}>
            <span className="dim">{r.label}</span>
            <span style={r.color ? { color: r.color } : undefined}>{r.value}</span>
          </React.Fragment>
        ))}
      </div>
      <div className="coshead" style={{ marginTop: 10 }}>Lifetime Deeds</div>
      <div className="statgrid">
        <span className="dim">Kills</span><span>{fmt(m.kills)}</span>
        <span className="dim">Damage Dealt</span><span>{fmt(m.dmgDone)}</span>
        <span className="dim">Healing Done</span><span>{fmt(m.healDone)}</span>
        <span className="dim">Skill Points</span><span>{m.sp > 0 ? `★ ${m.sp} unspent` : "none unspent"}</span>
      </div>
    </div>
  );
}

function CosmeticGrid({ g, m, kind, list, title, send, lock }) {
  return (
    <div className="cosgroup">
      <div className="coshead">{title}</div>
      <div className="cosgrid">
        {list.map((item, idx) => {
          const key = item.id !== undefined ? item.id : idx;
          const owned = m.owned[kind].includes(key);
          const equipped = m.cos[kind] === key;
          const afford = g.gold >= item.price;
          return (
            <button key={key}
              className={"cositem" + (equipped ? " eq" : owned ? " own" : "")}
              disabled={!!lock || (!owned && !afford)}
              onClick={() => send({ a: "cosmetic", memberId: m.id, kind, key })}>
              {item.c && <span className="swatch" style={{ background: item.c }} />}
              <span>{item.name}</span>
              <span className="price">{equipped ? "✓" : owned ? "owned" : `${item.price}g`}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Wardrobe({ g, m, send, lock }) {
  return (
    <div className="ward">
      <div className="cosgroup">
        <div className="coshead">Fighting Style <span className="dim small">(free to switch)</span></div>
        <div className="cosgrid">
          {STYLES[m.cls].map((s) => (
            <button key={s.id} disabled={!!lock} className={"cositem" + (m.style === s.id ? " eq" : " own")}
              onClick={() => send({ a: "setStyle", memberId: m.id, styleId: s.id })}>
              <span>{s.name}</span>
              <span className="price">{m.style === s.id ? "✓" : "switch"}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="cosgroup">
        <div className="coshead">Body <span className="dim small">(free)</span></div>
        <div className="cosgrid">
          {BODIES.map((b) => (
            <button key={b.id} disabled={!!lock} className={"cositem" + (m.cos.body === b.id ? " eq" : " own")}
              onClick={() => send({ a: "setBody", memberId: m.id, body: b.id })}>
              <span>{b.name}</span>
              <span className="price">{m.cos.body === b.id ? "✓" : "switch"}</span>
            </button>
          ))}
        </div>
      </div>
      <CosmeticGrid g={g} m={m} kind="hat" list={HATS} title="Headwear" send={send} lock={lock} />
      <CosmeticGrid g={g} m={m} kind="hairstyle" list={HAIRSTYLES} title="Hairstyle" send={send} lock={lock} />
      <CosmeticGrid g={g} m={m} kind="hair" list={HAIRS} title="Hair Dye" send={send} lock={lock} />
      <CosmeticGrid g={g} m={m} kind="outfit" list={OUTFITS} title="Outfit" send={send} lock={lock} />
      <CosmeticGrid g={g} m={m} kind="accessory" list={ACCESSORIES} title="Accessories" send={send} lock={lock} />
      <CosmeticGrid g={g} m={m} kind="cape" list={CAPES} title="Capes" send={send} lock={lock} />
      <CosmeticGrid g={g} m={m} kind="weapon" list={WEAPON_SKINS} title="Weapon Finish" send={send} lock={lock} />
      <CosmeticGrid g={g} m={m} kind="pet" list={PETS} title="Companions" send={send} lock={lock} />
      <CosmeticGrid g={g} m={m} kind="aura" list={AURAS} title="Auras" send={send} lock={lock} />
    </div>
  );
}

function Equipment({ m }) {
  return (
    <div className="equip">
      {SLOTS.map((s) => {
        const it = m.gear[s];
        return (
          <div key={s} className="eqslot">
            <div className="dim small">{s.toUpperCase()}</div>
            {it
              ? <div>
                  <div style={{ color: it.rarity.color }}>{it.unique ? "✦ " : ""}{it.name}<span className="dim small"> · {it.rarity.name} · +{it.power}</span></div>
                  {it.affixes && it.affixes.map((a) => (
                    <div key={a.id} className="small" style={{ color: "#8fd0b0" }}>{AFFIX_DEFS[a.id].name}: {AFFIX_DEFS[a.id].fmt(a.v)}</div>
                  ))}
                </div>
              : <div className="dim">empty</div>}
          </div>
        );
      })}
      <div className="note">Loot auto-equips when it beats what is worn; otherwise it is salvaged for gold.</div>
    </div>
  );
}

function Skills({ g, m, send, lock }) {
  return (
    <div className="skills">
      <div className="dim small pad">Skill points: <b style={{ color: "#f2c14e" }}>{m.sp}</b></div>
      <div className="skrow">
        <div>
          <div>🎲 Auto-assign</div>
          <div className="dim small">{m.autoSkill ? "Points spend themselves as they are earned." : "Off — spend your points below."}</div>
        </div>
        <button className="mini" disabled={!!lock}
          onClick={() => send({ a: "setAutoSkill", memberId: m.id, on: !m.autoSkill })}>{m.autoSkill ? "turn off" : "turn on"}</button>
      </div>
      <div className="skrow">
        <div>
          <div>↺ Reset points</div>
          <div className="dim small">Reclaim all spent points and assign them yourself (turns auto off).</div>
        </div>
        <button className="mini" disabled={!!lock}
          onClick={() => send({ a: "respecSkills", memberId: m.id })}>reset</button>
      </div>
      {SKILLS[m.cls].map((sk) => {
        const r = m.skills[sk.id] || 0;
        return (
          <div key={sk.id} className="skrow">
            <div>
              <div>{sk.name} <span className="dim small">{"◆".repeat(r)}{"◇".repeat(MAX_RANK - r)}</span></div>
              <div className="dim small">{sk.desc}</div>
            </div>
            <button className="mini" disabled={!!lock || m.sp <= 0 || r >= MAX_RANK}
              onClick={() => send({ a: "skillUp", memberId: m.id, skillId: sk.id })}>+</button>
          </div>
        );
      })}
      <div className="coshead pad">Respec (resets skills)</div>
      <div className="cosgrid">
        {Object.keys(CLASSES).map((c) => (
          <button key={c} disabled={!!lock} className={"cositem" + (m.cls === c ? " eq" : " own")}
            onClick={() => send({ a: "setClass", memberId: m.id, cls: c })}>
            <span style={{ color: CLASSES[c].color }}>{CLASSES[c].icon} {CLASSES[c].name}</span>
            <span className="price">{m.cls === c ? "✓" : "respec"}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function GuildHall({ g, send, confirm, setConfirm, lock, me, authConfigured }) {
  const can = g.stage >= 21 && !lock;
  const muDef = MUTATORS.find((x) => x.id === g.mutator);
  const earn = Math.round(renownEarn(g.stage) * (muDef ? muDef.renownMult : 1));
  const partyKeys = [...new Set(g.members.map((m) => m.key))];
  const multi = partyKeys.length > 1;
  const v = g.vote;
  const yesN = v ? v.yes.filter((k) => partyKeys.includes(k)).length : 0;
  const noN = v ? v.no.filter((k) => partyKeys.includes(k)).length : 0;
  const myMember = me && g.members.find((m) => m.key === me.key);
  const myBallot = v && me ? (v.yes.includes(me.key) ? "Aye" : v.no.includes(me.key) ? "Nay" : null) : null;
  const hoursLeft = g.questDay ? Math.max(0, Math.ceil(((g.questDay + 1) * 86400000 - Date.now()) / 3600000)) : 0;
  return (
    <div className="guild">
      <div className="prestigebox">
        <div className="coshead">📜 Quest Board</div>
        {(g.quests || []).map((q) => (
          <div key={q.id} className="questrow">
            <div className="qtop">
              <span style={{ color: q.done ? "#7fd069" : "#efeaff" }}>{q.done ? "✓ " : ""}{questLabel(q)}</span>
              <span className="dim small">{q.done ? "complete" : `${fmt(Math.floor(q.progress))} / ${fmt(q.target)}`} · {q.gold}g ✨{q.renown}</span>
            </div>
            <div className="qbar"><div className="qfill" style={{ width: `${Math.min(100, (q.progress / q.target) * 100)}%`, background: q.done ? "#7fd069" : "#c9a24b" }} /></div>
          </div>
        ))}
        {!(g.quests || []).length && <div className="dim small">The board refreshes when the world wakes.</div>}
        <div className="dim small">New contracts at daybreak{hoursLeft ? ` (about ${hoursLeft}h)` : ""}.</div>
      </div>
      {v ? (
        <div className="prestigebox votebox">
          <div className="coshead">📖 Vote: Retell the Tale</div>
          <div className="dim small">
            {v.byName} calls for a new chapter, worth <b style={{ color: "#f2c14e" }}>{earn} renown</b>.
            A majority of the party must agree. <b style={{ color: "#b07fe0" }}>{Math.ceil(Math.max(0, v.t))}s</b> remain.
          </div>
          <div className="drow">
            <span className="pill">Aye {yesN} · Nay {noN} · of {partyKeys.length}</span>
          </div>
          {authConfigured ? (
            myMember ? (
              <div className="drow">
                <button className="mini big" onClick={() => send({ a: "vote", v: true })}>Aye, retell it</button>
                <button className="mini big warn" onClick={() => send({ a: "vote", v: false })}>Nay, fight on</button>
                {myBallot && <span className="dim small">You voted {myBallot}.</span>}
              </div>
            ) : <div className="dim small">Your adventurer must be in the party to vote.</div>
          ) : (
            <div className="votegrid">
              {g.members.map((m) => {
                const b = v.yes.includes(m.key) ? "y" : v.no.includes(m.key) ? "n" : "";
                return (
                  <div key={m.id} className="voterow">
                    <span style={{ color: CLASSES[m.cls].color }}>{m.name}</span>
                    <button className={"mini" + (b === "y" ? " aye" : "")} onClick={() => send({ a: "vote", v: true, key: m.key })}>✓</button>
                    <button className={"mini" + (b === "n" ? " nay" : "")} onClick={() => send({ a: "vote", v: false, key: m.key })}>✗</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
      <div className="prestigebox">
        <div className="coshead">📖 Retell the Tale</div>
        <div className="dim small">
          End this chapter to earn <b style={{ color: "#f2c14e" }}>{earn} renown</b>. Levels, gear, gold, and stage reset.
          Cosmetics, styles, renown, and legacy upgrades endure. {can ? "" : "Reach stage 21 to unlock."}
          {multi ? " With a full party this calls a vote: the majority decides." : ""}
        </div>
        {!confirm
          ? <button className="mini big" disabled={!can} onClick={() => setConfirm(true)}>{multi ? "Call the vote" : "Retell the Tale"}</button>
          : <div className="drow">
              <button className="mini big warn" onClick={() => { send({ a: "prestige" }); setConfirm(false); }}>{multi ? "Confirm: put it to the party" : `Confirm: end Chapter ${g.prestiges + 1}`}</button>
              <button className="mini" onClick={() => setConfirm(false)}>cancel</button>
            </div>}
      </div>
      )}
      {lock && <div className="lockmsg">🔒 {lock}</div>}
      <div className="coshead pad">Legacy Upgrades <span className="dim small">✨ {fmt(g.renown)} renown</span></div>
      {LEGACY.map((u) => {
        const r = g.legacy[u.id], cost = legacyCost(r), maxed = r >= u.max;
        return (
          <div key={u.id} className="skrow">
            <div>
              <div>{u.name} <span className="dim small">{"◆".repeat(r)}{"◇".repeat(u.max - r)}</span></div>
              <div className="dim small">{u.desc}</div>
            </div>
            <button className="mini" disabled={!!lock || maxed || g.renown < cost}
              onClick={() => send({ a: "legacyUp", id: u.id })}>
              {maxed ? "MAX" : `${cost}✨`}
            </button>
          </div>
        );
      })}
      {(g.hall || []).length > 0 && <>
        <div className="coshead pad">🏛️ Hall of Legends</div>
        {[...g.hall].reverse().map((r) => {
          const rmu = MUTATORS.find((x) => x.id === r.mutator);
          return (
            <div key={r.chapter} className="skrow">
              <div>
                <div>Chapter {r.chapter} · reached stage {fmt(r.stage)}
                  {rmu && <span style={{ color: rmu.c }}> · {rmu.name}</span>}</div>
                <div className="dim small">
                  {fmt(r.kills)} foes · {fmt(r.gold)}g · ✨{fmt(r.renown)}
                  {r.mvp ? ` · MVP ${r.mvp.name} (${fmt(r.mvp.dmg)} dmg)` : ""}
                  {r.uniques && r.uniques.length ? ` · ★ ${r.uniques.join(", ")}` : ""}
                </div>
              </div>
            </div>
          );
        })}
      </>}
      <div className="dim small pad">Best stage this chapter: {g.best} · Best ever: {g.everBest} · Chapters told: {g.prestiges}</div>
    </div>
  );
}

function Shop({ g, send, lock }) {
  return (
    <div className="shop">
      {lock && <div className="lockmsg">🔒 {lock}</div>}
      {Object.entries(POTIONS).map(([k, p]) => (
        <div key={k} className="skrow">
          <div>
            <div>{p.icon} {p.name} <span className="dim small">× {g.stock[k]}</span></div>
            <div className="dim small">{p.desc}</div>
          </div>
          <div className="drow">
            <label className="dim small auto">
              <input type="checkbox" disabled={!!lock} checked={!!g.auto[k]} onChange={() => send({ a: "toggleAuto", k })} /> auto
            </label>
            <button className="mini" disabled={!!lock || g.gold < p.price} onClick={() => send({ a: "buyPotion", k })}>{p.price}g</button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ===================== styles ===================== */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap');
* { box-sizing: border-box; margin: 0; }
body { background: #0a0812; }
.app { min-height: 100vh; display: flex; background: #0a0812; font-family: 'VT323', monospace; color: #efeaff; font-size: 19px; }
.frame { width: 100%; background: #100e1a; border-top: 2px solid #2b2740; border-bottom: 2px solid #2b2740; overflow: hidden; display: flex; flex-direction: column; }
header { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 10px 14px; background: #161326; border-bottom: 2px solid #2b2740; flex-wrap: wrap; }
.title { font-family: 'Press Start 2P', monospace; font-size: 13px; color: #f2c14e; }
.title .ver { font-size: 10px; color: #8b84ad; }
.hstats { display: flex; gap: 6px; flex-wrap: wrap; }
.pill { background: #1e1a30; border: 1px solid #2b2740; border-radius: 6px; padding: 2px 9px; }
.pill.gold { color: #f2c14e; } .pill.renown { color: #b07fe0; }
.pill.chorus { color: #8fe3ff; }
.pill.ok { color: #7fd069; } .pill.bad { color: #ef6461; }
.pill.sound { cursor: pointer; font-family: inherit; font-size: 15px; color: #efeaff; }
.pill.sound:hover { background: #26213c; }
.main { display: flex; min-height: 560px; flex: 1; }
.voice { width: 240px; background: #131022; border-right: 2px solid #2b2740; padding: 10px; display: flex; flex-direction: column; gap: 7px; overflow-y: auto; }
.voice .plist { grid-template-columns: 1fr; }
.rightcol { width: 340px; flex: none; background: #131022; border-left: 2px solid #2b2740; padding: 10px; overflow-y: auto; position: sticky; top: 0; max-height: calc(100vh - 56px); align-self: flex-start; }
.bossrail { width: 130px; flex: none; background: #131022; border-left: 2px solid #2b2740; padding: 10px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 0; overflow-y: auto; position: sticky; top: 0; max-height: calc(100vh - 56px); align-self: flex-start; }
.bossent { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 8px 0; border-bottom: 1px solid #2b2740; width: 100%; opacity: 0.7; }
.bossent:last-child { border-bottom: none; }
.bossent.first { opacity: 1; }
.bossicon { font-size: 20px; line-height: 1; }
.bossent.first .bossicon { font-size: 30px; }
.bossname { font-size: 17px; line-height: 1.1; }
.bossent.first .bossname { font-size: 19px; }
.bosswaves { color: #f2c14e; font-size: 17px; }
.bossent.first .bosswaves { font-size: 20px; }
.vhead { color: #8b84ad; font-size: 17px; }
.dim { color: #8b84ad; } .small { font-size: 15px; } .pad { padding: 8px; }
.vuser { display: flex; align-items: center; gap: 7px; padding: 4px 6px; border-radius: 6px; opacity: 0.55; }
.vuser.in { opacity: 1; background: #1c1830; }
.avatar { width: 22px; height: 22px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: #100e1a; font-weight: bold; flex: none; }
.uname { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mini { font-family: 'VT323', monospace; font-size: 16px; background: #26213c; color: #efeaff; border: 1px solid #3a3550; border-radius: 5px; padding: 2px 8px; cursor: pointer; }
.mini:hover:not(:disabled) { background: #33304f; }
.mini:disabled { opacity: 0.4; cursor: default; }
.mini.big { font-size: 18px; padding: 5px 12px; margin-top: 6px; }
.mini.warn { background: #5c2430; border-color: #93384a; }
.pill.login { color: #8a6fe0; text-decoration: none; }
.pill.login:hover { background: #26213c; }
.pill.who { display: inline-flex; align-items: center; gap: 6px; }
.pfp { width: 18px; height: 18px; border-radius: 50%; }
.linkish { background: none; border: none; color: #8b84ad; font-family: 'VT323', monospace; font-size: 14px; cursor: pointer; text-decoration: underline; padding: 0; }
.lockmsg { background: #1c1830; border: 1px solid #3a3550; border-radius: 6px; padding: 6px 10px; color: #b8b2d4; }
.note { color: #6d6790; font-size: 14px; line-height: 1.25; margin-top: auto; }
.stage { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.worldbar { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; padding: 5px 12px; background: #161326; border-bottom: 1px solid #2b2740; }
.worldbar .wgroup { display: flex; gap: 16px; flex-wrap: wrap; }
.wgold { color: #f2c14e; } .wrenown { color: #b07fe0; }
.chorusline { color: #8fe3ff; font-size: 16px; }
.canvaswrap { flex: 1; min-height: 0; display: flex; align-items: center; background: #000; border-bottom: 2px solid #2b2740; }
canvas { width: 100%; display: block; image-rendering: pixelated; background: #000; }
.tabs { display: flex; gap: 4px; padding: 8px 10px; }
.tab { font-family: 'VT323', monospace; font-size: 18px; background: #161326; color: #8b84ad; border: 1px solid #2b2740; border-radius: 7px; padding: 4px 12px; cursor: pointer; }
.tab.on { background: #1e1a30; color: #efeaff; }
.tab.sm { font-size: 16px; border-radius: 6px; border: 1px solid #2b2740; }
.plist { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; }
.pcard { font-family: 'VT323', monospace; font-size: 18px; text-align: left; background: #17142a; color: #efeaff; border: 1px solid; border-radius: 8px; padding: 8px; cursor: pointer; }
.pcard:hover { background: #201c36; }
.prow { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; }
.bar { height: 7px; background: #131022; border-radius: 4px; margin: 5px 0; overflow: hidden; }
.fill { height: 100%; }
.detail { display: flex; flex-direction: column; gap: 8px; }
.statgrid { display: grid; grid-template-columns: auto 1fr; gap: 3px 14px; align-items: baseline; }
.statgrid span:nth-child(even) { text-align: right; }
.drow { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.inspect { display: flex; justify-content: center; padding: 4px 0 2px; }
.portrait { width: 190px; height: auto; image-rendering: pixelated; border: 1px solid #2e2947; border-radius: 10px; }
.subtabs { display: flex; gap: 5px; }
.cosgroup { margin-bottom: 10px; }
.coshead { color: #f2c14e; margin-bottom: 5px; }
.cosgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(128px, 1fr)); gap: 5px; }
.cositem { font-family: 'VT323', monospace; font-size: 16px; display: flex; align-items: center; gap: 6px; background: #17142a; color: #cfc9e8; border: 1px solid #2b2740; border-radius: 6px; padding: 4px 7px; cursor: pointer; }
.cositem:hover:not(:disabled) { background: #201c36; }
.cositem:disabled { opacity: 0.45; cursor: default; }
.cositem.eq { border-color: #f2c14e; color: #f2c14e; }
.cositem.own { border-color: #3a3550; }
.cositem span:first-child { flex: none; }
.cositem span:nth-last-child(2) { flex: 1; text-align: left; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.price { color: #8b84ad; flex: none; }
.swatch { width: 12px; height: 12px; border-radius: 3px; border: 1px solid #0008; }
.skrow { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 6px 4px; border-bottom: 1px solid #26213c; }
.logbox { display: flex; flex-direction: column; gap: 3px; }
.logline { font-size: 17px; }
.prestigebox { background: #17142a; border: 1px solid #3a3550; border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 6px; }
.votebox { border-color: #b07fe0; }
.questrow { background: #131022; border-radius: 6px; padding: 6px 8px; display: flex; flex-direction: column; gap: 3px; }
.qtop { display: flex; justify-content: space-between; gap: 8px; }
.qbar { height: 5px; background: #26213c; border-radius: 3px; overflow: hidden; }
.qfill { height: 100%; }
.votegrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 5px; }
.voterow { display: flex; align-items: center; gap: 6px; background: #131022; border-radius: 6px; padding: 3px 7px; }
.voterow span { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mini.aye { border-color: #7fd069; color: #7fd069; }
.mini.nay { border-color: #ef6461; color: #ef6461; }
.auto { display: flex; align-items: center; gap: 4px; }
@media (max-width: 760px) { .main { flex-direction: column; } .voice { width: 100%; border-right: none; border-bottom: 2px solid #2b2740; } .rightcol { width: 100%; border-left: none; border-top: 2px solid #2b2740; } .bossrail { width: 100%; border-left: none; border-top: 2px solid #2b2740; } }
`;
