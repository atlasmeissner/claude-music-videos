// The edit: one continuous shot. The whole song is the `map` scene; it is split into parts only so the export can
// render in resumable segments (every frame is a pure function of song time, so the joins are invisible).
import type { TimelineEntry } from './engine/engine';
import type { SceneClass } from './engine/scene';
import type { Lyrics } from './engine/lyrics';
import type { AudioData } from './engine/audio';

const modules = import.meta.glob<{ default: SceneClass }>('./scenes/*.ts');
const scene = (name: string) => () => {
  const m = modules[`./scenes/${name}.ts`];
  return m ? m() : Promise.reject(new Error(`scene module not found: scenes/${name}.ts`));
};

/** Part boundaries (song seconds): the section starts. Shared with analysis/windows.py (same rule). */
export function bounds(_ly: Lyrics, au: AudioData): number[] {
  const names = ['verse1', 'pre1', 'chorus1', 'verse2', 'pre2', 'chorus2', 'bridge', 'final', 'inst', 'final2', 'outro'];
  return [0, au.downbeats[19]!, ...names.map((n) => au.sections.find((x) => x.name === n)!.start), au.duration];
}

export function makeTimeline(ly: Lyrics, au: AudioData): TimelineEntry[] {
  const b = bounds(ly, au);
  return b.slice(0, -1).map((start, i) => ({ id: `p${String(i + 1).padStart(2, '0')}`, load: scene('map'), start, end: b[i + 1]! }));
}
