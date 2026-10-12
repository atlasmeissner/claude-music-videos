"""Segment the vocal stem into sung notes (pYIN pitch + onset), for checking word starts.

    uv run python notes.py VOCALS.wav T0 T1
"""
import sys

import librosa
import numpy as np

path, t0, t1 = sys.argv[1], float(sys.argv[2]), float(sys.argv[3])
y, sr = librosa.load(path, sr=22050, mono=True, offset=t0, duration=t1 - t0)
hop = 128
f0, voiced, prob = librosa.pyin(y, fmin=80, fmax=900, sr=sr, frame_length=1024, hop_length=hop)
rms = librosa.feature.rms(y=y, frame_length=1024, hop_length=hop)[0]
on = librosa.onset.onset_detect(y=y, sr=sr, hop_length=hop, units='time', delta=0.04, backtrack=True)
ts = librosa.frames_to_time(np.arange(len(f0)), sr=sr, hop_length=hop) + t0
midi = librosa.hz_to_midi(f0)
# notes: voiced runs, split where pitch jumps by > 0.7 semitone or at an onset
notes = []
cur = None
onset_set = set(np.round(on + t0, 2))
for i, t in enumerate(ts):
    v = voiced[i] and rms[i] > 0.02
    if not v:
        if cur: notes.append(cur); cur = None
        continue
    m = midi[i]
    if cur and (abs(m - np.median(cur['m'][-6:])) > 0.7 or any(abs(t - o) < hop / sr for o in onset_set)) and t - cur['t0'] > 0.06:
        notes.append(cur); cur = None
    if not cur:
        cur = {'t0': t, 'm': []}
    cur['m'].append(m); cur['t1'] = t
if cur: notes.append(cur)
for n in notes:
    if n['t1'] - n['t0'] < 0.05: continue
    name = librosa.midi_to_note(np.median(n['m']))
    print(f"{n['t0']:7.2f} - {n['t1']:7.2f}  {name:4}  {'=' * int((n['t1'] - n['t0']) * 40)}")
print('onsets', ' '.join(f'{o + t0:.2f}' for o in on))
