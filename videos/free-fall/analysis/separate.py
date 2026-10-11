"""Vocal / instrumental separation -> stems/vocals.wav, stems/instrumental.wav

UVR MDX-Net "Kim_Vocal_2" (ONNX, CPU) through python-audio-separator. (The pdoom/one-degree pipeline used Demucs
htdemucs; its weights host is not reachable from the render container, so this video uses the MDX vocal model,
whose weights are published as GitHub release assets.) Drums are derived from the instrumental by HPSS in
analyze.py.
Run:  python separate.py MIX_WAV
"""
import shutil, sys
from pathlib import Path
from audio_separator.separator import Separator

mix = sys.argv[1]
here = Path(__file__).parent
sep = Separator(output_dir=str(here / "stems"), model_file_dir=str(here / ".cache"), output_format="WAV")
sep.load_model(model_filename="Kim_Vocal_2.onnx")
files = sep.separate(mix)
for f in files:
    p = here / "stems" / Path(f).name
    name = "vocals.wav" if "(Vocals)" in p.name else "instrumental.wav"
    shutil.move(str(p), str(here / "stems" / name))
    print(name)
