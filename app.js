/* ===== Vapologic — zajednički JS (index / proizvod / blog / lokacije) ===== */

const ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const slug = (s) => s.toLowerCase()
  .replace(/č|ć/g, 'c').replace(/š/g, 's').replace(/ž/g, 'z').replace(/đ/g, 'dj')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/* ---------- AGE GATE (sve stranice) ---------- */
(function () {
  if (localStorage.getItem('vpl_age18') === '1') return;
  const el = document.createElement('div');
  el.className = 'agegate';
  el.innerHTML = `<div class="agecard" role="dialog" aria-modal="true" aria-labelledby="ageTitle">
      <img class="logo-img" src="vapologic-logo-white.png" alt="Vapologic">
      <h2 id="ageTitle">Imaš li 18 godina?</h2>
      <p>Ovaj sajt sadrži informacije o nikotinskim proizvodima namenjenim isključivo punoletnim osobama.</p>
      <div class="age-actions">
        <button class="btn btn-primary" id="ageYes" type="button">Imam 18+</button>
        <button class="btn btn-ghost" id="ageNo" type="button">Nemam 18</button>
      </div>
      <div class="agewarn">Proizvodi sadrže nikotin koji izaziva zavisnost.</div>
    </div>`;
  const mount = () => {
    document.body.appendChild(el);
    document.documentElement.style.overflow = 'hidden';
    el.querySelector('#ageYes').focus();
    el.querySelector('#ageYes').onclick = () => {
      localStorage.setItem('vpl_age18', '1'); el.remove(); document.documentElement.style.overflow = '';
    };
    el.querySelector('#ageNo').onclick = () => {
      document.body.innerHTML = '<div class="age-blocked">Žao nam je — sajt je dostupan samo punoletnim osobama.</div>';
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
  for (let i = 0; i < N; i++) {
    const b = document.createElement('button');
    b.setAttribute('aria-label', 'Slajd ' + (i + 1));
    b.onclick = () => { set(i); restartAuto(); };
    dotsWrap.appendChild(b);
  }
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
  const nextBtn = document.getElementById('nextBtn');
  if (!nextBtn) return;
  let step = 0;
  const answers = { taste: null, intensity: null, puffs: null };
  const stepKeys = ['taste', 'intensity', 'puffs'];

  window.pick = (key, val, el) => {
    answers[key] = val;
    el.parentElement.querySelectorAll('.opt').forEach(o => o.setAttribute('aria-pressed', 'false'));
    el.setAttribute('aria-pressed', 'true');
    nextBtn.disabled = false;
  };
  function showStep() {
    document.querySelectorAll('.qstep').forEach(s => s.classList.toggle('on', +s.dataset.step === step));
    document.querySelectorAll('.qbar .seg').forEach((s, k) => s.classList.toggle('on', k <= step));
    document.getElementById('backBtn').style.visibility = step === 0 ? 'hidden' : 'visible';
    nextBtn.innerHTML = step === 2 ? 'Prikaži rezultat 🎉' : ('Dalje <span class="ico" aria-hidden="true">' + ARROW + '</span>');
    nextBtn.disabled = !answers[stepKeys[step]];
  }
  window.next = () => { if (step < 2) { step++; showStep(); } else { finish(); } };
  window.back = () => { if (step > 0) { step--; showStep(); } };
  function finish() {
    document.querySelectorAll('.qstep').forEach(s => s.classList.remove('on'));
    document.getElementById('backBtn').parentElement.style.display = 'none';
    document.querySelectorAll('.qbar .seg').forEach(s => s.classList.add('on'));
    let m = FLAVORS.filter(f => f.taste.includes(answers.taste) && f.intensity === answers.intensity && f.puffs === answers.puffs);
    const empty = document.getElementById('empty');
    if (m.length === 0) {
      empty.style.display = 'block';
      m = FLAVORS.filter(f => f.taste.includes(answers.taste) && f.puffs === answers.puffs);
      if (m.length === 0) m = FLAVORS.filter(f => f.taste.includes(answers.taste));
    } else { empty.style.display = 'none'; }
    document.getElementById('resSummary').textContent =
      `${answers.taste} · ${answers.intensity} · ${answers.puffs} puffova — pronašli smo ${m.length} ${m.length === 1 ? 'ukus' : 'ukusa'}:`;
    const g = document.getElementById('rgrid'); g.innerHTML = '';
    m.forEach(f => {
      const a = document.createElement('a');
      a.className = 'rcard';
      a.href = `proizvod.html?ukus=${slug(f.fl)}&dev=${f.dev}`;
      a.setAttribute('aria-label', `Otvori ${f.fl} (${f.dev})`);
      a.innerHTML = `<div class="fl">${f.fl}</div><div class="dev">${f.dev}</div>
        <div class="tags">${f.taste.map(t => `<span class="t">${t}</span>`).join('')}<span class="t">${f.intensity}</span><span class="t">${f.puffs}</span></div>
        <span class="rmore">Otvori uređaj ${ARROW}</span>`;
      g.appendChild(a);
    });
    document.getElementById('result').classList.add('on');
  }
  window.restart = () => {
    step = 0; answers.taste = answers.intensity = answers.puffs = null;
    document.getElementById('result').classList.remove('on');
    document.getElementById('backBtn').parentElement.style.display = 'flex';
    document.querySelectorAll('.opt').forEach(o => o.setAttribute('aria-pressed', 'false'));
    showStep();
  };
  showStep();
})();

/* ---------- Product page: ?ukus= highlight (proizvod.html) ---------- */
(function () {
  const grid = document.getElementById('flavorGrid');
  if (!grid) return;
  const uk = new URLSearchParams(location.search).get('ukus');
  if (!uk) return;
  const active = grid.querySelector(`.flavor[data-ukus="${uk}"]`);
  if (active) {
    active.classList.add('active');
    const name = active.querySelector('.fname').textContent;
    const title = document.getElementById('pdTitle');
    if (title) title.innerHTML = `EB6000 <span style="color:var(--muted-2);font-weight:500">·</span> <span class="grad">${name}</span>`;
  }
})();

/* ---------- Locations page + clustering (lokacije.html) ---------- */
(function () {
  const mapEl = document.getElementById('locmap');
  if (!mapEl || typeof L === 'undefined') return;

  const CITIES = {
    'beograd': [44.8125, 20.4612], 'novi sad': [45.2671, 19.8335], 'nis': [43.3209, 21.8958],
    'niš': [43.3209, 21.8958], 'kragujevac': [44.0128, 20.9114], 'subotica': [46.1000, 19.6650],
    'zrenjanin': [45.3836, 20.3819], 'pancevo': [44.8708, 20.6403], 'pančevo': [44.8708, 20.6403],
    'cacak': [43.8914, 20.3497], 'čačak': [43.8914, 20.3497], 'kraljevo': [43.7258, 20.6892],
    'novi pazar': [43.1367, 20.5122], 'leskovac': [42.9981, 21.9461], 'valjevo': [44.2708, 19.8903],
    'uzice': [43.8556, 19.8425], 'užice': [43.8556, 19.8425], 'sombor': [45.7742, 19.1122],
    'smederevo': [44.6633, 20.9289], 'vranje': [42.5514, 21.8983], 'sabac': [44.7489, 19.6906],
    'šabac': [44.7489, 19.6906],
  };

  // ~260 test lokacija (grupisane oko gradova + rasute) — da clustering ima šta da grupiše
  const centers = [
    ['Beograd', 44.8125, 20.4612, 60], ['Novi Sad', 45.2671, 19.8335, 34], ['Niš', 43.3209, 21.8958, 24],
    ['Kragujevac', 44.0128, 20.9114, 18], ['Subotica', 46.10, 19.665, 12], ['Zrenjanin', 45.3836, 20.3819, 10],
    ['Pančevo', 44.8708, 20.6403, 12], ['Čačak', 43.8914, 20.3497, 10], ['Kraljevo', 43.7258, 20.6892, 10],
    ['Novi Pazar', 43.1367, 20.5122, 9], ['Leskovac', 42.9981, 21.9461, 9], ['Valjevo', 44.2708, 19.8903, 9],
    ['Užice', 43.8556, 19.8425, 8], ['Sombor', 45.7742, 19.1122, 7], ['Smederevo', 44.6633, 20.9289, 8],
    ['Vranje', 42.5514, 21.8983, 7], ['Šabac', 44.7489, 19.6906, 8],
  ];
  const types = ['Kiosk Duvan', 'Benzinska stanica', 'Vape Shop', 'Mini market', 'Trafika'];
  const LOCATIONS = [];
  centers.forEach(c => {
    for (let i = 0; i < c[3]; i++) {
      const spread = 0.09;
      LOCATIONS.push({
        name: `${types[LOCATIONS.length % types.length]} — ${c[0]}`,
        addr: `${c[0]}, Srbija`,
        lat: c[1] + (Math.random() - 0.5) * spread,
        lng: c[2] + (Math.random() - 0.5) * spread * 1.4,
      });
    }
  });

  const map = L.map('locmap', { scrollWheelZoom: false, zoomControl: false }).setView([44.05, 20.8], 7);
  // Esri World Imagery (satelit) — nema iscrtanih političkih granica, pa Kosovo NIJE odvojeno od Srbije.
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri', maxZoom: 19,
  }).addTo(map);

  const cluster = (typeof L.markerClusterGroup === 'function')
    ? L.markerClusterGroup({ maxClusterRadius: 55, chunkedLoading: true, showCoverageOnHover: false })
    : L.layerGroup();
  LOCATIONS.forEach((loc, i) => {
    const m = L.circleMarker([loc.lat, loc.lng], {
      radius: 7, color: '#fff', weight: 1.4, fillColor: i % 2 ? '#38d6ff' : '#ff4d9d', fillOpacity: .9,
    }).bindPopup(`<b>${loc.name}</b><br>${loc.addr}`);
    loc._m = m;
    cluster.addLayer(m);
  });
  cluster.addTo(map);

  let refMarker = null, refCircle = null;
  const R = 6371, rad = (d) => d * Math.PI / 180;
  const haversine = (a, b, c, d) => {
    const dLat = rad(c - a), dLng = rad(d - b);
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  };

  const radiusInput = document.getElementById('locRadius');
  const radiusVal = document.getElementById('locRadiusVal');
  radiusInput.addEventListener('input', () => radiusVal.textContent = radiusInput.value + ' km');
  const resultsEl = document.getElementById('locResults');

  function search(refLat, refLng, label) {
    const km = +radiusInput.value;
    const near = LOCATIONS.map(l => ({ ...l, d: haversine(refLat, refLng, l.lat, l.lng) }))
      .filter(l => l.d <= km).sort((a, b) => a.d - b.d);

    if (refMarker) map.removeLayer(refMarker);
    if (refCircle) map.removeLayer(refCircle);
    refMarker = L.circleMarker([refLat, refLng], { radius: 9, color: '#fff', weight: 2, fillColor: '#b14bff', fillOpacity: 1 })
      .addTo(map).bindPopup(`<b>${label}</b>`);
    refCircle = L.circle([refLat, refLng], { radius: km * 1000, color: '#b14bff', weight: 1, fillColor: '#b14bff', fillOpacity: .08 }).addTo(map);

    resultsEl.innerHTML = '';
    if (near.length === 0) {
      resultsEl.innerHTML = `<div class="locempty">Nema lokacija u krugu od ${km} km. Povećaj radijus.</div>`;
    } else {
      const head = document.createElement('div');
      head.className = 'locempty';
      head.textContent = `${near.length} lokacija u krugu od ${km} km — najbliža ${near[0].d.toFixed(1)} km:`;
      resultsEl.appendChild(head);
      near.slice(0, 30).forEach(l => {
        const item = document.createElement('div');
        item.className = 'locitem'; item.tabIndex = 0;
        item.innerHTML = `<div class="ln">${l.name}</div><div class="la">${l.addr}</div><div class="ld">${l.d.toFixed(1)} km od tebe</div>`;
        const focus = () => { map.setView([l.lat, l.lng], 13); l._m.openPopup(); };
        item.onclick = focus;
        item.onkeydown = (e) => { if (e.key === 'Enter') focus(); };
        resultsEl.appendChild(item);
      });
    }
    const pts = [[refLat, refLng], ...near.map(l => [l.lat, l.lng])];
    if (near.length) map.fitBounds(pts, { padding: [40, 40], maxZoom: 12 });
    else map.setView([refLat, refLng], 9);
  }

  document.getElementById('locForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = document.getElementById('locQuery').value.trim().toLowerCase();
    if (q && CITIES[q]) { search(CITIES[q][0], CITIES[q][1], q.charAt(0).toUpperCase() + q.slice(1)); return; }
    const key = Object.keys(CITIES).find(c => q.length > 1 && c.includes(q));
    if (key) { search(CITIES[key][0], CITIES[key][1], key.charAt(0).toUpperCase() + key.slice(1)); return; }
    if (q) { resultsEl.innerHTML = `<div class="locempty">Grad „${q}" nije u test bazi. Probaj: Beograd, Novi Sad, Niš, Kragujevac…</div>`; return; }
    document.getElementById('geoBtn').click();
  });

  document.getElementById('geoBtn').addEventListener('click', () => {
    if (!navigator.geolocation) { search(44.8125, 20.4612, 'Beograd'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => search(pos.coords.latitude, pos.coords.longitude, 'Moja lokacija'),
      () => search(44.8125, 20.4612, 'Beograd (podrazumevano)')
    );
  });
})();
