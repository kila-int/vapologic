/* ===== Korekcija lokacija (interni alat, /lokacije-korekcija) =====
   Prolazi kroz prodajna mesta iz lokacije-podaci.json na satelitskom snimku; pin se prevuce na
   pravo mesto. Ispravke se cuvaju u OVOM pregledacu (localStorage) i preuzimaju kao JSON fajl,
   koji alat (tools/excel-lokacije.py --samo-ispravke fajl.json) primenjuje na bazu.
   Stranica namerno NE menja sajt direktno: staticki hosting nema server, a i bolje je da
   ispravke prodju kroz jednu ruku pre nego sto odu live. */

import * as maptilersdk from 'https://cdn.jsdelivr.net/npm/@maptiler/sdk@4.1.0/+esm';

maptilersdk.config.apiKey = 'xCboGTDaRsqFuVgneleh';
const LS = 'vpl_ispravke_v1', LS_SENT = 'vpl_ispravke_poslato';
const $ = (id) => document.getElementById(id);

let locs = [], base = {}, edits = {}, filter = 'approx', query = '', cur = null, view = [];

const store = {
  load() { try { return JSON.parse(localStorage.getItem(LS) || '{}'); } catch (e) { return {}; } },
  save() { try { localStorage.setItem(LS, JSON.stringify(edits)); } catch (e) { toast('Pregledač ne dozvoljava čuvanje — preuzmi fajl pre zatvaranja!'); } },
  sentTs() { try { return +localStorage.getItem(LS_SENT) || 0; } catch (e) { return 0; } },
  markSent() { try { localStorage.setItem(LS_SENT, String(Date.now())); } catch (e) {} },
};

const fold = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'dj');
const TYPE = { 'loctype.gas': 'Benzinska stanica', 'loctype.kiosk': 'Kiosk', 'loctype.mini': 'Market',
  'loctype.vape': 'Vape shop', 'loctype.store': 'Prodajno mesto' };
const label = (l) => l.name || TYPE[l.typeKey] || 'Prodajno mesto';
const fix = (l) => edits[l.id] || base[l.id] || null;
const pos = (l) => fix(l) || l;
const status = (l) => edits[l.id] ? 'local' : base[l.id] ? 'done' : l.approx ? 'approx' : '';
const STATUS_TXT = { local: 'Ispravljeno (nije poslato)', done: 'Ispravljeno ranije', approx: 'Približno — proveri', '': 'Po adresi' };

let toastT;
function toast(msg) {
  const t = $('kxToast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2400);
}

/* ---------- mapa ---------- */
const map = new maptilersdk.Map({
  container: 'kxmap', style: maptilersdk.MapStyle.HYBRID_V2,
  center: [20.46, 44.81], zoom: 7, attributionControl: { compact: true },
});
map.addControl(new maptilersdk.NavigationControl({ showCompass: false }), 'top-right');
map.on('load', () => {
  try {   // ista pravila kao na /lokacije: bez sporne granice, natpisi latinicom
    const SR = ['coalesce', ['get', 'name:sr-Latn'], ['get', 'name:latin'], ['get', 'name']];
    map.getStyle().layers.forEach(l => {
      if (/disput/i.test(l.id)) { map.setLayoutProperty(l.id, 'visibility', 'none'); return; }
      if (l.type !== 'symbol') return;
      const tf = map.getLayoutProperty(l.id, 'text-field');
      if (tf && JSON.stringify(tf).includes('name')) map.setLayoutProperty(l.id, 'text-field', SR);
    });
  } catch (e) { /* stil je MapTiler-ov, struktura moze da se promeni — alat radi i bez ovoga */ }
});

const pin = new maptilersdk.Marker({ color: '#ff4d9d', draggable: true });
const origEl = document.createElement('div'); origEl.className = 'kx-orig'; origEl.title = 'Prvobitna pozicija';
const orig = new maptilersdk.Marker({ element: origEl });
let pending = null;   // pomeren, a jos nesacuvan pin

pin.on('dragend', () => { const p = pin.getLngLat(); pending = { lat: p.lat, lng: p.lng }; renderCard(); });
map.on('click', (e) => {
  if (!cur) return;
  pin.setLngLat(e.lngLat); pending = { lat: e.lngLat.lat, lng: e.lngLat.lng }; renderCard();
});

/* ---------- prikaz ---------- */
function computeView() {
  const q = fold(query).trim();
  view = locs.filter(l => {
    const s = status(l);
    if (filter === 'approx' && s !== 'approx') return false;
    if (filter === 'done' && s !== 'local' && s !== 'done') return false;
    return !q || fold(`${label(l)} ${l.addr} ${l.city}`).includes(q);
  });
}

function renderCounts() {
  const n = locs.length, done = locs.filter(l => fix(l)).length;
  const open = locs.filter(l => status(l) === 'approx').length;
  $('cApprox').textContent = open; $('cAll').textContent = n; $('cDone').textContent = done;
  $('kxProg').innerHTML = '';
  const b = document.createElement('b'); b.textContent = String(done);
  $('kxProg').append('Pregledano ', b, ` / ${n} · približnih ostalo ${open}`);
  const sent = store.sentTs();
  const unsent = Object.values(edits).filter(v => (v.ts || 0) > sent).length;
  $('kxUnsent').hidden = !unsent;
  $('kxUnsent').textContent = `Nepreuzetih ispravki: ${unsent}`;
}

function renderList() {
  const box = $('kxList'); box.innerHTML = '';
  if (!view.length) {
    const p = document.createElement('div'); p.className = 'kx-empty';
    p.textContent = filter === 'approx' && !query ? 'Sve približne lokacije su pregledane. 🎉' : 'Nema lokacija za ovaj filter.';
    box.append(p); return;
  }
  const frag = document.createDocumentFragment();
  view.forEach(l => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'kx-item'; b.setAttribute('role', 'listitem');
    b.dataset.id = l.id; if (cur && cur.id === l.id) b.setAttribute('aria-current', 'true');
    const dot = document.createElement('span'); dot.className = 'kx-dot ' + status(l);
    const txt = document.createElement('span'); txt.textContent = label(l);
    const sm = document.createElement('small'); sm.textContent = l.addr; txt.append(sm);
    b.append(dot, txt); b.onclick = () => select(l);
    frag.append(b);
  });
  box.append(frag);
}

function renderCard() {
  const card = $('kxCard');
  if (!cur) { card.hidden = true; return; }
  card.hidden = false;
  const s = pending ? 'local' : status(cur);
  $('kxStatus').className = 'kx-chip ' + s;
  $('kxStatus').textContent = pending ? 'Pomereno — klikni Sačuvaj' : STATUS_TXT[s];
  $('kxName').textContent = `${label(cur)} · ${TYPE[cur.typeKey] && cur.name ? TYPE[cur.typeKey] : cur.city}`;
  $('kxAddr').textContent = cur.addr;
  const p = pending || pos(cur);
  const moved = p.lat !== cur.lat || p.lng !== cur.lng;
  $('kxCoords').innerHTML = '';
  const span = document.createElement('span'); if (moved) span.className = 'moved';
  span.textContent = `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`;
  $('kxCoords').append(span, moved ? `  (pomereno ${Math.round(dist(cur, p))} m)` : '');
  $('kxGmap').href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`${cur.name ? cur.name + ', ' : ''}${cur.addr}, Srbija`);
  const i = view.findIndex(l => l.id === cur.id);
  $('kxPrev').disabled = i <= 0; $('kxNext').disabled = i < 0 || i >= view.length - 1;
  $('kxReset').disabled = !pending && !edits[cur.id];
}

function dist(a, b) {
  const r = Math.PI / 180, x = Math.sin((b.lat - a.lat) * r / 2) ** 2
    + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin((b.lng - a.lng) * r / 2) ** 2;
  return 12742000 * Math.asin(Math.sqrt(x));
}

function render() { computeView(); renderCounts(); renderList(); renderCard(); }

function select(l) {
  cur = l; pending = null;
  const p = pos(l);
  pin.setLngLat([p.lng, p.lat]).addTo(map);
  orig.setLngLat([l.lng, l.lat]).addTo(map);
  map.jumpTo({ center: [p.lng, p.lat], zoom: 18 });
  renderList(); renderCard();
  const el = $('kxList').querySelector(`[data-id="${l.id}"]`); if (el) el.scrollIntoView({ block: 'nearest' });
}

/* sledeca u listi; posle cuvanja u filteru „Priblizne" sacuvana nestaje, pa racunamo pre osvezavanja */
function go(step) {
  if (!cur) { if (view.length) select(view[0]); return; }
  const i = view.findIndex(l => l.id === cur.id);
  const n = view[i + step]; if (n) select(n);
}
function commit(entry) {
  const i = view.findIndex(l => l.id === cur.id);
  edits[cur.id] = { ...entry, ts: Date.now(), addr: cur.addr };
  store.save();
  computeView(); renderCounts();
  // ako sacuvana i dalje stoji u listi (filter „Sve"), sledeca je i+1; ako je ispala
  // (filter „Priblizne"), na njeno mesto je vec dosla sledeca, pa je to indeks i
  const still = view.some(l => l.id === cur.id);
  const n = view[still ? i + 1 : i];
  if (n) select(n); else { pending = null; renderList(); renderCard(); }
}

$('kxSave').onclick = () => {
  const p = pending || pos(cur);
  commit({ lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6) });
  toast('Sačuvano');
};
$('kxOk').onclick = () => {   // pin je vec dobar — samo potvrdi (skida oznaku „priblizno")
  const p = pos(cur);
  commit({ lat: p.lat, lng: p.lng, ok: true });
  toast('Potvrđeno kao tačno');
};
$('kxReset').onclick = () => {
  delete edits[cur.id]; store.save(); pending = null;
  const p = pos(cur); pin.setLngLat([p.lng, p.lat]);
  render(); toast('Vraćeno');
};
$('kxPrev').onclick = () => go(-1);
$('kxNext').onclick = () => go(1);

document.querySelectorAll('.kx-tab').forEach(b => b.onclick = () => {
  filter = b.dataset.f;
  document.querySelectorAll('.kx-tab').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  computeView(); renderList();
  if (!cur || !view.some(l => l.id === cur.id)) { if (view.length) select(view[0]); else { cur = null; renderCard(); } }
});
let st;
$('kxSearch').addEventListener('input', (e) => {
  clearTimeout(st); st = setTimeout(() => { query = e.target.value; computeView(); renderList(); }, 150);
});

document.addEventListener('keydown', (e) => {
  // Na fokusiranom dugmetu/linku Enter vec okida njihov klik — inace bi se sacuvalo DVA puta
  // i jedna lokacija bi bila preskocena bez pregleda.
  const el = e.target instanceof Element ? e.target : null;
  if ((el && el.closest('input, textarea, select, button, a, label')) || !cur || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Enter') { e.preventDefault(); $('kxSave').click(); }
  else if (e.key === 't' || e.key === 'T') $('kxOk').click();
  else if (e.key === 'ArrowRight') go(1);
  else if (e.key === 'ArrowLeft') go(-1);
});

/* ---------- uvoz / izvoz ---------- */
$('kxExport').onclick = () => {
  const all = { ...base };
  for (const [k, v] of Object.entries(edits)) if (!all[k] || (v.ts || 0) >= (all[k].ts || 0)) all[k] = v;
  if (!Object.keys(all).length) { toast('Još nema ispravki za preuzimanje'); return; }
  const blob = new Blob([JSON.stringify(all, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `lokacije-ispravke-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  store.markSent(); renderCounts();
  toast(`Preuzeto: ${Object.keys(all).length} ispravki — pošalji fajl`);
};
$('kxImport').onchange = async (e) => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    let n = 0;
    for (const [k, v] of Object.entries(data)) {
      if (!v || typeof v.lat !== 'number' || typeof v.lng !== 'number') continue;
      if (!locs.some(l => l.id === k)) continue;
      if (!edits[k] || (v.ts || 0) > (edits[k].ts || 0)) { edits[k] = v; n++; }
    }
    store.save(); render(); toast(`Uvezeno ${n} ispravki`);
  } catch (err) { toast('Fajl nije ispravan JSON sa ispravkama'); }
};
window.addEventListener('beforeunload', (e) => {
  const sent = store.sentTs();
  if (Object.values(edits).some(v => (v.ts || 0) > sent)) { e.preventDefault(); e.returnValue = ''; }
});

/* ---------- podaci ---------- */
(async () => {
  try {
    const r = await fetch('lokacije-podaci.json', { cache: 'no-cache' });
    locs = (await r.json()).filter(l => l.id);
  } catch (e) { toast('Baza lokacija nije učitana'); return; }
  try {   // ispravke koje su vec primenjene na bazu (ako fajl postoji na serveru)
    const r = await fetch('tools/lokacije-ispravke.json', { cache: 'no-cache' });
    if (r.ok) base = await r.json();
  } catch (e) { base = {}; }
  edits = store.load();
  for (const k of Object.keys(edits)) if (!locs.some(l => l.id === k)) delete edits[k];
  computeView(); renderCounts(); renderList();
  if (view.length) select(view[0]);
  else if (locs.length) { filter = 'all'; document.querySelector('[data-f="all"]').click(); }
})();
