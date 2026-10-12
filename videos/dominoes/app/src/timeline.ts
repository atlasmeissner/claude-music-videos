// The edit: the stations in order along the machine, extra camera keys, and the ink/paper rhythm.
import { type CamKey } from './engine/camera';
import { H, type R, W } from './engine/draw';
import { ease } from './engine/util';
import { type Station } from './station';
import { intro } from './stations/intro';
import { thread } from './stations/thread';
import { river } from './stations/river';
import { tube } from './stations/tube';
import { matchSt } from './stations/match';
import { stops, CHORUS_X } from './stations/stops';
import { makeChorus } from './stations/chorus';
import { LN } from './station';
import { makeGalton } from './stations/galton';
import { makeMap } from './stations/map';
import { makeStairs } from './stations/stairs';
import { makeGeo } from './stations/geo';

export const chorus1 = makeChorus({ id: 'chorus1', x: CHORUS_X + 1000, lines: [...LN.c1], variant: 1, end: 50.24 });

export const galton = makeGalton({ x: chorus1.x1 + 900 });

export const map = makeMap(galton.station.x1 + 1100, { t: galton.exit.t + 0.4 });

export const stairs = makeStairs(map.station.x1 + 900, -900);
export const chorus2 = makeChorus({ id: 'chorus2', x: stairs.exitX + 1400, lines: [...LN.c2], variant: 2, end: 96.52 });

export const geo = makeGeo(chorus2.x1 + 1500, -900, chorus2.x1, () => STATIONS.filter((s) => s.id !== 'geo'));

export const STATIONS: Station[] = [intro, thread, river, tube, matchSt, stops, chorus1, galton.station, map.station, stairs.station, chorus2, geo.station];

export const EXTRA_CAM: CamKey[] = [];

export interface ThemeKey { t: number; theme: 'ink' | 'paper'; dur: number; wipe: (r: R, u: number) => void }

/** A slab falling across the frame from the left edge, face-on: the incoming theme is behind it. */
export const slabWipe = (dir: 1 | -1 = 1) => (r: R, u: number) => {
  const g = r.g;
  const k = ease.inQuad(u);
  // a hinged slab: its far edge sweeps across the screen
  const x = dir > 0 ? k * (W + 200) - 100 : W + 100 - k * (W + 200);
  const lean = (1 - k) * 160;
  g.beginPath();
  if (dir > 0) {
    g.moveTo(-10, -10);
    g.lineTo(x + lean, -10);
    g.lineTo(x, H + 10);
    g.lineTo(-10, H + 10);
  } else {
    g.moveTo(W + 10, -10);
    g.lineTo(x - lean, -10);
    g.lineTo(x, H + 10);
    g.lineTo(W + 10, H + 10);
  }
  g.closePath();
};

export const THEME_KEYS: ThemeKey[] = [
  { t: 0, theme: 'ink', dur: 0, wipe: () => {} },
  { t: 37.17, theme: 'paper', dur: 0.32, wipe: slabWipe(1) },
  { t: 50.24, theme: 'ink', dur: 0.3, wipe: slabWipe(-1) },
  { t: 83.16, theme: 'paper', dur: 0.3, wipe: slabWipe(1) },
  { t: 96.52, theme: 'ink', dur: 0.35, wipe: slabWipe(-1) },
];
