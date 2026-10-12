# Maps & Territory (version 2) — music video

A generative, code-rendered music video with word-synced karaoke for "Maps & Territory" by Joburgalex, the title
track of the album *Maps & Territory* (made with Suno). Every frame is a deterministic function of song time,
rendered in headless Chromium (TypeScript + three.js), encoded with ffmpeg.

This is the second version. [Version 1](../maps-territory/) told the idea in twenty-one separate plates; version 2
is **one map, one continuous shot**: the plan of a life is drawn, and then a real life walks away from it, event by
event.

**Watch / download:** the 1080p30 render (5:19, 431 MB) is in [`render/`](render/), split into five parts
(GitHub's 100 MB file limit); join them with one command, see [`render/README.md`](render/README.md):
`cat maps-territory-v2_1080p30.mp4.part0 … maps-territory-v2_1080p30.mp4.part4 > maps-territory-v2_1080p30.mp4`.

## The idea

In the first verse a plotter draws **the plan**, the universal milestones: HOME 2000 → SCHOOL → UNIVERSITY →
FIRST JOB → PROMOTION → THE HOUSE → RETIREMENT 2040, a ruled road straight across the mountains and through the
middle of a lake. From the first chorus a lamp walks **the trail**, Joburgalex's own story: it starts in
JOHANNESBURG, traces the plan's road for a line ("I was tracing someone else's story"), then leaves it for good across
the lake (LEFT FOR EUROPE, "off the shore") to MUNICH; rain where the plan said sun; MARRIED ("found a feast": a
second trail joins); TWO CHILDREN ("every detour was the real road": two small lamps follow); RAN A COMPANY
("headed east"); WOUND IT UP ("now I'm lost": the road washes out, the compass spins); loops; AN AI RED TEAM; MY OWN
PLATFORM ("arrive"); MAKING MUSIC ("beautiful"); and finally off the shore to an islet no map shows: HERE.

Wherever the trail has been, the paper is cut away and the real terrain shows through. By the last chorus the cut
has opened out over the whole sheet, the plan is peeled off like tape, and the country carries on past the paper's
edge. The French horn bookends it: its call lights the dark sheet at the start, and rings out from HERE at the end.
Full plan and the event-by-event cue sheet: [`docs/TREATMENT.md`](docs/TREATMENT.md).

## Layout

- `audio/`, `lyrics/`, `data/`, `analysis/` — as in version 1 (the same song analysis: word-level lyric timings and
  the beat grid).
- `app/src/scenes/map.ts` — the whole video: the camera (a list of shots blended into one move), the plan, the
  trail, the events and their glyphs and tags, the strip with the lyric.
- `app/src/scenes/_story.ts` — the story timed to the song: the walk's keyframes and the events, each anchored to a
  lyric word or a downbeat.
- `app/src/scenes/_world.ts` — the country, the plan, and the trail's waypoints (a least-cost path through the
  valleys between them; straight across water).
- `app/src/scenes/_mt.ts` — the kit: views, the terrain shader (map or territory, with the trail cut-away: a
  distance field to the trail, baked once), the lamp, map furniture, karaoke helpers. `_plan.ts` draws the plan,
  `_sheet.ts` the card and furniture.
- `app/src/timeline.ts` — one scene, split at the section starts into thirteen parts for resumable segment renders.

## Render

```sh
cd app
bun install
bunx vite                                    # preview at http://localhost:5173 (?t=120 to start at a time)
python3 ../analysis/windows.py               # (from the video folder) part windows → out/windows.json
scripts/segments.sh p01 p02 … p13            # each part → out/seg/<id>.mp4 (1080p30, no audio)
scripts/assemble.sh                          # joins the parts and muxes the song → out/maps-territory-v2.mp4
```

Rendered in a CPU-only cloud container (SwiftShader, about 2–2.6 s per frame, some six hours for the song), hence
30 fps and one sample per frame; on a GPU machine
`render.ts video --samples auto --fps 60` renders a 60 fps file with motion blur.

## Credits

- **Song:** "Maps & Territory" by Joburgalex, title track of *Maps & Territory*, made with Suno. The life on the
  map is the artist's own.
- **Engine:** forked from [mexicat/pdoom-video](https://github.com/mexicat/pdoom-video) (MIT).
- **Fonts:** Archivo, IBM Plex Mono, Cormorant Garamond (SIL Open Font License); single-stroke EMS and Hershey fonts
  via the `hersheytext` package (OFL / public domain).
- Made with Claude (Opus 5.5) in conversation.
