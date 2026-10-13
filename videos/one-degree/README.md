# One Degree — music video

A generative, code-rendered music video with word-synced karaoke typography for "One Degree" by Joburgalex (made with
Suno): a quiet song about change too small to see. Every frame is a deterministic function of song time, rendered in
headless Chromium (TypeScript + three.js), encoded with ffmpeg.

**Watch / download:** the 1080p30 render (3:39, 415 MB) is in [`render/`](render/), split into five parts (GitHub's
100 MB file limit); join them with one command, see [`render/README.md`](render/README.md):
`cat one-degree_1080p30.mp4.part0 … one-degree_1080p30.mp4.part4 > one-degree_1080p30.mp4`.

The renderer is a fork of the [pdoom-video](https://github.com/mexicat/pdoom-video) engine (MIT): same timeline,
post-processing, typography and export pipeline, with a dawn palette, a small kit of motifs and sixteen new plates.

## The idea

Built on the song's subject, the compound effect: small, consistent changes that look like nothing at first and
change everything over time. **The choruses and the ending are the island**: the whole world is one small flat island
balanced on the point of the needle. It starts level, with a still lake, dry dead land and two people. On every sung
"degree" it tips one degree more. One degree is enough for the lake to spill; every "degree" sends a surge down the
river, and the land comes alive behind the water: grass, trees, fields, villages, people, lights. The lake drains
downhill as it goes, and that weight tips the world further. By "the whole world's different now" it leans 16°; on
the last "degree" it reaches 24°, passes the tipping point and falls off the needle, leaving the needle alone for the
title. **The verses are an atlas of slow change**: instruments that measure something too
small to notice, with a compounding counter (×1.01ⁿ over the song's year) running through them. Full concept,
palette, type and plate list: [`docs/TREATMENT.md`](docs/TREATMENT.md).

| Plate | Lyric | Idiom |
|---|---|---|
| `dawn` | intro | a protractor draws itself around one upright needle; the push into a single degree |
| `ground` | One step… / One word… | a seismograph (MAGNITUDE 0.0); a sound-level meter pinned at −∞ dB |
| `days` | One day… / Nothing worth remembering yet | a year of identical crossed-off days; "1% better each day" creeps from ×1.00; on "yet", day one turns orange |
| `river` | But the river… / It's carving… | a survey cross-section in geological map symbols; the river cuts a canyon; the words label the layers |
| `turn` | One degree, one degree / Turn so slow… | the level island tips a degree per "degree"; the lake spills; the spirit level sees it |
| `bending` | But the whole world's bending / one degree ×3 | the river bends its way across the dry land, a surge per "degree" |
| `pages` | One page… / One glance… | a book's fore-edge growing a page per eighth note; a stopwatch: a second is 1.000 s |
| `night` | One night… / something's gathering | star trails closing into rings and gathering on the pole star |
| `snow` | And the mountain… / falling snow | flakes settle into strata that stack into an engraved mountain |
| `ice` | One degree ×4 / Turn so slow… / bending | trees, fields, the first village and its people |
| `whoa` | One degree, whoa ×3 + break | more villages; dusk, the windows coming on |
| `quiet` | I almost gave up… / But I was changing | whispered: a wall of tally marks, each a hair steeper; the pull-back shows the turn |
| `thaw` | One degree ×4 / Turned so slow… / different now / all I need | the whole island alive at 16°; the river falls off the edge |
| `lights` | tag | night on the island: everyone's windows |
| `coda` | One degree… was all I need | the last degrees to 24°; the tipping point: it falls off the needle |
| `outro` | — | the needle alone above the title card |

## Layout

- `audio/one_degree.mp3` — the song.
- `lyrics/lyrics.txt` — the published lyric sheet; `lyrics/lines.sung.json` — the lines as actually sung (Suno
  repeats and adds lines: chorus 2 doubles "One degree, one degree", there is a "One degree, whoa" ×3 post-chorus,
  and a longer "One degree" coda), with coarse windows.
- `analysis/` — Python tools: `whisper_run.py` / `whisper_large.py` (faster-whisper medium.en and large-v3 on the
  htdemucs vocal stem, cross-checks), `align.py` (torchaudio MMS_FA CTC forced alignment of each sung line in its
  window, plus manual word-start fixes from `notes.py` (pYIN note segmentation) and `vmap2.py` (vocal map on the beat
  grid)), `analyze.py` (129.11 BPM constant grid, downbeats, sections, envelopes, onsets), `windows.py` (plate
  windows for segment renders).
- `data/lyrics.json`, `data/audio.json` — word-level lyric timings and the music analysis.
- `app/` — the renderer (bun + Vite + three.js). `src/engine/` is the forked engine; `src/scenes/_od.ts` is the
  shared kit (the degree count, the compounding counter, the needle, karaoke and text-on-arc helpers); `_island.ts`
  is the island (its geometry, the river, what grows where and when) and `island.ts` its shot lists for the
  choruses and the ending; one module per other plate in `src/scenes/`; `src/timeline.ts` anchors the plates to lyric lines and beats.
- `docs/` — `TREATMENT.md` (the plan), `ENGINE.md` (the pdoom-video engine and scene API).

## Render

Requirements: [bun](https://bun.sh), Chromium/Chrome, ffmpeg with libx264, Python 3 (for `analysis/windows.py`).

```sh
cd app
bun install
bunx vite                                    # preview at http://localhost:5173 (?t=37 to start at a time)
bun scripts/render.ts stills --t 37.4,164 --out ../out/stills
python3 ../analysis/windows.py               # plate windows → out/windows.json
scripts/segments.sh dawn ground days …       # each plate → out/seg/<id>.mp4 (1080p30, no audio)
scripts/assemble.sh                          # joins the plates and muxes the song → out/one-degree.mp4
```

`scripts/render.ts` launches the Chromium bundled with Playwright under SwiftShader (`CHROME_PATH` overrides it).
The published render was made in a CPU-only cloud container (SwiftShader, about 1.9 s per frame, 3.5 hours for the
song), hence 30 fps and one sample per frame; the export path was trimmed for that (quarter-resolution bloom
pyramid, empty HUD frames not re-uploaded). On a GPU machine, `render.ts video --samples auto --fps 60` renders a
single 60 fps file with motion blur.

Engine changes from pdoom-video: a world `roll` (and `rollBg`) in `post.ts` (used by the first cut, now always 0), the quarter-resolution bloom pyramid,
the skipped empty HUD upload in `hud.ts`, the dawn palette in `palette.ts`, and the SwiftShader launch in
`scripts/render.ts`.

## How it was made

Made with Claude (Opus 5.5) in conversation, by a single agent: the concept and treatment, the stem separation and
lyric alignment (the sung lyrics differ from the sheet, so the line list was rebuilt from two Whisper runs, the
vocal map and the pitch track), the kit, all sixteen plates, the contact-sheet reviews and the renders. The first cut
rolled the whole frame one degree per "degree"; revision 2 dropped that and added the compounding counter; revision
3 turned the choruses and the ending into a little planet whose axis tilted instead, and redrew the river's strata;
revision 4 replaced the planet with the island, so the consequences can be seen rather than explained; revision 5
tips it a degree per "degree" until it falls off the needle.

## Credits

- **Song:** "One Degree" by Joburgalex, made with Suno.
- **Engine:** forked from [mexicat/pdoom-video](https://github.com/mexicat/pdoom-video) (MIT).
- **Fonts:** Archivo, IBM Plex Mono, Cormorant Garamond (SIL Open Font License); single-stroke EMS and Hershey fonts
  via the `hersheytext` package (OFL / public domain).
