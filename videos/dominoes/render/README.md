# Dominoes — the render

`dominoes_1080p30.mp4` (1920×1080, 30 fps, 3:07, H.264 + AAC, 133 MB) split into two pieces, because GitHub caps
files at 100 MB. Download both parts into one folder, then join them:

**macOS / Linux**

```sh
cat dominoes_1080p30.mp4.part0 dominoes_1080p30.mp4.part1 > dominoes_1080p30.mp4
```

**Windows (Command Prompt)**

```bat
copy /b dominoes_1080p30.mp4.part0 + dominoes_1080p30.mp4.part1 dominoes_1080p30.mp4
```

Check the result (optional) — the SHA-256 must be
`65064ab015bc4f3c71a65d6ec54d9d0228b39b6f96ce36117200e412de1e23ee`:

```sh
shasum -a 256 dominoes_1080p30.mp4        # macOS (Linux: sha256sum dominoes_1080p30.mp4)
```
