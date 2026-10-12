"""Whisper word timestamps on the Demucs vocal stem (coarse line placement and cross-check).
Run:  WORK=../work python whisper_run.py [model] [out-name]   (models: medium.en, large-v3)"""
import json, os, sys
from pathlib import Path
W = Path(os.environ["WORK"])
from faster_whisper import WhisperModel
import soundfile as sf
model = sys.argv[1] if len(sys.argv) > 1 else "medium.en"
name = sys.argv[2] if len(sys.argv) > 2 else "whisper"
m = WhisperModel(model, device="cpu", compute_type="int8", cpu_threads=2)
audio, _ = sf.read(str(W / "vocals16.wav"), dtype="float32")
segs, info = m.transcribe(audio, language="en", word_timestamps=True, vad_filter=False, beam_size=5,
                          condition_on_previous_text=False,
                          initial_prompt="Take me down to the bones. Strip the gold and the stone. Build it up from the bones.")
out = []
for s in segs:
    out.append({"start": s.start, "end": s.end, "text": s.text,
                "words": [{"w": w.word, "start": w.start, "end": w.end, "p": w.probability} for w in s.words]})
    print(f"{s.start:7.2f} {s.end:7.2f} {s.text}", flush=True)
(W / f"{name}.json").write_text(json.dumps(out, indent=1))
