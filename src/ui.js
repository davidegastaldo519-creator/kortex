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
import { elencoDestinazioni, Sessioni } from './terminale.js';
import { html, C, PAGINE, Intestazione } from './grafica.js';
import { RUOLI, FILTRI, SCHEDE, BarraAllegati, PaginaSelettore, PaginaLavoro, PaginaControllo, PaginaStudio, PaginaGuida } from './pagine.js';

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
  for (const d of ['Downloads', 'Scaricati', 'Pictures', 'Immagini', 'Pictures/Screenshots', 'Immagini/Screenshot', 'Desktop', 'Scrivania', 'Documents', 'Documenti']) visita(path.join(casa, d), 1);
  return [...new Set(out)];
}

function App({ config, disponibili, cwd, versione }) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [dim, setDim] = useState({ c: stdout.columns || 80, r: stdout.rows || 24 });
  const [pagina, setPagina] = useState('lavoro');
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
    if (!p) return scrivi('\n✖ Flameshot non trovato: installalo con  sudo apt install -y flameshot\n');
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
    if (!selettore && valore.length - inputIA.length >= 3) {
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
  else if (pagina === 'controllo') corpo = html`<${PaginaControllo} h=${hCorpo} w=${c} config=${config} selezionato=${selezionato} tel=${tel.current} disponibili=${disponibili} tick=${tick} messaggio=${messaggio} />`;
  else if (pagina === 'studio') corpo = html`<${PaginaStudio} h=${hCorpo} w=${c} lavagna=${lavagna} appunti=${stato.current.appunti()} scorri=${scorri.studio} tick=${tick} massimi=${m} />`;
  else if (pagina === 'guida') corpo = html`<${PaginaGuida} h=${hCorpo} w=${c} scorri=${scorri.guida} massimi=${m} />`;
  else corpo = html`<${PaginaLavoro} h=${hCorpo} w=${c} righe=${righe} scorri=${scheda === 'registro' ? scorri.registro : scorri.lavoro} log=${log} ruoli=${ruoli} disponibili=${disponibili} compiti=${compiti} file=${file} tick=${tick} massimi=${m} tel=${tel.current} scheda=${scheda} fuoco=${fuoco} filtro=${filtro} destinazioni=${destinazioni} dest=${dest} sessione=${sessione} scorriShell=${scorri.shell} inCorso=${shellInCorso} />`;

  const inLavoro = pagina === 'lavoro' && !selettore;
  const fuocoShell = inLavoro && fuoco === 'shell';
  const segnapostoIA = selettore ? 'scrivi una parte del nome del file…' : modo ? `scrivi a ${disponibili[modo].nome}…` : 'scrivi cosa vuoi fare…   (trascina qui file e foto · /aiuto)';
  const segnapostoShell = shellInCorso ? 'comando in corso… (Ctrl+C per fermarlo)' : `comando su ${dest.nome}…   (↑↓ precedenti · Ctrl+D cambia macchina)`;
  const bloccato = occupato && !selettore;

  return html`<${Box} flexDirection="column" width=${c} height=${H}>
    <${Box} height=${hTesta}>
      <${Intestazione} config=${config} tick=${tick} pagina=${pagina} modo=${modo} disponibili=${disponibili} occupato=${occupato} etichetta=${etichetta} costo=${costo} larghezza=${c} grande=${grande} versione=${versione} />
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
            : html`<${TextInput} value=${selettore ? selettore.query : inputIA} onChange=${selettore ? (q) => setSelettore((s) => ({ ...s, query: q, sel: 0 })) : cambiaInputIA} onSubmit=${inviaIA} placeholder=${segnapostoIA} />`}
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
