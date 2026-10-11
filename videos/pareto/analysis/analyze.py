"""Music analysis -> data/audio.json (beats, downbeats, sections, envelopes, onsets).

Format matches the engine's AudioData (see app/src/engine/audio.ts):
  envelopes at 100 fps, each divided by its 99th percentile and clipped 0..1,
  one-pole smoothed (10 ms attack / 90 ms release);
  onsets {kick|snare|hat|vocal|guitar: [[t, strength], ...]} from the stems.
Run after align.py (sections use the aligned lyric lines).
"""
import common, json, sys
import numpy as np, librosa, scipy.signal as sg

FPS = 100
SR = 22050
HOP = SR // FPS  # 220.5 -> use 221 and resample time axis
y_mix, _ = librosa.load(str(common.AUDIO), sr=SR, mono=True)
dur = len(y_mix) / SR
N = int(np.ceil(dur * FPS))
stems = {k: common.load_stem(k, sr=SR)[0] for k in ("vocals", "drums", "bass", "other")}


def env_rms(y, win=0.046):
    w = int(win * SR)
    pad = np.pad(y, (w // 2, w // 2))
    c = np.cumsum(np.concatenate([[0], pad ** 2]))
    centers = (np.arange(N) / FPS * SR).astype(int)
    centers = np.clip(centers, 0, len(y) - 1)
    e = np.sqrt(np.maximum(0, (c[centers + w] - c[centers]) / w))
    return e


def smooth(e, att=0.010, rel=0.090):
    a1, r1 = np.exp(-1 / (att * FPS)), np.exp(-1 / (rel * FPS))
    o = np.zeros_like(e); v = 0.0
    for i, x in enumerate(e):
        k = a1 if x > v else r1
        v = k * v + (1 - k) * x
        o[i] = v
    return o


def norm(e):
    p = np.percentile(e, 99) + 1e-9
    return np.clip(e / p, 0, 1)


def band(y, lo, hi):
    if lo is None:
        b = sg.butter(4, hi, "low", fs=SR, output="sos")
    elif hi is None:
        b = sg.butter(4, lo, "high", fs=SR, output="sos")
    else:
        b = sg.butter(4, [lo, hi], "band", fs=SR, output="sos")
    return sg.sosfiltfilt(b, y)


feat = {
    "rms": env_rms(y_mix), "low": env_rms(band(y_mix, None, 150)), "mid": env_rms(band(y_mix, 150, 2000)),
    "high": env_rms(band(y_mix, 4000, None)),
    "vocal": env_rms(stems["vocals"]), "drums": env_rms(stems["drums"]), "bass": env_rms(stems["bass"]), "other": env_rms(stems["other"]),
}
feat = {k: [round(float(x), 3) for x in norm(smooth(v))] for k, v in feat.items()}

# ---------------------------------------------------------------- beats
oenv = librosa.onset.onset_strength(y=stems["drums"] + 0.5 * y_mix, sr=SR, hop_length=256)
tempo, beats = librosa.beat.beat_track(onset_envelope=oenv, sr=SR, hop_length=256, start_bpm=120, tightness=400, units="time")
beats = np.asarray(beats, float)
# remove the tracker's frame-quantisation jitter (11.6 ms) while following slow tempo drift
idx = np.arange(len(beats)); sm = beats.copy()
for i in range(len(beats)):
    a, b_ = max(0, i - 6), min(len(beats), i + 7)
    p = np.polyfit(idx[a:b_], beats[a:b_], 1); sm[i] = np.polyval(p, i)
beats = sm
ibi = np.diff(beats)
print("tempo", tempo, "median ibi", np.median(ibi), "beats", len(beats))

# --- fit a piecewise-constant grid: global period from the median, refined by least squares on segments
# where the tracker agrees with the grid; keep the tracker's beats where tempo changes (bridge slow-down).
P = float(np.median(ibi))
# local tempo report
for s in range(0, int(dur), 15):
    m = (beats[:-1] >= s) & (beats[:-1] < s + 15)
    if m.sum() > 2:
        print(f"{s:4d}s  bpm {60 / np.median(ibi[m]):6.2f}  n {m.sum()}")

# ---------------------------------------------------------------- onsets from the drum stem
def peaks(y, lo, hi, thr_pct=70, min_gap=0.07):
    e = env_rms(band(y, lo, hi), win=0.012)
    d = np.maximum(0, np.diff(e, prepend=e[0]))
    d = sg.convolve(d, np.ones(2) / 2, mode="same")
    thr = np.percentile(d[d > 0], thr_pct) if (d > 0).any() else 1
    pk, pr = sg.find_peaks(d, height=thr, distance=int(min_gap * FPS))
    s = pr["peak_heights"]
    s = np.clip(s / (np.percentile(s, 98) + 1e-9), 0, 1)
    return [[round(i / FPS, 3), round(float(v), 3)] for i, v in zip(pk, s)]


kick = peaks(stems["drums"], None, 120, 80, 0.12)
snare = peaks(stems["drums"], 1500, 5000, 85, 0.12)
hat = peaks(stems["drums"], 7000, None, 75, 0.06)
# snare: keep attacks on the beat grid (backbeats mostly); the 1.5-5 kHz band also catches hats and guitar bleed
_bi = lambda t: np.interp(t, beats, np.arange(len(beats)))
snare = [x for x in snare if abs(_bi(x[0]) - round(_bi(x[0]))) < 0.09 and x[1] > 0.25]
# drop hats near kicks/snares
ks = np.array([x[0] for x in kick + snare]) if kick or snare else np.zeros(0)
hat = [h for h in hat if ks.size == 0 or np.min(np.abs(ks - h[0])) > 0.035]
vo = librosa.onset.onset_detect(y=stems["vocals"], sr=SR, hop_length=256, units="time", backtrack=False)
venv = np.array(feat["vocal"])
vocal = [[round(float(t), 3), round(float(venv[min(N - 1, int(t * FPS) + 3)]), 3)] for t in vo if venv[min(N - 1, int(t * FPS) + 3)] > 0.08]
go = librosa.onset.onset_detect(y=stems["other"], sr=SR, hop_length=256, units="time", backtrack=False)
genv = np.array(feat["other"])
guitar = [[round(float(t), 3), round(float(genv[min(N - 1, int(t * FPS) + 3)]), 3)] for t in go if genv[min(N - 1, int(t * FPS) + 3)] > 0.1]
print("onsets kick", len(kick), "snare", len(snare), "hat", len(hat), "vocal", len(vocal), "guitar", len(guitar))

# ---------------------------------------------------------------- downbeat phase
# chord changes (chroma novelty of bass+other) and kick-vs-snare pattern per beat index mod 4
chroma = librosa.feature.chroma_cqt(y=stems["bass"] + stems["other"], sr=SR, hop_length=512)
ct = librosa.frames_to_time(np.arange(chroma.shape[1]), sr=SR, hop_length=512)
def chroma_at(t0, t1):
    m = (ct >= t0) & (ct < t1)
    return chroma[:, m].mean(1) if m.any() else np.zeros(12)
nov = []
for i in range(1, len(beats) - 1):
    a = chroma_at(beats[i - 1], beats[i]); b = chroma_at(beats[i], beats[i + 1])
    nov.append(1 - np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-9))
nov = np.array([0] + nov + [0])
kick_t = np.array([k[0] for k in kick]); snare_t = np.array([s[0] for s in snare])
def near(arr, t, w=0.06):
    return float(np.sum(np.abs(arr - t) < w)) if arr.size else 0.0
score = np.zeros(4)
for ph in range(4):
    for i, b in enumerate(beats):
        pos = (i - ph) % 4
        if pos == 0:
            score[ph] += 2.0 * nov[i] + 0.3 * near(kick_t, b)
        if pos in (1, 3):
            score[ph] += 0.15 * near(snare_t, b)
print("phase scores", score)
ph = int(np.argmax(score))
# Override: the snare sits on beat indices 1,3 mod 4 (backbeats), which leaves phase 0 or 2. The chroma
# novelty prefers 2, but the lyric stresses decide for 0: lines start with a one-beat pickup and the
# stressed syllables land on phase-0 beats ("Spent FOUR-fifths", "the kettle's BOILING", "EIGHTY percent").
PHASE_OVERRIDE = 0
ph = PHASE_OVERRIDE if PHASE_OVERRIDE is not None else ph
# lyric lines: the line starts' beat positions as a tie-breaker / report
downbeats = [float(beats[i]) for i in range(ph, len(beats), 4)]

# ---------------------------------------------------------------- sections from aligned lyrics
sections = []
try:
    ly = json.load(open(common.DATA / "lyrics.json"))
    groups = {}
    for l in ly["lines"]:
        groups.setdefault(l["section"], []).append(l)
    order = []
    for l in ly["lines"]:
        if l["section"] not in order:
            order.append(l["section"])
    def db_before(t):
        c = [d for d in downbeats if d <= t + 0.05]
        return c[-1] if c else 0.0
    first = groups[order[0]][0]["start"]
    sections.append({"name": "intro", "start": 0.0, "end": db_before(first - 0.3)})
    for k, name in enumerate(order):
        s = db_before(groups[name][0]["words"][0]["start"] - 0.3)
        sections.append({"name": name, "start": s, "end": None})
    for i in range(len(sections) - 1):
        sections[i]["end"] = sections[i + 1]["start"]
    # the solo: the gap after the build's last line, before the outro
    sections[-1]["end"] = dur
    out = []
    for s in sections:
        if s["name"] == "outro":
            b_end = groups["build"][-1]["end"]
            solo_start = min([d for d in downbeats if d >= b_end - 0.2], default=b_end)
            if s["start"] - solo_start > 4:
                out.append({"name": "solo", "start": solo_start, "end": s["start"]})
                prev = out[-2]
                prev["end"] = solo_start
        out.append(s)
    sections = [{"name": s["name"], "start": round(s["start"], 3), "end": round(s["end"], 3)} for s in sorted(out, key=lambda s: s["start"])]
except FileNotFoundError:
    print("no lyrics.json yet: no sections")
for s in sections:
    print(s)

json.dump({
    "duration": round(dur, 3), "bpm": round(60 / P, 3), "beat_period": round(P, 5), "time_signature": 4,
    "beats": [round(float(b), 3) for b in beats], "downbeats": [round(d, 3) for d in downbeats], "sections": sections,
    "fps": FPS, **feat,
    "onsets": {"kick": kick, "snare": snare, "hat": hat, "vocal": vocal, "guitar": guitar},
    "notes": "librosa beat tracker on drums+mix (start 120 BPM, tight); downbeat phase from chroma novelty of bass+other and kick/snare pattern; envelopes 100 fps, 46 ms RMS, 10/90 ms smoothing, /p99; onsets from htdemucs stems.",
}, open(common.DATA / "audio.json", "w"), separators=(",", ":"))
print("wrote data/audio.json")
