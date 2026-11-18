"""Nove finalne slike (Downloads/vizualizasajt) -> AVIF za sajt + originali u Slike/.

Pokretanje (iz korena projekta):  python tools/avif-slike.py "C:/Users/.../Downloads/vizualizasajt"

Pravila (kao do sada, samo AVIF umesto WebP-a): kvalitet 60, odnos strana se ne menja,
vizuali uredjaja i mapa max 1600 px po duzoj strani, ukusi/kartice 700 px, upitnik i
pakovanje u originalnoj velicini.
"""
import os, shutil, sys
from PIL import Image

SRC = sys.argv[1]
Q = 60
made = []

def avif(src, out, max_side=None):
    im = Image.open(src)
    im = im.convert('RGBA' if im.mode in ('RGBA', 'LA', 'P') else 'RGB')
    if max_side and max(im.size) > max_side:
        s = max_side / max(im.size)
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    im.save(out, 'AVIF', quality=Q)
    made.append((out, im.size, os.path.getsize(src), os.path.getsize(out)))

def keep(src, dst):
    """original u Slike/<folder> (isto ime kao ranije, da se zna sta je sta)"""
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copyfile(src, dst)

S = lambda *p: os.path.join(SRC, *p)

# 1. vizuali uredjaja (stranica proizvoda; klasik slajder)
DEV = {'eb1000': ('eb1000 (1).jpg', 'eb1000 mob.jpg', 'Slike/Elfbar 1000', 'EB1000'),
       'bm1000': ('BM1000 (1).jpg', 'BM1000 mob.jpg', 'Slike/BM1000', 'BM1000'),
       'eb6000': ('eb6000.jpg', 'eb6000 mob.jpg', 'Slike/Elfbar 6000', 'EB6000')}
for slug, (web, mob, folder, up) in DEV.items():
    avif(S(web), f'Slike/web/uredjaj/{slug}-web.avif', 1600)
    avif(S(mob), f'Slike/web/uredjaj/{slug}-mob.avif', 1600)
    keep(S(web), f'{folder}/{up}-web.jpg')
    keep(S(mob), f'{folder}/{up}-mob.jpg')

# 2. ukusi sa vocem (EB1000, BM1000) — slug = ime fajla malim slovima
for dev, sub, folder in (('eb1000', 'EB1000 Sa vocem i pozadinom', 'Slike/Elfbar 1000 Ukusi'),
                         ('bm1000', 'BM1000 Sa vocem i pozadinom', 'Slike/BM1000 Ukusi')):
    d = S(sub, sub)
    for old in os.listdir(folder):                       # stari PNG originali odlaze
        os.remove(os.path.join(folder, old))
    for f in sorted(os.listdir(d)):
        if not f.lower().endswith('.jpg'): continue
        avif(os.path.join(d, f), f'Slike/web/{dev}/{f[:-4].lower()}.avif', 700)
        keep(os.path.join(d, f), f'{folder}/{f}')

# 3. EB6000 ukusi (originali vec u projektu) i boje uredjaja (postoje samo kao webp)
E6 = 'Slike/Elfbar 6000 Ukusi'
for f in sorted(os.listdir(E6)):
    if f.lower().endswith('.jpg'):
        avif(os.path.join(E6, f), f'Slike/web/eb6000/{f[:-4].lower().replace(" ", "-")}.avif', 700)
for c in ('blue', 'black', 'green', 'purple'):
    avif(f'Slike/web/eb6000/{c}.webp', f'Slike/web/eb6000/{c}.avif', 700)

# 4. kartice proizvoda na pocetnoj (providna pozadina)
for slug, f in (('eb1000', 'eb1000.png'), ('bm1000', 'lost mary.png'), ('eb6000', 'eb6000.png')):
    avif(S(f), f'Slike/web/kartice/{slug}.avif', 700)
    keep(S(f), f'Slike/Kartice/{slug}.png')

# 5. pakovanje (BM6000 verzija 2 = pakovanje EB6000; BM1000 stiglo preko WhatsApp-a)
PK = 'Slike/Pakovanje'
avif(S('WhatsApp Image 2026-11-17 at 13.29.02.jpeg'), 'Slike/web/pakovanje/bm1000.avif')
avif(S('BM6000 verzija 2.jpg'), 'Slike/web/pakovanje/eb6000.avif')
avif(f'{PK}/EB1000 (1).webp', 'Slike/web/pakovanje/eb1000.avif')
keep(S('WhatsApp Image 2026-11-17 at 13.29.02.jpeg'), f'{PK}/BM1000.jpg')
keep(S('BM6000 verzija 2.jpg'), f'{PK}/EB6000.jpg')
for old in ('BM1000 (1).webp', 'BM6000 (1).webp'):
    if os.path.exists(f'{PK}/{old}'): os.remove(f'{PK}/{old}')

# 6. upitnik
KV = 'Slike/Vizuali za upitnik'
for old in os.listdir(KV): os.remove(os.path.join(KV, old))
for f, slug in (('slatki', 'ukus-slatki'), ('kiseli', 'ukus-kiseli'), ('slatko-kiseli', 'ukus-slatko-kiseli'),
                ('osvezavajuci', 'ukus-osvezavajuci'), ('tropski', 'ukus-tropski'), ('snazaniji', 'jacina-snazniji'),
                ('nezniji', 'jacina-nezniji'), ('1000', 'puff-1000'), ('6000', 'puff-6000')):
    avif(S(f + '.jpg'), f'Slike/web/kviz/{slug}.avif')
    keep(S(f + '.jpg'), f'{KV}/{slug}.jpg')

# 7. mapa (lokacije na pocetnoj)
avif(S('mapa.jpg'), 'Slike/web/lokacije/lokacije-web.avif', 1600)
avif(S('mapa mob.jpg'), 'Slike/web/lokacije/lokacije-mob.avif', 1600)
keep(S('mapa.jpg'), 'Slike/Mapa/mapa.jpg')
keep(S('mapa mob.jpg'), 'Slike/Mapa/mapa-mob.jpg')

tin = sum(m[2] for m in made); tout = sum(m[3] for m in made)
for out, size, a, b in made:
    print(f'{out:48} {size[0]}x{size[1]:<5} {a // 1024:5} KB -> {b // 1024:4} KB')
print(f'{len(made)} slika: {tin // 1024} KB -> {tout // 1024} KB')
