// The palette of pdoom-video: ink, bone and one signal colour. No other hues.
export const HEX = {
  ink: '#0A0A0B', // background black (slightly warm)
  ink2: '#151517', // raised black (panels)
  graphite: '#5E5B57', // dim lines, spent parts
  ash: '#9C978F', // mid grey
  bone: '#EEE9DF', // paper white, primary lines and type
  signal: '#FF4D12', // the impulse: whatever is moving right now, the sung word
  ember: '#FF8A3D', // hot cores
  blood: '#C21D0B', // deep shadow of signal
} as const;
export type PaletteKey = keyof typeof HEX;

export type RGB = [number, number, number];
export const rgbOf = (hex: string): RGB => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export const RGBS = Object.fromEntries(Object.entries(HEX).map(([k, v]) => [k, rgbOf(v)])) as Record<PaletteKey, RGB>;

export const mixRGB = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const css = (c: RGB, a = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;

/**
 * A theme maps roles to colours. `ink` = bone lines on a black ground (night blueprint);
 * `paper` = ink lines on bone paper. Orange is the same in both.
 */
export interface Theme {
  name: 'ink' | 'paper';
  bg: RGB; // ground
  fg: RGB; // primary lines/type
  mid: RGB; // secondary
  dim: RGB; // spent parts, faint construction lines
  faint: RGB; // grid, hatching
  panel: RGB; // fill of solid parts (occludes what is behind)
  sig: RGB;
  ember: RGB;
  blood: RGB;
}
export const THEMES: Record<'ink' | 'paper', Theme> = {
  ink: {
    name: 'ink',
    bg: RGBS.ink, fg: RGBS.bone, mid: RGBS.ash, dim: RGBS.graphite, faint: [38, 37, 36], panel: RGBS.ink,
    sig: RGBS.signal, ember: RGBS.ember, blood: RGBS.blood,
  },
  paper: {
    name: 'paper',
    bg: RGBS.bone, fg: RGBS.ink, mid: [92, 89, 85], dim: [160, 155, 147], faint: [214, 209, 199], panel: RGBS.bone,
    sig: RGBS.signal, ember: [232, 90, 30], blood: RGBS.blood,
  },
};
