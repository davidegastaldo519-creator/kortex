// Il teschio di KORTEX in 3D vero: una forma descritta da una funzione di distanza (cranio, zigomi,
// mandibola, orbite, naso, denti) e disegnata col raymarching, con luce, ombre e occlusione nelle cavità.
// Ogni cella del terminale vale due pixel (sopra e sotto) grazie ai mezzi blocchi ▀ ▄: così la
// risoluzione verticale raddoppia e i pixel vengono quadrati.

import { caso, lim } from './colori.js';

const EPS = 0.0045;
const PASSI = 72;
const LONTANO = 7.5;

// ---------- primitive, senza allocazioni ----------

const sdEllissoide = (x, y, z, rx, ry, rz) => {
  const ax = x / rx, ay = y / ry, az = z / rz;
  const k0 = Math.sqrt(ax * ax + ay * ay + az * az);
  const bx = ax / rx, by = ay / ry, bz = az / rz;
  const k1 = Math.sqrt(bx * bx + by * by + bz * bz);
  return k1 > 0 ? (k0 * (k0 - 1)) / k1 : -Math.min(rx, ry, rz);
};
const sdScatola = (x, y, z, bx, by, bz, r = 0) => {
  const qx = Math.abs(x) - bx;
  const qy = Math.abs(y) - by;
  const qz = Math.abs(z) - bz;
  const fx = qx > 0 ? qx : 0, fy = qy > 0 ? qy : 0, fz = qz > 0 ? qz : 0;
  const fuori = Math.sqrt(fx * fx + fy * fy + fz * fz);
  return fuori + Math.min(Math.max(qx, qy, qz), 0) - r;
};
const smin = (a, b, k) => {
  const h = lim(0.5 + (0.5 * (b - a)) / k);
  return b + (a - b) * h - k * h * (1 - h);
};

// ---------- la forma ----------

function teschio(x, y, z) {
  const ax = Math.abs(x);
  // il cranio
  let d = sdEllissoide(x, y - 0.30, z + 0.05, 1.0, 1.06, 1.15);
  // la faccia (mascella superiore), fusa morbidamente al cranio
  d = smin(d, sdScatola(x, y + 0.14, z - 0.44, 0.62, 0.44, 0.38, 0.30), 0.28);
  // gli zigomi
  d = smin(d, sdEllissoide(ax - 0.74, y + 0.10, z - 0.40, 0.24, 0.16, 0.28), 0.12);
  // la mandibola: un'ellisse schiacciata, col mento tondo
  d = smin(d, sdEllissoide(x, y + 0.90, z - 0.36, 0.66, 0.30, 0.56), 0.12);
  // la base: il cranio non è un uovo, sotto e dietro è tagliato
  d = Math.max(d, -sdScatola(x, y + 1.40, z + 0.62, 1.5, 0.52, 0.86, 0.1));
  // le orbite
  d = Math.max(d, -sdEllissoide(ax - 0.40, y - 0.10, z - 0.92, 0.30, 0.27, 0.42));
  // il naso: una goccia rovesciata
  d = Math.max(d, -sdEllissoide(x, y + 0.36, z - 1.0, 0.11 + 0.12 * lim(-(y + 0.2)), 0.26, 0.36));
  // la fessura della bocca
  d = Math.max(d, -sdScatola(x, y + 0.72, z - 0.96, 0.46, 0.022, 0.26));
  // i denti: solchi verticali ripetuti lungo la bocca
  const tx = Math.abs((((x + 0.075) % 0.15) + 0.15) % 0.15 - 0.075);
  const solco = Math.max(sdScatola(tx, y + 0.72, z - 0.96, 0.016, 0.15, 0.26), ax - 0.44);
  d = Math.max(d, -solco);
  return d;
}

// Quanto un punto è dentro un'orbita (1 al centro, 0 sul bordo): serve per la luce degli occhi.
function dentroOrbita(x, y, z, sx) {
  const a = (Math.abs(x) - 0.40 - sx * 0.09) / 0.34, b = (y - 0.10) / 0.31, c = (z - 0.92) / 0.50;
  return lim(1 - Math.sqrt(a * a + b * b + c * c));
}

// ---------- il disegno ----------

/**
 * Disegna il teschio in una griglia di celle.
 * @param {object} o
 *  w, h            celle (larghezza, altezza)
 *  angolo          rotazione attorno all'asse verticale (radianti); 0 = di fronte
 *  tilt            inclinazione avanti/indietro (radianti)
 *  luce            quanto brillano gli occhi, 0..1
 *  forma           quanto del teschio è già apparso, 0..1 (1 = intero)
 *  sguardo         [sx, sy] dove guardano gli occhi, da -1 a 1
 *  palette         { osso, ombra, occhio: [colore1, colore2], riflesso }
 *  qualita         1 = ogni pixel, 2 = un pixel ogni due (metà del lavoro)
 *  zoom            1 = il teschio riempie la cella; <1 più piccolo
 * @returns {{ car: string[], fg: (number[]|null)[], bg: (number[]|null)[] }}
 */
export function disegnaTeschio(o) {
  const { w, h } = o;
  const angolo = o.angolo || 0;
  const tilt = o.tilt || 0;
  const luce = lim(o.luce ?? 1);
  const forma = lim(o.forma ?? 1);
  const [sx, sy] = o.sguardo || [0, 0];
  const p = o.palette || PALETTE.neon;
  const qualita = o.qualita || 1;
  const zoom = o.zoom || 1;
  const direzione = o.direzione || 0;
  const H2 = h * 2;
  const car = new Array(w * h).fill(' ');
  const fg = new Array(w * h).fill(null);
  const bg = new Array(w * h).fill(null);
  if (forma <= 0) return { car, fg, bg };

  const cosA = Math.cos(angolo), sinA = Math.sin(angolo);
  const cosT = Math.cos(tilt), sinT = Math.sin(tilt);
  const D = 5.4;
  const s = 1.52 / (h * zoom);
  // la luce principale viene dall'alto a sinistra, un riflesso colorato da dietro a destra
  const lx = -0.46, ly = 0.70, lz = 0.55;
  const rx = 0.55, ry = 0.25, rz = -0.80;

  const pixel = new Array(w * H2).fill(null);
  const passoP = qualita;
  for (let j = 0; j < H2; j += passoP) {
    for (let i = 0; i < w; i += passoP) {
      // soglia di apparizione: casuale, oppure un fronte che sale dal basso o scende dall'alto
      const rumore = caso(i * 3 + 1, j * 5 + 7);
      const soglia = direzione === 0 ? rumore : direzione > 0 ? 1 - j / H2 + (rumore - 0.5) * 0.16 : j / H2 + (rumore - 0.5) * 0.16;
      if (soglia > forma * 1.12) continue;
      const u = (i + 0.5 - w / 2) * s;
      const v = (h - j - 0.5) * s;
      // raggio nella scena: parte dalla camera, passa per il pixel sul piano z=0
      let ox = 0, oy = 0.10, oz = D;
      let dx = u, dy = v, dz = -D;
      const ln = Math.sqrt(dx * dx + dy * dy + dz * dz);
      dx /= ln; dy /= ln; dz /= ln;
      // ruoto il raggio al contrario: è come ruotare il teschio
      let t1 = oy * cosT - oz * sinT, t2 = oy * sinT + oz * cosT; oy = t1; oz = t2;
      t1 = dy * cosT - dz * sinT; t2 = dy * sinT + dz * cosT; dy = t1; dz = t2;
      t1 = ox * cosA - oz * sinA; t2 = ox * sinA + oz * cosA; ox = t1; oz = t2;
      t1 = dx * cosA - dz * sinA; t2 = dx * sinA + dz * cosA; dx = t1; dz = t2;
      // sfera che contiene tutto: se il raggio non la tocca, niente da fare
      const bx = -ox, by = -oy + 0.1, bz = -oz;
      const tc = bx * dx + by * dy + bz * dz;
      const d2 = bx * bx + by * by + bz * bz - tc * tc;
      if (d2 > 1.75 * 1.75) continue;
      const mezzaCorda = Math.sqrt(1.75 * 1.75 - d2);
      let t = Math.max(0, tc - mezzaCorda);
      const tFine = tc + mezzaCorda;
      let colpito = false;
      let px = 0, py = 0, pz = 0;
      for (let k = 0; k < PASSI; k++) {
        px = ox + dx * t; py = oy + dy * t; pz = oz + dz * t;
        const d = teschio(px, py, pz);
        if (d < EPS) { colpito = true; break; }
        t += d * 0.92;
        if (t > tFine) break;
      }
      // gli occhi: due sfere di luce dentro le orbite, visibili solo attraverso l'apertura
      let bagliore = 0;
      if (luce > 0) {
        for (let lato = -1; lato <= 1; lato += 2) {
          const ex = lato * (0.40 + sx * 0.10), ey = 0.09 + sy * 0.07, ez = 0.74;
          const wx = ex - ox, wy = ey - oy, wz = ez - oz;
          const tO = wx * dx + wy * dy + wz * dz;
          if (tO <= 0 || (colpito && tO > t + 0.02)) continue;
          const cx = wx - dx * tO, cy = wy - dy * tO, cz = wz - dz * tO;
          const dd = (cx * cx + cy * cy + cz * cz) / (0.11 * 0.11);
          bagliore += Math.exp(-dd) * 1.5 + Math.exp(-dd * 0.18) * 0.45;
        }
        bagliore *= luce;
      }
      if (!colpito) {
        if (bagliore < 0.08) continue;
        const [c1, c2] = p.occhio;
        const m = lim(bagliore * 0.6);
        const col = [lim(c1[0] / 255 + (c2[0] / 255 - c1[0] / 255) * m + m * 0.5) * 255 * lim(bagliore) | 0, lim(c1[1] / 255 + (c2[1] / 255 - c1[1] / 255) * m + m * 0.5) * 255 * lim(bagliore) | 0, lim(c1[2] / 255 + (c2[2] / 255 - c1[2] / 255) * m + m * 0.5) * 255 * lim(bagliore) | 0];
        pixel[j * w + i] = col;
        if (passoP > 1) { if (i + 1 < w) pixel[j * w + i + 1] = col; if (j + 1 < H2) { pixel[(j + 1) * w + i] = col; if (i + 1 < w) pixel[(j + 1) * w + i + 1] = col; } }
        continue;
      }
      // normale col metodo del tetraedro: quattro valutazioni
      const e = 0.0025;
      const a1 = teschio(px + e, py - e, pz - e), a2 = teschio(px - e, py - e, pz + e);
      const a3 = teschio(px - e, py + e, pz - e), a4 = teschio(px + e, py + e, pz + e);
      let nx = a1 - a2 - a3 + a4, ny = -a1 - a2 + a3 + a4, nz = -a1 + a2 - a3 + a4;
      const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      nx /= nl; ny /= nl; nz /= nl;
      // occlusione: dentro le cavità la luce arriva meno
      const o1 = teschio(px + nx * 0.10, py + ny * 0.10, pz + nz * 0.10);
      const o2 = teschio(px + nx * 0.26, py + ny * 0.26, pz + nz * 0.26);
      const occ = lim(1 - 2.2 * ((0.10 - o1) + 0.5 * (0.26 - o2)));
      // le luci sono fisse rispetto a chi guarda: le porto nello spazio del teschio
      let kx = lx * cosA - lz * sinA, kz = lx * sinA + lz * cosA;
      let ky = ly * cosT - kz * sinT; kz = ly * sinT + kz * cosT;
      let qx = rx * cosA - rz * sinA, qz = rx * sinA + rz * cosA;
      let qy = ry * cosT - qz * sinT; qz = ry * sinT + qz * cosT;
      const diff = Math.max(0, nx * kx + ny * ky + nz * kz);
      const riflesso = Math.pow(Math.max(0, nx * qx + ny * qy + nz * qz), 3);
      // la camera guarda lungo -z (nello spazio della camera): il bordo del teschio ha la normale di lato
      const vx = -dx, vy = -dy, vz = -dz;
      const fresnel = Math.pow(1 - Math.max(0, nx * vx + ny * vy + nz * vz), 2.5);
      const ombra = 0.22 + 0.78 * diff;
      const luceTot = ombra * occ;
      const orb = dentroOrbita(px, py, pz, sx);
      const alto = lim(0.5 + py * 0.25); // sopra più chiaro, sotto più scuro
      let r = (p.ombra[0] + (p.osso[0] - p.ombra[0]) * alto) * luceTot;
      let g = (p.ombra[1] + (p.osso[1] - p.ombra[1]) * alto) * luceTot;
      let b = (p.ombra[2] + (p.osso[2] - p.ombra[2]) * alto) * luceTot;
      const rf = (riflesso * 0.55 + fresnel * 0.35) * occ;
      r += p.riflesso[0] * rf; g += p.riflesso[1] * rf; b += p.riflesso[2] * rf;
      if (luce > 0) {
        // dentro l'orbita la parete si tinge della luce dell'occhio; fuori resta un alone tenue
        const [c1, c2] = p.occhio;
        const a1 = (Math.abs(px) - 0.40) / 0.62, a2 = (py - 0.10) / 0.55, a3 = (pz - 0.9) / 0.7;
        const alone = lim(1 - Math.sqrt(a1 * a1 + a2 * a2 + a3 * a3)) * 0.30 * luce;
        const tinta = orb * 0.55 * luce + alone;
        r += (c1[0] * 0.5 + c2[0] * 0.5) * tinta; g += (c1[1] * 0.5 + c2[1] * 0.5) * tinta; b += (c1[2] * 0.5 + c2[2] * 0.5) * tinta;
      }
      if (bagliore > 0) {
        const [c1, c2] = p.occhio;
        const m = lim(bagliore * 0.6);
        const k2 = lim(bagliore);
        r = r * (1 - k2) + (c1[0] + (c2[0] - c1[0]) * m + 255 * m * 0.5) * k2;
        g = g * (1 - k2) + (c1[1] + (c2[1] - c1[1]) * m + 255 * m * 0.5) * k2;
        b = b * (1 - k2) + (c1[2] + (c2[2] - c1[2]) * m + 255 * m * 0.5) * k2;
      }
      // il bordo che si sta formando scintilla
      if (forma < 1 && soglia > forma * 1.12 - 0.07) { r = 255; g = 255; b = 255; }
      const col = [r > 255 ? 255 : r | 0, g > 255 ? 255 : g | 0, b > 255 ? 255 : b | 0];
      pixel[j * w + i] = col;
      if (passoP > 1) {
        if (i + 1 < w) pixel[j * w + i + 1] = col;
        if (j + 1 < H2) { pixel[(j + 1) * w + i] = col; if (i + 1 < w) pixel[(j + 1) * w + i + 1] = col; }
      }
    }
  }
  for (let r = 0; r < h; r++) {
    for (let i = 0; i < w; i++) {
      const sopra = pixel[(2 * r) * w + i];
      const sotto = pixel[(2 * r + 1) * w + i];
      const k = r * w + i;
      if (sopra && sotto) { car[k] = '▀'; fg[k] = sopra; bg[k] = sotto; }
      else if (sopra) { car[k] = '▀'; fg[k] = sopra; }
      else if (sotto) { car[k] = '▄'; fg[k] = sotto; }
    }
  }
  return { car, fg, bg };
}

// Le palette del teschio per ogni tema: osso, ombra, colori degli occhi, riflesso.
export const PALETTE = {
  neon:     { osso: [236, 232, 222], ombra: [120, 112, 128], occhio: [[255, 43, 214], [0, 245, 255]], riflesso: [90, 60, 150] },
  fuoco:    { osso: [240, 226, 200], ombra: [120, 70, 40], occhio: [[255, 70, 0], [255, 210, 40]], riflesso: [160, 60, 10] },
  ghiaccio: { osso: [232, 240, 250], ombra: [90, 120, 160], occhio: [[120, 200, 255], [240, 252, 255]], riflesso: [80, 140, 220] },
  matrix:   { osso: [214, 236, 214], ombra: [40, 90, 40], occhio: [[0, 180, 60], [180, 255, 170]], riflesso: [0, 120, 40] },
  tokyonight: { osso: [200, 210, 245], ombra: [60, 66, 110], occhio: [[122, 162, 247], [125, 207, 255]], riflesso: [130, 90, 200] },
  dracula:  { osso: [235, 232, 245], ombra: [80, 70, 110], occhio: [[255, 121, 198], [139, 233, 253]], riflesso: [150, 110, 220] },
  synthwave: { osso: [245, 225, 240], ombra: [90, 40, 100], occhio: [[255, 42, 109], [249, 200, 14]], riflesso: [5, 160, 200] },
  vaporwave: { osso: [250, 235, 245], ombra: [110, 80, 140], occhio: [[255, 113, 206], [1, 205, 254]], riflesso: [185, 103, 255] },
};
