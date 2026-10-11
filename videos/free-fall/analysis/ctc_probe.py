"""Probe: align a block of lines jointly inside a wide window and print word times + confidences."""
import sys, re, json
import numpy as np, soundfile as sf, torch, torchaudio.functional as AF
from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor
NAME = "facebook/wav2vec2-large-960h-lv60-self"
proc = Wav2Vec2Processor.from_pretrained(NAME); model = Wav2Vec2ForCTC.from_pretrained(NAME).eval()
V = proc.tokenizer.get_vocab()
wav, sr = sf.read("work/vocals16.wav", dtype="float32")
t0, t1 = float(sys.argv[1]), float(sys.argv[2]); text = sys.argv[3]
x = wav[int(t0*sr):int(t1*sr)]
x = (x - x.mean()) / (x.std() + 1e-7)
with torch.inference_mode():
    lg = model(torch.from_numpy(x)[None]).logits
em = torch.log_softmax(lg, -1)[0]
fr = (t1 - t0) / em.shape[0]
words = text.split()
seq, own = [], []
for i, w in enumerate(words):
    for ch in re.sub(r"[^A-Z']", "", w.upper()):
        seq.append(V[ch]); own.append(i)
    if i < len(words) - 1: seq.append(V["|"]); own.append(-1)
ali, sc = AF.forced_align(em[None], torch.tensor([seq], dtype=torch.int32), blank=0)
spans = AF.merge_tokens(ali[0], sc[0].exp())
ws = {}
for sp, o in zip(spans, own):
    if o < 0: continue
    d = ws.setdefault(o, [1e9, 0, []]); d[0] = min(d[0], t0 + sp.start*fr); d[1] = max(d[1], t0 + sp.end*fr); d[2].append(sp.score)
print(" ".join(f"{words[i]}@{d[0]:.2f}-{d[1]:.2f}({np.mean(d[2]):.2f})" for i, d in sorted(ws.items())))
