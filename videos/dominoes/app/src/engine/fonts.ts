// Font registry. Every font file is its own family (static instances of the variable fonts), so the
// same CSS font strings work in the browser (FontFace) and in the offline renderer (@napi-rs/canvas).

export const ARCHIVO_WIDTHS = [620, 750, 875, 1000, 1125, 1250] as const;
export const ARCHIVO_WEIGHTS = [300, 500, 700, 900] as const;

export interface FontFile { family: string; file: string; weight: number; style: 'normal' | 'italic' }

export const FONT_FILES: FontFile[] = [
  ...ARCHIVO_WIDTHS.flatMap((w) =>
    ARCHIVO_WEIGHTS.map((wt) => ({ family: `Archivo-w${w}-${wt}`, file: `Archivo-w${w}-${wt}.ttf`, weight: wt, style: 'normal' as const })),
  ),
  ...[750, 1000].flatMap((w) =>
    [400, 800].map((wt) => ({ family: `ArchivoItalic-w${w}-${wt}`, file: `ArchivoItalic-w${w}-${wt}.ttf`, weight: wt, style: 'italic' as const })),
  ),
  { family: 'Cormorant-400', file: 'Cormorant-400.ttf', weight: 400, style: 'normal' },
  { family: 'Cormorant-600', file: 'Cormorant-600.ttf', weight: 600, style: 'normal' },
  { family: 'CormorantItalic-400', file: 'CormorantItalic-400.ttf', weight: 400, style: 'italic' },
  { family: 'CormorantItalic-600', file: 'CormorantItalic-600.ttf', weight: 600, style: 'italic' },
  { family: 'PlexMono-300', file: 'IBMPlexMono-Light.ttf', weight: 300, style: 'normal' },
  { family: 'PlexMono-400', file: 'IBMPlexMono-Regular.ttf', weight: 400, style: 'normal' },
  { family: 'PlexMono-500', file: 'IBMPlexMono-Medium.ttf', weight: 500, style: 'normal' },
  { family: 'PlexMono-600', file: 'IBMPlexMono-SemiBold.ttf', weight: 600, style: 'normal' },
];

const nearest = <T extends number>(arr: readonly T[], v: number): T =>
  arr.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));

/** Archivo at the nearest available width (62–125 %, as 620–1250) and weight. */
export const archivo = (size: number, width = 1000, weight = 700) => {
  const w = nearest(ARCHIVO_WIDTHS, width), wt = nearest(ARCHIVO_WEIGHTS, weight);
  return `${wt} ${size}px "Archivo-w${w}-${wt}"`;
};
export const archivoItalic = (size: number, width = 1000, weight = 800) => {
  const w = nearest([750, 1000] as const, width), wt = nearest([400, 800] as const, weight);
  return `italic ${wt} ${size}px "ArchivoItalic-w${w}-${wt}"`;
};
export const mono = (size: number, weight = 400) => {
  const wt = nearest([300, 400, 500, 600] as const, weight);
  return `${wt} ${size}px "PlexMono-${wt}"`;
};
export const cormorant = (size: number, italic = true, weight = 400) => {
  const wt = nearest([400, 600] as const, weight);
  return `${italic ? 'italic ' : ''}${wt} ${size}px "${italic ? 'CormorantItalic' : 'Cormorant'}-${wt}"`;
};
