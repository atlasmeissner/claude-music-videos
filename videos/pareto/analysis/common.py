"""Shared paths for the Pareto analysis scripts (import first: sets model caches)."""
import os
from pathlib import Path
ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parent
CACHE = ROOT / ".cache"
for var, sub in [("TORCH_HOME", "torch"), ("HF_HOME", "hf"), ("XDG_CACHE_HOME", "xdg"), ("MPLCONFIGDIR", "mpl"), ("NUMBA_CACHE_DIR", "numba")]:
    os.environ.setdefault(var, str(CACHE / sub)); (CACHE / sub).mkdir(parents=True, exist_ok=True)
AUDIO = PROJECT / "audio" / "pareto.mp3"
STEMS = ROOT / "stems"
DATA = PROJECT / "data"
WORK = ROOT / "work"
QA = ROOT / "qa"
for d in (WORK, QA, DATA): d.mkdir(exist_ok=True)

def load_lyrics():
    """-> list of (section, text)"""
    sec, out = None, []
    for ln in (PROJECT / "lyrics" / "lyrics.txt").read_text().splitlines():
        ln = ln.strip()
        if not ln: continue
        if ln.startswith("#"): sec = ln[1:].strip(); continue
        out.append((sec, ln))
    return out

def load_stem(name, sr=None, mono=True):
    import soundfile as sf, librosa, numpy as np
    y, s = sf.read(STEMS / f"{name}.wav", dtype="float32", always_2d=True)
    y = y.mean(axis=1) if mono else y.T
    if sr and sr != s:
        y = librosa.resample(y, orig_sr=s, target_sr=sr) if mono else np.stack([librosa.resample(c, orig_sr=s, target_sr=sr) for c in y])
        s = sr
    return y, s

def load_vocal_source(name, sr=None):
    if name in ("vocL", "vocR"):
        y, s = load_stem("vocals", sr=sr, mono=False)
        return y[0 if name == "vocL" else 1], s
    return load_stem("vocals", sr=sr)
