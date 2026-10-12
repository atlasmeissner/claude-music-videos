import sys, soundfile as sf
from faster_whisper import WhisperModel
m = WhisperModel(sys.argv[1], device="cpu", compute_type="int8", cpu_threads=2)
audio, sr = sf.read("/home/claude/work/an/vocals16.wav", dtype="float32")
for rng in sys.argv[2:]:
    a, b = map(float, rng.split('-'))
    segs, _ = m.transcribe(audio[int(a*sr):int(b*sr)], language="en", word_timestamps=True, beam_size=5, condition_on_previous_text=False, vad_filter=False)
    for s in segs:
        print(f"{a+s.start:7.2f} {a+s.end:7.2f} {s.text}  ||", " ".join(f"{w.word.strip()}@{a+w.start:.2f}" for w in s.words), flush=True)
    print('---', flush=True)
