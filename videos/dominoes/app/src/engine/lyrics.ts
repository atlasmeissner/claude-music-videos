// Word-level lyric timings (data/lyrics.json, produced by analysis/align.py + refine.py).
import raw from '../../../data/lyrics.json';
import { clamp } from './util';

export interface Word { w: string; start: number; end: number; conf?: number }
export interface Line { i: number; section: string; text: string; start: number; end: number; words: Word[] }

export const LINES: Line[] = (raw as unknown as { lines: Line[] }).lines;

/** Line by index. */
export const line = (i: number) => LINES[i]!;

/** The n-th line (0-based) whose text starts with `prefix` (case-insensitive). */
export function find(prefix: string, n = 0): Line {
  const p = prefix.toLowerCase();
  const hits = LINES.filter((l) => l.text.toLowerCase().startsWith(p));
  const l = hits[n];
  if (!l) throw new Error(`no line "${prefix}" #${n}`);
  return l;
}

/** Lines of a section, in order. */
export const section = (name: string) => LINES.filter((l) => l.section === name);

/**
 * Display text for a word: typographic apostrophes. Lyric-file punctuation (commas) is kept
 * only where the caller wants it.
 */
export const display = (w: string, keepPunct = false) => {
  let s = w.replace(/'/g, '’');
  if (!keepPunct) s = s.replace(/[,.]$/, '');
  return s;
};

/** 0 before the word starts, 1 once it has been sung, linear in between. */
export const wordProg = (w: Word, t: number) => clamp((t - w.start) / Math.max(0.05, w.end - w.start));

/** State of a word at time t: unsung, active (being sung) or sung. */
export function wordState(w: Word, t: number): 'unsung' | 'active' | 'sung' {
  if (t < w.start) return 'unsung';
  if (t < Math.max(w.end, w.start + 0.18)) return 'active';
  return 'sung';
}

/** Index of the word being sung (or last sung) in a line, -1 before the line. */
export function currentWord(l: Line, t: number) {
  let k = -1;
  for (let i = 0; i < l.words.length; i++) if (t >= l.words[i]!.start) k = i;
  return k;
}
