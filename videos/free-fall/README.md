# Free Fall — music video

A generative, code-rendered music video with word-synced karaoke typography for "Free Fall" by Joburgalex (album
*Maps & Territory*), in the style of [mexicat/pdoom-video](https://github.com/mexicat/pdoom-video): every frame is a
deterministic function of song time, rendered in headless Chromium (TypeScript + three.js) and encoded with ffmpeg.

**Watch / download:** the 1080p30 render (3:00, 297 MB) is in [`render/`](render/), split into four parts (GitHub's
100 MB file limit); join them with one command, see [`render/README.md`](render/README.md):
`cat free-fall_1080p30.mp4.part0 … free-fall_1080p30.mp4.part3 > free-fall_1080p30.mp4`.

The renderer is a fork of the pdoom-video engine (MIT) by way of this repo's `one-degree`, and the video follows
pdoom-video's style bible: its palette (ink, bone, one hazard orange, one rare acid accent), its grain and halation,
its spark, its plates-from-a-treatise structure, its escalating typographic hook and its crop-marked bookends that
make the video loop.

## The idea

**Plates from an illustrated treatise on leaping.** The song argues for asymmetric risk (the downside of a leap is
small and capped, the upside is huge and open-ended); each plate argues one clause of it in its own idiom, with
straight-faced measurements that keep coming out absurdly small. **The spark** — pdoom's orange point dragging a
hairline — is cast as the falling body of a physics textbook: it walks the ground out to a cliff edge, draws the
payoff curve, flies the parabola into a wall, falls through a vacuum tube beside a feather, and lands, at the end,
with a stumble. The running number, staged in-world like P(doom), is **THE ODDS** (upside : downside), which climb on
every "Free fall": 1 : 1 → 3 → 10 → 40 → 100 → 1,000 → 1,000,000 → ∞ : 1. Full concept, palette, type and plate list:
[`docs/TREATMENT.md`](docs/TREATMENT.md); the song's own notes: [`docs/SONG.md`](docs/SONG.md).

| Plate | Lyric | Idiom |
|---|---|---|
| `edge` | intro | crop-marked sheet: the spark draws the ground to a cliff edge; a safety sign slams in on every downbeat; the stomps land the title and knock the signs off |
| `ledger` | They said count the cost… / Measure twice… | bone paper: an adding-machine tape prices the leap (€0.18); the drop measured twice, 1.40 m both times |
| `cliff` | But the cliff is only shoulder-high / And the sky is screaming blue | engraved elevation with a levelling staff and an anthropometric outline; then a spectrometer whose 470 nm peak screams off the chart (in orange: this video has no blue) |
| `payoff` | The worst… a stumble / The best is something beautiful | the payoff chart: the spark draws the floor and the kink and climbs off the chart; the lyric rides the curve |
| `hook` ×4 | Free fall, free fall | FREE / FALL slams, the letters of FALL obeying gravity; THE ODDS take the frame and roll up; escalating: bone on ink → ink on signal → strobes and stacks → rounded up to ∞ |
| `fly` ×2 | I'd rather fly and hit a wall / … standing tall / … never moves at all | ballistics (parabola, stroboscopic ghosts, a brick wall: DAMAGE ONE (1) BRUISE); statics (a column standing forever, ΣF = 0); a seismograph flatline. Chorus 2 on bone paper; its tag drops the trace off the paper |
| `vacuum` | Free fall, free fall (tail) | a feather and the spark in an engraved vacuum tube, falling alike, half-time; the tube turned over like an hourglass |
| `letter` | They said what if nobody answers… | bone paper: a cold email typed into a form; REPLIES 0; the words fly off as paper planes; WHISPER €0.00; SILENCE — the only cost |
| `door` | The door says no or the door swings wide… | a blueprint door in plan: NO, then the swing arc; a decision tree whose branches both end OTHER SIDE; the sheet floods orange into hook 2 |
| `chant` | (yeah, yeah — oh, oh…) | a festival site plan: hundreds of dots, a wave from the stage per chanted syllable; JUMPED counts; they lift off as sparks |
| `bridge` | Every great thing started with a jump… | stripped to claps: a register of firsts stamped on black (№ 1 A JUMP … № 4 THE SHAME, RISKED); a handclap tally |
| `final` | I'd rather fly and hit the wall… / Free fall, free fall | the `fly` plate, maximal: a fan of sparks, the wall breaks (the one acid moment), the column topples, the flat ground erupts into the payoff curve and leaves the chart |
| `outro` | outro | the spark lands: OUTCOME −1, A STUMBLE; E[leap] = p · (−1) + (1 − p) · ∞ = ∞; *Free fall isn't reckless. It's rational.*; title; the frame closes back in on the first frame |

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
- `app/` — the renderer (bun + Vite + three.js). `src/engine/` is the forked engine; `src/scenes/_ff.ts` is the shared
  kit (THE ODDS, the payoff curve, signage, karaoke, the spark from `_motifs.ts`); one module per plate in
  `src/scenes/`; `src/timeline.ts` anchors the plates to lyric lines and beats.
- `docs/` — `TREATMENT.md` (the plan), `ENGINE.md` (the engine, the scene API and the kit), `SONG.md`.

## Render

Requirements: [bun](https://bun.sh), Chromium/Chrome, ffmpeg with libx264, Python 3 (for `analysis/windows.py`).

```sh
cd app
bun install
bunx vite                                    # preview at http://localhost:5173 (?t=44 to start at a time)
bun scripts/render.ts stills --t 44.3,138.8 --out ../out/stills
python3 ../analysis/windows.py               # (from the video folder) plate windows → out/windows.json
scripts/segments.sh edge ledger cliff …      # each plate → out/seg/<id>.mp4 (1080p30, no audio)
scripts/assemble.sh                          # joins the plates and muxes the song → out/free-fall.mp4
```

`scripts/render.ts` launches the Chromium bundled with Playwright under SwiftShader (`CHROME_PATH` overrides it). The
published render was made in a CPU-only cloud container (SwiftShader, about 1.5 s per frame, 2.3 hours for the song), hence 30 fps and one
sample per frame. On a GPU machine, `render.ts video --samples auto --fps 60` renders a single 60 fps file with motion
blur.

Analysis environment: `uv venv analysis/.venv` and `uv pip install torch torchaudio torchvision (cpu)
"audio-separator[cpu]" faster-whisper transformers librosa soundfile scipy`.

## How it was made

Made with Claude (Opus 5.5) in conversation: the stem separation and lyric alignment, the treatment, the kit, the
plates (a first pass of three of them by parallel scene agents), the contact-sheet reviews and the render. A first
draft drifted into a cobalt-blue, pictogram-hero look; on review it was rebuilt to follow pdoom-video's style bible
(no blues, no mascots, the spark as the protagonist, the escalating hook, the in-world running number).

## Credits

- **Song:** "Free Fall" by Joburgalex, from the album *Maps & Territory*.
- **Engine and style:** forked from [mexicat/pdoom-video](https://github.com/mexicat/pdoom-video) (MIT).
- **Fonts:** Archivo, IBM Plex Mono, Cormorant Garamond (SIL Open Font License); single-stroke EMS and Hershey fonts
  via the `hersheytext` package (OFL / public domain).
