import React, { useState, useEffect, useRef, useCallback } from 'react';
import { render, Box, Text, useApp, useStdout, useInput } from 'ink';
import TextInput from 'ink-text-input';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { eseguiRichiesta, chatDiretta } from './director.js';
import { apriStato, righeFile } from './state.js';
import { fermaTutti } from './adapters.js';
import { FILE_CONFIG } from './config.js';
import { Telemetria } from './telemetria.js';
import { PARAMETRI, cambia, applicaMappatura, salvaConfig } from './parametri.js';
import { html, C, PAGINE, Intestazione } from './grafica.js';
import { RUOLI, FILTRI, BarraAllegati, PaginaSelettore, PaginaLavoro, PaginaTerminale, PaginaControllo, PaginaStudio, PaginaGuida } from './pagine.js';

const CONSIGLI = [
  'TAB cambia pagina. In TERMINALE trovi il registro completo e una shell vera.',
  'Trascina un file o una foto nella finestra: si allega da solo. Oppure /allega per cercarlo.',
  'Ctrl+O fa uno screenshot con Flameshot e lo allega alla prossima richiesta.',
  'Le frecce SU e GIÙ scorrono il testo. PAG SU e PAG GIÙ di una pagina intera.',
  '/chat claude per parlare con una sola IA, /team per tornare alla squadra.',
  '/nota testo scrive un appunto sulla lavagna dello STUDIO, salvato nel progetto.',
  '/mappa 1 per domande veloci, /mappa 5 per i lavori enormi. 3 è il giusto mezzo.',
  'Il dollaro in alto è un valore indicativo: con gli abbonamenti non paghi a consumo.',
  'Se un\'IA finisce il limite, il suo cervello diventa rosso e lavorano le riserve.',
];
const INTERATTIVI = /^(sudo\s+)?(nano|vim?|nvim|top|htop|less|more|man|ssh|python3?|node|mc|watch)(\s|$)/;
const ora = () => new Date().toTimeString().slice(0, 8);
const ruoliIniziali = () => Object.fromEntries(RUOLI.map(([id]) => [id, { stato: 'attesa', ia: null }]));
const tipoDa = (t) => (/^\s*▶/.test(t) ? 'avvio' : /^\s*▸/.test(t) ? 'strumento' : /^\s*✖/.test(t) ? 'errore' : /^\s*⚠/.test(t) ? 'avviso' : /^\s*✔/.test(t) ? 'fine' : 'info');
const ANSI = /\x1b\[[0-9;?]*[A-Za-z]/g;

// File trascinati nella finestra: il terminale incolla il loro percorso (a volte tra apici o come file://).
function percorsiIncollati(testo) {
  const trovati = [];
  const re = /'([^']+)'|"([^"]+)"|(?:file:\/\/)?((?:~|\/)(?:\\ |[^\s'"])+)/g;
  let m;
  while ((m = re.exec(testo))) {
    let p = (m[1] || m[2] || m[3] || '').replace(/^file:\/\//, '').replace(/\\ /g, ' ');
    try { p = decodeURIComponent(p); } catch { /* lascio com'è */ }
    if (p.startsWith('~')) p = path.join(os.homedir(), p.slice(1));
    try { if (fs.statSync(p).isFile()) trovati.push({ intero: m[0], percorso: p }); } catch { /* non è un file */ }
  }
  return trovati;
}

// Dove cercare i file da allegare: il progetto e le cartelle tipiche di foto e download.
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
  for (const d of ['Downloads', 'Scaricati', 'Pictures', 'Immagini', 'Pictures/Screenshots', 'Immagini/Screenshot', 'Desktop', 'Scrivania', 'Documents', 'Documenti']) {
    visita(path.join(casa, d), 1);
  }
  return [...new Set(out)];
}

function App({ config, disponibili, cwd }) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [dim, setDim] = useState({ c: stdout.columns || 80, r: stdout.rows || 24 });
  const [pagina, setPagina] = useState('lavoro');
  const [righe, setRighe] = useState(['']);
  const [log, setLog] = useState([]);
  const [ruoli, setRuoli] = useState(ruoliIniziali());
  const [compiti, setCompiti] = useState([]);
  const [input, setInput] = useState('');
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
  const [selettore, setSelettore] = useState(null); // { query, sel, indice }
  const [filtro, setFiltro] = useState('tutti');
  const [fuoco, setFuoco] = useState('shell');
  const [shell, setShell] = useState([]);
  const [shellInCorso, setShellInCorso] = useState(false);
  const [cwdShell, setCwdShell] = useState(cwd);
  const [, ridisegna] = useState(0);
  const storia = useRef([]);
  const comandi = useRef({ elenco: [], indice: -1 });
  const processoShell = useRef(null);
  const massimi = useRef({});
  const stato = useRef(null);
  const tel = useRef(null);
  if (!stato.current) stato.current = apriStato(cwd);
  if (!tel.current) tel.current = new Telemetria(Object.keys(disponibili));

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
  const shellScrivi = useCallback((t, tipo = 'out') => setShell((s) => {
    const nuove = String(t).replace(ANSI, '').replace(/\r/g, '').split('\n').map((x) => ({ t: x, tipo }));
    if (nuove.length > 1 && nuove[nuove.length - 1].t === '') nuove.pop();
    return [...s, ...nuove].slice(-3000);
  }), []);

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
    scrivi(`Benvenuto in ${config.brand.nome}. Cartella di lavoro: ${cwd}\n` +
      `IA collegate: ${attive.join(', ') || 'nessuna — scrivi /ia per capire perché'}\n` +
      `Scrivi cosa vuoi fare e premi INVIO. Trascina file o foto per allegarli. TAB per le altre pagine.\n`);
  }, []);

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
    const dest = path.join(stato.current.cartellaAllegati(), `screenshot-${new Date().toTimeString().slice(0, 8).replace(/:/g, '')}.png`);
    const pezzi = [];
    let p;
    try { p = spawn('flameshot', ['gui', '--raw'], { stdio: ['ignore', 'pipe', 'ignore'] }); } catch { p = null; }
    if (!p) return scrivi('\n✖ Flameshot non trovato: installalo con  sudo apt install -y flameshot\n');
    p.on('error', () => scrivi('\n✖ Flameshot non trovato: installalo con  sudo apt install -y flameshot\n'));
    p.stdout.on('data', (d) => pezzi.push(d));
    p.on('close', () => {
      const buf = Buffer.concat(pezzi);
      if (buf.length < 100) return scrivi('\n· screenshot annullato\n');
      fs.writeFileSync(dest, buf);
      setAllegati((a) => [...a, path.relative(cwd, dest)]);
      scrivi(`\n✔ screenshot allegato: ${path.basename(dest)}\n`);
    });
  };

  const cambiaInput = (valore) => {
    // un incollaggio o un trascinamento arriva tutto insieme: lì cerco i percorsi dei file
    if (pagina !== 'terminale' && !selettore && valore.length - input.length >= 3) {
      const trovati = percorsiIncollati(valore.slice(0, valore.length));
      if (trovati.length) {
        let resto = valore;
        for (const t of trovati) if (aggiungiAllegato(t.percorso)) resto = resto.replace(t.intero, '');
        setInput(resto.replace(/\s{2,}/g, ' ').trimStart());
        return;
      }
    }
    setInput(valore);
  };

  // ---------- shell ----------
  const eseguiShell = (cmd) => {
    comandi.current.elenco = [...comandi.current.elenco.filter((c) => c !== cmd), cmd].slice(-200);
    comandi.current.indice = -1;
    const casa = os.homedir();
    const dove = cwdShell.startsWith(casa) ? '~' + cwdShell.slice(casa.length) : cwdShell;
    shellScrivi(`${dove} $ ${cmd}`, 'cmd');
    setScorri((s) => ({ ...s, shell: 0 }));
    const cd = cmd.match(/^cd(?:\s+(.*))?$/);
    if (cd) {
      let dest = (cd[1] || '~').trim().replace(/^['"]|['"]$/g, '');
      if (dest.startsWith('~')) dest = path.join(casa, dest.slice(1));
      dest = path.resolve(cwdShell, dest);
      try { if (fs.statSync(dest).isDirectory()) { setCwdShell(dest); return; } } catch { /* */ }
      shellScrivi(`cd: cartella non trovata: ${dest}`, 'err');
      return;
    }
    if (cmd === 'clear' || cmd === 'pulisci') { setShell([]); return; }
    if (INTERATTIVI.test(cmd)) {
      shellScrivi('⚠ questo programma è interattivo e qui non può funzionare: aprilo in un terminale normale (Ctrl+Alt+T).', 'info');
      return;
    }
    const p = spawn('bash', ['-lc', cmd], { cwd: cwdShell, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, TERM: 'dumb', NO_COLOR: '1' } });
    processoShell.current = p;
    setShellInCorso(true);
    p.stdout.on('data', (d) => shellScrivi(d.toString(), 'out'));
    p.stderr.on('data', (d) => shellScrivi(d.toString(), 'err'));
    p.on('error', (e) => shellScrivi(e.message, 'err'));
    p.on('close', (codice, segnale) => {
      processoShell.current = null;
      setShellInCorso(false);
      if (segnale) shellScrivi(`· interrotto (${segnale})`, 'info');
      else if (codice) shellScrivi(`· uscito con codice ${codice}`, 'info');
      aggiornaFile();
    });
  };

  // ---------- comandi /... ----------
  function comando(t) {
    const [cmd, ...resto] = t.slice(1).split(/\s+/);
    const arg = resto.join(' ');
    switch (cmd) {
      case 'esci': case 'q': fermaTutti(); exit(); return;
      case 'pulisci': setRighe(['']); return;
      case 'pagina': { const p = PAGINE[Number(arg) - 1]; if (p) setPagina(p[0]); return; }
      case 'allega':
        if (arg) {
          const p = path.resolve(cwd, arg.replace(/^~/, os.homedir()));
          if (fs.existsSync(p) && fs.statSync(p).isFile()) { aggiungiAllegato(p); scrivi(`\n✔ allegato ${path.basename(p)}\n`); }
          else scrivi(`\n✖ file non trovato: ${p}\n`);
          return;
        }
        setSelettore({ query: '', sel: 0, indice: indiceFile(cwd) });
        return;
      case 'allegati':
        scrivi('\n' + (allegati.length ? allegati.map((a, i) => `  ${i + 1}. ${a}`).join('\n') : 'nessun allegato') + '\n');
        return;
      case 'togli':
        if (arg === 'tutti') { setAllegati([]); return; }
        setAllegati((a) => a.filter((_, i) => i !== Number(arg) - 1));
        return;
      case 'screenshot': scattaScreenshot(); return;
      case 'mappa': {
        const m = applicaMappatura(config, Number(arg) - 1);
        if (m) { salva(`mappatura ${m.nome} applicata`); scrivi(`\n▌ Mappatura ${m.nome}: ${m.uso}\n`); }
        else scrivi('\nUso: /mappa 1 … /mappa 5\n');
        return;
      }
      case 'nota':
        if (!arg) { scrivi('\nUso: /nota testo dell\'appunto\n'); return; }
        stato.current.annotaAppunto(arg);
        scrivi('\n✔ appunto scritto sulla lavagna (pagina STUDIO)\n');
        return;
      case 'ia':
        scrivi('\n' + Object.values(disponibili).map((d) => `${d.ok ? '●' : '○'} ${d.nome.padEnd(8)} ${d.ok ? d.versione || '' : d.nota || ''}${d.limitato ? '  [limite raggiunto]' : ''}`).join('\n') + '\n');
        return;
      case 'ruoli': scrivi('\n' + Object.entries(config.ruoli).map(([r, l]) => `${r.padEnd(14)} ${l.join(' → ')}`).join('\n') + '\n'); return;
      case 'stato': scrivi('\n' + (stato.current.memoria(25) || '(diario vuoto)') + '\n'); return;
      case 'config': scrivi(`\nConfigurazione: ${FILE_CONFIG}\n`); return;
      case 'chat': {
        const attive = Object.values(disponibili).filter((d) => d.ok && !d.limitato);
        if (!arg) { scrivi(`\nCon chi vuoi parlare? ${attive.map((d) => '/chat ' + d.id).join('   ')}\n`); return; }
        if (!disponibili[arg]?.ok) { scrivi(`\n✖ ${arg} non è disponibile. Attive: ${attive.map((d) => d.id).join(', ')}\n`); return; }
        setModo(arg); storia.current = [];
        scrivi(`\n▌ CHAT DIRETTA con ${disponibili[arg].nome} — /team per tornare alla squadra\n`);
        return;
      }
      case 'team': setModo(null); scrivi('\n▌ SQUADRA al lavoro\n'); return;
      case 'nuova':
        if (!modo) { scrivi('\n/nuova vale in chat diretta\n'); return; }
        stato.current.salvaSessione(modo, 'chat', null); storia.current = [];
        scrivi(`\n▌ Nuova conversazione con ${disponibili[modo].nome}\n`);
        return;
      default:
        scrivi('\nComandi: /allega [file]  /allegati  /togli N  /screenshot  /chat X  /team  /nuova  /mappa N  /nota testo  /pagina N  /ia  /ruoli  /stato  /pulisci  /esci\nLa pagina GUIDA spiega tutto nel dettaglio.\n');
    }
  }

  async function invia(valore) {
    const t = valore.trim();
    setInput('');
    if (selettore) {
      const f = filtrati()[selettore.sel];
      if (f) { aggiungiAllegato(f); scrivi(`\n✔ allegato ${path.basename(f)}\n`); }
      setSelettore(null);
      return;
    }
    if (pagina === 'terminale') { if (t) eseguiShell(t); return; }
    if (!t || occupato) return;
    if (t.startsWith('/')) return comando(t);
    setOccupato(true);
    setScorri((s) => ({ ...s, lavoro: 0 }));
    const daAllegare = allegati;
    setAllegati([]);
    scrivi(`\n› ${t}${daAllegare.length ? `   📎 ${daAllegare.length} allegat${daAllegare.length === 1 ? 'o' : 'i'}` : ''}\n`);
    const ctx = { config, disponibili, cwd, stato: stato.current, ui: ui.current, tel: tel.current, allegati: daAllegare };
    try {
      if (modo) {
        const r = await chatDiretta({ id: modo, messaggio: t, ctx, storia: storia.current });
        storia.current.push({ chi: 'Utente', testo: t });
        if (r.ok) storia.current.push({ chi: disponibili[modo].nome, testo: r.testo });
        scrivi('\n');
      } else {
        setRuoli(ruoliIniziali());
        await eseguiRichiesta({ richiesta: t, ctx });
      }
    } catch (e) {
      ui.current.log('✖ ' + e.message, { tipo: 'errore' });
    }
    setOccupato(false);
    aggiornaFile();
  }

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
  const conAllegati = conInput && pagina !== 'terminale' && allegati.length > 0;
  const hCorpo = H - hTesta - 1 - (conInput ? 3 : 0) - (conAllegati ? 1 : 0);

  const cambiaPagina = (verso) => {
    const i = PAGINE.findIndex(([id]) => id === pagina);
    setPagina(PAGINE[(i + verso + PAGINE.length) % PAGINE.length][0]);
    setMessaggio('');
  };
  // quale elenco scorrono le frecce in questa pagina
  const chiaveScorri = pagina === 'terminale' ? fuoco : pagina;
  const dalBasso = ['lavoro', 'registro', 'shell'].includes(chiaveScorri);
  const sposta = (quanto) => setScorri((s) => {
    const v = s[chiaveScorri] ?? 0;
    const nuovo = dalBasso ? v + quanto : v - quanto;
    return { ...s, [chiaveScorri]: Math.max(0, Math.min(massimi.current[chiaveScorri] ?? 0, nuovo)) };
  });

  useInput((ch, key) => {
    // Ctrl+C: prima ferma il comando della shell, poi esce
    if (key.ctrl && ch === 'c') {
      if (processoShell.current) { processoShell.current.kill('SIGINT'); return; }
      fermaTutti();
      exit();
      return;
    }
    if (key.ctrl && ch === 'o') return scattaScreenshot();
    if (selettore) {
      const n = filtrati().length;
      if (key.escape) { setSelettore(null); setInput(''); return; }
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
    const pg = Math.max(3, hCorpo - 6);
    if (pagina === 'terminale') {
      if (key.ctrl && ch === 'f') return setFiltro((f) => FILTRI[(FILTRI.findIndex(([id]) => id === f) + 1) % FILTRI.length][0]);
      if (key.ctrl && ch === 'l') return setFuoco((f) => (f === 'shell' ? 'registro' : 'shell'));
      // nella shell le frecce richiamano i comandi precedenti, come in bash
      if (key.upArrow || key.downArrow) {
        const st = comandi.current;
        if (!st.elenco.length) return;
        st.indice = key.upArrow ? (st.indice < 0 ? st.elenco.length - 1 : Math.max(0, st.indice - 1)) : st.indice < 0 ? -1 : st.indice + 1;
        if (st.indice >= st.elenco.length) st.indice = -1;
        setInput(st.indice < 0 ? '' : st.elenco[st.indice]);
        return;
      }
      if (key.pageUp) return sposta(pg);
      if (key.pageDown) return sposta(-pg);
      return;
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
  else if (pagina === 'terminale') corpo = html`<${PaginaTerminale} h=${hCorpo} w=${c} log=${log} filtro=${filtro} fuoco=${fuoco} scorriLog=${scorri.registro} shell=${shell} scorriShell=${scorri.shell} inCorso=${shellInCorso} cwdShell=${cwdShell} massimi=${m} />`;
  else if (pagina === 'controllo') corpo = html`<${PaginaControllo} h=${hCorpo} w=${c} config=${config} selezionato=${selezionato} tel=${tel.current} disponibili=${disponibili} tick=${tick} messaggio=${messaggio} />`;
  else if (pagina === 'studio') corpo = html`<${PaginaStudio} h=${hCorpo} w=${c} lavagna=${lavagna} appunti=${stato.current.appunti()} scorri=${scorri.studio} tick=${tick} massimi=${m} />`;
  else if (pagina === 'guida') corpo = html`<${PaginaGuida} h=${hCorpo} w=${c} scorri=${scorri.guida} massimi=${m} />`;
  else corpo = html`<${PaginaLavoro} h=${hCorpo} w=${c} righe=${righe} scorri=${scorri.lavoro} log=${log} ruoli=${ruoli} disponibili=${disponibili} compiti=${compiti} file=${file} tick=${tick} massimi=${m} tel=${tel.current} />`;

  const inTerminale = pagina === 'terminale' && !selettore;
  const segnaposto = selettore ? 'scrivi una parte del nome del file…'
    : inTerminale ? (shellInCorso ? 'comando in corso… (Ctrl+C per fermarlo)' : 'comando della shell, es.  ls -la   (↑↓ comandi precedenti)')
    : modo ? `scrivi a ${disponibili[modo].nome}…`
    : 'scrivi cosa vuoi fare…   (trascina qui file e foto · /aiuto per i comandi)';
  const bloccato = occupato && !inTerminale && !selettore;

  return html`<${Box} flexDirection="column" width=${c} height=${H}>
    <${Box} height=${hTesta}>
      <${Intestazione} config=${config} tick=${tick} pagina=${pagina} modo=${modo} disponibili=${disponibili} occupato=${occupato} etichetta=${etichetta} costo=${costo} larghezza=${c} grande=${grande} />
    <//>
    ${corpo}
    ${conAllegati && html`<${BarraAllegati} allegati=${allegati} larghezza=${c} />`}
    ${conInput && html`<${Box} borderStyle="round" borderColor=${bloccato ? C.scuro : selettore ? C.giallo : inTerminale ? C.ciano : C.rosa} paddingX=${1} height=${3}>
      <${Text} color=${selettore ? C.giallo : inTerminale ? C.ciano : C.rosa} bold>${selettore ? '🔎 ' : inTerminale ? '$ ' : '› '}<//>
      ${bloccato
        ? html`<${Text} color=${C.grigio}>le IA stanno lavorando…  (TAB per guardare le altre pagine, Ctrl+C per uscire)<//>`
        : html`<${TextInput} value=${selettore ? selettore.query : input} onChange=${selettore ? (q) => setSelettore((s) => ({ ...s, query: q, sel: 0 })) : cambiaInput} onSubmit=${invia} placeholder=${segnaposto} />`}
    <//>`}
    <${Box} height=${1} paddingX=${1}>
      <${Text} color=${C.ciano}>💡 <//><${Text} color=${C.grigio} wrap="truncate-end">${pagina === 'controllo' ? '↑↓ scegli il parametro · ←→ regola · 1-5 mappature · TAB pagina · ESC torna a LAVORO' : inTerminale ? 'Ctrl+F filtra il registro · Ctrl+L sposta il fuoco · PAG SU/GIÙ scorre · Ctrl+C ferma il comando' : consiglio}<//>
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
