"""Prave lokacije: Excel klijenta -> lokacije-podaci.json (ono sto mapa na /lokacije cita).

Pokretanje (iz korena projekta):
    python tools/excel-lokacije.py "C:/putanja/do/TOTAL PM.xlsx"

Koraci:
  1. cita Excel (kolone: Source.Name, Client Name, PM, Adress, City, Sales Channel Structure, Distributor)
  2. izbacuje unose koji nisu prodajna mesta (magacini, reprezentacija, sifra kupca 0) i duplikate
  3. geokodira adrese preko MapTiler-a (isti kljuc kao na sajtu); rezultati se cuvaju u
     tools/geo-cache.json, pa ponovno pokretanje ne trosi kvotu — samo nove adrese idu na API
  4. upisuje lokacije-podaci.json; unosi koje geokoder nije nasao do adrese dobijaju "approx": true
     (pin stoji na naselju/opstini) i spisak ide u tools/lokacije-priblizne.txt za rucnu proveru
  5. primenjuje RUCNE ISPRAVKE iz tools/lokacije-ispravke.json (pravi ih stranica /lokacije-korekcija);
     one uvek imaju poslednju rec i prezivljavaju svako sledece osvezavanje Excela

Ispravke poslate sa stranice za korekciju (preuzet fajl), bez ponovnog citanja Excela:
    python tools/excel-lokacije.py --samo-ispravke "C:/Downloads/lokacije-ispravke.json"
Ili uz novi Excel:
    python tools/excel-lokacije.py "TOTAL PM.xlsx" --ispravke "C:/Downloads/lokacije-ispravke.json"
"""
import difflib, hashlib, json, math, os, re, sys, time, unicodedata, urllib.parse, urllib.request
import openpyxl

KEY = 'xCboGTDaRsqFuVgneleh'
CACHE = 'tools/geo-cache.json'
OUT = 'lokacije-podaci.json'
REPORT = 'tools/lokacije-priblizne.txt'
ISPRAVKE = 'tools/lokacije-ispravke.json'   # rucne ispravke pinova (IDE u git)
PUMPE = 'tools/osm-pumpe.json'   # benzinske stanice iz OpenStreetMap-a (kes, ne ide u git)

CYR = dict(zip('АБВГДЂЕЖЗИЈКЛЉМНЊОПРСТЋУФХЦЧЏШабвгдђежзијклљмнњопрстћуфхцчџш',
               ['A','B','V','G','D','Đ','E','Ž','Z','I','J','K','L','Lj','M','N','Nj','O','P','R','S','T','Ć','U','F','H','C','Č','Dž','Š',
                'a','b','v','g','d','đ','e','ž','z','i','j','k','l','lj','m','n','nj','o','p','r','s','t','ć','u','f','h','c','č','dž','š']))
lat = lambda s: ''.join(CYR.get(ch, ch) for ch in (s or ''))
fold = lambda s: ''.join(c for c in unicodedata.normalize('NFD', lat(s).lower()) if unicodedata.category(c) != 'Mn').replace('đ', 'dj')

SMALL = {'i', 'u', 'na', 'od', 'kod', 'za', 'sa', 'do', 'bb', 'b.b.', 'lok.', 'br.'}
def title(s):
    """HERCEGOVACKA 14A -> Hercegovacka 14a ; 'bb' i predlozi ostaju malim slovima."""
    s = re.sub(r'\s+', ' ', (s or '').strip())
    out = []
    for i, w in enumerate(s.split(' ')):
        lw = w.lower()
        if lw in SMALL and i > 0: out.append(lw)
        elif re.match(r'^[ivxlc]+$', lw) and len(lw) <= 4 and i > 0: out.append(w.upper())     # rimski brojevi (Petra I)
        elif re.match(r'^\d', w): out.append(lw)
        else: out.append('-'.join(p[:1].upper() + p[1:].lower() for p in w.split('-')))
    return ' '.join(out)

def clean_city(c):
    """'BEOGRAD - ZEMUN' -> ('Beograd', 'Zemun') ; 'NOVI SAD (Srbija)' -> ('Novi Sad', '')"""
    c = re.sub(r'\(srbija\)', '', c or '', flags=re.I).strip(' ,')
    parts = [p.strip() for p in re.split(r'\s+-\s+', c) if p.strip()]
    main = title(parts[0]) if parts else ''
    sub = title(parts[1]) if len(parts) > 1 and fold(parts[1]) != fold(parts[0]) else ''
    return main, sub

def clean_addr(a):
    a = re.sub(r'\s+', ' ', (a or '').strip())
    a = re.sub(r',?\s*(lok(al)?\.?\s*[\w/-]+|objekat\s*\w+)\s*$', '', a, flags=re.I)   # ", LOK.L1"
    a = re.sub(r'^M\d+\s*-\s*', '', a)                                                  # interna sifra „M100-"
    return a.strip(' ,')

def typ(channel, source, name):
    ch, src, n = fold(channel), fold(source), fold(name)
    if 'petrol' in ch or any(b in src for b in ('nis petrol', 'lukoil', 'sheel', 'shell')): return 'loctype.gas'
    if 'specijalizovana' in ch or 'galaxy' in src or re.search(r'\bvape|vejp', n): return 'loctype.vape'
    if 'tobacco' in ch: return 'loctype.kiosk'
    if 'kiosk' in ch: return 'loctype.kiosk'
    if 'market' in ch: return 'loctype.mini'
    if re.search(r'pumpa|benzin|petrol', n): return 'loctype.gas'
    if re.search(r'kiosk|trafik|duvan', n): return 'loctype.kiosk'
    if re.search(r'market|samousl|prodavnic|\bmini\b|supermark', n): return 'loctype.mini'
    return 'loctype.store'

BRAND = [('nis petrol', 'NIS Petrol'), ('lukoil', 'Lukoil'), ('sheel', 'Shell'), ('shell', 'Shell'), ('galaxy', 'Galaxy Code')]

def geocode(q, cache, center=None):
    """Jedan upit; uz `center` (lng, lat) rezultat se ogranicava na ~35 km oko grada,
    pa ista ulica u drugom gradu (npr. Karadjordjeva u Prijepolju umesto u Kragujevcu) ne prolazi."""
    params = {'key': KEY, 'country': 'rs', 'language': 'sr', 'limit': 1}
    if center:
        lng, la = center
        params['proximity'] = f'{lng:.4f},{la:.4f}'
        params['bbox'] = f'{lng - .45:.4f},{la - .32:.4f},{lng + .45:.4f},{la + .32:.4f}'
    ck = q + ('|' + params['bbox'] if center else '')
    if ck in cache: return cache[ck]
    u = 'https://api.maptiler.com/geocoding/' + urllib.parse.quote(q) + '.json?' + urllib.parse.urlencode(params)
    for attempt in range(3):
        try:
            r = json.load(urllib.request.urlopen(urllib.request.Request(u, headers={'Referer': 'https://vapologic.onrender.com/'}), timeout=20))
            f = r['features'][0] if r.get('features') else None
            cache[ck] = None if not f else {'lng': f['center'][0], 'lat': f['center'][1], 'type': f['place_type'][0],
                                            'rel': f.get('relevance', 0), 'num': bool(f.get('address')), 'name': f.get('place_name', '')}
            time.sleep(0.08)
            return cache[ck]
        except Exception:
            time.sleep(1 + attempt)
    return None

PLACE_TYPES = ('place', 'locality', 'municipal_district', 'municipality', 'joint_municipality', 'postal_code', 'neighbourhood')

def city_center(place, main_city, cache):
    for q in (f'{place}, Srbija', f'{main_city}, Srbija'):
        g = geocode(q, cache)
        if g and g['type'] in PLACE_TYPES and 41.8 < g['lat'] < 46.3 and 18.8 < g['lng'] < 23.1:
            return g
    return None

def norm_num(a):
    """'81 B' -> '81b', '31/A' -> '31a', 'BB/1' -> 'bb' (geokoder bolje razume)"""
    a = re.sub(r'\b(\d+)\s*/?\s*([A-Za-zČĆŠŽĐčćšžđ])\b', r'\1\2', a)
    a = re.sub(r'\bB\.?\s?B\.?(/\d+)?\b', 'bb', a, flags=re.I)
    return re.sub(r'\b(DZ|OBJ\.?\s*\d+)\b', '', a, flags=re.I).strip(' ,')


def street_key(s):
    """'BUL. KRALJA PETRA I 12' -> 'kralja petra i' (bez broja, skracenica i interpunkcije)"""
    s = fold(s)
    s = re.sub(r'\b(ulica|ul|bulevar|bul|blvd|trg|put|br|broj)\b\.?', ' ', s)
    s = re.sub(r'\b\d+\w*\b|\bbb\b', ' ', s)
    return ' '.join(re.sub(r'[^a-z ]', ' ', s).split())

def clean_street(a):
    """Excel cesto nosi dopise uz ulicu: '"pijaca"dositejeva bb (kod Male pijace)',
    'Ivana Djaje 11(vracar)', 'Bulevar Cara Lazara 85 - Liman', 'Maksima Gorkog ispred broja 32'.
    Za poredjenje sa geokoderom ostavljamo samo ime ulice."""
    a = re.sub(r'^\s*"[^"]*"\s*', '', a)                    # "kiosk" na pocetku
    a = re.sub(r'\([^)]*\)', ' ', a)                         # (vracar)
    a = re.sub(r'^\s*ugao\s+', '', a, flags=re.I)
    a = re.split(r'\s+-\s+|\s-(?=[A-Za-z])|\b(?:kod|ispred|preko|pre|iza|izmedju|između|pored|naspram|ostaviti)\b', a, flags=re.I)[0]
    return a

# opste reci u imenima ulica: same po sebi ne razlikuju 'Kralja Petra' od 'Kralja Milana'
GENERIC = {'kralja', 'kraljice', 'cara', 'carice', 'kneza', 'kneginje', 'knez', 'vojvode', 'svetog', 'svete', 'sveti',
           'narodnog', 'narodnih', 'narodne', 'heroja', 'majora', 'generala', 'doktora', 'patrijarha', 'despota',
           'nova', 'stara', 'gornja', 'donja', 'velika', 'mala', 'novi', 'stari'}

def _tok_match(t, toks):
    # padezi menjaju KRAJ reci (Djoke/Djoka, Marta/mart), ne pocetak - zato isti pocetak + slicnost;
    # inace 'Zeljka Milojevica' prolazi kao 'Veljka Vlahovica'
    return any(u[:3] == t[:3] and (u[:5] == t[:5] or difflib.SequenceMatcher(None, t, u).ratio() >= 0.8) for u in toks)

def street_ok(src, got):
    """Da li je geokoder vratio ISTU ulicu? Bez ovoga 'Karadjordjeva 23, Loznica' prolazi kao
    'Loznicka 23', a 'Bul. revolucije 51, Grocka' kao 'Gocka 51' u Rakovici - pin izgleda tacno, a nije.
    Prva karakteristicna rec trazene ulice mora da postoji u vracenoj ('D.tucovica' -> 'Dimitrija
    Tucovica' prolazi, 'Bul. Slobodana Jovanovica' -> 'Dobre Jovanovica' ne). Tolerise kucne greske
    iz Excela ('Secanski put' -> 'Sencanski put', 'Djoke' -> 'Djoka')."""
    a, b = street_key(clean_street(src)), street_key(got)
    if not a or not b: return True                      # nema po cemu da se sudi
    if difflib.SequenceMatcher(None, a, b).ratio() >= 0.8: return True
    bt = b.split()
    key = [w for w in a.split() if len(w) >= 3 and w not in GENERIC] or [w for w in a.split() if len(w) >= 3]
    if not key: return True
    if len(key[0]) == 3:   # skracenica (JNA, BAS) vazi samo ako je i vracena ulica ta skracenica
        return key[0] in bt and len(b) <= 6
    return _tok_match(key[0], bt)

def got_street(g):
    return (g.get('name') or '').split(',')[0]

BRAND_OSM = {'NIS Petrol': r'\bnis\b', 'Lukoil': r'lukoil', 'Shell': r'\bshell\b'}

def km(la1, ln1, la2, ln2):
    p = math.radians
    x = math.sin(p(la2 - la1) / 2) ** 2 + math.cos(p(la1)) * math.cos(p(la2)) * math.sin(p(ln2 - ln1) / 2) ** 2
    return 12742 * math.asin(math.sqrt(x))

def load_pumpe():
    """Sve benzinske stanice iz OSM-a (Overpass), jednom pa iz kesa. Ikonica pumpe na nasoj mapi
    dolazi iz istih podataka - zato je to tacnije od kucnog broja (zvanicna adresa pumpe i
    kucni broj u bazi adresa cesto nisu isto mesto, npr. Dzona Kenedija 10 je 445 m od pumpe)."""
    if os.path.exists(PUMPE): return json.load(open(PUMPE, encoding='utf-8'))
    q = '[out:json][timeout:120];(node["amenity"="fuel"](41.8,18.8,46.3,23.1);way["amenity"="fuel"](41.8,18.8,46.3,23.1););out center tags;'
    for url in ('https://lz4.overpass-api.de/api/interpreter', 'https://overpass-api.de/api/interpreter'):
        try:
            req = urllib.request.Request(url, data=urllib.parse.urlencode({'data': q}).encode(),
                                         headers={'User-Agent': 'vapologic-lokacije/1.0 (jednokratno)'})
            r = json.load(urllib.request.urlopen(req, timeout=180)); break
        except Exception as e:
            print('Overpass ne odgovara:', url, e); time.sleep(3)
    else:
        print('UPOZORENJE: pumpe iz OSM-a nisu skinute, pumpe ostaju na adresi'); return []
    st = []
    for e in r['elements']:
        t = e.get('tags', {})
        st.append({'lat': e.get('lat') or e['center']['lat'], 'lng': e.get('lon') or e['center']['lon'],
                   'brand': t.get('brand', ''), 'name': t.get('name', ''), 'operator': t.get('operator', ''),
                   'street': t.get('addr:street', ''), 'num': t.get('addr:housenumber', '')})
    json.dump(st, open(PUMPE, 'w', encoding='utf-8'), ensure_ascii=False)
    return st

def snap_pumpa(brand, a, g, level, pumpe):
    """Pin brendirane pumpe -> OSM pumpa ISTOG brenda.
    1) kandidat cija se ulica poklapa sa nasom adresom (do 2 km) - najsigurnije
    2) inace najbliza do 800 m (u gustom gradu dalje od toga je vec druga pumpa istog brenda)
    3) ako je pin bio samo na naselju: samo ako je u krugu od 3 km tacno jedna takva pumpa"""
    pat = BRAND_OSM.get(brand)
    if not pat or not g: return None
    src = a.split(',')[0]
    cand = []
    for s in pumpe:
        if not re.search(pat, fold(' '.join((s['brand'], s['name'], s['operator'])))): continue
        d = km(g['lat'], g['lng'], s['lat'], s['lng'])
        if d <= 3: cand.append((d, s))
    if not cand: return None
    cand.sort(key=lambda c: c[0])
    same = [c for c in cand if c[0] <= 2 and street_key(c[1]['street'] or c[1]['name'])
            and street_ok(src, c[1]['street'] or c[1]['name'])]
    if same: return same[0][1]
    if level != 'mesto' and cand[0][0] <= 0.8: return cand[0][1]
    if level == 'mesto' and len(cand) == 1: return cand[0][1]
    return None

def locate(a, place, main_city, cache):
    """-> (rezultat, nivo) ; nivo: 'adresa' (kucni broj), 'ulica', 'mesto' (priblizno)"""
    cc = city_center(place, main_city, cache)
    center = (cc['lng'], cc['lat']) if cc else None
    first = norm_num(a.split(',')[0])
    for q in dict.fromkeys([f'{norm_num(a)}, {place}, Srbija', f'{first}, {place}, Srbija']):
        g = geocode(q, cache, center)
        if g and g['type'] in ('address', 'poi') and g['rel'] >= 0.6 and street_ok(first, got_street(g)):
            return g, ('adresa' if g.get('num') else 'ulica')
    street = re.sub(r'\b(\d+\w*|bb)\b.*$', '', first, flags=re.I).strip(' ,.')      # samo ime ulice
    if len(street) > 3:
        g = geocode(f'{street}, {place}, Srbija', cache, center)
        if g and g['type'] in ('address', 'poi', 'road') and g['rel'] >= 0.6 and street_ok(first, got_street(g)):
            return g, 'ulica'
    # drugi geokoder (OpenStreetMap/Nominatim) cesto ima ulice kojih MapTiler nema
    for q in dict.fromkeys([f'{first}, {place}', f'{street}, {place}' if len(street) > 3 else None]):
        if not q: continue
        g = nominatim(q, cache, center)
        if g and street_ok(first, got_street(g)): return g, ('adresa' if g['num'] else 'ulica')
    return cc, 'mesto'

def nominatim(q, cache, center):
    """Nominatim, ogranicen na okolinu grada; politika korišćenja: najvise 1 upit u sekundi."""
    ck = 'N|' + q
    if ck in cache: return cache[ck]
    params = {'q': q, 'countrycodes': 'rs', 'format': 'jsonv2', 'limit': 1, 'addressdetails': 1}
    if center:
        lng, la = center
        params.update(viewbox=f'{lng - .45},{la + .32},{lng + .45},{la - .32}', bounded=1)
    u = 'https://nominatim.openstreetmap.org/search?' + urllib.parse.urlencode(params)
    res = None
    try:
        r = json.load(urllib.request.urlopen(urllib.request.Request(u, headers={
            'User-Agent': 'vapologic-lokacije/1.0 (jednokratno geokodiranje prodajnih mesta)'}), timeout=20))
        if r and r[0].get('addresstype') not in ('city', 'town', 'village', 'municipality', 'county', 'state', 'suburb', 'city_district', 'hamlet'):
            f = r[0]
            res = {'lng': float(f['lon']), 'lat': float(f['lat']), 'type': 'address', 'rel': 1,
                   'num': bool((f.get('address') or {}).get('house_number')), 'name': f.get('display_name', '')}
    except Exception:
        res = None
    cache[ck] = res
    time.sleep(1.1)
    return res


def loc_id(key):
    """Stabilan ID lokacije iz normalizovane adrese (istog kljuca po kome se uklanjaju duplikati),
    pa ne zavisi od redosleda redova u Excelu. Rucna ispravka je vezana za ovaj ID."""
    return hashlib.sha1('|'.join(key).encode('utf-8')).hexdigest()[:10]

def load_ispravke(path=ISPRAVKE):
    return json.load(open(path, encoding='utf-8')) if os.path.exists(path) else {}

def merge_ispravke(extra_path):
    """Spaja preuzeti fajl sa stranice za korekciju u tools/lokacije-ispravke.json.
    Ako je isti pin ispravljan vise puta (npr. dve osobe), vazi novija ispravka."""
    base, extra = load_ispravke(), load_ispravke(extra_path)
    if not extra:
        print('fajl sa ispravkama je prazan ili ne postoji:', extra_path); return base
    novih = izmenjenih = 0
    for k, v in extra.items():
        if not isinstance(v, dict) or 'lat' not in v or 'lng' not in v: continue
        if not (41.8 < v['lat'] < 46.3 and 18.8 < v['lng'] < 23.1):
            print('preskacem ispravku van Srbije:', k, v); continue
        if k not in base: novih += 1
        elif v.get('ts', 0) > base[k].get('ts', 0): izmenjenih += 1
        else: continue
        base[k] = v
    json.dump(dict(sorted(base.items())), open(ISPRAVKE, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'ispravke: {novih} novih, {izmenjenih} izmenjenih, ukupno {len(base)} -> {ISPRAVKE}')
    return base

def apply_ispravke(locs, isp):
    """Rucna ispravka ima poslednju rec: pin ide tacno tamo, a lokacija vise nije 'priblizna'
    (i kad je samo potvrdjeno da je pin vec tacan - 'ok': true)."""
    by_id, n = {l['id']: l for l in locs}, 0
    for k, v in isp.items():
        l = by_id.get(k)
        if not l: continue
        l['lat'], l['lng'] = round(v['lat'], 6), round(v['lng'], 6)
        l.pop('approx', None); n += 1
    stale = [k for k in isp if k not in by_id]
    return n, stale

def samo_ispravke(extra_path):
    """Primeni ispravke direktno na lokacije-podaci.json, bez ponovnog geokodiranja Excela."""
    isp = merge_ispravke(extra_path) if extra_path else load_ispravke()
    locs = json.load(open(OUT, encoding='utf-8'))
    if not all('id' in l for l in locs):
        sys.exit('lokacije-podaci.json nema ID-jeve - pokreni prvo alat nad Excelom')
    n, stale = apply_ispravke(locs, isp)
    json.dump(locs, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'primenjeno ispravki: {n} | ispravke za lokacije kojih vise nema u bazi: {len(stale)}')

def main(xlsx, extra=None):
    rows = list(openpyxl.load_workbook(xlsx, read_only=True, data_only=True).worksheets[0].iter_rows(values_only=True))
    hdr, rows = rows[0], rows[1:]
    cache = json.load(open(CACHE, encoding='utf-8')) if os.path.exists(CACHE) else {}
    seen, out, skipped, approx = set(), [], [], []
    pumpe, snapped, unsnapped = load_pumpe(), [], []
    isp = merge_ispravke(extra) if extra else load_ispravke()
    for r in rows:
        source, client, name, addr, city, channel, distributor = [str(x or '').strip() for x in r[:7]]
        # Excel ima mesano pismo: latinica sa skrivenim cirilicnim slovima (а, е, о, ј...).
        # Izgleda isto, ali geokoder i deduplikacija to vide kao drugi tekst.
        name, addr, city = lat(name), lat(addr), lat(city)
        if client in ('0', '') or re.search(r'magacin|reprezentacij', fold(name)):
            skipped.append(f'{name} | {addr} | {city}'); continue
        main_city, sub = clean_city(city)
        a = clean_addr(addr)
        key = (fold(a), fold(main_city), fold(sub))
        if key in seen: skipped.append(f'DUPLIKAT {name} | {addr} | {city}'); continue
        seen.add(key)
        place = f'{sub}, {main_city}' if sub else main_city
        g, level = locate(a, place, main_city, cache)
        exact = level != 'mesto'
        if not g or not (41.8 < g['lat'] < 46.3 and 18.8 < g['lng'] < 23.1):
            skipped.append(f'NIJE NADJENO {name} | {addr} | {city}'); continue
        brand = next((b for k, b in BRAND if k in fold(source)), '')
        if brand in BRAND_OSM:
            s = snap_pumpa(brand, a, g, level, pumpe)
            if s:
                snapped.append(f"{km(g['lat'], g['lng'], s['lat'], s['lng']) * 1000:5.0f} m  {brand} | {a}, {place}")
                g, level, exact = {**g, 'lat': s['lat'], 'lng': s['lng']}, 'pumpa', True
            else:
                unsnapped.append(f'{brand} | {a}, {place}')
        loc = {'id': loc_id(key), 'typeKey': typ(channel, source, name), 'city': main_city,
               'addr': f'{title(a)}, {sub + ", " if sub else ""}{main_city}',
               'lat': round(g['lat'], 6), 'lng': round(g['lng'], 6)}
        if brand: loc = {'id': loc['id'], 'name': brand, **{k: v for k, v in loc.items() if k != 'id'}}
        if brand == 'Galaxy Code': loc['featured'] = True
        if not exact:
            loc['approx'] = True
            approx.append(f"{name} | {addr} | {city}  ->  {lat(g['name'])}")
        out.append(loc)
        json.dump(cache, open(CACHE, 'w', encoding='utf-8'), ensure_ascii=False)
    assert len({l['id'] for l in out}) == len(out), 'duplikat ID-ja lokacije'
    n_isp, stale = apply_ispravke(out, isp)
    out.sort(key=lambda l: (not l.get('featured'), l['city'], l['addr']))
    json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    with open(REPORT, 'w', encoding='utf-8') as f:
        f.write(f'Pribliznih lokacija (pin na naselju/opstini, ne na adresi): {len(approx)}\n\n' + '\n'.join(approx))
        f.write(f'\n\nIzostavljeno: {len(skipped)}\n' + '\n'.join(skipped))
        f.write(f'\n\nPumpe zalepljene za OSM pumpu istog brenda: {len(snapped)} (pomeraj | pumpa)\n'
                + '\n'.join(sorted(snapped, reverse=True)))
        f.write(f'\n\nBrendirane pumpe BEZ para u OSM-u (ostale na adresi): {len(unsnapped)}\n' + '\n'.join(unsnapped))
    print(f'redova {len(rows)} | upisano {len(out)} | tacna adresa {len(out) - len(approx)} | priblizno {len(approx)} | izostavljeno {len(skipped)}')
    print(f'pumpe zalepljene za OSM: {len(snapped)} | brendirane bez para: {len(unsnapped)}')
    print(f'rucne ispravke primenjene: {n_isp} | ispravke za lokacije kojih vise nema u Excelu: {len(stale)}')
    print(f'pribliznih posle ispravki: {sum(1 for l in out if l.get("approx"))}')

if __name__ == '__main__':
    a = sys.argv[1:]
    if a and a[0] == '--samo-ispravke':
        samo_ispravke(a[1] if len(a) > 1 else None)
    elif a:
        extra = a[a.index('--ispravke') + 1] if '--ispravke' in a else None
        main(a[0], extra)
    else:
        sys.exit(__doc__)
