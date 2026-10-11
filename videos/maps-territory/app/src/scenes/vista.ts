// vista — intro, the band comes in under the horn (bass entry → the drum break).
// The territory seen standing in it: a panorama of ridgelines, each one an east–west section through the height
// field, stacked back to front with perspective (the near ones low and large, the far ones thin at the horizon).
// The viewer drifts north over the country, so the sections slide toward the camera. The lamp stands in the
// near valley. On the first swell the title and the artist are set over the sky; a compass star rises.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { FSPass, Layer2D, clearRT, W, H } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F, font, measure } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import { clamp, ease, frameIdx, hash, lerp, prog } from '../engine/util';
import { hAt, coastX } from './_world';
import { compassStar, lamp, mono } from './_mt';

export const HORIZON = 430;
/**
 * The ridgeline panorama as line segments (floating horizon): rows are sections through the height field at
 * fixed latitudes north of the viewer, sampled at regular screen columns, drawn near to far; a row only shows where
 * it rises above everything nearer. camY: the viewer's latitude (km, looking north); camX: easting.
 * col(fade) gives each row's colour/alpha (fade 1 near .. 0 far). Returns the nearest visible rows' points.
 */
export function ridgeLines(lb: LineBatch, camX: number, camY: number, o: { rows?: number; dz?: number; camH?: number; f?: number; horizon?: number; col?: (fade: number) => [[number, number, number], number]; width?: (fade: number) => number } = {}) {
  const rows = o.rows ?? 90, dz = o.dz ?? 0.8, camH = o.camH ?? 3.0, f = o.f ?? 1100, hz = o.horizon ?? HORIZON;
  const STEP = 6, NC = Math.ceil(W / STEP) + 1;
  const env = new Float32Array(NC).fill(H + 50);
  const first = Math.floor(camY - 0.6);
  const rowsOut: { x: number; y: number }[][] = [];
  const ys = new Float32Array(NC);
  for (let k = 0; k < rows; k++) {
    const yw = first - k * dz;
    const z = camY - yw;
    if (z < 0.6) continue;
    for (let i = 0; i < NC; i++) {
      const xw = camX + ((i * STEP - W / 2) * z) / f;
      ys[i] = hz + (f * (camH - Math.max(0, hAt(xw, yw)) * 3.0)) / z;
    }
    const fade = clamp(1 - z / (rows * dz));
    const [rgb, al] = o.col ? o.col(fade) : [LIN.bone, 0.08 + 0.62 * fade * fade] as [[number, number, number], number];
    const wd = o.width ? o.width(fade) : 0.8 + 1.1 * fade;
    if (rowsOut.length < 12) rowsOut.push(Array.from(ys, (y, i) => ({ x: i * STEP, y })));
    for (let i = 0; i + 1 < NC; i++) {
      const a = ys[i]!, b = ys[i + 1]!;
      const va = a < env[i]! - 0.5, vb = b < env[i + 1]! - 0.5;
      if (va && vb) lb.seg2(i * STEP, a, (i + 1) * STEP, b, wd, rgb, al);
      else if (va || vb) {
        // partly hidden: draw the visible half
        const m = 0.5;
        if (va) lb.seg2(i * STEP, a, (i + m) * STEP, a + (b - a) * m, wd, rgb, al);
        else lb.seg2((i + m) * STEP, a + (b - a) * m, (i + 1) * STEP, b, wd, rgb, al);
      }
    }
    for (let i = 0; i < NC; i++) env[i] = Math.min(env[i]!, ys[i]!);
  }
  return rowsOut;
}

/**
 * Ridgelines seen from (cx, cy) at height camH (km) facing `yaw` (radians; world x east, y south: −π/2 = north,
 * π = west), floating horizon as in ridgeLines. Over the sea the sections lie flat and read as water lines
 * (coloured by `sea`). Returns a projector for drawing other things (the track) into the same view.
 */
export function ridgeLinesDir(lb: LineBatch, cx: number, cy: number, yaw: number, o: { rows?: number; dz?: number; z0?: number; camH?: number; f?: number; horizon?: number; col?: (fade: number, land: number) => [[number, number, number], number] } = {}) {
  const rows = o.rows ?? 90, dz = o.dz ?? 0.8, camH = o.camH ?? 3.0, f = o.f ?? 1100, hz = o.horizon ?? HORIZON, z0 = o.z0 ?? 0.8;
  const fx = Math.cos(yaw), fy = Math.sin(yaw), rx = -Math.sin(yaw), ry = Math.cos(yaw);
  const STEP = 6, NC = Math.ceil(W / STEP) + 1;
  const env = new Float32Array(NC).fill(H + 50);
  const ys = new Float32Array(NC), land = new Float32Array(NC);
  for (let k = 0; k < rows; k++) {
    const z = z0 + k * dz;
    for (let i = 0; i < NC; i++) {
      const xr = ((i * STEP - W / 2) * z) / f;
      const h = hAt(cx + fx * z + rx * xr, cy + fy * z + ry * xr);
      land[i] = h > 0.002 ? 1 : 0;
      ys[i] = hz + (f * (camH - Math.max(0, h) * 3.0)) / z;
    }
    const fade = clamp(1 - z / (z0 + rows * dz));
    for (let i = 0; i + 1 < NC; i++) {
      const a = ys[i]!, b = ys[i + 1]!;
      if (!(a < env[i]! - 0.5 && b < env[i + 1]! - 0.5)) continue;
      const [rgb, al] = o.col ? o.col(fade, land[i]!) : [LIN.bone, 0.08 + 0.62 * fade * fade] as [[number, number, number], number];
      lb.seg2(i * STEP, a, (i + 1) * STEP, b, 0.8 + 1.1 * fade, rgb, al);
    }
    for (let i = 0; i < NC; i++) env[i] = Math.min(env[i]!, ys[i]!);
  }
  return (x: number, y: number, h = 0) => {
    const dx = x - cx, dy = y - cy;
    const z = dx * fx + dy * fy, xr = dx * rx + dy * ry;
    if (z < 0.3) return null;
    return { x: W / 2 + (f * xr) / z, y: hz + (f * (camH - Math.max(0, h) * 3.0)) / z, z };
  };
}

/** Night sky over a horizon (y px from the top): a cool glow at the horizon, stars; warmth 0..1 for dawn. */
export const SKY_FRAG = /* glsl */ `
uniform float horizon; uniform float tw; uniform float warmth; uniform float stars;
void main() {
  vec2 px = vec2(FRAG_PX.x, 1080.0 - FRAG_PX.y);
  float above = horizon - px.y; // > 0 in the sky
  vec3 col;
  if (above > 0.0) {
    float y = 1.0 - above / horizon;
    col = mix(C_INK, C_INK2 * 1.25, pow(y, 3.0));
    // dawn: a glow that hugs the horizon, hottest low down
    float g = exp(-above / 210.0);
    col += warmth * g * mix(C_BLOOD * 0.35, C_EMBER * 0.42, exp(-above / 50.0));
    // stars on a jittered grid
    vec2 cell = floor(px / 22.0);
    float h = hash12(cell);
    vec2 sp = (cell + 0.2 + 0.6 * hash22(cell + 7.0)) * 22.0;
    float d = length(px - sp);
    float br = step(0.93, h) * pow(hash12(cell + 3.1), 3.0) * (0.6 + 0.4 * hash12(cell + floor(tw)));
    col += C_BONE * br * (1.0 - smoothstep(0.4, 1.4, d)) * 0.9 * stars * (1.0 - y * 0.85) * (1.0 - warmth * 0.8);
  } else {
    // below the horizon: the dark sea / land, with a faint warm reflection near the horizon at dawn
    col = mix(C_INK2 * 1.25, C_INK * 0.95, warmth) + warmth * C_EMBER * 0.07 * exp(above / 140.0);
  }
  fragColor = vec4(col, 1.0);
}`;

export default class Vista extends Scene {
  skyPass = new FSPass(SKY_FRAG, { horizon: { value: HORIZON }, tw: { value: 0 }, warmth: { value: 0 }, stars: { value: 1 } });
  text = new Layer2D();
  ridges = new LineBatch(40000, { blend: 'normal' });
  lb = new LineBatch(200);

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, audio } = this.ctx;
    const t = f.t, t0 = this.ctx.start, t1 = this.ctx.end;
    this.skyPass.u.tw!.value = frameIdx(t) / 8;
    this.skyPass.render(renderer, out);
    // the viewer drifts north; faster once the drums are in
    const u = prog(t, t0, t1, (x) => x);
    const camY = 96 - 9 * u - 7 * prog(t, 27.3, t1, ease.inQuad);
    const camX = 36 + 6 * u;
    this.ridges.clear();
    const ridges = ridgeLines(this.ridges, camX, camY);
    this.ridges.render(renderer, out);
    const near = ridges[0];

    const lb = this.lb; lb.clear();
    const now = audio.env('other', t);
    if (near) {
      let row = near;
    for (let k = 0; k < ridges.length; k++) { const r = ridges[k]!; if (r[Math.floor(r.length * 0.38)]!.y < 930) { row = r; break; } }
    const p = row[Math.floor(row.length * 0.38)]!;
      lamp(lb, p.x, p.y - 6, t, 0.9 + 0.3 * now, 0.8 + 0.4 * now);
    }
    lb.render(renderer, out);

    // title on the first swell, the artist after; a compass star rises behind them
    const T = this.text, d = T.ctx; T.clear();
    const a = prog(t, t0 + 0.2, t0 + 2.2, ease.outCubic) * (1 - prog(t, 31.5, 33.6, ease.inOutCubic));
    if (a > 0) {
      const sy = lerp(250, 205, prog(t, t0, t1, ease.outCubic));
      compassStar(d, W / 2, sy - 128, 40, { col: rgba('bone', 0.75), fill: rgba('signal', 0.95), alpha: a * 0.9, lw: 1 });
      const title = 'MAPS & TERRITORY';
      const fam = F.archivo(lerp(87.5, 125, prog(t, t0, 26, ease.outCubic)), 300);
      const size = 96, tr = lerp(6, 22, prog(t, t0, t1, ease.outCubic));
      d.save();
      d.globalAlpha = a;
      d.font = font(fam, size); d.letterSpacing = `${tr}px`; d.textBaseline = 'alphabetic';
      d.fillStyle = rgba('bone', 1);
      const wt = measure(title, fam, size, tr);
      d.fillText(title, W / 2 - wt / 2 + tr / 2, sy);
      d.restore();
      const b = prog(t, 20.4, 22.4, ease.outCubic) * a;
      if (b > 0) {
        d.save(); d.globalAlpha = b;
        mono(d, 'JOBURGALEX', W / 2, sy + 62, { size: 20, color: rgba('signal', 1), track: 14, align: 'center', weight: 500 });
        mono(d, 'TITLE TRACK  ·  FRENCH HORN, OPEN COUNTRY', W / 2, sy + 94, { size: 12, color: rgba('ash', 0.85), track: 4, align: 'center' });
        d.restore();
      }
    }
    // a quiet survey readout, bottom left
    d.globalAlpha = prog(t, t0 + 1, t0 + 3) * (1 - prog(t, t1 - 0.6, t1));
    mono(d, `LAT ${camY.toFixed(2)} S   LON ${camX.toFixed(2)} E   FACING N`, 120, 1000, { size: 12, color: rgba('bone', 0.55), track: 3 });
    mono(d, `COAST ${coastX(camY).toFixed(1)} E`, W - 120, 1000, { size: 12, color: rgba('bone', 0.45), track: 3, align: 'right' });
    d.globalAlpha = 1;
    comp.draw(renderer, T.upload(), out);
    const fadeIn = 1 - prog(t, t0, t0 + 0.5);
    return { bloom: 0.6, vignette: 0.5, ca: 0.5, halation: 0.25, flash: fadeIn * 0.0 };
  }
}
