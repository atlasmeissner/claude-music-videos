"""faster-whisper word timestamps on the vocal stem (cross-check) -> work/whisper.json"""
import common, json
from faster_whisper import WhisperModel
import soundfile as sf
m = WhisperModel("small.en", device="cpu", compute_type="int8", cpu_threads=2)
y, sr = common.load_stem("vocals", sr=16000)
init = " ".join(t for _, t in common.load_lyrics()[:8])
segs, info = m.transcribe(y, language="en", word_timestamps=True, vad_filter=False, initial_prompt=init, condition_on_previous_text=False)
out = [dict(start=s.start, end=s.end, text=s.text, words=[dict(w=w.word, start=w.start, end=w.end, p=w.probability) for w in s.words]) for s in segs]
json.dump(out, open(common.WORK / "whisper.json", "w"), indent=1)
for s in out: print(f"{s['start']:7.2f} {s['end']:7.2f} {s['text']}")
