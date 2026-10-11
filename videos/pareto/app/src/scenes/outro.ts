// `outro` — "The vital few" (colophon; from the solo's white-out to the end; loops into PLATE I).
//   A "Eighty percent of this song is just vibe / The other twenty is the reason I'm alive": the song's own
//     timeline as a bar with a live playhead; it fills graphite (VIBE) with the sung line, then the two
//     choruses flip red (REASON, 22.7% ≈ 20, near enough).
//   B "Just the twenty… (yeah, the vital few)": a giant red 20 slams; the backing line as a marginal note.
//   C "I'm spending my twenty… (on a pint and you)": an engraved pint fills gold (the only other gold); a
//     receipt prints: PINT 6.80, YOU 13.20, TOTAL 20.00.
//   D "It's unconventional, it's math, it's art": three panels tick in on the three phrases.
//   E "The smallest piece is the biggest part.": the 10×10 grid with a single red cell; the camera dives
//     into it until it fills the frame on "part".
//   F la-la-la: the cell steps back into the title page's census grid, the colophon types in, then the
//     cells drain, the hairlines retract and the crop-mark frame flies back in: bare paper, the video's
//     first frame.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D } from '../engine/gl';
import { F, font, layout } from '../engine/type';
import { Lyrics, type Line } from '../engine/lyrics';
import { clamp, ease, lerp, prog, hash } from '../engine/util';
import { Ground, PAPER_POST, VITAL20, isVital, drawKaraokeWords, drawParetoCurve, footnote, fg, RED, wordIn, type C2D } from './_kit';

const LYR = F.archivo(87.5, 800);
// the title page's grid (open.ts)
const PITCH = 64 * 1.22;
const GX = 488 + (168 - 488) * 1.22, GY = 556 + (236 - 556) * 1.22;
const GOLD = (a = 1) => `rgba(242,177,58,${a})`;

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export default class Outro extends Scene {
  g = new Ground();
  L = new Layer2D();
  l: Line[] = [];
  tB = 0; tC = 0; tD = 0; tE = 0; tF = 0; tPart = 0; tBig = 0;
  tGrid = 0; tDrain = 0; tFrame = 0; end = 0;
  reasons: [number, number][] = [];
  reasonShare = 0;
  dur = 300;
  cellOrder: number[] = [];

  override init() {
    const { lyrics: ly, audio: au, end } = this.ctx;
    this.end = end; this.dur = au.duration;
    this.l = [
      ly.get('Eighty percent of this song'), ly.get('The other twenty'), ly.get('Just the twenty', 2), ly.get('the vital few)'),
      ly.get("I'm spending my twenty"), ly.get('on a pint and you'), ly.get('unconventional'), ly.get('The smallest piece'),
    ];
    const beatBefore = (t: number) => au.timeOfBeat(Math.floor(au.beatAt(t + 0.03)));
    this.tB = beatBefore(this.l[2]!.words[0]!.start - 0.12);
    this.tC = beatBefore(this.l[4]!.words[0]!.start - 0.12);
    this.tD = beatBefore(this.l[6]!.words[0]!.start - 0.12);
    this.tE = beatBefore(this.l[7]!.words[0]!.start - 0.12);
    this.tBig = wordIn(this.l[7]!, 'is').start;
    this.tPart = wordIn(this.l[7]!, 'part.').start;
    // F: the cell steps back on the first downbeat after the lyric; colophon; drain; frame back in
    this.tF = au.downbeats.find((d) => d > this.l[7]!.end + 0.2) ?? this.l[7]!.end + 0.6;
    this.tGrid = this.tF + 0.9;
    this.tDrain = end - 8.0;
    this.tFrame = end - 2.6;
    // the reason: the two choruses (from the first to the last line of each chorus section)
    for (const sec of ['chorus1', 'chorus2']) {
      const ls = ly.lines.filter((x: any) => (x as any).section === sec);
      if (ls.length) this.reasons.push([ls[0]!.start - 0.4, ls[ls.length - 1]!.end]);
    }
    this.reasonShare = this.reasons.reduce((a, [s, e]) => a + (e - s), 0) / this.dur;
    // F: reverse census order for the refill (row-major, as on the title page)
    this.cellOrder = Array.from({ length: 100 }, (_, i) => i);
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    const t = f.t;
    this.g.render(renderer, out, { paper: 1, grid: 16, gridA: 0.07, vig: 0.22 });
    const c = this.L.ctx; this.L.clear();
    let zoom = 1, flash = 0, shake: [number, number] = [0, 0];

    if (t < this.tB) this.drawA(c, t);
    else if (t < this.tC) this.drawB(c, t);
    else if (t < this.tD) this.drawC(c, t);
    else if (t < this.tE) this.drawD(c, t);
    else if (t < this.tF) this.drawE(c, t);
    else this.drawF(c, t);

    comp.draw(renderer, this.L.upload(), out);

    // the solo ends in a white-out: come out of it
    flash = Math.max(0, 1 - (t - this.ctx.start) / 0.5) * 0.9;
    // punches on the cuts
    for (const tc of [this.tB, this.tC, this.tD, this.tE]) if (t >= tc) zoom = Math.max(zoom, 1 + 0.02 * Math.exp(-(t - tc) * 8));
    const big = wordIn(this.l[2]!, 'twenty...').start;
    if (t >= big && t < big + 0.25) shake = [Math.sin(t * 160) * 6 * (1 - (t - big) / 0.25), 0];
    const frame = prog(t, this.tFrame, this.end - 0.6, ease.outCubic);
    return { ...PAPER_POST, zoom, flash, shake, frame };
  }

  // ------------------------------------------------------------ A: the song's own timeline
  drawA(c: C2D, t: number) {
    const [l0, l1] = this.l;
    const x0 = 120, x1 = 1800, y = 700, h = 84;
    const X = (s: number) => x0 + (s / this.dur) * (x1 - x0);
    // lyric
    drawKaraokeWords(c, l0!.words, t, x0, 300, { family: LYR, size: 92, paper: true, lead: 1.2 });
    if (t >= l1!.words[0]!.start - 0.4) drawKaraokeWords(c, l1!.words, t, x0, 410, { family: LYR, size: 92, paper: true });
    // bar frame + sections
    const k = prog(t, this.ctx.start + 0.1, this.ctx.start + 0.8, ease.outExpo);
    c.save();
    c.strokeStyle = fg(true, 0.8); c.lineWidth = 1.2;
    c.strokeRect(x0, y, (x1 - x0) * k, h);
    c.font = font(F.mono(500), 13); c.fillStyle = fg(true, 0.6);
    const secs = this.ctx.audio.sections;
    for (const s of secs) {
      const sx = X(s.start);
      if (sx > lerp(x0, x1, k)) continue;
      c.strokeStyle = fg(true, 0.5); c.beginPath(); c.moveTo(sx, y - 14); c.lineTo(sx, y + h); c.stroke();
      c.save(); c.translate(sx + 4, y - 20); c.fillText(s.name.replace(/\d/, ' $&').toUpperCase(), 0, 0); c.restore();
    }
    // fill: graphite with the first line's sung progress
    const p0 = Lyrics.lineCharProgress(l0!, t) / l0!.text.length;
    c.fillStyle = 'rgba(94,91,87,0.85)';
    c.fillRect(x0 + 2, y + 2, (x1 - x0 - 4) * ease.outCubic(p0), h - 4);
    if (p0 > 0.9) {
      c.font = font(F.archivo(125, 900), 40); c.fillStyle = 'rgba(241,235,221,0.9)';
      c.fillText('VIBE', x0 + 24, y + h - 16);
    }
    // the reason: the choruses flip red on "other" and "twenty"
    const flips = [wordIn(l1!, 'other').start, wordIn(l1!, 'twenty').start];
    this.reasons.forEach(([s, e], i) => {
      const fk = prog(t, flips[i]!, flips[i]! + 0.18, ease.outExpo);
      if (fk <= 0) return;
      c.fillStyle = RED();
      const yy = y + 2 + (h - 4) * (1 - fk) / 2;
      c.fillRect(X(s), yy, X(e) - X(s), (h - 4) * fk);
      c.font = font(F.mono(600), 14); c.fillStyle = RED(fk);
      c.fillText('REASON', X(s), y + h + 26);
    });
    const rk = prog(t, flips[1]! + 0.3, flips[1]! + 0.9);
    if (rk > 0) {
      c.font = font(F.mono(500), 18); c.fillStyle = RED(rk); c.textAlign = 'right';
      c.fillText(`REASON  ${(this.reasonShare * 100).toFixed(1)}%  ≈ 20 (NEAR ENOUGH)`, x1, y + h + 70);
      c.fillStyle = fg(true, 0.7 * rk);
      c.fillText(`VIBE  ${(100 - this.reasonShare * 100).toFixed(1)}%`, x1, y + h + 100);
      c.textAlign = 'left';
    }
    // playhead: the real current time
    const px = X(t);
    c.strokeStyle = RED(); c.lineWidth = 2;
    c.beginPath(); c.moveTo(px, y - 40); c.lineTo(px, y + h + 10); c.stroke();
    c.fillStyle = RED(); c.beginPath(); c.moveTo(px - 7, y - 48); c.lineTo(px + 7, y - 48); c.lineTo(px, y - 38); c.fill();
    c.font = font(F.mono(600), 14); c.textAlign = 'right';
    c.fillText(`YOU ARE HERE  ${fmt(t)} / ${fmt(this.dur)}`, px - 12, y - 52);
    c.textAlign = 'left';
    c.restore();
    footnote(c, '¹ Timeline measured to the beat. The vibe was not measured.', x0, 1004, { a: k });
    this.head(c, t, 'COLOPHON — THE SONG, MEASURED');
  }

  head(c: C2D, t: number, s: string) {
    c.save();
    c.font = font(F.mono(500), 14); c.fillStyle = fg(true, 0.7);
    c.fillText(s, 96, 64);
    c.strokeStyle = fg(true, 0.4); c.lineWidth = 1; c.beginPath(); c.moveTo(96, 76); c.lineTo(1824, 76); c.stroke();
    c.restore();
    void t;
  }

  // ------------------------------------------------------------ B: just the twenty
  drawB(c: C2D, t: number) {
    const [, , l2, l3] = this.l;
    this.head(c, t, 'COLOPHON — THE VITAL FEW');
    const tw = wordIn(l2!, 'twenty...').start;
    // giant 20
    const k = prog(t, tw - 0.02, tw + 0.25, ease.outExpo);
    if (k > 0) {
      const fam = F.archivo(100, 900);
      const size = 760;
      const lay = layout('20', fam, size, -10);
      const s = lerp(1.35, 1, k) * (1 + 0.012 * this.ctx.audio.hit('kick', t, 0.1));
      const cx = 1320, by = 880;
      c.save();
      c.translate(cx, by); c.scale(s, s); c.translate(-cx, -by);
      c.font = font(fam, size); c.fillStyle = RED(k);
      c.fillText('20', cx - lay.width / 2, by);
      c.restore();
      footnote(c, '20 / 100', cx - lay.width / 2 + 10, by + 50, { size: 16, a: k });
    }
    drawKaraokeWords(c, l2!.words, t, 120, 420, { family: LYR, size: 104, paper: true, lead: 0.3 });
    if (t >= l3!.words[0]!.start - 0.4) {
      drawKaraokeWords(c, l3!.words, t, 124, 520, { family: F.serif(400, true), size: 66, paper: true, keys: true });
      footnote(c, '— backing vocals, in the margin', 126, 566, { a: prog(t, l3!.words[0]!.start, l3!.words[0]!.start + 0.5) });
    }
  }

  // ------------------------------------------------------------ C: a pint and you
  drawC(c: C2D, t: number) {
    const [, , , , l4, l5] = this.l;
    this.head(c, t, 'COLOPHON — EXPENDITURE');
    drawKaraokeWords(c, l4!.words, t, 120, 250, { family: LYR, size: 88, paper: true, lead: 0.3 });
    if (t >= l5!.words[0]!.start - 0.4) drawKaraokeWords(c, l5!.words, t, 124, 340, { family: F.serif(400, true), size: 64, paper: true });
    // the pint: an engraved glass that fills gold from "spending" to the end of "twenty"
    const g0 = wordIn(l4!, 'spending').start, g1 = wordIn(l4!, 'twenty...').end;
    const fill = ease.inOutCubic(prog(t, g0, g1));
    const gx = 330, gb = 960, gh = 470, wTop = 300, wBot = 230;
    const edge = (y: number) => { const u = (gb - y) / gh; return lerp(wBot, wTop, u) / 2 + (u > 0.72 ? Math.sin((u - 0.72) / 0.28 * Math.PI) * 14 : 0); };
    c.save();
    // beer
    const level = gb - 14 - (gh - 70) * fill;
    if (fill > 0) {
      c.beginPath();
      for (let y = gb - 14; y >= level; y -= 6) c.lineTo(gx - edge(y) + 10, y);
      for (let y = level; y <= gb - 14; y += 6) c.lineTo(gx + edge(y) - 10, y);
      c.closePath(); c.fillStyle = GOLD(0.92); c.fill();
      // bubbles (deterministic)
      c.fillStyle = 'rgba(255,240,200,0.7)';
      for (let i = 0; i < 26; i++) {
        const ph = (t * (0.35 + hash(i, 2) * 0.4) + hash(i, 3)) % 1;
        const by = lerp(gb - 20, level + 6, ph);
        if (by < level + 4) continue;
        c.beginPath(); c.arc(gx + (hash(i, 4) - 0.5) * (wBot - 50), by, 1.5 + hash(i, 5) * 2, 0, Math.PI * 2); c.fill();
      }
      // head of foam
      const foam = Math.min(46, 8 + fill * 40);
      c.fillStyle = 'rgba(250,244,230,1)';
      c.beginPath();
      c.moveTo(gx - edge(level) + 10, level);
      for (let i = 0; i <= 12; i++) {
        const x = lerp(gx - edge(level) + 10, gx + edge(level) - 10, i / 12);
        c.lineTo(x, level - foam + Math.sin(i * 1.7 + t * 2) * 4);
      }
      c.lineTo(gx + edge(level) - 10, level); c.closePath(); c.fill();
      c.strokeStyle = fg(true, 0.5); c.lineWidth = 1; c.stroke();
    }
    // glass outline with engraved hatching on the right side
    c.strokeStyle = fg(true, 0.9); c.lineWidth = 2.2;
    c.beginPath();
    for (let y = gb - gh; y <= gb; y += 4) c.lineTo(gx - edge(y), y);
    c.lineTo(gx + edge(gb), gb);
    for (let y = gb; y >= gb - gh; y -= 4) c.lineTo(gx + edge(y), y);
    c.stroke();
    c.beginPath(); c.moveTo(gx - edge(gb) + 6, gb - 14); c.lineTo(gx + edge(gb) - 6, gb - 14); c.stroke();
    c.lineWidth = 1; c.strokeStyle = fg(true, 0.35);
    for (let y = gb - gh + 20; y < gb - 20; y += 9) { const e = edge(y); c.beginPath(); c.moveTo(gx + e - 22, y); c.lineTo(gx + e - 4, y + 4); c.stroke(); }
    c.font = font(F.mono(500), 14); c.fillStyle = fg(true, 0.7);
    c.fillText(`FILL  ${(fill * 100).toFixed(0)}%  (OF ONE PINT)`, gx - 130, gb + 40);
    c.restore();
    // "you": a red figure beside the glass
    const yk = prog(t, wordIn(l5!, 'you)').start, wordIn(l5!, 'you)').start + 0.25, ease.outBack);
    if (yk > 0) {
      const fx = 640, fb = 960;
      c.save(); c.fillStyle = RED();
      c.translate(fx, fb); c.scale(yk, yk);
      c.beginPath(); c.arc(0, -330, 38, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.roundRect(-40, -280, 80, 280, 40); c.fill();
      c.restore();
    }
    // the receipt
    const rx = 1180, ry = 430, rw = 560;
    const rows: [string, string, number, boolean][] = [
      ['THE VITAL FEW ARMS', '', g0 - 0.3, false],
      ['1 × PINT, BITTER', '6.80', wordIn(l4!, 'twenty...').start, false],
      ['1 × YOU (COMPANY)', '13.20', wordIn(l5!, 'you)').start, true],
      ['TOTAL', '20.00', wordIn(l5!, 'you)').start + 0.45, false],
      ['80% OF THE EVENING: CHAT', '0.00', wordIn(l5!, 'you)').start + 0.8, false],
    ];
    const rk = prog(t, this.tC, this.tC + 0.4, ease.outExpo);
    c.save();
    c.translate(0, (1 - rk) * 80); c.globalAlpha = rk;
    c.fillStyle = 'rgba(250,247,240,1)'; c.shadowColor = 'rgba(0,0,0,0.12)'; c.shadowBlur = 18; c.shadowOffsetY = 6;
    c.fillRect(rx, ry, rw, 420); c.shadowBlur = 0; c.shadowOffsetY = 0;
    c.font = font(F.mono(500), 20);
    rows.forEach(([a, b, tr, red], i) => {
      if (t < tr) return;
      const yy = ry + 60 + i * 66;
      c.fillStyle = red ? RED() : fg(true, 0.85);
      c.fillText(a, rx + 36, yy);
      c.textAlign = 'right'; c.fillText(b, rx + rw - 36, yy); c.textAlign = 'left';
      if (i === 2) { c.strokeStyle = fg(true, 0.5); c.setLineDash([4, 4]); c.beginPath(); c.moveTo(rx + 36, yy + 26); c.lineTo(rx + rw - 36, yy + 26); c.stroke(); c.setLineDash([]); }
    });
    c.restore();
  }

  // ------------------------------------------------------------ D: unconventional, math, art
  drawD(c: C2D, t: number) {
    const l6 = this.l[6]!;
    this.head(c, t, 'COLOPHON — CLASSIFICATION');
    drawKaraokeWords(c, l6.words, t, 960, 250, { family: LYR, size: 92, paper: true, align: 'center', lead: 0.3 });
    const ws = [wordIn(l6, 'unconventional,'), wordIn(l6, 'math,'), wordIn(l6, 'art')];
    const labels = ['UNCONVENTIONAL', 'MATH', 'ART'];
    const pw = 480, ph = 420, gap = 60, x0 = (1920 - (pw * 3 + gap * 2)) / 2, y0 = 380;
    ws.forEach((w, i) => {
      const k = prog(t, w.start - 0.05, w.start + 0.25, ease.outExpo);
      const x = x0 + i * (pw + gap);
      c.save();
      c.strokeStyle = fg(true, 0.25 + 0.55 * k); c.lineWidth = 1.2;
      c.strokeRect(x, y0, pw, ph);
      c.font = font(F.mono(600), 15); c.fillStyle = fg(true, 0.3 + 0.6 * k);
      c.fillText(`FIG. ${i + 1} — ${labels[i]}`, x, y0 + ph + 34);
      if (k > 0) {
        const p = prog(t, w.start, w.end + 0.4, ease.inOutCubic);
        c.beginPath(); c.rect(x, y0, pw, ph); c.clip();
        if (i === 0) {
          // a crooked line: a walk that refuses to go straight
          c.strokeStyle = fg(true, 0.9); c.lineWidth = 3; c.lineCap = 'round'; c.lineJoin = 'round';
          c.beginPath();
          let px = x + 40, py = y0 + ph - 60;
          c.moveTo(px, py);
          const n = 28;
          for (let j = 1; j <= Math.floor(n * p); j++) {
            px = x + 40 + (pw - 80) * (j / n) + (hash(j, 11) - 0.5) * 40;
            py = y0 + ph - 60 - (ph - 120) * (j / n) * (0.5 + 0.5 * Math.sin(j * 1.3)) + (hash(j, 12) - 0.5) * 50;
            c.lineTo(px, py);
          }
          c.stroke();
        } else if (i === 1) {
          drawParetoCurve(c, x + 70, y0 + ph - 60, pw - 120, ph - 130, p, { paper: true, lw: 3 });
        } else {
          // a red brushstroke: tapered, thick
          const n = 40, pts: [number, number, number][] = [];
          for (let j = 0; j <= n; j++) {
            const u = j / n;
            pts.push([x + 50 + (pw - 100) * u, y0 + ph * 0.62 - Math.sin(u * Math.PI * 1.1) * 150 + Math.sin(u * 9) * 8, Math.sin(Math.PI * Math.min(1, u * 1.05)) * 46 + 4]);
          }
          const m = Math.max(1, Math.floor(n * p));
          c.fillStyle = RED();
          c.beginPath();
          for (let j = 0; j <= m; j++) c.lineTo(pts[j]![0], pts[j]![1] - pts[j]![2] / 2);
          for (let j = m; j >= 0; j--) c.lineTo(pts[j]![0], pts[j]![1] + pts[j]![2] / 2);
          c.closePath(); c.fill();
        }
      }
      c.restore();
    });
    footnote(c, '¹ All three. The categories are not mutually exclusive; the panel borders are.', 120, 1004);
  }

  // ------------------------------------------------------------ E: the smallest piece
  drawE(c: C2D, t: number) {
    const l7 = this.l[7]!;
    const cell = 44; // the smallest piece: E5
    const cx = GX + (cell % 10 + 0.5) * PITCH, cy = GY + (Math.floor(cell / 10) + 0.5) * PITCH;
    // dive: from "is" to "part." exponentially, then the cell fills the frame
    const dk = prog(t, this.tBig, this.tPart + 0.05, ease.inCubic);
    const z = Math.exp(Math.log(30) * dk);
    c.save();
    // the camera moves the cell to the frame centre as it zooms
    const tx = lerp(cx, 960, ease.inOutCubic(dk)), ty = lerp(cy, 540, ease.inOutCubic(dk));
    c.translate(tx, ty); c.scale(z, z); c.translate(-cx, -cy);
    const gk = prog(t, this.tE, this.tE + 0.5, ease.outExpo);
    c.strokeStyle = fg(true, 0.28); c.lineWidth = 1 / z;
    c.beginPath();
    for (let i = 0; i <= 10; i++) { c.moveTo(GX + i * PITCH, GY); c.lineTo(GX + i * PITCH, GY + 10 * PITCH * gk); c.moveTo(GX, GY + i * PITCH); c.lineTo(GX + 10 * PITCH * gk, GY + i * PITCH); }
    c.stroke();
    const inset = 7;
    for (let i = 0; i < 100; i++) {
      const ti = this.tE + 0.1 + (i / 100) * 1.2;
      if (t < ti) continue;
      const pop = ease.outBack(prog(t, ti, ti + 0.15));
      const s = (PITCH - inset * 2) * (0.55 + 0.45 * pop) * (i === cell ? 1 : 1);
      const x = GX + (i % 10) * PITCH, y = GY + Math.floor(i / 10) * PITCH, o = (PITCH - s) / 2;
      if (i === cell) {
        const rk = prog(t, wordIn(l7, 'smallest').start, wordIn(l7, 'smallest').start + 0.2, ease.outExpo);
        c.fillStyle = rk > 0 ? RED() : fg(true, 0.3);
        // the red piece is the smallest: a quarter-size square until "biggest", then it grows to the cell
        const small = lerp(0.42, 1, prog(t, wordIn(l7, 'biggest').start, wordIn(l7, 'biggest').start + 0.4, ease.outExpo));
        const ss = s * (rk > 0 ? small : 1), oo = (PITCH - ss) / 2;
        c.fillRect(x + oo, y + oo, ss, ss);
      } else {
        c.fillStyle = fg(true, 0.3);
        c.fillRect(x + o, y + o, s, s);
      }
    }
    c.restore();
    // the frame floods red after "part."
    const fk = prog(t, this.tPart + 0.05, this.tPart + 0.3);
    if (fk > 0) { c.fillStyle = RED(fk); c.fillRect(0, 0, 1920, 1080); }
    // lyric (stays on top, bone when the red floods)
    const big = t >= this.tPart;
    drawKaraokeWords(c, l7.words, t, 960, 940, { family: LYR, size: 84, paper: !big, align: 'center', lead: 0.3, key: big ? 'rgba(241,235,221,1)' : undefined });
    if (dk === 0) {
      c.save(); c.font = font(F.mono(500), 15); c.fillStyle = fg(true, 0.7);
      c.fillText('E5 · AREA 0.42² OF ONE CELL · 0.18% OF THE SHEET', GX + 10 * PITCH + 40, cy + 5);
      c.restore();
    }
  }

  // ------------------------------------------------------------ F: back to the title page (loop)
  drawF(c: C2D, t: number) {
    // red holds, then the cell steps back into the grid
    const back = prog(t, this.tF, this.tGrid, ease.outExpo);
    const cell = 44;
    const cx = GX + (cell % 10 + 0.5) * PITCH, cy = GY + (Math.floor(cell / 10) + 0.5) * PITCH;
    if (back < 1) {
      const z = Math.exp(Math.log(30) * (1 - back));
      c.save();
      const tx = lerp(960, cx, back), ty = lerp(540, cy, back);
      c.fillStyle = RED();
      const s = (PITCH - 14) * z;
      c.fillRect(tx - s / 2, ty - s / 2, s, s);
      c.restore();
    }
    // grid lines (retract at the end)
    const rk = prog(t, this.tDrain + 4.5, this.tFrame + 0.5, ease.inCubic);
    c.save();
    c.strokeStyle = fg(true, 0.28 * (1 - rk)); c.lineWidth = 1;
    const L = 10 * PITCH * (1 - rk);
    c.beginPath();
    for (let i = 0; i <= 10; i++) { c.moveTo(GX + i * PITCH, GY); c.lineTo(GX + i * PITCH, GY + L); c.moveTo(GX, GY + i * PITCH); c.lineTo(GX + L, GY + i * PITCH); }
    c.stroke();
    // cells: refill on the beats (row-major, two per beat), the vital 20 red; drain from tDrain
    const au = this.ctx.audio;
    const b0 = au.beatAt(this.tGrid);
    const inset = 7;
    for (let i = 0; i < 100; i++) {
      if (i === cell && back < 1) continue;
      const tf = i === cell ? this.tGrid : au.timeOfBeat(b0 + Math.floor(i / 4) * 0.5 + (i % 4) * 0.125);
      if (t < tf) continue;
      const td = this.tDrain + (99 - i) * 0.045;
      const dk = prog(t, td, td + 0.15, ease.inCubic);
      if (dk >= 1) continue;
      const pop = ease.outBack(prog(t, tf, tf + 0.14));
      const s = (PITCH - inset * 2) * (0.55 + 0.45 * pop) * (1 - dk);
      const x = GX + (i % 10) * PITCH, y = GY + Math.floor(i / 10) * PITCH, o = (PITCH - s) / 2;
      c.fillStyle = isVital(i) || i === cell ? RED() : fg(true, 0.75);
      c.fillRect(x + o, y + o, s, s);
    }
    c.restore();
    // colophon (right column, where the title stood)
    const COLX = 1010;
    const cl: [string, string, number][] = [
      ['PARETO', 'title', 0],
      ['a song by Joburgalex', 'serif', 1],
      ['', '', 2],
      ['AN ALMANAC OF THE VITAL FEW', 'mono', 3],
      ['15 plates · 42 lines · 1 red fifth', 'mono', 4],
      ['Every frame is a function of time.', 'mono', 5],
      ['80% of this video is vibe.', 'mono', 6],
      ['The other 20 is you.', 'red', 7],
    ];
    const ca = 1 - prog(t, this.tDrain + 1.5, this.tDrain + 3);
    if (ca > 0) {
      c.save();
      c.globalAlpha = ca;
      let y = 400;
      for (const [s, kind, i] of cl) {
        const tk = this.tGrid + 0.3 + i * 0.62;
        const k = prog(t, tk, tk + 0.5);
        if (kind === 'title') {
          if (k > 0) {
            const fam = F.archivo(125, 900);
            c.font = font(fam, 150); c.fillStyle = fg(true, k);
            c.fillText('PARET', COLX, y); const w = c.measureText('PARET').width;
            c.fillStyle = RED(k); c.fillText('O', COLX + w, y);
          }
          y += 90; continue;
        }
        if (!s) { y += 40; continue; }
        if (kind === 'serif') { c.font = font(F.serif(400, true), 52); c.fillStyle = fg(true, 0.9); }
        else { c.font = font(F.mono(500), 20); c.fillStyle = kind === 'red' ? RED() : fg(true, 0.75); }
        c.fillText(s.slice(0, Math.floor(s.length * k)), COLX, y);
        y += kind === 'serif' ? 64 : 36;
      }
      c.restore();
    }
    // la-la-la: a marginal note that types with the vocal
    const la = this.ctx.audio.env('vocal', t);
    const lk = prog(t, this.tGrid + 2, this.tGrid + 3) * ca;
    if (lk > 0) footnote(c, `(la-la-la)  vocal ${(la * 100).toFixed(0).padStart(3, ' ')}%`, COLX, 1004, { a: lk, size: 15 });
  }
}
