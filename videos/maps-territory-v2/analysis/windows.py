"""Part windows (same rule as app/src/timeline.ts › bounds) -> out/windows.json, for segment renders.
Run from the video folder: python3 analysis/windows.py"""
import json, os
au = json.load(open('data/audio.json'))
sec = {s['name']: s['start'] for s in au['sections']}
names = ['verse1', 'pre1', 'chorus1', 'verse2', 'pre2', 'chorus2', 'bridge', 'final', 'inst', 'final2', 'outro']
st = [0, au['downbeats'][19]] + [sec[n] for n in names] + [au['duration']]
os.makedirs('out', exist_ok=True)
w = {f"p{i + 1:02d}": [round(st[i], 4), round(st[i + 1], 4)] for i in range(len(st) - 1)}
json.dump(w, open('out/windows.json', 'w'), indent=1)
for n, (a, e) in w.items(): print(f"{n:4s} {a:7.2f} {e:7.2f}  {e - a:5.2f}s")
