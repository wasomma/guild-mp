/* Rendering only. The view object mirrors the server snapshot plus
   client-local visual state: floaters, particles, shake, time. */
import {
  P, W, H, GROUND, CLASSES, HAIRS, OUTFITS, WEAPON_SKINS, CAPES, AURAS,
  ZONES, zoneOf, SKIN, SKIN_D, hexA, clamp, SLOTS,
} from "@shared/sim.js";

function px(ctx, ox, oy, x, y, w, h, c) {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(ox + x * P), Math.round(oy + y * P), w * P, h * P);
}

function getLayer(g, key) {
  if (!g[key]) { const c = document.createElement("canvas"); c.width = W; c.height = H; g[key] = c; }
  return g[key];
}

function drawRange(c, off, baseY, amp, wgap, color) {
  c.fillStyle = color;
  for (let i = -1; i < Math.ceil(W / wgap) + 2; i++) {
    const x = i * wgap - off;
    c.beginPath();
    c.moveTo(x, baseY);
    c.lineTo(x + wgap * 0.5, baseY - amp - ((i * 37) % 23));
    c.lineTo(x + wgap, baseY);
    c.fill();
  }
}

function drawScene(ctx, g) {
  const zone = zoneOf(g);
  const t = g.time;
  const bg = getLayer(g, "_bg"), b = bg.getContext("2d");
  b.clearRect(0, 0, W, H);
  const grad = b.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, zone.sky[0]); grad.addColorStop(0.55, zone.sky[1]); grad.addColorStop(1, zone.sky[2]);
  b.fillStyle = grad; b.fillRect(0, 0, W, H);
  const mg = b.createRadialGradient(552, 52, 4, 552, 52, 46);
  mg.addColorStop(0, `rgba(${zone.ray},0.85)`); mg.addColorStop(0.25, `rgba(${zone.ray},0.30)`); mg.addColorStop(1, `rgba(${zone.ray},0)`);
  b.fillStyle = mg; b.fillRect(500, 0, 110, 110);
  b.fillStyle = "#f4ecd0"; b.beginPath(); b.arc(552, 52, 11, 0, Math.PI * 2); b.fill();
  if (zone.ambient === "dust") {
    b.fillStyle = "rgba(230,235,255,0.8)";
    for (let i = 0; i < 26; i++) b.fillRect((i * 97.3) % W, (i * 53.7) % 120, (i % 3) === 0 ? 2 : 1, (i % 3) === 0 ? 2 : 1);
  }
  b.fillStyle = "rgba(255,255,255,0.10)";
  for (let i = 0; i < 4; i++) {
    const cx = ((i * 210 + t * 4) % (W + 140)) - 70;
    b.fillRect(cx, 36 + i * 22, 90 + i * 18, 8);
    b.fillRect(cx + 16, 30 + i * 22, 50, 8);
  }
  drawRange(b, (g.scroll * 0.12) % 190, 208, 66, 190, zone.far);
  const fog = b.createLinearGradient(0, 150, 0, 214);
  fog.addColorStop(0, `rgba(${zone.fogC},0)`); fog.addColorStop(1, `rgba(${zone.fogC},0.30)`);
  b.fillStyle = fog; b.fillRect(0, 150, W, 64);
  drawRange(b, (g.scroll * 0.22) % 150, 216, 88, 150, zone.near);
  ctx.save(); ctx.filter = "blur(2.2px)"; ctx.drawImage(bg, 0, 0); ctx.restore();

  const md = getLayer(g, "_mid"), mm = md.getContext("2d");
  mm.clearRect(0, 0, W, H);
  const off2 = (g.scroll * 0.55) % 150;
  for (let i = -1; i < 6; i++) {
    const x = i * 150 - off2 + 26;
    if (zone.enemy === "slime") {
      mm.fillStyle = "#33261d"; mm.fillRect(x + 11, 170, 7, 64);
      mm.fillStyle = zone.midDark; mm.fillRect(x - 10, 126, 48, 34);
      mm.fillStyle = zone.mid; mm.fillRect(x - 4, 112, 36, 30); mm.fillRect(x - 14, 140, 24, 18);
    } else if (zone.enemy === "bat") {
      mm.fillStyle = zone.midDark; mm.fillRect(x + 4, 96, 12, 138);
      mm.fillStyle = zone.mid; mm.fillRect(x + 4, 96, 4, 138);
      mm.fillStyle = zone.midDark; mm.fillRect(x - 26, 88, 70, 14);
      mm.fillStyle = zone.mid;
      for (let v = 0; v < 3; v++) mm.fillRect(x - 20 + v * 22, 102, 2, 26 + ((v * 13) % 18));
    } else if (zone.enemy === "skeleton") {
      mm.fillStyle = zone.mid; mm.fillRect(x + 6, 132, 16, 102);
      mm.fillStyle = zone.midDark; mm.fillRect(x + 6, 132, 5, 102);
      mm.fillStyle = zone.mid; mm.fillRect(x, 124, 28, 10); mm.fillRect(x + 2, 226, 24, 10);
      const cd = mm.createRadialGradient(x + 14, 120, 1, x + 14, 120, 13);
      cd.addColorStop(0, "rgba(255,190,110,0.7)"); cd.addColorStop(1, "rgba(255,190,110,0)");
      mm.fillStyle = cd; mm.fillRect(x + 1, 107, 26, 26);
      mm.fillStyle = "#ffdf9e"; mm.fillRect(x + 13, 118, 2, 4);
    } else {
      mm.fillStyle = zone.mid;
      mm.beginPath(); mm.moveTo(x - 6, 234); mm.lineTo(x + 10, 128); mm.lineTo(x + 26, 234); mm.fill();
      mm.fillStyle = zone.midDark;
      mm.beginPath(); mm.moveTo(x + 10, 128); mm.lineTo(x + 26, 234); mm.lineTo(x + 10, 234); mm.fill();
      const lg = mm.createRadialGradient(x + 10, 232, 1, x + 10, 232, 20);
      lg.addColorStop(0, "rgba(255,120,40,0.5)"); lg.addColorStop(1, "rgba(255,120,40,0)");
      mm.fillStyle = lg; mm.fillRect(x - 12, 212, 44, 26);
    }
  }
  ctx.save(); ctx.filter = "blur(1px)"; ctx.drawImage(md, 0, 0); ctx.restore();

  ctx.fillStyle = zone.top; ctx.fillRect(0, GROUND - 12, W, 5);
  ctx.fillStyle = zone.ground; ctx.fillRect(0, GROUND - 7, W, H - GROUND + 7);
  ctx.fillStyle = zone.band; ctx.fillRect(0, GROUND - 7, W, 12);
  ctx.fillStyle = "rgba(0,0,0,0.20)"; ctx.fillRect(0, GROUND + 18, W, H - GROUND - 18);
  const off3 = g.scroll % 46;
  for (let i = -1; i < 16; i++) {
    const dx = i * 46 - off3, dy = GROUND + 3 + (i % 3) * 8;
    if (zone.ambient === "ember") { ctx.fillStyle = "rgba(255,140,60,0.5)"; ctx.fillRect(dx, dy, 3, 2); }
    else if (zone.ambient === "dust") { ctx.fillStyle = "rgba(220,215,200,0.35)"; ctx.fillRect(dx, dy, 4, 2); }
    else { ctx.fillStyle = hexA(zone.top, 0.55); ctx.fillRect(dx, dy, 2, 4); ctx.fillRect(dx + 3, dy + 1, 2, 3); }
  }
  ctx.save(); ctx.globalCompositeOperation = "overlay";
  for (let i = 0; i < 3; i++) {
    const lx = (((i * 260 - g.scroll * 0.9) % (W + 160)) + W + 160) % (W + 160) - 80;
    const ly = GROUND + 8;
    const lg2 = ctx.createRadialGradient(lx, ly, 2, lx, ly, 60);
    lg2.addColorStop(0, `rgba(${zone.ray},0.35)`); lg2.addColorStop(1, `rgba(${zone.ray},0)`);
    ctx.fillStyle = lg2;
    ctx.save(); ctx.translate(lx, ly); ctx.scale(1, 0.35); ctx.translate(-lx, -ly);
    ctx.beginPath(); ctx.arc(lx, ly, 60, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  drawAmbient(ctx, g, zone);
}

function drawAmbient(ctx, g, zone) {
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 22; i++) {
    const sp = 4 + (i % 5) * 2.5;
    let x = (i * 151.7 + g.time * sp - g.scroll * (0.3 + (i % 3) * 0.18)) % (W + 30);
    if (x < 0) x += W + 30;
    x -= 15;
    let y, a, r;
    if (zone.ambient === "ember") {
      y = H - ((i * 61.3 + g.time * 26) % (H - 60)) - 20; a = 0.5; r = 1.5 + (i % 3);
    } else {
      y = 34 + ((i * 71.3) % (H - 90)) + Math.sin(g.time * 0.6 + i * 1.7) * 9;
      r = 1 + (i % 3) * 0.8;
      a = zone.ambient === "firefly" ? 0.22 + 0.34 * Math.max(0, Math.sin(g.time * 1.8 + i * 2.3)) : 0.30;
    }
    const gg = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
    gg.addColorStop(0, hexA(zone.amb, a)); gg.addColorStop(1, hexA(zone.amb, 0));
    ctx.fillStyle = gg; ctx.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
  }
  ctx.restore();
}

function drawForeground(ctx, g) {
  const zone = zoneOf(g);
  const fgc = getLayer(g, "_fg"), f = fgc.getContext("2d");
  f.clearRect(0, 0, W, H);
  f.globalCompositeOperation = "source-over";
  const off = (g.scroll * 1.7) % 120;
  f.fillStyle = zone.fg;
  for (let i = -1; i < 7; i++) {
    const x = i * 120 - off;
    for (let k = 0; k < 5; k++) {
      const bx = x + k * 9 + ((i * 13 + k * 7) % 6);
      const hgt = 16 + ((i * 17 + k * 29) % 18);
      f.beginPath(); f.moveTo(bx, H); f.lineTo(bx + 4, H - hgt); f.lineTo(bx + 8, H); f.fill();
    }
  }
  f.fillRect(0, H - 12, W, 12);
  f.globalCompositeOperation = "lighter";
  for (let i = 0; i < 6; i++) {
    const x = (((i * 197.7 + g.time * 7 - g.scroll * 0.9) % (W + 60)) + W + 60) % (W + 60) - 30;
    const y = H - 55 + ((i * 31) % 40) + Math.sin(g.time * 0.5 + i) * 6;
    const r = 6 + (i % 3) * 4;
    const gg = f.createRadialGradient(x, y, 0, x, y, r);
    gg.addColorStop(0, hexA(zone.amb, 0.34)); gg.addColorStop(1, hexA(zone.amb, 0));
    f.fillStyle = gg; f.beginPath(); f.arc(x, y, r, 0, Math.PI * 2); f.fill();
  }
  ctx.save(); ctx.filter = "blur(3px)"; ctx.drawImage(fgc, 0, 0); ctx.restore();
}

function drawLighting(ctx, g) {
  const zone = zoneOf(g);
  const t = g.time;
  ctx.save();
  ctx.filter = "blur(1.6px)";
  ctx.drawImage(ctx.canvas, 0, 0, W, 64, 0, 0, W, 64);
  ctx.drawImage(ctx.canvas, 0, H - 28, W, 28, 0, H - 28, W, 28);
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let i = 0; i < 3; i++) {
    const sway = Math.sin(t * 0.25 + i * 1.9) * 30;
    const x0 = 130 + i * 190 + sway;
    const a = Math.max(0.02, 0.055 + 0.03 * Math.sin(t * 0.5 + i * 2.1));
    const grd = ctx.createLinearGradient(x0, 0, x0 - 130, H);
    grd.addColorStop(0, `rgba(${zone.ray},${a})`);
    grd.addColorStop(1, `rgba(${zone.ray},0)`);
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.moveTo(x0, -10); ctx.lineTo(x0 + 46, -10); ctx.lineTo(x0 - 100, H); ctx.lineTo(x0 - 170, H);
    ctx.closePath(); ctx.fill();
  }
  ctx.globalCompositeOperation = "soft-light";
  const cg = ctx.createLinearGradient(0, 0, 0, H);
  cg.addColorStop(0, `rgba(${zone.gradeTop},0.55)`);
  cg.addColorStop(1, `rgba(${zone.gradeBot},0.45)`);
  ctx.fillStyle = cg; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = "source-over";
  const vg = ctx.createRadialGradient(W / 2, H * 0.42, H * 0.35, W / 2, H * 0.55, H * 0.95);
  vg.addColorStop(0, "rgba(8,6,18,0)"); vg.addColorStop(1, "rgba(8,6,18,0.50)");
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function drawShadow(ctx, x, y, w) {
  const sg = ctx.createRadialGradient(x, y, 1, x, y, w * 0.7);
  sg.addColorStop(0, "rgba(0,0,0,0.42)"); sg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.32); ctx.translate(-x, -y);
  ctx.fillStyle = sg;
  ctx.beginPath(); ctx.arc(x, y, w * 0.7, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function hpBar(ctx, x, y, w, ratio, color) {
  ctx.fillStyle = "#141221"; ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, 6);
  ctx.fillStyle = "#3a3550"; ctx.fillRect(x - w / 2, y, w, 4);
  ctx.fillStyle = color; ctx.fillRect(x - w / 2, y, Math.max(0, w * ratio), 4);
}

/* ===== high-detail character rendering on a 2px texel grid ===== */
const P2 = 2;
function px2(ctx, ox, oy, x, y, w, h, c) {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(ox + x * P2), Math.round(oy + y * P2), Math.round(w * P2), Math.round(h * P2));
}
function shade(hex, f) {
  if (typeof hex !== "string" || hex[0] !== "#") return hex;
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${ch((n >> 16) & 255)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}
const SKIN_L = "#f6d4a6";

function drawHat(ctx, ox, oy, hat, outfit, tint, hairC) {
  const oD = shade(outfit, 0.7), oL = shade(outfit, 1.28);
  if (hat === "helm") {
    px2(ctx, ox, oy, -5, -33, 10, 2, "#aeb7c9");
    px2(ctx, ox, oy, -6, -31, 12, 3, "#9aa3b5");
    px2(ctx, ox, oy, -6, -28, 2, 6, "#9aa3b5");
    px2(ctx, ox, oy, 4, -28, 2, 5, "#9aa3b5");
    px2(ctx, ox, oy, -4, -32, 4, 1, "#e3e8f2");
    px2(ctx, ox, oy, -6, -29, 12, 1, "#6f7890");
    px2(ctx, ox, oy, -1, -37, 2, 4, "#d0455a");
    px2(ctx, ox, oy, -2, -35, 1, 2, "#a83648");
  } else if (hat === "wizard") {
    px2(ctx, ox, oy, -10, -30, 20, 2, "#6a4a9e");
    px2(ctx, ox, oy, -10, -28, 20, 1, "#4e3675");
    px2(ctx, ox, oy, -6, -34, 12, 4, "#6a4a9e");
    px2(ctx, ox, oy, -3, -38, 7, 4, "#6a4a9e");
    px2(ctx, ox, oy, -1, -41, 4, 3, "#6a4a9e");
    px2(ctx, ox, oy, 1, -43, 3, 2, "#5a3f87");
    px2(ctx, ox, oy, -6, -34, 1, 4, "#8a6fe0");
    px2(ctx, ox, oy, -3, -38, 1, 4, "#8a6fe0");
    px2(ctx, ox, oy, -6, -31, 12, 1, "#8a6fe0");
    px2(ctx, ox, oy, 2, -36, 2, 2, "#f2c14e");
    px2(ctx, ox, oy, 3, -37, 1, 1, "#fff1c9");
  } else if (hat === "hood") {
    px2(ctx, ox, oy, -6, -32, 12, 3, outfit);
    px2(ctx, ox, oy, -7, -29, 2, 10, outfit);
    px2(ctx, ox, oy, 5, -29, 2, 6, outfit);
    px2(ctx, ox, oy, -5, -32, 4, 1, oL);
    px2(ctx, ox, oy, -4, -29, 9, 1, oD);
    px2(ctx, ox, oy, -9, -25, 2, 7, oD);
    px2(ctx, ox, oy, -8, -19, 2, 2, oD);
  } else if (hat === "crown") {
    px2(ctx, ox, oy, -5, -33, 10, 3, "#f2c14e");
    px2(ctx, ox, oy, -5, -31, 10, 1, "#c78a3b");
    px2(ctx, ox, oy, -5, -36, 2, 3, "#f2c14e");
    px2(ctx, ox, oy, -1, -37, 2, 4, "#f2c14e");
    px2(ctx, ox, oy, 3, -36, 2, 3, "#f2c14e");
    px2(ctx, ox, oy, -1, -37, 1, 1, "#fff1c9");
    px2(ctx, ox, oy, -4, -32, 1, 1, "#d0455a");
    px2(ctx, ox, oy, 0, -32, 2, 1, "#5aa9e6");
    px2(ctx, ox, oy, 4, -32, 1, 1, "#d0455a");
  } else if (hat === "horns") {
    px2(ctx, ox, oy, -7, -32, 2, 3, "#d0455a");
    px2(ctx, ox, oy, -9, -35, 2, 3, "#e77463");
    px2(ctx, ox, oy, -10, -37, 1, 2, "#f2a08c");
    px2(ctx, ox, oy, -8, -34, 1, 1, "#a83648");
    px2(ctx, ox, oy, 5, -32, 2, 3, "#d0455a");
    px2(ctx, ox, oy, 7, -35, 2, 3, "#e77463");
    px2(ctx, ox, oy, 9, -37, 1, 2, "#f2a08c");
    px2(ctx, ox, oy, 6, -34, 1, 1, "#a83648");
  } else if (hat === "halo") {
    px2(ctx, ox, oy, -4, -37, 8, 1, "#f7e28b");
    px2(ctx, ox, oy, -5, -36, 1, 1, "#f7e28b");
    px2(ctx, ox, oy, 4, -36, 1, 1, "#f7e28b");
    px2(ctx, ox, oy, -3, -38, 6, 1, "rgba(247,226,139,0.4)");
    px2(ctx, ox, oy, -3, -35, 6, 1, "rgba(247,226,139,0.4)");
  } else if (hat === "flower") {
    px2(ctx, ox, oy, -5, -31, 10, 1, "#3f6d4a");
    px2(ctx, ox, oy, -6, -32, 1, 1, "#5a8f5f");
    px2(ctx, ox, oy, 5, -32, 1, 1, "#5a8f5f");
    px2(ctx, ox, oy, -4, -33, 2, 2, "#e77fb3");
    px2(ctx, ox, oy, -4, -33, 1, 1, "#f2a8ce");
    px2(ctx, ox, oy, 0, -33, 2, 2, "#efeaff");
    px2(ctx, ox, oy, 0, -32, 1, 1, "#f2c14e");
    px2(ctx, ox, oy, 3, -32, 2, 2, "#f2c14e");
    px2(ctx, ox, oy, 4, -32, 1, 1, "#c78a3b");
  } else if (hat === "ribbon") {
    px2(ctx, ox, oy, 2, -34, 3, 3, "#e77fb3");
    px2(ctx, ox, oy, 6, -34, 3, 3, "#e77fb3");
    px2(ctx, ox, oy, 5, -33, 1, 2, "#c9506d");
    px2(ctx, ox, oy, 2, -34, 1, 1, "#f2a8ce");
    px2(ctx, ox, oy, 6, -34, 1, 1, "#f2a8ce");
    px2(ctx, ox, oy, 6, -31, 1, 3, "#e77fb3");
    px2(ctx, ox, oy, 8, -30, 1, 2, "#c9506d");
  } else if (hat === "witch") {
    px2(ctx, ox, oy, -12, -29, 24, 2, "#33304f");
    px2(ctx, ox, oy, -12, -27, 24, 1, "#242138");
    px2(ctx, ox, oy, -11, -30, 6, 1, "#4c4763");
    px2(ctx, ox, oy, -6, -33, 12, 4, "#33304f");
    px2(ctx, ox, oy, -3, -37, 7, 4, "#33304f");
    px2(ctx, ox, oy, -1, -40, 4, 3, "#33304f");
    px2(ctx, ox, oy, 1, -42, 4, 2, "#2b2740");
    px2(ctx, ox, oy, 4, -43, 2, 1, "#2b2740");
    px2(ctx, ox, oy, -6, -33, 1, 4, "#4c4763");
    px2(ctx, ox, oy, -6, -30, 12, 1, "#4c4763");
    px2(ctx, ox, oy, -1, -30, 3, 1, "#f2c14e");
    px2(ctx, ox, oy, 0, -30, 1, 1, "#7a6326");
  } else if (hat === "circlet") {
    px2(ctx, ox, oy, -5, -27, 10, 1, "#f2c14e");
    px2(ctx, ox, oy, 0, -27, 2, 1, "#8fe3ff");
    px2(ctx, ox, oy, -4, -27, 1, 1, "#fff1c9");
  } else if (hat === "catears") {
    const cc = hairC || "#3a3550", ccD = shade(cc, 0.7);
    px2(ctx, ox, oy, -6, -33, 3, 2, cc);
    px2(ctx, ox, oy, -5, -35, 2, 2, cc);
    px2(ctx, ox, oy, -4, -33, 1, 1, "#e77fb3");
    px2(ctx, ox, oy, -3, -33, 1, 2, ccD);
    px2(ctx, ox, oy, 3, -33, 3, 2, cc);
    px2(ctx, ox, oy, 4, -35, 2, 2, cc);
    px2(ctx, ox, oy, 4, -33, 1, 1, "#e77fb3");
    px2(ctx, ox, oy, 5, -33, 1, 2, ccD);
  }
}

function drawHair(ctx, ox, oy, style, c) {
  const cD = shade(c, 0.68), cL = shade(c, 1.3);
  /* base cap over the scalp */
  px2(ctx, ox, oy, -5, -31, 10, 2, c);
  px2(ctx, ox, oy, -6, -30, 2, 4, c);
  px2(ctx, ox, oy, -5, -29, 2, 2, cD);
  px2(ctx, ox, oy, -3, -31, 4, 1, cL);
  px2(ctx, ox, oy, 1, -29, 4, 1, c);       /* fringe over the brow */
  px2(ctx, ox, oy, 3, -28, 2, 1, cD);
  if (style === "short") {
    px2(ctx, ox, oy, -6, -27, 1, 4, c);
    px2(ctx, ox, oy, -6, -24, 1, 1, cD);
  } else if (style === "pixie") {
    px2(ctx, ox, oy, -6, -33, 2, 2, c);
    px2(ctx, ox, oy, -2, -33, 3, 2, cL);
    px2(ctx, ox, oy, 2, -33, 2, 2, c);
    px2(ctx, ox, oy, -4, -32, 2, 1, cD);
    px2(ctx, ox, oy, -6, -27, 1, 3, c);
  } else if (style === "bob") {
    px2(ctx, ox, oy, -7, -29, 2, 9, c);
    px2(ctx, ox, oy, 5, -29, 2, 9, c);
    px2(ctx, ox, oy, -6, -21, 2, 1, c);
    px2(ctx, ox, oy, 5, -21, 2, 1, c);
    px2(ctx, ox, oy, -6, -28, 1, 7, cD);
    px2(ctx, ox, oy, -7, -29, 1, 3, cL);
  } else if (style === "long") {
    px2(ctx, ox, oy, -8, -29, 3, 17, c);
    px2(ctx, ox, oy, -7, -12, 2, 2, c);
    px2(ctx, ox, oy, -6, -28, 1, 14, cD);
    px2(ctx, ox, oy, -8, -27, 1, 10, cL);
    px2(ctx, ox, oy, 5, -29, 2, 6, c);
    px2(ctx, ox, oy, 5, -23, 1, 2, cD);
  } else if (style === "pony") {
    px2(ctx, ox, oy, -8, -28, 2, 5, c);
    px2(ctx, ox, oy, -8, -27, 1, 1, "#f2c14e");
    px2(ctx, ox, oy, -11, -25, 3, 8, c);
    px2(ctx, ox, oy, -10, -17, 2, 3, c);
    px2(ctx, ox, oy, -9, -14, 1, 2, cD);
    px2(ctx, ox, oy, -11, -24, 1, 6, cL);
    px2(ctx, ox, oy, -9, -22, 1, 6, cD);
  } else if (style === "twin") {
    px2(ctx, ox, oy, -9, -27, 3, 9, c);
    px2(ctx, ox, oy, -10, -18, 2, 3, c);
    px2(ctx, ox, oy, -9, -28, 3, 1, "#f2c14e");
    px2(ctx, ox, oy, -9, -24, 1, 6, cL);
    px2(ctx, ox, oy, 7, -27, 3, 9, c);
    px2(ctx, ox, oy, 8, -18, 2, 3, c);
    px2(ctx, ox, oy, 7, -28, 3, 1, "#f2c14e");
    px2(ctx, ox, oy, 9, -24, 1, 6, cD);
  } else if (style === "bun") {
    px2(ctx, ox, oy, -9, -35, 4, 4, c);
    px2(ctx, ox, oy, -8, -36, 2, 1, c);
    px2(ctx, ox, oy, -8, -32, 3, 1, cD);
    px2(ctx, ox, oy, -9, -34, 1, 2, cL);
    px2(ctx, ox, oy, -6, -31, 2, 1, "#f2c14e");
  } else if (style === "braid") {
    px2(ctx, ox, oy, -8, -27, 3, 3, c);
    px2(ctx, ox, oy, -10, -24, 3, 3, cD);
    px2(ctx, ox, oy, -8, -21, 3, 3, c);
    px2(ctx, ox, oy, -10, -18, 3, 3, cD);
    px2(ctx, ox, oy, -8, -15, 3, 3, c);
    px2(ctx, ox, oy, -9, -12, 2, 2, cD);
    px2(ctx, ox, oy, -9, -10, 2, 1, "#f2c14e");
  }
}

function drawAccessory(ctx, ox, oy, acc) {
  if (acc === "earrings") {
    px2(ctx, ox, oy, -5, -23, 1, 1, "#f2c14e");
    px2(ctx, ox, oy, -5, -22, 1, 2, "#c78a3b");
    px2(ctx, ox, oy, -5, -20, 1, 1, "#d0455a");
  } else if (acc === "pendant") {
    px2(ctx, ox, oy, -3, -19, 1, 1, "#caa53d");
    px2(ctx, ox, oy, 2, -19, 1, 1, "#caa53d");
    px2(ctx, ox, oy, -2, -18, 4, 1, "#caa53d");
    px2(ctx, ox, oy, -1, -17, 2, 2, "#d0455a");
    px2(ctx, ox, oy, -1, -17, 1, 1, "#f2a0a8");
  } else if (acc === "scarf") {
    px2(ctx, ox, oy, -5, -20, 10, 2, "#c9506d");
    px2(ctx, ox, oy, -5, -18, 10, 1, "#93384a");
    px2(ctx, ox, oy, -7, -18, 2, 5, "#c9506d");
    px2(ctx, ox, oy, -6, -17, 1, 4, "#a84358");
    px2(ctx, ox, oy, -7, -13, 2, 1, "#93384a");
  } else if (acc === "warpaint") {
    px2(ctx, ox, oy, 0, -25, 2, 1, "rgba(208,69,90,0.8)");
    px2(ctx, ox, oy, 3, -25, 2, 1, "rgba(208,69,90,0.8)");
    px2(ctx, ox, oy, -1, -28, 4, 1, "rgba(208,69,90,0.8)");
  } else if (acc === "freckles") {
    px2(ctx, ox, oy, 0, -24, 1, 1, "rgba(150,90,60,0.85)");
    px2(ctx, ox, oy, 3, -24, 1, 1, "rgba(150,90,60,0.85)");
    px2(ctx, ox, oy, 2, -23, 1, 1, "rgba(150,90,60,0.7)");
    px2(ctx, ox, oy, 4, -23, 1, 1, "rgba(150,90,60,0.7)");
  }
}

function drawCape(ctx, ox, oy, capeId, t, walking) {
  if (!capeId || capeId === "none") return;
  const cape = CAPES.find((c) => c.id === capeId);
  if (!cape) return;
  const c = cape.c, cD = shade(c, 0.66), cL = shade(c, 1.25);
  const trim = cape.trim || cD;
  const sway = walking ? Math.sin(t * 9) * 2 : Math.sin(t * 2) * 0.8;
  const s1 = Math.round(sway * 0.5), s2 = Math.round(sway);
  px2(ctx, ox, oy, -6, -18, 2, 1, trim);                 /* shoulder clasp */
  px2(ctx, ox, oy, -5, -18, 1, 1, "#f2c14e");
  px2(ctx, ox, oy, -8, -17, 3, 13, c);                   /* inner panel */
  px2(ctx, ox, oy, -8, -17, 1, 4, cL);
  px2(ctx, ox, oy, -10 - s1, -15, 2, 11, c);             /* mid fold */
  px2(ctx, ox, oy, -9 - s1, -14, 1, 9, cD);
  px2(ctx, ox, oy, -12 - s2, -12, 2, 8, c);              /* outer fold */
  px2(ctx, ox, oy, -11 - s2, -11, 1, 6, cD);
  px2(ctx, ox, oy, -8, -5, 3, 1, trim);                  /* hem */
  px2(ctx, ox, oy, -10 - s1, -5, 2, 1, trim);
  px2(ctx, ox, oy, -12 - s2, -5, 2, 1, trim);
}

function drawPet(ctx, m, t) {
  const id = m.cos.pet;
  if (!id || id === "none") return;
  const bx = m.x - 20, by = m.y;
  const hover = Math.sin(t * 3 + m.seed) * 1.5;
  const f = m.walking ? Math.floor(t * 8 + m.seed) % 2 : 0;
  drawShadow(ctx, bx, by, 12);
  if (id === "wisp") {
    const yy = by - 24 + hover * 2;
    const gg = ctx.createRadialGradient(bx, yy, 1, bx, yy, 10);
    gg.addColorStop(0, "rgba(143,227,255,0.8)"); gg.addColorStop(1, "rgba(143,227,255,0)");
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = gg; ctx.fillRect(bx - 10, yy - 10, 20, 20);
    ctx.restore();
    px(ctx, bx, yy, -1, -1, 2, 2, "#eafaff");
  } else if (id === "slimelet") {
    const sq = Math.sin(t * 5 + m.seed);
    px(ctx, bx, by, -3, -4 + sq * 0.5, 6, 4 - sq * 0.5, "#6fbf5e");
    px(ctx, bx, by, -4, -2, 8, 2, "#6fbf5e");
    px(ctx, bx, by, -2, -3, 1, 1, "#26232b"); px(ctx, bx, by, 1, -3, 1, 1, "#26232b");
  } else if (id === "cat") {
    const c = "#7a7490";
    px(ctx, bx, by, -4, -4, 7, 3, c);
    px(ctx, bx, by, 2, -7, 4, 4, c);
    px(ctx, bx, by, 2, -8, 1, 1, c); px(ctx, bx, by, 5, -8, 1, 1, c);
    px(ctx, bx, by, 4, -6, 1, 1, "#f2c14e");
    px(ctx, bx, by, -5, -7 + Math.round(Math.sin(t * 4 + m.seed)), 1, 3, c);
    px(ctx, bx, by, -3, -1, 1, 1, c); px(ctx, bx, by, f ? 0 : 1, -1, 1, 1, c);
  } else if (id === "pup") {
    const c = "#8a6b48";
    px(ctx, bx, by, -4, -4, 7, 3, c);
    px(ctx, bx, by, 2, -7, 4, 4, c);
    px(ctx, bx, by, 5, -7, 1, 2, "#6b4a32");
    px(ctx, bx, by, 4, -6, 1, 1, "#26232b");
    px(ctx, bx, by, -5, -5 + Math.round(Math.sin(t * 12)), 2, 1, c);
    px(ctx, bx, by, -3, -1, 1, 1, c); px(ctx, bx, by, f ? 0 : 1, -1, 1, 1, c);
  } else if (id === "owl") {
    const yy = by - 22 + hover * 2;
    const fl = Math.floor(t * 6 + m.seed) % 2;
    const c = "#9a8f7a";
    px(ctx, bx, yy, -2, -5, 5, 6, c);
    px(ctx, bx, yy, fl ? -5 : -6, fl ? -6 : -3, 3, 2, c); px(ctx, bx, yy, fl ? 3 : 4, fl ? -6 : -3, 3, 2, c);
    px(ctx, bx, yy, -1, -4, 1, 1, "#f7e28b"); px(ctx, bx, yy, 1, -4, 1, 1, "#f7e28b");
    px(ctx, bx, yy, 0, -3, 1, 1, "#e8a13b");
  } else if (id === "drake") {
    const yy = by - 18 + hover * 2;
    const fl = Math.floor(t * 7 + m.seed) % 2;
    px(ctx, bx, yy, -3, -4, 7, 4, "#c9503f");
    px(ctx, bx, yy, 3, -6, 3, 3, "#e0654f");
    px(ctx, bx, yy, -5, -3, 2, 1, "#c9503f");
    px(ctx, bx, yy, fl ? -2 : -1, fl ? -8 : -6, 3, 3, "#8a2f24");
    px(ctx, bx, yy, 4, -5, 1, 1, "#f7e28b");
    if (Math.floor(t * 2 + m.seed) % 5 === 0) px(ctx, bx, yy, 7, -5, 1, 1, "#ff8a4a");
  }
}

function swingAngle(m, start, end, dur) {
  if (m.lunge <= 0) return start;
  const p = 1 - m.lunge / dur;
  return start + (end - start) * Math.sin(Math.min(1, p) * Math.PI * 0.5);
}

/* Warrior axe models: a distinct silhouette and material ramp per weapon skin.
   Drawn in hand-local space: the grip is at the origin, the haft runs up to
   about y=-30, and the head hangs off the +x side of its top. Poses: "rest"
   (held upright), "swing" (wide horizontal cleave), "back" (slung across the
   back, small). */
function drawWarriorAxe(ctx, wk, pose, t, seed) {
  const id = wk.id;
  const c = wk.c, cD = wk.cD || shade(wk.c, 0.55), cL = wk.cL || shade(wk.c, 1.3), edge = wk.edge || "#f2f6fc";
  const R = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
  const haft = id === "obsidian" ? "#3a3050" : id === "blood" ? "#4a3b2c" : id === "crystal" ? "#7f95ad" : "#6b4a32";
  const haftD = id === "obsidian" ? "#262038" : id === "blood" ? "#2e2517" : id === "crystal" ? "#5d7085" : "#513723";

  if (pose === "back") {
    R(-1, -18, 3, 18, haft); R(-1, -10, 3, 1, haftD);
    if (id === "gold") { R(-1, -14, 3, 1, "#f2c14e"); R(-1, -6, 3, 1, "#f2c14e"); }
    R(0, -24, 9, 8, cD); R(0, -23, 8, 6, c);
    if (id === "obsidian") { R(6, -24, 3, 2, cL); R(5, -20, 3, 2, cL); R(7, -22, 1, 1, edge); }
    else if (id === "blood") { R(6, -23, 2, 2, cL); R(6, -19, 2, 1, cL); R(7, -21, 1, 1, cD); R(5, -17, 3, 2, c); }
    else if (id === "crystal") { R(1, -22, 2, 3, "#ffffff"); R(3, -26, 2, 3, hexA(c, 0.8)); R(6, -22, 2, 5, hexA(edge, 0.8)); }
    else if (id === "gold") { R(-4, -22, 4, 5, cD); R(-3, -21, 2, 3, c); R(6, -22, 2, 5, cL); R(7, -21, 1, 3, edge); R(0, -21, 2, 2, "#d0455a"); }
    else { R(6, -23, 2, 6, cL); R(7, -22, 1, 4, edge); }
    R(1, -23, 6, 1, cL);
    return;
  }

  /* haft, shared by rest and swing */
  R(-2, -30, 4, 28, haft);
  R(-2, -24, 4, 1, haftD); R(-2, -16, 4, 1, haftD);
  R(-2, -8, 4, 5, haftD); R(-2, -7, 4, 1, shade(haft, 1.35)); R(-2, -5, 4, 1, shade(haft, 1.35));
  if (id === "gold") { R(-2, -26, 4, 1, "#f2c14e"); R(-2, -18, 4, 1, "#f2c14e"); R(-2, -3, 4, 2, "#f2c14e"); R(-2, -3, 1, 1, "#fff1c9"); }

  if (pose === "rest") {
    if (id === "steel") {
      R(-6, -31, 3, 3, "#7f8aa0"); R(-6, -31, 3, 1, "#aeb7c9");
      R(-3, -32, 6, 4, "#7f8aa0"); R(-3, -32, 6, 1, "#aeb7c9");
      R(-1, -36, 12, 13, cD);
      R(0, -35, 10, 11, c);
      R(4, -24, 6, 3, c); R(4, -22, 6, 1, cD);
      R(3, -33, 1, 8, cD);
      R(8, -35, 3, 11, cL); R(10, -33, 1, 8, edge);
      R(8, -24, 3, 2, cL); R(10, -23, 1, 2, edge);
      R(0, -33, 1, 1, "#6f7890"); R(0, -29, 1, 1, "#6f7890"); R(0, -25, 1, 1, "#6f7890");
    } else if (id === "gold") {
      R(-1, -40, 2, 4, "#f2c14e"); R(-1, -40, 1, 2, "#fff1c9");
      R(-7, -35, 6, 10, cD); R(-6, -34, 4, 8, c);
      R(-7, -34, 1, 8, cL); R(-7, -32, 1, 4, edge);
      R(1, -37, 10, 14, cD); R(2, -36, 8, 12, c);
      R(8, -36, 2, 12, cL); R(9, -33, 1, 6, edge);
      R(8, -36, 2, 2, cD); R(8, -26, 2, 2, cD);
      R(2, -31, 6, 1, shade(c, 0.75)); R(-6, -31, 3, 1, shade(c, 0.75));
      R(-1, -33, 3, 3, "#d0455a"); R(-1, -33, 1, 1, "#ff9fae"); R(-1, -31, 3, 1, "#8e2436");
    } else if (id === "obsidian") {
      ctx.fillStyle = "rgba(138,92,255,0.16)"; ctx.fillRect(-3, -40, 17, 18);
      R(1, -40, 3, 2, cD); R(2, -40, 1, 2, c);
      R(-1, -38, 12, 15, cD); R(0, -37, 10, 13, c);
      R(2, -35, 1, 3, cL); R(3, -32, 1, 3, cL); R(4, -29, 1, 3, cL);
      R(9, -37, 3, 3, cL); R(9, -32, 2, 3, cL); R(9, -27, 3, 3, cL);
      R(11, -36, 1, 1, edge); R(10, -31, 1, 1, edge); R(11, -26, 1, 1, edge);
      if (Math.sin(t * 5 + seed) > 0.3) R(10, -33, 1, 4, edge);
    } else if (id === "blood") {
      R(-3, -32, 6, 3, "#5b4a3a"); R(-3, -32, 6, 1, "#7a6248");
      R(-1, -34, 13, 11, cD); R(0, -33, 11, 9, c);
      R(9, -33, 2, 9, cL); R(10, -33, 1, 3, edge);
      R(9, -30, 3, 2, cD); R(9, -26, 3, 1, cD);
      R(6, -24, 5, 2, c); R(9, -23, 2, 2, c); R(10, -21, 1, 2, cD);
      R(6, -24, 4, 1, cL);
      R(2, -31, 1, 1, "#6e1f30"); R(5, -27, 2, 1, "#6e1f30"); R(3, -25, 1, 1, "#3a1810");
      R(1, -30, 2, 2, "#8e2436");
      const dp = (t * 5 + seed * 3) % 6;
      if (dp < 4) R(10, -20 + dp * 1.5, 1, 2, "#8e0f24");
    } else if (id === "crystal") {
      const pl = 0.12 + 0.07 * Math.sin(t * 3 + seed);
      ctx.fillStyle = `rgba(143,227,255,${pl})`; ctx.fillRect(-3, -42, 17, 21);
      R(-3, -32, 6, 3, haftD); R(-3, -32, 6, 1, "#9fb8cc");
      R(1, -42, 2, 4, hexA(c, 0.8)); R(4, -41, 2, 3, hexA(cL, 0.8)); R(7, -40, 2, 2, hexA(c, 0.7));
      R(-1, -39, 13, 16, hexA(c, 0.35));
      R(0, -38, 11, 14, hexA(c, 0.55));
      R(2, -37, 3, 5, hexA(cL, 0.7)); R(5, -33, 3, 5, hexA(cL, 0.7)); R(2, -29, 3, 4, hexA(cL, 0.6));
      R(3, -33, 2, 4, "#ffffff");
      R(10, -38, 1, 14, hexA("#ffffff", 0.8));
      const sp = Math.floor(t * 4 + seed) % 3;
      const spp = [[2, -36], [7, -31], [4, -26]][sp];
      R(spp[0] - 1, spp[1], 3, 1, "#ffffff"); R(spp[0], spp[1] - 1, 1, 3, "#ffffff");
    }
    if (id === "steel" || id === "gold") {
      const gp = ((t * 24 + seed * 37) % 110) / 10;
      if (gp < 3) {
        const gy = -35 + gp * 3.4;
        R(id === "gold" ? 8 : 9, gy, 2, 2, "rgba(255,255,255,0.85)");
        R(id === "gold" ? 7 : 8, gy + 1, 1, 1, "rgba(255,255,255,0.5)");
      }
    }
    return;
  }

  /* swing: the blade sweeps wide and horizontal */
  if (id === "crystal") {
    const pl = 0.1 + 0.06 * Math.sin(t * 3 + seed);
    ctx.fillStyle = `rgba(143,227,255,${pl})`; ctx.fillRect(-13, -39, 26, 15);
    R(-11, -37, 22, 11, hexA(c, 0.35));
    R(-10, -36, 20, 9, hexA(c, 0.55));
    R(-8, -35, 4, 6, hexA(cL, 0.7)); R(-1, -34, 4, 6, hexA(cL, 0.7)); R(6, -35, 4, 6, hexA(cL, 0.6));
    R(-2, -33, 3, 3, "#ffffff");
    R(-10, -28, 20, 1, hexA("#ffffff", 0.8));
    return;
  }
  R(-11, -37, 22, 11, cD);
  R(-10, -36, 20, 9, c);
  if (id === "steel") {
    R(-10, -36, 3, 9, cL); R(7, -36, 3, 9, cL);
    R(-10, -29, 20, 1, cL); R(-10, -28, 20, 1, edge);
    R(-1, -36, 2, 9, "#7f8aa0");
  } else if (id === "gold") {
    R(-10, -36, 2, 2, cD); R(8, -36, 2, 2, cD);
    R(-10, -30, 3, 3, cL); R(7, -30, 3, 3, cL);
    R(-10, -28, 20, 1, cL);
    R(-7, -36, 1, 8, shade(c, 0.75)); R(6, -36, 1, 8, shade(c, 0.75));
    R(-1, -34, 3, 3, "#d0455a"); R(-1, -34, 1, 1, "#ff9fae");
  } else if (id === "obsidian") {
    ctx.fillStyle = "rgba(138,92,255,0.16)"; ctx.fillRect(-12, -38, 24, 14);
    R(-8, -28, 3, 2, cL); R(-2, -28, 3, 2, cL); R(4, -28, 3, 2, cL); R(9, -28, 2, 2, cL);
    R(-7, -26, 1, 1, edge); R(-1, -26, 1, 1, edge); R(5, -26, 1, 1, edge);
    R(-6, -35, 1, 3, cL); R(0, -34, 1, 3, cL); R(6, -35, 1, 3, cL);
  } else if (id === "blood") {
    R(-11, -28, 3, 3, c); R(-12, -26, 2, 2, cD);
    R(-10, -28, 20, 1, cL);
    R(-4, -28, 3, 1, cD); R(3, -28, 3, 1, cD);
    R(-8, -33, 2, 1, "#6e1f30"); R(2, -31, 2, 1, "#6e1f30");
  }
}

/* Shared guard/fitting metals per weapon skin, used by every style's painter. */
const FITTINGS = {
  steel:    { m: "#9aa3b5", hi: "#e3e8f2" },
  gold:     { m: "#f2c14e", hi: "#fff1c9", gem: "#d0455a", gemHi: "#ff9fae" },
  obsidian: { m: "#3a3050", hi: "#8a77b8", gem: "#8a5cff", gemHi: "#cdbcff" },
  blood:    { m: "#5b3a2a", hi: "#7a6248", gem: "#8e0f24", gemHi: "#f27d8d" },
  crystal:  { m: "#9fb8cc", hi: "#d1f4ff", gem: "#ffffff", gemHi: "#ffffff" },
};
function wkRamp(wk) {
  return {
    id: wk.id, c: wk.c,
    cD: wk.cD || shade(wk.c, 0.55), cL: wk.cL || shade(wk.c, 1.3),
    edge: wk.edge || "#f2f6fc", F: FITTINGS[wk.id] || FITTINGS.steel,
    grip: wk.id === "obsidian" ? "#3a3050" : wk.id === "blood" ? "#4a3b2c" : wk.id === "crystal" ? "#7f95ad" : "#6b4a32",
    gripD: wk.id === "obsidian" ? "#262038" : wk.id === "blood" ? "#2e2517" : wk.id === "crystal" ? "#5d7085" : "#513723",
  };
}

/* Paladin longsword, hand-local rotated space: blade up to y=-38, guard at
   y=-8, grip below, pommel at the bottom. */
function drawPaladinBlade(ctx, wk, t, seed) {
  const { id, c, cD, cL, edge, F, grip, gripD } = wkRamp(wk);
  const R = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
  if (id === "obsidian") { ctx.fillStyle = "rgba(138,92,255,0.14)"; ctx.fillRect(-6, -40, 12, 36); }
  if (id === "crystal") {
    const pl = 0.1 + 0.06 * Math.sin(t * 3 + seed);
    ctx.fillStyle = `rgba(143,227,255,${pl})`; ctx.fillRect(-6, -41, 12, 37);
    R(-4, -36, 8, 30, hexA(c, 0.35));
    R(-3, -35, 6, 28, hexA(c, 0.55));
    R(-2, -38, 4, 3, hexA(cL, 0.7));
    R(-1, -33, 1, 22, "#ffffff");
    R(1, -35, 2, 28, hexA("#ffffff", 0.7));
    const sp = Math.floor(t * 4 + seed) % 3;
    const spy = [-32, -22, -14][sp];
    R(-1, spy, 3, 1, "#ffffff"); R(0, spy - 1, 1, 3, "#ffffff");
  } else {
    R(-4, -36, 8, 30, cD);
    R(-3, -35, 6, 28, c);
    R(-2, -38, 4, 3, c); R(-1, -38, 2, 2, cL);
    R(-1, -33, 1, 24, cD);
    R(1, -35, 2, 28, cL); R(2, -33, 1, 24, edge);
    if (id === "gold") { R(-3, -30, 4, 1, shade(c, 0.75)); R(-3, -22, 4, 1, shade(c, 0.75)); R(-3, -14, 4, 1, shade(c, 0.75)); }
    if (id === "obsidian") {
      R(1, -33, 2, 3, cL); R(1, -26, 2, 3, cL); R(1, -19, 2, 3, cL);
      R(3, -32, 1, 1, edge); R(3, -25, 1, 1, edge); R(3, -18, 1, 1, edge);
      if (Math.sin(t * 5 + seed) > 0.3) R(2, -29, 1, 5, edge);
    }
    if (id === "blood") {
      R(1, -28, 2, 2, cD); R(1, -18, 2, 2, cD);
      R(-2, -31, 1, 1, "#6e1f30"); R(0, -24, 1, 1, "#6e1f30"); R(-2, -16, 1, 1, "#3a1810");
      const dp = (t * 5 + seed * 3) % 7;
      if (dp < 4.5) R(-1, -38 + dp * 1.6, 1, 2, "#8e0f24");
    }
    if (id === "steel" || id === "gold") {
      const gp = ((t * 24 + seed * 37) % 120) / 10;
      if (gp < 3) R(1, -35 + gp * 8, 2, 2, "rgba(255,255,255,0.85)");
    }
  }
  R(-8, -8, 16, 4, F.m); R(-8, -8, 16, 1, F.hi); R(-8, -5, 16, 1, shade(F.m, 0.6));
  if (id === "gold") { R(-9, -10, 3, 3, F.m); R(6, -10, 3, 3, F.m); R(-9, -10, 1, 1, F.hi); R(8, -10, 1, 1, F.hi); }
  if (F.gem) { R(-1, -7, 2, 2, F.gem); R(-1, -7, 1, 1, F.gemHi); } else { R(-1, -7, 2, 2, "#d0455a"); }
  R(-2, -4, 4, 9, grip);
  R(-2, -1, 4, 1, gripD); R(-2, 2, 4, 1, gripD);
  R(-3, 5, 6, 3, F.m); R(-3, 5, 6, 1, F.hi);
  if (F.gem && id !== "steel") R(-1, 6, 2, 1, F.gem);
}

/* Rogue dagger, hand-local rotated space; front daggers are a touch longer
   and carry the living effects. */
function drawRogueDagger(ctx, wk, front, t, seed) {
  const { id, c, cD, cL, edge, F } = wkRamp(wk);
  const R = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
  const top = front ? -17 : -15, bh = front ? 14 : 12, ih = bh - 2;
  if (id === "crystal") {
    const pl = 0.1 + 0.05 * Math.sin(t * 3.5 + seed);
    ctx.fillStyle = `rgba(143,227,255,${pl})`; ctx.fillRect(-4.5, top - 2, 9, bh + 4);
    R(-2.5, top, 5, bh, hexA(c, 0.35));
    R(-1.5, top + 1, 3, ih, hexA(c, 0.6));
    R(0, top + 1, 1.5, ih, hexA("#ffffff", 0.75));
    R(-0.5, top + 3, 1, 3, "#ffffff");
    if (front) { const sp = Math.floor(t * 5 + seed) % 2; R(-1, top + 3 + sp * 6, 3, 1, "#ffffff"); }
  } else {
    R(-2.5, top, 5, bh, cD);
    R(-1.5, top + 1, 3, ih, c);
    R(0, top + 1, 1.5, ih, cL);
    R(0.5, top + 2, 1, ih - 2, edge);
    if (id === "gold") R(-1.5, top + 4, 1, ih - 6, shade(c, 0.75));
    if (id === "obsidian") {
      R(0, top + 2, 1.5, 2, cL); R(0, top + 6, 1.5, 2, cL);
      if (front && Math.sin(t * 5 + seed) > 0.35) R(1, top + 3, 0.8, 4, edge);
    }
    if (id === "blood") {
      R(0, top + 5, 1.5, 1.5, cD); R(-1.5, top + 3, 1, 1, "#6e1f30");
      if (front) { const dp = (t * 6 + seed * 3) % 5; if (dp < 3) R(-0.5, top + dp * 1.4, 1, 1.6, "#8e0f24"); }
    }
    if ((id === "steel" || id === "gold") && front) {
      const gp = ((t * 26 + seed * 31) % 100) / 10;
      if (gp < 2.5) R(0, top + 2 + gp * 3.6, 1.2, 1.6, "rgba(255,255,255,0.85)");
    }
  }
  R(front ? -4 : -3.5, front ? -5 : -4, front ? 8 : 7, front ? 3 : 2, F.m);
  R(front ? -4 : -3.5, front ? -5 : -4, front ? 8 : 7, 1, F.hi);
  R(-1.5, -2, 3, front ? 7 : 6, id === "obsidian" ? "#262038" : id === "blood" ? "#2e2517" : "#26232b");
  if (front) { R(-1.5, 0, 3, 1, "#3a3550"); R(-1.5, 3, 3, 1, "#3a3550"); }
  if (F.gem && front) { R(-1, 4.5, 2, 2, F.gem); R(-1, 4.5, 1, 1, F.gemHi); }
}

/* Archer bow, absolute coords centered on (bx, by) with radius r. The string
   and nocked arrow stay with the caller (they track draw progress). */
function drawArcherBow(ctx, wk, bx, by, r, t, seed) {
  const { id, c, cD, cL, edge, F } = wkRamp(wk);
  const R = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
  if (id === "crystal") {
    const pl = 0.1 + 0.05 * Math.sin(t * 3 + seed);
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = `rgba(143,227,255,${pl + 0.15})`; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(bx, by, r, -Math.PI / 2, Math.PI / 2); ctx.stroke();
    ctx.restore();
  }
  ctx.strokeStyle = cD; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(bx, by, r, -Math.PI / 2, Math.PI / 2); ctx.stroke();
  ctx.strokeStyle = id === "crystal" ? hexA(c, 0.75) : c; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(bx, by, r, -Math.PI / 2, Math.PI / 2); ctx.stroke();
  ctx.strokeStyle = cL; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(bx - 1, by, r, -Math.PI / 2 + 0.35, Math.PI / 2 - 0.35); ctx.stroke();
  R(bx - 2, by - r - 3, 4, 4, c); R(bx - 2, by + r - 1, 4, 4, c);
  if (id === "steel") { R(bx - 2, by - r - 3, 4, 1, cL); R(bx - 2, by + r - 1, 4, 1, cL); }
  else if (id === "gold") {
    R(bx - 1, by - r - 5, 2, 2, F.m); R(bx - 1, by + r + 3, 2, 2, F.m);
    R(bx - 1, by - r - 5, 1, 1, F.hi); R(bx - 1, by + r + 3, 1, 1, F.hi);
  } else if (id === "obsidian") {
    R(bx + 1, by - r - 5, 2, 3, cD); R(bx + 1, by + r + 2, 2, 3, cD);
    R(bx + 2, by - r - 4, 1, 1, cL); R(bx + 2, by + r + 3, 1, 1, cL);
    if (Math.sin(t * 5 + seed) > 0.35) R(bx + 2, by - r - 5, 1, 2, edge);
  } else if (id === "blood") {
    R(bx - 2, by - r + 2, 4, 1, "#2e2517"); R(bx - 2, by + r - 3, 4, 1, "#2e2517");
    const dp = (t * 5 + seed * 3) % 7;
    if (dp < 4) R(bx, by + r + 3 + dp, 1, 2, "#8e0f24");
  } else if (id === "crystal") {
    R(bx - 2, by - r - 3, 4, 1, "#ffffff"); R(bx - 2, by + r + 2, 4, 1, "#ffffff");
  }
  R(bx - 2, by - 2, 3, 5, F.m); R(bx - 2, by - 2, 3, 1, F.hi);
  if (F.gem) { R(bx - 1, by, 2, 2, F.gem); R(bx - 1, by, 1, 1, F.gemHi); }
  if (id === "steel" || id === "gold") {
    const gp = ((t * 20 + seed * 29) % 90) / 10;
    if (gp < 3) {
      const a = -Math.PI / 2 + (gp / 3) * Math.PI;
      R(bx + Math.cos(a) * r - 1, by + Math.sin(a) * r - 1, 2, 2, "rgba(255,255,255,0.85)");
    }
  } else if (id === "crystal") {
    const sp = Math.floor(t * 4 + seed) % 3;
    const a = -Math.PI / 2 + (sp + 0.5) * (Math.PI / 3);
    R(bx + Math.cos(a) * r, by + Math.sin(a) * r, 1.5, 1.5, "#ffffff");
  }
}

/* Chainblade head. mode "held": local to the hand, resting at the hip.
   mode "tip": local to the flying whip tip, rotated by the caller. */
function drawChainBlade(ctx, wk, mode, t, seed) {
  const { id, c, cD, cL, edge, F } = wkRamp(wk);
  const R = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
  if (mode === "tip") {
    if (id === "crystal") {
      R(-3, -4, 12, 8, hexA(c, 0.4)); R(-2, -3, 10, 6, hexA(c, 0.6));
      R(6, -3, 2, 6, hexA("#ffffff", 0.8)); R(8, -5, 2, 3, hexA(cL, 0.8));
      R(1, -2, 3, 2, "#ffffff");
    } else {
      R(-3, -4, 12, 8, cD); R(-2, -3, 10, 6, c);
      R(6, -3, 2, 6, cL); R(7, -2, 1, 4, edge); R(8, -5, 2, 3, c);
      if (id === "gold") R(0, -2, 2, 2, F.gem);
      if (id === "obsidian") { R(4, -4, 2, 1, cL); R(4, 2, 2, 1, cL); }
      if (id === "blood") R(2, 2, 2, 1, "#6e1f30");
    }
    return;
  }
  if (id === "crystal") {
    const pl = 0.1 + 0.05 * Math.sin(t * 3 + seed);
    ctx.fillStyle = `rgba(143,227,255,${pl})`; ctx.fillRect(0, -9, 16, 13);
    R(1, -3, 12, 6, hexA(c, 0.4)); R(2, -2, 10, 4, hexA(c, 0.6));
    R(2, -2, 10, 1, hexA("#ffffff", 0.7)); R(10, -6, 3, 7, hexA(cL, 0.75));
    R(5, -1, 3, 2, "#ffffff");
    if (Math.floor(t * 5 + seed) % 2) R(11, -7, 1, 3, "#ffffff");
  } else {
    R(1, -3, 12, 6, cD); R(2, -2, 10, 4, c); R(2, -2, 10, 1, cL);
    R(10, -6, 3, 7, c); R(12, -8, 2, 3, cD);
    R(10, -6, 1, 6, cL); R(11, -5, 1, 4, edge);
    if (id === "gold") { R(4, -2, 1, 4, F.hi); R(6, -1, 2, 2, F.gem); R(6, -1, 1, 1, F.gemHi); }
    if (id === "obsidian") { R(8, -7, 2, 2, cL); if (Math.sin(t * 5 + seed) > 0.35) R(11, -5, 1, 4, edge); }
    if (id === "blood") {
      R(5, 2, 2, 1, "#6e1f30"); R(8, -2, 1, 1, "#3a1810");
      const dp = (t * 6 + seed * 3) % 6;
      if (dp < 3.5) R(12, 1 + dp, 1, 1.6, "#8e0f24");
    }
    if (id === "steel" || id === "gold") {
      const gp = ((t * 24 + seed * 33) % 100) / 10;
      if (gp < 2.5) R(3 + gp * 3, -2, 1.6, 1.4, "rgba(255,255,255,0.85)");
    }
  }
}

/* Mystic staff, drawn on the px2 grid at (ox, oy) like the caller's body. */
function drawMysticStaff(ctx, wk, ox, oy, casting, t, seed) {
  const { id, c, cD, cL, edge, F } = wkRamp(wk);
  const shaft = id === "obsidian" ? "#3a3050" : id === "blood" ? "#4a3b2c" : id === "crystal" ? "#7f95ad" : "#6b4a32";
  const shaftD = id === "obsidian" ? "#262038" : id === "blood" ? "#2e2517" : id === "crystal" ? "#5d7085" : "#513723";
  px2(ctx, ox, oy, 9, -36, 1.5, 26, shaft);
  px2(ctx, ox, oy, 9, -30, 1.5, 1, shaftD);
  px2(ctx, ox, oy, 9, -20, 1.5, 1, shaftD);
  px2(ctx, ox, oy, 7.5, -38, 4.5, 2, F.m);
  px2(ctx, ox, oy, 6, -41, 1.5, 4, F.m);
  px2(ctx, ox, oy, 12, -41, 1.5, 4, F.m);
  px2(ctx, ox, oy, 6, -42, 1, 1, F.hi);
  px2(ctx, ox, oy, 12.5, -42, 1, 1, F.hi);
  if (id === "gold") px2(ctx, ox, oy, 7.5, -38.5, 4.5, 0.8, shade(c, 0.75));
  if (id === "obsidian") { px2(ctx, ox, oy, 5, -40, 1, 1, cL); px2(ctx, ox, oy, 13.5, -40, 1, 1, cL); }
  const glow = casting ? 1 : 0.6 + Math.sin(t * 4 + seed) * 0.3;
  if (id === "crystal") {
    px2(ctx, ox, oy, 7.5, -42, 4.5, 4.5, hexA(c, 0.6));
    px2(ctx, ox, oy, 8, -44, 1.5, 2, hexA(cL, 0.8));
    px2(ctx, ox, oy, 10.5, -43.5, 1, 1.5, hexA(c, 0.7));
    px2(ctx, ox, oy, 8.5, -41, 1.5, 1.5, "#ffffff");
  } else {
    px2(ctx, ox, oy, 7.5, -42, 4.5, 4.5, c);
    px2(ctx, ox, oy, 7.5, -42, 4.5, 1, cL);
    px2(ctx, ox, oy, 8.5, -41, 1.5, 1.5, "#ffffff");
    if (id === "obsidian" && Math.sin(t * 5 + seed) > 0.3) px2(ctx, ox, oy, 11, -42, 1, 1, edge);
    if (id === "blood") { const dp = (t * 5 + seed * 3) % 7; if (dp < 4) px2(ctx, ox, oy, 9.5, -37.5 + dp, 0.8, 1, "#8e0f24"); }
  }
  ctx.fillStyle = `rgba(255,255,255,${glow * 0.45})`;
  const pad = casting ? 3 : 0;
  ctx.fillRect(ox + 15 - pad, oy - 84 - pad, 9 + pad * 2, 9 + pad * 2);
  if (id === "crystal" && Math.floor(t * 4 + seed) % 2) {
    ctx.fillStyle = "#ffffff"; ctx.fillRect(ox + 14 + ((seed * 7) % 1) * 8, oy - 88, 2, 2);
  }
}

export function drawAdventurer(ctx, m, t) {
  if (m.feast) { drawFeaster(ctx, m, t); return; }
  drawPet(ctx, m, t);
  let oy = m.y;
  if (m.alive && !m.walking && m.lunge <= 0) oy += Math.round(Math.sin(t * 2.5 + m.seed) * 1.4);
  if (m.hop > 0) oy -= Math.round(Math.abs(Math.sin(((0.7 - m.hop) / 0.7) * Math.PI * 2)) * 6);
  const ox = m.x + (m.lunge > 0 ? Math.sin(((0.25 - m.lunge) / 0.25) * Math.PI) * 13 : 0);

  if (!m.alive) {
    drawShadow(ctx, m.x, m.y, 26);
    px2(ctx, m.x, m.y, -6, -13, 12, 13, "#7a7490");
    px2(ctx, m.x, m.y, -5, -15, 10, 2, "#7a7490");
    px2(ctx, m.x, m.y, -4, -16, 8, 1, "#8d87a3");
    px2(ctx, m.x, m.y, -6, -13, 1, 13, "#8d87a3");
    px2(ctx, m.x, m.y, 4, -13, 2, 13, "#5f5a75");
    px2(ctx, m.x, m.y, -1, -12, 2, 7, "#4c4763");
    px2(ctx, m.x, m.y, -3, -10, 6, 2, "#4c4763");
    px2(ctx, m.x, m.y, 2, -7, 1, 1, "#4c4763");
    px2(ctx, m.x, m.y, 3, -6, 1, 2, "#4c4763");
    px2(ctx, m.x, m.y, -6, -2, 3, 2, "#5a8f5f");
    px2(ctx, m.x, m.y, -4, -14, 3, 1, "#5a8f5f");
    px2(ctx, m.x, m.y, -8, 0, 2, 1, "#4d8f45");
    px2(ctx, m.x, m.y, 6, 0, 2, 1, "#4d8f45");
    hpBar(ctx, m.x, m.y - 46, 26, 0, "#7fd069");
    return;
  }

  const f = m.walking ? Math.floor(t * 8 + m.seed) % 2 : 0;
  const hair = HAIRS[m.cos.hair].c;
  const outfit = OUTFITS[m.cos.outfit].c;
  const wskin = WEAPON_SKINS.find((w) => w.id === m.cos.weapon);
  const tint = wskin.c;
  const sty = m.style;
  const oD = shade(outfit, 0.7), oL = shade(outfit, 1.28);
  const tintD = shade(tint, 0.55);
  const fem = m.cos.body === "f";
  const hx = ox + 8 * P2, hy = oy - 13 * P2;

  drawShadow(ctx, ox, oy, 26);
  if (m.cos.aura !== "none") {
    const auraDef = AURAS.find((a) => a.id === m.cos.aura);
    if (auraDef && auraDef.c) {
      const pl = 0.16 + 0.08 * Math.sin(t * 3 + m.seed);
      const ag = ctx.createRadialGradient(ox, oy, 2, ox, oy, 20);
      ag.addColorStop(0, hexA(auraDef.c, pl)); ag.addColorStop(1, hexA(auraDef.c, 0));
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      ctx.translate(ox, oy); ctx.scale(1, 0.35); ctx.translate(-ox, -oy);
      ctx.fillStyle = ag; ctx.beginPath(); ctx.arc(ox, oy, 20, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  /* chainblade whip, behind the body */
  if (sty === "chain" && m.chainT > 0 && m.chainTgt) {
    const dur = 0.34;
    const prog = 1 - m.chainT / dur;
    const HND = { x: hx, y: hy };
    const TGT = { x: m.chainTgt.x, y: m.chainTgt.y };
    const APEX = { x: (HND.x + TGT.x) / 2, y: Math.min(HND.y, TGT.y) - 62 };
    const qp = (a, b, c, tt) => ({
      x: (1 - tt) * (1 - tt) * a.x + 2 * (1 - tt) * tt * b.x + tt * tt * c.x,
      y: (1 - tt) * (1 - tt) * a.y + 2 * (1 - tt) * tt * b.y + tt * tt * c.y,
    });
    let tip, ta;
    if (prog <= 0.5) {
      const s = Math.min(1, prog / 0.5);
      tip = qp(HND, APEX, TGT, s);
      const ahead = qp(HND, APEX, TGT, Math.min(1, s + 0.05));
      ta = Math.atan2(ahead.y - tip.y, ahead.x - tip.x);
      const t0 = Math.max(0, s - 0.35);
      ctx.strokeStyle = "rgba(255,255,255,0.28)"; ctx.lineWidth = 3;
      ctx.beginPath();
      const first = qp(HND, APEX, TGT, t0);
      ctx.moveTo(first.x, first.y);
      for (let k = t0 + 0.06; k <= s; k += 0.06) { const pt = qp(HND, APEX, TGT, k); ctx.lineTo(pt.x, pt.y); }
      ctx.lineTo(tip.x, tip.y);
      ctx.stroke();
    } else {
      const r = (prog - 0.5) / 0.5;
      const rr = r * r;
      tip = { x: TGT.x + (HND.x - TGT.x) * rr, y: TGT.y + (HND.y - TGT.y) * rr };
      ta = Math.atan2(tip.y - HND.y, tip.x - HND.x);
    }
    const bow = prog <= 0.5 ? 26 + 20 * (prog / 0.5) : -8 + 18 * (1 - (prog - 0.5) / 0.5);
    const MID = { x: (HND.x + tip.x) / 2, y: Math.min(HND.y, tip.y) - bow };
    const dist = Math.hypot(tip.x - HND.x, tip.y - HND.y);
    const links = Math.max(2, Math.floor(dist / 8));
    for (let i = 1; i <= links; i++) {
      const pt = qp(HND, MID, tip, i / links);
      ctx.fillStyle = i % 2 ? "#9aa3b5" : "#6f7890";
      ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
      if (i % 2) { ctx.fillStyle = "#c6cddb"; ctx.fillRect(pt.x - 2, pt.y - 2, 2, 2); }
    }
    ctx.save(); ctx.translate(tip.x, tip.y); ctx.rotate(ta);
    drawChainBlade(ctx, wskin, "tip", t, m.seed);
    ctx.restore();
  }

  drawCape(ctx, ox, oy, m.cos.cape, t, m.walking);

  /* back arm (behind the torso) */
  const armSw = m.walking ? (f ? 1 : 0) : 0;
  const backSleeve = sty === "paladin" ? "#7f8aa0" : sty === "warrior" ? SKIN_D : sty === "mystic" ? outfit : oD;
  px2(ctx, ox, oy, -7, -17, 2, 5, backSleeve);
  px2(ctx, ox, oy, -7, -12 + armSw, 2, 2, SKIN);

  /* back-mounted gear, behind the torso */
  if (sty === "archer") {
    px2(ctx, ox, oy, -11, -23, 3, 9, "#6b4a32");
    px2(ctx, ox, oy, -11, -23, 3, 1, "#8a6b48");
    px2(ctx, ox, oy, -11, -22, 1, 8, "#513723");
    px2(ctx, ox, oy, -10, -27, 1, 4, "#a3835c");
    px2(ctx, ox, oy, -9, -28, 1, 5, "#a3835c");
    px2(ctx, ox, oy, -8, -27, 1, 4, "#a3835c");
    px2(ctx, ox, oy, -10, -28, 1, 1, tint);
    px2(ctx, ox, oy, -9, -30, 1, 2, "#d0455a");
    px2(ctx, ox, oy, -8, -28, 1, 1, "#e8e2d0");
  }
  if (sty === "warrior") {
    ctx.save(); ctx.translate(ox - 8, oy - 26); ctx.rotate(-2.3);
    drawWarriorAxe(ctx, wskin, "back", t, m.seed);
    ctx.restore();
  }

  /* legs and boots (the mystic robe covers them) */
  if (sty !== "mystic") {
    const pants = "#3a3550", pantsD = "#2a2740", boot = "#4a3b2c", bootL = "#5d4a36", sole = "#26232b";
    const legB = m.walking && f ? 1 : 0;
    const legF = m.walking && !f ? 1 : 0;
    px2(ctx, ox, oy, -4, -8, 3, 5 - legB, pants);
    px2(ctx, ox, oy, -2, -8, 1, 5 - legB, pantsD);
    px2(ctx, ox, oy, -4, -3 - legB, 3, 3, boot);
    px2(ctx, ox, oy, -4, -3 - legB, 3, 1, bootL);
    px2(ctx, ox, oy, -4, -1 - legB, 4, 1, sole);
    px2(ctx, ox, oy, 1, -8, 3, 5 - legF, pants);
    px2(ctx, ox, oy, 3, -8, 1, 5 - legF, pantsD);
    px2(ctx, ox, oy, 1, -3 - legF, 3, 3, boot);
    px2(ctx, ox, oy, 1, -3 - legF, 3, 1, bootL);
    px2(ctx, ox, oy, 1, -1 - legF, 4, 1, sole);
  }

  /* torso per fighting style */
  if (sty === "paladin") {
    const pl = "#9aa3b5", plL = "#c6cddb", plD = "#6f7890";
    px2(ctx, ox, oy, -6, -19, 12, 8, pl);
    px2(ctx, ox, oy, -5, -19, 10, 1, plL);
    px2(ctx, ox, oy, -6, -19, 1, 8, plD);
    px2(ctx, ox, oy, -4, -15, 9, 1, plD);
    px2(ctx, ox, oy, -2, -19, 4, 10, outfit);
    px2(ctx, ox, oy, -3, -19, 1, 10, "#f2c14e");
    px2(ctx, ox, oy, 2, -19, 1, 10, "#f2c14e");
    px2(ctx, ox, oy, -2, -9, 4, 1, oD);
    px2(ctx, ox, oy, -1, -16, 2, 2, oL);
    px2(ctx, ox, oy, -9, -20, 4, 2, plL);
    px2(ctx, ox, oy, -9, -18, 4, 3, pl);
    px2(ctx, ox, oy, -9, -16, 4, 1, plD);
    px2(ctx, ox, oy, -8, -19, 1, 1, "#f2c14e");
  } else if (sty === "warrior") {
    px2(ctx, ox, oy, -6, -19, 12, 8, SKIN);
    px2(ctx, ox, oy, -5, -19, 10, 1, SKIN_L);
    px2(ctx, ox, oy, -6, -19, 1, 8, SKIN_D);
    px2(ctx, ox, oy, -4, -16, 9, 1, SKIN_D);
    px2(ctx, ox, oy, -1, -14, 1, 3, SKIN_D);
    px2(ctx, ox, oy, -3, -13, 2, 1, SKIN_D);
    px2(ctx, ox, oy, 1, -13, 2, 1, SKIN_D);
    for (let i = 0; i < 6; i++) px2(ctx, ox, oy, -6 + i * 2, -19 + i * 1.5, 2, 1.5, outfit);
    px2(ctx, ox, oy, -10, -22, 6, 4, "#6b4a32");
    px2(ctx, ox, oy, -10, -23, 1, 1, "#8a6b48");
    px2(ctx, ox, oy, -8, -24, 1, 2, "#8a6b48");
    px2(ctx, ox, oy, -6, -23, 1, 1, "#8a6b48");
    px2(ctx, ox, oy, -9, -21, 1, 1, "#a3835c");
    px2(ctx, ox, oy, -7, -22, 1, 1, "#a3835c");
    px2(ctx, ox, oy, 5, -14, 3, 2, "#8a6b48");
  } else if (sty === "archer") {
    px2(ctx, ox, oy, -6, -19, 12, 8, outfit);
    px2(ctx, ox, oy, -5, -19, 10, 1, oL);
    px2(ctx, ox, oy, -6, -19, 1, 8, oD);
    px2(ctx, ox, oy, 0, -18, 1, 5, oD);
    px2(ctx, ox, oy, -1, -17, 1, 1, oD);
    px2(ctx, ox, oy, 1, -16, 1, 1, oD);
    px2(ctx, ox, oy, -6, -12, 12, 1, oD);
    for (let i = 0; i < 5; i++) px2(ctx, ox, oy, 4 - i * 2, -19 + i * 2, 2, 2, "#513723");
  } else if (sty === "rogue") {
    px2(ctx, ox, oy, -6, -19, 12, 8, outfit);
    px2(ctx, ox, oy, -5, -19, 10, 1, oL);
    px2(ctx, ox, oy, -6, -19, 1, 8, oD);
    px2(ctx, ox, oy, -2, -19, 2, 3, oD);
    px2(ctx, ox, oy, 1, -19, 2, 3, oD);
    px2(ctx, ox, oy, 0, -19, 1, 2, SKIN_D);
    for (let i = 0; i < 6; i++) px2(ctx, ox, oy, -5 + i * 2, -18 + i * 1.5, 2, 1.5, "#26232b");
    px2(ctx, ox, oy, -1, -15, 2, 2, "#9aa3b5");
    px2(ctx, ox, oy, -4, -9, 3, 2, "#4a3b2c");
    px2(ctx, ox, oy, -4, -9, 3, 1, "#5d4a36");
    px2(ctx, ox, oy, 2, -9, 2, 2, "#4a3b2c");
    px2(ctx, ox, oy, 5, -20, 4, 2, oD);
  } else if (sty === "chain") {
    px2(ctx, ox, oy, -6, -19, 12, 8, outfit);
    px2(ctx, ox, oy, -5, -19, 10, 1, oL);
    px2(ctx, ox, oy, -6, -19, 1, 8, oD);
    px2(ctx, ox, oy, -5, -18, 10, 1, "#9aa3b5");
    px2(ctx, ox, oy, -5, -15, 10, 1, "#9aa3b5");
    px2(ctx, ox, oy, -5, -12, 10, 1, "#9aa3b5");
    px2(ctx, ox, oy, -5, -18, 1, 1, "#6f7890");
    px2(ctx, ox, oy, 4, -15, 1, 1, "#6f7890");
    px2(ctx, ox, oy, -5, -12, 1, 1, "#6f7890");
    px2(ctx, ox, oy, -1, -15, 2, 1, "#f2c14e");
    px2(ctx, ox, oy, -9, -20, 4, 3, oD);
    px2(ctx, ox, oy, 5, -21, 4, 2, "#c6cddb");
    px2(ctx, ox, oy, 5, -19, 4, 2, "#9aa3b5");
    px2(ctx, ox, oy, 5, -17, 4, 1, "#6f7890");
    px2(ctx, ox, oy, -7, -10, 3, 3, "#9aa3b5");
    px2(ctx, ox, oy, -6, -9, 1, 1, "#6f7890");
  } else {
    /* mystic robe */
    px2(ctx, ox, oy, -5, -19, 10, 7, outfit);
    px2(ctx, ox, oy, -4, -19, 8, 1, oL);
    px2(ctx, ox, oy, -5, -19, 1, 7, oD);
    px2(ctx, ox, oy, -1, -19, 2, 7, "#f2c14e");
    px2(ctx, ox, oy, -2, -19, 1, 7, "#c78a3b");
    px2(ctx, ox, oy, -5, -12, 10, 2, "#f2c14e");
    px2(ctx, ox, oy, 3, -12, 2, 3, "#c78a3b");
    px2(ctx, ox, oy, -6, -10, 12, 4, outfit);
    px2(ctx, ox, oy, -7, -6, 14, 6, outfit);
    px2(ctx, ox, oy, -3, -10, 1, 10, oD);
    px2(ctx, ox, oy, 2, -9, 1, 9, oD);
    px2(ctx, ox, oy, -7, -6, 1, 6, oD);
    px2(ctx, ox, oy, 6, -9, 1, 9, oL);
    px2(ctx, ox, oy, -7, -1, 14, 1, "#f2c14e");
    px2(ctx, ox, oy, -4, -3, 1, 1, "#efeaff");
    px2(ctx, ox, oy, 0, -3, 1, 1, "#efeaff");
    px2(ctx, ox, oy, 4, -3, 1, 1, "#efeaff");
  }

  /* belt (mystic wears a sash instead) */
  if (sty !== "mystic") {
    px2(ctx, ox, oy, -5, -11, 10, 2, "#26232b");
    px2(ctx, ox, oy, 0, -11, 2, 2, "#f2c14e");
    px2(ctx, ox, oy, 0, -10, 1, 1, "#8a6b26");
  }

  /* body silhouette: masc breadth vs fem taper */
  if (!fem) {
    const padC = sty === "warrior" ? SKIN_D : oD;
    const padL = sty === "warrior" ? SKIN : oL;
    px2(ctx, ox, oy, -7.5, -19, 2, 3, padC);
    px2(ctx, ox, oy, 5.5, -19, 2, 3, padC);
    px2(ctx, ox, oy, -7.5, -19, 2, 1, padL);
    px2(ctx, ox, oy, 5.5, -19, 2, 1, padL);
  } else {
    if (sty === "warrior") {
      px2(ctx, ox, oy, -6, -18.5, 12, 3, outfit);
      px2(ctx, ox, oy, -6, -18.5, 12, 1, oL);
      px2(ctx, ox, oy, -6, -16.5, 12, 1, oD);
    }
    const side = shade(sty === "warrior" ? SKIN : outfit, 0.5);
    px2(ctx, ox, oy, -6, -15.5, 1.5, 3, side);
    px2(ctx, ox, oy, 4.5, -15.5, 1.5, 3, side);
    px2(ctx, ox, oy, -5, -13, 1, 2, "rgba(16,14,26,0.30)");
    px2(ctx, ox, oy, 4, -13, 1, 2, "rgba(16,14,26,0.30)");
    if (sty !== "mystic") {
      px2(ctx, ox, oy, -5.5, -12.5, 11, 0.5, oL);
      px2(ctx, ox, oy, -5.5, -12, 11, 1, oD);
    }
    px2(ctx, ox, oy, -3, -18.5, 2, 1, oL);
    px2(ctx, ox, oy, 1.5, -18.5, 2, 1, oL);
  }

  /* earned gear rendered on the body: armor tiers on the shoulders and chest */
  const grA = m.gear && m.gear.armor;
  if (grA) {
    const gtier = grA.unique ? 5 : ["common", "uncommon", "rare", "epic", "legendary"].indexOf((grA.rarity && grA.rarity.id) || "common");
    const grc = grA.unique ? "#a8f2e2" : (grA.rarity && grA.rarity.color) || "#b6b3c7";
    if (gtier >= 1) {
      px2(ctx, ox, oy, -8, -20, 3, 2.5, "#8b95a8");
      px2(ctx, ox, oy, -8, -20, 3, 1, "#c6cddb");
      px2(ctx, ox, oy, -8, -18, 3, 0.5, "#6f7890");
    }
    if (gtier >= 2) {
      px2(ctx, ox, oy, 5, -20, 3, 2.5, "#8b95a8");
      px2(ctx, ox, oy, 5, -20, 3, 1, "#c6cddb");
      px2(ctx, ox, oy, 5, -18, 3, 0.5, "#6f7890");
      px2(ctx, ox, oy, -8, -20, 3, 0.5, grc);
      px2(ctx, ox, oy, 5, -20, 3, 0.5, grc);
    }
    if (gtier >= 3) {
      px2(ctx, ox, oy, -3.5, -17.5, 7, 2.5, "#9aa3b5");
      px2(ctx, ox, oy, -3.5, -17.5, 7, 1, "#c6cddb");
      px2(ctx, ox, oy, -3.5, -15.5, 7, 0.5, "#6f7890");
      px2(ctx, ox, oy, -0.5, -17, 1.5, 1.5, grc);
    }
    if (gtier >= 4) {
      px2(ctx, ox, oy, -8, -20.5, 3, 0.5, grA.unique ? "#a8f2e2" : "#f2a94e");
      px2(ctx, ox, oy, 5, -20.5, 3, 0.5, grA.unique ? "#a8f2e2" : "#f2a94e");
      const gpl = 0.12 + 0.08 * Math.sin(t * 3.2 + m.seed);
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = hexA(grA.unique ? "#a8f2e2" : "#f2a94e", gpl);
      ctx.fillRect(ox - 17, oy - 42, 34, 12);
      ctx.restore();
    }
  }

  /* head and face */
  px2(ctx, ox, oy, -4, -31, 8, 1, SKIN);
  px2(ctx, ox, oy, -5, -30, 10, 9, SKIN);
  px2(ctx, ox, oy, -4, -21, 8, 1, SKIN_D);
  px2(ctx, ox, oy, -3, -31, 6, 1, SKIN_L);
  px2(ctx, ox, oy, -5, -29, 1, 8, SKIN_D);
  px2(ctx, ox, oy, -4, -22, 8, 1, SKIN_D);
  px2(ctx, ox, oy, -5, -26, 2, 3, SKIN);
  px2(ctx, ox, oy, -4, -25, 1, 1, SKIN_D);
  px2(ctx, ox, oy, -1, -20, 4, 1, SKIN_D);
  const browC = shade(hair, 0.6);
  px2(ctx, ox, oy, 0, -27, 2, 1, browC);
  px2(ctx, ox, oy, 3, -27, 2, 1, browC);
  if (!fem) {
    px2(ctx, ox, oy, -0.5, -27.5, 3, 1, browC);
    px2(ctx, ox, oy, 2.5, -27.5, 3, 1, browC);
    px2(ctx, ox, oy, -4.5, -26, 1, 3, shade(hair, 0.8));
    px2(ctx, ox, oy, -4, -21.5, 1, 1, SKIN_D);
    px2(ctx, ox, oy, 3.5, -21.5, 1, 1, SKIN_D);
  } else {
    px2(ctx, ox, oy, -1, -26.5, 1, 1, "#2b2436");
    px2(ctx, ox, oy, 5, -26.5, 1, 1, "#2b2436");
  }
  px2(ctx, ox, oy, 0, -26, 2, 2, "#f7f4ff");
  px2(ctx, ox, oy, 3, -26, 2, 2, "#f7f4ff");
  px2(ctx, ox, oy, 1, -26, 1, 2, "#2b2436");
  px2(ctx, ox, oy, 4, -26, 1, 2, "#2b2436");
  px2(ctx, ox, oy, 5, -24, 1, 2, SKIN_D);
  if (fem) {
    px2(ctx, ox, oy, 1, -22, 3, 1, "#c96a7a");
    px2(ctx, ox, oy, 2, -22, 1, 1, "#a84f60");
    px2(ctx, ox, oy, -1, -23, 1, 1, "rgba(224,122,110,0.5)");
    px2(ctx, ox, oy, 4, -23, 1, 1, "rgba(224,122,110,0.5)");
  } else {
    px2(ctx, ox, oy, 1, -22, 3, 1, "#8a5a44");
  }
  if (sty === "warrior") {
    px2(ctx, ox, oy, 0, -25, 2, 1, "rgba(208,69,90,0.75)");
    px2(ctx, ox, oy, 3, -25, 2, 1, "rgba(208,69,90,0.75)");
  }
  drawHair(ctx, ox, oy, m.cos.hairstyle, hair);

  /* trinket charm at the throat, and the weapon-quality glow at the hand */
  const grT = m.gear && m.gear.trinket;
  if (grT) {
    const trc = grT.unique ? "#a8f2e2" : (grT.rarity && grT.rarity.color) || "#b6b3c7";
    px2(ctx, ox, oy, -1, -20, 3, 0.5, "#513723");
    px2(ctx, ox, oy, -0.5, -19.5, 1.5, 1.5, trc);
    if (grT.unique || (grT.rarity && (grT.rarity.id === "epic" || grT.rarity.id === "legendary"))) px2(ctx, ox, oy, -0.5, -19.5, 0.5, 0.5, "#ffffff");
  }
  const grW = m.gear && m.gear.weapon;
  if (grW && (grW.unique || (grW.rarity && (grW.rarity.id === "rare" || grW.rarity.id === "epic" || grW.rarity.id === "legendary")))) {
    const wrc = grW.unique ? "#a8f2e2" : grW.rarity.color;
    const wpl = 0.1 + 0.06 * Math.sin(t * 3.6 + m.seed * 2);
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    const wg = ctx.createRadialGradient(hx, hy, 1, hx, hy, 14);
    wg.addColorStop(0, hexA(wrc, wpl + 0.12));
    wg.addColorStop(1, hexA(wrc, 0));
    ctx.fillStyle = wg; ctx.beginPath(); ctx.arc(hx, hy, 14, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  /* weapons and the near arm */
  if (sty === "paladin") {
    px2(ctx, ox, oy, 4, -16, 3, 3, "#7f8aa0");
    px2(ctx, ox, oy, 5, -14, 3, 3, SKIN);
    const ang = m.lunge > 0 ? swingAngle(m, -1.7, 1.3, 0.25) : 0.45;
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(ang);
    drawPaladinBlade(ctx, wskin, t, m.seed);
    ctx.restore();
    if (m.lunge > 0.05) {
      ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(hx, hy, 27, ang - 1.0, ang - 0.1); ctx.stroke();
    }
    px2(ctx, ox, oy, 7, -19, 5, 9, "#aeb7c9");
    px2(ctx, ox, oy, 7, -19, 5, 1, "#e3e8f2");
    px2(ctx, ox, oy, 7, -18, 1, 8, "#6f7890");
    px2(ctx, ox, oy, 8, -10, 4, 2, "#aeb7c9");
    px2(ctx, ox, oy, 9, -8, 2, 1, "#6f7890");
    px2(ctx, ox, oy, 9, -15, 2, 2, "#f2c14e");
    if (m.ultT > 0 && m.ultTgt) {
      const ua = Math.min(1, m.ultT / 0.7);
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      const bw = 16 + 10 * (1 - ua);
      const lg = ctx.createLinearGradient(0, 0, 0, m.ultTgt.y);
      lg.addColorStop(0, "rgba(255,241,201,0)");
      lg.addColorStop(0.25, `rgba(255,241,201,${0.5 * ua})`);
      lg.addColorStop(1, `rgba(242,193,78,${0.75 * ua})`);
      ctx.fillStyle = lg;
      ctx.fillRect(m.ultTgt.x - bw / 2, 0, bw, m.ultTgt.y);
      ctx.restore();
    }
  } else if (sty === "warrior") {
    px2(ctx, ox, oy, 5, -16, 2, 3, SKIN);
    const ang = m.lunge > 0 ? swingAngle(m, -2.1, 1.4, 0.25) : 0.6;
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(ang);
    drawWarriorAxe(ctx, wskin, m.swing ? "swing" : "rest", t, m.seed);
    ctx.restore();
    if (m.lunge > 0.05) {
      ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(hx, hy, 30, ang - 1.1, ang - 0.15); ctx.stroke();
    }
    if (m.ultT > 0) {
      const spin = (0.55 - m.ultT) * 25;
      ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(ox, oy - 26, 30, spin, spin + 2.2); ctx.stroke();
      ctx.beginPath(); ctx.arc(ox, oy - 26, 22, spin + Math.PI, spin + Math.PI + 2.2); ctx.stroke();
    }
  } else if (sty === "archer") {
    px2(ctx, ox, oy, 5, -18, 2, 4, SKIN);
    px2(ctx, ox, oy, 5, -16, 3, 3, "#6b4a32");
    px2(ctx, ox, oy, 6, -15, 1, 1, "#9aa3b5");
    const bx = ox + 12 * P2, by = oy - 16 * P2, r = 17;
    const pull = m.shootT > 0 ? 0 : clamp(1 - m.atkT / Math.max(0.4, m._st ? m._st.spd : 1), 0, 1);
    drawArcherBow(ctx, wskin, bx, by, r, t, m.seed);
    ctx.strokeStyle = "#e8e2d0"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(bx, by - r); ctx.lineTo(bx - pull * 9, by); ctx.lineTo(bx, by + r); ctx.stroke();
    if (pull > 0.35) {
      ctx.fillStyle = "#8a6b48"; ctx.fillRect(bx - pull * 9, by - 1, 15 + pull * 9, 2);
      ctx.fillStyle = "#d0455a"; ctx.fillRect(bx - pull * 9 - 2, by - 3, 3, 2); ctx.fillRect(bx - pull * 9 - 2, by + 1, 3, 2);
      ctx.fillStyle = tint; ctx.fillRect(bx + 15, by - 2, 5, 4);
    }
  } else if (sty === "rogue") {
    px2(ctx, ox, oy, 4, -16, 3, 3, oD);
    px2(ctx, ox, oy, 5, -14, 3, 3, SKIN);
    const aF = m.lunge > 0 && m.swing ? swingAngle(m, -0.6, 1.2, 0.2) : 0.7;
    const aB = m.lunge > 0 && !m.swing ? swingAngle(m, 2.2, 0.6, 0.2) : 2.6;
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(aF);
    drawRogueDagger(ctx, wskin, true, t, m.seed);
    ctx.restore();
    ctx.save(); ctx.translate(ox - 7 * P2, oy - 13 * P2); ctx.rotate(aB);
    drawRogueDagger(ctx, wskin, false, t, m.seed);
    ctx.restore();
    if (m.lunge > 0.08) {
      ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 3; ctx.beginPath();
      if (m.swing) { ctx.moveTo(ox + 18, oy - 44); ctx.lineTo(ox + 34, oy - 24); }
      else { ctx.moveTo(ox + 18, oy - 24); ctx.lineTo(ox + 34, oy - 44); }
      ctx.stroke();
    }
    if (m.ultT > 0 && m.ultTgt) {
      const uk = Math.floor(t * 24) % 3;
      ctx.strokeStyle = "rgba(220,190,255,0.85)"; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(m.ultTgt.x - 16 + uk * 6, m.ultTgt.y - 16);
      ctx.lineTo(m.ultTgt.x + 16 - uk * 4, m.ultTgt.y + 14);
      ctx.moveTo(m.ultTgt.x + 14 - uk * 5, m.ultTgt.y - 15);
      ctx.lineTo(m.ultTgt.x - 15 + uk * 5, m.ultTgt.y + 13);
      ctx.stroke();
    }
  } else if (sty === "chain") {
    px2(ctx, ox, oy, 4, -16, 3, 3, oD);
    px2(ctx, ox, oy, 5, -14, 3, 3, "#9aa3b5");
    px2(ctx, ox, oy, 7, -13, 1, 1, "#c6cddb");
    if (m.chainT <= 0) {
      ctx.save(); ctx.translate(hx, hy);
      drawChainBlade(ctx, wskin, "held", t, m.seed);
      ctx.restore();
    }
    if (m.ultT > 0 && m.ultTgts) {
      for (const tg of m.ultTgts) {
        const links = Math.max(2, Math.floor(Math.hypot(tg.x - hx, tg.y - hy) / 10));
        for (let i = 1; i <= links; i++) {
          const lx = hx + ((tg.x - hx) * i) / links;
          const ly = hy + ((tg.y - hy) * i) / links + Math.sin(i * 1.3 + t * 20) * 2;
          ctx.fillStyle = i % 2 ? "#9aa3b5" : "#6f7890";
          ctx.fillRect(lx - 2, ly - 2, 4, 4);
        }
      }
    }
  } else {
    /* mystic staff */
    const casting = m.castT > 0;
    px2(ctx, ox, oy, 4, -17, 2, 3, outfit);
    if (casting) px2(ctx, ox, oy, 5, -19, 2, 5, SKIN); else px2(ctx, ox, oy, 5, -15, 2, 4, SKIN);
    drawMysticStaff(ctx, wskin, ox, oy, casting, t, m.seed);
    if (m.ultT > 0) {
      const ua = Math.min(1, m.ultT / 0.8);
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = `rgba(159,232,140,${0.7 * ua})`; ctx.lineWidth = 3;
      ctx.translate(ox, oy); ctx.scale(1, 0.35);
      ctx.beginPath(); ctx.arc(0, 0, 60 * (1.3 - ua), 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      const lg2 = ctx.createLinearGradient(0, 0, 0, oy);
      lg2.addColorStop(0, "rgba(255,241,201,0)");
      lg2.addColorStop(1, `rgba(159,232,140,${0.4 * ua})`);
      ctx.fillStyle = lg2; ctx.fillRect(ox - 20, 0, 40, oy);
      ctx.restore();
    }
  }

  drawHat(ctx, ox, oy, m.cos.hat, outfit, tint, hair);
  drawAccessory(ctx, ox, oy, m.cos.accessory);
  px2(ctx, ox, oy, -4, -31, 8, 1, "rgba(255,232,190,0.4)");
  px2(ctx, ox, oy, 3, -30, 1, 4, "rgba(255,232,190,0.3)");
  px2(ctx, ox, oy, 4, -19, 1, 6, "rgba(255,232,190,0.2)");
  px2(ctx, ox, oy, -6, -18, 1, 9, "rgba(15,12,45,0.32)");
  if (m.gear && SLOTS.some((sl) => m.gear[sl] && m.gear[sl].unique)) {
    const tw = Math.floor(t * 7 + m.seed * 3) % 5;
    if (tw < 2) {
      const sxp = ox + (tw ? 14 : -10) + Math.sin(t * 3 + m.seed) * 3;
      const syp = oy - 30 - (tw ? 14 : 4);
      ctx.fillStyle = "#a8f2e2";
      ctx.fillRect(sxp - 1, syp, 3, 1);
      ctx.fillRect(sxp, syp - 1, 1, 3);
    }
  }
  if (m.noBars) return; /* inspect portraits draw the sprite without HUD */
  hpBar(ctx, ox, oy - 72, 26, m.hp / Math.max(1, m._st ? m._st.hp : m.hp), CLASSES[m.cls].color);
  if (m.ult != null) {
    const uw = 26, ur = clamp(m.ult, 0, 1);
    ctx.fillStyle = "#141221"; ctx.fillRect(ox - uw / 2 - 1, oy - 65, uw + 2, 4);
    ctx.fillStyle = "#3a3550"; ctx.fillRect(ox - uw / 2, oy - 64, uw, 2);
    ctx.fillStyle = ur >= 1 ? (Math.floor(t * 6) % 2 ? "#fff1c9" : "#f2c14e") : "#c78a3b";
    ctx.fillRect(ox - uw / 2, oy - 64, uw * ur, 2);
  }
  if (m.bubble > 0) {
    ctx.fillStyle = "#efeaff"; ctx.fillRect(ox + 10, oy - 106, 26, 15);
    ctx.fillRect(ox + 12, oy - 91, 6, 4);
    ctx.fillStyle = "#33304f";
    for (let i = 0; i < 3; i++) ctx.fillRect(ox + 14 + i * 7, oy - 101, 4, 4);
  }
}

function drawEnemy(ctx, e, t) {
  if (e.hp <= 0) return;
  const s = e.scale || 1;
  const ox = e.x - (e.lunge > 0 ? Math.sin(((0.22 - e.lunge) / 0.22) * Math.PI) * 12 : 0)
           + (e.hitT > 0 ? (e.hitT / 0.15) * 5 : 0)
           + (e.enraged ? Math.sin(t * 30 + e.seed) * 1.2 : 0);
  let oy = e.y;
  if (e.slamT > 0) oy -= Math.round(Math.sin(Math.min(1, (0.45 - e.slamT) / 0.45) * Math.PI) * 34);
  drawShadow(ctx, e.x, e.y, 26 * s);
  if (e.cleaveWind > 0) {
    const cwMax = e.elite ? 0.5 : 0.4;
    const p = clamp(1 - e.cleaveWind / cwMax, 0, 1);
    const rr = (16 + 46 * p) * s;
    ctx.save();
    ctx.translate(e.x, e.y); ctx.scale(1, 0.35); ctx.translate(-e.x, -e.y);
    ctx.globalCompositeOperation = "lighter";
    const rg = ctx.createRadialGradient(e.x, e.y, 2, e.x, e.y, rr);
    rg.addColorStop(0, `rgba(255,120,50,${0.05 + 0.14 * p})`);
    rg.addColorStop(0.7, `rgba(255,150,60,${0.04 + 0.1 * p})`);
    rg.addColorStop(1, "rgba(255,150,60,0)");
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(e.x, e.y, rr, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(255,${Math.round(170 - 90 * p)},70,${0.5 + 0.4 * p})`;
    ctx.lineWidth = 2 + 2 * p;
    ctx.beginPath(); ctx.arc(e.x, e.y, rr, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  if (e.elite) {
    const ar = e.enraged ? 38 : 30;
    const pulse = (e.enraged ? 0.42 : 0.22) + (e.enraged ? 0.2 : 0.12) * Math.sin(t * (e.enraged ? 7 : 3) + e.seed);
    const ag = ctx.createRadialGradient(e.x, e.y, 2, e.x, e.y, ar);
    ag.addColorStop(0, `rgba(${e.enraged ? "255,90,50" : "231,116,99"},${pulse})`);
    ag.addColorStop(1, "rgba(231,116,99,0)");
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.translate(e.x, e.y); ctx.scale(1, 0.35); ctx.translate(-e.x, -e.y);
    ctx.fillStyle = ag; ctx.beginPath(); ctx.arc(e.x, e.y, ar, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.save();
  ctx.translate(ox, oy); ctx.scale(s, s); ctx.translate(-ox, -oy);
  let top = -21;
  if (e.kind === "slime") {
    top = -13;
    const sq = Math.sin(t * 5 + e.seed);
    const c = "#6fbf5e", cd = "#4d8f45", cD = "#3a6e37", cl = "#a8e08c", core = "#d9f7c2";
    px2(ctx, ox, oy, -11, -2, 22, 2, cd);
    px2(ctx, ox, oy, -10, -5, 20, 3, c);
    px2(ctx, ox, oy, -9, -9 + sq, 18, 4, c);
    px2(ctx, ox, oy, -6, -12 + sq, 12, 3, c);
    px2(ctx, ox, oy, -4, -14 + sq, 8, 2, c);
    px2(ctx, ox, oy, 6, -8, 3, 6, cd);
    px2(ctx, ox, oy, 4, -11 + sq, 3, 3, cd);
    px2(ctx, ox, oy, -6, -12 + sq, 4, 2, cl);
    px2(ctx, ox, oy, -7, -10 + sq, 2, 2, cl);
    px2(ctx, ox, oy, -5, -11 + sq, 2, 1, core);
    px2(ctx, ox, oy, 2, -6, 2, 2, cD);
    px2(ctx, ox, oy, -4, -4, 1, 1, cD);
    px2(ctx, ox, oy, 6, -4, 1, 1, cD);
    px2(ctx, ox, oy, -3, -8, 2, 3, "#f4faee");
    px2(ctx, ox, oy, 3, -8, 2, 3, "#f4faee");
    px2(ctx, ox, oy, -3, -7, 2, 2, "#26232b");
    px2(ctx, ox, oy, 3, -7, 2, 2, "#26232b");
    px2(ctx, ox, oy, -3, -8, 1, 1, "#ffffff");
    px2(ctx, ox, oy, 3, -8, 1, 1, "#ffffff");
    px2(ctx, ox, oy, 0, -4, 3, 2, "#2e5b2a");
    px2(ctx, ox, oy, 1, -3, 1, 1, "#e77fb3");
    px2(ctx, ox, oy, -9, -1, 2, 1, cd);
    px2(ctx, ox, oy, 8, -1, 2, 1, cd);
  } else if (e.kind === "bat") {
    top = -25;
    const fl = Math.floor(t * 8 + e.seed) % 2;
    const hov = Math.sin(t * 3 + e.seed) * 4;
    const c = "#5d4a7a", cd = "#463659", cl = "#7a659c", mem = "#3a2d4a";
    const wy = (fl ? -28 : -23) + hov;
    /* back wing */
    px2(ctx, ox, oy, -13, wy, 8, 2, cd);
    px2(ctx, ox, oy, -12, wy + 2, 7, 2, mem);
    px2(ctx, ox, oy, -11, wy + 4, 5, 2, mem);
    px2(ctx, ox, oy, -10, wy, 1, 6, cd);
    px2(ctx, ox, oy, -7, wy, 1, 5, cd);
    /* front wing */
    px2(ctx, ox, oy, 5, wy, 8, 2, cd);
    px2(ctx, ox, oy, 5, wy + 2, 7, 2, mem);
    px2(ctx, ox, oy, 6, wy + 4, 5, 2, mem);
    px2(ctx, ox, oy, 9, wy, 1, 6, cd);
    px2(ctx, ox, oy, 6, wy, 1, 5, cd);
    /* body */
    px2(ctx, ox, oy, -5, -25 + hov, 10, 9, c);
    px2(ctx, ox, oy, -4, -25 + hov, 8, 1, cl);
    px2(ctx, ox, oy, -5, -24 + hov, 1, 7, cd);
    px2(ctx, ox, oy, -3, -20 + hov, 5, 3, cl);
    /* ears */
    px2(ctx, ox, oy, -4, -28 + hov, 2, 3, c);
    px2(ctx, ox, oy, -3, -27 + hov, 1, 2, "#e77fb3");
    px2(ctx, ox, oy, 2, -28 + hov, 2, 3, c);
    px2(ctx, ox, oy, 3, -27 + hov, 1, 2, "#e77fb3");
    /* face */
    px2(ctx, ox, oy, -3, -23 + hov, 7, 1, cd);
    px2(ctx, ox, oy, -2, -22 + hov, 2, 2, "#ff5a5a");
    px2(ctx, ox, oy, 2, -22 + hov, 2, 2, "#ff5a5a");
    px2(ctx, ox, oy, -2, -22 + hov, 1, 1, "#ffd0d0");
    px2(ctx, ox, oy, 2, -22 + hov, 1, 1, "#ffd0d0");
    px2(ctx, ox, oy, -1, -17 + hov, 1, 2, "#ffffff");
    px2(ctx, ox, oy, 2, -17 + hov, 1, 2, "#ffffff");
    /* dangling feet */
    px2(ctx, ox, oy, -2, -16 + hov, 1, 2, cd);
    px2(ctx, ox, oy, 2, -16 + hov, 1, 2, cd);
  } else if (e.kind === "skeleton") {
    top = -28;
    const bone = "#e8e4d4", boneD = "#b8b2a0", boneDD = "#8f8a78", cav = "#1c1a26";
    const f = Math.floor(t * 6 + e.seed) % 2;
    /* legs */
    px2(ctx, ox, oy, -4, -6, 3, 6 - (f ? 1 : 0), bone);
    px2(ctx, ox, oy, -3, -3, 1, 1, boneD);
    px2(ctx, ox, oy, 1, -6, 3, 6 - (f ? 0 : 1), bone);
    px2(ctx, ox, oy, 2, -3, 1, 1, boneD);
    /* pelvis */
    px2(ctx, ox, oy, -5, -9, 10, 3, bone);
    px2(ctx, ox, oy, -3, -8, 2, 1, boneDD);
    px2(ctx, ox, oy, 2, -8, 2, 1, boneDD);
    /* ribcage over a dark cavity */
    px2(ctx, ox, oy, -5, -16, 11, 7, cav);
    px2(ctx, ox, oy, -5, -15, 11, 1, bone);
    px2(ctx, ox, oy, -5, -13, 11, 1, bone);
    px2(ctx, ox, oy, -5, -11, 11, 1, boneD);
    px2(ctx, ox, oy, 0, -16, 2, 7, bone);
    px2(ctx, ox, oy, -6, -17, 12, 2, bone);
    px2(ctx, ox, oy, -6, -16, 12, 1, boneD);
    /* back arm */
    px2(ctx, ox, oy, -7, -16, 2, 5, boneD);
    px2(ctx, ox, oy, -7, -11, 2, 2, bone);
    /* skull */
    px2(ctx, ox, oy, -5, -27, 10, 8, bone);
    px2(ctx, ox, oy, -4, -28, 8, 1, "#f6f3e6");
    px2(ctx, ox, oy, 3, -26, 2, 6, boneD);
    px2(ctx, ox, oy, -4, -25, 3, 3, cav);
    px2(ctx, ox, oy, 1, -25, 3, 3, cav);
    px2(ctx, ox, oy, -3, -24, 1, 1, "#ef6461");
    px2(ctx, ox, oy, 2, -24, 1, 1, "#ef6461");
    px2(ctx, ox, oy, 4, -22, 1, 1, cav);
    px2(ctx, ox, oy, -2, -28, 1, 1, boneDD);
    px2(ctx, ox, oy, -1, -27, 1, 1, boneDD);
    px2(ctx, ox, oy, -1, -26, 1, 1, boneDD);
    /* jaw with teeth gaps */
    px2(ctx, ox, oy, -4, -20, 8, 2, boneD);
    px2(ctx, ox, oy, -3, -20, 1, 1, bone);
    px2(ctx, ox, oy, -1, -20, 1, 1, bone);
    px2(ctx, ox, oy, 1, -20, 1, 1, bone);
    px2(ctx, ox, oy, 3, -20, 1, 1, bone);
    /* sword arm with a rusty notched blade */
    px2(ctx, ox, oy, 5, -15, 2, 4, boneD);
    px2(ctx, ox, oy, 5, -11, 2, 2, bone);
    px2(ctx, ox, oy, 7, -24, 2, 10, "#9aa3b5");
    px2(ctx, ox, oy, 7, -24, 1, 10, "#c9d2de");
    px2(ctx, ox, oy, 8, -21, 1, 1, "#5f6673");
    px2(ctx, ox, oy, 7, -17, 1, 1, "#5f6673");
    px2(ctx, ox, oy, 7, -23, 1, 2, "#7a6a4a");
    px2(ctx, ox, oy, 5, -14, 6, 2, "#6b4a32");
    px2(ctx, ox, oy, 7, -12, 2, 3, "#513723");
  } else {
    top = -21;
    const c = "#c9503f", cl = "#e0654f", cd = "#96382c", belly = "#efa08c";
    const f = Math.floor(t * 7 + e.seed) % 2;
    const eyeC = e.enraged ? "#ff4a3a" : "#f7e28b";
    const sw = Math.round(Math.sin(t * 3 + e.seed) * 1.5);
    /* tail, behind the body */
    px2(ctx, ox, oy, -7, -8, 2, 2, c);
    px2(ctx, ox, oy, -9, -7 + sw, 2, 2, c);
    px2(ctx, ox, oy, -11, -5 + sw, 2, 2, cd);
    px2(ctx, ox, oy, -13, -7 + sw, 2, 3, cd);
    px2(ctx, ox, oy, -14, -6 + sw, 1, 1, cd);
    /* legs with dark hooves */
    px2(ctx, ox, oy, -3, f ? -5 : -6, 3, f ? 5 : 6, c);
    px2(ctx, ox, oy, -3, -1, 3, 1, "#4a2a24");
    px2(ctx, ox, oy, 1, f ? -6 : -5, 3, f ? 6 : 5, c);
    px2(ctx, ox, oy, 1, -1, 3, 1, "#4a2a24");
    /* body */
    px2(ctx, ox, oy, -5, -13, 10, 7, c);
    px2(ctx, ox, oy, -5, -13, 1, 7, cd);
    px2(ctx, ox, oy, 3, -13, 2, 7, cd);
    px2(ctx, ox, oy, -3, -12, 5, 4, belly);
    px2(ctx, ox, oy, -3, -10, 5, 1, "#d98a74");
    /* arms with claws */
    px2(ctx, ox, oy, -7, -12, 2, 4, c);
    px2(ctx, ox, oy, -8, -8, 1, 2, "#e8e2d0");
    px2(ctx, ox, oy, -6, -8, 1, 2, "#e8e2d0");
    px2(ctx, ox, oy, 5, -12, 2, 4, c);
    px2(ctx, ox, oy, 5, -8, 1, 2, "#e8e2d0");
    px2(ctx, ox, oy, 7, -8, 1, 2, "#e8e2d0");
    /* head */
    px2(ctx, ox, oy, -5, -21, 10, 8, cl);
    px2(ctx, ox, oy, -4, -21, 8, 1, "#eb7a62");
    px2(ctx, ox, oy, -5, -20, 1, 7, cd);
    px2(ctx, ox, oy, -4, -18, 9, 1, cd);
    px2(ctx, ox, oy, -3, -17, 2, 2, eyeC);
    px2(ctx, ox, oy, 2, -17, 2, 2, eyeC);
    if (!e.enraged) { px2(ctx, ox, oy, -3, -17, 1, 1, "#fff7d0"); px2(ctx, ox, oy, 2, -17, 1, 1, "#fff7d0"); }
    px2(ctx, ox, oy, 4, -16, 3, 3, cl);
    px2(ctx, ox, oy, 5, -15, 1, 1, cd);
    px2(ctx, ox, oy, 6, -14, 1, 1, cd);
    px2(ctx, ox, oy, -2, -14, 1, 2, "#ffffff");
    px2(ctx, ox, oy, 2, -14, 1, 2, "#ffffff");
    /* horns */
    px2(ctx, ox, oy, -6, -23, 2, 2, "#8a2f24");
    px2(ctx, ox, oy, -7, -26, 2, 3, "#a8443a");
    px2(ctx, ox, oy, -8, -29, 2, 3, "#8a2f24");
    px2(ctx, ox, oy, -7, -25, 1, 1, "#6e251c");
    px2(ctx, ox, oy, 4, -23, 2, 2, "#8a2f24");
    px2(ctx, ox, oy, 5, -26, 2, 3, "#a8443a");
    px2(ctx, ox, oy, 6, -29, 2, 3, "#8a2f24");
    px2(ctx, ox, oy, 6, -25, 1, 1, "#6e251c");
  }
  if (e.boss) {
    px2(ctx, ox, oy, -4, top - 4, 8, 2, "#f2c14e");
    px2(ctx, ox, oy, -4, top - 5, 8, 1, "#c78a3b");
    px2(ctx, ox, oy, -4, top - 6, 2, 2, "#f2c14e");
    px2(ctx, ox, oy, -1, top - 7, 2, 3, "#f2c14e");
    px2(ctx, ox, oy, 2, top - 6, 2, 2, "#f2c14e");
    px2(ctx, ox, oy, -1, top - 7, 1, 1, "#fff1c9");
    px2(ctx, ox, oy, -3, top - 4, 1, 1, "#d0455a");
    px2(ctx, ox, oy, 1, top - 4, 1, 1, "#5aa9e6");
  }
  px2(ctx, ox, oy, -4, top, 8, 1, "rgba(255,232,190,0.22)");
  if (e.elite) {
    px2(ctx, ox, oy, -3, top - 2, 1, 2, "#d0455a");
    px2(ctx, ox, oy, 0, top - 3, 1, 3, "#e77463");
    px2(ctx, ox, oy, 2, top - 2, 1, 2, "#d0455a");
  }
  ctx.restore();
  if (e.windup > 0) {
    const wp = clamp(1 - e.windup / (e.windupMax || 1), 0, 1);
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    const cc = e.kind === "skeleton" ? "138,111,224" : e.kind === "bat" ? "180,120,255" : e.kind === "slime" ? "127,208,105" : "255,120,60";
    const cg = ctx.createRadialGradient(e.x, e.y - 24 * s, 2, e.x, e.y - 24 * s, 30 * s);
    cg.addColorStop(0, `rgba(${cc},${0.12 + wp * 0.30})`); cg.addColorStop(1, `rgba(${cc},0)`);
    ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(e.x, e.y - 24 * s, 30 * s, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (Math.floor(t * 8) % 2) {
      ctx.font = "14px 'Press Start 2P', monospace"; ctx.textAlign = "center";
      ctx.fillStyle = "#141221"; ctx.fillText("!", e.x + 1, e.y - 66 * s - 13);
      ctx.fillStyle = "#ff5a4a"; ctx.fillText("!", e.x, e.y - 66 * s - 14);
    }
  }
  if (e.screechT > 0) {
    const pr = 1 - e.screechT / 0.6;
    ctx.strokeStyle = `rgba(200,160,255,${0.7 * (1 - pr)})`; ctx.lineWidth = 2;
    ctx.save(); ctx.translate(e.x, e.y - 26 * s); ctx.scale(1, 0.6);
    for (let k = 0; k < 3; k++) {
      ctx.beginPath(); ctx.arc(0, 0, Math.max(1, pr * 110 + k * 16), 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }
  if (e.shell > 0) {
    for (let k = 0; k < 4; k++) {
      const a = t * 2.2 + (k * Math.PI) / 2;
      ctx.fillStyle = k % 2 ? "#b8b2a0" : "#e8e4d4";
      ctx.fillRect(e.x + Math.cos(a) * 24 * s - 2, e.y - 26 * s + Math.sin(a) * 10 * s - 3, 4, 7);
    }
  }
  if (e.stunT > 0) {
    for (let i = 0; i < 3; i++) {
      const a = t * 5 + (i * Math.PI * 2) / 3;
      ctx.fillStyle = "#f7e28b";
      ctx.fillRect(e.x + Math.cos(a) * 12 - 2, e.y - 62 * s + Math.sin(a) * 4, 4, 4);
    }
  }
  if (e.poisonT > 0) {
    ctx.fillStyle = "rgba(127,208,105,0.85)";
    ctx.fillRect(ox - 2, oy - 60 * s - Math.sin(t * 6 + e.seed) * 4, 4, 4);
  }
  hpBar(ctx, e.x, e.y - 54 * s, e.boss ? 60 : e.elite ? 40 : 26, e.hp / e.maxHp, "#ef6461");
  if (e.elite) {
    ctx.font = "7px 'Press Start 2P', monospace"; ctx.textAlign = "center";
    ctx.fillStyle = "#e77463"; ctx.fillText(e.name, e.x, e.y - 54 * s - 8);
  }
}


/* ===== the feast: a Nordic mead hall for successful prestiges ===== */
function drawMugAt(ctx, x, y, tilt) {
  ctx.save();
  ctx.translate(x, y);
  if (tilt) ctx.rotate(tilt);
  ctx.fillStyle = "#6b4a32"; ctx.fillRect(-4, -5, 9, 11);
  ctx.fillStyle = "#8a6b48"; ctx.fillRect(-4, -3, 9, 2); ctx.fillRect(-4, 2, 9, 2);
  ctx.fillStyle = "#513723"; ctx.fillRect(4, -5, 1, 11);
  ctx.fillStyle = "#6b4a32"; ctx.fillRect(5, -3, 3, 2); ctx.fillRect(5, 1, 3, 2); ctx.fillRect(7, -2, 2, 4);
  ctx.fillStyle = "#f7f2e2"; ctx.fillRect(-4, -8, 9, 3);
  ctx.fillStyle = "#ffffff"; ctx.fillRect(-3, -9, 3, 2); ctx.fillRect(2, -9, 2, 2);
  ctx.restore();
}
function drawTurkeyLegAt(ctx, x, y, rot) {
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  ctx.fillStyle = "#8a4f26"; ctx.fillRect(-6, -4, 10, 9);
  ctx.fillStyle = "#a3622f"; ctx.fillRect(-5, -3, 8, 6);
  ctx.fillStyle = "#c9803f"; ctx.fillRect(-5, -3, 6, 2);
  ctx.fillStyle = "#efe9d8"; ctx.fillRect(4, -1, 5, 3);
  ctx.fillStyle = "#ffffff"; ctx.fillRect(8, -3, 3, 2); ctx.fillRect(8, 2, 3, 2);
  ctx.restore();
}
function drawWindowN(ctx, cx, wy, ww, wh, t, moon) {
  const x0 = cx - ww / 2;
  ctx.fillStyle = "#241812";
  ctx.fillRect(x0 - 4, wy - 4, ww + 8, wh + 10);
  ctx.fillRect(x0 + 4 - 4, wy - 10, ww - 8 + 8, 8);
  ctx.fillRect(x0 + 10 - 4, wy - 15, ww - 20 + 8, 6);
  /* night sky */
  ctx.fillStyle = "#0c1424";
  ctx.fillRect(x0, wy, ww, wh);
  ctx.fillRect(x0 + 4, wy - 6, ww - 8, 6);
  ctx.fillRect(x0 + 10, wy - 11, ww - 20, 5);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, wy - 11, ww, wh + 11);
  ctx.clip();
  /* stars */
  ctx.fillStyle = "rgba(230,235,255,0.9)";
  for (let i = 0; i < 8; i++) {
    const sx = x0 + ((i * 37 + cx) % ww);
    const sy = wy - 6 + ((i * 23) % (wh - 6));
    const tw = 0.5 + 0.5 * Math.sin(t * 2 + i * 2.2 + cx);
    ctx.globalAlpha = 0.3 + 0.6 * tw;
    ctx.fillRect(sx, sy, 2, 2);
  }
  ctx.globalAlpha = 1;
  if (moon) {
    ctx.fillStyle = "#e8ecf4"; ctx.fillRect(cx + 8, wy + 8, 10, 10);
    ctx.fillStyle = "#c4ccdc"; ctx.fillRect(cx + 11, wy + 11, 3, 3); ctx.fillRect(cx + 15, wy + 9, 2, 2);
  }
  /* aurora */
  ctx.globalCompositeOperation = "lighter";
  for (let k = 0; k < 3; k++) {
    const col = k === 1 ? "143,227,255" : "127,208,105";
    for (let sx = 0; sx < ww; sx += 4) {
      const yy = wy + 10 + k * 12 + Math.sin(t * 0.6 + (x0 + sx) * 0.05 + k * 1.7) * 7;
      const a = 0.10 + 0.08 * Math.sin(t * 0.9 + sx * 0.08 + k);
      ctx.fillStyle = `rgba(${col},${Math.max(0.03, a)})`;
      ctx.fillRect(x0 + sx, yy, 4, 9 - k * 2);
    }
  }
  ctx.restore();
  ctx.globalCompositeOperation = "source-over";
  /* mullions and sill */
  ctx.fillStyle = "#3a2a1c";
  ctx.fillRect(cx - 1, wy - 8, 3, wh + 8);
  ctx.fillRect(x0, wy + wh / 2 - 1, ww, 3);
  ctx.fillStyle = "#4a3626";
  ctx.fillRect(x0 - 6, wy + wh, ww + 12, 4);
}
function drawFlame(ctx, x, y, s, t, seed) {
  const fl = Math.floor(t * 9 + seed) % 2;
  ctx.fillStyle = "#e8642c"; ctx.fillRect(x - 2 * s, y - 3 * s, 4 * s, 4 * s);
  ctx.fillStyle = "#f2a94e"; ctx.fillRect(x - 1 * s, y - (4 + fl) * s, 2 * s, 3 * s);
  ctx.fillStyle = "#ffe9a0"; ctx.fillRect(x - 0.5 * s, y - (2 + fl) * s, s, 2 * s);
}
function drawInnkeep(ctx, x, y, t) {
  const polish = Math.floor(t * 2.2) % 2;
  const bob = Math.round(Math.sin(t * 2.1) * 1);
  /* a broad-shouldered barkeep, visible from the waist up behind the counter */
  ctx.fillStyle = "#7a2f45"; ctx.fillRect(x - 12, y - 26 + bob, 24, 20);         /* tunic */
  ctx.fillStyle = "#93384a"; ctx.fillRect(x - 12, y - 26 + bob, 24, 3);
  ctx.fillStyle = "#e8dcc0"; ctx.fillRect(x - 8, y - 16 + bob, 16, 12);          /* apron */
  ctx.fillStyle = "#c9bda2"; ctx.fillRect(x - 8, y - 16 + bob, 16, 2);
  ctx.fillStyle = SKIN; ctx.fillRect(x - 6, y - 38 + bob, 13, 12);               /* head */
  ctx.fillStyle = SKIN_D; ctx.fillRect(x - 6, y - 28 + bob, 13, 2);
  ctx.fillStyle = "#c94f3d"; ctx.fillRect(x - 7, y - 40 + bob, 15, 4);           /* red hair */
  ctx.fillStyle = "#a83b2c"; ctx.fillRect(x + 3, y - 43 + bob, 5, 4);            /* top knot */
  ctx.fillStyle = "#c94f3d"; ctx.fillRect(x - 7, y - 32 + bob, 4, 12);           /* beard sides */
  ctx.fillRect(x - 5, y - 27 + bob, 11, 7);
  ctx.fillStyle = "#a83b2c"; ctx.fillRect(x - 3, y - 22 + bob, 3, 3); ctx.fillRect(x + 2, y - 22 + bob, 3, 3); /* braids */
  ctx.fillStyle = "#f2c14e"; ctx.fillRect(x - 3, y - 20 + bob, 3, 2); ctx.fillRect(x + 2, y - 20 + bob, 3, 2);
  ctx.fillStyle = "#2b2436"; ctx.fillRect(x - 2, y - 35 + bob, 2, 2); ctx.fillRect(x + 3, y - 35 + bob, 2, 2); /* eyes */
  ctx.fillStyle = SKIN; ctx.fillRect(x - 16, y - 24 + bob, 5, 4 + polish * 2);   /* arms */
  ctx.fillRect(x + 11, y - 24 + bob, 5, 4);
  drawMugAt(ctx, x + 18, y - 24 + bob - polish * 3, polish ? -0.4 : 0);
}
function drawFeastBack(ctx, g) {
  const t = g.time;
  /* gable and rafters */
  ctx.fillStyle = "#16100b"; ctx.fillRect(0, 0, W, 48);
  ctx.fillStyle = "#241812";
  ctx.fillRect(0, 8, W, 4); ctx.fillRect(0, 24, W, 4); ctx.fillRect(0, 40, W, 5);
  ctx.fillStyle = "#2e2118";
  for (let i = 0; i < 8; i++) { ctx.fillRect(40 + i * 80, 0, 6, 46); }
  /* walls: horizontal plank courses */
  for (let y = 46; y < GROUND - 6; y += 16) {
    ctx.fillStyle = ((y / 16) | 0) % 2 ? "#33251b" : "#2b1f16";
    ctx.fillRect(0, y, W, 16);
    ctx.fillStyle = "#1f1710";
    ctx.fillRect(((y * 7) % 160) + 40, y + 2, 2, 12);
    ctx.fillRect(((y * 7) % 160) + 240, y + 2, 2, 12);
    ctx.fillRect(((y * 7) % 160) + 440, y + 2, 2, 12);
  }
  /* windows with aurora night */
  drawWindowN(ctx, 80, 78, 52, 74, t, true);
  drawWindowN(ctx, 415, 78, 52, 74, t, false);
  drawWindowN(ctx, 592, 78, 44, 74, t, false);
  /* hanging banner with the guild sigil */
  ctx.fillStyle = "#7a2f45"; ctx.fillRect(330, 56, 30, 48);
  ctx.fillStyle = "#5c2434";
  ctx.fillRect(330, 96, 10, 8); ctx.fillRect(350, 96, 10, 8);
  ctx.fillStyle = "#f2c14e";
  ctx.fillRect(330, 56, 30, 3); ctx.fillRect(330, 92, 30, 2);
  ctx.fillRect(342, 70, 6, 6); ctx.fillRect(344, 66, 2, 14); ctx.fillRect(338, 72, 14, 2);
  /* wall shields */
  for (const sx of [220, 480]) {
    ctx.fillStyle = "#4a3626"; ctx.fillRect(sx - 12, 66, 24, 24);
    ctx.fillStyle = "#93384a"; ctx.fillRect(sx - 10, 68, 20, 10);
    ctx.fillStyle = "#c9a24b"; ctx.fillRect(sx - 10, 78, 20, 10);
    ctx.fillStyle = "#6f7890"; ctx.fillRect(sx - 3, 75, 6, 6);
    ctx.fillStyle = "#2b1f16"; ctx.fillRect(sx - 12, 66, 24, 2);
  }
  /* antlers above the bar */
  ctx.fillStyle = "#d8cfae";
  ctx.fillRect(70, 56, 40, 3);
  ctx.fillRect(74, 50, 3, 8); ctx.fillRect(66, 46, 3, 6); ctx.fillRect(82, 48, 3, 8);
  ctx.fillRect(103, 50, 3, 8); ctx.fillRect(111, 46, 3, 6); ctx.fillRect(95, 48, 3, 8);
  /* hearth with living fire */
  ctx.fillStyle = "#5a5347";
  ctx.fillRect(196, 132, 84, GROUND - 138);
  ctx.fillStyle = "#6b6354";
  for (let i = 0; i < 5; i++) { ctx.fillRect(200 + (i % 2) * 8, 138 + i * 20, 34 - (i % 2) * 8, 16); ctx.fillRect(240 + ((i + 1) % 2) * 8, 138 + i * 20, 34 - ((i + 1) % 2) * 8, 16); }
  ctx.fillStyle = "#3f3a32"; ctx.fillRect(196, 128, 84, 6);
  ctx.fillStyle = "#14100c"; ctx.fillRect(210, 168, 56, GROUND - 174);
  ctx.fillStyle = "#3a2a1c"; ctx.fillRect(216, GROUND - 18, 20, 8); ctx.fillRect(238, GROUND - 14, 22, 7);
  drawFlame(ctx, 230, GROUND - 18, 3, t, 0);
  drawFlame(ctx, 248, GROUND - 16, 2.4, t, 3);
  /* pillars with torches */
  for (const pxl of [186, 470]) {
    ctx.fillStyle = "#3a2a1c"; ctx.fillRect(pxl - 7, 46, 14, GROUND - 46);
    ctx.fillStyle = "#241812"; ctx.fillRect(pxl + 4, 46, 3, GROUND - 46);
    ctx.fillStyle = "#4a3626"; ctx.fillRect(pxl - 7, 96, 14, 4); ctx.fillRect(pxl - 7, 176, 14, 4);
    ctx.fillStyle = "#6f7890"; ctx.fillRect(pxl - 2, 108, 4, 8);
    drawFlame(ctx, pxl, 108, 2, t, pxl);
  }
  /* chandelier */
  ctx.fillStyle = "#2b1f16"; ctx.fillRect(318, 0, 3, 26);
  ctx.fillStyle = "#241812"; ctx.fillRect(276, 26, 88, 6);
  ctx.fillStyle = "#3a2a1c"; ctx.fillRect(276, 26, 88, 2);
  for (let i = 0; i < 5; i++) {
    const cxx = 284 + i * 18;
    ctx.fillStyle = "#e8dcc0"; ctx.fillRect(cxx, 18, 4, 8);
    drawFlame(ctx, cxx + 2, 18, 1.4, t, i * 1.7);
  }
  /* the bar: shelves, bottles, counter */
  ctx.fillStyle = "#221812"; ctx.fillRect(24, 92, 128, 84);
  for (const sy of [104, 132, 160]) { ctx.fillStyle = "#4a3626"; ctx.fillRect(26, sy, 124, 5); }
  const bottleCols = ["#5a8f5f", "#5aa9e6", "#c94f3d", "#c9a24b", "#8a6fe0", "#5a8f5f"];
  bottleCols.forEach((bc, i) => {
    const bx = 34 + i * 19;
    ctx.fillStyle = bc; ctx.fillRect(bx, 88, 7, 15);
    ctx.fillStyle = shade(bc, 0.65); ctx.fillRect(bx + 5, 88, 2, 15);
    ctx.fillStyle = "#2b1f16"; ctx.fillRect(bx + 2, 84, 3, 5);
  });
  for (let i = 0; i < 4; i++) drawMugAt(ctx, 42 + i * 28, 126, 0);
  ctx.fillStyle = "#5a4028"; ctx.fillRect(34, 142, 22, 17); ctx.fillRect(66, 142, 22, 17);
  ctx.fillStyle = "#6f7890"; ctx.fillRect(34, 146, 22, 2); ctx.fillRect(66, 146, 22, 2); ctx.fillRect(34, 153, 22, 2); ctx.fillRect(66, 153, 22, 2);
  drawInnkeep(ctx, 88, 208, t);
  ctx.fillStyle = "#6b4f33"; ctx.fillRect(20, 176, 136, 9);
  ctx.fillStyle = "#8a6b48"; ctx.fillRect(20, 176, 136, 2);
  ctx.fillStyle = "#4a3626"; ctx.fillRect(24, 185, 128, GROUND - 179);
  ctx.fillStyle = "#3a2a1c";
  for (let i = 0; i < 5; i++) ctx.fillRect(34 + i * 26, 188, 2, GROUND - 186);
  drawMugAt(ctx, 40, 172, 0);
  drawMugAt(ctx, 132, 172, 0);
  /* big barrels beside the bar */
  ctx.fillStyle = "#5a4028"; ctx.fillRect(158, 196, 26, GROUND - 190);
  ctx.fillStyle = "#6e5033"; ctx.fillRect(162, 196, 8, GROUND - 190);
  ctx.fillStyle = "#6f7890"; ctx.fillRect(158, 202, 26, 3); ctx.fillRect(158, GROUND - 12, 26, 3);
  /* floor and rug */
  ctx.fillStyle = "#3a2a1c"; ctx.fillRect(0, GROUND - 6, W, H - GROUND + 6);
  ctx.fillStyle = "#33251b";
  for (let i = 0; i < 10; i++) ctx.fillRect(0, GROUND + i * 8, W, 2);
  ctx.fillStyle = "#6e2b3e"; ctx.fillRect(190, GROUND + 4, 290, H - GROUND - 12);
  ctx.fillStyle = "#f2c14e";
  ctx.fillRect(190, GROUND + 4, 290, 2); ctx.fillRect(190, H - 10, 290, 2);
  ctx.fillStyle = "#8a3b52";
  for (let i = 0; i < 6; i++) ctx.fillRect(215 + i * 48, GROUND + 18, 10, 10);
}
function drawFeastFront(ctx, g) {
  const t = g.time;
  /* the long table, in front of the diners */
  ctx.fillStyle = "#6b4f33"; ctx.fillRect(296, GROUND - 30, 182, 8);
  ctx.fillStyle = "#8a6b48"; ctx.fillRect(296, GROUND - 30, 182, 2);
  ctx.fillStyle = "#4a3626"; ctx.fillRect(300, GROUND - 22, 174, 34);
  ctx.fillStyle = "#3a2a1c";
  for (let i = 0; i < 6; i++) ctx.fillRect(310 + i * 28, GROUND - 20, 2, 30);
  ctx.fillStyle = "#2b1f16"; ctx.fillRect(304, GROUND + 12, 12, 6); ctx.fillRect(458, GROUND + 12, 12, 6);
  /* spread on the table */
  ctx.fillStyle = "#c9c3b8"; ctx.fillRect(360, GROUND - 38, 46, 8);
  ctx.fillStyle = "#a3622f"; ctx.fillRect(368, GROUND - 48, 30, 13);
  ctx.fillStyle = "#c9803f"; ctx.fillRect(370, GROUND - 48, 26, 4);
  ctx.fillStyle = "#efe9d8"; ctx.fillRect(364, GROUND - 52, 4, 6); ctx.fillRect(398, GROUND - 52, 4, 6);
  drawMugAt(ctx, 330, GROUND - 34, 0);
  drawMugAt(ctx, 434, GROUND - 34, 0);
  ctx.fillStyle = "#e8c15a"; ctx.fillRect(414, GROUND - 38, 16, 8);
  ctx.fillStyle = "#c78a3b"; ctx.fillRect(414, GROUND - 38, 16, 2); ctx.fillRect(418, GROUND - 34, 3, 2);
  ctx.fillStyle = "#e8dcc0"; ctx.fillRect(344, GROUND - 36, 4, 6);
  drawFlame(ctx, 346, GROUND - 36, 1.2, t, 5);
  /* the arm-wrestling table */
  ctx.fillStyle = "#6b4f33"; ctx.fillRect(526, GROUND - 26, 40, 6);
  ctx.fillStyle = "#8a6b48"; ctx.fillRect(526, GROUND - 26, 40, 2);
  ctx.fillStyle = "#4a3626"; ctx.fillRect(542, GROUND - 20, 8, 22);
  ctx.fillStyle = "#3a2a1c"; ctx.fillRect(536, GROUND, 20, 4);
  /* music notes from singers and dancers */
  ctx.font = "10px monospace";
  for (const m of g.members) {
    if (!m.feast || m.walking) continue;
    if (m.feast.act !== "sing" && m.feast.act !== "dance") continue;
    const nN = m.feast.act === "sing" ? 3 : 1;
    for (let k = 0; k < nN; k++) {
      const ph = ((t * 0.8 + m.feast.seed + k * 0.55) % 1.6) / 1.6;
      if (ph > 0.9) continue;
      const nx = m.x + Math.sin(ph * 5 + k * 2) * 9 + (k - 1) * 7;
      const ny = m.y - 70 - ph * 34;
      ctx.globalAlpha = 1 - ph;
      const nc = k % 2 ? "#8fe3ff" : "#f2c14e";
      ctx.fillStyle = nc;
      ctx.fillRect(nx, ny, 5, 4);
      ctx.fillRect(nx + 4, ny - 8, 2, 10);
      ctx.fillRect(nx + 4, ny - 8, 4, 2);
      ctx.globalAlpha = 1;
    }
  }
  /* names over heads: this party earned them */
  ctx.font = "7px 'Press Start 2P', monospace"; ctx.textAlign = "center";
  for (const m of g.members) {
    ctx.fillStyle = "#14122188"; ctx.fillText(m.name, m.x + 1, m.y - 63);
    ctx.fillStyle = "#efeaff"; ctx.fillText(m.name, m.x, m.y - 64);
  }
}
function drawFeastLight(ctx, g) {
  const t = g.time;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const glow = (x, y, r, col, a) => {
    const gg = ctx.createRadialGradient(x, y, 2, x, y, r);
    gg.addColorStop(0, `rgba(${col},${a})`); gg.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = gg; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  const fl = 0.9 + 0.1 * Math.sin(t * 8);
  glow(238, GROUND - 24, 90, "255,150,60", 0.22 * fl);
  glow(186, 110, 44, "255,170,80", 0.16 * fl);
  glow(470, 110, 44, "255,170,80", 0.16 * fl);
  glow(320, 24, 70, "255,200,120", 0.12);
  glow(346, GROUND - 38, 26, "255,200,120", 0.12 * fl);
  glow(88, 176, 50, "255,180,90", 0.10);
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = "soft-light";
  const cg = ctx.createLinearGradient(0, 0, 0, H);
  cg.addColorStop(0, "rgba(200,120,50,0.5)");
  cg.addColorStop(1, "rgba(90,45,25,0.5)");
  ctx.fillStyle = cg; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = "source-over";
  const vg = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.3, W / 2, H * 0.55, H * 0.95);
  vg.addColorStop(0, "rgba(10,6,4,0)"); vg.addColorStop(1, "rgba(10,6,4,0.55)");
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  ctx.restore();
}
function drawFeastBanner(ctx, g) {
  ctx.fillStyle = "rgba(12,10,20,0.55)";
  ctx.fillRect(0, 0, W, 22);
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fillRect(0, 22, W, 1);
  ctx.font = "8px 'Press Start 2P', monospace"; ctx.textAlign = "center";
  const txt = "THE FEAST OF CHAPTER " + (g.prestiges + 1);
  ctx.fillStyle = "#f2c14e";
  ctx.fillText(txt, W / 2, 15);
  const tw = ctx.measureText(txt).width;
  drawMugAt(ctx, W / 2 - tw / 2 - 18, 12, -0.15);
  drawMugAt(ctx, W / 2 + tw / 2 + 18, 12, 0.15);
  ctx.font = "7px 'Press Start 2P', monospace"; ctx.textAlign = "right";
  ctx.fillStyle = "#cfc9e8";
  ctx.fillText(Math.ceil(Math.max(0, g.feastT || 0)) + "s", W - 8, 15);
}
function drawFeaster(ctx, m, t) {
  drawPet(ctx, m, t);
  const fs = m.feast || {};
  const act = fs.act || "dance";
  let oy = m.y;
  if (act === "dance" && !m.walking) oy -= Math.round(Math.abs(Math.sin(t * 6 + fs.seed)) * 5);
  else if (!m.walking) oy += Math.round(Math.sin(t * 2.5 + m.seed) * 1.2);
  const ox = m.x;
  let face = fs.face || 1;
  if (act === "dance" && !m.walking) face = Math.sin(t * 1.6 + fs.seed) > 0 ? 1 : -1;
  drawShadow(ctx, ox, m.y, 26);
  ctx.save();
  if (face === -1) { ctx.translate(ox, 0); ctx.scale(-1, 1); ctx.translate(-ox, 0); }
  const f = m.walking ? Math.floor(t * 8 + m.seed) % 2 : 0;
  const hair = HAIRS[m.cos.hair].c;
  const outfit = OUTFITS[m.cos.outfit].c;
  const oD = shade(outfit, 0.7), oL = shade(outfit, 1.28);
  const fem = m.cos.body === "f";
  drawCape(ctx, ox, oy, m.cos.cape, t, m.walking);
  /* legs: dancers kick, everyone else stands */
  const pants = "#3a3550", pantsD = "#2a2740", boot = "#4a3b2c", bootL = "#5d4a36", sole = "#26232b";
  let legB = m.walking && f ? 1 : 0, legF = m.walking && !f ? 1 : 0;
  if (act === "dance" && !m.walking) { const db = Math.floor(t * 6 + fs.seed) % 2; legB = db; legF = 1 - db; }
  px2(ctx, ox, oy, -4, -8, 3, 5 - legB, pants);
  px2(ctx, ox, oy, -2, -8, 1, 5 - legB, pantsD);
  px2(ctx, ox, oy, -4, -3 - legB, 3, 3, boot);
  px2(ctx, ox, oy, -4, -3 - legB, 3, 1, bootL);
  px2(ctx, ox, oy, -4, -1 - legB, 4, 1, sole);
  px2(ctx, ox, oy, 1, -8, 3, 5 - legF, pants);
  px2(ctx, ox, oy, 3, -8, 1, 5 - legF, pantsD);
  px2(ctx, ox, oy, 1, -3 - legF, 3, 3, boot);
  px2(ctx, ox, oy, 1, -3 - legF, 3, 1, bootL);
  px2(ctx, ox, oy, 1, -1 - legF, 4, 1, sole);
  /* off-duty tunic for everyone */
  px2(ctx, ox, oy, -6, -19, 12, 8, outfit);
  px2(ctx, ox, oy, -5, -19, 10, 1, oL);
  px2(ctx, ox, oy, -6, -19, 1, 8, oD);
  px2(ctx, ox, oy, 0, -18, 1, 4, oD);
  px2(ctx, ox, oy, -5, -11, 10, 2, "#26232b");
  px2(ctx, ox, oy, 0, -11, 2, 2, "#f2c14e");
  if (fem) {
    px2(ctx, ox, oy, -5, -13, 1, 2, "rgba(16,14,26,0.30)");
    px2(ctx, ox, oy, 4, -13, 1, 2, "rgba(16,14,26,0.30)");
  }
  /* head */
  px2(ctx, ox, oy, -4, -31, 8, 1, SKIN);
  px2(ctx, ox, oy, -5, -30, 10, 9, SKIN);
  px2(ctx, ox, oy, -4, -21, 8, 1, SKIN_D);
  px2(ctx, ox, oy, -3, -31, 6, 1, SKIN_L);
  px2(ctx, ox, oy, -5, -29, 1, 8, SKIN_D);
  px2(ctx, ox, oy, -4, -22, 8, 1, SKIN_D);
  px2(ctx, ox, oy, -5, -26, 2, 3, SKIN);
  px2(ctx, ox, oy, -1, -20, 4, 1, SKIN_D);
  const browC = shade(hair, 0.6);
  const merry = act === "sing" || act === "dance" || (act === "drink" && ((t * 0.8 + fs.seed) % 3) < 0.7);
  px2(ctx, ox, oy, 0, -27, 2, 1, browC);
  px2(ctx, ox, oy, 3, -27, 2, 1, browC);
  if (merry) {
    /* happy closed eyes */
    px2(ctx, ox, oy, 0, -25, 2, 1, "#2b2436");
    px2(ctx, ox, oy, 3, -25, 2, 1, "#2b2436");
  } else {
    px2(ctx, ox, oy, 0, -26, 2, 2, "#f7f4ff");
    px2(ctx, ox, oy, 3, -26, 2, 2, "#f7f4ff");
    px2(ctx, ox, oy, 1, -26, 1, 2, "#2b2436");
    px2(ctx, ox, oy, 4, -26, 1, 2, "#2b2436");
  }
  px2(ctx, ox, oy, 5, -24, 1, 2, SKIN_D);
  /* feast-flushed cheeks for all */
  px2(ctx, ox, oy, -1, -23, 1, 1, "rgba(224,122,110,0.55)");
  px2(ctx, ox, oy, 4, -23, 1, 1, "rgba(224,122,110,0.55)");
  if (act === "sing") {
    px2(ctx, ox, oy, 1, -23, 3, 2, "#5a2f35");
    px2(ctx, ox, oy, 2, -22, 1, 1, "#e77fb3");
  } else if (act === "wrestle") {
    px2(ctx, ox, oy, 1, -22, 3, 1, "#f7f4ff");
  } else if (fem) {
    px2(ctx, ox, oy, 1, -22, 3, 1, "#c96a7a");
  } else {
    px2(ctx, ox, oy, 1, -22, 3, 1, "#8a5a44");
  }
  drawHair(ctx, ox, oy, m.cos.hairstyle, hair);
  /* activity arms and props */
  if (act === "drink") {
    px2(ctx, ox, oy, -7, -17, 2, 5, oD);
    px2(ctx, ox, oy, -7, -12, 2, 2, SKIN);
    const swig = ((t * 0.8 + fs.seed) % 3) < 0.7;
    if (swig) {
      px2(ctx, ox, oy, 4, -20, 2, 3, oD);
      px2(ctx, ox, oy, 5, -23, 2, 3, SKIN);
      drawMugAt(ctx, ox + 15, oy - 48, -0.7);
      if (Math.floor(t * 6 + fs.seed) % 3 === 0) { px2(ctx, ox, oy, 9, -21, 1, 1, "#f7f2e2"); }
    } else {
      px2(ctx, ox, oy, 4, -16, 3, 3, oD);
      px2(ctx, ox, oy, 5, -14, 3, 2, SKIN);
      drawMugAt(ctx, ox + 15, oy - 26, 0);
    }
  } else if (act === "eat") {
    px2(ctx, ox, oy, -7, -17, 2, 5, oD);
    px2(ctx, ox, oy, -7, -12, 2, 2, SKIN);
    const bite = ((t * 1.1 + fs.seed) % 2) < 0.55;
    if (bite) {
      px2(ctx, ox, oy, 4, -20, 2, 3, oD);
      px2(ctx, ox, oy, 5, -23, 2, 3, SKIN);
      drawTurkeyLegAt(ctx, ox + 17, oy - 46, -0.5);
      if (Math.floor(t * 8 + fs.seed) % 4 === 0) px2(ctx, ox, oy, 8, -19 + (Math.floor(t * 10) % 3), 1, 1, "#c9803f");
    } else {
      px2(ctx, ox, oy, 4, -16, 3, 3, oD);
      px2(ctx, ox, oy, 5, -14, 3, 2, SKIN);
      drawTurkeyLegAt(ctx, ox + 17, oy - 26, 0.2);
    }
  } else if (act === "sing") {
    px2(ctx, ox, oy, -8, -21, 2, 4, oD);
    px2(ctx, ox, oy, -9, -23, 2, 2, SKIN);
    px2(ctx, ox, oy, 6, -21, 2, 4, oD);
    px2(ctx, ox, oy, 7, -23, 2, 2, SKIN);
  } else if (act === "dance") {
    const a = Math.floor(t * 6 + fs.seed) % 2;
    if (a) {
      px2(ctx, ox, oy, -8, -22, 2, 4, oD);
      px2(ctx, ox, oy, -9, -24, 2, 2, SKIN);
      px2(ctx, ox, oy, 5, -15, 3, 2, oD);
      px2(ctx, ox, oy, 7, -14, 2, 2, SKIN);
    } else {
      px2(ctx, ox, oy, -7, -15, 3, 2, oD);
      px2(ctx, ox, oy, -9, -14, 2, 2, SKIN);
      px2(ctx, ox, oy, 6, -22, 2, 4, oD);
      px2(ctx, ox, oy, 7, -24, 2, 2, SKIN);
    }
  } else if (act === "wrestle") {
    px2(ctx, ox, oy, -7, -17, 2, 5, oD);
    px2(ctx, ox, oy, -7, -12, 2, 2, SKIN);
    const wob = Math.sin(t * 7 + (fs.pairSeed || 0)) * 2;
    const yo = Math.round((fs.face === -1 ? -wob : wob));
    const reach = Math.max(6, Math.round(Math.abs((fs.midX || (m.x + 22)) - m.x) / 2));
    px2(ctx, ox, oy, 4, -17, 3, 2, oD);
    px2(ctx, ox, oy, 6, -17 + yo * 0.5, reach - 6, 2, SKIN);
    px2(ctx, ox, oy, reach - 1, -18 + yo, 3, 3, SKIN);
    px2(ctx, ox, oy, reach, -18 + yo, 1, 1, SKIN_D);
    if (Math.abs(wob) > 1.6) px2(ctx, ox, oy, 3, -28, 1, 1, "#8fe3ff");
  }
  drawHat(ctx, ox, oy, m.cos.hat, outfit, WEAPON_SKINS.find((w) => w.id === m.cos.weapon).c, hair);
  drawAccessory(ctx, ox, oy, m.cos.accessory);
  px2(ctx, ox, oy, -4, -31, 8, 1, "rgba(255,232,190,0.28)");
  ctx.restore();
}

function drawBossTelegraphs(ctx, g) {
  const t = g.time;
  for (const e of g.enemies) {
    if (!e.boss || e.hp <= 0 || !(e.windup > 0)) continue;
    const p = clamp(1 - e.windup / (e.windupMax || 1), 0, 1);
    const puls = 0.5 + 0.5 * Math.sin(t * 10);
    if (e.kind === "imp") {
      for (const m of g.members) {
        if (!m.alive) continue;
        ctx.strokeStyle = `rgba(255,80,50,${0.25 + 0.45 * p * puls})`;
        ctx.lineWidth = 2;
        ctx.save(); ctx.translate(m.x, m.y); ctx.scale(1, 0.35);
        ctx.beginPath(); ctx.arc(0, 0, 16 + 6 * (1 - p), 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(22, 0); ctx.moveTo(0, -22); ctx.lineTo(0, 22); ctx.stroke();
        ctx.restore();
      }
    } else if (e.kind === "slime") {
      const xs = g.members.filter((m) => m.alive).map((m) => m.x);
      const cx = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 150;
      ctx.strokeStyle = `rgba(127,208,105,${0.3 + 0.4 * p * puls})`;
      ctx.lineWidth = 3;
      ctx.save(); ctx.translate(cx, GROUND); ctx.scale(1, 0.35);
      ctx.beginPath(); ctx.arc(0, 0, 80 * (0.4 + 0.6 * p), 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 56 * (0.4 + 0.6 * p), 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    } else if (e.kind === "skeleton") {
      ctx.save(); ctx.translate(e.x, e.y); ctx.scale(1, 0.35);
      ctx.strokeStyle = `rgba(138,111,224,${0.35 + 0.35 * puls})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = `rgba(180,160,255,${0.5 + 0.4 * puls})`;
      for (let k = 0; k < 5; k++) {
        const a = t * 1.5 + (k * Math.PI * 2) / 5;
        ctx.fillRect(Math.cos(a) * 34 - 2, Math.sin(a) * 34 - 2, 5, 5);
      }
      ctx.restore();
    } else if (e.kind === "bat") {
      ctx.strokeStyle = `rgba(200,160,255,${0.25 + 0.4 * p * puls})`; ctx.lineWidth = 2;
      ctx.save(); ctx.translate(e.x, e.y - 26 * (e.scale || 1)); ctx.scale(1, 0.5);
      for (let k = 1; k <= 2; k++) { ctx.beginPath(); ctx.arc(0, 0, 18 * k * (0.5 + 0.5 * p), 0, Math.PI * 2); ctx.stroke(); }
      ctx.restore();
    }
  }
}

function drawTimeline(ctx, g) {
  const y = 13, x0 = 110, right = W - 14;
  const sp = (W - 150) / 10;
  /* progress through the current stage: walk-in, then enemy HP burned down */
  let p = 0;
  if (g.phase === "advance") p = clamp(1 - (g.advanceT || 0) / 2.4, 0, 1) * 0.35;
  else if (g.phase === "combat") {
    let hp = 0, mx = 0;
    for (const e of g.enemies) { hp += Math.max(0, e.hp); mx += e.maxHp; }
    if (mx > 0) p = 0.35 + 0.55 * clamp(1 - hp / mx, 0, 1);
  }
  /* backing band */
  ctx.fillStyle = "rgba(12,10,20,0.55)";
  ctx.fillRect(0, 0, W, 22);
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fillRect(0, 22, W, 1);
  /* track */
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.fillRect(92, y, right - 92, 2);
  ctx.font = "7px 'Press Start 2P', monospace";
  ctx.textAlign = "left";
  const ready = g.stage >= 21;
  ctx.fillStyle = ready ? ("rgba(242,193,78," + (0.7 + 0.3 * Math.sin(g.time * 4)).toFixed(3) + ")") : "#f2c14e";
  ctx.fillText("STAGE " + g.stage, 6, 16);
  const hits = [];
  /* pulsing tome beside the label once the tale can be retold */
  if (ready) {
    const bx = 6 + ctx.measureText("STAGE " + g.stage).width + 7;
    if (bx < 76) {
      ctx.globalAlpha = 0.7 + 0.3 * Math.sin(g.time * 4);
      ctx.fillStyle = "#6a4a9e"; ctx.fillRect(bx, 6, 8, 9);
      ctx.fillStyle = "#4e3675"; ctx.fillRect(bx, 6, 2, 9);
      ctx.fillStyle = "#efeaff"; ctx.fillRect(bx + 7, 7, 1, 7);
      ctx.fillStyle = "#f2c14e"; ctx.fillRect(bx + 3, 8, 3, 1); ctx.fillRect(bx + 3, 12, 3, 1);
      ctx.globalAlpha = 1;
      hits.push({ x: bx + 4, kind: "ready" });
    }
  }
  /* upcoming encounters scroll beneath the fixed party marker */
  for (let i = 0; i < 12; i++) {
    const st = g.stage + i;
    const x = Math.round(x0 + (i - p) * sp);
    if (x < 96 || x > right - 4) continue;
    const zc = ZONES[Math.floor((st - 1) / 5) % ZONES.length].top;
    ctx.globalAlpha = x < x0 ? 0.35 : 1;
    if (st === 21 && g.stage <= 21) {
      /* the prestige threshold: a purple tome on the road */
      ctx.fillStyle = "rgba(176,127,224," + (0.2 + 0.12 * Math.sin(g.time * 3)).toFixed(3) + ")";
      ctx.fillRect(x - 7, 1, 14, 15);
      ctx.fillStyle = "#6a4a9e"; ctx.fillRect(x - 4, 3, 8, 9);
      ctx.fillStyle = "#4e3675"; ctx.fillRect(x - 4, 3, 2, 9);
      ctx.fillStyle = "#efeaff"; ctx.fillRect(x + 3, 4, 1, 7);
      ctx.fillStyle = "#f2c14e"; ctx.fillRect(x - 1, 5, 3, 1); ctx.fillRect(x - 1, 9, 3, 1);
      ctx.fillRect(x - 1, 12, 2, 3);
      hits.push({ x, st, kind: "tale" });
    } else if (st % 5 === 0) {
      /* boss: crown */
      ctx.fillStyle = "#f2c14e";
      ctx.fillRect(x - 4, 4, 2, 2); ctx.fillRect(x - 1, 3, 2, 3); ctx.fillRect(x + 2, 4, 2, 2);
      ctx.fillRect(x - 4, 6, 8, 3);
      ctx.fillStyle = "#d0455a"; ctx.fillRect(x - 1, 7, 2, 1);
      ctx.fillStyle = "#f2c14e"; ctx.fillRect(x - 1, 10, 2, 5);
      hits.push({ x, st, kind: "boss" });
    } else if (st % 5 === 3) {
      /* elite: war spikes */
      ctx.fillStyle = "#e77463";
      ctx.fillRect(x - 4, 8, 2, 4); ctx.fillRect(x - 1, 5, 2, 7); ctx.fillRect(x + 2, 8, 2, 4);
      ctx.fillRect(x - 1, 12, 2, 3);
      hits.push({ x, st, kind: "elite" });
    } else {
      /* normal pack, tinted by its zone */
      ctx.fillStyle = zc;
      ctx.fillRect(x - 2, 11, 4, 4);
      hits.push({ x, st, kind: "normal" });
    }
    ctx.globalAlpha = 1;
  }
  /* the party: a banner pointing at the road, with a pulsing position */
  const pulse = 0.55 + 0.45 * Math.sin(g.time * 5);
  ctx.fillStyle = "#f2c14e";
  ctx.fillRect(x0 - 3, 2, 6, 2);
  ctx.fillRect(x0 - 2, 4, 4, 2);
  ctx.fillRect(x0 - 1, 6, 2, 3);
  ctx.fillStyle = "rgba(242,193,78," + pulse.toFixed(3) + ")";
  ctx.fillRect(x0 - 3, 10, 6, 6);
  ctx.fillStyle = "#100e1a";
  ctx.fillRect(x0 - 1, 12, 2, 2);
  hits.push({ x: x0, kind: "party" });
  /* hover tooltips */
  if (g.mx == null || g.my == null || g.my > 24) return;
  let best = null;
  for (const h of hits) {
    const d = Math.abs(g.mx - h.x);
    const rr = h.kind === "party" ? 8 : 11;
    if (d <= rr && (!best || d < best.d)) best = { ...h, d };
  }
  if (!best) return;
  const ELITE_HINTS = { slime: "splits in two on death", bat: "drains life from its prey", skeleton: "raises a fallen warrior", imp: "enrages at half health" };
  let l1 = "", l2 = "", c1 = "#cfc9e8";
  if (best.kind === "party") {
    l1 = "YOUR PARTY"; c1 = "#f2c14e";
    l2 = "Stage " + g.stage + " · " + zoneOf(g).name;
  } else if (best.kind === "ready") {
    l1 = "RETELL THE TALE: READY"; c1 = "#b07fe0";
    l2 = "Visit the Guild Hall to prestige";
  } else {
    const z = ZONES[Math.floor((best.st - 1) / 5) % ZONES.length];
    if (best.kind === "tale") {
      l1 = "STAGE 21 · RETELL THE TALE"; c1 = "#b07fe0";
      l2 = "Prestige unlocks here: earn renown";
    } else if (best.kind === "boss") {
      l1 = "STAGE " + best.st + " · BOSS"; c1 = "#f2c14e";
      l2 = z.label + " King · rich loot awaits";
    } else if (best.kind === "elite") {
      l1 = "STAGE " + best.st + " · ELITE"; c1 = "#e77463";
      l2 = z.eliteLabel + ": " + ELITE_HINTS[z.enemy];
    } else {
      l1 = "STAGE " + best.st; c1 = z.top;
      l2 = z.label + " pack · " + z.name;
    }
  }
  ctx.font = "7px 'Press Start 2P', monospace";
  const tw = Math.max(ctx.measureText(l1).width, ctx.measureText(l2).width) + 14;
  const tx = clamp(best.x - tw / 2, 4, W - tw - 4);
  ctx.fillStyle = c1; ctx.fillRect(best.x - 2, 23, 4, 2);
  ctx.fillStyle = "rgba(16,14,26,0.94)"; ctx.fillRect(tx, 25, tw, 27);
  ctx.fillStyle = c1; ctx.fillRect(tx, 25, tw, 1);
  ctx.textAlign = "left";
  ctx.fillStyle = c1; ctx.fillText(l1, tx + 7, 36);
  ctx.fillStyle = "#8b84ad"; ctx.fillText(l2, tx + 7, 47);
}

export function draw(ctx, g, dt) {
  ctx.imageSmoothingEnabled = false;
  const t = g.time;
  ctx.save();
  if (g.shake > 0.2) ctx.translate((Math.random() * 2 - 1) * g.shake, (Math.random() * 2 - 1) * g.shake * 0.6);
  if (g.phase === "feast") drawFeastBack(ctx, g); else drawScene(ctx, g);
  drawBossTelegraphs(ctx, g);
  const units = [...g.members.map((m) => ({ y: m.y, d: () => drawAdventurer(ctx, m, t) })),
                 ...g.enemies.filter((e) => e.hp > 0).map((e) => ({ y: e.y, d: () => drawEnemy(ctx, e, t) }))];
  units.sort((a, b) => a.y - b.y).forEach((u) => u.d());
  for (const pr of g.projectiles) {
    if (pr.kind === "arrow") {
      ctx.save(); ctx.translate(pr.x, pr.y); ctx.rotate(pr.a || 0);
      ctx.fillStyle = "#8a6b48"; ctx.fillRect(-9, -1, 15, 2);
      ctx.fillStyle = "#e8e2d0"; ctx.fillRect(-11, -3, 3, 2); ctx.fillRect(-11, 1, 3, 2);
      ctx.fillStyle = pr.tint || "#cfd6e0"; ctx.fillRect(6, -3, 6, 6);
      ctx.restore();
    } else {
      ctx.fillStyle = pr.kind === "heal" ? "#7fd069" : (pr.tint || "#b07fe0");
      ctx.fillRect(pr.x - 3, pr.y - 3, 6, 6);
      ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.fillRect(pr.x - 1, pr.y - 1, 3, 3);
    }
  }
  for (let i = g.particles.length - 1; i >= 0; i--) {
    const p = g.particles[i];
    p.life -= dt; p.x += p.vx * 60 * dt; p.y += p.vy * 60 * dt; p.vy += (p.grav || 0) * dt * 8;
    if (p.life <= 0) { g.particles.splice(i, 1); continue; }
    ctx.globalAlpha = clamp(p.life * 2, 0, 1);
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
  }
  ctx.globalAlpha = 1;
  for (let i = g.floaters.length - 1; i >= 0; i--) {
    const f = g.floaters[i];
    f.life -= dt; f.y -= 42 * dt; f.x += (f.vx || 0) * 60 * dt;
    if (f.life <= 0) { g.floaters.splice(i, 1); continue; }
    ctx.globalAlpha = Math.min(1, f.life * 1.6);
    const pop = 1 + Math.max(0, f.life - 0.95) * 5;
    ctx.font = `${Math.round((f.big ? 13 : 9) * pop)}px 'Press Start 2P', monospace`;
    ctx.textAlign = "center";
    ctx.fillStyle = "#14122188"; ctx.fillText(f.text, f.x + 1, f.y + 1);
    ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
    ctx.globalAlpha = 1;
  }
  if (g.phase === "feast") { drawFeastFront(ctx, g); drawFeastLight(ctx, g); }
  else { drawForeground(ctx, g); drawLighting(ctx, g); }
  ctx.restore();
  if (g.phase === "feast") drawFeastBanner(ctx, g); else drawTimeline(ctx, g);
  if (g.vote) {
    ctx.font = "7px 'Press Start 2P', monospace"; ctx.textAlign = "left";
    const keys = new Set(g.members.map((m) => m.key));
    const yes = g.vote.yes.filter((k) => keys.has(k)).length;
    const txt = "RETELL VOTE " + yes + "/" + keys.size + " AYE · " + Math.ceil(Math.max(0, g.vote.t)) + "s";
    const w2 = ctx.measureText(txt).width + 12;
    ctx.fillStyle = "rgba(16,14,26,0.9)"; ctx.fillRect(4, 25, w2, 14);
    ctx.fillStyle = "#b07fe0"; ctx.fillRect(4, 25, w2, 1);
    ctx.fillStyle = "#b07fe0"; ctx.fillText(txt, 10, 35);
  }
  if (g.bossT > 0) {
    ctx.fillStyle = `rgba(190,50,50,${Math.min(0.22, g.bossT * 0.12)})`;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = ((Math.sin(t * 12) + 1) / 2) * 0.85 + 0.15;
    ctx.font = "14px 'Press Start 2P', monospace"; ctx.textAlign = "center";
    ctx.fillStyle = "#ef6461"; ctx.fillText("A MIGHTY FOE APPROACHES", W / 2, 78);
    ctx.globalAlpha = 1;
  }
  const boss = g.enemies.find((e) => e.boss && e.hp > 0);
  if (boss && g.phase === "combat") {
    ctx.font = "10px 'Press Start 2P', monospace"; ctx.textAlign = "center";
    ctx.fillStyle = "#141221cc"; ctx.fillRect(W / 2 - 130, 26, 260, 26);
    ctx.fillStyle = "#f2a94e"; ctx.fillText(boss.name.toUpperCase(), W / 2, 44);
  }
  if (g.phase === "wipe") {
    ctx.fillStyle = "rgba(16,14,26,0.65)"; ctx.fillRect(0, 0, W, H);
    ctx.font = "14px 'Press Start 2P', monospace"; ctx.textAlign = "center";
    ctx.fillStyle = "#ef6461"; ctx.fillText("PARTY WIPED", W / 2, H / 2 - 8);
    ctx.font = "10px 'Press Start 2P', monospace"; ctx.fillStyle = "#cfc9e8";
    ctx.fillText("Regrouping at the last camp...", W / 2, H / 2 + 16);
  }
  if (g.prestigeT > 0) {
    ctx.fillStyle = `rgba(16,14,26,${Math.min(0.55, g.prestigeT * 0.3)})`; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = Math.min(1, g.prestigeT * 1.2);
    ctx.font = "16px 'Press Start 2P', monospace"; ctx.textAlign = "center";
    ctx.fillStyle = "#f2c14e"; ctx.fillText(`CHAPTER ${g.prestiges + 1}`, W / 2, H / 2 - 8);
    ctx.font = "9px 'Press Start 2P', monospace"; ctx.fillStyle = "#cfc9e8";
    ctx.fillText("The legend grows...", W / 2, H / 2 + 16);
    ctx.globalAlpha = 1;
  }
  if (!g.members.length) {
    ctx.font = "10px 'Press Start 2P', monospace"; ctx.textAlign = "center";
    ctx.fillStyle = "#cfc9e8";
    ctx.fillText("The road is empty. The world sleeps.", W / 2, H / 2 - 10);
    ctx.fillText("Join the voice channel to muster the party!", W / 2, H / 2 + 12);
  }
  if (!g.connected) {
    ctx.fillStyle = "rgba(16,14,26,0.7)"; ctx.fillRect(0, 0, W, H);
    ctx.font = "11px 'Press Start 2P', monospace"; ctx.textAlign = "center";
    ctx.fillStyle = "#ef6461"; ctx.fillText("CONNECTING TO THE GUILD...", W / 2, H / 2);
  }
}
