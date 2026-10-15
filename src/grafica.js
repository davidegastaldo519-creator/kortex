import React from 'react';
import { Box, Text } from 'ink';
import htm from 'htm';
import { campiona, hex, rgbHex, righeLogo, caso, lim } from './colori.js';
import { disegnaTeschio, PALETTE } from './teschio3d.js';
import { Cliccabile } from './mouse.js';
import { sparkline } from './telemetria.js';

export const html = htm.bind(React.createElement);

export const C = {
  viola: '#9D4EDD', rosa: '#FF2BD6', ciano: '#00F5FF', grigio: '#6B6B80', scuro: '#3A3A4A',
  verde: '#39FF14', rosso: '#FF3860', giallo: '#FFE66D', gesso: '#E8E4D0', lavagna: '#3E6B5A', tema: 'neon',
};
// Ogni IA ha il suo colore, uguale in tutto il programma.
export const COLORE_IA = { claude: '#FF8A3D', codex: '#3DDC97', gemini: '#4D9FFF', ollama: '#C9C9D6', antigravity: '#B48CFF' };
export const SPIN = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏';
export const PAGINE = [['lavoro', 'LAVORO'], ['progetti', 'PROGETTI'], ['database', 'DATABASE'], ['controllo', 'CONTROLLO'], ['studio', 'STUDIO'], ['statistiche', 'STATISTICHE'], ['guida', 'GUIDA']];

export const lim01 = (x) => Math.max(0, Math.min(1, x || 0));
export const accorcia = (s, n) => (s.length <= n ? s : '…' + s.slice(-Math.max(1, n - 1)));
const mescola = (a, b, t) => rgbHex(campiona([hex(a), hex(b)], lim01(t) * 0.5));
const ora = () => new Date().toTimeString().slice(0, 8);

export function avvolgi(righe, w) {
  const out = [];
  for (const r of righe) {
    if (r.length <= w) out.push(r);
    else for (let i = 0; i < r.length; i += w) out.push(r.slice(i, i + w));
  }
  return out;
}

// Come avvolgi, ma va a capo tra le parole; le righe che iniziano con "• " continuano rientrate.
export function avvolgiParole(righe, w) {
  const out = [];
  for (const r of righe) {
    const rientro = /^\s*[•·-] /.test(r) ? ' '.repeat(r.indexOf(' ', r.search(/\S/)) + 1) : '';
    let resto = r;
    let primo = true;
    while (resto.length > (primo ? w : w - rientro.length)) {
      const lim = primo ? w : w - rientro.length;
      let taglio = resto.lastIndexOf(' ', lim);
      if (taglio < lim * 0.4) taglio = lim;
      out.push((primo ? '' : rientro) + resto.slice(0, taglio).trimEnd());
      resto = resto.slice(taglio).trimStart();
      primo = false;
    }
    out.push((primo ? '' : rientro) + resto);
  }
  return out;
}

export function Gradiente({ testo, colori, fase = 0, bold = true, passo = 1 }) {
  const stops = colori.map(hex);
  const car = [...testo];
  const n = Math.max(1, car.length);
  const pezzi = [];
  for (let i = 0; i < car.length; i += passo) pezzi.push([i, car.slice(i, i + passo).join('')]);
  return html`<${Text} bold=${bold}>${pezzi.map(
    ([i, s]) => html`<${Text} key=${i} color=${rgbHex(campiona(stops, (i / n) * 0.9 - fase))}>${s}<//>`
  )}<//>`;
}

// ---------- il pannello: cornice, titolo con la "linguetta", nota ed etichetta tecnica a destra ----------

export function Pannello({ titolo, nota, etichetta, colore = C.viola, coloreTitolo = C.ciano, children, ...resto }) {
  return html`<${Box} flexDirection="column" borderStyle="round" borderColor=${colore} paddingX=${1} overflow="hidden" ...${resto}>
    <${Box} height=${1}>
      <${Text} wrap="truncate-end"><${Text} color=${coloreTitolo} bold>▌${titolo}<//>${nota ? html`<${Text} color=${C.grigio}>  ${nota}<//>` : null}<//>
      ${etichetta ? html`<${Box} flexGrow=${1} justifyContent="flex-end"><${Text} color=${C.scuro} wrap="truncate-end"> ${etichetta}<//><//>` : null}
    <//>
    ${children}
  <//>`;
}

export function Barra({ valore, larghezza, colore = C.ciano }) {
  const pieni = Math.round(lim01(valore) * larghezza);
  return html`<${Text}><${Text} color=${colore}>${'█'.repeat(pieni)}<//><${Text} color=${C.scuro}>${'░'.repeat(Math.max(0, larghezza - pieni))}<//><//>`;
}

// ---------- i neuroni: la rete che pulsa negli spazi vuoti dei pannelli ----------

const retiNeuroni = new Map();
function reteNeuroni(w, h) {
  const chiave = `${w}x${h}`;
  if (retiNeuroni.has(chiave)) return retiNeuroni.get(chiave);
  const n = Math.max(3, Math.floor((w * h) / 170));
  const nodi = Array.from({ length: n }, (_, i) => ({ x: Math.floor(caso(i, w) * w), y: Math.floor(caso(i, h + 3) * h), f: caso(i, 99) }));
  const archi = [];
  nodi.forEach((a, i) => {
    const vicini = nodi.map((b, j) => ({ j, d: Math.hypot((b.x - a.x) / 2, b.y - a.y) })).filter((v) => v.j !== i).sort((p, q) => p.d - q.d).slice(0, caso(i, 5) < 0.35 ? 2 : 1);
    for (const v of vicini) if (!archi.some((e) => (e[0] === v.j && e[1] === i) || (e[0] === i && e[1] === v.j))) archi.push([i, v.j, caso(i, v.j)]);
  });
  const celle = new Map();
  for (const [i, j] of archi) {
    const a = nodi[i], b = nodi[j];
    const passi = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y), 1);
    for (let k = 1; k < passi; k++) {
      const x = Math.round(a.x + ((b.x - a.x) * k) / passi), y = Math.round(a.y + ((b.y - a.y) * k) / passi);
      const dx = b.x - a.x, dy = b.y - a.y;
      const ch = Math.abs(dx) > Math.abs(dy) * 2.5 ? '─' : Math.abs(dy) > Math.abs(dx) ? '│' : dx * dy > 0 ? '╲' : '╱';
      celle.set(`${x},${y}`, { ch, arco: archi.indexOf(archi.find((e) => e[0] === i && e[1] === j)), k: k / passi });
    }
  }
  const rete = { nodi, archi, celle };
  retiNeuroni.set(chiave, rete);
  return rete;
}

// In grafica leggera i neuroni stanno fermi e spenti: resta solo la scritta.
export const GRAFICA = { leggera: false };

export function Neuroni({ w, h, tick, testo, colore = C.viola }) {
  w = Math.max(6, w); h = Math.max(2, h);
  if (GRAFICA.leggera) return html`<${Box} flexDirection="column" height=${h} overflow="hidden"><${Text}> <//><${Text} color=${C.grigio} wrap="truncate-end">${testo ? ' '.repeat(Math.max(0, Math.floor((w - testo.length) / 2))) + testo : ''}<//><//>`;
  const rete = reteNeuroni(w, h);
  const base = hex(colore);
  const righe = [];
  const riga = Math.floor(h / 2);
  const x0 = testo ? Math.max(0, Math.floor((w - testo.length) / 2)) : -1;
  for (let y = 0; y < h; y++) {
    const pezzi = [];
    let corrente = null;
    const chiudi = () => { if (corrente) pezzi.push(html`<${Text} key=${pezzi.length} color=${corrente.col}>${corrente.s}<//>`); corrente = null; };
    for (let x = 0; x < w; x++) {
      let ch = ' ', col = null;
      if (testo && y === riga && x >= x0 && x < x0 + testo.length) { ch = testo[x - x0]; col = C.grigio; }
      else {
        const nodo = rete.nodi.find((n) => n.x === x && n.y === y);
        if (nodo) {
          const b = 0.35 + 0.65 * Math.abs(Math.sin(tick * 0.12 + nodo.f * 9));
          ch = b > 0.8 ? '●' : '○';
          col = rgbHex(base.map((v) => v * (0.25 + 0.55 * b)));
        } else {
          const c = rete.celle.get(`${x},${y}`);
          if (c) {
            const impulso = Math.abs(((tick * 0.05 + rete.archi[c.arco][2] * 3) % 1) - c.k) < 0.08;
            ch = c.ch;
            col = impulso ? C.ciano : rgbHex(base.map((v) => v * 0.22));
          }
        }
      }
      if (corrente && corrente.col === col) corrente.s += ch;
      else { chiudi(); corrente = { col, s: ch }; }
    }
    chiudi();
    righe.push(html`<${Text} key=${y}>${pezzi}<//>`);
  }
  return html`<${Box} flexDirection="column" height=${h} overflow="hidden">${righe}<//>`;
}

// ---------- il cervello animato di ogni IA ----------
// Due righe, cinque colonne: due emisferi e la scissura in mezzo.
const CERVELLO = ['▄▀█▀▄', '▀▄█▄▀'];

export function Cervello({ id, stato, tick, compatto = false }) {
  // stato: 'pensa' | 'pronto' | 'limite' | 'assente'
  const base = COLORE_IA[id] || C.viola;
  const righe = CERVELLO.map((riga, y) => [...riga].map((ch, x) => {
    let col;
    if (stato === 'assente') col = C.scuro;
    else if (stato === 'limite') col = (tick + x) % 6 < 3 ? C.rosso : '#7A1F30';
    else if (stato === 'pensa') col = rgbHex(campiona([hex(base), hex(C.rosa), hex(C.ciano), [255, 255, 255]], tick * 0.08 + x * 0.12 + y * 0.2));
    else col = mescola(base, '#1A1A24', 0.25 + 0.25 * Math.sin(tick * 0.15));
    return html`<${Text} key=${x} color=${col}>${ch}<//>`;
  }));
  if (compatto) return html`<${Text}>${righe[0]}<//>`;
  return html`<${Box} flexDirection="column" marginRight=${1}>
    <${Text}>${righe[0]}<//>
    <${Text}>${righe[1]}<//>
  <//>`;
}

export function statoCervello(d, tel) {
  if (!d.ok) return 'assente';
  if (d.limitato) return 'limite';
  if (tel?.ia?.[d.id]?.attivo) return 'pensa';
  return 'pronto';
}

// ---------- il teschio dell'intestazione: in 3D, gli occhi seguono l'IA che pensa ----------

// Quando chiude gli occhi: un battito di ciglia ogni tanto, uno doppio quando finisce un lavoro.
function palpebra(tick, lampeggio) {
  if (lampeggio && Date.now() - lampeggio < 700) return Math.floor((Date.now() - lampeggio) / 175) % 2 === 0 ? 0 : 1;
  return tick % 53 === 0 || tick % 53 === 1 ? 0 : 1;
}

export function TeschioGrande({ tick, occupato, sguardo = [0, 0], lampeggio, leggera }) {
  const chiuso = palpebra(tick, lampeggio) === 0;
  if (leggera) return html`<${TeschioFisso} tick=${tick} occupato=${occupato} chiuso=${chiuso} sguardo=${sguardo} />`;
  const luce = chiuso ? 0.05 : occupato ? 0.9 + 0.1 * Math.sin(tick * 0.9) : 0.7 + 0.15 * Math.sin(tick * 0.25);
  const angolo = 0.22 * Math.sin(tick * 0.045) + sguardo[0] * 0.18;
  const d = disegnaTeschio({ w: 15, h: 8, angolo, tilt: 0.06 + 0.03 * Math.sin(tick * 0.07), luce, palette: PALETTE[C.tema] || PALETTE.neon, sguardo, zoom: 0.98 });
  const righe = [];
  for (let y = 0; y < 8; y++) {
    const pezzi = [];
    for (let x = 0; x < 15; x++) {
      const k = y * 15 + x;
      if (d.car[k] === ' ') pezzi.push(html`<${Text} key=${x}> <//>`);
      else pezzi.push(html`<${Text} key=${x} color=${rgbHex(d.fg[k])} backgroundColor=${d.bg[k] ? rgbHex(d.bg[k]) : undefined}>${d.car[k]}<//>`);
    }
    righe.push(html`<${Text} key=${y}>${pezzi}<//>`);
  }
  return html`<${Box} flexDirection="column" marginRight=${2} width=${15}>${righe}<//>`;
}

// La versione leggera: disegnata una volta, solo gli occhi si muovono.
const TESCHIO_FISSO = [
  '    ▄▄▄█▄▄▄    ',
  '  ▄█████████▄  ',
  ' ██████╲██████ ',
  ' ██EEEE█EEEE██ ',
  ' ██EEEE▀EEEE██ ',
  '  ▀████ ████▀  ',
  '   █▌█▌█▐█▐█   ',
  '    ▀▀▀▀▀▀▀    ',
];
function TeschioFisso({ tick, occupato, chiuso, sguardo }) {
  const battito = 0.5 + 0.5 * Math.sin(tick * (occupato ? 0.6 : 0.25));
  // la pupilla: una cella più chiara dentro l'orbita, che si sposta con lo sguardo
  const px = Math.round(1.5 + sguardo[0] * 1.5);
  return html`<${Box} flexDirection="column" marginRight=${2}>
    ${TESCHIO_FISSO.map((riga, y) => html`<${Text} key=${y}>${[...riga].map((ch, x) => {
      if (ch === 'E') {
        if (chiuso) return html`<${Text} key=${x} color="#14141C">█<//>`;
        const dentro = x < 7 ? x - 3 : x - 8;
        const pupilla = dentro === px && (y === 3 ? sguardo[1] <= 0 : sguardo[1] > 0);
        return html`<${Text} key=${x} color=${pupilla ? '#FFFFFF' : rgbHex(campiona([hex(C.rosa), hex(C.ciano)], 0.3 + battito * 0.45))}>█<//>`;
      }
      if (ch === '╲') return html`<${Text} key=${x} color=${rgbHex(campiona([hex(C.rosa), hex(C.ciano)], 0.5 + 0.5 * Math.sin(tick * 0.4)))} bold>╲<//>`;
      const g = Math.round(232 - y * 9);
      return html`<${Text} key=${x} color=${rgbHex([g, g, g + 12])}>${ch}<//>`;
    })}<//>`)}
  <//>`;
}

function TeschioPiccolo({ tick, occupato, sguardo = [0, 0], lampeggio }) {
  const chiuso = palpebra(tick, lampeggio) === 0;
  const battito = 0.5 + 0.5 * Math.sin(tick * (occupato ? 0.6 : 0.25));
  const occhio = chiuso ? '#14141C' : rgbHex(campiona([hex(C.rosa), hex(C.ciano), [255, 255, 255]], 0.3 + battito * 0.45));
  const osso = '#C8C8D4';
  const crepa = rgbHex(campiona([hex(C.rosa), hex(C.ciano)], 0.5 + 0.5 * Math.sin(tick * 0.4)));
  const sx = sguardo[0] > 0.3 ? ['█ ', '●', '█', '●', '█ '] : sguardo[0] < -0.3 ? [' █', '●', '█', '●', ' █'] : ['█ ', '●', '█', '●', ' █'];
  return html`<${Box} flexDirection="column" marginRight=${1}>
    <${Text}><${Text} color=${osso}>▄██<//><${Text} color=${crepa}>╲<//><${Text} color=${osso}>██▄<//><//>
    <${Text}><${Text} color=${osso}>${sx[0]}<//><${Text} color=${occhio}>${chiuso ? '─' : sx[1]}<//><${Text} color=${osso}>${sx[2]}<//><${Text} color=${occhio}>${chiuso ? '─' : sx[3]}<//><${Text} color=${osso}>${sx[4]}<//><//>
    <${Text} color=${osso}> ▀▄▀▄▀<//>
  <//>`;
}

// ---------- l'intestazione ----------

let NOME_CACHE = null;

function Linguette({ pagina, corte, onPagina }) {
  // su schermi stretti: solo il numero, tranne la pagina in cui sei
  return html`<${Box} flexShrink=${0}>${PAGINE.map(([id, nome], i) => html`<${Cliccabile} key=${id} azione=${() => onPagina?.(id)}><${Text} color=${id === pagina ? '#000000' : C.grigio} backgroundColor=${id === pagina ? C.ciano : undefined} bold=${id === pagina}> ${i + 1}${corte && id !== pagina ? '' : ' ' + nome} <//><//>`)}<//>`;
}

function Stato({ config, modo, disponibili, occupato, etichetta, costo, tick, progetto, chat, coda, larghezza }) {
  const w = Math.max(30, Math.min(60, Math.floor(larghezza * 0.3)));
  return html`<${Box} flexDirection="column" width=${w} flexShrink=${0}>
    <${Text} wrap="truncate-end"><${Text} color=${C.grigio}>progetto    <//><${Text} color=${C.gesso} bold>${progetto || '—'}<//><${Text} color=${C.grigio}>${chat ? '  ·  ' + chat : ''}<//><//>
    <${Text}><${Text} color=${C.grigio}>modalità    <//><${Text} color=${modo ? C.giallo : C.viola} bold>${modo ? '💬 chat con ' + disponibili[modo].nome : '◈ squadra'}<//><//>
    <${Text}><${Text} color=${C.grigio}>mappatura   <//><${Text} color=${C.ciano} bold>${config.mappa || '—'}<//><${Text} color=${C.grigio}>  ·  parallelo <//><${Text} color=${C.ciano}>${config.parallelo > 1 ? `×${config.parallelo}` : 'no'}<//><//>
    <${Text}><${Text} color=${C.grigio}>autonomia   <//><${Text} color=${config.autonomia === 'totale' ? C.rosso : C.verde} bold>${config.autonomia}<//><//>
    <${Text}><${Text} color=${C.grigio}>stato       <//><${Text} color=${occupato ? C.rosa : C.verde} bold>${occupato ? `${SPIN[tick % SPIN.length]} ${etichetta}` : '● pronto'}<//><${Text} color=${C.giallo}>${coda ? `  · in coda ${coda}` : ''}<//><//>
    <${Text}><${Text} color=${C.grigio}>valore API  <//><${Text} color=${C.gesso}>${costo > 0 ? `≈ $${costo.toFixed(2)}` : '—'}<//><//>
  <//>`;
}

// La striscia tecnica: CPU, RAM, pensieri, le IA, l'ora. Riempie il centro dell'intestazione grande.
function Strumenti({ tel, disponibili, tick, config, suoni, mouse }) {
  const cpu = tel?.cpu?.at(-1) || 0;
  const ram = tel?.ram?.at(-1) || 0;
  const pensieri = tel?.pensieri?.at(-1) || 0;
  const colCpu = cpu > 0.85 ? C.rosso : cpu > 0.5 ? C.giallo : C.ciano;
  return html`<${Box} flexDirection="column" marginLeft=${3} width=${34}>
    <${Text}><${Text} color=${C.scuro}>┌ <//><${Text} color=${C.grigio}>telemetria<//><${Text} color=${C.scuro}> ${'─'.repeat(20)}<//><//>
    <${Text}><${Text} color=${C.grigio}>│ cpu  <//><${Text} color=${colCpu}>${sparkline(tel?.cpu || [], 14, 1)}<//><${Text} color=${C.gesso}> ${String(Math.round(cpu * 100)).padStart(3)}%<//><//>
    <${Text}><${Text} color=${C.grigio}>│ ram  <//><${Text} color=${C.viola}>${sparkline(tel?.ram || [], 14, 1)}<//><${Text} color=${C.gesso}> ${String(Math.round(ram * 100)).padStart(3)}%<//><//>
    <${Text}><${Text} color=${C.grigio}>│ idee <//><${Text} color=${C.rosa}>${sparkline(tel?.pensieri || [], 14)}<//><${Text} color=${C.gesso}> ${String(pensieri).padStart(3)}/s<//><//>
    <${Text} wrap="truncate-end"><${Text} color=${C.grigio}>│ ia   <//>${Object.values(disponibili).map((d) => html`<${Text} key=${d.id} color=${!d.ok ? C.scuro : d.limitato ? C.rosso : tel?.ia?.[d.id]?.attivo ? C.rosa : COLORE_IA[d.id]}>${!d.ok ? '○' : tel?.ia?.[d.id]?.attivo ? SPIN[tick % SPIN.length] : '●'} <//>`)}<${Text} color=${C.scuro}>${Object.values(disponibili).filter((d) => d.ok).length}/${Object.keys(disponibili).length}<//><//>
    <${Text}><${Text} color=${C.grigio}>│ ora  <//><${Text} color=${C.gesso}>${ora()}<//><${Text} color=${C.scuro}>  ${config.animazioni === 'leggera' ? 'grafica leggera' : config.animazioni === 'spenta' ? 'grafica spenta' : 'grafica piena'}<//><//>
    <${Text}><${Text} color=${C.scuro}>└ <//><${Text} color=${C.scuro}>${suoni ? '◎ suoni' : '◎ muto'} · ${mouse ? '▸ mouse' : '▸ tastiera'} · ${'─'.repeat(6)}<//><//>
  <//>`;
}

export function Intestazione(props) {
  const { config, tick, pagina, occupato, larghezza, grande, onPagina } = props;
  const fase = tick * 0.04;
  if (!NOME_CACHE) NOME_CACHE = righeLogo(config.brand.nome.toUpperCase(), 999, ['ANSI Shadow']);
  const LW = Math.max(...NOME_CACHE.map((l) => l.length));
  const sguardo = props.sguardo || [0, 0];

  if (!grande) {
    return html`<${Box} flexDirection="column" width=${larghezza} height=${3} overflow="hidden">
      <${Box} paddingX=${1} overflow="hidden">
        <${TeschioPiccolo} tick=${tick} occupato=${occupato} sguardo=${sguardo} lampeggio=${props.lampeggio} />
        <${Box} flexDirection="column" flexGrow=${1}>
          <${Box} height=${1}>
            <${Box} flexShrink=${0}><${Gradiente} testo=${config.brand.nome.split('').join(' ')} colori=${config.brand.colori} fase=${fase} /><${Text} color=${C.scuro}> v${props.versione || '?'}<//><//>
            ${larghezza >= 130 ? html`<${Text} color=${C.grigio} wrap="truncate-end">   ${config.brand.tagline}<//>` : null}
            <${Box} flexGrow=${1} />
            <${Linguette} pagina=${pagina} corte=${larghezza < 130} onPagina=${onPagina} />
          <//>
          <${Box} height=${1} overflow="hidden">
            <${Text} wrap="truncate-end"><${Text} color=${props.modo ? C.giallo : C.viola}>${props.modo ? '💬 chat con ' + props.disponibili[props.modo].nome : '◈ squadra'}<//>${larghezza >= 100 ? html`<${Text} color=${C.grigio}>  ·  mappa <//><${Text} color=${C.ciano}>${config.mappa || '—'}<//><${Text} color=${C.grigio}>  ·  autonomia <//><${Text} color=${config.autonomia === 'totale' ? C.rosso : C.verde}>${config.autonomia}<//>` : null}${props.coda ? html`<${Text} color=${C.giallo}>  ·  in coda ${props.coda}<//>` : null}<//>
            <${Box} flexGrow=${1} />
            <${Text} wrap="truncate-end">${larghezza >= 100 ? html`<${Text} color=${C.scuro}>${ora()}  <//>` : null}<${Text} color=${occupato ? C.rosa : C.verde}>${occupato ? `${SPIN[tick % SPIN.length]} ${props.etichetta}` : '● pronto'}<//><//>
          <//>
          <${Gradiente} testo=${'━'.repeat(Math.max(10, larghezza - 12))} colori=${config.brand.colori} fase=${fase * 2} bold=${false} passo=${6} />
        <//>
      <//>
    <//>`;
  }

  const spazioStrumenti = larghezza >= LW + 15 + 2 + 36 + 40 + 6;
  return html`<${Box} flexDirection="column" width=${larghezza} height=${9} overflow="hidden">
    <${Box} paddingX=${1} height=${8} overflow="hidden">
      <${TeschioGrande} tick=${tick} occupato=${occupato} sguardo=${sguardo} lampeggio=${props.lampeggio} leggera=${config.animazioni !== 'piena'} />
      <${Box} flexDirection="column" width=${LW + 2}>
        ${NOME_CACHE.map((r, y) => html`<${Gradiente} key=${y} testo=${r} colori=${config.brand.colori} fase=${fase - y * 0.03} passo=${2} />`)}
        <${Text}><${Text} color=${C.ciano}>${config.brand.tagline}<//><${Text} color=${C.grigio}>  ·  by <//><${Gradiente} testo="GASTY" colori=${config.brand.colori} fase=${fase * 1.5} /><${Text} color=${C.scuro}>   v${props.versione || '?'}<//><//>
      <//>
      ${spazioStrumenti ? html`<${Strumenti} tel=${props.tel} disponibili=${props.disponibili} tick=${tick} config=${config} suoni=${props.suoniAttivi} mouse=${props.mouseAttivo} />` : null}
      <${Box} flexGrow=${1} />
      <${Box} flexDirection="column" alignItems="flex-end" flexShrink=${0}>
        <${Linguette} pagina=${pagina} onPagina=${onPagina} />
        <${Text}> <//>
        <${Stato} ...${props} />
      <//>
    <//>
    <${Gradiente} testo=${'━'.repeat(Math.max(10, larghezza))} colori=${config.brand.colori} fase=${fase * 2} bold=${false} passo=${6} />
  <//>`;
}
