/* The listening party state machine (server/music.js): pure logic tests.
   No websockets — a fake broadcast collects payloads, fake socks stand in
   for connections. oEmbed title fetches are fire-and-forget over the real
   network, so titles stay null here; that path is exercised live. */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMusic } from "../server/music.js";

const ID_A = "dQw4w9WgXcQ";
const ID_B = "aaaaaaaaaaa";
const ID_C = "bbbbbbbbbbb";

function setup() {
  const sent = [];
  const music = createMusic((p) => sent.push(p));
  const sock = (name) => (name ? { user: { name } } : {});
  return { sent, music, sock, last: () => sent[sent.length - 1] };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-25T12:00:00Z"));
  vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("listening party", () => {
  it("ignores non-music messages and malformed video ids", () => {
    const { music, sent, sock } = setup();
    expect(music.handle(sock("A"), { a: "retell" })).toBe(false);
    expect(music.handle(sock("A"), { a: "music", op: "play", videoId: "nope" })).toBe(true);
    expect(music.handle(sock("A"), { a: "music", op: "play", videoId: "x".repeat(40) })).toBe(true);
    expect(music.handle(sock("A"), { a: "music", op: "play", videoId: { evil: 1 } })).toBe(true);
    expect(sent.length).toBe(0);
    expect(music.payload().active).toBe(false);
  });

  it("play starts a party at the current epoch; queue appends", () => {
    const { music, sock, last } = setup();
    music.handle(sock("A"), { a: "music", op: "play", videoId: ID_A });
    let p = last();
    expect(p.active).toBe(true);
    expect(p.videoId).toBe(ID_A);
    expect(p.by).toBe("A");
    expect(p.epochStartMs).toBe(Date.now());
    music.handle(sock("B"), { a: "music", op: "queue", videoId: ID_B });
    p = last();
    expect(p.videoId).toBe(ID_A); // still playing the first
    expect(p.queue).toEqual([{ videoId: ID_B, title: null, by: "B" }]);
  });

  it("queue on an idle party starts playing instead", () => {
    const { music, sock, last } = setup();
    music.handle(sock("A"), { a: "music", op: "queue", videoId: ID_A });
    expect(last().videoId).toBe(ID_A);
    expect(last().queue).toEqual([]);
  });

  it("skip advances; skipping the last song ends the party", () => {
    const { music, sock, last } = setup();
    music.handle(sock("A"), { a: "music", op: "play", videoId: ID_A });
    music.handle(sock("A"), { a: "music", op: "queue", videoId: ID_B });
    music.handle(sock("A"), { a: "music", op: "skip" });
    expect(last().videoId).toBe(ID_B);
    expect(last().queue).toEqual([]);
    music.handle(sock("A"), { a: "music", op: "skip" });
    expect(last().active).toBe(false);
    expect(last().videoId).toBe(null);
  });

  it("pause freezes the position; resume rebases the epoch", () => {
    const { music, sock, last } = setup();
    music.handle(sock("A"), { a: "music", op: "play", videoId: ID_A });
    vi.advanceTimersByTime(30000);
    music.handle(sock("A"), { a: "music", op: "pause" });
    expect(last().paused).toBe(true);
    expect(last().pausedPosMs).toBe(30000);
    vi.advanceTimersByTime(60000); // a minute of silence
    music.handle(sock("A"), { a: "music", op: "resume" });
    const p = last();
    expect(p.paused).toBe(false);
    // the shared clock says we are 30s in, not 90s
    expect(Date.now() - p.epochStartMs).toBe(30000);
  });

  it("ended advances exactly once: stale and too-early reports are ignored", () => {
    const { music, sock, last, sent } = setup();
    music.handle(sock("A"), { a: "music", op: "play", videoId: ID_A });
    music.handle(sock("A"), { a: "music", op: "queue", videoId: ID_B });
    // too early (an instant troll report)
    music.handle(sock("B"), { a: "music", op: "ended", videoId: ID_A });
    expect(last().videoId).toBe(ID_A);
    vi.advanceTimersByTime(180000);
    const n = sent.length;
    music.handle(sock("A"), { a: "music", op: "ended", videoId: ID_A }); // first report wins
    music.handle(sock("B"), { a: "music", op: "ended", videoId: ID_A }); // stale, ignored
    music.handle(sock("C"), { a: "music", op: "ended", videoId: ID_A }); // stale, ignored
    expect(last().videoId).toBe(ID_B);
    expect(sent.length).toBe(n + 1); // exactly one advance broadcast
  });

  it("ended is ignored while paused", () => {
    const { music, sock, last } = setup();
    music.handle(sock("A"), { a: "music", op: "play", videoId: ID_A });
    vi.advanceTimersByTime(30000);
    music.handle(sock("A"), { a: "music", op: "pause" });
    music.handle(sock("B"), { a: "music", op: "ended", videoId: ID_A });
    expect(last().videoId).toBe(ID_A);
    expect(last().paused).toBe(true);
  });

  it("stop clears everything including the queue", () => {
    const { music, sock, last } = setup();
    music.handle(sock("A"), { a: "music", op: "play", videoId: ID_A });
    music.handle(sock("A"), { a: "music", op: "queue", videoId: ID_B });
    music.handle(sock("A"), { a: "music", op: "stop" });
    const p = last();
    expect(p.active).toBe(false);
    expect(p.queue).toEqual([]);
    expect(p.videoId).toBe(null);
  });

  it("listeners: join, leave, and socket drop; guests get a name", () => {
    const { music, sock, last } = setup();
    const a = sock("A"), guest = sock(null);
    music.handle(a, { a: "music", op: "join" });
    music.handle(guest, { a: "music", op: "join" });
    expect(last().listeners).toEqual(["A", "a guest"]);
    music.handle(a, { a: "music", op: "leave" });
    expect(last().listeners).toEqual(["a guest"]);
    music.drop(guest);
    expect(last().listeners).toEqual([]);
    const before = last();
    music.drop(guest); // dropping a non-listener broadcasts nothing
    expect(last()).toBe(before);
  });

  it("caps the queue at 50", () => {
    const { music, sock } = setup();
    music.handle(sock("A"), { a: "music", op: "play", videoId: ID_A });
    for (let i = 0; i < 60; i++) music.handle(sock("A"), { a: "music", op: "queue", videoId: ID_C });
    expect(music.payload().queue.length).toBe(50);
  });

  it("ops on a dead party are harmless", () => {
    const { music, sock, sent } = setup();
    for (const op of ["skip", "pause", "resume", "stop", "ended"]) {
      expect(music.handle(sock("A"), { a: "music", op })).toBe(true);
    }
    expect(sent.length).toBe(0);
  });
});
