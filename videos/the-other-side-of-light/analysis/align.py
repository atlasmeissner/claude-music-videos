import json, re, numpy as np, torch, librosa
from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor
from torchaudio.functional import forced_align
torch.set_num_threads(2)
LINES = [
 ("I drew a map of every way to lose", 24.6, 32.2),
 ("Every door that leads to ruin", 32.0, 37.2),
 ("Every lie I'd tell myself", 37.6, 43.0),
 ("Every bridge I'd set to burning", 43.6, 48.7),
 ("I learned the dark by name", 48.5, 52.85),
 ("Every shadow, every flame", 52.6, 56.2),
 ("So I'm running to the other side of light", 60.0, 66.6),
 ("Every wrong turn made the right one clear", 66.5, 72.4),
 ("I'm not chasing what I want tonight", 72.3, 77.9),
 ("I'm just leaving what I fear", 77.6, 85.0),
 ("I wrote the list of all the ways to fail", 88.2, 93.6),
 ("All the poison dressed as medicine", 94.0, 99.6),
 ("Every shortcut to the bottom", 100.0, 103.4),
 ("Every comfortable sin", 102.6, 106.0),
 ("I held the worst up to the light", 105.8, 110.1),
 ("And finally saw the way to fight", 109.6, 112.4),
 ("So I'm running to the other side of light", 112.0, 117.4),
 ("Every wrong turn made the right one clear", 117.2, 122.8),
 ("I'm not chasing what I want tonight", 122.4, 129.2),
 ("I'm just leaving what I fear", 128.8, 136.0),
 ("They said go find the path to glory", 136.2, 142.0),
 ("I just found every path to grief", 142.2, 146.6),
 ("And walked the other way", 146.2, 153.0),
 ("So I'm running to the other side of light", 160.0, 179.0),
 ("Every wrong turn made the right one bright", 177.5, 183.0),
 ("I'm not chasing anymore tonight", 183.2, 189.3),
 ("I just left behind the fight", 189.2, 195.5),
]
name = "facebook/wav2vec2-large-960h-lv60-self"
proc = Wav2Vec2Processor.from_pretrained(name); model = Wav2Vec2ForCTC.from_pretrained(name).eval()
vocab = proc.tokenizer.get_vocab()
y, sr = librosa.load('vocals.wav', sr=16000, mono=True)
FR = 0.02
out = []
for li, (text, a, b) in enumerate(LINES):
    seg = y[int(a*sr):int(b*sr)]
    seg = seg / (np.abs(seg).max() + 1e-9)
    with torch.inference_mode():
        x = proc(seg, sampling_rate=sr, return_tensors='pt').input_values
        em = torch.log_softmax(model(x).logits, -1)[0]
    words = text.split()
    clean = [re.sub(r"[^A-Z']", "", w.upper()) for w in words]
    toks, wid = [], []
    for i, w in enumerate(clean):
        if i: toks.append(vocab['|']); wid.append(-1)
        for ch in w: toks.append(vocab[ch]); wid.append(i)
    al, sc = forced_align(em[None], torch.tensor([toks], dtype=torch.int32), blank=vocab['<pad>'])
    al = al[0].numpy(); sc = sc[0].exp().numpy()
    # token spans: walk frames, assign to token index sequence
    ti = -1; prev = vocab['<pad>']; spans = [[None, None, []] for _ in toks]
    for f, tok in enumerate(al):
        if tok == vocab['<pad>']: prev = tok; continue
        if tok != prev or ti < 0:
            ti += 1
        spans[ti][0] = f if spans[ti][0] is None else spans[ti][0]; spans[ti][1] = f; spans[ti][2].append(sc[f])
        prev = tok
    wl = []
    for i, w in enumerate(words):
        idx = [k for k, q in enumerate(wid) if q == i]
        s0 = spans[idx[0]][0]; s1 = spans[idx[-1]][1]
        conf = float(np.mean([np.mean(spans[k][2]) for k in idx]))
        wl.append(dict(w=w, start=round(a + s0*FR, 3), end=round(a + (s1+1)*FR, 3), conf=round(conf, 2)))
    # extend each word's end to next word's start if gap small (sustained vowels)
    for i in range(len(wl)-1):
        if wl[i+1]['start'] - wl[i]['end'] < 0.35: wl[i]['end'] = wl[i+1]['start']
    out.append(dict(i=li, text=text, start=wl[0]['start'], end=wl[-1]['end'], words=wl))
    print(li, ' '.join(f"{w['w']}@{w['start']:.2f}-{w['end']:.2f}({w['conf']:.2f})" for w in wl), flush=True)
json.dump(dict(lines=out), open('lyrics_raw.json','w'), indent=1)
