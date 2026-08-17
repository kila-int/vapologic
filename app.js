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
window.toggleNav = () => {
  const open = document.body.classList.toggle('nav-open');
  const btn = document.querySelector('.nav-toggle');
  if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
};
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
      a.href = `proizvod.html?ukus=${slug(f.fl)}&dev=${f.dev}`;
      a.setAttribute('aria-label', t('quiz.open_aria', { fl: f.fl, dev: f.dev }));
      a.style.setProperty('--acc', accFor(f.fl));
      const tags = f.taste.map(x => `<span class="t">${t('taste.' + x)}</span>`).join('')
        + `<span class="t">${t('intensity.' + f.intensity)}</span><span class="t">${f.puffs}</span>`;
      a.innerHTML = `<div class="rimg"><span class="remo" aria-hidden="true">${emoFor(f.fl)}</span><span class="fr">3:4</span></div>
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

/* ---------- Product page: slajder ukusa — scroll-snap (proizvod.html) ---------- */
(function () {
  const fcar = document.getElementById('fcar');
  if (!fcar) return;
  const EB6 = [
    { fn: 'Watermelon Ice', slug: 'watermelon-ice', emo: '🍉', taste: 'slatki', intensity: 'nežniji', acc: '#ff4d9d' },
    { fn: 'Triple Mango', slug: 'triple-mango', emo: '🥭', taste: 'tropski', intensity: 'nežniji', acc: '#ffcf5c' },
    { fn: 'Strawberry Ice', slug: 'strawberry-ice', emo: '🍓', taste: 'slatki', intensity: 'snažniji', acc: '#ff4d9d' },
    { fn: 'Menthol', slug: 'menthol', emo: '❄️', taste: 'osvežavajući', intensity: 'snažniji', acc: '#38d6ff' },
    { fn: 'Grape', slug: 'grape', emo: '🍇', taste: 'osvežavajući', intensity: 'nežniji', acc: '#b14bff' },
    { fn: 'Blueberry Sour Raspberry', slug: 'blueberry-sour-raspberry', emo: '🫐', taste: 'kiseli', intensity: 'snažniji', acc: '#38d6ff' },
  ];
  const BAND = EB6.length;               // jedan „pojas" = kompletan set ukusa
  const title = document.getElementById('pdTitle');
  const upd = (f) => { if (title && f) title.innerHTML = `EB6000 <span style="color:var(--muted-2);font-weight:500">·</span> <span class="grad">${f.fn}</span>`; };

  // Za beskonačnu petlju renderujemo set 3× (klon pre + original + klon posle).
  // Kad centar izađe iz srednjeg pojasa, tiho pomerimo scrollLeft za tačno jedan
  // pojas — sadržaj pod prozorom je identičan, pa se skok ne vidi.
  const card = (f, i) => `
    <a class="fslide" data-i="${i % BAND}" data-slug="${f.slug}" href="proizvod.html?ukus=${f.slug}" style="--acc:${f.acc}" aria-label="${t('flav.open', { fn: f.fn })}">
      <div class="fimg"><span class="femo" aria-hidden="true">${f.emo}</span><span class="fr">3:4</span></div>
      <div class="fbody"><div class="fn">${f.fn}</div><div class="ftag">${t('taste.' + f.taste)} · ${t('intensity.' + f.intensity)}</div></div>
    </a>`;
  const renderAll = () => {
    fcar.innerHTML = [...EB6, ...EB6, ...EB6].map(card).join('');
    return [...fcar.children];
  };
  let slides = renderAll();

  const nearestIdx = () => {
    const c = fcar.getBoundingClientRect().left + fcar.clientWidth / 2;
    let best = 0, bd = Infinity;
    slides.forEach((s, i) => {
      const r = s.getBoundingClientRect();
      const d = Math.abs((r.left + r.right) / 2 - c);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  };
  const bandWidth = () =>
    slides[BAND].getBoundingClientRect().left - slides[0].getBoundingClientRect().left;

  function syncActive() {
    const i = nearestIdx();
    slides.forEach((s, k) => s.classList.toggle('active', k === i));
    upd(EB6[i % BAND]);
  }
  // vrati centar u srednji pojas (bez animacije — skok je nevidljiv)
  function normalize() {
    const i = nearestIdx();
    if (i < BAND) fcar.scrollTo({ left: fcar.scrollLeft + bandWidth(), behavior: 'instant' });
    else if (i >= 2 * BAND) fcar.scrollTo({ left: fcar.scrollLeft - bandWidth(), behavior: 'instant' });
  }
  const centerOn = (i, behavior = 'smooth') => {
    const s = slides[Math.max(0, Math.min(slides.length - 1, i))];
    const cr = fcar.getBoundingClientRect(), sr = s.getBoundingClientRect();
    const delta = (sr.left + sr.width / 2) - (cr.left + cr.width / 2);
    fcar.scrollTo({ left: fcar.scrollLeft + delta, behavior });
  };

  // klik na neaktivnu -> centriraj je; klik na aktivnu -> otvori stranicu (default link)
  fcar.addEventListener('click', (e) => {
    const s = e.target.closest('.fslide');
    if (s && !s.classList.contains('active')) { e.preventDefault(); centerOn(slides.indexOf(s)); }
  });
  let tick;
  const settle = () => { normalize(); syncActive(); };
  fcar.addEventListener('scroll', () => { clearTimeout(tick); tick = setTimeout(settle, 90); }, { passive: true });
  window.addEventListener('resize', () => { clearTimeout(tick); tick = setTimeout(syncActive, 120); });

  document.getElementById('fPrev').onclick = () => centerOn(nearestIdx() - 1);
  document.getElementById('fNext').onclick = () => centerOn(nearestIdx() + 1);

  // krećemo od srednjeg pojasa (i od srednje kartice, da traka ne počinje prazninom levo)
  let start = Math.min(2, BAND - 1);
  const uk = new URLSearchParams(location.search).get('ukus');
  if (uk) { const i = EB6.findIndex(f => f.slug === uk); if (i >= 0) start = i; }
  // 'instant' je bitno: 'auto' bi pokupio CSS scroll-behavior:smooth i animirao na ucitavanju
  const initPos = () => { centerOn(BAND + start, 'instant'); syncActive(); };
  initPos();
  document.addEventListener('langchange', () => {
    const keep = nearestIdx();
    slides = renderAll();
    centerOn(keep, 'instant'); syncActive();
  });
  // jos jednom kad se ucitaju fontovi/slike (sirine kartica se tada mogu promeniti)
  window.addEventListener('load', initPos);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(initPos);
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

/* ---------- Lokacije (lokacije.html) ---------- 
   Preseljeno u lokacije.js — MapTiler SDK je ESM, pa taj deo mora
   da se ucitava kao <script type="module">. ---------- */
