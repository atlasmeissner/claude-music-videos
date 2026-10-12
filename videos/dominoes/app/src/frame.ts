// One frame of the video: camera, theme (ink or paper, with wipes), every visible station, overlays.
import { camAt, shake, type CamKey } from './engine/camera';
import { H, type R, W } from './engine/draw';
import { THEMES, type Theme } from './engine/palette';
import { clamp, smoothstep } from './engine/util';
import { STATIONS, THEME_KEYS, EXTRA_CAM } from './timeline';
import { grid, titleBlock } from './hud';

const CAM_KEYS: CamKey[] = [...STATIONS.flatMap((s) => s.cam ?? []), ...EXTRA_CAM].sort((a, b) => a.t - b.t);
const HITS = STATIONS.flatMap((s) => s.hits ?? []);

const FOLLOWS = STATIONS.filter((s) => s.camFollow).map((s) => s.camFollow!);

export function camera(t: number, r?: R) {
  const c = camAt(CAM_KEYS, t);
  if (r) {
    for (const f of FOLLOWS) {
      const b = f.blend ?? 0.6;
      if (t < f.t0 - b || t > f.t1 + b) continue;
      const w = t < f.t0 ? smoothstep(f.t0 - b, f.t0, t) : t > f.t1 ? 1 - smoothstep(f.t1, f.t1 + b, t) : 1;
      const p = f.fn(r, Math.max(f.t0, Math.min(f.t1, t)));
      c.x += (p.x - c.x) * w;
      c.y += (p.y - c.y) * w;
      c.z = Math.exp(Math.log(c.z) + (Math.log(p.z) - Math.log(c.z)) * w);
    }
  }
  const s = shake(t, HITS);
  return { x: c.x - s.dx / c.z, y: c.y - s.dy / c.z, z: c.z, r: c.r + s.dr };
}

/** Theme state: a base theme and, during a wipe, the incoming theme with its screen-space clip. */
export function themeAt(t: number): { a: Theme; b?: Theme; clip?: (r: R) => void; glow: number } {
  let cur = THEME_KEYS[0]!;
  for (const k of THEME_KEYS) if (t >= k.t) cur = k;
  const idx = THEME_KEYS.indexOf(cur);
  const next = THEME_KEYS[idx + 1];
  // wipes run over [k.t - k.dur, k.t]
  if (next && t >= next.t - next.dur && t < next.t) {
    const u = clamp((t - (next.t - next.dur)) / next.dur);
    return { a: THEMES[cur.theme], b: THEMES[next.theme], clip: (r) => next.wipe(r, u), glow: 1 };
  }
  return { a: THEMES[cur.theme], glow: cur.theme === 'ink' ? 1 : 0.35 };
}

// ------------------------------------------------------------------ the outro: the machine runs backwards
export const REWIND = { t0: 164.3, t1: 186.0 };
/** Song time -> machine time. After the last line the whole video rewinds to frame 0 by the last chord. */
export function warp(t: number) {
  if (t <= REWIND.t0) return t;
  if (t >= REWIND.t1) return 0;
  const u = (t - REWIND.t0) / (REWIND.t1 - REWIND.t0);
  // slow to start (the staccato slows), fastest in the middle, gentle landing on frame 0
  const k = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
  return REWIND.t0 * (1 - k);
}
/** How fast machine time runs (absolute), for motion blur sampling. */
export const warpSpeed = (t: number) => Math.abs(warp(t + 0.01) - warp(t - 0.01)) / 0.02;
/** 0 outside the rewind, 1 inside it. */
export const rewinding = (t: number) => (t > REWIND.t0 + 0.2 && t < REWIND.t1 - 0.05 ? 1 : 0) * smoothstep(REWIND.t0, REWIND.t0 + 1, t) * (1 - smoothstep(REWIND.t1 - 1.2, REWIND.t1 - 0.2, t));

export function drawWorld(r: R, t: number, th: Theme, rw = 0) {
  r.th = th;
  const g = r.g;
  r.screen();
  g.fillStyle = r.c('bg');
  g.fillRect(0, 0, W, H);
  r.world(camera(t, r));
  r.t = t;
  grid(r);
  for (const s of STATIONS) {
    if (!r.visible(s.x0, s.y0, s.x1, s.y1, 50)) continue;
    g.save();
    s.draw(r, t);
    g.restore();
    g.globalAlpha = 1;
  }
  r.screen();
  if (rw < 0.98) {
    for (const s of STATIONS) {
      if (s.overlay && t >= s.t0 - 1 && t <= s.t1 + 1) {
        g.save();
        g.globalAlpha = 1 - rw;
        s.overlay(r, t);
        g.restore();
      }
    }
  }
}

export function renderFrame(r: R, songT: number) {
  const t = warp(songT);
  const rw = rewinding(songT);
  r.lyricAlpha = 1 - 0.65 * rw;
  const th = themeAt(t);
  drawWorld(r, t, th.a, rw);
  if (th.b && th.clip) {
    const g = r.g;
    g.save();
    r.screen();
    th.clip(r);
    g.clip();
    drawWorld(r, t, th.b, rw);
    g.restore();
  }
  titleBlock(r, songT, t, rw);
  // rewind indicator (the drawing's own deadpan)
  if (rw > 0.01) {
    const g = r.g;
    r.screen();
    g.globalAlpha = rw;
    const sp = warpSpeed(songT);
    r.text(`◀◀  ×${sp.toFixed(1)}`, 96, 96, '600 22px "PlexMono-600"', r.c('sig'));
    r.text('REWINDING (EVERYTHING)', 96, 124, '400 15px "PlexMono-400"', r.c('mid'));
    r.text(`T = ${t.toFixed(2)} s`, 96, 148, '400 15px "PlexMono-400"', r.c('dim'));
    g.globalAlpha = 1;
  }
  return th;
}
