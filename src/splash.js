import figlet from 'figlet';

const out = process.stdout;
const dorme = (ms) => new Promise((r) => setTimeout(r, ms));

export const hex = (h) => {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export const rgbHex = (rgb) => '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');

// Campiona un gradiente ciclico a più colori: t in [0,1) si ripete.
export function campiona(stops, t) {
  t = ((t % 1) + 1) % 1;
  const pos = t * stops.length;
  const i = Math.floor(pos);
  const f = pos - i;
  const a = stops[i % stops.length];
  const b = stops[(i + 1) % stops.length];
  return a.map((v, k) => Math.round(v + (b[k] - v) * f));
}

const fg = ([r, g, b]) => `\x1b[38;2;${r};${g};${b}m`;

// Sceglie il carattere più grande che entra nella larghezza del terminale.
export function righeLogo(nome, colonne) {
  for (const font of ['ANSI Shadow', 'Small', 'Mini']) {
    try {
      const righe = figlet.textSync(nome, { font }).split('\n').filter((l) => l.trim());
      const larg = Math.max(...righe.map((l) => l.length));
      if (larg <= colonne - 2) return righe;
    } catch { /* font non disponibile: provo il successivo */ }
  }
  return [nome];
}

export async function splash(brand) {
  if (!out.isTTY) return;
  const colonne = out.columns || 80;
  const righeTerm = out.rows || 24;
  const stops = brand.colori.map(hex);
  const righe = righeLogo(brand.nome.toUpperCase(), colonne);
  const larg = Math.max(...righe.map((l) => l.length));
  const margine = ' '.repeat(Math.max(0, Math.floor((colonne - larg) / 2)));
  const alto = Math.max(0, Math.floor((righeTerm - righe.length - 4) / 2));
  const GLITCH = '▓▒░█▚▞';
  const FOTOGRAMMI = 42;

  out.write('\x1b[?1049h\x1b[2J\x1b[H\x1b[?25l');

  for (let f = 0; f < FOTOGRAMMI; f++) {
    const fase = (f / FOTOGRAMMI) * 1.5;
    const glitch = f === 9 || f === 10 || f === 24;
    const rivela = Math.min(1, f / 14);
    let buf = `\x1b[${alto + 1};1H`;
    righe.forEach((riga, y) => {
      let s = margine + (glitch && y % 2 ? ' ' : '');
      for (let x = 0; x < riga.length; x++) {
        let ch = riga[x];
        if (x / larg > rivela) ch = ' ';
        else if (glitch && ch !== ' ' && Math.random() < 0.15) ch = GLITCH[Math.floor(Math.random() * GLITCH.length)];
        s += ch === ' ' ? ' ' : fg(campiona(stops, (x / larg) * 0.8 - fase + y * 0.04)) + ch;
      }
      buf += s + '\x1b[0m\x1b[K\n';
    });
    out.write(buf);
    await dorme(35);
  }

  const tag = brand.tagline || '';
  const margineTag = ' '.repeat(Math.max(0, Math.floor((colonne - tag.length) / 2)));
  const rigaTag = alto + righe.length + 2;
  for (let i = 0; i <= tag.length; i++) {
    out.write(`\x1b[${rigaTag};1H${margineTag}${fg(stops[stops.length - 1])}${tag.slice(0, i)}${i < tag.length ? '▌' : ' '}\x1b[0m`);
    await dorme(18);
  }
  await dorme(400);
}
