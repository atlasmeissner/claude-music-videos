// corona — the tag (instrumental, "whoa" backing). Day: the sun in the middle of the bone page with one ray per
// degree turned so far (19 of 24 slots; the empty slots are dotted). The corona turns one degree per beat and
// breathes with the band. In the last two bars night falls back and the sun shrinks into the needle's tip at
// the top of the frame, where the opening's protractor will find it.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, clearRT, W, H } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { LIN, rgba } from '../engine/palette';
import { ease, lerp, prog, TAU } from '../engine/util';
import { degreeCount, drawHeading, heading, mixCss, mono, needleTip, rad, rollPost, unroll, levelCtx } from './_od';

const mix3 = (a: [number, number, number], b: [number, number, number], k: number): [number, number, number] => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];

export default class Corona extends Scene {
  lb = new LineBatch(6000, { blend: 'normal' });
  glow = new LineBatch(300);
  text = new Layer2D();

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, lyrics, audio } = this.ctx;
    const t = f.t;
    const bar = 4 * 60 / audio.bpm;
    const night = prog(t, this.ctx.end - 2 * bar, this.ctx.end - 0.25, ease.inOutCubic);
    const day = 1 - night;
    const bg = mix3(LIN.ink, LIN.bone, day), fg = mix3(LIN.bone, LIN.ink, day);
    clearRT(renderer, out, bg);
    const lb = this.lb; lb.clear();
    const gb = this.glow; gb.clear();
    const h = heading(lyrics, t);
    // the sun travels to where the coda's needle tip will be (screen, after the roll is undone)
    const tip = unroll(960, 540 - 410, h), tipX = tip.x, tipY = tip.y;
    const cx = lerp(W / 2, tipX, night), cy = lerp(H / 2 + 20, tipY, ease.inOutCubic(night));
    const R = lerp(170, 4, ease.inCubic(night)) * (1 + 0.03 * f.a.rms);
    const beats = Math.floor(audio.beatAt(t) - audio.beatAt(this.ctx.start));
    const turn = rad(beats + prog(audio.beatAt(t) % 1, 0, 0.25, ease.outBack)); // one degree per beat
    const n = degreeCount(lyrics, t);
    const sun = mix3(LIN.acid, LIN.signal, night);
    for (let i = 0; i < 24; i++) {
      const a = turn + (i / 24) * TAU - Math.PI / 2;
      const r0 = R + 30, r1 = R + 30 + (230 + 60 * f.a.kick) * (1 - night);
      if (i < n) lb.seg2(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * r1, cy + Math.sin(a) * r1, 2.6, fg, 0.9 * day);
      else for (let s = r0; s < r1; s += 14) lb.seg2(cx + Math.cos(a) * s, cy + Math.sin(a) * s, cx + Math.cos(a) * (s + 3), cy + Math.sin(a) * (s + 3), 2, fg, 0.4 * day);
    }
    // fine 360-tick ring around the corona
    const rr = R + 300 * (1 - night);
    for (let i = 0; i < 360; i++) {
      const a = turn + rad(i) - Math.PI / 2;
      const l = i % 15 === 0 ? 18 : 7;
      lb.seg2(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, cx + Math.cos(a) * (rr + l), cy + Math.sin(a) * (rr + l), 1, fg, 0.45 * day);
    }
    lb.seg2(cx, cy, cx + 0.01, cy, R * 2, sun, 1);
    for (let i = 0; i < 72; i++) {
      const a0 = (i / 72) * TAU, a1 = ((i + 1) / 72) * TAU;
      lb.seg2(cx + Math.cos(a0) * R, cy + Math.sin(a0) * R, cx + Math.cos(a1) * R, cy + Math.sin(a1) * R, 1.4, LIN.ink, day);
    }
    for (let y = -R + 10; y < R; y += 11) { const hw = Math.sqrt(Math.max(0, R * R - y * y)) * 0.96; lb.seg2(cx - hw, cy + y, cx + hw, cy + y, 0.8, LIN.ink, 0.22 * day); }
    lb.render(renderer, out);
    if (night > 0.5) { needleTip(gb, cx, cy, t, 1, (night - 0.5) * 2); gb.render(renderer, out); }

    const T = this.text, c = T.ctx; T.clear();
    c.save(); levelCtx(c, heading(lyrics, t));
    const col = mixCss(rgba('ink', 0.75), rgba('bone', 0.75), night);
    c.save(); c.globalAlpha = day;
    mono(c, `CORONA  ${n} / 24 RAYS`, 120, 150, { size: 13, color: col, track: 3, weight: 500 });
    mono(c, 'ROTATION  1° PER BEAT', 120, 176, { size: 12, color: col, track: 3 });
    mono(c, `${beats}° SINCE THE TAG`, 120, 202, { size: 12, color: rgba('signal', 1), track: 3 });
    c.restore();
    drawHeading(c, 120, 990, h, { color: col });
    c.restore();
    comp.draw(renderer, T.upload(), out);
    return { ...rollPost(lyrics, t, bg), bloom: lerp(0.3, 0.6, night), halation: lerp(0, 0.25, night), ca: 0.5, vignette: lerp(0.22, 0.45, night) };
  }
}
