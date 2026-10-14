# Maps & Territory (version 3) — treatment

Song: "Maps & Territory" by Joburgalex, title track of the album *Maps & Territory* (made with Suno). Version 3 of
the video. Same engine (a fork of [mexicat/pdoom-video](https://github.com/mexicat/pdoom-video)), same invented
country, same palette and type as [version 1](../../maps-territory/) and [version 2](../../maps-territory-v2/).

## The idea in one paragraph

**A whole life, planned and lived, on one map.** The whole song is one continuous camera move over one sheet.
Mara's father draws her life in the first verse as a ruled road, HOME 1952 to RETIREMENT 2017. From the first chorus
two figures walk: the real Mara, a gold lamp whose trail cuts the paper away so the real ground shows through, and a
pale pencilled ghost who keeps to the plan on schedule and fades each time she leaves it. At each turning point an
engraved plate unfolds out of the map (the life as lived, drawn like the territory, bright lines on a dark plate)
with the plan's version printed underneath and struck through. Fifteen plates, eighty-two years: a childhood
postcard of the sea, a dance, a ferry, a bakery, a feast and Jonah, Ida, her own bakery, a fire, her father's death,
the seaside from the postcard, a lighthouse bought and lit, a granddaughter, Jonah's death, and, after her own lamp
goes out, a coda in which her granddaughter draws Mara's real road onto the old plan.

## Characters

- **Mara**, 1952–2034, born at HOME. A child's small lamp that grows as the year counter runs to 1970; it goes out
  on the islet in the outro, at 82.
- **The ghost**, Mara as planned: a pale disc and a dotted pencil line along the ruled road, with a label (AS PLANNED ·
  THE CLINIC, 1978). It reaches the plan's places on the same beats as the real events (THE CLINIC when Ida is born,
  MARRIED when Mara's opens, THE HOUSE when her father dies), and fades in steps: 72 %, 52 %, 38 %, 20 %, gone by
  "arrive". It never reaches RETIREMENT, which is stamped UNVISITED in the last chorus.
- **Her father**, who drew the plan: a small lamp at HOME from her birth until 1994. He never walks with her; when he
  dies the camera pulls back so his lamp is in the frame as it goes out, and a tag stays there: HER FATHER · d. 1994.
- **Jonah**, 1949–2019, met at the feast in 1976: his trail joins hers and they walk on as two lines; he mends the
  lighthouse's lamp; his lamp goes out in the last chorus.
- **Ida**, born 1978: a small lamp that follows and grows, and keeps the lighthouse after Mara.
- **Noa**, Ida's daughter, born 2006: a small lamp on the islet; in 2041 she finds the plan.

## Cue sheet

| Time | Lyric / music | On the map | Plate |
|---|---|---|---|
| 0:00 | horn intro | the dark sheet; the horn's call rings from HOME; the title (one font, fading in) | |
| 0:34 | drum break | "The map is not the territory."; the plotter draws the sheet and the card (FOR MARA · DRAWN BY HER FATHER, 1952) | |
| 1:02 | verse 1 | the plan, drawn as sung; the verse handwritten on the card | |
| 1:17 | pre-chorus | down to HOME; "ground" opens the paper; on "page" she is born: *Mara, b. 1952* | |
| 1:24 | chorus 1 | childhood at HOME; the year counter runs; her father's lamp beside hers | 1 A POSTCARD · 2 THE DANCE |
| 1:38 | "tracing someone else's story" | she and the ghost walk the plan's road together | |
| 1:46 | "off the shore" | she leaves the road across the lake; the ghost walks on alone, fading | 3 THE FERRY |
| 1:57 | verse 2 | four plates in quick succession, alternating sides of the frame | 4–7 |
| 2:12 | pre-chorus 2 | the camera pulls back to the whole sheet | |
| 2:19 | chorus 2 | | 8 THE FIRE |
| 2:38 | "Now I'm lost" | the camera pulls back; name tags; her father's lamp at HOME goes out with the candle; her trail turns grey | 9 HER FATHER |
| 2:45 | bridge | loops; the camera turns with them | |
| 2:59 | "finally arrive" | THE SEASIDE; a dark lighthouse on the islet, FOR SALE | 10 THE SEASIDE |
| 3:02 | final chorus | she signs; stamped SOLD on "would", and the sign on the map turns to SOLD | 11 THE DEED |
| 3:16 | "Oh, it's more beautiful" | Jonah's mended lamp lights on "beautiful" | 12 THE LAMP |
| 3:31 | instrumental | the family crosses to the islet | |
| 3:45 | the drop | HERE, 1999: names on the lamps; she lights the lighthouse | |
| 3:50 | the build | the beam turns once every two bars and cuts the paper away in a spiral; the years run on | |
| 4:11 | last chorus | Noa's lamp joins; RETIREMENT stamped UNVISITED; Jonah's lamp goes out; the plan is peeled off | 13 NOA · 14 JONAH |
| 4:37 | outro | night; the beam turning; Mara's lamp goes out on the islet: MARA · 1952–2034 | |
| 4:54 | the band drops out | coda: Noa draws Mara's real road onto the old plan, in gold | 15 THE MAP, FOUND |
| 5:11 | the horn | the horn rings out from the lighthouse; the title | |

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
