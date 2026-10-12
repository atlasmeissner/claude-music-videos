// Browser preview: the same frame code as the offline export, played against the audio.
// Keys: space play/pause · ←/→ seek 1 s (shift: 5 s) · , / . one frame · h hide the UI.
// URL: ?t=23 starts at 23 s; &scale=0.5 renders at half resolution.
import { DURATION } from './engine/audio';
import { R, type Ctx, H, W } from './engine/draw';
import { FONT_FILES } from './engine/fonts';
import { Post } from './engine/post';
import { renderFrame } from './frame';
import audioUrl from '../../audio/dominoes.mp3?url';

const params = new URLSearchParams(location.search);
const scale = Number(params.get('scale') ?? 1);
const canvas = document.getElementById('c') as HTMLCanvasElement;
canvas.width = W * scale;
canvas.height = H * scale;
const g = canvas.getContext('2d')!;
const r = new R(g as unknown as Ctx, scale);
const post = new Post((w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c as unknown as { width: number; height: number; getContext(t: '2d'): unknown };
}, scale);

const audio = new Audio(audioUrl);
audio.preload = 'auto';
let t = Number(params.get('t') ?? 0);
let playing = false;

async function loadFonts() {
  await Promise.all(FONT_FILES.map(async (f) => {
    const face = new FontFace(f.family, `url(fonts/${f.file})`, { weight: String(f.weight), style: f.style });
    await face.load();
    document.fonts.add(face);
  }));
}

function draw() {
  const th = renderFrame(r, t);
  post.apply(canvas as never, g as unknown as Ctx, { glow: th.glow, grain: 0.09, frame: Math.round(t * 30) });
  const fill = document.getElementById('fill')!;
  fill.style.width = `${(t / DURATION) * 100}%`;
  const mm = Math.floor(t / 60), ss = (t % 60).toFixed(2).padStart(5, '0');
  document.getElementById('time')!.textContent = `${String(mm).padStart(2, '0')}:${ss}`;
}

function loop() {
  if (playing) {
    t = audio.currentTime;
    if (audio.ended) playing = false;
  }
  draw();
  requestAnimationFrame(loop);
}

function seek(to: number) {
  t = Math.max(0, Math.min(DURATION, to));
  audio.currentTime = t;
}

window.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === ' ') {
    e.preventDefault();
    playing = !playing;
    if (playing) { audio.currentTime = t; void audio.play(); } else audio.pause();
  } else if (e.key === 'ArrowRight') seek(t + (e.shiftKey ? 5 : 1));
  else if (e.key === 'ArrowLeft') seek(t - (e.shiftKey ? 5 : 1));
  else if (e.key === '.') seek(t + 1 / 30);
  else if (e.key === ',') seek(t - 1 / 30);
  else if (e.key === 'h') document.getElementById('ui')!.classList.toggle('hidden');
});
document.getElementById('bar')!.addEventListener('click', (e) => {
  const b = (e.currentTarget as HTMLElement).getBoundingClientRect();
  seek(((e.clientX - b.left) / b.width) * DURATION);
});
document.getElementById('start')!.addEventListener('click', (e) => {
  (e.currentTarget as HTMLElement).remove();
  playing = true;
  audio.currentTime = t;
  void audio.play();
});

void loadFonts().then(() => requestAnimationFrame(loop));
