// Shared kit for "The Other Side of Light": the atlas plates.
//  - IMAGES: Creative Commons / CC0 photographs and prints (public/cc/, manifest.json with credits),
//    drawn as printed plates through one shader (tone, engraving line-screen, halftone; negative;
//    highlight glow; wipes, irises and burns), so every picture lives in the video's ink / bone / signal palette.
//  - TYPE: karaoke words (per-word wipes synced to the vocal) and the plate captions (credit lines in mono).
//  - THE LAMP: the orange point of light (the pdoom spark, reused) that walks every route in the atlas.
import * as THREE from 'three';
import { W, H, SCALE } from '../engine/gl';
import { GLSL_COMMON } from '../engine/glsl/common';
import { LIN, rgba } from '../engine/palette';
import { F, font, measure } from '../engine/type';
import { Lyrics, type Word, type Line } from '../engine/lyrics';
import { clamp, lerp } from '../engine/util';

// ------------------------------------------------------------------ image bank
export interface ImgMeta { lum: [number, number, number]; id: string; file: string; w: number; h: number; title: string; creator: string; license: string; source: string; landing: string; plate: number }
let MANIFEST: Record<string, ImgMeta> | null = null;
const TEX = new Map<string, Promise<THREE.Texture>>();
const TEX_READY = new Map<string, THREE.Texture>();

export async function manifest(): Promise<Record<string, ImgMeta>> {
  if (!MANIFEST) MANIFEST = await (await fetch('cc/manifest.json')).json();
  return MANIFEST!;
}
export function meta(id: string): ImgMeta {
  const m = MANIFEST?.[id];
  if (!m) throw new Error(`image not in manifest: ${id}`);
  return m;
}
/** Load (once) the textures of these image ids. Call from init(); afterwards tex(id) is synchronous. */
export async function loadImages(ids: string[]) {
  const man = await manifest();
  const loader = new THREE.TextureLoader();
  await Promise.all(ids.map((id) => {
    // '@file.jpg': a raw file in public/cc (the atlas sheet), not a plate
    if (!id.startsWith('@') && !man[id]) throw new Error(`image not in manifest: ${id}`);
    let p = TEX.get(id);
    if (!p) {
      p = loader.loadAsync(`cc/${id.startsWith('@') ? id.slice(1) : man[id]!.file}`).then((t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.minFilter = THREE.LinearMipmapLinearFilter;
        t.magFilter = THREE.LinearFilter;
        t.generateMipmaps = true;
        t.anisotropy = 4;
        TEX_READY.set(id, t);
        return t;
      });
      TEX.set(id, p);
    }
    return p;
  }));
}
export function tex(id: string): THREE.Texture {
  const t = TEX_READY.get(id);
  if (!t) throw new Error(`texture not loaded: ${id}`);
  return t;
}

// ------------------------------------------------------------------ plate shader
export type Treat = 'tone' | 'engrave' | 'halftone' | 'photo';
const TREAT: Record<Treat, number> = { tone: 0, engrave: 1, halftone: 2, photo: 3 };
export type Reveal = 'none' | 'wipe' | 'iris' | 'burn' | 'blinds';
const REVEAL: Record<Reveal, number> = { none: 0, wipe: 1, iris: 2, burn: 3, blinds: 4 };

export interface PlateOpts {
  /** destination rect in logical px (top-left x, y, width, height) */
  x: number; y: number; w: number; h: number;
  rot?: number;
  /** cover-fit zoom inside the rect (1 = cover) and pan (-1..1 of the slack, + extra), Ken Burns */
  zoom?: number; panX?: number; panY?: number;
  flipX?: boolean;
  treat?: Treat;
  /** 0..1 photographic negative */
  invert?: number;
  /** tone curve: black/white points as fractions of the image's own 2%..98% luminance range (auto levels), gamma */
  lo?: number; hi?: number; gamma?: number;
  /** colours the tone maps between (linear rgb); default ink -> bone */
  dark?: [number, number, number]; light?: [number, number, number];
  /** highlight glow: luminance above `glowAt` adds signal/ember light (HDR, blooms) */
  glow?: number; glowAt?: number;
  /** keep a little of the photo's own colour (0 = palette only) — used very sparingly */
  sat?: number;
  /** 0..1: print the photo's saturated reds in signal orange */
  redKey?: number;
  /** line screen: lines per logical px and angle */
  freq?: number; angle?: number;
  alpha?: number;
  reveal?: Reveal; rp?: number; rdir?: number; rsoft?: number; rx?: number; ry?: number; seed?: number;
  /** paper grain / plate tone wobble 0..1 */
  paper?: number;
  /** thin plate border (keyline) alpha */
  border?: number;
}

const VERT = /* glsl */ `
in vec3 position;
uniform vec4 rect; uniform float rot; uniform vec2 res;
out vec2 vLocal;
void main() {
  vLocal = position.xy; // 0..1, y down
  vec2 c = rect.xy + rect.zw * 0.5;
  vec2 p = (position.xy - 0.5) * rect.zw;
  float cs = cos(rot), sn = sin(rot);
  p = vec2(cs * p.x - sn * p.y, sn * p.x + cs * p.y) + c;
  gl_Position = vec4(p.x / res.x * 2.0 - 1.0, 1.0 - p.y / res.y * 2.0, 0.0, 1.0);
}`;

const FRAG = /* glsl */ `
in vec2 vLocal;
out vec4 fragColor;
uniform sampler2D tex; uniform vec2 texSize; uniform vec4 rect; uniform float rot;
uniform vec3 view; uniform float flipX; uniform int treat; uniform float invert;
uniform vec3 tone; uniform vec3 cDark; uniform vec3 cLight; uniform vec2 glow; uniform float satK;
uniform vec2 screen; uniform float redKey; uniform float alpha; uniform int reveal; uniform vec4 rv; uniform vec2 rc; uniform float paper; uniform float border; uniform float seed;
void main() {
  // cover fit + zoom/pan
  float ra = rect.z / rect.w, ia = texSize.x / texSize.y;
  vec2 s = ra > ia ? vec2(1.0, ia / ra) : vec2(ra / ia, 1.0); // visible fraction of the texture at cover
  s /= view.x;
  vec2 slack = 1.0 - s;
  vec2 lc = vLocal; if (flipX > 0.5) lc.x = 1.0 - lc.x;
  vec2 uv = (lc - 0.5) * s + 0.5 + vec2(view.y, view.z) * slack * 0.5;
  uv.y = 1.0 - uv.y;
  vec3 src = texture(tex, uv).rgb;
  float L = luma(src);
  float Lr = L;
  L = mix(L, 1.0 - L, invert);
  L = pow(sat((L - tone.x) / max(1e-3, tone.y - tone.x)), tone.z);
  vec2 px = vLocal * rect.zw; // plate-local logical px (rotates with the plate)
  float v = L;
  if (treat == 1) {
    float cov = engrave(px, 1.0 - L, screen.x, screen.y);
    v = 1.0 - cov;
  } else if (treat == 2) {
    vec2 q = rot2(0.785) * px * screen.x;
    vec2 cell = fract(q) - 0.5;
    float r = sqrt(sat(1.0 - L)) * 0.62;
    float d = length(cell) - r;
    float w = fwidth(d);
    v = smoothstep(-w, w, d);
  }
  if (paper > 0.0) { vec2 q = px * 0.004 + seed; v = sat(v + (hash12(floor(px * 0.75) + seed) - 0.5) * 0.06 * paper + (sin(q.x * 3.1 + sin(q.y * 2.3)) * sin(q.y * 2.7 + sin(q.x * 1.7))) * 0.04 * paper); }
  vec3 col = mix(cDark, cLight, v);
  if (treat == 3) col = mix(cDark, cLight, L) * mix(vec3(1.0), src / max(1e-3, luma(src)), satK);
  else if (satK > 0.0) col *= mix(vec3(1.0), src / max(1e-3, luma(src)), satK);
  // red things in the photograph (a sign, a jacket) print in the signal colour
  if (redKey > 0.0) {
    float red = smoothstep(0.08, 0.3, src.r - max(src.g, src.b) * 1.3) * smoothstep(0.02, 0.08, src.r);
    col = mix(col, C_SIGNAL * (0.6 + 0.8 * Lr), red * redKey);
  }
  // highlights glow in signal -> ember -> white (on the original light, or the inverted one)
  float hiL = mix(Lr, 1.0 - Lr, invert);
  float g = smoothstep(glow.y, 1.0, hiL) * glow.x;
  col += mix(C_SIGNAL * 1.6, vec3(3.2, 2.6, 2.0), smoothstep(0.5, 1.0, g)) * g;
  // reveal
  float a = alpha;
  if (reveal == 1) { // wipe along direction rv.y (radians), progress rv.x, softness rv.z
    vec2 dir = vec2(cos(rv.y), sin(rv.y));
    float k = dot(vLocal - 0.5, dir) / (abs(dir.x) * 0.5 + abs(dir.y) * 0.5) * 0.5 + 0.5; // 0..1 across the rect
    a *= 1.0 - smoothstep(rv.x - rv.z, rv.x, k);
  } else if (reveal == 2) { // iris around rc (local 0..1), radius rv.x (in rect heights)
    float d = length((vLocal - rc) * vec2(rect.z / rect.w, 1.0));
    a *= 1.0 - smoothstep(rv.x - rv.z - 1e-3, rv.x, d);
  } else if (reveal == 3) { // burn: noise threshold, glowing edge; rv.x = 0 intact .. 1 gone
    vec2 bd = vec2(cos(rv.y), sin(rv.y));
    float n = (fbm(px * 0.006 + seed, 5) * 0.6 + 0.5) * 0.45 + hash12(px * 0.31 + seed) * 0.03 + (dot(vLocal - 0.5, bd) + 0.5) * 0.55;
    float e = n - (rv.x * 1.2 - 0.1);
    a *= smoothstep(0.0, 0.015, e);
    float edge = 1.0 - smoothstep(0.0, 0.05, abs(e));
    col = mix(col, heat(1.0 - smoothstep(0.0, 0.05, e)) * 2.5, edge * step(0.001, rv.x));
    col *= mix(1.0, 0.35, (1.0 - smoothstep(0.0, 0.12, e)) * step(0.001, rv.x)); // char
  } else if (reveal == 4) { // horizontal blinds
    float k = fract(vLocal.y * rv.y);
    a *= step(k, rv.x);
  }
  // keyline + AA on the rect edge
  vec2 ed = min(vLocal, 1.0 - vLocal) * rect.zw;
  float edge = min(ed.x, ed.y);
  a *= smoothstep(0.0, 1.0, edge * ${SCALE.toFixed(1)});
  col = mix(col, cLight * 0.9 + cDark * 0.1, (1.0 - smoothstep(0.6, 1.4, edge)) * border);
  fragColor = vec4(col * a, a);
}`;

/** Draws image plates as quads (premultiplied alpha over the target). */
export class PlateDrawer {
  mat: THREE.RawShaderMaterial;
  mesh: THREE.Mesh;
  scene = new THREE.Scene();
  cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  constructor(additive = false) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    this.mat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: `precision highp float;\n${VERT}`,
      fragmentShader: `precision highp float;\nprecision highp int;\n${GLSL_COMMON}\n${FRAG}`,
      uniforms: {
        tex: { value: null }, texSize: { value: new THREE.Vector2(1, 1) }, rect: { value: new THREE.Vector4() }, rot: { value: 0 }, res: { value: new THREE.Vector2(W, H) },
        view: { value: new THREE.Vector3(1, 0, 0) }, flipX: { value: 0 }, treat: { value: 0 }, invert: { value: 0 },
        tone: { value: new THREE.Vector3(0, 1, 1) }, cDark: { value: new THREE.Vector3(...LIN.ink) }, cLight: { value: new THREE.Vector3(...LIN.bone) },
        glow: { value: new THREE.Vector2(0, 0.85) }, satK: { value: 0 }, redKey: { value: 0 }, screen: { value: new THREE.Vector2(0.25, 0.6) }, alpha: { value: 1 },
        reveal: { value: 0 }, rv: { value: new THREE.Vector4() }, rc: { value: new THREE.Vector2(0.5, 0.5) }, paper: { value: 0.5 }, border: { value: 0 }, seed: { value: 0 },
      },
      transparent: true, depthTest: false, depthWrite: false, blending: THREE.CustomBlending, side: THREE.DoubleSide,
    });
    const m = this.mat;
    m.blendEquation = THREE.AddEquation;
    m.blendSrc = THREE.OneFactor;
    m.blendDst = additive ? THREE.OneFactor : THREE.OneMinusSrcAlphaFactor;
    m.blendSrcAlpha = THREE.OneFactor; m.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }
  draw(renderer: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget, id: string, o: PlateOpts) {
    const t = tex(id), u = this.mat.uniforms;
    const img = t.image as { width: number; height: number };
    u.tex!.value = t;
    (u.texSize!.value as THREE.Vector2).set(img.width, img.height);
    (u.rect!.value as THREE.Vector4).set(o.x, o.y, o.w, o.h);
    u.rot!.value = o.rot ?? 0;
    (u.view!.value as THREE.Vector3).set(o.zoom ?? 1, o.panX ?? 0, o.panY ?? 0);
    u.flipX!.value = o.flipX ? 1 : 0;
    u.treat!.value = TREAT[o.treat ?? 'tone'];
    u.invert!.value = o.invert ?? 0;
    const lum = MANIFEST?.[id]?.lum ?? [0, 0.5, 1];
    const inv = (o.invert ?? 0) > 0.5;
    const pLo = inv ? 1 - lum[2] : lum[0], pHi = inv ? 1 - lum[0] : lum[2];
    (u.tone!.value as THREE.Vector3).set(lerp(pLo, pHi, o.lo ?? 0), lerp(pLo, pHi, o.hi ?? 1), o.gamma ?? 1);
    (u.cDark!.value as THREE.Vector3).set(...(o.dark ?? LIN.ink));
    (u.cLight!.value as THREE.Vector3).set(...(o.light ?? LIN.bone));
    (u.glow!.value as THREE.Vector2).set(o.glow ?? 0, o.glowAt ?? 0.85);
    u.satK!.value = o.sat ?? 0;
    u.redKey!.value = o.redKey ?? 0;
    (u.screen!.value as THREE.Vector2).set(o.freq ?? 0.22, o.angle ?? 0.6);
    u.alpha!.value = o.alpha ?? 1;
    u.reveal!.value = REVEAL[o.reveal ?? 'none'];
    (u.rv!.value as THREE.Vector4).set(o.rp ?? 0, o.rdir ?? 0, o.rsoft ?? 0.05, 0);
    (u.rc!.value as THREE.Vector2).set(o.rx ?? 0.5, o.ry ?? 0.5);
    u.paper!.value = o.paper ?? 0.5;
    u.border!.value = o.border ?? 0;
    u.seed!.value = o.seed ?? 0;
    renderer.setRenderTarget(target);
    renderer.render(this.scene, this.cam);
  }
}

/** A rect that covers the frame (optionally overscanned for camera moves). */
export const FULL = (over = 0): { x: number; y: number; w: number; h: number } => ({ x: -over, y: -over * (H / W), w: W + 2 * over, h: H + 2 * over * (H / W) });

// ------------------------------------------------------------------ type
export const FT = {
  disp: (w = 100, wt = 900) => F.archivo(w, wt),
  mono: (wt = 400) => F.mono(wt),
  serif: (wt = 400, it = true) => F.serif(wt, it),
};

/**
 * Karaoke: draw a run of words at (x, y) (alphabetic baseline), each word wiped from `dim` to `lit`
 * as it is sung. Returns the x after the run. Words appear only once `show` time has passed (anticipation).
 */
export function karaoke(c: CanvasRenderingContext2D, words: Word[], t: number, x: number, y: number, family: string, size: number, o: { lit?: string; dim?: string; gap?: number; tracking?: number; anticip?: number; hideUnsung?: boolean; upper?: boolean; align?: 'left' | 'center' | 'right' } = {}) {
  const gap = (o.gap ?? 0.28) * size;
  c.font = font(family, size);
  c.letterSpacing = `${o.tracking ?? 0}px`;
  const txt = (w: Word) => (o.upper ? w.w.toUpperCase() : w.w);
  const widths = words.map((w) => measure(txt(w), family, size, o.tracking ?? 0));
  const total = widths.reduce((a, b) => a + b, 0) + gap * Math.max(0, words.length - 1);
  let cx = o.align === 'center' ? x - total / 2 : o.align === 'right' ? x - total : x;
  const ant = o.anticip ?? 0.35;
  words.forEach((w, i) => {
    const ww = widths[i]!;
    const p = Lyrics.wordProgress(w, t);
    const vis = t >= w.start - ant;
    if (vis && !(o.hideUnsung && p <= 0)) {
      c.fillStyle = o.dim ?? rgba('bone', 0.28);
      if (p < 1) c.fillText(txt(w), cx, y);
      if (p > 0) {
        c.save();
        c.beginPath(); c.rect(cx - size * 0.2, y - size * 1.2, size * 0.2 + ww * p, size * 1.6); c.clip();
        c.fillStyle = o.lit ?? rgba('bone', 1);
        c.fillText(txt(w), cx, y);
        c.restore();
      }
    }
    cx += ww + gap;
  });
  c.letterSpacing = '0px';
  return cx - gap;
}
export function runWidth(words: Word[], family: string, size: number, gap = 0.28, upper = false, tracking = 0) {
  return words.reduce((a, w) => a + measure(upper ? w.w.toUpperCase() : w.w, family, size, tracking), 0) + gap * size * Math.max(0, words.length - 1);
}

/** Plate caption (credit line), small mono: "PL. 12 — Title · Creator · CC BY 2.0". */
export function caption(c: CanvasRenderingContext2D, id: string, x: number, y: number, o: { color?: string; size?: number; align?: 'left' | 'right'; maxW?: number; short?: boolean } = {}) {
  const m = meta(id);
  const size = o.size ?? 13;
  c.font = font(F.mono(400), size);
  c.letterSpacing = '0.5px';
  c.fillStyle = o.color ?? rgba('bone', 0.62);
  const lic = licName(m.license);
  let title = m.title.replace(/\s+/g, ' ').trim();
  let who = (m.creator || 'unknown').replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
  const maxW = o.maxW ?? 760;
  const fit = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
  title = fit(title, 46); who = fit(who, 30);
  let s = o.short ? `PL. ${m.plate} · ${who} · ${lic}` : `PL. ${m.plate} — ${title} · ${who} · ${lic}`;
  while (measure(s, F.mono(400), size, 0.5) > maxW && title.length > 8) { title = fit(title, title.length - 4); s = `PL. ${m.plate} — ${title} · ${who} · ${lic}`; }
  c.textAlign = o.align ?? 'left';
  c.fillText(s, x, y);
  c.textAlign = 'left';
  c.letterSpacing = '0px';
}
export function licName(l: string) {
  const L = l.toLowerCase();
  if (L === 'cc0') return 'CC0';
  if (L === 'pdm') return 'Public Domain';
  if (L === 'by') return 'CC BY';
  if (L === 'by-sa') return 'CC BY-SA';
  return l.toUpperCase();
}

// ------------------------------------------------------------------ misc
/** Index of the beat-cut slot at time t, given cut times (sorted). */
export function slot(cuts: number[], t: number) {
  let i = -1;
  for (const c of cuts) if (t >= c) i++;
  return i;
}
/** Beat times between t0 and t1 every `every` beats (from the analysed grid). */
export function beatsIn(au: { beatAt(t: number): number; timeOfBeat(i: number): number }, t0: number, t1: number, every = 1, phase = 0) {
  const out: number[] = [];
  let b = Math.ceil(au.beatAt(t0) - 1e-3);
  while ((b - phase) % every !== 0) b++;
  for (; au.timeOfBeat(b) < t1 - 1e-3; b += every) out.push(au.timeOfBeat(b));
  return out;
}
export const mixC = (a: [number, number, number], b: [number, number, number], k: number): [number, number, number] => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
export const kc = (k: number, c: [number, number, number]): [number, number, number] => [c[0] * k, c[1] * k, c[2] * k];
export { clamp, LIN, rgba, W, H };
export type { Line, Word };

// ------------------------------------------------------------------ writing & camera
/** Per-char [start, end] times spreading `text` evenly over [t0, t1] (for writing non-lyric text). */
export function charTimesLinear(text: string, t0: number, t1: number): [number, number][] {
  const n = Math.max(1, text.length);
  return Array.from(text).map((_, i) => [t0 + ((t1 - t0) * i) / n, t0 + ((t1 - t0) * (i + 1)) / n]);
}
/** The words joined by spaces, with per-char times following each word's sung window. */
export function charTimesWords(words: Word[], upper = false): { text: string; times: [number, number][] } {
  let text = '';
  const times: [number, number][] = [];
  words.forEach((w, i) => {
    if (i) { text += ' '; times.push([w.start, w.start]); }
    const s = upper ? w.w.toUpperCase() : w.w;
    const n = s.length;
    Array.from(s).forEach((_, k) => times.push([w.start + ((w.end - w.start) * k) / n, w.start + ((w.end - w.start) * (k + 1)) / n]));
    text += s;
  });
  return { text, times };
}

/** A 2D camera over a world in logical px: screen = (p - c) * z rotated by r + frame centre. */
export class Cam {
  cx = W / 2; cy = H / 2; z = 1; r = 0;
  set(cx: number, cy: number, z: number, r = 0) { this.cx = cx; this.cy = cy; this.z = z; this.r = r; return this; }
  pt(x: number, y: number) {
    const dx = (x - this.cx) * this.z, dy = (y - this.cy) * this.z;
    const c = Math.cos(this.r), s = Math.sin(this.r);
    return { x: W / 2 + c * dx - s * dy, y: H / 2 + s * dx + c * dy };
  }
  /** A world rect (top-left x, y, w, h) as a plate rect with rotation. */
  rect(x: number, y: number, w: number, h: number, rot = 0) {
    const c = this.pt(x + w / 2, y + h / 2);
    return { x: c.x - (w * this.z) / 2, y: c.y - (h * this.z) / 2, w: w * this.z, h: h * this.z, rot: rot + this.r };
  }
  /** Apply to a Canvas2D context (draw in world px afterwards). */
  apply(c: CanvasRenderingContext2D) {
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.translate(W / 2, H / 2); c.rotate(this.r); c.scale(this.z, this.z); c.translate(-this.cx, -this.cy);
  }
}

// ------------------------------------------------------------------ looks & routes
/** Plate looks (partial PlateOpts). */
export const LOOK = {
  /** old prints and maps: paper to ink, the engraved lines in bone */
  print: { treat: 'tone', invert: 1, lo: 0.36, hi: 0.97, gamma: 1.2, paper: 0.6 } as Partial<PlateOpts>,
  /** the same on bone paper (inverted frames): ink lines on paper */
  printPaper: { treat: 'tone', invert: 0, lo: 0.03, hi: 0.64, gamma: 0.8, paper: 0.6, dark: LIN.ink, light: LIN.bone } as Partial<PlateOpts>,
  /** photographs as line engravings, bone on ink */
  photo: { treat: 'engrave', freq: 0.2, angle: 0.62, lo: 0.04, hi: 0.96, gamma: 1.05, paper: 0.4 } as Partial<PlateOpts>,
  /** photographs as a smooth ink->bone duotone */
  tone: { treat: 'tone', lo: 0.02, hi: 0.98, gamma: 1.25, paper: 0.5 } as Partial<PlateOpts>,
  /** photographs as their own negative (the other side of the light) */
  negative: { treat: 'tone', invert: 1, lo: 0.02, hi: 0.98, gamma: 1.0, paper: 0.4 } as Partial<PlateOpts>,
  /** halftone dots */
  dots: { treat: 'halftone', freq: 0.13, lo: 0.04, hi: 0.96, gamma: 1.1, paper: 0.3 } as Partial<PlateOpts>,
};

/** Ken Burns helper: zoom and pan interpolated over [t0, t1]. */
export function kb(t: number, t0: number, t1: number, z0: number, z1: number, px0 = 0, px1 = 0, py0 = 0, py1 = 0) {
  const k = clamp((t - t0) / Math.max(1e-3, t1 - t0));
  const e = k * k * (3 - 2 * k) * 0.35 + k * 0.65;
  return { zoom: lerp(z0, z1, e), panX: lerp(px0, px1, e), panY: lerp(py0, py1, e) };
}

/** A wandering route (seeded): n points from a to b with lateral jitter, for the lamp to walk. */
export function wander(seed: number, ax: number, ay: number, bx: number, by: number, n = 7, jit = 0.25) {
  const pts: { x: number; y: number }[] = [];
  const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const j = i === 0 || i === n ? 0 : (hashK(seed, i) - 0.5) * 2 * jit * L;
    pts.push({ x: ax + dx * u + nx * j, y: ay + dy * u + ny * j });
  }
  return pts;
}
function hashK(a: number, b: number) { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); }
/** Point at fraction f (0..1, by length) along a polyline, plus the partial polyline up to it. */
export function along(pts: { x: number; y: number }[], f: number) {
  const L: number[] = [0];
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1]! + Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y));
  const s = clamp(f) * L[L.length - 1]!;
  const part = [pts[0]!];
  for (let i = 1; i < pts.length; i++) {
    if (L[i]! <= s) { part.push(pts[i]!); continue; }
    const u = (s - L[i - 1]!) / Math.max(1e-6, L[i]! - L[i - 1]!);
    const p = { x: lerp(pts[i - 1]!.x, pts[i]!.x, u), y: lerp(pts[i - 1]!.y, pts[i]!.y, u) };
    part.push(p);
    return { p, part, ang: Math.atan2(pts[i]!.y - pts[i - 1]!.y, pts[i]!.x - pts[i - 1]!.x) };
  }
  const n = pts.length;
  return { p: pts[n - 1]!, part, ang: Math.atan2(pts[n - 1]!.y - pts[n - 2]!.y, pts[n - 1]!.x - pts[n - 2]!.x) };
}
/** Smooth a polyline (Chaikin). */
export function chaikin(pts: { x: number; y: number }[], it = 2) {
  let p = pts;
  for (let k = 0; k < it; k++) {
    const q = [p[0]!];
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i]!, b = p[i + 1]!;
      q.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 }, { x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    q.push(p[p.length - 1]!);
    p = q;
  }
  return p;
}

import type { LineBatch } from '../engine/lines';
/** The lamp's route: a signal line (dashed if `dash` px > 0). */
export function routeLine(lb: LineBatch, part: { x: number; y: number }[], o: { w?: number; I?: number; dash?: number; col?: [number, number, number]; alpha?: number } = {}) {
  const col = kc(o.I ?? 1.5, o.col ?? LIN.signal);
  let acc = 0;
  for (let i = 1; i < part.length; i++) {
    const a = part[i - 1]!, b = part[i]!;
    const l = Math.hypot(b.x - a.x, b.y - a.y);
    if (!o.dash) { lb.seg2(a.x, a.y, b.x, b.y, o.w ?? 2.2, col, o.alpha ?? 1); acc += l; continue; }
    // split into dashes
    let s = 0;
    while (s < l) {
      const ph = (acc + s) % (o.dash * 2);
      const run = Math.min(l - s, ph < o.dash ? o.dash - ph : o.dash * 2 - ph);
      if (ph < o.dash) {
        const u0 = s / l, u1 = (s + run) / l;
        lb.seg2(a.x + (b.x - a.x) * u0, a.y + (b.y - a.y) * u0, a.x + (b.x - a.x) * u1, a.y + (b.y - a.y) * u1, o.w ?? 2.2, col, o.alpha ?? 1);
      }
      s += run + 1e-3;
    }
    acc += l;
  }
}
/** A cross (×) mark: where a route ends badly. */
export function xMark(lb: LineBatch, x: number, y: number, s: number, I = 2, w = 3) {
  const col = kc(I, LIN.signal);
  lb.seg2(x - s, y - s, x + s, y + s, w, col, 1);
  lb.seg2(x - s, y + s, x + s, y - s, w, col, 1);
}
