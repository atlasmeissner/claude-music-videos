"""Whisper word timestamps on the vocal stem (a second opinion for align.py / refine.py).

    uv run python whisper_run.py VOCALS.wav MODEL OUT.json
"""
import json
import sys

from faster_whisper import WhisperModel

vocals, model_name, out = sys.argv[1:4]
m = WhisperModel(model_name, device="cpu", compute_type="int8", cpu_threads=2)
segs, _ = m.transcribe(vocals, language="en", word_timestamps=True, vad_filter=False,
                       condition_on_previous_text=False, beam_size=5)
words = []
for s in segs:
    for w in s.words or []:
        words.append({"w": w.word.strip(), "start": round(w.start, 3), "end": round(w.end, 3), "p": round(w.probability, 3)})
json.dump(words, open(out, "w"), indent=1)
print(" ".join(f"{w['w']}@{w['start']:.2f}" for w in words))
