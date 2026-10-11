#!/usr/bin/env bun
// Render every timeline entry to its own silent segment (out/seg/<id>.mp4), frame-exact and contiguous,
// then `bun scripts/segments.ts concat` joins them with the audio into out/pareto.mp4.
//   bun scripts/segments.ts render [--fps 30] [--ids a,b] [--force]
import { chromium } from 'playwright-core';
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const argv = process.argv.slice(2);
const opt = (k: string, d?: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const ROOT = path.resolve(import.meta.dir, '../..');
const fps = +opt('fps', '30')!;
const url = 'http://localhost:5173';

async function timeline(): Promise<{ id: string; start: number; end: number }[]> {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage();
  await p.goto(`${url}/?export=1&only=none`);
  await p.waitForFunction(() => (window as any).__pdoom?.ready || (window as any).__pdoom?.error, null, { timeout: 120000 });
  const tl = await p.evaluate(() => (window as any).__pdoom.timeline);
  await b.close();
  return tl;
}

const tl0 = await timeline();
// split long entries into chunks of at most CH frames (resumable; each chunk is its own file)
const CH = +opt('chunk-frames', '240')!;
const tl: { id: string; start: number; end: number; scene: string }[] = [];
for (const e of tl0) {
  const f0 = Math.ceil(e.start * fps - 1e-6), f1 = Math.ceil(e.end * fps - 1e-6);
  const n = Math.max(1, Math.ceil((f1 - f0) / CH));
  for (let k = 0; k < n; k++) {
    const a = f0 + Math.round(((f1 - f0) * k) / n), b = f0 + Math.round(((f1 - f0) * (k + 1)) / n);
    tl.push({ id: `${e.id}_${String(k).padStart(2, '0')}`, scene: e.id, start: a / fps, end: b / fps });
  }
}
if (argv[0] === 'concat') {
  const list = tl.map((e) => `file '${path.join(ROOT, 'out/seg', e.id + '.mp4')}'`).join('\n');
  writeFileSync(path.join(ROOT, 'out/seg/list.txt'), list + '\n');
  const out = opt('out', path.join(ROOT, 'out/pareto.mp4'))!;
  const p = Bun.spawnSync(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(ROOT, 'out/seg/list.txt'), '-i', path.join(ROOT, 'audio/pareto.mp3'),
    '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-shortest', '-movflags', '+faststart', out], { stdout: 'inherit', stderr: 'inherit' });
  console.log('concat exit', p.exitCode, out);
  process.exit(p.exitCode ?? 0);
}
const ids = opt('ids')?.split(',');
for (const e of tl) {
  if (ids && !ids.includes(e.scene) && !ids.includes(e.id)) continue;
  const out = path.join(ROOT, 'out/seg', `${e.id}.mp4`);
  if (existsSync(out) && !argv.includes('--force')) { console.log('skip', e.id); continue; }
  const from = e.start, to = e.end;
  const t0 = Date.now();
  console.log(`render ${e.id} ${from.toFixed(3)} → ${to.toFixed(3)} (${Math.round((to - from) * fps)} frames)`);
  const p = Bun.spawn(['bun', 'scripts/render.ts', 'video', '--only', e.scene, '--from', String(from), '--to', String(to), '--fps', String(fps),
    '--noaudio', '--preset', opt('preset', 'medium')!, '--crf', opt('crf', '17')!, '--workers', opt('workers', '2')!, '--out', out + '.part.mp4', '--url', url],
    { cwd: path.join(ROOT, 'app'), stdout: 'inherit', stderr: 'inherit' });
  const code = await p.exited;
  if (code !== 0) { console.log('FAILED', e.id, code); continue; }
  Bun.spawnSync(['mv', out + '.part.mp4', out]);
  console.log(`done ${e.id} in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
}
