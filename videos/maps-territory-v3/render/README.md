# Maps & Territory (version 3) — the render

`maps-territory-v3_1080p30.mp4` (1920×1080, 30 fps, 5:19, H.264 + AAC, 470 MB) split into five pieces, because
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
`1ac347536cdca378cf2bad7f04c9ef567b0da70069738092818fc51b8e179518`:

```sh
shasum -a 256 maps-territory-v3_1080p30.mp4        # macOS (Linux: sha256sum maps-territory-v3_1080p30.mp4)
```
