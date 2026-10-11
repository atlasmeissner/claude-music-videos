#!/bin/sh
# Join the plate segments (out/seg/*.mp4, in timeline order) and mux the song: out/free-fall.mp4.
# The segments are cheap intermediates (x264 ultrafast, CRF 14); the join re-encodes once at a delivery bitrate.
cd "$(dirname "$0")/../.." || exit 1
LIST=out/seg/list.txt
: > $LIST
for id in edge ledger cliff payoff hook1 fly1 vacuum letter door hook2 fly2 chant bridge hook3 final hook4 outro; do
  echo "file '$(pwd)/out/seg/$id.mp4'" >> $LIST
done
ffmpeg -v error -y -f concat -safe 0 -i $LIST -i audio/free_fall.mp3 -map 0:v -map 1:a \
  -c:v libx264 -preset medium -crf 19 -tune grain -pix_fmt yuv420p \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
  -c:a aac -b:a 256k -shortest -movflags +faststart out/free-fall.mp4
ls -la out/free-fall.mp4
