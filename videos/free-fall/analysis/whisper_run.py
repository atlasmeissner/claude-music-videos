"""Whisper word timestamps on the vocal stem (coarse line placement and cross-check).
Run:  WORK=work python whisper_run.py [model]
"""
import json, os, sys
from pathlib import Path
import soundfile as sf
from faster_whisper import WhisperModel

W = Path(os.environ.get("WORK", "work"))
name = sys.argv[1] if len(sys.argv) > 1 else "medium.en"
m = WhisperModel(name, device="cpu", compute_type="int8", cpu_threads=2, download_root=str(Path(__file__).parent / ".cache"))
audio, _ = sf.read(str(W / "vocals16.wav"), dtype="float32")
segs, info = m.transcribe(audio, language="en", word_timestamps=True, vad_filter=False, beam_size=5,
                          condition_on_previous_text=False,
                          initial_prompt="Free fall, free fall. I'd rather fly and hit a wall. They said count the cost before you leap.")
out = []
for s in segs:
    out.append({"start": s.start, "end": s.end, "text": s.text,
                "words": [{"w": w.word, "start": w.start, "end": w.end, "p": w.probability} for w in s.words]})
    print(f"{s.start:7.2f} {s.end:7.2f} {s.text}", flush=True)
(W / f"whisper_{name}.json").write_text(json.dumps(out, indent=1))
