"""Audio analysis for the Dominoes video.

Produces data/audio.json: tempo, beat grid, downbeats, onsets (full mix and
the accompaniment stem), and loudness envelopes sampled at 60 Hz.

    uv run python analyze.py ../audio/dominoes.mp3 [--stems ../../work/stems/htdemucs/dominoes]
"""
import argparse
import json
from pathlib import Path

import librosa
import numpy as np

SR = 22050
HOP = 256
ENV_HZ = 60


def onset_times(y, sr, delta=0.08):
    env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=HOP, aggregate=np.median)
    on = librosa.onset.onset_detect(
        onset_envelope=env, sr=sr, hop_length=HOP, backtrack=False, delta=delta, units="frames"
    )
    strength = env[on] / (env.max() + 1e-9)
    t = librosa.frames_to_time(on, sr=sr, hop_length=HOP)
    return [[round(float(a), 3), round(float(b), 3)] for a, b in zip(t, strength)]


def envelope(y, sr, duration):
    frame = int(sr / ENV_HZ)
    n = int(np.ceil(duration * ENV_HZ))
    rms = np.zeros(n)
    for i in range(n):
        seg = y[i * frame:(i + 1) * frame]
        if len(seg):
            rms[i] = np.sqrt(np.mean(seg ** 2))
    db = 20 * np.log10(rms + 1e-6)
    lo, hi = np.percentile(db, 5), np.percentile(db, 99.5)
    norm = np.clip((db - lo) / (hi - lo), 0, 1)
    return [round(float(v), 3) for v in norm]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("audio")
    ap.add_argument("--stems", default=None)
    ap.add_argument("--out", default="../data/audio.json")
    ap.add_argument("--lyrics", default="../data/lyrics.json")
    ap.add_argument("--phase", type=int, default=None)
    a = ap.parse_args()

    y, sr = librosa.load(a.audio, sr=SR, mono=True)
    duration = len(y) / sr

    # Tracked beats (dynamic programming, very tight: the song is at a near-constant tempo),
    # extended back to 0 with the median period. A straight-line fit through them is not used:
    # the tempo is not exactly constant, and a fitted grid drifts by up to ~0.15 s.
    oenv = librosa.onset.onset_strength(y=y, sr=sr, hop_length=HOP)
    tempo, beat_t = librosa.beat.beat_track(onset_envelope=oenv, sr=sr, hop_length=HOP,
                                            tightness=1600, units="time")
    tempo = float(np.atleast_1d(tempo)[0])
    period = float(np.median(np.diff(beat_t)))
    pre = []
    t = beat_t[0] - period
    while t >= 0:
        pre.insert(0, t)
        t -= period
    post = []
    t = beat_t[-1] + period
    while t < duration:
        post.append(t)
        t += period
    grid = np.concatenate([pre, beat_t, post])

    # Downbeat phase: the sung lines start on the first beat of a bar (verses: every 8 beats).
    # `--phase` overrides; the default comes from lyric line starts when data/lyrics.json exists.
    ph = a.phase
    scores = []
    lyr = Path(a.lyrics)
    if ph is None and lyr.exists():
        starts = [l["start"] for l in json.loads(lyr.read_text())["lines"]]
        scores = [0, 0, 0, 0]
        for s0 in starts:
            j = int(np.argmin(np.abs(grid - s0)))
            if abs(grid[j] - s0) < 0.2:
                scores[j % 4] += 1
        ph = int(np.argmax(scores))
    if ph is None:
        ph = 0
    downbeats = grid[ph::4]

    out = {
        "duration": round(duration, 3),
        "bpm": round(60.0 / period, 3),
        "librosa_bpm": round(tempo, 3),
        "beat_period": round(float(period), 5),
        "time_signature": 4,
        "downbeat_phase": ph,
        "downbeat_votes": scores,
        "beats": [round(float(b), 3) for b in grid],
        "downbeats": [round(float(b), 3) for b in downbeats],
        "onsets": onset_times(y, sr),
        "perc_onsets": onset_times(librosa.effects.hpss(y)[1], sr, delta=0.1),
        "env_hz": ENV_HZ,
        "loud": envelope(y, sr, duration),
    }

    if a.stems:
        sd = Path(a.stems)
        voc, _ = librosa.load(sd / "vocals.wav", sr=SR, mono=True)
        acc, _ = librosa.load(sd / "no_vocals.wav", sr=SR, mono=True)
        out["vocal_loud"] = envelope(voc, sr, duration)
        out["acc_loud"] = envelope(acc, sr, duration)
        out["acc_onsets"] = onset_times(acc, sr, delta=0.07)
        # high band of the accompaniment: xylophone / staccato strings
        acc_h = librosa.effects.preemphasis(acc, coef=0.97)
        out["hi_onsets"] = onset_times(acc_h, sr, delta=0.1)

    Path(a.out).write_text(json.dumps(out, separators=(",", ":")))
    print("duration", out["duration"], "bpm", out["bpm"], "librosa", tempo, "phase", ph, scores)
    print("beats", len(grid), "onsets", len(out["onsets"]))


if __name__ == "__main__":
    main()
