// La barra di stato in fondo, a blocchi colorati come negli editor professionali ("powerline").
// A sinistra: modalità e profilo, ramo git e file cambiati, stato del lavoro con la barra di avanzamento.
// In mezzo: il consiglio del momento o cosa sta facendo la squadra.
// A destra: il carburante di ogni IA (quanto abbonamento resta nelle ultime 5 ore), la coda, l'ora.
import { Box, Text } from 'ink';
import stringWidth from 'string-width';
import { html, C, COLORE_IA, SPIN } from './grafica.js';
import { I, iconeNerd } from './icone.js';
import { carburante } from './uso.js';
import { PROFILI } from './profili.js';

const NERO = '#0B0B10';
const SCURO = '#1E1E2A';

// Disegna una fila di blocchi: [{ t, fg, bg, b }]. Con le icone Nerd i blocchi sono uniti da una freccia.
function Blocchi({ blocchi, verso = 'dx' }) {
  const pezzi = [];
  blocchi.forEach((b, i) => {
    if (verso === 'sx' && iconeNerd()) pezzi.push(html`<${Text} key=${'s' + i} color=${b.bg}>${I.sepSx}<//>`);
    pezzi.push(html`<${Text} key=${'b' + i} color=${b.fg} backgroundColor=${b.bg} bold=${!!b.b}>${b.t}<//>`);
    if (verso === 'dx' && iconeNerd()) pezzi.push(html`<${Text} key=${'d' + i} color=${b.bg} backgroundColor=${blocchi[i + 1]?.bg}>${I.sepDx}<//>`);
  });
  return html`<${Text}>${pezzi}<//>`;
}
const largo = (blocchi) => blocchi.reduce((a, b) => a + stringWidth(b.t) + (iconeNerd() ? 1 : 0), 0);

function serbatoio(f, celle = 5) {
  const pieni = Math.round(f.resto * celle);
  return '■'.repeat(pieni) + '□'.repeat(celle - pieni);
}

export function BarraStato(p) {
  const { larghezza, config, modo, disponibili, occupato, tick, ramo, cambiati, progresso, etichetta, dettaglio, coda, consiglio } = p;
  const profilo = PROFILI[config.profilo];
  const sinistra = [
    { t: ` ${I.lavoro} ${modo ? 'CHAT ' + (disponibili[modo]?.nome || modo).toUpperCase() : 'SQUADRA'}${profilo ? ' · ' + profilo.nome : ''} `, fg: NERO, bg: modo ? C.giallo : C.rosa, b: true },
    { t: ` ${I.git} ${ramo || 'senza git'}${cambiati ? ` ±${cambiati}` : ramo ? ' ' + I.ok : ''} `, fg: '#FFFFFF', bg: C.viola },
  ];
  if (occupato) {
    const n = 12;
    const pieni = Math.round(progresso * n);
    sinistra.push({ t: ` ${SPIN[tick % SPIN.length]} ${'█'.repeat(pieni)}${'░'.repeat(n - pieni)} ${String(Math.round(progresso * 100)).padStart(2)}% `, fg: C.ciano, bg: SCURO, b: true });
  } else sinistra.push({ t: ` ● pronto `, fg: C.verde, bg: SCURO, b: true });

  // il carburante delle IA collegate
  const destra = [];
  for (const d of Object.values(disponibili)) {
    if (!d.ok || d.id === 'ollama') continue;
    const f = carburante(d.id, config);
    const col = d.limitato || f.resto < 0.1 ? C.rosso : f.resto < 0.35 ? C.giallo : C.verde;
    destra.push({ t: ` ${d.nome} `, fg: COLORE_IA[d.id] || C.gesso, bg: SCURO, b: true, extra: { t: `${serbatoio(f)}${f.stimato ? '~' : ''} `, fg: col } });
  }
  if (coda) destra.push({ t: ` ${I.coda} ${coda} `, fg: NERO, bg: C.giallo, b: true });
  destra.push({ t: ` ${I.ora} ${new Date().toTimeString().slice(0, 5)} `, fg: NERO, bg: C.ciano, b: true });

  // il blocco carburante è fatto di due colori: lo rendo come due pezzi con lo stesso sfondo
  let blocchiDx = destra.flatMap((b) => (b.extra ? [{ ...b, extra: undefined, sep: false }, { t: b.extra.t, fg: b.extra.fg, bg: b.bg, unito: true }] : [b]));
  const misuraDx = () => blocchiDx.reduce((a, b) => a + stringWidth(b.t) + (iconeNerd() && !b.unito ? 1 : 0), 0);
  // sui terminali stretti (telefono, finestra piccola) la barra si accorcia un pezzo alla volta invece di uscire dallo schermo
  const riduzioni = [
    () => { if (profilo) sinistra[0].t = sinistra[0].t.replace(' · ' + profilo.nome, ' · ' + profilo.icona); },
    () => { blocchiDx = blocchiDx.filter((b) => !b.t.includes(I.ora)); },
    () => { sinistra[1].t = ` ${I.git}${cambiati ? ` ±${cambiati}` : ''} `; },
    () => { blocchiDx = blocchiDx.map((b) => (b.unito || b.t.includes(I.coda) ? b : { ...b, t: ' ' + b.t.trim().slice(0, 2) + ' ' })); },
    () => { sinistra[0].t = ` ${I.lavoro} ${modo ? 'CHAT' : 'SQ'} `; },
  ];
  for (const r of riduzioni) { if (largo(sinistra) + misuraDx() + 12 <= larghezza) break; r(); }
  const wSx = largo(sinistra);
  const wDx = misuraDx();
  const spazio = Math.max(0, larghezza - wSx - wDx - 2);
  const testoMezzo = occupato ? dettaglio : consiglio;
  const mezzo = stringWidth(testoMezzo || '') > spazio - 2 ? (testoMezzo || '').slice(0, Math.max(0, spazio - 3)) + '…' : testoMezzo || '';

  const pezziDx = [];
  blocchiDx.forEach((b, i) => {
    if (iconeNerd() && !b.unito) pezziDx.push(html`<${Text} key=${'s' + i} color=${b.bg}>${I.sepSx}<//>`);
    pezziDx.push(html`<${Text} key=${'b' + i} color=${b.fg} backgroundColor=${b.bg} bold=${!!b.b}>${b.t}<//>`);
  });
  return html`<${Box} height=${1} width=${larghezza} overflow="hidden">
    <${Blocchi} blocchi=${sinistra} />
    <${Text} color=${occupato ? C.grigio : C.scuro} wrap="truncate-end"> ${mezzo.padEnd(Math.max(0, spazio - 1))}<//>
    <${Text}>${pezziDx}<//>
  <//>`;
}
