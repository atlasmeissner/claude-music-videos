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
import { cachedLayout, drawKaraoke, mono, poseKeys, runPose, wordColor, type Pose } from './_ff';
import { applyCam, breath, camKeys, daysAt, drawCounter, drawWorld, person, S, SP, type Cam } from './_story';
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
    const pose = u < 0.35 ? SP.leap : SP.star;
    person(c, px, py + S * 0.5, S, pose, { rot: 0.3 * Math.sin(u * 1.3) });
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
    let px: number, pose: Pose;
    if (t < tFreeze) { const k = prog(t, t0 - 0.05, tFreeze, ease.inQuad); px = lerp(-520, -26, k); pose = runPose(f.beat, 0.35); }
    else { px = -26; pose = { ...SP.freeze, a1: SP.freeze.a1 + Math.sin(t * 18) * 0.9, b1: SP.freeze.b1 + Math.sin(t * 18 + 1.5) * 0.9, a2: SP.freeze.a2 + Math.sin(t * 18) * 0.9, b2: SP.freeze.b2 + Math.sin(t * 18 + 1.5) * 0.9 }; }
    person(c, px, 0, S, pose);
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
    let x: number, y: number, rot = Math.PI / 2, pose: Pose = SP.cheer;
    const base = 520 * scale + oy;
    if (t < tWall) {
      const k = prog(t, this.tA - 0.1, tWall, (q) => q * q * (3 - 2 * q) * 0.4 + q * 0.6);
      x = lerp(-200 * scale + ox, WX - 140 * scale, k); y = base + Math.sin(t * 3) * 18 * scale;
    } else {
      const u = t - tWall;
      x = WX - 140 * scale - 520 * scale * (1 - Math.exp(-u * 2.5)); y = base + 260 * scale * (1 - Math.exp(-u * 2)) * Math.min(1, u * 2);
      rot = Math.PI / 2 - u * 7; pose = SP.tuck;
    }
    // speed lines behind the flier
    if (t < tWall) for (let i = 0; i < 9; i++) {
      const ly = y + (i - 4) * 16 * scale, len = (120 + 160 * hash(i, 3)) * scale;
      c.strokeStyle = rgba('bone', 0.35); c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(x - 80 * scale - len, ly); c.lineTo(x - 80 * scale, ly); c.stroke();
    }
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
    person(c, x, y + S * 0.5 * scale, S * scale, pose, { rot });
    // stars of the bonk
    if (t > tWall && t < tWall + 0.8) for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + t * 4, r = 60 * scale * (1 + (t - tWall));
      c.fillStyle = rgba('signal', 1 - (t - tWall) / 0.8);
      c.beginPath(); c.arc(WX - 30 * scale + Math.cos(a) * r, base + Math.sin(a) * r * 0.6, 5 * scale, 0, TAU); c.fill();
    }
    if (scale === 1) {
      stamp(c, 1180, 860, ['DAMAGE:', 'ONE (1) BRUISE'], t, tWall + 0.25, { size: 26, rot: -0.1 });
      drawKaraoke(c, this.la, 104, 170, t, { family: F.archivo(112.5, 900), size: 80, tracking: -2, sung: rgba('bone', 1), unsung: rgba('bone', 0.18), active: rgba('signal', 1), lead: 0.4 });
      mono(c, 'A DAYDREAM', W - 104, 96, { size: 13, color: rgba('ash', 0.75), track: 6, align: 'right' });
    }
    return pulse(t, tWall, 0.08) * 1.3;
  }

  // ---------------------------------------------------------------- v2 A: the same flight, in a thought bubble over the frozen person
  bubble(c: CanvasRenderingContext2D, t: number, f: Frame) {
    const cam: Cam = { x: 380, y: 0, z: 1.0 };
    c.save(); applyCam(c, cam);
    drawWorld(c, cam, { t, fear: 1, door: 0.2, glow: 1.2, stars: 1 });
    person(c, -26, 0, S, breath(SP.freeze, t, 1.5));
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
    const grey = v2 ? prog(t, t0, lc.start + 1.0) * (tag ? 1 - prog(t, tag.words[1]!.start, tag.words[1]!.start + 0.5) : 1) : 1;
    const cam: Cam = camKeys(t, [[t0, { x: v2 ? -40 : -120, y: -140, z: 1.25 }], [end, { x: v2 ? -60 : -160, y: -160, z: 1.45 }]]);
    c.save(); applyCam(c, cam);
    drawWorld(c, cam, { t, fear: 0.6, door: 0.2, glow: 1.0, dawn: day * 0.85, stars: 1 - day });
    // the figure: colour fades to graphite (the statue); dust settles on head and shoulders; v2's tag: steps back, sits
    const col = `rgba(${lerp(238, 94, grey).toFixed(0)},${lerp(233, 91, grey).toFixed(0)},${lerp(223, 87, grey).toFixed(0)},1)`;
    let px = v2 ? -26 : -120, pose: Pose = SP.statue, sitting = false;
    if (v2) pose = poseKeys(t, [[0, SP.freeze], [t0 + 0.8, SP.statue]], 0.6);
    if (tag && t > tag.words[1]!.start) {
      const k = prog(t, tag.words[1]!.start, tag.words[1]!.start + 0.9, ease.inOutCubic);
      px = lerp(-26, -170, k);
      pose = poseKeys(t, [[0, SP.statue], [tag.words[1]!.start + 0.5, SP.stand], [tag.words[1]!.start + 1.1, SP.hunch]], 0.4);
      sitting = t > tag.words[1]!.start + 0.8;
    }
    const head = person(c, px, 0, S, pose, { color: col, sitting });
    // dust and a cobweb from the shoulder to the ground
    const dust = clamp(u / 6) * (1 - (tag && t > tag.words[1]!.start ? 1 : 0));
    for (let i = 0; i < 40 * dust; i++) {
      c.fillStyle = rgba('ash', 0.7);
      c.fillRect(head.x - 22 + hash(i, 1) * 44, head.y - 21 - hash(i, 2) * 3, 2.2, 2.2);
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
