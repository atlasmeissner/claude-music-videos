// Offline renderer: the same frame code as the browser preview, drawn with @napi-rs/canvas (Skia)
// and piped to ffmpeg. Modes:
//
//   bun scripts/render.ts stills --times 0,3.2,17 [--scale 0.5] [--out ../out/stills]
//   bun scripts/render.ts sheet  --from 0 --to 20 --n 24 [--cols 6] [--scale 0.3] [--out ../out/sheet.png]
//   bun scripts/render.ts video  [--from 0] [--to 187.28] [--fps 30] [--samples 3] [--scale 1]
//                                [--workers 2] [--crf 16] [--out ../out/dominoes.mp4]
//
// Motion blur: each frame averages `samples` sub-frames spread over a shutter of `shutter` frame
// times (default 0.5). Frame k's time is k / fps.
import { createCanvas, GlobalFonts, type Canvas, type SKRSContext2D } from '@napi-rs/canvas';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { FONT_FILES } from '../src/engine/fonts';
import { R, W, H, type Ctx } from '../src/engine/draw';
import { Post } from '../src/engine/post';
import { renderFrame, warpSpeed } from '../src/frame';
import { DURATION } from '../src/engine/audio';

const ROOT = resolve(import.meta.dir, '..');
for (const f of FONT_FILES) GlobalFonts.registerFromPath(join(ROOT, 'public/fonts', f.file), f.family);

const argv = process.argv.slice(2);
const mode = argv[0] ?? 'stills';
const opt = (k: string, d?: string) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 ? argv[i + 1]! : d;
};
const num = (k: string, d: number) => Number(opt(k, String(d)));

const scale = num('scale', mode === 'video' || mode === 'chunk' ? 1 : 0.5);
const fps = num('fps', 30);
const samples = num('samples', 1);
const shutter = num('shutter', 0.5);
const grain = num('grain', 0.09);

class Renderer {
  canvas: Canvas;
  g: SKRSContext2D;
  acc: Canvas;
  ag: SKRSContext2D;
  r: R;
  post: Post;
  constructor() {
    this.canvas = createCanvas(Math.round(W * scale), Math.round(H * scale));
    this.g = this.canvas.getContext('2d');
    this.acc = createCanvas(Math.round(W * scale), Math.round(H * scale));
    this.ag = this.acc.getContext('2d');
    this.r = new R(this.g as unknown as Ctx, scale);
    this.post = new Post((w, h) => createCanvas(w, h) as unknown as { width: number; height: number; getContext(t: '2d'): unknown }, scale);
  }
  /** Render frame at time t (with motion blur) into the accumulation canvas; returns it. */
  frame(t: number, frameIdx: number, nSamples0 = samples) {
    // more sub-frames where machine time runs fast (the rewind)
    const sp = warpSpeed(t);
    const nSamples = sp > 1.5 && nSamples0 > 1 ? Math.min(16, Math.round(nSamples0 * Math.sqrt(sp) * 1.3)) : nSamples0;
    let glow = 1;
    if (nSamples <= 1) {
      const th = renderFrame(this.r, t);
      glow = th.glow;
      this.ag.globalCompositeOperation = 'source-over';
      this.ag.globalAlpha = 1;
      this.ag.clearRect(0, 0, this.acc.width, this.acc.height);
      this.ag.drawImage(this.canvas, 0, 0);
    } else {
      const dt = shutter / fps;
      for (let k = 0; k < nSamples; k++) {
        const ts = t + (nSamples === 1 ? 0 : (k / (nSamples - 1) - 0.5) * dt);
        const th = renderFrame(this.r, Math.max(0, ts));
        glow = th.glow;
        this.ag.globalCompositeOperation = 'source-over';
        if (k === 0) this.ag.clearRect(0, 0, this.acc.width, this.acc.height);
        this.ag.globalAlpha = 1 / (k + 1);
        this.ag.drawImage(this.canvas, 0, 0);
      }
      this.ag.globalAlpha = 1;
    }
    this.post.apply(this.acc as never, this.ag as unknown as Ctx, { glow, grain, frame: frameIdx });
    return this.acc;
  }
}

async function stills() {
  const out = resolve(opt('out', join(ROOT, '../out/stills'))!);
  mkdirSync(out, { recursive: true });
  const times = opt('times', '0,3.3,6,10,14,16.5')!.split(',').map(Number);
  const R0 = new Renderer();
  for (const t of times) {
    const t0 = performance.now();
    const c = R0.frame(t, Math.round(t * fps));
    const f = join(out, `t${t.toFixed(2).padStart(7, '0')}.png`);
    writeFileSync(f, await c.encode('png'));
    console.log(f, `${(performance.now() - t0).toFixed(0)} ms`);
  }
}

async function sheet() {
  const from = num('from', 0), to = num('to', 20), n = num('n', 24), cols = num('cols', 6);
  const out = resolve(opt('out', join(ROOT, '../out/sheet.png'))!);
  mkdirSync(dirname(out), { recursive: true });
  const R0 = new Renderer();
  const cw = Math.round(W * scale), ch = Math.round(H * scale);
  const rows = Math.ceil(n / cols);
  const sheetC = createCanvas(cols * cw + (cols + 1) * 6, rows * (ch + 22) + 6);
  const sg = sheetC.getContext('2d');
  sg.fillStyle = '#222';
  sg.fillRect(0, 0, sheetC.width, sheetC.height);
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? from : from + ((to - from) * i) / (n - 1);
    const c = R0.frame(t, Math.round(t * fps));
    const x = 6 + (i % cols) * (cw + 6), y = 6 + Math.floor(i / cols) * (ch + 22);
    // copy pixels (drawImage of one canvas onto another is not reliable here)
    sg.putImageData(c.getContext('2d').getImageData(0, 0, cw, ch), x, y);
    sg.fillStyle = '#ddd';
    sg.font = '14px "PlexMono-400"';
    sg.fillText(`${t.toFixed(2)}s`, x, y + ch + 16);
  }
  writeFileSync(out, await sheetC.encode('png'));
  console.log(out);
}

async function chunk() {
  // a worker: render frames [a, b) into its own mp4
  const a = num('a', 0), b = num('b', 0), crf = num('crf', 16);
  const out = opt('chunk-out')!;
  const R0 = new Renderer();
  const w = Math.round(W * scale), h = Math.round(H * scale);
  const ff = spawn('ffmpeg', [
    '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${w}x${h}`, '-r', String(fps), '-i', '-',
    '-c:v', 'libx264', '-preset', opt('preset', 'medium')!, '-crf', String(crf), '-pix_fmt', 'yuv420p',
    '-threads', opt('x264-threads', '1')!, '-x264-params', 'keyint=60', out,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = performance.now();
  for (let k = a; k < b; k++) {
    const t = k / fps;
    const c = R0.frame(t, k);
    const data = c.data();
    const ok = ff.stdin.write(data);
    if (!ok) await new Promise((res) => ff.stdin.once('drain', res));
    if ((k - a) % 60 === 0) {
      const el = (performance.now() - t0) / 1000;
      const done = k - a + 1;
      console.log(`[${a}-${b}] frame ${k} (${t.toFixed(2)}s)  ${(el / done * 1000).toFixed(0)} ms/frame  eta ${((b - k) * el / done / 60).toFixed(1)} min`);
    }
  }
  ff.stdin.end();
  await new Promise((res) => ff.on('close', res));
}

async function video() {
  const from = num('from', 0), to = num('to', DURATION);
  const workers = num('workers', 2);
  const out = resolve(opt('out', join(ROOT, '../out/dominoes.mp4'))!);
  const tmp = join(dirname(out), '.chunks');
  if (existsSync(tmp)) rmSync(tmp, { recursive: true });
  mkdirSync(tmp, { recursive: true });
  const f0 = Math.round(from * fps), f1 = Math.round(to * fps);
  // interleave small blocks between workers so they finish together: worker w renders blocks w, w+W, ...
  const block = num('block', 300);
  const blocks: [number, number][] = [];
  for (let a = f0; a < f1; a += block) blocks.push([a, Math.min(f1, a + block)]);
  const pass = argv.filter((x, i) => !['video', '--out', '--workers', '--from', '--to', '--block'].includes(x) && !['--out', '--workers', '--from', '--to', '--block'].includes(argv[i - 1]!));
  const queue = blocks.map((bk, i) => ({ bk, file: join(tmp, `c${String(i).padStart(4, '0')}.mp4`) }));
  let next = 0;
  const run = async () => {
    while (next < queue.length) {
      const q = queue[next++]!;
      await new Promise<void>((res, rej) => {
        const p = spawn('bun', [join(ROOT, 'scripts/render.ts'), 'chunk', '--a', String(q.bk[0]), '--b', String(q.bk[1]), '--chunk-out', q.file, ...pass], { stdio: 'inherit' });
        p.on('close', (code) => (code === 0 ? res() : rej(new Error(`chunk ${q.bk} exited ${code}`))));
      });
    }
  };
  const t0 = performance.now();
  await Promise.all(Array.from({ length: workers }, run));
  const list = join(tmp, 'list.txt');
  writeFileSync(list, queue.map((q) => `file '${q.file}'`).join('\n'));
  const audio = join(ROOT, '../audio/dominoes.mp3');
  await new Promise<void>((res, rej) => {
    const p = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-ss', String(from), '-t', String(to - from), '-i', audio,
      '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', out], { stdio: 'inherit' });
    p.on('close', (code) => (code === 0 ? res() : rej(new Error(`mux exited ${code}`))));
  });
  console.log(`${out}  (${((performance.now() - t0) / 60000).toFixed(1)} min)`);
}

const modes: Record<string, () => Promise<void>> = { stills, sheet, video, chunk };
await (modes[mode] ?? stills)();
