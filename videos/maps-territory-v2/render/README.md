# Maps & Territory (version 2) — the render

`maps-territory-v2_1080p30.mp4` (1920×1080, 30 fps, 5:19, H.264 + AAC, 431 MB) split into five pieces, because
GitHub caps files at 100 MB. Download all five parts into one folder, then join them:

**macOS / Linux**

```sh
cat maps-territory-v2_1080p30.mp4.part0 maps-territory-v2_1080p30.mp4.part1 maps-territory-v2_1080p30.mp4.part2 maps-territory-v2_1080p30.mp4.part3 maps-territory-v2_1080p30.mp4.part4 > maps-territory-v2_1080p30.mp4
```

**Windows (Command Prompt)**

```bat
copy /b maps-territory-v2_1080p30.mp4.part0 + maps-territory-v2_1080p30.mp4.part1 + maps-territory-v2_1080p30.mp4.part2 + maps-territory-v2_1080p30.mp4.part3 + maps-territory-v2_1080p30.mp4.part4 maps-territory-v2_1080p30.mp4
```

Check the result (optional) — the SHA-256 must be
`e71f881a165dd95290fe10910a0a5e467ec893a2220b40a9e8b65a7b6ffa252b`:

```sh
shasum -a 256 maps-territory-v2_1080p30.mp4        # macOS (Linux: sha256sum maps-territory-v2_1080p30.mp4)
```
