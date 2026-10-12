# The Other Side of Light — music video

A generative, code-rendered music video with word-synced karaoke typography for "The Other Side of Light" by
Joburgalex, from the album *Maps & Territory* (made with Suno): the darkest track on the album, a relentless cello
ostinato and a military snare under a pipe organ, about **inversion** — mapping every path to failure, then running
away from what's wrong rather than toward what's right. Every frame is a deterministic function of song time,
rendered in headless Chromium (TypeScript + three.js), encoded with ffmpeg.

**Watch / download:** the 1080p30 render (4:04, 661 MB) is in [`render/`](render/), split into eight parts (GitHub's 100 MB file
limit); join them with one command, see [`render/README.md`](render/README.md).

The renderer is a fork of the [pdoom-video](https://github.com/mexicat/pdoom-video) engine (MIT) and sticks to its
style: plates from an illustrated treatise, one palette (ink, bone and one hazard orange), Archivo / Plex Mono /
Cormorant typography, the spark, film grain, bloom only on the signal colour, hard cuts on the beat. What is new
here is that the plates are **real pictures**: 188 Creative Commons and public-domain photographs, maps, prints and
paintings, printed through one shader into that palette and used for the visual storytelling.

## The idea

**An Atlas of Every Way to Lose.** The verses chart failure: a map of every way to lose, a typology of doors that
lead to ruin, a mirror that tells the lie back reversed, a bridge burning behind the lamp, a specimen sheet of the
dark with Latin names, a ledger of ways to fail, poison with a MEDICINE label slapped over it, a stairwell straight
down, the comfortable sin. In each, **the lamp** (one orange point of light) walks the routes, and every route ends
in a cross. On every chorus the atlas **prints as its own negative** — the ink sheet becomes bone paper, every
photograph turns into its negative (the light at the end of the tunnel turns black), and only the orange stays
itself: the lamp, the routes, and every red thing in every photograph. The right path is never drawn directly: it
is what is left once every wrong turn is crossed out ("Every wrong turn made the right one clear"). The bridge is
three whispered lines on an almost empty sheet: glory hung in small frames turns, one by one, into graves; the
footprints turn around. The outro rewinds through the whole atlas, lays all 188 plates out as one index sheet, every
one crossed, and the lamp draws the single route that is left. Jacobi ("Invert, always invert", over his grave) opens
it; Munger ("where I'm going to die, so I'll never go there") sits in the break.

| Plate | Lyric | Idiom |
|---|---|---|
| `title` | intro | Jacobi's maxim written by the lamp over his grave, then turned upside down; Ortelius' world with seven routes to ruin; the title; the sheet as its own negative on the drop |
| `map` | I drew a map of every way to lose | the line written by the lamp over Nolli's Rome; four old maps on the beat, a route and a cross on each; LOSE on the Chartres labyrinth |
| `doors` | Every door that leads to ruin | a typology of six doors, filed; through the dark one; only ruins on the other side; RUIN falls apart |
| `mirror` | Every lie I'd tell myself | the frame is a mirror; MYSELF answers reversed; the glass breaks into strips |
| `bridge` | Every bridge I'd set to burning | Hiroshige's bridge burns behind the lamp; BURNING chars to ash over Turner |
| `names` | I learned the dark by name / Every shadow, every flame | a specimen sheet of darkness with Latin names; shadows; flames multiplying on every bar to white |
| `chorus` ×3 | So I'm running to the other side of light… | the inversion: a run through the atlas (plates bursting out of the lamp at the centre and flying at the camera, one per beat), LIGHT on a black sun; every wrong turn crossed until the right one lights up; WANT struck out; the plates of fear (and, the last time, of the fight) receding behind a distance meter |
| `munger` | break | Munger's line typed out under his portrait |
| `ledger` | I wrote the list… / All the poison dressed as medicine | a ledger of failures on the beat; POISON, then MEDICINE pasted over it |
| `descent` | Every shortcut to the bottom / Every comfortable sin | down the stairwells; red armchairs, Doré, Bruegel's *Sloth* |
| `lightbox` | I held the worst up to the light / …the way to fight | a hell engraving in a lightbox that switches on; an X-ray; FIGHT |
| `glory` | They said go find the path to glory… | glory in small frames turning into graves; every path crossed; the footprints turn around |
| `climb` | instrumental | cello, snare and organ as a score; the nave; totality, and the black sun's negative |
| `outro` | climax | every plate crossed out on the way back; the index of 188 plates; the one route left; the title; the lamp goes out |
| `plates` | silence | the List of Plates: every image, its creator and licence |

Full concept, palette, type and plate list: [`docs/TREATMENT.md`](docs/TREATMENT.md).

## Layout

- `audio/other-side-of-light.mp3` — the song.
- `analysis/` — Python tools. Timing: `whisper_run.py` / `whisper_seg.py` (faster-whisper large-v3-turbo word
  timestamps on the UVR-MDX vocal stem; separate passes on doubtful sections), `align.py` (wav2vec2
  large-960h-lv60-self CTC forced alignment of each sung line in its window), `finalize_lyrics.py` (cross-checks
  low-confidence words, snaps starts to vocal onsets, extends held notes), `analyze.py` (160.42 BPM constant grid
  fitted on the htdemucs_ft drum stem, downbeats from kick energy, sections, envelopes, onsets). Images:
  `fetch_openverse.py` (Openverse API, licences CC0 / PDM / CC BY only) and `fetch_cma.py` (Cleveland Museum of Art
  Open Access, CC0) collected ~560 candidates (`candidates.json`, with full metadata); `selection.txt` is the
  curated list per plate; `build_images.py` resizes them into `app/public/cc/`, measures each image's luminance
  range for auto-levels, writes `manifest.json`, the atlas sheet of all plates and [`CREDITS.md`](CREDITS.md).
- `data/lyrics.json`, `data/audio.json` — word-level lyric timings and the music analysis.
- `app/` — the renderer (bun + Vite + three.js). `src/engine/` is the forked engine (two changes for software GL:
  synchronous readback with `?syncread=1`, and no full-frame HUD upload when the HUD is empty; plus a silent tail
  after the song for the credits). `src/scenes/_kit.ts` is the kit: the image bank, the plate shader and its looks,
  karaoke and caption helpers, the lamp's routes and crosses, a 2D camera. One module per plate in `src/scenes/`;
  `src/timeline.ts` anchors the plates to lyric lines and downbeats.
- `docs/` — `TREATMENT.md` (the plan), `ENGINE.md` (the pdoom-video engine and scene API).

## Render

Requirements: [bun](https://bun.sh), Chromium/Chrome, ffmpeg with libx264.

```sh
cd app
bun install
bunx vite                                    # preview at http://localhost:5173 (?t=62 to start at a time)
bun scripts/render.ts stills --t 62,113 --out ../out/stills
bun scripts/render.ts sheet --from 60 --to 90 --n 16 --cols 4 --out ../out/sheet.png
scripts/render_all.sh                        # 20 s segments (resumable) → join → mux the song → ../out/the-other-side-of-light.mp4
```

On a GPU machine use `CHROME_ANGLE=metal` (macOS) or drop the software-GL variables and run
`bun scripts/render.ts video --samples auto --fps 60 --out ../out/the-other-side-of-light.mp4` for a single 60 fps
file with motion blur. The published render was made in a CPU-only cloud container (SwiftShader, about 1.1–1.5 s
per frame), hence 30 fps and one sample per frame.

## How it was made

Made with Claude (Opus 5.5) in conversation, by a single agent: the concept and treatment, the stem separation and
lyric alignment, the image search and curation, the kit, all seventeen plates, the contact-sheet reviews and the
render.

## Credits

- **Song:** "The Other Side of Light" by Joburgalex, from *Maps & Territory*, made with Suno.
- **Images:** 188 Creative Commons (CC BY), CC0 and public-domain images, each credited on screen as a numbered
  plate and listed with creator, licence and source link in [`CREDITS.md`](CREDITS.md) (and on the List of Plates at
  the end of the video). They were cropped, recoloured, inverted, engraved and animated. No NC or ND licences.
- **Quotes:** Carl Gustav Jacob Jacobi ("Man muss immer umkehren"); Charlie Munger, on inversion.
- **Engine:** forked from [mexicat/pdoom-video](https://github.com/mexicat/pdoom-video) (MIT, see [`LICENSE`](LICENSE)).
- **Fonts:** Archivo, IBM Plex Mono, Cormorant Garamond (SIL Open Font License); single-stroke EMS and Hershey fonts
  via the `hersheytext` package (OFL / public domain).
