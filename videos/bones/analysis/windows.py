"""Plate windows (same rule as app/src/timeline.ts › plateWindows) -> out/windows.json, for segment renders.
Run from the video folder:  python3 analysis/windows.py"""
import json, math, bisect, os
ly = json.load(open('data/lyrics.json')); au = json.load(open('data/audio.json'))
b = au['beats']
def beatAt(t):
    i = bisect.bisect_right(b, t) - 1
    return i + (t - b[i]) / (b[i + 1] - b[i])
def cut(i):
    s = ly['lines'][i]['words'][0]['start']
    return b[math.floor(beatAt(s + 0.02))]
sec = {s['name']: s['start'] for s in au['sections']}
db = lambda t: min(au['downbeats'], key=lambda d: abs(d - t))
names = ['note', 'facade', 'edges', 'carry', 'strip', 'shown', 'xray', 'maps', 'burn', 'ground', 'orders',
         'build', 'wreckage', 'cathedral', 'vault', 'asbuilt', 'outro']
st = [0, cut(0), cut(2), cut(4), cut(6), cut(8), sec['break1'], cut(10), cut(12), cut(14), cut(16),
      cut(20), sec['bridge'], cut(26), sec['tag'], db(176.4), cut(31), au['duration']]
os.makedirs('out', exist_ok=True)
json.dump({n: [st[i], st[i + 1]] for i, n in enumerate(names)}, open('out/windows.json', 'w'), indent=1)
for n in names: print(f"{n:10s} {st[names.index(n)]:7.2f} {st[names.index(n)+1]:7.2f}  ({st[names.index(n)+1]-st[names.index(n)]:5.2f}s)")
