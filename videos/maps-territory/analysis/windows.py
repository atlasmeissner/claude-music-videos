"""Plate windows (same rule as app/src/timeline.ts › bounds) -> out/windows.json, for segment renders.
Run from the video folder: python3 analysis/windows.py"""
import json, math, bisect, os
ly = json.load(open('data/lyrics.json')); au = json.load(open('data/audio.json'))
b = au['beats']; db = au['downbeats']
def beatAt(t):
    i = bisect.bisect_right(b, t) - 1
    return i + (t - b[i]) / (b[i + 1] - b[i])
def cut(i):
    return b[math.floor(beatAt(ly['lines'][i]['words'][0]['start'] + 0.02))]
sec = {s['name']: s['start'] for s in au['sections']}
names = ['horn', 'vista', 'korzybski', 'sheet', 'drew', 'ground', 'chorus1', 'tracing', 'detour', 'fits', 'chorus2',
         'compass', 'bridge', 'chorus3', 'beyond', 'journey', 'dawn', 'chorus4', 'found', 'return', 'coda']
st = [0, db[8], db[19], db[27], sec['verse1'], sec['pre1'], cut(6), cut(8), sec['verse2'], cut(14), cut(16), cut(18),
      sec['bridge'], cut(23), cut(25), sec['inst'], db[130], cut(27), cut(29), sec['outro'], db[170], au['duration']]
os.makedirs('out', exist_ok=True)
w = {n: [round(st[i], 4), round(st[i + 1], 4)] for i, n in enumerate(names)}
json.dump(w, open('out/windows.json', 'w'), indent=1)
for n, (a, e) in w.items(): print(f"{n:10s} {a:7.2f} {e:7.2f}  {e - a:5.2f}s")
