import React from 'react';
import { Box, Text } from 'ink';
import htm from 'htm';
import { campiona, hex, rgbHex, righeLogo } from './splash.js';

export const html = htm.bind(React.createElement);

export const C = {
  viola: '#9D4EDD', rosa: '#FF2BD6', ciano: '#00F5FF', grigio: '#6B6B80', scuro: '#3A3A4A',
  verde: '#39FF14', rosso: '#FF3860', giallo: '#FFE66D', gesso: '#E8E4D0', lavagna: '#3E6B5A',
};
// Ogni IA ha il suo colore, uguale in tutto il programma.
export const COLORE_IA = { claude: '#FF8A3D', codex: '#3DDC97', gemini: '#4D9FFF', ollama: '#C9C9D6' };
export const SPIN = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏';
export const PAGINE = [['lavoro', 'LAVORO'], ['progetti', 'PROGETTI'], ['database', 'DATABASE'], ['controllo', 'CONTROLLO'], ['studio', 'STUDIO'], ['guida', 'GUIDA']];

export const lim01 = (x) => Math.max(0, Math.min(1, x || 0));
export const accorcia = (s, n) => (s.length <= n ? s : '…' + s.slice(-Math.max(1, n - 1)));
const mescola = (a, b, t) => rgbHex(campiona([hex(a), hex(b)], lim01(t) * 0.5));

export function avvolgi(righe, w) {
  const out = [];
  for (const r of righe) {
    if (r.length <= w) out.push(r);
    else for (let i = 0; i < r.length; i += w) out.push(r.slice(i, i + w));
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

export function Pannello({ titolo, nota, colore = C.viola, coloreTitolo = C.ciano, children, ...resto }) {
  return html`<${Box} flexDirection="column" borderStyle="round" borderColor=${colore} paddingX=${1} overflow="hidden" ...${resto}>
    <${Text} wrap="truncate-end"><${Text} color=${coloreTitolo} bold>${titolo}<//>${nota ? html`<${Text} color=${C.grigio}>  ${nota}<//>` : null}<//>
    ${children}
  <//>`;
}

export function Barra({ valore, larghezza, colore = C.ciano }) {
  const pieni = Math.round(lim01(valore) * larghezza);
  return html`<${Text}><${Text} color=${colore}>${'█'.repeat(pieni)}<//><${Text} color=${C.scuro}>${'░'.repeat(larghezza - pieni)}<//><//>`;
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

// ---------- il teschio dell'intestazione ----------

const TESCHIO_GRANDE = [
  '    ▄▄▄█▄▄▄    ',
  '  ▄█████████▄  ',
  ' ██████╲██████ ',
  ' ██EEEE█EEEE██ ',
  ' ██EEEE▀EEEE██ ',
  '  ▀████ ████▀  ',
  '   █▌█▌█▐█▐█   ',
  '    ▀▀▀▀▀▀▀    ',
];

function coloreOcchio(tick, x, occupato) {
  const battito = 0.5 + 0.5 * Math.sin(tick * (occupato ? 0.6 : 0.25));
  const chiuso = tick % 47 === 0 || tick % 47 === 1;
  if (chiuso) return '#14141C';
  // il centro di ogni orbita è più chiaro: sembra una luce che viene da dentro
  const centro = x === 4 || x === 5 || x === 9 || x === 10;
  return rgbHex(campiona([hex(C.rosa), hex(C.ciano), [255, 255, 255]], 0.3 + battito * 0.45 + (centro ? 0.12 : 0)));
}

export function TeschioGrande({ tick, occupato }) {
  return html`<${Box} flexDirection="column" marginRight=${2}>
    ${TESCHIO_GRANDE.map((riga, y) => html`<${Text} key=${y}>${[...riga].map((ch, x) => {
      if (ch === 'E') return html`<${Text} key=${x} color=${coloreOcchio(tick, x, occupato)}>█<//>`;
      if (ch === '╲') return html`<${Text} key=${x} color=${rgbHex(campiona([hex(C.rosa), hex(C.ciano)], 0.5 + 0.5 * Math.sin(tick * 0.4)))} bold>╲<//>`;
      const g = Math.round(232 - y * 9);
      return html`<${Text} key=${x} color=${rgbHex([g, g, g + 12])}>${ch}<//>`;
    })}<//>`)}
  <//>`;
}

function TeschioPiccolo({ tick, occupato }) {
  const occhio = coloreOcchio(tick, 4, occupato);
  const osso = '#C8C8D4';
  const crepa = rgbHex(campiona([hex(C.rosa), hex(C.ciano)], 0.5 + 0.5 * Math.sin(tick * 0.4)));
  return html`<${Box} flexDirection="column" marginRight=${1}>
    <${Text}><${Text} color=${osso}>▄██<//><${Text} color=${crepa}>╲<//><${Text} color=${osso}>██▄<//><//>
    <${Text}><${Text} color=${osso}>█ <//><${Text} color=${occhio}>●<//><${Text} color=${osso}>█<//><${Text} color=${occhio}>●<//><${Text} color=${osso}> █<//><//>
    <${Text} color=${osso}> ▀▄▀▄▀<//>
  <//>`;
}

// ---------- l'intestazione ----------

let NOME_CACHE = null;

function Linguette({ pagina, corte }) {
  // su schermi stretti: solo il numero, tranne la pagina in cui sei
  const testo = PAGINE.map(([id, nome], i) => ` ${i + 1}${corte && id !== pagina ? '' : ' ' + nome} `).join('');
  return html`<${Box} flexShrink=${0} width=${testo.length}><${Text} wrap="truncate-end">${PAGINE.map(([id, nome], i) => html`<${Text} key=${id} color=${id === pagina ? '#000000' : C.grigio} backgroundColor=${id === pagina ? C.ciano : undefined} bold=${id === pagina}> ${i + 1}${corte && id !== pagina ? '' : ' ' + nome} <//>`)}<//><//>`;
}

function Stato({ config, modo, disponibili, occupato, etichetta, costo, tick, progetto, chat }) {
  return html`<${Box} flexDirection="column">
    <${Text} wrap="truncate-end"><${Text} color=${C.grigio}>progetto    <//><${Text} color=${C.gesso} bold>${progetto || '—'}<//><${Text} color=${C.grigio}>${chat ? '  ·  ' + chat : ''}<//><//>
    <${Text}><${Text} color=${C.grigio}>modalità    <//><${Text} color=${modo ? C.giallo : C.viola} bold>${modo ? '💬 chat con ' + disponibili[modo].nome : '⚙ squadra'}<//><//>
    <${Text}><${Text} color=${C.grigio}>mappatura   <//><${Text} color=${C.ciano} bold>${config.mappa || '—'}<//><//>
    <${Text}><${Text} color=${C.grigio}>autonomia   <//><${Text} color=${config.autonomia === 'totale' ? C.rosso : C.verde} bold>${config.autonomia}<//><//>
    <${Text}><${Text} color=${C.grigio}>stato       <//><${Text} color=${occupato ? C.rosa : C.verde} bold>${occupato ? `${SPIN[tick % SPIN.length]} ${etichetta}` : '● pronto'}<//><//>
    <${Text}><${Text} color=${C.grigio}>valore API  <//><${Text} color=${C.gesso}>${costo > 0 ? `≈ $${costo.toFixed(2)}` : '—'}<//><//>
  <//>`;
}

export function Intestazione(props) {
  const { config, tick, pagina, occupato, larghezza, grande } = props;
  const fase = tick * 0.04;
  if (!NOME_CACHE) NOME_CACHE = righeLogo(config.brand.nome.toUpperCase(), 999, ['ANSI Shadow']);
  const LW = Math.max(...NOME_CACHE.map((l) => l.length));

  if (!grande) {
    return html`<${Box} flexDirection="column" width=${larghezza} height=${3}>
      <${Box} paddingX=${1}>
        <${TeschioPiccolo} tick=${tick} occupato=${occupato} />
        <${Box} flexDirection="column" flexGrow=${1}>
          <${Box} height=${1}>
            <${Box} flexShrink=${0}><${Gradiente} testo=${config.brand.nome.split('').join(' ')} colori=${config.brand.colori} fase=${fase} /><${Text} color=${C.scuro}> v${props.versione || '?'}<//><//>
            ${larghezza >= 130 ? html`<${Text} color=${C.grigio} wrap="truncate-end">   ${config.brand.tagline}<//>` : null}
            <${Box} flexGrow=${1} />
            <${Linguette} pagina=${pagina} corte=${larghezza < 130} />
          <//>
          <${Box} height=${1}>
            <${Text} color=${props.modo ? C.giallo : C.viola}>${props.modo ? '💬 chat con ' + props.disponibili[props.modo].nome : '⚙ squadra'}<//>
            <${Text} color=${C.grigio}>  ·  mappa <//><${Text} color=${C.ciano}>${config.mappa || '—'}<//>
            <${Text} color=${C.grigio}>  ·  autonomia <//><${Text} color=${config.autonomia === 'totale' ? C.rosso : C.verde}>${config.autonomia}<//>
            <${Box} flexGrow=${1} />
            <${Text} color=${occupato ? C.rosa : C.verde}>${occupato ? `${SPIN[tick % SPIN.length]} ${props.etichetta}` : '● pronto'}<//>
          <//>
          <${Gradiente} testo=${'━'.repeat(Math.max(10, larghezza - 12))} colori=${config.brand.colori} fase=${fase * 2} bold=${false} passo=${6} />
        <//>
      <//>
    <//>`;
  }

  return html`<${Box} flexDirection="column" width=${larghezza} height=${9}>
    <${Box} paddingX=${1} height=${8}>
      <${TeschioGrande} tick=${tick} occupato=${occupato} />
      <${Box} flexDirection="column" width=${LW + 2}>
        ${NOME_CACHE.map((r, y) => html`<${Gradiente} key=${y} testo=${r} colori=${config.brand.colori} fase=${fase - y * 0.03} passo=${2} />`)}
        <${Text}><${Text} color=${C.ciano}>${config.brand.tagline}<//><${Text} color=${C.grigio}>  ·  by <//><${Gradiente} testo="GASTY" colori=${config.brand.colori} fase=${fase * 1.5} /><${Text} color=${C.scuro}>   v${props.versione || '?'}<//><//>
      <//>
      <${Box} flexGrow=${1} />
      <${Box} flexDirection="column" alignItems="flex-end">
        <${Linguette} pagina=${pagina} />
        <${Text}> <//>
        <${Stato} ...${props} />
      <//>
    <//>
    <${Gradiente} testo=${'━'.repeat(Math.max(10, larghezza))} colori=${config.brand.colori} fase=${fase * 2} bold=${false} passo=${6} />
  <//>`;
}
