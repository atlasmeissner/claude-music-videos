"""Word-level lyric alignment for the Dominoes video.

1. Whisper (faster-whisper, word timestamps) on the vocal stem finds where each
   lyric line is sung.
2. CTC forced alignment (torchaudio MMS_FA) aligns the known words of each line
   inside a window around the Whisper estimate.
3. The two estimates are cross-checked; CTC wins unless it is implausible.

    uv run python align.py --vocals ../../work/stems/htdemucs/dominoes/vocals.wav
"""
import argparse
import json
import re
from difflib import SequenceMatcher
from pathlib import Path

import numpy as np
import torch
import torchaudio

SR = 16000


def load_lyrics(path):
    sections, lines = [], []
    cur = None
    for raw in Path(path).read_text().splitlines():
        raw = raw.strip()
        if not raw or raw.startswith("#"):
            continue
        m = re.match(r"\[(.+)\]", raw)
        if m:
            cur = m.group(1)
            continue
        hint = None
        if "|" in raw:
            raw, h = raw.split("|")
            raw = raw.strip()
            hint = [float(x) for x in h.split()]
        lines.append({"section": cur, "text": raw, "words": raw.split(), "hint": hint})
    return lines


def norm(w):
    w = w.lower().replace("’", "'")
    return re.sub(r"[^a-z']", "", w)


def run_whisper(vocals, cache):
    if Path(cache).exists():
        return json.loads(Path(cache).read_text())
    from faster_whisper import WhisperModel

    model = WhisperModel("medium.en", device="cpu", compute_type="int8", cpu_threads=2)
    prompt = "Dominoes, dominoes. Every touch becomes a thousand echoes."
    segs, _ = model.transcribe(
        vocals, language="en", word_timestamps=True, vad_filter=False,
        initial_prompt=prompt, condition_on_previous_text=False, beam_size=5,
    )
    words = []
    for s in segs:
        for w in s.words or []:
            words.append({"w": w.word.strip(), "start": round(w.start, 3), "end": round(w.end, 3),
                          "p": round(w.probability, 3)})
    Path(cache).write_text(json.dumps(words, indent=1))
    return words


def match_lines(lines, wwords):
    """Map each lyric word to a whisper word index via a global sequence match."""
    lyr = [(li, wi, norm(w)) for li, l in enumerate(lines) for wi, w in enumerate(l["words"])]
    a = [x[2] for x in lyr]
    b = [norm(w["w"]) for w in wwords]
    sm = SequenceMatcher(a=a, b=b, autojunk=False)
    hit = {}
    for blk in sm.get_matching_blocks():
        for k in range(blk.size):
            hit[blk.a + k] = blk.b + k
    est = []
    for li, l in enumerate(lines):
        idxs = [k for k, x in enumerate(lyr) if x[0] == li]
        times = [(wwords[hit[k]]["start"], wwords[hit[k]]["end"]) for k in idxs if k in hit]
        est.append({"start": min(t[0] for t in times) if times else None,
                    "end": max(t[1] for t in times) if times else None,
                    "matched": len(times), "n": len(idxs)})
    return est, hit, lyr


class CTC:
    def __init__(self):
        b = torchaudio.pipelines.MMS_FA
        self.model = b.get_model(with_star=True).eval()
        self.dict = b.get_dict(star="*")
        self.bundle = b

    @torch.inference_mode()
    def emissions(self, wav):
        # chunked to bound memory: 20 s windows with 1 s context each side
        win, ctx = 20 * SR, 1 * SR
        outs = []
        frames_per_sample = None
        pos = 0
        n = wav.shape[1]
        while pos < n:
            a, b = max(0, pos - ctx), min(n, pos + win + ctx)
            em, _ = self.model(wav[:, a:b])
            fr = em.shape[1] / (b - a)
            frames_per_sample = fr
            s = int(round((pos - a) * fr))
            e = s + int(round(min(win, n - pos) * fr))
            outs.append(em[:, s:e])
            pos += win
        em = torch.cat(outs, dim=1)
        return torch.log_softmax(em, dim=-1), frames_per_sample

    def align(self, em, fps, t0, t1, words):
        a, b = int(t0 * SR * fps), int(t1 * SR * fps)
        seg = em[:, a:b]
        toks = [[self.dict[c] for c in norm(w).replace("'", "") if c in self.dict] for w in words]
        # a <star> token between words absorbs held vowels, breaths and backing vocals
        star = self.dict["*"]
        flat = [star]
        for w in toks:
            flat += w + [star]
        if seg.shape[1] < len(flat) * 2 + 2:
            return None
        labels, scores = torchaudio.functional.forced_align(
            seg, torch.tensor([flat], dtype=torch.int32), blank=0)
        spans = torchaudio.functional.merge_tokens(labels[0], scores[0].exp())
        spans = [sp for sp in spans if sp.token != star]
        out, k = [], 0
        sec = 1.0 / (SR * fps)
        for w, tk in zip(words, toks):
            ws = spans[k:k + len(tk)]
            k += len(tk)
            st = t0 + ws[0].start * sec
            en = t0 + ws[-1].end * sec
            conf = float(np.mean([s.score for s in ws]))
            syl = None
            out.append({"w": w, "start": round(st, 3), "end": round(en, 3), "conf": round(conf, 2),
                        "chars": [[round(t0 + s.start * sec, 3), round(t0 + s.end * sec, 3)] for s in ws]})
        return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--vocals", required=True)
    ap.add_argument("--lyrics", default="../lyrics/lyrics.txt")
    ap.add_argument("--whisper-cache", default="../../work/whisper.json")
    ap.add_argument("--out", default="../data/lyrics.json")
    a = ap.parse_args()

    lines = load_lyrics(a.lyrics)
    wwords = run_whisper(a.vocals, a.whisper_cache)
    est, hit, lyr = match_lines(lines, wwords)
    for l, e in zip(lines, est):
        print(f"{e['start']}\t{e['end']}\t{e['matched']}/{e['n']}\t{l['text']}")

    for l, e in zip(lines, est):
        if l["hint"]:
            e["start"], e["end"] = l["hint"]
            e["hinted"] = True
    # fill missing line estimates by interpolation between neighbours
    for i, e in enumerate(est):
        if e["start"] is None:
            prev = next((est[j]["end"] for j in range(i - 1, -1, -1) if est[j]["end"]), 0)
            nxt = next((est[j]["start"] for j in range(i + 1, len(est)) if est[j]["start"]), prev + 6)
            e["start"], e["end"] = prev + 0.2, nxt - 0.2

    wav, sr = torchaudio.load(a.vocals)
    wav = torchaudio.functional.resample(wav.mean(0, keepdim=True), sr, SR)
    ctc = CTC()
    em, fps = ctc.emissions(wav)

    out_lines = []
    for i, (l, e) in enumerate(zip(lines, est)):
        prev_end = out_lines[-1]["end"] if out_lines else 0.0
        nxt = est[i + 1]["start"] if i + 1 < len(est) else e["end"] + 3
        if e.get("hinted"):
            t0, t1 = max(prev_end, e["start"]), e["end"]
        else:
            t0 = max(prev_end - 0.1, e["start"] - 0.6)
            t1 = min(nxt + 0.3, e["end"] + 1.0)
        words = ctc.align(em, fps, t0, t1, l["words"])
        out_lines.append({"i": i, "section": l["section"], "text": l["text"],
                          "start": words[0]["start"], "end": words[-1]["end"], "words": words,
                          "whisper": [e["start"], e["end"]]})
    Path(a.out).write_text(json.dumps({"lines": out_lines}, indent=1))
    for l in out_lines:
        print(f"{l['start']:7.2f} {l['end']:7.2f}  (wh {l['whisper'][0]}-{l['whisper'][1]})  {l['text']}")
        print("   ", " ".join(f"{w['w']}@{w['start']:.2f}[{w['conf']}]" for w in l["words"]))


if __name__ == "__main__":
    main()
