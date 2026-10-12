# Maps & Territory — music video

A generative, code-rendered music video with word-synced karaoke typography for "Maps & Territory" by Joburgalex,
the title track of the album *Maps & Territory* (made with Suno): a French horn calling across open country, and a
song about the gap between the life you plan and the one you find. Every frame is a deterministic function of song
time, rendered in headless Chromium (TypeScript + three.js), encoded with ffmpeg.

**Watch / download:** the 1080p30 render (5:19, 536 MB) is in [`render/`](render/), split into six parts (GitHub's
100 MB file limit); join them with one command, see [`render/README.md`](render/README.md):
`cat maps-territory_1080p30.mp4.part0 … maps-territory_1080p30.mp4.part5 > maps-territory_1080p30.mp4`.

The renderer is a fork of the [pdoom-video](https://github.com/mexicat/pdoom-video) engine (MIT), by way of
[`one-degree`](../one-degree/): same timeline, post-processing, typography and export pipeline, with the album
cover's palette, one invented country with a shared terrain shader, and twenty-one new plates.

## The idea

**"The map is not the territory"** (Korzybski, 1931). The whole video is set in one invented country, a
100 × 100 km sheet with a mountain spine, a lake, a coast and, offshore, an islet that no map shows. Every plate
looks at that same place either as **the map** (bone paper, ink hairlines, contours, ruled roads, mono
annotations) or as **the territory** (the shaded, engraved relief itself, at night or in gold light). Two lines run
through it: **the plan**, the life as drawn (a ruled road from HOME through SCHOOL, UNIVERSITY, FIRST JOB,
PROMOTION and THE HOUSE to RETIREMENT, straight over the mountains and through the middle of the lake), and **the
track**, the life as walked (a gold line with a lamp at its head that keeps to the valleys, takes the detours,
turns east at every wrong turn and ends off the shore, on the islet). The plates trade the map for the territory as
the song goes on, and the French horn bookends it: the first plate is the horn's call sounding out the land in the
dark, the last is the lamp alone, fading into silence. Full concept, palette, type and plate list:
[`docs/TREATMENT.md`](docs/TREATMENT.md).

| Plate | Lyric | Idiom |
|---|---|---|
| `horn` | intro, the horn alone | the call travels out from the lamp; contour lines light up as the wavefront passes, as bright as the horn was loud |
| `vista` | intro, the band comes in | a panorama of ridgelines (sections through the height field); the title and the artist |
| `korzybski` | intro, drum break | "The map is not the territory."; a loupe over the map shows the territory; NOT SHOWN ON THIS SHEET |
| `sheet` | intro, last bars | a plotter draws the empty sheet: neatline, coast, compass star, scale, legend, "The Plan" |
| `drew` | I drew the life… (verse 1) | the plan drawn as it is sung: the ruled road, a tick a year, the places, the districts coloured in; the verse written by a second pen |
| `ground` | But the ground beneath my feet… | a hole opens in the paper at FIRST JOB and the relief shows through; on "page" the sheet is gone |
| `chorus1` | These are maps… | split screen, MAP and TERRITORY of the same place; the map slips off the land |
| `tracing` | I was tracing… / off the shore | somebody else's dotted route on tracing paper; the lamp leaves it and walks into the sea to the islet (sea teal) |
| `detour` | I planned for sun… (verse 2) | a wrong forecast and rain; a packing list stamped FEAST; DETOUR signs that turn into ROAD; every wrong turn points east |
| `fits` | And the life I never planned… | the plan crosses the contours, the track lies between them; two elevation profiles; FIT 23 % / 97 % |
| `chorus2` | These are maps… | the territory with a map lens that disagrees more and more |
| `compass` | Now I'm lost but I'm not looking anymore | a compass spins free; the map folds itself up like a road map and is put away |
| `bridge` | What if getting lost (×2) / …finally arrive | loops around the track, no north; the pull-back; on "arrive" the compass star of the cover |
| `chorus3` | These are maps… / …the way I thought it would | gold light; the map is an inset, shrinking |
| `beyond` | But the life I found beyond the story… | paper inside the neatline, lit country outside; the pull-back past the sheet's edge |
| `journey` | instrumental | a track-up flight along the whole walk; DISTANCE WALKED, DEVIATION FROM PLAN |
| `dawn` | instrumental | the islet before dawn (sea teal); the ridgeline panorama again, facing west at sunrise |
| `chorus4` | These are maps… | full gold light; the map's ghost contours fade out word by word |
| `found` | …more beautiful than lines on paper could | the plan as a strip of ruled tape, peeled off the country |
| `return` | outro, the horn returns, "oh" | the album cover's picture: out at sea looking west, ridgelines, water lines, the gold track, the compass star |
| `coda` | outro, to silence | the pull-back to the contour-lit country of the first frame; the title; the lamp goes out |

## Layout

- `audio/maps_territory.mp3` — the song.
- `lyrics/lines.sung.json` — the lines as actually sung, with coarse windows (the bridge sings "What if getting
  lost" twice; the final chorus's last line is sung "Oh, it's more beautiful…").
- `analysis/` — Python tools: `whisper_run.py` / `whisper_clip.py` (faster-whisper medium.en on the htdemucs_ft
  vocal stem, large-v3 on clips to settle doubtful passages), `align.py` (torchaudio MMS_FA CTC forced alignment of
  each sung line in its window, plus word-start fixes from `notes.py` (pYIN note segmentation) and `vmap2.py`
  (vocal map on the beat grid)), `analyze.py` (139.6 BPM constant grid, downbeats, sections, envelopes, onsets),
  `windows.py` (plate windows for segment renders).
- `data/lyrics.json`, `data/audio.json` — word-level lyric timings and the music analysis.
- `app/` — the renderer (bun + Vite + three.js). `src/engine/` is the forked engine; `src/scenes/_world.ts` is the
  country (height function, baked height texture, the plan, the A* track); `src/scenes/_mt.ts` the kit (views, the
  terrain shader for map/territory with split/lens/sheet masks, the track and its lamp, map furniture, karaoke
  helpers); `src/scenes/_sheet.ts` the plan sheet; one module per plate in `src/scenes/`; `src/timeline.ts` anchors
  the plates to lyric lines, sections and downbeats.
- `docs/` — `TREATMENT.md` (the plan), `ENGINE.md` (the pdoom-video engine and scene API).

## Render

Requirements: [bun](https://bun.sh), Chromium/Chrome, ffmpeg with libx264, Python 3 (for `analysis/windows.py`).

```sh
cd app
bun install
bunx vite                                    # preview at http://localhost:5173 (?t=84 to start at a time)
bun scripts/render.ts stills --t 84,170 --out ../out/stills
python3 ../analysis/windows.py               # (from the video folder) plate windows → out/windows.json
scripts/segments.sh horn vista korzybski …   # each plate → out/seg/<id>.mp4 (1080p30, no audio)
scripts/assemble.sh                          # joins the plates and muxes the song → out/maps-territory.mp4
```

`scripts/render.ts` launches the Chromium bundled with Playwright under SwiftShader (`CHROME_PATH` overrides it).
The published render was made in a CPU-only cloud container (SwiftShader, 1.4–2.6 s per frame depending on the plate,
about five and a half hours for the song), hence 30 fps and one sample per frame. On a GPU machine, `render.ts video --samples auto --fps 60` renders a single 60 fps file with
motion blur. The terrain shader keeps software GL in mind: the height field is baked once into a half-float texture
(height and gradient), the fine relief is a tiling value-noise texture differentiated on screen, and each detail
octave fades out before it would alias.

## How it was made

Made with Claude (Opus 5.5) in conversation, by a single agent: the concept and treatment, the stem separation and
lyric alignment, the country, the kit, all twenty-one plates, the contact-sheet reviews and the renders.

## Credits

- **Song:** "Maps & Territory" by Joburgalex, title track of *Maps & Territory*, made with Suno.
- **Engine:** forked from [mexicat/pdoom-video](https://github.com/mexicat/pdoom-video) (MIT).
- **Fonts:** Archivo, IBM Plex Mono, Cormorant Garamond (SIL Open Font License); single-stroke EMS and Hershey fonts
  via the `hersheytext` package (OFL / public domain).
