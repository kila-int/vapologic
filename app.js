/* ===== Vapologic — zajednički JS (index / proizvod / blog / lokacije) ===== */

const ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
// emoji + akcenat po ukusu (koristi se na karticama rezultata kviza)
const FLAVOR_EMO = { watermelon: '🍉', strawberry: '🍓', blueberry: '🫐', grape: '🍇', mango: '🥭',
  melon: '🍈', pineapple: '🍍', cherry: '🍒', kiwi: '🥝', menthol: '❄️', lemonade: '🍋' };
const FLAVOR_ACC = { watermelon: '#ff4d9d', strawberry: '#ff4d9d', cherry: '#ff4d9d', lemonade: '#ffcf5c',
  mango: '#ffcf5c', pineapple: '#ffcf5c', grape: '#b14bff', blueberry: '#38d6ff', menthol: '#38d6ff',
  melon: '#ff4d9d', kiwi: '#38d6ff' };
const pickBy = (map, name, fallback) => {
  const n = name.toLowerCase();
  for (const k in map) if (n.includes(k)) return map[k];
  return fallback;
};
const emoFor = (name) => pickBy(FLAVOR_EMO, name, '💨');
const accFor = (name) => pickBy(FLAVOR_ACC, name, '#b14bff');

const slug = (s) => s.toLowerCase()
  .replace(/č|ć/g, 'c').replace(/š/g, 's').replace(/ž/g, 'z').replace(/đ/g, 'dj')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

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
    slides.style.transform = `translateX(-${idx * 100}%)`;
    [...dotsWrap.children].forEach((d, k) => d.classList.toggle('on', k === idx));
  }
  window.go = (d) => { set(idx + d); restartAuto(); };
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function restartAuto() { if (reduce) return; clearInterval(timer); timer = setInterval(() => set(idx + 1), 5000); }
  set(0); restartAuto();
})();

/* ---------- Kviz (index.html) ---------- */
const FLAVORS = [
  { fl: "Watermelon ice", dev: "BM1000", taste: ["slatki"], intensity: "snažniji", puffs: "1000" },
  { fl: "Strawberry ice", dev: "BM1000", taste: ["slatki"], intensity: "nežniji", puffs: "1000" },
  { fl: "Blueberry sour raspberry", dev: "BM1000", taste: ["kiseli"], intensity: "snažniji", puffs: "1000" },
  { fl: "Strawberry kiwi", dev: "BM1000", taste: ["slatko-kiseli"], intensity: "nežniji", puffs: "1000" },
  { fl: "Grape", dev: "BM1000", taste: ["osvežavajući"], intensity: "nežniji", puffs: "1000" },
  { fl: "Triple Mango", dev: "BM1000", taste: ["tropski"], intensity: "nežniji", puffs: "1000" },
  { fl: "Triple Melon", dev: "BM1000", taste: ["slatki"], intensity: "nežniji", puffs: "1000" },
  { fl: "Pineapple Ice", dev: "BM1000", taste: ["tropski"], intensity: "snažniji", puffs: "1000" },
  { fl: "Watermelon", dev: "EB1000", taste: ["slatki", "osvežavajući"], intensity: "nežniji", puffs: "1000" },
  { fl: "Cherry", dev: "EB1000", taste: ["slatko-kiseli"], intensity: "snažniji", puffs: "1000" },
  { fl: "Strawberry ice", dev: "EB1000", taste: ["slatki"], intensity: "nežniji", puffs: "1000" },
  { fl: "Blueberry", dev: "EB1000", taste: ["slatko-kiseli"], intensity: "nežniji", puffs: "1000" },
  { fl: "Kiwi passion fruit guava", dev: "EB1000", taste: ["kiseli", "tropski"], intensity: "nežniji", puffs: "1000" },
  { fl: "Blueberry sour raspberry", dev: "EB1000", taste: ["kiseli"], intensity: "snažniji", puffs: "1000" },
  { fl: "Menthol", dev: "EB1000", taste: ["osvežavajući"], intensity: "snažniji", puffs: "1000" },
  { fl: "Pink lemonade", dev: "EB1000", taste: ["slatko-kiseli"], intensity: "snažniji", puffs: "1000" },
  { fl: "Watermelon ice", dev: "EB6000", taste: ["slatki"], intensity: "nežniji", puffs: "6000" },
  { fl: "Triple mango", dev: "EB6000", taste: ["tropski"], intensity: "nežniji", puffs: "6000" },
  { fl: "Strawberry ice", dev: "EB6000", taste: ["slatki"], intensity: "snažniji", puffs: "6000" },
  { fl: "Menthol", dev: "EB6000", taste: ["osvežavajući"], intensity: "snažniji", puffs: "6000" },
  { fl: "Grape", dev: "EB6000", taste: ["osvežavajući"], intensity: "nežniji", puffs: "6000" },
  { fl: "Blueberry sour raspberry", dev: "EB6000", taste: ["kiseli", "slatko-kiseli"], intensity: "snažniji", puffs: "6000" },
];

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
      a.href = `/proizvod?ukus=${slug(f.fl)}&dev=${f.dev}`;
      a.setAttribute('aria-label', t('quiz.open_aria', { fl: f.fl, dev: f.dev }));
      a.style.setProperty('--acc', accFor(f.fl));
      const tags = f.taste.map(x => `<span class="t">${t('taste.' + x)}</span>`).join('')
        + `<span class="t">${t('intensity.' + f.intensity)}</span><span class="t">${f.puffs}</span>`;
      a.innerHTML = `<div class="rimg"><span class="remo" aria-hidden="true">${emoFor(f.fl)}</span><span class="fr">1:1</span></div>
        <div class="rbody">
          <div class="fl">${f.fl}</div><div class="dev">${f.dev}</div>
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

/* ---------- Slajder ukusa (proizvod.html) — bešavni infinite loop ----------
   Kartice se pomeraju JEDNA PO JEDNA; kad se dođe do poslednje, traka nastavlja
   udesno preko klonova pa se tiho (bez tranzicije) resetuje — nema naglog
   „vraćanja na početak". Broj vidljivih kartica (--per) i dalje dolazi iz CSS-a. */
(function () {
  const track = document.getElementById('fcar');
  const slider = document.getElementById('fslider');
  if (!track || !slider) return;
  const view = slider.querySelector('.pview');
  const dotsEl = document.getElementById('fdots');
  const prevBtn = document.getElementById('fPrev');
  const nextBtn = document.getElementById('fNext');

  const EB6 = [
    { fn: 'Watermelon Ice', slug: 'watermelon-ice', emo: '🍉', taste: 'slatki', intensity: 'nežniji', acc: '#ff4d9d' },
    { fn: 'Triple Mango', slug: 'triple-mango', emo: '🥭', taste: 'tropski', intensity: 'nežniji', acc: '#ffcf5c' },
    { fn: 'Strawberry Ice', slug: 'strawberry-ice', emo: '🍓', taste: 'slatki', intensity: 'snažniji', acc: '#ff4d9d' },
    { fn: 'Menthol', slug: 'menthol', emo: '❄️', taste: 'osvežavajući', intensity: 'snažniji', acc: '#38d6ff' },
    { fn: 'Grape', slug: 'grape', emo: '🍇', taste: 'osvežavajući', intensity: 'nežniji', acc: '#b14bff' },
    { fn: 'Blueberry Sour Raspberry', slug: 'blueberry-sour-raspberry', emo: '🫐', taste: 'kiseli', intensity: 'snažniji', acc: '#38d6ff' },
  ];

  const title = document.getElementById('pdTitle');
  const setTitle = (f) => {
    if (title && f) title.innerHTML = 'EB6000 <span style="color:var(--muted-2);font-weight:500">·</span> <span class="grad">' + f.fn + '</span>';
  };

  /* Slika + ime, bez opisa i bez linka (nema per-flavor stranice). */
  const card = (f, clone) => `
    <div class="card${clone ? ' is-clone' : ''}" style="--acc:${f.acc}"${clone ? ' aria-hidden="true"' : ''}>
      <div class="shot"><span class="brand">Elfbar</span><span class="ratio">1:1</span>
        <span class="femo" aria-hidden="true">${f.emo}</span></div>
      <div class="body"><h3>${f.fn}</h3></div>
    </div>`;

  const N = EB6.length;
  const AUTO_MS = 3800;
  let per = 1, step = 0, pos = 0, animating = false, finTimer = null, autoTimer = null;

  const readPer = () => Math.max(1, parseInt(getComputedStyle(slider).getPropertyValue('--per'), 10) || 1);
  const gapPx = () => parseFloat(getComputedStyle(track).columnGap) || 0;
  // .pview ima vodoravni padding (da se hover ne seče) -> širina sadržaja je bez njega
  const viewW = () => {
    const cs = getComputedStyle(view);
    return view.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  };
  const realIndex = () => ((((pos - per) % N) + N) % N);

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
    track.style.transform = `translateX(${-pos * step}px)`;
    if (!animate) { void track.offsetHeight; track.style.transition = ''; }  // zaključaj kadar bez tranzicije
    updateDots();
  }

  // prošireni niz: [klonovi poslednjih `per`] + [pravih N] + [klonovi prvih `per`]
  function build(ri) {
    per = readPer();
    const head = EB6.slice(N - per).map(f => card(f, true));
    const body = EB6.map(f => card(f, false));
    const tail = EB6.slice(0, per).map(f => card(f, true));
    track.innerHTML = head.concat(body, tail).join('');
    buildDots();
    measure();
    pos = per + ((((ri || 0) % N) + N) % N);
    place(false);
  }

  function afterMove() {
    animating = false;
    // ušli smo u klon-zonu -> tiho vrati na ekvivalentnu pravu karticu (bez „skoka")
    if (pos >= per + N) { pos -= N; place(false); }
    else if (pos < per) { pos += N; place(false); }
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
  const userGoTo = (ri) => { restartAuto(); moveTo(per + ri); };

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

  // prevlačenje prstom
  let x0 = null;
  view.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; stopAuto(); }, { passive: true });
  view.addEventListener('touchend', (e) => {
    if (x0 != null) {
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 45) stepBy(dx < 0 ? 1 : -1);
    }
    x0 = null; startAuto();
  }, { passive: true });

  /* Broj kartica po strani zavisi od širine -> na prelaz breakpointa rebuild-uj
     klonove čuvajući trenutni ukus; inače samo preračunaj korak i pomeraj. */
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

  // init: ?ukus=... postavlja početni ukus i naslov u heroju
  const uk = new URLSearchParams(location.search).get('ukus');
  const found = uk ? EB6.findIndex(f => f.slug === uk) : -1;
  build(found >= 0 ? found : 0);
  setTitle(found >= 0 ? EB6[found] : EB6[0]);
  startAuto();
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
