// Bridge, final chorus and climax (96.5 – 164.3 s): one chain of 41 dominoes.
//
//  Bridge: the chain shrinks (each domino 0.78× the last) while the camera follows it down to a
//  domino 2 units tall, "one millimetre". The one before it comes to rest against it and everything
//  holds through the whispered lines. On "changing" it tips.
//  Final chorus: the geometric chain, each domino twice the last, 20 doublings: a kilometre.
//  The camera pulls back on every impact; the scale labels climb from millimetres to kilometres.
//  "And now I see how far the falling goes": the whole chain, with the machine itself a speck
//  (shown in a magnifier). Climax: the echoes branch out from the landing across the frame.
//  Final2: three slams of DOMINOES and the last pull-back.
import { snapBeat } from '../engine/audio';
import { type Cam, H, type R, W } from '../engine/draw';
import { archivo, cormorant, mono } from '../engine/fonts';
import { type Line, display, line, wordState } from '../engine/lyrics';
import { lyric } from '../engine/text';
import { clamp, ease, hash, lerp, mulberry32, smoothstep, type V2 } from '../engine/util';
import { Chain, type Domino, drawDomino } from '../machine/domino';
import { hit } from '../machine/motion';
import { LN, type Station } from '../station';

const SHRINK = 0.78;
const NS = 20; // shrinking dominoes S_0..S_19, then D* (index 20)
const NG = 20; // growth: G_1..G_20 (indices 21..40)
const H0 = 300;
const MM = 0.5; // millimetres per world unit (D* is ~2 units = 1 mm)

function fmtLen(units: number) {
  const mm = units * MM;
  if (mm < 1000) return `${mm < 10 ? mm.toFixed(1) : Math.round(mm)} mm`;
  if (mm < 1e6) return `${(mm / 1000).toFixed(mm < 1e4 ? 2 : 1)} m`;
  return `${(mm / 1e6).toFixed(2)} km`;
}

export function makeGeo(x0: number, machineX0: number, machineX1: number, others: () => Station[]) {
  const LB = [line(LN.small), line(LN.remember), line(LN.life)];
  const LF = LN.fin.map((i) => line(i));
  const LF2 = LN.fin2.map((i) => line(i));
  const W20 = LB[0]!.words;

  // ---- geometry
  const hs: number[] = [];
  for (let k = 0; k <= NS; k++) hs.push(H0 * SHRINK ** k);
  const hStar = hs[NS]!;
  for (let j = 1; j <= NG; j++) hs.push(hStar * 2 ** j);
  const d: Domino[] = [];
  let x = x0;
  hs.forEach((h, i) => {
    const w = h * 0.2;
    if (i > 0) {
      const prev = d[i - 1]!;
      const gap = i <= NS ? prev.h * 0.5 : prev.h * 0.42;
      x = prev.x + prev.w / 2 + gap + w / 2;
    }
    d.push({ x, y: 0, w, h });
  });
  const last = d[d.length - 1]!;
  const IDX_STAR = NS;

  // ---- timing
  const Ts: number[] = [];
  const anchors: [number, number][] = [[0, W20[0]!.start], [4, W20[1]!.start], [7, W20[2]!.start], [9, W20[3]!.start], [12, W20[4]!.start], [13, W20[5]!.start], [17, W20[6]!.start], [19, W20[6]!.start + 0.36]];
  for (let k = 0; k < NS; k++) {
    let a = anchors[0]!, b = anchors[anchors.length - 1]!;
    for (let q = 0; q < anchors.length - 1; q++) if (k >= anchors[q]![0] && k <= anchors[q + 1]![0]) { a = anchors[q]!; b = anchors[q + 1]!; break; }
    Ts.push(a[0] === b[0] ? a[1] : lerp(a[1], b[1], (k - a[0]) / (b[0] - a[0])));
  }
  const T_STAR = LB[2]!.words[3]!.start; // "changing"
  const T_REST = Ts[NS - 1]! + 0.22; // S_19 comes to rest against D*
  const fin = LF;
  const sung: number[] = [
    110.2, fin[0]!.words[0]!.start, 0, 0, 0, 0, fin[1]!.words[0]!.start, 0, 0, fin[2]!.words[0]!.start, 0, 0, 0,
    fin[3]!.words[0]!.start, fin[3]!.words[1]!.start, fin[4]!.words[0]!.start, fin[4]!.words[4]!.start,
    fin[5]!.words[0]!.start, fin[5]!.words[1]!.start, fin[6]!.words[0]!.start,
  ];
  // fill the unanchored hits evenly between anchors, snapped to beats
  for (let j = 0; j < sung.length; j++) {
    if (sung[j]) continue;
    let a = j - 1;
    while (!sung[a]) a--;
    let b = j + 1;
    while (!sung[b]) b++;
    sung[j] = snapBeat(lerp(sung[a]!, sung[b]!, (j - a) / (b - a)));
  }
  const T = [...Ts, T_STAR, ...sung];
  const T_LAND = fin[6]!.words[8]!.start; // "goes"
  const contact: (number | undefined)[] = [];
  contact[NS - 1] = T_REST;
  const chain = new Chain(d, T, { lastFall: T_LAND - T[T.length - 1]!, glowAfter: 0.5, contact });

  // ---- camera
  const totalLen = last.x + last.h - x0;
  const zFull = 1920 / (totalLen * 1.18);
  const fullCam = { x: x0 + totalLen * 0.5, y: -last.h * 0.42, z: zFull };
  const idxAt = (t: number) => {
    // continuous index of the domino currently falling
    if (t <= T[0]!) return 0;
    for (let i = 0; i < T.length - 1; i++) if (t < T[i + 1]!) return i + clamp((t - T[i]!) / (T[i + 1]! - T[i]!));
    return T.length - 1;
  };
  const hAt = (k: number) => {
    const i = Math.floor(k), f = k - i;
    const a = hs[Math.min(i, hs.length - 1)]!, b = hs[Math.min(i + 1, hs.length - 1)]!;
    return Math.exp(lerp(Math.log(a), Math.log(b), f));
  };
  const xAt = (k: number) => {
    const i = Math.floor(k), f = k - i;
    const a = d[Math.min(i, d.length - 1)]!.x, b = d[Math.min(i + 1, d.length - 1)]!.x;
    return lerp(a, b, f);
  };
  function camFn(t: number): { x: number; y: number; z: number } {
    if (t < T_REST) {
      const k = idxAt(t);
      const h = hAt(k + 1);
      return { x: xAt(k + 0.6) + h * 0.2, y: -h * 0.75, z: 420 / h };
    }
    if (t < T_STAR) {
      // the hold: a slow push on the two smallest dominoes
      const u = ease.inOutSine(clamp((t - T_REST) / (T_STAR - T_REST)));
      const h = hStar;
      return { x: d[IDX_STAR]!.x - h * 0.3, y: -h * 0.7, z: lerp(420, 620, u) / h };
    }
    if (t < T_LAND - 0.4) {
      const k = idxAt(t);
      const h = hAt(k + 0.75);
      const settle = smoothstep(T_STAR, T[IDX_STAR + 1]!, t);
      const cx = xAt(k + 0.5) + h * 0.1;
      const z = lerp(620 / hStar, 330 / h, settle);
      return { x: lerp(d[IDX_STAR]!.x - hStar * 0.3, cx, settle), y: lerp(-hStar * 0.7, -h * 0.6, settle), z };
    }
    // the whole chain
    const k = idxAt(T_LAND - 0.4);
    const h = hAt(k + 1);
    const from = { x: xAt(k + 0.5) + h * 0.15, y: -h * 0.6, z: 330 / h };
    const u = ease.inOutCubic(clamp((t - (T_LAND - 0.4)) / 2.6));
    let z = Math.exp(lerp(Math.log(from.z), Math.log(fullCam.z), u));
    let cx = lerp(from.x, fullCam.x, u), cy = lerp(from.y, fullCam.y, u);
    // final pull-back on the last line
    const l = LF2[3]!;
    const v = ease.inOutCubic(clamp((t - l.start) / (l.end + 1 - l.start)));
    z *= Math.exp(lerp(0, Math.log(0.18), v));
    cx += totalLen * 0.05 * v;
    cy += last.h * 0.25 * v;
    // a slow drift during the climax
    const dr = smoothstep(137, 150, t);
    z *= 1 + 0.08 * dr;
    return { x: cx, y: cy, z };
  }

  // ---- the echo network (climax): branches out of the landed giant
  interface Seg { a: V2; b: V2; t0: number; dur: number; depth: number }
  const segs: Seg[] = [];
  {
    const rnd = mulberry32(2026);
    const root: V2 = { x: last.x + last.h, y: -last.w * 0.5 };
    const L0 = last.h * 0.42;
    const grow = (p: V2, ang: number, len: number, depth: number, t0: number) => {
      if (depth > 9) return;
      const b = { x: p.x + Math.cos(ang) * len, y: p.y + Math.sin(ang) * len };
      // keep above the ground mostly: reflect downward branches
      if (b.y > 0) b.y = -b.y * 0.3;
      const dur = 0.9 + rnd() * 0.5;
      segs.push({ a: p, b, t0, dur, depth });
      const n = depth < 2 ? 3 : 2;
      for (let q = 0; q < n; q++) {
        const spread = 0.5 + rnd() * 0.6;
        grow(b, ang + (q - (n - 1) / 2) * spread + (rnd() - 0.5) * 0.3, len * (0.62 + rnd() * 0.12), depth + 1, t0 + dur * (0.75 + rnd() * 0.2));
      }
    };
    const T0 = fin[6]!.end + 0.1;
    for (let q = 0; q < 5; q++) grow(root, -Math.PI * (0.15 + q * 0.2), L0, 0, T0 + q * 0.15);
    for (let q = 0; q < 4; q++) grow({ x: last.x + last.h * (0.2 + q * 0.2), y: -last.w }, -Math.PI * (0.35 + q * 0.12) - 0.4, L0 * 0.7, 1, T0 + 0.5 + q * 0.3);
  }

  // ---- inset: the machine, magnified
  function inset(r: R, t: number, a: number) {
    if (a <= 0.01) return;
    const mid = { x: (machineX0 + machineX1) / 2, y: -500 };
    const p = r.toScreen(mid.x, mid.y);
    const cx = 470, cy = 300, rad = 210;
    const g = r.g;
    r.screen();
    r.alpha(a, () => {
      g.beginPath();
      g.moveTo(p.x, p.y);
      g.lineTo(cx + (p.x - cx) * (rad / Math.hypot(p.x - cx, p.y - cy)), cy + (p.y - cy) * (rad / Math.hypot(p.x - cx, p.y - cy)));
      r.stroke(r.c('mid'), 1);
      r.circle(p.x, p.y, 6, r.c('sig'), undefined, 1.2);
      g.save();
      g.beginPath();
      g.arc(cx, cy, rad, 0, Math.PI * 2);
      g.fillStyle = r.c('bg');
      g.fill();
      g.clip();
      const saved: Cam = { ...r.cam };
      const savedView = { ...r.view };
      const zIn = (rad * 2.1) / (machineX1 - machineX0);
      const camIn: Cam = { x: mid.x, y: mid.y, z: zIn, r: 0 };
      // world transform for the inset: centre it on the circle instead of the screen
      r.world(camIn);
      g.setTransform(zIn * r.S, 0, 0, zIn * r.S, (cx - zIn * mid.x) * r.S, (cy - zIn * mid.y) * r.S);
      const tt = Math.min(t, 96);
      for (const s of others()) {
        g.save();
        s.draw(r, tt);
        g.restore();
      }
      r.cam = saved;
      r.unit = saved.z;
      r.view = savedView;
      g.restore();
      r.screen();
      r.circle(cx, cy, rad, r.c('fg'), undefined, 1.4);
      r.text('THE MACHINE, ENLARGED', cx - rad, cy + rad + 30, mono(15, 500), r.c('fg'));
      r.text('EVERYTHING SO FAR. (FOR SCALE: THE SPECK.)', cx - rad, cy + rad + 52, mono(13), r.c('mid'));
    });
  }

  // ---- screen-space slams for the final chorus
  function slam(r: R, l: Line, t: number, cx: number, cy: number, size: number, opts: { width?: number; until?: number; align?: 'center' | 'left' | 'right' } = {}) {
    const until = opts.until ?? l.end + 1.2;
    if (t < l.start - 0.3 || t > until + 0.3) return;
    const a = smoothstep(l.start - 0.3, l.start, t) * (1 - smoothstep(until, until + 0.3, t));
    const k = 1 + 0.1 * hit(t, l.start, 0.12);
    r.alpha(a, () => {
      r.local(cx, cy, 0, k, () => {
        lyric(r, l, 0, 0, {
          size, width: opts.width ?? 1000, weight: 900, align: opts.align ?? 'center', upper: true, unsung: 0.22, appear: 0.3, maxWidth: 1700,
          // the slam flashes orange on the hit and cools to bone fast (big orange type blooms)
          fx: (f) => {
            if (f.state !== 'unsung') f.color = r.mix('sig', 'fg', smoothstep(0.15, 0.7, f.dt));
          },
        });
      });
    });
  }

  const st: Station = {
    id: 'geo',
    x0: x0 - 400, x1: last.x + last.h * 3, y0: -last.h * 3, y1: last.h,
    t0: 96, t1: 165,
    camFollow: { t0: 96.52, t1: 164.3, blend: 0.35, fn: (_r, t) => camFn(t) },
    hits: [
      ...sung.map((tt, j) => ({ t: tt, amp: 4 + Math.min(16, j * 0.9), hl: 0.12 + j * 0.006 })),
      { t: T_LAND, amp: 24, hl: 0.3 },
      ...LF2.slice(0, 3).map((l) => ({ t: l.start, amp: 14 })),
    ],
    draw(r: R, t: number) {
      const g = r.g;
      // ground: a hairline across everything visible
      const v = r.view;
      r.line(Math.max(x0 - 400, v.x0), 0, v.x1, 0, r.c('fg'), 1.2);
      // wobble of D* before it falls
      chain.draw(r, t, {
        lw: 1.6,
        color: (i, heat, spent) => {
          if (i === IDX_STAR && t < T_STAR) return r.c('sig');
          if (i === IDX_STAR - 1 && t > T_REST && t < T_STAR) return r.mix('sig', 'fg', smoothstep(T_REST, T_REST + 1, t));
          return heat > 0.01 ? r.mix(spent ? 'dim' : 'fg', 'sig', heat) : undefined;
        },
      });
      void drawDomino;
      // ---- scale labels: each domino's height
      for (let i = IDX_STAR; i < d.length; i++) {
        const dm = d[i]!;
        const sz = dm.h * 0.09;
        if (r.onScreen(sz) < 7 || r.onScreen(sz) > 80) continue;
        const a = smoothstep(T[i]! - 0.6, T[i]! - 0.2, t);
        if (a <= 0) continue;
        r.alpha(a, () => {
          const xl = dm.x - dm.w / 2 - dm.h * 0.05;
          r.line(xl, 0, xl, -dm.h, r.c('mid'), 1);
          r.line(xl - dm.h * 0.02, -dm.h, xl + dm.h * 0.02, -dm.h, r.c('mid'), 1);
          r.text(fmtLen(dm.h), xl - dm.h * 0.03, -dm.h * 0.5, mono(sz, 500), i === IDX_STAR ? r.c('sig') : r.c('mid'), 'right');
          if (i > IDX_STAR) r.text(`No. ${i - IDX_STAR}  ×2`, xl - dm.h * 0.03, -dm.h * 0.5 + sz * 1.4, mono(sz * 0.7), r.c('dim'), 'right');
        });
      }
      // the stop: scale bar and caption by D*
      const ds = d[IDX_STAR]!;
      const capA = smoothstep(T_REST, T_REST + 0.6, t) * (1 - smoothstep(T_STAR + 0.4, T_STAR + 1.2, t));
      if (capA > 0) {
        r.alpha(capA, () => {
          const sz = ds.h * 0.07;
          r.line(ds.x - ds.h * 0.6, ds.h * 0.25, ds.x - ds.h * 0.6 + 2 / MM / 2, ds.h * 0.25, r.c('fg'), 1.2);
          r.text('1 mm', ds.x - ds.h * 0.6, ds.h * 0.25 + sz * 1.6, mono(sz, 500), r.c('fg'));
          r.text('FIG. 21 — SOMETHING SMALL', ds.x - ds.h * 0.6, -ds.h * 1.55, mono(sz, 500), r.c('mid'));
          r.text('(ACTUAL SIZE NOT SHOWN)', ds.x - ds.h * 0.6, -ds.h * 1.55 + sz * 1.5, mono(sz * 0.85), r.c('dim'));
        });
        // dust motes, suspended
        for (let q = 0; q < 30; q++) {
          const px = ds.x - ds.h * 1.5 + hash(q, 1) * ds.h * 3, py = -hash(q, 2) * ds.h * 1.6;
          const drift = Math.sin(t * 0.3 + q) * ds.h * 0.01;
          r.circle(px + drift, py, r.px(1 + hash(q, 3)), undefined, r.c('fg', 0.25 * capA));
        }
      }
      // D*'s teeter before it goes
      if (t > LB[2]!.start - 0.1 && t < T_STAR) {
        const k = smoothstep(LB[2]!.start, T_STAR, t);
        r.alpha(k, () => {
          g.beginPath();
          g.arc(ds.x + ds.w / 2, 0, ds.h * 1.05, -Math.PI / 2, -Math.PI / 2 + 0.5);
          g.setLineDash([r.px(4), r.px(4)]);
          r.stroke(r.c('sig'), 1);
          g.setLineDash([]);
        });
      }

      // ---- the echo network
      const T0 = fin[6]!.end;
      if (t > T0) {
        const fade = 1;
        for (const s of segs) {
          const u = clamp((t - s.t0) / s.dur);
          if (u <= 0) continue;
          const bx = lerp(s.a.x, s.b.x, ease.outCubic(u)), by = lerp(s.a.y, s.b.y, ease.outCubic(u));
          const heat = u < 1 ? 1 : Math.max(0, 1 - (t - s.t0 - s.dur) / 0.8);
          const lw = Math.max(0.6, 2.6 - s.depth * 0.22);
          r.line(s.a.x, s.a.y, bx, by, heat > 0.02 ? r.mix(s.depth > 5 ? 'dim' : 'fg', 'sig', heat) : r.c(s.depth > 5 ? 'dim' : 'fg', fade), lw);
          // little dominoes along the branch (ticks), fallen behind the front
          if (s.depth < 6) {
            const n = 6;
            const ang = Math.atan2(s.b.y - s.a.y, s.b.x - s.a.x);
            for (let q = 1; q < n; q++) {
              const f = q / n;
              if (f > ease.outCubic(u)) break;
              const px = lerp(s.a.x, s.b.x, f), py = lerp(s.a.y, s.b.y, f);
              const tick = r.px(7 - s.depth);
              r.line(px - Math.sin(ang) * tick, py + Math.cos(ang) * tick, px + Math.sin(ang) * tick * 0.2, py - Math.cos(ang) * tick * 0.2, r.c('mid'), 1);
            }
          }
          if (u < 1) r.circle(bx, by, r.px(3.2), undefined, r.c('ember'));
        }
      }
    },
    overlay(r: R, t: number) {
      // ---- bridge (screen space: the camera zooms continuously here). All three lines are whispered:
      // Cormorant italic, top left, each forgotten soon after it is sung.
      for (const [li, y] of [[0, 160], [1, 250], [2, 340]] as const) {
        const l = LB[li]!;
        const until = li === 0 ? LB[1]!.start - 0.2 : li === 1 ? T_STAR + 1.3 : T_STAR + 1.3;
        if (t < l.start - 0.6 || t > until + 0.6) continue;
        const size = li === 2 ? 72 : 60;
        r.g.font = cormorant(size, true, 400);
        let cx = 140;
        for (const w of l.words) {
          const text = display(w.w);
          const ww = r.g.measureText(text + ' ').width;
          const appear = smoothstep(l.start - 0.5, l.start - 0.1, t);
          const forget = li === 1 ? 1 - smoothstep(w.end + 0.4, w.end + 1.6, t) : li === 0 ? 1 - smoothstep(until - 0.4, until + 0.4, t) : 1 - smoothstep(T_STAR + 0.6, T_STAR + 1.3, t);
          const stt = wordState(w, t);
          const col = stt === 'unsung' ? r.c('fg', 0.3) : li === 2 && w.w === 'changing' ? r.c('sig') : r.mix('sig', 'fg', smoothstep(w.end, w.end + 0.6, t));
          r.alpha(appear * forget, () => r.text(text, cx, y, cormorant(size, true, li === 2 ? 600 : 400), col));
          cx += ww;
        }
      }
      // final chorus slams and lines (screen space)
      slam(r, fin[0]!, t, W / 2, H - 150, 170, { until: fin[0]!.words[0]!.start + 1.8 });
      slam(r, fin[1]!, t, W / 2, H - 150, 190, { until: fin[1]!.words[0]!.start + 1.8 });
      slam(r, fin[2]!, t, W / 2, H - 150, 210, { until: fin[2]!.words[0]!.start + 3.2 });
      slam(r, fin[3]!, t, W / 2, H / 2 - 20, 150, { width: 1000 });
      // a cappella line: lower third, quieter
      if (t > fin[4]!.start - 0.6 && t < fin[4]!.end + 0.8) {
        const a = 1 - smoothstep(fin[4]!.end + 0.4, fin[4]!.end + 0.8, t);
        r.alpha(a, () => lyric(r, fin[4]!, 120, H - 150, { size: 66, width: 1000, weight: 700, appear: 0.5 }));
      }
      slam(r, fin[5]!, t, W / 2, H / 2 - 20, 150, { width: 1000 });
      if (t > fin[6]!.start - 0.5 && t < 150) {
        const a = 1 - smoothstep(139.5, 140.5, t);
        r.alpha(a, () => lyric(r, fin[6]!, 120, H - 150, { size: 66, width: 1000, weight: 700, appear: 0.4 }));
      }
      // the magnifier on the machine
      // (the "machine, enlarged" magnifier is not shown)
      // climax caption and counter
      if (t > T_LAND && t < 150.3) {
        const a = smoothstep(T_LAND + 1.5, T_LAND + 2.2, t) * (1 - smoothstep(149.6, 150.2, t));
        const n = Math.floor(2 ** Math.min(20, 1 + (t - T_LAND) * 1.6));
        r.alpha(a, () => {
          r.text(n.toLocaleString('en-US'), W - 120, 190, archivo(120, 750, 900), r.c('sig'), 'right');
          r.text('CONSEQUENCES, AND COUNTING', W - 124, 228, mono(16, 500), r.c('mid'), 'right');
          r.text(`THE LAST DOMINO: ${fmtLen(last.h)}`, W - 124, 254, mono(14), r.c('dim'), 'right');
        });
      }
      // final2: three slams, three layouts
      slam(r, LF2[0]!, t, 120, 330, 180, { align: 'left', until: LF2[1]!.start - 0.05 });
      slam(r, LF2[1]!, t, W - 120, 330, 180, { align: 'right', until: LF2[2]!.start - 0.05 });
      slam(r, LF2[2]!, t, W / 2, H / 2 + 40, 220, { until: LF2[3]!.start - 0.1 });
      if (t > LF2[3]!.start - 0.5 && t < 165) {
        const a = 1 - smoothstep(164.4, 165, t);
        r.alpha(a, () => lyric(r, LF2[3]!, 120, H - 150, { size: 66, width: 1000, weight: 700, appear: 0.4 }));
      }
    },
  };
  return { station: st, fullCam, last, T_LAND };
}
