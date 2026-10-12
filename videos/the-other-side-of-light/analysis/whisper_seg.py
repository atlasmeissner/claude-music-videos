import json, sys, librosa
from faster_whisper import WhisperModel
m = WhisperModel("deepdml/faster-whisper-large-v3-turbo-ct2", device="cpu", compute_type="int8", cpu_threads=2)
audio,_ = librosa.load("vocals.wav", sr=16000, mono=True)
for a,b in [(18,34),(150,200),(194,230)]:
    segs,_ = m.transcribe(audio[int(a*16000):int(b*16000)], language="en", word_timestamps=True, condition_on_previous_text=False, beam_size=5, temperature=0)
    print(f'== {a}-{b}')
    for s in segs:
        print(' '.join(f"{w.word.strip()}@{w.start+a:.2f}-{w.end+a:.2f}" for w in s.words), flush=True)
