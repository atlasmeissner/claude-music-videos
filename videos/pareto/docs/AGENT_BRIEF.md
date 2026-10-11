# Brief for scene authors — Pareto music video

You are building plates (scene modules) for a generative, code-rendered music video of the song "Pareto" (Britpop, ~120 BPM, ~5 min). The engine is a fork of the pdoom-video renderer (TypeScript + three.js, run with bun + Vite, rendered offline in headless Chromium). Every frame is a pure function of song time.

## Read first (in this order)

1. `docs/TREATMENT.md` — the concept, palette, type, karaoke rules, and **your plates' descriptions**. Follow it, but you own the details: improve on it where you have a better idea that keeps the spirit (deadpan almanac, the red fifth, 80/20 everywhere, beat-synced, Britpop-bright).
2. `docs/ENGINE.md` — engine API (Scene class, Frame, Layer2D, FSPass, LineBatch, type/stroke fonts, post overrides, determinism rules). Ignore its P(doom)/mask/spark specifics: they belong to the old video.
3. `app/src/scenes/_kit.ts` — the shared Pareto kit: `Ground` (paper/ink background pass), `drawKaraokeWords` (per-word, per-glyph karaoke wipe, key words red), `wrapWords`, `wordIn`, `isKey`, `drawFifthBar`, `drawFifthWedge`, `drawGrid100` + `VITAL20`, `pareto(x)` + `drawParetoCurve`, `drawPlateHead` (running head "PLATE IV — …"), `footnote`, `beatPunch`. Use them so recurring motifs match across plates. Do not edit `_kit.ts`; if you need a change, copy the helper into your own file and tell the lead in your final report.
4. `app/src/scenes/open.ts` (when present) — a finished plate by the lead, as a reference for code style and quality bar.
5. `data/lyrics.json` — word-level timings (each line has `section`, `text`, `start`, `end`, `words[{w,start,end,syl?}]`). `data/audio.json` — beats, downbeats, sections, envelopes (`f.a.*`), onsets (kick/snare/hat/vocal/guitar). Print what you need with a quick `bun -e` or python one-liner. Look lines up by content (`this.ctx.lyrics.get('kettle')`), never hard-code times.
6. `app/src/timeline.ts` — your entries' windows (do not edit it; ask the lead if a boundary is wrong).

## Rules

- Write only your own files: `app/src/scenes/<name>.ts` and helpers `app/src/scenes/<name>-*.ts`. Don't edit the engine, the kit, the timeline, or other agents' scenes.
- **Software rendering** (SwiftShader, 2 CPU cores shared with other agents): keep frames cheap. Prefer Canvas2D layers (at most 2 `Layer2D` per scene) + the `Ground` pass + an optional light `FSPass` or a `LineBatch`. No raymarching, no heavy fbm loops, no per-pixel loops in JS, no `getImageData`. Precompute geometry in `init()`.
- Post presets in the kit: paper plates return `{ ...PAPER_POST, ... }` (halation OFF — otherwise the page turns pink), dark plates `{ ...INK_POST, ... }`.
- Canvas2D layers are sRGB and never bloom. For a glowing red/gold element, draw it on its own `Layer2D` and composite it with `this.ctx.comp.draw(renderer, tex, out, { mode: 'add' or 'normal', tint: [g, g, g] })` with g ~1.5–2.5, or use a `LineBatch` with colours > 1. Bone type must stay crisp (no bloom): defaults already use bloomThreshold 0.85; on paper plates return `{ bloom: 0.25, paper: 1 }` or similar.
- Deterministic: no `Math.random`, `Date.now`, `performance.now`. Use `hash`, `mulberry32`, `noise1` from `engine/util.ts`. Per-frame jitter keyed to `frameIdx(t)`.
- Karaoke: every word of every line in your window must be readable and highlight exactly when sung (`Lyrics.wordProgress`). Show a line dim at most ~0.4 s early. Words are part of the picture (on a shelf label, in steam, in a ticker…), not subtitles. Key words (see `KEY_WORDS` in the kit) are signal red when sung. Keep text ≥ 96 px from the frame edges.
- Motion: cuts and big changes on downbeats/beats (`audio.downbeats`, `audio.timeOfBeat(i)`, `f.beat`, `f.beatPhase`), hits on kicks/snares (`f.a.kick`, `f.a.snare`), strong eases (`ease.outExpo`, `outBack`, `inOutCubic`). Something always moves; the camera (a transform on your canvas or uv) reframes on the beat. No floaty drift.
- People only as geometric figures (circle head, capsule body). No faces, no logos, no brands, no real banknotes, no flags, no imitation of album covers.
- Each plate starts with a running head `drawPlateHead(c, n, 'TITLE', k, { paper })` (plate numbers in the table below) that types in over the first ~0.6 s and may leave after a few seconds — keep it small and quiet; it's the almanac's page furniture.
- Hand-offs: entries touch (hard cut at the boundary). Your first frame should read as a fresh plate on a downbeat; your last ~0.3 s may anticipate the next plate (e.g. collapse to a red dot, a white flash via `flash` post override).

## Reference code

The original pdoom-video scenes (a different song, same engine, very high craft bar) are at `/tmp/claude-0/-home-claude/eb110f41-2e55-5cdb-bd6d-2be69d1d8445/scratchpad/ref/pdoom-video/app/src/scenes/` — read them for idioms (beat-synced choreography, `keys()`, Canvas2D camera transforms, stroke text, LineBatch use, hand-offs). Don't copy their imagery (orange spark, mask, P(doom)).

## Plate numbers

I open · II flat · III records · IV kettle · V park · VI chorus (n=1) / XI (n=2) · VII lopsided (n=1) / XII (n=2) · VIII camden · IX friends · XIII bridge · XIV cut · XV solo · (outro: no head, it's the colophon)

## Checking your work

- A dev server without live reload runs at http://localhost:5173 (if it's down, `render.ts` starts a private one automatically).
- Stills (then LOOK at the PNGs with the Read tool — this is the main feedback loop):
  `cd app && bun scripts/render.ts stills --t 12.5,13.0 --only flat --out ../out/wip/flat`
- Contact sheet of a range: `bun scripts/render.ts sheet --from 10 --to 24 --n 12 --cols 4 --only flat --out ../out/wip/flat/sheet.png`
- A short clip to judge motion (slow here; use sparingly, low fps): `bun scripts/render.ts video --from 20 --to 24 --fps 15 --only flat --out ../out/wip/flat.mp4 --preset ultrafast` then extract frames with ffmpeg if needed.
- Typecheck: `cd app && bunx tsc --noEmit -p tsconfig.json 2>&1 | grep scenes/<name>`.
- `render.ts` prints `SCENE ERRORS` and browser console errors — read them.
- Renders take a few seconds per still (software GL, shared CPU). Check at least: the first frame, every lyric line mid-word, every beat-synced hit you designed, and the last frame. Verify each word highlights on its sung time, and that nothing overlaps illegibly.
- Budget: aim for under ~250 ms per frame in `perf` mode (`bun scripts/render.ts perf --from A --to A+1 --only id`); report your number.

## Final report

When done, reply with: files written, a 3–5 line description per plate of what happens (with the lyric beats it hits), the perf number per plate, anything you'd want from the lead (kit/engine/timeline changes), and known weaknesses.
