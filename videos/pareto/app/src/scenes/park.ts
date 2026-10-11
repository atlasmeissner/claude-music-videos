// PLATE V — "Exercise, mapped". Last plate of verse 1.
//  A. Bone paper survey map of a park (contours, pond, trees, paths, a stadium-shaped running track).
//     The runner is a red dot whose position IS the karaoke playhead: the line "I'm running 'round the
//     park in my worn-out shoes" is lettered along the bottom straight like a map label, and the dot runs
//     over each glyph as it is sung, leaving a red trail. Tight tracking shot; on "park" the camera snaps
//     out to the whole park. On "worn-out" a detail inset stamps in: the sole, 20% of it worn red.
//  B. On the beat after "shoes" the camera whips out: the map was on TV — the fifth set in a wall of five.
//     Four grey sets show news (shots change on the beat); a broadcast ticker carries "While eighty
//     percent of the world is watching the news."; share bars + bracket: AUDIENCE SHARE 80% / 20% n = 1.
//  Build into the chorus: beat-stepped push toward the red set, the four news sets switch off one per
//  16th, then a whip into the red screen (the map's bone paper fills the frame) and a small flash.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D } from '../engine/gl';
import { rgba } from '../engine/palette';
import { F, font, layout } from '../engine/type';
import { Lyrics, type Line, type Word } from '../engine/lyrics';
import { clamp, ease, frameIdx, hash, keys, lerp, mulberry32, noise2, prog, TAU } from '../engine/util';
import { Ground, drawKaraokeWords, drawPlateHead, footnote, fg, RED, isKey, PAPER_POST, INK_POST, type C2D } from './_kit';
import { beats, camera, mono, pulses, scanlines, steps, typed, wd } from './park-lib';

// ---------------------------------------------------------------- map geometry (map units)
const TR = { a: 800, R: 300 };
const LAP = 4 * TR.a + TAU * TR.R;
/** Point on the stadium track at arc length s (s = 0: bottom-left, heading +x). */
function trackAt(s: number): { x: number; y: number } {
  const { a, R } = TR;
  s = ((s % LAP) + LAP) % LAP;
  if (s < 2 * a) return { x: -a + s, y: R };
  s -= 2 * a;
  if (s < Math.PI * R) { const f = Math.PI / 2 - s / R; return { x: a + R * Math.cos(f), y: R * Math.sin(f) }; }
  s -= Math.PI * R;
  if (s < 2 * a) return { x: a - s, y: -R };
  s -= 2 * a;
  const f = -Math.PI / 2 - s / R;
  return { x: -a + R * Math.cos(f), y: R * Math.sin(f) };
}
/** The map as shown on the TV: this map rect fills the screen. */
const MAPR = { w: 2300, h: 1900 };

// ---------------------------------------------------------------- the TV wall (wall px)
const TV = { w: 318, h: 252, gap: 26, y: 262, sx: 16, sy: 16, sw: 248, sh: 200 };
const MS = TV.sw / MAPR.w; // map unit → wall px
const TVX0 = (1920 - (5 * TV.w + 4 * TV.gap)) / 2;
const tvX = (i: number) => TVX0 + i * (TV.w + TV.gap);
const S5 = { x: tvX(4) + TV.sx, y: TV.y + TV.sy, w: TV.sw, h: TV.sh };
const TVC = { x: S5.x + S5.w / 2, y: S5.y + S5.h / 2 };

type Poly = { x: number; y: number }[];

export default class Park extends Scene {
  g = new Ground();
  L = new Layer2D();
  G = new Layer2D(1920, 1080, 0.5); // low-res glow under the crisp reds (dark half only)
  l1!: Line; l2!: Line;
  T = {
    park: 0, worn: 0, shoes: 0, z0: 0, z1: 0, db2: 0, world: 0, build: [] as number[], offs: [] as number[], whip: 0,
    beats: [] as number[],
  };
  // map
  contours: { pts: Poly; major: boolean; lvl: number }[] = [];
  trees: { x: number; y: number; r: number }[] = [];
  pond: Poly = [];
  paths: Poly[] = [];
  // line 1 along the track
  w1: { w: Word; x: number; width: number }[] = [];
  textY = TR.R + 96;
  textSize = 66;
  textFam = F.archivo(100, 800);
  // ticker
  w2: { w: Word; x: number; width: number }[] = [];
  tkSize = 74;
  tkFam = F.archivo(87.5, 800);

  override init() {
    const ly = this.ctx.lyrics, au = this.ctx.audio, B = beats(au), T = this.T;
    this.l1 = ly.get("running 'round the park");
    this.l2 = ly.get('watching the news');
    T.park = wd(this.l1, 'park').start;
    T.worn = wd(this.l1, 'worn').start;
    T.shoes = wd(this.l1, 'shoes').start;
    T.z0 = this.l1.end; // the whip-out starts as "shoes" ends (the pickup "While")
    T.z1 = B.after(this.l2.words[1]!.start - 0.08); // lands on "eighty"
    T.db2 = B.downAfter(T.z1 + 0.1);
    T.world = wd(this.l2, 'world').start;
    const end = this.ctx.end;
    const lastDb = [...au.downbeats].reverse().find((d) => d < end - 0.5)!;
    T.build = B.list(lastDb - 0.01, end - 0.1);
    // the four news sets switch off one per 8th over the last beat-and-a-half; then the whip into the red set
    const lastBeat = B.before(end - 0.05);
    const b8 = (end - lastBeat) / 2;
    T.offs = [0, 1, 2, 3].map((i) => lastBeat - 2 * b8 + i * b8);
    T.whip = lastBeat + b8;
    T.beats = B.list(this.ctx.start - 0.01, end + 0.01);

    // --- map
    const rnd = mulberry32(5);
    const hill = (cx: number, cy: number, n: number, r0: number, dr: number, seed: number, rx = 1, ry = 0.8) => {
      for (let k = 0; k < n; k++) {
        const r = r0 + k * dr;
        const pts: Poly = [];
        for (let i = 0; i <= 96; i++) {
          const a = (i / 96) * TAU;
          const q = 1 + 0.22 * noise2(Math.cos(a) * 1.3 + seed, Math.sin(a) * 1.3 + k * 0.08, seed) + 0.06 * noise2(Math.cos(a) * 4, Math.sin(a) * 4 + k * 0.2, seed + 1);
          pts.push({ x: cx + Math.cos(a) * r * rx * q, y: cy + Math.sin(a) * r * ry * q });
        }
        this.contours.push({ pts, major: k % 4 === 0, lvl: (n - k) * 2.5 });
      }
    };
    hill(700, -720, 12, 50, 52, 3, 1.25, 0.8);
    hill(-950, 760, 10, 40, 50, 9, 1.1, 0.75);
    hill(1250, 640, 7, 40, 45, 13, 1, 0.9);
    // pond inside the loop
    for (let i = 0; i <= 80; i++) {
      const a = (i / 80) * TAU;
      const q = 1 + 0.18 * noise2(Math.cos(a) * 1.5, Math.sin(a) * 1.5, 21);
      this.pond.push({ x: -170 + Math.cos(a) * 270 * q, y: -10 + Math.sin(a) * 125 * q });
    }
    // paths: gentle curves from the track out to the map edge
    const curve = (p0: [number, number], p1: [number, number], p2: [number, number]) => {
      const pts: Poly = [];
      for (let i = 0; i <= 30; i++) {
        const u = i / 30;
        pts.push({ x: (1 - u) ** 2 * p0[0] + 2 * u * (1 - u) * p1[0] + u * u * p2[0], y: (1 - u) ** 2 * p0[1] + 2 * u * (1 - u) * p1[1] + u * u * p2[1] });
      }
      this.paths.push(pts);
    };
    curve([200, -300], [320, -620], [180, -1000]);
    curve([-1100, 0], [-1350, -200], [-1500, -520]);
    curve([300, 300], [450, 650], [820, 1000]);
    curve([1100, 0], [1350, 120], [1600, -60]);
    curve([-400, 300], [-520, 640], [-300, 1000]);
    // trees (avoid track band, pond, paths)
    const nearTrack = (x: number, y: number) => {
      const cx = clamp(x, -TR.a, TR.a);
      const d = Math.hypot(x - cx, y) - TR.R;
      return Math.abs(d) < 70;
    };
    for (let i = 0; i < 900 && this.trees.length < 230; i++) {
      const x = (rnd() * 2 - 1) * 1500, y = (rnd() * 2 - 1) * 1050;
      const r = 9 + rnd() * 16;
      if (nearTrack(x, y)) continue;
      if (((x + 170) / 300) ** 2 + ((y + 10) / 150) ** 2 < 1) continue;
      if (Math.abs(y - TR.R - 70) < 70 && Math.abs(x) < 900) continue; // keep the label lane clear
      if (Math.hypot(x - 420, y + 40) < 90 || (x > 400 && x < 760 && Math.abs(y + 30) < 30)) continue;
      if (this.paths.some((p) => p.some((q) => Math.hypot(q.x - x, q.y - y) < 40))) continue;
      if (this.trees.some((q) => Math.hypot(q.x - x, q.y - y) < q.r + r + 6)) continue;
      // clumps: denser in some areas
      if (noise2(x * 0.002, y * 0.002, 4) < -0.1) continue;
      this.trees.push({ x, y, r });
    }
    // line 1 along the bottom straight
    const c = this.L.ctx;
    c.font = font(this.textFam, this.textSize);
    const sp = c.measureText(' ').width;
    let x = -TR.a + 50;
    for (const w of this.l1.words) {
      const width = layout(w.w, this.textFam, this.textSize).width;
      this.w1.push({ w, x, width });
      x += width + sp;
    }
    c.font = font(this.tkFam, this.tkSize);
    const sp2 = c.measureText(' ').width;
    x = 0;
    for (const w of this.l2.words) {
      const width = layout(w.w, this.tkFam, this.tkSize).width;
      this.w2.push({ w, x, width });
      x += width + sp2;
    }
  }

  // ---------------------------------------------------------------- runner
  /** x along the label for time t: the glyph being sung (piecewise over word timings). */
  labelX(t: number) {
    const ws = this.w1;
    const x0 = -TR.a, t0 = this.ctx.start;
    if (t <= ws[0]!.w.start) return lerp(x0, ws[0]!.x, ease.inOutQuad(prog(t, t0, ws[0]!.w.start)));
    for (let i = 0; i < ws.length; i++) {
      const a = ws[i]!;
      if (t < a.w.end) {
        return a.x + a.width * Lyrics.wordProgress(a.w, t);
      }
      const b = ws[i + 1];
      if (b && t < b.w.start) return lerp(a.x + a.width, b.x, (t - a.w.end) / (b.w.start - a.w.end));
    }
    return ws[ws.length - 1]!.x + ws[ws.length - 1]!.width;
  }
  runnerS(t: number) {
    const ws = this.w1, last = ws[ws.length - 1]!;
    const te = last.w.end;
    if (t <= te) return this.labelX(t) + TR.a;
    const s0 = last.x + last.width + TR.a;
    const dt = t - te, v0 = 380, dv = 2200, ramp = 0.6;
    return s0 + v0 * dt + dv * (dt < ramp ? (dt ** 3) / (3 * ramp * ramp) : ramp / 3 + (dt - ramp));
  }

  // ---------------------------------------------------------------- cameras
  /** Part A camera in map units: centre + zoom. */
  camA(t: number) {
    const T = this.T;
    const rx = trackAt(this.runnerS(t)).x;
    const zin = 1.45 * (1 + 0.12 * (1 - ease.outExpo(prog(t, this.ctx.start, this.ctx.start + 0.5))));
    const follow = { x: rx + 270, y: 250, z: zin };
    const wideZ = 0.95 + 0.06 * prog(t, T.park + 0.4, T.z0, ease.inOutQuad);
    const wide = { x: -10, y: 80, z: wideZ * (1 + 0.025 * ease.outExpo(prog(t, T.worn, T.worn + 0.3)) * (1 - prog(t, T.worn + 0.3, T.z0))) };
    const k = ease.outExpo(prog(t, T.park, T.park + 0.42));
    return { x: lerp(follow.x, wide.x, k), y: lerp(follow.y, wide.y, k), z: Math.exp(lerp(Math.log(follow.z), Math.log(wide.z), k)) };
  }
  /** Wall camera (wall px): centre + zoom, valid for every t (part A maps through the TV). */
  camB(t: number) {
    const T = this.T;
    const a = this.camA(Math.min(t, T.z0));
    const Z0 = a.z / MS, C0 = { x: TVC.x + a.x * MS, y: TVC.y + a.y * MS };
    if (t <= T.z0) return { x: C0.x, y: C0.y, z: Z0 };
    const u = ease.outCubic(prog(t, T.z0, T.z1));
    let z = Math.exp(lerp(Math.log(Z0), 0, u));
    // keep screen motion even: blend centres by 1/zoom
    const w = (1 / z - 1 / Z0) / (1 - 1 / Z0);
    let x = lerp(C0.x, 960, w), y = lerp(C0.y, 540, w);
    // after landing: downbeat breaths, then the beat-stepped push toward the red set, then the whip in
    const settle = 1 + 0.035 * (1 - ease.outCubic(prog(t, T.z1, T.z1 + 0.5)));
    z *= settle * (1 + 0.012 * steps(t, [T.db2], 0.4));
    const push = steps(t, T.build.slice(0, 3), 0.32) / 3;
    z *= 1 + 0.16 * push;
    x = lerp(x, 1180, push * 0.55); y = lerp(y, 470, push * 0.55);
    const wk = ease.inCubic(prog(t, T.whip, this.ctx.end));
    if (wk > 0) {
      const ze = 1920 / S5.w * 1.12;
      const zz = Math.exp(lerp(Math.log(z), Math.log(ze), wk));
      const ww = (1 / zz - 1 / z) / (1 / ze - 1 / z);
      x = lerp(x, TVC.x, ww); y = lerp(y, TVC.y, ww); z = zz;
    }
    z *= 1 + 0.006 * this.ctx.audio.hit('kick', t, 0.08);
    return { x, y, z };
  }

  // ---------------------------------------------------------------- render
  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    const t = f.t, T = this.T;
    const partB = t >= T.z0;
    this.g.render(renderer, out, partB ? { paper: 0, vig: 0 } : { paper: 1, grid: 0, vig: 0.2 });
    const c = this.L.ctx; this.L.clear();
    const gc = this.G.ctx; this.G.clear();
    const cam = this.camB(t);

    // ---- the wall (part B)
    if (partB) {
      c.save();
      camera(c, cam.x, cam.y, cam.z);
      this.drawWall(c, gc, t, cam);
      c.restore();
    }

    // ---- the map (inside the red set's screen once the wall exists)
    c.save();
    camera(c, cam.x, cam.y, cam.z);
    if (partB) {
      c.beginPath(); c.roundRect(S5.x, S5.y, S5.w, S5.h, 16); c.clip();
      c.fillStyle = rgba('bone'); c.fillRect(S5.x, S5.y, S5.w, S5.h);
    }
    c.translate(TVC.x, TVC.y); c.scale(MS, MS);
    this.drawMap(c, t, 1 / (cam.z * MS));
    c.restore();
    if (partB) {
      // CRT on the red set: scanlines + a beat flicker, fading in with the whip-out
      const k = prog(t, T.z0, T.z1) * (1 - prog(t, T.whip + 0.12, this.ctx.end));
      if (k > 0) {
        c.save();
        camera(c, cam.x, cam.y, cam.z);
        c.beginPath(); c.roundRect(S5.x, S5.y, S5.w, S5.h, 16); c.clip();
        scanlines(c, S5.x, S5.y, S5.w, S5.h, 0.16 * k, 3);
        const vg = c.createRadialGradient(TVC.x, TVC.y, S5.h * 0.3, TVC.x, TVC.y, S5.w * 0.75);
        vg.addColorStop(0, 'rgba(12,12,14,0)'); vg.addColorStop(1, `rgba(12,12,14,${0.45 * k})`);
        c.fillStyle = vg; c.fillRect(S5.x, S5.y, S5.w, S5.h);
        c.restore();
      }
      this.drawScreenB(c, t);
    } else {
      this.drawScreenA(c, t, cam);
    }

    comp.draw(renderer, this.L.upload(), out);
    if (partB) comp.draw(renderer, this.G.upload(), out, { mode: 'add', tint: [0.9, 0.9, 0.9] });

    const flash = 0.4 * prog(t, this.ctx.end - 0.07, this.ctx.end, ease.inQuad);
    if (!partB) return { ...PAPER_POST, bloom: 0.2 };
    return { ...INK_POST, bloom: 0.45, bloomThreshold: 0.95, flash, vignette: 0.3 };
  }

  // ---------------------------------------------------------------- the map
  drawMap(c: C2D, t: number, px: number) {
    const T = this.T;
    const detail = px < 3; // map units per screen px: skip fine detail when tiny
    c.lineCap = 'round'; c.lineJoin = 'round';
    // survey grid
    c.strokeStyle = rgba('ash', 0.35); c.lineWidth = px;
    c.beginPath();
    for (let x = -1500; x <= 1500; x += 250) { c.moveTo(x, -1100); c.lineTo(x, 1100); }
    for (let y = -1000; y <= 1000; y += 250) { c.moveTo(-1600, y); c.lineTo(1600, y); }
    c.stroke();
    if (detail) {
      c.font = font(F.mono(400), 11 * px); c.fillStyle = rgba('graphite', 0.7); c.textAlign = 'left';
      for (let x = -1500; x <= 1500; x += 250) c.fillText(`${28 + (x + 1500) / 250}`.padStart(2, '0'), x + 4 * px, -1000 + 14 * px);
    }
    // contours
    for (const k of this.contours) {
      c.strokeStyle = k.major ? rgba('graphite', 0.75) : rgba('ash', 0.75);
      c.lineWidth = (k.major ? 1.3 : 0.8) * px;
      c.beginPath();
      k.pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
      c.stroke();
      if (k.major && detail) {
        const p = k.pts[20]!;
        c.save(); c.font = font(F.mono(400), 11 * px); c.fillStyle = rgba('graphite', 0.85);
        c.fillStyle = rgba('bone'); c.fillRect(p.x - 18 * px, p.y - 8 * px, 36 * px, 14 * px);
        c.fillStyle = rgba('graphite', 0.9); c.textAlign = 'center'; c.fillText(`${(40 + k.lvl).toFixed(0)}`, p.x, p.y + 4 * px);
        c.restore();
      }
    }
    // paths (dashed double line)
    c.strokeStyle = rgba('graphite', 0.8); c.lineWidth = px;
    c.setLineDash([10 * px, 6 * px]);
    for (const p of this.paths) {
      for (const off of [-9, 9]) {
        c.beginPath();
        p.forEach((q, i) => {
          const r = p[Math.min(p.length - 1, i + 1)]!, l = p[Math.max(0, i - 1)]!;
          const dx = r.x - l.x, dy = r.y - l.y, n = Math.hypot(dx, dy) || 1;
          const x = q.x - (dy / n) * off, y = q.y + (dx / n) * off;
          i ? c.lineTo(x, y) : c.moveTo(x, y);
        });
        c.stroke();
      }
    }
    c.setLineDash([]);
    // pond: outline + horizontal hatch
    c.save();
    c.beginPath(); this.pond.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.closePath();
    c.strokeStyle = fg(true, 0.85); c.lineWidth = 1.4 * px; c.stroke();
    c.clip();
    c.strokeStyle = rgba('graphite', 0.55); c.lineWidth = 0.8 * px;
    c.beginPath();
    const drift = ((t * 14) % 12);
    for (let y = -170; y < 160; y += 12) {
      const yy = y + drift;
      for (let x = -480 + (hash(y, 3) * 60); x < 140; x += 70 + hash(x, y) * 50) { c.moveTo(x, yy); c.lineTo(x + 34 + hash(y, x) * 30, yy); }
    }
    c.stroke();
    c.restore();
    if (detail) {
      c.font = font(F.serif(400, true), 34 * Math.max(1, px * 0.8)); c.fillStyle = fg(true, 0.8); c.textAlign = 'center';
      c.fillText('The Pond', -170, 0);
      c.font = font(F.mono(400), 11 * px); c.fillStyle = rgba('graphite', 0.9);
      c.fillText('DUCKS 20% · BREAD 80%', -170, 22);
    }
    // trees
    c.strokeStyle = rgba('graphite', 0.7); c.lineWidth = 0.9 * px;
    c.beginPath();
    for (const tr of this.trees) { c.moveTo(tr.x + tr.r, tr.y); c.arc(tr.x, tr.y, tr.r, 0, TAU); }
    c.stroke();
    if (detail) {
      c.fillStyle = rgba('graphite', 0.75);
      c.beginPath();
      for (const tr of this.trees) { c.moveTo(tr.x + 1.6 * px, tr.y); c.arc(tr.x, tr.y, 1.6 * px, 0, TAU); }
      c.fill();
    }
    // bandstand + benches
    c.strokeStyle = fg(true, 0.8); c.lineWidth = 1.1 * px;
    c.beginPath();
    for (let i = 0; i <= 8; i++) { const a = (i / 8) * TAU + Math.PI / 8; const x = 420 + Math.cos(a) * 46, y = -40 + Math.sin(a) * 46; i ? c.lineTo(x, y) : c.moveTo(x, y); }
    c.stroke();
    if (detail) {
      c.font = font(F.mono(500), 11 * px); c.fillStyle = rgba('graphite', 0.95); c.textAlign = 'left';
      c.fillText('BANDSTAND', 476, -36);
      c.fillText('(SILENT SINCE 1987)', 476, -22);
      for (const bx of [-500, 0, 500]) { c.strokeRect(bx - 22, -TR.R - 46, 44, 9); }
      c.fillText('BENCH, UNSAT ON', 528, -TR.R - 38);
    }
    // the track: lane lines + distance ticks
    const lane = (off: number) => {
      c.beginPath();
      c.moveTo(-TR.a, TR.R + off); c.lineTo(TR.a, TR.R + off);
      c.arc(TR.a, 0, TR.R + off, Math.PI / 2, -Math.PI / 2, true);
      c.lineTo(-TR.a, -TR.R - off);
      c.arc(-TR.a, 0, TR.R + off, -Math.PI / 2, -Math.PI * 1.5, true);
      c.closePath();
      c.stroke();
    };
    c.strokeStyle = fg(true, 0.9); c.lineWidth = 1.2 * px;
    lane(-20); lane(20);
    c.strokeStyle = rgba('ash', 0.8); c.lineWidth = 0.8 * px; c.setLineDash([6 * px, 8 * px]); lane(0); c.setLineDash([]);
    if (detail) {
      c.font = font(F.mono(500), 11 * px); c.fillStyle = rgba('graphite', 0.95); c.textAlign = 'center';
      for (let s = 500, m = 50; s < LAP; s += 500, m += 50) {
        const p = trackAt(s), q = trackAt(s + 1);
        const nx = -(q.y - p.y), ny = q.x - p.x, n = Math.hypot(nx, ny);
        c.beginPath(); c.moveTo(p.x + (nx / n) * 20, p.y + (ny / n) * 20); c.lineTo(p.x + (nx / n) * 34, p.y + (ny / n) * 34); c.stroke();
        if (p.y < TR.R - 1) c.fillText(`${m} m`, p.x - (nx / n) * 44, p.y - (ny / n) * 44 + 4);
      }
      // start / finish
      c.fillStyle = fg(true, 0.9);
      for (let i = 0; i < 4; i++) c.fillRect(-TR.a - 6 + (i % 2) * 6, TR.R - 20 + i * 10, 6, 10);
      c.font = font(F.mono(600), 12 * px); c.textAlign = 'right';
      c.fillText('START', -TR.a - 16, TR.R - 4);
      c.fillText('FINISH', -TR.a - 16, TR.R + 12);
      // title cartouche
      c.textAlign = 'left';
      c.font = font(F.serif(600, true), 64); c.fillStyle = fg(true, 0.9);
      c.fillText('The Park', -1100, -840);
      c.font = font(F.mono(500), 14); c.fillStyle = rgba('graphite', 1);
      c.fillText('SURVEYED AT A JOG · SCALE 1 : 2 500 · CONTOURS AT 2.5 m', -1100, -812);
      c.strokeStyle = fg(true, 0.6); c.lineWidth = px;
      c.strokeRect(-1130, -920, 560, 128);
    }
    // line 1 lettered along the bottom straight (a map label; the runner is its playhead)
    drawKaraokeWords(c, this.l1.words, t, this.w1[0]!.x, this.textY, { family: this.textFam, size: this.textSize, paper: true, dim: 0.22, lead: 0.3 });
    // trail + runner
    const s = this.runnerS(t);
    c.strokeStyle = RED(); c.lineWidth = 3.2 * Math.max(px, 0.9);
    c.beginPath();
    const sMin = Math.max(0, s - LAP * 0.98);
    for (let q = sMin; q <= s; q += 16) { const p = trackAt(q); q === sMin ? c.moveTo(p.x, p.y) : c.lineTo(p.x, p.y); }
    const rp = trackAt(s);
    c.lineTo(rp.x, rp.y);
    c.stroke();
    // footfalls: a ring on every beat
    const bi = this.T.beats.filter((b) => b <= t).pop();
    const ring = bi !== undefined ? prog(t, bi, bi + 0.4) : 1;
    const rpx = Math.max(px, 0.35);
    if (ring < 1) {
      c.strokeStyle = RED(1 - ring); c.lineWidth = 1.5 * rpx;
      c.beginPath(); c.arc(rp.x, rp.y, (12 + 26 * ease.outCubic(ring)) * rpx, 0, TAU); c.stroke();
    }
    c.fillStyle = RED();
    c.beginPath(); c.arc(rp.x, rp.y, 10 * rpx, 0, TAU); c.fill();
    if (detail && t < T.z0) {
      c.font = font(F.mono(600), 12 * px); c.fillStyle = RED(); c.textAlign = 'left';
      c.fillText('YOU', rp.x + 16 * px, rp.y - 16 * px);
    }
  }

  // ---------------------------------------------------------------- part A screen furniture
  drawScreenA(c: C2D, t: number, cam: { x: number; y: number; z: number }) {
    const T = this.T, t0 = this.ctx.start;
    drawPlateHead(c, 5, 'Exercise, mapped', (t - t0) / 0.6, { paper: true, right: 'THE PARK, 1 : 2 500' });
    // lap readout
    const s = this.runnerS(t);
    const km = (s * 0.1) / 1000;
    const el = Math.max(0.01, t - t0);
    const pace = (el / 60) / Math.max(0.001, km); // min per km
    const pm = Math.floor(pace), ps = Math.floor((pace - pm) * 60);
    const k = prog(t, t0 + 0.2, t0 + 0.8);
    mono(c, typed(`LAP 1 OF 1   DIST ${km.toFixed(3)} km   PACE ${km > 0.002 ? `${Math.min(pm, 99)}′${String(ps).padStart(2, '0')}″/km (WIND-ASSISTED)` : '—'}`, k), 1824, 1016, 14, fg(true, 0.75), 'right');
    footnote(c, '¹ n = 1 runner. Shoes: one pair, of a certain age. Ducks not surveyed individually.', 96, 1016, { paper: true, a: k });
    // DETAIL A: the sole (stamps in on "worn-out")
    const ka = ease.outBack(prog(t, T.worn - 0.04, T.worn + 0.3));
    const kout = ease.inBack(prog(t, T.z0 - 0.2, T.z0));
    const sc = ka * (1 - kout);
    if (sc > 0.001) {
      const cx = 1540, cy = 380, R = 190;
      // runner on screen
      const rp = trackAt(s);
      const sx = (rp.x - cam.x / 1) * 1, sy = rp.y; void sx; void sy;
      const a = this.camA(t);
      const rx = (rp.x - a.x) * a.z + 960, ry = (rp.y - a.y) * a.z + 540;
      // leader
      const ang = Math.atan2(ry - cy, rx - cx);
      c.save();
      c.strokeStyle = fg(true, 0.6 * sc); c.lineWidth = 1;
      c.setLineDash([4, 4]);
      c.beginPath(); c.moveTo(cx + Math.cos(ang) * R * sc, cy + Math.sin(ang) * R * sc); c.lineTo(rx, ry); c.stroke();
      c.setLineDash([]);
      c.translate(cx, cy); c.scale(sc, sc);
      c.fillStyle = rgba('bone'); c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fill();
      c.strokeStyle = fg(true, 0.9); c.lineWidth = 1.5; c.stroke();
      c.strokeStyle = fg(true, 0.35); c.lineWidth = 1; c.beginPath(); c.arc(0, 0, R - 8, 0, TAU); c.stroke();
      this.drawSole(c, t);
      c.restore();
      const kt = prog(t, T.worn + 0.15, T.worn + 0.7);
      mono(c, typed('DETAIL A — SOLE, LEFT, TREAD SIDE', kt), cx - R, cy + R + 34, 14, fg(true, 0.8 * (1 - kout)));
      mono(c, typed('20% OF THE SOLE DOES 80% OF THE WEAR', prog(t, T.worn + 0.4, T.worn + 1.0)), cx - R, cy + R + 56, 14, RED(1 - kout));
    }
  }

  drawSole(c: C2D, t: number) {
    const T = this.T;
    const L = 290;
    c.save();
    c.rotate(-0.42);
    const prof = (v: number) => {
      const w = 0.17 + 0.16 * Math.exp(-(((v - 0.28) / 0.2) ** 2)) + 0.07 * Math.exp(-(((v - 0.86) / 0.12) ** 2));
      return L * w * 0.5 * Math.pow(Math.max(0, 1 - Math.pow(2 * v - 1, 10)), 0.5);
    };
    const path = new Path2D();
    const N = 40;
    for (let i = 0; i <= N; i++) { const v = i / N; const y = -L / 2 + v * L; const x = prof(v) + (v - 0.5) * 12; i ? path.lineTo(x, y) : path.moveTo(x, y); }
    for (let i = N; i >= 0; i--) { const v = i / N; const y = -L / 2 + v * L; const x = -prof(v) * 0.92 + (v - 0.5) * 12; path.lineTo(x, y); }
    path.closePath();
    c.save();
    c.clip(path);
    // worn fifth: the ball of the foot (v 0.16..0.36)
    const wk = ease.outExpo(prog(t, T.worn + 0.2, T.worn + 0.6));
    const y0 = -L / 2 + 0.16 * L, y1 = -L / 2 + 0.36 * L;
    // tread bars
    c.strokeStyle = fg(true, 0.7); c.lineWidth = 2.6;
    c.beginPath();
    for (let y = -L / 2 + 6; y < L / 2; y += 12) {
      if (y > y0 - 3 && y < y1 + 3 && wk > 0.5) continue;
      c.moveTo(-80, y + 6); c.lineTo(0, y); c.lineTo(80, y + 6);
    }
    c.stroke();
    if (wk > 0) {
      c.fillStyle = RED(); c.fillRect(-90, y0, 180 * wk, y1 - y0);
      c.strokeStyle = rgba('blood', 0.6); c.lineWidth = 1;
      c.beginPath();
      for (let y = y0 + 6; y < y1; y += 9) { c.moveTo(-90, y); c.lineTo(-90 + 180 * wk, y + 4); }
      c.stroke();
    }
    c.restore();
    c.strokeStyle = fg(true, 0.95); c.lineWidth = 2; c.stroke(path);
    // dimension: 20% / 80%
    const dx = 96;
    c.strokeStyle = fg(true, 0.7); c.lineWidth = 1;
    c.beginPath();
    c.moveTo(dx, -L / 2); c.lineTo(dx, L / 2);
    for (const y of [-L / 2, y0, y1, L / 2]) { c.moveTo(dx - 5, y); c.lineTo(dx + 5, y); }
    c.stroke();
    c.strokeStyle = RED(); c.lineWidth = 3;
    c.beginPath(); c.moveTo(dx, y0); c.lineTo(dx, y1); c.stroke();
    c.rotate(Math.PI / 2);
    c.font = font(F.mono(600), 13); c.textAlign = 'center';
    c.fillStyle = RED(); c.fillText('20%', (y0 + y1) / 2, -dx - 10);
    c.fillStyle = fg(true, 0.7); c.fillText('80%', (y1 + L / 2) / 2, -dx - 10);
    c.restore();
  }

  // ---------------------------------------------------------------- the wall
  drawWall(c: C2D, gc: C2D, t: number, cam: { x: number; y: number; z: number }) {
    const T = this.T, au = this.ctx.audio;
    const bIdx = Math.floor(au.beatAt(t) + 1e-4);
    for (let i = 0; i < 5; i++) {
      const x = tvX(i), y = TV.y;
      // body
      c.fillStyle = rgba('ink2'); c.strokeStyle = rgba('graphite', 0.9); c.lineWidth = 1.2;
      c.beginPath(); c.roundRect(x, y, TV.w, TV.h, 14); c.fill(); c.stroke();
      // legs + antenna
      c.beginPath();
      c.moveTo(x + 40, y + TV.h); c.lineTo(x + 28, y + TV.h + 22);
      c.moveTo(x + TV.w - 40, y + TV.h); c.lineTo(x + TV.w - 28, y + TV.h + 22);
      c.moveTo(x + TV.w / 2, y); c.lineTo(x + TV.w / 2 - 46, y - 52);
      c.moveTo(x + TV.w / 2, y); c.lineTo(x + TV.w / 2 + 38, y - 58);
      c.stroke();
      // knobs + speaker slats
      const kx = x + TV.sx + TV.sw + (TV.w - TV.sx - TV.sw) / 2;
      for (const ky of [y + 46, y + 96]) {
        c.beginPath(); c.arc(kx, ky, 13, 0, TAU); c.stroke();
        const a = hash(i, ky) * TAU + (i === 4 ? 0 : bIdx * 0.3);
        c.beginPath(); c.moveTo(kx, ky); c.lineTo(kx + Math.cos(a) * 11, ky + Math.sin(a) * 11); c.stroke();
      }
      c.beginPath();
      for (let k = 0; k < 6; k++) { c.moveTo(kx - 14, y + 140 + k * 12); c.lineTo(kx + 14, y + 140 + k * 12); }
      c.stroke();
      if (i < 4) this.drawNews(c, i, x + TV.sx, y + TV.sy, TV.sw, TV.sh, t, bIdx);
      // channel labels
      const lk = prog(t, T.z1 - 0.1 + i * 0.06, T.z1 + 0.3 + i * 0.06);
      const names = ['CH 1 · NEWS', 'CH 2 · NEWS', 'CH 3 · MORE NEWS', 'CH 4 · NEWS, AGAIN', 'CH 5 · THE PARK'];
      mono(c, typed(names[i]!, lk), x + 4, y + TV.h + 50, 14, i === 4 ? rgba('bone', 0.9) : rgba('ash', 0.9));
    }
    // red set rim (glows)
    gc.save();
    camera(gc, cam.x, cam.y, cam.z);
    const pk = pulses(t, T.build, 0.18);
    for (const k of [c, gc]) {
      k.strokeStyle = RED(0.85 + 0.15 * pk); k.lineWidth = 2.5 + 3 * pk;
      k.beginPath(); k.roundRect(S5.x - 5, S5.y - 5, S5.w + 10, S5.h + 10, 19); k.stroke();
    }
    // share bars
    const by = TV.y + TV.h + 66;
    for (let i = 0; i < 5; i++) {
      const k = ease.outExpo(prog(t, T.db2 + i * 0.155, T.db2 + i * 0.155 + 0.4));
      if (k <= 0) continue;
      if (i < 4) { c.fillStyle = rgba('graphite', 1); c.fillRect(tvX(i), by, TV.w * k, 12); }
      else for (const q of [c, gc]) { q.fillStyle = RED(); q.fillRect(tvX(i), by, TV.w * k, 12); }
      mono(c, '20%', tvX(i) + TV.w, by + 32, 13, i === 4 ? RED(k) : rgba('ash', 0.8 * k), 'right');
    }
    gc.restore();
    // bracket over the four news sets
    const bk = ease.outExpo(prog(t, T.db2 + 0.7, T.db2 + 1.2));
    if (bk > 0) {
      const y = by + 50, x0 = tvX(0), x1 = tvX(3) + TV.w, xm = (x0 + x1) / 2;
      c.strokeStyle = rgba('bone', 0.7); c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(x0, y - 8); c.lineTo(x0, y); c.lineTo(lerp(x0, xm, bk), y);
      c.moveTo(x1, y - 8); c.lineTo(x1, y); c.lineTo(lerp(x1, xm, bk), y);
      c.moveTo(xm, y); c.lineTo(xm, y + 8 * bk);
      c.stroke();
      mono(c, typed('AUDIENCE SHARE  80%', prog(t, T.db2 + 0.9, T.db2 + 1.5)), xm, y + 32, 17, rgba('bone', 0.9), 'center', 'Plex-600');
      mono(c, typed('n = 1 (RUNNING)', prog(t, T.db2 + 1.0, T.db2 + 1.5)), tvX(4) + TV.w / 2, y + 32, 17, RED(), 'center', 'Plex-600');
    }
  }

  /** A news set's screen: grey shots that cut on the beat, scanlines, CRT switch-off at the end. */
  drawNews(c: C2D, i: number, x: number, y: number, w: number, h: number, t: number, bIdx: number) {
    const T = this.T;
    const tOff = T.offs[i]!;
    const ko = prog(t, tOff, tOff + 0.13);
    c.save();
    c.beginPath(); c.roundRect(x, y, w, h, 16); c.clip();
    c.fillStyle = '#101012'; c.fillRect(x, y, w, h);
    if (ko >= 1) { c.restore(); return; }
    const fl = 0.92 + 0.08 * hash(frameIdx(t), i);
    const sq = ko > 0 ? Math.max(0.012, 1 - ease.inQuad(clamp(ko / 0.55))) : 1;
    c.save();
    c.translate(x + w / 2, y + h / 2); c.scale(1, sq); c.translate(-(x + w / 2), -(y + h / 2));
    const g = c.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, `rgba(94,91,87,${0.55 * fl})`); g.addColorStop(1, `rgba(40,39,38,${0.9 * fl})`);
    c.fillStyle = g; c.fillRect(x, y, w, h);
    const shot = (bIdx + i * 3 + (i > 1 ? 1 : 0)) % 4;
    const A = (a: number) => rgba('bone', a * fl);
    c.lineCap = 'round';
    if (shot === 0) {
      // anchor at a desk, globe graticule behind
      c.strokeStyle = A(0.25); c.lineWidth = 1;
      const gx = x + w * 0.72, gy = y + h * 0.4, gr = 52;
      c.beginPath(); c.arc(gx, gy, gr, 0, TAU);
      for (let k = -2; k <= 2; k++) { c.moveTo(gx + gr, gy + k * 18); c.ellipse(gx, gy + k * 18, Math.sqrt(Math.max(0, gr * gr - (k * 18) ** 2)), 3, 0, 0, TAU); }
      for (let k = -2; k <= 2; k++) { c.moveTo(gx, gy - gr); c.ellipse(gx, gy, Math.abs(k) * 12 + 2, gr, 0, 0, TAU); }
      c.stroke();
      c.fillStyle = A(0.75);
      c.beginPath(); c.arc(x + w * 0.38, y + h * 0.36, 17, 0, TAU); c.fill();
      c.beginPath(); c.roundRect(x + w * 0.38 - 36, y + h * 0.36 + 24, 72, 80, 30); c.fill();
      c.fillStyle = A(0.35); c.fillRect(x, y + h * 0.66, w, h * 0.34);
    } else if (shot === 1) {
      // markets, down
      c.strokeStyle = A(0.3); c.lineWidth = 1;
      c.beginPath(); c.moveTo(x + 24, y + 26); c.lineTo(x + 24, y + h - 50); c.lineTo(x + w - 20, y + h - 50); c.stroke();
      c.strokeStyle = A(0.85); c.lineWidth = 2.5;
      c.beginPath();
      for (let k = 0; k <= 10; k++) { const xx = x + 30 + k * (w - 60) / 10, yy = y + 40 + k * 9 + (hash(k, i) - 0.5) * 30; k ? c.lineTo(xx, yy) : c.moveTo(xx, yy); }
      c.stroke();
      mono(c, '▼ 0.8%', x + w - 24, y + 34, 15, A(0.9), 'right', 'Plex-600');
    } else if (shot === 2) {
      // two-way: two talking figures, split screen
      c.strokeStyle = A(0.4); c.lineWidth = 1; c.beginPath(); c.moveTo(x + w / 2, y); c.lineTo(x + w / 2, y + h); c.stroke();
      c.fillStyle = A(0.7);
      for (const fx of [0.25, 0.75]) {
        c.beginPath(); c.arc(x + w * fx, y + h * 0.4, 15, 0, TAU); c.fill();
        c.beginPath(); c.roundRect(x + w * fx - 30, y + h * 0.4 + 21, 60, 80, 26); c.fill();
      }
    } else {
      // weather: isobars, a front
      c.strokeStyle = A(0.5); c.lineWidth = 1;
      for (let k = 1; k <= 5; k++) { c.beginPath(); c.ellipse(x + w * 0.35, y + h * 0.42, k * 18, k * 12, 0.3, 0, TAU); c.stroke(); }
      mono(c, 'L', x + w * 0.35, y + h * 0.42 + 6, 18, A(0.9), 'center', 'Plex-700');
      mono(c, 'RAIN, LATER', x + w - 20, y + 32, 13, A(0.85), 'right');
    }
    // lower third with a tiny crawl
    c.fillStyle = A(0.85); c.fillRect(x, y + h - 40, w, 22);
    c.fillStyle = '#17171A'; c.fillRect(x, y + h - 40, 54, 22);
    mono(c, 'NEWS', x + 27, y + h - 24, 12, A(0.95), 'center', 'Plex-700');
    c.save(); c.beginPath(); c.rect(x + 56, y + h - 40, w - 56, 22); c.clip();
    const crawl = ['80% OF VIEWERS AGREE WITH THE OTHER 80%', 'MORE NEWS AFTER THE NEWS', 'STILL NEWS · DEVELOPING', 'EXPERTS: THINGS HAPPENED'][i]!;
    const off = ((t * 60 + i * 97) % 520);
    mono(c, `${crawl}  +++  ${crawl}`, x + w - off, y + h - 24, 12, '#17171A', 'left', 'Plex-600');
    c.restore();
    c.restore();
    scanlines(c, x, y, w, h, 0.22, 3);
    // switch-off line + dot
    if (ko > 0) {
      const lk = clamp((ko - 0.45) / 0.55);
      const lw = w * (1 - ease.inCubic(lk));
      c.fillStyle = rgba('bone', 0.95 - 0.5 * lk);
      c.fillRect(x + w / 2 - lw / 2, y + h / 2 - 1.5, lw, 3);
    }
    c.restore();
  }

  // ---------------------------------------------------------------- part B screen furniture (ticker)
  drawScreenB(c: C2D, t: number) {
    const T = this.T;
    drawPlateHead(c, 5, 'Meanwhile, on television', (t - T.z1 + 0.1) / 0.6, { paper: false, right: this.viewers(t) });
    // the ticker band wipes in under the whip-out
    const bk = ease.outExpo(prog(t, T.z0 + 0.04, T.z0 + 0.3));
    const y0 = 790, h = 112;
    const out = 0;
    const yy = y0 + out * 300;
    c.save();
    c.beginPath(); c.rect(0, yy, 1920 * bk, h); c.clip();
    c.fillStyle = rgba('ink2', 0.96); c.fillRect(0, yy, 1920, h);
    c.strokeStyle = rgba('graphite', 1); c.lineWidth = 1;
    c.beginPath(); c.moveTo(0, yy + 0.5); c.lineTo(1920, yy + 0.5); c.moveTo(0, yy + h - 0.5); c.lineTo(1920, yy + h - 0.5); c.stroke();
    // crawl: the sung position sits at the playhead PH
    const PH = 1060;
    const ws = this.w2;
    const lineW = ws[ws.length - 1]!.x + ws[ws.length - 1]!.width;
    const vAvg = lineW / (this.l2.end - this.l2.start);
    let xs: number;
    if (t < ws[0]!.w.start) xs = (t - ws[0]!.w.start) * vAvg;
    else if (t >= ws[ws.length - 1]!.w.end) xs = lineW + (t - ws[ws.length - 1]!.w.end) * vAvg;
    else {
      xs = lineW;
      for (let i = 0; i < ws.length; i++) {
        const a = ws[i]!;
        if (t < a.w.end) { xs = a.x + a.width * clamp((t - a.w.start) / (a.w.end - a.w.start)); break; }
        const b = ws[i + 1];
        if (b && t < b.w.start) { xs = lerp(a.x + a.width, b.x, (t - a.w.end) / (b.w.start - a.w.end)); break; }
      }
    }
    const ox = PH - xs;
    const by = yy + 82;
    c.save(); c.beginPath(); c.rect(276, yy, 1920, h); c.clip();
    drawKaraokeWords(c, this.l2.words, t, ox, by, { family: this.tkFam, size: this.tkSize, paper: false, dim: 0.3, lead: 99 });
    // separators before and after the line
    mono(c, '+++  THE NEWS  +++', ox - 60, by - 22, 22, rgba('ash', 0.8), 'right', 'Plex-600');
    mono(c, '+++  AND NOW, THE WEATHER: RAIN, LATER  +++', ox + lineW + 60, by - 22, 22, rgba('ash', 0.8), 'left', 'Plex-600');
    c.restore();
    // tag
    c.fillStyle = rgba('bone'); c.fillRect(96, yy + 30, 168, 52);
    mono(c, 'AS IT', 180, yy + 52, 15, rgba('ink'), 'center', 'Plex-700');
    mono(c, 'HAPPENS', 180, yy + 72, 15, rgba('ink'), 'center', 'Plex-700');
    c.restore();
    footnote(c, '¹ Source: the remote control. Sample: one living room, one runner absent from it.', 96, 1016, { paper: false, a: bk * (1 - out) });
  }

  viewers(t: number) {
    const T = this.T;
    const k = ease.outCubic(prog(t, T.world, T.world + 1.0));
    const bn = 6.48 * k;
    return `WATCHING: ${bn.toFixed(2)} bn (80.0%) · RUNNING: 1`;
  }
}
// silence unused-import lint for helpers kept for symmetry
void isKey; void keys;
