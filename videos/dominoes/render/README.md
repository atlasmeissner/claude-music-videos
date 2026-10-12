# Dominoes — the render

`dominoes_1080p30.mp4` (1920×1080, 30 fps, 3:07, H.264 + AAC, 134 MB) split into two pieces, because GitHub caps
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
`9bd628332303c7a8a3092ea5ea6817853756bce99464fd48123ac967898b4db4`:

```sh
shasum -a 256 dominoes_1080p30.mp4        # macOS (Linux: sha256sum dominoes_1080p30.mp4)
```
