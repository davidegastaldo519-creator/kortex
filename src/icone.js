// Le icone di KORTEX. Con un "Nerd Font" installato (l'installer mette JetBrainsMono Nerd Font) si usano
// icone vere: cartelle, file, git, server, ingranaggi, e i separatori "powerline" della barra di stato.
// Senza, si usano simboli normali che funzionano in qualunque terminale. Tutte occupano UNA colonna.
import { execFileSync } from 'node:child_process';

const NERD = {
  lavoro: '', progetti: '', database: '', controllo: '', studio: '', guida: '', statistiche: '',
  terminale: '', agenti: '', output: '', registro: '', diff: '', file: '', cartella: '',
  git: '', ia: '', tempo: '', ora: '', ok: '', errore: '', avviso: '', cerca: '',
  server: '', chip: '', carburante: '', profilo: '', coda: '', razzo: '', stella: '',
  accetta: '', rifiuta: '', nuovo: '', modificato: '', tolto: '', comando: '', occhio: '',
  sepDx: '', sepSx: '', sepDxTondo: '', sepSxTondo: '',
};
const NORMALI = {
  lavoro: '◈', progetti: '•', database: '◉', controllo: '≡', studio: '◇', guida: '?', statistiche: '◦',
  terminale: '$', agenti: '◆', output: '›', registro: '≣', diff: '±', file: '·', cartella: '▸',
  git: 'git', ia: '◆', tempo: '⊙', ora: '⊙', ok: '✓', errore: '✗', avviso: '△', cerca: '⊙',
  server: '◈', chip: '◈', carburante: '■', profilo: '◎', coda: '⋯', razzo: '▲', stella: '◆',
  accetta: '✓', rifiuta: '◂', nuovo: '+', modificato: '~', tolto: '-', comando: '▸', occhio: '◉',
  sepDx: '▌', sepSx: '▐', sepDxTondo: '▌', sepSxTondo: '▐',
};

export const I = { ...NORMALI };
let nerd = false;

// C'è un Nerd Font installato? (fc-list è su ogni Linux con un desktop; su Termux il font si sceglie a parte)
export function nerdFontPresente() {
  try {
    const out = execFileSync('fc-list', [':', 'family'], { encoding: 'utf8', timeout: 4000, stdio: ['ignore', 'pipe', 'ignore'] });
    return /nerd font/i.test(out);
  } catch { return !!process.env.TERMUX_VERSION && false; }
}

// config.icone: 'auto' (le usa se il font c'è), 'on', 'off'
export function applicaIcone(config) {
  const scelta = ['auto', 'on', 'off'].includes(config.icone) ? config.icone : 'auto';
  nerd = scelta === 'on' || (scelta === 'auto' && nerdFontPresente());
  Object.assign(I, nerd ? NERD : NORMALI);
  return nerd;
}
export const iconeNerd = () => nerd;
