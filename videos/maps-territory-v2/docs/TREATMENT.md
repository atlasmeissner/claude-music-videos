# Maps & Territory (version 2) — treatment

Song: "Maps & Territory" by Joburgalex, title track of the album *Maps & Territory* (made with Suno). Version 2 of
the video ([version 1](../../maps-territory/) told the same idea in twenty-one separate plates). Same engine (a fork
of [mexicat/pdoom-video](https://github.com/mexicat/pdoom-video)), same invented country, same palette and type.

## The idea in one paragraph

**One map, one shot, one life.** The whole song is a single continuous camera move over one sheet of paper. In the
first verse a plotter draws **the plan** — the universal milestones, HOME 2000 → SCHOOL → UNIVERSITY → FIRST JOB →
PROMOTION → THE HOUSE → RETIREMENT 2040, a ruled road with a tick for every year, straight across the mountains and
through the middle of a lake. From the first chorus a lamp walks **the trail**, Joburgalex's own life, and each life
event bends it away from the plan on the word that carries it. Wherever the trail has gone, the paper is cut away and
the real terrain shows through; by the last chorus the cut has opened out over the whole sheet, the plan is peeled off
like tape, and the country carries on past the paper's edge. The French horn bookends it: its call lights the dark
sheet at the start and rings out from the trail's end at the close.

## The plan and the story

| The plan (universal, drawn in verse 1) | The trail (Joburgalex's life) | Cue |
|---|---|---|
| HOME 2000 | JOHANNESBURG (HOME gets its real name, handwritten) | "Was never on the **page**" |
| SCHOOL 2004 | the trail traces the plan's road | "I was tracing someone else's story" |
| UNIVERSITY 2008 | LEFT FOR EUROPE — it leaves the road and crosses the lake | "Now I'm standing somewhere off the shore" |
| FIRST JOB 2012 (in the lake) | MUNICH, on the far shore | the break |
| PROMOTION 2016 | rain where the plan forecast sun | "I planned for sun but it was **raining**" |
| THE HOUSE 2020 | MARRIED — a second trail joins, a table of lamps; walked as two lines from here | "Packed for war but found a **feast**" |
| RETIREMENT 2040 | TWO CHILDREN — two small lamps follow | "Every detour was the real **road**" |
| | RAN A COMPANY — a building on the map | "Every wrong turn headed **east**" |
| | WOUND IT UP — struck through; that stretch of road washes out; the compass spins | "Now I'm **lost** but I'm not looking anymore" |
| | loops, then AN AI RED TEAM | "What if getting lost" (×2) |
| | MY OWN PLATFORM | "Was the only way to finally **arrive**" |
| | MAKING MUSIC — rings on every beat, like the horn's | "Oh, it's more **beautiful**…" |
| | HERE — off the shore, on an islet no map shows | the instrumental's drop |

## Shape of the shot

- **Intro.** The sheet in the dark; the horn's call rings out from HOME; the title. On the drum break, "The map is not
  the territory." The paper lights up and a plotter draws the frame, coast, lake, compass, scale and a card with the
  title and legend.
- **Verse 1.** The plan, drawn as it is sung; the verse written by a second pen on the card.
- **Pre-chorus 1.** Down to HOME. On "ground" the paper under the lamp opens onto the real ground.
- **Choruses and verses.** The camera follows the lamp; tags pop onto the map at each event and stay. A strip along
  the bottom (the sheet's title block) carries the lyric, word-synced, the latest event and how far the walker is
  from the plan. Pre-chorus 2 pulls back to the whole sheet: "fits better than the one I drew by hand".
- **Bridge.** Close, the camera turning with the loops; it settles on "arrive".
- **Final chorus.** Gold light comes into the cut-away country.
- **Instrumental.** Out to the islet: HERE, sea teal. The build pulls back to the whole sheet while the cut opens out.
- **Last chorus.** The whole sheet is territory; on "beyond the story" the plan is peeled off and the land shows past
  the paper's edge.
- **Outro.** Night again; the horn rings from HERE; only contour lines and the trail remain; the title; silence.

## Craft

Palette, type and karaoke rules as in version 1 ([`../maps-territory/docs/TREATMENT.md`](../../maps-territory/docs/TREATMENT.md)).
The cut-away is a distance field to the trail baked once per page (`_mt.ts › trailTexture`: distance to the trail and
the arc length of its nearest point), so the terrain opens exactly behind the lamp and nowhere ahead of it.
