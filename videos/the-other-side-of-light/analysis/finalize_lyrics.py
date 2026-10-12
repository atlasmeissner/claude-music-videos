import json, re, numpy as np, librosa
raw = json.load(open('lyrics_raw.json'))['lines']
wh = [w for s in json.load(open('whisper.json')) for w in s['words']]
norm = lambda s: re.sub(r"[^a-z']", "", s.lower())
y, sr = librosa.load('vocals.wav', sr=16000)
hop = 160
rms = librosa.feature.rms(y=y, frame_length=640, hop_length=hop)[0]
rms = rms / np.percentile(rms, 99)
env = lambda t: rms[min(len(rms)-1, max(0, int(t*100)))]
on = librosa.onset.onset_detect(y=y, sr=sr, hop_length=hop, units='time', backtrack=False)
fixes = []
WHITELIST = {(4,'by'), (26,'I'), (26,'left')}
MANUAL = {(25,'anymore'): 186.0, (4,'name'): 52.0}
for L in raw:
    for i, w in enumerate(L['words']):
        cands = [x for x in wh if norm(x['w']) == norm(w['w']) and abs(x['start'] - w['start']) < 1.2]
        if (L['i'], w['w']) in WHITELIST and cands:
            c = min(cands, key=lambda x: abs(x['start'] - w['start']))
            if abs(c['start'] - w['start']) > 0.3 and c['end'] - c['start'] < 2.5:
                fixes.append((L['i'], w['w'], w['start'], c['start']))
                w['start'] = round(c['start'], 3)
        if (L['i'], w['w']) in MANUAL: w['start'] = MANUAL[(L['i'], w['w'])]
        # snap to vocal onset within 70 ms
        if len(on):
            o = on[np.argmin(abs(on - w['start']))]
            if abs(o - w['start']) < 0.07: w['start'] = round(float(o), 3)
    ws = L['words']
    for i in range(len(ws)):
        if i+1 < len(ws): ws[i]['end'] = max(ws[i]['start'] + 0.08, ws[i+1]['start']) if ws[i+1]['start'] - ws[i]['end'] < 0.35 else ws[i]['end']
        ws[i]['end'] = max(ws[i]['end'], ws[i]['start'] + 0.08)
    # monotone
    for i in range(1, len(ws)):
        if ws[i]['start'] < ws[i-1]['start'] + 0.05: ws[i]['start'] = round(ws[i-1]['start'] + 0.05, 3)
        if ws[i-1]['end'] > ws[i]['start']: ws[i-1]['end'] = ws[i]['start']
# special: final chorus 'So' (CTC put it in the 'oh' vocalise)
L23 = raw[23]; L23['words'][0]['start'] = round(L23['words'][1]['start'] - 0.42, 3); L23['words'][0]['end'] = L23['words'][1]['start']
# extend last word of each line through the held note (vocal energy), not into the next line
for k, L in enumerate(raw):
    lw = L['words'][-1]
    nxt = raw[k+1]['words'][0]['start'] if k+1 < len(raw) else lw['end'] + 3
    lvl = np.median([env(t) for t in np.arange(L['words'][0]['start'], lw['end'], 0.01)])
    t = lw['end']
    while t < min(nxt - 0.12, lw['end'] + 2.5) and env(t) > 0.35 * lvl: t += 0.01
    lw['end'] = round(max(lw['end'], t), 3)
    L['start'] = L['words'][0]['start']; L['end'] = lw['end']
    L['text'] = ' '.join(w['w'] for w in L['words'])
print(fixes)
for L in raw: print(L['i'], f"{L['start']:.2f}-{L['end']:.2f}", ' '.join(f"{w['w']}@{w['start']:.2f}" for w in L['words']))
json.dump(dict(lines=raw, extras=[], notes="Word timings: wav2vec2-large-960h-lv60-self CTC forced alignment on the UVR-MDX vocal stem within per-line windows from faster-whisper large-v3-turbo; low-confidence words cross-checked with whisper; starts snapped to vocal onsets."), open('lyrics.json','w'), indent=1)
