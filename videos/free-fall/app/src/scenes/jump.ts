// jump — the final chorus. This time it is real.
//   "Free fall, free fall": the run ends at the edge and they leap — arms out, into the dawn — in slow motion (×9):
//     the whole first line is one 0.53-second fall. FREE / FALL slam, maximal (stacked repeats, strobe).
//   "I'd rather fly and hit the wall": they land on "hit" and stumble — a roll, sat on the ground. The worst case,
//     realised: −1, a stumble.
//   "Than spend a life just standing tall": they get up, laughing, and look back: the grey statue of the one who
//     stayed still stands on the ledge — and on "tall" it crumbles to dust.
//   "On ground that never moves at all": they run for the door; the ground moves under them (it scrolls past, the
//     crowd parts and cheers); on "all" the door swings wide and the light floods out (the one acid moment), held.
//   "Free fall, free fall": they turn in the doorway, wave, and walk into the light.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, clearRT, W, H } from '../engine/gl';
import { LIN, rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import type { Line, Word } from '../engine/lyrics';
import { clamp, ease, frameIdx, hash, lerp, prog, pulse, TAU } from '../engine/util';
import { cachedLayout, drawKaraoke, mixCss, mono, wordColor } from './_ff';
import { bodyKeys, crowdDance, flutter, hopState, jumpState, track, type Body } from './_body';
import { applyCam, breath, camKeys, drawCounter, drawWorld, DOOR_X, M, person, S, SP, toScreen, TRUE_DROP, type Cam } from './_story';
import { stamp } from './ledger-kit';

const FAM = F.archivo(125, 900);

export default class Jump extends Scene {
  L = new Layer2D();
  l: Line[] = [];
  tLeap = 0; tLand = 0; tUp = 0; tTall = 0; tRun = 0; tOpen = 0; tTurn = 0; tIn = 0;

  override init() {
    const ly = this.ctx.lyrics;
    this.l = [26, 27, 28, 29, 30].map((i) => ly.lines[i]!);
    const w = (li: number, wi: number) => this.l[li]!.words[wi < 0 ? this.l[li]!.words.length + wi : wi]!.start;
    this.tLeap = this.ctx.start + 0.02;
    this.tLand = w(1, 4); // "hit"
    this.tUp = w(2, 0);
    this.tTall = w(2, -1);
    this.tRun = w(3, 0);
    this.tOpen = w(3, -1); // "all"
    this.tTurn = w(4, 0);
    this.tIn = w(4, 3);
  }

  /**
   * The person at t. The jump is real physics in slow motion (×9): take-off at the edge at full run, a parabola
   * under constant gravity, arms out against the air. The landing carries the run's momentum: knees give, the body
   * pitches forward — a stumble — caught on the hands, rolled down to sitting. Then: laughing; up on one knee; up;
   * arms up; a look back at the ledge; a run to the door; a wave from the doorway; in.
   */
  me(t: number): { x: number; y: number; pose: Body; rot: number; dir: 1 | -1; air: boolean; lift: number } {
    const D = TRUE_DROP;
    const air = this.tLand - this.tLeap;
    const j = jumpState(t, {
      tTake: this.tLeap, air, from: { x: -14, y: 0 }, to: { x: 236, y: D }, apex: 72,
      airPose: (u) => flutter(bodyKeys(u, [[0, SP.takeoff], [0.2, SP.leap], [0.45, SP.star], [0.78, SP.star], [1, SP.reach]], 0.18), t / 9, 0.6 * Math.sin(Math.PI * u)),
    });
    if (j.mode === 'air') return { x: j.x, y: j.y, pose: j.pose, rot: 0.12 * Math.sin(Math.PI * j.x / 250), dir: 1, air: true, lift: 0 };
    const v = t - this.tLand;
    if (t < this.tUp) {
      // the stumble: momentum carries the hips on as the knees give
      const x = 236 + 104 * ease.outCubic(clamp(v / 0.8));
      let pose = bodyKeys(v, [[0, SP.reach], [0.09, SP.land], [0.32, SP.stumble], [0.56, SP.fours], [1.3, SP.sitGround]], 0.22);
      // laughing: little shakes of the shoulders and head
      const laugh = prog(v, 1.3, 1.6) * (1 - prog(t, this.tUp - 0.2, this.tUp));
      pose = { ...pose, torso: pose.torso + laugh * 0.07 * Math.sin(v * 21), head: pose.head - laugh * (0.25 + 0.12 * Math.sin(v * 21 + 1)) };
      return { x, y: D, pose, rot: 0, dir: 1, air: false, lift: 0 };
    }
    const tr = track(t, [
      { at: this.tUp, pose: SP.kneelUp, x: 330, blend: 0.6 },
      { at: this.tUp + 0.55, pose: SP.stand, x: 336, blend: 0.6 },
      { at: this.tUp + 1.15, pose: SP.cheer, blend: 0.4 },
      { at: this.tTall - 0.9, pose: SP.lookBack, face: -1, blend: 0.6 },
      { at: this.tRun, run: DOOR_X - 90, dur: this.tOpen + 0.3 - this.tRun, face: 1 },
      { at: this.tTurn - 0.1, pose: SP.wave, face: -1, blend: 0.55 },
      { at: this.tIn - 0.45, pose: SP.stand, face: 1, blend: 0.5 },
      { at: this.tIn, walk: DOOR_X + 0.47 * M, dur: this.ctx.end - this.tIn },
    ], S, 340, SP.sitGround);
    const pose = tr.moving ? tr.pose : breath(tr.pose, t, 0.6);
    return { x: tr.x, y: D, pose, rot: 0, dir: tr.dir, air: false, lift: tr.lift };
  }

  slam(c: CanvasRenderingContext2D, s: string, w: Word, x: number, base: number, size: number, col: string, t: number) {
    const k = clamp((t - w.start + 0.02) / 0.1);
    if (k <= 0) return;
    const L = cachedLayout(s, FAM, size, -size * 0.03);
    const sc = 1 + 0.25 * (1 - ease.outBack(k, 2.4));
    c.save(); c.font = font(FAM, size); c.letterSpacing = `${-size * 0.03}px`; c.fillStyle = col;
    c.translate(x + L.width / 2, base - size * 0.34); c.scale(sc, sc); c.translate(-(x + L.width / 2), -(base - size * 0.34));
    c.fillText(s, x, base); c.restore();
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    const t = f.t, end = this.ctx.end;
    clearRT(renderer, out, LIN.ink);
    const L = this.L, c = L.ctx; L.clear();
    const me = this.me(t);
    const open = prog(t, this.tOpen - 0.05, this.tOpen + 0.6, ease.outBack);
    const acid = pulse(t, this.tOpen, 0.35) * (t > this.tOpen ? 1 : 0);
    // camera: on the leaper (slow-mo), then the two-shot of ground + ledge, then tracking the run, then the door
    const cam: Cam = camKeys(t, [
      [this.tLeap, { x: 60, y: -40, z: 1.25 }],
      [this.tLand - 0.4, { x: 200, y: 120, z: 1.0 }],
      [this.tUp, { x: 160, y: 120, z: 0.95 }],
      [this.tRun, { x: 220, y: 100, z: 0.9 }],
      [this.tOpen, { x: DOOR_X - 220, y: TRUE_DROP - 140, z: 1.05 }],
      [this.tTurn, { x: DOOR_X - 40, y: TRUE_DROP - 180, z: 1.15 }],
      [end, { x: DOOR_X + 40, y: TRUE_DROP - 200, z: 1.45 }],
    ]);
    c.save(); applyCam(c, cam);
    drawWorld(c, cam, { t, fear: 0, door: open, glow: 1.6 + 2.5 * open + acid, dawn: 1, stars: 0 });
    // the ground moves now: running stripes under the runner
    if (t > this.tRun && t < this.tOpen + 0.5) {
      const off = ((t - this.tRun) * 900) % 60;
      c.strokeStyle = rgba('signal', 0.55); c.lineWidth = 2;
      for (let x = 0; x < DOOR_X; x += 60) { const xx = x - off; if (xx < 0) continue; c.beginPath(); c.moveTo(xx, TRUE_DROP + 6); c.lineTo(xx + 24, TRUE_DROP + 6); c.stroke(); }
    }
    // the crowd at the door (from the chant), cheering, parting for the runner
    for (let i = 0; i < 12; i++) {
      const bx = DOOR_X - 520 + ((i + 0.5) / 12) * 1300 + (hash(i, 1) - 0.5) * 40;
      const part = t > this.tRun ? prog(t, this.tRun + 0.8, this.tOpen, ease.inOutCubic) : 0;
      const x = bx + (bx < DOOR_X - 80 ? -1 : 1) * 160 * part * (Math.abs(bx - (DOOR_X - 80)) < 260 ? 1 : 0);
      const h = S * (0.58 + 0.17 * hash(i, 4));
      // dancing, wilder once the jump has landed; everyone jumps when the door swings wide
      const dn = crowdDance(t, f.beat, i + 3, h, t > this.tLand ? 1 : 0.55);
      const hp = hopState(t, this.tOpen + (hash(i, 6) - 0.5) * 0.1, 0.16 * h, h, dn.pose);
      const lift = Math.max(t > this.tOpen - 0.2 && t < this.tOpen + 0.9 ? 0 : dn.lift, hp.lift / h);
      person(c, x + dn.dx, TRUE_DROP, h, hp.pose, { color: mixCss(rgba('ink', 1), rgba('ash', 1), 0.8), lift });
    }
    // the statue of the one who stayed, on the ledge: crumbles on "tall"
    const sa = prog(t, this.tUp + 0.6, this.tUp + 1.2);
    if (sa > 0) {
      const crumble = prog(t, this.tTall, this.tTall + 1.2);
      if (crumble < 0.05) person(c, -80, 0, S, SP.statue, { color: rgba('graphite', sa) });
      if (crumble > 0) for (let i = 0; i < 140; i++) {
        const u = crumble;
        const x0 = -80 + (hash(i, 1) - 0.5) * 0.3 * S, y0 = -hash(i, 2) * S;
        const y = Math.min(0, y0 + 0.5 * 900 * (u * 1.2) ** 2 * (0.5 + hash(i, 3)));
        c.fillStyle = rgba('graphite', 1 - u * 0.6);
        c.fillRect(x0 + (hash(i, 4) - 0.5) * 80 * u, y - 3, 5, 5);
      }
    }
    // the person
    person(c, me.x, me.y, S, me.pose, { rot: me.rot, dir: me.dir, air: me.air, lift: me.lift, support: (wx) => (wx <= 0 ? 0 : TRUE_DROP), color: t > this.tIn ? rgba('ink', 1 - prog(t, end - 0.8, end)) : rgba('bone', 1) });
    // the acid light from the door, one moment
    if (acid > 0.01) {
      for (let i = 0; i < 30; i++) {
        const ang = Math.PI + (i / 29) * Math.PI;
        const Lr = (600 + 900 * hash(i, 5)) * (0.4 + 0.6 * open);
        c.strokeStyle = rgba('acid', 0.8 * acid); c.lineWidth = 2.5;
        c.beginPath(); c.moveTo(DOOR_X + 0.47 * M, TRUE_DROP - 1.1 * M); c.lineTo(DOOR_X + 0.47 * M + Math.cos(ang) * Lr, TRUE_DROP - 1.1 * M + Math.sin(ang) * Lr); c.stroke();
      }
    }
    c.restore();
    // ---- type
    const [l26, l27, l28, l29, l30] = this.l;
    if (t < l27!.start - 0.1) {
      // the hook, maximal: stacked repeats behind, a strobe on each word
      const w = l26!.words;
      for (let r = 2; r >= 0; r--) {
        const ox = r * 22, oy = r * 22;
        const cF = r === 0 ? rgba('bone', 1) : r === 1 ? rgba('signal', 0.5) : rgba('graphite', 0.8);
        const cL = r === 0 ? rgba('signal', 1) : r === 1 ? rgba('bone', 0.3) : rgba('blood', 0.8);
        this.slam(c, 'FREE', w[0]!, 104 + ox, 330 + oy, 230, cF, t);
        this.slam(c, 'FALL', w[1]!, 104 + ox, 560 + oy, 230, cL, t);
        if (t > w[2]!.start - 0.05) {
          const xr = W - 104 - cachedLayout('FREE', FAM, 230, -7).width;
          this.slam(c, 'FREE', w[2]!, xr + ox, 330 + oy, 230, cF, t);
          this.slam(c, 'FALL', w[3]!, xr + ox, 560 + oy, 230, cL, t);
        }
      }
    } else if (t < l30!.start - 0.15) {
      const cur = t < l28!.start - 0.1 ? l27! : t < l29!.start - 0.1 ? l28! : l29!;
      drawKaraoke(c, cur, 104, 170, t, { family: F.archivo(112.5, 900), size: 80, tracking: -2, sung: rgba('bone', 1), unsung: rgba('bone', 0.18), active: rgba('signal', 1), lead: 0.4 });
      if (cur === l29) {
        // "all", held: stretched wide while it is held
        const wa = l29!.words[l29!.words.length - 1]!;
        const hold = prog(t, wa.start, wa.end, ease.inOutQuad);
        if (t > wa.start) {
          c.save(); c.font = font(F.archivo(125, 900), 200); c.letterSpacing = `${lerp(0, 90, hold)}px`;
          c.fillStyle = wordColor(wa, t); c.fillText('ALL', 104, 420); c.restore();
        }
      }
    } else {
      const w = l30!.words;
      this.slam(c, 'FREE', w[0]!, 104, 330, 200, rgba('bone', 1), t);
      this.slam(c, 'FALL', w[1]!, 104, 520, 200, rgba('signal', 1), t);
      if (t > w[2]!.start - 0.05) { this.slam(c, 'FREE', w[2]!, 980, 330, 200, rgba('bone', 1), t); this.slam(c, 'FALL', w[3]!, 980, 520, 200, rgba('signal', 1), t); }
    }
    // readouts: time in the air (real time, not the slow motion), the outcome
    const air = clamp((t - this.tLeap) / (this.tLand - this.tLeap)) * 0.53;
    if (t > this.tLeap) {
      mono(c, t < this.tLand ? 'SLOW MOTION ×9' : 'LANDED', W - 104, 96, { size: 13, color: rgba('ash', 0.85), track: 5, align: 'right' });
      mono(c, 'TIME IN THE AIR', W - 104, 130, { size: 12, color: rgba('ash', 0.85), track: 4, align: 'right' });
      mono(c, `${air.toFixed(2)} s`, W - 104, 166, { size: 30, color: rgba('signal', 1), track: 2, align: 'right', weight: 500 });
    }
    stamp(c, 1420, 820, ['OUTCOME: −1', 'A STUMBLE'], t, this.tLand + 0.35, { size: 26, rot: -0.1 });
    drawCounter(c, t, { label: 'DAYS ON THE LEDGE', value: t > this.tLeap ? '412 · DONE' : undefined });
    comp.draw(renderer, L.upload(), out);
    const words = this.l.flatMap((l) => l.words);
    let hit = pulse(t, this.tLand, 0.1) * 1.4 + pulse(t, this.tTall, 0.1) * 0.6 + acid;
    if (t < l27!.start) for (const w of l26!.words) hit = Math.max(hit, pulse(t, w.start, 0.1));
    void words; void H; void toScreen;
    const sh = hit * 9;
    return {
      bloom: 0.9 + acid, vignette: 0.35, shake: [(hash(frameIdx(t), 1) - 0.5) * sh, (hash(frameIdx(t), 2) - 0.5) * sh] as [number, number],
      zoom: 1 + hit * 0.012, flash: t < l27!.start ? Math.max(...l26!.words.map((w) => pulse(t, w.start, 0.04))) * 0.25 : 0,
    };
  }
}
