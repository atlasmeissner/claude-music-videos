// The edit: which plate plays when. Boundaries are anchored to lyric lines (by index into data/lyrics.json; the
// choruses repeat, so content lookups would be ambiguous), to sections, or to downbeats in the instrumental
// stretches (the horn intro, the instrumental after the final chorus, the outro), all on the beat grid.
import type { TimelineEntry } from './engine/engine';
import type { SceneClass } from './engine/scene';
import type { Lyrics } from './engine/lyrics';
import type { AudioData } from './engine/audio';

const modules = import.meta.glob<{ default: SceneClass }>('./scenes/*.ts');
const scene = (name: string) => () => {
  const m = modules[`./scenes/${name}.ts`];
  return m ? m() : Promise.reject(new Error(`scene module not found: scenes/${name}.ts`));
};

/** Plate ids in order, with the module each one uses (several plates share a module through params). */
export const PLATES: [id: string, module: string, params?: Record<string, any>][] = [
  ['horn', 'horn'], ['vista', 'vista'], ['korzybski', 'korzybski'], ['sheet', 'sheet'], ['drew', 'drew'],
  ['ground', 'ground'], ['chorus1', 'chorus', { n: 1 }], ['tracing', 'tracing'], ['detour', 'detour'], ['fits', 'fits'],
  ['chorus2', 'chorus', { n: 2 }], ['compass', 'compass'], ['bridge', 'bridge'], ['chorus3', 'chorus', { n: 3 }],
  ['beyond', 'beyond', { n: 1 }], ['journey', 'journey'], ['dawn', 'dawn'], ['chorus4', 'chorus', { n: 4 }],
  ['found', 'beyond', { n: 2 }], ['return', 'return'], ['coda', 'coda'],
];

/** Plate boundaries (song seconds), PLATES.length + 1 values. Shared with analysis/windows.py (same rule). */
export function bounds(ly: Lyrics, au: AudioData): number[] {
  /** Cut on the last beat at/before the first word of line i (never after the word). */
  const cut = (i: number, tol = 0.02) => au.timeOfBeat(Math.floor(au.beatAt(ly.lines[i]!.words[0]!.start + tol)));
  const sec = (name: string) => au.sections.find((x) => x.name === name)!.start;
  const db = (i: number) => au.downbeats[i]!;
  return [
    0, db(8), db(19), db(27), sec('verse1'), sec('pre1'), cut(6), cut(8), sec('verse2'), cut(14), cut(16), cut(18),
    sec('bridge'), cut(23), cut(25), sec('inst'), db(130), cut(27), cut(29), sec('outro'), db(170), au.duration,
  ];
}

export function makeTimeline(ly: Lyrics, au: AudioData): TimelineEntry[] {
  const b = bounds(ly, au);
  return PLATES.map(([id, mod, params], i) => ({ id, load: scene(mod), start: b[i]!, end: b[i + 1]!, params: params ?? {} }));
}
