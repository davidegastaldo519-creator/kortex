import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn, execFile, execFileSync } from 'node:child_process';
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

// Le regole dei comandi Bash della scheda, in due elenchi: quelle di sola lettura e quelle
// che modificano. Si scrivono come le vuole Claude, per esempio "Bash(gh repo view:*)".
function leggiBash(b) {
  if (!b || typeof b !== 'object') return null;
  const elenco = (x) => (Array.isArray(x) ? x.map((r) => String(r).trim()).filter(Boolean) : []);
  const fuori = { lettura: elenco(b.lettura), scrittura: elenco(b.scrittura) };
  return fuori.lettura.length || fuori.scrittura.length ? fuori : null;
}

// Mette i valori di riserva dove la scheda non dice niente.
function normalizzaScheda(s, percorso) {
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
    avvia: s.avvia || '',
    mcp: s.mcp || null,
    bash: leggiBash(s.bash),
    contesto: s.contesto || '',
    progetti: Array.isArray(s.progetti) ? s.progetti : [],
    percorso,
  };
}


// Le schede predefinite di KORTEX, lette una volta sola: servono a completare quelle dell'utente.
let cachePredefinite = null;
function predefinite() {
  if (cachePredefinite) return cachePredefinite;
  cachePredefinite = {};
  try {
    for (const nome of fs.readdirSync(DIR_SCHEDE)) {
      if (!nome.toLowerCase().endsWith('.json')) continue;
      try {
        const grezza = JSON.parse(fs.readFileSync(path.join(DIR_SCHEDE, nome), 'utf8'));
        const id = String(grezza.id || path.basename(nome, '.json')).toLowerCase();
        cachePredefinite[id] = { grezza };
      } catch { /* una scheda rotta non deve fermare niente */ }
    }
  } catch { /* cartella assente: nessuna predefinita */ }
  return cachePredefinite;
}
// I campi scritti a blocchetto: qui l'eredità va guardata anche dentro, voce per voce, così una
// scheda vecchia dell'utente riceve le novità (per esempio "mostra" dentro "stato") senza perdere
// quello che ha già scritto lei.
const CAMPI_A_BLOCCHETTO = ['stato', 'bash'];
const blocchetto = (x) => !!x && typeof x === 'object' && !Array.isArray(x);

// Unisce la scheda predefinita di KORTEX con quella dell'utente: vince sempre l'utente, la
// predefinita riempie solo i buchi. Nessun file viene riscritto, la fusione vive in memoria.
function fondiSchede(pred, sua) {
  const fuori = { ...pred, ...sua };
  for (const k of CAMPI_A_BLOCCHETTO) {
    if (blocchetto(pred?.[k]) && blocchetto(sua?.[k])) fuori[k] = { ...pred[k], ...sua[k] };
  }
  return fuori;
}

// Tutte le schede leggibili della cartella dell'utente. Quelle rotte vengono saltate
// con una riga nel registro: una scheda sbagliata non deve fermare KORTEX.
export function caricaStrumenti(cartella = DIR_STRUMENTI) {
  const fuori = [];
  const base = predefinite();
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
      // i campi che la scheda dell'utente non ha (arrivati con un aggiornamento: lo stato di tipo
      // comando, le regole bash, il contesto) si prendono dalla scheda predefinita con lo stesso
      // id, senza toccare il suo file né i valori che ha già
      const grezza = JSON.parse(fs.readFileSync(percorso, 'utf8'));
      const id = String(grezza.id || path.basename(nome, '.json')).toLowerCase();
      const pred = base[id];
      fuori.push(normalizzaScheda(pred ? fondiSchede(pred.grezza, grezza) : grezza, percorso));
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

// Lo strumento è acceso? Due modi, secondo il campo "stato" della scheda:
//   { "tipo": "porta",   "host": "localhost", "porta": 9876 }  -> risponde su quella porta?
//   { "tipo": "comando", "comando": "gh auth status" }         -> quel comando esce con 0?
// true = acceso, false = spento, null = non c'è niente da controllare (o non si può sapere).
// Non lancia mai eccezioni.
export function controllaStato(strumento) {
  return statoConDettaglio(strumento).then((r) => r.acceso).catch(() => null);
}

// La prova della porta: si arrende dopo mezzo secondo.
function provaPorta(st) {
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

// Quanto si aspetta un comando di controllo prima di ucciderlo, e quanto si tiene buono il
// risultato: lanciare gh a ogni aggiornamento della pagina rallenterebbe tutto.
const TEMPO_COMANDO = 3000;
const DURATA_CACHE_STATO = 30000;
const LUNGHEZZA_DETTAGLIO = 40;

// Lancia un comando corto senza passare da una shell (niente apici, niente sorprese) e non
// lancia mai eccezioni. Risponde con un esito in parole:
//   'ok' = uscito con 0 · 'male' = uscito con un codice diverso da 0 · 'scaduto' = tempo finito,
//   processo ucciso · 'manca' = il programma non c'è (o non si può eseguire).
function lanciaBreve(comando) {
  return new Promise((risolvi) => {
    const pezzi = String(comando || '').trim().split(/\s+/).filter(Boolean);
    if (!pezzi.length) return risolvi({ esito: 'manca', testo: '' });
    let fatto = false;
    const chiudi = (esito, testo = '') => { if (!fatto) { fatto = true; risolvi({ esito, testo }); } };
    try {
      execFile(pezzi[0], pezzi.slice(1), { timeout: TEMPO_COMANDO, killSignal: 'SIGKILL', maxBuffer: 256 * 1024 }, (err, stdout) => {
        if (!err) return chiudi('ok', String(stdout || ''));
        if (err.code === 'ENOENT' || err.code === 'EACCES') return chiudi('manca');
        if (err.killed || err.signal) return chiudi('scaduto');
        chiudi('male', String(stdout || ''));
      });
    } catch { chiudi('manca'); }
  });
}

// La prima riga utile dell'output, ripulita e tagliata: è quella che la tessera mostra accanto
// allo stato (per GitHub, il nome dell'account collegato).
function primaRigaUtile(testo) {
  const riga = String(testo || '').split('\n').map((r) => r.replace(/\s+/g, ' ').trim()).find(Boolean) || '';
  return riga.length > LUNGHEZZA_DETTAGLIO ? riga.slice(0, LUNGHEZZA_DETTAGLIO - 1) + '…' : riga;
}

// La prova del comando: acceso se esce con 0, spento se esce con un codice diverso o se scade il
// tempo, "non si può sapere" se il programma non è installato. Se è acceso e la scheda ha anche
// "mostra", quel comando dà il dettaglio da far vedere; se non riesce, lo stato resta buono.
async function provaComando(st) {
  const r = await lanciaBreve(st.comando);
  if (r.esito === 'manca') return { acceso: null };
  if (r.esito !== 'ok') return { acceso: false };
  const fuori = { acceso: true };
  if (st.mostra) {
    const m = await lanciaBreve(st.mostra);
    const d = m.esito === 'ok' ? primaRigaUtile(m.testo) : '';
    if (d) fuori.dettaglio = d;
  }
  return fuori;
}

// I risultati tenuti da parte: una voce per coppia comando+mostra, con l'ora in cui è arrivata.
// In "inVolo" ci sono le prove ancora in corso, così due aggiornamenti vicini non lanciano il
// comando due volte.
const cacheStato = new Map();
const inVolo = new Map();
const chiaveStato = (st) => `${st?.comando || ''}\n${st?.mostra || ''}`;

// Butta via i risultati tenuti da parte: senza argomenti svuota tutto (lo fa il tasto CONTROLLA
// della pagina STRUMENTI), con uno strumento o una chiave svuota solo quello.
export function svuotaCacheStato(cosa) {
  try {
    if (cosa === undefined || cosa === null) { cacheStato.clear(); return; }
    cacheStato.delete(typeof cosa === 'string' ? cosa : chiaveStato(cosa.stato || cosa));
  } catch { /* la cache non deve mai fermare KORTEX */ }
}

// Lo stato con il dettaglio da mostrare: { acceso: true|false|null, dettaglio?: 'testo' }.
// Non lancia mai eccezioni: qualunque guaio diventa { acceso: null }.
export function statoConDettaglio(strumento) {
  const st = strumento?.stato;
  try {
    if (!st) return Promise.resolve({ acceso: null });
    if (st.tipo === 'porta') return provaPorta(st).then((acceso) => ({ acceso }), () => ({ acceso: null }));
    if (st.tipo !== 'comando' || !String(st.comando || '').trim()) return Promise.resolve({ acceso: null });
    const chiave = chiaveStato(st);
    const tenuto = cacheStato.get(chiave);
    if (tenuto && Date.now() - tenuto.t < DURATA_CACHE_STATO) return Promise.resolve(tenuto.valore);
    const giaInCorso = inVolo.get(chiave);
    if (giaInCorso) return giaInCorso;
    const prova = provaComando(st)
      .catch(() => ({ acceso: null }))
      .then((valore) => {
        cacheStato.set(chiave, { t: Date.now(), valore });
        inVolo.delete(chiave);
        return valore;
      });
    inVolo.set(chiave, prova);
    return prova;
  } catch {
    return Promise.resolve({ acceso: null });
  }
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

// ---------- i comandi Bash: le regole da passare a Claude ----------

// I comandi che modificano davvero qualcosa, nella forma esatta che vuole --disallowedTools.
// È QUESTO il recinto: in autonomia totale Claude parte con --dangerously-skip-permissions e
// le regole di --allowedTools non contano più niente (una lista di permessi apre le porte, non
// le chiude), mentre la lista dei divieti regge anche lì e vince sempre sul permesso.
// Attenzione: il confronto è per prefisso, quindi è una rete di sicurezza contro gli errori,
// non una gabbia: scritto in un altro modo (`git -C . commit`) lo stesso comando passerebbe.
export const BLOCCO_BASH = [
  'Bash(git push:*)',
  'Bash(git commit:*)',
  'Bash(git reset:*)',
  'Bash(gh repo create:*)',
  'Bash(gh repo delete:*)',
  'Bash(gh repo edit:*)',
  'Bash(gh pr create:*)',
  'Bash(gh pr merge:*)',
  'Bash(gh pr close:*)',
  'Bash(gh issue create:*)',
  'Bash(gh issue close:*)',
  'Bash(gh issue delete:*)',
  'Bash(gh issue edit:*)',
  'Bash(gh release create:*)',
  'Bash(gh release delete:*)',
  'Bash(gh api -X:*)',
  'Bash(gh api --method:*)',
];

// Gli argomenti da aggiungere alla riga di comando di Claude per i comandi Bash degli strumenti
// (per esempio gh e git della scheda GitHub). Forma provata sulla CLI: una sola occorrenza di
// ogni opzione, le regole separate da virgola senza spazio dopo, tutto in un unico argomento.
//   permessi "lettura" o "conferma" -> solo le regole di lettura, più la lista dei divieti
//   permessi "libero"               -> lettura e scrittura, nessun divieto
// Se fra gli strumenti ce n'è anche uno solo non libero, la lista dei divieti vale per tutti:
// le opzioni sono una per comando, non una per strumento, e il divieto vince sempre.
// Non lancia mai eccezioni: nel dubbio restituisce un elenco vuoto.
export function argomentiBash(strumenti) {
  try {
    const conBash = (strumenti || []).filter((s) => s?.bash);
    if (!conBash.length) return [];
    const permette = [];
    let serveIlBlocco = false;
    for (const s of conBash) {
      for (const r of s.bash.lettura || []) if (!permette.includes(r)) permette.push(r);
      if (s.permessi === 'libero') {
        for (const r of s.bash.scrittura || []) if (!permette.includes(r)) permette.push(r);
      } else serveIlBlocco = true;
    }
    const fuori = [];
    if (permette.length) fuori.push('--allowedTools', permette.join(','));
    if (serveIlBlocco) fuori.push('--disallowedTools', BLOCCO_BASH.join(','));
    return fuori;
  } catch {
    return [];
  }
}

// L'avviso da mostrare nell'OUTPUT quando lo strumento risulta spento.
export function avvisoSpento(strumento) {
  const nome = strumento?.nome || strumento?.id || 'lo strumento';
  if (strumento?.avviso) return `△ ${nome} sembra spento: ${strumento.avviso}`;
  return `△ ${nome} sembra spento: accendilo e riprova`;
}

// ---------- il registro delle azioni: chi ha usato lo strumento, quando e per cosa ----------

const FILE_USO = path.join(DIR_CONFIG, 'strumenti-uso.json');
let usoInMemoria = null;
function leggiUso(file) {
  if (!file && usoInMemoria) return usoInMemoria;
  let d = {};
  try { d = JSON.parse(fs.readFileSync(file || FILE_USO, 'utf8')) || {}; } catch { d = {}; }
  if (!file) usoInMemoria = d;
  return d;
}

// Annota un'azione sullo strumento. Tiene le ultime 20 per ognuno. Non lancia mai eccezioni.
export function registraUso(id, { chi = 'tu', cosa = '' } = {}, file) {
  try {
    const d = leggiUso(file);
    const l = (d[id] ||= []);
    l.unshift({ t: Date.now(), chi, cosa: String(cosa).replace(/\s+/g, ' ').trim().slice(0, 120) });
    d[id] = l.slice(0, 20);
    fs.mkdirSync(path.dirname(file || FILE_USO), { recursive: true });
    fs.writeFileSync(file || FILE_USO, JSON.stringify(d));
  } catch { /* il registro non deve mai fermare KORTEX */ }
}

// Le ultime azioni di uno strumento (la più recente per prima) e quante sono di oggi.
export function usiStrumento(id, file) {
  const l = leggiUso(file)[id] || [];
  const oggi = new Date().toDateString();
  return { ultime: l, oggi: l.filter((x) => new Date(x.t).toDateString() === oggi).length };
}

// ---------- i controlli della scheda: cosa manca per far funzionare lo strumento ----------

function esiste(cmd) {
  if (!cmd) return false;
  if (cmd.includes('/')) return fs.existsSync(espandiPercorso(cmd));
  try { execFileSync('sh', ['-c', `command -v "$1"`, 'sh', cmd], { stdio: 'ignore', timeout: 2000 }); return true; } catch { return false; }
}

// L'elenco dei problemi che impediscono allo strumento di funzionare: vuoto = è tutto a posto.
// Sono i controlli della ricerca automatica: programma del server mcp, cartella del server, programma da avviare.
export function problemiScheda(s) {
  const p = [];
  if (s?.mcp?.command && !esiste(s.mcp.command)) p.push(`manca il programma "${s.mcp.command}" per il collegamento`);
  const args = s?.mcp?.args || [];
  const i = args.indexOf('--directory');
  if (i >= 0 && args[i + 1] && !fs.existsSync(espandiPercorso(args[i + 1]))) p.push(`manca la cartella del collegamento: ${args[i + 1]}`);
  if (s?.avvia && !esiste(String(s.avvia).split(/\s+/)[0])) p.push(`manca il programma da avviare: ${String(s.avvia).split(/\s+/)[0]}`);
  return p;
}

// Apre il programma dello strumento (per esempio Blender) staccato da KORTEX: resta aperto anche
// se KORTEX si chiude. Restituisce un testo da mostrare.
export function avviaApp(s) {
  if (!s?.avvia) return { ok: false, testo: `${s?.nome || 'lo strumento'} non ha un programma da avviare (campo "avvia" nella scheda)` };
  try {
    const p = spawn('sh', ['-c', s.avvia], { detached: true, stdio: 'ignore' });
    p.on('error', () => {});
    p.unref();
    return { ok: true, testo: `avvio ${s.nome}…` };
  } catch (e) {
    return { ok: false, testo: `non riesco ad avviare ${s.nome}: ${e.message}` };
  }
}
