// The edit: which plate plays when. Boundaries are anchored to lyric lines (by index into data/lyrics.json,
// whose repeated chorus lines make content lookups ambiguous) and snapped to the beat grid.
import type { TimelineEntry } from './engine/engine';
import type { SceneClass } from './engine/scene';
import type { Lyrics } from './engine/lyrics';
import type { AudioData } from './engine/audio';

const modules = import.meta.glob<{ default: SceneClass }>('./scenes/*.ts');
const scene = (name: string) => () => {
  const m = modules[`./scenes/${name}.ts`];
  return m ? m() : Promise.reject(new Error(`scene module not found: scenes/${name}.ts`));
};

export function makeTimeline(ly: Lyrics, au: AudioData): TimelineEntry[] {
  return plateWindows(ly, au).map(([id, start, end]) => ({ id, load: scene(id), start, end }));
}

/** [id, start, end] for every plate (also used by analysis/windows.py's twin rule). */
export function plateWindows(ly: Lyrics, au: AudioData): [string, number, number][] {
  /** Cut on the last beat at/before the first word of line i (never after the word). */
  const cut = (i: number, tol = 0.02) => {
    const s = ly.lines[i]!.words[0]!.start;
    return au.timeOfBeat(Math.floor(au.beatAt(s + tol)));
  };
  const sec = (name: string) => au.sections.find((x) => x.name === name)!.start;
  /** the downbeat nearest to t */
  const db = (t: number) => au.downbeats.reduce((b, d) => (Math.abs(d - t) < Math.abs(b - t) ? d : b), au.downbeats[0]!);

  const ids = ['note', 'facade', 'edges', 'carry', 'strip', 'shown', 'xray', 'maps', 'burn', 'ground', 'orders',
    'build', 'wreckage', 'cathedral', 'vault', 'asbuilt', 'outro'];
  const st = [0, cut(0), cut(2), cut(4), cut(6), cut(8), sec('break1'), cut(10), cut(12), cut(14), cut(16),
    cut(20), sec('bridge'), cut(26), sec('tag'), db(176.4), cut(31), au.duration];
  return ids.map((id, i) => [id, st[i]!, st[i + 1]!]);
}
