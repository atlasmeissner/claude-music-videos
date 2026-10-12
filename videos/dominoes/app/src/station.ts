// A station is one stage of the machine: a region of the world with its own parts, drawn as a pure
// function of song time (before its window it shows its initial state, after it its spent state).
import { type CamKey } from './engine/camera';
import { type R } from './engine/draw';

export interface Station {
  id: string;
  /** world bounds (for culling) */
  x0: number; x1: number; y0: number; y1: number;
  /** when the station is doing something */
  t0: number; t1: number;
  /** camera keys contributed by this station */
  cam?: CamKey[];
  /** camera function overriding the keys inside [t0, t1] (blended in/out over `blend` s) */
  camFollow?: { t0: number; t1: number; blend?: number; fn: (r: R, t: number) => { x: number; y: number; z: number } };
  /** impact times for camera shake */
  hits?: { t: number; amp: number; hl?: number }[];
  draw(r: R, t: number): void;
  /** optional screen-space overlay (drawn after the world, before post) */
  overlay?(r: R, t: number): void;
  /** world point where the impulse is at time t (for the echo network and the order counter) */
  impulse?(t: number): { x: number; y: number } | null;
}

/** Line indices into data/lyrics.json, by role. */
export const LN = {
  thread: 0, stone: 1, word: 2, alight: 3, stops: 4, bends: 5,
  c1: [6, 7, 8, 9],
  left: 10, war: 11, held: 12, ledto: 13, step: 14, been: 15,
  c2: [16, 17, 18, 19],
  small: 20, remember: 21, life: 22,
  fin: [23, 24, 25, 26, 27, 28, 29],
  fin2: [30, 31, 32, 33],
} as const;
