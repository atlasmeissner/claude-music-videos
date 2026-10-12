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

The verses are **an atlas of slow change**: instruments that measure something too small to notice (a seismograph
that does not register a footstep, a sound meter pinned at −∞ dB, a year of identical days, a river cutting a canyon,
a book growing a page at a time, star trails, snow becoming a mountain, a wall of tally marks), with the
**compounding counter** (×1.01ⁿ over the song's year) running through them. The choruses and the ending are
**the little world**: one small planet whose axis tilts by exactly one degree on every sung "degree", 0° at the
first chorus, 24° at the last word. That is a hair more than Earth's 23.4°, the tilt that gives Earth its seasons, and
the song happens to sing "degree" exactly 24 times. The frame never tilts; the planet does. The shots cut on the beat
between the planet turning and the village at 50°N that lives on it. Each degree is one degree of planet and a
season's difference down there: the noon sun climbs, the ice line retreats 289 km, the river thaws, the trees leaf,
the windows light. A ledger in the village names what each degree did ("+4° THE RIVER CRACKS", "+14° THE ICE LINE
PASSES THE VILLAGE"). At 24°: a world with seasons.

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
| `days` | One day… / Nothing worth remembering yet | Bone paper: a year of identical day cells crossed off faster and faster; "1% better each day" creeps from ×1.00; on "yet" the first day after the year turns orange. |
| `river` | But the river… / It's carving… | A survey cross-section in geological map symbols (sandstone dots, limestone brickwork, shale dashes, schist waves, granite crosses); the orange river cuts a canyon; each word labels the layer it has reached. |
| `turn` | One degree, one degree / Turn so slow… | The little world, frozen, at 0°; each "degree" tilts its axis one degree (the arc from the vertical, +1°), then cuts to the village; "Turn so slow": a slow push in. |
| `bending` | But the whole world's bending / one degree ×3 / break | The axis leaning from the vertical; three more degrees, turn / village; the break at the village as the light goes. |
| `pages` | One page… / One glance… | A book's fore-edge growing a page per eighth note; a stopwatch: a second is 1.000 s. |
| `night` | One night… / something's gathering | Star trails over a horizon: each night an arc, the years close them into rings that gather on the pole star. |
| `snow` | And the mountain… / falling snow | Snowflakes settle into strata that stack into an engraved mountain. |
| `ice` | One degree ×4 / Turn so slow… / bending | Four degrees in six seconds, planet / village / planet / village; the ice line closing on the village (ICE n KM FROM THE VILLAGE). |
| `whoa` | One degree, whoa ×3 + break | Turn / village on each "whoa"; the break at dusk, the windows coming on. |
| `quiet` | I almost gave up… / But I was changing | Whispered: a wall of tally marks, each a hair steeper than the last; close up every one looks upright; the pull-back shows the turn. |
| `thaw` | One degree ×4 / Turned so slow… / different now / all I need | The ice line passes the village (+14°); "different now" cuts to the village in full summer. |
| `lights` | tag | The planet's night side, filling with the lights of the people on it. |
| `coda` | One degree… was all I need | The last six degrees, quietly, on the planet alone: 18° → 24°, EARTH: 23.4°; "twenty-four degrees: a world with seasons". |
| `outro` | — | The little world at 24° above the title card. |

## Revisions

- **3:** the little world. The choruses and the ending became one small planet tilting a degree per "degree" and the
  village that lives on it (`scenes/_world.ts`, `scenes/world.ts`); the curve, the then/now pairs, the sunflower and
  the protractor coda were dropped. The river's hatching (read as noise) became geological map symbols.
- **2:** the world no longer tilts (the first cut rolled the whole frame one degree per "degree": it cropped the type
  and read as a mistake). The degree is now a step inside each plate, and the running thread is the compounding
  counter. The globe became the `curve`, and the final-chorus sunrise, the corona and the coda were rethought around
  the compound effect (`different`, `sunflower`, `coda`).
