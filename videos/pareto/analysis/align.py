"""Word-level lyric alignment -> data/lyrics.json

1. emissions.py: frame-wise CTC log-probs (MMS_FA + wav2vec2 LV60K) of the Demucs vocal stem.
2. here: one global constrained CTC Viterbi pass over the whole song on the fused emissions,
   with a garbage "star" token between lines (absorbs instrumental, backing vocals, la-la-las),
   optional per-line windows; then word-end refinement from the vocal envelope.
3. cross-check against faster-whisper word timestamps (work/whisper.json) -> report.

Run: uv run python align.py
"""
import common
import json, re, sys
import numpy as np
from ctcalign import FRAME, align, emissions, word_table

KIND = sys.argv[1] if len(sys.argv) > 1 else "fused"
LY = common.load_lyrics()
lines_tokens = [t.split(" ") for _, t in LY]

# Per-line windows (s) for spots where the global path is ambiguous (filled after QA).
LINE_WINDOWS = {0: (26.5, 33.0), 34: (242.0, 248.5)}
ANCHORS = {}
FIX = {}

E = emissions(KIND)
spans, score, path, tgt = align(E, lines_tokens, margin=1.4, anchors=ANCHORS, line_windows=LINE_WINDOWS)
tab = word_table(spans, lines_tokens)
print("viterbi score", score)

# ---------------------------------------------------------------- refine word ends with the vocal envelope
y, sr = common.load_stem("vocals", sr=16000)
hop = 160  # 10 ms
fr = np.sqrt(np.convolve(y ** 2, np.ones(400) / 400, mode="same")[::hop])
fr = fr / (np.percentile(fr, 99) + 1e-9)
def env(t):
    i = int(t * 100); return fr[min(max(i, 0), len(fr) - 1)]

words = []
for li, toks in enumerate(lines_tokens):
    for ti, tok in enumerate(toks):
        w = next(x for x in tab if x["li"] == li and x["ti"] == ti)
        words.append(dict(li=li, ti=ti, w=tok, start=w["start"], end=w["end"], conf=w["conf"], subs=w["subs"]))

for k, w in enumerate(words):
    nxt = words[k + 1] if k + 1 < len(words) else None
    limit = nxt["start"] if nxt else w["end"] + 1.5
    same_line = nxt is not None and nxt["li"] == w["li"]
    if same_line and limit - w["end"] < 0.35:
        w["end"] = limit  # legato: run to the next word
    else:
        # extend while the voice keeps sounding (held notes), up to the next word / 1.6 s
        t = w["end"]
        cap = min(limit - 0.03, w["end"] + 1.6)
        while t < cap and env(t) > 0.12:
            t += 0.01
        w["end"] = max(w["end"], t)
    w["end"] = min(w["end"], w["start"] + 2.5)  # CTC can park a last char across an instrumental
    if (w["li"], w["ti"]) in FIX:
        w.update(FIX[(w["li"], w["ti"])])

# syllable spans for multi-subword tokens
out_lines = []
for li, (sec, text) in enumerate(LY):
    ws = [w for w in words if w["li"] == li]
    jw = []
    for w in ws:
        d = dict(w=w["w"], start=round(w["start"], 3), end=round(w["end"], 3), conf=round(min(1.0, w["conf"] * 1.6), 2))
        if len(w["subs"]) > 1:
            subs = [list(s) for s in w["subs"]]
            subs[-1][1] = w["end"]
            d["syl"] = [[round(a, 3), round(b, 3)] for a, b in subs]
        jw.append(d)
    out_lines.append(dict(i=li, section=sec, text=text, start=jw[0]["start"], end=jw[-1]["end"], words=jw))

json.dump(dict(lines=out_lines, notes=f"CTC forced alignment ({KIND}: MMS_FA+LV60K on htdemucs vocals), global Viterbi with garbage token between lines; word ends extended over held notes from the vocal RMS."),
          open(common.DATA / "lyrics.json", "w"), indent=1, ensure_ascii=False)

# ---------------------------------------------------------------- cross-check with whisper
try:
    wj = json.load(open(common.WORK / "whisper.json"))
    ww = [dict(w=re.sub(r"[^a-z']", "", x["w"].lower()), start=x["start"]) for s in wj for x in s["words"]]
    from difflib import SequenceMatcher
    a = [re.sub(r"[^a-z']", "", w["w"].lower()) for w in words]
    b = [x["w"] for x in ww]
    sm = SequenceMatcher(a=a, b=b, autojunk=False)
    diffs = []
    for blk in sm.get_matching_blocks():
        for k in range(blk.size):
            diffs.append((blk.a + k, words[blk.a + k]["start"] - ww[blk.b + k]["start"]))
    d = np.array([x[1] for x in diffs])
    print(f"whisper matched {len(d)}/{len(a)} words; median |Δstart| {np.median(np.abs(d)):.3f}s; >0.3s: {(np.abs(d) > 0.3).sum()}")
    for i, dd in diffs:
        if abs(dd) > 0.3:
            w = words[i]
            print(f"  L{w['li']:2d} '{w['w']}' ctc {w['start']:.2f} whisper {w['start'] - dd:.2f}")
except FileNotFoundError:
    pass

for l in out_lines:
    print(f"{l['start']:7.2f} {l['end']:7.2f} [{l['section']}] " + " ".join(f"{w['w']}@{w['start']:.2f}" for w in l["words"]))
