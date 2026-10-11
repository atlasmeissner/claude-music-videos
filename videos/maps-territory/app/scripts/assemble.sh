#!/bin/sh
# Join the plate segments (out/seg/*.mp4, in timeline order) and mux the song: out/maps-territory.mp4.
# The segments are cheap intermediates (x264 ultrafast, CRF 14); the join re-encodes once at a delivery bitrate.
cd "$(dirname "$0")/../.." || exit 1
LIST=out/seg/list.txt
: > $LIST
for id in horn vista korzybski sheet drew ground chorus1 tracing detour fits chorus2 compass bridge chorus3 beyond \
          journey dawn chorus4 found return coda; do
  echo "file '$(pwd)/out/seg/$id.mp4'" >> $LIST
done
ffmpeg -v error -y -f concat -safe 0 -i $LIST -i audio/maps_territory.mp3 -map 0:v -map 1:a \
  -c:v libx264 -preset medium -crf 20 -tune grain -pix_fmt yuv420p \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
  -c:a aac -b:a 256k -shortest -movflags +faststart out/maps-territory.mp4
ls -la out/maps-territory.mp4
