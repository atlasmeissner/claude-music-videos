// Song timing data (data/audio.json, produced by analysis/analyze.py).
import raw from '../../../data/audio.json';
import { clamp } from './util';

interface AudioJson {
  duration: number;
  bpm: number;
  beat_period: number;
  beats: number[];
  downbeats: number[];
  onsets: [number, number][];
  acc_onsets: [number, number][];
  hi_onsets: [number, number][];
  env_hz: number;
  loud: number[];
  vocal_loud: number[];
  acc_loud: number[];
}
const A = raw as unknown as AudioJson;

export const DURATION = A.duration;
export const BEAT = A.beat_period;
export const BEATS = A.beats;
export const DOWNBEATS = A.downbeats;
export const BAR = BEAT * 4;

function bsearch(arr: number[], t: number) {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (arr[m]! < t) lo = m + 1; else hi = m;
  }
  return lo; // first index with arr[i] >= t
}

/** Nearest beat time to t. */
export function snapBeat(t: number) {
  const i = bsearch(BEATS, t);
  const a = BEATS[Math.max(0, i - 1)]!, b = BEATS[Math.min(BEATS.length - 1, i)]!;
  return Math.abs(a - t) <= Math.abs(b - t) ? a : b;
}
/** Nearest downbeat to t. */
export function snapBar(t: number) {
  const i = bsearch(DOWNBEATS, t);
  const a = DOWNBEATS[Math.max(0, i - 1)]!, b = DOWNBEATS[Math.min(DOWNBEATS.length - 1, i)]!;
  return Math.abs(a - t) <= Math.abs(b - t) ? a : b;
}
/** The n-th beat at or after t (n = 0: the first beat >= t). */
export function beatAfter(t: number, n = 0) {
  return BEATS[Math.min(BEATS.length - 1, bsearch(BEATS, t - 1e-6) + n)]!;
}
export function barAfter(t: number, n = 0) {
  return DOWNBEATS[Math.min(DOWNBEATS.length - 1, bsearch(DOWNBEATS, t - 1e-6) + n)]!;
}
/** Beats in [a, b). */
export function beatsIn(a: number, b: number) {
  return BEATS.slice(bsearch(BEATS, a), bsearch(BEATS, b));
}
/** Position within the current beat (0..1) and the beat's index. */
export function beatPhase(t: number) {
  const i = Math.max(0, bsearch(BEATS, t + 1e-9) - 1);
  const a = BEATS[i]!, b = BEATS[i + 1] ?? a + BEAT;
  return { i, u: clamp((t - a) / (b - a)), t0: a };
}

type OnsetKey = 'onsets' | 'acc_onsets' | 'hi_onsets';
/** Onsets (time, strength 0..1) in [a, b). */
export function onsetsIn(a: number, b: number, key: OnsetKey = 'acc_onsets', minStrength = 0) {
  const arr = A[key];
  const out: [number, number][] = [];
  for (const o of arr) if (o[0] >= a && o[0] < b && o[1] >= minStrength) out.push(o);
  return out;
}

type EnvKey = 'loud' | 'vocal_loud' | 'acc_loud';
/** Loudness envelope (0..1), linearly interpolated, optionally averaged over a window (s). */
export function loud(t: number, key: EnvKey = 'loud', win = 0) {
  const env = A[key];
  const hz = A.env_hz;
  if (win <= 0) {
    const x = clamp(t * hz, 0, env.length - 1);
    const i = Math.floor(x), f = x - i;
    return env[i]! * (1 - f) + (env[Math.min(env.length - 1, i + 1)]! * f);
  }
  const i0 = Math.max(0, Math.floor((t - win / 2) * hz)), i1 = Math.min(env.length, Math.ceil((t + win / 2) * hz));
  let s = 0;
  for (let i = i0; i < i1; i++) s += env[i]!;
  return i1 > i0 ? s / (i1 - i0) : 0;
}
