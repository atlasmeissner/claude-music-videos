// The edit: which plate plays when. Boundaries are anchored to lyric lines and snapped
// to the beat grid, so they follow the aligned data (data/lyrics.json, data/audio.json).
import type { TimelineEntry } from './engine/engine';
import type { SceneClass } from './engine/scene';
import type { Lyrics } from './engine/lyrics';
import type { AudioData } from './engine/audio';

const modules = import.meta.glob<{ default: SceneClass }>('./scenes/*.ts');
const scene = (name: string) => () => {
  const m = modules[`./scenes/${name}.ts`];
  return m ? m() : Promise.reject(new Error(`scene module not found: scenes/${name}.ts`));
};

/** Seconds of silent "List of Plates" (the image credits) after the song's last hit. */
export const TAIL = 14;

export function makeTimeline(ly: Lyrics, au: AudioData): TimelineEntry[] {
  /** Cut on the last beat at/before the first word of the matching line. */
  const cut = (q: string, nth = 0, tol = 0.02) => {
    const s = ly.get(q, nth).words[0]!.start;
    return au.timeOfBeat(Math.floor(au.beatAt(s + tol)));
  };
  /** First downbeat at/after t. */
  const dbAfter = (t: number) => au.downbeats.find((d) => d >= t - 0.02) ?? t;
  const sec = (n: string) => au.sections.find((s) => s.name === n)!;

  const b = {
    map: cut('I drew a map'),
    doors: cut('Every door'),
    mirror: cut('Every lie'),
    bridge: cut('Every bridge'),
    names: cut('I learned the dark'),
    ch1: cut("So I'm running", 0),
    munger: dbAfter(ly.get("leaving what I fear", 0).end + 0.5),
    ledger: cut('I wrote the list'),
    descent: cut('Every shortcut'),
    lightbox: cut('I held the worst'),
    ch2: cut("So I'm running", 1),
    glory: dbAfter(ly.get("leaving what I fear", 1).end - 0.1),
    climb: sec('climb').start,
    ch3: cut("So I'm running", 2),
    outro: sec('outro').start,
    end: au.duration - 2.4, // the last hit, then silence
  };
  const E = (id: string, file: string, start: number, end: number, extra: Partial<TimelineEntry> = {}): TimelineEntry =>
    ({ id, load: scene(file), start, end, ...extra });

  return [
    E('title', 'title', 0, b.map),
    E('map', 'map', b.map, b.doors),
    E('doors', 'doors', b.doors, b.mirror),
    E('mirror', 'mirror', b.mirror, b.bridge),
    E('bridge', 'bridge', b.bridge, b.names),
    E('names', 'names', b.names, b.ch1),
    E('chorus1', 'chorus', b.ch1, b.munger, { params: { n: 1 } }),
    E('munger', 'munger', b.munger, b.ledger),
    E('ledger', 'ledger', b.ledger, b.descent),
    E('descent', 'descent', b.descent, b.lightbox),
    E('lightbox', 'lightbox', b.lightbox, b.ch2),
    E('chorus2', 'chorus', b.ch2, b.glory, { params: { n: 2 } }),
    E('glory', 'glory', b.glory, b.climb),
    E('climb', 'climb', b.climb, b.ch3),
    E('chorus3', 'chorus', b.ch3, b.outro, { params: { n: 3 } }),
    E('outro', 'outro', b.outro, b.end),
    E('plates', 'plates', b.end, au.duration + TAIL),
  ];
}
