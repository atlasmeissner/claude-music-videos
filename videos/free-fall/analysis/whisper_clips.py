"""Whisper large-v3 on the unclear regions of the vocal stem (intro ad-lib, post-chorus chant, outro), no prompt.
Run:  WORK=work python whisper_clips.py
"""
import json, os
from pathlib import Path
import soundfile as sf
from faster_whisper import WhisperModel
W = Path(os.environ.get("WORK", "work"))
m = WhisperModel("large-v3", device="cpu", compute_type="int8", cpu_threads=2, download_root=str(Path(__file__).parent / ".cache"))
audio, sr = sf.read(str(W / "vocals16.wav"), dtype="float32")
out = {}
for a, b in [(8, 40), (100, 122), (150, 180)]:
    segs, _ = m.transcribe(audio[a * sr:b * sr], language="en", word_timestamps=True, vad_filter=False, beam_size=5, condition_on_previous_text=False)
    res = []
    for s in segs:
        ws = [(w.word.strip(), round(a + w.start, 2), round(a + w.end, 2), round(w.probability, 2)) for w in s.words]
        res.append(ws)
        print(f"[{a}-{b}] " + " ".join(f"{w}@{s_:.2f}({p})" for w, s_, e, p in ws), flush=True)
    out[f"{a}-{b}"] = res
(W / "whisper_clips.json").write_text(json.dumps(out, indent=1))
