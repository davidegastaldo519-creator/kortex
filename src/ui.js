import React, { useState, useEffect, useRef, useCallback } from 'react';
import { render, Box, Text, useApp, useStdout } from 'ink';
import TextInput from 'ink-text-input';
import htm from 'htm';
import { eseguiRichiesta, chatDiretta } from './director.js';
import { apriStato, righeFile } from './state.js';
import { campiona, hex, rgbHex } from './splash.js';
import { fermaTutti } from './adapters.js';
import { FILE_CONFIG } from './config.js';

const html = htm.bind(React.createElement);

const C = {
  viola: '#9D4EDD',
  rosa: '#FF2BD6',
  ciano: '#00F5FF',
  grigio: '#6B6B80',
  verde: '#39FF14',
  rosso: '#FF3860',
  giallo: '#FFE66D',
};
const SPIN = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏';
const RUOLI = [
  ['direttore', 'Direttore'],
  ['pianificatore', 'Pianificatore'],
  ['esecutore', 'Esecutore'],
  ['revisore', 'Revisore'],
];
const ora = () => new Date().toTimeString().slice(0, 8);
const ruoliIniziali = () => Object.fromEntries(RUOLI.map(([id]) => [id, { stato: 'attesa', ia: null }]));

function avvolgi(righe, w) {
  const out = [];
  for (const r of righe) {
    if (r.length <= w) out.push(r);
    else for (let i = 0; i < r.length; i += w) out.push(r.slice(i, i + w));
  }
  return out;
}

const accorcia = (s, n) => (s.length <= n ? s : '…' + s.slice(-(n - 1)));

function coloreRiga(r) {
  if (r.startsWith('▌')) return C.ciano;
  if (r.startsWith('› ')) return C.rosa;
  if (r.includes('✖')) return C.rosso;
  if (r.trimStart().startsWith('✔')) return C.verde;
  if (r.trimStart().startsWith('⚠')) return C.giallo;
  return undefined;
}

function Gradiente({ testo, colori }) {
  const stops = colori.map(hex);
  const n = Math.max(1, testo.length);
  return html`<${Text} bold>${[...testo].map(
    (ch, i) => html`<${Text} key=${i} color=${rgbHex(campiona(stops, (i / n) * 0.9))}>${ch}<//>`
  )}<//>`;
}

function Pannello({ titolo, colore = C.viola, children, ...resto }) {
  return html`<${Box} flexDirection="column" borderStyle="round" borderColor=${colore} paddingX=${1} overflow="hidden" ...${resto}>
    <${Text} color=${C.ciano} bold>${titolo}<//>
    ${children}
  <//>`;
}

function App({ config, disponibili, cwd }) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [dim, setDim] = useState({ c: stdout.columns || 80, r: stdout.rows || 24 });
  const [righe, setRighe] = useState(['']);
  const [log, setLog] = useState([]);
  const [ruoli, setRuoli] = useState(ruoliIniziali());
  const [input, setInput] = useState('');
  const [occupato, setOccupato] = useState(false);
  const [tick, setTick] = useState(0);
  const [file, setFile] = useState([]);
  const [costo, setCosto] = useState(0);
  const [modo, setModo] = useState(null); // null = squadra, altrimenti id dell'IA in chat diretta
  const storia = useRef([]);
  const stato = useRef(null);
  if (!stato.current) stato.current = apriStato(cwd);

  useEffect(() => {
    const f = () => setDim({ c: stdout.columns, r: stdout.rows });
    stdout.on('resize', f);
    return () => stdout.off('resize', f);
  }, [stdout]);

  // L'animazione gira solo mentre si lavora: da ferma l'interfaccia non consuma CPU.
  useEffect(() => {
    if (!occupato) return;
    const t = setInterval(() => setTick((x) => x + 1), 120);
    return () => clearInterval(t);
  }, [occupato]);

  const scrivi = useCallback(
    (testo) =>
      setRighe((prima) => {
        const parti = String(testo).split('\n');
        const nuove = prima.slice(-1000);
        nuove[nuove.length - 1] += parti[0];
        for (let i = 1; i < parti.length; i++) nuove.push(parti[i]);
        return nuove;
      }),
    []
  );

  const aggiornaFile = useCallback(() => setFile(righeFile(cwd)), [cwd]);

  const ui = useRef(null);
  if (!ui.current) {
    ui.current = {
      out: (t) => scrivi(t),
      titolo: (t) => scrivi(`\n▌ ${t}\n`),
      log: (m) => setLog((p) => [...p.slice(-200), `${ora()}  ${m}`]),
      ruolo: (r, s, ia) => setRuoli((p) => ({ ...p, [r]: { stato: s, ia: ia ?? p[r]?.ia ?? null } })),
      costo: (x) => setCosto((v) => v + x),
      aggiornaFile,
    };
  }

  useEffect(() => {
    aggiornaFile();
    const attive = Object.values(disponibili).filter((d) => d.ok).map((d) => d.nome);
    scrivi(
      `${config.brand.nome} pronto in ${cwd}\n` +
        `IA attive: ${attive.join(', ') || 'nessuna — scrivi /ia per capire perché'}\n` +
        `Autonomia: ${config.autonomia}\n` +
        `Scrivi cosa vuoi fare. /aiuto per i comandi.\n`
    );
  }, []);

  function comando(t) {
    const [cmd, arg] = t.slice(1).split(/\s+/);
    switch (cmd) {
      case 'esci':
      case 'q':
        fermaTutti();
        exit();
        return;
      case 'pulisci':
        setRighe(['']);
        return;
      case 'ia':
        scrivi(
          '\n' +
            Object.values(disponibili)
              .map(
                (d) =>
                  `${d.ok ? '●' : '○'} ${d.nome.padEnd(8)} ${d.ok ? d.versione || '' : d.nota || ''}` +
                  `${d.limitato ? '  [limite raggiunto]' : ''}${d.modelli?.length ? '  modelli: ' + d.modelli.join(', ') : ''}`
              )
              .join('\n') +
            '\n'
        );
        return;
      case 'ruoli':
        scrivi('\n' + Object.entries(config.ruoli).map(([r, l]) => `${r.padEnd(14)} ${l.join(' → ')}`).join('\n') + '\n');
        return;
      case 'stato':
        scrivi('\n' + (stato.current.memoria(25) || '(diario vuoto: nessun lavoro ancora in questo progetto)') + '\n');
        return;
      case 'chat': {
        const attive = Object.values(disponibili).filter((d) => d.ok && !d.limitato);
        if (!arg) {
          scrivi(`\nCon chi vuoi parlare? ${attive.map((d) => '/chat ' + d.id).join('   ') || '(nessuna IA attiva)'}\n`);
          return;
        }
        if (!disponibili[arg]?.ok) {
          scrivi(`\n✖ ${arg} non è disponibile su questa macchina. Attive: ${attive.map((d) => d.id).join(', ')}\n`);
          return;
        }
        setModo(arg);
        storia.current = [];
        scrivi(`\n▌ CHAT DIRETTA con ${disponibili[arg].nome} — /team per tornare alla squadra, /nuova per ricominciare\n`);
        return;
      }
      case 'team':
        setModo(null);
        scrivi('\n▌ SQUADRA — direttore, pianificatore, esecutore e revisore di nuovo al lavoro insieme\n');
        return;
      case 'nuova':
        if (!modo) {
          scrivi('\n/nuova vale in chat diretta: prima scegli un\'IA con /chat\n');
          return;
        }
        stato.current.salvaSessione(modo, 'chat', null);
        storia.current = [];
        scrivi(`\n▌ Nuova conversazione con ${disponibili[modo].nome}\n`);
        return;
      case 'config':
        scrivi(`\nConfigurazione: ${FILE_CONFIG}\nModificala e riavvia per applicare.\n`);
        return;
      default:
        scrivi(
          '\nComandi:\n' +
            '  /chat X   parla direttamente con una sola IA (claude, codex, gemini, ollama)\n' +
            '  /team     torna alla squadra di IA\n' +
            '  /nuova    in chat diretta, ricomincia la conversazione\n' +
            '  /ia       quali IA sono installate e attive\n' +
            '  /ruoli    chi fa cosa, in ordine di riserva\n' +
            '  /stato    diario di questo progetto\n' +
            '  /config   dove sta la configurazione\n' +
            '  /pulisci  svuota il pannello OUTPUT\n' +
            '  /esci     esci (anche Ctrl+C)\n'
        );
    }
  }

  async function invia(valore) {
    const t = valore.trim();
    setInput('');
    if (!t || occupato) return;
    if (t.startsWith('/')) return comando(t);
    setOccupato(true);
    scrivi(`\n› ${t}\n`);
    const ctx = { config, disponibili, cwd, stato: stato.current, ui: ui.current };
    if (modo) {
      try {
        const r = await chatDiretta({ id: modo, messaggio: t, ctx, storia: storia.current });
        storia.current.push({ chi: 'Utente', testo: t });
        if (r.ok) storia.current.push({ chi: disponibili[modo].nome, testo: r.testo });
      } catch (e) {
        ui.current.log('✖ ' + e.message);
      }
      scrivi('\n');
      setOccupato(false);
      aggiornaFile();
      return;
    }
    setRuoli(ruoliIniziali());
    try {
      await eseguiRichiesta({ richiesta: t, ctx });
    } catch (e) {
      ui.current.log('✖ ' + e.message);
    }
    setOccupato(false);
    aggiornaFile();
  }

  // ---------- impaginazione ----------
  const { c, r } = dim;
  const H = Math.max(14, r - 1);
  const hLog = r >= 30 ? 7 : 5;
  const hInput = 3;
  const hMain = H - hLog - hInput - 1;
  const mostraSx = c >= 70; // su schermi stretti (telefono) spariscono i pannelli laterali
  const mostraDx = c >= 100;
  const wSx = 26;
  const wDx = 32;
  const wCentro = c - (mostraSx ? wSx : 0) - (mostraDx ? wDx : 0);
  const visibili = avvolgi(righe, Math.max(10, wCentro - 4)).slice(-Math.max(1, hMain - 3));
  const spin = SPIN[tick % SPIN.length];

  const icona = (s) =>
    s === 'lavoro' ? [spin, C.rosa] : s === 'ok' ? ['●', C.verde] : s === 'errore' ? ['✖', C.rosso] : ['○', C.grigio];

  const ruoloAttivo = RUOLI.find(([id]) => ruoli[id].stato === 'lavoro');

  return html`<${Box} flexDirection="column" width=${c} height=${H}>
    <${Box} height=${1} paddingX=${1}>
      <${Gradiente} testo=${'◢◤ ' + config.brand.nome} colori=${config.brand.colori} />
      <${Text} color=${modo ? C.giallo : C.viola}>  ${modo ? '💬 ' + disponibili[modo].nome : '⚙ squadra'}<//>
      <${Text} color=${C.grigio}>  ${accorcia(cwd, Math.max(10, c - 62))}<//>
      <${Box} flexGrow=${1} />
      <${Text} color=${occupato ? C.rosa : C.verde}>
        ${occupato ? `${spin} ${modo ? 'risponde' : ruoloAttivo ? ruoloAttivo[1] : 'al lavoro'}` : '● pronto'}
      <//>
      <${Text} color=${C.grigio}>${costo > 0 ? `  $${costo.toFixed(3)}` : ''}<//>
    <//>

    <${Box} height=${hMain}>
      ${mostraSx &&
      html`<${Pannello} titolo="AGENTI" width=${wSx} height=${hMain}>
        ${RUOLI.map(([id, nome]) => {
          const [ic, col] = icona(ruoli[id].stato);
          const ia = ruoli[id].ia ? disponibili[ruoli[id].ia]?.nome : '—';
          return html`<${Box} key=${id} flexDirection="column">
            <${Text}><${Text} color=${col}>${ic}<//> ${nome}<//>
            <${Text} color=${C.grigio}>   ${ia}<//>
          <//>`;
        })}
        <${Text} color=${C.ciano} bold>IA<//>
        ${Object.values(disponibili).map(
          (d) => html`<${Text} key=${d.id} color=${d.ok && !d.limitato ? C.verde : C.grigio}>
            ${d.ok && !d.limitato ? '●' : '○'} ${d.nome}${d.limitato ? ' (limite)' : ''}
          <//>`
        )}
      <//>`}

      <${Pannello} titolo="OUTPUT" flexGrow=${1} height=${hMain}>
        ${visibili.map((riga, i) => html`<${Text} key=${i} color=${coloreRiga(riga)} wrap="truncate-end">${riga || ' '}<//>`)}
      <//>

      ${mostraDx &&
      html`<${Pannello} titolo="FILE" width=${wDx} height=${hMain}>
        ${file.slice(0, Math.max(1, hMain - 3)).map(
          (f, i) => html`<${Text} key=${i} wrap="truncate-end" color=${f.startsWith('??') ? C.verde : f.startsWith(' M') || f.startsWith('M') ? C.giallo : C.grigio}>${f}<//>`
        )}
      <//>`}
    <//>

    <${Pannello} titolo="LOG" height=${hLog} colore=${C.grigio}>
      ${log.slice(-(hLog - 3)).map((l, i) => html`<${Text} key=${i} color=${C.grigio} wrap="truncate-end">${l}<//>`)}
    <//>

    <${Box} borderStyle="round" borderColor=${occupato ? C.grigio : C.rosa} paddingX=${1} height=${hInput}>
      <${Text} color=${C.rosa} bold>› <//>
      ${occupato
        ? html`<${Text} color=${C.grigio}>le IA stanno lavorando… (Ctrl+C per uscire)<//>`
        : html`<${TextInput} value=${input} onChange=${setInput} onSubmit=${invia} placeholder=${modo ? `scrivi a ${disponibili[modo].nome}…  (/team per la squadra)` : 'scrivi cosa vuoi fare…  (/aiuto)'} />`}
    <//>
  <//>`;
}

export async function avviaUI(props) {
  process.stdout.write('\x1b[?1049h\x1b[2J\x1b[H');
  const app = render(html`<${App} ...${props} />`, { exitOnCtrlC: true });
  await app.waitUntilExit();
  fermaTutti();
  process.stdout.write('\x1b[?25h\x1b[?1049l');
}
