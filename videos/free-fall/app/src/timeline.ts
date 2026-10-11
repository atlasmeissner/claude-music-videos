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
    ledger: cut(0),
    cliff: cut(2),
    payoff: cut(4),
    hook1: cut(6),
    fly1: cut(7),
    vacuum: cut(10),
    letter: cut(11),
    door: cut(15),
    hook2: cut(17),
    fly2: cut(18),
    chant: sec('chant'),
    bridge: cut(22),
    hook3: cut(26),
    final: cut(27),
    hook4: sec('tail2'),
    outro: sec('outro'),
    end: au.duration,
  };
}

export function makeTimeline(ly: Lyrics, au: AudioData): TimelineEntry[] {
  const b = bounds(ly, au);
  const E = (id: string, file: string, start: number, end: number, extra: Partial<TimelineEntry> = {}): TimelineEntry =>
    ({ id, load: scene(file), start, end, ...extra, ...(id !== file ? { file } : {}) }) as TimelineEntry;
  return [
    E('edge', 'edge', 0, b.ledger),
    E('ledger', 'ledger', b.ledger, b.cliff),
    E('cliff', 'cliff', b.cliff, b.payoff),
    E('payoff', 'payoff', b.payoff, b.hook1),
    E('hook1', 'hook', b.hook1, b.fly1, { params: { n: 1, line: 6 } }),
    E('fly1', 'fly', b.fly1, b.vacuum, { params: { v: 1, lines: [7, 8, 9] } }),
    E('vacuum', 'vacuum', b.vacuum, b.letter),
    E('letter', 'letter', b.letter, b.door),
    E('door', 'door', b.door, b.hook2),
    E('hook2', 'hook', b.hook2, b.fly2, { params: { n: 2, line: 17 } }),
    E('fly2', 'fly', b.fly2, b.chant, { params: { v: 2, lines: [18, 19, 20], tag: 21 } }),
    E('chant', 'chant', b.chant, b.bridge),
    E('bridge', 'bridge', b.bridge, b.hook3),
    E('hook3', 'hook', b.hook3, b.final, { params: { n: 3, line: 26 } }),
    E('final', 'fly', b.final, b.hook4, { params: { v: 3, lines: [27, 28, 29], tag: 30 } }),
    E('hook4', 'hook', b.hook4, b.outro, { params: { n: 4, line: 31 } }),
    E('outro', 'outro', b.outro, b.end),
  ];
}
