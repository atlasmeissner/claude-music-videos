# Maps & Territory — the render

`maps-territory_1080p30.mp4` (1920×1080, 30 fps, 5:19, H.264 + AAC, 536 MB) split into six pieces, because GitHub
caps files at 100 MB. Download all six parts into one folder, then join them:

**macOS / Linux**

```sh
cat maps-territory_1080p30.mp4.part0 maps-territory_1080p30.mp4.part1 maps-territory_1080p30.mp4.part2 maps-territory_1080p30.mp4.part3 maps-territory_1080p30.mp4.part4 maps-territory_1080p30.mp4.part5 > maps-territory_1080p30.mp4
```

**Windows (Command Prompt)**

```bat
copy /b maps-territory_1080p30.mp4.part0 + maps-territory_1080p30.mp4.part1 + maps-territory_1080p30.mp4.part2 + maps-territory_1080p30.mp4.part3 + maps-territory_1080p30.mp4.part4 + maps-territory_1080p30.mp4.part5 maps-territory_1080p30.mp4
```

Check the result (optional) — the SHA-256 must be
`7c248a262e3c9e4a97f65941508edf73827669cf8bd45406c55caf5a822f502a`:

```sh
shasum -a 256 maps-territory_1080p30.mp4        # macOS (Linux: sha256sum maps-territory_1080p30.mp4)
```
