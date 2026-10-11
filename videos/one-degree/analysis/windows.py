"""Plate windows (same rule as app/src/timeline.ts) -> out/windows.json, for segment renders."""
import json, math, bisect, os
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))  # paths relative to the video folder
ly = json.load(open('data/lyrics.json')); au = json.load(open('data/audio.json'))
b = au['beats']
def beatAt(t):
    i = bisect.bisect_right(b, t) - 1
    return i + (t - b[i]) / (b[i + 1] - b[i])
def cut(i):
    s = ly['lines'][i]['words'][0]['start']
    return b[math.floor(beatAt(s + 0.02))]
sec = {s['name']: s['start'] for s in au['sections']}
names = ['dawn','ground','days','river','hook','curve','pages','night','snow','course','whoa','quiet','different','sunflower','coda','outro']
st = [0, cut(0), cut(2), cut(4), cut(6), cut(8), cut(10), cut(12), cut(14), cut(16), cut(20), cut(23), cut(26), sec['tag'], cut(32), sec['outro'], au['duration']]
json.dump({n: [st[i], st[i + 1]] for i, n in enumerate(names)}, open('out/windows.json', 'w'), indent=1)
print(open('out/windows.json').read())
