"""The atlas sheet for the outro's index: every plate in one texture (16 x 12 cells of 240 x 160), in plate
order, from app/public/cc/manifest.json. Plates that show a sign (WRONG WAY, DEAD END) are not shown in the
video (revision 3: no signs anywhere); their cells show another plate instead."""
import json, os
from PIL import Image, ImageOps
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = f'{ROOT}/app/public/cc'
man = json.load(open(f'{out}/manifest.json'))
NO_SIGNS = {'66159111', '92852d3d', '29335d30', '4894723b', 'a352ef17', '6d2ad4d3'}
SUBST = ['cma423521', 'cma423516', 'cma423523', 'ca21b201', 'c00ef074', '33f4b2d9']
CW, CH, COLS, ROWS = 240, 160, 16, 12
sheet = Image.new('RGB', (CW * COLS, CH * ROWS), (20, 20, 20))
k = 0
for i, (pid, m) in enumerate(sorted(man.items(), key=lambda kv: kv[1]['plate'])):
    if i >= COLS * ROWS: break
    if pid in NO_SIGNS:
        pid = SUBST[k % len(SUBST)]; k += 1
    im = ImageOps.fit(Image.open(f"{out}/{man[pid]['file']}").convert('RGB'), (CW, CH), Image.LANCZOS)
    sheet.paste(im, ((i % COLS) * CW, (i // COLS) * CH))
sheet.save(f'{out}/atlas.jpg', quality=88)
json.dump({'cols': COLS, 'rows': ROWS, 'n': min(len(man), COLS * ROWS)}, open(f'{out}/atlas.json', 'w'))
print('atlas rebuilt;', k, 'sign cells replaced')
