// Shared kit for the Pareto plates: paper/ink backgrounds, karaoke text, the red fifth, the 10×10
// grid, the Pareto curve, plate headers. Use these so recurring motifs look identical everywhere.
// Read-only for scene authors (ask the lead for changes).
import * as THREE from 'three';
import { FSPass } from '../engine/gl';
import { HEX, LIN, rgba } from '../engine/palette';
import { F, font, layout, type TextLayout } from '../engine/type';
import { Lyrics, type Line, type Word } from '../engine/lyrics';
import { clamp, ease, lerp, hash } from '../engine/util';

export type C2D = CanvasRenderingContext2D;

// ------------------------------------------------------------------ backgrounds
/**
 * Paper (bone, fibres, faint tooth) or ink (black, faint warm noise) background with an optional
 * hairline grid. `paper` 0..1 blends ink → bone; `grid` = cell size in px (0 = none); `gridA` opacity.
 * `vig` darkens the edges a touch (paper only). Cheap: one noise tap per pixel.
 */
/** 512×512 paper texture (R: tooth, per-texel hash; G: smooth fibre noise, tiles seamlessly). Built once. */
let PAPER_TEX: THREE.DataTexture | null = null;
function paperTex() {
  if (PAPER_TEX) return PAPER_TEX;
  const N = 512, d = new Uint8Array(N * N * 4);
  // tileable value noise for the fibres: lattice of 32×32 with smooth interpolation, two octaves
  const lat = (n: number, s: number) => { const a = new Float32Array(n * n); for (let i = 0; i < n * n; i++) a[i] = hash(i, s); return a; };
  const L1 = lat(32, 5), L2 = lat(64, 9);
  const vn = (L: Float32Array, n: number, x: number, y: number) => {
    const fx = (x / N) * n, fy = (y / N) * n, ix = Math.floor(fx), iy = Math.floor(fy);
    const tx = fx - ix, ty = fy - iy, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const g = (i: number, j: number) => L[((j % n + n) % n) * n + ((i % n + n) % n)]!;
    return lerp(lerp(g(ix, iy), g(ix + 1, iy), sx), lerp(g(ix, iy + 1), g(ix + 1, iy + 1), sx), sy);
  };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = (y * N + x) * 4;
    d[i] = Math.floor(hash(x, y, 3) * 255);
    d[i + 1] = Math.floor((vn(L1, 32, x, y) * 0.65 + vn(L2, 64, x, y) * 0.35) * 255);
    d[i + 2] = 0; d[i + 3] = 255;
  }
  const t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false; t.needsUpdate = true;
  PAPER_TEX = t;
  return t;
}

/**
 * Paper (bone, fibres, faint tooth) or ink (black, faint warm noise) background with an optional
 * hairline grid. `paper` 0..1 blends ink → bone; `grid` = cell size in px (0 = none); `gridA` opacity.
 * `vig` darkens the edges a touch. Cheap: two taps of a precomputed texture per pixel.
 */
export class Ground {
  pass = new FSPass(/* glsl */ `
    uniform float paper, grid, gridA, vig, seed;
    uniform vec2 gridOff;
    uniform sampler2D ptex;
    void main() {
      vec2 p = FRAG_PX;
      float n = texelFetch(ptex, ivec2(mod(floor(p * 0.5) + seed * 37.0, 512.0)), 0).r - 0.5;   // tooth
      float fib = (texture(ptex, vec2(p.x / 4096.0, p.y / 300.0) + seed * 0.37).g - 0.5);       // fibres
      vec3 bone = C_BONE * (1.0 + n * 0.035 + fib * 0.04);
      vec3 ink = C_INK * (1.0 + n * 0.25) + vec3(0.002) * fib;
      vec3 col = mix(ink, bone, paper);
      if (grid > 0.5) {
        vec2 g = abs(fract((p - gridOff) / grid + 0.5) - 0.5) * grid;
        float l = pxLine(min(g.x, g.y), 0.35, 1.1);
        vec3 lc = mix(C_GRAPHITE * 0.55, mix(C_ASH, C_GRAPHITE, 0.4), paper);
        col = mix(col, lc, l * gridA);
      }
      vec2 q = vUv - 0.5;
      col *= 1.0 - vig * dot(q, q) * 1.2;
      fragColor = vec4(col, 1.0);
    }`, {
    paper: { value: 1 }, grid: { value: 0 }, gridA: { value: 0.35 }, vig: { value: 0.25 }, seed: { value: 0 },
    gridOff: { value: new THREE.Vector2(0, 0) }, ptex: { value: paperTex() },
  });
  render(renderer: THREE.WebGLRenderer, out: THREE.WebGLRenderTarget, o: { paper?: number; grid?: number; gridA?: number; vig?: number; seed?: number; gridOff?: [number, number] } = {}) {
    const u = this.pass.u;
    u.paper!.value = o.paper ?? 1; u.grid!.value = o.grid ?? 0; u.gridA!.value = o.gridA ?? 0.35; u.vig!.value = o.vig ?? 0.25; u.seed!.value = o.seed ?? 0;
    (u.gridOff!.value as THREE.Vector2).set(o.gridOff?.[0] ?? 0, o.gridOff?.[1] ?? 0);
    this.pass.render(renderer, out);
  }
}

/** Colour of "ink" on the current ground: ink on paper, bone on dark. */
export const fg = (paper: boolean, a = 1) => rgba(paper ? 'ink' : 'bone', a);
export const RED = (a = 1) => rgba('signal', a);

// ------------------------------------------------------------------ the Pareto curve
/** Cumulative share of effects from the top x of causes: concave, y(0.2) = 0.8 exactly. */
export const PARETO_K = Math.log(0.2) / Math.log(0.8); // 7.2126
export const pareto = (x: number) => 1 - Math.pow(1 - clamp(x), PARETO_K);

/**
 * Draws the Pareto chart curve in a box (x0,y0 = bottom-left, w,h), revealed to `reveal` (0..1 of x),
 * with the 80/20 guides once the pen passes 0.2. Returns the pen position.
 */
export function drawParetoCurve(c: C2D, x0: number, y0: number, w: number, h: number, reveal: number, o: { paper?: boolean; lw?: number; guides?: number; label?: boolean; color?: string } = {}) {
  const paper = o.paper ?? true;
  const r = clamp(reveal);
  c.save();
  c.lineCap = 'round'; c.lineJoin = 'round';
  // guides
  const g = clamp(o.guides ?? (r > 0.2 ? (r - 0.2) / 0.15 : 0));
  if (g > 0) {
    const gx = x0 + 0.2 * w, gy = y0 - 0.8 * h;
    c.setLineDash([6, 6]);
    c.strokeStyle = fg(paper, 0.45 * g); c.lineWidth = 1;
    c.beginPath(); c.moveTo(gx, y0); c.lineTo(gx, lerp(y0, gy, ease.outCubic(g))); c.stroke();
    c.beginPath(); c.moveTo(x0, gy); c.lineTo(lerp(x0, gx, ease.outCubic(g)), gy); c.stroke();
    c.setLineDash([]);
    if (o.label !== false) {
      c.font = font(F.mono(500), 15); c.fillStyle = fg(paper, 0.8 * g);
      c.textAlign = 'center'; c.fillText('20%', gx, y0 + 26);
      c.textAlign = 'right'; c.fillText('80%', x0 - 12, gy + 5);
      c.textAlign = 'left';
    }
  }
  // curve
  c.strokeStyle = o.color ?? RED(); c.lineWidth = o.lw ?? 3;
  c.beginPath();
  const n = 120;
  let px = x0, py = y0;
  for (let i = 0; i <= n; i++) {
    const x = (i / n) * r;
    px = x0 + x * w; py = y0 - pareto(x) * h;
    if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
  }
  c.stroke();
  if (r > 0.2) {
    c.fillStyle = RED();
    c.beginPath(); c.arc(x0 + 0.2 * w, y0 - 0.8 * h, 6 + 3 * clamp(1 - (r - 0.2) * 6), 0, Math.PI * 2); c.fill();
  }
  c.restore();
  return { x: px, y: py };
}

// ------------------------------------------------------------------ the red fifth
/**
 * A bar split 80/20: graphite 4/5, signal-red 1/5 (on the right by default). `split` animates 0..1 the
 * red fifth growing in; `fill` 0..1 reveals the whole bar left→right. `red` = which end ('right'|'left').
 */
export function drawFifthBar(c: C2D, x: number, y: number, w: number, h: number, o: { paper?: boolean; split?: number; fill?: number; red?: 'right' | 'left'; labels?: boolean; gap?: number } = {}) {
  const paper = o.paper ?? true, fill = clamp(o.fill ?? 1), split = clamp(o.split ?? 1), gap = o.gap ?? 4;
  const redRight = (o.red ?? 'right') === 'right';
  const wGrey = w * 0.8 - gap / 2, wRed = w * 0.2 - gap / 2;
  c.save();
  c.beginPath(); c.rect(x, y - 1, w * fill, h + 2); c.clip();
  c.fillStyle = paper ? rgba('graphite', 0.85) : rgba('graphite', 0.9);
  if (redRight) c.fillRect(x, y, wGrey, h); else c.fillRect(x + wRed + gap, y, wGrey, h);
  c.fillStyle = RED();
  const rw = wRed * ease.outExpo(split);
  if (redRight) c.fillRect(x + w - rw, y, rw, h); else c.fillRect(x, y, rw, h);
  c.restore();
  if (o.labels) {
    c.save();
    c.font = font(F.mono(500), 14); c.fillStyle = fg(paper, 0.7 * fill); c.textBaseline = 'top';
    const gx = redRight ? x : x + wRed + gap, rx = redRight ? x + w - wRed : x;
    c.fillText('80%', gx, y + h + 8);
    c.fillStyle = RED(fill * split); c.fillText('20%', rx, y + h + 8);
    c.restore();
  }
}

/** A 72° wedge (one fifth of a circle) — the red fifth as a pie slice. `k` 0..1 sweeps it in. */
export function drawFifthWedge(c: C2D, x: number, y: number, r: number, a0: number, k = 1, color = RED()) {
  const a1 = a0 + (Math.PI * 2 * 0.2) * ease.outCubic(clamp(k));
  c.save(); c.fillStyle = color;
  c.beginPath(); c.moveTo(x, y); c.arc(x, y, r, a0, a1); c.closePath(); c.fill();
  c.restore();
}

// ------------------------------------------------------------------ the 10×10 grid
/** The 20 "vital" cells (deterministic, scattered): indices 0..99. */
export const VITAL20: number[] = (() => {
  const idx = Array.from({ length: 100 }, (_, i) => i);
  idx.sort((a, b) => hash(a, 77) - hash(b, 77));
  return idx.slice(0, 20).sort((a, b) => a - b);
})();
export const isVital = (i: number) => VITAL20.includes(i);

/**
 * Draws the 10×10 grid at (x, y) top-left with cell size `cell` and gap. `style(i)` returns
 * { fill, a, scale } per cell (fill = CSS colour or null for outline only).
 */
export function drawGrid100(c: C2D, x: number, y: number, cell: number, gap: number, style: (i: number) => { fill: string | null; a?: number; scale?: number; stroke?: string }) {
  c.save();
  for (let i = 0; i < 100; i++) {
    const cx = x + (i % 10) * (cell + gap), cy = y + Math.floor(i / 10) * (cell + gap);
    const s = style(i);
    const sc = s.scale ?? 1;
    if (sc <= 0.001) continue;
    const d = (cell * (1 - sc)) / 2;
    c.globalAlpha = s.a ?? 1;
    if (s.fill) { c.fillStyle = s.fill; c.fillRect(cx + d, cy + d, cell * sc, cell * sc); }
    if (s.stroke) { c.strokeStyle = s.stroke; c.lineWidth = 1; c.strokeRect(cx + d + 0.5, cy + d + 0.5, cell * sc - 1, cell * sc - 1); }
  }
  c.restore();
}

// ------------------------------------------------------------------ plate header (the almanac's running head)
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV'];
/**
 * Small running head top-left: "PLATE IV — BREAKFAST, ENGRAVED" in mono with a hairline rule, and an
 * optional right-hand note. `k` 0..1 = entrance (rule draws, text types).
 */
export function drawPlateHead(c: C2D, n: number, title: string, k: number, o: { paper?: boolean; right?: string; y?: number; x0?: number; x1?: number } = {}) {
  const paper = o.paper ?? true, y = o.y ?? 64, x0 = o.x0 ?? 96, x1 = o.x1 ?? 1920 - 96;
  const kk = clamp(k);
  if (kk <= 0) return;
  c.save();
  c.strokeStyle = fg(paper, 0.5); c.lineWidth = 1;
  c.beginPath(); c.moveTo(x0, y + 12); c.lineTo(lerp(x0, x1, ease.outExpo(kk)), y + 12); c.stroke();
  c.font = font(F.mono(500), 14); c.fillStyle = fg(paper, 0.75); c.textBaseline = 'alphabetic';
  const head = `PLATE ${ROMAN[n] ?? n} — ${title.toUpperCase()}`;
  const nch = Math.floor(head.length * clamp(kk * 1.6));
  c.fillText(head.slice(0, nch), x0, y);
  if (o.right) {
    c.textAlign = 'right'; c.fillStyle = fg(paper, 0.55);
    c.fillText(o.right.slice(0, Math.floor(o.right.length * clamp(kk * 1.6 - 0.3))), x1, y);
  }
  c.restore();
}

/** A deadpan mono footnote (small, dim) — e.g. "¹ n = 1 flat; source: the kettle". */
export function footnote(c: C2D, text: string, x: number, y: number, o: { paper?: boolean; a?: number; size?: number; align?: CanvasTextAlign } = {}) {
  c.save();
  c.font = font(F.mono(400), o.size ?? 13); c.fillStyle = fg(o.paper ?? true, (o.a ?? 1) * 0.6);
  c.textAlign = o.align ?? 'left'; c.textBaseline = 'alphabetic';
  c.fillText(text, x, y);
  c.restore();
}

// ------------------------------------------------------------------ karaoke
/** Words that carry the line's meaning (drawn in signal red when sung). Lower-case, punctuation stripped. */
export const KEY_WORDS = new Set([
  'eighty', 'percent', 'fourfifths', 'hundred', 'twenty', 'charred', 'bloody', 'hard', 'wornout', 'news',
  'lot', 'cream', 'filler', 'weight', 'great', 'lopsided', 'mathematical', 'high', 'fraction', 'fly',
  'camden', 'blur', 'wasted', 'wink', 'fifth', 'smile', 'friday', 'noise', 'shadows', 'toys', 'two', 'ten', 'rain', 'static', 'drain',
  'pareto', 'score', 'peas', 'rich', 'poor', 'law', 'stone', 'vital', 'few', 'fat', 'wire', 'fire',
  'vibe', 'alive', 'pint', 'you', 'math', 'art', 'smallest', 'biggest',
]);
export const wkey = (w: string) => w.toLowerCase().replace(/[^a-z]/g, '');
export const isKey = (w: Word | string) => KEY_WORDS.has(wkey(typeof w === 'string' ? w : w.w));

export interface KaraokeStyle {
  family: string;
  size: number;
  paper?: boolean; // ink on paper (true) or bone on dark (false)
  tracking?: number;
  /** unsung opacity */
  dim?: number;
  /** seconds of anticipation (line shows dim this early) */
  lead?: number;
  /** colour for sung non-key words (default ink/bone) and key words (default signal) */
  sung?: string;
  key?: string;
  /** set false to colour no key words red */
  keys?: boolean;
  /** word pop: scale bump at word start */
  pop?: number;
  /** words appear only when sung (no dim preview) */
  reveal?: boolean;
  align?: 'left' | 'center' | 'right';
  /** extra space between words in em (default: the font's space) */
  space?: number;
}

export interface WordBox { w: Word; x: number; y: number; width: number; lay: TextLayout; p: number }

/**
 * Lays out and draws words on one baseline at (x, y) with per-word karaoke state. Sung words get the
 * full colour (key words red), the word being sung is wiped glyph by glyph, unsung words are dim.
 * Returns the word boxes (for decorations: underlines, strike-throughs, leader lines).
 */
export function drawKaraokeWords(c: C2D, words: Word[], t: number, x: number, y: number, s: KaraokeStyle): WordBox[] {
  const paper = s.paper ?? true;
  const dim = s.dim ?? 0.28;
  const base = s.sung ?? fg(paper);
  const keyCol = s.key ?? RED();
  c.save();
  c.font = font(s.family, s.size); c.textBaseline = 'alphabetic'; c.textAlign = 'left';
  const space = (s.space ?? null) !== null ? s.space! * s.size : c.measureText(' ').width;
  const lays = words.map((w) => layout(w.w, s.family, s.size, s.tracking ?? 0));
  const total = lays.reduce((a, l) => a + l.width, 0) + space * Math.max(0, words.length - 1);
  let cx = s.align === 'center' ? x - total / 2 : s.align === 'right' ? x - total : x;
  const boxes: WordBox[] = [];
  const lead = s.lead ?? 0.4;
  words.forEach((w, i) => {
    const lay = lays[i]!;
    const p = Lyrics.wordProgress(w, t);
    const vis = s.reveal ? t >= w.start - 0.02 : t >= words[0]!.start - lead;
    if (vis) {
      const col = (s.keys ?? true) && isKey(w) ? keyCol : base;
      const pop = (s.pop ?? 0) * Math.max(0, 1 - (t - w.start) / 0.22) * (t >= w.start ? 1 : 0);
      c.save();
      if (pop > 0) {
        const mx = cx + lay.width / 2;
        c.translate(mx, y); c.scale(1 + pop, 1 + pop); c.translate(-mx, -y);
      }
      // per-glyph wipe
      const nG = lay.glyphs.length;
      const sungG = p * nG;
      for (const g of lay.glyphs) {
        const k = clamp(sungG - g.i);
        if (k >= 1) { c.fillStyle = col; c.globalAlpha = 1; }
        else if (k > 0) { c.fillStyle = col; c.globalAlpha = lerp(dim, 1, k); }
        else { c.fillStyle = base; c.globalAlpha = s.reveal ? 0 : dim; }
        if (c.globalAlpha > 0) c.fillText(g.ch, cx + g.x, y);
      }
      c.restore();
    }
    boxes.push({ w, x: cx, y, width: lay.width, lay, p });
    cx += lay.width + space;
  });
  c.restore();
  return boxes;
}

/** Splits a line's words into rows that fit maxWidth (greedy) at the given font/size. */
export function wrapWords(words: Word[], family: string, size: number, maxWidth: number, tracking = 0): Word[][] {
  const rows: Word[][] = [];
  let row: Word[] = [], w = 0;
  const c = document.createElement('canvas').getContext('2d')!;
  c.font = font(family, size);
  const sp = c.measureText(' ').width;
  for (const word of words) {
    const ww = layout(word.w, family, size, tracking).width;
    if (row.length && w + sp + ww > maxWidth) { rows.push(row); row = []; w = 0; }
    w += (row.length ? sp : 0) + ww; row.push(word);
  }
  if (row.length) rows.push(row);
  return rows;
}

/** Line helpers by content. */
export const lineWords = (l: Line) => l.words;
/** First word in a line whose text matches (case/punct-insensitive). */
export function wordIn(l: Line, q: string, nth = 0): Word {
  const k = wkey(q);
  const ws = l.words.filter((w) => wkey(w.w) === k);
  const w = ws[nth];
  if (!w) throw new Error(`word not found: ${q} in "${l.text}"`);
  return w;
}

/** Ink colour constants for Canvas2D. */
export const COL = {
  ink: HEX.ink, ink2: HEX.ink2, graphite: HEX.graphite, ash: HEX.ash, bone: HEX.bone,
  signal: HEX.signal, ember: HEX.ember, blood: HEX.blood, gold: HEX.gold,
};
export const LINC = LIN;

/** Beat-synced punch: 1 at the beat, decaying (for scale/brightness bumps on every beat). */
export const beatPunch = (beatPhase: number, sharp = 6) => Math.exp(-beatPhase * sharp);

/**
 * Post-processing presets. Paper plates MUST switch halation off (the film halation tints a bright page
 * pink) and keep bloom low; dark plates keep a little halation for the red glows. Spread and override:
 * `return { ...PAPER_POST, shake: [x, y] }`.
 */
export const PAPER_POST = { paper: 1, bloom: 0.15, halation: 0, ca: 0.5, vignette: 0.2 } as const;
export const INK_POST = { paper: 0, bloom: 0.6, halation: 0.12, ca: 0.9, vignette: 0.35 } as const;
