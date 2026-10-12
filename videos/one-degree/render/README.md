# One Degree — the render

`one-degree_1080p30.mp4` (1920×1080, 30 fps, 3:39, H.264 + AAC, 422 MB) split into five pieces, because GitHub caps
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
`a6a2f45cc7b274d08e3a446d4c194d8dc902016fe2282004b8ab00099639bf9c`:

```sh
shasum -a 256 one-degree_1080p30.mp4        # macOS (Linux: sha256sum one-degree_1080p30.mp4)
```
