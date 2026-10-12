// The render context handed to every station: the 2D context, the camera, the theme, and small
// drawing helpers. World units are pixels at zoom 1 on a 1920x1080 frame; y points down; the
// machine's ground is y = 0.
import { type RGB, type Theme, css, mixRGB } from './palette';
import { type V2 } from './util';

export type Ctx = CanvasRenderingContext2D;
export type AnyCanvas = { width: number; height: number; getContext(type: '2d'): unknown };

export interface Cam { x: number; y: number; z: number; r: number }

export const W = 1920;
export const H = 1080;

export type Role = 'bg' | 'fg' | 'mid' | 'dim' | 'faint' | 'panel' | 'sig' | 'ember' | 'blood';

export class R {
  g: Ctx;
  /** Device scale: 1 = 1920x1080, 2 = 4K, 0.5 = quick previews. */
  S: number;
  t = 0;
  cam: Cam = { x: 0, y: 0, z: 1, r: 0 };
  th!: Theme;
  /** World-space view rectangle (axis-aligned bounds of the screen), for culling. */
  view = { x0: 0, y0: 0, x1: 0, y1: 0 };
  /** Level of detail: hide fine detail when a station is drawn very small. */
  lod = 1;
  /** Multiplier on lyric alpha (the rewind dims the words). */
  lyricAlpha = 1;
  /** Scale of the current transform (camera zoom in world mode, 1 in screen mode). */
  unit = 1;

  constructor(g: Ctx, S = 1) {
    this.g = g;
    this.S = S;
  }

  /** Colour of a theme role, optionally mixed toward another role, with alpha. */
  c(role: Role, a = 1): string {
    return css(this.th[role], a);
  }
  rgb(role: Role): RGB {
    return this.th[role];
  }
  mix(a: Role, b: Role, t: number, alpha = 1) {
    return css(mixRGB(this.th[a], this.th[b], Math.max(0, Math.min(1, t))), alpha);
  }

  /** Set the world transform for camera `cam`. */
  world(cam: Cam = this.cam) {
    this.cam = cam;
    this.unit = cam.z;
    const S = this.S, z = cam.z * S;
    const cs = Math.cos(cam.r) * z, sn = Math.sin(cam.r) * z;
    const e = (W / 2) * S - (cs * cam.x - sn * cam.y);
    const f = (H / 2) * S - (sn * cam.x + cs * cam.y);
    this.g.setTransform(cs, sn, -sn, cs, e, f);
    // view bounds: inverse-map the screen corners
    const inv = (sx: number, sy: number): V2 => {
      const dx = sx - W / 2, dy = sy - H / 2;
      const c = Math.cos(-cam.r), s = Math.sin(-cam.r);
      return { x: cam.x + (c * dx - s * dy) / cam.z, y: cam.y + (s * dx + c * dy) / cam.z };
    };
    const ps = [inv(0, 0), inv(W, 0), inv(0, H), inv(W, H)];
    this.view = {
      x0: Math.min(...ps.map((p) => p.x)), x1: Math.max(...ps.map((p) => p.x)),
      y0: Math.min(...ps.map((p) => p.y)), y1: Math.max(...ps.map((p) => p.y)),
    };
  }
  /** Screen-space transform (for overlays laid out on the 1920x1080 frame). */
  screen() {
    this.g.setTransform(this.S, 0, 0, this.S, 0, 0);
    this.unit = 1;
  }
  /** World -> screen point. */
  toScreen(x: number, y: number): V2 {
    const c = this.cam, cs = Math.cos(c.r), sn = Math.sin(c.r);
    const dx = (x - c.x) * c.z, dy = (y - c.y) * c.z;
    return { x: W / 2 + cs * dx - sn * dy, y: H / 2 + sn * dx + cs * dy };
  }
  /** World units for `n` screen pixels (hairlines stay hairlines at any zoom). */
  px(n = 1) {
    return n / this.unit;
  }
  /** Is the world box (with margin in world units) on screen? */
  visible(x0: number, y0: number, x1: number, y1: number, margin = 0) {
    const v = this.view;
    return x1 + margin >= v.x0 && x0 - margin <= v.x1 && y1 + margin >= v.y0 && y0 - margin <= v.y1;
  }
  /** On-screen size in pixels of a world length. */
  onScreen(len: number) {
    return len * this.cam.z;
  }

  // ------------------------------------------------------------------ shapes
  path(pts: V2[], close = false) {
    const g = this.g;
    g.beginPath();
    if (!pts.length) return;
    g.moveTo(pts[0]!.x, pts[0]!.y);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i]!.x, pts[i]!.y);
    if (close) g.closePath();
  }
  stroke(color: string, lwPx = 1.4) {
    const g = this.g;
    g.strokeStyle = color;
    g.lineWidth = this.px(lwPx);
    g.stroke();
  }
  fill(color: string) {
    this.g.fillStyle = color;
    this.g.fill();
  }
  line(x0: number, y0: number, x1: number, y1: number, color: string, lwPx = 1.4) {
    const g = this.g;
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    this.stroke(color, lwPx);
  }
  poly(pts: V2[], stroke?: string, fill?: string, lwPx = 1.4, close = true) {
    this.path(pts, close);
    if (fill) this.fill(fill);
    if (stroke) this.stroke(stroke, lwPx);
  }
  circle(x: number, y: number, r: number, stroke?: string, fill?: string, lwPx = 1.4) {
    const g = this.g;
    g.beginPath();
    g.arc(x, y, Math.max(r, 0.0001), 0, Math.PI * 2);
    if (fill) this.fill(fill);
    if (stroke) this.stroke(stroke, lwPx);
  }
  /** Rectangle with its local origin at (x, y), rotated by `rot` around (x, y); box spans [ox, ox+w] x [oy, oy+h]. */
  box(x: number, y: number, rot: number, ox: number, oy: number, w: number, h: number, stroke?: string, fill?: string, lwPx = 1.4, radius = 0) {
    const g = this.g;
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.beginPath();
    if (radius > 0 && (g as unknown as { roundRect?: unknown }).roundRect) g.roundRect(ox, oy, w, h, radius);
    else g.rect(ox, oy, w, h);
    if (fill) this.fill(fill);
    if (stroke) this.stroke(stroke, lwPx);
    g.restore();
  }
  text(s: string, x: number, y: number, font: string, color: string, align: CanvasTextAlign = 'left', baseline: CanvasTextBaseline = 'alphabetic') {
    const g = this.g;
    g.font = font;
    g.fillStyle = color;
    g.textAlign = align;
    g.textBaseline = baseline;
    g.fillText(s, x, y);
  }
  measure(s: string, font: string) {
    this.g.font = font;
    return this.g.measureText(s).width;
  }
  /** Run `fn` with alpha multiplied by a. */
  alpha(a: number, fn: () => void) {
    if (a <= 0.001) return;
    const g = this.g, prev = g.globalAlpha;
    g.globalAlpha = prev * Math.min(1, a);
    fn();
    g.globalAlpha = prev;
  }
  /** Run `fn` in a translated/rotated/scaled local frame. */
  local(x: number, y: number, rot: number, scale: number, fn: () => void) {
    const g = this.g;
    g.save();
    g.translate(x, y);
    if (rot) g.rotate(rot);
    if (scale !== 1) g.scale(scale, scale);
    fn();
    g.restore();
  }
  /** Hatching inside a polygon (45° technical-drawing section lines), spacing in screen px. */
  hatch(pts: V2[], color: string, spacingPx = 7, angle = Math.PI / 4, lwPx = 1) {
    const g = this.g;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of pts) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
    const sp = this.px(spacingPx);
    g.save();
    this.path(pts, true);
    g.clip();
    g.beginPath();
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rad = Math.hypot(x1 - x0, y1 - y0) / 2 + sp;
    const ca = Math.cos(angle), sa = Math.sin(angle);
    for (let d = -rad; d <= rad; d += sp) {
      const px = cx - sa * d, py = cy + ca * d;
      g.moveTo(px - ca * rad, py - sa * rad);
      g.lineTo(px + ca * rad, py + sa * rad);
    }
    this.stroke(color, lwPx);
    g.restore();
  }
}
