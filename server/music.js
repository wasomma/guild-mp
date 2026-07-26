/* =====================================================================
   The Listening Party: synchronized YouTube playback for the guild.

   Deliberately OUTSIDE shared/sim.js and the snapshot: music is a
   multiplayer nicety like voting and presence, not game state. Nothing
   here persists, nothing touches SQLite, and the prototype never sees it.

   Model: one in-memory session per server. Clients send {a:"music", op}
   messages (handled in index.js before applyIntent); every change is
   broadcast as {type:"music", ...state, serverNow} so clients can align
   their players against the shared epoch clock. Positions use epoch ms
   because the snapshot's "now" is sim-seconds and freezes when the world
   sleeps — useless for wall-clock audio sync.

   Ops:
     play   {videoId}  start a party (or replace the current song)
     queue  {videoId}  append to the queue (starts the party if idle)
     skip              advance to the next queued song (or end if none)
     pause / resume    shared pause state
     stop              end the party for everyone
     join / leave      count me as a listener (client-local playback gate)
     ended  {videoId}  my player hit the end of the current song

   "ended" advances the queue exactly once: every listening client reports
   it, but only the first report matching the current videoId (and only
   after the song has plausibly been playing) wins; the rest see a stale
   videoId and are ignored. Ads on non-Premium viewers delay their report,
   which is fine — someone ad-free always finishes first.
   ===================================================================== */

const VIDEO_ID = /^[\w-]{11}$/;
const QUEUE_CAP = 50;
const MIN_PLAY_MS = 5000; // ignore "ended" reports younger than this

export function createMusic(broadcastFn) {
  const state = {
    active: false,
    videoId: null, // currently playing
    title: null,
    by: null, // display name of who started the current song
    epochStartMs: 0, // wall clock when position 0 played
    paused: false,
    pausedPosMs: 0, // position frozen at pause time
    queue: [], // [{videoId, title, by}]
  };
  const listeners = new Map(); // sock -> display name

  const nameOf = (sock) => (sock.user && sock.user.name) || "a guest";

  function payload() {
    return {
      type: "music",
      active: state.active,
      videoId: state.videoId,
      title: state.title,
      by: state.by,
      epochStartMs: state.epochStartMs,
      paused: state.paused,
      pausedPosMs: state.pausedPosMs,
      queue: state.queue.map((q) => ({ videoId: q.videoId, title: q.title, by: q.by })),
      listeners: [...listeners.values()],
      serverNow: Date.now(),
    };
  }
  const push = () => broadcastFn(payload());

  /* Titles come from YouTube's keyless oEmbed endpoint; a failure just
     leaves the video id showing. Never blocks the op that queued it. */
  function fetchTitle(videoId) {
    fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent("https://www.youtube.com/watch?v=" + videoId)}&format=json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j || !j.title) return;
        let dirty = false;
        if (state.videoId === videoId && !state.title) { state.title = j.title; dirty = true; }
        for (const q of state.queue) if (q.videoId === videoId && !q.title) { q.title = j.title; dirty = true; }
        if (dirty) push();
      })
      .catch(() => {});
  }

  function startSong(videoId, title, by) {
    state.active = true;
    state.videoId = videoId;
    state.title = title || null;
    state.by = by;
    state.epochStartMs = Date.now();
    state.paused = false;
    state.pausedPosMs = 0;
    if (!title) fetchTitle(videoId);
  }

  function advance() {
    const next = state.queue.shift();
    if (next) startSong(next.videoId, next.title, next.by);
    else stop();
  }

  function stop() {
    state.active = false;
    state.videoId = null;
    state.title = null;
    state.by = null;
    state.epochStartMs = 0;
    state.paused = false;
    state.pausedPosMs = 0;
    state.queue = [];
  }

  return {
    payload, // current state for freshly connected sockets

    /* returns true if the message was a music op (handled or not) */
    handle(sock, msg) {
      if (msg.a !== "music") return false;
      const op = msg.op;
      if (op === "join") {
        listeners.set(sock, nameOf(sock));
        push();
        return true;
      }
      if (op === "leave") {
        if (listeners.delete(sock)) push();
        return true;
      }
      if (op === "play" || op === "queue") {
        const id = typeof msg.videoId === "string" ? msg.videoId : "";
        if (!VIDEO_ID.test(id)) return true; // silently drop malformed ids
        console.log(`Music: ${nameOf(sock)} ${op} ${id}`);
        if (op === "play" || !state.active) {
          startSong(id, null, nameOf(sock));
        } else {
          if (state.queue.length >= QUEUE_CAP) return true;
          state.queue.push({ videoId: id, title: null, by: nameOf(sock) });
          fetchTitle(id);
        }
        push();
        return true;
      }
      if (!state.active) return true; // everything below acts on a live party
      if (op === "skip") {
        console.log(`Music: ${nameOf(sock)} skip (${state.videoId} -> ${state.queue[0] ? state.queue[0].videoId : "end"})`);
        advance();
        push();
      } else if (op === "pause") {
        if (!state.paused) {
          state.paused = true;
          state.pausedPosMs = Math.max(0, Date.now() - state.epochStartMs);
          push();
        }
      } else if (op === "resume") {
        if (state.paused) {
          state.paused = false;
          state.epochStartMs = Date.now() - state.pausedPosMs;
          state.pausedPosMs = 0;
          push();
        }
      } else if (op === "stop") {
        console.log(`Music: ${nameOf(sock)} stopped the party`);
        stop();
        push();
      } else if (op === "ended") {
        if (!state.paused && msg.videoId === state.videoId && Date.now() - state.epochStartMs > MIN_PLAY_MS) {
          console.log(`Music: ${state.videoId} ended (reported by ${nameOf(sock)}) -> ${state.queue[0] ? state.queue[0].videoId : "party over"}`);
          advance();
          push();
        }
      }
      return true;
    },

    /* socket closed: forget the listener */
    drop(sock) {
      if (listeners.delete(sock)) push();
    },
  };
}
