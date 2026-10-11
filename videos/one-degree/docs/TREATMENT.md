# One Degree — treatment & style bible

Song: "One Degree" by Joburgalex (made with Suno). Video: a generative, code-rendered music video in the manner of
[mexicat/pdoom-video](https://github.com/mexicat/pdoom-video), on its engine (MIT): every frame is a
deterministic function of song time, the lyrics are word-synced karaoke typography, cuts land on the beat grid.

## The idea in one paragraph

The video is **an atlas of slow change**: a sequence of plates, each an instrument that measures something too
small to notice — a seismograph that does not register a footstep, a sound meter pinned at −∞ dB, a year of
identical days, a river cutting a canyon, a protractor, a ship's course one degree off, star trails, snow
becoming a mountain, a wall of tally marks. The running device is **the degree count**: every time the singer
sings "degree", the whole world turns by exactly one degree (the plate is rolled in post, and most plates carry
a small in-world readout of the heading). Nobody can see it happen — "turn so slow you can't see" — but by the
final chorus the world sits visibly askew, and in the last shot the needle that stood upright in the first frame
is upright again only because everything else has turned 24° around it. "One degree was all I need."

## Tone

- Quiet, precise, patient; never cute. Most plates are slow and still with exact, small events placed on the
  beat (a tick, a stamp, a step of the needle). The choruses open up: wider shots, bigger type, more light.
- Straight-faced instrument humour: deadpan readouts (MAGNITUDE 0.0, −∞ dB, Δ = 0, "a second (1.000 s)").
- Not slop: no particle nebulae, no lens flares, no stock "inspirational" imagery (no sunrise-over-mountains
  photography look), nothing that looks AI-generated. Line drawing, engraving, type.

## Palette (`app/src/engine/palette.ts`)

ink `#0A0B0D` night · ink2 `#15171A` · graphite `#5B5D5F` · ash `#9B988F` · bone `#F0EBE0` paper/type ·
**signal** `#FF6A1F` sunrise orange (the needle's tip, the degree, the sung word, the river, the sun) ·
ember `#FFA552` hot cores · blood `#B23A14` · one rare accent **acid** `#FFD58A` pale dawn gold, owned by the
final sunrise. Paper plates (the calendar, the chart) invert to bone with ink lines. Only signal/ember glow.

## Typography

Archivo (lyrics, big and confident; width/weight animate), IBM Plex Mono (instruments, readouts),
Cormorant Garamond italic (the whispered bridge and the coda). Every line kerned; typographic punctuation.

## Karaoke rules

Every sung line is on screen, readable and synced per word (`_od.ts › drawKaraoke`): unsung words dim (or
hidden, then revealed on their start), the word being sung in signal, cooling to bone. Never ahead of the voice.

## Plates

| id | lyric | idea |
|---|---|---|
| `dawn` | intro | Black; a protractor draws itself on the downbeats around a single upright needle. 0°. |
| `ground` | One step… / One word… | Seismograph drum (MAGNITUDE 0.0), then a sound-level meter pinned at −∞ dB. |
| `days` | One day… / Nothing worth remembering yet | Bone paper: a year of identical day cells ticking by; on "yet" one cell turns orange. |
| `river` | But the river… / It's carving… | Engraved strata cross-section; the orange river cuts a canyon; years counter. |
| `hook` | One degree, one degree / Turn so slow… | Giant ONE DEGREE type on a 360-tick dial; the first two degrees; a clock hand you can't see move. |
| `globe` | But the whole world's bending / one degree ×3 | A graticule globe rolls; meridians bend; three more degrees. |
| `pages` | One page… / One glance… | A book's edge growing a page per beat; "a second look" timed to 1.000 s. |
| `night` | One night… / something's gathering | Star trails over a horizon: each night an arc, the years close them into rings that gather on the pole star. |
| `snow` | And the mountain… / falling snow | Snowflakes settle into strata that rise into an engraved mountain; the lyric is made of snow. |
| `course` | One degree ×4 / Turn so slow… / bending | Bone nautical chart: a true course and one 1° off; the pull-back shows how far apart they end. |
| `whoa` | One degree, whoa ×3 + break | A fan of rays, one per degree so far, opening in steps; then the quiet. |
| `quiet` | I almost gave up… / But I was changing | Whispered: a wall of tally marks, each one 1° steeper than the last; the pull-back reveals the turn. |
| `sunrise` | One degree ×4 / Turned so slow… / different now / all I need | A horizon; the sun climbs one degree per "degree"; on "different now" the world flips to day. |
| `corona` | tag (whoa) | The rays of every degree so far turn into the sun's corona. |
| `coda` | One degree… was all I need | The protractor from the opening returns: the needle stands upright because the world has turned 24°. |
| `outro` | — | Title card and fade. |
