# One Degree — music video

A generative, code-rendered music video with word-synced karaoke typography for "One Degree" by Joburgalex (made with
Suno): a quiet song about change too small to see. Every frame is a deterministic function of song time, rendered in
headless Chromium (TypeScript + three.js), encoded with ffmpeg.

**Watch / download:** the 1080p30 render (3:39, 311 MB) is in [`render/`](render/), split into five parts (GitHub's
100 MB file limit); join them with one command, see [`render/README.md`](render/README.md):
`cat one-degree_1080p30.mp4.part0 … one-degree_1080p30.mp4.part4 > one-degree_1080p30.mp4`.

The renderer is a fork of the [pdoom-video](https://github.com/mexicat/pdoom-video) engine (MIT): same timeline,
post-processing, typography and export pipeline, with a dawn palette, a small kit of motifs and sixteen new plates.

## The idea

Built on the song's subject, the compound effect: small, consistent changes that look like nothing at first and
change everything over time. **The choruses and the ending are the little world**: one small planet whose axis
tilts by exactly one degree on every sung "degree", from 0° at the first chorus to 24° on the last word. That is a hair
more than Earth's 23.4°, the tilt that gives Earth its seasons, and the song sings "degree" exactly 24 times. The
frame never tilts; the planet does. Shots cut on the beat between the planet turning and the village at 50°N that
lives on it: one degree of planet is a season's difference down there. The noon sun climbs, the ice line retreats
289 km, the river thaws, the trees leaf, the windows light, and a ledger names what each degree did ("+4° THE RIVER
CRACKS", "+14° THE ICE LINE PASSES THE VILLAGE"). **The verses are an atlas of slow change**: instruments that
measure something too small to notice, with a compounding counter (×1.01ⁿ over the song's year) running through
them. Full concept, palette, type and plate list: [`docs/TREATMENT.md`](docs/TREATMENT.md).

| Plate | Lyric | Idiom |
|---|---|---|
| `dawn` | intro | a protractor draws itself around one upright needle; the push into a single degree |
| `ground` | One step… / One word… | a seismograph (MAGNITUDE 0.0); a sound-level meter pinned at −∞ dB |
| `days` | One day… / Nothing worth remembering yet | a year of identical crossed-off days; "1% better each day" creeps from ×1.00; on "yet", day one turns orange |
| `river` | But the river… / It's carving… | a survey cross-section in geological map symbols; the river cuts a canyon; the words label the layers |
| `turn` | One degree, one degree / Turn so slow… | the little world, frozen at 0°; each "degree" tilts its axis a degree, then the village |
| `bending` | But the whole world's bending / one degree ×3 | the axis leaning from the vertical; turn / village; the break at dusk |
| `pages` | One page… / One glance… | a book's fore-edge growing a page per eighth note; a stopwatch: a second is 1.000 s |
| `night` | One night… / something's gathering | star trails closing into rings and gathering on the pole star |
| `snow` | And the mountain… / falling snow | flakes settle into strata that stack into an engraved mountain |
| `ice` | One degree ×4 / Turn so slow… / bending | four degrees in six seconds; the ice line closing on the village |
| `whoa` | One degree, whoa ×3 + break | turn / village on each "whoa"; dusk, the windows coming on |
| `quiet` | I almost gave up… / But I was changing | whispered: a wall of tally marks, each a hair steeper; the pull-back shows the turn |
| `thaw` | One degree ×4 / Turned so slow… / different now / all I need | the ice line passes the village; "different now": the village in full summer |
| `lights` | tag | the planet's night side filling with lights |
| `coda` | One degree… was all I need | the last six degrees, quietly: 24°, next to Earth's 23.4° |
| `outro` | — | the little world at 24° above the title card |

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
  shared kit (the degree count, the compounding counter, the needle, karaoke and text-on-arc helpers); `_world.ts`
  is the little world (the planet shader, the village, what each degree does) and `world.ts` its shot lists for the
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
3 turned the choruses and the ending into the little world, whose axis tilts instead, and redrew the river's strata.

## Credits

- **Song:** "One Degree" by Joburgalex, made with Suno.
- **Engine:** forked from [mexicat/pdoom-video](https://github.com/mexicat/pdoom-video) (MIT).
- **Fonts:** Archivo, IBM Plex Mono, Cormorant Garamond (SIL Open Font License); single-stroke EMS and Hershey fonts
  via the `hersheytext` package (OFL / public domain).
