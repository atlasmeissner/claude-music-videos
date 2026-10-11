// Folded-paper line drawings for the letter plate (the words that fly away). A paper plane in three-quarter view: two wing panels and the keel, paper fill, ink folds.
import { rgba } from '../engine/palette';

/**
 * Paper plane with its nose at angle `ang` (radians, canvas y down), centred at (x, y); `s` = half its length.
 * `fold` 0..1 folds it out of a flat sheet (0 = a flat strip the width of the word, 1 = a plane), `w0` the strip's
 * half-width at fold 0 (the word it came from).
 */
export function drawPlane(c: CanvasRenderingContext2D, x: number, y: number, s: number, ang: number,
  o: { paper?: string; ink?: string; shade?: string; fold?: number; w0?: number; h0?: number; lw?: number } = {}) {
  const k = o.fold ?? 1;
  const w0 = (o.w0 ?? s) / s, h0 = (o.h0 ?? s * 0.3) / s;
  const L = (a: number, b: number) => a + (b - a) * k;
  // flat sheet corners (k = 0) → plane points (k = 1), in units of s
  const N = [L(w0, 1.0), L(0, 0)];
  const B = [L(-w0, -0.78), L(-h0, -0.46)]; // far wing tip
  const C = [L(-w0, -0.66), L(0, 0.06)]; // tail, centre fold
  const A = [L(-w0, -0.92), L(h0, 0.58)]; // near wing tip
  const K = [L(w0, -0.78), L(h0, 0.24)]; // keel
  c.save();
  c.translate(x, y); c.rotate(ang); c.scale(s, s);
  c.lineJoin = 'round'; c.lineCap = 'round';
  c.lineWidth = (o.lw ?? 1.8) / s;
  const ink = o.ink ?? rgba('ink', 1);
  const poly = (pts: number[][], fill: string) => {
    c.beginPath(); c.moveTo(pts[0]![0]!, pts[0]![1]!);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i]![0]!, pts[i]![1]!);
    c.closePath(); c.fillStyle = fill; c.fill(); c.strokeStyle = ink; c.stroke();
  };
  const paper = o.paper ?? rgba('bone', 1);
  poly([N, B, C], paper);
  poly([N, C, K], o.shade ?? rgba('ash', 1));
  poly([N, C, A], paper);
  c.restore();
}
