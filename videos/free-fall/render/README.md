# Free Fall — the render

`free-fall_1080p30.mp4` (1920×1080, 30 fps, 3:00, H.264 + AAC, 297 MB) split into four pieces, because GitHub caps
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
`6662c0f117fc5481fc6f4e975e60cdae326c56fb543beae33a1ef6f17dbef196`:

```sh
shasum -a 256 free-fall_1080p30.mp4        # macOS (Linux: sha256sum free-fall_1080p30.mp4)
```
