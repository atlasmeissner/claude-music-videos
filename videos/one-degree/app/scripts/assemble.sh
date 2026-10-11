#!/bin/sh
# Join the plate segments (out/seg/*.mp4, in timeline order) and mux the song: out/one-degree.mp4.
# The segments are cheap intermediates (x264 ultrafast/veryfast, CRF 14–17); the join re-encodes once at a
# delivery bitrate.
cd "$(dirname "$0")/../.." || exit 1
LIST=out/seg/list.txt
: > $LIST
for id in dawn ground days river hook globe pages night snow course whoa quiet sunrise corona coda outro; do
  echo "file '$(pwd)/out/seg/$id.mp4'" >> $LIST
done
ffmpeg -v error -y -f concat -safe 0 -i $LIST -i audio/one_degree.mp3 -map 0:v -map 1:a \
  -c:v libx264 -preset medium -crf 19 -tune grain -pix_fmt yuv420p \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
  -c:a aac -b:a 256k -shortest -movflags +faststart out/one-degree.mp4
ls -la out/one-degree.mp4
