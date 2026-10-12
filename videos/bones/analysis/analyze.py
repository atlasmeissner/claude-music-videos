"""Music analysis -> data/audio.json

  * constant-tempo beat grid (tempo + phase fitted to the onset strength of the mix and the drum stem),
    downbeats (bar phase that best lines up kick/low-end energy and lyric line starts),
  * 100 fps normalized envelopes (mix rms / low / mid / high, stem rms),
  * kick / snare / hat onsets from the drums stem, vocal note onsets from the vocal stem,
  * sections from the lyric structure (data/lyrics.json must exist: run align.py first).

Stems: Demucs htdemucs run on the gapless ffmpeg decode of the mp3 (so they share its timeline).
Run:  python analyze.py STEMS_DIR MIX_WAV OUT_JSON LYRICS_JSON
"""
import json
import sys

import librosa
import numpy as np
import soundfile as sf
from scipy.ndimage import maximum_filter1d, uniform_filter1d
from scipy.signal import butter, find_peaks, sosfiltfilt

SR = 44100
FPS = 100
STEMS, MIX, OUT, LYR = sys.argv[1:5]


def load(path):
    y, s = sf.read(path, dtype="float32", always_2d=True)
    assert s == SR, s
    return y.mean(axis=1)


def band(x, lo=None, hi=None):
    if lo and hi:
        sos = butter(4, [lo, hi], btype="band", fs=SR, output="sos")
    elif hi:
        sos = butter(4, hi, btype="low", fs=SR, output="sos")
    else:
        sos = butter(4, lo, btype="high", fs=SR, output="sos")
    return sosfiltfilt(sos, x)


def frame_rms(x, win=2048):
    hop = SR // FPS
    n = len(x) // hop + 1
    xp = np.pad(x, (win // 2, win // 2))
    out = np.empty(n, np.float32)
    for i in range(n):
        seg = xp[i * hop: i * hop + win]
        out[i] = np.sqrt(np.mean(seg * seg) + 1e-12)
    return out


def norm_env(e, pct=98.5, smooth=3):
    e = uniform_filter1d(e, smooth)
    ref = np.percentile(e, pct) + 1e-9
    return np.clip(e / ref, 0, 1)


mix = load(MIX)
dur = len(mix) / SR
stems = {k: load(f"{STEMS}/{k}.wav") for k in ("vocals", "drums", "bass", "other")}

# ------------------------------------------------------------------ envelopes
feat = {
    "rms": norm_env(frame_rms(mix)),
    "low": norm_env(frame_rms(band(mix, hi=180))),
    "mid": norm_env(frame_rms(band(mix, 300, 3000))),
    "high": norm_env(frame_rms(band(mix, lo=5000))),
}
for k, v in stems.items():
    feat["vocal" if k == "vocals" else k] = norm_env(frame_rms(v))
n = min(len(v) for v in feat.values())
feat = {k: [round(float(x), 3) for x in v[:n]] for k, v in feat.items()}


# ------------------------------------------------------------------ onsets
def onset_env(x, lo=None, hi=None):
    y = band(x, lo, hi) if (lo or hi) else x
    hop = SR // FPS
    S = np.abs(librosa.stft(y, n_fft=2048, hop_length=hop, center=True))
    S = np.log1p(100 * S)
    d = np.maximum(0, np.diff(S, axis=1, prepend=S[:, :1])).sum(axis=0)
    return d / (np.percentile(d, 99.5) + 1e-9)


def pick(env, thr, min_gap):
    pk, props = find_peaks(env, height=thr, distance=max(1, int(min_gap * FPS)))
    h = props["peak_heights"]
    h = np.clip(h / (np.percentile(h, 95) + 1e-9), 0, 1) if len(h) else h
    return [[round(p / FPS, 3), round(float(s), 3)] for p, s in zip(pk, h)]


dr = stems["drums"]
kick_env = onset_env(dr, hi=150)
snare_env = onset_env(dr, 180, 3500)
hat_env = onset_env(dr, lo=7000)
voc_env = onset_env(stems["vocals"], 150, 5000)
drum_level = np.array(feat["drums"])
onsets = {
    "kick": pick(kick_env * (drum_level[: len(kick_env)] > 0.08), 0.35, 0.18) if len(kick_env) <= len(drum_level) else pick(kick_env, 0.35, 0.18),
    "snare": pick(snare_env, 0.4, 0.18),
    "hat": pick(hat_env, 0.35, 0.09),
    "vocal": pick(voc_env * (np.array(feat["vocal"][: len(voc_env)]) > 0.1) if len(voc_env) <= len(feat["vocal"]) else voc_env, 0.3, 0.15),
}

# ------------------------------------------------------------------ tempo + constant grid
oenv = librosa.onset.onset_strength(y=mix, sr=SR, hop_length=SR // FPS)
oenv2 = np.zeros_like(oenv)
m = min(len(oenv), len(kick_env))
oenv2[:m] = oenv[:m] / (oenv.max() + 1e-9) + 0.8 * kick_env[:m] + 0.5 * snare_env[:m]
tempo, _ = librosa.beat.beat_track(onset_envelope=oenv2, sr=SR, hop_length=SR // FPS)
bpm0 = float(np.atleast_1d(tempo)[0])


def grid_score(bpm, phase):
    per = 60 / bpm
    ts = np.arange(phase, dur, per)
    idx = np.clip(np.round(ts * FPS).astype(int), 0, len(oenv2) - 1)
    pk = maximum_filter1d(oenv2, 5)
    return pk[idx].mean()


best = (-1, bpm0, 0)
for bpm in np.arange(bpm0 - 1.5, bpm0 + 1.5, 0.01):
    per = 60 / bpm
    for ph in np.arange(0, per, 0.005):
        s = grid_score(bpm, ph)
        if s > best[0]:
            best = (s, bpm, ph)
_, bpm, phase = best
per = 60 / bpm
beats = np.arange(phase, dur, per)
print(f"tempo {bpm0:.2f} -> {bpm:.3f} BPM, phase {phase:.3f}s, {len(beats)} beats")

# ------------------------------------------------------------------ downbeats
lyr = json.load(open(LYR))
line_starts = [l["words"][0]["start"] for l in lyr["lines"]]
low = np.array(feat["low"])
scores = []
for k in range(4):
    db = beats[k::4]
    idx = np.clip(np.round(db * FPS).astype(int), 0, len(kick_env) - 1)
    s_kick = kick_env[idx].mean() + 0.5 * low[np.clip(idx + 3, 0, len(low) - 1)].mean()
    # line starts close (within half a beat, before or on) to a downbeat
    s_lyr = np.mean([np.min(np.abs(db - t)) < per * 0.6 for t in line_starts])
    scores.append(s_kick + s_lyr)
    print(f"downbeat phase {k}: kick {s_kick:.3f} lyric {s_lyr:.2f}")
k = int(np.argmax(scores))
downbeats = beats[k::4]
print("downbeat phase", k)

# ------------------------------------------------------------------ sections (from the lyric structure)
def bar_of(t):
    return int(np.searchsorted(downbeats, t + per * 0.6) - 1)

# Sections, anchored to lyric lines (index into data/lyrics.json): ("name", line, "start"|"end").
# "start": the downbeat of the bar the line's first word falls in (a short pickup stays in the previous
# section); "end": the first downbeat after the line's last word ends.
SECTIONS = [
    ("verse1", 0, "start"), ("pre1", 4, "start"), ("chorus1", 6, "start"), ("break1", 9, "end"),
    ("verse2", 10, "start"), ("pre2", 14, "start"), ("chorus2", 16, "start"), ("chorus3", 20, "start"),
    ("bridge", 24, "start"), ("final", 26, "start"), ("tag", 30, "start"), ("choir", 30, "end"),
    ("outro", 31, "end"),
]
L = lyr["lines"]
starts = []
for nm, li, kind in SECTIONS:
    if kind == "start":
        b = bar_of(L[li]["words"][0]["start"])
    else:
        b = int(np.searchsorted(downbeats, L[li]["end"] - 0.05))
        b = min(b, len(downbeats) - 1)
    starts.append((nm, float(downbeats[max(0, b)])))
sections = [{"name": "intro", "start": 0.0, "end": starts[0][1]}]
for i, (nm, st) in enumerate(starts):
    en = starts[i + 1][1] if i + 1 < len(starts) else dur
    sections.append({"name": nm, "start": st, "end": en})
for s_ in sections:
    print(f"  {s_['name']:8s} {s_['start']:7.2f} {s_['end']:7.2f}")

json.dump({
    "duration": round(dur, 3), "bpm": round(bpm, 3), "fps": FPS,
    "beats": [round(float(b), 3) for b in beats], "downbeats": [round(float(b), 3) for b in downbeats],
    "sections": sections, "features": feat, "onsets": onsets,
}, open(OUT, "w"))
print("wrote", OUT, {k: len(v) for k, v in onsets.items()})
