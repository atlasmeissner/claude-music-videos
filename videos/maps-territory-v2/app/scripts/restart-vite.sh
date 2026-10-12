#!/bin/sh
# (re)start the no-HMR dev server the render script uses (needed after adding a scene file: the timeline's
# import.meta.glob is resolved when the module is first transformed)
PIDF=/tmp/mt-vite.pid
if [ -f $PIDF ]; then kill $(cat $PIDF) 2>/dev/null; fi
for p in $(pgrep -f "vite --port 5173 --strictPort"); do
  [ "$p" != "$$" ] && kill $p 2>/dev/null
done
sleep 0.5
cd "$(dirname "$0")/.." || exit 1
PDOOM_NO_HMR=1 nohup bunx vite --port 5173 --strictPort > /tmp/vite.log 2>&1 &
echo $! > $PIDF
sleep 2
