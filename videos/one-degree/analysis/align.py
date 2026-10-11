"""Word-level lyric alignment -> data/lyrics.json

  1. whisper_run.py / whisper_large.py: Whisper word timestamps on the Demucs vocal stem, used to place
     each lyric line in a coarse window (the sung lyrics differ from the published text: Suno repeats
     and drops lines, so the line list below is what is actually sung, established from both Whisper
     runs and the vocal-activity map).
  2. this script: torchaudio MMS_FA CTC forced alignment of each line's text inside its window
     (window = coarse line span +- margin, with <star> garbage tokens at both ends so the line can
     float inside it), then word starts snapped to vocal onsets within 60 ms and ends trimmed to
     the vocal envelope.

Run:  python align.py WORK_DIR OUT_JSON
"""
import json
import re
import sys

import numpy as np
import soundfile as sf
import torch
import torchaudio
import torchaudio.functional as AF

WORK, OUT = sys.argv[1:3]

# (text, coarse start, coarse end): the lines as actually sung, with windows from the Whisper runs and
# the vocal-activity map (vocal stem RMS).
LINES = json.load(open(f"{WORK}/lines.json"))

wav, sr = sf.read(f"{WORK}/vocals16.wav", dtype="float32")
assert sr == 16000
bundle = torchaudio.pipelines.MMS_FA
model = bundle.get_model(with_star=True).eval()
DICT = bundle.get_dict(star="*")
FRAME = 320 / 16000  # MMS_FA emission frame (20 ms)

# vocal envelope (10 ms) for refinements
hop = 160
env = np.array([np.sqrt(np.mean(wav[i * hop:(i + 1) * hop] ** 2)) for i in range(len(wav) // hop)])
from scipy.ndimage import uniform_filter1d
env_s = uniform_filter1d(env, 5)
ref = np.percentile(env_s, 97)


def norm_word(w):
    return re.sub(r"[^a-z']", "", w.lower().replace("’", "'"))


def emissions(t0, t1):
    a, b = int(max(0, t0) * sr), int(min(len(wav) / sr, t1) * sr)
    x = torch.from_numpy(wav[a:b]).unsqueeze(0)
    with torch.inference_mode():
        em, _ = model(x)
    return torch.log_softmax(em, dim=-1)[0], a / sr


# Manual word-start corrections (0-based line, word) -> start, where the CTC path is unsure (choruses with
# backing vocals, held notes). Established from the vocal note segmentation (notes.py: pYIN pitch steps +
# onsets on the vocal stem; the hook's melody is "one" / "de-" / "-gree" on three rising notes), the
# compact vocal map (vmap2.py) and both Whisper runs.
FIX = {
    (6, 0): 36.74, (6, 2): 40.46,
    (9, 0): 52.68, (9, 1): 53.28, (9, 3): 57.03, (9, 5): 60.78,
    (16, 0): 88.55, (16, 1): 89.10, (16, 2): 90.06, (16, 3): 91.01,
    (17, 0): 92.33, (17, 1): 92.86, (17, 2): 93.86, (17, 3): 94.51,
    (20, 0): 104.63, (20, 1): 105.32, (20, 2): 106.52,
    (21, 0): 108.15, (21, 1): 108.92, (21, 2): 110.23,
    (22, 0): 111.90, (22, 1): 112.65, (22, 2): 113.96,
    (23, 0): 132.24,
    (25, 0): 143.76, (25, 1): 143.98, (25, 2): 144.95, (25, 3): 145.75,
    (26, 0): 147.85, (26, 1): 148.77, (26, 2): 150.29, (26, 3): 150.91,
    (27, 0): 152.41, (27, 1): 153.35, (27, 2): 154.00, (27, 3): 154.70,
    (28, 3): 159.62, (28, 4): 159.98, (28, 5): 160.70,
    (30, 0): 165.31, (30, 1): 166.02, (30, 2): 167.20, (30, 3): 167.61, (30, 4): 168.00, (30, 5): 168.30,
    (33, 1): 188.42,
    (34, 2): 193.50, (34, 3): 194.16, (34, 4): 194.85, (34, 5): 195.45,
    (35, 0): 196.15, (35, 1): 196.80, (35, 2): 197.63, (35, 3): 198.12, (35, 4): 198.55, (35, 5): 198.95,
    (36, 0): 199.95, (36, 1): 200.67,
    (37, 1): 204.60,
}

out_lines = []
prev_end = 0.0
for li, (text, c0, c1) in enumerate(LINES):
    words = text.split()
    toks_words = [norm_word(w) for w in words]
    # never search before the previous line's last word started + its first 150 ms (windows must not overlap)
    t0, t1 = max(c0 - 0.6, prev_end), c1 + 0.6
    em, off = emissions(t0, t1)
    # star at both ends and between words lets silence / backing vocals be absorbed
    seq, owner = [], []
    seq.append(DICT["*"]); owner.append(-1)
    for wi, w in enumerate(toks_words):
        for ch in w:
            seq.append(DICT[ch]); owner.append(wi)
        seq.append(DICT["*"]); owner.append(-1)
    targets = torch.tensor([seq], dtype=torch.int32)
    ali, scores = AF.forced_align(em.unsqueeze(0), targets, blank=0)
    ali, scores = ali[0], scores[0].exp()
    spans = AF.merge_tokens(ali, scores)
    # spans align 1:1 with target tokens
    wspans = {}
    for sp, ow in zip(spans, owner):
        if ow < 0:
            continue
        s, e = off + sp.start * FRAME, off + sp.end * FRAME
        ws = wspans.setdefault(ow, [s, e, []])
        ws[0] = min(ws[0], s); ws[1] = max(ws[1], e); ws[2].append(sp.score)
    wl = []
    for wi, w in enumerate(words):
        s, e, sc = wspans[wi]
        wl.append({"w": w, "start": round(s, 3), "end": round(e, 3), "conf": round(float(np.mean(sc)), 3)})
    for wi, w in enumerate(wl):
        if (li, wi) in FIX:
            w["start"] = FIX[(li, wi)]
            w["fixed"] = True
    # keep words ordered: an end never runs past the next word's start, and is at least 80 ms after its own
    for i in range(len(wl)):
        nxt = wl[i + 1]["start"] if i + 1 < len(wl) else None
        if nxt is not None and wl[i]["end"] > nxt:
            wl[i]["end"] = nxt
        if wl[i]["end"] < wl[i]["start"] + 0.08:
            wl[i]["end"] = round(min(wl[i]["start"] + 0.3, nxt if nxt is not None else wl[i]["start"] + 0.3), 3)
    # refinements: extend each word's end to the next word's start when the gap is short (legato),
    # and extend the last word's end while the voice holds (envelope above 25% of ref)
    for i in range(len(wl) - 1):
        gap = wl[i + 1]["start"] - wl[i]["end"]
        if gap < 0.35:
            wl[i]["end"] = wl[i + 1]["start"]
    last = wl[-1]
    k = int(last["end"] * 100)
    lim = int(min(c1 + 1.5, (LINES[li + 1][1] if li + 1 < len(LINES) else c1 + 1.5)) * 100)
    while k < min(lim, len(env_s) - 1) and env_s[k] > 0.18 * ref:
        k += 1
    last["end"] = round(max(last["end"], k / 100), 3)
    prev_end = wl[-1]["start"] + 0.15
    out_lines.append({"text": text, "start": wl[0]["start"], "end": wl[-1]["end"], "words": wl})
    print(f"{wl[0]['start']:7.2f} {wl[-1]['end']:7.2f}  " + " ".join(f"{w['w']}@{w['start']:.2f}({w['conf']:.2f})" for w in wl))

json.dump({"lines": out_lines}, open(OUT, "w"), indent=1)
print("wrote", OUT)
