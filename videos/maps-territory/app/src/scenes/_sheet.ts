// SHEET 1 · THE PLAN — the planner's map shared by `sheet`, `drew` and `ground`: the sheet on the right of the frame,
// a left column for the title cartouche, the lyric and the legend. A planner's map shows the coast and the lake
// and nothing of the relief ("the ground beneath my feet was never on the page").
import { F, font } from '../engine/type';
import { rgba } from '../engine/palette';
import { clamp, ease } from '../engine/util';
import { strokeText, drawStrokeText, type StrokeText } from '../engine/stroke';
import { compassStar, mono, neatline, scaleBar, type View } from './_mt';

export const SHEET_VIEW: View = { cx: 24.4, cy: 50, s: 8.6, rot: 0 };
export const COL_X = 120;

let titleST: StrokeText | null = null;
export const titleStroke = () => (titleST ??= strokeText('The Plan', 'script', 78, 0));

export interface FurnitureK { frame: number; star: number; scale: number; legend: number; title: number; ticks?: number }

/** The left column's own paper: a card beside the sheet on the dark desk (for the title, the verse, the legend). */
export function columnCard(c: CanvasRenderingContext2D, k: number) {
  if (k <= 0) return;
  const e = ease.outCubic(clamp(k));
  c.save();
  c.globalAlpha *= clamp(k * 1.5);
  c.translate(-(1 - e) * 60, 0);
  c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(COL_X - 44 + 6, 84 + 8, 640, 920);
  c.fillStyle = rgba('bone', 1); c.fillRect(COL_X - 44, 84, 640, 920);
  c.strokeStyle = rgba('ink', 0.5); c.lineWidth = 1; c.strokeRect(COL_X - 32, 96, 616, 896);
  c.restore();
}

/** The sheet's furniture at progress k (each 0..1). Returns the pen position if something is being drawn. */
export function drawFurniture(c: CanvasRenderingContext2D, v: View, k: FurnitureK, o: { alpha?: number } = {}) {
  let pen: { x: number; y: number } | null = null;
  c.save();
  c.globalAlpha *= o.alpha ?? 1;
  columnCard(c, Math.max(k.legend, k.title) * 4);
  const ink = rgba('ink', 0.88);
  neatline(c, v, ink, { k: k.frame, step: 10 });
  // compass star, top right inside the frame
  if (k.star > 0) {
    c.save(); c.globalAlpha *= clamp(k.star * 1.5);
    compassStar(c, 1520, 215, 40 * ease.outBack(clamp(k.star)), { col: rgba('ink', 0.85), fill: rgba('ink', 0.85), rot: (1 - clamp(k.star)) * 1.2, lw: 1 });
    c.restore();
  }
  if (k.scale > 0) {
    c.save(); c.globalAlpha *= clamp(k.scale * 2);
    scaleBar(c, v, 800, 925, 20 * clamp(k.scale), rgba('ink', 0.85), `${Math.round(20 * clamp(k.scale))} KM`);
    c.restore();
  }
  // title cartouche (left column, top): the title written by the pen
  if (k.title > 0) {
    const st = titleStroke();
    c.save();
    c.translate(COL_X, 236);
    c.strokeStyle = rgba('ink', 0.95); c.lineWidth = 2.4; c.lineCap = 'round'; c.lineJoin = 'round';
    const h = drawStrokeText(c, st, st.total * clamp(k.title));
    if (h && k.title < 1) pen = { x: COL_X + h.x, y: 236 + h.y };
    c.restore();
    const a = clamp((k.title - 0.6) / 0.4);
    c.save(); c.globalAlpha *= a;
    mono(c, 'SHEET 1', COL_X, 132, { size: 13, color: rgba('ink', 0.85), track: 5, weight: 600 });
    mono(c, 'A LIFE, DRAWN IN ADVANCE', COL_X, 286, { size: 12, color: rgba('ink', 0.75), track: 3 });
    mono(c, 'SCALE 1 : 1 000 000  ·  RELIEF NOT SHOWN', COL_X, 308, { size: 12, color: rgba('ink', 0.6), track: 2 });
    c.restore();
  }
  // legend (left column, bottom)
  if (k.legend > 0) {
    const x = COL_X, y = 780;
    const items: [string, (yy: number) => void][] = [
      ['PLANNED ROAD', (yy) => { c.lineWidth = 2; c.beginPath(); c.moveTo(x, yy - 4); c.lineTo(x + 40, yy - 4); c.stroke(); }],
      ['PLACE', (yy) => { c.lineWidth = 1.4; c.beginPath(); c.arc(x + 20, yy - 4, 6, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.arc(x + 20, yy - 4, 2, 0, Math.PI * 2); c.fill(); }],
      ['ONE YEAR', (yy) => { c.lineWidth = 1.2; for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(x + i * 10, yy - 9); c.lineTo(x + i * 10, yy + 1); c.stroke(); } }],
      ['COLOURED IN', (yy) => { c.lineWidth = 0.8; c.strokeRect(x, yy - 12, 40, 14); for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(x + i * 8, yy + 2); c.lineTo(x + i * 8 + 10, yy - 12); c.stroke(); } }],
    ];
    c.save();
    c.strokeStyle = rgba('ink', 0.85); c.fillStyle = rgba('ink', 0.85);
    c.globalAlpha *= clamp(k.legend * 1.5);
    mono(c, 'LEGEND', x, y - 26, { size: 12, color: rgba('ink', 0.85), track: 5, weight: 600 });
    c.lineWidth = 1; c.beginPath(); c.moveTo(x, y - 14); c.lineTo(x + 330, y - 14); c.stroke();
    items.forEach(([label, sym], i) => {
      const a = clamp(k.legend * items.length - i);
      if (a <= 0) return;
      c.save(); c.globalAlpha *= a;
      const yy = y + 22 + i * 34;
      sym(yy);
      mono(c, label, x + 64, yy, { size: 13, color: rgba('ink', 0.9), track: 2 });
      c.restore();
    });
    c.restore();
  }
  c.restore();
  return pen;
}

/** The plotter's pen: a fine crosshair with a warm point (Canvas2D, on paper). */
export function penCross(c: CanvasRenderingContext2D, x: number, y: number, a = 1) {
  if (a <= 0) return;
  c.save();
  c.globalAlpha *= a;
  c.strokeStyle = rgba('ink', 0.7); c.lineWidth = 1;
  c.beginPath(); c.moveTo(x - 18, y); c.lineTo(x - 5, y); c.moveTo(x + 5, y); c.lineTo(x + 18, y);
  c.moveTo(x, y - 18); c.lineTo(x, y - 5); c.moveTo(x, y + 5); c.lineTo(x, y + 18); c.stroke();
  c.fillStyle = rgba('blood', 1);
  c.beginPath(); c.arc(x, y, 2.6, 0, Math.PI * 2); c.fill();
  c.restore();
}
export { font, F };
