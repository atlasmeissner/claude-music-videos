# Dominoes — treatment & style bible

Music video for **“Dominoes” by Joburgalex**, the closing track of *Maps & Territory*. Built in the
style of [mexicat/pdoom-video](https://github.com/mexicat/pdoom-video): a code-rendered video where
every frame is a deterministic function of song time, with word-synced karaoke typography, a
restrained palette, film grain, and a straight-faced sense of humour.

## The idea in one paragraph

**One machine, one take.** The whole song is a single Rube Goldberg machine that runs from the first
xylophone note to the last chord, and the camera follows the chain reaction along it without a cut.
Every lyric line is one stage of the machine, and each stage is a *consequence of the one before*: a
pulled thread shakes a building, the shaking moves a stone, the stone breaks a river, the river says
a word down a speaking tube, the word lights a stranger’s window. The song is about second-order
thinking (“and then what happens after that?”), so the machine is annotated like an engineering
drawing that keeps count: every stage carries a small **order number** (1°, 2°, 3° …) that ticks up as
the consequences pile up. The bridge shrinks everything down to a single domino a millimetre tall;
the final chorus is the famous geometric chain, each domino 1.5× the last, until the last one is
taller than the whole machine. Then the camera pulls back and we see the full length of everything
that fell. The outro runs the machine in reverse, so the last frame is the first: one domino,
standing, waiting.

## The rule of the impulse

The eye must always be able to follow the chain reaction, so **only the part that is moving right
now is orange**. Everything at rest is bone (on ink) or ink (on paper); things that have already done
their job fall back to graphite. The orange is handed from part to part like a baton: thread → stone
→ water → sound → flame → ball → domino. It is the video’s equivalent of pdoom’s spark.

## Tone

- Dynamic and mechanical: something is always moving; impacts land **on the beat** and on sung
  syllables; the camera holds, then moves with strong eases into downbeats; whips when the chain
  outruns it.
- Precise, not cute: hairline technical drawing, Swiss-grid type, small mono annotations and
  leader lines next to big display type. Deadpan captions (“fig. omitted”, “a stranger (unknown)”,
  “→ continues beyond frame”). No faces, no mascots, no cartoon physics gags.
- Not slop: no neon, no particle nebulae, no lens flares, no stock “mind-blown” imagery.

## Palette

Same as pdoom: **ink** `#0A0A0B`, **ink2** `#151517`, **graphite** `#5E5B57`, **ash** `#9C978F`,
**bone** `#EEE9DF`, **signal** `#FF4D12` (the impulse, the sung word), **ember** `#FF8A3D`,
**blood** `#C21D0B`. No other hues.

The verses are drawn bone-on-ink (a night blueprint); the choruses invert to ink-on-bone paper.
Inversions are wipes driven by the machine itself (a giant domino face falling across the frame),
never fades. Orange stays orange on both. Only orange glows.

## Typography

- **Archivo** (static instances, width 62–125, weight 300–900): the lyrics. Condensed and heavy for
  the slams, wide for the held notes.
- **IBM Plex Mono**: the drawing’s annotations: order numbers, part labels, scale bars, timestamps.
- **Cormorant Garamond Italic**: the whispered bridge only.

## Karaoke rules

- Every line is readable and synced per word: a word turns orange exactly at its sung onset and
  never before; sung words settle to bone/ink; unsung words wait at ~35%.
- Lines may appear up to ~0.4 s before they are sung.
- The words are part of the machine (carried on the thread, floating on the river, written by the
  plotter, printed on the dominoes), not subtitles.

## Stations (as built)

Every station is a module in `app/src/stations/`; positions chain off each other in `app/src/timeline.ts`, and
every hit is placed on a sung word onset or a beat from `data/`.

| time | lyric | station | stage |
|---|---|---|---|
| 0–16.7 | intro (staccato strings, xylophone runs) | `intro` | One domino on a plinth (FIG. 1, 0°). A marble touches it on the first note; it knocks a steel ball down a 21-bar xylophone staircase, one bar per detected note, across two chimes and a floor marimba cut to the rhythm, into a ratchet wheel that lifts it one notch per beat. The maker’s plate: DOMINOES · JOBURGALEX. |
| 16.7 | I pulled a thread and felt the building shake | `thread` | The ball drops into a cup on a thread; the pull travels along a washing line of words and is stitched through a tower’s facade; the tower sways (live readout in mm). |
| 20.0 | Moved a stone and watched the river break | `river` | A stone shaken off the roof slides down a chute that carries the first half of the line; it knocks out the dam’s keystone on “watched”; on “break” the reservoir’s contour lines burst through and carry the rest of the line. |
| 23.3 | Said one word on an ordinary night | `tube` | The flood fills a bucket on a seesaw, which squeezes a bellows; one word travels as a pulse down a speaking tube, passing each word as it is sung, under a crescent moon (“AN ORDINARY NIGHT. NOTHING TO REPORT.”). |
| 26.7 | And set a stranger’s world alight | `match` | The horn’s blast pushes a match along its striker on “set”; it falls lit onto a fuse under the words; the spark reaches a stranger’s house (NAME UNKNOWN) and its windows light one by one. |
| 30.7 | Nothing stops where you think it ends | `stops` | The house’s heat inflates a balloon that pulls a pin; a ball runs under the words into a buffer stop marked END, which is a domino: it tips over (“IT DID NOT”). |
| 33.8 | Every line you draw just bends | `stops` | The falling END starts a plotter; the pen writes the line along a ruler-straight stroke that bends under it (INTENDED / ACTUAL), then springs back and flicks the first giant domino: the slab wipe to paper. |
| 37.2 | Chorus 1 (paper) | `chorus` ×1 | DOMINOES as letter-dominoes knocked over syllable by syllable, the shelf row falling into the floor row; a plan view of one touch branching through ten generations to ×1,024; the letters again, bigger; a row receding to a vanishing point (“→ CONTINUES BEYOND FRAME (FIG. OMITTED)”). |
| 50.2 | interlude | `galton` | Back to ink. FIG. 13, SECOND-ORDER THINKING (APPARATUS): one ball per beat through a pegboard, one row per eighth note, each row labelled AND THEN?; “MOST PEOPLE STOP HERE →” at row 1; a live count of consequences traced; the last ball leaves through a trapdoor. |
| 61.7 | I chose the left road … led to you | `map` | Plan view, contour interval ONE DECISION. The lyric is set along the roads like road names and a dot passes each word as it is sung. A fair coin lands L on “left”; the dotted road not taken runs to a hatched A WAR (MISSED) as a ghost dot; the left road finds A HYMN (FOUND); a dot holds a door (architectural swing) for another, who holds the next one, which opens onto YOU ARE HERE. |
| 76.4 | The second step is never seen | `stairs` | A slinky walks down a staircase whose next step is only drawn when reached; one word per tread. |
| 79.5 | Until it’s everywhere you’ve been | `stairs` | Pull back over the whole machine so far (FIG. 18, GENERAL ARRANGEMENT). |
| 83.2 | Chorus 2 (paper) | `chorus` ×2 | As chorus 1, escalated: heavier, wider letters, the echoes as twelve concentric rings, the far row curving. |
| 96.5 | And somewhere now because of something small | `geo` | Ink. Twenty dominoes, each 0.78× the last; the camera follows the chain down to one a millimetre tall (FIG. 21, SOMETHING SMALL, ACTUAL SIZE NOT SHOWN). |
| 104.3 | Something I won’t remember at all | `geo` | Stillness: the one before it rests against it. Whispered Cormorant italic that fades as soon as each word is sung. Dust, suspended. |
| 108.5 | A life is changing | `geo` | The millimetre domino teeters, and tips on “changing”. |
| 110.4 | Final chorus | `geo` | The geometric chain: twenty dominoes, each twice the last, every impact on a sung “Dominoes” or a beat; height labels climb from 1 mm to 1.09 km while the camera pulls back on each hit; DOMINOES slams flash orange and cool to bone. |
| 124.1 | Every life becomes a thousand echoes (a cappella) | `geo` | The giants fall slowly over the hush. |
| 133.3 | And now I see how far the falling goes | `geo` | The last one lands on “goes”; the camera pulls back over the whole chain; a magnifier finds the entire machine as a speck at its foot. |
| 137.4 | climax | `geo` | Echoes branch out of the landing across the frame; the counter runs from 1 to 1,048,576 consequences. |
| 150.3 | Dominoes, dominoes ×3 / And now I see how far the falling goes | `geo` | Three slams (left, right, centre) over the network; the last pull-back. |
| 164.3 | outro | `frame.ts` | The mechanism runs in reverse: the whole video rewinds, slow at first, fastest in the middle, gentle at the end (◀◀ ×n, REWINDING (EVERYTHING)), through every station back to FIG. 1: one domino, standing, on the final chord. The last frame is the first. |

Running through it all: a faint drafting grid that adapts to the zoom, order tags (1°, 2° …) on each stage, and a
title block (sheet number, sheet name, timecode, CONSEQUENCES SO FAR, JOBURGALEX) in the bottom-right corner.
