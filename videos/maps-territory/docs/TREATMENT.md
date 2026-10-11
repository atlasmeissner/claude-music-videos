# Maps & Territory — treatment & style bible

Song: "Maps & Territory" by Joburgalex, the title track of the album *Maps & Territory* (made with Suno). Video: a
generative, code-rendered music video in the manner of [mexicat/pdoom-video](https://github.com/mexicat/pdoom-video),
on its engine (MIT): every frame is a deterministic function of song time, the lyrics are word-synced karaoke
typography, cuts land on the beat grid.

## The idea in one paragraph

"The map is not the territory" (Korzybski, 1931). The whole video is set in **one invented country**, a 100 × 100 km
sheet with a mountain spine, a lake, a coast and, offshore, one small islet that is not on the map. Every plate
looks at this same place in one of two ways: as **the map** (bone paper, ink hairlines, contour lines, ruled roads,
mono annotations) or as **the territory** (the shaded, engraved relief itself, at night or in gold light). Two lines
run through it. **The plan**, the life as drawn: a ruled ink road from HOME through SCHOOL, UNIVERSITY, FIRST JOB,
PROMOTION and THE HOUSE to RETIREMENT, a year tick every few kilometres, straight across mountains and through the
middle of the lake. **The track**, the life as walked: a gold line with a lamp at its head that follows the
valleys, takes the detours, turns east at every wrong turn and ends off the shore, on the islet. The plates trade
the map for the territory as the song goes on: in the first chorus the two halves of the screen disagree; by the
last, the map is only a few ghost lines over a country lit gold. The French horn bookends it: the first plate is
the horn's call sounding out the land in the dark, the last is the lamp alone again, fading into silence.

## Tone

- Cinematic, patient, warm; a horn solo across open country, not a pop video. Slow camera moves that ease into
  downbeats; a few decisive events per plate placed on words and hits.
- Deadpan cartography as the humour: readouts (RANGE, DEVIATION FROM PLAN, FIT), legends, stamps, a packing list,
  a forecast that is wrong.
- Not slop: no stock "journey" imagery, no lens-flare sunsets, no particle nebulae, no glowing brains. Line drawing,
  engraving, relief shading, type.

## Palette (`app/src/engine/palette.ts`)

From the album cover (a night sea, a glowing gold line, a compass star): ink `#0A1013` night sea · ink2 `#131B1F` ·
graphite `#56615F` · ash `#99A19B` · bone `#EEE7D6` map paper · **signal** `#F0962E` lamplight amber-gold (the
track, its lamp, the sung word, the horn) · ember `#FFCF7A` gold core · blood `#A2501A` deep amber (sung words on
paper) · one rare accent **acid** `#5FB3AA` sea teal, owned by the shore (the end of chorus 1, the drop in the
instrumental, the final islet). Paper plates are bone with ink lines; only signal/ember glow.

## Typography

Archivo (lyrics; big, tight; width/weight animate on held notes), IBM Plex Mono (the cartographer: labels,
readouts, coordinates), Cormorant Garamond italic (Korzybski, the bridge), single-stroke Hershey/EMS fonts for
everything written by the pen (verse 1 is written by a plotter as it is sung). Every line kerned; typographic
punctuation.

## Karaoke rules

Every sung line is on screen, readable and synced per word (`_mt.ts › drawKaraoke`, `charTimes` for pen-written
lines): unsung words dim, the word being sung in signal (blood on paper), cooling to bone/ink. Never ahead of the
voice. Wordless vocals (the ad-libs in the instrumental and the outro's "oh") are not captioned.

## The world (`app/src/scenes/_world.ts`)

`heightAt(x, y)` is the territory, a pure function (ridged noise spine, hills, a lake basin, a noisy coast, the
islet). It is baked once per page into a half-float texture (height + gradient) that the terrain shader samples.
`PLAN` holds the named places; `track()` is a least-cost (A*) path through the valleys between waypoints that are
never the planned ones (A WRONG TURN, A DETOUR, A FEAST, EAST, HERE).

## Plates

| id | lyric | idea |
|---|---|---|
| `horn` | intro, horn alone | Darkness and a lamp at HOME. The horn's call travels out across the country; contour lines light up as the wavefront passes, as bright as the horn was loud when it left. RANGE readout. |
| `vista` | intro, the band swells | The territory as a panorama of ridgelines (sections through the height field, back to front), the lamp moving in the foreground valley; the title and the artist. |
| `korzybski` | intro, drum break → | "The map is not the territory." Cormorant epigraph; a 1:1 map of one square kilometre laid over its territory, the two refusing to match. |
| `sheet` | intro, last bars | Bone paper: a plotter draws the empty sheet — neatline, graticule, scale bar, compass star, legend, SHEET 1: THE PLAN. |
| `drew` | I drew the life… / Every year… / Named the cities… / Colored in… | The plotter draws the plan as it is sung: the ruled road, a year tick on every beat, the places named, the regions hatched. The lyric is written by the pen. |
| `ground` | But the ground beneath my feet / Was never on the page | The paper turns translucent: the territory shows through, the ruled road runs straight through the lake; on "page" the sheet lifts away. |
| `chorus1` | These are maps… / Nothing looks… | Split screen of the same place: MAP left, TERRITORY right, the divider sweeping on the beats; on "nothing looks" the map's contours slide off the land they describe. |
| `tracing` | I was tracing someone else's story / Now I'm standing somewhere off the shore | Tracing paper with somebody else's dotted route; the lamp follows it, then leaves it and walks off the coast into the sea: the islet, unsurveyed (sea teal). The break: waves. |
| `detour` | I planned for sun… / Packed for war… / Every detour… / Every wrong turn… | Four sub-plates on the line starts: a forecast (sun) and the rain hatching across the relief; a packing list struck through to FEAST; DETOUR signs that turn into ROAD; a compass whose every wrong turn points east. |
| `fits` | And the life I never planned / Fits better… | The plan and the track over the contours: the track lies in the valleys, the plan cuts across them. FIT: PLAN 23 % / TRACK 97 %. |
| `chorus2` | These are maps… / Nothing looks… | The territory with a map lens: a round magnifier shows the map underneath, and it no longer agrees. |
| `compass` | I was tracing… / Now I'm lost but I'm not looking anymore | A compass card spins free; the map folds itself up along its creases and is put away. |
| `bridge` | What if getting lost (×2) / Was the only way to finally arrive | Quiet, Cormorant italic. The whole track drawn as one line, loops and all, the camera pulling back; on "arrive" the end of the line becomes the compass star of the cover. |
| `chorus3` | These are maps… / Nothing looks the way I thought it would | Gold light: the territory full screen, the map shrunk to an inset. |
| `beyond` | But the life I found beyond the story / Oh, it's more beautiful… | The sheet's neatline in a far larger country: the camera pulls back past the paper's edge and the land goes on, lit. |
| `journey` | instrumental | A low flight along the track over the gold relief, the lamp leading; DISTANCE WALKED / DEVIATION FROM PLAN. |
| `dawn` | instrumental, the drop and the build | The drop: the shore at night, sea teal. The build: the ridgeline panorama of `vista` again, now at sunrise. |
| `chorus4` | These are maps… / Nothing looks… | The territory in full light; the map is only ghost contours that fade out word by word. |
| `found` | But the life I found… / Is more beautiful… | The track complete over the territory; the plan's ruled road is lifted off like a strip of tape. |
| `return` | outro, the horn returns; "oh" | Night again: the cover's picture — the sea, the compass star, the gold line of the track across the land to the islet. |
| `coda` | outro, to silence | The world pulls away to a map again, then to the single lamp of the first frame; the title; vast silence. |
