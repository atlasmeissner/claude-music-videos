import json
from faster_whisper import WhisperModel
m = WhisperModel("deepdml/faster-whisper-large-v3-turbo-ct2", device="cpu", compute_type="int8", cpu_threads=2)
import librosa
audio,_ = librosa.load("vocals.wav", sr=16000, mono=True)
segs, info = m.transcribe(audio, language="en", word_timestamps=True, vad_filter=False, beam_size=5,
    initial_prompt="I drew a map of every way to lose. So I'm running to the other side of light.")
out=[]
for s in segs:
    print(f"[{s.start:7.2f}-{s.end:7.2f}] {s.text}", flush=True)
    out.append(dict(start=s.start,end=s.end,text=s.text,words=[dict(w=w.word,start=w.start,end=w.end,p=w.probability) for w in s.words]))
json.dump(out, open('whisper.json','w'), indent=1)
