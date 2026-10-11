import { hexToLinear } from './util';

// One Degree lives in a restrained dawn palette: ink, bone, and one warm signal colour (the needle's tip,
// the sung word, the sun). One rare accent, `acid` (here a pale dawn gold), owned by the final sunrise.
export const HEX = {
  ink: '#0A0B0D', // night (slightly cool black)
  ink2: '#15171A', // raised black (panels, paper-in-the-dark)
  graphite: '#5B5D5F', // dim lines, secondary text
  ash: '#9B988F', // mid grey
  bone: '#F0EBE0', // paper white, primary text
  signal: '#FF6A1F', // sunrise orange: the needle's tip, the degree, the sung word
  ember: '#FFA552', // hotter, lighter orange-gold for cores/highlights
  blood: '#B23A14', // deep red-orange for shadows of signal
  acid: '#FFD58A', // pale dawn gold: only the final sunrise
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
