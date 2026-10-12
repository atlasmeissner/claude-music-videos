"""Copy the selected Creative Commons / CC0 images into app/public/cc (resized) and write
app/public/cc/manifest.json and CREDITS.md. Candidates and their metadata come from fetch_openverse.py /
fetch_cma.py (cand.json)."""
import json, os, sys
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAND = os.environ.get('CAND_DIR', '/home/claude/cc')
meta = json.load(open(f'{CAND}/cand.json'))
ids, groups, g = [], {}, None
for l in open(f'{ROOT}/analysis/selection.txt'):
    if l.startswith('## '): g = l[3:].strip(); continue
    if l.startswith('#'): continue
    for x in l.split(): ids.append(x); groups[x] = g
out = f'{ROOT}/app/public/cc'; os.makedirs(out, exist_ok=True)
man = {}
LIC = {'cc0': ('CC0 1.0', 'https://creativecommons.org/publicdomain/zero/1.0/'), 'pdm': ('Public Domain Mark 1.0', 'https://creativecommons.org/publicdomain/mark/1.0/')}
for n, i in enumerate(ids, 1):
    m = meta[i]
    im = Image.open(f"{CAND}/{m['file']}").convert('RGB')
    im.thumbnail((1600, 1600), Image.LANCZOS)
    fn = f'{i}.jpg'
    im.save(f'{out}/{fn}', quality=86, optimize=True)
    import numpy as np
    a = np.asarray(im.resize((256, int(256 * im.size[1] / im.size[0]))), dtype=np.float32) / 255.0
    lin = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
    lum = lin @ np.array([0.2126, 0.7152, 0.0722])
    pc = [round(float(np.percentile(lum, q)), 4) for q in (2, 50, 98)]
    lic = m['license'].lower()
    ver = m.get('license_version') or ''
    lname, lurl = LIC.get(lic, (f"CC {lic.upper()} {ver}".strip(), m.get('license_url') or f'https://creativecommons.org/licenses/{lic}/{ver}/'))
    man[i] = dict(id=i, file=fn, w=im.size[0], h=im.size[1], title=(m.get('title') or 'Untitled').strip(), creator=(m.get('creator') or 'Unknown').strip(),
                  license=lic, license_name=lname, license_url=lurl, source=m.get('source') or m.get('provider'), landing=m.get('landing'), plate=n, scene=groups[i], lum=pc)
json.dump(man, open(f'{out}/manifest.json', 'w'), indent=1)
with open(f'{ROOT}/CREDITS.md', 'w') as f:
    f.write('# Image credits\n\nEvery picture in the video is a Creative Commons licensed or CC0 / public-domain image, shown as a numbered plate (PL.) of the atlas. '
            'All were processed (cropped, recoloured into the video\'s palette, inverted, engraved, animated). '
            'Licences: CC BY (attribution), CC0 (public domain dedication) and the Public Domain Mark. No NC or ND licences were used.\n\n'
            '| PL. | Title | Creator | Licence | Source |\n|---|---|---|---|---|\n')
    for i, m in man.items():
        t = m['title'].replace('|', '/'); c = m['creator'].replace('|', '/')
        f.write(f"| {m['plate']} | {t} | {c} | [{m['license_name']}]({m['license_url']}) | [{m['source']}]({m['landing']}) |\n")
print(len(man), 'images;', sum(os.path.getsize(f'{out}/{m["file"]}') for m in man.values()) / 1e6, 'MB')
from collections import Counter; print(Counter(m['license'] for m in man.values()))

# the atlas sheet: every plate in one texture (16 x 12 cells of 240 x 160), in plate order, for the outro's mosaic
from PIL import ImageOps
CW, CH, COLS, ROWS = 240, 160, 16, 12
sheet = Image.new('RGB', (CW * COLS, CH * ROWS), (20, 20, 20))
for i, (k, m) in enumerate(man.items()):
    if i >= COLS * ROWS: break
    im = Image.open(f"{out}/{m['file']}").convert('RGB')
    im = ImageOps.fit(im, (CW, CH), Image.LANCZOS)
    sheet.paste(im, ((i % COLS) * CW, (i // COLS) * CH))
sheet.save(f'{out}/atlas.jpg', quality=88)
man_atlas = {'cols': COLS, 'rows': ROWS, 'n': min(len(man), COLS * ROWS)}
json.dump(man_atlas, open(f'{out}/atlas.json', 'w'))
print('atlas', man_atlas)
