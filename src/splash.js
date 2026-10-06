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
      if (Math.max(...righe.map((l) => l.length)) <= colonne) return righe;
    } catch { /* font non disponibile */ }
  }
  return [nome];
}

const lim = (x) => Math.max(0, Math.min(1, x));
const fase = (t, a, b) => lim((t - a) / (b - a));
const morbido = (x) => { x = lim(x); return x * x * (3 - 2 * x); };
const mescola = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * lim(t)));
const scala = (c, k) => c.map((v) => Math.round(v * k));

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
  libero(x, y) {
    x = Math.round(x);
    y = Math.round(y);
    return x >= 0 && y >= 0 && x < this.w && y < this.h && this.car[y * this.w + x] === ' ';
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
const CREPE = [
  [[19, 0], [19, 1], [18, 2], [19, 3], [20, 4], [20, 5], [21, 6], [22, 7]],
  [[19, 3], [18, 4], [17, 5], [17, 6]],
];
const OCCHI = [[9, 9.5], [24, 9.5]];
const maschera = (x, y) => (TESCHIO[y] && TESCHIO[y][x]) || ' ';
const distOcchio = (x, y) => Math.min(...OCCHI.map(([ox, oy]) => Math.hypot((x - ox) / 2, y - oy)));

function carattereCrepa(a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (dx === 0) return '│';
  if (dy === 0) return '─';
  return dx * dy > 0 ? '╲' : '╱';
}
// Celle di una crepa in scala: una diagonale "spessa" resta una diagonale.
function celleCrepa(x, y, ch, s) {
  if (s === 1) return [[x, y, ch]];
  const out = [];
  for (let k = 0; k < s; k++) {
    if (ch === '│') out.push([x * s + Math.floor(s / 2), y * s + k, '│']);
    else if (ch === '╱') out.push([x * s + s - 1 - k, y * s + k, '╱']);
    else if (ch === '╲') out.push([x * s + k, y * s + k, '╲']);
    else out.push([x * s + k, y * s + Math.floor(s / 2), '─']);
  }
  return out;
}

// ---------- il cervello a circuiti, generato a ogni avvio: mai uguale ----------

function creaCervello(cx, cy, s, casuale) {
  const rx = 7.4 * s;
  const ry = 4.3 * s;
  const dentro = (x, y) => {
    if (Math.abs(x - cx) < s * 0.6 && y < cy + 3 * s) return false;
    return [cx - 7.5 * s, cx + 7.5 * s].some((lx) => ((x - lx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1);
  };
  const bordo = [];
  const occupate = new Set();
  for (let y = cy - ry - 1; y <= cy + ry + 1; y++) {
    for (let x = cx - 16 * s; x <= cx + 16 * s; x++) {
      if (!dentro(x, y)) continue;
      if (!dentro(x + 1, y) || !dentro(x - 1, y) || !dentro(x, y + 1) || !dentro(x, y - 1)) {
        bordo.push({ x, y, ang: Math.atan2(y - cy, (x - cx) / 2) });
        occupate.add(`${x},${y}`);
      }
    }
  }
  const nodi = [];
  for (let y = cy - 3 * s; y <= cy + 3 * s; y += 2 * s) {
    for (let x = cx - 13 * s; x <= cx + 13 * s; x += 4 * s) {
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
  return { bordo, nodi, piste };
}

// ---------- la rete esterna: collegamenti che portano dati verso il centro ----------

function creaRete({ W, zone, sx, sy, s, casuale }) {
  const rete = [];
  const sinistra = sx - 3;
  const destra = sx + TW * s + 2;
  let i = 0;
  for (const z of zone) {
    const quanti = Math.max(0, Math.min(14, Math.floor((z.x1 - z.x0) / 9)));
    for (let k = 0; k < quanti; k++, i++) {
      const nx = z.x0 + Math.floor(casuale() * (z.x1 - z.x0));
      const ny = z.y0 + Math.floor(casuale() * (z.y1 - z.y0));
      const arrivoX = nx < sx ? sinistra : destra;
      let arrivoY = sy + 2 * s + Math.floor(casuale() * (TH - 6) * s);
      const passi = [[nx, ny]];
      let x = nx;
      let y = ny;
      if (z.corridoi) {
        // c'è del testo in mezzo: salgo o scendo fino a una riga libera, poi vado dritto al teschio
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

// ---------- la regia ----------

const DURATA = 10.4;
const T = {
  rete: [0.0, 1.4], cervello: [0.7, 2.2], circuiti: [1.4, 2.4],
  teschio: [2.5, 3.7], svanisce: [2.9, 3.9], crepa: [3.9, 4.9], ramo: [4.2, 5.0],
  scossa: [4.75, 5.05], occhi: [5.1, 6.1], scintille: 5.7,
  nome: [5.9, 7.0], frase: [6.9, 7.5], ideato: [7.4, 7.9], gasty: [7.8, 8.9], elogio: [8.8, 9.6],
};

export async function splash(brand) {
  if (!out.isTTY) return;
  const W = Math.max(20, (out.columns || 80) - 1);
  const H = Math.max(10, (out.rows || 24) - 1);
  const stops = brand.colori.map(hex);
  const [VIOLA, ROSA, CIANO] = [stops[0], stops[1] || stops[0], stops[stops.length - 1]];
  const BIANCO = [240, 250, 255];

  if (W < 40 || H < 22) return splashSemplice(brand);

  // ---- impaginazione: scala del teschio e posizione del blocco testo ----
  const nomeGrande = righeLogo(brand.nome.toUpperCase(), 999, ['ANSI Shadow']);
  const gastyGrande = righeLogo('GASTY', 999, ['ANSI Shadow']);
  const LW = Math.max(...nomeGrande.map((l) => l.length));
  const GW = Math.max(...gastyGrande.map((l) => l.length));
  const tag = brand.tagline || '';
  const IDEATO = 'I D E A T O   E   F O R G I A T O   D A';
  const ELOGIO = 'architetto di intelligenze  ·  costruttore di mondi';
  const TB = Math.max(LW, GW, IDEATO.length, ELOGIO.length, tag.length);

  let s = 1;
  let lato = false; // testo accanto al teschio (schermo intero) oppure sotto
  for (const k of [3, 2]) {
    if (TH * k + 2 <= H && TW * k + 8 + TB + 4 <= W) { s = k; lato = true; break; }
  }
  const completo = !lato && H >= 30 && W >= Math.max(LW, GW) + 4;
  const nome = lato || completo ? nomeGrande : [brand.nome.toUpperCase().split('').join(' ')];
  const gasty = lato || completo ? gastyGrande : ['G A S T Y'];

  let sx, sy, tx, ty, zone;
  if (lato) {
    const blocco = nome.length + 1 + 1 + 1 + gasty.length + 1; // nome, frase, vuoto, ideato, gasty, elogio
    const totale = TW * s + 8 + TB;
    sx = Math.floor((W - totale) / 2);
    sy = Math.floor((H - TH * s) / 2);
    tx = sx + TW * s + 8;
    ty = sy + Math.floor((TH * s - blocco) / 2);
    const corridoi = [];
    if (ty - 2 > sy + 1) corridoi.push([sy + 1, ty - 2]);
    if (sy + TH * s - 2 > ty + blocco + 1) corridoi.push([ty + blocco + 1, sy + TH * s - 2]);
    zone = [
      { x0: 2, x1: Math.max(3, sx - 10), y0: 1, y1: H - 1 },
      { x0: Math.min(W - 3, tx + TB + 6), x1: W - 2, y0: 1, y1: H - 1, corridoi: corridoi.length ? corridoi : null },
    ];
  } else {
    const blocco = TH * s + 1 + nome.length + (completo ? 1 + 1 + 1 + gasty.length + 1 : 2);
    sx = Math.floor((W - TW * s) / 2);
    sy = Math.max(1, Math.floor((H - blocco) / 2));
    tx = 0; // il blocco testo è centrato riga per riga
    ty = sy + TH * s + 1;
    zone = [
      { x0: 2, x1: Math.max(3, sx - 10), y0: 1, y1: ty - 1 },
      { x0: Math.min(W - 3, sx + TW * s + 10), x1: W - 2, y0: 1, y1: ty - 1 },
    ];
  }
  const centra = (len) => (lato ? tx : Math.floor((W - len) / 2));

  const casuale = generatore((Date.now() & 0xffff) + 1);
  const cervello = creaCervello(sx + 17 * s, sy + 4.5 * s, s, casuale);
  const rete = creaRete({ W, zone, sx, sy, s, casuale });
  const impulsi = cervello.piste.map(() => ({ sfasa: casuale() * 10, vel: 6 + casuale() * 8 }));
  const bloccoH = nome.length + 1 + 1 + 1 + gasty.length + 1;
  const nelTesto = (x, y) => (lato ? x >= tx - 1 && x <= tx + TB && y >= ty - 1 && y <= ty + bloccoH : y >= ty - 1);
  const nelTeschio = (x, y) => x >= sx - 2 && x <= sx + TW * s + 1 && y >= sy - 3 && y <= sy + TH * s;
  const stelle = Array.from({ length: Math.floor((W * H) / 110) }, (_, i) => ({
    x: Math.floor(caso(i, 11) * W), y: Math.floor(caso(i, 29) * H), f: caso(i, 53),
  })).filter((st) => !nelTesto(st.x, st.y) && !nelTeschio(st.x, st.y));
  const tela = new Tela(W, H);

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

  while (!salta) {
    const t = (Date.now() - t0) / 1000;
    if (t > DURATA) break;
    fotogramma++;
    tela.pulisci();

    const scossa = t > T.scossa[0] && t < T.scossa[1] ? (fotogramma % 2 ? 1 : -1) : 0;
    const X = sx + scossa;
    const occhi = morbido(fase(t, ...T.occhi));
    const tremolio = t < T.occhi[1] && caso(fotogramma, 7) < 0.3 ? 0.15 : 1;
    const luce = t >= T.occhi[1] ? 0.86 + 0.14 * Math.sin(t * 4.5) : occhi * tremolio;

    // stelle di fondo, che respirano
    for (const st of stelle) {
      const b = 0.25 + 0.75 * Math.abs(Math.sin(t * (0.8 + st.f) + st.f * 9));
      tela.metti(st.x, st.y, b > 0.7 ? '·' : '˙', scala([120, 100, 170], b * 0.6));
    }

    // ATTO 1 — la rete
    for (const p of rete) {
      const visibili = Math.floor(p.celle.length * morbido(fase(t, p.inizio, p.inizio + T.rete[1])));
      const testa = t > p.inizio + 0.8 ? ((t - p.inizio) * p.velocita + p.sfasa) % (p.celle.length + 10) : -99;
      for (let k = 0; k < visibili; k++) {
        const c = p.celle[k];
        let colore = c.c === '◉' ? VIOLA : c.c === '◆' ? ROSA : [66, 36, 108];
        const d = testa - k;
        if (d >= 0 && d < 5) colore = scala(mescola(BIANCO, CIANO, d / 2.5), 1 - d * 0.1);
        tela.metti(c.x, c.y, c.c, colore);
      }
    }

    // ATTO 2 — il cervello
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
        pista.forEach((q, k) => tela.metti(q.x + scossa, q.y, q.c, scala(Math.abs(pos - k) < 1.2 ? BIANCO : mescola([20, 80, 100], CIANO, 0.35), resta)));
      });
      for (const n of cervello.nodi) {
        if (caso(n.x, n.y) > accendi) continue;
        tela.metti(n.x + scossa, n.y, '●', scala(mescola(VIOLA, CIANO, 0.6 + 0.4 * Math.sin(t * 6 + n.x)), resta));
      }
    }

    // ATTO 3 — il teschio si forma sopra il cervello
    const forma = fase(t, ...T.teschio);
    if (forma > 0) {
      for (let yy = 0; yy < TH * s; yy++) {
        const y = Math.floor(yy / s);
        for (let xx = 0; xx < TW * s; xx++) {
          const x = Math.floor(xx / s);
          const m = maschera(x, y);
          if (m === ' ' || m === 'N') continue;
          if (caso(xx * 7, yy * 13) > forma * 1.12) continue;
          const fx = xx / s + 0.5 / s;
          const fy = yy / s + 0.5 / s;
          if (m === 'E') {
            const forza = luce * lim(1.18 - distOcchio(fx, fy) / 3.4);
            if (forza < 0.06) continue;
            const ch = forza > 0.72 ? '█' : forza > 0.45 ? '▓' : forza > 0.22 ? '▒' : '░';
            const col = forza > 0.82 ? mescola(CIANO, BIANCO, (forza - 0.82) * 5) : mescola(ROSA, CIANO, forza * 1.3);
            tela.metti(X + xx, sy + yy, ch, col);
            continue;
          }
          if (m === 't') { tela.metti(X + xx, sy + yy, '│', [66, 66, 82]); continue; }
          const bordo = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => maschera(x + dx, y + dy) === ' ');
          const g = Math.round((238 - y * 3.6 - (x / TW) * 18) * (0.3 + 0.7 * morbido(forma)));
          let col = bordo ? [g - 70, g - 70, g - 52] : [g, g, g + 10];
          const bagliore = luce * lim(1 - (distOcchio(fx, fy) - 2.2) / 2.6) * 0.6;
          if (bagliore > 0) col = mescola(col, CIANO, bagliore);
          tela.metti(X + xx, sy + yy, bordo ? '▓' : '█', col);
        }
      }
    }

    // ATTO 3b — la crepa
    if (t > T.crepa[0]) {
      CREPE.forEach((cammino, j) => {
        const quota = morbido(j === 0 ? fase(t, ...T.crepa) : fase(t, ...T.ramo));
        const n = Math.floor((cammino.length - 1) * quota) + 1;
        for (let k = 0; k < n; k++) {
          const a = cammino[k];
          const b = cammino[k + 1] || a;
          const ch = carattereCrepa(cammino[k + 1] ? a : cammino[k - 1], cammino[k + 1] ? b : a);
          const pulsa = 0.5 + 0.5 * Math.sin(t * 9 + k);
          const col = t > T.occhi[0] ? mescola(ROSA, CIANO, luce * pulsa) : mescola([255, 100, 225], ROSA, pulsa);
          for (const [cx, cy, c] of celleCrepa(a[0], a[1], ch, s)) tela.metti(X + cx, sy + cy, c, col);
        }
      });
    }

    // scintille che salgono dalla crepa quando gli occhi sono accesi
    if (t > T.scintille) {
      const topX = X + 19 * s + Math.floor(s / 2);
      const topY = sy - 1;
      for (let k = 0; k < 40; k++) {
        const nascita = T.scintille + k * 0.11;
        const eta = t - nascita;
        if (eta < 0 || eta > 1.1) continue;
        const px = topX + (caso(k, 5) - 0.5) * 7 + Math.sin(eta * 7 + k) * 1.5;
        const py = topY - eta * (6 + caso(k, 9) * 5) * s * 0.6;
        const ch = eta < 0.3 ? '✦' : eta < 0.7 ? '·' : '˙';
        if (tela.libero(px, py)) tela.metti(px, py, ch, scala(mescola(CIANO, ROSA, eta), 1 - eta * 0.7));
      }
    }

    // ATTO 4 — il nome, la frase, la dedica
    const rivela = fase(t, ...T.nome);
    nome.forEach((riga, y) => {
      const x0 = centra(riga.length);
      for (let x = 0; x < riga.length; x++) {
        if (riga[x] === ' ' || rivela <= 0 || x / riga.length >= rivela) continue;
        tela.metti(x0 + x, ty + y, riga[x], campiona(stops, (x / riga.length) * 0.8 - t * 0.35 + y * 0.04));
      }
    });
    let riga = ty + nome.length;
    if (lato || completo) {
      const n = Math.floor(tag.length * fase(t, ...T.frase));
      tela.testo(centra(tag.length), riga, tag.slice(0, n), CIANO);
      riga += 2;
      const n2 = Math.floor(IDEATO.length * fase(t, ...T.ideato));
      tela.testo(centra(IDEATO.length), riga, IDEATO.slice(0, n2), [185, 185, 205]);
      riga += 1;
      const rg = fase(t, ...T.gasty);
      gasty.forEach((r, y) => {
        const x0 = centra(r.length);
        for (let x = 0; x < r.length; x++) {
          if (r[x] === ' ' || rg <= 0 || x / r.length >= rg) continue;
          tela.metti(x0 + x, riga + y, r[x], campiona(stops, 0.5 + (x / r.length) * 0.8 - t * 0.5 + y * 0.05));
        }
      });
      riga += gasty.length;
      const n3 = Math.floor(ELOGIO.length * fase(t, ...T.elogio));
      tela.testo(centra(ELOGIO.length), riga, ELOGIO.slice(0, n3), [150, 150, 175]);
    } else {
      const firma = 'ideato e forgiato da GASTY';
      const n = Math.floor(firma.length * fase(t, ...T.ideato));
      tela.testo(centra(firma.length), riga + 1, firma.slice(0, n), (i) => (i >= 21 ? campiona(stops, i / 6 - t * 0.5) : [170, 170, 190]));
    }

    if (t < 8.5) tela.testo(W - 27, 0, 'un tasto qualsiasi: salta', [75, 75, 92]);

    out.write(tela.stringa());
    await dorme(38);
  }

  if (stdin.isTTY) { stdin.off('data', tasto); stdin.setRawMode(false); stdin.pause(); }
}

// ---------- versione corta per schermi piccoli (telefono) ----------

async function splashSemplice(brand) {
  const colonne = out.columns || 80;
  const righeTerm = out.rows || 24;
  const stops = brand.colori.map(hex);
  const righe = righeLogo(brand.nome.toUpperCase(), colonne - 2);
  const larg = Math.max(...righe.map((l) => l.length));
  const margine = ' '.repeat(Math.max(0, Math.floor((colonne - larg) / 2)));
  const alto = Math.max(0, Math.floor((righeTerm - righe.length - 5) / 2));
  const fg = ([r, g, b]) => `\x1b[38;2;${r};${g};${b}m`;
  out.write('\x1b]0;KORTEX\x07\x1b[?1049h\x1b[2J\x1b[H\x1b[?25l');
  for (let f = 0; f < 42; f++) {
    let buf = `\x1b[${alto + 1};1H`;
    righe.forEach((r, y) => {
      let s = margine;
      for (let x = 0; x < r.length; x++) {
        const ch = x / larg > Math.min(1, f / 14) ? ' ' : r[x];
        s += ch === ' ' ? ' ' : fg(campiona(stops, (x / larg) * 0.8 - (f / 42) * 1.5 + y * 0.04)) + ch;
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
