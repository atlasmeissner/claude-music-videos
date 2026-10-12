# Maps & Territory (version 3) — treatment

Song: "Maps & Territory" by Joburgalex, title track of the album *Maps & Territory* (made with Suno). Version 3 of
the video. Same engine (a fork of [mexicat/pdoom-video](https://github.com/mexicat/pdoom-video)), same invented
country, same palette and type as [version 1](../../maps-territory/) and [version 2](../../maps-territory-v2/).

## The idea in one paragraph

**A planned life and an unplanned one, on one map.** The whole song is one continuous camera move over one sheet.
Mara's father draws her life in the first verse as a ruled road. From the first chorus two figures walk: the real
Mara, a gold lamp whose trail cuts the paper away so the real ground shows through, and a pale pencilled ghost who
keeps to the plan on schedule. Every time Mara leaves the plan behind, the ghost fades a step. At each turning point
an engraved plate unfolds out of the map — the life as lived, drawn like the territory, bright lines on a dark
plate — with the plan's version printed underneath and struck through. The bittersweet middle is her father's death;
the end is a lighthouse on an islet that was never on the map, whose turning beam opens the whole country.

## Characters

- **Mara**, born 1990 at HOME. A child's small lamp that grows as the year counter runs to 2008.
- **The ghost**, Mara as planned: a pale disc and a dotted pencil line along the ruled road, with a label (AS PLANNED ·
  THE CLINIC, 2016). It reaches the plan's places on the same beats as the real events (THE CLINIC when Ida is born,
  MARRIED when Mara's opens, THE HOUSE when her father dies), and fades in steps: 72 %, 52 %, 38 %, 20 %, gone by
  "arrive". It never reaches RETIREMENT.
- **Her father**, who drew the plan: a small lamp at HOME from her birth until 2021.
- **Jonah**, met at the feast in 2014: his trail joins hers and they walk on as two lines.
- **Ida**, born 2016: a small lamp that follows and grows.

## Cue sheet

| Time | Lyric / music | On the map | Plate |
|---|---|---|---|
| 0:00 | horn intro | the dark sheet; the horn's call rings from HOME; the title | |
| 0:34 | drum break | "The map is not the territory."; the plotter draws the sheet and the card (FOR MARA · DRAWN BY HER FATHER, 1990) | |
| 1:02 | verse 1 | the plan, drawn as sung; the verse handwritten on the card | |
| 1:17 | pre-chorus | down to HOME; "ground" opens the paper; on "page" she is born: *Mara, b. 1990* | |
| 1:24 | chorus 1 | childhood: the year counter runs; her father's lamp beside hers | |
| 1:38 | "tracing someone else's story" | she and the ghost walk the plan's road together | |
| 1:46 | "off the shore" | she leaves the road across the lake; the ghost walks on alone, fading | FIG. 1 THE FERRY |
| 1:57 | verse 2 | four plates in quick succession, alternating sides of the frame | FIG. 2–5 |
| 2:12 | pre-chorus 2 | the camera pulls back to the whole sheet: "fits better than the one I drew by hand" | |
| 2:40 | "Now I'm lost" | her father's lamp at HOME goes out; her trail turns grey; the compass spins | FIG. 6 HER FATHER (the candle gutters out) |
| 2:45 | bridge | loops; the camera turns with them | |
| 2:59 | "finally arrive" | THE COAST; the lighthouse on the islet, flashing every two bars; the ghost is gone | FIG. 7 THE LIGHTHOUSE |
| 3:02 | final chorus | gold light comes into the country; the grey trail warms again | |
| 3:31 | instrumental | the three of them cross the water to the islet | |
| 3:45 | the drop | HERE: the lighthouse lights | |
| 3:50 | the build | the beam turns once every two bars; each turn cuts the paper further out, a spiral; the camera pulls back | |
| 4:11 | last chorus | the whole sheet is territory; RETIREMENT is stamped UNVISITED; on "beyond the story" the plan is peeled off | |
| 4:37 | outro | night; the beam turning; three lamps on the islet; the horn rings out from the lighthouse; the title | |

## The plates

Each plate is a dark card (bone hairline frame) that unfolds from its place on the map — first a thin strip, then
the paper opening out of its creases — flies to its side of the frame, and folds back into the map when its line is
over, leaving a tag. Inside, a 700 × 380 engraving is plotted stroke by stroke (outlines first, then hatching, then
the details), with a pen point at the drawing head; what moves (the ferry crossing, rain, swinging lanterns, the
rocking cradle and turning mobile, the oven's fire and steam, the guttering candle, the lighthouse beams) is drawn
live every frame, and the lights glow gold on top. Underneath, on a strip of the map's paper, the plan's version
(PLANNED · …) is struck through in red, and what happened is written out in italic.

## Craft

- **Type.** The lyric is set large along the bottom (Archivo, up to 84 px; the bridge in Cormorant italic at 108 px),
  word by word as sung, the rest of the line visible as a faint ghost of itself; long lines break into two rows.
- **The cut-away.** The trail's reveal is an exact distance field: a snapshot per waypoint for what has been walked,
  plus the current leg as a polyline measured in the shader, so the paper opens with a round edge right behind the
  lamp and nowhere ahead of it.
- **The beam.** Two beams on one axis, light added after the night fade so they stay bright in the outro; the reveal
  radius at each angle is the radius at the beam's last pass, which draws the spiral.
- Palette and the rest of the type as in version 1 ([`../maps-territory/docs/TREATMENT.md`](../../maps-territory/docs/TREATMENT.md)).
