# Bones — the render

`bones_1080p30.mp4` (1920×1080, 30 fps, 3:19, H.264 + AAC, 412 MB) split into five pieces, because GitHub caps
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
`deb5c0113d7c8b102c7335a078e2845b8959ba3d88b3baae46cef0dc993bf465`:

```sh
shasum -a 256 bones_1080p30.mp4        # macOS (Linux: sha256sum bones_1080p30.mp4)
```
