import { hexToLinear } from './util';

// The whole video lives in a restrained palette: ink, bone, and one signal colour (red).
// One rare accent (gold: the fire and the pint) — see docs/TREATMENT.md.
export const HEX = {
  ink: '#0C0C0E', // background black
  ink2: '#17171A', // raised black (panels, paper-in-the-dark)
  graphite: '#5E5B57', // dim lines, secondary text, the 80%
  ash: '#9C978F', // mid grey
  bone: '#F1EBDD', // paper white, primary text
  signal: '#E8341C', // pillar-box red: the red fifth, the vital few, the sung key word
  ember: '#FF7A4A', // hotter, lighter red for cores/highlights
  blood: '#A3170E', // deep red for shadows of signal
  gold: '#F2B13A', // rare accent: the fire and the pint only
  acid: '#D8FF3C', // (legacy key, unused in Pareto)
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
