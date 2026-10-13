# The Other Side of Light — treatment & style bible

## The idea in one paragraph

**An Atlas of Every Way to Lose.** The song is about *inversion* (Jacobi's "Invert, always invert", Munger's "All
I want to know is where I'm going to die, so I'll never go there"): the verses map every path to failure, the
chorus runs away from what's wrong rather than toward what's right. So the video is an atlas whose plates chart
only failures. Every picture in it is a real photograph or print under a Creative Commons licence or in the public
domain (188 of them), printed through one shader into the video's palette and numbered like the plates of a book
(PL. 1 … PL. 188), each with its credit line in the margin. Running through the whole atlas is **the lamp**: one
orange point of light (the pdoom spark) that writes the first line of each verse in a clerk's hand and walks
every route; every route it walks in a verse ends in a cross. On each chorus the atlas **prints as its own
negative**: the ink sheet becomes bone paper, the photographs turn into negatives (the light at the end of the
tunnel turns black, the night road turns white), and only the signal orange stays itself: the lamp, the routes and
every red thing in every photograph (a jacket, a WRONG WAY sign, boxing gloves). That is the other side of light.
The right path is never drawn directly: it is what is left when every wrong turn has been crossed out.

## Tone

- Same rules as pdoom-video: something always moves, big changes land on the beat (cuts on downbeats and beats,
  stamps on eighth notes), strong eases and holds, hard cuts.
- Deadpan: mono annotations, filing labels (D-01 … D-06, FIG. 1, EXHIBIT 3), a ledger of failures, a distance
  meter (DISTANCE FROM WHAT I FEAR: 412.7 m), a pharmacist's label that says "KEEP OUT OF REACH OF YOURSELF".
- Dark verses, blinding choruses: the dynamic shifts of the track are the light/dark rhythm of the edit.
- The bridge is the opposite of everything else: almost empty, small serif type, hairlines.

## Palette

pdoom's palette, unchanged: **ink** `#0A0A0B`, **bone** `#EEE9DF`, **signal** `#FF4D12`, **ember** `#FF8A3D`,
graphite and ash for secondary type. No other hues. Photographs are printed through `_kit.ts`' plate shader:

- `print`: old maps and engravings, paper to ink and the engraved lines in bone (inverted, auto-levelled).
- `photo`: photographs as a line engraving (pdoom's `engrave()` hatch) in bone on ink.
- `tone`: a smooth ink→bone duotone.
- `negative`: the photograph's negative, on the paper of the chorus world.
- `redKey`: saturated reds in the photograph print in signal orange.
- Every plate is auto-levelled on its own 2 % / 98 % luminance (measured in the build step), can glow in signal and
  ember above a threshold, and reveals with a wipe, an iris, blinds or a burn (a charred, glowing edge).

## Typography

Archivo for the lyric voice (900, condensed widths for long lines), IBM Plex Mono for the machine voice
(annotations, credits, the ledger, Munger's quote typed out), Cormorant Garamond italic for the sacred and the
whispered (the epigraph, "I learned the dark by name", the bridge), the Hershey script for what the lamp writes.
Every lyric is word-synced: words wipe from dim to lit exactly as they are sung.

## Plates

| id | lyric | idea |
|---|---|---|
| `title` | intro | The lamp writes *Man muss immer umkehren.* over the plate of Jacobi's grave; on the bar where the band drops out the epigraph turns upside down. Ortelius' world, a compass rose that flips north to south, the lamp drawing seven routes that each end in a cross (RUIN, A LIE TOLD TWICE, A BURNT BRIDGE, THE BOTTOM, COMFORT, GLORY (UNVERIFIED), FEAR); the title stamps in a word per two beats; on the drop the sheet prints as its own negative. |
| `map` | I drew a map of every way to lose | "I drew a map" written by the lamp over Nolli's Rome, lit only along its trail; four old maps on the beat, a route and a cross on each (WAY Nº 01 · RESULT: LOSS); LOSE on the Chartres labyrinth, a DEAD END sign pasted into the margin. |
| `doors` | Every door that leads to ruin | A Becher-style typology of six doors stamped on the eighth notes, filed D-01 … D-06; the lamp walks to the dark one and the camera goes through it; on the other side only ruins, and RUIN falls apart letter by letter. |
| `mirror` | Every lie I'd tell myself | The frame is a mirror (right half = left half reflected); the lie is told on the left, MYSELF answers reversed from the glass; the mirror cracks, then breaks into strips out of register. EXHIBIT 3 · REFLECTION ≠ EVIDENCE. |
| `bridge` | Every bridge I'd set to burning | The lamp crosses Hiroshige's bridge in the rain and the print burns behind it; BURNING heats letter by letter through signal to ash over Turner's burning parliament. |
| `names` | I learned the dark by name / Every shadow, every flame | A specimen sheet of darkness (Goya, night paintings, a cave), each pinned with a Latin name (*Tenebrae domesticae*, *Nox perpetua*…); shadows on the beat; one flame, then the backing vocals' echoes multiply the flames on every bar (1, 2, 4, 8, 16) to white. |
| `chorus` ×3 | So I'm running… | The inversion (see above). A: running through the atlas, the same burst as the outro's opening: plates (empty roads and the verses' doors, mirror, bridge and dark) shoot out of the lamp at the centre of the frame, one per beat, and grow toward the camera until they fill it and pass us; the word slams sit on top; LIGHT on a tunnel whose light is black. B: the lamp walks Nolli's Rome, every wrong turn crossed, then the right path lights up and WRONG is struck out. C: a WANT → signpost, struck through, the lamp walking the other way (the final chorus, "not chasing anymore", has no sign). D: the frightening plates of the verses recede into the distance with a meter counting. The third (final) chorus breaks down to a whisper in B and explodes in C and D ("I just left behind the fight": the fight plates recede). |
| `munger` | instrumental | Back in the dark: Munger's line typed out under his portrait; the lamp crosses out "there". |
| `ledger` | I wrote the list of all the ways to fail / All the poison dressed as medicine | The lamp writes the line over typewriters and handwriting; a numbered ledger of failures runs on the beat (014 Ignore the map … FAIL); apothecary plates, a POISON label, then a neat MEDICINE label slapped on top of it. |
| `descent` | Every shortcut to the bottom / Every comfortable sin | Straight down spiral stairwells, each handing over to the next, the lamp spiralling in, BOTTOM falling after it; red armchairs (in signal), Doré's damned, Bruegel's *Sloth* on "sin." |
| `lightbox` | I held the worst up to the light / And finally saw the way to fight | A hell engraving lifted into an empty lightbox; on "light" the box switches on and the print turns translucent; an X-ray, Redon's *I Saw a Flash of Light*; the lamp draws the way through; FIGHT on fencers, boxers, Pollaiuolo's *Battle of the Nudes*, building to white. |
| `glory` | They said go find the path to glory / I just found every path to grief / And walked the other way | A fingerpost in hairlines, small framed plates of glory (arches, laurels, a victory, medals); on "every path to grief" each frame turns over into a grave and the single path splits into a fan of routes, each crossed; footprints in the sand turn around, DIRECTION OF TRAVEL: REVERSED, the lamp walks out to the left. |
| `climb` | instrumental climb | The band as a triptych of plates cutting on their own instruments (VC. ostinato, SN. military on the snare hits, ORG. 32′); engraved naves looking up; totality: a new eclipse corona on every "oh" phrase, and on the last beat the black sun prints as its own negative. |
| `outro` | the climax, the last hit | Rewind: plates of the atlas fly out of the vanishing point, each crossed as it passes (WAYS TO LOSE, REVISITED: 032 / 188 · ALL AVOIDED); the whole atlas as one index sheet of 188 plates unfolding from the centre in sixteenth notes, every one crossed; the lamp draws the one route left across the whole sheet; the title sets itself on it; on the last hit the paper goes dark and the lamp goes out. |
| `plates` | silence | The List of Plates: every image with its number, title, creator and licence, two pages. |

## Timing

`data/lyrics.json` (word level) and `data/audio.json` (160.42 BPM constant grid, downbeats, sections, envelopes,
kick/snare/hat onsets) drive everything; `src/timeline.ts` anchors each plate to its lyric line on the beat grid.
