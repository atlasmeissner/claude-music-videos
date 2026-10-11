"""Print a vocal-activity map (10 ms RMS, onsets) with the beat grid for a time range: QA for alignment."""
from pathlib import Path
DATA = Path(__file__).resolve().parent.parent / "data"
import sys, json, numpy as np, soundfile as sf
from scipy.ndimage import uniform_filter1d
A = sys.argv[1]; t0, t1 = float(sys.argv[2]), float(sys.argv[3])
y, sr = sf.read(f"{A}/work/vocals16.wav", dtype="float32")
au = json.load(open(str(DATA / "audio.json")))
beats = np.array(au["beats"]); per = 60 / au["bpm"]; db = set(np.round(au["downbeats"], 3))
hop = 160
r = np.array([np.sqrt(np.mean(y[i*hop:(i+1)*hop]**2)) for i in range(len(y)//hop)])
r = uniform_filter1d(r, 3); ref = np.percentile(r, 98)
# print per 1/4 beat (sixteenth) a bar of level
step = per / 4
t = beats[np.searchsorted(beats, t0)] - per
while t < t1:
    i = int(t * 100); j = int((t + step) * 100)
    lv = r[i:j].mean() / ref
    bi = (t - beats[0]) / per
    mark = ""
    if abs(bi - round(bi)) < 0.01:
        b = beats[int(round(bi))]
        mark = "DOWN" if round(b, 3) in db else "beat"
    print(f"{t:7.2f} {mark:4s} {'#' * int(min(1.5, lv) * 40)}")
    t += step
