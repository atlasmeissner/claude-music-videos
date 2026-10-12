// The drawing's furniture: a drafting grid in world space and a title block in the corner (sheet,
// section, consequences so far, timecode), like the margin of an engineering drawing.
import { type R, W, H } from './engine/draw';
import { mono } from './engine/fonts';
import { clamp, lerp, smoothstep } from './engine/util';

/** Faint drafting crosses at a spacing that adapts to the zoom (two levels cross-fade). */
export function grid(r: R) {
  const z = r.cam.z;
  const target = 90 / z; // world spacing for ~90 px on screen
  const lg = Math.log10(target);
  const base = Math.pow(10, Math.floor(lg));
  const levels = [base, base * 10];
  const f = lg - Math.floor(lg); // 0..1 between levels
  const g = r.g;
  const v = r.view;
  levels.forEach((sp, li) => {
    const a = li === 0 ? 1 - f : f;
    if (a < 0.05) return;
    const n = ((v.x1 - v.x0) / sp) * ((v.y1 - v.y0) / sp);
    if (n > 2500) return;
    const arm = r.px(3.5);
    g.beginPath();
    for (let x = Math.floor(v.x0 / sp) * sp; x <= v.x1; x += sp) {
      for (let y = Math.floor(v.y0 / sp) * sp; y <= v.y1; y += sp) {
        g.moveTo(x - arm, y);
        g.lineTo(x + arm, y);
        g.moveTo(x, y - arm);
        g.lineTo(x, y + arm);
      }
    }
    r.alpha(a * 0.9, () => r.stroke(r.c('faint'), 1));
  });
}

interface Sheet { t: number; no: number; name: string }
const SHEETS: Sheet[] = [
  { t: 0, no: 1, name: 'ONE DOMINO, STANDING' },
  { t: 3.1, no: 2, name: 'XYLOPHONE, CHIMES, MARIMBA, LIFT' },
  { t: 16.6, no: 3, name: 'THREAD AND TOWER' },
  { t: 19.9, no: 4, name: 'STONE, DAM, RESERVOIR' },
  { t: 23.0, no: 5, name: 'SEESAW, BELLOWS, SPEAKING TUBE' },
  { t: 26.6, no: 6, name: 'MATCH, FUSE, A STRANGER’S HOUSE' },
  { t: 30.4, no: 7, name: 'BUFFER STOP' },
  { t: 33.6, no: 8, name: 'PLOTTER' },
  { t: 37.17, no: 9, name: 'CHORUS I' },
  { t: 50.24, no: 10, name: 'APPARATUS: AND THEN?' },
  { t: 61.5, no: 11, name: 'VERSE II — PLAN' },
  { t: 76.2, no: 12, name: 'STAIRS (UNSEEN)' },
  { t: 80.0, no: 13, name: 'GENERAL ARRANGEMENT' },
  { t: 83.16, no: 14, name: 'CHORUS II' },
  { t: 96.52, no: 15, name: 'SOMETHING SMALL' },
  { t: 110.2, no: 16, name: 'EACH TWICE THE LAST' },
  { t: 135.5, no: 17, name: 'HOW FAR THE FALLING GOES' },
  { t: 150.2, no: 18, name: 'DOMINOES' },
];

// consequences counted so far (things that have fallen, struck or moved), interpolated
const COUNT: [number, number][] = [
  [0, 0], [3.1, 1], [7.4, 21], [11.3, 34], [16.2, 46], [20, 50], [23.3, 59], [26.7, 64], [30.7, 72], [37.2, 80],
  [40, 96], [43.4, 1120], [46.5, 1136], [49.5, 1356], [50.3, 1360], [61.2, 1537], [76.2, 1546], [83.2, 1556],
  [86.3, 1572], [90, 2120], [92.9, 2136], [96.5, 2356], [102.6, 2376], [109.8, 2377], [135.6, 2397],
  [149.8, 1050973], [164.3, 1050973],
];
export function consequences(t: number) {
  for (let i = 1; i < COUNT.length; i++) {
    if (t < COUNT[i]![0]) {
      const a = COUNT[i - 1]!, b = COUNT[i]!;
      const u = (t - a[0]) / (b[0] - a[0]);
      // big jumps run up exponentially
      const v = b[1] / Math.max(1, a[1]) > 20 ? Math.exp(lerp(Math.log(Math.max(1, a[1])), Math.log(b[1]), u)) : lerp(a[1], b[1], u);
      return Math.floor(v);
    }
  }
  return COUNT[COUNT.length - 1]![1];
}

/** Title block in the bottom-right corner (screen space). `machineT` is the (possibly rewound) time. */
export function titleBlock(r: R, songT: number, machineT: number, rewind: number) {
  const a = smoothstep(3.3, 4.2, songT) * (1 - smoothstep(163.8, 164.6, songT)) * (1 - rewind);
  if (a <= 0.01) return;
  let sh = SHEETS[0]!;
  for (const s of SHEETS) if (machineT >= s.t) sh = s;
  const w = 380, h = 74;
  const x = W - 48 - w, y = H - 40 - h;
  r.screen();
  r.alpha(a, () => {
    const col = r.c('mid');
    r.box(x, y, 0, 0, 0, w, h, col, r.c('bg', 0.92), 1);
    r.line(x, y + 26, x + w, y + 26, col, 1);
    r.line(x + 92, y, x + 92, y + 26, col, 1);
    r.line(x + 250, y, x + 250, y + 26, col, 1);
    r.text(`SHEET ${String(sh.no).padStart(2, '0')}`, x + 10, y + 18, mono(12, 500), r.c('fg'));
    r.text('DOMINOES', x + 102, y + 18, mono(12, 600), r.c('fg'));
    const fr = Math.floor(songT * 30) % 30;
    const mm = Math.floor(songT / 60), ss = Math.floor(songT % 60);
    r.text(`${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}:${String(fr).padStart(2, '0')}`, x + 260, y + 18, mono(12), col);
    r.text(sh.name, x + 10, y + 45, mono(12, 500), r.c('fg'));
    const n = consequences(machineT);
    r.text(`CONSEQUENCES SO FAR: ${n.toLocaleString('en-US')}`, x + 10, y + 64, mono(12), n > 100000 ? r.c('sig') : col);
    r.text('JOBURGALEX', x + w - 10, y + 64, mono(12), col, 'right');
  });
  void clamp;
}
