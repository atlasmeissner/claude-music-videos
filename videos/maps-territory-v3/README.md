# Maps & Territory (version 3) — music video

A generative, code-rendered music video with word-synced lyrics for "Maps & Territory" by Joburgalex, the title
track of the album *Maps & Territory* (made with Suno). Every frame is a deterministic function of song time,
rendered in headless Chromium (TypeScript + three.js), encoded with ffmpeg.

This is the third version. [Version 1](../maps-territory/) told the idea in twenty-one separate plates;
[version 2](../maps-territory-v2/) walked the artist's own life across one map. Version 3 keeps the one map and
the one continuous shot, and tells **a fictional life, planned and unplanned**.

**Watch / download:** the 1080p30 render (5:19, 484 MB) is in [`render/`](render/), split into five parts (GitHub's
100 MB file limit); join them with one command, see [`render/README.md`](render/README.md):
`cat maps-territory-v3_1080p30.mp4.part0 … maps-territory-v3_1080p30.mp4.part4 > maps-territory-v3_1080p30.mp4`.

## The story

**Mara, born 1990.** In the first verse her father draws her life for her, a ruled road with a tick for every year:
HOME 1990 → SCHOOL 2008 → MEDICAL SCHOOL 2014 → THE CLINIC 2016 (in the middle of the lake) → MARRIED 2018 →
THE HOUSE 2020 → RETIREMENT 2055. The card beside the sheet says *For Mara · drawn by her father, 1990*.

From the first chorus she walks. A pale, pencilled **ghost** of her walks the plan on schedule. For a while they
walk together ("I was tracing someone else's story"); then the real Mara leaves the road, and every time she leaves
the plan behind, the ghost fades a step, until by "arrive" it is gone. A year counter in the corner counts her age.

Eight **engraved plates** unfold from the map at the turning points. Each is a small animated engraving, drawn
stroke by stroke, with its own gold light, and a caption that strikes out what was planned:

| | Plate | Planned | Happened | Cue |
|---|---|---|---|---|
| 1 | THE FERRY, 2011 | Medical school | She left on the morning ferry, at twenty-one. | "standing somewhere off the shore" |
| 2 | A BAKERY IN THE RAIN, 2012 | A summer internship · sunny | Rain. She ducked into a bakery, and stayed to learn. | "I planned for sun but it was raining" |
| 3 | THE FEAST, 2014 | Final exams | Packed for war; found a long table, and Jonah. | "Packed for war but found a feast" |
| 4 | A DAUGHTER, 2016 | The clinic | Ida. The detour was the road. | "Every detour was the real road" |
| 5 | HER OWN BAKERY, 2018 | Married to someone suitable | Mara's. Every wrong turn headed east. | "Every wrong turn headed east" |
| 6 | HER FATHER, 2021 | The house next door to him | Her father died that winter. She kept his pens. | "Now I'm lost but I'm not looking anymore" |
| 7 | THE SEASIDE, 2024 | Nothing drawn here | The sea, for the first time. And a lighthouse for sale. | "the only way to finally arrive" |
| 8 | THE DEED, 2025 | Retirement, 2055 | She bought the lighthouse. It needed a keeper. (stamped SOLD on "beautiful") | "Oh, it's more beautiful than lines on paper could" |

On the map, Jonah's trail joins hers at the feast and they walk on as two lines; a small lamp (Ida) follows from
2016 (name tags make clear who walks with her). Her father never leaves HOME: when he dies in 2021 the camera pulls
back to the whole sheet and his lamp there goes out with the candle in his plate. Her trail turns grey while she is
lost, warming again when she reaches the seaside. There she sees the sea for the first time, and on the islet a
lighthouse with a FOR SALE sign; during the final chorus she buys it, and the sign on the map turns to
SOLD. In the instrumental the three of them cross to the islet: **HERE**. She lights the lighthouse, and every turn
of its beam cuts the paper away a little further out, a spiral, until the whole sheet is territory. In the last
chorus RETIREMENT is stamped **UNVISITED** and the plan is peeled off like tape. The outro is night: the beam
turning, three lamps on the islet, the French horn ringing out from the lighthouse.

Full plan and cue sheet: [`docs/TREATMENT.md`](docs/TREATMENT.md).

## Layout

- `audio/`, `lyrics/`, `data/`, `analysis/` — as in version 1 (the same song analysis: word-level lyric timings and
  the beat grid).
- `app/src/scenes/map.ts` — the whole video: the camera (a list of shots blended into one move), the plan, the
  ghost, the trail and the family's lamps, the plates on screen, the lighthouse, the year counter, the lyric.
- `app/src/scenes/_story.ts` — the story timed to the song: Mara's walk, the ghost's schedule and fading, the years,
  the events and the plates' cues, each anchored to a lyric word or a downbeat.
- `app/src/scenes/_vignettes.ts` — the eight engraved plates (static engraving, animation, gold lights, captions)
  and the card they sit on; `_plot.ts` is the little plotter they are drawn with (hand-wobbled polylines, hatching
  clipped to polygons, stroke-font text, drawn progressively).
- `app/src/scenes/_world.ts` — the country, the plan, the trail's waypoints and the lighthouse.
- `app/src/scenes/_mt.ts` — the kit: views, the terrain shader (map or territory; the cut-away along the trail as
  exact distance fields; the lighthouse beam's light and its spiral reveal), lamps, map furniture, karaoke helpers.
- `app/src/timeline.ts` — one scene, split at the section starts into thirteen parts for resumable segment renders.

## Render

```sh
cd app
bun install
bunx vite                                    # preview at http://localhost:5173 (?t=120 to start at a time)
python3 ../analysis/windows.py               # (from the video folder) part windows → out/windows.json
scripts/segments.sh p01 p02 … p13            # each part → out/seg/<id>.mp4 (1080p30, no audio)
scripts/assemble.sh                          # joins the parts and muxes the song → out/maps-territory-v3.mp4
```

Rendered in a CPU-only cloud container (SwiftShader, about 2 s per frame), hence 30 fps and one sample per frame;
on a GPU machine `render.ts video --samples auto --fps 60` renders a 60 fps file with motion blur.

## Credits

- **Song:** "Maps & Territory" by Joburgalex, title track of *Maps & Territory*, made with Suno. Mara and her story
  are fiction.
- **Engine:** forked from [mexicat/pdoom-video](https://github.com/mexicat/pdoom-video) (MIT).
- **Fonts:** Archivo, IBM Plex Mono, Cormorant Garamond (SIL Open Font License); single-stroke EMS and Hershey fonts
  via the `hersheytext` package (OFL / public domain).
- Made with Claude (Opus 5.5) in conversation.
