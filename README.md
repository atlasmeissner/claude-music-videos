# Music videos made with Claude

Music videos I made with Claude (Opus 5.5) in Claude Code, with everything they need to render. Every video here is
code: each frame is rendered from the song time by programs Claude wrote, then encoded with ffmpeg. There is no
editing software in the loop. I directed in conversation, and Claude agents wrote the plans, the engines, the scenes
and the review passes and ran the renders.

## Videos

| Video | Song | Look | Made with | Watch |
|---|---|---|---|---|
| [`pdoom-tabletop`](videos/pdoom-tabletop/) | "I'm Upping My P(doom)" (Claude-Pop version) | Stop-motion-style miniature on a researcher's desk at night: Clawd as a vinyl toy, a peg-doll researcher, a brass P(doom) gauge | Blender 5.2 (EEVEE) from Python scripts; 4K 60 fps | [YouTube](https://www.youtube.com/watch?v=Hu3Gupp-wKc) |
| [`paranoia`](videos/paranoia/) | HEARTSTEEL, "PARANOIA" (last minute) | League of Legends montage of my own plays: CCTV intro, pentakills synced to the drums, impacts, split-screens, kill callouts | Python/PyTorch footage engine (RIFE slow-mo, time remaps, GPU effects, synthesized SFX); 1440p 60 fps | [YouTube](https://youtu.be/4_YzMI2pPY8) |
| [`pareto`](videos/pareto/) | Joburgalex, "Pareto (Remastered)" | A deadpan statistical almanac of one British life: 15 plates split 80/20, a pillar-box-red fifth marking what matters, word-synced karaoke | TypeScript + three.js in headless Chromium (fork of the pdoom-video engine); 1080p 30 fps | [3-part MP4](videos/pareto/render/) |
| [`one-degree`](videos/one-degree/) | Joburgalex, "One Degree" | A small island-world balanced on a needle tips one degree per sung "degree" while the river it set running brings the land and its people to life, until it passes the tipping point and falls off, between instrument plates of slow change (seismograph, canyon, star trails, tally marks), word-synced karaoke | TypeScript + three.js in headless Chromium (fork of the pdoom-video engine); 1080p 30 fps | [5-part MP4](videos/one-degree/render/) |
| [`free-fall`](videos/free-fall/) | Joburgalex, "Free Fall" | A person procrastinates on a ledge for 412 days while fear draws the drop bottomless; it is 1.40 m. Daydreams, unsent drafts, a freeze at the edge, a crowd chanting them down, then the real jump: 0.53 s in the air, a stumble, the door swings wide. pdoom-video's look, word-synced karaoke | TypeScript + three.js in headless Chromium (fork of the pdoom-video engine); 1080p 30 fps | [4-part MP4](videos/free-fall/render/) |
| [`maps-territory`](videos/maps-territory/) | Joburgalex, "Maps & Territory" | The map is not the territory: one invented country seen as a paper map and as engraved relief; the planned life a ruled road through the lake, the lived one a gold track that ends off the shore; a French horn bookends it, word-synced karaoke | TypeScript + three.js in headless Chromium (fork of the pdoom-video engine); 1080p 30 fps | [MP4 in parts](videos/maps-territory/render/) |
| [`maps-territory-v2`](videos/maps-territory-v2/) | Joburgalex, "Maps & Territory" (version 2) | One map, one continuous shot: the plan of a life (HOME → RETIREMENT) is drawn, then the artist's own life walks away from it event by event; the paper is cut away wherever the trail has been, word-synced karaoke | TypeScript + three.js in headless Chromium (fork of the pdoom-video engine); 1080p 30 fps | [MP4 in parts](videos/maps-territory-v2/render/) |
| [`maps-territory-v3`](videos/maps-territory-v3/) | Joburgalex, "Maps & Territory" (version 3) | A whole fictional life, 1952–2034, planned and unplanned: her father draws the plan, a pale ghost walks it and fades each time she leaves it; nineteen engraved, animated plates unfold at her life events, and after every one she draws a new plan that the next one strikes out, from a childhood postcard of the sea to the lighthouse she buys, and a coda after her death; big word-synced lyrics | TypeScript + three.js in headless Chromium (fork of the pdoom-video engine); 1080p 30 fps | [MP4 in parts](videos/maps-territory-v3/render/) |
| [`bones`](videos/bones/) | Joburgalex, "Bones" | Demolition and construction drawings: a gilded façade stripped to its frame, the blueprints burnt, a cathedral built member by member from one surveyed point, word-synced karaoke | TypeScript + three.js in headless Chromium (fork of the pdoom-video engine); 1080p 30 fps | [5-part MP4](videos/bones/render/) |
| [`the-other-side-of-light`](videos/the-other-side-of-light/) | Joburgalex, "The Other Side of Light" | An atlas of every way to lose, in pdoom-video's style, built from 188 Creative Commons and public-domain photographs and prints: the lamp walks every route to ruin and crosses it out; each chorus prints the atlas as its own negative, the other side of light, word-synced karaoke | TypeScript + three.js in headless Chromium (fork of the pdoom-video engine); 1080p 30 fps | [MP4 in parts](videos/the-other-side-of-light/render/) |
| [`dominoes`](videos/dominoes/) | Joburgalex, "Dominoes" | One Rube Goldberg machine in a single take, drawn as engineering sheets: a thread, a dam, a speaking tube, a stranger's house, letter-dominoes, a pegboard of "AND THEN?", a chain shrinking to 1 mm and doubling to 1 km, then everything rewinds to the first domino, word-synced karaoke | TypeScript + Canvas 2D (Skia), new engine in pdoom-video's style; 1080p 30 fps | [2-part MP4](videos/dominoes/render/) |

Each folder is self-contained: its README covers the concept, layout, requirements, render commands and credits,
and its `docs/` hold the planning doc (`TREATMENT.md`), the brief the agents worked from (`ENGINE.md`) and notes on
how it was made.

## How the videos are made

The same rules run through every video:

1. **Every frame is a pure function of song time `t`.** No randomness, clocks or state carried between frames; seeded
   hashes instead. Frames can then render in parallel, out of order and resumably, and the previews match the final
   render exactly.
2. **Plan first.** A treatment (concept, look, palette, typography, one section per scene) comes before any code.
3. **Timing drives the edit.** The song is analysed first (beats, downbeats, drum hits, word-level lyric times), and
   cuts land on downbeats, hits on beats.
4. **One file per scene, written by parallel agents.** A lead agent writes the shared engine and a brief, then hands
   each agent one scene. The scene agents never edit shared code; they report engine bugs or needs to the lead.
5. **Look at the frames.** Contact sheets, frame strips and stills are rendered and read back by the agents, and each
   shot is revised until it reads well: first and last frames, motion across consecutive frames, transitions.
6. **Something happens in every shot.**
7. **Render offline, on rented GPUs when it's heavy.** Trials at 1080p; finals at full resolution and 60 fps on
   Vast.ai RTX 5090s, encoded with NVENC.

## License

The code is released under the [MIT License](LICENSE). Songs, gameplay footage, fonts and other third-party pieces
keep their own licenses; each video's README lists them.
