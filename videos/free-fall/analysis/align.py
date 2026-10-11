"""Word-level lyric alignment -> data/lyrics.json

  1. separate.py: MDX-Net vocal stem; whisper_run.py (medium.en) and whisper_clips.py (large-v3, no prompt) place
     the sung lines (they agree on every line). The lines below are as sung: the sheet's choruses, a "Free fall, free
     fall" tail after chorus 1 and after the final chorus, and the final chorus's "hit the wall" / "spend a life just
     standing tall".
  2. this script: CTC forced alignment (wav2vec2-large-960h-lv60-self, via torchaudio.functional.forced_align) of
     each BLOCK of lines jointly inside a window bounded by gaps in the vocal (a block = a verse, a pre-chorus, a
     chorus), so the aligner places line boundaries itself. Word ends are then extended over short legato gaps and
     the last word of a line is held while the voice holds (vocal envelope).
  The wordless chants (post-chorus "yeah, yeah / oh…", outro "oh…") are not lines: the video takes them from the
  vocal note onsets in data/audio.json.

Run:  HF_HOME=.cache/hf python align.py OUT_JSON
"""
import json, re, sys
import numpy as np, soundfile as sf, torch, torchaudio.functional as AF
from scipy.ndimage import uniform_filter1d
from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor

OUT = sys.argv[1]
NAME = "facebook/wav2vec2-large-960h-lv60-self"
proc = Wav2Vec2Processor.from_pretrained(NAME)
model = Wav2Vec2ForCTC.from_pretrained(NAME).eval()
V = proc.tokenizer.get_vocab()
wav, sr = sf.read("work/vocals16.wav", dtype="float32")

CH = ["Free fall, free fall", "I’d rather fly and hit a wall", "Than spend forever standing tall",
      "On ground that never moves at all"]
# (window start, window end, [lines as sung])
BLOCKS = [
    (22.0, 38.2, ["They said count the cost before you leap", "Measure twice and think it through",
                  "But the cliff is only shoulder-high", "And the sky is screaming blue"]),
    (38.0, 44.25, ["The worst that happens is a stumble", "The best is something beautiful"]),
    (44.0, 57.9, CH),
    (57.7, 63.6, ["Free fall, free fall"]),
    (63.5, 77.6, ["They said what if nobody answers", "What if all your words get lost",
                  "But a whisper costs you nothing", "And silence is the only cost"]),
    (77.4, 86.6, ["The door says no or the door swings wide", "Either way I’m on the other side"]),
    (86.4, 101.2, CH + ["Free fall"]),
    (119.9, 133.45, ["Every great thing started with a jump", "Every love began with just a name",
                     "Every single life worth telling", "Started when somebody risked the shame"]),
    (133.3, 151.6, ["Free fall, free fall", "I’d rather fly and hit the wall", "Than spend a life just standing tall",
                    "On ground that never moves at all", "Free fall, free fall"]),
    (151.6, 158.0, ["Free fall, free fall"]),
]
# Manual word-start fixes (line, word) -> start where the CTC path is unsure (low confidence), set from the vocal
# note onsets (data/audio.json) and both Whisper runs: "Either way I'm" (the aligner squeezes "I'm" into "on"),
# and the final chorus's "at all" (held; the aligner drifts into the hold).
FIX = {(16, 0): 81.22, (16, 1): 81.68, (16, 2): 82.12, (29, 5): 145.18, (29, 6): 145.45}

hop = 160
env = np.array([np.sqrt(np.mean(wav[i * hop:(i + 1) * hop] ** 2)) for i in range(len(wav) // hop)])
env_s = uniform_filter1d(env, 5)
ref = np.percentile(env_s, 97)


def toks(w):
    return re.sub(r"[^A-Z']", "", w.upper().replace("’", "'").replace("-", ""))


lines_out = []
for t0, t1, lines in BLOCKS:
    x = wav[int(t0 * sr):int(t1 * sr)]
    x = (x - x.mean()) / (x.std() + 1e-7)
    with torch.inference_mode():
        em = torch.log_softmax(model(torch.from_numpy(x)[None]).logits, -1)[0]
    fr = (t1 - t0) / em.shape[0]
    # words of all lines; a hyphenated word ("shoulder-high") is one display word
    words = [(li, w) for li, l in enumerate(lines) for w in l.split()]
    seq, own = [], []
    for i, (_, w) in enumerate(words):
        for ch in toks(w):
            seq.append(V[ch]); own.append(i)
        if i < len(words) - 1:
            seq.append(V["|"]); own.append(-1)
    ali, sc = AF.forced_align(em[None], torch.tensor([seq], dtype=torch.int32), blank=0)
    spans = AF.merge_tokens(ali[0], sc[0].exp())
    ws = {}
    for sp, o in zip(spans, own):
        if o < 0:
            continue
        d = ws.setdefault(o, [1e9, 0.0, []])
        d[0] = min(d[0], t0 + sp.start * fr); d[1] = max(d[1], t0 + (sp.end + 1) * fr); d[2].append(sp.score)
    per_line = [[] for _ in lines]
    for i, (li, w) in enumerate(words):
        s, e, c = ws[i]
        per_line[li].append({"w": w.rstrip(","), "start": round(s, 3), "end": round(e, 3), "conf": round(float(np.mean(c)), 3)})
    for li, wl in enumerate(per_line):
        lines_out.append({"text": lines[li].replace(",", ","), "words": wl, "_lim": t1})

# fixes, legato ends, held last words
for li, L in enumerate(lines_out):
    wl = L["words"]
    for wi, w in enumerate(wl):
        if (li, wi) in FIX:
            w["start"] = FIX[(li, wi)]; w["fixed"] = True
    for i in range(len(wl) - 1):
        if wl[i]["end"] > wl[i + 1]["start"]:
            wl[i]["end"] = wl[i + 1]["start"]
        if wl[i + 1]["start"] - wl[i]["end"] < 0.35:
            wl[i]["end"] = wl[i + 1]["start"]
    nxt = lines_out[li + 1]["words"][0]["start"] if li + 1 < len(lines_out) else 999
    lim = min(L.pop("_lim"), nxt - 0.05)
    last = wl[-1]
    k = int(last["end"] * 100)
    while k < min(int(lim * 100), len(env_s) - 1) and env_s[k] > 0.18 * ref:
        k += 1
    last["end"] = round(max(last["end"], min(k / 100, lim)), 3)
    L["start"], L["end"] = wl[0]["start"], wl[-1]["end"]
    print(f"{li:2d} {L['start']:7.2f} {L['end']:7.2f}  " + " ".join(f"{w['w']}@{w['start']:.2f}({w['conf']:.2f})" for w in wl))

json.dump({"lines": [{"text": L["text"], "start": L["start"], "end": L["end"], "words": L["words"]} for L in lines_out]},
          open(OUT, "w"), indent=1)
print("wrote", OUT)
