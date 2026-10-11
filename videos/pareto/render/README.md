# Pareto — the render

`pareto_1080p30.mp4` (1920×1080, 30 fps, 4:58, H.264 + AAC, 222 MB) split into three pieces, because GitHub caps
files at 100 MB. Download all three parts into one folder, then join them:

**macOS / Linux**

```sh
cat pareto_1080p30.mp4.part0 pareto_1080p30.mp4.part1 pareto_1080p30.mp4.part2 > pareto_1080p30.mp4
```

**Windows (Command Prompt)**

```bat
copy /b pareto_1080p30.mp4.part0 + pareto_1080p30.mp4.part1 + pareto_1080p30.mp4.part2 pareto_1080p30.mp4
```

Check the result (optional) — the SHA-256 must be
`69039c6b6154312f5fe1c354c0b17761e15e4fa9079b88edc2af528599f62eb5`:

```sh
shasum -a 256 pareto_1080p30.mp4        # macOS (Linux: sha256sum pareto_1080p30.mp4)
```
