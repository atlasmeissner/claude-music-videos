// Verse 2 (61.7 – 76.4 s): the machine seen as a map (plan view, "Maps & Territory").
// The ball is a dot on a road; the lyric is set along the roads like road names, and the dot passes
// each word as it is sung. A coin decides the fork: LEFT. The road not taken is a dotted
// counterfactual into a hatched "war (missed)"; the left road finds a church ("hymn"). Doors are
// drawn as architectural door swings: one dot holds a door while someone comes up the road from the
// south and passes through; they hold the next door, which opens onto a single point: YOU ARE HERE.
//
// Timing: every road carries one phrase and is sized to it. The words are placed along the road where
// the dot will be when each one is sung (time maps to arc length at a near-constant speed), so the
// dot moves evenly and is on each word as it is sung; no road has to be covered in a rush.
import { type R } from '../engine/draw';
import { archivo, mono } from '../engine/fonts';
import { type Line, line } from '../engine/lyrics';
import { label, layout, orderTag, textAlong, type WordBox } from '../engine/text';
import { clamp, ease, hash, lerp, noise2, smoothstep, type V2 } from '../engine/util';
import { Path, bezier, join } from '../machine/geom';
import { hit } from '../machine/motion';
import { type Station } from '../station';

const SIZE = 54;
const LEAD = 14; // the dot sits this far into a word when it is sung

/** A phrase set along a road, timed: the traveller enters at tIn and leaves the far end at tOut. */
class Route {
  path: Path;
  l: Line;
  tIn: number;
  tOut: number;
  side: number;
  private pos: { b: WordBox; s: number }[] | null = null;
  private anchors: [number, number][] = [];
  constructor(pts: V2[], l: Line, tIn: number, tOut: number, side = 1) {
    this.path = new Path(pts);
    this.l = l;
    this.tIn = tIn;
    this.tOut = tOut;
    this.side = side;
  }
  get length() {
    return this.path.length;
  }
  private layout(r: R) {
    if (this.pos) return this.pos;
    const boxes = layout(r, this.l, { size: SIZE, width: 875, weight: 700 });
    const space = SIZE * 0.26;
    const L = this.path.length;
    const v = L / (this.tOut - this.tIn);
    const pos: { b: WordBox; s: number }[] = [];
    let minS = 24;
    for (const b of boxes) {
      const want = v * (b.word.start - this.tIn) - LEAD;
      const s = Math.max(want, minS);
      pos.push({ b, s });
      minS = s + b.w + space;
    }
    // if the phrase runs past the end of the road, slide it back (keeping the gaps)
    const over = pos.length ? pos[pos.length - 1]!.s + pos[pos.length - 1]!.b.w - (L - 10) : 0;
    if (over > 0) {
      const room = pos[0]!.s - 24;
      const k = Math.min(over, room);
      for (const p of pos) p.s -= k;
    }
    this.pos = pos;
    this.anchors = [[this.tIn, 0], ...pos.map((p) => [p.b.word.start, p.s + LEAD] as [number, number]), [this.tOut, L]];
    // anchors must increase in both time and distance
    this.anchors = this.anchors.filter((a, i, arr) => i === 0 || (a[0] > arr[i - 1]![0] && a[1] >= arr[i - 1]![1]));
    return pos;
  }
  /** Arc length of the traveller at t. Piecewise linear through the word anchors (eased at the ends). */
  s(r: R, t: number) {
    this.layout(r);
    const A = this.anchors;
    if (t <= A[0]![0]) return 0;
    for (let i = 1; i < A.length; i++) if (t < A[i]![0]) {
      const a = A[i - 1]!, b = A[i]!;
      let u = (t - a[0]) / (b[0] - a[0]);
      if (i === 1 && A.length > 2) u = ease.inSine(u);
      if (i === A.length - 1 && A.length > 2) u = ease.outSine(u);
      return lerp(a[1], b[1], u);
    }
    return this.path.length;
  }
  at(r: R, t: number) {
    return this.path.at(this.s(r, t));
  }
  private textAt = (s: number) => {
    const p = this.path.at(s);
    const off = this.side * (26 + 10);
    return { x: p.x + Math.sin(p.angle) * off, y: p.y - Math.cos(p.angle) * off, angle: p.angle };
  };
  drawText(r: R, t: number, ghost = false) {
    const A = smoothstep(this.l.start - 0.8, this.l.start - 0.3, t);
    if (A <= 0) return;
    for (const { b, s } of this.layout(r)) {
      const lit = t >= b.word.start;
      const cool = smoothstep(b.word.end, b.word.end + 0.45, t);
      const col = lit ? (ghost ? r.mix('sig', 'mid', cool) : r.mix('sig', 'fg', cool)) : r.c('fg');
      textAlong(r, b.text, this.textAt, s, archivo(SIZE, 875, 700), col, A * (lit ? 1 : 0.3));
    }
  }
}

function road(r: R, p: Path, col: string, w = 26, dashed = false, upTo?: number) {
  const g = r.g;
  const pts = upTo !== undefined ? p.slice(0, upTo) : p.pts;
  if (pts.length < 2) return;
  if (dashed) g.setLineDash([r.px(10), r.px(9)]);
  for (const s of [-1, 1]) {
    g.beginPath();
    pts.forEach((q, i) => {
      const a = pts[Math.max(0, i - 1)]!, b = pts[Math.min(pts.length - 1, i + 1)]!;
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      const x = q.x + Math.sin(ang) * (s * w) / 2, y = q.y - Math.cos(ang) * (s * w) / 2;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    });
    r.stroke(col, 1.3);
  }
  g.setLineDash([]);
}

function dot(r: R, x: number, y: number, heat: number, ghost = false, alpha = 1) {
  r.alpha(alpha, () => {
    if (ghost) {
      r.circle(x, y, 11, r.c('mid'), undefined, 1.2);
      return;
    }
    r.circle(x, y, 18, r.c('sig', 0.5 * heat), undefined, 1);
    r.circle(x, y, 10, undefined, heat > 0.01 ? r.mix('fg', 'sig', heat) : r.c('fg'));
  });
}

/** Architectural door: wall gap, hinged leaf, swing arc; opening 0..1. */
function door(r: R, x: number, y: number, ang: number, w: number, open: number, hot: number) {
  r.local(x, y, ang, 1, () => {
    const col = hot > 0.01 ? r.mix('fg', 'sig', hot) : r.c('fg');
    r.line(-160, 0, 0, 0, r.c('fg'), 3);
    r.line(w, 0, w + 160, 0, r.c('fg'), 3);
    const a = -open * Math.PI / 2;
    r.line(0, 0, Math.cos(a) * w, Math.sin(a) * w, col, 2.2);
    const g = r.g;
    g.beginPath();
    g.arc(0, 0, w, a, 0);
    g.setLineDash([r.px(4), r.px(4)]);
    r.stroke(r.c('dim'), 1);
    g.setLineDash([]);
  });
}

const sub = (l: Line, a: number, b?: number): Line => {
  const words = l.words.slice(a, b);
  return { ...l, words, start: words[0]!.start, end: words[words.length - 1]!.end };
};

export function makeMap(x0: number, entry: { t: number }) {
  const X = x0, Y = -800;
  const L10 = line(10), L11 = line(11), L12 = line(12), L13 = line(13);
  const W10 = L10.words, W11 = L11.words, W12 = L12.words, W13 = L13.words;

  // ---- timing (all from the sung words)
  const tFork = W10[1]!.start - 0.6; // the coin goes up just before "chose"
  const tCoin = W10[3]!.start; // lands on "left"
  const tFk = W10[7]!.end + 0.1; // the dot reaches the fork as "whim" ends
  const tHymn = W11[7]!.start;
  const tChurch = tHymn + 0.35; // arrives at the church
  const tHeld = W12[0]!.start;
  const tDoor1 = W12[2]!.start + 0.35; // at the door on "door"
  const tSome0 = W12[3]!.start - 0.6; // someone sets off up the road
  const tThrough = W12[6]!.start + 0.3; // through the door on "through"
  const tWho = W13[0]!.start;
  const tDoor2 = W13[3]!.start + 0.3; // the second door on "door"
  const tYou = W13[7]!.start;

  // ---- geometry: roads sized to their phrases (about 380 units per second)
  const F: V2 = { x: X + 900, y: Y + 220 }; // the fork
  const H: V2 = { x: X + 2000, y: Y - 260 }; // church
  const WAR: V2 = { x: X + 2050, y: Y + 520 };
  const D1: V2 = { x: H.x + 600, y: H.y + 220 }; // first door (on the road from the church)
  const S0: V2 = { x: D1.x + 60, y: D1.y + 1080 }; // where the someone comes from
  const SD: V2 = { x: D1.x + 60, y: D1.y - 70 }; // just through the first door
  const D2: V2 = { x: SD.x + 620, y: SD.y - 230 }; // second door
  const YOU: V2 = { x: D2.x + 540, y: D2.y + 50 };

  const rIn = new Route(join([{ x: X - 500, y: Y + 560 }], bezier({ x: X - 200, y: Y + 520 }, { x: X + 300, y: Y + 420 }, { x: F.x - 400, y: F.y }, F, 30)), L10, entry.t, tFk);
  const rLeft = new Route(bezier(F, { x: F.x + 400, y: F.y - 40 }, { x: H.x - 500, y: H.y + 80 }, H, 50), sub(L11, 4), tFk, tChurch);
  const rRight = new Route(bezier(F, { x: F.x + 400, y: F.y + 60 }, { x: WAR.x - 500, y: WAR.y - 40 }, WAR, 50), sub(L11, 0, 4), W11[0]!.start - 0.3, W11[3]!.end + 0.3, -1);
  const rDoor = new Route(bezier(H, { x: H.x + 200, y: H.y }, { x: D1.x - 260, y: D1.y }, D1, 30), sub(L12, 0, 3), tChurch, tDoor1);
  const rSome = new Route([S0, SD], sub(L12, 3), tSome0, tThrough);
  const rWho = new Route(bezier(SD, { x: SD.x, y: SD.y - 200 }, { x: D2.x - 300, y: D2.y }, D2, 40), sub(L13, 0, 4), tThrough, tDoor2);
  // the phrase ends short of the star: the pulse reaches "you" as it is sung and runs on into YOU ARE HERE
  const rYou = new Route([D2, { x: D2.x + 270, y: D2.y + 40 }, YOU], sub(L13, 4), tDoor2, tYou + 0.4);

  /** The first dot (from the galton board): along the roads to the first door, where it waits. */
  function dotPos(r: R, t: number): V2 {
    if (t < tFk) return rIn.at(r, t);
    if (t < tChurch) return rLeft.at(r, t);
    if (t < tDoor1) return rDoor.at(r, t);
    return { x: D1.x - 14, y: D1.y };
  }
  /** The someone: up the road from the south, through the held door, on to the second door. */
  function someonePos(r: R, t: number): V2 | null {
    if (t < tSome0 - 0.5) return null;
    if (t < tThrough) return rSome.at(r, t);
    if (t < tDoor2) return rWho.at(r, t);
    return { x: D2.x - 16, y: D2.y };
  }

  // background: contour lines of the terrain (fixed)
  const contours: V2[][] = [];
  for (let k = 0; k < 9; k++) {
    const cx = X + 400 + hash(k, 1) * 3400, cy = Y - 300 + hash(k, 2) * 1000;
    for (let ring = 1; ring <= 4; ring++) {
      const pts: V2[] = [];
      for (let a = 0; a <= 64; a++) {
        const ang = (a / 64) * Math.PI * 2;
        const rad = ring * (70 + hash(k, 3) * 40) * (1 + 0.35 * noise2(Math.cos(ang) * 1.3 + k, Math.sin(ang) * 1.3, 4));
        pts.push({ x: cx + Math.cos(ang) * rad * 1.5, y: cy + Math.sin(ang) * rad });
      }
      contours.push(pts);
    }
  }

  // ---- the camera path: one continuous target, Gaussian-smoothed (sigma 0.5 s), precomputed at 60 Hz
  const CAM_HZ = 60;
  let camPath: { t0: number; x: Float64Array; y: Float64Array; z: Float64Array } | null = null;
  function camTarget(r: R, tt: number): V2 {
    if (tt < tDoor1) return dotPos(r, tt);
    if (tt < tThrough) {
      // between the held door and the someone walking up to it
      const so = someonePos(r, tt) ?? S0;
      return { x: (D1.x + so.x) / 2, y: (D1.y + so.y) / 2 };
    }
    if (tt < tDoor2) return someonePos(r, tt)!;
    if (tt < tYou) return rYou.at(r, tt);
    return YOU;
  }
  function buildCamPath(r: R) {
    const t0 = entry.t - 2, t1 = 79, n = Math.ceil((t1 - t0) * CAM_HZ) + 1;
    const rx = new Float64Array(n), ry = new Float64Array(n), rz = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const tt = t0 + i / CAM_HZ;
      const p = camTarget(r, Math.max(entry.t, tt));
      const coin = tt > tFork - 0.5 && tt < tFk + 0.2 ? 1 : 0;
      rx[i] = p.x + 60; ry[i] = p.y - 50 - coin * 60; rz[i] = 0.95;
    }
    const sig = 0.5 * CAM_HZ, R3 = Math.ceil(sig * 3);
    const kern = Array.from({ length: 2 * R3 + 1 }, (_, k) => Math.exp(-0.5 * ((k - R3) / sig) ** 2));
    const sm = (a: Float64Array) => {
      const o = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        let s = 0, w = 0;
        for (let k = -R3; k <= R3; k++) {
          const j = Math.min(n - 1, Math.max(0, i + k));
          s += a[j]! * kern[k + R3]!; w += kern[k + R3]!;
        }
        o[i] = s / w;
      }
      return o;
    };
    return { t0, x: sm(rx), y: sm(ry), z: sm(rz) };
  }

  const st: Station = {
    id: 'map',
    x0: X - 700, x1: YOU.x + 700, y0: Y - 1000, y1: S0.y + 200,
    t0: entry.t - 0.5, t1: 76.5,
    cam: [{ t: entry.t + 0.6, x: X + 300, y: Y + 300, z: 0.85, e: ease.inOutCubic }],
    camFollow: {
      t0: entry.t + 0.6, t1: 76.4, blend: 0.8,
      fn: (r, t) => {
        const c = (camPath ??= buildCamPath(r));
        const x = (t - c.t0) * CAM_HZ, i = Math.max(0, Math.min(c.x.length - 2, Math.floor(x))), f = Math.min(1, Math.max(0, x - i));
        return { x: lerp(c.x[i]!, c.x[i + 1]!, f), y: lerp(c.y[i]!, c.y[i + 1]!, f), z: lerp(c.z[i]!, c.z[i + 1]!, f) };
      },
    },
    hits: [{ t: tCoin, amp: 4 }, { t: tYou, amp: 6 }],
    impulse: (t) => (t < tDoor1 ? { x: 0, y: 0 } : null),
    draw(r: R, t: number) {
      const g = r.g;
      // the sheet: contours, title, compass, scale
      for (const c of contours) {
        r.path(c, true);
        r.stroke(r.c('faint'), 1);
      }
      label(r, 'SHEET 14 — VERSE II — PLAN', X - 450, Y - 860, 15, undefined, 'left', 500);
      label(r, 'CONTOUR INTERVAL: ONE DECISION', X - 450, Y - 834, 13, r.c('dim'));
      r.local(YOU.x + 320, Y - 700, 0, 1, () => {
        r.poly([{ x: 0, y: -60 }, { x: 14, y: 0 }, { x: 0, y: 60 }, { x: -14, y: 0 }], r.c('fg'), undefined, 1.2);
        r.poly([{ x: 0, y: -60 }, { x: 14, y: 0 }, { x: -14, y: 0 }], undefined, r.c('fg'));
        r.text('N', 0, -74, mono(16, 600), r.c('fg'), 'center');
      });
      r.line(X - 450, Y + 900, X - 50, Y + 900, r.c('fg'), 2);
      for (let k = 0; k <= 4; k++) r.line(X - 450 + k * 100, Y + 890, X - 450 + k * 100, Y + 910, r.c('fg'), 1);
      label(r, '0        1        2 KM', X - 450, Y + 880, 12);

      // roads
      road(r, rIn.path, r.c('fg'));
      road(r, rLeft.path, r.c('fg'));
      road(r, rRight.path, r.c('mid'), 26, true);
      road(r, rDoor.path, r.c('fg'));
      road(r, rSome.path, r.c('fg'));
      road(r, rWho.path, r.c('fg'));
      road(r, rYou.path, r.c('fg'), 26, false, rYou.length * ease.outCubic(clamp((t - (tDoor2 - 0.3)) / 0.8)));

      // ---- the coin at the fork
      if (t > tFork - 0.4) {
        const spin = t < tCoin ? (t - (tFork - 0.4)) * 22 : 0;
        const air = t < tCoin ? Math.sin(clamp((t - (tFork - 0.4)) / (tCoin - tFork + 0.4)) * Math.PI) * 120 : 0;
        const cx = F.x - 40, cy = F.y - 120 - air;
        const wC = Math.abs(Math.cos(spin)) * 40 + 3;
        const landed = t >= tCoin;
        const fade = 1 - smoothstep(W11[0]!.start, W11[2]!.start, t);
        r.alpha(fade, () => {
          g.beginPath();
          g.ellipse(cx, cy, wC, 40, 0, 0, Math.PI * 2);
          g.fillStyle = landed ? r.c('sig') : r.c('panel');
          g.fill();
          r.stroke(landed || t > tFork ? r.c('sig') : r.c('fg'), 1.6);
          if (wC > 20) r.text(landed ? 'L' : Math.cos(spin) > 0 ? 'L' : 'R', cx, cy + 12, archivo(34, 1000, 900), landed ? r.c('panel') : r.c('fg'), 'center');
          label(r, 'ON A WHIM (COIN, FAIR)', cx + 60, cy - 30, 13);
        });
      }
      r.text('LEFT', F.x + 160, F.y - 90, mono(16, 600), t > tCoin ? r.c('sig') : r.c('mid'));
      r.text('RIGHT', F.x + 160, F.y + 130, mono(16, 600), r.c('mid'));
      orderTag(r, 14, F.x - 140, F.y + 110, 16, hit(t, tCoin, 0.4));

      // ---- the war not fought: a hatched zone at the end of the dotted road
      const warA = smoothstep(W11[3]!.start - 0.2, W11[3]!.start + 0.2, t);
      if (warA > 0.01) {
        r.alpha(warA, () => {
          const zone: V2[] = [];
          for (let a = 0; a < 40; a++) {
            const ang = (a / 40) * Math.PI * 2;
            const rad = 170 * (1 + 0.25 * noise2(Math.cos(ang) * 2, Math.sin(ang) * 2, 8));
            zone.push({ x: WAR.x + 160 + Math.cos(ang) * rad * 1.4, y: WAR.y + Math.sin(ang) * rad });
          }
          r.poly(zone, r.c('mid'), undefined, 1.2);
          r.hatch(zone, r.c('dim'), 9);
          r.local(WAR.x + 160, WAR.y, 0, 1, () => {
            r.line(-40, -40, 40, 40, r.c('fg'), 3);
            r.line(40, -40, -40, 40, r.c('fg'), 3);
            r.line(-50, 22, -22, 50, r.c('fg'), 2);
            r.line(50, 22, 22, 50, r.c('fg'), 2);
          });
          r.text('A WAR', WAR.x + 400, WAR.y - 10, mono(18, 600), r.c('fg'));
          r.text('(MISSED)', WAR.x + 400, WAR.y + 16, mono(15), r.c('mid'));
        });
      }
      // the counterfactual: a ghost dot runs the road not taken at the sung pace
      if (t > rRight.tIn && t < rRight.tOut + 1) {
        const q = rRight.at(r, t);
        dot(r, q.x, q.y, 0, true, 1 - smoothstep(rRight.tOut, rRight.tOut + 0.8, t));
      }

      // ---- the church (map symbol: a cross on a small plan) and its hymn
      const hy = hit(t, tHymn, 0.6);
      r.local(H.x + 120, H.y - 80, 0, 1, () => {
        r.box(0, 0, 0, -40, -30, 80, 60, hy > 0.01 ? r.mix('fg', 'sig', hy) : r.c('fg'), r.c('panel'), 1.4);
        r.line(0, -30, 0, -80, r.c('fg'), 2);
        r.line(-16, -62, 16, -62, r.c('fg'), 2);
      });
      if (t > tHymn) {
        for (let q = 0; q < 4; q++) {
          const tau = t - tHymn - q * 0.18;
          if (tau < 0 || tau > 1.4) continue;
          g.beginPath();
          g.arc(H.x + 120, H.y - 110, 40 + tau * 180, -Math.PI * 0.85, -Math.PI * 0.15);
          r.stroke(r.c('sig', 1 - tau / 1.4), 1.4);
        }
      }
      r.text('A HYMN', H.x + 200, H.y - 120, mono(18, 600), t > tHymn ? r.c('sig') : r.c('fg'));
      r.text('(FOUND)', H.x + 200, H.y - 94, mono(15), r.c('mid'));
      orderTag(r, 15, H.x - 60, H.y - 160, 16, hy);

      // ---- doors: the first is held open from "door" until the someone is through
      const open1 = ease.outBack(clamp((t - (tDoor1 - 0.2)) / 0.5), 1.2) * (1 - smoothstep(tThrough + 0.3, tThrough + 1.1, t));
      door(r, D1.x + 10, D1.y - 20, 0, 100, open1, open1 > 0.02 && t < tThrough + 0.5 ? 1 : 0);
      const open2 = ease.outBack(clamp((t - (tDoor2 - 0.2)) / 0.5), 1.2);
      door(r, D2.x + 40, D2.y - 30, Math.PI / 2, 100, open2, open2 > 0.02 ? 1 : 0);
      label(r, 'DOOR (HELD)', D1.x - 200, D1.y - 60, 13, undefined, 'left', 400, smoothstep(tDoor1 - 0.3, tDoor1, t));
      label(r, 'SOMEONE (PASSING THROUGH)', S0.x + 50, S0.y - 40, 13, undefined, 'left', 400, smoothstep(tSome0 - 0.4, tSome0, t));
      orderTag(r, 16, D1.x + 180, D1.y - 90, 16, hit(t, tDoor1, 0.4));
      orderTag(r, 17, D2.x + 120, D2.y - 160, 16, hit(t, tDoor2, 0.4));

      // ---- YOU ARE HERE
      const youA = smoothstep(tYou - 0.15, tYou + 0.1, t);
      r.alpha(Math.max(0.15, youA), () => {
        const k = 1 + hit(t, tYou, 0.3) * 0.6;
        const star: V2[] = [];
        for (let q = 0; q < 10; q++) {
          const a = -Math.PI / 2 + (q * Math.PI) / 5;
          const rad = (q % 2 ? 16 : 40) * k;
          star.push({ x: YOU.x + Math.cos(a) * rad, y: YOU.y + Math.sin(a) * rad });
        }
        r.poly(star, youA > 0.5 ? r.c('sig') : r.c('fg'), youA > 0.5 ? r.c('sig') : undefined, 1.4);
        r.text('YOU ARE HERE', YOU.x + 60, YOU.y + 10, mono(20, 600), youA > 0.5 ? r.c('sig') : r.c('mid'));
      });
      if (t > tYou) {
        for (let q = 0; q < 3; q++) {
          const tau = ((t - tYou) * 0.8 + q / 3) % 1;
          r.circle(YOU.x, YOU.y, 50 + tau * 200, r.c('sig', (1 - tau) * 0.7 * (1 - smoothstep(76.3, 76.8, t))), undefined, 1.2);
        }
      }

      // ---- lyrics along the roads
      rIn.drawText(r, t);
      rRight.drawText(r, t, true);
      rLeft.drawText(r, t);
      rDoor.drawText(r, t);
      rSome.drawText(r, t);
      rWho.drawText(r, t);
      rYou.drawText(r, t);

      // ---- the travellers
      if (t >= entry.t) {
        const p = dotPos(r, t);
        // hot while travelling and while holding the door; cools once the someone is through
        dot(r, p.x, p.y, 1 - smoothstep(tThrough, tThrough + 0.6, t));
      }
      const so = someonePos(r, t);
      if (so) dot(r, so.x, so.y, t > tSome0 - 0.1 ? 1 - smoothstep(tYou, tYou + 0.6, t) : 0.2, false, smoothstep(tSome0 - 0.5, tSome0 - 0.1, t));
      // what the second door leads to: a pulse along the last road
      if (t > tDoor2 && t < tYou + 0.45) {
        const q = rYou.at(r, t);
        dot(r, q.x, q.y, 1);
      }
      void tHeld; void tWho;
    },
  };
  return { station: st, exit: { x: YOU.x, y: YOU.y, t: tYou } };
}
