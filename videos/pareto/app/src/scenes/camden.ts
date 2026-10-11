// PLATE VIII — "Friday night, transcribed". Night (ink). Four reframings, one per line:
//  1. "Met a girl in Camden, she spoke in a blur": a street at night under an iron railway bridge; the
//     first half of the line is lettered on the bridge girder. HER (filled) pops in under the lamp on
//     "girl"; on "spoke" her words fly out of her and smear into place, italic and streaking; on "blur"
//     the whole frame smears sideways for a beat.
//  2. "Eighty percent of my chat was wasted on her": a transcript column; my ten messages pop in one per
//     8th; on "wasted" eight of them are struck through one per 16th and the 80/20 bar fills (LANDED 20%).
//  3. "But that one little wink, that fifth of a smile": black. One red dot; it winks on "wink". Then a
//     protractor draws in and the dot becomes the pen that draws the smile under "that fifth of a smile"
//     (lettered along the arc); only its last fifth — one corner, 36° — is red.
//  4. "Made the whole Friday night feel well worth the while": the week as a bar chart of worth; FRI
//     shoots up red on "Friday"; the ledger types in; a WORTH IT stamp lands on "worth"; the camera dives
//     into the red FRI bar on the last half-beat.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D } from '../engine/gl';
import { rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import { Lyrics, type Line } from '../engine/lyrics';
import { clamp, ease, frameIdx, hash, lerp, mulberry32, prog, TAU } from '../engine/util';
import { Ground, drawKaraokeWords, drawPlateHead, drawFifthBar, footnote, wrapWords, fg, RED, INK_POST, type C2D } from './_kit';
import { beats, camera, drawArcWords, figure, mono, pulses, steps, typed, wd } from './park-lib';

const BONE = (a = 1) => rgba('bone', a);
const ASH = (a = 1) => rgba('ash', a);
const GRAPH = (a = 1) => rgba('graphite', a);

interface Bldg { x: number; w: number; h: number; floors: number; cols: number; lit: number[]; shop: string; roof: number }

const MSGS = [
  { me: true, s: 'so do you come here often' },
  { me: false, s: 'what?' },
  { me: true, s: 'i like your jacket', keep: true },
  { me: true, s: 'have you heard of pareto' },
  { me: true, s: 'italian economist. 1848' },
  { me: false, s: 'sorry?' },
  { me: true, s: 'the pea thing. you know' },
  { me: true, s: '80% of peas, 20% of pods' },
  { me: true, s: 'anyway' },
  { me: true, s: 'do you like charts' },
  { me: false, s: 'ha' },
  { me: true, s: 'i have one of my records' },
  { me: true, s: 'fancy a drink?', keep: true },
];

export default class Camden extends Scene {
  g = new Ground();
  L = new Layer2D();
  G = new Layer2D(1920, 1080, 0.5); // low-res glow under the crisp reds
  l1!: Line; l2!: Line; l3!: Line; l4!: Line;
  T = {
    c1: 0, c2: 0, c3: 0, c4: 0, girl: 0, camden: 0, spoke: 0, blur: 0, blurEnd: 0,
    pops: [] as number[], wasted: 0, strikes: [] as number[], wink: 0, winkEnd: 0, that2: 0, fifth: 0, smile: 0, smileEnd: 0,
    friday: 0, worth: 0, whileW: 0, dive: 0, beats: [] as number[], downs: [] as number[],
  };
  bl: Bldg[] = [];
  rows2: Line['words'][] = [];

  override init() {
    const ly = this.ctx.lyrics, au = this.ctx.audio, B = beats(au), T = this.T;
    this.l1 = ly.get('Met a girl in Camden');
    this.l2 = ly.get('of my chat was wasted');
    this.l3 = ly.get('one little wink');
    this.l4 = ly.get('Friday night feel');
    T.c1 = this.ctx.start;
    T.c2 = B.near(this.l1.end + 0.05); // cuts on the beat between lines
    T.c3 = B.near(this.l2.end + 0.12);
    T.c4 = (this.l3.end + this.l4.start) / 2; // "smile" runs to the next line: cut between the words
    T.girl = wd(this.l1, 'girl').start;
    T.camden = wd(this.l1, 'camden').start;
    T.spoke = wd(this.l1, 'she').start;
    T.blur = wd(this.l1, 'blur').start;
    T.blurEnd = T.c2;
    const b8 = 60 / au.bpm / 2;
    const p0 = B.after(this.l2.start + 0.05);
    const b16 = b8 / 2;
    // messages pop on a syncopated 16th grid (1, 2, 1, 2 … sixteenths apart)
    T.pops = MSGS.map((_, i) => p0 - b16 + Math.round(i * 1.5) * b16);
    T.wasted = wd(this.l2, 'wasted').start;
    const g16 = (x: number) => { const b = B.before(x); return b + Math.round((x - b) / b16) * b16; };
    const s0 = g16(T.wasted);
    T.strikes = Array.from({ length: 8 }, (_, i) => s0 + i * b16);
    const wk = wd(this.l3, 'wink');
    T.wink = wk.start; T.winkEnd = wk.end;
    T.that2 = wd(this.l3, 'that', 1).start;
    T.fifth = wd(this.l3, 'fifth').start;
    const sm = wd(this.l3, 'smile');
    T.smile = sm.start; T.smileEnd = sm.end;
    T.friday = wd(this.l4, 'friday').start;
    T.worth = wd(this.l4, 'worth').start;
    T.whileW = wd(this.l4, 'while').start;
    T.dive = Math.max(this.l4.end - 0.02, B.before(this.ctx.end - 0.05) + b8 * 0.0);
    T.beats = B.list(this.ctx.start - 0.01, this.ctx.end + 0.01);
    T.downs = au.downbeats.filter((d) => d >= this.ctx.start - 0.01 && d < this.ctx.end);
    // street
    const rnd = mulberry32(81);
    const shops = ['VINTAGE', 'RECORDS', 'BOOTS', 'KEBAB', 'TATTOO', 'MARKET', 'OFF-LICENCE', 'CAFÉ', 'GUITARS', 'BAR'];
    let x = -260;
    let i = 0;
    while (x < 2200) {
      const w = 170 + rnd() * 160, floors = 2 + Math.floor(rnd() * 3), cols = Math.max(2, Math.floor(w / 62));
      const lit: number[] = [];
      for (let k = 0; k < floors * cols; k++) lit.push(rnd() < 0.2 ? 0.25 + rnd() * 0.45 : 0);
      this.bl.push({ x, w, h: 210 + floors * 110 + rnd() * 40, floors, cols, lit, shop: shops[i % shops.length]!, roof: Math.floor(rnd() * 3) });
      x += w + 6; i++;
    }
    this.rows2 = wrapWords(this.l2.words, F.archivo(87.5, 800), 116, 930);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    const t = f.t, T = this.T;
    this.g.render(renderer, out, { paper: 0, vig: 0 });
    const c = this.L.ctx; this.L.clear();
    const gc = this.G.ctx; this.G.clear();
    let post: PostOverrides = { ...INK_POST, bloom: 0.45, bloomThreshold: 0.95 };
    let smear = 0;
    if (t < T.c2) smear = this.s1(c, gc, t);
    else if (t < T.c3) this.s2(c, gc, t);
    else if (t < T.c4) this.s3(c, gc, t);
    else post = { ...post, ...this.s4(c, gc, t) };
    drawPlateHead(c, 8, 'Friday night, transcribed', (t - this.ctx.start) / 0.6, { paper: false, right: this.headRight(t) });

    const tex = this.L.upload();
    if (smear > 0.01) {
      // the blur: the frame smeared sideways (a few offset copies)
      for (let k = 1; k <= 4; k++) comp.draw(renderer, tex, out, { offset: [-0.009 * k * smear, 0], opacity: 0.18 * smear });
      comp.draw(renderer, tex, out, { opacity: 1 - 0.35 * smear });
    } else comp.draw(renderer, tex, out);
    const gt = t >= T.c4 ? 0.35 : 1.0; // the FRI bar is big: keep its glow modest
    if (t >= T.c3) comp.draw(renderer, this.G.upload(), out, { mode: 'add', tint: [gt, gt, gt] });
    return post;
  }

  headRight(t: number) {
    const T = this.T;
    if (t < T.c2) return 'FIG. 1 — LOCATION';
    if (t < T.c3) return 'FIG. 2 — TRANSCRIPT';
    if (t < T.c4) return 'FIG. 3 — THE VITAL FEW';
    return 'FIG. 4 — RETURN ON FRIDAY';
  }

  // ---------------------------------------------------------------- 1. the street
  s1(c: C2D, gc: C2D, t: number) {
    const T = this.T, l = this.l1;
    const t0 = T.c1;
    // camera: fresh-plate settle, then a small sideways step on every downbeat
    const z = 1 + 0.08 * (1 - ease.outExpo(prog(t, t0, t0 + 0.55))) + 0.04 * ease.outExpo(prog(t, T.spoke, T.spoke + 0.5));
    const px = steps(t, T.downs, 0.45) * 26;
    const shake = smearAt(t, T.blur, T.blurEnd);
    c.save();
    camera(c, 960 + px + shake * 30 * Math.sin(frameIdx(t) * 2.1), 540, z);
    // parallax: buildings move less than the bridge
    c.save(); c.translate(-px * 0.6, 0);
    this.street(c, t);
    c.restore();
    // lamp + light cone
    const lx = 1330, ground = 930;
    const cone = c.createLinearGradient(0, 560, 0, ground);
    cone.addColorStop(0, BONE(0.16)); cone.addColorStop(1, BONE(0.03));
    c.fillStyle = cone;
    c.beginPath(); c.moveTo(lx - 22, 572); c.lineTo(lx + 22, 572); c.lineTo(lx + 230, ground); c.lineTo(lx - 230, ground); c.closePath(); c.fill();
    c.strokeStyle = BONE(0.8); c.lineWidth = 2;
    c.beginPath(); c.moveTo(lx, ground); c.lineTo(lx, 560); c.lineTo(lx + 0, 560); c.stroke();
    c.fillStyle = BONE(0.95); c.beginPath(); c.roundRect(lx - 24, 548, 48, 18, 6); c.fill();
    c.fillStyle = BONE(0.12); c.beginPath(); c.ellipse(lx, ground + 4, 240, 16, 0, 0, TAU); c.fill();
    // figures
    const me = ease.outBack(prog(t, t0 + 0.05, t0 + 0.4));
    figure(c, 1200, ground, 230 * me, { fill: BONE(0.95), legs: true });
    const her = ease.outBack(prog(t, T.girl - 0.05, T.girl + 0.3));
    if (her > 0) figure(c, 1460, ground, 220 * her, { fill: ASH(1), legs: true });
    // labels
    const lk = prog(t, T.girl + 0.1, T.girl + 0.6);
    if (lk > 0) {
      c.strokeStyle = BONE(0.5); c.lineWidth = 1;
      c.beginPath(); c.moveTo(1482, 712); c.lineTo(1560, 650); c.lineTo(1700, 650); c.stroke();
      mono(c, typed('SUBJECT B', lk), 1566, 642, 14, BONE(0.85), 'left', 'Plex-600');
      mono(c, typed('SPEECH: FAST', prog(t, T.spoke, T.spoke + 0.4)), 1566, 672, 13, ASH(0.9));
      mono(c, typed('INTELLIGIBLE: 20%', prog(t, T.spoke + 0.3, T.spoke + 0.7)), 1566, 692, 13, RED());
      c.beginPath(); c.moveTo(1180, 716); c.lineTo(1100, 680); c.lineTo(980, 680); c.stroke();
      mono(c, typed('SUBJECT A (ME)', lk), 1092, 672, 14, BONE(0.85), 'right', 'Plex-600');
    }
    // her speech: an oscillograph squiggle from her head
    const sk = prog(t, T.spoke - 0.05, T.spoke + 0.4) * (1 - prog(t, T.blurEnd - 0.2, T.blurEnd));
    if (sk > 0) {
      c.strokeStyle = BONE(0.45 * sk); c.lineWidth = 1.2;
      c.beginPath();
      for (let k = 0; k <= 80; k++) {
        const u = k / 80, xx = 1440 - u * 420 * sk, amp = 22 * Math.sin(u * Math.PI) * (0.5 + 0.5 * hash(k, frameIdx(t) >> 2));
        const yy = 700 + Math.sin(u * 60 + t * 40) * amp;
        k ? c.lineTo(xx, yy) : c.moveTo(xx, yy);
      }
      c.stroke();
    }
    // the bridge with the first half of the line lettered on its girder
    this.bridge(c, t, px);
    c.restore();

    // second half: her words, flying out of her and smearing into place (screen-ish space, same camera)
    c.save();
    camera(c, 960 + px * 0.4, 540, z);
    const fam = F.archivoItalic(100, 800), size = 92;
    const half2 = l.words.slice(l.words.findIndex((w) => w.start >= T.spoke - 0.01));
    c.font = font(fam, size);
    const sp = c.measureText(' ').width;
    const widths = half2.map((w) => c.measureText(w.w).width);
    const total = widths.reduce((a, b) => a + b, 0) + sp * (half2.length - 1);
    let x = 1070 - total;
    const by = 640;
    half2.forEach((w, i) => {
      const k = ease.outExpo(prog(t, w.start - 0.06, w.start + 0.32));
      const hx = 1440, hy = 690;
      const wx = lerp(hx, x, k), wy = lerp(hy, by, k);
      const isBlur = i === half2.length - 1;
      const p = Lyrics.wordProgress(w, t);
      const col = isBlur ? RED() : BONE();
      // streak copies trailing back toward her
      const trail = (1 - k) * 1 + (isBlur ? 0.55 + 0.25 * Math.sin(t * 30) : 0) * prog(t, w.start, w.start + 0.2);
      if (t >= w.start - 0.4) {
        c.font = font(fam, size);
        if (t < w.start - 0.06) {
          c.globalAlpha = 0.22; c.fillStyle = BONE(); c.fillText(w.w, x, by);
        } else {
          for (let s = 6; s >= 1; s--) {
            c.globalAlpha = 0.11 * trail * (1 - s / 7);
            c.fillStyle = col;
            c.fillText(w.w, wx + s * 26 * trail, wy);
          }
          c.globalAlpha = lerp(0.35, 1, clamp(p * 1.5 + k * 0.3));
          c.fillStyle = p > 0 ? col : BONE();
          c.fillText(w.w, wx, wy);
        }
        c.globalAlpha = 1;
      }
      x += widths[i]! + sp;
    });
    c.restore();
    footnote(c, '¹ Location: Camden, NW1. Time: Friday, 23:40. Visibility: one streetlamp’s worth.', 96, 1016, { paper: false, a: prog(t, t0 + 0.3, t0 + 1) });
    return smearAt(t, T.blur, T.blurEnd);
  }

  street(c: C2D, t: number) {
    const ground = 930;
    c.lineWidth = 1;
    for (const b of this.bl) {
      const top = ground - b.h;
      c.fillStyle = rgba('ink2', 0.9); c.fillRect(b.x, top, b.w, b.h);
      c.strokeStyle = GRAPH(0.9);
      c.strokeRect(b.x + 0.5, top + 0.5, b.w - 1, b.h - 1);
      // cornice / roof
      c.beginPath();
      c.moveTo(b.x - 4, top + 10); c.lineTo(b.x + b.w + 4, top + 10);
      if (b.roof === 1) { c.moveTo(b.x + b.w * 0.2, top); c.lineTo(b.x + b.w * 0.2, top - 26); c.lineTo(b.x + b.w * 0.32, top - 26); c.lineTo(b.x + b.w * 0.32, top); }
      c.stroke();
      // windows
      const shopH = 150;
      const fh = (b.h - shopH - 30) / b.floors;
      const ww = (b.w - 30) / b.cols;
      for (let f = 0; f < b.floors; f++) for (let k = 0; k < b.cols; k++) {
        const wx = b.x + 15 + k * ww + ww * 0.2, wy = top + 26 + f * fh + fh * 0.15, w = ww * 0.6, h = fh * 0.62;
        const lit = b.lit[f * b.cols + k]!;
        if (lit > 0) {
          const fl = 1 - 0.15 * (hash(f, k, Math.floor(t * 2)) > 0.93 ? 1 : 0);
          c.fillStyle = BONE(lit * 0.55 * fl); c.fillRect(wx, wy, w, h);
        }
        c.strokeStyle = GRAPH(0.95); c.strokeRect(wx + 0.5, wy + 0.5, w, h);
        c.beginPath(); c.moveTo(wx, wy + h / 2); c.lineTo(wx + w, wy + h / 2); c.stroke();
      }
      // shopfront: fascia with a generic trade name, window, door
      const fy = ground - shopH;
      c.strokeStyle = ASH(0.55);
      c.strokeRect(b.x + 8.5, fy + 0.5, b.w - 17, 30);
      c.font = font(F.mono(600), 13); c.fillStyle = ASH(0.75); c.textAlign = 'center';
      c.fillText(b.shop, b.x + b.w / 2, fy + 20);
      c.textAlign = 'left';
      c.strokeStyle = GRAPH(0.95);
      c.strokeRect(b.x + 14.5, fy + 44.5, b.w * 0.58, shopH - 50);
      c.strokeRect(b.x + b.w * 0.7 + 0.5, fy + 44.5, b.w * 0.22, shopH - 44);
    }
    // kerb
    c.strokeStyle = ASH(0.6); c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(-400, ground + 0.5); c.lineTo(2400, ground + 0.5); c.moveTo(-400, ground + 40.5); c.lineTo(2400, ground + 40.5); c.stroke();
    c.setLineDash([30, 26]); c.strokeStyle = GRAPH(0.8);
    c.beginPath(); c.moveTo(-400, ground + 110); c.lineTo(2400, ground + 110); c.stroke();
    c.setLineDash([]);
  }

  bridge(c: C2D, t: number, px: number) {
    const T = this.T, l = this.l1;
    const y0 = 196, h = 190;
    c.fillStyle = rgba('ink'); c.fillRect(-300, y0, 2520, h);
    // piers
    c.fillRect(40, y0 + h, 70, 930 - y0 - h); c.fillRect(1810, y0 + h, 70, 930 - y0 - h);
    c.strokeStyle = BONE(0.75); c.lineWidth = 1.4;
    c.strokeRect(40.5, y0 + h, 70, 930 - y0 - h); c.strokeRect(1810.5, y0 + h, 70, 930 - y0 - h);
    c.beginPath();
    c.moveTo(-300, y0 + 0.5); c.lineTo(2220, y0 + 0.5);
    c.moveTo(-300, y0 + 18.5); c.lineTo(2220, y0 + 18.5);
    c.moveTo(-300, y0 + h - 18.5); c.lineTo(2220, y0 + h - 18.5);
    c.moveTo(-300, y0 + h - 0.5); c.lineTo(2220, y0 + h - 0.5);
    c.stroke();
    c.strokeStyle = BONE(0.25); c.lineWidth = 1;
    c.beginPath();
    for (let x = -280; x < 2220; x += 168) { c.moveTo(x, y0 + 18); c.lineTo(x, y0 + h - 18); }
    c.stroke();
    // rivets
    c.fillStyle = BONE(0.45);
    for (let x = -290; x < 2220; x += 24) {
      c.beginPath(); c.arc(x, y0 + 9, 2, 0, TAU); c.arc(x, y0 + h - 9, 2, 0, TAU); c.fill();
    }
    // the lettering: first half of the line
    const half1 = l.words.filter((w) => w.start < T.spoke - 0.01);
    drawKaraokeWords(c, half1, t, 960 + px * 0.0, y0 + 136, { family: F.archivo(100, 900), size: 118, paper: false, align: 'center', dim: 0.2, lead: 0.4, tracking: 2 });
    // pier plate
    const pk = prog(t, T.camden + 0.1, T.camden + 0.5);
    if (pk > 0) {
      c.fillStyle = BONE(0.92); c.fillRect(1818, 470, 54, 30 * ease.outExpo(pk));
      if (pk > 0.6) mono(c, 'NW1', 1845, 491, 14, rgba('ink'), 'center', 'Plex-700');
    }
  }

  // ---------------------------------------------------------------- 2. the transcript
  s2(c: C2D, gc: C2D, t: number) {
    const T = this.T;
    const t0 = T.c2;
    const z = 1 + 0.05 * (1 - ease.outExpo(prog(t, t0, t0 + 0.5))) + 0.012 * steps(t, T.downs.filter((d) => d > t0), 0.3);
    c.save();
    camera(c, 960, 540, z, -0.006);
    // lyric, left
    const fam = F.archivo(87.5, 800), size = 116;
    let y = 330;
    for (const row of this.rows2) {
      const boxes = drawKaraokeWords(c, row, t, 130, y, { family: fam, size, paper: false, dim: 0.22, lead: row[0]!.start - this.l2.start + 0.4 });
      // a hairline strike through "wasted" once it is sung
      for (const b of boxes) {
        if (b.w.w.toLowerCase().startsWith('wasted') && b.p > 0) {
          c.strokeStyle = BONE(0.85); c.lineWidth = 3;
          c.beginPath(); c.moveTo(b.x - 6, y - size * 0.3); c.lineTo(b.x - 6 + (b.width + 12) * ease.outCubic(b.p), y - size * 0.3); c.stroke();
        }
      }
      y += size * 1.08;
    }
    // the 80/20 bar under it
    const fk = prog(t, T.strikes[0]!, T.strikes[7]! + 0.25);
    const by = y + 20;
    drawFifthBar(c, 130, by, 870, 18, { paper: false, fill: ease.outExpo(prog(t, T.pops[0]!, T.wasted)), split: fk, labels: false });
    mono(c, 'WASTED 80%', 130, by + 50, 16, ASH(0.9 * clamp(fk * 3)), 'left', 'Plex-600');
    mono(c, 'LANDED 20%', 1000, by + 50, 16, RED(clamp(fk * 3)), 'right', 'Plex-600');
    const nStruck = T.strikes.filter((s) => t >= s).length;
    const nSent = T.pops.filter((p, i) => t >= p && MSGS[i]!.me).length;
    mono(c, `SENT ${String(nSent).padStart(2, '0')} · STRUCK ${String(nStruck).padStart(2, '0')} · KEPT ${nStruck === 8 ? '02' : '—'}`, 130, by + 90, 15, BONE(0.7));
    // transcript column
    const X0 = 1130, X1 = 1810, Y0 = 130, Y1 = 960;
    c.fillStyle = rgba('ink2'); c.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
    c.strokeStyle = GRAPH(1); c.lineWidth = 1; c.strokeRect(X0 + 0.5, Y0 + 0.5, X1 - X0 - 1, Y1 - Y0 - 1);
    mono(c, 'TRANSCRIPT · FRI 23:41–00:12', X0 + 20, Y0 + 30, 14, ASH(0.9), 'left', 'Plex-600');
    mono(c, 'A → B', X1 - 20, Y0 + 30, 14, ASH(0.9), 'right', 'Plex-600');
    c.beginPath(); c.moveTo(X0, Y0 + 46.5); c.lineTo(X1, Y0 + 46.5); c.stroke();
    c.save();
    c.beginPath(); c.rect(X0, Y0 + 47, X1 - X0, Y1 - Y0 - 47); c.clip();
    // layout bubbles; scroll so the newest sits above the bottom
    const bh = 46, gap = 12;
    const shown = T.pops.map((p) => ease.outBack(prog(t, p, p + 0.22)));
    let n = 0; for (const s of shown) if (s > 0) n++;
    const contentH = (bh + gap) * MSGS.length;
    const scrollMax = Math.max(0, contentH - (Y1 - Y0 - 80));
    let scroll = 0;
    for (let i = 0; i < MSGS.length; i++) {
      const k = ease.outExpo(prog(t, T.pops[i]!, T.pops[i]! + 0.3));
      const yb = Y0 + 70 + (bh + gap) * (i + 1);
      if (yb > Y1 - 20) scroll = Math.max(scroll, (yb - (Y1 - 20)) * k);
    }
    scroll = Math.min(scroll, scrollMax);
    let si = 0;
    c.font = font(F.mono(500), 19);
    MSGS.forEach((m, i) => {
      const s = shown[i]!;
      if (s <= 0) return;
      const yb = Y0 + 70 + (bh + gap) * i - scroll;
      c.font = font(F.mono(500), 19);
      const tw = c.measureText(m.s).width + 36;
      const xb = m.me ? X1 - 24 - tw : X0 + 24;
      const struck = m.me && !m.keep ? T.strikes[si++] : undefined;
      const sk = struck !== undefined ? prog(t, struck, struck + 0.12) : 0;
      c.save();
      const ax = m.me ? xb + tw : xb, ay = yb + bh / 2;
      c.translate(ax, ay); c.scale(s, s); c.translate(-ax, -ay);
      c.beginPath(); c.roundRect(xb, yb, tw, bh, 14);
      if (m.me) {
        c.fillStyle = sk > 0 ? lerpCol(sk) : BONE(0.95); c.fill();
        c.fillStyle = sk > 0.5 ? ASH(0.8) : rgba('ink');
      } else {
        c.strokeStyle = ASH(0.6); c.lineWidth = 1.2; c.stroke();
        c.fillStyle = ASH(0.85);
      }
      c.font = font(F.mono(500), 19); c.textAlign = 'left';
      c.fillText(m.s, xb + 18, yb + 30);
      if (sk > 0) {
        c.strokeStyle = BONE(0.9); c.lineWidth = 2;
        c.beginPath(); c.moveTo(xb - 10, ay); c.lineTo(xb - 10 + (tw + 20) * ease.outExpo(sk), ay); c.stroke();
      }
      c.restore();
      if (m.keep && t > T.strikes[7]! + 0.1) {
        mono(c, '✓✓ READ', xb - 12, yb + 30, 13, RED(prog(t, T.strikes[7]! + 0.1, T.strikes[7]! + 0.3)), 'right', 'Plex-600');
      }
    });
    c.restore();
    c.restore();
    footnote(c, '¹ Messages from A. B’s replies reproduced in full.', 96, 1016, { paper: false, a: prog(t, t0 + 0.3, t0 + 1) });
  }

  // ---------------------------------------------------------------- 3. the wink, the fifth of a smile
  s3(c: C2D, gc: C2D, t: number) {
    const T = this.T, l = this.l3;
    const t0 = T.c3;
    const C = { x: 960, y: 290 }, R = 450;
    const z = 1 + 0.04 * (1 - ease.outExpo(prog(t, t0, t0 + 0.6))) + 0.03 * ease.outExpo(prog(t, T.that2 - 0.2, T.that2 + 0.4));
    c.save(); camera(c, 960, 540, z);
    gc.save(); camera(gc, 960, 540, z);
    const half1 = l.words.filter((w) => w.start < T.that2 - 0.01);
    const half2 = l.words.filter((w) => w.start >= T.that2 - 0.01);
    // the dot: at rest, winks, then moves to the pen position
    const moveK = ease.inOutCubic(prog(t, T.that2 - 0.35, T.that2 + 0.05));
    const penP = (u: number) => ({ x: C.x + Math.cos(Math.PI * (1 - u)) * R, y: C.y + Math.sin(Math.PI * (1 - u)) * R });
    // arc progress follows the karaoke of the second half
    const ws = half2;
    const a0 = ws[0]!.start, a1 = T.smileEnd;
    const arcU = clamp(ease.inOutQuad(prog(t, a0, a1)));
    const pen = penP(arcU);
    const rest = { x: 960, y: 470 };
    const dot = { x: lerp(rest.x, pen.x, moveK), y: lerp(rest.y, pen.y, moveK) };
    const wi = prog(t, T.wink, T.wink + 0.32);
    const sy = wi > 0 && wi < 1 ? 1 - 0.92 * Math.sin(Math.PI * wi) : 1;
    const din = ease.outBack(prog(t, t0, t0 + 0.35));
    const flare = pulses(t, [T.wink + 0.16], 0.18);
    const dr = (16 + 6 * flare) * din * (1 - 0.45 * moveK);
    for (const q of [c, gc]) {
      q.fillStyle = RED();
      q.beginPath(); q.ellipse(dot.x, dot.y, dr, dr * sy, 0, 0, TAU); q.fill();
      if (flare > 0.02) { q.strokeStyle = RED(flare); q.lineWidth = 2; q.beginPath(); q.arc(dot.x, dot.y, dr + 60 * (1 - flare), 0, TAU); q.stroke(); }
    }
    // first half under the dot, then up as a caption
    const capK = ease.inOutCubic(prog(t, T.that2 - 0.5, T.that2 - 0.05));
    c.save();
    const y1 = lerp(640, 150, capK), s1 = lerp(1, 0.62, capK);
    c.translate(960, y1); c.scale(s1, s1);
    drawKaraokeWords(c, half1, t, 0, 0, { family: F.archivo(100, 800), size: 104, paper: false, align: 'center', dim: 0.2, lead: 0.4 });
    c.restore();
    // wink annotation
    const ak = prog(t, T.winkEnd + 0.05, T.winkEnd + 0.5) * (1 - capK);
    if (ak > 0) {
      c.strokeStyle = BONE(0.45 * ak); c.lineWidth = 1;
      c.beginPath(); c.moveTo(dot.x + 30, dot.y - 10); c.lineTo(1130, 400); c.lineTo(1330, 400); c.stroke();
      mono(c, typed('EVENT 001 — WINK (×1)', ak), 1138, 392, 14, BONE(0.85), 'left', 'Plex-600');
      mono(c, typed(`DURATION ${(T.winkEnd - T.wink).toFixed(2)} s · SIGNAL 100%`, ak), 1138, 420, 13, RED());
    }
    // protractor
    const pk = ease.outCubic(prog(t, T.that2 - 0.3, T.that2 + 0.5));
    if (pk > 0) {
      c.strokeStyle = BONE(0.3); c.lineWidth = 1;
      // a protractor: straight edge + the scale ring (lower half only)
      c.beginPath(); c.moveTo(C.x - (R + 60) * pk, C.y); c.lineTo(C.x + (R + 60) * pk, C.y); c.stroke();
      c.strokeStyle = BONE(0.18);
      c.beginPath(); c.arc(C.x, C.y, R + 46, 0, Math.PI * pk); c.stroke();
      for (let d = 0; d <= 180; d += 5) {
        if (d / 180 > pk) break;
        const a = (d / 180) * Math.PI, len = d % 30 === 0 ? 18 : d % 10 === 0 ? 11 : 6;
        c.strokeStyle = BONE(d % 30 === 0 ? 0.5 : 0.25);
        c.beginPath(); c.moveTo(C.x + Math.cos(a) * (R + 46), C.y + Math.sin(a) * (R + 46)); c.lineTo(C.x + Math.cos(a) * (R + 46 - len), C.y + Math.sin(a) * (R + 46 - len)); c.stroke();
        if (d % 30 === 0) mono(c, `${180 - d}°`, C.x + Math.cos(a) * (R + 72), C.y + Math.sin(a) * (R + 72) + 5, 12, BONE(0.45), 'center');
      }
      // centre mark on the straight edge
      c.strokeStyle = BONE(0.4);
      c.beginPath(); c.moveTo(C.x, C.y); c.lineTo(C.x, C.y - 12); c.stroke();
    }
    // the smile: 4/5 bone, the last fifth (36°, one corner) red
    if (arcU > 0) {
      const aEnd = Math.PI * (1 - arcU);
      const aRed = Math.PI * 0.2;
      c.strokeStyle = BONE(0.9); c.lineWidth = 4; c.lineCap = 'round';
      c.beginPath(); c.arc(C.x, C.y, R, Math.PI, Math.max(aEnd, aRed), true); c.stroke();
      if (aEnd < aRed) {
        for (const q of [c, gc]) {
          q.strokeStyle = RED(); q.lineWidth = 6; q.lineCap = 'round';
          q.beginPath(); q.arc(C.x, C.y, R, aRed, aEnd, true); q.stroke();
        }
      }
    }
    // the second half lettered along the inside of the arc
    if (t > T.that2 - 0.45) drawArcWords(c, half2, t, C.x, C.y, R - 16, Math.PI / 2 + 0.1, { family: F.archivo(100, 800), size: 84, paper: false, dim: 0.2, lead: 0.4 });
    // dimension for the red corner
    const dk = prog(t, T.smile - 0.05, T.smile + 0.4);
    if (dk > 0) {
      const rr = R + 18;
      c.strokeStyle = RED(dk); c.lineWidth = 1.2;
      c.beginPath(); c.arc(C.x, C.y, rr, Math.PI * 0.2, Math.PI * 0.2 * (1 - ease.outCubic(dk)), true); c.stroke();
      for (const a of [0, Math.PI * 0.2]) { c.beginPath(); c.moveTo(C.x + Math.cos(a) * (rr - 6), C.y + Math.sin(a) * (rr - 6)); c.lineTo(C.x + Math.cos(a) * (rr + 6), C.y + Math.sin(a) * (rr + 6)); c.stroke(); }
      mono(c, typed('144–180°: ⅕ OF A SMILE', dk), 1440, 640, 15, RED(), 'left', 'Plex-600');
      mono(c, typed('(ONE CORNER, 36°)', prog(t, T.smile + 0.2, T.smile + 0.5)), 1440, 662, 13, RED(0.8), 'left', 'Plex-500');
      mono(c, typed('0–144°: POLITE', dk), 400, 640, 15, BONE(0.6), 'right', 'Plex-500');
    }
    c.restore(); gc.restore();
  }

  // ---------------------------------------------------------------- 4. the week, by worth
  s4(c: C2D, gc: C2D, t: number): PostOverrides {
    const T = this.T, l = this.l4;
    const t0 = T.c4;
    const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
    const vals = [0.05, 0.03, 0.05, 0.04, 1, 0.06, 0.02]; // FRI = 80% of the week's worth
    const X0 = 200, X1 = 1720, base = 880, top = 470;
    const cw = (X1 - X0) / 7;
    const fx = X0 + 4 * cw + cw / 2;
    // dive into the red FRI bar after the last word
    const dv = ease.inCubic(prog(t, T.dive, this.ctx.end));
    const zd = Math.exp(lerp(0, Math.log(17), dv));
    const z = (1 + 0.05 * (1 - ease.outExpo(prog(t, t0, t0 + 0.5)))) * (1 + 0.03 * ease.outExpo(prog(t, T.friday, T.friday + 0.4))) * zd;
    const cx = lerp(960, fx, Math.min(1, dv * 1.6)), cy = lerp(540, 700, Math.min(1, dv * 1.6));
    c.save(); camera(c, cx, cy, z);
    gc.save(); camera(gc, cx, cy, z);
    // lyric, two rows
    const rows = wrapWords(l.words, F.archivo(100, 800), 100, 1500);
    let y = 230;
    for (const row of rows) { drawKaraokeWords(c, row, t, 200, y, { family: F.archivo(100, 800), size: 100, paper: false, dim: 0.2, lead: row[0]!.start - l.start + 0.4 }); y += 112; }
    // axis
    c.strokeStyle = BONE(0.6); c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(X0, base + 0.5); c.lineTo(X1, base + 0.5); c.stroke();
    mono(c, 'WORTH, BY DAY (n = 1 WEEK)', X0, top - 10, 14, ASH(0.9), 'left', 'Plex-600');
    for (let i = 0; i < 7; i++) {
      const x = X0 + i * cw;
      const k = i === 4 ? ease.outExpo(prog(t, T.friday, T.friday + 0.45)) : ease.outExpo(prog(t, t0 + 0.1 + i * 0.06, t0 + 0.5 + i * 0.06));
      const v = (i === 4 ? lerp(0.08, 1, k) : vals[i]! * k) * (base - top - 40);
      if (i === 4) for (const q of [c, gc]) { q.fillStyle = RED(); q.fillRect(x + cw * 0.2, base - v, cw * 0.6, v); }
      else { c.fillStyle = GRAPH(1); c.fillRect(x + cw * 0.2, base - v, cw * 0.6, v); }
      const on = i === 4 && k > 0.05;
      mono(c, days[i]!, x + cw / 2, base + 34, 18, on ? RED() : BONE(0.7), 'center', 'Plex-600');
      if (i !== 4) mono(c, `${(vals[i]! * 100 / 1.25).toFixed(1)}%`, x + cw / 2, base - v - 12, 12, ASH(0.8 * k), 'center');
    }
    // FRI annotation + ledger
    const ak = prog(t, T.friday + 0.4, T.friday + 0.9);
    if (ak > 0) {
      mono(c, typed('80.0% OF THE WEEK’S WORTH', ak), fx + cw * 0.4, top + 70, 15, RED(), 'left', 'Plex-600');
      const led = [
        ['CHAT, WASTED', '80%'],
        ['WINKS RECEIVED', '1'],
        ['SMILE (FRACTION)', '1/5'],
      ];
      led.forEach((r, i) => {
        const k = prog(t, T.friday + 0.7 + i * 0.31, T.friday + 1.0 + i * 0.31);
        if (k <= 0) return;
        const yy = top + 120 + i * 28;
        mono(c, typed(r[0]!, k), fx + cw * 0.4, yy, 14, BONE(0.75));
        c.strokeStyle = BONE(0.25); c.setLineDash([2, 4]);
        c.beginPath(); c.moveTo(fx + cw * 0.4 + 170, yy - 4); c.lineTo(fx + cw * 0.4 + 300 * k, yy - 4); c.stroke(); c.setLineDash([]);
        mono(c, r[1]!, fx + cw * 0.4 + 340, yy, 14, BONE(0.9 * k), 'right', 'Plex-600');
      });
    }
    // the stamp
    const sk = prog(t, T.worth - 0.02, T.worth + 0.18);
    if (sk > 0) {
      const sc = lerp(1.8, 1, ease.outCubic(sk));
      c.save();
      c.translate(fx - cw * 1.6, top + 210); c.rotate(-0.12); c.scale(sc, sc);
      c.globalAlpha = clamp(sk * 2);
      c.strokeStyle = RED(); c.lineWidth = 4;
      c.beginPath(); c.roundRect(-200, -48, 400, 96, 10); c.stroke();
      c.lineWidth = 1.5; c.beginPath(); c.roundRect(-190, -38, 380, 76, 6); c.stroke();
      c.font = font(F.archivo(112.5, 900), 44); c.fillStyle = RED(); c.textAlign = 'center';
      c.fillText('WORTH IT', -38, 16);
      // check mark drawn on "while"
      const ck = ease.outCubic(prog(t, T.whileW, T.whileW + 0.3));
      if (ck > 0) {
        c.lineWidth = 6; c.lineCap = 'round'; c.lineJoin = 'round';
        c.beginPath();
        const P0 = [122, 0], P1 = [140, 20], P2 = [172, -24];
        c.moveTo(P0[0]!, P0[1]!);
        const L1 = Math.hypot(18, 20), L2 = Math.hypot(32, 44), Lt = L1 + L2, d = ck * Lt;
        if (d <= L1) c.lineTo(lerp(P0[0]!, P1[0]!, d / L1), lerp(P0[1]!, P1[1]!, d / L1));
        else { c.lineTo(P1[0]!, P1[1]!); c.lineTo(lerp(P1[0]!, P2[0]!, (d - L1) / L2), lerp(P1[1]!, P2[1]!, (d - L1) / L2)); }
        c.stroke();
      }
      c.restore();
    }
    c.restore(); gc.restore();
    footnote(c, '¹ Return on Friday computed after the fact. Saturday morning excluded on medical grounds.', 96, 1016, { paper: false, a: prog(t, t0 + 0.3, t0 + 1) * (1 - dv) });
    return { shake: [0, 0] };
  }
}

function smearAt(t: number, t0: number, t1: number) {
  return ease.outCubic(prog(t, t0 - 0.02, t0 + 0.12)) * (1 - ease.inCubic(prog(t, t1 - 0.25, t1)));
}
function lerpCol(k: number) {
  // bone → graphite as a message is struck
  const a = [241, 235, 221], b = [94, 91, 87];
  const m = (i: number) => Math.round(lerp(a[i]!, b[i]!, clamp(k)));
  return `rgba(${m(0)},${m(1)},${m(2)},0.95)`;
}
void fg;
