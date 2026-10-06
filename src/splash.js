import figlet from 'figlet';

const out = process.stdout;
const dorme = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- colori e utilità condivise (le usa anche l'interfaccia) ----------

export const hex = (h) => {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export const rgbHex = (rgb) => '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');

export function campiona(stops, t) {
  t = ((t % 1) + 1) % 1;
  const pos = t * stops.length;
  const i = Math.floor(pos);
  const f = pos - i;
  const a = stops[i % stops.length];
  const b = stops[(i + 1) % stops.length];
  return a.map((v, k) => Math.round(v + (b[k] - v) * f));
}

export function righeLogo(nome, colonne, fonts = ['ANSI Shadow', 'Small', 'Mini']) {
  for (const font of fonts) {
    try {
      const righe = figlet.textSync(nome, { font }).split('\n').filter((l) => l.trim());
      if (Math.max(...righe.map((l) => l.length)) <= colonne - 2) return righe;
    } catch { /* font non disponibile */ }
  }
  return [nome];
}

const lim = (x) => Math.max(0, Math.min(1, x));
const fase = (t, a, b) => lim((t - a) / (b - a));
const morbido = (x) => { x = lim(x); return x * x * (3 - 2 * x); };
const mescola = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * lim(t)));

function caso(x, y) {
  let h = Math.imul(x ^ 0x5bd1e995, 374761393) ^ Math.imul(y + 0x27d4eb2f, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function generatore(seme) {
  return () => {
    seme = (seme + 0x6d2b79f5) | 0;
    let t = Math.imul(seme ^ (seme >>> 15), 1 | seme);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- tela: un fotogramma intero, scritto in un colpo solo ----------

class Tela {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.car = new Array(w * h);
    this.col = new Array(w * h);
  }
  pulisci() {
    this.car.fill(' ');
    this.col.fill(null);
  }
  metti(x, y, c, rgb) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.car[y * this.w + x] = c;
    this.col[y * this.w + x] = rgb;
  }
  testo(x, y, s, colore) {
    [...s].forEach((c, i) => c !== ' ' && this.metti(x + i, y, c, typeof colore === 'function' ? colore(i) : colore));
  }
  stringa() {
    let s = '';
    let ultimo = '';
    for (let y = 0; y < this.h; y++) {
      s += `\x1b[${y + 1};1H`;
      let fine = this.w - 1;
      while (fine >= 0 && this.car[y * this.w + fine] === ' ') fine--;
      for (let x = 0; x <= fine; x++) {
        const i = y * this.w + x;
        const c = this.car[i];
        if (c === ' ') { s += ' '; continue; }
        const k = (this.col[i] || [200, 200, 200]).join(';');
        if (k !== ultimo) { s += `\x1b[38;2;${k}m`; ultimo = k; }
        s += c;
      }
      s += '\x1b[K';
    }
    return s + '\x1b[0m';
  }
}

// ---------- il teschio (metà sinistra specchiata: simmetrico per costruzione) ----------

const META_TESCHIO = [
  '            #####', '        #########', '      ###########', '    #############',
  '   ##############', '  ###############', '  ###############', '  ###############',
  '  ####EEEEEEE####', '  ###EEEEEEEEE###', '  ###EEEEEEEEE###', '   ###EEEEEEE###N',
  '    ###########NN', '     ###########N', '      ###########', '       ##tTtTtTtT',
  '       ##tTtTtTtT', '        #########', '          #######',
];
const TESCHIO = META_TESCHIO.map((m) => m.padEnd(17) + [...m.padEnd(17)].reverse().join(''));
const TW = 34;
const TH = TESCHIO.length;
// Crepa: dalla sommità verso l'occhio destro, con un ramo.
const CREPE = [
  [[19, 0], [19, 1], [18, 2], [19, 3], [20, 4], [20, 5], [21, 6], [22, 7]],
  [[19, 3], [18, 4], [17, 5], [17, 6]],
];
const OCCHI = [[9, 9.5], [24, 9.5]];

function carattereCrepa(a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (dx === 0) return '│';
  if (dy === 0) return '─';
  return dx * dy > 0 ? '╲' : '╱';
}

// distanza (in "celle tonde") dal centro dell'occhio più vicino
const distOcchio = (x, y) => Math.min(...OCCHI.map(([ox, oy]) => Math.hypot((x - ox) / 2, y - oy)));

// ---------- il cervello a circuiti, generato a ogni avvio: mai uguale ----------

function creaCervello(cx, cy, casuale) {
  const celle = new Map();
  const dentro = (x, y) => {
    if (x === cx && y < cy + 3) return false; // la scissura tra i due emisferi
    return [cx - 7.5, cx + 7.5].some((lx) => ((x - lx) / 7.4) ** 2 + ((y - cy) / 4.3) ** 2 <= 1);
  };
  for (let y = cy - 5; y <= cy + 5; y++) {
    for (let x = cx - 16; x <= cx + 16; x++) {
      if (!dentro(x, y)) continue;
      const bordo = !dentro(x + 1, y) || !dentro(x - 1, y) || !dentro(x, y + 1) || !dentro(x, y - 1);
      if (bordo) celle.set(`${x},${y}`, { x, y, tipo: 'bordo', ang: Math.atan2(y - cy, (x - cx) / 2) });
    }
  }
  // nodi su una griglia interna, collegati da piste
  const nodi = [];
  for (let y = cy - 3; y <= cy + 3; y += 2) {
    for (let x = cx - 13; x <= cx + 13; x += 4) {
      if (dentro(x, y) && !celle.has(`${x},${y}`)) nodi.push({ x, y });
    }
  }
  const piste = [];
  const trova = (x, y) => nodi.find((n) => n.x === x && n.y === y);
  for (const n of nodi) {
    for (const [dx, dy, p] of [[4, 0, 0.7], [0, 2, 0.55]]) {
      const m = trova(n.x + dx, n.y + dy);
      if (!m || casuale() > p) continue;
      const passi = [];
      for (let k = 1; k < (dx || dy); k++) passi.push({ x: n.x + (dx ? k : 0), y: n.y + (dy ? k : 0), c: dx ? '─' : '│' });
      if (passi.every((q) => dentro(q.x, q.y) && !celle.has(`${q.x},${q.y}`))) piste.push(passi);
    }
  }
  return { bordo: [...celle.values()], nodi, piste };
}

// ---------- la rete esterna: collegamenti che portano dati verso il centro ----------

function creaRete(W, Hutile, sx, sy, casuale) {
  const rete = [];
  const sinistra = sx - 3;
  const destra = sx + TW + 2;
  const quanti = Math.min(18, Math.floor(Hutile / 2));
  for (let i = 0; i < quanti; i++) {
    const lato = i % 2 ? 1 : -1;
    const limite = lato < 0 ? sinistra - 4 : W - destra - 4;
    if (limite < 4) continue;
    const nx = lato < 0 ? Math.floor(casuale() * limite) : destra + 4 + Math.floor(casuale() * limite);
    const ny = Math.floor(casuale() * Hutile);
    const arrivoX = lato < 0 ? sinistra : destra;
    const arrivoY = sy + 2 + Math.floor(casuale() * (TH - 6));
    const passi = [];
    let x = nx;
    let y = ny;
    passi.push([x, y]);
    while (x !== arrivoX) { x += Math.sign(arrivoX - x); passi.push([x, y]); }
    while (y !== arrivoY) { y += Math.sign(arrivoY - y); passi.push([x, y]); }
    const celle = passi.map((p, k) => {
      if (k === 0) return { x: p[0], y: p[1], c: '◉' };
      if (k === passi.length - 1) return { x: p[0], y: p[1], c: '◆' };
      const prima = passi[k - 1];
      const dopo = passi[k + 1];
      const lati = new Set();
      for (const q of [prima, dopo]) {
        if (q[0] < p[0]) lati.add('S'); else if (q[0] > p[0]) lati.add('D');
        else if (q[1] < p[1]) lati.add('A'); else lati.add('B');
      }
      const k2 = [...lati].sort().join('');
      const mappa = { DS: '─', AB: '│', BS: '┐', AS: '┘', BD: '┌', AD: '└' };
      return { x: p[0], y: p[1], c: mappa[k2] || '─' };
    });
    rete.push({ celle, inizio: casuale() * 1.1, velocita: 18 + casuale() * 22, sfasa: casuale() * 40 });
  }
  return rete;
}

// ---------- la regia ----------

const DURATA = 9.2;

export async function splash(brand) {
  if (!out.isTTY) return;
  const W = Math.max(20, (out.columns || 80) - 1);
  const H = Math.max(10, (out.rows || 24) - 1);
  const stops = brand.colori.map(hex);
  const [VIOLA, ROSA, CIANO] = [stops[0], stops[1] || stops[0], stops[stops.length - 1]];

  if (W < 40 || H < 22) return splashSemplice(brand);

  const completo = H >= 30;
  const logo = completo ? righeLogo(brand.nome.toUpperCase(), W, ['ANSI Shadow', 'Small']) : [brand.nome.toUpperCase().split('').join(' ')];
  const LW = Math.max(...logo.map((l) => l.length));
  const altezzaTotale = TH + 1 + logo.length + (completo ? 5 : 3);
  const sy = Math.max(1, Math.floor((H - altezzaTotale) / 2));
  const sx = Math.floor((W - TW) / 2);
  const ly = sy + TH + 1;
  const lx = Math.floor((W - LW) / 2);
  const tagY = ly + logo.length + 1;
  const firmaY = completo ? tagY + 2 : ly + logo.length + 1;

  const casuale = generatore((Date.now() & 0xffff) + 1);
  const cervello = creaCervello(sx + 17, sy + 4, casuale);
  const rete = creaRete(W, ly - 1, sx, sy, casuale);
  const impulsiCervello = cervello.piste.map(() => ({ sfasa: casuale() * 10, vel: 6 + casuale() * 8 }));
  const tela = new Tela(W, H);

  // vicinanza agli occhi: serve per la luce che "sborda" sull'osso
  const vicino = TESCHIO.map((r, y) => [...r].map((_, x) => distOcchio(x, y)));

  let salta = false;
  const stdin = process.stdin;
  const tasto = (d) => {
    if (d[0] === 3) { out.write('\x1b[0m\x1b[?25h\x1b[?1049l'); process.exit(0); }
    salta = true;
  };
  if (stdin.isTTY) {
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', tasto);
  }

  out.write('\x1b[?1049h\x1b[2J\x1b[H\x1b[?25l');
  const t0 = Date.now();
  let fotogramma = 0;

  while (!salta) {
    const t = (Date.now() - t0) / 1000;
    if (t > DURATA) break;
    fotogramma++;
    tela.pulisci();

    // scossa quando la crepa si apre del tutto
    const scossa = t > 4.5 && t < 4.8 ? (fotogramma % 2 ? 1 : -1) : 0;
    const X = sx + scossa;

    // ATTO 1 — la rete: piste che si disegnano dai bordi verso il centro, impulsi di dati
    const spegniRete = completo ? 1 : 1 - fase(t, 7.5, 8.5) * 0.6;
    for (const p of rete) {
      const visibili = Math.floor(p.celle.length * morbido(fase(t, p.inizio, p.inizio + 1.2)));
      const testa = t > p.inizio + 0.9 ? ((t - p.inizio) * p.velocita + p.sfasa) % (p.celle.length + 8) : -99;
      for (let k = 0; k < visibili; k++) {
        const c = p.celle[k];
        let colore = c.c === '◉' ? VIOLA : c.c === '◆' ? (k < visibili ? ROSA : VIOLA) : [64, 34, 104];
        const d = testa - k;
        if (d >= 0 && d < 4) colore = mescola([235, 255, 255], CIANO, d / 2).map((v) => Math.round(v * (1 - d * 0.12)));
        tela.metti(c.x, c.y, c.c, colore.map((v) => Math.round(v * spegniRete)));
      }
    }

    // ATTO 2 — il cervello: il contorno si traccia girando, i circuiti si accendono
    const svanisceCervello = 1 - fase(t, 2.6, 3.6);
    if (t > 0.8 && svanisceCervello > 0) {
      const giro = morbido(fase(t, 0.8, 2.0)) * Math.PI * 2 - Math.PI;
      for (const c of cervello.bordo) {
        if (c.ang > giro) continue;
        const col = campiona([VIOLA, ROSA], (c.ang + Math.PI) / (Math.PI * 2) + t * 0.2);
        tela.metti(c.x + scossa, c.y, '▓', col);
      }
      const accendi = fase(t, 1.5, 2.3);
      cervello.piste.forEach((pista, i) => {
        if (caso(i, 3) > accendi) return;
        const imp = impulsiCervello[i];
        const pos = ((t * imp.vel + imp.sfasa) % (pista.length + 6));
        pista.forEach((q, k) => {
          const vivo = Math.abs(pos - k) < 1.2;
          tela.metti(q.x + scossa, q.y, q.c, vivo ? [230, 255, 255] : mescola([20, 80, 100], CIANO, 0.35));
        });
      });
      for (const n of cervello.nodi) {
        if (caso(n.x, n.y) > accendi) continue;
        const pulsa = 0.6 + 0.4 * Math.sin(t * 6 + n.x);
        tela.metti(n.x + scossa, n.y, '●', mescola(VIOLA, CIANO, pulsa));
      }
    }

    // ATTO 3 — il teschio si forma sopra il cervello
    const forma = fase(t, 2.4, 3.5);
    const occhi = morbido(fase(t, 4.9, 5.8));
    const tremolio = t < 5.8 && caso(fotogramma, 7) < 0.3 ? 0.15 : 1;
    const luce = t >= 5.8 ? 0.88 + 0.12 * Math.sin(t * 5) : occhi * tremolio;
    if (forma > 0) {
      for (let y = 0; y < TH; y++) {
        for (let x = 0; x < TW; x++) {
          const m = TESCHIO[y][x];
          if (m === ' ' || m === 'N') continue;
          if (caso(x * 7, y * 13) > forma * 1.1) continue;
          if (m === 'E') {
            const d = vicino[y][x];
            const forza = luce * lim(1.15 - d / 3.3);
            if (forza < 0.06) continue;
            const ch = forza > 0.72 ? '█' : forza > 0.45 ? '▓' : forza > 0.22 ? '▒' : '░';
            const col = forza > 0.8 ? mescola(CIANO, [255, 255, 255], (forza - 0.8) * 4) : mescola(ROSA, CIANO, forza * 1.3);
            tela.metti(X + x, sy + y, ch, col);
            continue;
          }
          if (m === 't') { tela.metti(X + x, sy + y, '│', [70, 70, 84]); continue; }
          const bordo = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
            const r = TESCHIO[y + dy];
            return !r || r[x + dx] === undefined || r[x + dx] === ' ';
          });
          const g = Math.round((236 - y * 3.8) * (0.35 + 0.65 * morbido(forma)));
          let col = bordo ? [g - 60, g - 60, g - 45] : [g, g, g + 10];
          const bagliore = luce * lim(1 - (vicino[y][x] - 2.2) / 2.2) * 0.55;
          if (bagliore > 0) col = mescola(col, CIANO, bagliore);
          tela.metti(X + x, sy + y, bordo ? '▓' : '█', col);
        }
      }
    }

    // ATTO 3b — la crepa
    const crepa = fase(t, 3.7, 4.6);
    if (crepa > 0) {
      CREPE.forEach((cammino, j) => {
        const lunghezza = Math.floor((cammino.length - 1) * morbido(j === 0 ? crepa : fase(t, 4.0, 4.7))) + 1;
        for (let k = 0; k < lunghezza; k++) {
          const a = cammino[k];
          const b = cammino[k + 1] || cammino[k];
          const ch = carattereCrepa(k + 1 < cammino.length ? a : cammino[k - 1], k + 1 < cammino.length ? b : a);
          const pulsa = 0.5 + 0.5 * Math.sin(t * 9 + k);
          const col = t > 5.0 ? mescola(ROSA, CIANO, luce * pulsa) : mescola([255, 90, 220], ROSA, pulsa);
          tela.metti(X + a[0], sy + a[1], ch, col);
        }
      });
    }

    // ATTO 4 — il nome, la frase, la dedica al creatore
    const rivela = fase(t, 5.6, 6.7);
    if (rivela > 0) {
      logo.forEach((riga, y) => {
        for (let x = 0; x < riga.length; x++) {
          const c = riga[x];
          if (c === ' ' || x / LW > rivela) continue;
          tela.metti(lx + x, ly + y, c, campiona(stops, (x / LW) * 0.8 - t * 0.35 + y * 0.04));
        }
      });
    }
    if (completo) {
      const tag = brand.tagline || '';
      const n = Math.floor(tag.length * fase(t, 6.6, 7.3));
      tela.testo(Math.floor((W - tag.length) / 2), tagY, tag.slice(0, n), CIANO);
    }
    const riga1 = '◆  ideato e forgiato da  G A S T Y  ◆';
    const riga2 = 'architetto di intelligenze · costruttore di mondi';
    const n1 = Math.floor(riga1.length * fase(t, 7.2, 7.9));
    const inizioNome = riga1.indexOf('G');
    tela.testo(Math.floor((W - riga1.length) / 2), firmaY, riga1.slice(0, n1), (i) =>
      i >= inizioNome && i < inizioNome + 9 ? campiona(stops, i / 9 - t * 0.5) : [150, 150, 170]
    );
    if (completo || firmaY + 1 < H) {
      const n2 = Math.floor(riga2.length * fase(t, 7.8, 8.5));
      tela.testo(Math.floor((W - riga2.length) / 2), firmaY + 1, riga2.slice(0, n2), [105, 105, 125]);
    }

    if (t < 7.5) tela.testo(W - 26, 0, 'un tasto qualsiasi: salta', [70, 70, 85]);

    out.write(tela.stringa());
    await dorme(40);
  }

  if (stdin.isTTY) {
    stdin.off('data', tasto);
    stdin.setRawMode(false);
    stdin.pause();
  }
}

// ---------- versione corta per schermi piccoli (telefono) ----------

async function splashSemplice(brand) {
  const colonne = out.columns || 80;
  const righeTerm = out.rows || 24;
  const stops = brand.colori.map(hex);
  const righe = righeLogo(brand.nome.toUpperCase(), colonne);
  const larg = Math.max(...righe.map((l) => l.length));
  const margine = ' '.repeat(Math.max(0, Math.floor((colonne - larg) / 2)));
  const alto = Math.max(0, Math.floor((righeTerm - righe.length - 5) / 2));
  const fg = ([r, g, b]) => `\x1b[38;2;${r};${g};${b}m`;
  out.write('\x1b[?1049h\x1b[2J\x1b[H\x1b[?25l');
  for (let f = 0; f < 42; f++) {
    const fase2 = (f / 42) * 1.5;
    let buf = `\x1b[${alto + 1};1H`;
    righe.forEach((riga, y) => {
      let s = margine;
      for (let x = 0; x < riga.length; x++) {
        const ch = x / larg > Math.min(1, f / 14) ? ' ' : riga[x];
        s += ch === ' ' ? ' ' : fg(campiona(stops, (x / larg) * 0.8 - fase2 + y * 0.04)) + ch;
      }
      buf += s + '\x1b[0m\x1b[K\n';
    });
    out.write(buf);
    await dorme(35);
  }
  const firma = 'ideato e forgiato da GASTY';
  out.write(`\x1b[${alto + righe.length + 2};1H${' '.repeat(Math.max(0, Math.floor((colonne - firma.length) / 2)))}${fg(stops[stops.length - 1])}${firma}\x1b[0m`);
  await dorme(900);
}
