# Maps & Territory (version 3) — the render

`maps-territory-v3_1080p30.mp4` (1920×1080, 30 fps, 5:19, H.264 + AAC, 486 MB) split into five pieces, because
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
`70e0cc6d3dcdde6d0e45b2742753d21f59d8e69919d01f9ddf1f834282f17f28`:

```sh
shasum -a 256 maps-territory-v3_1080p30.mp4        # macOS (Linux: sha256sum maps-territory-v3_1080p30.mp4)
```
