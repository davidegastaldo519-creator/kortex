import React, { useState, useEffect, useRef, useCallback } from 'react';
import stringWidth from 'string-width';
import { render, Box, Text, useApp, useStdout, useInput } from 'ink';
import TextInput from 'ink-text-input';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { eseguiRichiesta, chatDiretta, catalogaCon, aggiornaMemoria } from './director.js';
import { applicaTema, TEMI } from './temi.js';
import { preferenze, ricorda, dimentica, percorsoPreferenze } from './memoria.js';
import { caricaStrumenti, controllaStato, avvisoSpento, cartellaStrumenti } from './strumenti.js';
import { campiona, hex, rgbHex } from './colori.js';
import * as db from './database.js';
import { apriStato, righeFile, diffColorato } from './state.js';
import { fermaTutti, chiudiTutto } from './adapters.js';
import { FILE_CONFIG } from './config.js';
import { Telemetria } from './telemetria.js';
import { PROFILI, applicaProfilo } from './profili.js';
import { PARAMETRI, MAPPATURE, cambia, applicaMappatura, applicaGrafica, salvaConfig } from './parametri.js';
import { elencoDestinazioni, Sessioni } from './terminale.js';
import { html, C, PAGINE, Intestazione, SPIN, GRAFICA } from './grafica.js';
import { BarraStato } from './barra.js';
import { I, applicaIcone, iconeNerd } from './icone.js';
import { carburante, registraRichiesta } from './uso.js';
import { git as gitCmd } from './state.js';
import { SchermoStabile } from './schermo.js';
import { StdinFiltrato, accendiMouse, spegniMouse, eventi as eventiMouse, gestisciClick, gestisciRotella } from './mouse.js';
import { elencoProgetti, creaProgetto, importaProgetto, registraProgetto, toccaProgetto, progettoDi, elencoChat, creaChat, salvaChat, caricaChat, riassuntoChat, istantanea, elencoIstantanee, ripristina, cambiatiDa, diffDa, ripristinaFile } from './progetti.js';
import { RUOLI, FILTRI, SCHEDE, BarraAllegati, PaginaSelettore, PaginaTavolozza, PaginaStatistiche, Finestra, TUTORIAL, PaginaLavoro, PaginaControllo, PaginaStudio, PaginaGuida, PaginaProgetti, PaginaDatabase } from './pagine.js';

const CONSIGLI = [
  'Ctrl+P apre la tavolozza: scrivi due lettere e trovi qualsiasi comando, pagina, tema, profilo o progetto.',
  'Ctrl+T sposta il cursore tra il terminale ($) e le IA (›). Ctrl+N cambia la scheda a destra.',
  'Dopo una richiesta, scheda DIFF: rivedi i file uno per uno. INVIO accetta, Ctrl+R lo riporta com\'era.',
  'Mentre la squadra lavora puoi scrivere la richiesta successiva: si mette in coda e parte da sola.',
  '/profilo minecraft prepara KORTEX per il server: terminale SSH in primo piano e operatore pronto.',
  'Trascina un file o una foto nella finestra: si allega da solo. Ctrl+O fa uno screenshot.',
  'Il carburante in basso a destra stima quanto abbonamento resta nelle ultime 5 ore.',
  '/chiedi davanti alla richiesta: il direttore può farti una domanda a risposta multipla prima di partire.',
  'La pagina STATISTICHE mostra richieste, compiti riusciti, file toccati e il tempo risparmiato.',
  '/chat claude per parlare con una sola IA, /team per tornare alla squadra.',
  'Ctrl+D cambia la macchina del terminale: PC, server SSH, console Python o Node.',
  'Col mouse: clic su pagine, schede, voci e pulsanti; rotella per scorrere. Shift+trascina seleziona il testo.',
];
const ora = () => new Date().toTimeString().slice(0, 8);
// un riquadro sopra gli altri non cancella quello che c'è sotto: lo riempio di spazi fino al bordo
// il testo d'aiuto delle righe di comando non deve mai andare a capo (sfonderebbe il riquadro)
const tagliaA = (t, n) => { const s = String(t); if (stringWidth(s) <= n) return s; let o = ''; for (const ch of s) { if (stringWidth(o + ch) > n - 1) break; o += ch; } return o + '…'; };
const riempiA = (t, n) => { const s = String(t); const l = stringWidth(s); return l >= n ? s : s + ' '.repeat(n - l); };
const ruoliIniziali = () => Object.fromEntries(RUOLI.map(([id]) => [id, { stato: 'attesa', ia: null }]));
// Riconosco il tipo di evento dal simbolo e dal rientro: la riga di avvio della CLI comincia
// subito con ▸, quella dell'uso di uno strumento è rientrata di due spazi.
const tipoDa = (t) => (/^▸/.test(t) ? 'avvio' : /^\s+▸/.test(t) ? 'strumento' : /^\s*✗/.test(t) ? 'errore' : /^\s*△/.test(t) ? 'avviso' : /^\s*✓/.test(t) ? 'fine' : 'info');

function percorsiIncollati(testo) {
  const trovati = [];
  const re = /'([^']+)'|"([^"]+)"|(?:file:\/\/)?((?:~|\/)(?:\\ |[^\s'"])+)/g;
  let m;
  while ((m = re.exec(testo))) {
    let p = (m[1] || m[2] || m[3] || '').replace(/^file:\/\//, '').replace(/\\ /g, ' ');
    try { p = decodeURIComponent(p); } catch { /* */ }
    if (p.startsWith('~')) p = path.join(os.homedir(), p.slice(1));
    try { if (fs.statSync(p).isFile()) trovati.push({ intero: m[0], percorso: p }); } catch { /* */ }
  }
  return trovati;
}

// Ricerca "a salti": le lettere scritte devono comparire in ordine; vince chi le ha più vicine e all'inizio.
function cercaVoci(voci, q) {
  if (!q) return voci;
  const punti = [];
  for (const v of voci) {
    const testo = `${v.etichetta} ${v.gruppo} ${v.descr}`.toLowerCase();
    let pos = -1, punteggio = 0, ultimo = -2;
    for (const ch of q) {
      if (ch === ' ') continue;
      pos = testo.indexOf(ch, pos + 1);
      if (pos < 0) break;
      punteggio += pos === ultimo + 1 ? 3 : 1;
      if (pos === 0 || testo[pos - 1] === ' ') punteggio += 2;
      ultimo = pos;
    }
    if (pos < 0) continue;
    if (v.etichetta.toLowerCase().includes(q)) punteggio += 20;
    punti.push({ v, p: punteggio - testo.length * 0.01 });
  }
  return punti.sort((a, b) => b.p - a.p).map((x) => x.v);
}

function indiceFile(cwd) {
  const out = [];
  const salta = new Set(['node_modules', '.git', '.kortex', '.cache', 'dist', 'build']);
  const visita = (dir, prof) => {
    if (out.length > 3000 || prof < 0) return;
    let voci;
    try { voci = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const v of voci) {
      if (v.name.startsWith('.') || salta.has(v.name)) continue;
      const p = path.join(dir, v.name);
      if (v.isDirectory()) visita(p, prof - 1);
      else if (v.isFile()) out.push(p);
    }
  };
  visita(cwd, 3);
  const casa = os.homedir();
  for (const d of ['Downloads', 'Scaricati', 'Pictures', 'Immagini', 'Pictures/Screenshots', 'Immagini/Screenshot', 'Desktop', 'Scrivania', 'Documents', 'Documenti', 'kortex-database', 'storage/shared/Download', 'storage/shared/DCIM', 'storage/shared/Pictures', 'storage/shared/Documents']) visita(path.join(casa, d), 2);
  return [...new Set(out)];
}

function App({ config, disponibili, cwd: cwdIniziale, versione, suoni }) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [dim, setDim] = useState({ c: stdout.columns || 80, r: stdout.rows || 24 });
  const [pagina, setPagina] = useState('lavoro');
  const [cwd, setCwd] = useState(cwdIniziale);
  const [progetto, setProgetto] = useState(() => progettoDi(cwdIniziale));
  const [chat, setChat] = useState(null);
  const [selezione, setSelezione] = useState({ progetto: 0, chat: 0 });
  const [colonna, setColonna] = useState('progetti');
  const [versioneProgetti, setVersioneProgetti] = useState(0);
  const [dbCategoria, setDbCategoria] = useState('tutte');
  const [dbQuery, setDbQuery] = useState('');
  const [dbSel, setDbSel] = useState(0);
  const [dbVersione, setDbVersione] = useState(0);
  const [notifiche, setNotifiche] = useState([]);
  const [transizione, setTransizione] = useState(0);
  const [eventi, setEventi] = useState({ db: 0, dbTesto: '', prog: 0, progTesto: '', memoria: 0 });
  const inizioLavoro = useRef(0);
  const [scheda, setScheda] = useState('agenti');
  const [fuoco, setFuoco] = useState('ia');
  // l'OUTPUT: messaggi di sistema (titoli, esiti, i tuoi messaggi) e bolle delle IA
  const messaggi = useRef([{ tipo: 'sistema', testo: '' }]);
  const bolleAperte = useRef(new Map());
  const [, setVersioneMsg] = useState(0);
  const timerMsg = useRef(null);
  // tanti pezzi di testo al secondo: ridisegno al massimo ogni 60 ms
  const toccaMsg = () => { if (!timerMsg.current) timerMsg.current = setTimeout(() => { timerMsg.current = null; setVersioneMsg((v) => v + 1); }, 60); };
  const svuotaMsg = () => { messaggi.current = [{ tipo: 'sistema', testo: '' }]; bolleAperte.current.clear(); toccaMsg(); };
  const [log, setLog] = useState([]);
  const [ruoli, setRuoli] = useState(ruoliIniziali());
  const [compiti, setCompiti] = useState([]);
  const [inputIA, setInputIA] = useState('');
  const [inputShell, setInputShell] = useState('');
  const [occupato, setOccupato] = useState(false);
  const [tick, setTick] = useState(0);
  const [file, setFile] = useState([]);
  const [costo, setCosto] = useState(0);
  const [modo, setModo] = useState(null);
  const [scorri, setScorri] = useState({ lavoro: 0, studio: 0, guida: 0, registro: 0, shell: 0, diff: 0, selettore: 0, controllo: 0, database: 0 });
  const [selezionato, setSelezionato] = useState(0);
  const [messaggio, setMessaggio] = useState('');
  const [lavagna, setLavagna] = useState({});
  const [allegati, setAllegati] = useState([]);
  const [selettore, setSelettore] = useState(null);
  const [filtro, setFiltro] = useState('tutti');
  const [iDest, setIDest] = useState(0);
  const [shellInCorso, setShellInCorso] = useState(false);
  const [coda, setCoda] = useState([]);
  const [domanda, setDomanda] = useState(null);
  const [lampeggio, setLampeggio] = useState(0);
  const [guardiano, setGuardiano] = useState(false);
  const [sincronizzata, setSincronizzata] = useState(false);
  const [ramo, setRamo] = useState(null);
  // le finestre sopra a tutto: il giro guidato al primo avvio, le novità dopo un aggiornamento
  const [finestra, setFinestra] = useState(() => (!config.tutorialFatto ? { tipo: 'tutorial', passo: 0 } : config.ultimaVersione !== versione && config.ultimaVersione ? { tipo: 'novita' } : null));
  const avvisiCarburante = useRef({});
  const [, ridisegna] = useState(0);
  const storia = useRef([]);
  const massimi = useRef({});
  const stato = useRef(null);
  const tel = useRef(null);
  const sessioni = useRef(null);
  const cacheProgetti = useRef({ chiave: null, progetti: [], chat: [], istantanee: [] });
  const cacheDb = useRef({ chiave: null });
  const cacheDiff = useRef({ t: 0, cwd: null, dati: null });
  const domandaAperta = useRef(null);
  const codaRef = useRef([]);
  const occupatoRef = useRef(false);
  const timerSincro = useRef(null);
  if (!stato.current) stato.current = apriStato(cwd);
  if (!tel.current) tel.current = new Telemetria(Object.keys(disponibili));
  if (!sessioni.current) sessioni.current = new Sessioni(cwd);
  const destinazioni = elencoDestinazioni(config);
  const dest = destinazioni[Math.min(iDest, destinazioni.length - 1)];
  const sessione = sessioni.current.di(dest);
  const suona = (n) => { try { suoni?.suona(n); } catch { /* */ } };

  // Mentre trascini il bordo della finestra arrivano decine di ridimensionamenti: aspetto che ti fermi,
  // pulisco lo schermo (altrimenti restano pezzi del disegno vecchio) e ridisegno alla misura nuova.
  useEffect(() => {
    let attesa = null;
    const f = () => {
      clearTimeout(attesa);
      attesa = setTimeout(() => {
        stdout.write('\x1b[2J\x1b[3J\x1b[H');
        setDim({ c: stdout.columns, r: stdout.rows });
      }, 90);
    };
    stdout.on('resize', f);
    return () => { clearTimeout(attesa); stdout.off('resize', f); };
  }, [stdout]);

  useEffect(() => {
    const passo = config.animazioni === 'spenta' ? 0 : config.animazioni === 'leggera' ? 1000 : occupato ? 120 : 250;
    if (!passo) return;
    const t = setInterval(() => setTick((x) => x + 1), passo);
    return () => clearInterval(t);
  }, [config.animazioni, occupato]);

  useEffect(() => {
    const leggi = () => setRamo((gitCmd(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']) || '').trim() || null);
    leggi();
    const t = setInterval(() => {
      leggi();
      // il carburante: avviso una volta quando un'IA scende sotto il 20%
      for (const d of Object.values(disponibili)) {
        if (!d.ok || d.id === 'ollama') continue;
        const f = carburante(d.id, config);
        if (f.resto < 0.2 && !avvisiCarburante.current[d.id]) { avvisiCarburante.current[d.id] = true; ui.current.notifica(`${I.carburante} ${d.nome}: resta circa il ${Math.round(f.resto * 100)}% (stima)`, 'avviso'); }
        if (f.resto > 0.5) avvisiCarburante.current[d.id] = false;
      }
    }, 5000);
    return () => clearInterval(t);
  }, [cwd]);

  useEffect(() => {
    const t = setInterval(() => { tel.current.campiona(); setNotifiche((n) => n.filter((x) => Date.now() - x.t < 5000)); ridisegna((x) => x + 1); }, 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!transizione || config.animazioni !== 'piena') return;
    const t = setInterval(() => { if (Date.now() - transizione > 200) { clearInterval(t); setTransizione(0); } else ridisegna((x) => x + 1); }, 25);
    return () => clearInterval(t);
  }, [transizione]);

  const scrivi = useCallback((testo) => {
    const l = messaggi.current;
    let u = l[l.length - 1];
    if (!u || u.tipo !== 'sistema') { u = { tipo: 'sistema', testo: '' }; l.push(u); }
    u.testo += String(testo);
    if (u.testo.length > 60000) u.testo = u.testo.slice(-50000);
    if (l.length > 300) messaggi.current = l.slice(-250);
    toccaMsg();
  }, []);
  const bolla = (t, meta) => {
    let m = bolleAperte.current.get(meta.chiave);
    if (!m) {
      m = { tipo: 'ia', ia: meta.ia, ruolo: meta.ruolo, compito: meta.compito ?? null, testo: '', inizio: Date.now(), fine: null };
      bolleAperte.current.set(meta.chiave, m);
      messaggi.current.push(m);
    }
    m.testo += String(t);
    toccaMsg();
  };
  const bollaFine = (chiave) => {
    const m = bolleAperte.current.get(chiave);
    if (!m) return;
    m.fine = Date.now();
    bolleAperte.current.delete(chiave);
    // una bolla rimasta vuota (l'IA non ha scritto niente) non serve
    if (!m.testo.trim()) messaggi.current = messaggi.current.filter((x) => x !== m);
    toccaMsg();
  };
  const aggiornaFile = useCallback(() => setFile(righeFile(cwd)), [cwd]);

  const ui = useRef(null);
  if (!ui.current) {
    ui.current = {
      out: (t) => scrivi(t),
      bolla,
      bollaFine,
      titolo: (t) => scrivi(`\n▌ ${t}\n`),
      log: (m, meta = {}) => { if (process.env.KORTEX_DEBUG_LOG) { try { fs.appendFileSync(process.env.KORTEX_DEBUG_LOG, `${ora()} ${meta.ia || '-'} ${meta.ruolo || '-'} ${m}\n`); } catch { /* */ } } setLog((p) => [...p.slice(-1500), { ora: ora(), testo: String(m), ia: meta.ia || null, ruolo: meta.ruolo || '', tipo: meta.tipo || tipoDa(String(m)) }]); },
      ruolo: (r, s, ia) => setRuoli((p) => ({ ...p, [r]: { stato: s, ia: ia ?? p[r]?.ia ?? null } })),
      costo: (x) => setCosto((v) => v + x),
      compiti: (l) => setCompiti(l),
      pensiero: (tipo, testo) => setLavagna((l) => ({ ...l, [tipo]: tipo === 'richiesta' ? testo : l[tipo] && tipo !== 'compiti' ? l[tipo] + '\n\n' + testo : testo, ...(tipo === 'richiesta' ? { compiti: '', piano: '', revisione: '' } : {}) })),
      aggiornaFile,
      notifica: (testo, tipo = 'info') => { setNotifiche((n) => [...n.slice(-3), { testo, tipo, t: Date.now() }]); suona(tipo === 'ok' ? 'ok' : tipo === 'errore' ? 'errore' : 'notifica'); },
      // la domanda del direttore: aspetta la risposta dell'utente (tasti 1-4, clic, o ESC)
      domanda: (d) => new Promise((res) => { domandaAperta.current = { ...d, res }; setDomanda({ ...d }); suona('notifica'); }),
    };
  }
  const segnaEvento = (dove, testo) => setEventi((e) => ({ ...e, [dove]: Date.now(), [dove + 'Testo']: testo }));
  const rispondiDomanda = (i) => {
    const d = domandaAperta.current;
    if (!d) return;
    domandaAperta.current = null;
    setDomanda(null);
    d.res(i === null ? null : d.opzioni[i] ?? null);
  };

  const contestoBase = () => ({ config, disponibili, cwd, stato: stato.current, ui: ui.current, tel: tel.current });
  const catalogatore = ({ nome, estratto: e, percorso }) => catalogaCon(contestoBase(), { nome, estratto: e, percorso });
  const catalogatorePronto = () => (config.ruoli.catalogatore || []).some((id) => disponibili[id]?.ok && !disponibili[id]?.limitato);

  // La sincronizzazione del database su GitHub: in sottofondo, senza fermare niente.
  const sincronizzaPresto = (ritardo = 15000) => {
    if (!db.statoGithub()) return;
    clearTimeout(timerSincro.current);
    timerSincro.current = setTimeout(() => {
      db.sincronizzaAsync().then((r) => { if (r) { setSincronizzata(true); ui.current.log(`» database sincronizzato: ${r}`, { tipo: 'info' }); } }).catch(() => {});
    }, ritardo);
  };

  useEffect(() => {
    aggiornaFile();
    const attive = Object.values(disponibili).filter((d) => d.ok).map((d) => d.nome);
    scrivi(`Benvenuto in ${config.brand.nome} ${versione}. Cartella di lavoro: ${cwd}\n` +
      `IA collegate: ${attive.join(', ') || 'nessuna — scrivi /ia per capire perché'}\n` +
      `Scrivi cosa vuoi fare nella riga › e premi INVIO. Ctrl+T per passare al terminale $. TAB per le altre pagine.\n`);
    // il guardiano del database: file nuovi catalogati da soli; prima una scansione di quello che c'è già
    let ferma = null;
    try {
      const cat = () => (catalogatorePronto() ? catalogatore : null);
      const nuova = (v) => { setDbVersione((x) => x + 1); segnaEvento('db', 'indicizzato'); ui.current.notifica(`📚 indicizzato: ${v.titolo}`, 'info'); sincronizzaPresto(); };
      ferma = db.sorveglia({ catalogatore: cat(), onVoce: nuova, onErrore: () => {} });
      setGuardiano(true);
      setTimeout(() => db.scansiona(cat(), nuova).catch(() => {}), 2500);
    } catch { setGuardiano(false); }
    // con GitHub collegato, all'avvio scarico le novità degli altri PC
    if (db.statoGithub()) db.sincronizzaAsync().then((r) => { if (r) { setSincronizzata(true); setDbVersione((x) => x + 1); ui.current.log(`» database allineato con GitHub: ${r}`, { tipo: 'info' }); } }).catch(() => {});
    return () => { ferma?.(); clearTimeout(timerSincro.current); };
  }, []);

  const apriProgetto = (percorso) => {
    sessioni.current.chiudiTutto();
    stato.current = apriStato(percorso);
    sessioni.current = new Sessioni(percorso);
    setCwd(percorso);
    setProgetto(progettoDi(percorso));
    setChat(null);
    setAllegati([]);
    setLavagna({});
    setCompiti([]);
    setRuoli(ruoliIniziali());
    setIDest(0);
    toccaProgetto(percorso);
    setVersioneProgetti((v) => v + 1);
    segnaEvento('prog', 'progetto aperto');
    setFile(righeFile(percorso));
    cacheDiff.current = { t: 0, cwd: null, dati: null };
    const v = progettoDi(percorso);
    scrivi(`\n▌ PROGETTO APERTO: ${v?.nome || path.basename(percorso)}   (${percorso})\n${v?.descrizione ? v.descrizione + '\n' : ''}Scrivi una richiesta per iniziare una chat nuova, oppure apri una chat esistente dalla pagina PROGETTI.\n`);
  };
  const apriChat = (c) => {
    setChat(c);
    storia.current = c.messaggi.map((m) => ({ chi: m.chi === 'utente' ? 'Utente' : 'KORTEX', testo: m.testo }));
    svuotaMsg();
    scrivi(`▌ CHAT: ${c.titolo}   (${c.messaggi.length} messaggi)\n`);
    for (const m of c.messaggi) scrivi(m.chi === 'utente' ? `\n› ${m.testo}\n` : `${m.testo}\n`);
    scrivi('\n▌ Continua da qui: la squadra ricorda questa conversazione.\n');
    segnaEvento('prog', 'chat riaperta');
    setPagina('lavoro');
    setVersioneProgetti((v) => v + 1);
  };
  const datiProgetti = () => {
    const progetti = elencoProgetti();
    const sel = progetti[Math.min(selezione.progetto, Math.max(0, progetti.length - 1))];
    const chiave = `${versioneProgetti}|${sel?.percorso}|${selezione.progetto}`;
    if (cacheProgetti.current.chiave !== chiave) {
      cacheProgetti.current = { chiave, progetti, chat: sel ? elencoChat(sel.percorso) : [], istantanee: sel ? elencoIstantanee(sel.percorso, 12) : [] };
    }
    return cacheProgetti.current;
  };
  const datiDb = () => {
    const chiave = `${dbVersione}|${dbCategoria}|${dbQuery}`;
    if (cacheDb.current.chiave !== chiave) {
      const q = dbQuery.trim().toLowerCase();
      const tutte = db.indice().filter((v) => (dbCategoria === 'tutte' || v.categoria === dbCategoria) && (!q || `${v.titolo} ${v.tag.join(' ')} ${v.descrizione} ${v.estratto}`.toLowerCase().includes(q)));
      cacheDb.current = { chiave, voci: tutte, conteggi: db.conteggi(), github: db.statoGithub() };
    }
    return cacheDb.current;
  };
  // La revisione: i file cambiati dall'ultima richiesta (dal suo punto di ripristino "prima"), uno per uno.
  const [revisione, setRevisione] = useState({ prima: null, sel: 0, decisioni: {} });
  const datiDiff = () => {
    const vecchio = Date.now() - cacheDiff.current.t > (occupato ? 2500 : 6000);
    const chiave = `${cwd}|${revisione.prima}|${revisione.sel}|${JSON.stringify(revisione.decisioni)}`;
    if (vecchio || cacheDiff.current.chiave !== chiave) {
      if (revisione.prima) {
        const file = cambiatiDa(cwd, revisione.prima);
        const scelto = file[Math.min(revisione.sel, Math.max(0, file.length - 1))];
        cacheDiff.current = { t: Date.now(), chiave, dati: { revisione: true, file, scelto, righe: scelto ? diffDa(cwd, revisione.prima, scelto.file) : [], decisioni: revisione.decisioni } };
      } else cacheDiff.current = { t: Date.now(), chiave, dati: diffColorato(cwd) };
    }
    return cacheDiff.current.dati;
  };
  const decidi = (cosa, tutti = false) => {
    const d = datiDiff();
    if (!d?.revisione || !d.file.length) return scrivi('\n· niente da rivedere: la revisione file per file vale per i file cambiati dall\'ultima richiesta\n');
    const bersagli = tutti ? d.file : [d.scelto];
    const nuove = { ...revisione.decisioni };
    for (const f of bersagli) {
      if (cosa === 'accetta') nuove[f.file] = 'ok';
      else {
        try { const r = ripristinaFile(cwd, revisione.prima, f.file); nuove[f.file] = 'via'; ui.current.log(`◂ ${f.file}: ${r}`, { tipo: 'info' }); }
        catch (e) { scrivi(`\n✗ non riesco a ripristinare ${f.file}: ${e.message.split('\n')[0]}\n`); }
      }
    }
    setRevisione((r) => ({ ...r, decisioni: nuove, sel: cosa === 'accetta' && !tutti ? Math.min(r.sel + 1, Math.max(0, d.file.length - 1)) : r.sel }));
    cacheDiff.current.t = 0;
    aggiornaFile();
    ui.current.notifica(cosa === 'accetta' ? `✓ ${tutti ? 'tutto accettato' : 'accettato: ' + bersagli[0].file}` : `◂ ${tutti ? 'tutto riportato com\'era' : 'riportato: ' + bersagli[0].file}`, cosa === 'accetta' ? 'ok' : 'avviso');
  };
  const aggiungiAlDb = async (cosa, tipo = 'file') => {
    scrivi(`\n📚 aggiungo al database: ${cosa}${catalogatorePronto() ? '  (il catalogatore scrive la scheda…)' : ''}\n`);
    segnaEvento('db', 'catalogo…');
    try {
      const cat = catalogatorePronto() ? catalogatore : null;
      const v = tipo === 'nota' ? await db.aggiungiNota(cosa, cat) : /^https?:\/\//i.test(cosa) ? await db.aggiungiUrl(cosa, cat) : await db.aggiungiFile(cosa, cat);
      scrivi(`✓ ${v.titolo}  →  ${v.categoria}${v.tag.length ? '  #' + v.tag.join(' #') : ''}\n${v.descrizione ? '  ' + v.descrizione + '\n' : ''}`);
      setDbVersione((x) => x + 1);
      segnaEvento('db', 'nuova voce');
      sincronizzaPresto();
      return v;
    } catch (e) {
      scrivi(`✗ non riesco ad aggiungerlo: ${e.message.split('\n')[0]}\n`);
      return null;
    }
  };
  const cambiaQueryDb = (valore) => {
    if (valore.length - dbQuery.length >= 3) {
      const trovati = percorsiIncollati(valore);
      if (trovati.length) { for (const t of trovati) aggiungiAlDb(t.percorso); setDbQuery(''); return; }
    }
    setDbQuery(valore);
    setDbSel(0);
  };

  const salva = (msg) => { setMessaggio(salvaConfig(config) ? msg : 'impossibile salvare la configurazione'); ridisegna((x) => x + 1); };

  // ---------- allegati ----------
  const aggiungiAllegato = (percorso) => {
    try {
      const rel = stato.current.allega(percorso);
      setAllegati((a) => (a.includes(rel) ? a : [...a, rel]));
      ui.current.log(`📎 allegato ${path.basename(percorso)}`, { tipo: 'info' });
      return rel;
    } catch (e) {
      scrivi(`\n✗ non riesco ad allegare ${percorso}: ${e.message}\n`);
      return null;
    }
  };
  const scattaScreenshot = () => {
    const dest2 = path.join(stato.current.cartellaAllegati(), `screenshot-${ora().replace(/:/g, '')}.png`);
    const pezzi = [];
    let p;
    try { p = spawn('flameshot', ['gui', '--raw'], { stdio: ['ignore', 'pipe', 'ignore'] }); } catch { p = null; }
    if (!p) return scrivi(process.env.TERMUX_VERSION ? '\n· su Termux lo screenshot si fa dal telefono: poi trascina o /allega il file da storage/shared/Pictures\n' : '\n✗ Flameshot non trovato: installalo con  sudo apt install -y flameshot\n');
    p.on('error', () => scrivi('\n✗ Flameshot non trovato: installalo con  sudo apt install -y flameshot\n'));
    p.stdout.on('data', (d) => pezzi.push(d));
    p.on('close', () => {
      const buf = Buffer.concat(pezzi);
      if (buf.length < 100) return scrivi('\n· screenshot annullato\n');
      fs.writeFileSync(dest2, buf);
      setAllegati((a) => [...a, path.relative(cwd, dest2)]);
      scrivi(`\n✓ screenshot allegato: ${path.basename(dest2)}\n`);
    });
  };
  const ultimoInputIA = useRef('');
  const cambiaInputIA = (valore) => {
    // un INVIO arrivato insieme al testo (incollato, o digitato mentre KORTEX era occupato a disegnare)
    // vale come INVIO: la prima riga parte, il resto rimane nella casella
    if (/[\r\n]/.test(valore)) {
      const [prima, ...resto] = valore.split(/\r\n|\r|\n/);
      const rimasto = resto.join(' ').trim();
      ultimoInputIA.current = rimasto;
      setInputIA(rimasto);
      if (prima.trim()) inviaIA(prima, { lasciaInput: true });
      return;
    }
    ultimoInputIA.current = valore;
    if (!selettore && !valore.startsWith('/') && valore.length - inputIA.length >= 3) {
      const trovati = percorsiIncollati(valore);
      if (trovati.length) {
        let resto = valore;
        for (const t of trovati) if (aggiungiAllegato(t.percorso)) resto = resto.replace(t.intero, '');
        const pulito = resto.replace(/\s{2,}/g, ' ').trimStart();
        ultimoInputIA.current = pulito;
        setInputIA(pulito);
        return;
      }
    }
    setInputIA(valore);
  };

  // ---------- terminale ----------
  const shellScrivi = (t, tipo = 'out') => {
    const nuove = String(t).replace(/\r/g, '').split('\n').map((x) => ({ t: x, tipo }));
    if (nuove.length > 1 && nuove[nuove.length - 1].t === '') nuove.pop();
    sessione.righe = [...sessione.righe, ...nuove].slice(-3000);
    ridisegna((x) => x + 1);
  };
  const eseguiShell = (cmd) => {
    const casa = os.homedir();
    const dove = sessione.cwd ? (sessione.cwd.startsWith(casa) ? '~' + sessione.cwd.slice(casa.length) : sessione.cwd) : dest.nome;
    shellScrivi(`${dove} $ ${cmd}`, 'cmd');
    setScorri((s) => ({ ...s, shell: 0 }));
    setShellInCorso(true);
    sessioni.current.esegui(dest, cmd, {
      out: (t) => shellScrivi(t, 'out'),
      err: (t) => shellScrivi(t, 'err'),
      info: (t) => shellScrivi(t, 'info'),
      fine: () => { setShellInCorso(false); aggiornaFile(); },
    });
  };
  const cambiaDest = (verso) => { setIDest((i) => (i + verso + destinazioni.length) % destinazioni.length); setScorri((s) => ({ ...s, shell: 0 })); };

  // ---------- comandi /... ----------
  function comando(t) {
    const [cmd, ...resto] = t.slice(1).split(/\s+/);
    const arg = resto.join(' ');
    switch (cmd) {
      case 'esci': case 'q': chiudiTutto(); sessioni.current.chiudiTutto(); db.sincronizzaStaccato(); exit(); return;
      case 'pulisci': svuotaMsg(); return;
      case 'bolle': {
        if (!['on', 'off'].includes(arg)) { scrivi(`\nBolle: ${config.bolle !== false ? 'accese' : 'spente'}. Uso: /bolle on · /bolle off\n`); return; }
        config.bolle = arg === 'on'; salva(`bolle ${arg}`); scrivi(`\n✓ bolle ${arg === 'on' ? 'accese' : 'spente'}\n`); return;
      }
      case 'pagina': { const p = PAGINE[Number(arg) - 1]; if (p) setPagina(p[0]); return; }
      case 'progetto': {
        const sotto = resto[0];
        const restoArg = resto.slice(1).join(' ');
        try {
          if (sotto === 'nuovo' && restoArg) { const v = creaProgetto(restoArg); apriProgetto(v.percorso); return; }
          if (sotto === 'importa' && restoArg) { const v = importaProgetto(restoArg); apriProgetto(v.percorso); return; }
          if (sotto === 'apri' && restoArg) {
            const l = elencoProgetti();
            const v = l[Number(restoArg) - 1] || l.find((q) => q.nome.toLowerCase() === restoArg.toLowerCase());
            if (v) apriProgetto(v.percorso); else scrivi(`\n✗ progetto non trovato: ${restoArg}\n`);
            return;
          }
          if (sotto === 'qui') { const v = registraProgetto({ nome: path.basename(cwd), percorso: cwd }); setProgetto(v); setVersioneProgetti((x) => x + 1); scrivi(`\n✓ questa cartella è ora il progetto "${v.nome}"\n`); return; }
        } catch (e) { scrivi(`\n✗ ${e.message}\n`); return; }
        scrivi('\n' + (elencoProgetti().map((q, i) => `  ${i + 1}. ${q.nome}  ${q.percorso}`).join('\n') || 'nessun progetto') + '\n/progetto nuovo nome · /progetto apri N · /progetto importa percorso · /progetto qui\n');
        return;
      }
      case 'db': {
        const sotto = resto[0];
        const restoArg = resto.slice(1).join(' ');
        try {
          if (sotto === 'aggiungi' && restoArg) { aggiungiAlDb(restoArg.replace(/^~/, os.homedir())); return; }
          if (sotto === 'nota' && restoArg) { aggiungiAlDb(restoArg, 'nota'); return; }
          if (sotto === 'sposta' && resto[2]) { const v = db.sposta(resto[1], resto[2]); setDbVersione((x) => x + 1); scrivi(`\n✓ ${v.titolo} → ${v.categoria}\n`); sincronizzaPresto(); return; }
          if (sotto === 'tag' && resto[2]) { const v = db.aggiornaVoce(resto[1], { tag: resto.slice(2).join(' ').split(/[,\s]+/).filter(Boolean) }); setDbVersione((x) => x + 1); scrivi(`\n✓ tag di ${v.titolo}: ${v.tag.join(', ')}\n`); sincronizzaPresto(); return; }
          if (sotto === 'titolo' && resto[2]) { const v = db.aggiornaVoce(resto[1], { titolo: resto.slice(2).join(' ') }); setDbVersione((x) => x + 1); scrivi(`\n✓ titolo: ${v.titolo}\n`); sincronizzaPresto(); return; }
          if (sotto === 'togli' && resto[1]) { const v = db.togli(resto[1]); setDbVersione((x) => x + 1); scrivi(`\n✓ ${v.titolo} spostato nel cestino (archivio/.cestino)\n`); sincronizzaPresto(); return; }
          if (sotto === 'cerca' && restoArg) { const r = db.cerca(restoArg, 6); scrivi('\n' + (r.map((v) => `  ${v.id}  ${v.titolo} [${v.categoria}]`).join('\n') || 'niente di utile') + '\n'); return; }
          if (sotto === 'github') { scrivi('\n📚 collego il database a GitHub (repository privato kortex-database)…\n'); const u = db.collegaGithub(); setDbVersione((x) => x + 1); scrivi(`✓ collegato: ${u}\n`); return; }
          if (sotto === 'sync') { scrivi('\n» sincronizzo il database in sottofondo…\n'); db.sincronizzaAsync().then((r) => { setSincronizzata(!!r); setDbVersione((x) => x + 1); scrivi(`✓ database sincronizzato: ${r || 'non collegato a GitHub (/db github)'}\n`); }).catch((e) => scrivi(`✗ ${e.message}\n`)); return; }
          if (sotto === 'scarica' && resto[1]) { scrivi(`\n✓ ${db.scaricaDaGithub(resto[1])}\n`); setDbVersione((x) => x + 1); return; }
          if (sotto === 'scansiona') {
            const orf = db.orfani();
            scrivi(`\n📚 scansione: ${orf.length} file da catalogare${orf.length ? '…' : ''}\n`);
            db.scansiona(catalogatorePronto() ? catalogatore : null, (v) => { scrivi(`  ✓ ${v.titolo} [${v.categoria}]\n`); setDbVersione((x) => x + 1); }, { conIA: 20 }).then((f) => { if (f.length) sincronizzaPresto(); }).catch(() => {});
            return;
          }
        } catch (e) { scrivi(`\n✗ ${e.message.split('\n')[0]}\n`); return; }
        scrivi(`\n📚 Database: ${db.DIR_DB}\n  /db aggiungi percorso-o-url · /db nota testo · /db cerca parole\n  /db sposta ID categoria · /db tag ID a,b · /db titolo ID nuovo titolo · /db togli ID\n  /db github (copia privata) · /db sync · /db scarica utente-github (su una macchina nuova) · /db scansiona\nNella richiesta: @titolo o @ID obbliga le IA a usare quella voce, @manuali tutta la categoria.\nIl guardiano ${guardiano ? 'è acceso' : 'è spento'}: i file che compaiono nel database vengono catalogati da soli.\n`);
        return;
      }
      case 'profilo': {
        if (!PROFILI[arg]) { scrivi(`\nProfili: ${Object.entries(PROFILI).map(([id, p]) => `${id} (${p.descrizione})`).join(' · ')}\nAttuale: ${config.profilo || 'nessuno'}. Uso: /profilo nome · /profilo nessuno\n`); if (arg === 'nessuno') { config.profilo = null; salva('profilo tolto'); } return; }
        const p = applicaProfilo(config, arg);
        setScheda(p.scheda); setFuoco(p.fuoco);
        if (p.modo === 'chat') { const prima = Object.values(disponibili).find((d) => d.ok && !d.limitato); if (prima) { setModo(prima.id); storia.current = []; } }
        else setModo(null);
        if (p.destinazione) { const i = destinazioni.findIndex((d) => d.tipo === 'ssh' && (p.destinazione.test(d.nome) || p.destinazione.test(d.host || ''))); const j = i >= 0 ? i : destinazioni.findIndex((d) => d.tipo === 'ssh'); if (j >= 0) setIDest(j); else scrivi('\n△ nessuna macchina SSH: aggiungi il server con /dest aggiungi vps utente@indirizzo\n'); }
        salva(`profilo ${p.nome}`);
        scrivi(`\n▌ PROFILO ${p.nome}: ${p.descrizione}\n`);
        vaiAPagina('lavoro');
        return;
      }
      case 'icone': {
        if (!['on', 'off', 'auto'].includes(arg)) { scrivi(`\nIcone: ${config.icone || 'auto'} (${iconeNerd() ? 'Nerd Font trovato' : 'simboli normali'}). Uso: /icone auto · on · off\n`); return; }
        config.icone = arg; const n = applicaIcone(config); salva(`icone ${arg}`); scrivi(`\n✓ icone ${n ? 'Nerd Font' : 'semplici'}${arg !== 'off' && !n ? ' (il Nerd Font non è installato: lo mette kortex --aggiorna)' : ''}\n`); return;
      }
      case 'novita': case 'novità': setFinestra({ tipo: 'novita' }); return;
      case 'tutorial': setFinestra({ tipo: 'tutorial', passo: 0 }); return;
      case 'statistiche': vaiAPagina('statistiche'); return;
      case 'tema': {
        if (!TEMI[arg]) { scrivi(`\nTemi: ${Object.keys(TEMI).join(', ')} — attuale: ${config.tema || 'neon'}\n`); return; }
        config.tema = arg; applicaTema(config, C); salva(`tema ${arg}`); scrivi(`\n✓ tema ${TEMI[arg].nome}\n`); return;
      }
      case 'grafica': {
        if (!['auto', 'piena', 'leggera', 'spenta'].includes(arg)) { scrivi(`\nGrafica: ${config.grafica || 'auto'} (effettiva: ${config.animazioni}). Uso: /grafica auto · piena · leggera · spenta\n`); return; }
        config.grafica = arg; applicaGrafica(config); salva(`grafica ${arg}`); scrivi(`\n✓ grafica ${arg}${arg === 'auto' ? ` → ${config.animazioni}` : ''}\n`); return;
      }
      case 'suoni': {
        if (!['on', 'off', 'si', 'sì', 'no'].includes(arg)) { scrivi(`\nSuoni: ${suoni?.attivi ? 'accesi' : 'spenti'}${suoni?.lettore ? ` (lettore: ${suoni.lettore})` : ' (nessun lettore audio trovato: pw-play, paplay, aplay, play, ffplay)'}. Uso: /suoni on · /suoni off\n`); return; }
        const v = ['on', 'si', 'sì'].includes(arg); suoni?.cambia(v); config.suoni = v; salva(`suoni ${v ? 'accesi' : 'spenti'}`); scrivi(`\n✓ suoni ${v ? 'accesi' : 'spenti'}\n`); if (v) suona('ok'); return;
      }
      case 'mouse': {
        if (!['on', 'off'].includes(arg)) { scrivi(`\nMouse: ${config.mouse !== false ? 'acceso' : 'spento'}. Uso: /mouse on · /mouse off  (spento, il testo si seleziona senza SHIFT)\n`); return; }
        config.mouse = arg === 'on'; if (config.mouse) accendiMouse(); else spegniMouse(); salva(`mouse ${arg}`); scrivi(`\n✓ mouse ${arg === 'on' ? 'acceso' : 'spento'}\n`); return;
      }
      case 'coda': {
        if (arg === 'svuota') { codaRef.current = []; setCoda([]); scrivi('\n✓ coda svuotata\n'); return; }
        scrivi('\n' + (codaRef.current.length ? codaRef.current.map((q, i) => `  ${i + 1}. ${q}`).join('\n') : 'nessuna richiesta in coda') + '\n/coda svuota per cancellarle\n');
        return;
      }
      case 'ricorda':
        if (!arg) { scrivi('\nUso: /ricorda preferenza (vale in tutti i progetti, su tutti i PC)\n'); return; }
        scrivi(ricorda(arg) ? `\n✓ ricorderò: ${arg}\n` : '\n· già presente\n'); segnaEvento('memoria', ''); sincronizzaPresto(); return;
      case 'dimentica': {
        const via = dimentica(Number(arg));
        scrivi(via ? `\n✓ dimenticato: ${via}\n` : '\nUso: /dimentica N (il numero lo vedi nella pagina STUDIO)\n'); sincronizzaPresto(); return;
      }
      case 'memoria':
        scrivi(`\nPreferenze: ${percorsoPreferenze()} (nel database: viaggiano su GitHub)\nRiassunto del progetto: ${path.join(cwd, '.kortex', 'riassunto.md')}\nSoluzioni: ${db.DIR_DB}/note (tag #soluzione)\nMemoria automatica: ${config.memoriaAutomatica === false ? 'spenta' : 'accesa'} (plancia CONTROLLO)\n`);
        return;
      case 'ripristina': {
        if (!arg) { scrivi('\n' + (elencoIstantanee(cwd, 15).map((i) => `  ${i.id}  ${i.data}  ${i.etichetta}`).join('\n') || 'nessun punto di ripristino') + '\nUso: /ripristina ID\n'); return; }
        try {
          const r = ripristina(cwd, arg);
          scrivi(`\n✓ file riportati al punto ${arg}${r.rimossi ? ` (${r.rimossi} file creati dopo sono stati tolti)` : ''}. Per annullare: /ripristina ${r.sicurezza}\n`);
          aggiornaFile(); setVersioneProgetti((x) => x + 1);
        } catch (e) { scrivi(`\n✗ ripristino non riuscito: ${e.message.split('\n')[0]}\n`); }
        return;
      }
      case 'scheda': { const s = SCHEDE[Number(arg) - 1]; if (s) setScheda(s[0]); return; }
      case 'dest': {
        if (!arg) { scrivi('\n' + destinazioni.map((d, i) => `  ${i + 1}. ${d.nome}${d.host ? '  ' + d.host : ''}  (${d.tipo}${d.origine ? ', ' + d.origine : ''})`).join('\n') + '\n/dest N per scegliere · /dest aggiungi nome utente@host [porta] · /dest togli nome\n'); return; }
        if (resto[0] === 'aggiungi') {
          const [, nome, host, porta] = resto;
          if (!nome || !host) { scrivi('\nUso: /dest aggiungi nome utente@host [porta]\n'); return; }
          config.destinazioni = [...(config.destinazioni || []).filter((d) => d.nome !== nome), { nome, host, porta }];
          salva('destinazione salvata'); scrivi(`\n✓ destinazione ${nome} (${host}) salvata: Ctrl+D per usarla\n`); return;
        }
        if (resto[0] === 'togli') {
          config.destinazioni = (config.destinazioni || []).filter((d) => d.nome !== resto[1]);
          salva('destinazione tolta'); setIDest(0); scrivi(`\n✓ destinazione ${resto[1]} tolta\n`); return;
        }
        const i = Number.isInteger(Number(arg)) ? Number(arg) - 1 : destinazioni.findIndex((d) => d.nome === arg || d.id === arg);
        if (destinazioni[i]) { setIDest(i); scrivi(`\n▌ terminale su ${destinazioni[i].nome}\n`); } else scrivi(`\n✗ destinazione non trovata: ${arg}\n`);
        return;
      }
      case 'allega':
        if (arg) {
          const p = path.resolve(cwd, arg.replace(/^~/, os.homedir()));
          if (fs.existsSync(p) && fs.statSync(p).isFile()) { aggiungiAllegato(p); scrivi(`\n✓ allegato ${path.basename(p)}\n`); }
          else scrivi(`\n✗ file non trovato: ${p}\n`);
          return;
        }
        setSelettore({ query: '', sel: 0, indice: indiceFile(cwd) });
        return;
      case 'allegati': scrivi('\n' + (allegati.length ? allegati.map((a, i) => `  ${i + 1}. ${a}`).join('\n') : 'nessun allegato') + '\n'); return;
      case 'togli': if (arg === 'tutti') setAllegati([]); else setAllegati((a) => a.filter((_, i) => i !== Number(arg) - 1)); return;
      case 'screenshot': scattaScreenshot(); return;
      case 'mappa': {
        const m = applicaMappatura(config, Number(arg) - 1);
        if (m) { salva(`mappatura ${m.nome} applicata`); scrivi(`\n▌ Mappatura ${m.nome}: ${m.uso}\n`); } else scrivi('\nUso: /mappa 1 … /mappa 5\n');
        return;
      }
      case 'nota':
        if (!arg) { scrivi('\nUso: /nota testo dell\'appunto\n'); return; }
        stato.current.annotaAppunto(arg); scrivi('\n✓ appunto scritto sulla lavagna (pagina STUDIO)\n'); return;
      case 'ia': scrivi('\n' + Object.values(disponibili).map((d) => `${d.ok ? '●' : '○'} ${d.nome.padEnd(8)} ${d.ok ? d.versione || '' : d.nota || ''}${d.limitato ? '  [limite raggiunto]' : ''}`).join('\n') + '\n'); return;
      case 'ruoli': scrivi('\n' + Object.entries(config.ruoli).map(([r, l]) => `${r.padEnd(14)} ${l.join(' → ')}`).join('\n') + '\n'); return;
      case 'strumento': {
        // il segno dello stato: ■ acceso, □ spento, ? non si può sapere
        const segno = (s) => (s === true ? '■ acceso' : s === false ? '□ spento' : '? sconosciuto');
        const cartella = cartellaStrumenti(config);
        const lista = caricaStrumenti(cartella);
        if (!lista.length) { scrivi(`\nNessuno strumento. Le schede stanno in ${cartella}: un file .json per ogni strumento.\n`); return; }
        if (!arg) {
          Promise.all(lista.map((s) => controllaStato(s).catch(() => null))).then((stati) => {
            scrivi('\n' + lista.map((s, i) => `  ${s.icona} ${riempiA(s.nome, 12)} @${riempiA(s.id, 10)} ${riempiA(s.tasto ? 'tasto ' + s.tasto : '', 8)} ${segno(stati[i])}`).join('\n')
              + `\nSchede: ${cartella}\n/strumento id per la scheda completa · @id nella richiesta per dare lo strumento alle IA\n`);
          });
          return;
        }
        const s = lista.find((x) => x.id === arg.toLowerCase());
        if (!s) { scrivi(`\n✗ strumento non trovato: ${arg}\n`); return; }
        controllaStato(s).catch(() => null).then((st) => {
          scrivi(`\n${s.icona} ${s.nome}  @${s.id}${s.tasto ? '  tasto ' + s.tasto : ''}\n`
            + `  stato: ${segno(st)}${s.stato?.tipo === 'porta' ? `  (porta ${s.stato.porta} su ${s.stato.host || 'localhost'})` : ''}\n`
            + (st === false ? `  ${avvisoSpento(s)}\n` : '')
            + `  permessi: ${s.permessi}\n`
            + (s.descrizione ? `  ${s.descrizione}\n` : '')
            + `  progetti: ${s.progetti.length ? s.progetti.join(', ') : 'tutti'}\n`
            + `  server mcp: ${s.mcp?.command ? `${s.mcp.command} ${(s.mcp.args || []).join(' ')}` : 'nessuno'}\n`
            + (s.contesto ? `  contesto: ${s.contesto.split('\n').join('\n            ')}\n` : '')
            + `  scheda: ${s.percorso}\n`);
        });
        return;
      }
      case 'stato': scrivi('\n' + (stato.current.memoria(25) || '(diario vuoto)') + '\n'); return;
      case 'config': scrivi(`\nConfigurazione: ${FILE_CONFIG}\n`); return;
      case 'chat': {
        if (resto[0] === 'nuova') { const c = creaChat(cwd, resto.slice(1).join(' ') || 'Nuova chat'); apriChat(c); return; }
        if (resto[0] === 'apri') { const l = elencoChat(cwd); const c = l[Number(resto[1]) - 1]; if (c) apriChat(c); else scrivi('\n✗ chat non trovata\n'); return; }
        const attive = Object.values(disponibili).filter((d) => d.ok && !d.limitato);
        if (!arg) { scrivi(`\nCon chi vuoi parlare? ${attive.map((d) => '/chat ' + d.id).join('   ')}\n`); return; }
        if (!disponibili[arg]?.ok) { scrivi(`\n✗ ${arg} non è disponibile. Attive: ${attive.map((d) => d.id).join(', ')}\n`); return; }
        setModo(arg); storia.current = []; scrivi(`\n▌ CHAT DIRETTA con ${disponibili[arg].nome} — /team per tornare alla squadra\n`); return;
      }
      case 'team': setModo(null); scrivi('\n▌ SQUADRA al lavoro\n'); return;
      case 'nuova':
        if (!modo) { scrivi('\n/nuova vale in chat diretta\n'); return; }
        stato.current.salvaSessione(modo, 'chat', null); storia.current = []; scrivi(`\n▌ Nuova conversazione con ${disponibili[modo].nome}\n`); return;
      case 'chiedi':
        if (!arg) { scrivi('\nUso: /chiedi seguito dalla richiesta. Il direttore potrà farti UNA domanda a risposta multipla prima di dividere il lavoro.\n'); return; }
        avviaRichiesta(arg, { chiedi: true });
        return;
      default:
        scrivi('\nComandi: /dest  /scheda N  /allega [file]  /allegati  /togli N  /screenshot  /chat X  /team  /nuova  /chiedi richiesta  /coda  /mappa N  /nota testo  /pagina N  /grafica  /suoni  /mouse  /ia  /ruoli  /strumento [id]  /stato  /pulisci  /esci\nLa pagina GUIDA spiega tutto nel dettaglio.\n');
    }
  }

  async function inviaIA(valore, opz = {}) {
    if (finestra) return;
    if (!opz.lasciaInput) {
      if (!selettore && pagina !== 'database' && ultimoInputIA.current.length > (valore || '').length && ultimoInputIA.current.startsWith(valore || '')) valore = ultimoInputIA.current;
      ultimoInputIA.current = '';
    }
    try { await inviaIAvero(valore, opz); } catch (e) { ui.current.log(`✗ errore interno: ${e.message}`, { tipo: 'errore' }); scrivi(`\n✗ errore interno: ${e.message}\n`); setOccupato(false); occupatoRef.current = false; }
  }
  async function inviaIAvero(valore, opz = {}) {
    const t = valore.trim();
    if (process.env.KORTEX_DEBUG_TASTI) { try { fs.appendFileSync(process.env.KORTEX_DEBUG_TASTI, 'INVIO ' + JSON.stringify(valore) + '\n'); } catch { /* */ } }
    if (!opz.lasciaInput) { setInputIA(''); ultimoInputIA.current = ''; }
    if (selettore) {
      const f = filtrati()[selettore.sel];
      if (selettore.tipo === 'tavolozza') { setSelettore(null); if (f) setTimeout(() => f.esegui(), 0); return; }
      if (f) { aggiungiAllegato(f); scrivi(`\n✓ allegato ${path.basename(f)}\n`); }
      setSelettore(null);
      return;
    }
    if (pagina === 'database') {
      if (t.startsWith('/')) { setDbQuery(''); return comando(t); }
      const d = datiDb();
      const v = d.voci[dbSel];
      if (v) { setInputIA(`@${v.id} `); setDbQuery(''); setPagina('lavoro'); setFuoco('ia'); scrivi(`\n📚 ${v.titolo}: scrivi cosa farne, l'IA la userà\n`); }
      return;
    }
    if (pagina === 'progetti') {
      const d = datiProgetti();
      if (!t) {
        if (colonna === 'chat' && d.chat[selezione.chat]) { const q = d.progetti[selezione.progetto]; if (q && q.percorso !== cwd) apriProgetto(q.percorso); setTimeout(() => apriChat(caricaChat(q.percorso, d.chat[selezione.chat].id)), 0); }
        else if (d.progetti[selezione.progetto]) { apriProgetto(d.progetti[selezione.progetto].percorso); setPagina('lavoro'); }
        return;
      }
      if (t.startsWith('/')) return comando(t);
      try { const v = creaProgetto(t); apriProgetto(v.percorso); setPagina('lavoro'); } catch (e) { scrivi(`\n✗ ${e.message}\n`); }
      return;
    }
    if (!t) { if (pagina === 'lavoro' && scheda === 'diff' && revisione.prima) decidi('accetta'); return; }
    if (t.startsWith('/')) return comando(t);
    if (occupatoRef.current) {
      // la squadra sta lavorando: la richiesta aspetta il suo turno
      codaRef.current = [...codaRef.current, t];
      setCoda([...codaRef.current]);
      scrivi(`\n⋯ in coda (${codaRef.current.length}): ${t}\n`);
      ui.current.notifica(`⋯ in coda: ${t.slice(0, 40)}`, 'info');
      return;
    }
    await avviaRichiesta(t, {});
  }

  async function avviaRichiesta(t, { chiedi = false }) {
    if (occupatoRef.current) { codaRef.current = [...codaRef.current, (chiedi ? '/chiedi ' : '') + t]; setCoda([...codaRef.current]); return; }
    setOccupato(true);
    occupatoRef.current = true;
    // ogni cartella in cui lavori diventa un progetto, con le sue chat
    let prog = progetto;
    if (!prog) { prog = registraProgetto({ nome: path.basename(cwd), percorso: cwd }); setProgetto(prog); }
    let c = chat;
    if (!c) { c = creaChat(cwd, t.slice(0, 60)); setChat(c); }
    const prima = istantanea(cwd, `prima di: ${t.slice(0, 70)}`);
    if (prima) setRevisione({ prima, sel: 0, decisioni: {} });
    c.messaggi.push({ chi: 'utente', testo: t, ora: new Date().toISOString(), istantanea: prima, allegati });
    salvaChat(cwd, c);
    setScorri((s) => ({ ...s, lavoro: 0 }));
    const daAllegare = allegati;
    setAllegati([]);
    scrivi(`\n› ${t}${daAllegare.length ? `   📎 ${daAllegare.length} allegat${daAllegare.length === 1 ? 'o' : 'i'}` : ''}${chiedi ? '   ? il direttore può fare una domanda' : ''}\n`);
    const conoscenze = [...new Map([...db.menzioni(t), ...db.cerca(t, 3)].map((v) => [v.id, v])).values()].slice(0, 5);
    if (conoscenze.length) { scrivi(`📚 dal database: ${conoscenze.map((v) => v.titolo).join(' · ')}\n`); segnaEvento('db', 'le IA leggono'); }
    inizioLavoro.current = Date.now();
    const ctx = { config, disponibili, cwd, stato: stato.current, ui: ui.current, tel: tel.current, allegati: daAllegare, chatId: c.id, chatPrecedente: riassuntoChat({ messaggi: c.messaggi.slice(0, -1) }), conoscenze, chiedi, server: config.profilo === 'minecraft' && dest.tipo === 'ssh' ? (dest.porta ? `-p ${dest.porta} ` : '') + dest.host : null };
    let risposta = '';
    let esitiFatti = [];
    try {
      if (modo) {
        const r = await chatDiretta({ id: modo, messaggio: t, ctx, storia: storia.current });
        storia.current.push({ chi: 'Utente', testo: t });
        if (r.ok) storia.current.push({ chi: disponibili[modo].nome, testo: r.testo });
        risposta = r.ok ? r.testo : `✗ ${r.errore}`;
        scrivi('\n');
      } else {
        setRuoli(ruoliIniziali());
        setCompiti([]);
        const esiti = await eseguiRichiesta({ richiesta: t, ctx });
        esitiFatti = esiti || [];
        risposta = (esiti || []).map((e, i) => `${e.esito === 'OK' ? '✓' : e.esito === 'FALLITO' ? '✗' : '△'} ${i + 1}. ${e.c.titolo} — ${e.esito}`).join('\n') || '(nessun esito)';
      }
    } catch (e) {
      ui.current.log('✗ ' + e.message, { tipo: 'errore' });
      risposta = '✗ ' + e.message;
    }
    if (domandaAperta.current) rispondiDomanda(null);
    const dopo = istantanea(cwd, `dopo: ${t.slice(0, 70)}`);
    try { registraRichiesta({ compiti: esitiFatti.length || (modo ? 1 : 0), compitiOk: esitiFatti.length ? esitiFatti.filter((e) => e.esito === 'OK').length : modo && !risposta.startsWith('✗') ? 1 : 0, file: prima ? cambiatiDa(cwd, prima).length : 0 }); } catch { /* */ }
    c.messaggi.push({ chi: 'kortex', testo: risposta, ora: new Date().toISOString(), istantanea: dopo });
    salvaChat(cwd, c);
    setVersioneProgetti((x) => x + 1);
    segnaEvento('prog', 'punto di ripristino');
    setOccupato(false);
    occupatoRef.current = false;
    setLampeggio(Date.now());
    aggiornaFile();
    cacheDiff.current.t = 0;
    const durata = Math.round((Date.now() - inizioLavoro.current) / 1000);
    const riuscita = !risposta.includes('✗');
    setNotifiche((n) => [...n.slice(-3), { testo: `${riuscita ? '✓' : '△'} richiesta finita in ${durata >= 60 ? Math.floor(durata / 60) + 'm ' + (durata % 60) + 's' : durata + 's'}`, tipo: riuscita ? 'ok' : 'avviso', t: Date.now() }]);
    suona(riuscita ? 'fine' : 'errore');
    // notifica del sistema: la vedi anche se stai lavorando in un'altra finestra
    if (!process.env.TERMUX_VERSION) { try { spawn('notify-send', ['-a', 'KORTEX', '-i', path.join(os.homedir(), '.local/share/icons/kortex.svg'), 'KORTEX', `${riuscita ? 'Finito' : 'Finito con avvisi'}: ${t.slice(0, 80)}`], { stdio: 'ignore' }).on('error', () => {}); } catch { /* */ } }
    // il memorista lavora in sottofondo: non blocca la prossima richiesta
    if (config.memoriaAutomatica !== false && !modo) {
      const ctxM = { ...contestoBase(), conoscenze: [] };
      aggiornaMemoria(ctxM, { richiesta: t, esito: risposta, file: righeFile(cwd), progetto: prog.nome })
        .then((f) => {
          if (!f) return;
          segnaEvento('memoria', '');
          if (f.soluzione) { setDbVersione((x) => x + 1); segnaEvento('db', 'soluzione imparata'); ui.current.notifica(`📚 imparata: ${f.soluzione.titolo}`, 'info'); }
          if (f.preferenze.length) ui.current.notifica(`◆ ricorderò: ${f.preferenze[0]}`, 'info');
          if (f.soluzione || f.preferenze.length) sincronizzaPresto();
        })
        .catch(() => {});
    }
    // la prossima richiesta in coda parte da sola
    if (codaRef.current.length) {
      const prossima = codaRef.current[0];
      codaRef.current = codaRef.current.slice(1);
      setCoda([...codaRef.current]);
      scrivi(`\n» dalla coda: ${prossima}\n`);
      setTimeout(() => { if (prossima.startsWith('/chiedi ')) avviaRichiesta(prossima.slice(8), { chiedi: true }); else avviaRichiesta(prossima, {}); }, 400);
    }
  }
  const inviaShell = (valore) => { const t = valore.trim(); setInputShell(''); if (t) eseguiShell(t); };
  const cambiaInputShell = (valore) => {
    if (/[\r\n]/.test(valore)) {
      const [prima, ...resto] = valore.split(/\r\n|\r|\n/);
      setInputShell(resto.join(' ').trim());
      if (prima.trim()) eseguiShell(prima.trim());
      return;
    }
    setInputShell(valore);
  };

  const filtrati = () => {
    if (!selettore) return [];
    const q = (selettore.query || '').toLowerCase();
    if (selettore.tipo === 'tavolozza') return cercaVoci(selettore.voci, q).slice(0, 200);
    return selettore.indice.filter((f) => !q || f.toLowerCase().includes(q)).slice(0, 400);
  };

  // ---------- la tavolozza dei comandi (Ctrl+P) ----------
  const apriTavolozza = () => {
    const v = [];
    const add = (gruppo, etichetta, descr, esegui) => v.push({ gruppo, etichetta, descr, esegui });
    PAGINE.forEach(([id, nome], i) => add('pagina', `Vai a ${nome}`, `pagina ${i + 1}`, () => vaiAPagina(id)));
    SCHEDE.forEach(([id, nome]) => add('scheda', `Scheda ${nome}`, 'a destra nella pagina LAVORO', () => { vaiAPagina('lavoro'); setScheda(id); }));
    Object.entries(PROFILI).forEach(([id, p]) => add('profilo', `Profilo ${p.nome}`, p.descrizione, () => comando(`/profilo ${id}`)));
    Object.entries(TEMI).forEach(([id, t]) => add('tema', `Tema ${t.nome}`, id === config.tema ? 'quello attuale' : 'cambia i colori di tutto KORTEX', () => comando(`/tema ${id}`)));
    MAPPATURE.forEach((m, i) => add('mappatura', `Mappatura ${m.nome}`, m.uso, () => comando(`/mappa ${i + 1}`)));
    for (const g of ['auto', 'piena', 'leggera', 'spenta']) add('grafica', `Grafica ${g}`, 'quanto si muove l\'interfaccia', () => comando(`/grafica ${g}`));
    Object.values(disponibili).filter((d) => d.ok).forEach((d) => add('chat', `Chat diretta con ${d.nome}`, 'parli con una sola IA', () => comando(`/chat ${d.id}`)));
    add('chat', 'Torna alla squadra', '/team', () => comando('/team'));
    add('comando', `Suoni ${suoni?.attivi ? 'spenti' : 'accesi'}`, '/suoni', () => comando(`/suoni ${suoni?.attivi ? 'off' : 'on'}`));
    add('comando', `Mouse ${config.mouse !== false ? 'spento' : 'acceso'}`, '/mouse', () => comando(`/mouse ${config.mouse !== false ? 'off' : 'on'}`));
    add('comando', `Bolle ${config.bolle !== false ? 'spente' : 'accese'}`, 'come si vede l\'OUTPUT', () => comando(`/bolle ${config.bolle !== false ? 'off' : 'on'}`));
    add('comando', `Icone ${config.icone === 'off' ? 'automatiche' : 'semplici'}`, '/icone', () => comando(`/icone ${config.icone === 'off' ? 'auto' : 'off'}`));
    add('comando', 'Allega un file', '/allega', () => comando('/allega'));
    add('comando', 'Screenshot da allegare', 'Ctrl+O', () => scattaScreenshot());
    add('comando', 'Nuova chat nel progetto', '/chat nuova', () => comando('/chat nuova'));
    add('comando', 'Pulisci l\'output', '/pulisci', () => comando('/pulisci'));
    add('comando', 'Sincronizza il database con GitHub', '/db sync', () => comando('/db sync'));
    add('comando', 'Cataloga i file nuovi del database', '/db scansiona', () => comando('/db scansiona'));
    add('comando', 'Punti di ripristino', '/ripristina', () => comando('/ripristina'));
    add('comando', 'Le novità di questa versione', '/novita', () => comando('/novita'));
    add('comando', 'Rifai il giro guidato', '/tutorial', () => comando('/tutorial'));
    add('comando', 'Esci da KORTEX', '/esci', () => comando('/esci'));
    elencoProgetti().forEach((q) => add('progetto', `Apri ${q.nome}`, q.percorso, () => { apriProgetto(q.percorso); vaiAPagina('lavoro'); }));
    db.indice().slice(0, 300).forEach((x) => add('database', `@ ${x.titolo}`, `${x.categoria} · usala nella prossima richiesta`, () => { setInputIA(`@${x.id} `); vaiAPagina('lavoro'); setFuoco('ia'); }));
    setSelettore({ tipo: 'tavolozza', query: '', sel: 0, voci: v });
  };

  // ---------- impaginazione ----------
  GRAFICA.leggera = config.animazioni !== 'piena';
  const { c, r } = dim;
  const H = Math.max(16, r - 1);
  const grande = H >= 40 && c >= 140;
  const hTesta = grande ? 9 : 3;
  const conInput = pagina !== 'controllo';
  const conAllegati = conInput && allegati.length > 0;
  const hCorpo = H - hTesta - 1 - (conInput ? 3 : 0) - (conAllegati ? 1 : 0);
  const wTerm = Math.max(44, Math.floor(c * 0.44));

  const cambiaPagina = (verso) => {
    const i = PAGINE.findIndex(([id]) => id === pagina);
    vaiAPagina(PAGINE[(i + verso + PAGINE.length) % PAGINE.length][0]);
  };
  const vaiAPagina = (id) => {
    if (id === pagina) return;
    setPagina(id);
    setMessaggio('');
    setTransizione(Date.now());
  };
  const chiaveScorri = pagina === 'lavoro' ? (fuoco === 'shell' ? 'shell' : scheda === 'registro' ? 'registro' : scheda === 'diff' ? 'diff' : 'lavoro') : pagina;
  const dalBasso = (k) => ['lavoro', 'registro', 'shell'].includes(k);
  const sposta = (quanto, chiave = chiaveScorri) => setScorri((s) => {
    const v = s[chiave] ?? 0;
    const nuovo = dalBasso(chiave) ? v + quanto : v - quanto;
    return { ...s, [chiave]: Math.max(0, Math.min(massimi.current[chiave] ?? 0, nuovo)) };
  });

  // La casella di testo riceve anche la lettera delle combinazioni Ctrl: la tolgo subito dopo.
  const scartaLettera = (ch) => {
    const fs2 = pagina === 'lavoro' && fuoco === 'shell' && !selettore;
    const prima = selettore ? selettore.query : fs2 ? inputShell : inputIA;
    const togli = (v) => (v.length === prima.length + 1 && v.endsWith(ch) ? v.slice(0, -1) : v);
    setTimeout(() => {
      if (selettore) setSelettore((sl) => (sl ? { ...sl, query: togli(sl.query) } : sl));
      else if (fs2) setInputShell(togli);
      else setInputIA(togli);
    }, 0);
  };

  // ---------- le azioni del mouse: ogni pagina sa cosa fare con un clic ----------
  const azioni = {
    tick,
    pagina: vaiAPagina,
    scheda: (id) => setScheda(id),
    filtro: (id) => setFiltro(id),
    dest: (id) => { const i = destinazioni.findIndex((d) => d.id === id); if (i >= 0) { setIDest(i); setFuoco('shell'); } },
    fuoco: (f) => setFuoco(f),
    rotella: (chiave, verso) => sposta(verso * 3, chiave),
    togliAllegato: (i) => setAllegati((a) => a.filter((_, k) => k !== i)),
    selettore: (i) => { const f = filtrati()[i]; const tav = selettore?.tipo === 'tavolozza'; setSelettore(null); if (!f) return; if (tav) setTimeout(() => f.esegui(), 0); else { aggiungiAllegato(f); scrivi(`\n✓ allegato ${path.basename(f)}\n`); } },
    domanda: (i) => rispondiDomanda(i),
    progetto: (i) => {
      const d = datiProgetti();
      if (colonna === 'progetti' && selezione.progetto === i) { const q = d.progetti[i]; if (q) { apriProgetto(q.percorso); vaiAPagina('lavoro'); } }
      else { setColonna('progetti'); setSelezione({ progetto: i, chat: 0 }); }
    },
    chat: (i) => {
      const d = datiProgetti();
      if (colonna === 'chat' && selezione.chat === i) { const q = d.progetti[selezione.progetto]; if (q) { if (q.percorso !== cwd) apriProgetto(q.percorso); setTimeout(() => { const cc = caricaChat(q.percorso, d.chat[i].id); if (cc) apriChat(cc); }, 0); } }
      else { setColonna('chat'); setSelezione((z) => ({ ...z, chat: i })); }
    },
    colonna: (col) => setColonna(col),
    istantanea: (id) => { setInputIA(`/ripristina ${id}`); vaiAPagina('lavoro'); setFuoco('ia'); },
    dbCategoria: (id) => { setDbCategoria(id); setDbSel(0); },
    dbVoce: (i) => { if (dbSel === i) { const v = datiDb().voci[i]; if (v) { setInputIA(`@${v.id} `); setDbQuery(''); vaiAPagina('lavoro'); setFuoco('ia'); } } else setDbSel(i); },
    parametro: (i, cosa, ev) => {
      setSelezionato(i);
      const p = PARAMETRI[i];
      if (cosa === 'meno' || cosa === 'piu') { cambia(config, p, cosa === 'piu' ? 1 : -1); if (p.chiave === 'tema') applicaTema(config, C); salva('salvato'); }
      else if (cosa === 'barra' && p.tipo === 'sino') { cambia(config, p, 1); salva('salvato'); }
    },
    decidi: (cosa, tutti) => decidi(cosa, tutti),
    selezionaFile: (i) => { setRevisione((r) => ({ ...r, sel: i })); setScorri((x) => ({ ...x, diff: 0 })); },
    mappatura: (i) => { const m = applicaMappatura(config, i); if (m) salva(`mappatura ${m.nome} applicata`); },
  };
  const azioniRef = useRef(azioni);
  azioniRef.current = azioni;
  useEffect(() => {
    const click = (ev) => { try { gestisciClick(ev); } catch (e) { ui.current.log(`✗ errore interno (mouse): ${e.message}`, { tipo: 'errore' }); } };
    const rotella = (ev) => { try { if (!gestisciRotella(ev)) azioniRef.current.rotella(chiaveScorri, ev.verso); } catch { /* */ } };
    eventiMouse.on('click', click);
    eventiMouse.on('rotella', rotella);
    return () => { eventiMouse.off('click', click); eventiMouse.off('rotella', rotella); };
  }, [chiaveScorri]);

  // Un errore dentro la gestione di un tasto non deve mai chiudere KORTEX: finisce nel registro.
  useInput((ch, key) => {
    try { gestisciTasto(ch, key); } catch (e) { ui.current.log(`✗ errore interno (tasto): ${e.message}`, { tipo: 'errore' }); ui.current.notifica('✗ errore interno: guarda il REGISTRO', 'errore'); }
  });
  function gestisciTasto(ch, key) {
    if (process.env.KORTEX_DEBUG_TASTI) { try { fs.appendFileSync(process.env.KORTEX_DEBUG_TASTI, JSON.stringify({ ch, key: Object.entries(key).filter(([, v]) => v).map(([k]) => k), fuoco, finestra, occupato: occupatoRef.current, t: Date.now() % 100000 }) + '\n'); } catch { /* */ } }
    if (key.ctrl && 'tndfokrp'.includes(ch)) scartaLettera(ch);
    if (key.ctrl && ch === 'k' && occupato) {
      fermaTutti();
      ui.current.log('» hai saltato l\'IA che stava lavorando: passo alla riserva', { tipo: 'riserva' });
      ui.current.notifica('» IA saltata: lavora la riserva', 'avviso');
      return;
    }
    if (key.ctrl && ch === 'c') {
      if (pagina === 'lavoro' && fuoco === 'shell' && sessioni.current.interrompi(dest)) return;
      chiudiTutto(); sessioni.current.chiudiTutto(); db.sincronizzaStaccato(); exit(); return;
    }
    if (key.ctrl && ch === 'o') return scattaScreenshot();
    if (finestra) {
      // Tutto si decide dentro l'aggiornamento, guardando la finestra com'è DAVVERO in quel momento:
      // se arrivano più tasti prima che lo schermo si ridisegni, nessuno va perso o finisce alla finestra sbagliata.
      const avanti = key.return || key.rightArrow ? 1 : (ch.match(/\r/g) || []).length;
      const azione = key.escape ? 'chiudi' : avanti ? 'avanti' : key.leftArrow ? 'indietro' : 'altro';
      setFinestra((f) => {
        if (!f) return f;
        const chiudi = () => {
          config.tutorialFatto = true;
          const n = f.tipo === 'tutorial' && config.ultimaVersione && config.ultimaVersione !== versione ? { tipo: 'novita' } : null;
          if (!n) config.ultimaVersione = versione;
          salvaConfig(config);
          return n;
        };
        // le novità si chiudono con qualsiasi tasto (anche se INVIO arriva attaccato ad altro testo)
        if (f.tipo !== 'tutorial') return chiudi();
        if (azione === 'chiudi') return chiudi();
        if (azione === 'avanti') return f.passo + avanti <= TUTORIAL.length - 1 ? { ...f, passo: f.passo + avanti } : chiudi();
        if (azione === 'indietro') return { ...f, passo: Math.max(0, f.passo - 1) };
        return f;
      });
      return;
    }
    if (key.ctrl && ch === 'p') { if (selettore?.tipo === 'tavolozza') setSelettore(null); else apriTavolozza(); return; }
    if (domanda) {
      if (key.escape) { rispondiDomanda(null); return; }
      if (/^[1-4]$/.test(ch) && Number(ch) <= domanda.opzioni.length) { scartaLettera(ch); rispondiDomanda(Number(ch) - 1); return; }
    }
    if (selettore) {
      const n = filtrati().length;
      if (key.escape) { setSelettore(null); return; }
      if (key.upArrow) return setSelettore((s) => ({ ...s, sel: Math.max(0, s.sel - 1) }));
      if (key.downArrow) return setSelettore((s) => ({ ...s, sel: Math.min(Math.max(0, n - 1), s.sel + 1) }));
      return;
    }
    if (key.tab) return cambiaPagina(key.shift ? -1 : 1);
    if (key.escape) return vaiAPagina('lavoro');
    if (pagina === 'controllo') {
      if (key.upArrow) return setSelezionato((x) => (x - 1 + PARAMETRI.length) % PARAMETRI.length);
      if (key.downArrow) return setSelezionato((x) => (x + 1) % PARAMETRI.length);
      if (key.leftArrow || key.rightArrow) { cambia(config, PARAMETRI[selezionato], key.rightArrow ? 1 : -1); if (PARAMETRI[selezionato].chiave === 'tema') applicaTema(config, C); return salva('salvato'); }
      if (/^[1-5]$/.test(ch)) { const m = applicaMappatura(config, Number(ch) - 1); return salva(`mappatura ${m.nome} applicata`); }
      return;
    }
    if (pagina === 'database') {
      const cats = ['tutte', ...db.CATEGORIE];
      const n = datiDb().voci.length;
      if (key.leftArrow || key.rightArrow) { setDbCategoria((c0) => cats[(cats.indexOf(c0) + (key.rightArrow ? 1 : -1) + cats.length) % cats.length]); setDbSel(0); return; }
      if (key.upArrow) return setDbSel((x) => Math.max(0, x - 1));
      if (key.downArrow) return setDbSel((x) => Math.min(Math.max(0, n - 1), x + 1));
      return;
    }
    if (pagina === 'progetti') {
      const d = datiProgetti();
      if (key.leftArrow) return setColonna('progetti');
      if (key.rightArrow) return setColonna('chat');
      if (key.upArrow) return setSelezione((z) => (colonna === 'chat' ? { ...z, chat: Math.max(0, z.chat - 1) } : { progetto: Math.max(0, z.progetto - 1), chat: 0 }));
      if (key.downArrow) return setSelezione((z) => (colonna === 'chat' ? { ...z, chat: Math.min(Math.max(0, d.chat.length - 1), z.chat + 1) } : { progetto: Math.min(Math.max(0, d.progetti.length - 1), z.progetto + 1), chat: 0 }));
      return;
    }
    const pg = Math.max(3, hCorpo - 6);
    if (pagina === 'lavoro') {
      if (key.ctrl && ch === 't') return setFuoco((f) => (f === 'shell' ? 'ia' : 'shell'));
      if (key.ctrl && ch === 'n') return setScheda((s) => SCHEDE[(SCHEDE.findIndex(([id]) => id === s) + 1) % SCHEDE.length][0]);
      if (key.ctrl && ch === 'd') return cambiaDest(1);
      if (key.ctrl && ch === 'f') return setFiltro((f) => FILTRI[(FILTRI.findIndex(([id]) => id === f) + 1) % FILTRI.length][0]);
      if (scheda === 'diff' && fuoco === 'ia' && revisione.prima) {
        const d = datiDiff();
        if (key.ctrl && ch === 'r') return decidi('rifiuta');
        if (d?.revisione && !inputIA && (key.upArrow || key.downArrow)) {
          setRevisione((r) => ({ ...r, sel: Math.max(0, Math.min(d.file.length - 1, r.sel + (key.downArrow ? 1 : -1))) }));
          setScorri((x) => ({ ...x, diff: 0 }));
          return;
        }
      }
      if (fuoco === 'shell' && (key.upArrow || key.downArrow)) {
        const s = sessione;
        if (!s.storia.length) return;
        s.indice = key.upArrow ? (s.indice < 0 ? s.storia.length - 1 : Math.max(0, s.indice - 1)) : s.indice < 0 ? -1 : s.indice + 1;
        if (s.indice >= s.storia.length) s.indice = -1;
        setInputShell(s.indice < 0 ? '' : s.storia[s.indice]);
        return;
      }
    }
    if (key.upArrow) return sposta(1);
    if (key.downArrow) return sposta(-1);
    if (key.pageUp) return sposta(pg);
    if (key.pageDown) return sposta(-pg);
  }

  const ruoloAttivo = RUOLI.find(([id]) => ruoli[id]?.stato === 'lavoro');
  const etichetta = modo ? 'risponde' : ruoloAttivo ? ruoloAttivo[1] : 'al lavoro';
  const consiglio = CONSIGLI[Math.floor(Date.now() / 12000) % CONSIGLI.length];
  const m = massimi.current;
  // dove guardano gli occhi del teschio: verso l'IA che pensa (sono a destra), altrimenti vagano piano
  const idIA = Object.keys(disponibili);
  const attiva = idIA.findIndex((id) => tel.current.ia[id]?.attivo);
  const sguardo = attiva >= 0 ? [0.45 + (0.45 * attiva) / Math.max(1, idIA.length - 1), -0.2] : [0.3 * Math.sin(tick * 0.03), 0.15 * Math.sin(tick * 0.05)];

  let corpo;
  if (selettore?.tipo === 'tavolozza') corpo = html`<${PaginaTavolozza} h=${hCorpo} w=${c} elenco=${filtrati()} query=${selettore.query} sel=${selettore.sel} azioni=${azioni} />`;
  else if (selettore) corpo = html`<${PaginaSelettore} h=${hCorpo} w=${c} elenco=${filtrati()} query=${selettore.query} sel=${selettore.sel} azioni=${azioni} />`;
  else if (pagina === 'progetti') { const d = datiProgetti(); corpo = html`<${PaginaProgetti} h=${hCorpo} w=${c} progetti=${d.progetti} selezione=${selezione} colonna=${colonna} chat=${d.chat} istantanee=${d.istantanee} progettoAttuale=${cwd} chatAttuale=${chat?.id} tick=${tick} ultimo=${eventi.prog} etichetta=${eventi.progTesto} azioni=${azioni} />`; }
  else if (pagina === 'database') { const d = datiDb(); corpo = html`<${PaginaDatabase} h=${hCorpo} w=${c} voci=${d.voci} categoria=${dbCategoria} query=${dbQuery} sel=${dbSel} conteggi=${d.conteggi} github=${d.github} pronto=${catalogatorePronto()} tick=${tick} ultimo=${eventi.db} etichetta=${eventi.dbTesto} azioni=${azioni} guardiano=${guardiano} />`; }
  else if (pagina === 'controllo') corpo = html`<${PaginaControllo} h=${hCorpo} w=${c} config=${config} selezionato=${selezionato} tel=${tel.current} disponibili=${disponibili} tick=${tick} messaggio=${messaggio} azioni=${azioni} />`;
  else if (pagina === 'studio') {
    const memoria = { preferenze: preferenze(), riassunto: stato.current.riassunto(), soluzioni: db.soluzioni(6), diario: stato.current.memoria(10).split('\n').filter((r) => r.trim()), ultimo: eventi.memoria, sincronizzata };
    corpo = html`<${PaginaStudio} h=${hCorpo} w=${c} lavagna=${lavagna} appunti=${stato.current.appunti()} scorri=${scorri.studio} tick=${tick} massimi=${m} memoria=${memoria} azioni=${azioni} />`;
  }
  else if (pagina === 'statistiche') corpo = html`<${PaginaStatistiche} h=${hCorpo} w=${c} config=${config} disponibili=${disponibili} tick=${tick} />`;
  else if (pagina === 'guida') corpo = html`<${PaginaGuida} h=${hCorpo} w=${c} scorri=${scorri.guida} massimi=${m} azioni=${azioni} />`;
  else corpo = html`<${PaginaLavoro} config=${config} h=${hCorpo} w=${c} messaggi=${messaggi.current} scorri=${scheda === 'registro' ? scorri.registro : scheda === 'diff' ? scorri.diff : scorri.lavoro} log=${log} ruoli=${ruoli} disponibili=${disponibili} compiti=${compiti} file=${file} tick=${tick} massimi=${m} tel=${tel.current} scheda=${scheda} fuoco=${fuoco} filtro=${filtro} destinazioni=${destinazioni} dest=${dest} sessione=${sessione} scorriShell=${scorri.shell} inCorso=${shellInCorso} azioni=${azioni} coda=${coda} domanda=${domanda} diff=${scheda === 'diff' ? datiDiff() : null} />`;

  let progresso = 0;
  if (occupato) {
    const n = compiti.length;
    if (!n) progresso = 0.06;
    else {
      const finiti = compiti.filter((x) => ['ok', 'avviso', 'errore', 'saltato'].includes(x.stato)).length;
      const fase = ruoli.revisore?.stato === 'lavoro' ? 0.85 : ruoli.esecutore?.stato === 'lavoro' || ruoli.operatore?.stato === 'lavoro' ? 0.5 : ruoli.pianificatore?.stato === 'lavoro' ? 0.15 : 0;
      progresso = Math.min(0.99, (finiti + (finiti < n ? fase : 0)) / n);
    }
  }
  const secondiLavoro = occupato ? Math.round((Date.now() - inizioLavoro.current) / 1000) : 0;
  const durataTesto = (sec) => (sec >= 60 ? Math.floor(sec / 60) + 'm ' + (sec % 60) + 's' : sec + 's');
  const chiamateAperte = occupato ? tel.current.chiamate.filter((x) => !x.fine) : [];
  const chiamataAperta = chiamateAperte[chiamateAperte.length - 1] || null;
  const colNotifica = { ok: C.verde, avviso: C.giallo, errore: C.rosso, info: C.ciano };
  const visibiliNotifiche = notifiche.filter((x) => Date.now() - x.t < 5000);
  const avanzTrans = transizione && config.animazioni === 'piena' ? Math.min(1, (Date.now() - transizione) / 190) : 1;

  const inLavoro = pagina === 'lavoro' && !selettore;
  const fuocoShell = inLavoro && fuoco === 'shell';
  const segnapostoIA = selettore?.tipo === 'tavolozza' ? 'cerca: un comando, una pagina, un tema, un profilo, un progetto, una voce del database…' : selettore ? 'scrivi una parte del nome del file…' : pagina === 'progetti' ? 'nome del nuovo progetto e INVIO · INVIO da solo apre quello selezionato · ←→ ↑↓ per muoverti' : pagina === 'database' ? 'scrivi per cercare · INVIO usa la voce scelta · trascina un file per aggiungerlo · /db per i comandi' : domanda ? 'rispondi con un numero da 1 a 4 (o clicca), ESC lascia decidere il direttore' : occupato ? 'scrivi la prossima richiesta: si mette in coda e parte da sola' : modo ? `scrivi a ${disponibili[modo].nome}…` : 'scrivi cosa vuoi fare…   (trascina qui file e foto · /aiuto)';
  const segnapostoShell = shellInCorso ? 'comando in corso… (Ctrl+C per fermarlo)' : `comando su ${dest.nome}…   (↑↓ precedenti · Ctrl+D cambia macchina)`;

  return html`<${Box} flexDirection="column" width=${c} height=${H} overflow="hidden">
    <${Box} height=${hTesta} overflow="hidden">
      <${Intestazione} config=${config} tick=${tick} pagina=${pagina} modo=${modo} disponibili=${disponibili} occupato=${occupato} etichetta=${etichetta} costo=${costo} larghezza=${c} grande=${grande} versione=${versione} progetto=${progetto?.nome || path.basename(cwd)} chat=${chat?.titolo} onPagina=${vaiAPagina} sguardo=${sguardo} lampeggio=${lampeggio} tel=${tel.current} coda=${coda.length} suoniAttivi=${!!suoni?.attivi} mouseAttivo=${config.mouse !== false} />
    <//>
    ${corpo}
    ${conAllegati && html`<${BarraAllegati} allegati=${allegati} larghezza=${c} azioni=${azioni} />`}
    ${conInput && html`<${Box} height=${3}>
      ${inLavoro && html`<${Box} borderStyle="round" borderColor=${fuocoShell ? C.ciano : C.scuro} paddingX=${1} width=${wTerm} flexShrink=${0}>
        <${Text} color=${fuocoShell ? C.ciano : C.grigio} bold>$ <//>
        ${fuocoShell
          ? html`<${TextInput} value=${inputShell} onChange=${cambiaInputShell} onSubmit=${inviaShell} placeholder=${tagliaA(segnapostoShell, wTerm - 7)} focus=${!finestra} />`
          : html`<${Text} color=${C.grigio} wrap="truncate-end">${inputShell || 'Ctrl+T per scrivere qui'}<//>`}
      <//>`}
      <${Box} borderStyle="round" borderColor=${selettore ? C.giallo : domanda ? C.giallo : fuocoShell ? C.scuro : occupato ? C.viola : C.rosa} paddingX=${1} flexGrow=${1}>
        <${Text} color=${selettore ? C.giallo : domanda ? C.giallo : occupato ? C.viola : C.rosa} bold>${selettore ? '🔎 ' : domanda ? '? ' : occupato ? '⋯ ' : '› '}<//>
        ${fuocoShell
          ? html`<${Text} color=${C.grigio} wrap="truncate-end">${inputIA || 'Ctrl+T per scrivere alle IA'}<//>`
          : html`<${TextInput} value=${selettore ? selettore.query : pagina === 'database' ? dbQuery : inputIA} onChange=${selettore ? (q) => setSelettore((s) => ({ ...s, query: q, sel: 0 })) : pagina === 'database' ? cambiaQueryDb : cambiaInputIA} onSubmit=${inviaIA} placeholder=${tagliaA(segnapostoIA, (inLavoro ? c - wTerm : c) - 8)} focus=${!finestra} />`}
      <//>
    <//>`}
    <${BarraStato} larghezza=${c} config=${config} modo=${modo} disponibili=${disponibili} occupato=${occupato} tick=${tick} ramo=${ramo} cambiati=${file.filter((f) => /^\s*[MADR?]/.test(f) && !f.startsWith('(')).length} progresso=${progresso} etichetta=${etichetta} coda=${coda.length}
      dettaglio=${`${compiti.length ? (compiti.filter((x) => x.stato === 'lavoro').length > 1 ? `‖ ${compiti.filter((x) => x.stato === 'lavoro').length} compiti insieme` : `compito ${Math.max(1, compiti.findIndex((x) => x.stato === 'lavoro') + 1)}/${compiti.length}`) : domanda ? 'aspetto la tua risposta' : 'il direttore divide il lavoro'} · ${etichetta}${chiamataAperta ? ` (${disponibili[chiamataAperta.ia]?.nome || chiamataAperta.ia}, ${durataTesto(Math.round((Date.now() - chiamataAperta.inizio) / 1000))})` : ''} · ${durataTesto(secondiLavoro)} · Ctrl+K salta l'IA`}
      consiglio=${pagina === 'controllo' ? '↑↓ parametro · ←→ regola · 1-5 mappature · TAB pagina' : `${I.studio} ${consiglio}`} />
    ${visibiliNotifiche.length > 0 && html`<${Box} position="absolute" marginTop=${Math.max(hTesta, H - 5 - 3 * visibiliNotifiche.length)} marginLeft=${Math.max(0, c - 53)} flexDirection="column" width=${50}>
      ${visibiliNotifiche.map((x, i) => html`<${Box} key=${x.t + '' + i} borderStyle="round" borderColor=${colNotifica[x.tipo] || C.ciano} width=${50}><${Text} color=${colNotifica[x.tipo] || C.ciano} bold wrap="truncate-end">${' ' + riempiA(x.testo, 46) + ' '}<//><//>`)}
    <//>`}
    ${finestra ? html`<${Finestra} finestra=${finestra} larghezza=${c} altezza=${H} versione=${versione} azioni=${{ avanti: () => gestisciTasto('', { return: true }), chiudi: () => gestisciTasto('', { escape: true }) }} />` : null}
    ${avanzTrans < 1 && html`<${Box} position="absolute" marginTop=${hTesta} marginLeft=${Math.min(c - 1, Math.round(avanzTrans * c))} width=${Math.max(1, c - Math.round(avanzTrans * c))} height=${hCorpo} flexDirection="column">
      ${Array.from({ length: hCorpo }, (_, y) => html`<${Text} key=${y} wrap="truncate-end"><${Text} color=${rgbHex(campiona(config.brand.colori.map(hex), y / hCorpo + avanzTrans))}>▌<//>${' '.repeat(Math.max(0, c - Math.round(avanzTrans * c) - 1))}<//>`)}
    <//>`}
  <//>`;
}

export async function avviaUI(props) {
  process.stdout.write('\x1b]0;KORTEX\x07\x1b[?1049h\x1b[2J\x1b[H');
  const stdin = new StdinFiltrato(process.stdin);
  if (props.config.mouse !== false) accendiMouse();
  const schermo = new SchermoStabile(process.stdout);
  // Niente deve scrivere sul terminale fuori da Ink (farebbe scorrere lo schermo): avvisi ed errori vanno nel log.
  const fileLog = path.join(os.homedir(), '.cache', 'kortex', 'kortex.log');
  try { fs.mkdirSync(path.dirname(fileLog), { recursive: true }); } catch { /* */ }
  const nelLog = (...a) => { try { fs.appendFileSync(fileLog, `[${new Date().toISOString()}] ${a.map((x) => (typeof x === 'string' ? x : x?.stack || JSON.stringify(x))).join(' ')}\n`); } catch { /* */ } };
  const veri = { log: console.log, error: console.error, warn: console.warn, info: console.info, stderr: process.stderr.write.bind(process.stderr) };
  console.log = console.error = console.warn = console.info = nelLog;
  // le sequenze per nascondere/mostrare il cursore possono passare; tutto il resto va nel log
  process.stderr.write = (d) => { const t = String(d); if (/^(\x1b\[\?25[lh])+$/.test(t)) return veri.stderr(t); nelLog(t); return true; };
  const app = render(html`<${App} ...${props} />`, { exitOnCtrlC: false, stdin, stdout: schermo, patchConsole: false });
  await app.waitUntilExit();
  chiudiTutto();
  spegniMouse();
  stdin.chiudi();
  schermo.chiudi();
  Object.assign(console, { log: veri.log, error: veri.error, warn: veri.warn, info: veri.info });
  process.stderr.write = veri.stderr;
  process.stdout.write('\x1b[?25h\x1b[?1049l');
  // se qualcosa resta appeso (un'IA che non vuole morire), tra poco si esce lo stesso
  setTimeout(() => process.exit(0), 1500).unref();
}
