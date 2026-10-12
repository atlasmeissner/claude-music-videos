"""Compact vocal map: one row per bar, 16 sixteenth cells (0-9 level), with CTC word starts marked below."""
from pathlib import Path
DATA = Path(__file__).resolve().parent.parent / "data"
import sys, json, numpy as np, soundfile as sf
from scipy.ndimage import uniform_filter1d
A = sys.argv[1]; t0, t1 = float(sys.argv[2]), float(sys.argv[3])
y, sr = sf.read(f"{A}/work/vocals16.wav", dtype="float32")
au = json.load(open(str(DATA / "audio.json")))
ly = json.load(open(str(DATA / "lyrics.json")))
words = [(w["start"], w["w"]) for l in ly["lines"] for w in l["words"]]
per = 60 / au["bpm"]; dbs = np.array(au["downbeats"])
hop = 160
r = np.array([np.sqrt(np.mean(y[i*hop:(i+1)*hop]**2)) for i in range(len(y)//hop)])
r = uniform_filter1d(r, 3); ref = np.percentile(r, 98)
for d in dbs:
    if d + 4 * per < t0 or d > t1: continue
    cells = ""; labels = []
    for k in range(16):
        a = d + k * per / 4; b = a + per / 4
        lv = r[int(a*100):int(b*100)].mean() / ref
        cells += str(min(9, int(lv * 10)))
        for ws, w in words:
            if a <= ws < b: labels.append(f"{k}:{w}@{ws:.2f}")
    print(f"{d:7.2f} |{cells[:4]} {cells[4:8]} {cells[8:12]} {cells[12:]}| " + " ".join(labels))
