import { hexToLinear } from './util';

// Maps & Territory lives in the palette of the album cover: a night sea (cool ink), map paper (bone) with ink
// hairlines, and one warm signal colour, the lamplight gold of the walked track (the traveller's light, the sung
// word, the French horn's call). One rare accent, `acid`, is the sea itself: a pale teal owned by the shore.
export const HEX = {
  ink: '#0A1013', // night sea (cool teal-black)
  ink2: '#131B1F', // raised black (panels, paper in the dark)
  graphite: '#56615F', // dim lines, secondary text
  ash: '#99A19B', // mid grey
  bone: '#EEE7D6', // map paper, primary text
  signal: '#F0962E', // lamplight amber-gold: the walked track, the sung word, the horn
  ember: '#FFCF7A', // gold core / highlights
  blood: '#8A6424', // deep ochre (signal's shadow; ink accents on paper) — no red anywhere
  acid: '#5FB3AA', // sea teal: only the shore and the sea
} as const;

export type PaletteKey = keyof typeof HEX;

/** Linear RGB triplets for GL uniforms. */
export const LIN: Record<PaletteKey, [number, number, number]> = Object.fromEntries(
  Object.entries(HEX).map(([k, v]) => [k, hexToLinear(v)]),
) as Record<PaletteKey, [number, number, number]>;

/** CSS rgba() for Canvas2D. */
export function rgba(key: PaletteKey | string, a = 1): string {
  const hex = (HEX as Record<string, string>)[key] ?? key;
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
