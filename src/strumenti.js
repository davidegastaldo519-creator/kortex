import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { DIR_CONFIG, RADICE } from './config.js';

// Gli STRUMENTI sono i programmi esterni che le IA possono comandare: Blender, un server, un gioco.
// Ognuno è descritto da una piccola scheda .json. Le schede dell'utente stanno nella sua
// configurazione (così restano sue e nessun aggiornamento le tocca); quelle predefinite vivono
// nella cartella "strumenti/" di KORTEX e vengono copiate la prima volta.
export const DIR_STRUMENTI = path.join(DIR_CONFIG, 'strumenti');
export const DIR_SCHEDE = path.join(RADICE, 'strumenti');

// Nelle schede i percorsi si scrivono con la ~ davanti: qui diventa la cartella di casa.
// Solo la ~ all'inizio: una ~ in mezzo al testo resta com'è.
export function espandiPercorso(testo) {
  if (typeof testo !== 'string') return testo;
  if (testo === '~') return os.homedir();
  if (testo.startsWith('~/')) return path.join(os.homedir(), testo.slice(2));
  return testo;
}

// Da dove si leggono le schede: di solito la cartella dell'utente, ma la configurazione può
// indicarne un'altra (serve anche alle prove, che lavorano in una cartella temporanea).
export function cartellaStrumenti(config) {
  const sua = config?.cartellaStrumenti;
  return sua ? espandiPercorso(sua) : DIR_STRUMENTI;
}

// Copia le schede predefinite nella cartella dell'utente, ma SOLO quelle che non ci sono già:
// una scheda modificata dall'utente non viene mai sovrascritta.
// Restituisce i nomi dei file copiati davvero.
export function copiaSchedePredefinite(opz = {}) {
  const origine = opz.origine || DIR_SCHEDE;
  const destinazione = opz.destinazione || DIR_STRUMENTI;
  const copiati = [];
  try {
    fs.mkdirSync(destinazione, { recursive: true });
    if (!fs.existsSync(origine)) return copiati;
    for (const nome of fs.readdirSync(origine)) {
      if (!nome.toLowerCase().endsWith('.json')) continue;
      const da = path.join(origine, nome);
      const a = path.join(destinazione, nome);
      if (fs.existsSync(a)) continue;
      try {
        fs.copyFileSync(da, a);
        copiati.push(nome);
      } catch (e) {
        console.error(`Strumenti: non riesco a copiare la scheda ${nome} (${e.message}).`);
      }
    }
  } catch (e) {
    console.error(`Strumenti: non riesco a preparare la cartella ${destinazione} (${e.message}).`);
  }
  return copiati;
}

// Legge una scheda e mette i valori di riserva dove manca qualcosa.
function leggiScheda(percorso) {
  const s = JSON.parse(fs.readFileSync(percorso, 'utf8'));
  const id = String(s.id || path.basename(percorso, '.json')).toLowerCase();
  return {
    id,
    nome: s.nome || id,
    icona: s.icona || '◆',
    tasto: s.tasto || '',
    descrizione: s.descrizione || '',
    permessi: s.permessi || 'conferma',
    stato: s.stato || null,
    avviso: s.avviso || '',
    mcp: s.mcp || null,
    contesto: s.contesto || '',
    progetti: Array.isArray(s.progetti) ? s.progetti : [],
    percorso,
  };
}

// Tutte le schede leggibili della cartella dell'utente. Quelle rotte vengono saltate
// con una riga nel registro: una scheda sbagliata non deve fermare KORTEX.
export function caricaStrumenti(cartella = DIR_STRUMENTI) {
  const fuori = [];
  let nomi = [];
  try {
    nomi = fs.readdirSync(cartella);
  } catch {
    return fuori;
  }
  for (const nome of nomi.sort()) {
    if (!nome.toLowerCase().endsWith('.json')) continue;
    const percorso = path.join(cartella, nome);
    try {
      fuori.push(leggiScheda(percorso));
    } catch (e) {
      console.error(`Strumenti: salto la scheda ${nome}, non riesco a leggerla (${e.message}).`);
    }
  }
  return fuori;
}

export function strumentoPerId(id, cartella = DIR_STRUMENTI) {
  const q = String(id || '').toLowerCase();
  if (!q) return null;
  return caricaStrumenti(cartella).find((s) => s.id === q) || null;
}

// Gli strumenti validi per un progetto: "progetti" vuoto vuol dire "va bene per tutti".
export function strumentiPerProgetto(nomeProgetto, cartella = DIR_STRUMENTI) {
  const q = String(nomeProgetto || '').toLowerCase();
  return caricaStrumenti(cartella).filter(
    (s) => !s.progetti.length || s.progetti.some((p) => String(p).toLowerCase() === q)
  );
}

// Lo strumento è acceso? Per ora si guarda se risponde su una porta.
// true = acceso, false = spento, null = non c'è niente da controllare.
// Non lancia mai eccezioni e si arrende dopo mezzo secondo.
export function controllaStato(strumento) {
  const st = strumento?.stato;
  if (!st || st.tipo !== 'porta') return Promise.resolve(null);
  return new Promise((risolvi) => {
    let fatto = false;
    const chiudi = (acceso, presa) => {
      if (fatto) return;
      fatto = true;
      try { presa?.destroy(); } catch { /* già chiusa */ }
      risolvi(acceso);
    };
    let presa;
    try {
      presa = net.createConnection({ host: st.host || 'localhost', port: Number(st.porta) || 0 });
    } catch {
      return risolvi(false);
    }
    presa.setTimeout(500);
    presa.once('connect', () => chiudi(true, presa));
    presa.once('timeout', () => chiudi(false, presa));
    presa.once('error', () => chiudi(false, presa));
  });
}

// @blender nella richiesta: dà quello strumento alle IA. Le @ che non sono strumenti si ignorano
// (le usa anche il database per le sue voci).
export function trovaMenzioni(testo, cartella = DIR_STRUMENTI) {
  const t = String(testo || '');
  if (!t.includes('@')) return [];
  const tutti = caricaStrumenti(cartella);
  if (!tutti.length) return [];
  const trovati = new Map();
  for (const m of t.matchAll(/@([\w\-.]+)/g)) {
    const q = m[1].toLowerCase();
    const s = tutti.find((x) => x.id === q);
    if (s && !trovati.has(s.id)) trovati.set(s.id, s);
  }
  return [...trovati.values()];
}

// Toglie dalla richiesta le parole @id degli strumenti riconosciuti e ripulisce gli spazi.
export function togliMenzioni(testo, strumenti) {
  let t = String(testo || '');
  for (const s of strumenti || []) {
    const id = String(s.id || '').replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
    if (!id) continue;
    t = t.replace(new RegExp('@' + id + '\\b', 'gi'), ' ');
  }
  return t.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim();
}

// Il blocco di testo che spiega gli strumenti alle IA: va nel prompt di tutti i ruoli.
export function contestoStrumenti(strumenti) {
  const l = strumenti || [];
  if (!l.length) return '';
  const voci = l.map((s) => {
    const righe = [`- ${s.nome}${s.descrizione ? ': ' + s.descrizione : ''}`];
    if (s.contesto) righe.push('  ' + String(s.contesto).trim().split('\n').join('\n  '));
    if (s.permessi === 'lettura') righe.push(`  Su ${s.nome} puoi solo LEGGERE e guardare: non modificare niente.`);
    return righe.join('\n');
  });
  return `\nSTRUMENTI ESTERNI A DISPOSIZIONE (usali per fare il lavoro, non chiedere all'utente di farlo):\n${voci.join('\n')}\n`;
}

// Gli argomenti da aggiungere alla riga di comando di Claude per dargli questi strumenti.
// Un solo --mcp-config con tutti i server dentro, e un --allowedTools con i loro nomi.
export function argomentiMcp(strumenti) {
  const conMcp = (strumenti || []).filter((s) => s?.mcp?.command);
  if (!conMcp.length) return [];
  const mcpServers = {};
  for (const s of conMcp) {
    mcpServers[s.id] = {
      command: espandiPercorso(s.mcp.command),
      args: (s.mcp.args || []).map((a) => espandiPercorso(a)),
    };
  }
  return [
    '--mcp-config', JSON.stringify({ mcpServers }),
    '--allowedTools', conMcp.map((s) => `mcp__${s.id}`).join(' '),
  ];
}

// L'avviso da mostrare nell'OUTPUT quando lo strumento risulta spento.
export function avvisoSpento(strumento) {
  const nome = strumento?.nome || strumento?.id || 'lo strumento';
  if (strumento?.avviso) return `△ ${nome} sembra spento: ${strumento.avviso}`;
  return `△ ${nome} sembra spento: accendilo e riprova`;
}
