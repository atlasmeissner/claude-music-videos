// ground — pre-chorus 1: "But the ground beneath my feet / Was never on the page".
// The camera pushes into the finished plan toward FIRST JOB. On "ground" the paper goes thin and the territory
// shows through it: the ruled road runs straight across the mountains and through the middle of the lake. On
// "page" the sheet lifts off toward the camera and is gone; the road is left lying on the real ground.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import type { Line } from '../engine/lyrics';
import { clamp, ease, prog } from '../engine/util';
import { PLAN } from './_world';
import { drawKaraoke, lerpView, mixCss, mixRGB, mono, Terrain, w2s, type View } from './_mt';
import { drawFurniture, SHEET_VIEW } from './_sheet';
import { drawThePlan } from './drew';

export default class Ground extends Scene {
  terrain = new Terrain();
  lb = new LineBatch(2000, { blend: 'normal' });
  text = new Layer2D();
  sheet = new Layer2D();
  l4!: Line; l5!: Line;

  override init() { this.l4 = this.ctx.lyrics.lines[4]!; this.l5 = this.ctx.lyrics.lines[5]!; }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp } = this.ctx;
    const t = f.t, t0 = this.ctx.start, t1 = this.ctx.end;
    const l4 = this.l4, l5 = this.l5;
    const vA: View = { cx: 23.2, cy: 47, s: 9.4, rot: 0 };
    const vB: View = { cx: 43.5, cy: 40.5, s: 34, rot: -0.12 };
    const push = prog(t, t0, t1 + 0.3, ease.inOutCubic);
    const v = lerpView(vA, vB, push);
    // the paper thins on "ground" and lifts away on "page"
    const ground = l4.words[2]!, page = l5.words[4]!;
    const thin = prog(t, ground.start - 0.05, l4.end + 0.2, ease.inOutSine);
    const lift = prog(t, page.start - 0.05, page.start + 0.75, ease.inCubic);
    // the ground shows through a hole that opens in the paper at FIRST JOB, wider and wider
    const fj = PLAN[3]!, q = w2s(v, fj.x, fj.y);
    const R = 40 + 820 * thin + 900 * lift;
    const mapMix = 1;
    this.terrain.draw(renderer, out, { view: v, mapMix, lens: [q.x, q.y, R, thin > 0 ? 1 : 0], contourInk: 0, terrInk: 0.55, relief: 3.2, t, sun: [-0.5, -0.7, 0.55] });

    // the plan: ink on paper, bone on the ground; it lifts with the sheet but a ghost stays
    const lb = this.lb; lb.clear();
    const S = this.sheet, c = S.ctx; S.clear();
    const dark = clamp(Math.max(thin, lift));
    void mapMix;
    const lineCol = mixRGB(LIN.ink, LIN.bone, clamp(dark * 1.3));
    const all = PLAN.map(() => 1);
    c.save();
    // the lift: the sheet's own layer scales up about the centre and fades
    const z = 1 + lift * 1.6;
    c.translate(960, 540); c.scale(z, z); c.translate(-960, -540);
    c.globalAlpha = 1 - lift;
    drawFurniture(c, v, { frame: 1, star: 1, scale: 1, legend: 1, title: 1 }, { alpha: 1 - prog(t, t0, t0 + 0.8) });
    c.restore();
    // the road stays (in screen space, unscaled), ghosting as the sheet goes
    drawThePlan(lb, c, v, { road: 1, ticks: 1, places: all, fill: all.map(() => 1 - thin) }, lineCol, dark > 0.5 ? 'bone' : 'ink', 1 - 0.45 * lift);
    lb.render(renderer, out);
    comp.draw(renderer, S.upload(), out);

    // the lyric: set on the ground itself
    const T = this.text, d = T.ctx; T.clear();
    const st = { family: F.archivo(100, 800), size: 78, tracking: -1.5, lead: 0.4 } as const;
    // ink while the words sit on paper, bone once the hole has reached them
    const inHole = (x: number, y: number) => clamp((R - Math.hypot(x - q.x, y - q.y)) / 120 + 0.5) * (thin > 0 ? 1 : 0);
    const k4 = Math.max(inHole(960, 800), lift), k5 = Math.max(inHole(960, 900), lift);
    const sty = (k: number) => ({ sung: mixCss(rgba('ink', 1), rgba('bone', 1), k), unsung: mixCss(rgba('ink', 0.14), rgba('bone', 0.16), k), active: mixCss(rgba('blood', 1), rgba('signal', 1), k) });
    drawKaraoke(d, l4, 960, 820, t, { ...st, ...sty(k4), align: 'center' });
    drawKaraoke(d, l5, 960, 912, t, { ...st, ...sty(k5), align: 'center', lead: 0.8 });
    const a = prog(t, ground.end, ground.end + 0.4) * (1 - lift);
    if (a > 0) { d.globalAlpha = a; mono(d, 'FIRST JOB  ·  DEPTH 41 M', q.x + 18, q.y + 36, { size: 12, color: rgba('bone', 0.85), track: 3 }); d.globalAlpha = 1; }
    comp.draw(renderer, T.upload(), out);
    return { bloom: 0.35, vignette: 0.22 + 0.25 * dark, ca: 0.3 + 0.3 * dark, halation: 0.1 * dark, paper: 1 - thin };
  }
}
