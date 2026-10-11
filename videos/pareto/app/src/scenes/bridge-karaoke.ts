// drawKaraokeWords from the kit with two additions the bridge / cut plates need: an overall `alpha`
// (the kit's helper sets globalAlpha per glyph, so an outer globalAlpha cannot fade it) and `isKeyFn`
// (which words go red; e.g. "you" is a key word for the outro but not in "you reap what you sow").
import { Lyrics, type Word } from '../engine/lyrics';
import { font, layout } from '../engine/type';
import { clamp, lerp } from '../engine/util';
import { fg, RED, isKey, type C2D, type KaraokeStyle, type WordBox } from './_kit';

export interface KStyle extends KaraokeStyle { alpha?: number; isKeyFn?: (w: Word) => boolean }

export function karaoke(c: C2D, words: Word[], t: number, x: number, y: number, s: KStyle): WordBox[] {
  const paper = s.paper ?? true;
  const dim = s.dim ?? 0.28;
  const A = s.alpha ?? 1;
  const base = s.sung ?? fg(paper);
  const keyCol = s.key ?? RED();
  const keyF = s.isKeyFn ?? ((w: Word) => (s.keys ?? true) && isKey(w));
  c.save();
  c.font = font(s.family, s.size); c.textBaseline = 'alphabetic'; c.textAlign = 'left';
  const space = s.space != null ? s.space * s.size : c.measureText(' ').width;
  const lays = words.map((w) => layout(w.w, s.family, s.size, s.tracking ?? 0));
  const total = lays.reduce((a, l) => a + l.width, 0) + space * Math.max(0, words.length - 1);
  let cx = s.align === 'center' ? x - total / 2 : s.align === 'right' ? x - total : x;
  const boxes: WordBox[] = [];
  const lead = s.lead ?? 0.4;
  words.forEach((w, i) => {
    const lay = lays[i]!;
    const p = Lyrics.wordProgress(w, t);
    const vis = s.reveal ? t >= w.start - 0.02 : t >= words[0]!.start - lead;
    if (vis && A > 0) {
      const col = keyF(w) ? keyCol : base;
      const pop = (s.pop ?? 0) * Math.max(0, 1 - (t - w.start) / 0.22) * (t >= w.start ? 1 : 0);
      c.save();
      if (pop > 0) { const mx = cx + lay.width / 2; c.translate(mx, y); c.scale(1 + pop, 1 + pop); c.translate(-mx, -y); }
      const sungG = p * lay.glyphs.length;
      for (const g of lay.glyphs) {
        const k = clamp(sungG - g.i);
        let a: number;
        if (k >= 1) { c.fillStyle = col; a = 1; }
        else if (k > 0) { c.fillStyle = col; a = lerp(dim, 1, k); }
        else { c.fillStyle = base; a = s.reveal ? 0 : dim; }
        c.globalAlpha = a * A;
        if (c.globalAlpha > 0) c.fillText(g.ch, cx + g.x, y);
      }
      c.restore();
    }
    boxes.push({ w, x: cx, y, width: lay.width, lay, p });
    cx += lay.width + space;
  });
  c.restore();
  return boxes;
}
