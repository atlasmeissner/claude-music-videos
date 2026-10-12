"""Cross-check the CTC word timings (align.py) with Whisper and the vocal onsets, and write the
final data/lyrics.json.

Rules, per word:
1. Start from the CTC estimate (sharp on consonants).
2. Where CTC lost its place (confidence < 0.12, or a line's first word squashed to almost nothing
   in front of a held vowel) and Whisper (medium.en) disagrees by more than 0.25 s, take Whisper.
3. The repeated "Dominoes" chants of the final chorus defeat both aligners on the full mix; their
   starts come from Whisper large-v3 run on short excerpts of the vocal stem (MANUAL below).
4. Snap the start to the nearest vocal-stem onset within [-0.15, +0.06] s.

    uv run python refine.py --ctc ../../work/lyrics_ctc2.json --whisper ../../work/whisper.json \
        --onsets ../../work/vocal_onsets.npy
"""
import argparse
import json
import re
from difflib import SequenceMatcher
from pathlib import Path

import numpy as np

# (line index, word index) -> start, from large-v3 on excerpts (110-126 s, 146-160 s, 108-138 s)
MANUAL_LINES = {
    23: [110.80],
    24: [114.96],
    25: [118.30],
    26: [124.08, 125.20],
    28: [129.76, 131.44],
    30: [150.26, 151.66],
    31: [153.06, 154.78],
    32: [156.38, 158.10],
    33: [158.16, 159.12, 160.08, 160.24, 160.48, 160.84, 161.32, 161.76, 163.02],
}

# single words: CTC stretched the held "goes" to the end of the note
MANUAL_WORDS = {(29, 8): 135.56}


def norm(w):
    w = w.lower().replace("’", "'")
    w = re.sub(r"[^a-z']", "", w).replace("'", "")
    return {"dominos": "dominoes", "passin": "passing", "fallin": "falling"}.get(w, w)


def map_words(lyr_words, wh):
    sm = SequenceMatcher(a=[norm(w) for w in lyr_words], b=[norm(w["w"]) for w in wh], autojunk=False)
    hit = {}
    for blk in sm.get_matching_blocks():
        for k in range(blk.size):
            hit[blk.a + k] = wh[blk.b + k]
    return hit


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ctc", required=True)
    ap.add_argument("--whisper", required=True)
    ap.add_argument("--onsets", required=True)
    ap.add_argument("--out", default="../data/lyrics.json")
    a = ap.parse_args()

    lines = json.loads(Path(a.ctc).read_text())["lines"]
    onsets = np.load(a.onsets)
    flat = [(li, wi, w) for li, l in enumerate(lines) for wi, w in enumerate(l["words"])]
    hit = map_words([w["w"] for _, _, w in flat], json.loads(Path(a.whisper).read_text()))

    for k, (li, wi, w) in enumerate(flat):
        l = lines[li]
        c, src = w["start"], "ctc"
        wh = hit.get(k)
        whs = wh["start"] if wh and abs(wh["start"] - c) < 2.0 else None
        squashed = wi == 0 and len(l["words"]) > 1 and l["words"][1]["start"] - c < 0.12
        if whs is not None and abs(whs - c) > 0.25 and (w["conf"] < 0.12 or (squashed and whs < c)):
            c, src = whs, "whisper"
        if li in MANUAL_LINES:
            c, src = MANUAL_LINES[li][wi], "manual"
        if (li, wi) in MANUAL_WORDS:
            c, src = MANUAL_WORDS[(li, wi)], "manual"
        # snap to a vocal onset
        cand = onsets[(onsets > c - 0.15) & (onsets < c + 0.06)]
        if len(cand):
            c = float(cand[np.argmin(np.abs(cand - c))])
            src += "+onset"
        w["start"] = round(c, 3)
        w["src"] = src
        w.pop("chars", None)

    for l in lines:
        ws = l["words"]
        for i, w in enumerate(ws):
            if i + 1 < len(ws) and ws[i + 1]["start"] < w["start"] + 0.08:
                ws[i + 1]["start"] = round(w["start"] + 0.08, 3)
        for i, w in enumerate(ws):
            nxt = ws[i + 1]["start"] if i + 1 < len(ws) else None
            end = max(w["end"], w["start"] + 0.12)
            if nxt is not None and (end > nxt or nxt - end < 0.25):
                end = nxt
            w["end"] = round(end, 3)
        l["start"], l["end"] = ws[0]["start"], ws[-1]["end"]
        l.pop("whisper", None)
    for i, l in enumerate(lines):
        if i + 1 < len(lines) and l["end"] > lines[i + 1]["start"]:
            l["end"] = l["words"][-1]["end"] = lines[i + 1]["start"]

    Path(a.out).write_text(json.dumps({"lines": lines}, indent=1))
    for l in lines:
        print(f"{l['start']:7.2f} {l['end']:7.2f}  {l['section']:8} " +
              " ".join(f"{w['w']}@{w['start']:.2f}{'*' if not w['src'].startswith('ctc') else ''}" for w in l["words"]))


if __name__ == "__main__":
    main()
