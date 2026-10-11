// The edit: which scene plays when. Boundaries are anchored to lyric lines and snapped
// to the beat grid, so they follow the aligned data (data/lyrics.json, data/audio.json).
import type { TimelineEntry } from './engine/engine';
import type { SceneClass } from './engine/scene';
import type { Lyrics } from './engine/lyrics';
import type { AudioData } from './engine/audio';

// Scene modules are discovered lazily so a missing/broken scene never breaks the build.
const modules = import.meta.glob<{ default: SceneClass }>('./scenes/*.ts');
const scene = (name: string) => () => {
  const m = modules[`./scenes/${name}.ts`];
  return m ? m() : Promise.reject(new Error(`scene module not found: scenes/${name}.ts`));
};

export function makeTimeline(ly: Lyrics, au: AudioData): TimelineEntry[] {
  /** Downbeat at/before the first word of the matching line, unless that is more than `maxEarly` s early (then the beat). */
  const cut = (q: string, nth = 0, maxEarly = 1.2) => {
    const s = ly.get(q, nth).words[0]!.start;
    const db = [...au.downbeats].reverse().find((d) => d <= s + 0.03);
    if (db !== undefined && s - db <= maxEarly) return db;
    return au.timeOfBeat(Math.floor(au.beatAt(s + 0.03)));
  };
  const sec = (name: string) => au.sections.find((x) => x.name === name);
  /** First downbeat at/after the end of the matching line. */
  const after = (q: string, nth = 0) => {
    const e = ly.get(q, nth).end;
    return au.downbeats.find((d) => d >= e - 0.05) ?? e;
  };

  const b = {
    flat: cut('Woke up in a flat'),
    records: cut('a hundred records'),
    kettle: cut("The kettle's boiling"),
    park: cut("running 'round the park"),
    chorus1: cut('give me the twenty', 0),
    lop1: cut('lopsided world', 0),
    camden: cut('Met a girl in Camden'),
    friends: cut('Most of my friends'),
    chorus2: cut('give me the twenty', 1),
    lop2: cut('lopsided world', 1),
    // the bridge's psychedelic swirl starts where the music slows, right after chorus 2
    bridge: after('watching time fly', 1),
    cut: cut('Cut the fat'),
    solo: sec('solo')?.start ?? cut('Eighty percent of this song') - 30,
    outro: cut('Eighty percent of this song'),
    end: au.duration,
  };

  const E = (id: string, file: string, start: number, end: number, extra: Partial<TimelineEntry> = {}): TimelineEntry =>
    ({ id, load: scene(file), start, end, ...extra });

  return [
    E('open', 'open', 0, b.flat),
    E('flat', 'flat', b.flat, b.records),
    E('records', 'records', b.records, b.kettle),
    E('kettle', 'kettle', b.kettle, b.park),
    E('park', 'park', b.park, b.chorus1),
    E('chorus1', 'chorus', b.chorus1, b.lop1, { params: { n: 1 } }),
    E('lopsided1', 'lopsided', b.lop1, b.camden, { params: { n: 1 } }),
    E('camden', 'camden', b.camden, b.friends),
    E('friends', 'friends', b.friends, b.chorus2),
    E('chorus2', 'chorus', b.chorus2, b.lop2, { params: { n: 2 } }),
    E('lopsided2', 'lopsided', b.lop2, b.bridge, { params: { n: 2 } }),
    E('bridge', 'bridge', b.bridge, b.cut),
    E('cut', 'cut', b.cut, b.solo),
    E('solo', 'solo', b.solo, b.outro),
    E('outro', 'outro', b.outro, b.end),
  ];
}
