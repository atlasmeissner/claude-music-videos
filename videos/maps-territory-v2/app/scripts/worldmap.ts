// Debug: write the world's height field (the whole baked domain) with the plan and the track as a PPM.
// usage: bun scripts/worldmap.ts ../out/world.ppm
import { heights, HM, PLAN_PTS, track, WAY, DMIN, DSIZE } from '../src/scenes/_world';
const t0 = performance.now();
const d = heights();
const t1 = performance.now();
const T = track();
const t2 = performance.now();
console.log(`heights ${(t1 - t0).toFixed(0)} ms, track ${(t2 - t1).toFixed(0)} ms, ${T.pts.length} pts, ${T.total.toFixed(1)} km`);
const img = new Uint8Array(HM * HM * 3);
let mn = 1e9, mx = -1e9; for (const v of d) { mn = Math.min(mn, v); mx = Math.max(mx, v); }
console.log('h range', mn.toFixed(3), mx.toFixed(3));
for (let i = 0; i < HM * HM; i++) {
  const h = d[i]!;
  const c = Math.abs((h / 0.05) % 1) < 0.08 ? 0.5 : 0;
  if (h < 0) { img[i * 3] = 20; img[i * 3 + 1] = 40 + 80 * c; img[i * 3 + 2] = 70 + h * 100; }
  else { const v = 60 + 150 * (h / mx); img[i * 3] = v + 60 * c; img[i * 3 + 1] = v; img[i * 3 + 2] = v * 0.8; }
}
const dot = (x: number, y: number, r: number, g: number, b: number) => { const i = Math.round((x - DMIN) / DSIZE * HM), j = Math.round((y - DMIN) / DSIZE * HM); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const k = ((j + dy) * HM + i + dx) * 3; if (k >= 0 && k < img.length) { img[k] = r; img[k + 1] = g; img[k + 2] = b; } } };
for (const p of T.pts) dot(p.x, p.y, 255, 160, 40);
for (let k = 0; k + 1 < PLAN_PTS.length; k++) { const a = PLAN_PTS[k]!, b = PLAN_PTS[k + 1]!; for (let u = 0; u < 1; u += 0.005) dot(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u, 0, 0, 0); }
for (const w of WAY) dot(w.x, w.y, 255, 0, 0);
await Bun.write(process.argv[2] ?? '../out/world.ppm', Buffer.concat([Buffer.from(`P6 ${HM} ${HM} 255\n`), Buffer.from(img)]));
