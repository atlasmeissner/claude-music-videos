# One Degree — treatment & style bible

Song: "One Degree" by Joburgalex (made with Suno), from the album *Maps & Territory*. Video: a generative,
code-rendered music video in the manner of [mexicat/pdoom-video](https://github.com/mexicat/pdoom-video), on its
engine (MIT): every frame is a deterministic function of song time, the lyrics are word-synced karaoke typography,
cuts land on the beat grid.

## The song

From the album notes: "One Degree" is about **the compound effect (the 1% rule)**: small, consistent improvements
add up to a massive change. Getting 1% better each day for a year makes you 1.01³⁶⁵ ≈ 37.8 times better. The early
returns feel disproportionately small and the curve looks flat at the beginning. That is when most people quit, and
the ones who succeed trust the process through the quiet days. The production argues the same way: each section adds
exactly one layer to a fingerpicked guitar pattern until the final chorus is a full wall, and the outro peels the
layers away again.

## The idea in one paragraph

The video is **an atlas of slow change**: a sequence of plates, each an instrument that measures something too small
to notice. There is a seismograph that does not register a footstep, a sound meter pinned at −∞ dB, a year of
identical days, a river cutting a canyon, a book growing a page at a time, star trails, snow becoming a mountain, a
ship's course one degree off, and a wall of tally marks. Running through all of them is **the compounding counter**:
the song is one year (day 0 on the first sung word, day 365 on the last), and a small readout in each plate shows
the 1.01ⁿ curve so far, DAY n and ×1.01ⁿ. It sits near ×1.00 for most of the first half ("nothing worth remembering
yet") and climbs to ×37.8 on the last word. The hook's "degree" is the unit of the small step: each sung "degree"
moves something by exactly one degree inside the plate (the dial's hand, the ship's course, the protractor's
needle). The frame itself never tilts.

## Tone

- Quiet, precise, patient; never cute. Most plates are slow and still, with exact, small events placed on the beat
  (a tick, a stamp, a step of the needle). The choruses open up: wider shots, bigger type, more light.
- Straight-faced instrument humour: deadpan readouts (MAGNITUDE 0.0, −∞ dB, "a second (1.000 s)", "WHERE MOST
  PEOPLE STOP").
- Not slop: no particle nebulae, no lens flares, no stock "inspirational" imagery, nothing that looks AI-generated.
  Line drawing, engraving, type.

## Palette (`app/src/engine/palette.ts`)

ink `#0A0B0D` night · ink2 `#15171A` · graphite `#5B5D5F` · ash `#9B988F` · bone `#F0EBE0` paper/type ·
**signal** `#FF6A1F` sunrise orange (the needle's tip, the step, the sung word, the river, the curve's latest days) ·
ember `#FFA552` hot cores · blood `#B23A14`. Paper plates (the calendar, the chart) invert to bone with ink lines.
Only signal/ember glow.

## Typography

Archivo (lyrics, big and confident; width/weight animate), IBM Plex Mono (instruments, readouts), Cormorant Garamond
italic (the whispered bridge, the coda, equations). Every line kerned; typographic punctuation.

## Karaoke rules

Every sung line is on screen, readable and synced per word (`_od.ts › drawKaraoke`): unsung words dim (or hidden,
then revealed on their start), the word being sung in signal, cooling to bone. Never ahead of the voice.

## Plates

| id | lyric | idea |
|---|---|---|
| `dawn` | intro | Black; a protractor draws itself on the downbeats around one upright needle, then pushes into a single degree. |
| `ground` | One step… / One word… | Seismograph drum (MAGNITUDE 0.0), then a sound-level meter pinned at −∞ dB. |
| `days` | One day… / Nothing worth remembering yet | Bone paper: a year of identical day cells crossed off faster and faster; the ledger's "1% better each day" creeps from ×1.00 and only shoots up at the end; on "yet" the first day after the year turns orange. |
| `river` | But the river… / It's carving… | Engraved strata; the orange river cuts a canyon; each word of the line labels the layer it has reached. |
| `hook` | One degree, one degree / Turn so slow… | Giant ONE DEGREE type over a 360-tick dial whose hand steps one degree on each "degree"; then a clock hand you can't see move, and a loupe at 60×. |
| `curve` | But the whole world's bending / one degree ×3 / break | The 1% rule as a plot: the curve runs flat along the floor and bends upward on "bending" to ×37.8; then 1.00ⁿ and 0.99ⁿ for comparison and the gap (×1,481); the break marks the quiet days, "where most people stop". |
| `pages` | One page… / One glance… | A book's fore-edge growing a page per eighth note; a stopwatch: a glance is 0.2 s, a second is 1.000 s. |
| `night` | One night… / something's gathering | Star trails over a horizon: each night an arc, the years close them into rings that gather on the pole star. |
| `snow` | And the mountain… / falling snow | Snowflakes settle into strata that stack into an engraved mountain. |
| `course` | One degree ×4 / Turn so slow… / bending | Bone nautical chart: the true course and one that opens by a degree on each "degree"; the pull-back shows they end on different coasts. |
| `whoa` | One degree, whoa ×3 + break | A fan of rays, one per "degree" so far, one degree apart; the pull-back shows 12 of 360 ticks lit. |
| `quiet` | I almost gave up… / But I was changing | Whispered: a wall of tally marks, each a hair steeper than the last; close up every one looks upright; the pull-back shows the turn. |
| `different` | One degree ×4 / Turned so slow… / different now / all I need | THEN \| NOW pairs, one opened on each "degree": one step \| a worn path; one page \| a book; one night \| ten years of trails; one flake \| a mountain. On "different" the THENs are gone and the four NOWs fill the frame. |
| `sunflower` | tag (whoa) | 365 days as a sunflower at the golden angle, each dot 1% bigger than the last (day 365 is 37.8× day one), arriving faster and faster; it closes into a single point. |
| `coda` | One degree… was all I need | The opening's protractor: the needle really turns, one degree on each "degree", leaving a hairline at each step; then 1.01³⁶⁵ = 37.8. |
| `outro` | — | The needle and the title card: "1% a day · ×37.8 a year". |

## Revisions

- **2:** the world no longer tilts (the first cut rolled the whole frame one degree per "degree": it cropped the type
  and read as a mistake). The degree is now a step inside each plate, and the running thread is the compounding
  counter. The globe became the `curve`, and the final-chorus sunrise, the corona and the coda were rethought around
  the compound effect (`different`, `sunflower`, `coda`).
