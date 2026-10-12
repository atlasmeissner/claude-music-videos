# Free Fall — music video

A generative, code-rendered music video with word-synced karaoke typography for "Free Fall" by Joburgalex (album
*Maps & Territory*), in the style of [mexicat/pdoom-video](https://github.com/mexicat/pdoom-video): every frame is a
deterministic function of song time, rendered in headless Chromium (TypeScript + three.js) and encoded with ffmpeg.

**Watch / download:** the 1080p30 render (3:00, 312 MB) is in [`render/`](render/), split into four parts (GitHub's
100 MB file limit); join them with one command, see [`render/README.md`](render/README.md):
`cat free-fall_1080p30.mp4.part0 … free-fall_1080p30.mp4.part3 > free-fall_1080p30.mp4`.

The renderer is a fork of the pdoom-video engine (MIT) by way of this repo's `one-degree`, and the video keeps
pdoom-video's look: its palette (ink, bone, one hazard orange, one rare acid moment), its grain and halation, its
full-frame typographic hook, its deadpan in-world readouts and its crop-marked bookends that make the video loop.

## The story

**A person procrastinates on a ledge for 412 days. The drop looks bottomless. It is 1.40 m.** Below and across the
gap, a doorway glows: the goal. Fear draws the drop deep — the lower ground sinks into a hatched abyss whenever they
doubt and rises back to its true height, shoulder-high, whenever they see clearly. They list reasons not to, lower a
tape measure that never finds the bottom, daydream the jump, wake up still sitting there, write messages they never
send, run at the edge and freeze, while DAYS ON THE LEDGE counts up. A crowd gathers at the door and chants them
down; in the stripped bridge they take one step back per handclap; the final chorus is the real jump — 0.53 s in the
air, a stumble on landing, the door swinging wide. Full treatment: [`docs/TREATMENT.md`](docs/TREATMENT.md); the
song's own notes: [`docs/SONG.md`](docs/SONG.md).

| Plate | Lyric | What happens |
|---|---|---|
| `ledge` | intro | a tiny person on a huge cliff, a tiny light far below; head in hands, peers over the edge, recoils, sits back down; the title on the stomps |
| `measure` | They said count the cost… / Measure twice… | a card of REASONS NOT TO fills up; a tape measure lowered into the dark finds no bottom, twice |
| `reveal` | But the cliff is only shoulder-high / And the sky is screaming blue | the abyss collapses to 1.40 m — shoulder-high; dawn ignites (in orange: this video has no blue) |
| `runup` | The worst… a stumble / The best… beautiful | a run-up; ghosts of both outcomes: a stumble, and the door swinging wide |
| `dream` ×2 | the choruses | 1: a daydreamed jump, a flight into a brick wall, a grey statue standing forever; 2: running at the edge and freezing there while the days race past |
| `wake` | Free fall, free fall (tail) | still on the ledge; calendar pages fall into the dark instead |
| `message` | They said what if nobody answers… | drafts typed and deleted, paper planes falling short, a whispered "hi" that costs €0.00 — unsent |
| `doorway` | The door says no or the door swings wide… | both outcomes, split screen: OTHER SIDE either way |
| `crowd` | (yeah, yeah — oh, oh…) | people at the door chanting them down, a wave of jumps per syllable |
| `decide` | Every great thing started with a jump… | handclaps: one step back each; the abyss shrinks line by line |
| `jump` | the final chorus | the real jump in slow motion, a stumble, the statue crumbles, the ground moves, the door swings wide |
| `through` | outro | the pull-back: DROP 1.40 m · TIME IN THE AIR 0.53 s · TIME ON THE LEDGE 412 DAYS; title; loop |

## Layout

- `audio/free_fall.mp3` — the song.
- `lyrics/lyrics.txt` — the lyric sheet (sung as written, plus "Free fall, free fall" tails after chorus 1 and the
  final chorus, and wordless chants after chorus 2 and in the outro).
- `analysis/` — Python tools: `separate.py` (UVR MDX-Net vocal stem via python-audio-separator), `whisper_run.py` /
  `whisper_clips.py` (faster-whisper medium.en and large-v3 on the vocal stem, line placement and cross-check),
  `align.py` (CTC forced alignment of each verse/chorus block with wav2vec2-large-960h-lv60-self through
  `torchaudio.functional.forced_align`, plus a few manual word-start fixes), `ctc_probe.py` (alignment probe),
  `analyze.py` (143.64 BPM constant grid, downbeats, sections, envelopes, kick/snare/hat/vocal onsets),
  `windows.py` (plate windows for segment renders).
- `data/lyrics.json`, `data/audio.json` — word-level lyric timings and the music analysis.
- `app/` — the renderer (bun + Vite + three.js). `src/engine/` is the forked engine; `src/scenes/_story.ts` is the story kit
  (the person resting under gravity, the ledge world with its fear-scaled drop, the door, the camera, DAYS ON THE
  LEDGE) on top of `_body.ts` (the body: kinematics, poses, distance-phased walk and run cycles, ballistic jumps and
  hops, choreography tracks) and `_ff.ts` (karaoke, the hook typography helpers); one module per plate in `src/scenes/`; `src/timeline.ts` anchors the plates to lyric lines and beats.
- `docs/` — `TREATMENT.md` (the plan), `ENGINE.md` (the engine, the scene API and the kit), `SONG.md`.

## Render

Requirements: [bun](https://bun.sh), Chromium/Chrome, ffmpeg with libx264, Python 3 (for `analysis/windows.py`).

```sh
cd app
bun install
bunx vite                                    # preview at http://localhost:5173 (?t=44 to start at a time)
bun scripts/render.ts stills --t 44.3,138.8 --out ../out/stills
python3 ../analysis/windows.py               # (from the video folder) plate windows → out/windows.json
scripts/segments.sh ledge measure reveal …   # each plate → out/seg/<id>.mp4 (1080p30, no audio)
scripts/assemble.sh                          # joins the plates and muxes the song → out/free-fall.mp4
```

`scripts/render.ts` launches the Chromium bundled with Playwright under SwiftShader (`CHROME_PATH` overrides it). The
published render was made in a CPU-only cloud container (SwiftShader, about 3.3 s per frame, 4.9 hours for the song), hence 30 fps and one
sample per frame. On a GPU machine, `render.ts video --samples auto --fps 60` renders a single 60 fps file with motion
blur.

Analysis environment: `uv venv analysis/.venv` and `uv pip install torch torchaudio torchvision (cpu)
"audio-separator[cpu]" faster-whisper transformers librosa soundfile scipy`.

## How it was made

Made with Claude (Opus 5.5) in conversation: the stem separation and lyric alignment, the treatment, the kits, the
plates, the contact-sheet reviews and the renders. Three cuts: a cobalt-blue first draft (dropped: off pdoom's
palette); a second, literal one — "plates from a treatise on leaping", one diagram per lyric line (in git history);
and this one, after the note "too literal — show a person procrastinating who just has to jump off the ledge, which
isn't as high as it looks, to get to the goal". Then a pass on the movement, after "the people are still a bit
scruffy — work on the way they respond to gravity and their movement; it should look more natural": the pictogram
was rebuilt as a body that rests on whatever it touches, walks and runs on keyframed cycles without foot-skate, and
jumps, lands, stumbles, hops and falls under gravity.

## Credits

- **Song:** "Free Fall" by Joburgalex, from the album *Maps & Territory*.
- **Engine and style:** forked from [mexicat/pdoom-video](https://github.com/mexicat/pdoom-video) (MIT).
- **Fonts:** Archivo, IBM Plex Mono, Cormorant Garamond (SIL Open Font License); single-stroke EMS and Hershey fonts
  via the `hersheytext` package (OFL / public domain).
