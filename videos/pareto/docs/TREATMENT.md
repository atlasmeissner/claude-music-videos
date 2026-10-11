# Pareto — treatment & style bible

Song: "Pareto (Remastered)" by Joburgalex (made with Suno). Upbeat Britpop, ~120 BPM, jangly guitar, driving bassline. About the 80/20 rule applied to a scruffy, happy London life: a messy flat, a hundred records, burnt toast, a run in the park, a girl in Camden, two good friends out of ten, a pint.

## The idea in one paragraph

The video is **"The Vital Few" — plates from a deadpan statistical almanac of one ordinary British life.** Every plate measures something small and domestic with the full apparatus of a Victorian treatise on political economy (Pareto's own world: charts, ledgers, engraved diagrams, tables, hairline rules, footnotes), and every plate is **split 80/20**: four-fifths of everything is grey, quiet, filler; one-fifth is **red** and carries the meaning. Running through the whole video is **the red fifth**: a pillar-box-red slice (a 1/5 bar, a 72° wedge, 20 out of 100 squares) that is always the thing that matters — the sung word, the twenty records, the charred corner of the toast, the wink, the two friends, the fire, the pint. The 10×10 grid of 100 squares opens the video and closes it (the last frame matches the first, so it loops). Around it, every plate has its **own idiom** (blueprint floor plan, record-shop shelf, kitchen engraving, park survey map, TV wall, Pareto chart, chat log, census of figures, guilloché swirl, stone tablet, scissors-cut paper, oscilloscope strings), so the look changes often, but everything shares one palette, one type system, one grain and one dry humour.

## Tone

- **Bright and jangly, never moody.** This is Britpop on a sunny morning: brisk, cheeky, optimistic. More light (bone paper) plates than the dark plates; dark plates are for night (Camden, Friday), the psychedelic bridge and the solo.
- Dynamic: something is always moving, and big changes land **on the beat** (cuts on downbeats, hits on kicks/snares, eases into downbeats). Strong eases (`outExpo`, `inOutCubic`, `outBack`), holds, then snaps. No floaty screensaver motion.
- Funny the way a straight-faced statistician is funny: deadpan captions, tiny footnotes ("n = 1 flat", "source: the kettle"), ledgers, percentages for everything. No emoji, no cartoon faces, no mascots, no stock "data" imagery.
- Not slop: no neon, no glowing brains, no lens-flare soup, no generic particles, nothing that looks AI-generated. No Union Jacks, no real logos, brands, banknotes or album covers (the solo nods to "Morning Glory" only through a sunburst of light — never an imitation of any cover). People appear only as simple geometric figures (circle head + capsule body), never faces.

## Palette (`app/src/engine/palette.ts`)

- **ink** `#0C0C0E` black, **ink2** `#17171A` panels, **graphite** `#5E5B57`, **ash** `#9C978F`, **bone** `#F1EBDD` paper/type, **signal** `#E8341C` pillar-box red (the red fifth, the sung word), **ember** `#FF7A4A` hot cores/highlights of red, **blood** `#A3170E` deep red shadows.
- One rare accent, owned by two moments: **gold** `#F2B13A` (the fire in "Set the twenty percent on fire" and the pint in the outro). Nothing else: no other hues.
- Light plates are **bone paper with ink lines**; dark plates are ink with bone lines. Red stays red on both. Only signal/ember/gold may glow (> ~0.85 linear); bone type stays crisp.
- The 80/20 rule is also a colour rule: in any frame, roughly 80% of the marks are graphite/ash/ink, about 20% red.

## Typography

- **Archivo** (grotesk, width 62–125, weight 300–900): the voice of the lyrics. Big, tight, confident, animated in width/weight.
- **IBM Plex Mono**: the almanac's machinery: labels, axes, percentages, footnotes, tables, ledgers.
- **Cormorant Garamond** (italic especially): the treatise voice, used rarely (the title card, "Vilfredo Pareto", "law of the universe", the closing line).
- **Single-stroke fonts** (`stroke.ts`) for text written by a pen (the plotter on the title page, handwritten notes).
- Swiss-grid discipline, asymmetric layouts, generous negative space, hairline rules, small mono annotations next to big display type. Typographic punctuation (’ “ ” … – — ×). No outlined or haloed type.

## Karaoke rules (all plates)

- Every lyric line must be **readable** and **synced per word**: a word appears or highlights at its `start` and completes by its `end` (`Lyrics.wordProgress`). Anticipation is OK (show the line dim up to ~0.4 s early) but highlighting never runs ahead of the voice.
- Each plate integrates the lyric **graphically and differently**: on a shelf of record spines, in the steam of a kettle, as TV news tickers, as bars of a Pareto chart, as chat bubbles, carved in stone. The words are part of the image, not subtitles on top.
- Default emphasis: sung portion bone (dark plates) / ink (light plates), the **key word of each line in signal red** (the line's "vital fifth": eighty, twenty, fifth, wink, two, fire…), unsung at ~30% opacity.
- Lyric text inside the title-safe area (≥ 96 px from the edges).

## Motifs

1. **The red fifth**: a 1/5 slice in signal red — a bar split at 80%, a 72° wedge, 20 cells of 100. It marks what matters in every plate.
2. **The 10×10 grid**: 100 small squares. Opens the video (cells fill one per 16th), returns in the choruses (20 red cells), closes the video.
3. **The Pareto curve**: the cumulative curve (concave, steep then flat) with the 80/20 point marked by a red dot and dashed guide lines `20% → 80%`. It is drawn by a red pen in the title, carries the chorus, and is carved in stone in the bridge.
4. **Percent readouts**: deadpan mono labels ("80.0% mess", "4/5 of the morning", "20 of 100", "2 of 10") staged inside each plate.

## Plates (scene modules)

Times come from `src/timeline.ts`, derived from the aligned lyrics. Look lines up by content (`lyrics.get('kettle')`), never hard-code times in scenes.

| id | lyric | idea |
|---|---|---|
| `open` | intro (instrumental) | title page: the 10×10 grid fills, the red pen draws the Pareto curve, PARETO set big, subtitle "On the Distribution of Things That Matter" |
| `flat` | Woke up in a flat… / Spent four-fifths of the morning… | blueprint floor plan, 100-cell mess census; a clock face 4/5 swept |
| `records` | I've got a hundred records… / But I only needle-drop twenty… | 100 record spines on a shelf; 20 pulled red; the needle drops on a spinning record |
| `kettle` | The kettle's boiling over… / Why's living the simple life so bloody hard? | kitchen engraving: kettle steam carries the words; toast with 20% charred; effort/result chart slams |
| `park` | I'm running 'round the park… / While eighty percent of the world is watching the news | park survey map, red runner laps; cut to a wall of 5 TVs: 4 news, 1 red |
| `chorus` ×2 | Oh, give me the twenty… / The cream of the crop… / I don't need the filler… / Just the twenty percent… | the Pareto chart: the words are bars sorted by importance; filler and weight fall out; the frame splits 80/20 |
| `lopsided` ×2 | Yeah, it's a lopsided world… / We're soaring on the fraction… | a balance where 20 outweighs 80, the curve becomes a flight path, clocks fly by |
| `camden` | Met a girl in Camden… / …Friday night feel well worth the while | night; her words in a blur; chat log 80% struck through; one wink = one red dot; a fifth of a smile |
| `friends` | Most of my friends are just background noise… / …a beautiful drain | ten figures; eight turn to static and shadows; two red ones pull you from the rain; everything spirals down the drain |
| `bridge` | Vilfredo Pareto, he knew the score… / …"vital few" zone | slowed, psychedelic: guilloché swirl; peas in pods; the wealth distribution; the formula carved in stone |
| `cut` | Cut the fat! Trim the wire! / Set the twenty percent on fire! | drum-fill build: scissors cuts across the frame on the hits; the red fifth ignites (gold fire) |
| `solo` | guitar solo | 100 strings ringing to the guitar; the 20 loudest red; echo trails; a sunburst |
| `outro` | Eighty percent of this song is just vibe… / The smallest piece is the biggest part. / la-la-la | the song's own progress bar (80% vibe / 20% reason); spending the twenty on a pint (gold) and you; the smallest piece fills the frame; back to the 10×10 grid (loop) |

### `open` — "Title page"
Bone paper. Hairline crop marks; a ruled frame. On the first downbeat a 10×10 grid draws in; the cells fill graphite one per 8th note, and the last 20 fill red (or 20 scattered cells turn red at once on a downbeat). A red pen (single-stroke) plots the Pareto curve across a small chart; the 80/20 point gets its dot and dashed guides with `20% of causes → 80% of effects`. Title **PARETO** in Archivo 900 wide, with a Cormorant italic subtitle *On the Distribution of Things That Matter* and a mono plate number "PLATE I · AN ALMANAC OF THE VITAL FEW". On the cut into verse 1 the grid zooms to become the floor plan's grid.

### `flat` — "The flat, surveyed"
Blueprint/architect's plan in ink on bone: a top-down floor plan (walls, door swings, a bed, a sofa, a sink), overlaid with a 10×10 survey grid. "Woke up in a flat that's eighty percent mess": on each sung word mess items (socks, mugs, books, pizza box — as simple line icons) stamp into cells until 80 of 100 are hatched "MESS" in graphite; a mono tally "MESS 80.0%". "eighty percent" in red. "Spent four-fifths of the morning just trying to dress": a big clock face; a red sweep fills 4/5 of the dial while clothing outlines (shirt, trousers, one sock) try on and off; "four-fifths" in red; footnote "n = 1 morning".

### `records` — "Collection, catalogued"
A shelf of 100 record spines (thin vertical rectangles, varied widths, ash/graphite, tiny mono catalogue numbers). The lyric runs along the shelf edge as a label strip. "a hundred records": a counter rolls to 100. "But I only needle-drop twenty": 20 spines slide out in red, one per 8th; then cut to a top-down turntable: a record spinning (fine concentric grooves), the tonearm swings in and the needle drops exactly on "drop" (a hit + ripple); the words "to find myself" spiral along the groove toward the label.

### `kettle` — "Breakfast, engraved"
Engraving style (hatching) on bone: a kettle at left; on "boiling over" steam curls rise and the sung words ride the steam upward. The toast: a slice with a browning gauge; exactly its top fifth chars red/ember ("slightly charred" — "20% CHARRED"). "Why's living the simple life so bloody hard?": a deadpan chart "EFFORT vs. RESULT" where the effort bar shoots up and the result bar stays tiny; "bloody hard" slams big in Archivo 900 with a shake.

### `park` — "Exercise, mapped"
Survey map of a park (contour lines, paths, a pond, trees as circles), the runner a red dot tracing a loop, leaving a red trail; a lap counter; "worn-out shoes": a shoe tread pattern stamps with 20% worn red. "While eighty percent of the world is watching the news": cut to a dark wall of 5 TV sets: 4 show grey news (scanlines, lower-third tickers that carry the lyric), 1 shows the red runner; mono "AUDIENCE SHARE 80%".

### `chorus` — "The Pareto chart" (two instances: n=1 bone paper, n=2 inverted on ink/red, heavier)
A Pareto chart (descending bars + cumulative curve) with mono axes. "Oh, give me the twenty that gives me the lot!": the words drop in as bars, tallest first; on "twenty" the first fifth of the bars is red and the cumulative curve shoots to 80%; "lot" fills. "The cream of the crop, the best of what I've got": the bars stack into layers, the top 20% layer red = "CREAM". "I don't need the filler, I don't need the weight": the grey bars (filler, weight) are struck through and fall out of the frame on the beats. "Just the twenty percent that makes me feel great": the frame splits hard 80/20 (a vertical rule at x = 80%): the line sits in the red fifth; "great" slams.

### `lopsided` — "A lopsided world" (two instances)
"Yeah, it's a lopsided world, a mathematical high": a balance/see-saw where 20 small red weights outweigh 80 grey ones; the whole world tilts; the Pareto curve rises steeply ("high"). "We're soaring on the fraction, watching time fly by!": the camera flies along the fraction bar of a huge "20/100" like a runway; clock faces fly past on the beats; the words streak.

### `camden` — "Friday night, transcribed"
Night (ink). "Met a girl in Camden, she spoke in a blur": her words appear motion-blurred, streaking. "Eighty percent of my chat was wasted on her": a chat log column, 80% of the messages struck through in graphite ("wasted"). "But that one little wink, that fifth of a smile": everything goes dark except one red dot that blinks on "wink"; a smile arc is drawn, with only its fifth (72°) in red. "Made the whole Friday night feel well worth the while": a week strip MON–SUN where FRI lights up red; a ledger "worth: ✓".

### `friends` — "Census of acquaintances"
Ten simple figures in a row (geometric, no faces). "Most of my friends are just background noise": eight of them dissolve into TV static. "Chasing the shadows and the plastic toys": their shadows run off; little plastic toy shapes. "But there's two out of ten who'd pull me from the rain": rain (falling hairlines) fills the frame; two figures turn red and lift you out (an umbrella shape forms). "The rest is just static, a beautiful drain": the eight become static and spiral down a drain vortex, which becomes the chorus' first bar.

### `bridge` — "Vilfredo Pareto, he knew the score" (music slows, psychedelic swirl)
Dark, slower, hypnotic: guilloché rosettes swirl (fine bone lines, red highlights) like a banknote engraving (generic, no real banknote). "Vilfredo Pareto, he knew the score": his name engraved in Cormorant inside a cartouche, "1848–1923". "From the peas in his garden to the rich and the poor": pea pods open, 20% of pods spill 80% of the peas; the peas roll into a wealth histogram. "It's a law of the universe, carved in the stone": the formula `P(X > x) = (xₘ / x)^α` and `α ≈ 1.16` carved into a stone tablet with engraving hatching. "You reap what you sow in the 'vital few' zone": the curve's head is shaded red, labelled VITAL FEW, and the swirl tightens into the build.

### `cut` — "Editing" (drum fill build-up)
Bone paper; each drum hit is a scissor cut: a straight cut line slices the frame and the parts slide apart. "Cut the fat!": the lyric is cut letter-wise. "Trim the wire!": a wire is trimmed and sparks. "Set the twenty percent on fire!": the red fifth bar ignites (gold/ember flames, the only fire), and the flash launches the solo.

### `solo` — "Resonance" (guitar solo, bright, echoing)
Dark then bright. 100 strings (vertical or radiating hairlines) vibrate with the guitar (audio envelopes, `other` stem onsets); the 20 loudest are red; echo/delay trails repeat fading copies of each pluck on the beat. Halfway, the strings radiate into a sunburst (bone rays on ink, red sun) — morning glory as light, not as any cover. Big width/weight sweeps on the downbeats.

### `outro` — "The vital few"
"Eighty percent of this song is just vibe / The other twenty is the reason I'm alive": the song's own timeline appears as a progress bar with the playhead at the real current time; 80% is labelled "VIBE", the last 20% "REASON". "Just the twenty… (yeah, the vital few)" / "I'm spending my twenty… (on a pint and you)": a fictional 20-unit note (generic guilloché "TWENTY", obviously not any real currency) folds into a pint glass that fills gold; "you" in red. "It's unconventional, it's math, it's art": three panels tick in: a crooked line, an equation, a brushstroke. "The smallest piece is the biggest part.": the camera zooms into the smallest red cell until it fills the frame. La-la-la fade: the 10×10 grid returns and empties back to the opening's first frame (loop).

## Technical conventions

See `docs/ENGINE.md`. Deterministic (pure function of `f.t`), per-word sync, beat-synced motion, hard cuts on downbeats. Rendering here is software (no GPU): keep each frame cheap — Canvas2D layers (≤ 2 per scene), `LineBatch` for many lines, and only light fullscreen shaders (no raymarching, no big fbm stacks).
