"""Piano note onsets (the 'other' stem: in this song the piano owns it until the strings come in) with the
loudest pitch at each onset (CQT peak, MIDI) -> merged into data/audio.json as onsets.piano = [[t, strength, midi]].
Run:  python piano.py STEMS_DIR AUDIO_JSON"""
import json, sys
import numpy as np, librosa, soundfile as sf
STEMS, OUT = sys.argv[1:3]
y, sr = sf.read(f"{STEMS}/other.wav", dtype="float32", always_2d=True)
y = y.mean(axis=1)
hop = 441
env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
on = librosa.onset.onset_detect(onset_envelope=env, sr=sr, hop_length=hop, backtrack=False, delta=0.12, wait=8)
C = np.abs(librosa.cqt(y, sr=sr, hop_length=hop, fmin=librosa.note_to_hz('A1'), n_bins=72))
ref = np.percentile(env[on], 95) if len(on) else 1
out = []
for f in on:
    seg = C[:, f + 2: f + 8].mean(axis=1)
    m = int(np.argmax(seg)) + librosa.note_to_midi('A1')
    out.append([round(f * hop / sr, 3), round(float(min(1, env[f] / ref)), 3), m])
a = json.load(open(OUT))
a["onsets"]["piano"] = out
json.dump(a, open(OUT, "w"))
print(len(out), "piano onsets;", [o for o in out if o[0] < 12])
