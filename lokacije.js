/* ===== Vapologic — stranica lokacija (mapa, pretraga, geolokacija) =====
   ESM modul: @maptiler/sdk se isporučuje samo kao ESM, pa ovaj deo ne može
   da živi u app.js (klasična skripta). Globali t() i događaj 'langchange'
   dolaze iz i18n.js / app.js — moduli se izvršavaju posle klasičnih skripti,
   pa su u trenutku pokretanja već tu.

   Zašto SDK a ne goli MapLibre: MapTiler naplaćuje po sesiji SAMO kroz svoj
   SDK. Sa third-party klijentom se broji svaki tile posebno (~40-150 zahteva
   po poseti), što na Free planu znači da se servis pauzira do sledećeg meseca. */

import * as maptilersdk from 'https://cdn.jsdelivr.net/npm/@maptiler/sdk@4.1.0/+esm';

const mapEl = document.getElementById('locmap');
if (mapEl) {
  const MAPTILER_KEY = 'xCboGTDaRsqFuVgneleh'; // javni client ključ — ograničiti na domen u MapTiler dashboardu
  maptilersdk.config.apiKey = MAPTILER_KEY;

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

  /* Test lokacije se učitavaju iz `lokacije-podaci.json` — 255 tačaka čije su
     adrese dobijene reverse geocodingom BAŠ te koordinate, pa ulica u tekstu
     stvarno postoji na mestu gde stoji pin. Fajl pravi `tools/peci-lokacije.ps1`
     (jednokratno, ~255 zahteva); sajt ga posle samo čita i ne troši kvotu.
     Kad klijent pošalje pravu bazu (Excel/CSV), menja se samo ovaj JSON. */
  let LOCATIONS = [];
  const buildFC = () => ({
    type: 'FeatureCollection',
    features: LOCATIONS.map((l, i) => ({
      type: 'Feature', geometry: { type: 'Point', coordinates: [l.lng, l.lat] },
      properties: { id: i, typeKey: l.typeKey, city: l.city, addr: l.addr },
    })),
  });

  /* Stil ide kroz SDK referencu (MapStyle.STREETS_V2.DARK === 'streets-v2-dark'),
     NE kroz sirov style.json URL. Sa sirovim URL-om SDK svejedno ubaci svoj interni
     izvor `maptiler_attribution`, ali mu ne dostavi podatke — taj izvor ostane
     neučitan, style.loaded() nikad ne postane tačno, 'load' se ne okine i mapa
     ostane prazna bez ijedne greške u konzoli. */
  const map = new maptilersdk.Map({
    container: 'locmap',
    style: maptilersdk.MapStyle.STREETS_V2.DARK,
    center: [20.8, 44.05], zoom: 6,
    attributionControl: { compact: true },
  });
  map.addControl(new maptilersdk.NavigationControl({ showCompass: false }), 'top-right');
  // MapLibre gura greske stila/tileova kroz 'error' i inace ih tiho proguta
  map.on('error', (e) => console.warn('[lokacije] map error:', (e && e.error && e.error.message) || e, e && e.error));

  const locName = (l) => `${t(l.typeKey)} — ${l.city}`;

  const R = 6371, rad = (d) => d * Math.PI / 180;
  const haversine = (a, b, c, d) => {
    const dLat = rad(c - a), dLng = rad(d - b);
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  };
  function circlePolygon(lat, lng, km, n = 72) {
    const coords = [], latR = rad(lat), lngR = rad(lng), dR = km / R;
    for (let i = 0; i <= n; i++) {
      const brng = 2 * Math.PI * i / n;
      const lat2 = Math.asin(Math.sin(latR) * Math.cos(dR) + Math.cos(latR) * Math.sin(dR) * Math.cos(brng));
      const lng2 = lngR + Math.atan2(Math.sin(brng) * Math.sin(dR) * Math.cos(latR), Math.cos(dR) - Math.sin(latR) * Math.sin(lat2));
      coords.push([lng2 * 180 / Math.PI, lat2 * 180 / Math.PI]);
    }
    return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] } };
  }

  // nema više slajdera: krećemo od 25 km i širimo dok ne nađemo bar jedno mesto
  const RADII = [25, 50, 100, 200];
  const resultsEl = document.getElementById('locResults');

  let mapReady = false, dataReady = false, refMarker = null, pending = null;

  // podaci i mapa stižu nezavisno; ko god stigne drugi, ponavlja odloženu pretragu
  const replayPending = () => {
    if (!pending) return;
    const p = pending; pending = null; search(p[0], p[1], p[2], p[3]);
  };

  fetch('lokacije-podaci.json')
    .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then(d => {
      LOCATIONS = d;
      dataReady = true;
      if (mapReady) map.getSource('locs').setData(buildFC());
      replayPending();
    })
    .catch(e => {
      console.warn('[lokacije] lokacije-podaci.json nije učitan —', e);
      resultsEl.innerHTML = `<div class="locempty">${t('loc.data_failed')}</div>`;
    });

  map.on('load', () => {
    // Podešavanje stila je u try/catch namerno: zavisi od strukture MapTiler stila,
    // koju oni mogu da promene bez najave. Ako pukne, mapa i pretraga moraju da rade dalje.
    try {
      // Kosovo u sastavu Srbije: (1) sakrij spornu granicu, (2) ukloni tekstualni natpis „Kosovo"
      const KOS = ['Kosovo', 'Kosovë', 'Kosova', 'Kosovo*', 'Косово', 'Republika Kosovo', 'Republika e Kosovës'];
      map.getStyle().layers.forEach(l => {
        if (/disput/i.test(l.id)) { map.setLayoutProperty(l.id, 'visibility', 'none'); return; }
        if (l.type === 'symbol' && l['source-layer'] === 'place') {
          const excl = ['all', ['!in', 'name'].concat(KOS), ['!in', 'name:en'].concat(KOS)];
          const cur = map.getFilter(l.id);
          map.setFilter(l.id, cur ? ['all', cur, excl] : excl);
        }
      });
    } catch (e) { console.warn('[lokacije] stil: kosovski filter nije primenjen —', e); }

    try {
      // Nazivi SAMO latinica: srpska latinica -> latinizovano -> lokalno (bez ćirilice).
      // Ostaje ručno: SDK nema Language.LATIN konstantu, samo VISITOR/STYLE modove.
      const SR = ['coalesce', ['get', 'name:sr-Latn'], ['get', 'name:latin'], ['get', 'name']];
      map.getStyle().layers.forEach(l => {
        if (l.type !== 'symbol') return;
        const tf = map.getLayoutProperty(l.id, 'text-field');
        // preskoci oznake puteva/kucnih brojeva (ref, housenumber) — menjamo samo natpise sa imenom
        if (!tf || !JSON.stringify(tf).includes('name')) return;
        map.setLayoutProperty(l.id, 'text-field', SR);
      });
    } catch (e) { console.warn('[lokacije] stil: latinizacija natpisa nije primenjena —', e); }

    map.addSource('radius', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({ id: 'radius-fill', type: 'fill', source: 'radius', paint: { 'fill-color': '#b14bff', 'fill-opacity': 0.1 } });
    map.addLayer({ id: 'radius-line', type: 'line', source: 'radius', paint: { 'line-color': '#b14bff', 'line-width': 1 } });

    // krug tačnosti geolokacije — odvojen izvor i druga boja od radijusa pretrage,
    // da korisnik vidi ZAŠTO je pin promašen umesto da nagađa
    map.addSource('accuracy', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({ id: 'accuracy-fill', type: 'fill', source: 'accuracy', paint: { 'fill-color': '#38d6ff', 'fill-opacity': 0.12 } });
    map.addLayer({ id: 'accuracy-line', type: 'line', source: 'accuracy', paint: { 'line-color': '#38d6ff', 'line-width': 1, 'line-dasharray': [2, 2] } });

    map.addSource('locs', { type: 'geojson', data: buildFC(), cluster: true, clusterRadius: 50, clusterMaxZoom: 12 });
    map.addLayer({
      id: 'clusters', type: 'circle', source: 'locs', filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#b14bff', 'circle-opacity': 0.85,
        'circle-radius': ['step', ['get', 'point_count'], 15, 10, 20, 30, 27],
        'circle-stroke-width': 2, 'circle-stroke-color': 'rgba(255,255,255,.4)',
      },
    });
    map.addLayer({
      id: 'cluster-count', type: 'symbol', source: 'locs', filter: ['has', 'point_count'],
      layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Bold'], 'text-size': 13 },
      paint: { 'text-color': '#fff' },
    });
    map.addLayer({
      id: 'points', type: 'circle', source: 'locs', filter: ['!', ['has', 'point_count']],
      paint: { 'circle-color': '#ff4d9d', 'circle-radius': 7, 'circle-stroke-width': 1.5, 'circle-stroke-color': '#fff' },
    });
    // izabrana lokacija (klik u listi) — deblji beli prsten preko običnog pina
    map.addLayer({
      id: 'points-selected', type: 'circle', source: 'locs',
      filter: ['==', ['get', 'id'], -1],
      paint: {
        'circle-color': '#ff4d9d', 'circle-radius': 11,
        'circle-stroke-width': 3, 'circle-stroke-color': '#fff',
      },
    });

    map.on('click', 'clusters', (e) => {
      const f = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
      map.getSource('locs').getClusterExpansionZoom(f[0].properties.cluster_id)
        .then(z => map.easeTo({ center: f[0].geometry.coordinates, zoom: z }));
    });
    map.on('click', 'points', (e) => {
      const p = e.features[0].properties;
      selectLoc(p.id);
      new maptilersdk.Popup().setLngLat(e.features[0].geometry.coordinates)
        .setHTML(`<b>${t(p.typeKey)} — ${p.city}</b><br>${p.addr}`).addTo(map);
    });
    ['clusters', 'points'].forEach(id => {
      map.on('mouseenter', id, () => map.getCanvas().style.cursor = 'pointer');
      map.on('mouseleave', id, () => map.getCanvas().style.cursor = '');
    });

    mapReady = true;
    replayPending();
  });

  function selectLoc(id) {
    if (!mapReady) return;
    map.setFilter('points-selected', ['==', ['get', 'id'], id == null ? -1 : Number(id)]);
  }

  // na mobilnom je mapa ispod forme -> posle pretrage vodi korisnika dole do mape
  const scrollToMapOnMobile = () => {
    if (window.matchMedia('(max-width:900px)').matches) {
      setTimeout(() => mapEl.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    }
  };

  // poslednja pretraga — da je ponovimo na promenu jezika i da znamo odakle merimo
  let lastSearch = null;

  /* Lista rezultata je običan DOM i NE sme da zavisi od mape: ako WebGL zakaže,
     stil se ne učita ili je kartica u pozadini (render petlja stoji, pa 'load' ne
     stigne), korisnik i dalje mora da dobije najbliža prodajna mesta. Mapa se
     osvežava zasebno i, ako još nije spremna, ponavlja se na 'load'. */
  // pretraga u URL-u: rezultat je deljiv linkom i „nazad" radi kako korisnik očekuje.
  // Geolokaciju NE upisujemo — tuđe koordinate u deljenom linku nisu u redu.
  function syncUrl(lat, lng, label, fromGeo) {
    try {
      const u = new URL(location.href);
      if (fromGeo) { u.searchParams.delete('q'); u.searchParams.delete('lat'); u.searchParams.delete('lng'); }
      else {
        u.searchParams.set('q', label);
        u.searchParams.set('lat', lat.toFixed(5));
        u.searchParams.set('lng', lng.toFixed(5));
      }
      history.replaceState(null, '', u);
    } catch (e) {}
  }

  function search(refLat, refLng, label, accuracyM) {
    lastSearch = [refLat, refLng, label, accuracyM];
    syncUrl(refLat, refLng, label, accuracyM != null);
    // baza još putuje -> zapamti upit i javi se čim stigne, umesto „0 lokacija"
    if (!dataReady) {
      pending = [refLat, refLng, label, accuracyM];
      resultsEl.innerHTML = `<div class="locempty">${t('loc.searching')}</div>`;
      return;
    }
    // uzmi prvi radijus u kome ima rezultata (ako nigde nema, ostaje najveći)
    const all = LOCATIONS.map((l, i) => ({ ...l, id: i, d: haversine(refLat, refLng, l.lat, l.lng) }));
    const km = RADII.find(r => all.some(l => l.d <= r)) || RADII[RADII.length - 1];
    const near = all.filter(l => l.d <= km).sort((a, b) => a.d - b.d);

    if (mapReady) drawOnMap(refLat, refLng, label, accuracyM, km, near);
    else pending = [refLat, refLng, label, accuracyM];

    resultsEl.innerHTML = '';
    if (near.length === 0) {
      resultsEl.innerHTML = `<div class="locempty">${t('loc.none', { km })}</div>`;
      scrollToMapOnMobile();
      return;
    }
    const head = document.createElement('div');
    head.className = 'locempty';
    head.textContent = t('loc.found', { n: near.length, km, d: near[0].d.toFixed(1) });
    resultsEl.appendChild(head);

    // ako je fix nepouzdan (desktop bez GPS-a čita WiFi/IP bazu i промašuje kilometrima),
    // reci to otvoreno i ponudi ručni unos umesto da korisnik nagađa
    if (accuracyM && accuracyM > 1000) {
      const warn = document.createElement('div');
      warn.className = 'locempty loc-approx';
      warn.textContent = t('loc.geo_approx', { km: Math.round(accuracyM / 1000) }) + ' ';
      const fix = document.createElement('button');
      fix.type = 'button';
      fix.className = 'linklike';
      fix.textContent = t('loc.geo_fix_manually');
      fix.onclick = () => { const i = document.getElementById('locQuery'); i.focus(); i.select(); };
      warn.appendChild(fix);
      resultsEl.appendChild(warn);
    }

    near.slice(0, 30).forEach(l => {
      const item = document.createElement('div');
      item.className = 'locitem'; item.tabIndex = 0;
      item.innerHTML = `<div class="ln">${locName(l)}</div><div class="la">${l.addr}</div><div class="ld">${t('loc.km_from_you', { d: l.d.toFixed(1) })}</div>`;

      const dir = document.createElement('a');
      dir.className = 'dirlink';
      dir.href = `https://www.google.com/maps/dir/?api=1&destination=${l.lat},${l.lng}`;
      dir.target = '_blank'; dir.rel = 'noopener';
      dir.textContent = t('loc.directions');
      dir.onclick = (e) => e.stopPropagation();
      item.appendChild(dir);

      const focus = () => {
        selectLoc(l.id);
        resultsEl.querySelectorAll('.locitem.is-sel').forEach(el => el.classList.remove('is-sel'));
        item.classList.add('is-sel');
        map.flyTo({ center: [l.lng, l.lat], zoom: 13 });
        new maptilersdk.Popup().setLngLat([l.lng, l.lat]).setHTML(`<b>${locName(l)}</b><br>${l.addr}`).addTo(map);
      };
      item.onclick = focus;
      item.onkeydown = (e) => { if (e.key === 'Enter') focus(); };
      resultsEl.appendChild(item);
    });

    // na mobilnom: prvo 3 najbliže, ostalo iza dugmeta (da se ne skroluje beskonačno do mape)
    if (window.matchMedia('(max-width:900px)').matches && near.length > 3) {
      const items = [...resultsEl.querySelectorAll('.locitem')];
      items.slice(3).forEach(el => el.style.display = 'none');
      const more = document.createElement('button');
      more.type = 'button';
      more.className = 'btn btn-ghost locmore';
      more.textContent = t('loc.show_all', { n: near.length });
      more.onclick = () => { items.forEach(el => el.style.display = ''); more.remove(); };
      resultsEl.appendChild(more);
    }

    scrollToMapOnMobile();
  }

  function drawOnMap(refLat, refLng, label, accuracyM, km, near) {
    map.getSource('radius').setData(circlePolygon(refLat, refLng, km));
    map.getSource('accuracy').setData(accuracyM && accuracyM > 50
      ? circlePolygon(refLat, refLng, accuracyM / 1000)
      : { type: 'FeatureCollection', features: [] });
    selectLoc(null);
    if (refMarker) refMarker.remove();
    refMarker = new maptilersdk.Marker({ color: '#b14bff' }).setLngLat([refLng, refLat])
      .setPopup(new maptilersdk.Popup().setHTML(`<b>${label}</b>`)).addTo(map);

    if (!near.length) { map.easeTo({ center: [refLng, refLat], zoom: 8 }); return; }

    // fitBounds preko SVIH rezultata odzumira na pola zemlje kad je radijus 200 km —
    // dovoljno je da se vidi referentna tačka i najbližih 10
    const b = new maptilersdk.LngLatBounds([refLng, refLat], [refLng, refLat]);
    near.slice(0, 10).forEach(l => b.extend([l.lng, l.lat]));
    map.fitBounds(b, { padding: 50, maxZoom: 14 });
  }

  /* ---- Geokoder (MapTiler SDK) ----
     Pretraga radi po ULICI, gradu i adresi — ne zavisi od naše test baze.
     Imena iz OSM-a dolaze ćirilicom, pa ih prevodimo u latinicu. */
  const CYR = {
    'А':'A','Б':'B','В':'V','Г':'G','Д':'D','Ђ':'Đ','Е':'E','Ж':'Ž','З':'Z','И':'I','Ј':'J','К':'K',
    'Л':'L','Љ':'Lj','М':'M','Н':'N','Њ':'Nj','О':'O','П':'P','Р':'R','С':'S','Т':'T','Ћ':'Ć','У':'U',
    'Ф':'F','Х':'H','Ц':'C','Ч':'Č','Џ':'Dž','Ш':'Š',
    'а':'a','б':'b','в':'v','г':'g','д':'d','ђ':'đ','е':'e','ж':'ž','з':'z','и':'i','ј':'j','к':'k',
    'л':'l','љ':'lj','м':'m','н':'n','њ':'nj','о':'o','п':'p','р':'r','с':'s','т':'t','ћ':'ć','у':'u',
    'ф':'f','х':'h','ц':'c','ч':'č','џ':'dž','ш':'š',
  };
  const toLat = (s) => (s || '').replace(/[Ѐ-ӿ]/g, ch => (CYR[ch] != null ? CYR[ch] : ch));

  async function geocode(q, limit = 6) {
    // proximity: bez ovoga „Njegoševa" pogodi nasumičnu Njegoševu u Srbiji.
    // Merimo od poslednje poznate korisnikove tačke, pa od centra mape.
    const c = lastSearch ? [lastSearch[1], lastSearch[0]] : map.getCenter().toArray();
    const res = await maptilersdk.geocoding.forward(q, {
      country: ['rs'], limit, language: ['sr'], proximity: c,
    });
    return (res.features || []).map(f => ({
      lat: f.center[1], lng: f.center[0],
      label: toLat(f.place_name || f.text),   // MapTiler vraća ćirilicu i za language:'sr'
      kind: (f.place_type && f.place_type[0]) || 'place',
      rel: typeof f.relevance === 'number' ? f.relevance : 0,
    }));
  }

  const REV_RANK = { address: 0, street: 1, poi: 2, place: 3 };
  async function reverseGeocode(la, ln) {
    try {
      // BEZ `limit`: MapTiler na reverse vraća 400 „Parameter limit must be combined
      // with a single type parameter". Podrazumevano ionako vrati ~9 rezultata,
      // od najspecifičnijeg (adresa) ka najširem (država).
      const res = await maptilersdk.geocoding.reverse([ln, la], { language: ['sr'] });
      const feats = (res.features || []).slice();
      if (!feats.length) return null;
      // najspecifičniji rezultat, ne slepo features[0] — inače dobijemo „Srbija" umesto ulice
      feats.sort((a, b) => {
        const ra = REV_RANK[(a.place_type || [])[0]] ?? 9;
        const rb = REV_RANK[(b.place_type || [])[0]] ?? 9;
        return ra - rb;
      });
      return toLat(feats[0].place_name || feats[0].text);
    } catch (e) { return null; }
  }

  /* ---- Lokalna tabela gradova: rezerva kad geokoder padne ili ne nađe ništa ---- */
  const norm = (s) => toLat(s || '').toLowerCase()
    .replace(/č|ć/g, 'c').replace(/š/g, 's').replace(/ž/g, 'z').replace(/đ/g, 'dj').trim();

  // tačno ime grada -> centar grada, bez pitanja. Geokoder na „Kragujevac" kao prvi
  // rezultat vraća ulicu „Kragujevačkog oktobra", a sam grad tek kao drugi.
  function exactCity(q) {
    const n = norm(q);
    for (const key in CITIES) {
      if (norm(key) === n) return { lat: CITIES[key][0], lng: CITIES[key][1], label: key.charAt(0).toUpperCase() + key.slice(1) };
    }
    return null;
  }

  function cityFallback(q) {
    const n = norm(q);
    if (n.length < 3) return null;
    let best = null, bestScore = 99;
    for (const key in CITIES) {
      const k = norm(key);
      // tačno poklapanje > upit je prefiks imena > ime se pojavljuje u upitu
      const score = k === n ? 0 : k.startsWith(n) ? 1 : n.includes(k) ? 2 : 9;
      if (score < bestScore) { bestScore = score; best = key; }
    }
    if (!best || bestScore === 9) return null;
    return { lat: CITIES[best][0], lng: CITIES[best][1], label: best.charAt(0).toUpperCase() + best.slice(1) };
  }

  const input = document.getElementById('locQuery');
  const sugEl = document.getElementById('locSuggest');
  const chipEl = document.getElementById('locChip');
  const clearBtn = document.getElementById('locClear');

  const setChip = (text) => {
    if (!chipEl) return;
    if (!text) { chipEl.hidden = true; chipEl.querySelector('.loc-chip-text').textContent = ''; return; }
    chipEl.hidden = false;
    chipEl.querySelector('.loc-chip-text').textContent = text;
  };

  /* ---- Autocomplete ---- */
  const cache = new Map();          // upit -> rezultati (brisanje karaktera ne pravi nov zahtev)
  let seq = 0, abort = null, sug = [], active = -1;

  const closeSug = () => {
    sug = []; active = -1;
    if (!sugEl) return;
    sugEl.hidden = true; sugEl.innerHTML = '';
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  };

  function renderSug(list) {
    sug = list; active = -1;
    if (!sugEl) return;
    if (!list.length) { closeSug(); return; }
    sugEl.innerHTML = '';
    list.forEach((h, i) => {
      const li = document.createElement('li');
      li.id = `locsug-${i}`;
      li.className = 'loc-sug';
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', 'false');
      li.textContent = h.label;
      li.onmousedown = (e) => { e.preventDefault(); choose(i); };
      sugEl.appendChild(li);
    });
    sugEl.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  function highlight(i) {
    if (!sugEl) return;
    const items = [...sugEl.children];
    items.forEach(el => el.setAttribute('aria-selected', 'false'));
    active = i;
    if (i < 0 || !items[i]) { input.removeAttribute('aria-activedescendant'); return; }
    items[i].setAttribute('aria-selected', 'true');
    items[i].scrollIntoView({ block: 'nearest' });
    input.setAttribute('aria-activedescendant', items[i].id);
  }

  function choose(i) {
    const h = sug[i];
    if (!h) return;
    input.value = h.label;
    clearTimeout(debounce);   // inace zakazani predlog podigne `seq` i odbaci ovu pretragu
    closeSug();
    setChip(null);
    remember(h.label);
    search(h.lat, h.lng, h.label);
  }

  let debounce = null;
  async function suggest(q) {
    const key = norm(q);
    if (cache.has(key)) { renderSug(cache.get(key)); return; }
    const my = ++seq;
    if (abort) abort.abort();
    abort = new AbortController();
    try {
      const hits = await geocode(q);
      if (my !== seq) return;                 // stigao odgovor starije pretrage — odbaci ga
      cache.set(key, hits);
      renderSug(hits);
    } catch (e) {
      if (my === seq) closeSug();
    }
  }

  /* ---- Skorašnje pretrage (localStorage, bez ijednog API poziva) ---- */
  const RECENT_KEY = 'vpl_recent';
  const getRecent = () => {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch (e) { return []; }
  };
  const remember = (label) => {
    try {
      const r = [label, ...getRecent().filter(x => x !== label)].slice(0, 3);
      localStorage.setItem(RECENT_KEY, JSON.stringify(r));
    } catch (e) {}
  };
  function showRecent() {
    const r = getRecent();
    if (!r.length || !sugEl) return;
    sugEl.innerHTML = '';
    const hd = document.createElement('li');
    hd.className = 'loc-sug-head';
    hd.textContent = t('loc.recent');
    sugEl.appendChild(hd);
    sug = [];
    r.forEach((label, i) => {
      const li = document.createElement('li');
      li.id = `locsug-${i}`;
      li.className = 'loc-sug';
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', 'false');
      li.textContent = label;
      li.onmousedown = (e) => { e.preventDefault(); input.value = label; closeSug(); runSearch(); };
      sugEl.appendChild(li);
    });
    sugEl.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  input.addEventListener('input', () => {
    setChip(null);
    if (clearBtn) clearBtn.hidden = !input.value;
    const q = input.value.trim();
    clearTimeout(debounce);
    if (q.length < 3) { closeSug(); return; }
    debounce = setTimeout(() => suggest(q), 250);
  });

  input.addEventListener('focus', () => {
    if (!input.value.trim()) showRecent();
  });

  input.addEventListener('keydown', (e) => {
    if (sugEl && !sugEl.hidden && sug.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); highlight((active + 1) % sug.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); highlight((active - 1 + sug.length) % sug.length); return; }
      if (e.key === 'Enter' && active >= 0) { e.preventDefault(); choose(active); return; }
    }
    if (e.key === 'Escape') closeSug();
  });

  document.addEventListener('click', (e) => {
    if (sugEl && !sugEl.contains(e.target) && e.target !== input) closeSug();
  });

  if (clearBtn) {
    clearBtn.hidden = true;
    clearBtn.addEventListener('click', () => {
      input.value = '';
      clearBtn.hidden = true;
      closeSug();
      setChip(null);
      lastSearch = null;
      selectLoc(null);
      if (refMarker) { refMarker.remove(); refMarker = null; }
      if (mapReady) {
        map.getSource('radius').setData({ type: 'FeatureCollection', features: [] });
        map.getSource('accuracy').setData({ type: 'FeatureCollection', features: [] });
      }
      resultsEl.innerHTML = `<div class="locempty">${t('loc.results_empty')}</div>`;
      input.focus();
    });
  }

  /* ---- Submit ---- */
  function pickHit(hit) {
    input.value = hit.label;
    setChip(null);
    remember(hit.label);
    search(hit.lat, hit.lng, hit.label);
  }

  function renderChoices(hits) {
    resultsEl.innerHTML = '';
    const head = document.createElement('div');
    head.className = 'locempty';
    head.textContent = t('loc.did_you_mean');
    resultsEl.appendChild(head);
    hits.forEach(h => {
      const item = document.createElement('div');
      item.className = 'locitem'; item.tabIndex = 0;
      item.innerHTML = `<div class="ln">${h.label}</div>`;
      const go = () => pickHit(h);
      item.onclick = go;
      item.onkeydown = (e) => { if (e.key === 'Enter') go(); };
      resultsEl.appendChild(item);
    });
  }

  async function runSearch() {
    const q = input.value.trim();
    if (!q) {
      resultsEl.innerHTML = `<div class="locempty">${t('loc.enter_city')}</div>`;
      input.focus(); return;
    }
    // zakazani autocomplete bi inace stigao posle submita, podigao `seq`
    // i odbacio rezultat ove pretrage — pa lista nikad ne bi bila iscrtana
    clearTimeout(debounce);
    closeSug();
    // tačno ime grada rešavamo lokalno — bez mrežnog poziva i bez lažne dvosmislenosti
    const city = exactCity(q);
    if (city) { pickHit(city); return; }

    resultsEl.innerHTML = `<div class="locempty">${t('loc.searching')}</div>`;
    const my = ++seq;
    try {
      const hits = await geocode(q);
      if (my !== seq) return;
      if (hits.length === 1) { pickHit(hits[0]); return; }
      // jedan rezultat je ubedljivo bolji od ostalih -> ne gnjavi korisnika izborom
      // („Bulevar oslobođenja 12, Novi Sad" = 0.97 naspram 0.70 za sledeći)
      if (hits.length > 1 && hits[0].rel >= 0.85 && hits[0].rel - hits[1].rel >= 0.15) { pickHit(hits[0]); return; }
      if (hits.length > 1) { renderChoices(hits); return; }
      // geokoder nije našao ništa -> probaj lokalnu tabelu pre nego što odustaneš
      const fb = cityFallback(q);
      if (fb) { pickHit(fb); return; }
      resultsEl.innerHTML = `<div class="locempty">${t('loc.not_found', { q })}</div>`;
    } catch (err) {
      if (my !== seq) return;
      // geokoder nedostupan -> lokalna tabela gradova kao rezerva
      const fb = cityFallback(q);
      if (fb) { pickHit(fb); return; }
      resultsEl.innerHTML = `<div class="locempty">${t('loc.geocode_failed')}</div>`;
    }
  }

  document.getElementById('locForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if (active >= 0 && sug[active]) { choose(active); return; }
    runSearch();
  });

  /* ---- Geolokacija ---- */
  const geoFail = (key) => {
    resultsEl.innerHTML = `<div class="locempty">${t(key)}</div>`;
    input.focus();
  };

  let watchId = null, stopTimer = null, bestAcc = Infinity;

  function stopWatch() {
    if (watchId != null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
    clearTimeout(stopTimer); stopTimer = null;
  }

  function onFix(pos) {
    const { latitude, longitude, accuracy } = pos.coords;
    // prihvati samo ako je bolji od prethodnog — inače lista poskakuje bez razloga
    if (accuracy >= bestAcc) return;
    bestAcc = accuracy;

    setChip(t('loc.your_location_chip', { m: Math.round(accuracy) }));
    reverseGeocode(latitude, longitude).then(addr => {
      // nikad ne ostavljaj polje prazno — koordinate su bolje nego ništa
      input.value = addr || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
      if (clearBtn) clearBtn.hidden = false;
      search(latitude, longitude, addr || t('loc.my_location'), accuracy);
    });

    // dovoljno tačno -> nema šta da se dobije daljim slušanjem
    if (accuracy < 100) stopWatch();
  }

  function locateMe(highAccuracy = true) {
    if (!navigator.geolocation) { geoFail('loc.geo_failed'); return; }
    stopWatch();
    bestAcc = Infinity;
    resultsEl.innerHTML = `<div class="locempty">${t('loc.geo_searching')}</div>`;

    // watchPosition, ne getCurrentPosition: prvi fix je na telefonu često mrežni (km),
    // pa GPS dotera na desetine metara par sekundi kasnije. Uzmi prvi odmah, pa doteruj.
    watchId = navigator.geolocation.watchPosition(
      onFix,
      (err) => {
        stopWatch();
        // istekло vreme sa visokom preciznošću -> jedan pokušaj sa mrežnom lokacijom
        if (err.code === 3 && highAccuracy) { locateMe(false); return; }
        // NIKAD ne podmetati neku drugu lokaciju kao korisnikovu — reci šta je pošlo naopako
        geoFail(err.code === 1 ? 'loc.geo_denied' : 'loc.geo_failed');
      },
      highAccuracy
        ? { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
        : { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    );
    // ne slušaj unedogled — 8 s posle starta je GPS dao šta je imao
    stopTimer = setTimeout(stopWatch, 12000 + 8000);
  }

  if (chipEl) {
    const x = chipEl.querySelector('.loc-chip-x');
    if (x) x.onclick = () => { setChip(null); stopWatch(); };
  }

  /* Pretraga iz URL-a (deljen link ili „nazad"): koordinate su već u adresi,
     pa ne trošimo geokoding poziv. Ima prednost nad mekom najavom za geolokaciju. */
  const fromUrl = (() => {
    const p = new URLSearchParams(location.search);
    const lat = parseFloat(p.get('lat')), lng = parseFloat(p.get('lng')), q = p.get('q');
    if (!q || !isFinite(lat) || !isFinite(lng)) return false;
    input.value = q;
    if (clearBtn) clearBtn.hidden = false;
    search(lat, lng, q);
    return true;
  })();

  /* Meka najava: na učitavanju NE tražimo dozvolu odmah.
     - ako je korisnik ranije dozvolio  -> odmah ga lociramo, bez prompta
     - ako nije odlučio                 -> pokažemo karticu, prompt ide tek na klik
     - ako je odbio ili rekao „ne sada" -> ne prikazujemo ništa            */
  (function geoPreprompt() {
    const card = document.getElementById('geoPrompt');
    if (!card || !navigator.geolocation) return;
    if (fromUrl) return;   // korisnik je došao na konkretnu pretragu — ne preusmeravaj ga
    const hide = () => { card.hidden = true; };
    document.getElementById('geoAllow').onclick = () => { hide(); locateMe(); };
    document.getElementById('geoLater').onclick = () => { hide(); try { sessionStorage.setItem('vpl_geo_later', '1'); } catch (e) {} };

    let odbijeno = false;
    try { odbijeno = sessionStorage.getItem('vpl_geo_later') === '1'; } catch (e) {}
    if (odbijeno) return;

    const show = () => { card.hidden = false; };
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' })
        .then(p => { if (p.state === 'granted') locateMe(); else if (p.state === 'prompt') show(); })
        .catch(show);
    } else { show(); }
  })();

  document.getElementById('geoBtn').addEventListener('click', () => {
    document.getElementById('geoPrompt').hidden = true;
    locateMe();
  });

  // lista je izgrađena kroz t() — na promenu jezika je treba ponovo složiti
  document.addEventListener('langchange', () => {
    if (lastSearch) search(lastSearch[0], lastSearch[1], lastSearch[2], lastSearch[3]);
  });
}
