import { hexToLinear } from './util';

// Bones lives in a bone-and-ink palette: warm black, bone white, and one hot colour, the vermilion of a
// builder's chalk line (the point, the sung word, the first true line). One rare accent, `gold` (= acid), is
// owned by the inherited ornament: it only ever appears on things that are about to be stripped away.
export const HEX = {
  ink: '#0B0A09', // warm black
  ink2: '#171513', // raised black (panels, paper-in-the-dark)
  graphite: '#5E5A54', // dim lines, secondary text
  ash: '#9E978C', // mid grey
  bone: '#EDE5D3', // bone white: paper, type, the bones themselves
  signal: '#FF5326', // chalk-line vermilion: the point, the sung word
  ember: '#FF9A5C', // hotter, lighter orange for cores/highlights
  blood: '#A8240E', // deep red for shadows of signal
  acid: '#C8A04A', // gold leaf: the inherited ornament (never glows)
  gold: '#C8A04A',
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
