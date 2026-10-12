import json, sys, time, os, urllib.request, urllib.parse, hashlib, io
from PIL import Image
UA = "JoburgalexMV/1.0 (music video; atlas@meissners.xyz)"
Q = json.load(open('queries.json'))
out = 'cand'; os.makedirs(out, exist_ok=True)
meta = json.load(open('cand.json')) if os.path.exists('cand.json') else {}
def get(url, tries=4):
    for k in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            return urllib.request.urlopen(req, timeout=40).read()
        except Exception as e:
            if k == tries-1: raise
            time.sleep(6*(k+1))
for tag, q, n in Q:
    if any(m['query']==q for m in meta.values()): continue
    url = "https://api.openverse.org/v1/images/?" + urllib.parse.urlencode({'q': q, 'page_size': 20, 'license': 'cc0,pdm,by', 'mature': 'false'})
    try: d = json.loads(get(url))
    except Exception as e: print('Q FAIL', q, e); continue
    got = 0
    for r in d['results']:
        if got >= n: break
        if (r.get('width') or 0) < 900: continue
        iid = r['id'][:8]
        fn = f"{out}/{tag}__{iid}.jpg"
        if iid in meta: continue
        try:
            u = r['url']
            if 'upload.wikimedia.org/wikipedia/commons/' in u and '/thumb/' not in u:
                tail = u.split('/wikipedia/commons/')[1]
                name = tail.split('/')[-1]
                w = 1920 if (r.get('width') or 0) > 1920 else 1280
                if (r.get('width') or 0) <= 1280: w = 960
                u = f"https://upload.wikimedia.org/wikipedia/commons/thumb/{tail}/{w}px-{name}" + ('.jpg' if name.lower().endswith(('.tif','.tiff','.pdf')) else '')
            raw = get(u, 2)
            time.sleep(1.0)
            im = Image.open(io.BytesIO(raw)).convert('RGB')
            if min(im.size) < 600: continue
            im.thumbnail((2048, 2048))
            im.save(fn, quality=88)
        except Exception as e:
            print('  img fail', r['url'][:80], e); continue
        meta[iid] = dict(tag=tag, query=q, file=fn, title=r.get('title'), creator=r.get('creator'), creator_url=r.get('creator_url'),
                         license=r['license'], license_version=r.get('license_version'), license_url=r.get('license_url'),
                         source=r.get('source'), provider=r.get('provider'), landing=r.get('foreign_landing_url'), url=r['url'],
                         attribution=r.get('attribution'), size=list(im.size))
        got += 1
    print(f'{tag:10s} {q:35s} {got}/{len(d["results"])}', flush=True)
    json.dump(meta, open('cand.json','w'), indent=1)
    time.sleep(3.5)
