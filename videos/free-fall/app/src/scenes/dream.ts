// dream ×2 — the choruses. Both are what the person imagines; neither is the jump.
// v=1 (chorus 1, a daydream):
//   H "Free fall, free fall": they leap and fall, slow, arms out, through an abyss that is deep again (dreams lie);
//     FREE / FALL slam full-frame, the letters of FALL dropping in under gravity.
//   A "I'd rather fly and hit a wall": they fly, arms out, and hit a brick wall — bounce, tumble, fine. DAMAGE: ONE (1)
//     BRUISE.
//   B "Than spend forever standing tall / On ground that never moves at all": the alternative — a grey statue of them
//     standing on the ledge while the days cycle past (time-lapse), dust settling; GROUND MOVEMENT 0.000 mm.
// v=2 (chorus 2, the freeze):
//   H: they run at the edge for real — and freeze at it, toes over, arms windmilling. The letters fall; they don't.
//   A: the flight and the wall play in a thought bubble above them; they stay frozen.
//   B: frozen at the edge while the days race past, slowly turning to the grey of the statue; on the tag "Free fall"
//     they step back and sit down.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, clearRT, W, H } from '../engine/gl';
import { LIN, rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import type { Line, Word } from '../engine/lyrics';
import { clamp, ease, frameIdx, hash, lerp, prog, pulse, TAU } from '../engine/util';
import { cachedLayout, drawKaraoke, mono, wordColor } from './_ff';
import { bodyKeys, flutter, idle, mixBody, track, type Move } from './_body';
import { applyCam, breath, camKeys, daysAt, drawCounter, drawWorld, dropAt, ledgeTop, person, S, SP, type Cam } from './_story';
import { stamp } from './ledger-kit';

const FAM = F.archivo(125, 900);

export default class Dream extends Scene {
  v = 1;
  L = new Layer2D();
  hook!: Line; la!: Line; lb!: Line; lc!: Line; tag: Line | null = null;
  tA = 0; tB = 0;

  override init() {
    const { lyrics, audio, params } = this.ctx;
    this.v = params.v ?? 1;
    this.hook = lyrics.lines[params.hook]!;
    const [a, b, cc] = params.lines as number[];
    this.la = lyrics.lines[a!]!; this.lb = lyrics.lines[b!]!; this.lc = lyrics.lines[cc!]!;
    if (params.tag !== undefined) this.tag = lyrics.lines[params.tag]!;
    const cut = (l: Line) => audio.timeOfBeat(Math.floor(audio.beatAt(l.words[0]!.start + 0.05)));
    this.tA = cut(this.la); this.tB = cut(this.lb);
  }

  /** A full-frame word slam; letters of `fall` words drop in under gravity (and, if `away`, keep falling after). */
  slam(c: CanvasRenderingContext2D, s: string, w: Word, x: number, base: number, size: number, col: string, t: number, fall: boolean, away = 0) {
    const L = cachedLayout(s, FAM, size, -size * 0.03);
    c.save();
    c.font = font(FAM, size); c.letterSpacing = '0px'; c.textBaseline = 'alphabetic'; c.fillStyle = col;
    L.glyphs.forEach((g, i) => {
      if (!fall) {
        const k = clamp((t - w.start + 0.02) / 0.1);
        if (k <= 0) return;
        const sc = 1 + 0.22 * (1 - ease.outBack(k, 2.4));
        c.save(); c.translate(x + L.width / 2, base - size * 0.34); c.scale(sc, sc); c.translate(-(x + L.width / 2), -(base - size * 0.34));
        c.fillText(g.ch, x + g.x, base); c.restore();
        return;
      }
      const d = 0.24, land = w.start + 0.04 + i * 0.045;
      const u = (t - (land - d)) / d;
      if (u <= 0) return;
      let dy = 0, sy = 1;
      if (u < 1) { dy = -(base + size) * (1 - u * u); sy = 1 + 0.25 * u; }
      else {
        const a = t - land;
        sy = 1 - 0.2 * Math.exp(-a * 14) * Math.cos(a * 38);
        if (away > 0 && t > away + i * 0.05) dy = 0.5 * 5200 * (t - away - i * 0.05) ** 2; // and on, into the dark
      }
      c.save(); c.translate(x + g.x + g.w / 2, base + dy); c.scale(1, sy); c.fillText(g.ch, -g.w / 2, 0); c.restore();
    });
    c.restore();
    return L.width;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    const t = f.t;
    clearRT(renderer, out, LIN.ink);
    const L = this.L, c = L.ctx; L.clear();
    let hit = 0;
    if (t < this.tA) hit = this.v === 1 ? this.hook1(c, t) : this.hook2(c, t, f);
    else if (t < this.tB) hit = this.v === 1 ? this.flyWall(c, t, 1) : this.bubble(c, t, f);
    else hit = this.statue(c, t);
    comp.draw(renderer, L.upload(), out);
    const sh = hit * 9;
    return { bloom: 0.75, vignette: 0.45, shake: [(hash(frameIdx(t), 1) - 0.5) * sh, (hash(frameIdx(t), 2) - 0.5) * sh] as [number, number], zoom: 1 + hit * 0.012 };
  }

  words(c: CanvasRenderingContext2D, t: number, away: boolean) {
    const w = this.hook.words;
    const size = 230;
    const fallAway = (i: number) => (away ? w[i]!.start + 0.55 : 0);
    // first pair left, second pair right
    const firstA = away ? 1 - prog(t, w[2]!.start - 0.2, w[2]!.start - 0.05) : 1;
    if (firstA > 0) {
      c.save(); c.globalAlpha = firstA;
      this.slam(c, 'FREE', w[0]!, 104, 330, size, rgba('bone', 1), t, false);
      c.restore();
    }
    this.slam(c, 'FALL', w[1]!, 104, 560, size, rgba('signal', 1), t, true, fallAway(1));
    if (t > w[2]!.start - 0.05) {
      const xr = away ? 104 : W - 104 - cachedLayout('FREE', FAM, size, -size * 0.03).width;
      this.slam(c, 'FREE', w[2]!, xr, 330, size, rgba('bone', 1), t, false);
      this.slam(c, 'FALL', w[3]!, xr, 560, size, rgba('signal', 1), t, true, fallAway(3));
    }
    let h = 0;
    for (const x of w) h = Math.max(h, pulse(t, x.start, 0.08));
    return h;
  }

  // ---------------------------------------------------------------- v1 H: the dream leap
  hook1(c: CanvasRenderingContext2D, t: number) {
    const t0 = this.ctx.start;
    const u = t - t0;
    const px = 40 + 120 * u, py = -40 * Math.sin(Math.min(u, 0.6) / 0.6 * Math.PI / 2) + 0.5 * 260 * Math.max(0, u - 0.4) ** 2;
    const cam: Cam = { x: px + 120, y: py - 40, z: 1.0 - 0.15 * prog(t, t0, this.tA) };
    c.save(); applyCam(c, cam);
    drawWorld(c, cam, { t, fear: 1, door: 0.2, glow: 1.2, stars: 1 });
    // take-off → arms out (a star), limbs fluttering in the rushing air, slowly turning
    const pose = flutter(bodyKeys(u, [[0, SP.leap], [0.6, SP.star]], 0.5), t, prog(u, 0.4, 1.2));
    person(c, px, py + S * 0.5, S, pose, { rot: 0.3 * Math.sin(u * 1.3), air: true });
    c.restore();
    mono(c, 'A DAYDREAM', W - 104, 96, { size: 13, color: rgba('ash', 0.75), track: 6, align: 'right' });
    return this.words(c, t, false);
  }

  // ---------------------------------------------------------------- v2 H: the run — and the freeze at the edge
  hook2(c: CanvasRenderingContext2D, t: number, f: Frame) {
    const t0 = this.ctx.start, w = this.hook.words;
    const tFreeze = w[1]!.start;
    const cam: Cam = camKeys(t, [[t0, { x: -560, y: 0, z: 0.9 }], [this.tA, { x: -520, y: 40, z: 1.0 }]]);
    c.save(); applyCam(c, cam);
    drawWorld(c, cam, { t, fear: 1, door: 0.2, glow: 1.2, stars: 1 });
    // the run (from the doorway's set), braking hard into the edge: the stop throws the body forward over the toes,
    // the arms windmill backwards to pull it back, and the wobble dies away
    const tr = track(t, [{ at: t0 - 0.05, run: -30, dur: tFreeze - t0 + 0.05, end: SP.freeze }], S, -520, SP.set);
    let pose = tr.pose;
    if (t > tFreeze - 0.1) {
      const v = Math.max(0, t - tFreeze + 0.1), damp = Math.exp(-v * 1.6);
      const spin = -13 * (1 - Math.exp(-v * 1.1)) / 1.1; // the arms circle backwards, slowing
      const near = (a: number, ref: number) => a - TAU * Math.round((a - ref) / TAU);
      const F = SP.freeze;
      pose = { ...pose, torso: pose.torso + 0.16 * Math.sin(v * 7) * damp, a1: near(-1.5 + spin, F.a1), a2: near(-1.2 + spin, F.a2), b1: near(0.5 + spin, F.b1), b2: near(0.8 + spin, F.b2) };
      pose = mixBody(pose, F, prog(v, 1.8, 3.0, ease.inOutCubic));
    }
    person(c, tr.x, 0, S, pose, { lift: tr.lift, support: ledgeTop(dropAt(1)) });
    c.restore();
    if (t > tFreeze) mono(c, 'STOPPED AT THE EDGE', W - 104, 96, { size: 13, color: rgba('signal', 0.9), track: 5, align: 'right' });
    return this.words(c, t, true);
  }

  // ---------------------------------------------------------------- v1 A: flight into a wall (also inside the v2 bubble)
  flyWall(c: CanvasRenderingContext2D, t: number, scale: number, ox = 0, oy = 0) {
    const w = this.la.words;
    const tFly = w[2]!.start, tWall = w[w.length - 1]!.start;
    const WX = 1500 * scale + ox;
    // the flier: crosses the frame toward the wall, hits it on "wall", bounces back tumbling
    const base = 520 * scale + oy;
    const floor = base + 330 * scale; // the floor of the dream, appearing with the wall
    const fl = this.flight(t, tWall, WX, base, floor, scale, ox);
    const { x, y } = fl;
    // speed lines behind the flier

    // the wall (engraved bricks), sliding up into place on "hit"
    const wk = prog(t, w[4]!.start - 0.2, w[4]!.start + 0.2, ease.outBack);
    if (wk > 0) {
      const top = lerp(H * scale + oy, 160 * scale + oy, wk), bot = H * scale + oy;
      const shake = pulse(t, tWall, 0.08) * 10 * scale;
      c.save(); c.translate(shake * (hash(frameIdx(t), 4) - 0.5) * 2, 0);
      c.fillStyle = rgba('ink2', 1); c.fillRect(WX, top, 240 * scale, bot - top);
      c.strokeStyle = rgba('bone', 0.85); c.lineWidth = 1.4;
      for (let r = 0; top + r * 40 * scale < bot; r++) {
        const yy = top + r * 40 * scale;
        c.beginPath(); c.moveTo(WX, yy); c.lineTo(WX + 240 * scale, yy); c.stroke();
        for (let xx = WX + (r % 2 ? 50 : 0) * scale; xx < WX + 240 * scale; xx += 100 * scale) { c.beginPath(); c.moveTo(xx, yy); c.lineTo(xx, yy + 40 * scale); c.stroke(); }
      }
      c.lineWidth = 2; c.strokeRect(WX, top, 240 * scale, bot - top);
      c.restore();
    }
    if (wk > 0) {
      c.strokeStyle = rgba('bone', 0.85 * clamp(wk)); c.lineWidth = 2;
      c.beginPath(); c.moveTo(ox - 400 * scale, floor); c.lineTo(WX, floor); c.stroke();
      c.lineWidth = 1;
      for (let xx = ox - 400 * scale; xx < WX; xx += 26 * scale) { c.beginPath(); c.moveTo(xx, floor); c.lineTo(xx - 16 * scale, floor + 16 * scale); c.stroke(); }
    }
    if (fl.ground) person(c, x, floor, S * scale, fl.pose, { rot: fl.rot });
    else if (t < tWall) {
      // the flight: the body centred on its line of flight (y), arms first; the wind streaming past it, centred on it
      const me = person(c, x, y, S * scale, fl.pose, { rot: fl.rot, air: true, alpha: 0 });
      const sx = x - (me.hip.x + me.head.x) / 2, sy = y - (me.hip.y + me.head.y) / 2; // shift: body centre → (x, y)
      const tail = me.hip.x + sx - 0.5 * S * scale, nose = me.head.x + sx;
      for (let i = 0; i < 11; i++) {
        const k = i - 5, ly = y + k * 16 * scale + Math.sin(t * 9 + i) * 2 * scale;
        const len = (160 + 220 * hash(i, 3)) * scale;
        const off = (t * 1400 * scale + hash(i, 5) * 300 * scale) % (110 * scale);
        // close to the body the wind streams off behind the feet; further out it rushes past alongside
        const x1 = (Math.abs(k) <= 1 ? tail : nose - 40 * scale * Math.abs(k)) - off;
        c.strokeStyle = rgba('bone', 0.42 - Math.abs(k) * 0.05); c.lineWidth = 1.4;
        c.beginPath(); c.moveTo(x1 - len, ly); c.lineTo(x1, ly); c.stroke();
      }
      person(c, x + sx, y + sy, S * scale, fl.pose, { rot: fl.rot, air: true });
    } else person(c, x, y + fl.low * scale, S * scale, fl.pose, { rot: fl.rot, air: true });
    // stars of the bonk
    if (t > tWall && t < tWall + 0.8) for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + t * 4, r = 60 * scale * (1 + (t - tWall));
      c.fillStyle = rgba('signal', 1 - (t - tWall) / 0.8);
      c.beginPath(); c.arc(WX - 30 * scale + Math.cos(a) * r, base + Math.sin(a) * r * 0.6, 5 * scale, 0, TAU); c.fill();
    }
    if (scale === 1) {
      stamp(c, 560, 640, ['DAMAGE:', 'ONE (1) BRUISE'], t, tWall + 0.6, { size: 26, rot: -0.1 });
      drawKaraoke(c, this.la, 104, 170, t, { family: F.archivo(112.5, 900), size: 80, tracking: -2, sung: rgba('bone', 1), unsung: rgba('bone', 0.18), active: rgba('signal', 1), lead: 0.4 });
      mono(c, 'A DAYDREAM', W - 104, 96, { size: 13, color: rgba('ash', 0.75), track: 6, align: 'right' });
    }
    return pulse(t, tWall, 0.08) * 1.3;
  }

  /** The flier: arms-first flight (rotated 90°) → impact → thrown back and up, tumbling, under gravity → lands on the
   * floor, skids, rolls up to sitting, dazed. Returns the body centre (x, y), or the ground state. */
  flight(t: number, tWall: number, WX: number, base: number, floor: number, scale: number, ox: number) {
    if (t < tWall) {
      const k = prog(t, this.tA - 0.1, tWall, (q) => q * q * (3 - 2 * q) * 0.4 + q * 0.6);
      const pose = flutter(SP.cheer, t, 0.5);
      return { x: lerp(-200 * scale + ox, WX - 140 * scale, k), y: base + Math.sin(t * 3) * 18 * scale, low: S * 0.5, rot: Math.PI / 2, pose, ground: false };
    }
    const u = t - tWall;
    const g = 3400 * scale, vx = -620 * scale, vy = -520 * scale;
    // the lowest point of the tumbling body is ~0.3 S below its centre; it reaches the floor at uL
    const c0 = base + 0.3 * S * scale, need = floor - c0;
    const uL = (-vy + Math.sqrt(vy * vy + 2 * g * need)) / g;
    if (u < uL) {
      const pose = bodyKeys(u, [[0, SP.cheer], [0.15, SP.tuck]], 0.15);
      return { x: WX - 140 * scale + vx * u, y: base + vy * u + 0.5 * g * u * u, low: 0.3 * S, rot: Math.PI / 2 - u * 9, pose, ground: false };
    }
    // on the floor: the slide dies out with friction, the roll unwinds into sitting up
    const v = u - uL, xL = WX - 140 * scale + vx * uL;
    const slide = (vx * 0.45) * (1 - Math.exp(-v * 4)) / 4;
    const r0 = Math.PI / 2 - uL * 9;
    const rk = ease.outCubic(clamp(v / 0.5));
    const rot = lerp(((r0 % TAU) + TAU) % TAU > Math.PI ? (((r0 % TAU) + TAU) % TAU) - TAU : ((r0 % TAU) + TAU) % TAU, 0, rk);
    const pose = idle(bodyKeys(v, [[0, SP.tuck], [0.5, SP.sitGround]], 0.45), t * 1.6, 1.4);
    return { x: xL + slide, y: floor, low: 0, rot, pose, ground: true };
  }

  // ---------------------------------------------------------------- v2 A: the same flight, in a thought bubble over the frozen person
  bubble(c: CanvasRenderingContext2D, t: number, f: Frame) {
    const cam: Cam = { x: 380, y: 0, z: 1.0 };
    c.save(); applyCam(c, cam);
    drawWorld(c, cam, { t, fear: 1, door: 0.2, glow: 1.2, stars: 1 });
    person(c, -30, 0, S, breath(SP.freeze, t, 1.5), { support: ledgeTop(dropAt(1)) });
    c.restore();
    // the bubble (dashed ellipse) with the flight inside, rendered small
    const bx = 1240, by = 330, rx = 520, ry = 250;
    const bk = prog(t, this.tA, this.tA + 0.4, ease.outBack);
    c.save();
    c.globalAlpha = clamp(bk);
    c.fillStyle = rgba('ink', 0.92); c.strokeStyle = rgba('bone', 0.8); c.lineWidth = 2; c.setLineDash([10, 8]);
    c.beginPath(); c.ellipse(bx, by, rx * bk, ry * bk, 0, 0, TAU); c.fill(); c.stroke(); c.setLineDash([]);
    for (const [dx, dy, r] of [[-430, 300, 22], [-520, 380, 13]] as const) { c.beginPath(); c.arc(bx + dx, by + dy, r, 0, TAU); c.stroke(); }
    c.beginPath(); c.ellipse(bx, by, rx * bk - 4, ry * bk - 4, 0, 0, TAU); c.clip();
    const h = this.flyWall(c, t, 0.42, bx - 520 * 0.42 - 150, by - 540 * 0.42 + 30);
    c.restore();
    drawKaraoke(c, this.la, 104, 170, t, { family: F.archivo(112.5, 900), size: 80, tracking: -2, sung: rgba('bone', 1), unsung: rgba('bone', 0.18), active: rgba('signal', 1), lead: 0.4 });
    mono(c, 'STILL AT THE EDGE', W - 104, 96, { size: 13, color: rgba('signal', 0.9), track: 5, align: 'right' });
    void f;
    return h * 0.5;
  }

  // ---------------------------------------------------------------- B: standing tall, forever (time-lapse)
  statue(c: CanvasRenderingContext2D, t: number) {
    const lb = this.lb, lc = this.lc, end = this.ctx.end;
    const t0 = this.tB;
    const u = t - t0;
    const day = 0.5 - 0.5 * Math.cos(TAU * u * 0.9); // the days cycling past
    const v2 = this.v === 2;
    const tag = this.tag;
    const grey = v2 ? prog(t, t0, lc.start + 1.0) * (tag ? 1 - prog(t, tag.words[0]!.start, tag.words[0]!.start + 0.5) : 1) : 1;
    const cam: Cam = camKeys(t, [[t0, { x: v2 ? -40 : -120, y: -140, z: 1.25 }], [end, { x: v2 ? -60 : -160, y: -160, z: 1.45 }]]);
    c.save(); applyCam(c, cam);
    drawWorld(c, cam, { t, fear: 0.6, door: 0.2, glow: 1.0, dawn: day * 0.85, stars: 1 - day });
    // the figure: colour fades to graphite (the statue); dust settles on head and shoulders; v2's tag: steps back, sits
    const col = `rgba(${lerp(238, 94, grey).toFixed(0)},${lerp(233, 91, grey).toFixed(0)},${lerp(223, 87, grey).toFixed(0)},1)`;
    // (v1: the statue. v2: frozen at the edge, stiffening into the statue; on the tag: steps back, turns, sits down)
    const moves: Move[] = v2 ? [{ at: t0 + 0.2, pose: SP.statue, blend: 0.9 }] : [];
    if (tag) {
      const tt = tag.words[0]!.start + 0.1;
      moves.push({ at: tt, walk: -160, dur: 0.75, back: true, face: 1, end: SP.stand }, { at: tt + 0.8, pose: SP.squat, blend: 0.4 }, { at: tt + 1.2, pose: SP.huddleHunch, blend: 0.55 });
    }
    const tr = track(t, moves, S, v2 ? -30 : -120, v2 ? SP.freeze : SP.statue);
    const head = person(c, tr.x, 0, S, tr.moving ? tr.pose : breath(tr.pose, t, 0.3 * (1 - grey)), { color: col, dir: tr.dir, support: ledgeTop(dropAt(0.6)) });
    // dust and a cobweb from the shoulder to the ground
    const dust = clamp(u / 6) * (1 - (tag && t > tag.words[0]!.start ? 1 : 0));
    // (lying on the crown of the head: specks on its upper arc)
    const hr = 0.08 * S;
    for (let i = 0; i < 40 * dust; i++) {
      const ang = -Math.PI / 2 + (hash(i, 1) - 0.5) * 1.6;
      const rr = hr - 1.5 + hash(i, 2) * 1.5;
      c.fillStyle = rgba('ash', 0.85);
      c.fillRect(head.x + Math.cos(ang) * rr - 1.1, head.y + Math.sin(ang) * rr - 1.1, 2.2, 2.2);
    }
    c.restore();
    // readouts
    const yrs = Math.floor(u * u * 0.9 * (v2 ? 1 : 3));
    mono(c, 'TIME STANDING STILL', W - 520, 860, { size: 13, color: rgba('ash', 0.85), track: 4 });
    mono(c, `${yrs.toLocaleString('en-US')} yr ${Math.floor((u * 97) % 365)} d`, W - 520, 904, { size: 34, color: rgba('signal', 1), track: 2, weight: 500 });
    if (t > lc.start - 0.3) {
      mono(c, 'GROUND MOVEMENT', W - 520, 760, { size: 13, color: rgba('ash', 0.85), track: 4 });
      mono(c, '0.000 mm', W - 520, 800, { size: 28, color: rgba('bone', 0.95), track: 2, weight: 500 });
    }
    // the lyric: line b (forever stretches while held), then line c, then (v2) the tag
    const st = { family: F.archivo(112.5, 900), size: 80, tracking: -2, sung: rgba('bone', 1), unsung: rgba('bone', 0.18), active: rgba('signal', 1), lead: 0.4 } as const;
    if (t < lc.start - 0.1) {
      const wb = lb.words;
      const sub: Line = { ...lb, words: wb.slice(0, 2), text: `${wb[0]!.w} ${wb[1]!.w}`, end: wb[1]!.end };
      drawKaraoke(c, sub, 104, 170, t, st);
      const mid = wb.slice(2, wb.length - 2);
      const fw = { ...mid[0]!, w: mid.map((x) => x.w).join(' '), end: mid[mid.length - 1]!.end };
      const hold = prog(t, fw.start, fw.end, ease.inOutQuad);
      c.save();
      c.font = font(F.archivo(lerp(112.5, 125, hold), lerp(900, 300, hold)), 80); c.letterSpacing = `${lerp(-2, 30, hold)}px`;
      c.fillStyle = t < fw.start ? rgba('bone', 0.18) : wordColor(fw as Word, t);
      c.fillText(fw.w, 104, 270);
      c.restore();
      const tail = { ...lb, words: wb.slice(-2), text: wb.slice(-2).map((x) => x.w).join(' '), start: wb[wb.length - 2]!.start };
      drawKaraoke(c, tail, 104, 370, t, { ...st, lead: 1.5 });
    } else if (!tag || t < tag.start - 0.15) {
      drawKaraoke(c, lc, 104, 170, t, st);
    } else {
      drawKaraoke(c, tag, 104, 170, t, { ...st, size: 120 });
    }
    drawCounter(c, t, { y: 1000 });
    void daysAt;
    return tag ? pulse(t, tag.words[1]!.start, 0.1) * 0.6 : 0;
  }
}
