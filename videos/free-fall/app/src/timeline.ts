// The edit: which plate plays when. Boundaries are anchored to lyric lines (by index into data/lyrics.json, whose
// repeated "Free fall, free fall" lines make content lookups ambiguous) and snapped to the beat grid.
// Line map: 0–3 verse 1 · 4–5 pre 1 · 6–9 chorus 1 · 10 tail · 11–14 verse 2 · 15–16 pre 2 · 17–21 chorus 2 ·
// 22–25 bridge · 26–30 final chorus · 31 tail (hook 4).
import type { TimelineEntry } from './engine/engine';
import type { SceneClass } from './engine/scene';
import type { Lyrics } from './engine/lyrics';
import type { AudioData } from './engine/audio';

const modules = import.meta.glob<{ default: SceneClass }>('./scenes/*.ts');
const scene = (name: string) => () => {
  const m = modules[`./scenes/${name}.ts`];
  return m ? m() : Promise.reject(new Error(`scene module not found: scenes/${name}.ts`));
};

/** Plate boundaries (song seconds). Mirrored in analysis/windows.py for segment renders. */
export function bounds(ly: Lyrics, au: AudioData) {
  /** Cut on the last beat at/before the first word of line i (a word up to 50 ms early still counts as on it). */
  const cut = (i: number, tol = 0.05) => {
    const s = ly.lines[i]!.words[0]!.start;
    return au.timeOfBeat(Math.floor(au.beatAt(s + tol)));
  };
  const sec = (name: string) => au.sections.find((x) => x.name === name)!.start;
  return {
    measure: cut(0),
    reveal: cut(2),
    runup: cut(4),
    dream1: cut(6),
    wake: cut(10),
    message: cut(11),
    doorway: cut(15),
    dream2: cut(17),
    crowd: sec('chant'),
    decide: cut(22),
    jump: cut(26),
    through: sec('tail2'),
    end: au.duration,
  };
}

// Revision 3: one story. A person procrastinates on a ledge for 412 days; the drop looks bottomless; it is 1.40 m.
export function makeTimeline(ly: Lyrics, au: AudioData): TimelineEntry[] {
  const b = bounds(ly, au);
  const E = (id: string, file: string, start: number, end: number, extra: Partial<TimelineEntry> = {}): TimelineEntry =>
    ({ id, load: scene(file), start, end, ...extra, ...(id !== file ? { file } : {}) }) as TimelineEntry;
  return [
    E('ledge', 'ledge', 0, b.measure),
    E('measure', 'measure', b.measure, b.reveal),
    E('reveal', 'reveal', b.reveal, b.runup),
    E('runup', 'runup', b.runup, b.dream1),
    E('dream1', 'dream', b.dream1, b.wake, { params: { v: 1, hook: 6, lines: [7, 8, 9] } }),
    E('wake', 'wake', b.wake, b.message),
    E('message', 'message', b.message, b.doorway),
    E('doorway', 'doorway', b.doorway, b.dream2),
    E('dream2', 'dream', b.dream2, b.crowd, { params: { v: 2, hook: 17, lines: [18, 19, 20], tag: 21 } }),
    E('crowd', 'crowd', b.crowd, b.decide),
    E('decide', 'decide', b.decide, b.jump),
    E('jump', 'jump', b.jump, b.through),
    E('through', 'through', b.through, b.end),
  ];
}
