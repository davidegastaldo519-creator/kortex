// Il mouse dentro KORTEX. Il terminale, se glielo chiediamo, manda una sequenza di escape per ogni
// clic e per ogni scatto della rotella. Qui le intercettiamo PRIMA che arrivino a Ink (altrimenti
// finirebbero come lettere strane nella casella di testo), le trasformiamo in eventi e lasciamo
// passare tutto il resto (i tasti) intatto.
import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';
import React, { useRef, useEffect } from 'react';
import { Box } from 'ink';
import htm from 'htm';

const html = htm.bind(React.createElement);

export const eventi = new EventEmitter();
eventi.setMaxListeners(50);

const ACCENDI = '\x1b[?1000h\x1b[?1006h';
const SPEGNI = '\x1b[?1006l\x1b[?1000l';
let acceso = false;

export function accendiMouse() { if (!acceso) { process.stdout.write(ACCENDI); acceso = true; } }
export function spegniMouse() { if (acceso) { process.stdout.write(SPEGNI); acceso = false; } }
export const mouseAcceso = () => acceso;

// ---------- lo stdin filtrato che diamo a Ink ----------

const SEQUENZA = /\x1b\[<(\d+);(\d+);(\d+)([mM])/g;
// un pezzo di sequenza rimasto a metà alla fine di un blocco di dati
const MOZZA = /\x1b(\[(<(\d+(;\d*)*)?)?)?$/;

export class StdinFiltrato extends Readable {
  constructor(origine = process.stdin) {
    super();
    this.origine = origine;
    this.isTTY = origine.isTTY;
    this.resto = '';
    this.timer = null;
    this.ascolta = (d) => this.ricevi(d.toString('utf8'));
    origine.on('data', this.ascolta);
    origine.setEncoding?.('utf8');
    origine.resume();
  }
  _read() { /* i dati arrivano da soli */ }
  setRawMode(v) { try { this.origine.setRawMode(v); } catch { /* */ } return this; }
  ref() { try { this.origine.ref(); } catch { /* */ } return this; }
  unref() { try { this.origine.unref(); } catch { /* */ } return this; }
  ricevi(testo) {
    clearTimeout(this.timer);
    let dati = this.resto + testo;
    this.resto = '';
    const m = dati.match(MOZZA);
    if (m) { this.resto = m[0]; dati = dati.slice(0, dati.length - m[0].length); }
    const puliti = dati.replace(SEQUENZA, (_, b, x, y, tipo) => {
      const pulsante = Number(b);
      const ev = { x: Number(x) - 1, y: Number(y) - 1, pulsante };
      if (pulsante === 64) eventi.emit('rotella', { ...ev, verso: 1 });
      else if (pulsante === 65) eventi.emit('rotella', { ...ev, verso: -1 });
      else if (tipo === 'M' && (pulsante & 3) === 0 && pulsante < 32) eventi.emit('click', ev);
      else if (tipo === 'M' && (pulsante & 3) === 2 && pulsante < 32) eventi.emit('clickDestro', ev);
      return '';
    });
    if (puliti) this.consegna(puliti);
    // un ESC da solo, o un pezzo di sequenza che non si completa: dopo un attimo lo lascio passare
    if (this.resto) this.timer = setTimeout(() => { const r = this.resto; this.resto = ''; if (r) this.push(r); }, 40);
  }
  // Il testo passa com'è arrivato: spezzarlo in più consegne farebbe perdere lettere alla casella di testo,
  // che tra una consegna e l'altra non ha ancora fatto in tempo a ridisegnarsi.
  consegna(testo) { this.push(testo); }
  chiudi() {
    this.origine.off('data', this.ascolta);
    clearTimeout(this.timer);
    try { this.origine.setRawMode(false); } catch { /* */ }
    try { this.origine.pause(); this.origine.unref(); } catch { /* */ }
  }
}

// ---------- le zone cliccabili ----------

const zone = new Map();
let prossimoId = 1;

function posizioneAssoluta(nodo) {
  let x = 0, y = 0, n = nodo;
  while (n) {
    const yn = n.yogaNode;
    if (yn) { x += yn.getComputedLeft(); y += yn.getComputedTop(); }
    n = n.parentNode;
  }
  return { x, y };
}

function rettangolo(ref) {
  const nodo = ref.current;
  if (!nodo?.yogaNode) return null;
  const { x, y } = posizioneAssoluta(nodo);
  return { x, y, w: nodo.yogaNode.getComputedWidth(), h: nodo.yogaNode.getComputedHeight() };
}

// La zona più interna (più piccola) che contiene il punto e ha un gestore del tipo chiesto.
export function zonaIn(x, y, tipo = 'azione') {
  let migliore = null;
  let area = Infinity;
  for (const z of zone.values()) {
    if (!z.stato.current[tipo]) continue;
    const r = rettangolo(z.ref);
    if (!r || x < r.x || y < r.y || x >= r.x + r.w || y >= r.y + r.h) continue;
    const a = r.w * r.h;
    if (a < area) { area = a; migliore = z; }
  }
  return migliore;
}

export function gestisciClick(ev) {
  const z = zonaIn(ev.x, ev.y, 'azione');
  if (!z) return false;
  z.stato.current.azione(ev);
  return true;
}

export function gestisciRotella(ev) {
  const z = zonaIn(ev.x, ev.y, 'rotella');
  if (!z) return false;
  z.stato.current.rotella(ev.verso, ev);
  return true;
}

// Un riquadro che reagisce al mouse: azione al clic, rotella allo scorrimento. Per il resto è un Box.
export function Cliccabile({ azione, rotella, children, ...resto }) {
  const ref = useRef(null);
  const stato = useRef({});
  stato.current.azione = azione;
  stato.current.rotella = rotella;
  useEffect(() => {
    const id = prossimoId++;
    zone.set(id, { ref, stato });
    return () => zone.delete(id);
  }, []);
  return html`<${Box} ref=${ref} ...${resto}>${children}<//>`;
}
