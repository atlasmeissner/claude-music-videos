# One Degree — the render

`one-degree_1080p30.mp4` (1920×1080, 30 fps, 3:39, H.264 + AAC, 288 MB) split into five pieces, because GitHub caps
files at 100 MB. Download all five parts into one folder, then join them:

**macOS / Linux**

```sh
cat one-degree_1080p30.mp4.part0 one-degree_1080p30.mp4.part1 one-degree_1080p30.mp4.part2 one-degree_1080p30.mp4.part3 one-degree_1080p30.mp4.part4 > one-degree_1080p30.mp4
```

**Windows (Command Prompt)**

```bat
copy /b one-degree_1080p30.mp4.part0 + one-degree_1080p30.mp4.part1 + one-degree_1080p30.mp4.part2 + one-degree_1080p30.mp4.part3 + one-degree_1080p30.mp4.part4 one-degree_1080p30.mp4
```

Check the result (optional) — the SHA-256 must be
`dcb804bf48464229188f9280219e232561f25e58aa6cdc6bd90eb7c8dde15d34`:

```sh
shasum -a 256 one-degree_1080p30.mp4        # macOS (Linux: sha256sum one-degree_1080p30.mp4)
```
