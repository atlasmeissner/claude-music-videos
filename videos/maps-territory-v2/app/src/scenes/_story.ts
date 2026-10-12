// The story, timed to the song. One map for the whole video: the plan is drawn in the first verse, and from the
// first chorus the trail (Joburgalex's own life) walks away from it, one life event per cue. Everything here is
// derived from the aligned lyrics (line / word indices into data/lyrics.json) and the beat grid, so the events land
// on the words that carry them.
import type { Lyrics } from '../engine/lyrics';
import type { AudioData } from '../engine/audio';
import { clamp, ease } from '../engine/util';
import { WAY, waySAt, track, wayIx } from './_world';

export interface StoryEvent { name: string; way: number; t: number; note: string }
export interface Story {
  /** [time, km walked] keys; walked(t) interpolates with a sine ease between keys. */
  sKeys: [number, number][];
  events: StoryEvent[];
  /** Named times. */
  T: Record<string, number>;
}

const cache = new WeakMap<Lyrics, Story>();

export function story(ly: Lyrics, au: AudioData): Story {
  const c = cache.get(ly);
  if (c) return c;
  const L = (i: number) => ly.lines[i]!;
  const W = (i: number, j: number) => ly.lines[i]!.words[Math.min(j, ly.lines[i]!.words.length - 1)]!;
  const last = (i: number) => W(i, 99);
  const sec = (n: string) => au.sections.find((x) => x.name === n)!.start;
  const db = (i: number) => au.downbeats[i]!;
  const S = (w: number) => waySAt(w);
  const N = (name: string) => waySAt(wayIx(name));
  const T: Record<string, number> = {
    title: db(8), epigraph: db(19), sheet: au.downbeats.find((d) => d > db(19) + 1)!, verse1: sec('verse1'),
    pre1: sec('pre1'), ground: W(4, 2).start, page: last(5).start, chorus1: L(6).words[0]!.start - 0.4,
    tracing: L(8).words[0]!.start, now: L(9).words[0]!.start, shore: last(9).end, brk: sec('break1'), verse2: sec('verse2'),
    rain: last(10).start, feast: last(11).start, road: last(12).start, east: last(13).start, pre2: sec('pre2'),
    chorus2: L(16).words[0]!.start - 0.4, lost: W(19, 2).start, bridge: sec('bridge'), lost2: last(21).end, arrive: last(22).start,
    final: sec('final'), beautiful: W(26, 3).start, inst: sec('inst'), here: db(130), drop: db(130), build: db(133),
    final2: sec('final2'), peel: L(30).words[0]!.start, outro: sec('outro'), band: db(170), horn: db(180), end: au.duration,
  };
  const sKeys: [number, number][] = [
    [0, 0], [T.tracing!, 0],
    [L(8).end, S(2)],
    [W(9, 3).start, N('LEFT FOR EUROPE')],
    [T.shore!, N('LEFT FOR EUROPE') + 0.001 + (waySAt(wayIx('LEFT FOR EUROPE') + 1) - N('LEFT FOR EUROPE'))],
    [T.verse2! - 0.6, N('MUNICH')],
    [last(10).end, (N('MUNICH') + N('MARRIED')) / 2],
    [T.feast!, N('MARRIED')],
    [T.road!, N('TWO CHILDREN')],
    [T.east!, N('RAN A COMPANY')],
    [T.chorus2!, N('RAN A COMPANY')],
    [L(18).end, N('RAN A COMPANY') + (N('WOUND IT UP') - N('RAN A COMPANY')) * 0.6],
    [T.lost!, N('WOUND IT UP')],
    [T.lost2!, N('AN AI RED TEAM')],
    [T.arrive!, N('MY OWN PLATFORM')],
    [T.beautiful!, N('MAKING MUSIC')],
    [T.inst! + 1, N('MAKING MUSIC')],
    [T.here! - 0.3, track().total],
  ];
  const events: StoryEvent[] = [];
  const evAt = (name: string) => { const w = WAY.findIndex((x) => x.name === name); return { w, t: timeAtS(sKeys, S(w)) }; };
  const NOTES: Record<string, string> = {
    'JOHANNESBURG': 'WHERE THE PLAN SAID HOME',
    'LEFT FOR EUROPE': 'ACROSS THE WATER, OFF THE PAGE',
    'MUNICH': 'NOT ON THE PLAN',
    'MARRIED': 'TWO TRAILS, ONE',
    'TWO CHILDREN': 'THE DETOUR WAS THE ROAD',
    'RAN A COMPANY': 'A WRONG TURN, EAST',
    'WOUND IT UP': 'THE ROAD WASHED OUT',
    'AN AI RED TEAM': 'LOST, AND LOOKING NOWHERE',
    'MY OWN PLATFORM': 'ARRIVED BY GETTING LOST',
    'MAKING MUSIC': 'THIS SONG',
    'HERE': 'OFF THE SHORE · ON NO MAP',
  };
  for (const w of WAY) {
    if (!w.name) continue;
    if (w.name === 'JOHANNESBURG') { events.push({ name: w.name, way: 0, t: T.page!, note: NOTES[w.name]! }); continue; }
    const e = evAt(w.name);
    events.push({ name: w.name, way: e.w, t: e.t, note: NOTES[w.name] ?? '' });
  }
  const st = { sKeys, events, T };
  cache.set(ly, st);
  return st;
}

/** Km walked at time t. */
export function walked(st: Story, t: number) {
  const k = st.sKeys;
  if (t <= k[0]![0]) return k[0]![1];
  for (let i = 1; i < k.length; i++) {
    if (t <= k[i]![0]) {
      const [t0, s0] = k[i - 1]!, [t1, s1] = k[i]!;
      return s0 + (s1 - s0) * ease.inOutSine(clamp((t - t0) / Math.max(1e-6, t1 - t0)));
    }
  }
  return k[k.length - 1]![1];
}

/** First time the walk reaches arc length s. */
export function timeAtS(k: [number, number][], s: number) {
  for (let i = 1; i < k.length; i++) {
    const [t0, s0] = k[i - 1]!, [t1, s1] = k[i]!;
    if (s1 >= s - 1e-6 && s1 > s0) {
      // invert the sine ease
      const u = clamp((s - s0) / (s1 - s0));
      return t0 + (t1 - t0) * (Math.acos(1 - 2 * u) / Math.PI);
    }
  }
  return k[k.length - 1]![0];
}
