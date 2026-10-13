# Maps & Territory (version 3) — the render

`maps-territory-v3_1080p30.mp4` (1920×1080, 30 fps, 5:19, H.264 + AAC, 484 MB) split into five pieces, because
GitHub caps files at 100 MB. Download all five parts into one folder, then join them:

**macOS / Linux**

```sh
cat maps-territory-v3_1080p30.mp4.part0 maps-territory-v3_1080p30.mp4.part1 maps-territory-v3_1080p30.mp4.part2 maps-territory-v3_1080p30.mp4.part3 maps-territory-v3_1080p30.mp4.part4 > maps-territory-v3_1080p30.mp4
```

**Windows (Command Prompt)**

```bat
copy /b maps-territory-v3_1080p30.mp4.part0 + maps-territory-v3_1080p30.mp4.part1 + maps-territory-v3_1080p30.mp4.part2 + maps-territory-v3_1080p30.mp4.part3 + maps-territory-v3_1080p30.mp4.part4 maps-territory-v3_1080p30.mp4
```

Check the result (optional) — the SHA-256 must be
`473d40a0dddae5b0193d87e96a93300234373a3251340c80a08649dbc166f88e`:

```sh
shasum -a 256 maps-territory-v3_1080p30.mp4        # macOS (Linux: sha256sum maps-territory-v3_1080p30.mp4)
```
