"""Music analysis -> data/audio.json (tempo grid, downbeats, sections, envelopes, onsets).

Inputs (not in the repo): the song, the UVR-MDX vocal stem and the htdemucs_ft stems
(drums/bass/other) in ANA_DIR. Constant tempo fitted on the drum-stem onset envelope.
"""
import json, os, sys, glob
import numpy as np, librosa, scipy.signal as ss

ANA = os.environ.get('ANA_DIR', '/home/claude/ana')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 22050
FPS = 100
def load(p):
    y, _ = librosa.load(p, sr=SR, mono=True); return y
mix = load(f'{ANA}/song.wav')
stem = lambda n: glob.glob(f'{ANA}/stems/*({n})*htdemucs*.wav') or glob.glob(f'{ANA}/stems/*({n})*.wav')
voc = load(stem('Vocals')[0]) if stem('Vocals') else load(f'{ANA}/vocals.wav')
if stem('Drums'):
    drums = load(stem('Drums')[0]); bass = load(stem('Bass')[0]); other = load(stem('Other')[0])
else:  # provisional: no drum stems yet
    inst = load(stem('Instrumental')[0]); drums = bass = other = inst
dur = len(mix) / SR
hop = SR // FPS

def env(y, smooth=3):
    r = librosa.feature.rms(y=y, frame_length=hop * 4, hop_length=hop, center=True)[0]
    r = np.convolve(r, np.ones(smooth) / smooth, mode='same')
    return r / (np.percentile(r, 99.5) + 1e-9)
def band(y, lo, hi):
    S = np.abs(librosa.stft(y, n_fft=2048, hop_length=hop))
    f = librosa.fft_frequencies(sr=SR, n_fft=2048)
    e = np.sqrt((S[(f >= lo) & (f < hi)] ** 2).mean(0))
    e = np.convolve(e, np.ones(3) / 3, mode='same')
    return e / (np.percentile(e, 99.5) + 1e-9)

# ---- tempo: constant grid fitted on drum onsets
hop2 = 128; fr = SR / hop2
oenv = librosa.onset.onset_strength(y=drums, sr=SR, hop_length=hop2)
oenv_mix = librosa.onset.onset_strength(y=mix, sr=SR, hop_length=hop2)
oe = oenv / oenv.max() + 0.5 * oenv_mix / oenv_mix.max()
def score(bpm, ph, t0=15, t1=210):
    per = 60 / bpm
    ts = np.arange(t0 + ph, t1, per)
    return np.interp(ts * fr, np.arange(len(oe)), oe).mean()
best = (0, 0, 0)
for bpm in np.arange(159.8, 161.2, 0.01):
    per = 60 / bpm
    for ph in np.linspace(0, per, 75, endpoint=False):
        s = score(bpm, ph)
        if s > best[0]: best = (s, bpm, ph)
_, bpm, ph = best
per = 60 / bpm
print('bpm', bpm, 'phase', ph)
beats = np.arange(ph, dur, per)
# downbeat phase: kick (drum low band) energy on beat k mod 4 + vocal line starts
kick_env = band(drums, 20, 140)
lines = json.load(open(f'{ROOT}/data/lyrics.json'))['lines']
def kick_at(t): return kick_env[min(len(kick_env) - 1, int(t * FPS))]
sc = []
for k in range(4):
    db = beats[k::4]
    sc.append(np.mean([kick_at(t) for t in db if 20 < t < 210]))
print('kick by beat phase', np.round(sc, 3))
k0 = int(np.argmax(sc))
downbeats = beats[k0::4]

# ---- onsets
def onsets(y, lo, hi, delta=0.12, wait=0.07):
    S = np.abs(librosa.stft(y, n_fft=1024, hop_length=hop2))
    f = librosa.fft_frequencies(sr=SR, n_fft=1024)
    sub = S[(f >= lo) & (f < hi)]
    o = librosa.onset.onset_strength(S=librosa.amplitude_to_db(sub), sr=SR, hop_length=hop2)
    o = o / (o.max() + 1e-9)
    pk = librosa.util.peak_pick(o, pre_max=3, post_max=3, pre_avg=10, post_avg=10, delta=delta, wait=int(wait * fr))
    return [[round(p / fr, 3), round(float(min(1, o[p] * 1.4)), 3)] for p in pk]
ons = {
    'kick': onsets(drums, 30, 150, 0.15, 0.1),
    'snare': onsets(drums, 900, 5000, 0.15, 0.1),
    'hat': onsets(drums, 7000, 11000, 0.1, 0.05),
    'vocal': [[w['start'], 1.0] for l in lines for w in l['words']],
}
print({k: len(v) for k, v in ons.items()})

# ---- sections (from the lyric structure, snapped to downbeats)
def snap(t):
    return float(downbeats[np.argmin(np.abs(downbeats - t))])
L = lines
sec = [
    ('intro', 0.0, snap(L[0]['start'] - 1)),
    ('verse1', None, snap(L[4]['start'] - 0.5)),
    ('pre1', None, snap(L[6]['start'] - 0.2)),
    ('chorus1', None, snap(L[9]['end'] + 1)),
    ('break1', None, snap(L[10]['start'] - 0.5)),
    ('verse2', None, snap(L[14]['start'] - 0.3)),
    ('pre2', None, snap(L[16]['start'] - 0.2)),
    ('chorus2', None, snap(L[19]['end'] + 1)),
    ('bridge', None, snap(L[22]['end'] + 1.5)),
    ('climb', None, snap(L[23]['start'] - 0.2)),
    ('chorus3', None, snap(L[26]['end'] + 0.5)),
    ('outro', None, dur),
]
sections = []
for i, (n, a, b) in enumerate(sec):
    a = sections[-1]['end'] if a is None else a
    sections.append(dict(name=n, start=round(a, 3), end=round(b, 3)))
for s in sections: print(s)

feat = dict(rms=env(mix), low=band(mix, 20, 200), mid=band(mix, 200, 2500), high=band(mix, 2500, 11000),
            vocal=env(voc), drums=env(drums), bass=env(bass), other=env(other))
n = int(dur * FPS)
out = dict(duration=round(dur, 3), bpm=round(float(bpm), 3), beat_period=round(per, 5), time_signature=4,
           beats=[round(float(b), 3) for b in beats], downbeats=[round(float(b), 3) for b in downbeats],
           sections=sections, fps=FPS, **{k: [round(float(x), 3) for x in v[:n]] for k, v in feat.items()}, onsets=ons,
           notes='Constant tempo fitted on htdemucs_ft drum-stem + mix onset envelopes; downbeat phase from kick energy. Envelopes normalised to the 99.5th percentile (0..1+).')
json.dump(out, open(f'{ROOT}/data/audio.json', 'w'))
print('wrote', f'{ROOT}/data/audio.json')
