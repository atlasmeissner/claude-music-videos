#!/bin/bash
# Render the whole video in 20 s segments (software GL), then join and encode with the audio.
cd "$(dirname "$0")/.."   # app/
mkdir -p ../out/seg
# software GL (no GPU): Chromium + SwiftShader, synchronous readback
export CHROME_PATH=${CHROME_PATH:-/opt/pw-browsers/chromium} CHROME_ANGLE=${CHROME_ANGLE:-swiftshader} SYNC_READ=1
DUR=244.04
FPS=30
for s in $(seq 0 20 240); do
  e=$(python3 -c "print(min($s+20, $DUR))")
  f=../out/seg/seg_$(printf %03d $s).mp4
  [ -s "$f" ] && continue
  for try in 1 2 3; do
    echo "$(date +%T) segment $s-$e try $try"
    timeout 7200 bun scripts/render.ts video --from $s --to $e --fps $FPS --workers 1 --preset ultrafast --tune none --crf 12 --noaudio --out $f.tmp.mp4 2>&1 | strings | grep -v 404 | tail -3
    if [ -s $f.tmp.mp4 ]; then mv $f.tmp.mp4 $f; break; fi
  done
done
echo "$(date +%T) all segments done"
ls ../out/seg/*.mp4 | sed "s#^#file '#; s#\$#'#" > ../out/seg/list.txt
ffmpeg -y -loglevel error -f concat -safe 0 -i ../out/seg/list.txt -i ../audio/other-side-of-light.mp3 \
  -map 0:v -map 1:a -c:v libx264 -preset slow -crf 18 -tune grain -pix_fmt yuv420p \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 -af apad -c:a aac -b:a 320k -shortest -movflags +faststart \
  ../out/the-other-side-of-light.mp4
echo "$(date +%T) FINAL DONE"
