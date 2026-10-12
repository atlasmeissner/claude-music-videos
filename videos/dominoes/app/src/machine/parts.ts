// Small machine parts shared by the stations.
import { type R } from '../engine/draw';
import { type V2 } from '../engine/util';

/** A steel ball: outline, a specular tick, a spin mark; orange while it is the moving part. */
export function ball(r: R, x: number, y: number, rad: number, heat: number, spin = 0, vx = 0, vy = 0) {
  const g = r.g;
  const col = heat > 0.01 ? r.mix('fg', 'sig', heat) : r.c('fg');
  // motion streak (behind the ball)
  const v = Math.hypot(vx, vy);
  if (v > 1 && heat > 0.01) {
    const len = Math.min(v * 0.07, rad * 7);
    const ux = vx / v, uy = vy / v;
    const grd = g.createLinearGradient(x, y, x - ux * len, y - uy * len);
    grd.addColorStop(0, r.c('sig', 0.55 * heat));
    grd.addColorStop(1, r.c('sig', 0));
    g.beginPath();
    g.moveTo(x + uy * rad * 0.8, y - ux * rad * 0.8);
    g.lineTo(x - ux * len, y - uy * len);
    g.lineTo(x - uy * rad * 0.8, y + ux * rad * 0.8);
    g.closePath();
    g.fillStyle = grd;
    g.fill();
  }
  r.circle(x, y, rad, col, heat > 0.5 ? r.c('sig', 0.9 * heat) : r.c('panel'), 1.6);
  if (heat > 0.3) r.circle(x, y, rad * 0.45, undefined, r.c('ember', heat));
  // spin mark
  r.line(x + Math.cos(spin) * rad * 0.35, y + Math.sin(spin) * rad * 0.35, x + Math.cos(spin) * rad * 0.85, y + Math.sin(spin) * rad * 0.85, heat > 0.5 ? r.c('panel') : col, 1.2);
}

/** A pulley wheel with spokes, rotated by `rot`. */
export function pulley(r: R, x: number, y: number, rad: number, rot: number, col?: string) {
  const c = col ?? r.c('fg');
  r.circle(x, y, rad, c, r.c('panel'), 1.4);
  r.circle(x, y, rad * 0.78, c, undefined, 1);
  r.circle(x, y, rad * 0.14, c, undefined, 1.2);
  for (let k = 0; k < 4; k++) {
    const a = rot + (k * Math.PI) / 2;
    r.line(x + Math.cos(a) * rad * 0.14, y + Math.sin(a) * rad * 0.14, x + Math.cos(a) * rad * 0.78, y + Math.sin(a) * rad * 0.78, c, 1);
  }
}

/** A support post (technical-drawing style) from a point down to the ground. */
export function post(r: R, x: number, yTop: number, yGround: number, w = 10, col?: string) {
  const c = col ?? r.c('fg');
  r.box(x, yTop, 0, -w / 2, 0, w, yGround - yTop, c, r.c('panel'), 1.2);
  // foot
  r.line(x - w * 1.6, yGround, x + w * 1.6, yGround, c, 1.4);
}

/** Ground hatching under a ground line from x0 to x1. */
export function ground(r: R, x0: number, x1: number, y: number, depth = 16) {
  if (x1 <= x0) return;
  const g = r.g;
  r.line(x0, y, x1, y, r.c('fg'), 1.4);
  if (r.onScreen(depth) < 3) return;
  const sp = Math.max(depth * 0.9, r.px(9));
  const v = r.view;
  const a = Math.max(x0, v.x0 - depth), b = Math.min(x1, v.x1 + depth);
  g.beginPath();
  for (let x = Math.floor(a / sp) * sp; x < b; x += sp) {
    g.moveTo(x, y);
    g.lineTo(x - depth, y + depth);
  }
  r.stroke(r.c('dim'), 1);
}

/** A seesaw lever on a triangular fulcrum, tilted by `ang` (positive = right side down). */
export function lever(r: R, x: number, y: number, len: number, ang: number, col?: string, fulcrum = 24) {
  const c = col ?? r.c('fg');
  r.poly([{ x, y: y - fulcrum }, { x: x - fulcrum * 0.7, y }, { x: x + fulcrum * 0.7, y }], r.c('fg'), r.c('panel'), 1.2);
  r.box(x, y - fulcrum, ang, -len / 2, -5, len, 5, c, r.c('panel'), 1.4);
}

/** Open cup / bucket seen in section. */
export function cup(r: R, x: number, y: number, w: number, h: number, col?: string, fill = 0, fillCol?: string) {
  const c = col ?? r.c('fg');
  const pts: V2[] = [{ x: x - w / 2, y: y - h }, { x: x - w * 0.4, y }, { x: x + w * 0.4, y }, { x: x + w / 2, y: y - h }];
  if (fill > 0) {
    const fy = y - h * fill;
    const k = fill;
    r.poly([{ x: x - w * (0.4 + 0.1 * k), y: fy }, { x: x - w * 0.4, y }, { x: x + w * 0.4, y }, { x: x + w * (0.4 + 0.1 * k), y: fy }], undefined, fillCol ?? r.c('sig', 0.85));
  }
  r.poly(pts, c, undefined, 1.6, false);
}

/** Ramp / track segment (a rail with a thin underside) along points. */
export function rail(r: R, pts: V2[], col?: string, thick = 6) {
  const c = col ?? r.c('fg');
  r.path(pts);
  r.stroke(c, 1.6);
  if (r.onScreen(thick) < 2) return;
  const g = r.g;
  g.save();
  g.translate(0, thick);
  r.path(pts);
  r.stroke(r.c('dim'), 1);
  g.restore();
}
