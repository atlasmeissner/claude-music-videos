# Free Fall — treatment & style bible

Song: "Free Fall" by Joburgalex (album *Maps & Territory*). Video: a generative, code-rendered music video in the
style of [mexicat/pdoom-video](https://github.com/mexicat/pdoom-video), on its engine (MIT) and under its style bible:
every frame is a deterministic function of song time, the lyrics are word-synced karaoke typography, cuts land on the
beat grid, and the look is pdoom's — ink, bone and one hazard orange, hairlines, engraving, bone-paper bureaucracy,
deadpan mono footnotes, grain and halation.

## The idea in one paragraph

The video is presented as **plates from an illustrated treatise on leaping**: each set piece has its own instrument,
idiom and dry humour, and argues one clause of the song's case for *asymmetric risk* (the downside of a leap is small
and capped, the upside is huge and open-ended). Running through the whole video is **the spark** — pdoom's orange
point of light dragging a hairline — cast here as the falling body of a physics textbook: it walks the ground out to a
cliff edge, draws the payoff curve, flies the parabola into a wall, falls through a vacuum tube beside a feather, and
lands, at the end, with a stumble. The running number, staged in-world like P(doom), is **THE ODDS** (upside :
downside), which climb every time the singer starts a "Free fall": 1 : 1 → 3 → 10 → 40 → 100 → 1,000 → 1,000,000 →
∞ : 1. The subjects are concrete things (warning signs, an adding-machine tape, a levelling staff, a spectrometer, a
payoff chart, a brick wall, a plinth, a seismograph, a vacuum tube, an envelope, a door in plan, a stadium seating
chart, a rubber stamp) treated as visual puns, never as literal storyboard illustrations of each line.

## Tone

- Pure adrenaline, the track's festival energy: something is always moving, and big changes land **on the beat**
  (cuts on downbeats, hits on kicks and handclaps, camera moves easing into downbeats). Strong eases, holds, snaps.
- Impressive, not cute: precise hairlines, high-contrast typography, restraint in colour, bloom only on the signal.
- Funny the way a straight-faced scientist is funny: deadpan captions, footnotes, stamps, measurements that keep
  coming out absurdly small (DROP 1.40 m · COST €0.00 · REPLIES 0 · DAMAGE: ONE (1) BRUISE).
- Not slop: no neon, no lens-flare soup, no particle nebulae, no stock "inspirational" imagery, no mascots, no faces.
  People appear only as the pictograms printed on safety signs and as hairline scale figures in technical drawings.

## Palette (pdoom-video's, unchanged — `app/src/engine/palette.ts`)

ink `#0A0A0B` · ink2 `#151517` · graphite `#5E5B57` · ash `#9C978F` · bone `#EEE9DF` · **signal** `#FF4D12` (the spark,
the odds, the upside, the sung word) · ember `#FF8A3D` · blood `#C21D0B` · one rare accent **acid** `#D8FF3C`, owned by
one moment (the wall breaking in the final chorus, ~2 s). No other hues: "the sky is screaming blue" is measured, not
shown. Some plates invert to **bone paper with ink lines** (the ledger, the letter, the door's blueprint, chorus 2).

## Typography

Archivo (lyrics: big, tight, confident; width and weight animate), IBM Plex Mono (instruments, labels, footnotes,
forms), Cormorant Garamond italic (rare: the vacuum, the bridge's asides, the end card), single-stroke fonts for text
written by the spark. Kerned, typographic punctuation, no outlined or haloed type. Lyrics stay title-safe.

## Karaoke rules

Every sung line is readable and synced per word; highlighting never runs ahead of the voice; each plate integrates
the lyric graphically and differently (printed on a tape, riding a curve, stamped, typed into a form, falling).

## Motifs

1. **The spark and its line** — the falling body.
2. **THE ODDS** — upside : downside, staged in each plate's own idiom; the hooks blow it up full-screen.
3. **The hook** — "FREE / FALL, FREE / FALL": one full-frame slam per sung word, the letters of FALL obeying gravity;
   it escalates each time (1: bone on ink, clean · 2: ink on a signal field · 3: maximal — strobes, stacked repeats).
4. **The payoff curve** — the hockey stick: a floor at "a stumble", a line that leaves the chart.
5. **Signage** — CAUTION / MIND THE DROP / COUNT THE COST: the voice of "they said".

## Plates

| id | lyric | idea |
|---|---|---|
| `edge` | intro | Crop-marked sheet. The spark draws the ground out to a cliff edge; on every downbeat a safety sign slams in until the edge is a thicket of warnings. With the stomps the title lands (FREE · FALL · JOBURGALEX) and knocks the signs off; the frame flies out on the cut. |
| `ledger` | They said count the cost… / Measure twice… | Bone paper: an adding-machine tape prints the cost of leaping, item by item; the total stays absurdly small. Then the drop is measured twice: 1.40 m, 1.40 m, stamped. |
| `cliff` | But the cliff is only shoulder-high / And the sky is screaming blue | Engraved elevation: the cliff against a levelling staff and an anthropometric scale (shoulder 1.40 m). "Screaming blue": a spectrometer whose trace spikes at 470 nm and off the chart (in orange: the only colour we have). |
| `payoff` | The worst… a stumble / The best is something beautiful | The payoff chart: the spark draws the floor (A STUMBLE) and the kink, then the line climbs off the chart (SOMETHING BEAUTIFUL); the lyric rides the curve; the spark leaves the frame on the chorus downbeat. |
| `hook` ×3 | Free fall, free fall | The hook (see Motifs), then THE ODDS full-frame rolling to the new value with a deadpan footnote. |
| `fly` ×2 (+ `final`) | I'd rather fly and hit a wall / Than spend forever standing tall / On ground that never moves at all (+ Free fall) | A ballistics plate: the spark flies a parabola (velocity vectors, dashed prediction) and hits an engraved brick wall — DAMAGE: ONE (1) BRUISE. A free-body diagram of a body standing tall forever (ΣF = 0, Δx = 0, t → ∞). A seismograph of the ground: 0.000 mm, flat. Chorus 2 is the same plate in bone paper, faster. |
| `vacuum` | Free fall, free fall (tail) | Half-time: an engraved vacuum tube, a feather and the spark released together; they fall alike, and so do the words. *In vacuo, all bodies fall alike.* |
| `letter` | They said what if nobody answers… / And silence is the only cost | Bone paper: a letter typed into a form; REPLIES 0; the words get lost (they peel off as paper planes); a price tag WHISPER €0.00; the ledger again: SILENCE — the only cost. |
| `door` | The door says no or the door swings wide / Either way I'm on the other side | Blueprint on bone paper: a door in plan with its swing arc; a NO stamp, then the leaf swings wide; a decision tree whose two branches both end OTHER SIDE; the spark walks through. |
| `chant` | (yeah, yeah — oh, oh…) | A stadium seating chart, top-down: hundreds of dots; every "oh" a wave through the stands; JUMPED: 0 → 1,000s as the dots leave the ground and become sparks. |
| `bridge` | Every great thing started with a jump / … / risked the shame | Stripped to handclaps and stomps: black; a register of firsts stamped on the claps (№ 1 A JUMP · № 2 A NAME · № 3 A LIFE WORTH TELLING · № 4 THE SHAME), building into the final chorus. |
| `final` (the `fly` module, v3) | I'd rather fly and hit the wall / … / Free fall, free fall | The maximal ballistics plate: a thousand sparks fly; the wall breaks (the acid moment); the flat seismograph erupts into the payoff curve and leaves the chart on the held "all". |
| `hook` (4) | Free fall, free fall (the last call) | The hook once more, bone on ink: THE ODDS are rounded up to ∞ : 1. |
| `outro` | outro | The spark falls one last time and lands: a stumble (−1). End card: E[leap] = ∞, *Free fall isn't reckless. It's rational.* The frame closes back in on the first frame, so the video loops. |
