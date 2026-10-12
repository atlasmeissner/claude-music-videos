// Post-processing on the finished frame: orange-only bloom, film grain, vignette.
// Everything is done in Canvas2D so the browser preview and the offline export match.
import { type AnyCanvas, type Ctx, H, W } from './draw';
import { mulberry32 } from './util';

export type CanvasFactory = (w: number, h: number) => AnyCanvas;

const GW = 480, GH = 270; // bloom works at quarter resolution

export class Post {
  private small: AnyCanvas;
  private sg: Ctx;
  private blurA: AnyCanvas;
  private ba: Ctx;
  private blurB: AnyCanvas;
  private bb: Ctx;
  private grain: AnyCanvas[] = [];
  private vignette: AnyCanvas;
  private S: number;

  constructor(make: CanvasFactory, S = 1) {
    this.S = S;
    this.small = make(GW, GH);
    this.sg = this.small.getContext('2d') as Ctx;
    this.blurA = make(GW, GH);
    this.ba = this.blurA.getContext('2d') as Ctx;
    this.blurB = make(GW, GH);
    this.bb = this.blurB.getContext('2d') as Ctx;
    // grain tiles: gaussian-ish luminance noise around mid-grey (neutral under overlay)
    for (let k = 0; k < 4; k++) {
      const c = make(256, 256);
      const g = c.getContext('2d') as Ctx;
      const img = g.createImageData(256, 256);
      const rnd = mulberry32(1234 + k * 77);
      for (let i = 0; i < 256 * 256; i++) {
        const n = (rnd() + rnd() + rnd() - 1.5) * 0.8165; // ~N(0, 0.5)
        const v = Math.max(0, Math.min(255, 128 + n * 70));
        img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
        img.data[i * 4 + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      this.grain.push(c);
    }
    // vignette
    this.vignette = make(W * S, H * S);
    const vg = this.vignette.getContext('2d') as Ctx;
    const grd = vg.createRadialGradient((W * S) / 2, (H * S) / 2, H * S * 0.35, (W * S) / 2, (H * S) / 2, W * S * 0.62);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, 'rgba(0,0,0,0.42)');
    vg.fillStyle = grd;
    vg.fillRect(0, 0, W * S, H * S);
  }

  /**
   * @param glow bloom strength (0..1.5); reduce on paper.
   * @param grain grain strength.
   * @param frame integer frame index (grain pattern).
   */
  apply(main: AnyCanvas, g: Ctx, opts: { glow: number; grain: number; frame: number; vignette?: number }) {
    const S = this.S;
    g.setTransform(1, 0, 0, 1, 0, 0);
    // ---- bloom: orange pixels only
    if (opts.glow > 0.01) {
      const sg = this.sg;
      sg.clearRect(0, 0, GW, GH);
      sg.imageSmoothingEnabled = true;
      sg.drawImage(main as unknown as CanvasImageSource, 0, 0, W * S, H * S, 0, 0, GW, GH);
      const img = sg.getImageData(0, 0, GW, GH);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i]!, gg = d[i + 1]!;
        let m = (r - gg - 30) / 150;
        if (m <= 0) { d[i] = d[i + 1] = d[i + 2] = 0; continue; }
        if (m > 1) m = 1;
        d[i] = r * m; d[i + 1] = gg * m; d[i + 2] = d[i + 2]! * m;
      }
      sg.putImageData(img, 0, 0);
      const ba = this.ba, bb = this.bb;
      ba.clearRect(0, 0, GW, GH);
      ba.filter = 'blur(2.5px)';
      ba.drawImage(this.small as unknown as CanvasImageSource, 0, 0);
      ba.filter = 'none';
      bb.clearRect(0, 0, GW, GH);
      bb.filter = 'blur(9px)';
      bb.drawImage(this.small as unknown as CanvasImageSource, 0, 0);
      bb.filter = 'none';
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.imageSmoothingEnabled = true;
      g.globalAlpha = Math.min(1, 0.55 * opts.glow);
      g.drawImage(this.blurA as unknown as CanvasImageSource, 0, 0, W * S, H * S);
      g.globalAlpha = Math.min(1, 0.75 * opts.glow);
      g.drawImage(this.blurB as unknown as CanvasImageSource, 0, 0, W * S, H * S);
      g.restore();
    }
    // ---- vignette
    const vig = opts.vignette ?? 1;
    if (vig > 0) {
      g.save();
      g.globalAlpha = vig;
      g.drawImage(this.vignette as unknown as CanvasImageSource, 0, 0);
      g.restore();
    }
    // ---- grain
    if (opts.grain > 0) {
      const rnd = mulberry32(opts.frame * 9973 + 17);
      const tile = this.grain[opts.frame % 4]!;
      const pat = g.createPattern(tile as unknown as CanvasImageSource, 'repeat')!;
      g.save();
      g.globalCompositeOperation = 'overlay';
      g.globalAlpha = opts.grain;
      g.translate(-Math.floor(rnd() * 256), -Math.floor(rnd() * 256));
      g.scale(Math.max(1, S), Math.max(1, S));
      g.fillStyle = pat;
      g.fillRect(0, 0, W * S + 512, H * S + 512);
      g.restore();
    }
  }
}
