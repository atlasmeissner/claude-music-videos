// The little world (revision 3): one small planet whose axis tilts by exactly one degree on every sung "degree"
// (0° at the start, 24° at the end, a hair more than Earth's 23.4°, which is what gives Earth its seasons). The frame
// never tilts; the planet does. Two views:
//  - Planet: an engraved globe lit from the right. Ice covers everything poleward of the ice line, which retreats
//    with the tilt; land is hatched by the light; at night, the lights of whoever lives there.
//  - Village: the view from the ground at 50° north. The sun's noon height, the snow, the river, the trees, the
//    fields and the windows all follow the tilt: one degree of planet, a season's difference for the people on it.
import * as THREE from 'three';
import { FSPass, W, H } from '../engine/gl';
import type { LineBatch } from '../engine/lines';
import { LIN } from '../engine/palette';
import { clamp, hash, lerp, noise1, TAU } from '../engine/util';

export const TILT_MAX = 24;
/** Ice line latitude (degrees) for a tilt (degrees): a snowball at 0°, open water to 77° at 24°. */
export const iceLat = (tilt: number) => 15 + 2.6 * tilt;
/** The village's latitude (degrees north). */
export const VILLAGE_LAT = 50;
/** 0..1: how warm the village is (snowbound until ~5°, thawing, green from ~14°). */
export const warmth = (tilt: number) => clamp((tilt - 1) / 15);
/** Noon sun height over the village at midsummer (degrees): 90 − lat + tilt. */
export const noonSun = (tilt: number) => 90 - VILLAGE_LAT + tilt;
/** What each degree does to the village (degree n -> EVENTS[n-1]). */
export const EVENTS = [
  'THE NOON SUN CLEARS THE RIDGE', 'THE FIRST ICICLE DRIPS', 'SNOW SLIDES OFF THE SCHOOL ROOF', 'THE RIVER CRACKS',
  'TWELVE MORE MINUTES OF DAYLIGHT', 'THE RIVER RUNS', 'BUDS ON THE LINDEN TREE', 'THE FERRY RUNS AGAIN',
  'THE FIRST FIELD IS PLOUGHED', 'THE SWALLOWS COME BACK', 'WINDOWS OPEN AT NOON', 'THE SNOW IS GONE BY MAY',
  'BEES', 'THE ICE LINE PASSES THE VILLAGE', 'A SECOND CROP', 'THE CHILDREN SWIM IN THE RIVER',
  'ORCHARDS', 'A MARKET EVERY SATURDAY', 'LIGHTS ACROSS THE VALLEY', 'A NEW SCHOOL',
  'THE HARBOUR STAYS OPEN ALL YEAR', 'NEIGHBOURS FROM THE SOUTH', 'SUMMER, AUTUMN, WINTER, SPRING', 'SEASONS',
];
/** Growing season (days) at the village, deadpan. */
export const season = (tilt: number) => Math.round(Math.max(0, (tilt - 6) / 18) * 160);

const FRAG = /* glsl */ `
uniform vec2 C; uniform float R; uniform float tilt; uniform float spin; uniform float ice; uniform float life;
uniform float t; uniform float fade; uniform vec3 Ldir;
mat3 rotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }
mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
void main() {
  vec2 p = vec2(FRAG_PX.x, ${H.toFixed(1)} - FRAG_PX.y);
  vec2 d = (p - C) / R;
  float r2 = dot(d, d);
  vec3 col = C_INK;
  // a few fixed stars
  vec2 sc = floor(p / 6.0);
  float st = hash12(sc + 7.0);
  if (st > 0.9965) col += C_BONE * 0.35 * smoothstep(1.6, 0.0, length(p - (sc + 0.5) * 6.0));
  if (r2 < 1.0) {
    vec3 n = vec3(d.x, -d.y, sqrt(1.0 - r2));
    // planet frame: undo the axial tilt (the north pole leans right = toward the sun), then the spin
    vec3 q = rotZ(tilt) * n;
    q = rotY(spin) * q;
    float lat = asin(clamp(q.y, -1.0, 1.0));
    float lon = atan(q.z, q.x);
    float h = fbm(q * 1.55 + vec3(3.1, 1.7, 5.3), 4) + 0.10 * (abs(lat) * 0.6);
    float land = smoothstep(0.035, 0.06, h);
    float iced = smoothstep(ice - 0.012, ice + 0.012, abs(lat));
    vec3 L = normalize(Ldir);
    float diff = dot(n, L);
    float day = smoothstep(-0.10, 0.35, diff);
    // ocean: engraved parallels every 3 degrees, lit
    float par = pxLine(abs(fract(lat * 57.2958 / 3.0) - 0.5) * 3.0 / 57.2958 * R, 0.0, 0.6);
    vec3 ocean = C_INK2 * 0.7 + C_BONE * 0.07 * par * day;
    // land: a flat lit tone with a few wide engraved strokes, and a hairline coast
    float eg = hatch((rot2(0.8) * p).y * 0.16, 0.35);
    vec3 ground = C_INK2 + C_BONE * (0.30 * day + 0.06 * eg * day);
    float coast = 1.0 - smoothstep(0.0, 1.3, abs(h - 0.047) / max(fwidth(h), 1e-4));
    // ice: engraved, not flat: close parallel strokes following the latitude, lit
    float ist = pxLine(abs(fract(lat * 57.2958 / 0.9 + 0.3 * fbm(q * 6.0, 2)) - 0.5) * 0.9 / 57.2958 * R, 0.0, 0.9);
    vec3 icec = C_INK2 + C_BONE * (0.04 + 0.32 * day) * (0.35 + 0.65 * ist);
    col = mix(ocean, ground, land);
    col = mix(col, C_BONE * (0.12 + 0.6 * day), coast * 0.85);
    col = mix(col, icec, iced);
    // the ice line: a hot line that moves 111 km for every degree
    float edge = pxLine(abs(abs(lat) - ice) * R, 0.4, 1.6) * step(-0.25, diff);
    col = mix(col, C_SIGNAL * 1.8, edge);
    // night lights: the people, on unfrozen land in the dark
    vec2 cell = floor(vec2(lon, lat) * 26.0);
    float hh = hash12(cell);
    vec2 cc = (cell + 0.5 + (vec2(hash12(cell + 3.1), hash12(cell + 7.7)) - 0.5) * 0.7) / 26.0;
    float dd = length((vec2(lon, lat) - cc) * vec2(cos(lat), 1.0)) * R;
    float lit = step(hh, 0.08 + life * 0.6) * step(0.02, life) * land * (1.0 - iced) * (1.0 - smoothstep(-0.1, 0.12, diff));
    col += C_EMBER * 2.6 * lit * smoothstep(2.6, 0.3, dd);
    // limb darkening + rim
    col *= 0.55 + 0.45 * smoothstep(0.0, 0.35, n.z);
  }
  float rr = sqrt(r2);
  col = mix(col, C_BONE * 0.85, pxLine(abs(rr - 1.0) * R, 0.2, 1.0));
  col += C_BONE * 0.05 * smoothstep(1.06, 1.0, rr) * step(1.0, rr);
  fragColor = vec4(col * fade, 1.0);
}`;

export class Planet {
  pass = new FSPass(FRAG, {
    C: { value: new THREE.Vector2(W / 2, H / 2) }, R: { value: 360 }, tilt: { value: 0 }, spin: { value: 0 },
    ice: { value: 0.3 }, life: { value: 0 }, t: { value: 0 }, fade: { value: 1 }, Ldir: { value: new THREE.Vector3(1, 0.16, 0.32) },
  });
  /** Draw the planet (fully overwrites `out`). tilt in degrees. */
  render(renderer: THREE.WebGLRenderer, out: THREE.WebGLRenderTarget, o: { cx: number; cy: number; R: number; tilt: number; spin: number; t: number; fade?: number; light?: [number, number, number] }) {
    const u = this.pass.u;
    (u.C!.value as THREE.Vector2).set(o.cx, o.cy);
    u.R!.value = o.R; u.tilt!.value = (o.tilt * Math.PI) / 180; u.spin!.value = o.spin;
    u.ice!.value = (iceLat(o.tilt) * Math.PI) / 180; u.life!.value = clamp((o.tilt - 6) / 18); u.t!.value = o.t;
    u.fade!.value = o.fade ?? 1;
    const Lv = o.light ?? [1, 0.16, 0.32];
    (u.Ldir!.value as THREE.Vector3).set(Lv[0], Lv[1], Lv[2]);
    this.pass.render(renderer, out);
  }
  /** Screen position of a planet point (lat/lon in degrees) and whether it faces us. */
  static project(o: { cx: number; cy: number; R: number; tilt: number; spin: number }, latD: number, lonD: number) {
    const lat = (latD * Math.PI) / 180, lon = (lonD * Math.PI) / 180;
    // planet frame -> undo spin -> undo tilt (inverse of the shader's mapping)
    let x = Math.cos(lat) * Math.cos(lon), y = Math.sin(lat), z = Math.cos(lat) * Math.sin(lon);
    const s = -o.spin; // inverse rotY
    const x1 = Math.cos(s) * x + Math.sin(s) * z, z1 = -Math.sin(s) * x + Math.cos(s) * z;
    x = x1; z = z1;
    const tl = -(o.tilt * Math.PI) / 180; // the shader maps view -> planet with Rz(+tilt); back with Rz(-tilt)
    const x2 = Math.cos(tl) * x - Math.sin(tl) * y, y2 = Math.sin(tl) * x + Math.cos(tl) * y;
    return { x: o.cx + x2 * o.R, y: o.cy - y2 * o.R, front: z > 0 };
  }
}

/** The axis through the planet (and beyond it), drawn as a hairline with the pole marks. */
export function drawAxis(lb: LineBatch, o: { cx: number; cy: number; R: number; tilt: number }, alpha = 1) {
  const a = (o.tilt * Math.PI) / 180;
  const dx = Math.sin(a), dy = -Math.cos(a);
  const L0 = o.R * 1.28;
  // dashed beyond the surface, solid stubs at the poles
  for (const sgn of [1, -1]) {
    for (let s = o.R * 1.02; s < L0; s += 14) {
      lb.seg2(o.cx + dx * s * sgn, o.cy + dy * s * sgn, o.cx + dx * Math.min(L0, s + 7) * sgn, o.cy + dy * Math.min(L0, s + 7) * sgn, 1.2, LIN.bone, 0.75 * alpha);
    }
  }
  // the vertical it leans from
  for (let s = o.R * 1.02; s < L0; s += 14) lb.seg2(o.cx, o.cy - s, o.cx, o.cy - Math.min(L0, s + 5), 1, LIN.graphite, 0.8 * alpha);
}

// ------------------------------------------------------------------ the village (side view)
export interface VillageOpts { tilt: number; t: number; ox?: number; groundY?: number; scale?: number; alpha?: number; beat?: number; night?: number }
type RGB = [number, number, number];
const HOUSES: [number, number, number][] = [[-560, 120, 92], [-400, 150, 110], [-170, 110, 84], [80, 170, 118], [330, 120, 90]];
const TREES = [-650, -210, 40, 290, 520, 640];

/** Ground height (y) at x for the village: a gentle arc (the world is small) with the river valley at x≈-40. */
export function villageGround(x: number, o: VillageOpts) {
  const gy = o.groundY ?? 820, sc = o.scale ?? 1;
  const u = (x - (o.ox ?? W / 2)) / sc;
  return gy + (u * u) / 9000 * sc;
}

export function drawVillage(lb: LineBatch, o: VillageOpts) {
  const w = warmth(o.tilt), sc = o.scale ?? 1, ox = o.ox ?? W / 2, al = o.alpha ?? 1, t = o.t;
  const X = (u: number) => ox + u * sc;
  const G = (u: number) => villageGround(X(u), o);
  const bone = LIN.bone, gr = LIN.graphite;
  const snow: RGB = [LIN.bone[0] * 0.72, LIN.bone[1] * 0.72, LIN.bone[2] * 0.72], hot = LIN.signal, warm: RGB = LIN.ember;
  // the sun: noon height over the village (exaggerated ×6 in the sky so a degree reads)
  const sunH = noonSun(o.tilt);
  const sx = X(520), sy = G(520) - 100 * sc - (sunH - 40) * 22 * sc;
  const nt = o.night ?? 0;
  if (nt < 1) lb.seg2(sx, sy + nt * 500, sx + 0.01, sy + nt * 500, 70 * sc, [LIN.signal[0] * 1.6, LIN.signal[1] * 1.6, LIN.signal[2] * 1.6], al * (1 - nt));
  // ground: the curved horizon of a small world
  let px = -40, py = villageGround(-40, o);
  for (let x = -20; x <= W + 40; x += 20) { const y = villageGround(x, o); lb.seg2(px, py, x, y, 1.6, bone, 0.9 * al); px = x; py = y; }
  // snow cover: a second line above the ground, thinning with warmth
  const depth = (1 - w) * 30 * sc;
  if (depth > 0.5) {
    // a snow blanket: its surface line, and close hatching down to the ground
    px = -40; py = villageGround(-40, o) - depth;
    for (let x = -20; x <= W + 40; x += 20) {
      const y = villageGround(x, o) - depth * (0.8 + 0.2 * noise1(x * 0.01, 3));
      lb.seg2(px, py, x, y, 1.4, snow, 0.9 * al);
      for (let k = 1; k < 4; k++) lb.seg2(px, lerp(py, villageGround(px, o), k / 4), x, lerp(y, villageGround(x, o), k / 4), 1, snow, 0.35 * al);
      px = x; py = y;
    }
  }
  // the river (at u = -40): frozen (a white slab) or flowing (moving dashes)
  const rx = X(-40), ry = G(-40) + 4 * sc;
  if (w < 0.45) lb.seg2(rx - 46 * sc, ry, rx + 46 * sc, ry, 7 * sc, snow, 0.9 * al);
  else for (let i = 0; i < 6; i++) {
    const ph = ((t * 0.8 + i / 6) % 1);
    const x0 = rx - 46 * sc + ph * 92 * sc;
    lb.seg2(x0, ry + (i % 2) * 4 * sc, Math.min(rx + 46 * sc, x0 + 16 * sc), ry + (i % 2) * 4 * sc, 2 * sc, bone, 0.7 * al * clamp((w - 0.45) * 4));
  }
  // fields: furrows appear once the season is long enough
  const fieldK = clamp((w - 0.55) * 2.5);
  if (fieldK > 0) for (let r = 0; r < 7; r++) {
    const u0 = 560 + r * 10, u1 = 900 - r * 6;
    const n = Math.floor(14 * fieldK);
    for (let k = 0; k < n; k++) {
      const ua = lerp(u0, u1, k / 14), ub = lerp(u0, u1, (k + 0.7) / 14);
      lb.seg2(X(ua), G(ua) + (r + 1) * 9 * sc, X(ub), G(ub) + (r + 1) * 9 * sc, 1.3, LIN.ember, 0.55 * al);
    }
  }
  // houses: outline, roof, a snow cap; windows light up as the place comes alive
  HOUSES.forEach(([u, wdt, hgt], i) => {
    const x0 = X(u), x1 = X(u + wdt), y0 = Math.min(G(u), G(u + wdt)), yt = y0 - hgt * sc;
    lb.seg2(x0, y0, x0, yt, 1.4, bone, al); lb.seg2(x1, y0, x1, yt, 1.4, bone, al); lb.seg2(x0, yt, x1, yt, 1.4, bone, al);
    const rx2 = (x0 + x1) / 2, rt = yt - wdt * 0.42 * sc;
    lb.seg2(x0 - 8 * sc, yt, rx2, rt, 1.4, bone, al); lb.seg2(rx2, rt, x1 + 8 * sc, yt, 1.4, bone, al);
    if (depth > 0.5) { lb.seg2(x0 - 6 * sc, yt - 3, rx2, rt - 3 - depth * 0.5, 2 + depth * 0.35, snow, 0.9 * al); lb.seg2(rx2, rt - 3 - depth * 0.5, x1 + 6 * sc, yt - 3, 2 + depth * 0.35, snow, 0.9 * al); }
    // chimney smoke in the cold, open windows in the warm
    const win = clamp(o.tilt / 3 - i * 0.8);
    const wx = x0 + wdt * 0.3 * sc, wy = yt + hgt * 0.35 * sc, ww = 16 * sc, wh = 20 * sc;
    lb.seg2(wx, wy, wx + ww, wy, 1, bone, 0.8 * al); lb.seg2(wx, wy + wh, wx + ww, wy + wh, 1, bone, 0.8 * al);
    lb.seg2(wx, wy, wx, wy + wh, 1, bone, 0.8 * al); lb.seg2(wx + ww, wy, wx + ww, wy + wh, 1, bone, 0.8 * al);
    const wl = Math.max(win, (o.night ?? 0) * clamp(o.tilt / 6));
    if (wl > 0) lb.seg2(wx + ww / 2, wy + 2, wx + ww / 2, wy + wh - 2, ww - 3, [warm[0] * 1.4 * wl, warm[1] * 1.4 * wl, warm[2] * 1.4 * wl], al);
    if (w < 0.6) for (let k = 0; k < 5; k++) {
      const ph = ((t * 0.35 + k / 5 + i * 0.13) % 1);
      const cx = x1 - 22 * sc + Math.sin(ph * 6 + i) * 10 * sc * ph, cy = rt + 20 * sc - ph * 150 * sc;
      lb.seg2(cx, cy, cx + 0.01, cy, (4 + ph * 14) * sc, gr, 0.5 * (1 - ph) * al * (1 - w / 0.6));
    }
  });
  // trees: bare branches in the cold, crowns as it warms
  TREES.forEach((u, i) => {
    const x = X(u), y = G(u), hgt = (90 + 30 * hash(i, 4)) * sc;
    lb.seg2(x, y, x, y - hgt, 2, bone, al);
    for (let b = 0; b < 4; b++) {
      const by = y - hgt * (0.45 + b * 0.15), dir = b % 2 ? 1 : -1;
      lb.seg2(x, by, x + dir * (24 - b * 4) * sc, by - 18 * sc, 1.2, bone, 0.8 * al);
    }
    const crown = clamp((w - 0.3) * 2 - i * 0.05);
    if (crown > 0) {
      const cr = (34 + 8 * hash(i, 7)) * sc * crown, cy0 = y - hgt;
      // dark fill so the branches read behind it, an outline, and a few hatch strokes (engraved foliage)
      lb.seg2(x, cy0, x + 0.01, cy0, cr * 1.9, [0.012, 0.013, 0.015], al);
      const n = 28;
      for (let k = 0; k < n; k++) {
        const a0 = (k / n) * TAU, a1 = ((k + 1) / n) * TAU;
        const r0 = cr * (1 + 0.08 * Math.sin(a0 * 5 + i)), r1 = cr * (1 + 0.08 * Math.sin(a1 * 5 + i));
        lb.seg2(x + Math.cos(a0) * r0, cy0 + Math.sin(a0) * r0 * 0.85, x + Math.cos(a1) * r1, cy0 + Math.sin(a1) * r1 * 0.85, 1.3, bone, 0.9 * al);
      }
      for (let k = -3; k <= 3; k++) {
        const yy = cy0 + k * cr * 0.22, hw = Math.sqrt(Math.max(0, 1 - (k * 0.22) ** 2)) * cr * 0.8;
        lb.seg2(x - hw * 0.2, yy + hw * 0.25, x + hw, yy - hw * 0.25, 1, bone, 0.35 * al);
      }
    }
    if (depth > 0.5) lb.seg2(x - 20 * sc, y - hgt * 0.6, x + 20 * sc, y - hgt * 0.6 - 4, 2 + depth * 0.2, snow, 0.6 * al * (1 - crown));
  });
  // a person, with a shadow set by the noon sun: long in the cold, short in summer
  const pu = 560 + 30 * Math.sin(t * 0.25), pxp = X(pu), pyp = G(pu);
  const ph = 46 * sc;
  lb.seg2(pxp, pyp, pxp, pyp - ph * 0.55, 2, bone, al);
  lb.seg2(pxp, pyp - ph * 0.55, pxp - 6 * sc, pyp, 1.6, bone, al); lb.seg2(pxp, pyp - ph * 0.55, pxp + 6 * sc, pyp, 1.6, bone, al);
  lb.seg2(pxp, pyp - ph * 0.85, pxp - 8 * sc, pyp - ph * 0.55, 1.4, bone, al); lb.seg2(pxp, pyp - ph * 0.85, pxp + 9 * sc, pyp - ph * 0.6, 1.4, bone, al);
  lb.seg2(pxp, pyp - ph, pxp + 0.01, pyp - ph, 11 * sc, bone, al);
  const shadow = ph / Math.tan((noonSun(o.tilt) * Math.PI) / 180);
  lb.seg2(pxp, pyp + 2, pxp - shadow, pyp + 2, 3 * sc, gr, 0.9 * al);
  void hot;
}
