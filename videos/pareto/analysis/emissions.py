"""Frame-wise CTC log-probs (20 ms) of the vocal stem from MMS_FA and wav2vec2 LV60K -> work/emission_<model>[_src].npy"""
import common, sys, numpy as np, torch, torchaudio
torch.set_num_threads(2)
HOP = 320
def compute(name, source="vocals", chunk_s=20.0, ctx_s=3.0):
    bundle = {"mms": torchaudio.pipelines.MMS_FA, "lv60k": torchaudio.pipelines.WAV2VEC2_ASR_LARGE_LV60K_960H}[name]
    model = (bundle.get_model(with_star=False) if name == "mms" else bundle.get_model()).eval()
    y, sr = common.load_vocal_source(source, sr=16000)
    y = y / (np.abs(y).max() + 1e-9)
    n = len(y) // HOP; chunk, ctx = int(chunk_s * 16000), int(ctx_s * 16000); out = None
    for s in range(0, len(y), chunk):
        a, b = max(0, s - ctx), min(len(y), s + chunk + ctx)
        with torch.inference_mode():
            em, _ = model(torch.from_numpy(y[a:b]).float()[None])
            em = torch.log_softmax(em, -1)[0].numpy()
        if out is None: out = np.full((n, em.shape[1]), np.nan, np.float32)
        f0 = a // HOP; lo, hi = s // HOP, min(n, (s + chunk) // HOP)
        seg = em[lo - f0: hi - f0]; out[lo: lo + len(seg)] = seg
    last = np.where(~np.isnan(out[:, 0]))[0].max(); out[last + 1:] = out[last]
    tag = name if source == "vocals" else f"{name}_{source}"
    np.save(common.WORK / f"emission_{tag}.npy", out); print(tag, out.shape, flush=True)
if __name__ == "__main__":
    for src in (sys.argv[1:] or ["vocals"]):
        for m in ("mms", "lv60k"): compute(m, src)
