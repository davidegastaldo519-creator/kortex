// Il registro dell'uso: ogni chiamata a un'IA e ogni richiesta finita, salvate in ~/.config/kortex/uso.json.
// Serve a due cose:
//  1. il CARBURANTE: quante chiamate ha fatto ogni IA nelle ultime 5 ore (la finestra in cui gli abbonamenti
//     contano), rispetto a un limite stimato. Il limite si impara da solo: quando un'IA si ferma davvero per
//     limite raggiunto, KORTEX si segna quante chiamate aveva fatto e usa quel numero da lì in poi.
//  2. le STATISTICHE personali: richieste, compiti, file toccati, tempo di lavoro delle IA.
import fs from 'node:fs';
import path from 'node:path';
import { DIR_CONFIG } from './config.js';

const FILE = path.join(DIR_CONFIG, 'uso.json');
const FINESTRA = 5 * 3600 * 1000;
// limiti di partenza (chiamate in 5 ore): solo una stima, si correggono da soli al primo limite vero
const LIMITI_INIZIALI = { claude: 150, codex: 60, gemini: 100, ollama: 0, antigravity: 100 };

let dati = null;
function carica() {
  if (dati) return dati;
  try { dati = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { dati = {}; }
  dati.chiamate ??= [];
  dati.limiti ??= {};
  dati.totali ??= { richieste: 0, compiti: 0, compitiOk: 0, file: 0, secondiIA: 0, perIA: {}, perGiorno: {}, primoGiorno: null };
  return dati;
}
let timerSalva = null;
function salva() {
  clearTimeout(timerSalva);
  timerSalva = setTimeout(() => {
    try {
      fs.mkdirSync(DIR_CONFIG, { recursive: true });
      // le chiamate più vecchie di 5 ore servono solo come totali
      dati.chiamate = dati.chiamate.filter((c) => Date.now() - c.t < FINESTRA);
      fs.writeFileSync(FILE, JSON.stringify(dati));
    } catch { /* il registro non deve mai fermare KORTEX */ }
  }, 800);
  timerSalva.unref?.();
}

const oggi = () => new Date().toISOString().slice(0, 10);

export function registraChiamata({ ia, ruolo, secondi, ok, limitato }) {
  const d = carica();
  const t = Date.now();
  d.chiamate.push({ t, ia, ok: !!ok });
  const tot = d.totali;
  tot.secondiIA += secondi || 0;
  const p = (tot.perIA[ia] ??= { chiamate: 0, ok: 0, secondi: 0 });
  p.chiamate++; if (ok) p.ok++; p.secondi += secondi || 0;
  if (limitato) {
    // il limite vero: quante chiamate c'erano nella finestra quando si è fermata
    const n = d.chiamate.filter((c) => c.ia === ia && t - c.t < FINESTRA).length;
    if (n > 3) d.limiti[ia] = n;
    d.limitatoIl ??= {};
    d.limitatoIl[ia] = t;
  }
  salva();
}

export function registraRichiesta({ compiti = 0, compitiOk = 0, file = 0 }) {
  const d = carica();
  const tot = d.totali;
  tot.richieste++; tot.compiti += compiti; tot.compitiOk += compitiOk; tot.file += file;
  tot.primoGiorno ??= oggi();
  tot.perGiorno[oggi()] = (tot.perGiorno[oggi()] || 0) + 1;
  salva();
}

// Il carburante di un'IA: 1 = pieno, 0 = vuoto. Con "stimato" vero finché il limite non è stato imparato.
export function carburante(ia, config) {
  const d = carica();
  const limite = config?.limiti5h?.[ia] || d.limiti[ia] || LIMITI_INIZIALI[ia] || 100;
  const usate = d.chiamate.filter((c) => c.ia === ia && Date.now() - c.t < FINESTRA).length;
  const prima = d.chiamate.filter((c) => c.ia === ia && Date.now() - c.t < FINESTRA)[0];
  return {
    usate,
    limite,
    resto: Math.max(0, 1 - usate / limite),
    stimato: !d.limiti[ia] && !config?.limiti5h?.[ia],
    // quando la chiamata più vecchia della finestra esce dalle 5 ore, si libera un posto
    liberaTra: prima ? Math.max(0, FINESTRA - (Date.now() - prima.t)) : 0,
  };
}

export function statistiche() {
  const d = carica();
  const tot = d.totali;
  const giorni = Object.entries(tot.perGiorno).sort((a, b) => a[0].localeCompare(b[0]));
  return { ...tot, giorni, limiti: { ...LIMITI_INIZIALI, ...d.limiti } };
}
