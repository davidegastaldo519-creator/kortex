// La schermata iniziale di KORTEX: il RISVEGLIO.
// Buio → battito del cuore → onde cerebrali → il cervello a circuiti si accende → il teschio in 3D
// si forma e apre gli occhi → KORTEX si assembla da frammenti → la firma viene forgiata →
// i sistemi si accendono (le IA, il database, la memoria) → il teschio rimpicciolisce fino
// all'intestazione e le pagine si disegnano. Ogni tema ha la sua scena: stelle, fiamme, neve, pioggia.

import { hex, rgbHex, campiona, lim, mescola, scala, morbido, fase, caso, generatore, righeLogo } from './colori.js';
import { disegnaTeschio, PALETTE } from './teschio3d.js';
import { geometria } from './geometria.js';

export { hex, rgbHex, campiona, righeLogo };

const out = process.stdout;
const dorme = (ms) => new Promise((r) => setTimeout(r, ms));
const BIANCO = [240, 250, 255];
const NERO = [6, 6, 10];

// ---------- la tela: un fotogramma intero, con colore del carattere e dello sfondo ----------

export class Tela {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.car = new Array(w * h).fill(' ');
    this.fg = new Array(w * h).fill(null);
    this.bg = new Array(w * h).fill(null);
  }
  pulisci() { this.car.fill(' '); this.fg.fill(null); this.bg.fill(null); }
  metti(x, y, c, fg, bg = null) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const k = y * this.w + x;
    this.car[k] = c; this.fg[k] = fg; this.bg[k] = bg;
  }
  // Scrive un carattere lasciando lo sfondo che c'era (per le linee sopra le fiamme).
  sovrapponi(x, y, c, fg) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const k = y * this.w + x;
    this.car[k] = c; this.fg[k] = fg;
  }
  libero(x, y) {
    x = Math.round(x); y = Math.round(y);
    return x >= 0 && y >= 0 && x < this.w && y < this.h && this.car[y * this.w + x] === ' ' && !this.bg[y * this.w + x];
  }
  testo(x, y, s, colore) {
    [...s].forEach((c, i) => c !== ' ' && this.metti(x + i, y, c, typeof colore === 'function' ? colore(i) : colore));
  }
  // Incolla un disegno a celle (quello del teschio) in una posizione.
  incolla(x0, y0, d, w, h, k = 1) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (d.car[i] === ' ') continue;
      this.metti(x0 + x, y0 + y, d.car[i], k < 1 ? scala(d.fg[i], k) : d.fg[i], d.bg[i] ? (k < 1 ? scala(d.bg[i], k) : d.bg[i]) : null);
    }
  }
  // Abbassa la luce di tutto quello che c'è (per le dissolvenze).
  attenua(k) {
    for (let i = 0; i < this.car.length; i++) {
      if (this.fg[i]) this.fg[i] = scala(this.fg[i], k);
      if (this.bg[i]) this.bg[i] = scala(this.bg[i], k);
    }
  }
  stringa() {
    let s = '';
    for (let y = 0; y < this.h; y++) {
      s += `\x1b[${y + 1};1H`;
      let fine = this.w - 1;
      while (fine >= 0 && this.car[y * this.w + fine] === ' ' && !this.bg[y * this.w + fine]) fine--;
      let uf = '', ub = '';
      for (let x = 0; x <= fine; x++) {
        const i = y * this.w + x;
        const b = this.bg[i];
        const kb = b ? b.join(';') : '';
        if (kb !== ub) { s += b ? `\x1b[48;2;${kb}m` : '\x1b[49m'; ub = kb; }
        const c = this.car[i];
        if (c === ' ') { s += ' '; continue; }
        const kf = (this.fg[i] || [200, 200, 200]).join(';');
        if (kf !== uf) { s += `\x1b[38;2;${kf}m`; uf = kf; }
        s += c;
      }
      s += '\x1b[0m\x1b[K';
    }
    return s + '\x1b[0m';
  }
}

// ---------- il cervello a circuiti, generato a ogni avvio: mai uguale ----------

function creaCervello(cx, cy, sf, casuale) {
  // sf: scala della forma (anche frazionaria); s: passo intero della griglia dei circuiti
  const s = Math.max(1, Math.round(sf));
  const rx = 7.4 * sf;
  const ry = 4.3 * sf;
  const dentro = (x, y) => {
    if (Math.abs(x - cx) < sf * 0.6 && y < cy + 3 * sf) return false;
    return [cx - 7.5 * sf, cx + 7.5 * sf].some((lx) => ((x - lx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1);
  };
  const bordo = [];
  const occupate = new Set();
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
    for (let x = Math.floor(cx - 16 * sf); x <= Math.ceil(cx + 16 * sf); x++) {
      if (!dentro(x, y)) continue;
      if (!dentro(x + 1, y) || !dentro(x - 1, y) || !dentro(x, y + 1) || !dentro(x, y - 1)) {
        bordo.push({ x, y, ang: Math.atan2(y - cy, (x - cx) / 2) });
        occupate.add(`${x},${y}`);
      }
    }
  }
  const nodi = [];
  for (let y = cy - 3 * s; y <= cy + 3 * s; y += 2 * s) {
    for (let x = cx - Math.round(13 * sf); x <= cx + 13 * sf; x += 4 * s) {
      if (dentro(x, y) && !occupate.has(`${x},${y}`)) nodi.push({ x, y });
    }
  }
  const piste = [];
  const trova = (x, y) => nodi.find((n) => n.x === x && n.y === y);
  for (const n of nodi) {
    for (const [dx, dy, p] of [[4 * s, 0, 0.72], [0, 2 * s, 0.55]]) {
      const m = trova(n.x + dx, n.y + dy);
      if (!m || casuale() > p) continue;
      const passi = [];
      for (let k = 1; k < (dx || dy); k++) passi.push({ x: n.x + (dx ? k : 0), y: n.y + (dy ? k : 0), c: dx ? '─' : '│' });
      if (passi.every((q) => dentro(q.x, q.y) && !occupate.has(`${q.x},${q.y}`))) piste.push(passi);
    }
  }
  return { bordo, nodi, piste, cx, cy };
}

// ---------- la rete esterna: collegamenti che portano dati verso il centro ----------

function creaRete({ zone, sx, sy, TW, TH, casuale }) {
  const rete = [];
  const sinistra = sx - 3;
  const destra = sx + TW + 2;
  for (const z of zone) {
    const quanti = Math.max(0, Math.min(14, Math.floor((z.x1 - z.x0) / 9)));
    for (let k = 0; k < quanti; k++) {
      const nx = z.x0 + Math.floor(casuale() * Math.max(1, z.x1 - z.x0));
      const ny = z.y0 + Math.floor(casuale() * Math.max(1, z.y1 - z.y0));
      const arrivoX = nx < sx ? sinistra : destra;
      let arrivoY = sy + 2 + Math.floor(casuale() * Math.max(1, TH - 6));
      const passi = [[nx, ny]];
      let x = nx;
      let y = ny;
      if (z.corridoi) {
        const c = z.corridoi[Math.floor(casuale() * z.corridoi.length)];
        arrivoY = c[0] + Math.floor(casuale() * Math.max(1, c[1] - c[0]));
        while (y !== arrivoY) { y += Math.sign(arrivoY - y); passi.push([x, y]); }
        while (x !== arrivoX) { x += Math.sign(arrivoX - x); passi.push([x, y]); }
      } else {
        while (x !== arrivoX) { x += Math.sign(arrivoX - x); passi.push([x, y]); }
        while (y !== arrivoY) { y += Math.sign(arrivoY - y); passi.push([x, y]); }
      }
      const celle = passi.map((p, k) => {
        if (k === 0) return { x: p[0], y: p[1], c: '◉' };
        if (k === passi.length - 1) return { x: p[0], y: p[1], c: '◆' };
        const lati = new Set();
        for (const q of [passi[k - 1], passi[k + 1]]) {
          if (q[0] < p[0]) lati.add('S'); else if (q[0] > p[0]) lati.add('D');
          else if (q[1] < p[1]) lati.add('A'); else lati.add('B');
        }
        const mappa = { DS: '─', AB: '│', BS: '┐', AS: '┘', BD: '┌', AD: '└' };
        return { x: p[0], y: p[1], c: mappa[[...lati].sort().join('')] || '─' };
      });
      rete.push({ celle, inizio: casuale() * 1.3, velocita: 18 + casuale() * 24, sfasa: casuale() * 40 });
    }
  }
  return rete;
}

// ---------- gli sfondi dei temi ----------

function creaSfondo(tema, W, H, casuale) {
  if (tema === 'fuoco') {
    const FH = Math.max(6, Math.min(14, Math.floor(H / 3.5)));
    return { tipo: 'fiamme', FH, buf: new Uint8Array(W * FH), tavolozza: tavolozzaFuoco() };
  }
  if (tema === 'ghiaccio') {
    const n = Math.floor((W * H) / 45);
    return { tipo: 'neve', fiocchi: Array.from({ length: n }, () => ({ x: casuale() * W, y: casuale() * H, v: 2 + casuale() * 4, f: casuale() * 6.3, c: casuale() })) };
  }
  if (tema === 'matrix') {
    const gocce = [];
    for (let x = 0; x < W; x++) if (casuale() < 0.45) gocce.push({ x, y: -casuale() * H * 2, v: 6 + casuale() * 14, l: 5 + Math.floor(casuale() * 14), s: Math.floor(casuale() * 1000) });
    return { tipo: 'pioggia', gocce };
  }
  const stelle = Array.from({ length: Math.floor((W * H) / 110) }, (_, i) => ({ x: Math.floor(caso(i, 11) * W), y: Math.floor(caso(i, 29) * H), f: caso(i, 53) }));
  return { tipo: 'stelle', stelle };
}

function tavolozzaFuoco() {
  const tappe = [[0, 0, 0], [40, 0, 0], [120, 10, 0], [200, 40, 0], [240, 110, 0], [255, 180, 20], [255, 230, 120], [255, 255, 230]];
  return Array.from({ length: 37 }, (_, i) => campiona(tappe, (i / 36) * 0.999 * (1 - 1 / tappe.length) ));
}

const CARATTERI_PIOGGIA = '01Z#$%&*+=:;<>?@^|~¦§¤×÷±';

function disegnaSfondo(sf, tela, t, dt, W, H, evita, intensita) {
  if (sf.tipo === 'stelle') {
    for (const st of sf.stelle) {
      if (evita(st.x, st.y)) continue;
      const b = 0.25 + 0.75 * Math.abs(Math.sin(t * (0.8 + st.f) + st.f * 9));
      tela.metti(st.x, st.y, b > 0.7 ? '·' : '˙', scala([120, 100, 170], b * 0.6 * intensita));
    }
    return;
  }
  if (sf.tipo === 'fiamme') {
    const { FH, buf, tavolozza } = sf;
    const forza = Math.round(36 * lim(intensita));
    for (let x = 0; x < W; x++) buf[(FH - 1) * W + x] = Math.random() < 0.85 ? forza : Math.max(0, forza - 12);
    for (let y = 0; y < FH - 1; y++) {
      for (let x = 0; x < W; x++) {
        const s = buf[(y + 1) * W + x];
        const d = (Math.random() * 3) | 0;
        const nx = x - d + 1;
        if (nx < 0 || nx >= W) continue;
        buf[y * W + nx] = Math.max(0, s - ((Math.random() * 4.2) | 0));
      }
    }
    const simboli = [' ', '░', '░', '▒', '▒', '▓', '▓', '█'];
    for (let y = 0; y < FH; y++) {
      for (let x = 0; x < W; x++) {
        const v = buf[y * W + x];
        if (v < 3) continue;
        const sy = H - FH + y;
        if (evita(x, sy)) continue;
        const ch = simboli[Math.min(7, Math.floor((v / 36) * 7.99))];
        if (ch === ' ') continue;
        tela.metti(x, sy, ch, tavolozza[Math.min(36, v)], v > 26 ? tavolozza[Math.max(0, v - 18)] : null);
      }
    }
    // braci che salgono
    for (let k = 0; k < Math.floor(W / 6); k++) {
      const vita = ((t * 0.9 + caso(k, 3)) % 1);
      const x = Math.floor(caso(k, 7) * W + Math.sin(t * 3 + k) * 2);
      const y = H - FH - vita * (H - FH) * 0.8;
      if (!evita(x, y) && tela.libero(x, y)) tela.metti(x, y, vita < 0.5 ? '✦' : '·', scala([255, 150 + 80 * (1 - vita), 40], (1 - vita) * intensita));
    }
    return;
  }
  if (sf.tipo === 'neve') {
    for (const f of sf.fiocchi) {
      f.y += f.v * dt * intensita;
      f.x += Math.sin(t * 1.3 + f.f) * 2.5 * dt;
      if (f.y >= H) { f.y = -1; f.x = Math.random() * W; }
      if (f.x < 0) f.x += W; if (f.x >= W) f.x -= W;
      if (evita(f.x, f.y) || !tela.libero(f.x, f.y)) continue;
      const ch = f.c < 0.15 ? '✦' : f.c < 0.5 ? '*' : f.c < 0.8 ? '·' : '˙';
      tela.metti(f.x, f.y, ch, scala([200 + 55 * f.c, 230, 255], (0.35 + 0.65 * f.c) * intensita));
    }
    return;
  }
  if (sf.tipo === 'pioggia') {
    for (const g of sf.gocce) {
      g.y += g.v * dt * (0.4 + 0.6 * intensita);
      if (g.y - g.l > H) { g.y = -Math.random() * 20; g.v = 6 + Math.random() * 14; g.l = 5 + Math.floor(Math.random() * 14); g.s = Math.floor(Math.random() * 1000); }
      const testa = Math.floor(g.y);
      for (let k = 0; k < g.l; k++) {
        const y = testa - k;
        if (y < 0 || y >= H || evita(g.x, y)) continue;
        const ch = CARATTERI_PIOGGIA[Math.floor(caso(g.s + y, Math.floor(t * 8) + k) * CARATTERI_PIOGGIA.length)];
        const col = k === 0 ? [210, 255, 210] : scala([0, 255, 65], (1 - k / g.l) * 0.85 * intensita);
        tela.metti(g.x, y, ch, col);
      }
    }
  }
}

// ---------- linee: l'elettrocardiogramma e le onde cerebrali ----------

// Disegna una spezzata colonna per colonna: y(x) → caratteri di cornice tra un punto e il successivo.
function spezzata(tela, x0, x1, fy, colore) {
  let prec = null;
  for (let x = x0; x <= x1; x++) {
    const y = Math.round(fy(x));
    const col = typeof colore === 'function' ? colore(x) : colore;
    if (prec === null || prec === y) tela.metti(x, y, '─', col);
    else {
      const su = y < prec;
      tela.metti(x - 1, prec, su ? '╯' : '╮', col);
      for (let k = Math.min(prec, y) + 1; k < Math.max(prec, y); k++) tela.metti(x - 1, k, '│', col);
      tela.metti(x - 1, y, su ? '╭' : '╰', col);
      tela.metti(x, y, '─', col);
    }
    prec = y;
  }
}

// La forma di un battito (P, Q, R, S, T) in funzione della distanza dal picco, in colonne.
function battito(d) {
  const a = Math.abs(d);
  if (a < 1) return 7;
  if (a < 2.2) return d < 0 ? -1.5 : -2.5;
  if (a < 3.5) return 0;
  if (d > 0 && a < 8) return 1.2 * Math.sin(((a - 3.5) / 4.5) * Math.PI);
  if (d < 0 && a < 7) return 0.6 * Math.sin(((a - 3.5) / 3.5) * Math.PI);
  return 0;
}

// ---------- la regia ----------

const T = {
  ecg: [0.25, 2.3], battiti: [0.75, 1.45, 2.0],
  onde: [2.0, 3.5], rete: [2.4, 4.2], cervello: [2.9, 4.5], circuiti: [3.5, 4.7],
  teschio: [4.5, 6.0], svanisce: [5.0, 6.1], occhi: [6.05, 6.9], scossa: [6.1, 6.35], scintille: 6.2,
  nome: [6.7, 7.9], frase: [7.8, 8.4], ideato: [8.3, 8.8], gasty: [8.7, 9.9], elogio: [9.6, 10.2],
  boot: [9.0, 11.0], uscita: [11.0, 11.9],
};
const DURATA = 11.9;

/**
 * La schermata iniziale completa.
 * @param brand  { nome, tagline, colori }
 * @param o      { tema, rilevamento: Promise, suoni, leggera, info: () => ({ database, preferenze, progetti }), versione }
 */
export async function splash(brand, o = {}) {
  if (!out.isTTY) return;
  const W = Math.max(20, (out.columns || 80) - 1);
  const H = Math.max(10, (out.rows || 24) - 1);
  const tema = PALETTE[o.tema] ? o.tema : 'neon';
  const stops = brand.colori.map(hex);
  const [VIOLA, ROSA, CIANO] = [stops[0], stops[1] || stops[0], stops[stops.length - 1]];
  const palette = PALETTE[tema];
  const suona = (n) => { try { o.suoni?.suona(n); } catch { /* */ } };

  if (W < 78 || H < 24) return splashCorta(brand, { ...o, tema, W, H, stops, palette, suona });

  // ---- impaginazione ----
  const nomeGrande = righeLogo(brand.nome.toUpperCase(), 999, ['ANSI Shadow']);
  const gastyGrande = righeLogo('GASTY', 999, ['ANSI Shadow']);
  const LW = Math.max(...nomeGrande.map((l) => l.length));
  const GW = Math.max(...gastyGrande.map((l) => l.length));
  const tag = brand.tagline || '';
  const IDEATO = 'I D E A T O   E   F O R G I A T O   D A';
  const ELOGIO = 'architetto di intelligenze  ·  costruttore di mondi';
  const TB = Math.max(LW, GW, IDEATO.length, ELOGIO.length, tag.length);

  let TH = Math.max(12, Math.min(26, Math.floor(H * 0.52)));
  let TW = TH * 2;
  let lato = TW + 10 + TB + 4 <= W && TH + 10 <= H;
  if (!lato) { TH = Math.max(10, Math.min(20, H - 12)); TW = TH * 2; }
  const completo = lato || (H >= 34 && W >= Math.max(LW, GW) + 4);
  const nome = completo ? nomeGrande : [brand.nome.toUpperCase().split('').join(' ')];
  const gasty = completo ? gastyGrande : ['G A S T Y'];
  const bloccoH = nome.length + 1 + 1 + 1 + gasty.length + 1;
  const righeBoot = 7;

  let sx, sy, tx, ty, zone, bootX, bootY;
  if (lato) {
    const totale = TW + 10 + TB;
    sx = Math.floor((W - totale) / 2);
    sy = Math.floor((H - TH) / 2) - 1;
    tx = sx + TW + 10;
    ty = sy + Math.floor((TH - bloccoH) / 2) - 2;
    if (ty < 1) ty = 1;
    bootX = tx; bootY = ty + bloccoH + 1;
    if (bootY + righeBoot > H - 1) { bootX = sx; bootY = sy + TH + 1; }
    const corridoi = [];
    if (ty - 2 > sy + 1) corridoi.push([sy + 1, ty - 2]);
    if (sy + TH - 2 > ty + bloccoH + 1) corridoi.push([ty + bloccoH + 1, sy + TH - 2]);
    zone = [
      { x0: 2, x1: Math.max(3, sx - 10), y0: 1, y1: H - 1 },
      { x0: Math.min(W - 3, tx + TB + 6), x1: W - 2, y0: 1, y1: H - 1, corridoi: corridoi.length ? corridoi : null },
    ];
  } else {
    const blocco = TH + 1 + nome.length + (completo ? 1 + 1 + 1 + gasty.length + 1 : 2);
    sx = Math.floor((W - TW) / 2);
    sy = Math.max(1, Math.floor((H - blocco) / 2) - 1);
    tx = 0;
    ty = sy + TH + 1;
    bootX = 2; bootY = H - 2;
    zone = [
      { x0: 2, x1: Math.max(3, sx - 10), y0: 1, y1: ty - 1 },
      { x0: Math.min(W - 3, sx + TW + 10), x1: W - 2, y0: 1, y1: ty - 1 },
    ];
  }
  const centra = (len) => (lato ? tx : Math.floor((W - len) / 2));
  const tela = new Tela(W, H);
  const casuale = generatore((Date.now() & 0xffff) + 1);
  const cervello = creaCervello(sx + Math.floor(TW / 2), sy + Math.floor(TH * 0.42), TW / 36, casuale);
  const rete = creaRete({ zone, sx, sy, TW, TH, casuale });
  const impulsi = cervello.piste.map(() => ({ sfasa: casuale() * 10, vel: 6 + casuale() * 8 }));
  const nelTesto = (x, y) => (lato ? x >= tx - 1 && x <= tx + TB && y >= ty - 1 && y <= ty + bloccoH + righeBoot + 1 : y >= ty - 1);
  const nelTeschio = (x, y) => x >= sx - 2 && x <= sx + TW + 1 && y >= sy - 2 && y <= sy + TH + 1;
  const sfondo = creaSfondo(tema, W, H, casuale);
  const direzione = tema === 'fuoco' ? 1 : tema === 'ghiaccio' ? -1 : 0;
  const geo = geometria(out.columns || 80, out.rows || 24);

  // i frammenti del nome: ogni carattere parte da un punto a caso e vola al suo posto
  const frammenti = [];
  nome.forEach((riga, y) => {
    const x0 = centra(riga.length);
    for (let x = 0; x < riga.length; x++) {
      if (riga[x] === ' ') continue;
      frammenti.push({ c: riga[x], x: x0 + x, y: ty + y, px: casuale() * W, py: casuale() * H, ritardo: casuale() * 0.55, fx: x / riga.length, fy: y });
    }
  });
  // le lettere di GASTY: forgiate una alla volta, ognuna larga quanto è davvero
  const colonneGasty = gasty[0] ? Math.max(...gasty.map((r) => r.length)) : 5;
  const confini = [];
  if (completo) { let acc = 0; for (const l of 'GASTY') { acc += Math.max(...righeLogo(l, 999, ['ANSI Shadow']).map((r) => r.length)); confini.push(acc); } }
  else for (let i = 1; i <= 5; i++) confini.push(Math.ceil((colonneGasty * i) / 5));
  const letteraDi = (x) => { let i = 0; while (i < confini.length - 1 && x >= confini[i]) i++; return i; };
  const colpiGasty = 5;
  const scintilleForgia = Array.from({ length: 60 }, (_, k) => ({ k, vx: (casuale() - 0.5) * 14, vy: -(2 + casuale() * 7), vita: 0.5 + casuale() * 0.6 }));
  // le righe del "BIOS": si riempiono quando il rilevamento risponde
  let boot = null;
  const info = o.info ? o.info() : {};
  const preparaBoot = (d) => {
    const righe = [];
    righe.push(['corteccia', 'in linea', C_OK]);
    if (d) for (const x of Object.values(d)) righe.push([x.nome.toLowerCase(), x.ok ? `● ${(x.versione || 'ok').slice(0, 18)}` : `○ ${x.nota || 'non collegata'}`, x.ok ? C_OK : C_NO]);
    righe.push(['database', `${info.database ?? 0} voci`, C_INFO]);
    righe.push(['memoria', `${info.preferenze ?? 0} preferenze`, C_INFO]);
    righe.push(['progetti', `${info.progetti ?? 0}`, C_INFO]);
    return righe.slice(0, righeBoot);
  };
  const C_OK = [57, 255, 120], C_NO = [120, 120, 140], C_INFO = CIANO;
  if (o.rilevamento) o.rilevamento.then((d) => { boot = preparaBoot(d); }).catch(() => { boot = preparaBoot(null); });
  else boot = preparaBoot(null);

  // ---- il tasto che salta ----
  let salta = false;
  const stdin = process.stdin;
  const tasto = (d) => {
    if (d[0] === 3) { out.write('\x1b[0m\x1b[?25h\x1b[?1049l'); process.exit(0); }
    salta = true;
  };
  if (stdin.isTTY) { stdin.setRawMode(true); stdin.resume(); stdin.on('data', tasto); }

  out.write('\x1b]0;KORTEX\x07\x1b[?1049h\x1b[2J\x1b[H\x1b[?25l');
  const t0 = Date.now();
  let fotogramma = 0;
  let tPrec = 0;
  // il teschio parte sempre alla qualità piena: se il PC non regge, scende da solo dopo tre fotogrammi lenti
  let qualita = 1;
  let lenti = 0;
  let suonati = { battiti: 0, ronzio: false, colpo: false, forgia: 0 };
  const passoMs = o.leggera ? 55 : 38;

  while (!salta) {
    const t = (Date.now() - t0) / 1000;
    if (t > DURATA) break;
    const dt = Math.min(0.1, t - tPrec);
    tPrec = t;
    fotogramma++;
    const inizioFrame = Date.now();
    tela.pulisci();

    const uscita = morbido(fase(t, ...T.uscita));
    const scossa = t > T.scossa[0] && t < T.scossa[1] ? (fotogramma % 2 ? 1 : -1) : 0;
    const X = sx + scossa;
    const accensione = morbido(fase(t, ...T.occhi));
    const tremolio = t < T.occhi[1] && caso(fotogramma, 7) < 0.3 ? 0.15 : 1;
    const luce = t >= T.occhi[1] ? 0.86 + 0.14 * Math.sin(t * 4.5) : accensione * tremolio;

    // suoni
    while (suonati.battiti < T.battiti.length && t >= T.battiti[suonati.battiti]) { suona('battito'); suonati.battiti++; }
    if (!suonati.ronzio && t >= T.cervello[0]) { suona('ronzio'); suonati.ronzio = true; }
    if (!suonati.colpo && t >= T.occhi[0]) { suona('colpo'); suonati.colpo = true; }

    // ---- lo sfondo del tema ----
    const intensitaSfondo = uscita > 0 ? 1 - uscita : lim(fase(t, 0.2, 2.5));
    disegnaSfondo(sfondo, tela, t, dt, W, H, (x, y) => nelTesto(x, y) || (sfondo.tipo === 'stelle' && nelTeschio(x, y)), intensitaSfondo);

    // ---- ATTO 0: il battito del cuore ----
    if (t >= T.ecg[0] && t < T.onde[1]) {
      const vita = fase(t, ...T.ecg);
      const penna = Math.floor(vita * (W + 10)) - 5;
      const base = lato ? sy + Math.floor(TH * 0.42) : sy + Math.floor(TH * 0.45);
      const scomparsa = fase(t, T.onde[0], T.onde[1]);
      const inizioX = Math.max(0, Math.floor(scomparsa * W * 1.2) - W * 0.2);
      if (penna > inizioX) {
        const picchi = T.battiti.map((tb) => Math.floor(((tb - T.ecg[0]) / (T.ecg[1] - T.ecg[0])) * (W + 10)) - 5);
        const amp = (x) => picchi.reduce((a, px) => a + battito(x - px), 0);
        spezzata(tela, Math.max(0, inizioX), Math.min(W - 1, penna), (x) => base - amp(x) * 0.5, (x) => {
          const d = penna - x;
          const k = lim(1 - d / (W * 0.75));
          return mescola(scala(ROSA, 0.25), d < 4 ? BIANCO : ROSA, 0.25 + 0.75 * k);
        });
        if (penna < W) tela.metti(penna, base - amp(penna) * 0.5, '●', BIANCO);
      }
    }

    // ---- ATTO 1: le onde cerebrali ----
    if (t >= T.onde[0] && t < T.cervello[1]) {
      const forza = Math.sin(fase(t, T.onde[0], T.cervello[1]) * Math.PI);
      const cx = cervello.cx;
      for (let k = 0; k < 3; k++) {
        const base = cervello.cy + (k - 1) * Math.max(2, Math.floor(TH / 6));
        const f = 0.18 + k * 0.07;
        const col = scala(k === 0 ? VIOLA : k === 1 ? CIANO : ROSA, 0.4 + 0.6 * forza);
        const estensione = Math.floor(forza * W * 0.36);
        spezzata(tela, Math.max(0, cx - estensione), Math.min(W - 1, cx + estensione), (x) => base + Math.sin(x * f + t * (6 + k * 2) + k) * forza * (1.0 + k * 0.4) * Math.max(0.15, 1 - Math.abs(x - cx) / (W * 0.36)), col);
      }
    }

    // ---- ATTO 2: la rete ----
    if (t >= T.rete[0] && uscita < 1) {
      for (const p of rete) {
        const visibili = Math.floor(p.celle.length * morbido(fase(t, T.rete[0] + p.inizio, T.rete[0] + p.inizio + 1.4)));
        const testa = t > T.rete[0] + p.inizio + 0.8 ? ((t - T.rete[0] - p.inizio) * p.velocita + p.sfasa) % (p.celle.length + 10) : -99;
        for (let k = 0; k < visibili; k++) {
          const c = p.celle[k];
          let colore = c.c === '◉' ? VIOLA : c.c === '◆' ? ROSA : scala(VIOLA, 0.45);
          const d = testa - k;
          if (d >= 0 && d < 5) colore = scala(mescola(BIANCO, CIANO, d / 2.5), 1 - d * 0.1);
          tela.sovrapponi(c.x, c.y, c.c, scala(colore, 1 - uscita));
        }
      }
    }

    // ---- ATTO 3: il cervello ----
    const resta = 1 - fase(t, ...T.svanisce);
    if (t > T.cervello[0] && resta > 0) {
      const giro = morbido(fase(t, ...T.cervello)) * Math.PI * 2 - Math.PI;
      for (const c of cervello.bordo) {
        if (c.ang > giro) continue;
        tela.metti(c.x + scossa, c.y, '▓', scala(campiona([VIOLA, ROSA], (c.ang + Math.PI) / (Math.PI * 2) + t * 0.2), resta));
      }
      const accendi = fase(t, ...T.circuiti);
      cervello.piste.forEach((pista, i) => {
        if (caso(i, 3) > accendi) return;
        const pos = (t * impulsi[i].vel + impulsi[i].sfasa) % (pista.length + 6);
        pista.forEach((q, k) => tela.metti(q.x + scossa, q.y, q.c, scala(Math.abs(pos - k) < 1.2 ? BIANCO : mescola(scala(CIANO, 0.3), CIANO, 0.35), resta)));
      });
      for (const n of cervello.nodi) {
        if (caso(n.x, n.y) > accendi) continue;
        tela.metti(n.x + scossa, n.y, '●', scala(mescola(VIOLA, CIANO, 0.6 + 0.4 * Math.sin(t * 6 + n.x)), resta));
      }
    }

    // ---- ATTO 8 (sotto a tutto): in uscita le pagine si disegnano ----
    if (uscita > 0) disegnaScheletro(tela, geo, uscita, stops, VIOLA, ROSA);

    // ---- ATTO 4: il teschio in 3D ----
    const forma = fase(t, ...T.teschio);
    if (forma > 0) {
      const angolo = uscita > 0 ? 0.32 * (1 - uscita) + 0.22 * uscita : 0.55 * Math.sin((t - T.teschio[0]) * 0.55) + 0.1 * Math.sin(t * 1.7);
      const tilt = 0.08 + 0.05 * Math.sin(t * 0.9);
      // in uscita il teschio rimpicciolisce e scivola fino all'intestazione
      const tw = Math.round(TW + (geo.teschio.w - TW) * uscita);
      const th = Math.round(TH + (geo.teschio.h - TH) * uscita);
      const ox = Math.round(X + (geo.teschio.x - X) * uscita);
      const oy = Math.round(sy + (geo.teschio.y - sy) * uscita);
      const d = disegnaTeschio({ w: Math.max(4, tw), h: Math.max(2, th), angolo, tilt, luce, forma, palette, qualita, direzione, sguardo: [0.2 * Math.sin(t * 0.8), 0] });
      tela.incolla(ox, oy, d, Math.max(4, tw), Math.max(2, th));
    }

    // scintille dagli occhi quando si accendono
    if (t > T.scintille && uscita === 0) {
      for (let k = 0; k < 44; k++) {
        const nascita = T.scintille + k * 0.05;
        const eta = t - nascita;
        if (eta < 0 || eta > 1.2) continue;
        const lato2 = k % 2 ? 1 : -1;
        const ex = X + TW / 2 + lato2 * TW * 0.19;
        const ey = sy + TH * 0.46;
        const px = ex + (caso(k, 5) - 0.5) * 2 + lato2 * eta * (6 + caso(k, 11) * 10);
        const py = ey - eta * (3 + caso(k, 9) * 6) + eta * eta * 4;
        const ch = eta < 0.3 ? '✦' : eta < 0.7 ? '·' : '˙';
        if (tela.libero(px, py)) tela.metti(px, py, ch, scala(mescola(CIANO, ROSA, eta), 1 - eta * 0.7));
      }
    }

    // ---- ATTO 5: il nome si assembla ----
    const rivela = fase(t, ...T.nome);
    if (rivela > 0) {
      for (const f of frammenti) {
        const q = lim((rivela * (T.nome[1] - T.nome[0]) - f.ritardo) / 0.6);
        if (q <= 0) continue;
        const e = 1 - Math.pow(1 - q, 3);
        const x = f.px + (f.x - f.px) * e;
        const y = f.py + (f.y - f.py) * e;
        let col;
        if (q < 1) col = mescola(scala(CIANO, 0.5), BIANCO, q);
        else {
          const arrivo = (rivela * (T.nome[1] - T.nome[0]) - f.ritardo - 0.6);
          col = arrivo < 0.12 ? BIANCO : campiona(stops, f.fx * 0.8 - t * 0.35 + f.fy * 0.04);
        }
        const ch = q < 1 ? '█▀▄╗╔═║'[Math.floor(caso(f.x * 7 + fotogramma, f.y) * 7)] : f.c;
        if (uscita > 0) col = scala(col, 1 - uscita);
        tela.metti(x, y, ch, col);
      }
    }
    let riga = ty + nome.length;
    if (completo) {
      const n = Math.floor(tag.length * fase(t, ...T.frase));
      tela.testo(centra(tag.length), riga, tag.slice(0, n), scala(CIANO, 1 - uscita));
      riga += 2;
      const n2 = Math.floor(IDEATO.length * fase(t, ...T.ideato));
      tela.testo(centra(IDEATO.length), riga, IDEATO.slice(0, n2), scala([185, 185, 205], 1 - uscita));
      riga += 1;
      // ---- ATTO 6: la forgiatura di GASTY ----
      const forgia = fase(t, ...T.gasty);
      if (forgia > 0) {
        const durataColpi = 0.95;
        const colpi = Math.min(colpiGasty, Math.floor((forgia * (T.gasty[1] - T.gasty[0])) / (durataColpi / colpiGasty)) + 1);
        while (suonati.forgia < colpi) { suona('forgia'); suonati.forgia++; }
        gasty.forEach((r, y) => {
          const x0 = centra(colonneGasty);
          for (let x = 0; x < r.length; x++) {
            if (r[x] === ' ') continue;
            const lettera = letteraDi(x);
            if (lettera >= colpi) continue;
            const daColpo = forgia * (T.gasty[1] - T.gasty[0]) - lettera * (durataColpi / colpiGasty);
            // incandescente → giallo → arancio → rosso → il colore finale
            const raff = lim(daColpo / 1.3);
            const finale = campiona(stops, 0.5 + (x / r.length) * 0.8 - t * 0.5 + y * 0.05);
            const temperatura = raff < 0.25 ? mescola([255, 255, 240], [255, 220, 90], raff / 0.25)
              : raff < 0.55 ? mescola([255, 220, 90], [255, 110, 20], (raff - 0.25) / 0.3)
                : raff < 0.8 ? mescola([255, 110, 20], [170, 40, 40], (raff - 0.55) / 0.25)
                  : mescola([170, 40, 40], finale, (raff - 0.8) / 0.2);
            tela.metti(x0 + x, riga + y, r[x], scala(temperatura, 1 - uscita));
          }
        });
        // scintille dall'ultima lettera colpita
        const ultima = colpi - 1;
        const tColpo = T.gasty[0] + ultima * (durataColpi / colpiGasty);
        const eta = t - tColpo;
        if (eta < 0.9) {
          const x0 = centra(colonneGasty) + Math.floor(((ultima ? confini[ultima - 1] : 0) + confini[ultima]) / 2);
          for (const s of scintilleForgia) {
            const e2 = eta - (s.k % 10) * 0.03;
            if (e2 < 0 || e2 > s.vita) continue;
            const px = x0 + s.vx * e2;
            const py = riga + gasty.length / 2 + s.vy * e2 + 6 * e2 * e2;
            if (tela.libero(px, py)) tela.metti(px, py, e2 < 0.2 ? '✦' : '·', scala([255, 200 + 55 * (1 - e2), 80], (1 - e2 / s.vita) * (1 - uscita)));
          }
        }
      }
      riga += gasty.length;
      const n3 = Math.floor(ELOGIO.length * fase(t, ...T.elogio));
      tela.testo(centra(ELOGIO.length), riga, ELOGIO.slice(0, n3), scala([150, 150, 175], 1 - uscita));
    } else {
      const firma = 'ideato e forgiato da GASTY';
      const n = Math.floor(firma.length * fase(t, ...T.ideato));
      tela.testo(centra(firma.length), riga + 1, firma.slice(0, n), (i) => scala(i >= 21 ? campiona(stops, i / 6 - t * 0.5) : [170, 170, 190], 1 - uscita));
    }

    // ---- ATTO 7: i sistemi si accendono ----
    if (t >= T.boot[0] && boot && uscita < 1) {
      const quante = Math.min(boot.length, Math.floor(fase(t, ...T.boot) * (boot.length + 1)));
      for (let i = 0; i < quante; i++) {
        const [nomeRiga, valore, col] = boot[i];
        const eta = t - (T.boot[0] + (i / (boot.length + 1)) * (T.boot[1] - T.boot[0]));
        const punti = Math.floor(lim(eta / 0.25) * 14);
        const testo = `▸ ${nomeRiga.padEnd(10, ' ')} ${'·'.repeat(punti)}${punti >= 14 ? ' ' + valore : ''}`;
        tela.testo(bootX, bootY + i, testo, (k) => scala(k < 12 ? [160, 160, 185] : k < 27 ? [70, 70, 95] : col, 1 - uscita));
      }
    }

    if (t < 9.0 && uscita === 0) tela.testo(W - 27, 0, 'un tasto qualsiasi: salta', [75, 75, 92]);

    out.write(tela.stringa());
    // se il PC non ce la fa, abbasso la qualità del teschio invece di scattare
    const durataFrame = Date.now() - inizioFrame;
    if (durataFrame > 70) { if (++lenti >= 3 && qualita === 1) qualita = 2; } else lenti = 0;
    await dorme(Math.max(5, passoMs - durataFrame));
  }

  if (stdin.isTTY) { stdin.off('data', tasto); stdin.setRawMode(false); stdin.pause(); }
}

// Le cornici della pagina LAVORO, tracciate un pezzo alla volta.
function disegnaScheletro(tela, geo, q, stops, VIOLA, ROSA) {
  const { c, hTesta, hCorpo, wTerm } = geo;
  // la riga luminosa sotto l'intestazione
  const n = Math.floor(c * lim(q * 1.6));
  for (let x = 0; x < n; x++) tela.metti(x, hTesta - 1, '━', campiona(stops, (x / c) * 0.9 - q));
  const cornici = [
    [0, hTesta, wTerm, hCorpo, VIOLA],
    [wTerm, hTesta, c - wTerm, hCorpo, ROSA],
    [0, hTesta + hCorpo, wTerm, 3, [58, 58, 74]],
    [wTerm, hTesta + hCorpo, c - wTerm, 3, ROSA],
  ];
  cornici.forEach(([x0, y0, w, h, col], i) => {
    const quota = lim((q - 0.15 - i * 0.12) / 0.45);
    if (quota <= 0) return;
    rettangolo(tela, x0, y0, w, h, scala(col, 0.4 + 0.6 * quota), quota);
  });
}

// Disegna il bordo di un riquadro in senso orario fino a una quota (0..1) del perimetro.
function rettangolo(tela, x0, y0, w, h, col, quota) {
  const perimetro = 2 * (w + h) - 4;
  const n = Math.floor(perimetro * quota);
  let k = 0;
  const passo = (x, y, ch) => { if (k < n) tela.metti(x, y, ch, col); k++; };
  passo(x0, y0, '╭');
  for (let x = x0 + 1; x < x0 + w - 1; x++) passo(x, y0, '─');
  passo(x0 + w - 1, y0, '╮');
  for (let y = y0 + 1; y < y0 + h - 1; y++) passo(x0 + w - 1, y, '│');
  passo(x0 + w - 1, y0 + h - 1, '╯');
  for (let x = x0 + w - 2; x > x0; x--) passo(x, y0 + h - 1, '─');
  passo(x0, y0 + h - 1, '╰');
  for (let y = y0 + h - 2; y > y0; y--) passo(x0, y, '│');
}

// ---------- la versione corta per schermi piccoli (telefono, finestre strette) ----------

async function splashCorta(brand, o) {
  const { W, H, stops, palette, suona } = o;
  const [VIOLA, ROSA, CIANO] = [stops[0], stops[1] || stops[0], stops[stops.length - 1]];
  const tela = new Tela(W, H);
  const righe = righeLogo(brand.nome.toUpperCase(), W - 2, ['Small', 'Mini']);
  const LW = Math.max(...righe.map((l) => l.length));
  const TH = Math.max(6, Math.min(12, Math.floor((H - righe.length - 4) * 0.8)));
  const TW = TH * 2;
  const sx = Math.floor((W - TW) / 2);
  const bloccoH = TH + 1 + righe.length + 2;
  const sy = Math.max(0, Math.floor((H - bloccoH) / 2));
  const ty = sy + TH + 1;
  const firma = 'ideato e forgiato da GASTY';
  const Tc = { ecg: [0.1, 1.3], battiti: [0.4, 0.9, 1.25], teschio: [1.1, 2.2], occhi: [2.2, 2.8], nome: [2.6, 3.6], firma: [3.4, 3.9], fine: 4.9 };
  let salta = false;
  const stdin = process.stdin;
  const tasto = (d) => { if (d[0] === 3) { out.write('\x1b[0m\x1b[?25h\x1b[?1049l'); process.exit(0); } salta = true; };
  if (stdin.isTTY) { stdin.setRawMode(true); stdin.resume(); stdin.on('data', tasto); }
  out.write('\x1b]0;KORTEX\x07\x1b[?1049h\x1b[2J\x1b[H\x1b[?25l');
  const t0 = Date.now();
  let battiti = 0, colpo = false, fotogramma = 0;
  while (!salta) {
    const t = (Date.now() - t0) / 1000;
    if (t > Tc.fine) break;
    fotogramma++;
    tela.pulisci();
    while (battiti < Tc.battiti.length && t >= Tc.battiti[battiti]) { suona('battito'); battiti++; }
    if (!colpo && t >= Tc.occhi[0]) { suona('colpo'); colpo = true; }
    if (t < Tc.teschio[1]) {
      const vita = fase(t, ...Tc.ecg);
      const penna = Math.floor(vita * (W + 8)) - 4;
      const base = sy + Math.floor(TH / 2);
      const picchi = Tc.battiti.map((tb) => Math.floor(((tb - Tc.ecg[0]) / (Tc.ecg[1] - Tc.ecg[0])) * (W + 8)) - 4);
      const amp = (x) => picchi.reduce((a, px) => a + battito(x - px), 0);
      const svan = 1 - fase(t, Tc.teschio[0], Tc.teschio[1]);
      if (penna > 0 && svan > 0) spezzata(tela, 0, Math.min(W - 1, penna), (x) => base - amp(x) * 0.4, (x) => scala(mescola(scala(ROSA, 0.3), penna - x < 4 ? [240, 250, 255] : ROSA, lim(1 - (penna - x) / (W * 0.8))), svan));
    }
    const forma = fase(t, ...Tc.teschio);
    const accensione = morbido(fase(t, ...Tc.occhi));
    const luce = t >= Tc.occhi[1] ? 0.85 + 0.15 * Math.sin(t * 4.5) : accensione * (caso(fotogramma, 7) < 0.3 ? 0.15 : 1);
    if (forma > 0) {
      const d = disegnaTeschio({ w: TW, h: TH, angolo: 0.35 * Math.sin(t * 0.9), tilt: 0.08, luce, forma, palette, qualita: 1 });
      tela.incolla(sx, sy, d, TW, TH);
    }
    const rivela = fase(t, ...Tc.nome);
    righe.forEach((r, y) => {
      const x0 = Math.floor((W - LW) / 2);
      for (let x = 0; x < r.length; x++) {
        if (r[x] === ' ' || x / r.length >= rivela) continue;
        tela.metti(x0 + x, ty + y, r[x], campiona(stops, (x / r.length) * 0.8 - t * 0.5 + y * 0.04));
      }
    });
    const n = Math.floor(firma.length * fase(t, ...Tc.firma));
    tela.testo(Math.max(0, Math.floor((W - firma.length) / 2)), ty + righe.length + 1, firma.slice(0, n), (i) => (i >= 21 ? campiona(stops, i / 6 - t * 0.5) : [170, 170, 190]));
    out.write(tela.stringa());
    await dorme(40);
  }
  if (stdin.isTTY) { stdin.off('data', tasto); stdin.setRawMode(false); stdin.pause(); }
}
