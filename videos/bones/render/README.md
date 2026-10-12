# Bones — the render

`bones_1080p30.mp4` (1920×1080, 30 fps, 3:19, H.264 + AAC, 400 MB) split into five pieces, because GitHub caps
files at 100 MB. Download all five parts into one folder, then join them:

**macOS / Linux**

```sh
cat bones_1080p30.mp4.part0 bones_1080p30.mp4.part1 bones_1080p30.mp4.part2 bones_1080p30.mp4.part3 bones_1080p30.mp4.part4 > bones_1080p30.mp4
```

**Windows (Command Prompt)**

```bat
copy /b bones_1080p30.mp4.part0 + bones_1080p30.mp4.part1 + bones_1080p30.mp4.part2 + bones_1080p30.mp4.part3 + bones_1080p30.mp4.part4 bones_1080p30.mp4
```

Check the result (optional) — the SHA-256 must be
`6c57497ae7a269fcb83ca6996c721a4643be6c80083638d475178fdb24cf9e31`:

```sh
shasum -a 256 bones_1080p30.mp4        # macOS (Linux: sha256sum bones_1080p30.mp4)
```
