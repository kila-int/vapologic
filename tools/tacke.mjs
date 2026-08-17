/* Korak 1 od 2: generiše raspored test tačaka (bez mreže) -> tools/tacke.json
 *
 * Seed 20240817 i aritmetika MORAJU da ostanu identični onima u lokacije.js,
 * inače zapečene adrese prestanu da odgovaraju tačkama koje sajt crta.
 *
 * Pokretanje: node tools/tacke.mjs
 * Zatim:      powershell -File tools/peci-lokacije.ps1
 */

import { writeFileSync } from 'node:fs';

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let x = Math.imul(a ^ a >>> 15, 1 | a);
    x = x + Math.imul(x ^ x >>> 7, 61 | x) ^ x;
    return ((x ^ x >>> 14) >>> 0) / 4294967296;
  };
}

const centers = [
  ['Beograd', 44.8125, 20.4612, 60], ['Novi Sad', 45.2671, 19.8335, 34], ['Niš', 43.3209, 21.8958, 24],
  ['Kragujevac', 44.0128, 20.9114, 18], ['Subotica', 46.10, 19.665, 12], ['Zrenjanin', 45.3836, 20.3819, 10],
  ['Pančevo', 44.8708, 20.6403, 12], ['Čačak', 43.8914, 20.3497, 10], ['Kraljevo', 43.7258, 20.6892, 10],
  ['Novi Pazar', 43.1367, 20.5122, 9], ['Leskovac', 42.9981, 21.9461, 9], ['Valjevo', 44.2708, 19.8903, 9],
  ['Užice', 43.8556, 19.8425, 8], ['Sombor', 45.7742, 19.1122, 7], ['Smederevo', 44.6633, 20.9289, 8],
  ['Vranje', 42.5514, 21.8983, 7], ['Šabac', 44.7489, 19.6906, 8],
];
const TYPE_KEYS = ['loctype.kiosk', 'loctype.gas', 'loctype.vape', 'loctype.mini', 'loctype.trafika'];

const rnd = mulberry32(20240817);
const points = [];
centers.forEach(c => {
  for (let i = 0; i < c[3]; i++) {
    const spread = 0.09;
    points.push({
      typeKey: TYPE_KEYS[points.length % TYPE_KEYS.length],
      city: c[0],
      lat: Number((c[1] + (rnd() - 0.5) * spread).toFixed(6)),
      lng: Number((c[2] + (rnd() - 0.5) * spread * 1.4).toFixed(6)),
    });
  }
});

writeFileSync('tools/tacke.json', JSON.stringify(points, null, 1));
console.log(`Generisano ${points.length} tacaka -> tools/tacke.json`);
