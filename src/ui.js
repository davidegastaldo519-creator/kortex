import React, { useState, useEffect, useRef, useCallback } from 'react';
import { render, Box, Text, useApp, useStdout, useInput } from 'ink';
import TextInput from 'ink-text-input';
import htm from 'htm';
import { eseguiRichiesta, chatDiretta } from './director.js';
import { apriStato, righeFile } from './state.js';
import { campiona, hex, rgbHex } from './splash.js';
import { fermaTutti } from './adapters.js';
import { FILE_CONFIG } from './config.js';
import { Telemetria, graficoAlto } from './telemetria.js';
import { PARAMETRI, MAPPATURE, testoValore, livello, cambia, applicaMappatura, salvaConfig } from './parametri.js';
import { GUIDA } from './guida.js';

const html = htm.bind(React.createElement);

const C = {
  viola: '#9D4EDD', rosa: '#FF2BD6', ciano: '#00F5FF', grigio: '#6B6B80', scuro: '#3A3A4A',
  verde: '#39FF14', rosso: '#FF3860', giallo: '#FFE66D', gesso: '#E8E4D0', lavagna: '#3E6B5A',
};
const SPIN = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏';
const RUOLI = [['direttore', 'Direttore'], ['pianificatore', 'Pianificatore'], ['esecutore', 'Esecutore'], ['revisore', 'Revisore']];
const PAGINE = [['lavoro', 'LAVORO'], ['controllo', 'CONTROLLO'], ['studio', 'STUDIO'], ['guida', 'GUIDA']];
const CONSIGLI = [
  'TAB cambia pagina: nella plancia CONTROLLO regoli ogni parametro della squadra.',
  'Le frecce SU e GIÙ scorrono il testo. PAG SU e PAG GIÙ di una pagina intera.',
  '/chat claude per parlare con una sola IA, /team per tornare alla squadra.',
  '/nota testo scrive un appunto sulla lavagna dello STUDIO, salvato nel progetto.',
  '/mappa 1 per domande veloci, /mappa 5 per i lavori enormi. 3 è il giusto mezzo.',
  'Il dollaro in alto è un valore indicativo: con gli abbonamenti non paghi a consumo.',
  'Se un\'IA finisce il limite, KORTEX passa da sola alla riserva. Lo vedi nel LOG.',
  'Nella pagina GUIDA trovi spiegato ogni pezzo del tool.',
];
const ora = () => new Date().toTimeString().slice(0, 8);
const ruoliIniziali = () => Object.fromEntries(RUOLI.map(([id]) => [id, { stato: 'attesa', ia: null }]));
const accorcia = (s, n) => (s.length <= n ? s : '…' + s.slice(-(Math.max(1, n - 1))));

function avvolgi(righe, w) {
  const out = [];
  for (const r of righe) {
    if (r.length <= w) out.push(r);
    else for (let i = 0; i < r.length; i += w) out.push(r.slice(i, i + w));
  }
  return out;
}

function coloreRiga(r) {
  if (r.startsWith('▌')) return C.ciano;
  if (r.startsWith('› ')) return C.rosa;
  if (r.includes('✖')) return C.rosso;
  if (r.trimStart().startsWith('✔')) return C.verde;
  if (r.trimStart().startsWith('⚠')) return C.giallo;
  return undefined;
}

// ---------- pezzi grafici ----------

function Gradiente({ testo, colori, fase = 0, bold = true, passo = 1 }) {
  const stops = colori.map(hex);
  const car = [...testo];
  const n = Math.max(1, car.length);
  const pezzi = [];
  for (let i = 0; i < car.length; i += passo) pezzi.push([i, car.slice(i, i + passo).join('')]);
  return html`<${Text} bold=${bold}>${pezzi.map(
    ([i, s]) => html`<${Text} key=${i} color=${rgbHex(campiona(stops, (i / n) * 0.9 - fase))}>${s}<//>`
  )}<//>`;
}

function Pannello({ titolo, nota, colore = C.viola, coloreTitolo = C.ciano, children, ...resto }) {
  return html`<${Box} flexDirection="column" borderStyle="round" borderColor=${colore} paddingX=${1} overflow="hidden" ...${resto}>
    <${Box}><${Text} color=${coloreTitolo} bold>${titolo}<//>${nota ? html`<${Text} color=${C.grigio}>  ${nota}<//>` : null}<//>
    ${children}
  <//>`;
}

// Il teschio in miniatura, con la crepa e gli occhi che pulsano e ogni tanto sbattono.
function Teschio({ tick, acceso }) {
  const battito = 0.5 + 0.5 * Math.sin(tick * 0.5);
  const occhio = acceso ? rgbHex(campiona([hex(C.rosa), hex(C.ciano), [255, 255, 255]], 0.35 + battito * 0.5)) : C.scuro;
  const chiuso = tick % 28 === 0;
  const osso = '#C8C8D4';
  const crepa = rgbHex(campiona([hex(C.rosa), hex(C.ciano)], battito));
  return html`<${Box} flexDirection="column" marginRight=${1}>
    <${Text}><${Text} color=${osso}>▄██<//><${Text} color=${crepa}>╱<//><${Text} color=${osso}>██▄<//><//>
    <${Text}><${Text} color=${osso}>█ <//><${Text} color=${occhio}>${chiuso ? '─' : '●'}<//><${Text} color=${osso}>█<//><${Text} color=${occhio}>${chiuso ? '─' : '●'}<//><${Text} color=${osso}> █<//><//>
    <${Text} color=${osso}> ▀▄▀▄▀<//>
  <//>`;
}

function Intestazione({ config, tick, pagina, modo, disponibili, occupato, etichetta, costo, larghezza }) {
  const fase = tick * 0.04;
  return html`<${Box} flexDirection="column" width=${larghezza}>
    <${Box} paddingX=${1}>
      <${Teschio} tick=${tick} acceso=${occupato || tick % 40 < 30} />
      <${Box} flexDirection="column" flexGrow=${1}>
        <${Box}>
          <${Gradiente} testo=${config.brand.nome.split('').join(' ')} colori=${config.brand.colori} fase=${fase} />
          <${Text} color=${C.grigio}>   ${config.brand.tagline}<//>
          <${Box} flexGrow=${1} />
          ${PAGINE.map(([id, nome], i) => html`<${Text} key=${id} color=${id === pagina ? '#000000' : C.grigio} backgroundColor=${id === pagina ? C.ciano : undefined} bold=${id === pagina}> ${i + 1} ${nome} <//>`)}
        <//>
        <${Box}>
          <${Text} color=${modo ? C.giallo : C.viola}>${modo ? '💬 chat con ' + disponibili[modo].nome : '⚙ squadra'}<//>
          <${Text} color=${C.grigio}>  ·  mappa <//><${Text} color=${C.ciano}>${config.mappa || '—'}<//>
          <${Text} color=${C.grigio}>  ·  autonomia <//><${Text} color=${config.autonomia === 'totale' ? C.rosso : C.verde}>${config.autonomia}<//>
          <${Box} flexGrow=${1} />
          <${Text} color=${occupato ? C.rosa : C.verde}>${occupato ? `${SPIN[tick % SPIN.length]} ${etichetta}` : '● pronto'}<//>
          <${Text} color=${C.grigio}>${costo > 0 ? `   ≈$${costo.toFixed(2)} valore API` : ''}<//>
        <//>
        <${Gradiente} testo=${'━'.repeat(Math.max(10, larghezza - 12))} colori=${config.brand.colori} fase=${fase * 2} bold=${false} passo=${6} />
      <//>
    <//>
  <//>`;
}

function Barra({ valore, larghezza, colore = C.ciano }) {
  const pieni = Math.round(lim01(valore) * larghezza);
  return html`<${Text}><${Text} color=${colore}>${'█'.repeat(pieni)}<//><${Text} color=${C.scuro}>${'░'.repeat(larghezza - pieni)}<//><//>`;
}
const lim01 = (x) => Math.max(0, Math.min(1, x || 0));

// ---------- pagina LAVORO ----------

function PaginaLavoro({ h, w, righe, scorri, log, ruoli, disponibili, compiti, file, tick, massimi }) {
  const mostraSx = w >= 80;
  const mostraDx = w >= 120;
  const wSx = 26;
  const wDx = 34;
  const hLog = 6;
  const hSopra = h - hLog;
  const wCentro = w - (mostraSx ? wSx : 0) - (mostraDx ? wDx : 0);
  const spin = SPIN[tick % SPIN.length];
  const tutte = avvolgi(righe, Math.max(10, wCentro - 4));
  const spazio = Math.max(1, hSopra - 3);
  massimi.lavoro = Math.max(0, tutte.length - spazio);
  const fine = Math.max(0, tutte.length - scorri);
  const visibili = tutte.slice(Math.max(0, fine - spazio), fine);
  const icona = (s) => (s === 'lavoro' ? [spin, C.rosa] : s === 'ok' ? ['●', C.verde] : s === 'errore' ? ['✖', C.rosso] : s === 'saltato' ? ['–', C.scuro] : ['○', C.grigio]);
  const iconaCompito = { attesa: ['○', C.grigio], lavoro: [spin, C.rosa], ok: ['✔', C.verde], avviso: ['⚠', C.giallo], errore: ['✖', C.rosso] };

  return html`<${Box} flexDirection="column" height=${h}>
    <${Box} height=${hSopra}>
      ${mostraSx && html`<${Pannello} titolo="SQUADRA" width=${wSx} height=${hSopra}>
        ${RUOLI.map(([id, nome]) => {
          const [ic, col] = icona(ruoli[id].stato);
          return html`<${Box} key=${id} flexDirection="column">
            <${Text}><${Text} color=${col}>${ic}<//> ${nome}<//>
            <${Text} color=${C.grigio}>   ${ruoli[id].stato === 'saltato' ? 'spento' : ruoli[id].ia ? disponibili[ruoli[id].ia]?.nome : '—'}<//>
          <//>`;
        })}
        <${Text} color=${C.ciano} bold>IA<//>
        ${Object.values(disponibili).map((d) => html`<${Text} key=${d.id} color=${d.ok && !d.limitato ? C.verde : C.grigio}>${d.ok && !d.limitato ? '●' : '○'} ${d.nome}${d.limitato ? ' (limite)' : ''}<//>`)}
      <//>`}
      <${Pannello} titolo="OUTPUT" nota=${scorri > 0 ? `↑ stai guardando più indietro di ${scorri} righe — FRECCIA GIÙ per tornare` : ''} flexGrow=${1} height=${hSopra}>
        ${visibili.map((r, i) => html`<${Text} key=${i} color=${coloreRiga(r)} wrap="truncate-end">${r || ' '}<//>`)}
      <//>
      ${mostraDx && html`<${Box} flexDirection="column" width=${wDx}>
        <${Pannello} titolo="COMPITI" height=${Math.floor(hSopra / 2)}>
          ${compiti.length ? compiti.map((c, i) => {
            const [ic, col] = iconaCompito[c.stato] || iconaCompito.attesa;
            return html`<${Text} key=${i} wrap="truncate-end"><${Text} color=${col}>${ic}<//> ${i + 1}. ${c.titolo}<//>`;
          }) : html`<${Text} color=${C.grigio}>nessun lavoro in corso<//>`}
        <//>
        <${Pannello} titolo="FILE" height=${hSopra - Math.floor(hSopra / 2)}>
          ${file.slice(0, Math.max(1, hSopra - Math.floor(hSopra / 2) - 3)).map((f, i) => html`<${Text} key=${i} wrap="truncate-end" color=${f.startsWith('??') ? C.verde : f.trimStart().startsWith('M') ? C.giallo : C.grigio}>${f}<//>`)}
        <//>
      <//>`}
    <//>
    <${Pannello} titolo="LOG" colore=${C.scuro} coloreTitolo=${C.grigio} height=${hLog}>
      ${log.slice(-(hLog - 3)).map((l, i) => html`<${Text} key=${i} color=${C.grigio} wrap="truncate-end">${l}<//>`)}
    <//>
  <//>`;
}

// ---------- pagina CONTROLLO: la plancia ----------

function Cavo({ d, stato, tick, larghezza }) {
  const lungo = Math.max(6, larghezza);
  const attivo = !!stato?.attivo;
  const colore = !d.ok ? C.scuro : d.limitato ? C.rosso : attivo ? C.rosa : C.viola;
  const pos = attivo ? tick % lungo : -1;
  const cavo = [...'━'.repeat(lungo)].map((c, i) => (i === pos ? '●' : c)).join('');
  return html`<${Text} wrap="truncate-end">
    <${Text} color=${C.ciano}>KORTEX <//>
    ${pos >= 0
      ? html`<${Text}><${Text} color=${colore}>${cavo.slice(0, pos)}<//><${Text} color="#FFFFFF" bold>●<//><${Text} color=${colore}>${cavo.slice(pos + 1)}<//><//>`
      : html`<${Text} color=${colore}>${cavo}<//>`}
    <${Text} color=${d.ok ? (d.limitato ? C.rosso : C.verde) : C.grigio}> ${d.ok ? '◆' : '◇'} ${d.nome.padEnd(7)}<//>
    <${Text} color=${C.grigio}>${!d.ok ? 'non collegata' : d.limitato ? 'AL LIMITE' : attivo ? `lavora: ${stato.attivo}` : 'in attesa'}<//>
  <//>`;
}

function PaginaControllo({ h, w, config, selezionato, tel, disponibili, tick, messaggio }) {
  // Impaginazione calcolata: ogni pannello ha l'altezza che gli serve, niente si schiaccia.
  const compatto = h < 38 || w < 140;
  const wSx = compatto ? Math.min(58, Math.floor(w * 0.52)) : Math.min(64, Math.floor(w * 0.46));
  const wDx = w - wSx;
  const barra = Math.max(6, wSx - 44);
  const nIA = Object.keys(disponibili).length;
  const p = PARAMETRI[selezionato];
  const mappaAttiva = MAPPATURE.findIndex((m) => m.nome === config.mappa);
  const media = (s) => (s.ok + s.errori ? (s.secondi / (s.ok + s.errori)).toFixed(0) + 's' : '—');

  // colonna sinistra
  const hMap = compatto ? 0 : MAPPATURE.length + 3;
  const hPar = compatto ? Math.max(5, h - 7) : PARAMETRI.length + 3;
  const hInfo = h - hMap - hPar;
  const visibili = Math.min(PARAMETRI.length, hPar - 3);
  const primo = Math.max(0, Math.min(PARAMETRI.length - visibili, selezionato - Math.floor(visibili / 2)));

  // colonna destra
  const hConn = nIA + 3;
  const hNum = compatto ? 0 : nIA + 5;
  const hTel = h - hConn - hNum;
  const larGrafico = Math.max(10, Math.min(60, wDx - 6));
  const grafici = [
    ['CPU', 'quanto lavora il processore', tel.cpu, 1, C.rosa, `${Math.round((tel.cpu.at(-1) || 0) * 100)}%`],
    ['RAM', 'memoria occupata', tel.ram, 1, C.viola, `${Math.round((tel.ram.at(-1) || 0) * 100)}%`],
    ['PENSIERI', 'risposte e strumenti delle IA al secondo', tel.pensieri, undefined, C.ciano, `${tel.pensieri.at(-1) || 0}/s`],
  ];
  const quanti = Math.max(1, Math.min(3, Math.floor((hTel - 3) / 2)));
  const altGrafico = Math.max(1, Math.floor((hTel - 3) / quanti) - 1);
  const ordine = [2, 0, 1].slice(0, quanti).sort(); // se lo spazio è poco, i PENSIERI vengono prima di tutto

  return html`<${Box} height=${h}>
    <${Box} flexDirection="column" width=${wSx}>
      ${!compatto && html`<${Pannello} titolo="MAPPATURE" nota="tasti 1-5" height=${hMap} flexShrink=${0}>
        ${MAPPATURE.map((m, i) => html`<${Text} key=${m.nome} wrap="truncate-end">
          <${Text} color=${i === mappaAttiva ? C.ciano : C.grigio} bold=${i === mappaAttiva}>${i === mappaAttiva ? '▶' : ' '} ${i + 1} ${m.nome.padEnd(9)}<//>
          <${Text} color=${rgbHex(campiona([hex(C.viola), hex(C.rosa), hex(C.ciano)], i / 6))}>${'▮'.repeat(i + 1)}<//><${Text} color=${C.scuro}>${'▯'.repeat(4 - i)}<//>
          <${Text} color=${C.grigio}>  ${m.uso}<//>
        <//>`)}
      <//>`}
      <${Pannello} titolo="PARAMETRI" nota=${compatto ? `mappa ${config.mappa} · 1-5 mappature` : '↑↓ scegli  ←→ regola'} height=${hPar} flexShrink=${0}>
        ${PARAMETRI.slice(primo, primo + visibili).map((q, k) => {
          const i = primo + k;
          const sel = i === selezionato;
          return html`<${Text} key=${q.chiave} wrap="truncate-end">
            <${Text} color=${sel ? C.rosa : C.grigio}>${sel ? '▶ ' : '  '}<//>
            <${Text} color=${sel ? '#FFFFFF' : C.gesso} bold=${sel}>${q.nome.padEnd(23)}<//>
            <${Barra} valore=${livello(config, q)} larghezza=${barra} colore=${sel ? C.rosa : C.viola} />
            <${Text} color=${sel ? C.ciano : C.grigio}> ${testoValore(config, q)}<//>
          <//>`;
        })}
      <//>
      <${Pannello} titolo=${'ⓘ ' + p.nome.toUpperCase()} colore=${C.ciano} height=${hInfo} flexShrink=${0}>
        <${Text} color=${C.gesso}>${p.spiega}<//>
        <${Text} color=${C.grigio}>${p.tipo === 'numero' ? `Da ${p.min} a ${p.max}${p.unita || ''}, a passi di ${p.passo}.` : p.tipo === 'sino' ? 'SÌ oppure NO.' : p.tipo === 'scelta' ? `${p.valori.join(' · ').toUpperCase()}` : 'Ordine: ' + (config.ruoli[p.ruolo] || []).map((id) => config.ia[id]?.nome || id).join(' → ')}<//>
        ${messaggio ? html`<${Text} color=${C.verde}>✔ ${messaggio}<//>` : null}
      <//>
    <//>
    <${Box} flexDirection="column" width=${wDx}>
      <${Pannello} titolo="TELEMETRIA" nota="ultimi 60 secondi" height=${hTel} flexShrink=${0}>
        ${ordine.map((k) => {
          const [nome, spiega, dati, max, colore, ora] = grafici[k];
          return html`<${Box} key=${nome} flexDirection="column">
            <${Text} wrap="truncate-end"><${Text} color=${colore} bold>${nome.padEnd(9)}<//><${Text} color=${C.gesso} bold>${ora.padStart(5)}<//><${Text} color=${C.grigio}>   ${spiega}<//><//>
            ${graficoAlto(dati, larGrafico, altGrafico, max).map((riga, i) => html`<${Text} key=${i} color=${colore}>${riga}<//>`)}
          <//>`;
        })}
      <//>
      <${Pannello} titolo="CONNESSIONI" nota=${compatto ? '' : "l'impulso corre quando l'IA lavora"} height=${hConn} flexShrink=${0}>
        ${Object.values(disponibili).map((d) => html`<${Cavo} key=${d.id} d=${d} stato=${tel.ia[d.id]} tick=${tick} larghezza=${Math.max(4, wDx - 44)} />`)}
      <//>
      ${!compatto && html`<${Pannello} titolo="SQUADRA IN NUMERI" height=${hNum} flexShrink=${0}>
        <${Text} color=${C.grigio}>${'IA'.padEnd(9)}${'chiamate'.padStart(9)}${'riuscite'.padStart(10)}${'fallite'.padStart(9)}${'media'.padStart(8)}${'valore'.padStart(9)}<//>
        ${Object.values(disponibili).map((d) => {
          const s = tel.ia[d.id];
          return html`<${Text} key=${d.id} color=${d.ok ? C.gesso : C.scuro}>${d.nome.padEnd(9)}${String(s.chiamate).padStart(9)}${String(s.ok).padStart(10)}${String(s.errori).padStart(9)}${media(s).padStart(8)}${(s.valore ? '$' + s.valore.toFixed(2) : '—').padStart(9)}<//>`;
        })}
        <${Text} color=${C.grigio} wrap="truncate-end">Le modifiche si salvano da sole in ${accorcia(FILE_CONFIG, Math.max(20, wDx - 40))}<//>
      <//>`}
    <//>
  <//>`;
}

// ---------- pagina STUDIO: la lavagna ----------

const FORMULE = ['Idea = (Claude + Codex + Gemini)²', 'E = mc²  →  IA = KORTEX²', 'piano + revisione ≥ fortuna', 'Δ codice / Δ t → ∞'];

function PaginaStudio({ h, w, lavagna, appunti, scorri, tick, massimi }) {
  const formula = FORMULE[Math.floor(tick / 40) % FORMULE.length];
  const scritta = formula.slice(0, Math.min(formula.length, (tick % 40) * 2));
  const sezioni = [
    ['LA RICHIESTA', lavagna.richiesta],
    ['IL PIANO DEL DIRETTORE', lavagna.compiti],
    ['I PASSI DEL PIANIFICATORE', lavagna.piano],
    ['IL VERDETTO DEL REVISORE', lavagna.revisione],
    ['APPUNTI', appunti.length ? appunti.join('\n') : 'nessun appunto: scrivi /nota seguito dal testo'],
  ];
  const larg = Math.max(20, w - 8);
  const righe = [];
  for (const [titolo, testo] of sezioni) {
    righe.push({ t: `✎ ${titolo}`, titolo: true });
    for (const r of avvolgi(String(testo || '—').split('\n'), larg)) righe.push({ t: '  ' + r });
    righe.push({ t: '' });
  }
  const spazio = Math.max(1, h - 5);
  massimi.studio = Math.max(0, righe.length - spazio);
  const inizio = Math.min(scorri, massimi.studio);
  return html`<${Box} flexDirection="column" height=${h}>
    <${Pannello} titolo="LAVAGNA" nota=${righe.length > spazio ? `↑↓ scorri  (${inizio + 1}-${Math.min(righe.length, inizio + spazio)} di ${righe.length})` : ''} colore=${C.lavagna} coloreTitolo=${C.gesso} height=${h}>
      <${Text} color=${C.gesso} italic>  ${scritta}${scritta.length < formula.length ? '▌' : ''}<//>
      ${righe.slice(inizio, inizio + spazio).map((r, i) => html`<${Text} key=${i} wrap="truncate-end" color=${r.titolo ? C.giallo : C.gesso} bold=${!!r.titolo}>${r.t || ' '}<//>`)}
    <//>
  <//>`;
}

// ---------- pagina GUIDA ----------

function PaginaGuida({ h, w, scorri, massimi }) {
  const larg = Math.max(20, w - 8);
  const righe = [];
  for (const r of GUIDA) {
    if (r.startsWith('# ')) { righe.push({ t: '' }); righe.push({ t: '◆ ' + r.slice(2), titolo: true }); }
    else for (const x of avvolgi([r.startsWith('- ') ? '  • ' + r.slice(2) : r], larg)) righe.push({ t: x });
  }
  const spazio = Math.max(1, h - 3);
  massimi.guida = Math.max(0, righe.length - spazio);
  const inizio = Math.min(scorri, massimi.guida);
  return html`<${Pannello} titolo="GUIDA" nota=${`↑↓ PAG SU/GIÙ per scorrere  (${inizio + 1}-${Math.min(righe.length, inizio + spazio)} di ${righe.length})`} height=${h}>
    ${righe.slice(inizio, inizio + spazio).map((r, i) => html`<${Text} key=${i} wrap="truncate-end" color=${r.titolo ? C.ciano : C.gesso} bold=${!!r.titolo}>${r.t || ' '}<//>`)}
  <//>`;
}

// ---------- l'applicazione ----------

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
  const [scorri, setScorri] = useState({ lavoro: 0, studio: 0, guida: 0 });
  const [selezionato, setSelezionato] = useState(0);
  const [messaggio, setMessaggio] = useState('');
  const [, ridisegna] = useState(0);
  const [lavagna, setLavagna] = useState({});
  const storia = useRef([]);
  const massimi = useRef({ lavoro: 0, studio: 0, guida: 0 });
  const stato = useRef(null);
  const tel = useRef(null);
  if (!stato.current) stato.current = apriStato(cwd);
  if (!tel.current) tel.current = new Telemetria(Object.keys(disponibili));

  useEffect(() => {
    const f = () => setDim({ c: stdout.columns, r: stdout.rows });
    stdout.on('resize', f);
    return () => stdout.off('resize', f);
  }, [stdout]);

  // Il cuore che batte: anima intestazione e grafici. Più lento se le animazioni sono leggere.
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
      log: (m) => setLog((p) => [...p.slice(-200), `${ora()}  ${m}`]),
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
      `Scrivi cosa vuoi fare e premi Invio. TAB per le altre pagine, /aiuto per i comandi.\n`);
  }, []);

  const salva = (msg) => { setMessaggio(salvaConfig(config) ? msg : 'impossibile salvare la configurazione'); ridisegna((x) => x + 1); };

  function comando(t) {
    const [cmd, ...resto] = t.slice(1).split(/\s+/);
    const arg = resto.join(' ');
    switch (cmd) {
      case 'esci': case 'q': fermaTutti(); exit(); return;
      case 'pulisci': setRighe(['']); return;
      case 'pagina': { const p = PAGINE[Number(arg) - 1]; if (p) setPagina(p[0]); return; }
      case 'mappa': {
        const m = applicaMappatura(config, Number(arg) - 1);
        if (m) { salva(`mappatura ${m.nome} applicata`); scrivi(`\n▌ Mappatura ${m.nome}: ${m.uso}\n`); }
        else scrivi('\nUso: /mappa 1 … /mappa 5 (vedi la pagina CONTROLLO)\n');
        return;
      }
      case 'nota':
        if (!arg) { scrivi('\nUso: /nota testo dell\'appunto\n'); return; }
        stato.current.annotaAppunto(arg);
        scrivi('\n✔ appunto scritto sulla lavagna (pagina STUDIO)\n');
        ridisegna((x) => x + 1);
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
        scrivi('\nComandi: /chat X  /team  /nuova  /mappa N  /nota testo  /pagina N  /ia  /ruoli  /stato  /config  /pulisci  /esci\nLa pagina GUIDA (TAB) spiega tutto nel dettaglio.\n');
    }
  }

  async function invia(valore) {
    const t = valore.trim();
    setInput('');
    if (!t || occupato) return;
    if (t.startsWith('/')) return comando(t);
    setOccupato(true);
    setScorri((s) => ({ ...s, lavoro: 0 }));
    scrivi(`\n› ${t}\n`);
    const ctx = { config, disponibili, cwd, stato: stato.current, ui: ui.current, tel: tel.current };
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
      ui.current.log('✖ ' + e.message);
    }
    setOccupato(false);
    aggiornaFile();
  }

  // ---------- tastiera ----------
  const { c, r } = dim;
  const H = Math.max(16, r - 1);
  const conInput = pagina !== 'controllo';
  const hCorpo = H - 3 - 1 - (conInput ? 3 : 0);
  const pagina_ = (verso) => {
    const i = PAGINE.findIndex(([id]) => id === pagina);
    setPagina(PAGINE[(i + verso + PAGINE.length) % PAGINE.length][0]);
    setMessaggio('');
  };
  const sposta = (quanto) => setScorri((s) => {
    const v = s[pagina] ?? 0;
    const nuovo = pagina === 'lavoro' ? v + quanto : v - quanto;
    return { ...s, [pagina]: Math.max(0, Math.min(massimi.current[pagina] ?? 0, nuovo)) };
  });

  useInput((ch, key) => {
    if (key.tab) return pagina_(key.shift ? -1 : 1);
    if (key.escape) return setPagina('lavoro');
    if (pagina === 'controllo') {
      if (key.upArrow) return setSelezionato((x) => (x - 1 + PARAMETRI.length) % PARAMETRI.length);
      if (key.downArrow) return setSelezionato((x) => (x + 1) % PARAMETRI.length);
      if (key.leftArrow || key.rightArrow) { cambia(config, PARAMETRI[selezionato], key.rightArrow ? 1 : -1); return salva('salvato'); }
      if (/^[1-5]$/.test(ch)) { const m = applicaMappatura(config, Number(ch) - 1); return salva(`mappatura ${m.nome} applicata`); }
      return;
    }
    const pg = Math.max(3, hCorpo - 4);
    if (key.upArrow) return sposta(1);
    if (key.downArrow) return sposta(-1);
    if (key.pageUp) return sposta(pg);
    if (key.pageDown) return sposta(-pg);
  });

  const ruoloAttivo = RUOLI.find(([id]) => ruoli[id].stato === 'lavoro');
  const etichetta = modo ? 'risponde' : ruoloAttivo ? ruoloAttivo[1] : 'al lavoro';
  const consiglio = CONSIGLI[Math.floor(Date.now() / 12000) % CONSIGLI.length];

  let corpo;
  if (pagina === 'controllo') corpo = html`<${PaginaControllo} h=${hCorpo} w=${c} config=${config} selezionato=${selezionato} tel=${tel.current} disponibili=${disponibili} tick=${tick} messaggio=${messaggio} />`;
  else if (pagina === 'studio') corpo = html`<${PaginaStudio} h=${hCorpo} w=${c} lavagna=${lavagna} appunti=${stato.current.appunti()} scorri=${scorri.studio} tick=${tick} massimi=${massimi.current} />`;
  else if (pagina === 'guida') corpo = html`<${PaginaGuida} h=${hCorpo} w=${c} scorri=${scorri.guida} massimi=${massimi.current} />`;
  else corpo = html`<${PaginaLavoro} h=${hCorpo} w=${c} righe=${righe} scorri=${scorri.lavoro} log=${log} ruoli=${ruoli} disponibili=${disponibili} compiti=${compiti} file=${file} tick=${tick} massimi=${massimi.current} />`;

  return html`<${Box} flexDirection="column" width=${c} height=${H}>
    <${Box} height=${3}>
      <${Intestazione} config=${config} tick=${tick} pagina=${pagina} modo=${modo} disponibili=${disponibili} occupato=${occupato} etichetta=${etichetta} costo=${costo} larghezza=${c} />
    <//>
    ${corpo}
    ${conInput && html`<${Box} borderStyle="round" borderColor=${occupato ? C.scuro : C.rosa} paddingX=${1} height=${3}>
      <${Text} color=${C.rosa} bold>› <//>
      ${occupato
        ? html`<${Text} color=${C.grigio}>le IA stanno lavorando…  (TAB per guardare la plancia, Ctrl+C per uscire)<//>`
        : html`<${TextInput} value=${input} onChange=${setInput} onSubmit=${invia} placeholder=${modo ? `scrivi a ${disponibili[modo].nome}…` : 'scrivi cosa vuoi fare…   (/aiuto per i comandi)'} />`}
    <//>`}
    <${Box} height=${1} paddingX=${1}>
      <${Text} color=${C.ciano}>💡 <//><${Text} color=${C.grigio} wrap="truncate-end">${pagina === 'controllo' ? '↑↓ scegli il parametro · ←→ regola · 1-5 mappature · TAB pagina · ESC torna a LAVORO' : consiglio}<//>
    <//>
  <//>`;
}

export async function avviaUI(props) {
  process.stdout.write('\x1b]0;KORTEX\x07\x1b[?1049h\x1b[2J\x1b[H');
  const app = render(html`<${App} ...${props} />`, { exitOnCtrlC: true });
  await app.waitUntilExit();
  fermaTutti();
  process.stdout.write('\x1b[?25h\x1b[?1049l');
}
