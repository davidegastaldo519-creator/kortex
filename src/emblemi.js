import { Box, Text } from 'ink';
import { html, C } from './grafica.js';
import { campiona, hex, rgbHex } from './splash.js';

// Quanto resta vivo un emblema dopo un evento.
export const DURATA_VIVO = 4500;
const vivo = (ultimo) => !!ultimo && Date.now() - ultimo < DURATA_VIVO;
const spento = (c, k = 0.45) => rgbHex(hex(c).map((v) => Math.round(v * k)));

// ---------- il cervello nel barattolo: il DATABASE ----------
// Le bolle salgono e il cervello si accende quando le IA leggono o scrivono nel database.

const BARATTOLO = [
  ' ▄▄▄▄▄▄▄▄▄▄ ',
  ' ▀████████▀ ',
  ' │········│ ',
  ' │·▄▀█▀▄··│ ',
  ' │·▀▄█▄▀··│ ',
  ' │········│ ',
  ' ╰────────╯ ',
];
const BOLLE = [{ x: 8, ritardo: 0 }, { x: 3, ritardo: 2 }, { x: 7, ritardo: 5 }, { x: 4, ritardo: 3 }];

export function EmblemaDatabase({ tick, ultimo, etichetta }) {
  const attivo = vivo(ultimo);
  const liquido = attivo ? '#0E3B3B' : '#0B1F22';
  const vetro = attivo ? '#9FD8E0' : '#4A5A66';
  const coperchio = attivo ? '#B0B0C0' : '#555566';
  // bolle: salgono dal fondo (riga 5) alla superficie (riga 2)
  const bolle = new Map();
  for (const b of BOLLE) {
    const passo = attivo ? (tick + b.ritardo) % 5 : b.ritardo % 4;
    const y = 5 - passo;
    if (y >= 2) bolle.set(`${b.x},${y}`, passo < 2 ? '°' : passo < 4 ? 'o' : '◦');
  }
  const righe = BARATTOLO.map((riga, y) => html`<${Text} key=${y}>${[...riga].map((ch, x) => {
    if (y <= 1) return html`<${Text} key=${x} color=${coperchio}>${ch}<//>`;
    if (ch === '│' || ch === '╰' || ch === '╯' || ch === '─') return html`<${Text} key=${x} color=${vetro}>${ch}<//>`;
    if (ch === '·') {
      const bolla = bolle.get(`${x},${y}`);
      return html`<${Text} key=${x} backgroundColor=${liquido} color=${attivo ? '#E0FFFF' : '#3C5A5E'}>${bolla || ' '}<//>`;
    }
    if (ch === ' ') return html`<${Text} key=${x}> <//>`;
    // il cervello
    const col = attivo ? rgbHex(campiona([hex(C.rosa), hex(C.ciano), [255, 255, 255]], tick * 0.09 + x * 0.12 + y * 0.2)) : spento('#FF8FB8', 0.5);
    return html`<${Text} key=${x} backgroundColor=${liquido} color=${col}>${ch}<//>`;
  })}<//>`);
  return html`<${Box} flexDirection="column" alignItems="center">
    ${righe}
    <${Text} color=${attivo ? C.ciano : C.scuro} wrap="truncate-end">${attivo ? etichetta || 'al lavoro' : 'database'}<//>
  <//>`;
}

// ---------- la mappa stellare: i PROGETTI ----------
// Ogni stella è un progetto collegato agli altri. Quando ne apri uno o salvi una chat, la luce corre lungo le linee.

const MAPPA = [
  ' ✦───•      ✧  ',
  '  ╲   ╲    ╱   ',
  '   •───✦──•    ',
  '  ╱        ╲   ',
  ' ✧    •─────✦  ',
];
const STELLE = new Set(['✦', '✧', '•']);

export function EmblemaProgetti({ tick, ultimo, quanti, etichetta }) {
  const attivo = vivo(ultimo);
  const righe = MAPPA.map((riga, y) => html`<${Text} key=${y}>${[...riga].map((ch, x) => {
    if (ch === ' ') return html`<${Text} key=${x}> <//>`;
    if (STELLE.has(ch)) {
      // le stelle brillano a turno; da ferme sono tenui
      const brilla = attivo && (tick + x * 3 + y * 5) % 6 < 2;
      const c = attivo ? (brilla ? '#FFFFFF' : C.ciano) : spento(C.ciano, 0.5);
      return html`<${Text} key=${x} color=${c} bold=${brilla}>${brilla ? '✦' : ch}<//>`;
    }
    // le linee: un'onda di luce le percorre
    const onda = attivo ? campiona([hex(C.viola), hex(C.rosa), hex(C.ciano), hex(C.viola)], (x + y * 2) * 0.06 - tick * 0.12) : hex(C.scuro);
    return html`<${Text} key=${x} color=${rgbHex(onda)}>${ch}<//>`;
  })}<//>`);
  return html`<${Box} flexDirection="column" alignItems="center">
    ${righe}
    <${Text} color=${attivo ? C.ciano : C.scuro} wrap="truncate-end">${attivo ? etichetta || 'in movimento' : `${quanti} progett${quanti === 1 ? 'o' : 'i'}`}<//>
  <//>`;
}
