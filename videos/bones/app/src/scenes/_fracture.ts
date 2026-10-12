// A breakable façade: the painted building (_facadePaint) cut into small Voronoi cells, grouped into large
// fragments whose borders are the unions of cells (so cracks run jagged, cell by cell, like real masonry). The
// caller moves each fragment rigidly; cells on a fragment border can be released one by one (spalling). Drawn as
// one textured mesh in screen space, with crack lines along the fragment borders.
import * as THREE from 'three';
import { W, H } from '../engine/gl';
import { hash } from '../engine/util';
import { paintFacade, PAINT } from './_facadePaint';

export type P2 = [number, number];
export interface Cell { site: P2; poly: P2[]; c: P2; frag: number; edge: boolean; nb: number[]; r: [number, number, number]; area: number }
export interface Frag { site: P2; c: P2; cells: number[] }
export interface CrackEdge { cell: number; other: number; a: P2; b: P2 }
export interface Pose { dx: number; dy: number; rot: number; cx: number; cy: number }

function clip(poly: P2[], m: P2, n: P2): P2[] {
  // keep the side where (p - m)·n <= 0
  const out: P2[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!, b = poly[(i + 1) % poly.length]!;
    const da = (a[0] - m[0]) * n[0] + (a[1] - m[1]) * n[1], db = (b[0] - m[0]) * n[0] + (b[1] - m[1]) * n[1];
    if (da <= 0) out.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) { const t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  return out;
}

export class Fracture {
  cells: Cell[] = [];
  frags: Frag[] = [];
  cracks: CrackEdge[] = [];
  tex: THREE.CanvasTexture;
  geo = new THREE.BufferGeometry();
  mesh: THREE.Mesh;
  scene = new THREE.Scene();
  cam = new THREE.OrthographicCamera(0, W, 0, H, -1, 1);
  private pos: Float32Array; private shade: Float32Array; private crackA: Float32Array; private alpha: Float32Array;
  private tri: { cell: number; p: P2; rim: number }[] = [];

  constructor(cellSize = 34, fragSize = 230, seed = 7) {
    const cv = paintFacade();
    const cx2 = cv.getContext('2d')!;
    const img = cx2.getImageData(0, 0, cv.width, cv.height).data;
    const solid = (x: number, y: number) => {
      const px = Math.floor((x - PAINT.x0) * PAINT.px), py = Math.floor((y - PAINT.y0) * PAINT.px);
      if (px < 0 || py < 0 || px >= cv.width || py >= cv.height) return false;
      return img[(py * cv.width + px) * 4 + 3]! > 10;
    };
    this.tex = new THREE.CanvasTexture(cv);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.minFilter = THREE.LinearMipmapLinearFilter; this.tex.generateMipmaps = true; this.tex.anisotropy = 4;
    // fragment sites
    const fs: P2[] = [];
    for (let y = PAINT.y0 + fragSize * 0.4; y < PAINT.y1; y += fragSize * 0.85) for (let x = PAINT.x0 + fragSize * 0.3; x < PAINT.x1; x += fragSize) {
      fs.push([x + (hash(x, y, seed) - 0.5) * fragSize * 0.8, y + (hash(x, y, seed + 1) - 0.5) * fragSize * 0.7]);
    }
    // cell sites: jittered grid, kept where the building is
    const sites: P2[] = [];
    const gx = Math.ceil((PAINT.x1 - PAINT.x0) / cellSize), gy = Math.ceil((PAINT.y1 - PAINT.y0) / cellSize);
    const grid: number[][] = Array.from({ length: gx * gy }, () => []);
    for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) {
      const x = PAINT.x0 + (i + 0.5 + (hash(i, j, seed + 2) - 0.5) * 0.85) * cellSize;
      const y = PAINT.y0 + (j + 0.5 + (hash(i, j, seed + 3) - 0.5) * 0.85) * cellSize;
      grid[j * gx + i]!.push(sites.length);
      sites.push([x, y]);
    }
    const near = (i: number, j: number) => {
      const o: number[] = [];
      for (let b = j - 2; b <= j + 2; b++) for (let a = i - 2; a <= i + 2; a++) if (a >= 0 && b >= 0 && a < gx && b < gy) o.push(...grid[b * gx + a]!);
      return o;
    };
    const idx = new Map<number, number>();
    for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) {
      const si = grid[j * gx + i]![0]!;
      const s = sites[si]!;
      let poly: P2[] = [[s[0] - cellSize * 2, s[1] - cellSize * 2], [s[0] + cellSize * 2, s[1] - cellSize * 2], [s[0] + cellSize * 2, s[1] + cellSize * 2], [s[0] - cellSize * 2, s[1] + cellSize * 2]];
      const nb: number[] = [];
      for (const k of near(i, j)) {
        if (k === si) continue;
        const q = sites[k]!;
        const before = poly.length;
        const np = clip(poly, [(s[0] + q[0]) / 2, (s[1] + q[1]) / 2], [q[0] - s[0], q[1] - s[1]]);
        if (np.length !== before || np.some((p, n) => p !== poly[n])) nb.push(k);
        poly = np;
      }
      // keep the cell if any of its points (centre, vertices) is inside the building
      if (!(solid(s[0], s[1]) || poly.some(([x, y]) => solid(x * 0.7 + s[0] * 0.3, y * 0.7 + s[1] * 0.3)))) continue;
      let ax = 0, ay = 0, area = 0;
      for (let n = 0; n < poly.length; n++) { const a = poly[n]!, b = poly[(n + 1) % poly.length]!; const cr = a[0] * b[1] - b[0] * a[1]; area += cr; ax += (a[0] + b[0]) * cr; ay += (a[1] + b[1]) * cr; }
      area /= 2;
      const c: P2 = [ax / (6 * area), ay / (6 * area)];
      // fragment: nearest fragment site, with a little noise so borders wander
      let best = 0, bd = 1e18;
      fs.forEach((f, fi) => { const d = (f[0] - c[0]) ** 2 + (f[1] - c[1]) ** 2 + (hash(si, fi, seed + 5) - 0.5) * cellSize * cellSize * 6; if (d < bd) { bd = d; best = fi; } });
      idx.set(si, this.cells.length);
      this.cells.push({ site: s, poly, c, frag: best, edge: false, nb, r: [hash(si, 11), hash(si, 12), hash(si, 13)], area: Math.abs(area) });
    }
    // neighbours as cell indices; fragment-border cells and the crack edges between fragments
    for (const cl of this.cells) cl.nb = cl.nb.map((k) => idx.get(k)).filter((k): k is number => k !== undefined);
    this.cells.forEach((cl, ci) => {
      for (let n = 0; n < cl.poly.length; n++) {
        const a = cl.poly[n]!, b = cl.poly[(n + 1) % cl.poly.length]!;
        const m: P2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        // the neighbour across this edge: the one whose site is as close to the midpoint as ours
        const dS = Math.hypot(m[0] - cl.site[0], m[1] - cl.site[1]);
        let other = -1, bd = 1e9;
        for (const k of cl.nb) { const q = this.cells[k]!.site; const d = Math.abs(Math.hypot(m[0] - q[0], m[1] - q[1]) - dS); if (d < bd) { bd = d; other = k; } }
        if (other >= 0 && bd < 0.5 && this.cells[other]!.frag !== cl.frag) { cl.edge = true; if (ci < other) this.cracks.push({ cell: ci, other, a, b }); }
      }
    });
    // fragments
    const used = new Map<number, number>();
    this.cells.forEach((cl) => { if (!used.has(cl.frag)) { used.set(cl.frag, this.frags.length); this.frags.push({ site: fs[cl.frag]!, c: [0, 0], cells: [] }); } });
    this.cells.forEach((cl, ci) => { cl.frag = used.get(cl.frag)!; this.frags[cl.frag]!.cells.push(ci); });
    for (const f of this.frags) {
      let x = 0, y = 0, a = 0;
      for (const ci of f.cells) { const cl = this.cells[ci]!; x += cl.c[0] * cl.area; y += cl.c[1] * cl.area; a += cl.area; }
      f.c = [x / a, y / a];
    }
    // mesh: a fan per cell (centre rim=1, outline rim=0)
    for (let ci = 0; ci < this.cells.length; ci++) {
      const cl = this.cells[ci]!;
      for (let n = 0; n < cl.poly.length; n++) {
        this.tri.push({ cell: ci, p: cl.c, rim: 1 }, { cell: ci, p: cl.poly[n]!, rim: 0 }, { cell: ci, p: cl.poly[(n + 1) % cl.poly.length]!, rim: 0 });
      }
    }
    const nv = this.tri.length;
    this.pos = new Float32Array(nv * 3); this.shade = new Float32Array(nv); this.crackA = new Float32Array(nv); this.alpha = new Float32Array(nv);
    const uv = new Float32Array(nv * 2), rim = new Float32Array(nv);
    this.tri.forEach((v, i) => {
      uv[i * 2] = (v.p[0] - PAINT.x0) / (PAINT.x1 - PAINT.x0);
      uv[i * 2 + 1] = 1 - (v.p[1] - PAINT.y0) / (PAINT.y1 - PAINT.y0);
      rim[i] = v.rim;
    });
    const dyn = (a: Float32Array, n: number) => { const b = new THREE.BufferAttribute(a, n); b.setUsage(THREE.DynamicDrawUsage); return b; };
    this.geo.setAttribute('position', dyn(this.pos, 3));
    this.geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    this.geo.setAttribute('rim', new THREE.BufferAttribute(rim, 1));
    this.geo.setAttribute('shade', dyn(this.shade, 1));
    this.geo.setAttribute('crack', dyn(this.crackA, 1));
    this.geo.setAttribute('alpha', dyn(this.alpha, 1));
    const mat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: /* glsl */ `precision highp float;
        in vec3 position; in vec2 uv; in float rim; in float shade; in float crack; in float alpha;
        uniform mat4 projectionMatrix; uniform mat4 modelViewMatrix;
        out vec2 vUv; out float vRim; out float vShade; out float vCrack; out float vAlpha;
        void main() { vUv = uv; vRim = rim; vShade = shade; vCrack = crack; vAlpha = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `precision highp float;
        in vec2 vUv; in float vRim; in float vShade; in float vCrack; in float vAlpha;
        uniform sampler2D tex; uniform float gain; uniform vec3 tint;
        out vec4 fragColor;
        void main() {
          vec4 c = texture(tex, vUv);
          // broken edges: dark lip, with a thin bright fresh-stone line just inside it
          float e = smoothstep(0.0, 0.16, vRim);
          float lip = mix(1.0, 0.85 + 0.15 * e, vCrack * 0.0);
          float fresh = 0.0;
          float up = 0.62 + 0.48 * pow(1.0 - vUv.y, 1.3); // floodlit from the ground
          vec3 col = c.rgb * tint * gain * up * vShade * lip + vec3(0.55, 0.5, 0.42) * fresh * c.a;
          float a = c.a * vAlpha;
          fragColor = vec4(col * a, a);
        }`,
      uniforms: { tex: { value: this.tex }, gain: { value: 1 }, tint: { value: new THREE.Vector3(1, 1, 1) } },
      transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }

  /** Apply a pose (rigid about its centre) to a point in façade units. */
  static apply(p: P2, q: Pose): P2 {
    const cs = Math.cos(q.rot), sn = Math.sin(q.rot);
    const x = p[0] - q.cx, y = p[1] - q.cy;
    return [q.cx + x * cs - y * sn + q.dx, q.cy + x * sn + y * cs + q.dy];
  }

  /**
   * Update the mesh: `cellPose(ci)` returns the cell's pose in façade units (normally its fragment's), and
   * its alpha (0 hides); `crack(ci)` 0..1 shows the broken-edge lip; `light(ci)` multiplies its shade.
   */
  update(view: { ox: number; oy: number; s: number }, cellPose: (ci: number) => [Pose, number], crack: (ci: number) => number, light: (ci: number) => number, gain = 1) {
    const poses: [Pose, number][] = this.cells.map((_, ci) => cellPose(ci));
    const ck = this.cells.map((_, ci) => crack(ci)), lt = this.cells.map((_, ci) => light(ci));
    this.tri.forEach((v, i) => {
      const [q, a] = poses[v.cell]!;
      const p = Fracture.apply(v.p, q);
      this.pos[i * 3] = view.ox + p[0] * view.s; this.pos[i * 3 + 1] = view.oy + p[1] * view.s; this.pos[i * 3 + 2] = 0;
      this.alpha[i] = a; this.crackA[i] = ck[v.cell]!; this.shade[i] = lt[v.cell]!;
    });
    for (const k of ['position', 'shade', 'crack', 'alpha']) this.geo.getAttribute(k).needsUpdate = true;
    (this.mesh.material as THREE.RawShaderMaterial).uniforms.gain!.value = gain;
  }

  render(renderer: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget) {
    renderer.setRenderTarget(target);
    renderer.render(this.scene, this.cam);
  }
}
