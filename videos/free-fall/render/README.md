# Free Fall — the render

`free-fall_1080p30.mp4` (1920×1080, 30 fps, 3:00, H.264 + AAC, 312 MB) split into four pieces, because GitHub caps
files at 100 MB. Download all four parts into one folder, then join them:

**macOS / Linux**

```sh
cat free-fall_1080p30.mp4.part0 free-fall_1080p30.mp4.part1 free-fall_1080p30.mp4.part2 free-fall_1080p30.mp4.part3 > free-fall_1080p30.mp4
```

**Windows (Command Prompt)**

```bat
copy /b free-fall_1080p30.mp4.part0 + free-fall_1080p30.mp4.part1 + free-fall_1080p30.mp4.part2 + free-fall_1080p30.mp4.part3 free-fall_1080p30.mp4
```

Check the result (optional) — the SHA-256 must be
`94a6eeb8c5f1267dd80435eec823eae5269c912baceb473ac25d1f8f5ed9201a`:

```sh
shasum -a 256 free-fall_1080p30.mp4        # macOS (Linux: sha256sum free-fall_1080p30.mp4)
```
