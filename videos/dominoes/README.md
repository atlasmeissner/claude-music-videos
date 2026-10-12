# Dominoes — music video

A generative, code-rendered music video with word-synced karaoke typography for "Dominoes" by Joburgalex (made with
Suno), the closing track of the album *Maps & Territory*: a song about second-order thinking, every small action
rippling outward in ways you never fully see. Every frame is a deterministic function of song time, drawn with
Canvas 2D (Skia via `@napi-rs/canvas` offline, the browser's canvas in the preview) and encoded with ffmpeg.

**Watch / download:** the 1080p30 render (3:07, 133 MB) is in [`render/`](render/), split into two parts (GitHub's 100 MB file limit); join them with one command, see [`render/README.md`](render/README.md):
`cat dominoes_1080p30.mp4.part0 dominoes_1080p30.mp4.part1 > dominoes_1080p30.mp4`.

It is made in the style of [pdoom-video](https://github.com/mexicat/pdoom-video) (MIT): the same ink, bone and
hazard-orange palette, Archivo / IBM Plex Mono / Cormorant Garamond typography, film grain and orange-only bloom,
deadpan technical annotations, cuts and impacts on the beat, and per-word karaoke where the words are part of the
image. The renderer is new: a 2D engine built for a single continuous machine instead of separate plates.

## The idea

**One machine, one take.** The whole song is a single Rube Goldberg machine, and the camera follows the chain
reaction along it without a cut. Every lyric line is one stage, and every stage is a consequence of the one before:
a pulled thread shakes a tower, the shaking moves a stone, the stone breaks a dam, the flood fills a bucket, the
bucket squeezes a bellows, one word goes down a speaking tube, the blast strikes a match, and a stranger's windows
light up. The stage numbers count the orders of consequence (1°, 2°, 3° …) and a title block keeps a running
total. Only the part that is moving right now is orange, so the eye can always follow the impulse.

The bridge is the album's moment of silence: the chain shrinks, each domino 0.78× the last, down to one a millimetre
tall, and everything holds through the whispered lines until it tips on "changing". The final chorus is the
classic geometric chain, each domino twice the last, twenty doublings from a millimetre to over a kilometre, and on
"now I see how far the falling goes" the camera pulls back to show the whole machine as a speck at the foot of the
last domino. The echoes branch out across the frame. The outro runs the mechanism in reverse: the whole video
rewinds, through every station, to the first frame — one domino, standing — on the final chord.

Full concept, palette, type and the station list: [`docs/TREATMENT.md`](docs/TREATMENT.md).

| Station | Lyric | Stage |
|---|---|---|
| `intro` | intro | one domino; a ball down a xylophone staircase (a bar per note), chimes, marimba, a ratchet lift; the title plate |
| `thread` | I pulled a thread… | a thread through a tower; the tower sways |
| `river` | Moved a stone… | a stone, a chute, a dam's keystone; the reservoir breaks |
| `tube` | Said one word… | seesaw, bellows, a pulse down a speaking tube under the moon |
| `match` | And set a stranger's world alight | a match, a fuse, a stranger's house lighting up |
| `stops` | pre-chorus 1 | a buffer stop marked END that falls over; a plotter whose straight line bends |
| `chorus` | choruses 1 and 2 (paper) | letter-dominoes; one touch to 1,024 echoes; a row to the vanishing point |
| `galton` | interlude | a pegboard of "AND THEN?", one ball per beat |
| `map` | verse 2 | plan view: a coin picks LEFT, a war missed, a hymn found, two held doors, YOU ARE HERE |
| `stairs` | pre-chorus 2 | a slinky on stairs that appear only when reached; the whole machine |
| `geo` | bridge, final chorus | 0.78× down to 1 mm; ×2 up to 1.09 km; the echo network; three slams |
| `frame.ts` | outro | everything rewinds to the first frame |

## Layout

- `audio/dominoes.mp3` — the song.
- `lyrics/lyrics.txt` — the lyrics as sung (Suno extends the final chorus: three single "Dominoes", and a second
  "Dominoes ×3 / And now I see…" after the instrumental climax), with search windows for the aligner.
- `analysis/` — Python (uv) tools: `analyze.py` (beat tracking at 143.6 BPM, downbeats from the lyric line starts,
  onsets of the mix and of the stems, loudness envelopes), `align.py` (Whisper medium.en on the Demucs vocal stem
  for line placement, then MMS CTC forced alignment of each line with a star token for held vowels),
  `whisper_run.py` (Whisper large-v3 as a second opinion), `refine.py` (merges the estimates, snaps word starts to
  vocal-stem onsets; the repeated "Dominoes" chants are placed from large-v3 runs on short excerpts).
- `data/lyrics.json`, `data/audio.json` — word-level lyric timings and the music analysis.
- `app/` — the renderer (bun + Vite, TypeScript, Canvas 2D):
  - `src/engine/` — camera (log-zoom keyframes, follow cameras, impact shake), drawing context with hairlines that
    stay hairlines at any zoom, karaoke typography and technical annotations (leaders, order tags, dimension lines,
    scale bars), post-processing (orange-only bloom, vignette, grain), song data access.
  - `src/machine/` — the parts: a domino-chain model (each domino tips about its leading corner until it meets the
    next one, then rests against it as the next one falls, with hit times put on syllables and beats), paths,
    ballistic hops between timed contacts, balls, pulleys, cups, levers.
  - `src/stations/` — one module per stage of the machine; `src/timeline.ts` chains them along the world and sets
    the ink/paper rhythm (slab wipes on the chorus downbeats); `src/frame.ts` draws a frame and holds the rewind;
    `src/hud.ts` the drafting grid and title block.
  - `scripts/render.ts` — offline renderer: `stills`, `sheet` (contact sheets) and `video` (parallel chunk workers,
    motion blur by averaging sub-frames, more of them while the rewind runs fast; ffmpeg concat and mux).
- `docs/TREATMENT.md` — the plan.
- `LICENSE.pdoom-video` — `app/src/engine/util.ts` and the font set come from pdoom-video.

## Render

Requirements: [bun](https://bun.sh) and ffmpeg with libx264. The analysis needs [uv](https://docs.astral.sh/uv/);
the renderer doesn't.

```sh
cd app
bun install
bunx vite                                                   # preview at http://localhost:5173 (?t=96 to start at a time)
bun scripts/render.ts stills --times 3.3,110,141 --scale 1 --out ../out/stills
bun scripts/render.ts sheet --from 0 --to 187 --n 72 --cols 8 --scale 0.22 --out ../out/sheet.png
bun scripts/render.ts video --samples 3 --workers 2 --out ../out/dominoes.mp4
```

Preview keys: space play/pause, ←/→ seek 1 s (shift: 5 s), `,` / `.` one frame, `h` hide the UI.

The published render was made in a CPU-only cloud container: 1080p, 30 fps, three motion-blur sub-frames per frame
(up to sixteen during the rewind), about 0.3 s per frame with two workers, 24 minutes for the song.
`--fps 60 --scale 2` gives a 4K60 file from the same code.

## Regenerate the timing data

```sh
cd analysis
uv sync
uv run python -m demucs --two-stems=vocals -n htdemucs -o work/stems ../audio/dominoes.mp3
uv run python align.py --vocals work/stems/htdemucs/dominoes/vocals.wav --whisper-cache work/whisper.json --out work/lyrics_ctc.json
uv run python whisper_run.py work/stems/htdemucs/dominoes/vocals.wav large-v3 work/whisper_large.json
# vocal onsets for refine.py: librosa onset_detect on the vocal stem, saved as work/vocal_onsets.npy
uv run python refine.py --ctc work/lyrics_ctc.json --whisper work/whisper.json --onsets work/vocal_onsets.npy
uv run python analyze.py ../audio/dominoes.mp3 --stems work/stems/htdemucs/dominoes
```

## How it was made

Made with Claude (Opus 5.5) in conversation, by a single agent: the concept and treatment, the stem separation and
lyric alignment, the engine, the machine and all its stations, the contact-sheet reviews and the render.

## Credits

- **Song:** "Dominoes" by Joburgalex, from *Maps & Territory*, made with Suno.
- **Style and utilities:** after [mexicat/pdoom-video](https://github.com/mexicat/pdoom-video) (MIT).
- **Fonts:** Archivo, IBM Plex Mono, Cormorant Garamond (SIL Open Font License), from the pdoom-video font set.
