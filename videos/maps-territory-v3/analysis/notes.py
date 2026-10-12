"""Vocal note segmentation (pYIN pitch on the vocal stem + spectral-flux onsets) for a time range: QA for
syllable timing where the CTC alignment is unsure (choruses with backing vocals)."""
import sys, numpy as np, soundfile as sf, librosa
A = sys.argv[1]; t0, t1 = float(sys.argv[2]), float(sys.argv[3])
y, sr = sf.read(f"{A}/work/vocals16.wav", dtype="float32")
seg = y[int(t0*sr):int(t1*sr)]
hop = 160
f0, vf, vp = librosa.pyin(seg, fmin=110, fmax=900, sr=sr, frame_length=1024, hop_length=hop)
on = librosa.onset.onset_strength(y=seg, sr=sr, hop_length=hop)
on = on / (np.percentile(on, 99) + 1e-9)
midi = librosa.hz_to_midi(f0)
rms = librosa.feature.rms(y=seg, frame_length=1024, hop_length=hop)[0]; rms /= np.percentile(rms, 98)
# print segments of stable pitch (rounded semitone), voiced
cur = None; st = 0
def flush(i):
    if cur is not None and i - st >= 4:
        a = t0 + st * hop / sr; b = t0 + i * hop / sr
        pk = np.max(on[max(0, st-3):st+4]) if st < len(on) else 0
        print(f"{a:7.2f}-{b:6.2f} {librosa.midi_to_note(cur):>4s} onset {pk:.2f} lvl {rms[st:i].mean():.2f}")
for i, m in enumerate(midi):
    n = None if np.isnan(m) else int(round(m))
    if n != cur:
        flush(i); cur = n; st = i
flush(len(midi))
