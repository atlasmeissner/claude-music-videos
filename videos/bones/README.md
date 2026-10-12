# Bones — music video

A generative, code-rendered music video with word-synced karaoke typography for "Bones" by Joburgalex (made with
Suno), the opening track of the album *Maps & Territory*: a song about first principles — strip everything down
to what is actually true, then build up from there. Every frame is a deterministic function of song time,
rendered in headless Chromium (TypeScript + three.js), encoded with ffmpeg.

**Watch / download:** the 1080p30 render (3:19, 389 MB) is in [`render/`](render/), split into five parts (GitHub's
100 MB file limit); join them with one command, see [`render/README.md`](render/README.md):
`cat bones_1080p30.mp4.part0 … bones_1080p30.mp4.part4 > bones_1080p30.mp4`.

The renderer is a fork of the [pdoom-video](https://github.com/mexicat/pdoom-video) engine (MIT), by way of
[`one-degree`](../one-degree/): same timeline, post-processing, typography and export pipeline, with a bone-and-ink
palette, a small kit of motifs, a procedural building, a 3D line-drawn cathedral and seventeen new plates.

## The idea

**A set of demolition and construction drawings.** The song's production is its concept: one bare piano note,
then strings, drums, guitars and a choir, until the last chorus is a cathedral of sound built from that single
note. The video does the same. The first half is a demolition: an imposing, gilded, inherited façade is measured,
pulled at until it bends, found to be carrying loads that were never ours, then stripped — gold, stone, ornament —
down to its frame, its bones. The blueprints burn; what survives is a handful of survey points, and one of them
goes down to bedrock. The second half is a construction: from that one point a post, a lintel, then a frame, then
arches and rib vaults rise member by member on the beat, the way the arrangement builds instrument by instrument,
until the keystone of a cathedral is set — and it is the same point. At the end everything is taken back down to
it. Full concept, palette, type and plate list: [`docs/TREATMENT.md`](docs/TREATMENT.md).

Running devices: **the point** (one vermilion chalk-line mark: the first piano note, the corner pulled at, the
bearing, the benchmark, the keystone) is in every plate; **the ledger** counts what is ASSUMED (1,214 at the
start, down to 0 on the bridge's "finally saw") and what is PROVEN (up by one for every member built); every plate
is a **drawing sheet** with a deadpan title block (D- sheets for demolition, S- sheets for structure).

| Plate | Lyric | Idiom |
|---|---|---|
| `note` | intro | the title; every piano note a point that rings out; surveyed into one |
| `facade` | They built these walls… / Told me this is just the shape of things | pull back to an engraved gilded façade; its plan, the "shape" traced |
| `edges` | But I've been pulling at the edges / And the whole thing bends | the engraved façade cut along hidden fracture lines: the corner torn off, then the building settles, cracks through and drops its stones |
| `carry` | What if everything I'm carrying / Was never mine to hold | a load take-down; every load stamped NOT MINE; the stack lifts off |
| `strip` | Take me down to the bones / Strip the gold and the stone | an x-ray scan; the gold falls, the stone falls, the frame stands |
| `shown` | I don't need what I was shown / Build it up from the bones | ornament specimens struck out; post and lintel from the point |
| `xray` | instrumental | the old building's bones in 3D, four views, a section plane |
| `maps` | Every map they drew was borrowed / Every truth was someone else's guess | a map stitched from borrowed patches that slide out of register |
| `burn` | So I'm burning all the blueprints / Starting from what's left | the blueprint burns; the survey benchmarks survive |
| `ground` | What if all I really needed / Was the ground beneath my feet | a stratum per word down to bedrock; the level reads TRUE |
| `orders` | chorus 2 | one Corinthian column stripped through the orders to a post; a colonnade |
| `build` | chorus 3 | the new frame rising from the point, a member group per beat |
| `wreckage` | I stood in the wreckage… / The only foundation was never the wall | whispered: the rubble; a section — under the wall, nothing |
| `cathedral` | final chorus | the vaults close; the keystone is lowered into place on the last "bones": it is the point |
| `vault` | "From the bones" / choir | inside the nave; the choir lights the frame node by node |
| `asbuilt` | choir | the record drawing, stamped AS BUILT |
| `outro` | Take me down | the nave retracts into the point; title |

## Layout

- `audio/bones.mp3` — the song.
- `lyrics/lyrics.txt` — the lyric sheet; `lyrics/lines.sung.json` — the lines as actually sung, with coarse windows
  (Suno sings chorus 1 with one "Take me down" pair, adds a "From the bones" tag after the final chorus and a last
  "Take me down" at the end of the choir outro).
- `analysis/` — Python tools: `whisper_run.py` (faster-whisper medium.en and large-v3 on the Demucs htdemucs_ft
  vocal stem, for line placement), `align.py` (MMS CTC forced alignment of each sung line in its window, with the
  word-start corrections in `fix.json` from `notes.py` pitch segmentation and the `vmap2.py` vocal map),
  `analyze.py` (138.235 BPM constant grid, downbeats, sections, envelopes, onsets), `piano.py` (piano note onsets
  and pitches for the intro), `windows.py` (plate windows for segment renders).
- `data/lyrics.json`, `data/audio.json` — word-level lyric timings and the music analysis.
- `app/` — the renderer (bun + Vite + three.js). `src/engine/` is the forked engine; `src/scenes/_bones.ts` is the
  shared kit (the point, the ledger, title blocks, karaoke and slam typography), `_facade.ts` the procedural
  building (gold / stone / frame layers and its plan), `_fracture.ts` the same building cut
  into Voronoi stone cells grouped into fragments that crack apart (used by `edges`; `_facadePaint.ts` paints the
  silhouette it is cut from), `_frame3d.ts` the 3D frames (the old building's bones and the
  cathedral nave with its build schedule); one module per plate in `src/scenes/`; `src/timeline.ts` anchors the
  plates to lyric lines and beats.
- `docs/` — `TREATMENT.md` (the plan), `ENGINE.md` (the pdoom-video engine and scene API).

## Render

Requirements: [bun](https://bun.sh), Chromium/Chrome, ffmpeg with libx264, Python 3 (for `analysis/windows.py`).

```sh
cd app
bun install
bunx vite                                    # preview at http://localhost:5173 (?t=94 to start at a time)
bun scripts/render.ts stills --t 46.6,151 --out ../out/stills
python3 ../analysis/windows.py               # (from the video folder) plate windows → out/windows.json
scripts/segments.sh note facade edges …      # each plate → out/seg/<id>.mp4 (1080p30, no audio)
scripts/assemble.sh                          # joins the plates and muxes the song → out/bones.mp4
```

The published render was made in a CPU-only cloud container (SwiftShader: about 1.7 s per frame for one render,
3.5 s each with two plates rendering side by side; 3 hours for the song), hence 30 fps and one sample per frame. On a GPU machine,
`render.ts video --samples auto --fps 60` renders a single 60 fps file with motion blur.

Engine changes from one-degree: the bone-and-ink palette with a `gold` accent in `palette.ts` (and `C_GOLD` in the
GLSL common block), and a higher bloom threshold in `post.ts` so that bone-white type and lines stay crisp and only
the vermilion point glows.

## How it was made

Made with Claude (Opus 5.5) in conversation, by a single agent: the concept and treatment, the stem separation and
lyric alignment, the kit, the building and the cathedral, all seventeen plates, the contact-sheet reviews and the
renders.

## Credits

- **Song:** "Bones" by Joburgalex, from *Maps & Territory*, made with Suno.
- **Engine:** forked from [mexicat/pdoom-video](https://github.com/mexicat/pdoom-video) (MIT).
- **Fonts:** Archivo, IBM Plex Mono, Cormorant Garamond (SIL Open Font License); single-stroke EMS and Hershey fonts
  via the `hersheytext` package (OFL / public domain).
