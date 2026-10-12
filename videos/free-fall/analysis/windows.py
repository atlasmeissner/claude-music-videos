"""Plate windows (same rule as app/src/timeline.ts › bounds) -> out/windows.json, for segment renders.
Run from the video folder:  python3 analysis/windows.py
"""
import json, math, bisect, os
ly = json.load(open('data/lyrics.json')); au = json.load(open('data/audio.json'))
b = au['beats']
def beatAt(t):
    i = max(0, bisect.bisect_right(b, t) - 1)
    return i + (t - b[i]) / (b[i + 1] - b[i])
def cut(i, tol=0.05):
    s = ly['lines'][i]['words'][0]['start']
    return b[math.floor(beatAt(s + tol))]
sec = {s['name']: s['start'] for s in au['sections']}
names = ['ledge', 'measure', 'reveal', 'runup', 'dream1', 'wake', 'message', 'doorway', 'dream2', 'crowd', 'decide', 'jump', 'through']
st = [0, cut(0), cut(2), cut(4), cut(6), cut(10), cut(11), cut(15), cut(17), sec['chant'], cut(22), cut(26), sec['tail2'], au['duration']]
os.makedirs('out', exist_ok=True)
json.dump({n: [st[i], st[i + 1]] for i, n in enumerate(names)}, open('out/windows.json', 'w'), indent=1)
for i, n in enumerate(names): print(f"{n:8s} {st[i]:7.2f} {st[i+1]:7.2f}  {st[i+1]-st[i]:5.2f}s")
