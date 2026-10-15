// Lo schermo stabile: niente sfarfallio.
// Ink, a ogni aggiornamento, cancella tutte le righe e le riscrive da capo: il terminale fa in tempo a
// mostrare lo schermo mezzo vuoto, e l'occhio vede uno scatto. Qui Ink scrive su un finto stdout; noi
// prendiamo il fotogramma finito, lo confrontiamo con quello di prima e riscriviamo SOLO le righe
// cambiate, ognuna al suo posto, tutte in un'unica scrittura. In più chiediamo al terminale di
// mostrare il fotogramma solo quando è completo (aggiornamento sincronizzato, dove è supportato).
import { EventEmitter } from 'node:events';

const INIZIO_SYNC = '\x1b[?2026h';
const FINE_SYNC = '\x1b[?2026l';
// cancellazioni e ritorni a capo che Ink mette davanti a ogni fotogramma
const PREFISSO = /^(?:\x1b\[2K|\x1b\[1A|\x1b\[G|\x1b\[2J|\x1b\[3J|\x1b\[H|\x1bc)+/;

export class SchermoStabile extends EventEmitter {
  constructor(vero = process.stdout) {
    super();
    this.vero = vero;
    this.isTTY = true;
    this.precedenti = [];
    this.inoltra = () => { this.invalida(); this.emit('resize'); };
    vero.on('resize', this.inoltra);
  }
  get columns() { return this.vero.columns; }
  get rows() { return this.vero.rows; }
  // Dopo una pulizia dello schermo, il prossimo fotogramma va riscritto per intero.
  invalida() { this.precedenti = []; }
  write(dati, codifica, cb) {
    if (typeof codifica === 'function') { cb = codifica; codifica = undefined; }
    let s = typeof dati === 'string' ? dati : dati.toString();
    const pulisce = /\x1b\[2J|\x1bc/.test(s);
    if (pulisce) this.invalida();
    const m = s.match(PREFISSO);
    if (m) s = s.slice(m[0].length);
    if (!s.endsWith('\n')) {
      // non è un fotogramma di Ink: passa così com'è
      if (pulisce) this.vero.write('\x1b[2J\x1b[H');
      if (s) this.vero.write(s);
      cb?.();
      return true;
    }
    const righe = s.slice(0, -1).split('\n');
    let fuori = '';
    const max = Math.max(righe.length, this.precedenti.length);
    for (let i = 0; i < max && i < (this.vero.rows || 999); i++) {
      const r = righe[i] ?? '';
      if (r === this.precedenti[i]) continue;
      fuori += `\x1b[${i + 1};1H\x1b[0m${r}\x1b[0m\x1b[K`;
    }
    this.precedenti = righe;
    if (fuori) this.vero.write(INIZIO_SYNC + '\x1b[?25l' + fuori + FINE_SYNC);
    cb?.();
    return true;
  }
  end() {}
  chiudi() { this.vero.off('resize', this.inoltra); }
}
