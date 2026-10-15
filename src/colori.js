// Colori e piccole utilità condivise da tutto KORTEX (schermata iniziale, interfaccia, emblemi).
import figlet from 'figlet';

export const hex = (h) => {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export const rgbHex = (rgb) => '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

// Un colore lungo un gradiente ciclico: t da 0 a 1 percorre tutte le tappe e torna alla prima.
export function campiona(stops, t) {
  t = ((t % 1) + 1) % 1;
  const pos = t * stops.length;
  const i = Math.floor(pos);
  const f = pos - i;
  const a = stops[i % stops.length];
  const b = stops[(i + 1) % stops.length];
  return a.map((v, k) => Math.round(v + (b[k] - v) * f));
}

export const lim = (x) => Math.max(0, Math.min(1, x));
export const mescola = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * lim(t)));
export const scala = (c, k) => c.map((v) => Math.round(v * k));
export const morbido = (x) => { x = lim(x); return x * x * (3 - 2 * x); };
export const fase = (t, a, b) => lim((t - a) / (b - a));

// Numeri pseudo-casuali ripetibili: stessa coppia (x, y) → stesso numero, a ogni fotogramma.
export function caso(x, y) {
  let h = Math.imul(x ^ 0x5bd1e995, 374761393) ^ Math.imul(y + 0x27d4eb2f, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function generatore(seme) {
  return () => {
    seme = (seme + 0x6d2b79f5) | 0;
    let t = Math.imul(seme ^ (seme >>> 15), 1 | seme);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Il nome in lettere grandi: il primo font che ci sta nelle colonne disponibili.
export function righeLogo(nome, colonne, fonts = ['ANSI Shadow', 'Small', 'Mini']) {
  for (const font of fonts) {
    try {
      const righe = figlet.textSync(nome, { font }).split('\n').filter((l) => l.trim());
      if (Math.max(...righe.map((l) => l.length)) <= colonne) return righe;
    } catch { /* font non disponibile */ }
  }
  return [nome];
}
