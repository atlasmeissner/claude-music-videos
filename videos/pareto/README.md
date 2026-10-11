# Pareto — music video

A generative, code-rendered music video with word-synced karaoke typography for "Pareto (Remastered)" by lexm
(made with Suno): upbeat Britpop about the 80/20 rule applied to a scruffy, happy London life. Every frame is a
deterministic function of song time, rendered in headless Chromium (TypeScript + three.js), encoded with ffmpeg.

**Watch / download:** the 1080p30 render (4:58, 222 MB) is in [`render/`](render/), split into three parts (GitHub's
100 MB file limit); join them with one command, see [`render/README.md`](render/README.md):
`cat pareto_1080p30.mp4.part0 pareto_1080p30.mp4.part1 pareto_1080p30.mp4.part2 > pareto_1080p30.mp4`.

The renderer is a fork of the [pdoom-video](https://github.com/mexicat/pdoom-video) engine (MIT): same timeline,
post-processing, typography and export pipeline, with a new palette, a new kit of motifs and fifteen new scenes.

## The idea

**"The Vital Few" — plates from a deadpan statistical almanac of one ordinary British life.** Every plate measures
something small and domestic with the apparatus of a Victorian treatise on political economy, and every plate is split
80/20: four-fifths grey, one-fifth pillar-box red — the red fifth always marks what matters (the 20 records, the
charred corner of the toast, the wink, the two friends, the fire, the pint). The 10×10 grid of the title page returns
at the end and empties back to the first frame, so the video loops. Full concept, palette, type and plate-by-plate
treatment: [`docs/TREATMENT.md`](docs/TREATMENT.md).

| Plate | Lyric | Idiom |
|---|---|---|
| I `open` | intro | title page: census grid, PARETO stamped per bar, the Pareto curve plotted |
| II `flat` | Woke up in a flat… | survey floor plan, mess census; a clock 4/5 swept |
| III `records` | a hundred records… needle-drop twenty | 100 catalogued spines; a turntable |
| IV `kettle` | The kettle's boiling over… | kitchen engraving; effort vs. result |
| V `park` | running 'round the park… watching the news | park survey map; a wall of five TVs |
| VI / XI `chorus` | Oh, give me the twenty… | the Pareto chart: sung words become sorted bars |
| VII / XII `lopsided` | a lopsided world… watching time fly by | a balance; a runway along 20/100; flying clocks |
| VIII `camden` | Met a girl in Camden… | night street, chat log, one wink, a fifth of a smile |
| IX `friends` | Most of my friends… a beautiful drain | a census of ten figures; static, rain, a red umbrella |
| XIII `bridge` | Vilfredo Pareto, he knew the score… | guilloché rosettes, pea pods, the law carved in stone |
| XIV `cut` | Cut the fat! … on fire! | scissor cuts on the drum hits; the red fifth ignites |
| XV `solo` | guitar solo | 100 strings driven by the guitar stem's spectrum; a sunrise |
| `outro` | Eighty percent of this song is just vibe… | the song's own timeline; a pint and you; back to the grid |

## Layout

- `audio/pareto.mp3` — the song.
- `lyrics/lyrics.txt` — the lyric text by section.
- `analysis/` — Python (uv) tools: `separate.py` (htdemucs stems), `emissions.py` (MMS_FA + wav2vec2 CTC emissions),
  `align.py` (global constrained CTC Viterbi → word timings, cross-checked with `whisper_run.py`), `analyze.py`
  (beats, downbeats, sections, envelopes, onsets).
- `data/lyrics.json`, `data/audio.json` — word-level lyric timings and the music analysis (≈96.5 BPM, drifting slightly).
- `app/` — the renderer (bun + Vite + three.js). `src/engine/` is the forked engine; `src/scenes/_kit.ts` is the
  shared Pareto kit (paper ground, karaoke, red fifth, 10×10 grid, Pareto curve, plate heads); one module per plate in
  `src/scenes/`; `src/timeline.ts` anchors the plates to lyric lines and downbeats.
- `docs/` — `TREATMENT.md` (the plan), `AGENT_BRIEF.md` (the brief the scene agents worked from), `ENGINE.md`
  (engine and scene API).

## Render

Requirements: [bun](https://bun.sh), Chromium/Chrome, ffmpeg with libx264.

```sh
cd app
bun install
bunx vite                                   # preview at http://localhost:5173 (?t=66 to start at a time)
bun scripts/render.ts stills --t 70,113 --out ../out/stills
bun scripts/segments.ts render --fps 30     # every plate in resumable chunks → out/seg/
bun scripts/segments.ts concat              # joins the chunks with the audio → out/pareto.mp4
```

`render.ts video --samples auto --fps 60` also works for a single 60 fps file with motion blur on a GPU machine. The
published render was made in a CPU-only cloud container (SwiftShader, ~0.65 frames/s), hence 30 fps and one sample
per frame; the export path was trimmed for that (quarter-resolution bloom pyramid, textured paper ground, static HUD
frames skipped).

## How it was made

Made with Claude (Opus 5.5) in conversation: the concept and treatment, the stem separation and lyric alignment, the
kit, the title and outro plates and the renders by the lead agent; the other plates by four parallel scene agents
working from `docs/AGENT_BRIEF.md`, reviewed through contact sheets and revised.

## Credits

- **Song:** "Pareto (Remastered)" by lexm, made with Suno.
- **Engine:** forked from [mexicat/pdoom-video](https://github.com/mexicat/pdoom-video) (MIT).
- **Fonts:** Archivo, IBM Plex Mono, Cormorant Garamond (SIL Open Font License); single-stroke EMS and Hershey fonts
  via the `hersheytext` package (OFL / public domain).
