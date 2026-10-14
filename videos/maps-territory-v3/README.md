# Maps & Territory (version 3) — music video

A generative, code-rendered music video with word-synced lyrics for "Maps & Territory" by Joburgalex, the title
track of the album *Maps & Territory* (made with Suno). Every frame is a deterministic function of song time,
rendered in headless Chromium (TypeScript + three.js), encoded with ffmpeg.

This is the third version. [Version 1](../maps-territory/) told the idea in twenty-one separate plates;
[version 2](../maps-territory-v2/) walked the artist's own life across one map. Version 3 keeps the one map and
the one continuous shot, and tells **a fictional life, planned and unplanned**.

**Watch / download:** the 1080p30 render (5:19, 470 MB) is in [`render/`](render/), split into five parts (GitHub's
100 MB file limit); join them with one command, see [`render/README.md`](render/README.md):
`cat maps-territory-v3_1080p30.mp4.part0 … maps-territory-v3_1080p30.mp4.part4 > maps-territory-v3_1080p30.mp4`.

## The story

**Mara, 1952–2034.** In the first verse her father draws her life for her, a ruled road with a tick for every year:
HOME 1952 → SCHOOL 1970 → MEDICAL SCHOOL 1976 → THE CLINIC 1978 (in the middle of the lake) → MARRIED 1980 →
THE HOUSE 1982 → RETIREMENT 2017. The card beside the sheet says *For Mara · drawn by her father, 1952*.

She is born at HOME on "page" and grows up there through the first chorus; then she walks. A pale, pencilled
**ghost** of her walks the plan on schedule. For a while they walk together ("I was tracing someone else's story");
then the real Mara leaves the road, and every time she leaves the plan behind, the ghost fades a step, until by
"arrive" it is gone. A year counter in the corner counts her age, the whole of her life and a little beyond.

Fifteen **engraved plates** unfold from the map at the turning points. Each is a small animated engraving, drawn
stroke by stroke, with its own gold light, and a caption that strikes out what was planned:

| | Plate | Planned | Happened | Cue |
|---|---|---|---|---|
| 1 | A POSTCARD, 1959 | Piano lessons, Tuesdays | A postcard from the sea. She kept it under her pillow. | chorus 1, "These are maps…" |
| 2 | THE DANCE, 1968 | A suitable boy, at a suitable dance | She danced all night with the wrong boy, and laughed. | "Nothing looks the way it did before" |
| 3 | THE FERRY, 1973 | Medical school | She left on the morning ferry, at twenty-one. | "standing somewhere off the shore" |
| 4 | A BAKERY IN THE RAIN, 1974 | A summer internship · sunny | Rain. She ducked into a bakery, and stayed to learn. | "I planned for sun but it was raining" |
| 5 | THE FEAST, 1976 | Final exams | Packed for war; found a long table, and Jonah. | "Packed for war but found a feast" |
| 6 | A DAUGHTER, 1978 | The clinic | Ida. The detour was the road. | "Every detour was the real road" |
| 7 | HER OWN BAKERY, 1981 | Married to someone suitable | Mara's. Every wrong turn headed east. | "Every wrong turn headed east" |
| 8 | THE FIRE, 1989 | The house, paid off | Mara's burned. The town came with buckets, then with bricks. | chorus 2 |
| 9 | HER FATHER, 1994 | The house next door to him | Her father died that winter. She kept his pens. | "Now I'm lost but I'm not looking anymore" |
| 10 | THE SEASIDE, 1997 | Nothing drawn here | The sea from the postcard. And the lighthouse, for sale. | "the only way to finally arrive" |
| 11 | THE DEED, 1998 | Retirement, 2017 | She bought the lighthouse. It needed a keeper. (stamped SOLD) | "the way I thought it would" |
| 12 | THE LAMP, 1999 | A quiet life, inland | Jonah spent the winter mending the old lamp. (it lights on "beautiful") | "Oh, it's more beautiful…" |
| 13 | NOA, 2006 | Grandchildren, nearby | Noa, Ida's girl, climbed all hundred and twenty-one steps. | last chorus |
| 14 | JONAH, 2019 | Growing old in the house | Jonah died in the spring. She kept the lamp lit. | "beyond the story" |
| 15 | THE MAP, FOUND, 2041 | The plan, as drawn in 1952 | Noa found the old plan in a drawer, and drew in the life Mara lived. | the outro (coda) |

On the map, Jonah's trail joins hers at the feast and they walk on as two lines; a small lamp (Ida) follows from
1978 (name tags make clear who walks with her). Her father never leaves HOME: when he dies in 1994 the camera pulls
back to the whole sheet and his lamp there goes out with the candle in his plate. Her trail turns grey while she is
lost, warming again when she reaches the seaside, the sea from her childhood postcard, with a lighthouse for sale
on the islet. She buys it; Jonah mends its lamp; in the instrumental the family crosses to the islet, **HERE**, in
1999, and lights it. Every turn of the beam cuts the paper away a little further out, a spiral, while the years run
on to 2005. In the last chorus Noa's lamp joins them, RETIREMENT is stamped **UNVISITED** (she never retired), Jonah's
lamp goes out (1949–2019), and the plan is peeled off like tape. In the outro Mara's own lamp goes out, at 82
(1952–2034); the lighthouse keeps turning. Then the coda: in 2041 Noa finds the old plan and draws onto it, in gold,
the road Mara actually walked. The French horn rings out from the lighthouse, and the title.

Full plan and cue sheet: [`docs/TREATMENT.md`](docs/TREATMENT.md).

## Layout

- `audio/`, `lyrics/`, `data/`, `analysis/` — as in version 1 (the same song analysis: word-level lyric timings and
  the beat grid).
- `app/src/scenes/map.ts` — the whole video: the camera (a list of shots blended into one move), the plan, the
  ghost, the trail and the family's lamps, the plates on screen, the lighthouse, the year counter, the lyric.
- `app/src/scenes/_story.ts` — the story timed to the song: Mara's walk, the ghost's schedule and fading, the years,
  the events and the plates' cues, each anchored to a lyric word or a downbeat.
- `app/src/scenes/_vignettes.ts` — the fifteen engraved plates (static engraving, animation, gold lights, captions)
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
