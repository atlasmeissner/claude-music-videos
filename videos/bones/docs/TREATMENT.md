# Bones — treatment & style bible

Song: "Bones" by Joburgalex (made with Suno), the opening track of the album *Maps & Territory*. Video: a
generative, code-rendered music video in the manner of [mexicat/pdoom-video](https://github.com/mexicat/pdoom-video),
on its engine (MIT): every frame is a deterministic function of song time, the lyrics are word-synced karaoke
typography, cuts land on the beat grid.

## The idea in one paragraph

The song is about **first principles**: tear everything down to the facts that cannot be reduced any further, then
reason upward from there. Its production does the same thing — one bare piano note, then strings, drums, guitars,
choir, until the last chorus is a cathedral of sound built from that single note. The video is **a set of
demolition and construction drawings**. The first half is a demolition: an imposing, gilded, inherited façade is
measured, pulled at, found to be carrying loads that were never ours, then stripped — gold, stone, cladding — down
to its frame, its bones. The blueprints burn. What is left is a single surveyed point on bedrock. The second half is
a construction: from that one point, one post, one lintel, then a frame, then arches, then a ribbed nave — a
cathedral drawn in bone-white lines, built member by member on the beat, the way the arrangement builds instrument
by instrument. At the end it is all taken back down to the one point it was built from.

## Running devices

- **The point.** One vermilion point with a hot core (the chalk-line mark a builder makes before anything else).
  It is the first piano note, the corner pulled at, the bearing that carries the load, the ember that survives the
  burn, the survey benchmark on bedrock, the foot of the first post, and the keystone of the vault. It appears in
  every plate.
- **ASSUMED / PROVEN.** A small mono ledger (bottom left on most plates). In the first half it counts what is
  ASSUMED (1,214 things at the start, down in chunks as they are stripped, 0 at the bridge's "finally saw"); in the
  second half it counts what is PROVEN — every member the construction adds, one at a time, on the beat.
- **Sheet numbers.** Each plate is a drawing sheet with a tiny title block: D-sheets (demolition) in the first half,
  S-sheets (structure) in the second.

## Tone

- Patient, precise, deadpan; never cute. The verses are quiet and slow (the piano and voice are alone at first).
  The choruses hit: hard cuts on downbeats, big type, things falling and rising on the beat.
- Straight-faced survey and engineering humour: LOAD-BEARING: ASSUMED, OWNER: NOT YOU, SOURCE: SOMEONE ELSE,
  SCALE: INHERITED, "the map is not the territory".
- Not slop: no particle nebulae, no lens flares, no glowing brains, no stock "inspirational" imagery, no literal
  skeletons or skulls (the bones are a building's bones: its frame). Line drawing, engraving, type.

## Palette (`app/src/engine/palette.ts`)

ink `#0B0A09` warm black · ink2 `#171513` · graphite `#5E5A54` · ash `#9E978C` · **bone** `#EDE5D3` (paper,
type, and the bones themselves) · **signal** `#FF5326` chalk-line vermilion (the point, the sung word, the first
true line) · ember `#FF9A5C` · blood `#A8240E` · and one owned accent, **gold** `#C8A04A`: the inherited ornament.
Gold appears only on things that are about to be stripped away, and never glows. After the chorus strips it, gold
does not come back. Paper plates (the load ledger, the map, the orders) invert to bone with ink lines.

## Typography

Archivo (the lyrics: big, tight, confident; width and weight animate), IBM Plex Mono (instruments, title blocks,
the ledger), Cormorant Garamond (the inscriptions carved in the façade — inherited, Roman, gilded — and the
whispered bridge). Every line kerned; typographic punctuation.

## Karaoke rules

Every sung line is on screen, readable and synced per word: unsung words dim (or hidden, then revealed on their
start), the word being sung in signal, cooling to bone. Never ahead of the voice.

## Plates

| id | lyric | idea |
|---|---|---|
| `note` | intro (piano alone) | Black. The title; each piano note places a point and rings out; the points are surveyed into one. |
| `facade` | They built these walls… / Told me this is just the shape of things | Pull back from the point to an engraved, gilded classical façade; then the plan, its perimeter traced on "shape". |
| `edges` | But I've been pulling at the edges / And the whole thing bends (+ strings, "oh") | The façade's structural grid; the point pulls a corner out; on "bends" the lattice and the line bend; the strings' entrance closes on the corner; each "oh" is a standing wave. |
| `carry` | What if everything I'm carrying / Was never mine to hold | Bone paper load take-down: inherited loads drop on one bearing, a stamp per word reads NOT MINE, the stack lifts off. |
| `strip` | Take me down to the bones / Strip the gold and the stone | An x-ray scan down the façade shows its bones; the gold falls, then the stone, course by course, until only the frame stands. |
| `shown` | I don't need what I was shown / Build it up from the bones | A specimen plate of the fallen ornament, struck out a word at a time; then post, post and lintel from the point. |
| `xray` | instrumental (full band, choir) | The old building's bones in 3D, x-rayed, four views cut on the bars, a section plane scanning through. |
| `maps` | Every map they drew was borrowed / Every truth was someone else's guess | Bone paper: a map stitched from borrowed patches, stamped BORROWED; spot heights get question marks; on "guess" the patches slide out of register. |
| `burn` | So I'm burning all the blueprints / Starting from what's left | The blueprint of the building burns from its corners; what survives is the survey: seven benchmarks. |
| `ground` | What if all I really needed / Was the ground beneath my feet | A section down through the strata, a layer per word, to bedrock; a spirit level settles TRUE on "feet". |
| `orders` | chorus 2 | Bone paper: one Corinthian column stripped word by word through the orders to a bare post; then posts on the beat into a colonnade. |
| `build` | chorus 3 | 3D: the new frame rises from the point, one member group per beat — piers, arcades, the first vault arches. |
| `wreckage` | I stood in the wreckage… / The only foundation was never the wall | Whispered (Cormorant italic). The rubble; on "saw" a section: under the wall nothing, under the point the bedrock. ASSUMED reaches 0. |
| `cathedral` | final chorus | The vaults close, the buttresses spring; on the last "bones" the keystone is set, and it is the point. |
| `vault` | "From the bones" + the choir | Inside the finished nave, a slow walk; the choir lights the frame node by node. |
| `asbuilt` | choir | Bone paper record drawing: sections of what was built, the old façade struck through, stamped AS BUILT. |
| `outro` | Take me down | The nave in section retracts into the point it was set out from; the point rings like the first note; title. |
