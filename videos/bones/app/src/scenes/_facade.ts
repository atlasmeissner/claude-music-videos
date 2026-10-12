// The building: one inherited, gilded classical façade, generated once as line members in layers, so the
// plates that show it (facade, edges, strip, xray, wreckage) can draw it, pull at it and strip it apart.
//
// Coordinates are façade units (≈ px at scale 1): origin at the ground line under the centre, x right, y DOWN
// (negative = up, like the canvas). Layers, outside in:
//   gold  — the inherited ornament: capitals, acroteria, window frames, the tympanum wreath, the dome's ribs
//   stone — the masonry: column shafts, steps, entablature, rustication, pediment, balustrade, dome shell
//   frame — the bones: the structural skeleton behind it (columns, beams, trusses, the dome's arches)
//   found — the ground line and the (missing) foundation
import { hash, TAU } from '../engine/util';

export type Layer = 'gold' | 'stone' | 'frame' | 'found';
export interface Member {
  layer: Layer;
  pts: [number, number][];
  w: number;
  /** group id: members of one group fall together */
  g: number;
  /** centroid of the group (filled after build) */
  cx: number; cy: number;
  /** stable per-member random 0..1 */
  r: number;
}

// key dimensions (exported for plates that place type or effects on the building)
export const COLS = [-375, -225, -75, 75, 225, 375];
export const STEP_Y = [-14, -28, -42];
export const SHAFT = { y0: -60, y1: -420, rb: 25, rt: 21 };
export const CAP = { y0: -420, y1: -470 };
export const ARCH = { y0: -470, y1: -510 };
export const FRIEZE = { x0: -430, x1: 430, y0: -510, y1: -566 };
export const CORNICE = { y0: -566, y1: -600 };
export const PED = { x0: -440, x1: 440, y0: -600, apex: -770 };
export const WING = { x0: 440, x1: 770, top: -540, bal: -590 };
export const DOME = { cy: -800, R: 165, drum0: -720, lantern: -1010 };
export const FLOORS = [-270];

let gid = 0;
const M: Member[] = [];
function add(layer: Layer, pts: [number, number][], w = 1, g = gid) {
  M.push({ layer, pts, w, g, cx: 0, cy: 0, r: hash(M.length, 77) });
}
const newGroup = () => ++gid;
function rect(layer: Layer, x0: number, y0: number, x1: number, y1: number, w = 1, g = gid) {
  add(layer, [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]], w, g);
}
function line(layer: Layer, x0: number, y0: number, x1: number, y1: number, w = 1, g = gid) {
  add(layer, [[x0, y0], [x1, y1]], w, g);
}
function arcPts(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 24): [number, number][] {
  const p: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    p.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return p;
}
function spiral(cx: number, cy: number, r0: number, turns: number, dir: number): [number, number][] {
  const p: [number, number][] = [];
  const n = Math.ceil(turns * 18);
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const a = dir * u * turns * TAU;
    const r = r0 * (1 - u * 0.82);
    p.push([cx + Math.cos(a) * r * dir, cy + Math.sin(a) * r]);
  }
  return p;
}
/** a small acanthus leaf: a pointed, curled tongue */
function leaf(x: number, yb: number, h: number, wd: number, curl: number): [number, number][] {
  const p: [number, number][] = [];
  const n = 9;
  for (let i = 0; i <= n; i++) { const u = i / n; p.push([x - wd * Math.sin(u * Math.PI * 0.95) * (1 - u * 0.6), yb - h * u]); }
  p.push([x + curl, yb - h * 1.04]);
  for (let i = n; i >= 0; i--) { const u = i / n; p.push([x + wd * Math.sin(u * Math.PI * 0.95) * (1 - u * 0.6), yb - h * u]); }
  return p;
}

function column(x: number) {
  // stone: base (torus + plinth), entasis shaft with fluting
  newGroup();
  rect('stone', x - 36, STEP_Y[2]!, x + 36, STEP_Y[2]! - 8, 1.2);
  add('stone', arcPts(x, STEP_Y[2]! - 13, 32, 5, Math.PI, TAU, 16), 1.1);
  add('stone', arcPts(x, STEP_Y[2]! - 13, 32, 5, 0, Math.PI, 16), 1.1);
  const sh = (u: number) => SHAFT.rb + (SHAFT.rt - SHAFT.rb) * Math.pow(u, 1.4); // entasis
  const n = 14;
  for (const side of [-1, 1]) {
    const p: [number, number][] = [];
    for (let i = 0; i <= n; i++) { const u = i / n; p.push([x + side * sh(u), SHAFT.y0 + (SHAFT.y1 - SHAFT.y0) * u]); }
    add('stone', p, 1.3);
  }
  for (const f of [-0.66, -0.33, 0, 0.33, 0.66]) {
    const p: [number, number][] = [];
    for (let i = 0; i <= n; i++) { const u = i / n; p.push([x + f * sh(u), SHAFT.y0 - 6 + (SHAFT.y1 - SHAFT.y0 + 12) * u]); }
    add('stone', p, 0.7);
  }
  // capital: stone abacus + bell; gold acanthus, volutes, rosette
  newGroup();
  rect('stone', x - 38, CAP.y1, x + 38, CAP.y1 + 9, 1.2);
  add('stone', [[x - 22, CAP.y0], [x - 30, CAP.y1 + 9]], 0.9); add('stone', [[x + 22, CAP.y0], [x + 30, CAP.y1 + 9]], 0.9);
  newGroup();
  for (let i = -2; i <= 2; i++) add('gold', leaf(x + i * 9.5, CAP.y0 + 2, 18, 6, i * 0.8), 0.9);
  for (let i = -1.5; i <= 1.5; i += 1) add('gold', leaf(x + i * 12, CAP.y0 - 10, 20, 7, i * 1.5), 0.9);
  add('gold', spiral(x - 27, CAP.y1 + 17, 8, 1.6, -1), 1); add('gold', spiral(x + 27, CAP.y1 + 17, 8, 1.6, 1), 1);
  add('gold', arcPts(x, CAP.y1 + 4, 4, 4, 0, TAU, 10), 0.9);
}

function steps() {
  newGroup();
  const x0 = -800, x1 = 800;
  rect('stone', x0, 0, x1, STEP_Y[0]!, 1.2);
  newGroup();
  rect('stone', -470, STEP_Y[0]!, 470, STEP_Y[1]!, 1.2);
  newGroup();
  rect('stone', -455, STEP_Y[1]!, 455, STEP_Y[2]!, 1.2);
}

function entablature() {
  newGroup();
  // architrave: three fasciae
  rect('stone', FRIEZE.x0, ARCH.y0, FRIEZE.x1, ARCH.y1, 1.3);
  line('stone', FRIEZE.x0, ARCH.y0 - 13, FRIEZE.x1, ARCH.y0 - 13, 0.8);
  line('stone', FRIEZE.x0, ARCH.y0 - 27, FRIEZE.x1, ARCH.y0 - 27, 0.8);
  newGroup();
  rect('stone', FRIEZE.x0, FRIEZE.y0, FRIEZE.x1, FRIEZE.y1, 1.3);
  newGroup();
  // cornice with dentils
  rect('stone', FRIEZE.x0 - 14, CORNICE.y0, FRIEZE.x1 + 14, CORNICE.y1, 1.3);
  for (let x = FRIEZE.x0 - 8; x < FRIEZE.x1 + 8; x += 13) rect('stone', x, CORNICE.y0 - 2, x + 7, CORNICE.y0 - 11, 0.7);
  newGroup();
  // gold egg-and-dart under the corona
  for (let x = FRIEZE.x0; x < FRIEZE.x1; x += 18) {
    add('gold', arcPts(x + 6, CORNICE.y0 - 19, 4.5, 6, 0, TAU, 10), 0.8);
    line('gold', x + 15, CORNICE.y0 - 24, x + 15, CORNICE.y0 - 14, 0.7);
  }
}

function pediment() {
  newGroup();
  add('stone', [[PED.x0, PED.y0], [0, PED.apex], [PED.x1, PED.y0], [PED.x0, PED.y0]], 1.4);
  add('stone', [[PED.x0 + 40, PED.y0 - 10], [0, PED.apex + 26], [PED.x1 - 40, PED.y0 - 10], [PED.x0 + 40, PED.y0 - 10]], 0.9);
  // tympanum: a gilded wreath and a sunburst
  newGroup();
  const wy = PED.y0 - 62;
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * TAU;
    const x = Math.cos(a) * 34, y = wy + Math.sin(a) * 34;
    add('gold', arcPts(x, y, 7, 4, a, a + TAU, 8).map(([px, py]) => [px, py] as [number, number]), 0.8);
  }
  for (let i = 0; i < 16; i++) {
    const a = Math.PI + (i / 15) * Math.PI;
    line('gold', Math.cos(a) * 46, wy + Math.sin(a) * 46, Math.cos(a) * 92, wy + Math.sin(a) * 92 * 0.62, 0.7);
  }
  add('gold', arcPts(0, wy, 12, 12, 0, TAU, 16), 1);
  // acroteria: gilded palmettes at the apex and the corners
  for (const [x, y, s] of [[0, PED.apex, 1], [PED.x0 + 6, PED.y0, 0.75], [PED.x1 - 6, PED.y0, 0.75]] as const) {
    newGroup();
    for (let i = -3; i <= 3; i++) add('gold', leaf(x + i * 6 * s, y - 2, (34 - Math.abs(i) * 5) * s, 4 * s, i * 2 * s), 0.9);
    rect('gold', x - 16 * s, y, x + 16 * s, y - 6 * s, 0.9);
  }
}

function wing(side: number) {
  const xa = side * WING.x0, xb = side * WING.x1;
  const x0 = Math.min(xa, xb), x1 = Math.max(xa, xb);
  // rusticated masonry, course by course (each course its own group so they drop one by one)
  let row = 0;
  for (let y = STEP_Y[0]!; y > WING.top + 1; y -= 34) {
    newGroup();
    const y1 = Math.max(WING.top, y - 34);
    line('stone', x0, y1, x1, y1, 0.9);
    const off = row % 2 ? 0 : 33;
    for (let x = x0 + off; x < x1; x += 66) line('stone', x, y, x, y1, 0.7);
    row++;
  }
  newGroup();
  add('stone', [[x0, STEP_Y[0]!], [x0, WING.top], [x1, WING.top], [x1, STEP_Y[0]!]], 1.3);
  line('stone', x0 - 10, WING.top - 10, x1 + 10, WING.top - 10, 1.2);
  line('stone', x0 - 10, WING.top, x1 + 10, WING.top, 1);
  // balustrade
  newGroup();
  line('stone', x0, WING.bal, x1, WING.bal, 1.2);
  line('stone', x0, WING.top - 16, x1, WING.top - 16, 0.9);
  for (let x = x0 + 14; x < x1 - 8; x += 22) {
    add('stone', [[x - 4, WING.top - 18], [x - 7, WING.top - 26], [x - 3, WING.top - 34], [x - 5, WING.bal + 3]], 0.7);
    add('stone', [[x + 4, WING.top - 18], [x + 7, WING.top - 26], [x + 3, WING.top - 34], [x + 5, WING.bal + 3]], 0.7);
  }
  // windows: two per floor, two floors; stone opening + gold frame, pediment, keystone
  for (const [yb, yt] of [[-90, -220], [-310, -440]]) {
    for (const k of [0.3, 0.7]) {
      const cx = x0 + (x1 - x0) * k;
      newGroup();
      rect('stone', cx - 34, yb, cx + 34, yt, 1.2);
      line('stone', cx, yb, cx, yt, 0.7); line('stone', cx - 34, (yb + yt) / 2, cx + 34, (yb + yt) / 2, 0.7);
      newGroup();
      rect('gold', cx - 42, yb + 8, cx + 42, yt - 8, 1);
      add('gold', [[cx - 50, yt - 14], [cx, yt - 44], [cx + 50, yt - 14], [cx - 50, yt - 14]], 1);
      add('gold', [[cx - 8, yt - 8], [cx + 8, yt - 8], [cx + 5, yt + 10], [cx - 5, yt + 10], [cx - 8, yt - 8]], 0.9);
      add('gold', [[cx - 46, yb + 8], [cx - 50, yb + 16], [cx + 50, yb + 16], [cx + 46, yb + 8]], 0.9);
    }
  }
  // a gilded medallion between the floors
  newGroup();
  const mx = (x0 + x1) / 2;
  add('gold', arcPts(mx, -265, 20, 14, 0, TAU, 20), 0.9);
  for (const s of [-1, 1]) add('gold', [[mx + s * 22, -265], [mx + s * 60, -258], [mx + s * 90, -268], [mx + s * 104, -262]], 0.8);
}

function dome() {
  const { cy, R } = DOME;
  newGroup();
  // drum with pilasters
  rect('stone', -R - 12, DOME.drum0, R + 12, cy, 1.2);
  for (let i = -3; i <= 3; i++) line('stone', i * (R / 3.3), DOME.drum0, i * (R / 3.3), cy, 0.8);
  newGroup();
  add('stone', arcPts(0, cy, R, R, Math.PI, TAU, 48), 1.4);
  line('stone', -R - 18, cy, R + 18, cy, 1.2);
  // gilded ribs (meridians in elevation) and lantern
  newGroup();
  for (const s of [-0.86, -0.5, 0, 0.5, 0.86]) {
    const p: [number, number][] = [];
    for (let i = 0; i <= 24; i++) { const a = (i / 24) * (Math.PI / 2); p.push([R * Math.cos(a) * s, cy - R * Math.sin(a)]); }
    add('gold', p, 1);
  }
  newGroup();
  rect('gold', -22, cy - R, 22, cy - R - 60, 1);
  add('gold', arcPts(0, cy - R - 60, 22, 22, Math.PI, TAU, 16), 1);
  line('gold', 0, cy - R - 82, 0, DOME.lantern, 1.2);
  add('gold', arcPts(0, DOME.lantern + 8, 6, 6, 0, TAU, 10), 1);
}

// ------------------------------------------------------------------ the bones
function frame() {
  const colX = [-770, -605, -440, ...COLS, 440, 605, 770];
  const fw = 2.2;
  for (const x of colX) { newGroup(); line('frame', x, 0, x, Math.abs(x) > 430 ? WING.top : CORNICE.y1, fw); }
  newGroup();
  for (const y of [STEP_Y[2]!, ...FLOORS]) line('frame', -770, y, 770, y, fw);
  line('frame', -770, WING.top, -440, WING.top, fw); line('frame', 440, WING.top, 770, WING.top, fw);
  line('frame', -440, ARCH.y0, 440, ARCH.y0, fw);
  line('frame', -440, CORNICE.y1, 440, CORNICE.y1, fw);
  // pediment truss
  newGroup();
  add('frame', [[PED.x0, PED.y0], [0, PED.apex], [PED.x1, PED.y0]], fw);
  line('frame', 0, PED.y0, 0, PED.apex, fw * 0.8);
  for (const s of [-1, 1]) {
    line('frame', s * 220, PED.y0, s * 220, PED.y0 + (PED.apex - PED.y0) * 0.5, fw * 0.7);
    line('frame', s * 220, PED.y0, 0, PED.apex, fw * 0.6);
  }
  // dome: arches on a ring beam
  newGroup();
  line('frame', -DOME.R, DOME.cy, DOME.R, DOME.cy, fw);
  for (const s of [-1, -0.5, 0.5, 1]) {
    const p: [number, number][] = [];
    for (let i = 0; i <= 24; i++) { const a = (i / 24) * (Math.PI / 2); p.push([DOME.R * Math.cos(a) * s, DOME.cy - DOME.R * Math.sin(a)]); }
    add('frame', p, fw * 0.8);
  }
  line('frame', -DOME.R, DOME.cy, -DOME.R, DOME.drum0, fw); line('frame', DOME.R, DOME.cy, DOME.R, DOME.drum0, fw);
  // cross bracing in the wing bays (the frame's own logic)
  newGroup();
  for (const [a, b] of [[-770, -605], [605, 770]]) {
    line('frame', a, STEP_Y[2]!, b, FLOORS[0]!, fw * 0.6); line('frame', b, STEP_Y[2]!, a, FLOORS[0]!, fw * 0.6);
  }
}

function ground() {
  newGroup();
  line('found', -1300, 0, 1300, 0, 1.4);
}

steps();
for (const x of COLS) column(x);
entablature();
pediment();
wing(-1); wing(1);
dome();
frame();
ground();

// group centroids
{
  const acc = new Map<number, [number, number, number]>();
  for (const m of M) {
    const a = acc.get(m.g) ?? [0, 0, 0];
    for (const [x, y] of m.pts) { a[0] += x; a[1] += y; a[2]++; }
    acc.set(m.g, a);
  }
  for (const m of M) { const a = acc.get(m.g)!; m.cx = a[0] / a[2]; m.cy = a[1] / a[2]; }
}

export const FACADE: readonly Member[] = M;
export const FACADE_SEGS = M.reduce((n, m) => n + m.pts.length - 1, 0);

// ------------------------------------------------------------------ the plan (the "shape of things")
// Plan units = façade units; x as in the elevation, y = depth (0 = the front steps' top edge, + = back).
export const GRID_X = [-770, -605, -440, -375, -225, -75, 75, 225, 375, 440, 605, 770];
export const GRID_Y = [0, 120, 360, 600];
export const GRID_XN = 'ABCDEFGHJKLM'.split('');
/** thick walls (poché) as axis-aligned rects [x0, y0, x1, y1] */
export const PLAN_WALLS: [number, number, number, number][] = [];
{
  const W = PLAN_WALLS;
  for (const s of [-1, 1]) {
    const m = (a: number, b: number) => (s < 0 ? [a, b] : [-b, -a]) as [number, number];
    // wing front with two windows
    for (const [a, b] of [[-770, -705], [-637, -573], [-505, -440]] as const) { const [x0, x1] = m(a, b); W.push([x0, 0, x1, 22]); }
    { const [x0, x1] = m(-770, -440); W.push([x0, 498, x1, 520]); }
    { const [x0, x1] = m(-770, -748); W.push([x0, 0, x1, 520]); }
    { const [x0, x1] = m(-462, -440); W.push([x0, 0, x1, 600]); }
    { const [x0, x1] = m(-613, -597); W.push([x0, 22, x1, 230]); W.push([x0, 300, x1, 498]); }
    { const [x0, x1] = m(-440, -60); W.push([x0, 120, x1, 142]); }
  }
  W.push([-440, 578, 440, 600]);
}
export const PLAN_COLS: [number, number][] = COLS.map((x) => [x, 54]);
export const PLAN_DOME = { x: 0, y: 360, r: 165 };
