/* ===== Vapologic — zajednički JS (index / proizvod / blog / lokacije) ===== */

const ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
// akcenat (boja okvira/senke) po ukusu — kartice kviza i slajder ukusa
const FLAVOR_ACC = { watermelon: '#ff4d9d', strawberry: '#ff4d9d', cherry: '#ff4d9d', lemonade: '#ffcf5c',
  mango: '#ffcf5c', pineapple: '#ffcf5c', grape: '#b14bff', blueberry: '#38d6ff', menthol: '#38d6ff',
  melon: '#ff4d9d', kiwi: '#38d6ff' };
const pickBy = (map, name, fallback) => {
  const n = name.toLowerCase();
  for (const k in map) if (n.includes(k)) return map[k];
  return fallback;
};
const accFor = (name) => pickBy(FLAVOR_ACC, name, '#b14bff');

/* ============================================================
   i18n — tekstovi se menjaju u i18n.js, ne ovde.
   t('kljuc', {n: 5})  ·  setLang('en')  ·  event 'langchange'
   ============================================================ */
const LANGS = ['sr', 'en', 'ru'];
let LANG = (() => {
  const q = new URLSearchParams(location.search).get('lang');
  if (q && LANGS.includes(q)) return q;
  const s = localStorage.getItem('vpl_lang');
  if (s && LANGS.includes(s)) return s;
  return 'sr';
})();
function t(key, vars) {
  const D = (window.I18N && window.I18N[LANG]) || {};
  const F = (window.I18N && window.I18N.sr) || {};   // fallback: srpski
  let s = D[key] != null ? D[key] : (F[key] != null ? F[key] : key);
  if (vars) for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
  return s;
}
window.t = t;
function applyLang(lang) {
  if (LANGS.includes(lang)) LANG = lang;
  try { localStorage.setItem('vpl_lang', LANG); } catch (e) {}
  document.documentElement.lang = LANG;
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-attr]').forEach(el => {
    el.dataset.i18nAttr.split(';').forEach(pair => {
      const i = pair.indexOf(':');
      if (i < 0) return;
      const attr = pair.slice(0, i).trim(), key = pair.slice(i + 1).trim();
      if (attr && key) el.setAttribute(attr, t(key));
    });
  });
  const cur = document.getElementById('langCurrent');
  if (cur) cur.textContent = ((window.I18N && window.I18N.langs) || {})[LANG] || LANG.toUpperCase();
  document.querySelectorAll('[data-lang-code]').forEach(a =>
    a.setAttribute('aria-current', a.dataset.langCode === LANG ? 'true' : 'false'));
  // dinamički delovi (kviz, slajder ukusa, lista lokacija) se sami preslože
  document.dispatchEvent(new CustomEvent('langchange', { detail: { lang: LANG } }));
}
window.setLang = (lang) => applyLang(lang);
applyLang(LANG);

/* ---------- Nav hamburger + FAQ accordion (sve stranice) ---------- */
const MOBILE_NAV = '(max-width:720px)';
const closeAllDrops = () =>
  document.querySelectorAll('.nav-menu .drop.open').forEach(d => {
    d.classList.remove('open');
    const b = d.querySelector('.drop-label,.lang-btn');
    if (b) b.setAttribute('aria-expanded', 'false');
  });

window.toggleNav = () => {
  const open = document.body.classList.toggle('nav-open');
  const btn = document.querySelector('.nav-toggle');
  if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (!open) closeAllDrops();          // sledece otvaranje pocinje sklopljeno
};

/* Na mobilnom su dropdownovi akordeon — ranije su bili zakucani na otvoreno,
   pa je meni bio duzi od ekrana. Na desktopu i dalje radi hover, ovo se ne mesa. */
document.addEventListener('click', (e) => {
  const label = e.target.closest('.nav-menu .drop-label, .nav-menu .lang-btn');
  if (!label || !window.matchMedia(MOBILE_NAV).matches) return;
  e.preventDefault();
  const drop = label.closest('.drop');
  const open = !drop.classList.contains('open');
  closeAllDrops();                      // samo jedan otvoren odjednom
  drop.classList.toggle('open', open);
  label.setAttribute('aria-expanded', open ? 'true' : 'false');
});
window.toggleFaq = (btn) => {
  const item = btn.closest('.faq');
  if (!item) return;
  const open = item.classList.toggle('open');
  btn.setAttribute('aria-expanded', open ? 'true' : 'false');
};
document.addEventListener('click', (e) => {
  if (e.target.closest('.nav-menu a') && document.body.classList.contains('nav-open')) {
    document.body.classList.remove('nav-open');
    const btn = document.querySelector('.nav-toggle');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.body.classList.contains('nav-open')) {
    document.body.classList.remove('nav-open');
    const btn = document.querySelector('.nav-toggle');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }
});

/* ---------- AGE GATE (sve stranice) ---------- */
(function () {
  if (localStorage.getItem('vpl_age18') === '1') return;
  const el = document.createElement('div');
  el.className = 'agegate';
  el.innerHTML = `<div class="agecard" role="dialog" aria-modal="true" aria-labelledby="ageTitle">
      <img class="logo-img" src="vapologic-logo-white.png" alt="Vapologic">
      <h2 id="ageTitle">${t('age.title')}</h2>
      <p>${t('age.text')}</p>
      <div class="age-actions">
        <button class="btn btn-primary" id="ageYes" type="button">${t('age.yes')}</button>
        <button class="btn btn-ghost" id="ageNo" type="button">${t('age.no')}</button>
      </div>
      <div class="agewarn">${t('age.warn')}</div>
    </div>`;
  const mount = () => {
    document.body.appendChild(el);
    document.documentElement.style.overflow = 'hidden';
    el.querySelector('#ageYes').focus();
    el.querySelector('#ageYes').onclick = () => {
      localStorage.setItem('vpl_age18', '1'); el.remove(); document.documentElement.style.overflow = '';
    };
    el.querySelector('#ageNo').onclick = () => {
      document.body.innerHTML = `<div class="age-blocked">${t('age.blocked')}</div>`;
      document.documentElement.style.overflow = '';
    };
  };
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();

/* ---------- HERO slider (index.html) ---------- */
(function () {
  const slides = document.getElementById('slides');
  const dotsWrap = document.getElementById('dots');
  if (!slides || !dotsWrap) return;
  const N = slides.children.length;
  let idx = 0, timer;
  const dots = [];

  /* Slajdovi se smenjuju pretapanjem (stoje jedan preko drugog, vidi .slides u
     CSS-u). Boja pozadine ne moze da ostane na samom slajdu: dva poluprovidna
     slajda tokom prelaza ne daju punu neprozirnost pa bi se kroz njih videla
     pozadina stranice. Zato za svaki slajd pravimo poseban sloj boje iza trake;
     taj stek je uvek pun. Slojevi se grade iz klasa .s1../.s4 koje vec nose boje
     u CSS-u, pa markup ostaje cist. */
  const sliderBox = document.getElementById('slider');
  const bgs = [];
  if (sliderBox) {
    const wrap = document.createElement('div');
    wrap.className = 'slide-bgs';
    wrap.setAttribute('aria-hidden', 'true');
    [...slides.children].forEach((sl, i) => {
      const b = document.createElement('span');
      const key = [...sl.classList].find(c => /^s\d+$/.test(c));
      b.className = 'slide-bg' + (key ? ' ' + key : '');
      b.style.opacity = i === 0 ? '1' : '0';   // prvi je odmah tu, bez uvodnog treperenja
      wrap.appendChild(b);
      bgs.push(b);
    });
    sliderBox.prepend(wrap);
  }
  /* Novi sloj se PODIZE iznad ostalih i pretapa od 0 do 1; stari ostaje pun
     ispod njega. Da smo stari istovremeno gasili, na pola prelaza bi se kroz
     dva poluprovidna sloja videla pozadina stranice — kao kratak blesak. */
  let bgTop = 1;
  function setBg(i) {
    const cur = bgs[i];
    if (!cur || cur.dataset.on === '1') return;
    bgs.forEach(b => { b.dataset.on = '0'; });
    cur.dataset.on = '1';
    cur.style.zIndex = ++bgTop;
    cur.style.opacity = '0';
    void cur.offsetWidth;                      // flush, da pretapanje krene bas od nule
    cur.style.opacity = '1';
  }

  for (let i = 0; i < N; i++) {
    const b = document.createElement('button');
    b.setAttribute('aria-label', t('hero.slide_n', { n: i + 1 }));
    b.onclick = () => { set(i); restartAuto(); };
    dotsWrap.appendChild(b); dots.push(b);
  }
  document.addEventListener('langchange', () =>
    dots.forEach((b, i) => b.setAttribute('aria-label', t('hero.slide_n', { n: i + 1 }))));
  function set(i) {
    idx = (i + N) % N;
    setBg(idx);
    [...slides.children].forEach((sl, k) => sl.classList.toggle('is-on', k === idx));
    [...dotsWrap.children].forEach((d, k) => d.classList.toggle('on', k === idx));
  }
  window.go = (d) => { set(idx + d); restartAuto(); };
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function restartAuto() { if (reduce) return; clearInterval(timer); timer = setInterval(() => set(idx + 1), 5000); }

  /* Prevlacenje prstom — na mobilnom nema strelica, pa je swipe glavna kontrola.
     Vertikalni potez se ignorise da ne otimamo skrol stranice. */
  const sliderEl = sliderBox;
  if (sliderEl) {
    let x0 = null, y0 = null;
    sliderEl.addEventListener('touchstart', (e) => {
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
    }, { passive: true });
    sliderEl.addEventListener('touchend', (e) => {
      if (x0 == null) return;
      const dx = e.changedTouches[0].clientX - x0;
      const dy = e.changedTouches[0].clientY - y0;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) { set(idx + (dx < 0 ? 1 : -1)); restartAuto(); }
      x0 = y0 = null;
    }, { passive: true });
  }

  if (bgs[0]) bgs[0].dataset.on = '1';        // sloj 0 je vec vidljiv, bez pretapanja
  set(0); restartAuto();
})();

/* ---------- Katalog uređaja i ukusa (JEDAN izvor istine) ----------
   Koriste ga: kviz na početnoj, grid proizvoda i stranica proizvoda.
   `slug` ukusa je ujedno ime fajla slike: Slike/web/<dev>/<slug>.webp
   (optimizovani derivati; originali stoje u Slike/<folder klijenta>).
   VAŽNO: ovde stoje SAMO ukusi za koje postoji slika — ako klijent pošalje
   nove, dodaj red ovde i ubaci fajl pod tim imenom, ostalo radi samo. */
const IMG = 'Slike/web';
const flavorImg = (dev, s) => `${IMG}/${dev.toLowerCase()}/${s}.webp`;
const deviceImg = (dev, v) => `${IMG}/uredjaj/${dev.toLowerCase()}-${v}.webp`;
const packImg   = (dev)    => `${IMG}/pakovanje/${dev.toLowerCase()}.webp`;

const PRODUCTS = {
  EB1000: {
    id: 'EB1000', brand: 'Elfbar', cls: 'eb', type: 'jednokratni', puffs: '1000',
    specs: [['specs.puffs', '1000'], ['specs.flavors', '8'], ['specs.nic', '20 mg/ml'], ['specs.kind', 'specs.kind_disp']],
    flavors: [
      { fn: 'Watermelon', slug: 'watermelon', taste: ['slatki', 'osvežavajući'], intensity: 'nežniji' },
      { fn: 'Strawberry Ice', slug: 'strawberry-ice', taste: ['slatki'], intensity: 'nežniji' },
      { fn: 'Cherry', slug: 'cherry', taste: ['slatko-kiseli'], intensity: 'snažniji' },
      { fn: 'Blueberry', slug: 'blueberry', taste: ['slatko-kiseli'], intensity: 'nežniji' },
      { fn: 'Blueberry Sour Raspberry', slug: 'blueberry-sour-raspberry', taste: ['kiseli'], intensity: 'snažniji' },
      { fn: 'Kiwi Passion Fruit Guava', slug: 'kiwi-passion-fruit-guava', taste: ['kiseli', 'tropski'], intensity: 'nežniji' },
      { fn: 'Pink Lemonade', slug: 'pink-lemonade', taste: ['slatko-kiseli'], intensity: 'snažniji' },
      { fn: 'Menthol', slug: 'menthol', taste: ['osvežavajući'], intensity: 'snažniji' },
    ],
  },
  BM1000: {
    id: 'BM1000', brand: 'Lost Mary', cls: 'bm', type: 'jednokratni', puffs: '1000',
    specs: [['specs.puffs', '1000'], ['specs.flavors', '6'], ['specs.nic', '20 mg/ml'], ['specs.mode', 'Turbo']],
    flavors: [
      { fn: 'Watermelon Ice', slug: 'watermelon-ice', taste: ['slatki'], intensity: 'snažniji' },
      { fn: 'Strawberry Ice', slug: 'strawberry-ice', taste: ['slatki'], intensity: 'nežniji' },
      { fn: 'Strawberry Kiwi', slug: 'strawberry-kiwi', taste: ['slatko-kiseli'], intensity: 'nežniji' },
      { fn: 'Blueberry Sour Raspberry', slug: 'blueberry-sour-raspberry', taste: ['kiseli'], intensity: 'snažniji' },
      { fn: 'Pineapple Ice', slug: 'pineapple-ice', taste: ['tropski'], intensity: 'snažniji' },
      { fn: 'Grape', slug: 'grape', taste: ['osvežavajući'], intensity: 'nežniji' },
    ],
  },
  EB6000: {
    id: 'EB6000', brand: 'Elfbar', cls: 'eb6', type: 'pod', puffs: '6000',
    specs: [['specs.puffs', '6000'], ['specs.charge', 'Type-C'], ['specs.flavors', '6'], ['specs.colors', '4']],
    // EB6000 je pod sistem: uređaj dolazi u 4 boje, a pod-ovi u 6 ukusa
    colors: [
      { fn: 'Blue', slug: 'blue' }, { fn: 'Black', slug: 'black' },
      { fn: 'Green', slug: 'green' }, { fn: 'Purple', slug: 'purple' },
    ],
    flavors: [
      { fn: 'Watermelon Ice', slug: 'watermelon-ice', taste: ['slatki'], intensity: 'nežniji' },
      { fn: 'Strawberry Ice', slug: 'strawberry-ice', taste: ['slatki'], intensity: 'snažniji' },
      { fn: 'Triple Mango', slug: 'triple-mango', taste: ['tropski'], intensity: 'nežniji' },
      { fn: 'Blueberry Sour Raspberry', slug: 'blueberry-sour-raspberry', taste: ['kiseli', 'slatko-kiseli'], intensity: 'snažniji' },
      { fn: 'Grape', slug: 'grape', taste: ['osvežavajući'], intensity: 'nežniji' },
      { fn: 'Menthol', slug: 'menthol', taste: ['osvežavajući'], intensity: 'snažniji' },
    ],
  },
};
const DEVS = ['EB1000', 'BM1000', 'EB6000'];
// ravna lista za kviz — izvedena iz kataloga, bez duplog održavanja
const FLAVORS = DEVS.flatMap(d =>
  PRODUCTS[d].flavors.map(f => ({ ...f, dev: d, puffs: PRODUCTS[d].puffs })));
// link sa rezultata kviza / grida: uređaj + ukus, sa sidrom na slajder ukusa
const flavorHref = (dev, s) => `/proizvod?dev=${dev}&ukus=${s}#ukusi`;

/* ---------- Kviz (index.html) ---------- */
(function () {
  const backBtn = document.getElementById('backBtn');
  if (!backBtn) return;
  let step = 0;
  const answers = { taste: null, intensity: null, puffs: null };
  const stepKeys = ['taste', 'intensity', 'puffs'];
  // slatki i slatko-kiseli se tretiraju kao ista grupa ukusa
  const TASTE_GROUPS = { 'slatki': ['slatki', 'slatko-kiseli'], 'slatko-kiseli': ['slatki', 'slatko-kiseli'] };
  const tasteGroup = (t) => TASTE_GROUPS[t] || [t];

  // klik na opciju odmah otvara sledeci korak (nema dugmeta "Dalje")
  window.pick = (key, val, el) => {
    answers[key] = val;
    el.parentElement.querySelectorAll('.opt').forEach(o => o.setAttribute('aria-pressed', 'false'));
    el.setAttribute('aria-pressed', 'true');
    setTimeout(() => { if (step < 2) { step++; showStep(); } else { finish(); } }, 200);
  };
  function showStep() {
    document.querySelectorAll('.qstep').forEach(s => s.classList.toggle('on', +s.dataset.step === step));
    document.querySelectorAll('.qbar .seg').forEach((s, k) => s.classList.toggle('on', k <= step));
    backBtn.style.visibility = step === 0 ? 'hidden' : 'visible';
  }
  window.next = () => { if (step < 2) { step++; showStep(); } else { finish(); } };
  window.back = () => { if (step > 0) { step--; showStep(); } };
  function finish() {
    document.querySelectorAll('.qstep').forEach(s => s.classList.remove('on'));
    backBtn.parentElement.style.display = 'none';
    document.querySelectorAll('.qbar .seg').forEach(s => s.classList.add('on'));
    const group = tasteGroup(answers.taste);
    const matchTaste = (f) => f.taste.some(t => group.includes(t));
    let m = FLAVORS.filter(f => matchTaste(f) && f.intensity === answers.intensity && f.puffs === answers.puffs);
    // ako za tu jacinu nema nista (npr. kiseli/nezniji/6000), sirimo izbor bez izvinjavanja
    let bezJacine = false;
    if (m.length === 0) { bezJacine = true; m = FLAVORS.filter(f => matchTaste(f) && f.puffs === answers.puffs); }
    if (m.length === 0) { m = FLAVORS.filter(f => matchTaste(f)); }
    document.getElementById('empty').style.display = 'none';
    const izbor = bezJacine
      ? `${t('taste.' + answers.taste)} · ${answers.puffs} ${t('quiz.puffs_label')}`
      : `${t('taste.' + answers.taste)} · ${t('intensity.' + answers.intensity)} · ${answers.puffs} ${t('quiz.puffs_label')}`;
    const nadjeno = m.length === 1 ? t('quiz.found_one') : t('quiz.found_many', { n: m.length });
    document.getElementById('resSummary').textContent = `${izbor} — ${nadjeno}`;
    const g = document.getElementById('rgrid'); g.innerHTML = '';
    m.forEach(f => {
      const a = document.createElement('a');
      a.className = 'rcard';
      // vodi na stranicu uređaja, sidro na slajder ukusa -> tamo se centrira baš ovaj ukus
      a.href = flavorHref(f.dev, f.slug);
      a.setAttribute('aria-label', t('quiz.open_aria', { fl: f.fn, dev: f.dev }));
      a.style.setProperty('--acc', accFor(f.fn));
      const tags = f.taste.map(x => `<span class="t">${t('taste.' + x)}</span>`).join('')
        + `<span class="t">${t('intensity.' + f.intensity)}</span><span class="t">${f.puffs}</span>`;
      a.innerHTML = `<div class="rimg is-shot"><img src="${flavorImg(f.dev, f.slug)}" alt="${f.dev} ${f.fn}" width="700" height="700" loading="eager" decoding="async"></div>
        <div class="rbody">
          <div class="fl">${f.fn}</div><div class="dev">${f.dev}</div>
          <div class="tags">${tags}</div>
          <span class="rmore">${t('quiz.open_device')} ${ARROW}</span>
        </div>`;
      g.appendChild(a);
    });
    document.getElementById('result').classList.add('on');
  }
  // promena jezika dok je rezultat na ekranu -> preslozi ga
  document.addEventListener('langchange', () => {
    if (document.getElementById('result').classList.contains('on')) finish();
  });
  window.restart = () => {
    step = 0; answers.taste = answers.intensity = answers.puffs = null;
    document.getElementById('result').classList.remove('on');
    backBtn.parentElement.style.display = 'flex';
    document.querySelectorAll('.opt').forEach(o => o.setAttribute('aria-pressed', 'false'));
    showStep();
  };
  showStep();
})();

/* ---------- Stranica proizvoda (proizvod.html) — sadrzaj po ?dev= ----------
   Jedna stranica opsluzuje sva tri uredjaja: ?dev=EB1000|BM1000|EB6000.
   Bez parametra ostaje EB6000 (tako je stranica i ranije radila).          */
const pdDevice = () => {
  const q = (new URLSearchParams(location.search).get('dev') || '').toUpperCase();
  return PRODUCTS[q] ? q : 'EB6000';
};

(function () {
  const titleEl = document.getElementById('pdTitle');
  if (!titleEl) return;
  const P = PRODUCTS[pdDevice()];
  const $ = (id) => document.getElementById(id);

  function render() {
    // naslov je SAMO ime uredjaja — ukus vise ne ulazi u njega, on je u slajderu ispod
    titleEl.textContent = P.id;
    $('pdBrand').textContent = P.brand;
    $('pdCrumbBrand').textContent = P.brand;
    $('pdCrumbName').textContent = P.id;
    $('pdDesc').textContent = t('pd.desc.' + P.id);
    $('pdAbout').textContent = t('specs.about.' + P.id);
    $('pdTechH').textContent = t('tech.t1.' + P.id);
    $('pdTechP').textContent = t('tech.t1d.' + P.id);
    $('pdTechIc').textContent = P.id === 'EB1000' ? '\u{1F4A8}' : '\u{1F50B}';
    $('flavTitle').textContent = t('flav.title', { dev: P.id });
    document.title = P.brand + ' ' + P.id + ' — ' + t('pd.meta_puffs', { n: P.puffs }) + ' | Vapologic';

    $('pdHeroWeb').src = deviceImg(P.id, 'web');
    $('pdHeroWeb').alt = P.brand + ' ' + P.id;
    $('pdHeroMob').srcset = deviceImg(P.id, 'mob');
    $('pdPack').src = packImg(P.id);
    $('pdPack').alt = P.brand + ' ' + P.id + ' — ' + t('pd.pack');

    $('pdSpecs').innerHTML = P.specs.map(function (kv) {
      const v = kv[1].indexOf('specs.') === 0 ? t(kv[1]) : kv[1];
      return '<div class="spec-cell"><div class="k">' + t(kv[0]) + '</div><div class="v">' + v + '</div></div>';
    }).join('');

    // boje uredjaja (za sad samo EB6000 — pod sistem)
    const box = $('pdColors');
    if (P.colors) {
      box.hidden = false;
      $('pdColorsH').textContent = t('pd.colors_title');
      $('pdColorsRow').innerHTML = P.colors.map(function (c) {
        return '<figure class="color"><img src="' + flavorImg(P.id, c.slug) + '" alt="' + P.id + ' ' + c.fn +
          '" width="700" height="700" loading="lazy" decoding="async"><figcaption>' + c.fn + '</figcaption></figure>';
      }).join('');
    } else box.hidden = true;
  }
  render();
  document.addEventListener('langchange', render);
})();

/* ---------- Slajder ukusa (proizvod.html) — besavni infinite loop ----------
   Kartice se pomeraju JEDNA PO JEDNA; kad se dodje do poslednje, traka nastavlja
   udesno preko klonova pa se tiho (bez tranzicije) resetuje — nema naglog
   vracanja na pocetak. Broj vidljivih kartica (--per) i dalje dolazi iz CSS-a. */
(function () {
  const track = document.getElementById('fcar');
  const slider = document.getElementById('fslider');
  if (!track || !slider) return;
  const view = slider.querySelector('.pview');
  const dotsEl = document.getElementById('fdots');
  const prevBtn = document.getElementById('fPrev');
  const nextBtn = document.getElementById('fNext');

  const P = PRODUCTS[pdDevice()];
  const LIST = P.flavors;

  /* Slika ukusa + ime, bez opisa i bez linka (nema per-flavor stranice). */
  const card = (f, clone) =>
    '<div class="card' + (clone ? ' is-clone' : '') + '" style="--acc:' + accFor(f.fn) + '"' +
      (clone ? ' aria-hidden="true"' : '') + ' data-slug="' + f.slug + '">' +
      '<div class="shot is-shot"><span class="brand">' + P.brand + '</span>' +
      '<img src="' + flavorImg(P.id, f.slug) + '" alt="' + P.id + ' ' + f.fn +
      '" width="700" height="700" loading="eager" decoding="async"></div>' +
      '<div class="body"><h3>' + f.fn + '</h3></div></div>';

  const N = LIST.length;
  const AUTO_MS = 3800;
  let per = 1, step = 0, pos = 0, animating = false, finTimer = null, autoTimer = null;

  const readPer = () => Math.max(1, parseInt(getComputedStyle(slider).getPropertyValue('--per'), 10) || 1);
  const gapPx = () => parseFloat(getComputedStyle(track).columnGap) || 0;
  // .pview ima vodoravni padding (da se hover ne sece) -> sirina sadrzaja je bez njega
  const viewW = () => {
    const cs = getComputedStyle(view);
    return view.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  };
  /* Koliko kartica stoji LEVO od centralne: 1 kod tri po strani, 0 kod jedne/dve. */
  const off = () => Math.floor((per - 1) / 2);
  // `pos` je indeks krajnje leve vidljive kartice; "trenutni" ukus je centralni
  const realIndex = () => ((((pos - per + off()) % N) + N) % N);
  // pozicija na kojoj kartica `ri` stoji u SREDINI vidljive grupe
  const centerPos = (ri) => per + ri - off();

  function buildDots() {
    dotsEl.innerHTML = '';
    for (let i = 0; i < N; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-label', t('flav.page', { n: i + 1 }));
      b.onclick = () => userGoTo(i);
      dotsEl.appendChild(b);
    }
  }
  const updateDots = () => {
    const ri = realIndex();
    [...dotsEl.children].forEach((d, i) => d.setAttribute('aria-selected', i === ri ? 'true' : 'false'));
  };

  const measure = () => { const g = gapPx(); step = (viewW() - (per - 1) * g) / per + g; };

  function place(animate) {
    if (!animate) track.style.transition = 'none';
    track.style.transform = 'translateX(' + (-pos * step) + 'px)';
    if (!animate) { void track.offsetHeight; track.style.transition = ''; }  // zakljucaj kadar bez tranzicije
    updateDots();
  }

  // prosireni niz: [klonovi poslednjih `per`] + [pravih N] + [klonovi prvih `per`]
  // `ri` je pravi indeks ukusa koji treba da stoji u sredini
  function build(ri) {
    per = readPer();
    const head = LIST.slice(N - per).map(f => card(f, true));
    const body = LIST.map(f => card(f, false));
    const tail = LIST.slice(0, per).map(f => card(f, true));
    track.innerHTML = head.concat(body, tail).join('');
    buildDots();
    measure();
    pos = centerPos(((((ri || 0) % N) + N) % N));
    place(false);
  }

  function afterMove() {
    animating = false;
    /* Posle koraka `pos` moze da odluta u klon-zonu. Vracamo ga na kanonsku
       poziciju ISTOG centralnog ukusa (razlika je uvek umnozak od N, pa je
       kadar identican) — tiho, bez tranzicije, tako da nema vidljivog skoka. */
    const canon = centerPos(realIndex());
    if (canon !== pos) { pos = canon; place(false); }
  }
  function moveTo(newPos) {
    if (animating || newPos === pos) return;
    animating = true;
    pos = newPos;
    place(true);
    clearTimeout(finTimer);
    finTimer = setTimeout(afterMove, 650);   // rezerva ako 'transitionend' izostane
  }
  track.addEventListener('transitionend', (e) => {
    if (e.propertyName !== 'transform') return;
    clearTimeout(finTimer);
    afterMove();
  });

  const stepBy = (d) => moveTo(pos + d);
  const userGoTo = (ri) => { restartAuto(); moveTo(centerPos(ri)); };

  function startAuto() { stopAuto(); autoTimer = setInterval(() => stepBy(1), AUTO_MS); }
  function stopAuto() { if (autoTimer) { clearInterval(autoTimer); autoTimer = null; } }
  const restartAuto = () => { if (autoTimer) startAuto(); };

  prevBtn.onclick = () => { restartAuto(); stepBy(-1); };
  nextBtn.onclick = () => { restartAuto(); stepBy(1); };

  // pauza dok korisnik gleda / koristi
  slider.addEventListener('mouseenter', stopAuto);
  slider.addEventListener('mouseleave', startAuto);
  slider.addEventListener('focusin', stopAuto);
  slider.addEventListener('focusout', startAuto);

  // prevlacenje prstom
  let x0 = null;
  view.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; stopAuto(); }, { passive: true });
  view.addEventListener('touchend', (e) => {
    if (x0 != null) {
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 45) stepBy(dx < 0 ? 1 : -1);
    }
    x0 = null; startAuto();
  }, { passive: true });

  /* Broj kartica po strani zavisi od sirine -> na prelaz breakpointa rebuild-uj
     klonove cuvajuci trenutni ukus; inace samo preracunaj korak i pomeraj. */
  let rt, prevPer = readPer();
  const relayout = () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      const ri = realIndex();
      const p = readPer();
      if (p !== prevPer) { prevPer = p; build(ri); }
      else { measure(); place(false); }
    }, 120);
  };
  ['(max-width:1024px)', '(max-width:720px)'].forEach(q => {
    const mq = window.matchMedia(q);
    if (mq.addEventListener) mq.addEventListener('change', relayout);
    else if (mq.addListener) mq.addListener(relayout);
  });
  if (window.ResizeObserver) new ResizeObserver(relayout).observe(slider);
  window.addEventListener('resize', relayout);
  document.addEventListener('langchange', () => build(realIndex()));

  /* ---- init ----
     ?ukus=<slug> bira pocetni ukus. Ako uz to stoji i #ukusi (tako linkuju
     rezultati kviza i kartice proizvoda), stranica se NE otvara naglo dole:
     krene od vrha, glatko odskroluje do slajdera i tek kad se skrol smiri
     traka klizi tako da izabrani ukus stane u sredinu. */
  const uk = new URLSearchParams(location.search).get('ukus');
  const target = uk ? LIST.findIndex(f => f.slug === uk) : -1;
  const deepLink = location.hash === '#ukusi' && target >= 0;
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Glatko do sekcije, pa tek onda pomeranje trake — da se dva pokreta ne
     preklapaju. Skrol se smirio = 140ms bez scroll dogadjaja (sa gornjom
     granicom od 1.6s ako pregledac ne posalje zavrsni dogadjaj). */
  /* Apsolutna Y pozicija na kojoj sekcija seda ispod lepljivog zaglavlja.
     Odmak nije zakucan u JS-u — cita se iz scroll-margin-top same sekcije. */
  function landingY(sec) {
    const gap = parseFloat(getComputedStyle(sec).scrollMarginTop) || 0;
    return Math.max(0, sec.getBoundingClientRect().top + window.scrollY - gap);
  }

  function scrollThenCenter(ri) {
    const sec = document.getElementById('ukusi');
    let idle, hardStop;
    const done = () => {
      clearTimeout(idle); clearTimeout(hardStop);
      window.removeEventListener('scroll', bump);
      moveTo(centerPos(ri));
      // auto-rotacija se NE pali: korisnik je dosao bas na ovaj ukus i on ostaje
      // u sredini dok ga sam ne pomeri (strelice / tackice / prevlacenje).
    };
    const bump = () => { clearTimeout(idle); idle = setTimeout(done, 140); };
    window.addEventListener('scroll', bump, { passive: true });
    hardStop = setTimeout(done, 1600);
    // setTimeout, ne requestAnimationFrame: rAF stoji dok je kartica u pozadini,
    // pa bi centriranje ostalo da visi do `hardStop`-a.
    setTimeout(() => {
      window.scrollTo(0, 0);              // jos jednom, ako je skok stigao posle nas
      window.scrollTo({ top: landingY(sec), behavior: 'smooth' });
      bump();                             // ako skrol uopste ne krene, `done` ipak stigne
    }, 0);
  }

  if (deepLink) {
    /* Bez ovoga pregledac po povratku na istu adresu VRACA staru poziciju skrola
       i to se desi POSLE naseg skrola — stranica zavrsi na pogresnom mestu. */
    try { history.scrollRestoration = 'manual'; } catch (e) {}
    window.scrollTo(0, 0);
  }

  if (deepLink && !calm) {
    build(0);                             // krece od prvog ukusa, cilj dolazi posle skrola
    scrollThenCenter(target);
  } else if (deepLink) {
    // ugasen pokret: isti ISHOD (ukus u sredini, sekcija na ekranu), samo bez animacije
    build(target);
    const sec = document.getElementById('ukusi');
    const land = () => window.scrollTo({ top: landingY(sec), behavior: 'auto' });
    land();
    // jos jednom kad se sve ucita: do tada slike dobiju visinu pa se sekcija pomeri
    window.addEventListener('load', () => setTimeout(land, 0), { once: true });
  } else {
    build(target >= 0 ? target : 0);
    startAuto();
  }
})();

/* ---------- Kontakt forma (kontakt.html) ----------
   Za sada je PRIKAZNA: ne šalje nigde. Kad izaberemo integraciju
   (FormSubmit / Formspree / Webflow forms), poruke idu na
   petrovic.lazar2409@gmail.com.                                     */
(function () {
  const form = document.getElementById('contactForm');
  if (!form) return;
  const note = document.getElementById('contactNote');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    note.textContent = t('contact.demo');
  });
  document.addEventListener('langchange', () => { if (note.textContent) note.textContent = t('contact.demo'); });
})();

/* ---------- Filter proizvoda + nav deep-link (index.html) ----------
   Marka (Elfbar/Lost Mary) i Tip (Pod sistem/Jednokratni) su radio grupe —
   po jedan izbor iz svake. Nav dropdown „Proizvodi" ne vodi na posebnu
   stranicu: samo pre-selektuje filtere i skroluje na #prods (bez reloada).
   Za sad 3 uređaja; logika je spremna za veći katalog kad stigne. */
(function () {
  const pf = document.getElementById('pf');
  const grid = document.querySelector('#prods .prods');
  if (!pf || !grid) return;

  const cards = [...grid.querySelectorAll('.card')];
  const chipsWrap = document.getElementById('pfChips');
  const emptyEl = document.getElementById('pfEmpty');
  const clearBtn = document.getElementById('pfClear');
  const drops = [...pf.querySelectorAll('.pf-drop')];

  const state = { brand: 'all', type: 'all' };
  const VALID = { brand: ['all', 'lost-mary', 'elfbar'], type: ['all', 'pod', 'jednokratni'] };

  // labela za dugme/čip po grupi+vrednosti (brendovi se ne prevode)
  const valLabel = (group, val) => {
    if (val === 'all') return t(group === 'brand' ? 'prods.filter.all_brands' : 'prods.filter.all_types');
    if (group === 'brand') return val === 'elfbar' ? 'Elfbar' : 'Lost Mary';
    return t(val === 'pod' ? 'prods.filter.pod' : 'prods.filter.disp');
  };
  const chipClass = (group, val) =>
    group === 'brand' ? (val === 'elfbar' ? 'brand-elf' : 'brand-lm') : 'type';

  const CHIP_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  // Čipovi se usklađuju (ne brišu se svi odjednom): postojeći ostaju, novi ulaze
  // fade+scale, uklonjeni izlaze fade+scale — da prelaz ne bude ispresecan.
  function renderChips() {
    const want = ['brand', 'type'].filter(g => state[g] !== 'all');
    let lbl = chipsWrap.querySelector('.pf-chips-lbl');
    if (want.length && !lbl) {
      lbl = document.createElement('span');
      lbl.className = 'pf-chips-lbl';
      chipsWrap.prepend(lbl);
    }
    if (lbl) { lbl.textContent = t('prods.filter.active'); lbl.hidden = !want.length; }

    // izlazak čipova koji više nisu aktivni
    chipsWrap.querySelectorAll('.chip').forEach(el => {
      if (!want.includes(el.dataset.group) && !el.classList.contains('pf-chip-out')) {
        el.classList.add('pf-chip-out');
        const done = () => el.remove();
        el.addEventListener('transitionend', done, { once: true });
        setTimeout(done, 320);
      }
    });

    // dodavanje/ažuriranje aktivnih (isti čvor ostaje -> bez re-animacije)
    want.forEach(g => {
      let el = chipsWrap.querySelector('.chip[data-group="' + g + '"]:not(.pf-chip-out)');
      if (el) {
        el.className = 'chip ' + chipClass(g, state[g]);
        el.querySelector('.chip-lbl').textContent = valLabel(g, state[g]);
      } else {
        el = document.createElement('span');
        el.className = 'chip ' + chipClass(g, state[g]);
        el.dataset.group = g;
        el.innerHTML = `<span class="chip-lbl">${valLabel(g, state[g])}</span>` +
          `<button type="button" class="x" data-clear="${g}" aria-label="${t('prods.filter.remove')}">${CHIP_X}</button>`;
        chipsWrap.appendChild(el);
        el.classList.add('pf-chip-in');
        void el.offsetWidth;                        // flush pre uklanjanja (ne zavisi od rAF)
        el.classList.remove('pf-chip-in');
      }
    });
    // redosled: Marka pa Tip
    want.forEach(g => {
      const el = chipsWrap.querySelector('.chip[data-group="' + g + '"]:not(.pf-chip-out)');
      if (el) chipsWrap.appendChild(el);
    });
  }

  const cardOk = (c) =>
    (state.brand === 'all' || c.dataset.brand === state.brand)
    && (state.type === 'all' || c.dataset.type === state.type);

  let cardsInit = false;
  // FLIP: kartice koje ostaju vidljive glatko skliznu na nove pozicije; nove
  // ulaze fade+scale, nepotrebne izlaze fade pa se uklone iz toka.
  function animateCards() {
    let shown = 0;
    cards.forEach(c => { if (cardOk(c)) shown++; });
    if (emptyEl) emptyEl.hidden = shown !== 0;

    if (!cardsInit) {                             // prvi (inicijalni) prikaz je instant
      cards.forEach(c => { c.hidden = !cardOk(c); });
      cardsInit = true;
      return;
    }

    // FIRST — pozicije trenutno vidljivih
    const first = new Map();
    cards.forEach(c => { if (!c.hidden) first.set(c, c.getBoundingClientRect()); });
    const gridRect = grid.getBoundingClientRect();

    // izlazeće -> van toka (apsolutno), da ostale odmah reflow-uju
    const leaving = [];
    cards.forEach(c => {
      if (!c.hidden && !cardOk(c)) {
        const r = first.get(c);
        c.style.width = r.width + 'px';
        c.style.height = r.height + 'px';
        c.style.top = (r.top - gridRect.top) + 'px';
        c.style.left = (r.left - gridRect.left) + 'px';
        c.classList.add('pf-abs');
        leaving.push(c);
      }
    });

    // ulazeće -> otkrivamo u pred-stanju (nevidljivo, ali zauzima svoj slot)
    const entering = [];
    cards.forEach(c => { if (c.hidden && cardOk(c)) { c.hidden = false; c.classList.add('pf-in-pre'); entering.push(c); } });

    // LAST — nove pozicije vidljivih (izlazeće su apsolutne, van računa)
    const stay = cards.filter(c => cardOk(c) && !c.classList.contains('pf-abs'));
    const last = new Map(stay.map(c => [c, c.getBoundingClientRect()]));

    // INVERT — kartice koje ostaju pomeramo na staru poziciju (bez tranzicije)
    const moving = [];
    stay.forEach(c => {
      if (first.has(c)) {
        const f = first.get(c), l = last.get(c);
        const dx = f.left - l.left, dy = f.top - l.top;
        if (dx || dy) {
          c.style.transition = 'none';
          c.style.transform = `translate(${dx}px, ${dy}px)`;
          moving.push(c);
        }
      }
    });

    // FLUSH — sinhrono „komituj" početno stanje (ne zavisi od rAF/vidljivosti taba)
    void grid.offsetWidth;

    // PLAY — pokreni sve tranzicije istovremeno
    leaving.forEach(c => {
      c.classList.add('pf-out');                  // fade+scale out
      const tm = setTimeout(() => finish(), 460);
      function finish(e) {
        if (e && e.propertyName && e.propertyName !== 'opacity') return;
        c.hidden = true;
        c.classList.remove('pf-abs', 'pf-out');
        c.style.cssText = '';
        clearTimeout(tm);
        c.removeEventListener('transitionend', finish);
      }
      c.addEventListener('transitionend', finish);
    });
    moving.forEach(c => { c.style.transition = ''; c.style.transform = ''; });  // FLIP klizanje
    entering.forEach(c => c.classList.remove('pf-in-pre'));                     // fade+scale in
  }

  function apply() {
    animateCards();
    pf.querySelectorAll('.pf-val').forEach(el => { el.textContent = valLabel(el.dataset.val, state[el.dataset.val]); });
    pf.querySelectorAll('.pf-opt').forEach(o =>
      o.setAttribute('aria-checked', state[o.dataset.group] === o.dataset.val ? 'true' : 'false'));
    renderChips();
    if (clearBtn) clearBtn.hidden = !(state.brand !== 'all' || state.type !== 'all');
  }

  const scrollToProds = () =>
    document.getElementById('prods').scrollIntoView({ behavior: 'smooth', block: 'start' });

  function setFilter(group, val) {
    if (!VALID[group] || !VALID[group].includes(val)) return;
    state[group] = val;
    apply();
  }

  const closeDrops = () => drops.forEach(d => {
    d.classList.remove('open');
    const b = d.querySelector('.pf-btn'); if (b) b.setAttribute('aria-expanded', 'false');
  });

  drops.forEach(d => {
    const btn = d.querySelector('.pf-btn');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = !d.classList.contains('open');
      closeDrops();
      d.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });
  pf.querySelectorAll('.pf-opt').forEach(o =>
    o.addEventListener('click', () => { setFilter(o.dataset.group, o.dataset.val); closeDrops(); }));
  document.addEventListener('click', (e) => { if (!e.target.closest('.pf-drop')) closeDrops(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrops(); });

  chipsWrap.addEventListener('click', (e) => {
    const x = e.target.closest('[data-clear]');
    if (x) setFilter(x.dataset.clear, 'all');
  });
  if (clearBtn) clearBtn.addEventListener('click', () => { state.brand = 'all'; state.type = 'all'; apply(); });

  // nav dropdown „Proizvodi" -> filtriraj + skroluj (bez reloada na index-u)
  document.querySelectorAll('.prod-menu [data-filter]').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      state.brand = VALID.brand.includes(a.dataset.brand) ? a.dataset.brand : 'all';
      state.type = VALID.type.includes(a.dataset.type) ? a.dataset.type : 'all';
      apply();
      if (document.body.classList.contains('nav-open')) {
        document.body.classList.remove('nav-open');
        const nb = document.querySelector('.nav-toggle');
        if (nb) nb.setAttribute('aria-expanded', 'false');
      }
      scrollToProds();
    });
  });

  // ?brand=&type= pri učitavanju (npr. dolazak sa druge stranice)
  const q = new URLSearchParams(location.search);
  const qb = q.get('brand'), qt = q.get('type');
  if (qb && VALID.brand.includes(qb)) state.brand = qb;
  if (qt && VALID.type.includes(qt)) state.type = qt;

  apply();
  document.addEventListener('langchange', apply);

  if ((qb && qb !== 'all') || (qt && qt !== 'all')) setTimeout(scrollToProds, 60);
})();

/* ---------- Lokacije (lokacije.html) ----------
   Preseljeno u lokacije.js — MapTiler SDK je ESM, pa taj deo mora
   da se ucitava kao <script type="module">. ---------- */
