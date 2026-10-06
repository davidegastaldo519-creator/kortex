import os from 'node:os';

const STORICO = 60; // secondi di grafico

function campioneCpu() {
  let inattivo = 0;
  let totale = 0;
  for (const c of os.cpus()) {
    for (const v of Object.values(c.times)) totale += v;
    inattivo += c.times.idle;
  }
  return { inattivo, totale };
}

// Raccoglie tutto quello che succede nel tool e lo tiene pronto per i grafici.
export class Telemetria {
  constructor(idIA) {
    this.cpu = [];
    this.ram = [];
    this.pensieri = [];
    this.contatore = 0;
    this.precedente = campioneCpu();
    this.ia = Object.fromEntries(
      idIA.map((id) => [id, { chiamate: 0, ok: 0, errori: 0, secondi: 0, valore: 0, ultima: null, attivo: null }])
    );
  }

  // Una volta al secondo.
  campiona() {
    const ora = campioneCpu();
    const dt = ora.totale - this.precedente.totale;
    const cpu = dt > 0 ? 1 - (ora.inattivo - this.precedente.inattivo) / dt : 0;
    this.precedente = ora;
    this.cpu = [...this.cpu, Math.max(0, Math.min(1, cpu))].slice(-STORICO);
    this.ram = [...this.ram, 1 - os.freemem() / os.totalmem()].slice(-STORICO);
    this.pensieri = [...this.pensieri, this.contatore].slice(-STORICO);
    this.contatore = 0;
  }

  // Ogni pezzo di testo o strumento usato da un'IA è un "pensiero".
  evento() {
    this.contatore++;
  }

  inizio(id, ruolo) {
    const s = this.ia[id];
    if (!s) return () => {};
    s.chiamate++;
    s.attivo = ruolo;
    const t0 = Date.now();
    return ({ ok, costo }) => {
      s.attivo = null;
      s.secondi += (Date.now() - t0) / 1000;
      s.ultima = (Date.now() - t0) / 1000;
      if (ok) s.ok++; else s.errori++;
      if (costo) s.valore += costo;
    };
  }
}

const BLOCCHI = '▁▂▃▄▅▆▇█';
export function sparkline(valori, larghezza, massimo) {
  const v = valori.slice(-larghezza);
  const top = massimo ?? Math.max(1, ...v);
  const riga = v.map((x) => BLOCCHI[Math.min(7, Math.round((x / top) * 7))]).join('');
  return riga.padStart(larghezza, ' ');
}

// Grafico a colonne alto più righe: restituisce le righe dall'alto verso il basso.
export function graficoAlto(valori, larghezza, altezza, massimo) {
  const v = valori.slice(-larghezza);
  const top = massimo ?? Math.max(1, ...v);
  const colonne = Array(larghezza - v.length).fill(0).concat(v.map((x) => Math.round((x / top) * altezza * 8)));
  const righe = [];
  for (let r = 0; r < altezza; r++) {
    const daBasso = altezza - 1 - r;
    righe.push(colonne.map((ottavi) => {
      const pieno = Math.max(0, Math.min(8, ottavi - daBasso * 8));
      return pieno === 0 ? ' ' : pieno >= 8 ? '█' : BLOCCHI[pieno - 1];
    }).join(''));
  }
  return righe;
}
