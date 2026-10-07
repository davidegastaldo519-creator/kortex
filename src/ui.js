import React, { useState, useEffect, useRef, useCallback } from 'react';
import { render, Box, Text, useApp, useStdout, useInput } from 'ink';
import TextInput from 'ink-text-input';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { eseguiRichiesta, chatDiretta, catalogaCon } from './director.js';
import * as db from './database.js';
import { apriStato, righeFile } from './state.js';
import { fermaTutti } from './adapters.js';
import { FILE_CONFIG } from './config.js';
import { Telemetria } from './telemetria.js';
import { PARAMETRI, cambia, applicaMappatura, salvaConfig } from './parametri.js';
import { elencoDestinazioni, Sessioni } from './terminale.js';
import { html, C, PAGINE, Intestazione } from './grafica.js';
import { elencoProgetti, creaProgetto, importaProgetto, registraProgetto, toccaProgetto, progettoDi, elencoChat, creaChat, salvaChat, caricaChat, riassuntoChat, istantanea, elencoIstantanee, ripristina } from './progetti.js';
import { RUOLI, FILTRI, SCHEDE, BarraAllegati, PaginaSelettore, PaginaLavoro, PaginaControllo, PaginaStudio, PaginaGuida, PaginaProgetti, PaginaDatabase } from './pagine.js';

const CONSIGLI = [
  'Ctrl+T sposta il cursore tra il terminale ($) e le IA (›). Ctrl+N cambia la scheda a destra.',
  'Ctrl+D cambia la macchina del terminale: PC, SSH, console Python o Node.',
  'Trascina un file o una foto nella finestra: si allega da solo. Oppure /allega per cercarlo.',
  'Ctrl+O fa uno screenshot con Flameshot e lo allega alla prossima richiesta.',
  'La scheda AGENTI mostra l\'albero del lavoro, la mappa dei ruoli e la linea del tempo.',
  '/chat claude per parlare con una sola IA, /team per tornare alla squadra.',
  '/nota testo scrive un appunto sulla lavagna dello STUDIO, salvato nel progetto.',
  '/mappa 1 per domande veloci, /mappa 5 per i lavori enormi. 3 è il giusto mezzo.',
  'Se un\'IA finisce il limite, il suo cervello diventa rosso e lavorano le riserve.',
  '/dest aggiungi vps root@indirizzo  salva una macchina SSH nel terminale.',
];
const ora = () => new Date().toTimeString().slice(0, 8);
const ruoliIniziali = () => Object.fromEntries(RUOLI.map(([id]) => [id, { stato: 'attesa', ia: null }]));
const tipoDa = (t) => (/^\s*▶/.test(t) ? 'avvio' : /^\s*▸/.test(t) ? 'strumento' : /^\s*✖/.test(t) ? 'errore' : /^\s*⚠/.test(t) ? 'avviso' : /^\s*✔/.test(t) ? 'fine' : 'info');

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

function App({ config, disponibili, cwd: cwdIniziale, versione }) {
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
  const [scheda, setScheda] = useState('agenti');
  const [fuoco, setFuoco] = useState('ia');
  const [righe, setRighe] = useState(['']);
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
  const [scorri, setScorri] = useState({ lavoro: 0, studio: 0, guida: 0, registro: 0, shell: 0 });
  const [selezionato, setSelezionato] = useState(0);
  const [messaggio, setMessaggio] = useState('');
  const [lavagna, setLavagna] = useState({});
  const [allegati, setAllegati] = useState([]);
  const [selettore, setSelettore] = useState(null);
  const [filtro, setFiltro] = useState('tutti');
  const [iDest, setIDest] = useState(0);
  const [shellInCorso, setShellInCorso] = useState(false);
  const [, ridisegna] = useState(0);
  const storia = useRef([]);
  const massimi = useRef({});
  const stato = useRef(null);
  const tel = useRef(null);
  const sessioni = useRef(null);
  const cacheProgetti = useRef({ chiave: null, progetti: [], chat: [], istantanee: [] });
  const cacheDb = useRef({ chiave: null });
  if (!stato.current) stato.current = apriStato(cwd);
  if (!tel.current) tel.current = new Telemetria(Object.keys(disponibili));
  if (!sessioni.current) sessioni.current = new Sessioni(cwd);
  const destinazioni = elencoDestinazioni(config);
  const dest = destinazioni[Math.min(iDest, destinazioni.length - 1)];
  const sessione = sessioni.current.di(dest);

  useEffect(() => {
    const f = () => setDim({ c: stdout.columns, r: stdout.rows });
    stdout.on('resize', f);
    return () => stdout.off('resize', f);
  }, [stdout]);

  useEffect(() => {
    const passo = config.animazioni === 'spenta' ? 0 : config.animazioni === 'leggera' ? 1000 : occupato ? 120 : 250;
    if (!passo) return;
    const t = setInterval(() => setTick((x) => x + 1), passo);
    return () => clearInterval(t);
  }, [config.animazioni, occupato]);

  useEffect(() => {
    const t = setInterval(() => { tel.current.campiona(); ridisegna((x) => x + 1); }, 1000);
    return () => clearInterval(t);
  }, []);

  const scrivi = useCallback((testo) => setRighe((prima) => {
    const parti = String(testo).split('\n');
    const nuove = prima.slice(-2000);
    nuove[nuove.length - 1] += parti[0];
    for (let i = 1; i < parti.length; i++) nuove.push(parti[i]);
    return nuove;
  }), []);
  const aggiornaFile = useCallback(() => setFile(righeFile(cwd)), [cwd]);

  const ui = useRef(null);
  if (!ui.current) {
    ui.current = {
      out: (t) => scrivi(t),
      titolo: (t) => scrivi(`\n▌ ${t}\n`),
      log: (m, meta = {}) => setLog((p) => [...p.slice(-1500), { ora: ora(), testo: String(m), ia: meta.ia || null, ruolo: meta.ruolo || '', tipo: meta.tipo || tipoDa(String(m)) }]),
      ruolo: (r, s, ia) => setRuoli((p) => ({ ...p, [r]: { stato: s, ia: ia ?? p[r]?.ia ?? null } })),
      costo: (x) => setCosto((v) => v + x),
      compiti: (l) => setCompiti(l),
      pensiero: (tipo, testo) => setLavagna((l) => ({ ...l, [tipo]: tipo === 'richiesta' ? testo : l[tipo] && tipo !== 'compiti' ? l[tipo] + '\n\n' + testo : testo, ...(tipo === 'richiesta' ? { compiti: '', piano: '', revisione: '' } : {}) })),
      aggiornaFile,
    };
  }

  useEffect(() => {
    aggiornaFile();
    const attive = Object.values(disponibili).filter((d) => d.ok).map((d) => d.nome);
    scrivi(`Benvenuto in ${config.brand.nome} ${versione}. Cartella di lavoro: ${cwd}\n` +
      `IA collegate: ${attive.join(', ') || 'nessuna — scrivi /ia per capire perché'}\n` +
      `Scrivi cosa vuoi fare nella riga › e premi INVIO. Ctrl+T per passare al terminale $. TAB per le altre pagine.\n`);
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
    setFile(righeFile(percorso));
    const v = progettoDi(percorso);
    scrivi(`\n▌ PROGETTO APERTO: ${v?.nome || path.basename(percorso)}   (${percorso})\n${v?.descrizione ? v.descrizione + '\n' : ''}Scrivi una richiesta per iniziare una chat nuova, oppure apri una chat esistente dalla pagina PROGETTI.\n`);
  };
  const apriChat = (c) => {
    setChat(c);
    storia.current = c.messaggi.map((m) => ({ chi: m.chi === 'utente' ? 'Utente' : 'KORTEX', testo: m.testo }));
    setRighe(['']);
    scrivi(`▌ CHAT: ${c.titolo}   (${c.messaggi.length} messaggi)\n`);
    for (const m of c.messaggi) scrivi(m.chi === 'utente' ? `\n› ${m.testo}\n` : `${m.testo}\n`);
    scrivi('\n▌ Continua da qui: la squadra ricorda questa conversazione.\n');
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

  const contestoBase = () => ({ config, disponibili, cwd, stato: stato.current, ui: ui.current, tel: tel.current });
  const catalogatore = ({ nome, estratto: e, percorso }) => catalogaCon(contestoBase(), { nome, estratto: e, percorso });
  const catalogatorePronto = () => (config.ruoli.catalogatore || []).some((id) => disponibili[id]?.ok && !disponibili[id]?.limitato);
  const datiDb = () => {
    const chiave = `${dbVersione}|${dbCategoria}|${dbQuery}`;
    if (cacheDb.current.chiave !== chiave) {
      const q = dbQuery.trim().toLowerCase();
      const tutte = db.indice().filter((v) => (dbCategoria === 'tutte' || v.categoria === dbCategoria) && (!q || `${v.titolo} ${v.tag.join(' ')} ${v.descrizione} ${v.estratto}`.toLowerCase().includes(q)));
      cacheDb.current = { chiave, voci: tutte, conteggi: db.conteggi(), github: db.statoGithub() };
    }
    return cacheDb.current;
  };
  const aggiungiAlDb = async (cosa, tipo = 'file') => {
    scrivi(`\n📚 aggiungo al database: ${cosa}${catalogatorePronto() ? '  (il catalogatore scrive la scheda…)' : ''}\n`);
    try {
      const cat = catalogatorePronto() ? catalogatore : null;
      const v = tipo === 'nota' ? await db.aggiungiNota(cosa, cat) : /^https?:\/\//i.test(cosa) ? await db.aggiungiUrl(cosa, cat) : await db.aggiungiFile(cosa, cat);
      scrivi(`✔ ${v.titolo}  →  ${v.categoria}${v.tag.length ? '  #' + v.tag.join(' #') : ''}\n${v.descrizione ? '  ' + v.descrizione + '\n' : ''}`);
      setDbVersione((x) => x + 1);
      return v;
    } catch (e) {
      scrivi(`✖ non riesco ad aggiungerlo: ${e.message.split('\n')[0]}\n`);
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
      scrivi(`\n✖ non riesco ad allegare ${percorso}: ${e.message}\n`);
      return null;
    }
  };
  const scattaScreenshot = () => {
    const dest2 = path.join(stato.current.cartellaAllegati(), `screenshot-${ora().replace(/:/g, '')}.png`);
    const pezzi = [];
    let p;
    try { p = spawn('flameshot', ['gui', '--raw'], { stdio: ['ignore', 'pipe', 'ignore'] }); } catch { p = null; }
    if (!p) return scrivi(process.env.TERMUX_VERSION ? '\n· su Termux lo screenshot si fa dal telefono: poi trascina o /allega il file da storage/shared/Pictures\n' : '\n✖ Flameshot non trovato: installalo con  sudo apt install -y flameshot\n');
    p.on('error', () => scrivi('\n✖ Flameshot non trovato: installalo con  sudo apt install -y flameshot\n'));
    p.stdout.on('data', (d) => pezzi.push(d));
    p.on('close', () => {
      const buf = Buffer.concat(pezzi);
      if (buf.length < 100) return scrivi('\n· screenshot annullato\n');
      fs.writeFileSync(dest2, buf);
      setAllegati((a) => [...a, path.relative(cwd, dest2)]);
      scrivi(`\n✔ screenshot allegato: ${path.basename(dest2)}\n`);
    });
  };
  const cambiaInputIA = (valore) => {
    if (!selettore && !valore.startsWith('/') && valore.length - inputIA.length >= 3) {
      const trovati = percorsiIncollati(valore);
      if (trovati.length) {
        let resto = valore;
        for (const t of trovati) if (aggiungiAllegato(t.percorso)) resto = resto.replace(t.intero, '');
        setInputIA(resto.replace(/\s{2,}/g, ' ').trimStart());
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
      case 'esci': case 'q': fermaTutti(); sessioni.current.chiudiTutto(); exit(); return;
      case 'pulisci': setRighe(['']); return;
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
            if (v) apriProgetto(v.percorso); else scrivi(`\n✖ progetto non trovato: ${restoArg}\n`);
            return;
          }
          if (sotto === 'qui') { const v = registraProgetto({ nome: path.basename(cwd), percorso: cwd }); setProgetto(v); setVersioneProgetti((x) => x + 1); scrivi(`\n✔ questa cartella è ora il progetto "${v.nome}"\n`); return; }
        } catch (e) { scrivi(`\n✖ ${e.message}\n`); return; }
        scrivi('\n' + (elencoProgetti().map((q, i) => `  ${i + 1}. ${q.nome}  ${q.percorso}`).join('\n') || 'nessun progetto') + '\n/progetto nuovo nome · /progetto apri N · /progetto importa percorso · /progetto qui\n');
        return;
      }
      case 'db': {
        const sotto = resto[0];
        const restoArg = resto.slice(1).join(' ');
        try {
          if (sotto === 'aggiungi' && restoArg) { aggiungiAlDb(restoArg.replace(/^~/, os.homedir())); return; }
          if (sotto === 'nota' && restoArg) { aggiungiAlDb(restoArg, 'nota'); return; }
          if (sotto === 'sposta' && resto[2]) { const v = db.sposta(resto[1], resto[2]); setDbVersione((x) => x + 1); scrivi(`\n✔ ${v.titolo} → ${v.categoria}\n`); return; }
          if (sotto === 'tag' && resto[2]) { const v = db.aggiornaVoce(resto[1], { tag: resto.slice(2).join(' ').split(/[,\s]+/).filter(Boolean) }); setDbVersione((x) => x + 1); scrivi(`\n✔ tag di ${v.titolo}: ${v.tag.join(', ')}\n`); return; }
          if (sotto === 'titolo' && resto[2]) { const v = db.aggiornaVoce(resto[1], { titolo: resto.slice(2).join(' ') }); setDbVersione((x) => x + 1); scrivi(`\n✔ titolo: ${v.titolo}\n`); return; }
          if (sotto === 'togli' && resto[1]) { const v = db.togli(resto[1]); setDbVersione((x) => x + 1); scrivi(`\n✔ ${v.titolo} spostato nel cestino (archivio/.cestino)\n`); return; }
          if (sotto === 'cerca' && restoArg) { const r = db.cerca(restoArg, 6); scrivi('\n' + (r.map((v) => `  ${v.id}  ${v.titolo} [${v.categoria}]`).join('\n') || 'niente di utile') + '\n'); return; }
          if (sotto === 'github') { scrivi('\n📚 collego il database a GitHub (repository privato kortex-database)…\n'); const u = db.collegaGithub(); setDbVersione((x) => x + 1); scrivi(`✔ collegato: ${u}\n`); return; }
          if (sotto === 'sync') { scrivi(`\n✔ database sincronizzato: ${db.sincronizza()}\n`); return; }
          if (sotto === 'scarica' && resto[1]) { scrivi(`\n✔ ${db.scaricaDaGithub(resto[1])}\n`); setDbVersione((x) => x + 1); return; }
        } catch (e) { scrivi(`\n✖ ${e.message.split('\n')[0]}\n`); return; }
        scrivi(`\n📚 Database: ${db.DIR_DB}\n  /db aggiungi percorso-o-url · /db nota testo · /db cerca parole\n  /db sposta ID categoria · /db tag ID a,b · /db titolo ID nuovo titolo · /db togli ID\n  /db github (copia privata) · /db sync · /db scarica utente-github (su una macchina nuova)\nNella richiesta: @titolo o @ID obbliga le IA a usare quella voce, @manuali tutta la categoria.\n`);
        return;
      }
      case 'ripristina': {
        if (!arg) { scrivi('\n' + (elencoIstantanee(cwd, 15).map((i) => `  ${i.id}  ${i.data}  ${i.etichetta}`).join('\n') || 'nessun punto di ripristino') + '\nUso: /ripristina ID\n'); return; }
        try {
          const r = ripristina(cwd, arg);
          scrivi(`\n✔ file riportati al punto ${arg}${r.rimossi ? ` (${r.rimossi} file creati dopo sono stati tolti)` : ''}. Per annullare: /ripristina ${r.sicurezza}\n`);
          aggiornaFile(); setVersioneProgetti((x) => x + 1);
        } catch (e) { scrivi(`\n✖ ripristino non riuscito: ${e.message.split('\n')[0]}\n`); }
        return;
      }
      case 'scheda': { const s = SCHEDE[Number(arg) - 1]; if (s) setScheda(s[0]); return; }
      case 'dest': {
        if (!arg) { scrivi('\n' + destinazioni.map((d, i) => `  ${i + 1}. ${d.nome}${d.host ? '  ' + d.host : ''}  (${d.tipo}${d.origine ? ', ' + d.origine : ''})`).join('\n') + '\n/dest N per scegliere · /dest aggiungi nome utente@host [porta] · /dest togli nome\n'); return; }
        if (resto[0] === 'aggiungi') {
          const [, nome, host, porta] = resto;
          if (!nome || !host) { scrivi('\nUso: /dest aggiungi nome utente@host [porta]\n'); return; }
          config.destinazioni = [...(config.destinazioni || []).filter((d) => d.nome !== nome), { nome, host, porta }];
          salva('destinazione salvata'); scrivi(`\n✔ destinazione ${nome} (${host}) salvata: Ctrl+D per usarla\n`); return;
        }
        if (resto[0] === 'togli') {
          config.destinazioni = (config.destinazioni || []).filter((d) => d.nome !== resto[1]);
          salva('destinazione tolta'); setIDest(0); scrivi(`\n✔ destinazione ${resto[1]} tolta\n`); return;
        }
        const i = Number.isInteger(Number(arg)) ? Number(arg) - 1 : destinazioni.findIndex((d) => d.nome === arg || d.id === arg);
        if (destinazioni[i]) { setIDest(i); scrivi(`\n▌ terminale su ${destinazioni[i].nome}\n`); } else scrivi(`\n✖ destinazione non trovata: ${arg}\n`);
        return;
      }
      case 'allega':
        if (arg) {
          const p = path.resolve(cwd, arg.replace(/^~/, os.homedir()));
          if (fs.existsSync(p) && fs.statSync(p).isFile()) { aggiungiAllegato(p); scrivi(`\n✔ allegato ${path.basename(p)}\n`); }
          else scrivi(`\n✖ file non trovato: ${p}\n`);
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
        stato.current.annotaAppunto(arg); scrivi('\n✔ appunto scritto sulla lavagna (pagina STUDIO)\n'); return;
      case 'ia': scrivi('\n' + Object.values(disponibili).map((d) => `${d.ok ? '●' : '○'} ${d.nome.padEnd(8)} ${d.ok ? d.versione || '' : d.nota || ''}${d.limitato ? '  [limite raggiunto]' : ''}`).join('\n') + '\n'); return;
      case 'ruoli': scrivi('\n' + Object.entries(config.ruoli).map(([r, l]) => `${r.padEnd(14)} ${l.join(' → ')}`).join('\n') + '\n'); return;
      case 'stato': scrivi('\n' + (stato.current.memoria(25) || '(diario vuoto)') + '\n'); return;
      case 'config': scrivi(`\nConfigurazione: ${FILE_CONFIG}\n`); return;
      case 'chat': {
        if (resto[0] === 'nuova') { const c = creaChat(cwd, resto.slice(1).join(' ') || 'Nuova chat'); apriChat(c); return; }
        if (resto[0] === 'apri') { const l = elencoChat(cwd); const c = l[Number(resto[1]) - 1]; if (c) apriChat(c); else scrivi('\n✖ chat non trovata\n'); return; }
        const attive = Object.values(disponibili).filter((d) => d.ok && !d.limitato);
        if (!arg) { scrivi(`\nCon chi vuoi parlare? ${attive.map((d) => '/chat ' + d.id).join('   ')}\n`); return; }
        if (!disponibili[arg]?.ok) { scrivi(`\n✖ ${arg} non è disponibile. Attive: ${attive.map((d) => d.id).join(', ')}\n`); return; }
        setModo(arg); storia.current = []; scrivi(`\n▌ CHAT DIRETTA con ${disponibili[arg].nome} — /team per tornare alla squadra\n`); return;
      }
      case 'team': setModo(null); scrivi('\n▌ SQUADRA al lavoro\n'); return;
      case 'nuova':
        if (!modo) { scrivi('\n/nuova vale in chat diretta\n'); return; }
        stato.current.salvaSessione(modo, 'chat', null); storia.current = []; scrivi(`\n▌ Nuova conversazione con ${disponibili[modo].nome}\n`); return;
      default:
        scrivi('\nComandi: /dest  /scheda N  /allega [file]  /allegati  /togli N  /screenshot  /chat X  /team  /nuova  /mappa N  /nota testo  /pagina N  /ia  /ruoli  /stato  /pulisci  /esci\nLa pagina GUIDA spiega tutto nel dettaglio.\n');
    }
  }

  async function inviaIA(valore) {
    const t = valore.trim();
    setInputIA('');
    if (selettore) {
      const f = filtrati()[selettore.sel];
      if (f) { aggiungiAllegato(f); scrivi(`\n✔ allegato ${path.basename(f)}\n`); }
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
      try { const v = creaProgetto(t); apriProgetto(v.percorso); setPagina('lavoro'); } catch (e) { scrivi(`\n✖ ${e.message}\n`); }
      return;
    }
    if (!t || occupato) return;
    if (t.startsWith('/')) return comando(t);
    setOccupato(true);
    // ogni cartella in cui lavori diventa un progetto, con le sue chat
    let prog = progetto;
    if (!prog) { prog = registraProgetto({ nome: path.basename(cwd), percorso: cwd }); setProgetto(prog); }
    let c = chat;
    if (!c) { c = creaChat(cwd, t.slice(0, 60)); setChat(c); }
    const prima = istantanea(cwd, `prima di: ${t.slice(0, 70)}`);
    c.messaggi.push({ chi: 'utente', testo: t, ora: new Date().toISOString(), istantanea: prima, allegati });
    salvaChat(cwd, c);
    setScorri((s) => ({ ...s, lavoro: 0 }));
    const daAllegare = allegati;
    setAllegati([]);
    scrivi(`\n› ${t}${daAllegare.length ? `   📎 ${daAllegare.length} allegat${daAllegare.length === 1 ? 'o' : 'i'}` : ''}\n`);
    const conoscenze = [...new Map([...db.menzioni(t), ...db.cerca(t, 3)].map((v) => [v.id, v])).values()].slice(0, 5);
    if (conoscenze.length) scrivi(`📚 dal database: ${conoscenze.map((v) => v.titolo).join(' · ')}\n`);
    const ctx = { config, disponibili, cwd, stato: stato.current, ui: ui.current, tel: tel.current, allegati: daAllegare, chatId: c.id, chatPrecedente: riassuntoChat({ messaggi: c.messaggi.slice(0, -1) }), conoscenze };
    let risposta = '';
    try {
      if (modo) {
        const r = await chatDiretta({ id: modo, messaggio: t, ctx, storia: storia.current });
        storia.current.push({ chi: 'Utente', testo: t });
        if (r.ok) storia.current.push({ chi: disponibili[modo].nome, testo: r.testo });
        risposta = r.ok ? r.testo : `✖ ${r.errore}`;
        scrivi('\n');
      } else {
        setRuoli(ruoliIniziali());
        const esiti = await eseguiRichiesta({ richiesta: t, ctx });
        risposta = (esiti || []).map((e, i) => `${e.esito === 'OK' ? '✔' : e.esito === 'FALLITO' ? '✖' : '⚠'} ${i + 1}. ${e.c.titolo} — ${e.esito}`).join('\n') || '(nessun esito)';
      }
    } catch (e) {
      ui.current.log('✖ ' + e.message, { tipo: 'errore' });
      risposta = '✖ ' + e.message;
    }
    const dopo = istantanea(cwd, `dopo: ${t.slice(0, 70)}`);
    c.messaggi.push({ chi: 'kortex', testo: risposta, ora: new Date().toISOString(), istantanea: dopo });
    salvaChat(cwd, c);
    setVersioneProgetti((x) => x + 1);
    setOccupato(false);
    aggiornaFile();
  }
  const inviaShell = (valore) => { const t = valore.trim(); setInputShell(''); if (t) eseguiShell(t); };

  const filtrati = () => {
    if (!selettore) return [];
    const q = (selettore.query || '').toLowerCase();
    return selettore.indice.filter((f) => !q || f.toLowerCase().includes(q)).slice(0, 400);
  };

  // ---------- impaginazione ----------
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
    setPagina(PAGINE[(i + verso + PAGINE.length) % PAGINE.length][0]);
    setMessaggio('');
  };
  const chiaveScorri = pagina === 'lavoro' ? (fuoco === 'shell' ? 'shell' : scheda === 'registro' ? 'registro' : 'lavoro') : pagina;
  const dalBasso = ['lavoro', 'registro', 'shell'].includes(chiaveScorri);
  const sposta = (quanto) => setScorri((s) => {
    const v = s[chiaveScorri] ?? 0;
    const nuovo = dalBasso ? v + quanto : v - quanto;
    return { ...s, [chiaveScorri]: Math.max(0, Math.min(massimi.current[chiaveScorri] ?? 0, nuovo)) };
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

  useInput((ch, key) => {
    if (key.ctrl && 'tndfo'.includes(ch)) scartaLettera(ch);
    if (key.ctrl && ch === 'c') {
      if (pagina === 'lavoro' && fuoco === 'shell' && sessioni.current.interrompi(dest)) return;
      fermaTutti(); sessioni.current.chiudiTutto(); exit(); return;
    }
    if (key.ctrl && ch === 'o') return scattaScreenshot();
    if (selettore) {
      const n = filtrati().length;
      if (key.escape) { setSelettore(null); return; }
      if (key.upArrow) return setSelettore((s) => ({ ...s, sel: Math.max(0, s.sel - 1) }));
      if (key.downArrow) return setSelettore((s) => ({ ...s, sel: Math.min(Math.max(0, n - 1), s.sel + 1) }));
      return;
    }
    if (key.tab) return cambiaPagina(key.shift ? -1 : 1);
    if (key.escape) return setPagina('lavoro');
    if (pagina === 'controllo') {
      if (key.upArrow) return setSelezionato((x) => (x - 1 + PARAMETRI.length) % PARAMETRI.length);
      if (key.downArrow) return setSelezionato((x) => (x + 1) % PARAMETRI.length);
      if (key.leftArrow || key.rightArrow) { cambia(config, PARAMETRI[selezionato], key.rightArrow ? 1 : -1); return salva('salvato'); }
      if (/^[1-5]$/.test(ch)) { const m = applicaMappatura(config, Number(ch) - 1); return salva(`mappatura ${m.nome} applicata`); }
      return;
    }
    if (pagina === 'database') {
      if (t.startsWith('/')) { setDbQuery(''); return comando(t); }
      const d = datiDb();
      const v = d.voci[dbSel];
      if (v) { setInputIA(`@${v.id} `); setDbQuery(''); setPagina('lavoro'); setFuoco('ia'); scrivi(`\n📚 ${v.titolo}: scrivi cosa farne, l'IA la userà\n`); }
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
  });

  const ruoloAttivo = RUOLI.find(([id]) => ruoli[id].stato === 'lavoro');
  const etichetta = modo ? 'risponde' : ruoloAttivo ? ruoloAttivo[1] : 'al lavoro';
  const consiglio = CONSIGLI[Math.floor(Date.now() / 12000) % CONSIGLI.length];
  const m = massimi.current;

  let corpo;
  if (selettore) corpo = html`<${PaginaSelettore} h=${hCorpo} w=${c} elenco=${filtrati()} query=${selettore.query} sel=${selettore.sel} />`;
  else if (pagina === 'progetti') { const d = datiProgetti(); corpo = html`<${PaginaProgetti} h=${hCorpo} w=${c} progetti=${d.progetti} selezione=${selezione} colonna=${colonna} chat=${d.chat} istantanee=${d.istantanee} progettoAttuale=${cwd} chatAttuale=${chat?.id} />`; }
  else if (pagina === 'database') { const d = datiDb(); corpo = html`<${PaginaDatabase} h=${hCorpo} w=${c} voci=${d.voci} categoria=${dbCategoria} query=${dbQuery} sel=${dbSel} conteggi=${d.conteggi} github=${d.github} pronto=${catalogatorePronto()} />`; }
  else if (pagina === 'controllo') corpo = html`<${PaginaControllo} h=${hCorpo} w=${c} config=${config} selezionato=${selezionato} tel=${tel.current} disponibili=${disponibili} tick=${tick} messaggio=${messaggio} />`;
  else if (pagina === 'studio') corpo = html`<${PaginaStudio} h=${hCorpo} w=${c} lavagna=${lavagna} appunti=${stato.current.appunti()} scorri=${scorri.studio} tick=${tick} massimi=${m} />`;
  else if (pagina === 'guida') corpo = html`<${PaginaGuida} h=${hCorpo} w=${c} scorri=${scorri.guida} massimi=${m} />`;
  else corpo = html`<${PaginaLavoro} h=${hCorpo} w=${c} righe=${righe} scorri=${scheda === 'registro' ? scorri.registro : scorri.lavoro} log=${log} ruoli=${ruoli} disponibili=${disponibili} compiti=${compiti} file=${file} tick=${tick} massimi=${m} tel=${tel.current} scheda=${scheda} fuoco=${fuoco} filtro=${filtro} destinazioni=${destinazioni} dest=${dest} sessione=${sessione} scorriShell=${scorri.shell} inCorso=${shellInCorso} />`;

  const inLavoro = pagina === 'lavoro' && !selettore;
  const fuocoShell = inLavoro && fuoco === 'shell';
  const segnapostoIA = selettore ? 'scrivi una parte del nome del file…' : pagina === 'progetti' ? 'nome del nuovo progetto e INVIO · INVIO da solo apre quello selezionato · ←→ ↑↓ per muoverti' : pagina === 'database' ? 'scrivi per cercare · INVIO usa la voce scelta · trascina un file per aggiungerlo · /db per i comandi' : modo ? `scrivi a ${disponibili[modo].nome}…` : 'scrivi cosa vuoi fare…   (trascina qui file e foto · /aiuto)';
  const segnapostoShell = shellInCorso ? 'comando in corso… (Ctrl+C per fermarlo)' : `comando su ${dest.nome}…   (↑↓ precedenti · Ctrl+D cambia macchina)`;
  const bloccato = occupato && !selettore;

  return html`<${Box} flexDirection="column" width=${c} height=${H}>
    <${Box} height=${hTesta}>
      <${Intestazione} config=${config} tick=${tick} pagina=${pagina} modo=${modo} disponibili=${disponibili} occupato=${occupato} etichetta=${etichetta} costo=${costo} larghezza=${c} grande=${grande} versione=${versione} progetto=${progetto?.nome || path.basename(cwd)} chat=${chat?.titolo} />
    <//>
    ${corpo}
    ${conAllegati && html`<${BarraAllegati} allegati=${allegati} larghezza=${c} />`}
    ${conInput && html`<${Box} height=${3}>
      ${inLavoro && html`<${Box} borderStyle="round" borderColor=${fuocoShell ? C.ciano : C.scuro} paddingX=${1} width=${wTerm} flexShrink=${0}>
        <${Text} color=${fuocoShell ? C.ciano : C.grigio} bold>$ <//>
        ${fuocoShell
          ? html`<${TextInput} value=${inputShell} onChange=${setInputShell} onSubmit=${inviaShell} placeholder=${segnapostoShell} />`
          : html`<${Text} color=${C.grigio} wrap="truncate-end">${inputShell || 'Ctrl+T per scrivere qui'}<//>`}
      <//>`}
      <${Box} borderStyle="round" borderColor=${bloccato ? C.scuro : selettore ? C.giallo : fuocoShell ? C.scuro : C.rosa} paddingX=${1} flexGrow=${1}>
        <${Text} color=${selettore ? C.giallo : C.rosa} bold>${selettore ? '🔎 ' : '› '}<//>
        ${bloccato
          ? html`<${Text} color=${C.grigio}>le IA stanno lavorando…  (Ctrl+T per usare il terminale intanto, TAB per le altre pagine)<//>`
          : fuocoShell
            ? html`<${Text} color=${C.grigio} wrap="truncate-end">${inputIA || 'Ctrl+T per scrivere alle IA'}<//>`
            : html`<${TextInput} value=${selettore ? selettore.query : pagina === 'database' ? dbQuery : inputIA} onChange=${selettore ? (q) => setSelettore((s) => ({ ...s, query: q, sel: 0 })) : pagina === 'database' ? cambiaQueryDb : cambiaInputIA} onSubmit=${inviaIA} placeholder=${segnapostoIA} />`}
      <//>
    <//>`}
    <${Box} height=${1} paddingX=${1}>
      <${Text} color=${C.ciano}>💡 <//><${Text} color=${C.grigio} wrap="truncate-end">${pagina === 'controllo' ? '↑↓ scegli il parametro · ←→ regola · 1-5 mappature · TAB pagina · ESC torna a LAVORO' : consiglio}<//>
    <//>
  <//>`;
}

export async function avviaUI(props) {
  process.stdout.write('\x1b]0;KORTEX\x07\x1b[?1049h\x1b[2J\x1b[H');
  const app = render(html`<${App} ...${props} />`, { exitOnCtrlC: false });
  await app.waitUntilExit();
  fermaTutti();
  process.stdout.write('\x1b[?25h\x1b[?1049l');
}
