"""Demucs htdemucs vocal/drums/bass/other stems -> stems/*.wav (CPU)."""
import numpy as np, soundfile as sf, librosa, torch
from demucs.pretrained import get_model
from demucs.apply import apply_model
torch.set_num_threads(2)
y, sr = librosa.load("../audio/pareto.mp3", sr=44100, mono=False)
m = get_model("htdemucs"); m.eval()
x = torch.from_numpy(y).float()[None]
ref = x.mean(1).mean(); std = x.mean(1).std()
with torch.inference_mode():
    out = apply_model(m, (x - ref) / std, device="cpu", shifts=0, split=True, overlap=0.15, progress=True)[0]
out = out * std + ref
for name, s in zip(m.sources, out):
    sf.write(f"stems/{name}.wav", s.numpy().T, 44100)
print("done", m.sources)
