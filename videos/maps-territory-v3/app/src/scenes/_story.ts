// The story, timed to the song. Mara, born 1990. Her father draws her life in the first verse (the plan, see
// _world.ts › PLAN); from the first chorus she walks it, and leaves it, one life event per cue. A pale ghost of her
// walks the plan on schedule, and fades each time the real Mara leaves it behind.
//
// Everything here is derived from the aligned lyrics (line / word indices into data/lyrics.json) and the beat grid,
// so the events land on the words that carry them.
import type { Lyrics } from '../engine/lyrics';
import type { AudioData } from '../engine/audio';
import { clamp, ease } from '../engine/util';
import { WAY, waySAt, track, trackAt, wayIx, PLAN_PTS } from './_world';
import { PLACE_S, PLAN_LEN } from './_plan';

export interface StoryEvent {
  /** Waypoint name (and the tag's label). */
  name: string; way: number; t: number; year: number;
  /** The tag on the map. */
  label: string;
}
/** One engraved figure plate (see _vignettes.ts). `anchor`: what the plate unfolds from (a waypoint index or 'light'). */
export interface PlateCue { id: string; t0: number; t1: number; side: 1 | -1; anchor: number | 'light' }
export interface Story {
  /** [time, km walked] keys; walked(t) interpolates with a sine ease between keys. */
  sKeys: [number, number][];
  /** The ghost (the life as planned): [time, km along the plan] keys, and [time, opacity] steps. */
  gKeys: [number, number][];
  gFade: [number, number][];
  /** [time, year] keys for the year counter. */
  yKeys: [number, number][];
  events: StoryEvent[];
  plates: PlateCue[];
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
    tracing: L(8).words[0]!.start, now: L(9).words[0]!.start, ferry: W(9, 3).start, shore: last(9).end, brk: sec('break1'), verse2: sec('verse2'),
    rain: last(10).start, feast: last(11).start, road: last(12).start, east: last(13).start, pre2: sec('pre2'),
    chorus2: L(16).words[0]!.start - 0.4, lost: W(19, 2).start, bridge: sec('bridge'), lost2: last(21).end, arrive: last(22).start,
    final: sec('final'), beautiful: W(26, 3).start, inst: sec('inst'), here: db(130), drop: db(130), build: db(133),
    final2: sec('final2'), stamp: W(29, 4).start, peel: L(30).words[0]!.start, outro: sec('outro'), band: db(170), horn: db(180), end: au.duration,
  };
  const sKeys: [number, number][] = [
    [0, 0], [T.tracing!, 0],
    [L(8).end, S(2)],
    [T.ferry!, N('THE FERRY')],
    [T.shore!, waySAt(wayIx('THE FERRY') + 1)],
    [T.verse2! - 0.6, N('THE BAKERY')],
    [last(10).end, (N('THE BAKERY') + N('THE FEAST')) / 2],
    [T.feast!, N('THE FEAST')],
    [T.road!, N('IDA')],
    [T.east!, N("MARA'S")],
    [T.chorus2!, N("MARA'S")],
    [L(18).end, N("MARA'S") + (N('HER FATHER') - N("MARA'S")) * 0.6],
    [T.lost!, N('HER FATHER')],
    [T.lost2!, N('WANDERING')],
    [T.arrive!, N('THE COAST')],
    [T.beautiful!, N('THE JETTY')],
    [T.inst! + 1, N('THE JETTY')],
    [T.here! - 0.3, track().total],
  ];
  // the ghost: with her as far as SCHOOL, then on schedule along the ruled road while she goes her own way
  const P = PLACE_S;
  // (while they walk together it keeps level with her: the point of the plan nearest to where she is)
  const near = (s: number) => {
    const q = trackAt(s);
    let best = 0, bd = Infinity;
    for (let i = 1; i < PLAN_PTS.length; i++) {
      const a = PLAN_PTS[i - 1]!, b = PLAN_PTS[i]!, vx = b.x - a.x, vy = b.y - a.y;
      const u = clamp(((q.x - a.x) * vx + (q.y - a.y) * vy) / (vx * vx + vy * vy));
      const d = Math.hypot(a.x + vx * u - q.x, a.y + vy * u - q.y);
      if (d < bd) { bd = d; best = P[i - 1]! + (P[i]! - P[i - 1]!) * u; }
    }
    return best;
  };
  const gKeys: [number, number][] = [
    [0, 0], [T.tracing!, 0], [L(8).end, near(S(2))], [T.ferry!, near(N('THE FERRY'))], [T.road!, P[3]!], [T.east!, P[4]!], [T.lost!, P[5]!],
    [T.arrive! + 2, P[5]! + (PLAN_LEN - P[5]!) * 0.55],
  ];
  // and it fades a step each time she leaves the plan behind
  const gFade: [number, number][] = [[T.ferry!, 0.72], [T.road!, 0.52], [T.east!, 0.38], [T.lost!, 0.2], [T.arrive!, 0]];
  const yKeys: [number, number][] = [
    [T.page!, 1990], [L(7).end, 2004], [L(8).end, 2008], [T.ferry!, 2011], [T.rain!, 2012], [T.feast!, 2014], [T.road!, 2016],
    [T.east!, 2018], [T.lost!, 2021], [T.arrive!, 2024], [T.here!, 2025], [T.final2!, 2026],
  ];
  const YEARS: Record<string, number> = {
    'HOME': 1990, 'THE FERRY': 2011, 'THE BAKERY': 2012, 'THE FEAST': 2014, 'IDA': 2016, "MARA'S": 2018, 'HER FATHER': 2021,
    'WANDERING': 2022, 'THE COAST': 2024, 'THE JETTY': 2024, 'HERE': 2025,
  };
  const LABELS: Record<string, string> = {
    'THE FERRY': 'THE FERRY · 2011', 'THE BAKERY': 'A BAKERY IN THE RAIN · 2012', 'THE FEAST': 'THE FEAST · JONAH · 2014',
    'IDA': 'IDA · 2016', "MARA'S": "MARA'S · 2018", 'HER FATHER': 'HER FATHER · 2021', 'THE COAST': 'THE COAST · 2024', 'HERE': 'HERE · 2025',
  };
  const events: StoryEvent[] = [];
  for (const w of WAY) {
    if (!w.name) continue;
    const wi = WAY.indexOf(w);
    const t = w.name === 'HOME' ? T.page! : timeAtS(sKeys, S(wi));
    events.push({ name: w.name, way: wi, t, year: YEARS[w.name] ?? 0, label: LABELS[w.name] ?? '' });
  }
  const ev = (n: string) => events.find((e) => e.name === n)!.t;
  // the plates, each open while its line is sung (verse 2 is a quick run of four, alternating sides)
  const plates: PlateCue[] = [
    { id: 'ferry', t0: T.ferry! - 0.8, t1: T.verse2! - 1.0, side: 1, anchor: wayIx('THE FERRY') },
    // verse 2: four in quick succession, alternating sides, each open until the next-but-one arrives
    { id: 'bakery', t0: L(10).start - 1.0, t1: L(12).start - 0.65, side: 1, anchor: wayIx('THE BAKERY') },
    { id: 'feast', t0: L(11).start - 0.35, t1: L(13).start - 0.6, side: -1, anchor: wayIx('THE FEAST') },
    { id: 'ida', t0: L(12).start - 0.35, t1: T.pre2! + 0.6, side: 1, anchor: wayIx('IDA') },
    { id: 'oven', t0: L(13).start - 0.3, t1: T.pre2! + 1.8, side: -1, anchor: wayIx("MARA'S") },
    { id: 'father', t0: L(18).end + 0.3, t1: T.bridge! + 0.9, side: -1, anchor: wayIx('HER FATHER') },
    { id: 'light', t0: L(22).start + 0.6, t1: T.final! + 2.4, side: -1, anchor: 'light' },
  ];
  void ev;
  const st = { sKeys, gKeys, gFade, yKeys, events, plates, T };
  cache.set(ly, st);
  return st;
}

/** Piecewise sine-eased interpolation through [time, value] keys. */
export function keyed(k: [number, number][], t: number) {
  if (t <= k[0]![0]) return k[0]![1];
  for (let i = 1; i < k.length; i++) {
    if (t <= k[i]![0]) {
      const [t0, s0] = k[i - 1]!, [t1, s1] = k[i]!;
      return s0 + (s1 - s0) * ease.inOutSine(clamp((t - t0) / Math.max(1e-6, t1 - t0)));
    }
  }
  return k[k.length - 1]![1];
}
/** Km walked at time t. */
export const walked = (st: Story, t: number) => keyed(st.sKeys, t);
/** The ghost's km along the plan, and its opacity. */
export const ghostS = (st: Story, t: number) => keyed(st.gKeys, t);
export function ghostA(st: Story, t: number) {
  let a = 1;
  for (const [t0, v] of st.gFade) {
    if (t < t0) break;
    a = a + (v - a) * ease.inOutSine(clamp((t - t0) / 1.6));
  }
  return a;
}
/** The year shown by the counter (fractional). */
export const yearAt = (st: Story, t: number) => keyed(st.yKeys, t);

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
