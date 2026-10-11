#!/bin/sh
# Render plates as separate video segments (no audio) into out/seg/<id>.mp4, one after another.
# usage: scripts/segments.sh id1 id2 ...   (windows from out/windows.json, see analysis/windows.py)
cd "$(dirname "$0")/.." || exit 1
mkdir -p ../out/seg
for id in "$@"; do
  from=$(python3 -c "import json;print(json.load(open('../out/windows.json'))['$id'][0])")
  to=$(python3 -c "import json;print(json.load(open('../out/windows.json'))['$id'][1])")
  echo "[$(date +%H:%M:%S)] $id $from -> $to"
  bun scripts/render.ts video --from "$from" --to "$to" --fps 30 --workers 1 --preset ultrafast --crf 14 --noaudio --out "../out/seg/$id.mp4" 2>&1 | grep -a -v "useProgram\|404" | tail -2
done
echo "[$(date +%H:%M:%S)] done: $*"
