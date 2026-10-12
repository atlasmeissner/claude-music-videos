import json, time, os, urllib.request, urllib.parse, io
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
UA = "JoburgalexMV/1.0 (music video; atlas@meissners.xyz)"
Q = json.load(open('queries_cma.json'))
os.makedirs('cand', exist_ok=True)
meta = json.load(open('cand.json'))
def get(url):
    for k in range(3):
        try: return urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=60).read()
        except Exception as e:
            if k == 2: raise
            time.sleep(4)
for tag, q, n in Q:
    if any(m['query']==q and m.get('provider')=='cma' for m in meta.values()): continue
    d = json.loads(get("https://openaccess-api.clevelandart.org/api/artworks/?" + urllib.parse.urlencode({'q': q, 'cc0': 1, 'has_image': 1, 'limit': n*2})))
    got = 0
    for r in d['data']:
        if got >= n: break
        iid = f"cma{r['id']}"
        if iid in meta: continue
        im_ = r.get('images') or {}
        src = (im_.get('print') or im_.get('web') or {}).get('url')
        if not src: continue
        try:
            im = Image.open(io.BytesIO(get(src))).convert('RGB'); im.thumbnail((2048, 2048))
        except Exception as e: print(' fail', src, e); continue
        if min(im.size) < 500: continue
        fn = f"cand/{tag}__{iid}.jpg"; im.save(fn, quality=88)
        meta[iid] = dict(tag=tag, query=q, file=fn, title=r['title'], creator='; '.join(c.get('description','') for c in r.get('creators',[])),
            date=r.get('creation_date'), license='cc0', license_version='1.0', license_url='https://creativecommons.org/publicdomain/zero/1.0/',
            source='Cleveland Museum of Art Open Access', provider='cma', landing=r.get('url'), url=src, type=r.get('type'), size=list(im.size))
        got += 1
    print(f'{tag:10s} {q:35s} {got}', flush=True)
    json.dump(meta, open('cand.json','w'), indent=1)
