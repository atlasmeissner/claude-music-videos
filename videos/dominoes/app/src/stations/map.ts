// Verse 2 (61.7 – 76.4 s): the machine seen as a map (plan view, "Maps & Territory").
// The ball is a dot on a road; the lyric is set along the roads like road names, and the dot passes
// each word as it is sung. A coin decides the fork: LEFT. The road not taken is a dotted
// counterfactual into a hatched "war (missed)"; the left road finds a church ("hymn"). Doors are
// drawn as architectural door swings: one dot holds a door for another, who holds the next one,
// which opens onto a single point: YOU ARE HERE.
import { type R } from '../engine/draw';
import { archivo, mono } from '../engine/fonts';
import { type Line, line } from '../engine/lyrics';
import { label, layout, orderTag, textAlong, type WordBox } from '../engine/text';
import { clamp, ease, hash, lerp, noise2, smoothstep, type V2 } from '../engine/util';
import { Path, bezier, join } from '../machine/geom';
import { hit } from '../machine/motion';
import { type Station } from '../station';

const SIZE = 60;

/** A lyric set along a road, with the travelling dot synced to the words. */
class Route {
  path: Path;
  l: Line;
  s0: number;
  side: number;
  boxes: WordBox[] | null = null;
  constructor(pts: V2[], l: Line, s0: number, side = 1) {
    this.path = new Path(pts);
    this.l = l;
    this.s0 = s0;
    this.side = side;
  }
  box(r: R) {
    return (this.boxes ??= layout(r, this.l, { size: SIZE, width: 875, weight: 700 }));
  }
  at = (s: number) => {
    const p = this.path.at(s);
    const off = this.side * (26 + 8);
    return { x: p.x + Math.sin(p.angle) * off, y: p.y - Math.cos(p.angle) * off, angle: p.angle };
  };
  /** Dot position (arc length) at t: before the first word at sStart, after the last at the end. */
  dotS(r: R, t: number, tIn: number, tOut: number) {
    const bx = this.box(r);
    const pts: [number, number][] = [[tIn, 0]];
    for (const b of bx) pts.push([b.word.start, this.s0 + b.x + Math.min(b.w * 0.5, 30)]);
    pts.push([tOut, this.path.length]);
    if (t <= tIn) return 0;
    for (let i = 1; i < pts.length; i++) if (t < pts[i]![0]) {
      const a = pts[i - 1]!, b = pts[i]!;
      return lerp(a[1], b[1], ease.inOutSine((t - a[0]) / (b[0] - a[0])));
    }
    return this.path.length;
  }
  drawText(r: R, t: number, ghost = false) {
    const A = smoothstep(this.l.start - 0.7, this.l.start - 0.2, t);
    if (A <= 0) return;
    for (const b of this.box(r)) {
      const lit = t >= b.word.start;
      const cool = smoothstep(b.word.end, b.word.end + 0.45, t);
      const col = lit ? (ghost ? r.mix('sig', 'mid', cool) : r.mix('sig', 'fg', cool)) : r.c('fg');
      textAlong(r, b.text, this.at, this.s0 + b.x, archivo(SIZE, 875, 700), col, A * (lit ? 1 : 0.3));
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

function dot(r: R, x: number, y: number, heat: number, ghost = false) {
  if (ghost) {
    r.circle(x, y, 11, r.c('mid'), undefined, 1.2);
    return;
  }
  r.circle(x, y, 18, r.c('sig', 0.5 * heat), undefined, 1);
  r.circle(x, y, 10, undefined, heat > 0.01 ? r.mix('fg', 'sig', heat) : r.c('fg'));
}

/** Architectural door: wall gap, hinged leaf, swing arc; opening 0..1. */
function door(r: R, x: number, y: number, ang: number, w: number, open: number, hot: number) {
  r.local(x, y, ang, 1, () => {
    const col = hot > 0.01 ? r.mix('fg', 'sig', hot) : r.c('fg');
    // wall stubs
    r.line(-160, 0, 0, 0, r.c('fg'), 3);
    r.line(w, 0, w + 160, 0, r.c('fg'), 3);
    // leaf
    const a = -open * Math.PI / 2;
    r.line(0, 0, Math.cos(a) * w, Math.sin(a) * w, col, 2.2);
    // swing arc
    const g = r.g;
    g.beginPath();
    g.arc(0, 0, w, a, 0);
    g.setLineDash([r.px(4), r.px(4)]);
    r.stroke(r.c('dim'), 1);
    g.setLineDash([]);
  });
}

export function makeMap(x0: number, entry: { t: number }) {
  const X = x0, Y = -800;
  const Ls = [line(10), line(11), line(12), line(13)];
  const W10 = Ls[0]!.words, W11 = Ls[1]!.words, W12 = Ls[2]!.words, W13 = Ls[3]!.words;
  const F: V2 = { x: X + 900, y: Y + 220 }; // the fork
  const H: V2 = { x: X + 2000, y: Y - 260 }; // church
  const WAR: V2 = { x: X + 2050, y: Y + 520 };
  const D1: V2 = { x: X + 3250, y: Y - 120 }; // first door
  const D2: V2 = { x: X + 4150, y: Y + 160 }; // second door
  const YOU: V2 = { x: X + 4700, y: Y + 60 };

  // roads
  const rIn = new Route(join([{ x: X - 500, y: Y + 560 }], bezier({ x: X - 200, y: Y + 520 }, { x: X + 300, y: Y + 420 }, { x: F.x - 400, y: F.y }, F, 30)), Ls[0]!, 60);
  // "I chose the left road on a whim": the first words before the fork, the rest after
  const left = new Path(bezier(F, { x: F.x + 400, y: F.y - 40 }, { x: H.x - 500, y: H.y + 80 }, H, 50));
  const right = new Path(bezier(F, { x: F.x + 400, y: F.y + 60 }, { x: WAR.x - 500, y: WAR.y - 40 }, WAR, 50));
  const lw: Line = { ...Ls[1]!, words: W11.slice(4), start: W11[4]!.start }; // and found a hymn
  const rw: Line = { ...Ls[1]!, words: W11.slice(0, 4) }; // And missed a war
  const rLeft = new Route(left.pts, lw, 60);
  const rRight = new Route(right.pts, rw, 60, -1);
  const rDoor = new Route(join(bezier(H, { x: H.x + 300, y: H.y }, { x: D1.x - 300, y: D1.y }, D1, 30)), Ls[2]!, 40);
  // the someone: comes up from the south through the door and on to the second door
  const someone = new Path(join([{ x: D1.x + 60, y: D1.y + 700 }, { x: D1.x + 60, y: D1.y + 40 }, { x: D1.x + 60, y: D1.y - 160 }], bezier({ x: D1.x + 60, y: D1.y - 160 }, { x: D1.x + 400, y: D1.y - 300 }, { x: D2.x - 400, y: D2.y - 200 }, D2, 40)));
  const rWho = new Route(someone.pts.slice(0), Ls[3]!, 900);
  const rYou = new Path([D2, { x: D2.x + 260, y: D2.y - 40 }, YOU]);

  // timing
  const tFork = W10[1]!.start - 0.6; // the coin goes up just before "chose"
  const tCoin = W10[3]!.start; // lands on "left"
  const tHymn = W11[7]!.start;
  const tHeld = W12[0]!.start;
  const tPass0 = W12[4]!.start, tPass1 = W12[6]!.start + 0.3;
  const tWho = W13[0]!.start;
  const tOpen2 = W13[2]!.start;
  const tYou = W13[7]!.start;

  // the travelling dot (plan view position)
  function dotPos(r: R, t: number): V2 & { ghost?: boolean } {
    if (t < W10[4]!.start) return rIn.path.at(rIn.dotS(r, t, entry.t, W10[4]!.start));
    if (t < tHymn) return left.at(rLeft.dotS(r, t, W10[7]!.end + 0.1, tHymn));
    if (t < tHeld) return rDoor.path.at(rDoor.dotS(r, t, tHymn + 0.1, tHeld));
    return D1;
  }
  function someonePos(t: number) {
    if (t < tPass0 - 0.8) return null;
    // walks up to the door, through it (while it is held), then on to the second door on "Who"
    const sDoor = 700, sThrough = 900;
    if (t < tPass1) return someone.at(lerp(0, sThrough, ease.inOutSine(clamp((t - (tPass0 - 0.8)) / (tPass1 - tPass0 + 0.8)))));
    if (t < tWho + 0.1) return someone.at(lerp(sThrough, someone.length, ease.inOutSine(clamp((t - tPass1) / (tWho + 0.1 - tPass1)))));
    void sDoor;
    return D2;
  }

  // background: contour lines of the terrain (fixed)
  const contours: V2[][] = [];
  for (let k = 0; k < 9; k++) {
    const cx = X + 400 + hash(k, 1) * 3600, cy = Y - 300 + hash(k, 2) * 900;
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

  const st: Station = {
    id: 'map',
    x0: X - 700, x1: YOU.x + 700, y0: Y - 1000, y1: Y + 1000,
    t0: entry.t - 0.5, t1: 76.5,
    cam: [
      { t: entry.t + 0.6, x: X + 300, y: Y + 300, z: 0.85, e: ease.inOutCubic },
      { t: tFork + 0.3, x: F.x + 150, y: F.y - 40, z: 1.0, e: ease.inOutSine },
      { t: tCoin + 0.3, x: F.x + 420, y: F.y + 40, z: 0.82, e: ease.inOutSine },
      { t: W11[2]!.start, x: F.x + 700, y: F.y + 120, z: 0.72, e: ease.inOutSine },
      { t: tHymn + 0.2, x: H.x + 100, y: H.y + 120, z: 0.82, e: ease.inOutSine },
      { t: tHeld + 0.1, x: D1.x - 200, y: D1.y + 100, z: 0.86, e: ease.inOutSine },
      { t: tPass1, x: D1.x + 200, y: D1.y + 60, z: 0.84, e: ease.inOutSine },
      { t: tOpen2, x: D2.x - 100, y: D2.y - 40, z: 0.86, e: ease.inOutSine },
      { t: tYou + 0.15, x: (D2.x + YOU.x) / 2 + 60, y: YOU.y - 20, z: 0.95, e: ease.inOutSine },
    ],
    camFollow: {
      t0: entry.t + 0.6, t1: 76.4, blend: 0.8,
      fn: (r, t) => {
        // follow whichever dot is the impulse, smoothed over ±0.4 s, looking a little ahead
        let sx = 0, sy = 0, n = 0;
        for (let d = -0.4; d <= 0.6; d += 0.1) {
          const tt = t + d;
          const q = tt < tHeld ? dotPos(r, tt) : tt < tWho ? { x: D1.x - 150, y: D1.y + 40 } : tt < tOpen2 ? (someonePos(tt) ?? D1) : tt < tYou ? rYou.at(rYou.length * clamp((tt - tOpen2) / (tYou - tOpen2))) : YOU;
          sx += q.x; sy += q.y; n++;
        }
        const coin = t > tFork - 0.5 && t < W10[4]!.start + 0.3 ? 1 : 0;
        return { x: sx / n - 40, y: sy / n - 60 - coin * 60, z: t > tYou - 0.6 ? 0.92 : 0.95 };
      },
    },
    hits: [{ t: tCoin, amp: 4 }, { t: tYou, amp: 6 }],
    impulse: (t) => (t < tHeld ? { x: 0, y: 0 } : null),
    draw(r: R, t: number) {
      const g = r.g;
      // the sheet: contours, grid, frame
      for (const c of contours) {
        r.path(c, true);
        r.stroke(r.c('faint'), 1);
      }
      label(r, 'SHEET 14 — VERSE II — PLAN', X - 450, Y - 860, 15, undefined, 'left', 500);
      label(r, 'CONTOUR INTERVAL: ONE DECISION', X - 450, Y - 834, 13, r.c('dim'));
      // compass
      r.local(YOU.x + 320, Y - 700, 0, 1, () => {
        r.poly([{ x: 0, y: -60 }, { x: 14, y: 0 }, { x: 0, y: 60 }, { x: -14, y: 0 }], r.c('fg'), undefined, 1.2);
        r.poly([{ x: 0, y: -60 }, { x: 14, y: 0 }, { x: -14, y: 0 }], undefined, r.c('fg'));
        r.text('N', 0, -74, mono(16, 600), r.c('fg'), 'center');
      });
      // scale bar
      r.line(X - 450, Y + 900, X - 50, Y + 900, r.c('fg'), 2);
      for (let k = 0; k <= 4; k++) r.line(X - 450 + k * 100, Y + 890, X - 450 + k * 100, Y + 910, r.c('fg'), 1);
      label(r, '0        1        2 KM', X - 450, Y + 880, 12);

      // roads
      road(r, rIn.path, r.c('fg'));
      road(r, left, r.c('fg'));
      road(r, right, r.c('mid'), 26, true);
      road(r, rDoor.path, r.c('fg'));
      road(r, someone, r.c('fg'));
      road(r, rYou, r.c('fg'), 26, false, (rYou.length * ease.outCubic(clamp((t - tOpen2) / 0.8))));
      // the travelled route glows behind the dot
      const p = dotPos(r, t);

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
      // signpost labels
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
          // crossed swords, the map symbol for a battle
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
      // the counterfactual dot runs the road not taken, at the sung pace, as a ghost
      if (t > W11[0]!.start - 0.3 && t < W11[4]!.start + 1) {
        const s = rRight.dotS(r, t, W11[0]!.start - 0.3, W11[3]!.end + 0.3);
        const q = right.at(s);
        r.alpha(1 - smoothstep(W11[4]!.start, W11[4]!.start + 0.8, t), () => dot(r, q.x, q.y, 0, true));
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

      // ---- doors
      const open1 = ease.outBack(clamp((t - tHeld - 0.3) / 0.6), 1.2) * (1 - smoothstep(tPass1 + 0.2, tPass1 + 1.0, t));
      door(r, D1.x + 10, D1.y - 20, 0, 100, open1, open1 > 0.02 && t < tPass1 + 0.4 ? 1 : 0);
      const open2 = ease.outBack(clamp((t - tOpen2) / 0.6), 1.2);
      door(r, D2.x + 40, D2.y - 30, Math.PI / 2, 100, open2, open2 > 0.02 ? 1 : 0);
      label(r, 'DOOR (HELD)', D1.x - 140, D1.y - 60, 13, undefined, 'left', 400, smoothstep(tHeld, tHeld + 0.3, t));
      orderTag(r, 16, D1.x + 180, D1.y - 90, 16, hit(t, tHeld, 0.4));
      orderTag(r, 17, D2.x + 120, D2.y - 160, 16, hit(t, tWho, 0.4));

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
      rWho.drawText(r, t);

      // ---- dots
      if (t >= entry.t && t < tHeld + 0.2) {
        dot(r, p.x, p.y, 1);
      } else if (t >= tHeld) {
        // the first dot stays at the door, holding it, then cools
        dot(r, D1.x - 20, D1.y + 10, 1 - smoothstep(tPass1, tPass1 + 0.6, t));
      }
      const sp = someonePos(t);
      if (sp) dot(r, sp.x, sp.y, t > tPass0 - 0.3 && t < tYou + 0.2 ? 1 : 0.2);
      if (t > tOpen2) {
        const s = rYou.length * ease.inOutSine(clamp((t - tOpen2) / (tYou - tOpen2)));
        const q = rYou.at(s);
        if (t < tYou) dot(r, q.x, q.y, 1);
      }
      void Ls;
    },
  };
  return { station: st, exit: { x: YOU.x, y: YOU.y, t: tYou } };
}
