// quiet — the whispered bridge: "I almost gave up on the quiet days" / "When nothing moved, when nothing changed" /
// "But I was changing". A wall of tally marks, one stroke per quiet day, each a hair steeper than the one before.
// Close up, the camera turns with the strokes, so every one looks upright: nothing changes. On "But I was
// changing" it pulls back and levels: the whole wall has turned.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, clearRT, W, H } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import type { Line } from '../engine/lyrics';
import { ease, lerp, prog } from '../engine/util';
import { drawCompound, drawKaraoke, heading, jit, mono, needleTip, rad, rollPost, levelCtx } from './_od';

const GROUPS_X = 30, ROWS = 16, N = GROUPS_X * ROWS * 5;
const SW = 15, GW = 104, RH = 112, SL = 64;
const TURN = 48; // degrees across the whole wall

export default class Quiet extends Scene {
  lb = new LineBatch(N * 2 + 200);
  text = new Layer2D();
  ls: Line[] = [];
  i0 = 0;

  override init() {
    this.ls = [23, 24, 25].map((i) => this.ctx.lyrics.lines[i]!);
    this.i0 = Math.floor(N * 0.7);
  }

  /** Stroke i: centre (world) and angle (degrees from vertical). */
  stroke(i: number) {
    const g = Math.floor(i / 5), k = i % 5;
    const col = g % GROUPS_X, row = Math.floor(g / GROUPS_X);
    const ang = (i / N) * TURN;
    const gx = col * GW, gy = row * RH;
    if (k < 4) return { x: gx + k * SW, y: gy, a: ang, len: SL, diag: false };
    return { x: gx + 1.5 * SW, y: gy, a: ang + 62, len: SL * 1.05, diag: true };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, lyrics, audio } = this.ctx;
    const t = f.t;
    clearRT(renderer, out, LIN.ink);
    const lb = this.lb; lb.clear();
    const [l23, l24, l25] = this.ls as [Line, Line, Line];
    const beat = 60 / audio.bpm;
    const cur = Math.min(N - 1, this.i0 + Math.floor((t - this.ctx.start) / beat));
    const curFrac = ((t - this.ctx.start) / beat) % 1;
    const reveal = prog(t, l25.words[3]!.start - 0.4, l25.words[3]!.start + 1.8, ease.inOutCubic);
    // camera: close on the cursor and turned with it, then back and level
    const sc = this.stroke(cur);
    const wallW = GROUPS_X * GW, wallH = ROWS * RH;
    const fx = lerp(sc.x - 120, wallW / 2 - 30, reveal), fy = lerp(sc.y, wallH / 2 - RH / 2, reveal);
    const zoom = lerp(2.4, 0.58, reveal) * (1 + 0.015 * Math.sin(t * 0.4));
    const rot = rad(-sc.a * (1 - reveal));
    const cs = Math.cos(rot), sn = Math.sin(rot);
    const S = (x: number, y: number) => { const dx = x - fx, dy = y - fy; return { x: W / 2 + (dx * cs - dy * sn) * zoom, y: H / 2 - 40 + (dx * sn + dy * cs) * zoom }; };
    for (let i = 0; i <= cur; i++) {
      const s = this.stroke(i);
      const a = rad(s.a) + jit(i, 9, 0.012);
      const dx = Math.sin(a) * s.len / 2, dy = -Math.cos(a) * s.len / 2;
      let draw = 1;
      if (i === cur) draw = ease.outCubic(Math.min(1, curFrac * 2.5));
      const p = S(s.x - dx, s.y - dy), q = S(s.x - dx + 2 * dx * draw, s.y - dy + 2 * dy * draw);
      const hot = i === cur;
      lb.seg2(p.x, p.y, q.x, q.y, (hot ? 1.8 : 1.3) * Math.max(0.8, zoom * 0.7), hot ? LIN.signal : LIN.bone, hot ? 1 : 0.62 + 0.25 * reveal * (i / N));
      if (hot && reveal < 0.5) needleTip(lb, q.x, q.y, t, 0.5, 0.8 * (1 - reveal * 2));
    }
    lb.render(renderer, out);

    const T = this.text, c = T.ctx; T.clear();
    c.save(); levelCtx(c, heading(lyrics, t));
    // a soft dark band so the whisper reads over the wall
    const gr = c.createLinearGradient(0, 780, 0, 1080);
    gr.addColorStop(0, 'rgba(10,11,13,0)'); gr.addColorStop(0.45, 'rgba(10,11,13,0.82)'); gr.addColorStop(1, 'rgba(10,11,13,0.9)');
    c.fillStyle = gr; c.fillRect(-200, 780, W + 400, 500);
    const g2 = c.createLinearGradient(0, -100, 0, 260);
    g2.addColorStop(0, 'rgba(10,11,13,0.92)'); g2.addColorStop(0.6, 'rgba(10,11,13,0.75)'); g2.addColorStop(1, 'rgba(10,11,13,0)');
    c.fillStyle = g2; c.fillRect(-200, -100, W + 400, 360);
    const st = { family: F.serif(400, true), size: 66, tracking: 0, sung: rgba('bone', 0.95), unsung: rgba('bone', 0.14), active: rgba('signal', 1), lead: 0.6, align: 'center' as const };
    // lines in place, one after another
    const show = (l: Line, nxt: Line | null) => {
      const a = prog(t, l.start - 0.7, l.start - 0.2) * (nxt ? 1 - prog(t, nxt.start - 0.7, nxt.start - 0.3) : 1);
      if (a <= 0) return;
      c.save(); c.globalAlpha = a; drawKaraoke(c, l, W / 2, 940, t, st); c.restore();
    };
    show(l23, l24); show(l24, l25);
    // "But I was changing": the last word in signal, larger, held
    if (t > l25.start - 0.7) {
      c.save(); c.globalAlpha = prog(t, l25.start - 0.7, l25.start - 0.2);
      drawKaraoke(c, l25, W / 2, 940, t, { ...st, family: F.serif(600, true), size: 78, active: rgba('signal', 1) });
      c.restore();
    }
    const days = cur + 1;
    mono(c, `QUIET DAYS  ${days.toLocaleString('en-US')}`, 120, 150, { size: 13, color: rgba('ash', 0.85), track: 3 });
    mono(c, reveal < 0.5 ? 'CHANGE SINCE YESTERDAY  0.02°' : `CHANGE SINCE DAY ONE  ${((cur / N) * TURN).toFixed(0)}°`, 120, 176, { size: 13, color: reveal < 0.5 ? rgba('bone', 0.8) : rgba('signal', 1), track: 3 });
    drawCompound(c, W - 340, 150, t, { ly: lyrics });
    c.restore();
    comp.draw(renderer, T.upload(), out);
    return { ...rollPost(lyrics, t), bloom: 0.55, ca: 0.4, vignette: 0.5 };
  }
}
