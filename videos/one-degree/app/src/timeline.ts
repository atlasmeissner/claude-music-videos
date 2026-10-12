// The edit: which plate plays when. Boundaries are anchored to lyric lines (by index into data/lyrics.json,
// whose many repeated "One degree" lines make content lookups ambiguous) and snapped to the beat grid.
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
  /** Cut on the last beat at/before the first word of line i (never after the word). */
  const cut = (i: number, tol = 0.02) => {
    const s = ly.lines[i]!.words[0]!.start;
    return au.timeOfBeat(Math.floor(au.beatAt(s + tol)));
  };
  const sec = (name: string) => au.sections.find((x) => x.name === name)!.start;

  const b = {
    ground: cut(0),
    days: cut(2),
    river: cut(4),
    turn: cut(6),
    bending: cut(8),
    pages: cut(10),
    night: cut(12),
    snow: cut(14),
    ice: cut(16),
    whoa: cut(20),
    quiet: cut(23),
    thaw: cut(26),
    lights: sec('tag'),
    coda: cut(32),
    outro: sec('outro'),
    end: au.duration,
  };
  const E = (id: string, start: number, end: number, extra: Partial<TimelineEntry> = {}): TimelineEntry =>
    ({ id, load: scene(id), start, end, ...extra });
  const W_ = (id: string, start: number, end: number, part: string): TimelineEntry =>
    ({ id, load: scene('world'), start, end, params: { part } });

  return [
    E('dawn', 0, b.ground),
    E('ground', b.ground, b.days),
    E('days', b.days, b.river),
    E('river', b.river, b.turn),
    // the little world (scenes/world.ts, one module, a shot list per part)
    W_('turn', b.turn, b.bending, 'c1a'),
    W_('bending', b.bending, b.pages, 'c1b'),
    E('pages', b.pages, b.night),
    E('night', b.night, b.snow),
    E('snow', b.snow, b.ice),
    W_('ice', b.ice, b.whoa, 'c2'),
    W_('whoa', b.whoa, b.quiet, 'post'),
    E('quiet', b.quiet, b.thaw),
    W_('thaw', b.thaw, b.lights, 'fin'),
    W_('lights', b.lights, b.coda, 'tag'),
    W_('coda', b.coda, b.outro, 'coda'),
    E('outro', b.outro, b.end),
  ];
}
