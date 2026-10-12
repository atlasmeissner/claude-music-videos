// decide — the bridge, stripped to handclaps and stomps: "Every great thing started with a jump / Every love began
// with just a name / Every single life worth telling / Started when somebody risked the shame".
// The decision. Near-dark; the person stands at the edge, and on every handclap takes one step back — the run-up,
// counted (STEP 1, 2, 3 …). Each sung line is stamped word by word over them, and on each line's last word the
// abyss loses a quarter of its depth with a thump, until the drop is its true 1.40 m again. On the last line the
// dawn comes back, the person crouches, sets — and on the downbeat runs.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, clearRT, W } from '../engine/gl';
import { LIN, rgba } from '../engine/palette';
import { F } from '../engine/type';
import type { Line } from '../engine/lyrics';
import { clamp, ease, frameIdx, hash, lerp, prog, pulse } from '../engine/util';
import { drawKaraoke, mono, poseKeys, runPose } from './_ff';
import { applyCam, breath, camKeys, drawCounter, drawWorld, dropAt, M, person, S, SP, walkPose, type Cam } from './_story';

export default class Decide extends Scene {
  L = new Layer2D();
  lines: Line[] = [];
  claps: number[] = [];

  override init() {
    const { lyrics, audio } = this.ctx;
    this.lines = [22, 23, 24, 25].map((i) => lyrics.lines[i]!);
    const cl = audio.events('snare', this.ctx.start, this.lines[3]!.start).filter(([, s]) => s >= 0.45).map(([t]) => t);
    for (const t of cl) if (!this.claps.length || t - this.claps[this.claps.length - 1]! > 0.3) this.claps.push(t);
  }

  fear(t: number) {
    let f = 1;
    this.lines.forEach((l) => { const tl = l.words[l.words.length - 1]!.start; f -= 0.25 * prog(t, tl, tl + 0.35, ease.outBack); });
    return clamp(f, 0, 1);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    const t = f.t, end = this.ctx.end;
    clearRT(renderer, out, LIN.ink);
    const L = this.L, c = L.ctx; L.clear();
    const fear = this.fear(t);
    const D = dropAt(fear);
    const last = this.lines[3]!;
    const build = prog(t, last.start, end, ease.inQuad);
    // the run-up: a step back on every clap (up to 9), then crouch, then run on the last beat
    const n = this.claps.filter((x) => x <= t).length;
    const steps = Math.min(n, 9);
    const lastClap = this.claps.filter((x) => x <= t).pop() ?? -9;
    const stepK = prog(t, lastClap, lastClap + 0.22, ease.outCubic);
    const px0 = -40 - Math.max(0, steps - 1) * 52 - (steps > 0 ? 52 * stepK : 0);
    const tSet = end - 1.4, tRun = end - 0.45;
    let px = px0, pose = steps > 0 && stepK < 1 ? walkPose(-f.beat) : breath(SP.breathe, t, 1.2);
    let dir: 1 | -1 = 1;
    if (t > tSet) pose = poseKeys(t, [[0, SP.breathe], [tSet + 0.3, SP.set]], 0.3);
    if (t > tRun) { px = lerp(px0, px0 + 240, prog(t, tRun, end, ease.inQuad)); pose = runPose(f.beat, 0.35); }
    if (steps > 0 && stepK < 1 && t < tSet) dir = 1;
    const cam: Cam = camKeys(t, [[this.ctx.start, { x: -120, y: -40, z: 0.95 }], [last.start, { x: -260, y: 20, z: 0.8 }], [end, { x: -220, y: -60, z: 1.05 }]]);
    c.save(); applyCam(c, cam);
    drawWorld(c, cam, { t, fear, door: 0.3, glow: 1.2 + build, dawn: build * 0.85, stars: 1 - build });
    person(c, px, 0, S, pose, { dir });
    // the footprints of the run-up
    for (let i = 0; i < steps; i++) { c.fillStyle = rgba('signal', 0.7); c.fillRect(-40 - i * 52 - 6, -3, 12, 3); }
    c.restore();
    // readouts
    if (steps > 0) mono(c, `RUN-UP  STEP ${steps}`, W - 104, 96, { size: 14, color: rgba('signal', 0.95), track: 4, align: 'right', weight: 500 });
    mono(c, 'DROP', W - 104, 140, { size: 12, color: rgba('ash', 0.8), track: 4, align: 'right' });
    mono(c, `${(D / M).toFixed(1)} m`, W - 104, 172, { size: 26, color: rgba('bone', 0.95), track: 2, align: 'right', weight: 500 });
    // the line, stamped word by word
    let cur = 0;
    this.lines.forEach((l, i) => { if (t >= l.start - 0.04) cur = i; });
    drawKaraoke(c, this.lines[cur]!, 104, 230, t, { family: F.archivo(112.5, 900), size: 80, tracking: -2, sung: rgba('bone', 1), unsung: '', active: rgba('signal', 1), mode: 'slam' });
    // the register of firsts, small, one entry per line
    const firsts = ['№ 1 A JUMP', '№ 2 A NAME', '№ 3 A LIFE WORTH TELLING', '№ 4 THE SHAME, RISKED'];
    this.lines.forEach((l, i) => {
      const tl = l.words[l.words.length - 1]!.start;
      if (t < tl) return;
      mono(c, firsts[i]!, 104, 300 + i * 30, { size: 15, color: rgba(i === 3 ? 'signal' : 'ash', 0.9 * prog(t, tl, tl + 0.2)), track: 4 });
    });
    drawCounter(c, t);
    comp.draw(renderer, L.upload(), out);
    let hit = 0;
    for (const x of this.claps) hit = Math.max(hit, pulse(t, x, 0.05) * 0.5);
    for (const l of this.lines) hit = Math.max(hit, pulse(t, l.words[l.words.length - 1]!.start, 0.1) * 1.3);
    const sh = hit * 6 + build * 6 * (0.5 + 0.5 * Math.sin(t * 60));
    return { bloom: 0.6 + 0.3 * build, vignette: 0.5 - 0.2 * build, shake: [(hash(frameIdx(t), 1) - 0.5) * sh, (hash(frameIdx(t), 2) - 0.5) * sh] as [number, number], zoom: 1 + build * 0.04 };
  }
}
