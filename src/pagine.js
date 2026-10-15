import { Box, Text } from 'ink';
import path from 'node:path';
import { html, C, COLORE_IA, SPIN, Pannello, Barra, Cervello, statoCervello, avvolgi, accorcia, Neuroni, avvolgiParole } from './grafica.js';
import { Cliccabile } from './mouse.js';
import { I } from './icone.js';
import { impagina } from './markdown.js';
import { PannelloAgenti } from './agenti.js';
import { EmblemaDatabase, EmblemaProgetti } from './emblemi.js';
import { campiona, hex, rgbHex } from './colori.js';
import { graficoAlto } from './telemetria.js';
import { PARAMETRI, MAPPATURE, testoValore, livello } from './parametri.js';
import { GUIDA } from './guida.js';
import { FILE_CONFIG } from './config.js';

export const RUOLI = [['direttore', 'Direttore'], ['pianificatore', 'Pianificatore'], ['esecutore', 'Esecutore'], ['operatore', 'Operatore'], ['revisore', 'Revisore']];

function coloreRiga(r) {
  if (r.startsWith('▌')) return C.ciano;
  if (r.startsWith('› ')) return C.rosa;
  if (/^│\d/.test(r)) return undefined;
  if (r.includes('✗')) return C.rosso;
  if (r.trimStart().startsWith('✓')) return C.verde;
  if (r.trimStart().startsWith('△')) return C.giallo;
  if (r.startsWith('?')) return C.giallo;
  return undefined;
}

// La finestra visibile di un elenco lungo, ancorata in basso (offset = righe dal fondo).
function finestraBasso(righe, spazio, offset) {
  const fine = Math.max(0, righe.length - offset);
  return righe.slice(Math.max(0, fine - spazio), fine);
}

// Una riga di elenco su cui si può cliccare.
const Riga = ({ azione, children }) => html`<${Cliccabile} azione=${azione} height=${1}><${Text} wrap="truncate-end">${children}<//><//>`;

// ---------- barra allegati e selettore ----------

export function BarraAllegati({ allegati, larghezza, azioni }) {
  if (!allegati.length) return null;
  return html`<${Box} paddingX=${1} height=${1}>
    <${Text} color=${C.giallo} bold>📎 ${allegati.length} allegat${allegati.length === 1 ? 'o' : 'i'}  <//>
    <${Box}>${allegati.map((a, i) => html`<${Cliccabile} key=${i} azione=${() => azioni?.togliAllegato(i)}><${Text}><${Text} color=${C.grigio}>${i + 1}<//> <${Text} color=${C.gesso}>${accorcia(path.basename(a), 28)}<//><${Text} color=${C.scuro}> ✕<//>   <//><//>`)}<//>
    <${Box} flexGrow=${1} />
    <${Text} color=${C.grigio}>/togli N · /togli tutti · clic sulla ✕<//>
  <//>`;
}

export function PaginaSelettore({ h, w, elenco, query, sel, azioni }) {
  const spazio = Math.max(1, h - 4);
  const primo = Math.max(0, Math.min(elenco.length - spazio, sel - Math.floor(spazio / 2)));
  return html`<${Cliccabile} rotella=${(v) => azioni?.rotella('selettore', v)} flexDirection="column"><${Pannello} titolo="ALLEGA UN FILE" nota=${`scrivi per cercare · ↑↓ scegli · INVIO allega · ESC chiudi   (${elenco.length} file trovati)`} colore=${C.giallo} coloreTitolo=${C.giallo} height=${h}>
    <${Text} color=${C.grigio}>cerco: <${Text} color=${C.gesso} bold>${query || '(tutto)'}<//><//>
    ${elenco.length === 0 ? html`<${Text} color=${C.grigio}>nessun file corrisponde<//>` : null}
    ${elenco.slice(primo, primo + spazio).map((f, k) => {
      const i = primo + k;
      const scelto = i === sel;
      return html`<${Riga} key=${f} azione=${() => azioni?.selettore(i)}>
        <${Text} color=${scelto ? C.rosa : C.grigio}>${scelto ? '▸ ' : '  '}<//>
        <${Text} color=${scelto ? '#FFFFFF' : C.gesso} bold=${scelto}>${path.basename(f)}<//>
        <${Text} color=${C.grigio}>   ${accorcia(path.dirname(f), Math.max(10, w - 50))}<//>
      <//>`;
    })}
  <//><//>`;
}

// ---------- la tavolozza dei comandi (Ctrl+P) ----------

const COL_GRUPPO = { pagina: C.ciano, scheda: C.ciano, profilo: C.rosa, tema: C.viola, mappatura: C.giallo, grafica: C.grigio, chat: C.verde, comando: C.gesso, progetto: '#FFB84D', database: '#4D9FFF' };

export function PaginaTavolozza({ h, w, elenco, query, sel, azioni }) {
  const spazio = Math.max(1, h - 4);
  const primo = Math.max(0, Math.min(elenco.length - spazio, sel - Math.floor(spazio / 2)));
  return html`<${Cliccabile} rotella=${(v) => azioni?.rotella('selettore', v)} flexDirection="column"><${Pannello} titolo=${`${I.cerca} TAVOLOZZA DEI COMANDI`} nota=${`scrivi per cercare · ↑↓ scegli · INVIO esegue · ESC o Ctrl+P chiude`} etichetta=${`${elenco.length} risultati`} colore=${C.rosa} coloreTitolo=${C.rosa} height=${h}>
    <${Text} color=${C.grigio}>cerco: <${Text} color=${C.gesso} bold>${query || '(tutto)'}<//><//>
    ${elenco.length === 0 ? html`<${Text} color=${C.grigio}>niente corrisponde: prova con meno lettere<//>` : null}
    ${elenco.slice(primo, primo + spazio).map((v, k) => {
      const i = primo + k;
      const scelto = i === sel;
      return html`<${Riga} key=${i + v.etichetta} azione=${() => azioni?.selettore(i)}>
        <${Text} color=${scelto ? C.rosa : C.scuro}>${scelto ? '▸ ' : '  '}<//>
        <${Text} color=${COL_GRUPPO[v.gruppo] || C.grigio}>${v.gruppo.padEnd(10)}<//>
        <${Text} color=${scelto ? '#FFFFFF' : C.gesso} bold=${scelto}>${v.etichetta}<//>
        <${Text} color=${C.grigio}>   ${v.descr}<//>
      <//>`;
    })}
  <//><//>`;
}

// ---------- la domanda del direttore (/chiedi) ----------

export function PannelloDomanda({ domanda, azioni }) {
  return html`<${Box} flexDirection="column" paddingX=${1}>
    <${Text} color=${C.giallo} bold>? IL DIRETTORE CHIEDE<//>
    ${avvolgiParole(domanda.testo.split('\n'), 70).map((r, i) => html`<${Text} key=${i} color=${C.gesso}>${r}<//>`)}
    <${Text}> <//>
    ${domanda.opzioni.map((o, i) => html`<${Cliccabile} key=${i} azione=${() => azioni?.domanda(i)} height=${1}><${Text} wrap="truncate-end"><${Text} color=${C.ciano} bold> [${i + 1}] <//><${Text} color=${C.gesso}>${o}<//><//><//>`)}
    <${Text}> <//>
    <${Text} color=${C.grigio}>premi il numero (o clicca) · ESC: decide lui<//>
  <//>`;
}

// ---------- LAVORO: terminale a sinistra, schede a destra ----------

export const SCHEDE = [['agenti', 'AGENTI'], ['output', 'OUTPUT'], ['registro', 'REGISTRO'], ['diff', 'DIFF'], ['file', 'FILE']];
export const FILTRI = [['tutti', 'TUTTI'], ['claude', 'Claude'], ['codex', 'Codex'], ['gemini', 'Gemini'], ['ollama', 'Ollama'], ['errori', 'ERRORI']];
const ICONA_EVENTO = {
  avvio: ['▸', C.ciano], strumento: ['◆', C.viola], fine: ['✓', C.verde], errore: ['✗', C.rosso],
  riserva: ['»', C.giallo], avviso: ['△', C.giallo], info: ['·', C.grigio],
};
const pulisci = (t) => t.replace(/^\s*[▸◆✗✓△»]\s*/, '').replace(/^(Claude|Codex|Gemini|Ollama|Antigravity)\s*(:|→)\s*/, '');

function Terminale({ h, w, destinazioni, dest, sessione, scorri, fuoco, inCorso, massimi, azioni }) {
  const righe = [];
  for (const e of sessione.righe) for (const r of avvolgi([e.t], Math.max(10, w - 4))) righe.push({ t: r, tipo: e.tipo });
  const spazio = Math.max(1, h - 5);
  massimi.shell = Math.max(0, righe.length - spazio);
  const vis = finestraBasso(righe, spazio, scorri);
  const colore = { cmd: C.ciano, err: '#FF7A90', info: C.giallo, out: C.gesso };
  const casa = process.env.HOME || '';
  const dove = sessione.cwd ? (sessione.cwd.startsWith(casa) ? '~' + sessione.cwd.slice(casa.length) : sessione.cwd) : 'console';
  const colDest = (d) => (d.tipo === 'locale' ? C.verde : d.tipo === 'ssh' ? C.ciano : C.viola);
  return html`<${Cliccabile} azione=${() => azioni?.fuoco('shell')} rotella=${(v) => azioni?.rotella('shell', v)} width=${w} flexShrink=${0}><${Pannello} titolo="TERMINALE" nota=${`${dest.nome}${dest.host ? '  ' + dest.host : ''}${inCorso ? '  · in corso, Ctrl+C ferma' : ''}`} etichetta=${`${righe.length} righe`} colore=${fuoco === 'shell' ? C.rosa : C.viola} height=${h} width=${w} flexShrink=${0}>
    <${Box} height=${1} flexShrink=${0}>
      <${Text} color=${C.grigio}>dove  <//>
      <${Box}>${destinazioni.map((d) => html`<${Cliccabile} key=${d.id} azione=${() => azioni?.dest(d.id)}><${Text} color=${d.id === dest.id ? '#000000' : colDest(d)} backgroundColor=${d.id === dest.id ? colDest(d) : undefined} bold=${d.id === dest.id}> ${d.breve || d.nome} <//><//>`)}<//>
    <//>
    <${Text} color=${C.grigio} wrap="truncate-end">${sessione.collegata === false ? '✗ non collegata  ' : ''}${dove}   <${Text} color=${C.scuro}>Ctrl+D cambia macchina · /dest aggiungi nome utente@host<//><//>
    ${vis.length === 0 ? html`<${Neuroni} w=${w - 4} h=${spazio} tick=${azioni?.tick || 0} testo="scrivi un comando nella riga $ e premi INVIO · ↑↓ richiamano i precedenti" />` : null}
    ${vis.map((r, i) => html`<${Text} key=${i} color=${colore[r.tipo]} bold=${r.tipo === 'cmd'} wrap="truncate-end">${r.t || ' '}<//>`)}
  <//><//>`;
}

function SchedaAgenti(p) {
  return html`<${PannelloAgenti} ...${p} />`;
}

function SchedaRegistro({ h, w, log, filtro, scorri, massimi, azioni, tick }) {
  const filtrati = log.filter((l) => filtro === 'tutti' || (filtro === 'errori' ? l.tipo === 'errore' || l.tipo === 'riserva' : l.ia === filtro));
  const spazio = Math.max(1, h - 2);
  massimi.registro = Math.max(0, filtrati.length - spazio);
  const vis = finestraBasso(filtrati, spazio, scorri);
  return html`<${Box} flexDirection="column" height=${h} overflow="hidden">
    <${Box} height=${1}>
      <${Text} color=${C.grigio}>filtro <//>
      ${FILTRI.map(([id, nome]) => html`<${Cliccabile} key=${id} azione=${() => azioni?.filtro(id)}><${Text} color=${id === filtro ? '#000000' : COLORE_IA[id] || C.grigio} backgroundColor=${id === filtro ? C.ciano : undefined} bold=${id === filtro}> ${nome} <//><//>`)}
      <${Text} color=${C.scuro}>  Ctrl+F · ${filtrati.length} eventi<//>
    <//>
    ${vis.length === 0 ? html`<${Neuroni} w=${w} h=${spazio} tick=${tick} testo="nessun evento ancora" />` : null}
    ${vis.map((l, i) => {
      const [ic, col] = ICONA_EVENTO[l.tipo] || ICONA_EVENTO.info;
      return html`<${Text} key=${i} wrap="truncate-end">
        <${Text} color=${C.grigio}>${l.ora} <//>
        <${Text} color=${l.ia ? COLORE_IA[l.ia] : C.grigio} bold>${(l.ia ? l.ia.toUpperCase() : 'KORTEX').padEnd(7)}<//>
        <${Text} color=${C.grigio}>${(l.ruolo || '').slice(0, 6).padEnd(7)}<//>
        <${Text} color=${col}>${ic} <//>
        <${Text} color=${l.tipo === 'errore' ? '#FF7A90' : C.gesso}>${pulisci(l.testo)}<//>
      <//>`;
    })}
  <//>`;
}

// Il diff del progetto, colorato: verde aggiunte, rosso righe tolte, ciano le intestazioni.
const COL_DIFF = { file: C.ciano, blocco: C.viola, piu: C.verde, meno: C.rosso, nuovo: C.giallo, testo: C.gesso, info: C.grigio };
const RigheDiff = ({ righe, w }) => righe.map((r, i) => html`<${Text} key=${i} color=${COL_DIFF[r.tipo] || C.gesso} bold=${r.tipo === 'file'} wrap="truncate-end">${r.t.slice(0, w) || ' '}<//>`);

// La scheda DIFF. Dopo una richiesta: a sinistra i file cambiati, a destra le modifiche del file scelto,
// e i pulsanti per accettare o rifiutare (rifiutare = riportare il file com'era prima della richiesta).
function SchedaDiff({ h, w, diff, scorri, massimi, tick, azioni }) {
  if (!diff?.revisione) {
    const righe = diff?.righe || [];
    const spazio = Math.max(1, h - 1);
    massimi.diff = Math.max(0, righe.length - spazio);
    const inizio = Math.min(scorri, massimi.diff);
    return html`<${Box} flexDirection="column" height=${h} overflow="hidden">
      <${Text} wrap="truncate-end"><${Text} color=${C.grigio}>${diff?.riepilogo || 'modifiche ai file del progetto'}<//><${Text} color=${C.scuro}>${righe.length > spazio ? `  ↑↓ scorri (${inizio + 1}-${Math.min(righe.length, inizio + spazio)} di ${righe.length})` : ''}<//><//>
      ${righe.length === 0 ? html`<${Neuroni} w=${w} h=${spazio} tick=${tick} testo=${diff?.vuoto || 'nessuna modifica: dopo una richiesta qui rivedi i file uno per uno'} />` : null}
      ${RigheDiff({ righe: righe.slice(inizio, inizio + spazio), w })}
    <//>`;
  }
  const { file, scelto, righe, decisioni } = diff;
  const wSx = Math.min(38, Math.max(24, Math.floor(w * 0.32)));
  const wDx = w - wSx - 1;
  const spazio = Math.max(1, h - 3);
  massimi.diff = Math.max(0, righe.length - spazio);
  const inizio = Math.min(scorri, massimi.diff);
  const fatti = file.filter((f) => decisioni[f.file]).length;
  const stato = { A: ['+', C.verde, 'nuovo'], M: ['~', C.giallo, 'modificato'], D: ['-', C.rosso, 'tolto'] };
  const segnoDecisione = (f) => decisioni[f.file] === 'ok' ? [I.accetta, C.verde] : decisioni[f.file] === 'via' ? [I.rifiuta, C.rosso] : ['○', C.scuro];
  const Pulsante = ({ testo, col, azione }) => html`<${Box} marginRight=${1}><${Cliccabile} azione=${azione}><${Text} color="#000000" backgroundColor=${col} bold> ${testo} <//><//><//>`;
  if (!file.length) return html`<${Box} flexDirection="column" height=${h} overflow="hidden">
    <${Text} color=${C.verde}>${I.ok} nessun file cambiato dall'ultima richiesta (o li hai già riportati tutti com'erano)<//>
    <${Neuroni} w=${w} h=${h - 1} tick=${tick} testo="dopo la prossima richiesta qui rivedi i file uno per uno" />
  <//>`;
  return html`<${Box} flexDirection="column" height=${h} overflow="hidden">
    <${Box} height=${1}>
      <${Pulsante} testo=${`${I.accetta} accetta  INVIO`} col=${C.verde} azione=${() => azioni?.decidi('accetta')} />
      <${Pulsante} testo=${`${I.rifiuta} rifiuta  Ctrl+R`} col=${C.rosso} azione=${() => azioni?.decidi('rifiuta')} />
      <${Pulsante} testo="accetta tutto" col=${C.viola} azione=${() => azioni?.decidi('accetta', true)} />
      <${Pulsante} testo="rifiuta tutto" col=${C.scuro} azione=${() => azioni?.decidi('rifiuta', true)} />
      <${Text} color=${C.grigio} wrap="truncate-end">  rivisti ${fatti}/${file.length}<//>
    <//>
    <${Text} color=${C.scuro} wrap="truncate-end">${'─'.repeat(wSx)}┬${'─'.repeat(Math.max(0, wDx))}<//>
    <${Box} height=${spazio}>
      <${Box} flexDirection="column" width=${wSx} overflow="hidden">
        ${file.slice(0, spazio).map((f, i) => { const sel = scelto && f.file === scelto.file; const [s, cs] = stato[f.stato] || ['?', C.grigio]; const [d, cd] = segnoDecisione(f); return html`<${Cliccabile} key=${f.file} azione=${() => azioni?.selezionaFile(i)} height=${1}><${Text} wrap="truncate-end"><${Text} color=${sel ? C.rosa : C.scuro}>${sel ? '▸' : ' '}<//><${Text} color=${cd}>${d} <//><${Text} color=${cs} bold>${s} <//><${Text} color=${sel ? '#FFFFFF' : decisioni[f.file] ? C.grigio : C.gesso} bold=${sel}>${f.file}<//><//><//>`; })}
      <//>
      <${Text} color=${C.scuro}>${'│\n'.repeat(spazio).trimEnd()}<//>
      <${Box} flexDirection="column" width=${wDx} overflow="hidden">
        ${scelto ? html`<${Text} wrap="truncate-end"><${Text} color=${(stato[scelto.stato] || [])[1] || C.grigio} bold>${scelto.file}<//><${Text} color=${C.grigio}>  ${(stato[scelto.stato] || [])[2] || ''}${righe.length > spazio - 1 ? `  · PAG SU/GIÙ scorre (${inizio + 1}-${Math.min(righe.length, inizio + spazio - 1)} di ${righe.length})` : ''}<//><//>` : null}
        ${RigheDiff({ righe: righe.filter((r) => r.tipo !== 'file').slice(inizio, inizio + spazio - 1), w: wDx })}
      <//>
    <//>
  <//>`;
}

export function PaginaLavoro(p) {
  const { h, w, messaggi, scorri, log, ruoli, disponibili, compiti, file, tick, massimi, tel, scheda, fuoco, filtro, azioni, domanda } = p;
  const wTerm = Math.max(44, Math.floor(w * 0.44));
  const wDx = w - wTerm;
  const dentro = wDx - 4;
  const spin = SPIN[tick % SPIN.length];
  const iconaCompito = { attesa: ['○', C.grigio], lavoro: [spin, C.rosa], ok: ['✓', C.verde], avviso: ['△', C.giallo], errore: ['✗', C.rosso] };
  const testoIA = (d) => (!d.ok ? 'non collegata' : d.limitato ? 'al limite' : tel.ia[d.id]?.attivo ? `pensa · ${tel.ia[d.id].attivo}` : 'pronta');
  const hDentro = h - 4; // bordi + riga delle schede + riga delle IA
  const stretta = dentro < 96;

  let contenuto;
  if (domanda) contenuto = html`<${PannelloDomanda} domanda=${domanda} azioni=${azioni} />`;
  else if (scheda === 'output') {
    const nomi = Object.fromEntries(Object.values(disponibili).map((d) => [d.id, d.nome]));
    const tutte = impagina(messaggi, Math.max(20, dentro - 1), { nomi, spin, bolle: p.config?.bolle !== false });
    const vuoto = !tutte.some((r) => r.length);
    massimi.lavoro = Math.max(0, tutte.length - hDentro);
    const vis = finestraBasso(tutte, hDentro - (scorri > 0 ? 1 : 0), scorri);
    contenuto = html`<${Box} flexDirection="column" height=${hDentro} overflow="hidden">
      ${scorri > 0 ? html`<${Text} color=${C.giallo}>↑ ${scorri} righe più indietro — FRECCIA GIÙ o rotella per tornare in fondo<//>` : null}
      ${vuoto ? html`<${Neuroni} w=${dentro} h=${hDentro} tick=${tick} testo="qui compare quello che scrivono le IA, ognuna nella sua bolla" />` : null}
      ${vuoto ? null : vis.map((r, i) => html`<${Text} key=${i} wrap="truncate-end">${r.length ? r.map((x, k) => html`<${Text} key=${k} color=${x.c} backgroundColor=${x.bg} bold=${!!x.b} italic=${!!x.i}>${x.t}<//>`) : ' '}<//>`)}
    <//>`;
  } else if (scheda === 'registro') {
    contenuto = html`<${SchedaRegistro} h=${hDentro} w=${dentro} log=${log} filtro=${filtro} scorri=${scorri} massimi=${massimi} azioni=${azioni} tick=${tick} />`;
  } else if (scheda === 'diff') {
    contenuto = html`<${SchedaDiff} h=${hDentro} w=${dentro} diff=${p.diff} scorri=${scorri} massimi=${massimi} tick=${tick} azioni=${azioni} />`;
  } else if (scheda === 'file') {
    contenuto = html`<${Box} flexDirection="column" height=${hDentro} overflow="hidden">
      <${Text} color=${C.ciano} bold>COMPITI<//>
      ${compiti.length ? compiti.map((c, i) => { const [ic, col] = iconaCompito[c.stato] || iconaCompito.attesa; return html`<${Text} key=${i} wrap="truncate-end"><${Text} color=${col}>${ic}<//> ${i + 1}. ${c.titolo}${c.dipende?.length ? html`<${Text} color=${C.scuro}>  (dopo ${c.dipende.join(', ')})<//>` : ''}<//>`; }) : html`<${Text} color=${C.grigio}>nessun lavoro in corso<//>`}
      <${Text}> <//>
      <${Text} color=${C.ciano} bold>FILE CAMBIATI NEL PROGETTO<//>
      ${file.map((f, i) => html`<${Text} key=${i} wrap="truncate-end" color=${f.startsWith('??') ? C.verde : f.trimStart().startsWith('M') ? C.giallo : C.grigio}>${f}<//>`)}
    <//>`;
  } else {
    contenuto = html`<${SchedaAgenti} h=${hDentro} w=${dentro} tel=${tel} ruoli=${ruoli} disponibili=${disponibili} tick=${tick} coda=${p.coda} config=${p.config} />`;
  }

  return html`<${Box} height=${h}>
    <${Terminale} h=${h} w=${wTerm} destinazioni=${p.destinazioni} dest=${p.dest} sessione=${p.sessione} scorri=${p.scorriShell} fuoco=${fuoco} inCorso=${p.inCorso} massimi=${massimi} azioni=${{ ...azioni, tick }} />
    <${Cliccabile} azione=${() => azioni?.fuoco('ia')} rotella=${(v) => azioni?.rotella(scheda === 'registro' ? 'registro' : scheda === 'diff' ? 'diff' : 'lavoro', v)} flexGrow=${1}><${Box} flexDirection="column" borderStyle="round" borderColor=${fuoco === 'ia' ? C.rosa : C.viola} paddingX=${1} height=${h} flexGrow=${1} overflow="hidden">
      <${Box} height=${1}>
        ${SCHEDE.map(([id, nome]) => html`<${Cliccabile} key=${id} azione=${() => azioni?.scheda(id)}><${Text} color=${id === scheda ? '#000000' : C.grigio} backgroundColor=${id === scheda ? C.ciano : undefined} bold=${id === scheda}> ${stretta && id !== scheda ? nome.slice(0, 3) : nome} <//><//>`)}
        ${!stretta ? html`<${Text} color=${C.scuro}>  Ctrl+N   <//>` : html`<${Text}> <//>`}
        <${Box} flexGrow=${1} />
        <${Text} wrap="truncate-end">${RUOLI.map(([id, nome]) => { const r = ruoli[id] || { stato: 'attesa' }; const col = r.stato === 'lavoro' ? C.rosa : r.stato === 'ok' ? C.verde : r.stato === 'errore' ? C.rosso : C.scuro; return html`<${Text} key=${id} color=${col}> ${r.stato === 'lavoro' ? spin : '●'}${stretta ? '' : ' ' + nome.slice(0, 4)}<//>`; })}<//>
      <//>
      <${Text} wrap="truncate-end">
        ${Object.values(disponibili).map((d) => html`<${Text} key=${d.id}><${Cervello} id=${d.id} stato=${statoCervello(d, tel)} tick=${tick} compatto=${true} /><${Text} color=${d.ok ? COLORE_IA[d.id] : C.grigio} bold>${d.nome}<//>${!stretta ? html`<${Text} color=${d.limitato ? C.rosso : tel.ia[d.id]?.attivo ? C.rosa : C.scuro}> ${testoIA(d)}<//>` : null}<${Text}>   <//><//>`)}
      <//>
      ${contenuto}
    <//><//>
  <//>`;
}

// ---------- CONTROLLO: la plancia ----------

function Cavo({ d, stato, tick, larghezza }) {
  const lungo = Math.max(6, larghezza);
  const attivo = !!stato?.attivo;
  const colore = !d.ok ? C.scuro : d.limitato ? C.rosso : attivo ? C.rosa : C.viola;
  const pos = attivo ? tick % lungo : -1;
  const cavo = '━'.repeat(lungo);
  return html`<${Box}>
    <${Cervello} id=${d.id} stato=${statoCervello(d, { ia: { [d.id]: stato } })} tick=${tick} />
    <${Box} flexDirection="column">
      <${Text} wrap="truncate-end"><${Text} color=${d.ok ? COLORE_IA[d.id] : C.grigio} bold>${d.nome.padEnd(8)}<//><${Text} color=${C.grigio}>${!d.ok ? 'non collegata' : d.limitato ? 'AL LIMITE: lavorano le riserve' : attivo ? `sta pensando · ${stato.attivo}` : 'collegata, in attesa'}<//><//>
      <${Text} wrap="truncate-end">
        <${Text} color=${C.ciano}>KORTEX <//>
        ${pos >= 0
          ? html`<${Text}><${Text} color=${colore}>${cavo.slice(0, pos)}<//><${Text} color="#FFFFFF" bold>●<//><${Text} color=${colore}>${cavo.slice(pos + 1)}<//><//>`
          : html`<${Text} color=${colore}>${cavo}<//>`}
        <${Text} color=${d.ok ? COLORE_IA[d.id] : C.grigio}> ◆<//>
      <//>
    <//>
  <//>`;
}

export function PaginaControllo({ h, w, config, selezionato, tel, disponibili, tick, messaggio, azioni }) {
  const compatto = h < 34 || w < 140;
  const wSx = compatto ? Math.min(58, Math.floor(w * 0.52)) : Math.min(64, Math.floor(w * 0.46));
  const wDx = w - wSx;
  const barra = Math.max(6, wSx - 44);
  const nIA = Object.keys(disponibili).length;
  const p = PARAMETRI[selezionato];
  const mappaAttiva = MAPPATURE.findIndex((m) => m.nome === config.mappa);
  const media = (s) => (s.ok + s.errori ? (s.secondi / (s.ok + s.errori)).toFixed(0) + 's' : '—');

  const hMap = compatto ? 0 : MAPPATURE.length + 3;
  const hPar = compatto ? Math.max(5, h - 8) : Math.min(PARAMETRI.length + 3, h - hMap - 8);
  const hInfo = h - hMap - hPar;
  const visibili = Math.min(PARAMETRI.length, hPar - 3);
  const primo = Math.max(0, Math.min(PARAMETRI.length - visibili, selezionato - Math.floor(visibili / 2)));

  const hConn = nIA * 2 + 3;
  const hNum = compatto ? 0 : nIA + 6;
  const hTel = Math.max(5, h - hConn - hNum);
  const larGrafico = Math.max(10, Math.min(60, wDx - 6));
  const grafici = [
    ['CPU', 'quanto lavora il processore', tel.cpu, 1, C.rosa, `${Math.round((tel.cpu.at(-1) || 0) * 100)}%`],
    ['RAM', 'memoria occupata', tel.ram, 1, C.viola, `${Math.round((tel.ram.at(-1) || 0) * 100)}%`],
    ['PENSIERI', 'risposte e strumenti delle IA al secondo', tel.pensieri, undefined, C.ciano, `${tel.pensieri.at(-1) || 0}/s`],
  ];
  const quanti = Math.max(1, Math.min(3, Math.floor((hTel - 3) / 2)));
  const altGrafico = Math.max(1, Math.floor((hTel - 3) / quanti) - 1);
  const ordine = [2, 0, 1].slice(0, quanti).sort();

  return html`<${Box} height=${h}>
    <${Cliccabile} rotella=${(v) => azioni?.rotella('controllo', v)} flexDirection="column" width=${wSx}>
      ${!compatto && html`<${Pannello} titolo="MAPPATURE" nota="tasti 1-5 o clic" height=${hMap} flexShrink=${0}>
        ${MAPPATURE.map((m, i) => html`<${Riga} key=${m.nome} azione=${() => azioni?.mappatura(i)}>
          <${Text} color=${i === mappaAttiva ? C.ciano : C.grigio} bold=${i === mappaAttiva}>${i === mappaAttiva ? '▸' : ' '} ${i + 1} ${m.nome.padEnd(9)}<//>
          <${Text} color=${rgbHex(campiona([hex(C.viola), hex(C.rosa), hex(C.ciano)], i / 6))}>${'■'.repeat(i + 1)}<//><${Text} color=${C.scuro}>${'□'.repeat(4 - i)}<//>
          <${Text} color=${C.grigio}>  ${m.uso}<//>
        <//>`)}
      <//>`}
      <${Pannello} titolo="PARAMETRI" nota=${compatto ? `mappa ${config.mappa} · 1-5 mappature` : '↑↓ scegli  ←→ regola  · clic su ◂ ▸'} etichetta=${`${selezionato + 1}/${PARAMETRI.length}`} height=${hPar} flexShrink=${0}>
        ${PARAMETRI.slice(primo, primo + visibili).map((q, k) => {
          const i = primo + k;
          const sel = i === selezionato;
          return html`<${Box} key=${q.chiave} height=${1}>
            <${Cliccabile} azione=${() => azioni?.parametro(i, 'seleziona')}><${Text} wrap="truncate-end">
              <${Text} color=${sel ? C.rosa : C.grigio}>${sel ? '▸ ' : '  '}<//>
              <${Text} color=${sel ? '#FFFFFF' : C.gesso} bold=${sel}>${q.nome.padEnd(23)}<//>
            <//><//>
            <${Cliccabile} azione=${() => azioni?.parametro(i, 'meno')}><${Text} color=${sel ? C.ciano : C.scuro}>◂<//><//>
            <${Cliccabile} azione=${(ev) => azioni?.parametro(i, 'barra', ev)}><${Barra} valore=${livello(config, q)} larghezza=${barra} colore=${sel ? C.rosa : C.viola} /><//>
            <${Cliccabile} azione=${() => azioni?.parametro(i, 'piu')}><${Text} color=${sel ? C.ciano : C.scuro}>▸<//><//>
            <${Text} color=${sel ? C.ciano : C.grigio} wrap="truncate-end"> ${testoValore(config, q)}<//>
          <//>`;
        })}
      <//>
      <${Pannello} titolo=${'i ' + p.nome.toUpperCase()} colore=${C.ciano} height=${hInfo} flexShrink=${0}>
        <${Text} color=${C.gesso}>${p.spiega}<//>
        <${Text} color=${C.grigio}>${p.tipo === 'numero' ? `Da ${p.min} a ${p.max}${p.unita || ''}, a passi di ${p.passo}.` : p.tipo === 'sino' ? 'SÌ oppure NO.' : p.tipo === 'scelta' ? `${p.valori.join(' · ').toUpperCase()}` : 'Ordine: ' + (config.ruoli[p.ruolo] || []).map((id) => config.ia[id]?.nome || id).join(' → ')}<//>
        ${messaggio ? html`<${Text} color=${C.verde}>✓ ${messaggio}<//>` : null}
      <//>
    <//>
    <${Box} flexDirection="column" width=${wDx}>
      <${Pannello} titolo="TELEMETRIA" nota="ultimi 60 secondi" etichetta=${new Date().toTimeString().slice(0, 8)} height=${hTel} flexShrink=${0}>
        ${ordine.map((k) => {
          const [nome, spiega, dati, max, colore, ora] = grafici[k];
          return html`<${Box} key=${nome} flexDirection="column">
            <${Text} wrap="truncate-end"><${Text} color=${colore} bold>${nome.padEnd(9)}<//><${Text} color=${C.gesso} bold>${ora.padStart(5)}<//><${Text} color=${C.grigio}>   ${spiega}<//><//>
            ${graficoAlto(dati, larGrafico, altGrafico, max).map((riga, i) => html`<${Text} key=${i} color=${colore}>${riga}<//>`)}
          <//>`;
        })}
      <//>
      <${Pannello} titolo="CONNESSIONI" nota=${compatto ? '' : "il cervello si accende e l'impulso corre quando l'IA pensa"} height=${hConn} flexShrink=${0}>
        ${Object.values(disponibili).map((d) => html`<${Cavo} key=${d.id} d=${d} stato=${tel.ia[d.id]} tick=${tick} larghezza=${Math.max(4, wDx - 22)} />`)}
      <//>
      ${!compatto && html`<${Pannello} titolo="SQUADRA IN NUMERI" height=${hNum} flexShrink=${0}>
        <${Text} color=${C.grigio}>${'IA'.padEnd(9)}${'chiamate'.padStart(9)}${'riuscite'.padStart(10)}${'fallite'.padStart(9)}${'media'.padStart(8)}${'valore'.padStart(9)}${'ultime 5h'.padStart(11)}<//>
        ${Object.values(disponibili).map((d) => {
          const s = tel.ia[d.id];
          const cinqueOre = tel.chiamate.filter((x) => x.ia === d.id && x.inizio > Date.now() - 5 * 3600 * 1000).length;
          return html`<${Text} key=${d.id} color=${d.ok ? C.gesso : C.scuro}><${Text} color=${d.ok ? COLORE_IA[d.id] : C.scuro}>${d.nome.padEnd(9)}<//>${String(s.chiamate).padStart(9)}${String(s.ok).padStart(10)}${String(s.errori).padStart(9)}${media(s).padStart(8)}${(s.valore ? '$' + s.valore.toFixed(2) : '—').padStart(9)}<${Text} color=${d.limitato ? C.rosso : cinqueOre > 40 ? C.giallo : C.gesso}>${String(cinqueOre).padStart(11)}<//><//>`;
        })}
        <${Text} color=${C.grigio}>"ultime 5h" è la finestra in cui gli abbonamenti contano i messaggi: se un'IA va al limite, la colonna diventa rossa.<//>
        <${Text} color=${C.grigio} wrap="truncate-end">Le modifiche si salvano da sole in ${accorcia(FILE_CONFIG, Math.max(20, wDx - 40))}<//>
      <//>`}
    <//>
  <//>`;
}

// ---------- STUDIO: la lavagna e la mappa della memoria ----------

const FORMULE = ['Idea = (Claude + Codex + Gemini)²', 'E = mc²  →  IA = KORTEX²', 'piano + revisione ≥ fortuna', 'Δ codice / Δ t → ∞', 'memoria × tempo = esperienza', 'compiti ∥ = tempo ÷ n'];

export function PaginaStudio({ h, w, lavagna, appunti, scorri, tick, massimi, memoria, azioni }) {
  const wSx = Math.max(40, Math.floor(w * 0.52));
  const wDx = w - wSx;
  const formula = FORMULE[Math.floor(tick / 40) % FORMULE.length];
  const scritta = formula.slice(0, Math.min(formula.length, (tick % 40) * 2));
  const vuota = !lavagna.richiesta && !appunti.length;
  const sezioni = [
    ['LA RICHIESTA', lavagna.richiesta],
    ['IL PIANO DEL DIRETTORE', lavagna.compiti],
    ['I PASSI DEL PIANIFICATORE', lavagna.piano],
    ['IL VERDETTO DEL REVISORE', lavagna.revisione],
    ['APPUNTI', appunti.length ? appunti.join('\n') : 'nessun appunto: scrivi /nota seguito dal testo'],
  ];
  const larg = Math.max(20, wSx - 6);
  const righe = [];
  for (const [titolo, testo] of sezioni) {
    righe.push({ t: `◇ ${titolo}`, titolo: true });
    for (const r of avvolgi(String(testo || '—').split('\n'), larg)) righe.push({ t: '  ' + r });
    righe.push({ t: '' });
  }
  const spazio = Math.max(1, h - 4);
  massimi.studio = Math.max(0, righe.length - spazio);
  const inizio = Math.min(scorri, massimi.studio);

  // la mappa della memoria: quello che KORTEX sa, dal più generale al più specifico
  const lm = Math.max(16, wDx - 6);
  const blocchi = [
    ['PREFERENZE · valgono in tutti i progetti, su tutti i PC', memoria.preferenze.length ? memoria.preferenze.map((p, i) => `${i + 1}. ${p}`) : ['nessuna: /ricorda testo per aggiungerne una'], C.giallo],
    ['RIASSUNTO DEL PROGETTO', memoria.riassunto ? memoria.riassunto.split('\n') : ['ancora nessuno: lo scrive il memorista dopo la prima richiesta'], C.ciano],
    ['SOLUZIONI IMPARATE · nel database', memoria.soluzioni.length ? memoria.soluzioni.map((v) => `• ${v.titolo}`) : ['nessuna ancora'], C.verde],
    ['DIARIO', memoria.diario.length ? memoria.diario : ['vuoto'], C.grigio],
  ];
  const righeM = [];
  for (const [titolo, testo, col] of blocchi) {
    righeM.push({ t: `◆ ${titolo}`, col, titolo: true });
    for (const r of avvolgiParole(testo, lm)) righeM.push({ t: '  ' + r, col: C.gesso });
    righeM.push({ t: '' });
  }
  const aggiornata = memoria.ultimo && Date.now() - memoria.ultimo < 4500;
  return html`<${Box} height=${h}>
    <${Cliccabile} rotella=${(v) => azioni?.rotella('studio', v)} width=${wSx} flexShrink=${0}><${Pannello} titolo="LAVAGNA" nota=${righe.length > spazio ? `↑↓ scorri  (${inizio + 1}-${Math.min(righe.length, inizio + spazio)} di ${righe.length})` : ''} colore=${C.lavagna} coloreTitolo=${C.gesso} width=${wSx} height=${h} flexShrink=${0}>
      <${Text} color=${C.gesso} italic>  ${scritta}${scritta.length < formula.length ? '▌' : ''}<//>
      ${vuota ? html`<${Neuroni} w=${wSx - 4} h=${Math.max(2, Math.floor(spazio / 2))} tick=${tick} colore=${C.lavagna} testo="la lavagna si riempie con la prima richiesta" />` : null}
      ${righe.slice(inizio, inizio + spazio - (vuota ? Math.floor(spazio / 2) : 0)).map((r, i) => html`<${Text} key=${i} wrap="truncate-end" color=${r.titolo ? C.giallo : C.gesso} bold=${!!r.titolo}>${r.t || ' '}<//>`)}
    <//><//>
    <${Pannello} titolo="MAPPA DELLA MEMORIA" nota=${aggiornata ? '● aggiornata adesso' : '/ricorda · /dimentica N · /memoria'} etichetta=${memoria.sincronizzata ? '» GitHub' : ''} colore=${aggiornata ? C.rosa : C.viola} flexGrow=${1} height=${h}>
      ${righeM.slice(0, h - 3).map((r, i) => html`<${Text} key=${i} wrap="truncate-end" color=${r.col || C.gesso} bold=${!!r.titolo}>${r.t || ' '}<//>`)}
    <//>
  <//>`;
}

// ---------- GUIDA ----------

export function PaginaGuida({ h, w, scorri, massimi, azioni }) {
  const larg = Math.max(20, w - 8);
  const righe = [];
  for (const r of GUIDA) {
    if (r.startsWith('# ')) { righe.push({ t: '' }); righe.push({ t: '◆ ' + r.slice(2), titolo: true }); }
    else for (const x of avvolgiParole([r.startsWith('- ') ? '  • ' + r.slice(2) : r], larg)) righe.push({ t: x });
  }
  const spazio = Math.max(1, h - 3);
  massimi.guida = Math.max(0, righe.length - spazio);
  const inizio = Math.min(scorri, massimi.guida);
  return html`<${Cliccabile} rotella=${(v) => azioni?.rotella('guida', v)} flexDirection="column"><${Pannello} titolo="GUIDA" nota=${`↑↓ PAG SU/GIÙ o rotella per scorrere  (${inizio + 1}-${Math.min(righe.length, inizio + spazio)} di ${righe.length})`} height=${h}>
    ${righe.slice(inizio, inizio + spazio).map((r, i) => html`<${Text} key=${i} wrap="truncate-end" color=${r.titolo ? C.ciano : C.gesso} bold=${!!r.titolo}>${r.t || ' '}<//>`)}
  <//><//>`;
}

// ---------- PROGETTI: i tuoi progetti, le loro chat, i punti di ripristino ----------

export function PaginaProgetti({ h, w, progetti, selezione, colonna, chat, istantanee, progettoAttuale, chatAttuale, tick, ultimo, etichetta, azioni }) {
  const wSx = Math.min(56, Math.floor(w * 0.4));
  const quando = (iso) => (iso ? iso.slice(0, 16).replace('T', ' ') : '');
  const p = progetti[selezione.progetto];
  const spazioChat = Math.max(2, Math.floor((h - 4) * 0.55));
  const spazioIst = Math.max(2, h - 4 - spazioChat - 3);
  const primoC = Math.max(0, Math.min(chat.length - spazioChat, selezione.chat - Math.floor(spazioChat / 2)));
  return html`<${Box} height=${h}>
    <${Cliccabile} azione=${() => azioni?.colonna('progetti')} width=${wSx} flexShrink=${0}><${Pannello} titolo="PROGETTI" nota=${`${progetti.length} · INVIO apre · scrivi un nome e INVIO per crearne uno`} colore=${colonna === 'progetti' ? C.rosa : C.viola} width=${wSx} height=${h} flexShrink=${0}>
      ${progetti.length === 0 ? html`<${Text} color=${C.grigio}>nessun progetto: scrivi un nome qui sotto e premi INVIO, oppure /progetto importa percorso<//>` : null}
      ${progetti.slice(0, Math.max(1, Math.floor((h - (h >= 22 ? 10 : 3)) / 2))).map((q, i) => {
        const sel = i === selezione.progetto;
        const aperto = q.percorso === progettoAttuale;
        return html`<${Cliccabile} key=${q.percorso} azione=${() => azioni?.progetto(i)} flexDirection="column">
          <${Text} wrap="truncate-end"><${Text} color=${sel ? C.rosa : C.grigio}>${sel ? '▸ ' : '  '}<//><${Text} color=${aperto ? C.ciano : C.gesso} bold=${sel || aperto}>${q.nome}<//><${Text} color=${C.grigio}>${aperto ? '  ● aperto' : ''}<//><//>
          <${Text} color=${C.grigio} wrap="truncate-end">    ${q.descrizione || accorcia(q.percorso, wSx - 8)}<//>
        <//>`;
      })}
      <${Box} flexGrow=${1} />
      ${h >= 22 ? html`<${EmblemaProgetti} tick=${tick} ultimo=${ultimo} quanti=${progetti.length} etichetta=${etichetta} />` : null}
    <//><//>
    <${Box} flexDirection="column" flexGrow=${1}>
      <${Cliccabile} azione=${() => azioni?.colonna('chat')} flexDirection="column"><${Pannello} titolo=${p ? 'CHAT DI ' + p.nome.toUpperCase() : 'CHAT'} nota=${chat.length ? `${chat.length} · INVIO apre · /chat nuova per iniziarne una` : ''} colore=${colonna === 'chat' ? C.rosa : C.viola} height=${spazioChat + 3} flexShrink=${0}>
        ${!p ? html`<${Text} color=${C.grigio}>scegli un progetto a sinistra<//>` : chat.length === 0 ? html`<${Neuroni} w=${w - wSx - 4} h=${spazioChat} tick=${tick} testo="nessuna chat ancora: apri il progetto e scrivi la prima richiesta, oppure /chat nuova" />` : null}
        ${chat.slice(primoC, primoC + spazioChat).map((c, k) => {
          const i = primoC + k;
          const sel = colonna === 'chat' && i === selezione.chat;
          const aperta = c.id === chatAttuale;
          return html`<${Riga} key=${c.id} azione=${() => azioni?.chat(i)}><${Text} color=${sel ? C.rosa : C.grigio}>${sel ? '▸ ' : '  '}<//><${Text} color=${aperta ? C.ciano : C.gesso} bold=${sel || aperta}>${c.titolo}<//><${Text} color=${C.grigio}>   ${c.messaggi.length} messaggi · ${quando(c.ultimo)}${aperta ? ' · ● aperta' : ''}<//><//>`;
        })}
      <//><//>
      <${Pannello} titolo="PUNTI DI RIPRISTINO" nota=${istantanee.length ? '/ripristina ID riporta i file a quel momento · clic per copiare il comando' : ''} flexGrow=${1}>
        ${istantanee.length === 0 ? html`<${Neuroni} w=${w - wSx - 4} h=${Math.max(2, spazioIst)} tick=${tick} testo="ancora nessuno: KORTEX ne scatta uno prima e uno dopo ogni richiesta" />` : null}
        ${istantanee.slice(0, spazioIst).map((i) => html`<${Riga} key=${i.id} azione=${() => azioni?.istantanea(i.id)}><${Text} color=${C.ciano}>${i.id}<//><${Text} color=${C.grigio}>  ${i.data}  <//><${Text} color=${C.gesso}>${i.etichetta}<//><//>`)}
      <//>
    <//>
  <//>`;
}

// ---------- DATABASE: la memoria di tutti i progetti ----------

import { CATEGORIE, percorsoAssoluto } from './database.js';
const COLORE_CAT = { manuali: '#FFB84D', codice: '#3DDC97', documenti: '#4D9FFF', immagini: '#FF6EC7', note: '#FFE66D', archivio: '#9A9AB0' };

export function PaginaDatabase({ h, w, voci, categoria, query, sel, conteggi, github, pronto, tick, ultimo, etichetta, azioni, guardiano }) {
  const wSx = 24;
  const wDx = Math.min(70, Math.floor(w * 0.38));
  const quando = (iso) => (iso ? iso.slice(0, 10) : '');
  const v = voci[sel];
  const spazio = Math.max(2, h - 4);
  const primo = Math.max(0, Math.min(voci.length - spazio, sel - Math.floor(spazio / 2)));
  const totale = Object.values(conteggi).reduce((a, b) => a + b, 0);
  return html`<${Box} height=${h}>
    <${Pannello} titolo="CATEGORIE" nota="←→" width=${wSx} height=${h} flexShrink=${0}>
      ${[['tutte', 'TUTTE', totale], ...CATEGORIE.map((c) => [c, c.toUpperCase(), conteggi[c] || 0])].map(([id, nome, n]) => html`<${Riga} key=${id} azione=${() => azioni?.dbCategoria(id)}><${Text} color=${id === categoria ? '#000000' : COLORE_CAT[id] || C.gesso} backgroundColor=${id === categoria ? COLORE_CAT[id] || C.ciano : undefined} bold=${id === categoria}> ${nome.padEnd(10)}<//><${Text} color=${C.grigio}> ${String(n).padStart(4)}<//><//>`)}
      <${Text}> <//>
      <${Text} color=${C.grigio}>GitHub<//>
      <${Text} color=${github ? C.verde : C.grigio} wrap="truncate-end">${github ? '● collegato' : '○ no: /db github'}<//>
      <${Text}> <//>
      <${Text} color=${C.grigio} wrap="truncate-end">${pronto ? 'catalogatore pronto' : 'catalogatore: nessuna IA'}<//>
      <${Text} color=${guardiano ? C.verde : C.grigio} wrap="truncate-end">${guardiano ? '● guardiano attivo' : '○ guardiano spento'}<//>
      <${Box} flexGrow=${1} />
      ${h >= 22 ? html`<${EmblemaDatabase} tick=${tick} ultimo=${ultimo} etichetta=${etichetta} />` : null}
    <//>
    <${Cliccabile} rotella=${(vv) => azioni?.rotella('database', vv)} flexGrow=${1}><${Pannello} titolo=${categoria === 'tutte' ? 'TUTTE LE VOCI' : categoria.toUpperCase()} nota=${`${voci.length}${query ? ` · cerco "${query}"` : ''} · ↑↓ scegli · scrivi per cercare · trascina un file per aggiungerlo`} flexGrow=${1} height=${h}>
      ${voci.length === 0 ? html`<${Neuroni} w=${w - wSx - wDx - 4} h=${spazio} tick=${tick} testo=${query ? 'niente corrisponde' : 'vuoto: trascina qui un file, oppure /db nota testo, /db aggiungi percorso-o-url'} />` : null}
      ${voci.slice(primo, primo + spazio).map((x, k) => {
        const i = primo + k;
        const s = i === sel;
        return html`<${Riga} key=${x.id} azione=${() => azioni?.dbVoce(i)}><${Text} color=${s ? C.rosa : C.grigio}>${s ? '▸ ' : '  '}<//><${Text} color=${COLORE_CAT[x.categoria]}>■ <//><${Text} color=${s ? '#FFFFFF' : C.gesso} bold=${s}>${x.titolo}<//><${Text} color=${C.grigio}>   ${x.tag.slice(0, 4).map((t) => '#' + t).join(' ')}  ${quando(x.aggiunto)}<//><//>`;
      })}
    <//><//>
    <${Pannello} titolo="SCHEDA" nota=${v ? `@${v.titolo.split(' ')[0].toLowerCase()} nella richiesta la usa` : ''} colore=${C.ciano} width=${wDx} height=${h} flexShrink=${0}>
      ${!v ? html`<${Text} color=${C.grigio}>scegli una voce<//>` : html`<${Box} flexDirection="column">
        <${Text} color=${COLORE_CAT[v.categoria]} bold wrap="truncate-end">${v.titolo}<//>
        <${Text} color=${C.grigio} wrap="truncate-end">${v.categoria} · ${v.tag.map((t) => '#' + t).join(' ') || 'nessun tag'} · ${v.catalogatoDa === 'ia' ? 'scheda scritta dall\'IA' : v.catalogatoDa === 'guardiano' ? 'trovata dal guardiano' : 'scheda automatica'}<//>
        <${Text} color=${C.gesso}>${v.descrizione || '—'}<//>
        <${Text}> <//>
        <${Text} color=${C.grigio} wrap="truncate-end">${percorsoAssoluto(v)}<//>
        ${v.fonte ? html`<${Text} color=${C.grigio} wrap="truncate-end">fonte: ${v.fonte}<//>` : null}
        <${Text}> <//>
        <${Text} color=${C.ciano} bold>ESTRATTO<//>
        ${avvolgi((v.estratto || '').split('\n').slice(0, 40), wDx - 4).slice(0, Math.max(2, h - 14)).map((r, i) => html`<${Text} key=${i} color=${C.gesso}>${r || ' '}<//>`)}
        <${Text}> <//>
        <${Text} color=${C.grigio} wrap="truncate-end">/db sposta ${v.id} categoria · /db tag ${v.id} a,b · /db togli ${v.id}<//>
      <//>`}
    <//>
  <//>`;
}

// ---------- STATISTICHE: il tuo lavoro con KORTEX in numeri ----------

import { statistiche, carburante } from './uso.js';
import { righeLogo } from './colori.js';

function Tessera({ titolo, valore, nota, colore, w }) {
  const grande = righeLogo(String(valore), w - 4, ['Small', 'Mini']);
  const usaGrande = grande.length > 1 && Math.max(...grande.map((r) => r.length)) <= w - 4;
  return html`<${Box} flexDirection="column" borderStyle="round" borderColor=${colore} paddingX=${1} width=${w} height=${usaGrande ? grande.length + 4 : 5} flexShrink=${0}>
    <${Text} color=${colore} bold wrap="truncate-end">${titolo}<//>
    ${usaGrande ? grande.map((r, i) => html`<${Text} key=${i} color=${colore}>${r}<//>`) : html`<${Text} color=${colore} bold>${String(valore)}<//>`}
    <${Text} color=${C.grigio} wrap="truncate-end">${nota}<//>
  <//>`;
}

export function PaginaStatistiche({ h, w, config, disponibili }) {
  const s = statistiche();
  const ore = (sec) => (sec >= 3600 ? `${(sec / 3600).toFixed(1)}h` : `${Math.round(sec / 60)}m`);
  const riuscitiPct = s.compiti ? Math.round((s.compitiOk / s.compiti) * 100) : 0;
  // stima prudente: un compito riuscito fa risparmiare circa un quarto d'ora di lavoro a mano
  const risparmiate = (s.compitiOk * 15) / 60;
  const wT = Math.max(18, Math.floor((w - 2) / 5));
  const preferita = Object.entries(s.perIA).sort((a, b) => b[1].chiamate - a[1].chiamate)[0];
  const giorni = [];
  for (let k = 13; k >= 0; k--) { const d = new Date(Date.now() - k * 86400000).toISOString().slice(0, 10); giorni.push([d, s.perGiorno[d] || 0]); }
  const maxG = Math.max(1, ...giorni.map((g) => g[1]));
  const hTessere = 9;
  const hSotto = Math.max(6, h - hTessere);
  const wSx = Math.floor(w * 0.55);
  const altezzaBarre = Math.max(2, hSotto - 6);
  const larghezzaColonna = Math.max(2, Math.min(5, Math.floor((w - wSx - 6) / 14)));
  return html`<${Box} flexDirection="column" height=${h}>
    <${Box} height=${hTessere} overflow="hidden">
      <${Tessera} titolo=${`${I.razzo} RICHIESTE`} valore=${s.richieste} nota=${s.primoGiorno ? `dal ${s.primoGiorno}` : 'ancora nessuna'} colore=${C.rosa} w=${wT} />
      <${Tessera} titolo=${`${I.ok} COMPITI RIUSCITI`} valore=${`${riuscitiPct}%`} nota=${`${s.compitiOk} su ${s.compiti}`} colore=${C.verde} w=${wT} />
      <${Tessera} titolo=${`${I.file} FILE TOCCATI`} valore=${s.file} nota="creati, modificati o tolti" colore=${C.ciano} w=${wT} />
      <${Tessera} titolo=${`${I.chip} LAVORO DELLE IA`} valore=${ore(s.secondiIA)} nota="tempo totale di calcolo" colore=${C.viola} w=${wT} />
      <${Tessera} titolo=${`${I.stella} TEMPO RISPARMIATO`} valore=${`${risparmiate.toFixed(1)}h`} nota="stima: 15 min per compito" colore=${C.giallo} w=${w - 4 * wT} />
    <//>
    <${Box} height=${hSotto}>
      <${Pannello} titolo=${`${I.ia} LE TUE IA`} nota=${preferita ? `la più usata: ${disponibili[preferita[0]]?.nome || preferita[0]}` : ''} width=${wSx} height=${hSotto} flexShrink=${0}>
        <${Text} color=${C.grigio}>${'IA'.padEnd(9)}${'chiamate'.padStart(9)}${'riuscite'.padStart(10)}${'tempo'.padStart(8)}   carburante (5 ore)<//>
        ${Object.values(disponibili).map((d) => {
          const p = s.perIA[d.id] || { chiamate: 0, ok: 0, secondi: 0 };
          const f = carburante(d.id, config);
          const pieni = Math.round(f.resto * 10);
          const col = f.resto < 0.1 ? C.rosso : f.resto < 0.35 ? C.giallo : C.verde;
          return html`<${Text} key=${d.id} wrap="truncate-end">
            <${Text} color=${d.ok ? COLORE_IA[d.id] : C.scuro} bold>${d.nome.padEnd(9)}<//>
            <${Text} color=${C.gesso}>${String(p.chiamate).padStart(9)}${(p.chiamate ? Math.round((p.ok / p.chiamate) * 100) + '%' : '—').padStart(10)}${ore(p.secondi).padStart(8)}   <//>
            ${d.ok && d.id !== 'ollama' ? html`<${Text}><${Text} color=${col}>${'■'.repeat(pieni)}<//><${Text} color=${C.scuro}>${'□'.repeat(10 - pieni)}<//><${Text} color=${C.grigio}> ${f.usate}/${f.limite}${f.stimato ? ' stimato' : ' imparato'}<//><//>` : html`<${Text} color=${C.scuro}>—<//>`}
          <//>`;
        })}
        <${Text}> <//>
        <${Text} color=${C.grigio} wrap="wrap">Il carburante conta le chiamate delle ultime 5 ore. Il limite all'inizio è una stima; quando un'IA si ferma davvero per limite raggiunto, KORTEX impara il numero giusto e la scritta diventa "imparato".<//>
      <//>
      <${Pannello} titolo=${`${I.statistiche} ULTIMI 14 GIORNI`} nota="richieste al giorno" flexGrow=${1} height=${hSotto}>
        ${graficoAlto(giorni.flatMap((g) => Array(larghezzaColonna).fill(g[1])), giorni.length * larghezzaColonna, altezzaBarre, maxG).map((r, i) => html`<${Text} key=${i} color=${C.ciano}>${r}<//>`)}
        <${Text} color=${C.grigio}>${giorni.map((g) => g[0].slice(8, 10).padEnd(larghezzaColonna)).join('')}<//>
        <${Text} color=${C.grigio}>oggi ${giorni[13][1]} · questa settimana ${giorni.slice(7).reduce((a, g) => a + g[1], 0)} · massimo ${maxG}<//>
      <//>
    <//>
  <//>`;
}

// ---------- le finestre sopra a tutto: il giro guidato e le novità ----------

import fs from 'node:fs';
import stringWidth from 'string-width';
import { RADICE } from './config.js';

export const TUTORIAL = [
  ['Benvenuto in KORTEX', ['KORTEX fa lavorare insieme più intelligenze artificiali sullo stesso progetto,', 'usando i tuoi abbonamenti: niente chiavi API, niente costi a consumo.', '', 'In 6 passi ti mostro dove sono le cose. Ci vuole un minuto.']],
  ['Scrivi cosa vuoi fare', ['In basso a destra c\'è la riga ›. Scrivi la richiesta e premi INVIO:', 'il DIRETTORE divide il lavoro, gli ESECUTORI lo fanno (anche in parallelo),', 'l\'OPERATORE lancia i comandi, il REVISORE controlla e fa correggere.', '', 'Mentre lavorano puoi già scrivere la richiesta dopo: si mette in coda.']],
  ['Le pagine', ['TAB (o un clic in alto) cambia pagina: LAVORO, PROGETTI, DATABASE,', 'CONTROLLO, STUDIO, STATISTICHE, GUIDA, STRUMENTI. ESC torna a LAVORO.', '', 'A sinistra in LAVORO c\'è un terminale vero: Ctrl+T ci sposta il cursore,', 'Ctrl+D cambia macchina (questo PC, i server SSH, Python, Node).']],
  ['Guardare il lavoro', ['A destra le schede (Ctrl+N): AGENTI mostra compiti, squadra e attività', 'in diretta; OUTPUT ha una bolla per ogni IA; DIFF ti fa rivedere i file', 'cambiati uno per uno: INVIO accetta, Ctrl+R riporta il file com\'era.']],
  ['Ctrl+P trova tutto', ['Ctrl+P apre la tavolozza dei comandi: scrivi due lettere e trovi pagine,', 'temi, profili (Programmatore, Minecraft, Studio, Creativo), progetti e', 'voci del database. Non serve ricordare i comandi.']],
  ['La barra in fondo', ['L\'ultima riga mostra modalità, ramo git, avanzamento e il CARBURANTE', 'di ogni abbonamento nelle ultime 5 ore: se scende, le riserve sono pronte.', '', 'La pagina GUIDA spiega tutto. Buon lavoro!   — ideato e forgiato da GASTY']],
];

function novita(versione) {
  try {
    const testo = fs.readFileSync(`${RADICE}/CHANGELOG.md`, 'utf8');
    const i = testo.indexOf(`## ${versione}`);
    if (i < 0) return ['Le novità di questa versione sono nel file CHANGELOG.md.'];
    const resto = testo.slice(i).split('\n').slice(1);
    const fine = resto.findIndex((r) => r.startsWith('## '));
    return resto.slice(0, fine < 0 ? undefined : fine).map((r) => r.replace(/^- /, '• ').replace(/\*\*/g, '')).filter((r, k, a) => r.trim() || (a[k - 1] || '').trim());
  } catch { return ['Le novità di questa versione sono nel file CHANGELOG.md.']; }
}

const pieno = (t, n) => { const s = String(t); const l = stringWidth(s); return l >= n ? s : s + ' '.repeat(n - l); };

export function Finestra({ finestra, larghezza, altezza, versione, azioni }) {
  const w = Math.min(84, larghezza - 6);
  const dentro = w - 4;
  let titolo, corpo, piede;
  if (finestra.tipo === 'tutorial') {
    const [t, righe] = TUTORIAL[finestra.passo];
    titolo = `${finestra.passo + 1}/${TUTORIAL.length}  ${t}`;
    corpo = righe;
    piede = `${TUTORIAL.map((_, i) => (i === finestra.passo ? '●' : '○')).join(' ')}     ← indietro · INVIO avanti · ESC salta`;
  } else {
    titolo = `Novità di KORTEX ${versione}`;
    corpo = avvolgiParole(novita(versione), dentro).slice(0, Math.max(4, altezza - 14));
    piede = 'INVIO o ESC per chiudere · /novita le riapre';
  }
  const righe = ['', ...avvolgiParole(corpo, dentro), ''];
  const h = righe.length + 4;
  return html`<${Box} position="absolute" marginTop=${Math.max(1, Math.floor((altezza - h) / 2))} marginLeft=${Math.max(0, Math.floor((larghezza - w) / 2))} width=${w} height=${h} flexDirection="column" borderStyle="double" borderColor=${C.rosa}>
    <${Cliccabile} azione=${azioni.avanti}><${Text} color="#000000" backgroundColor=${C.rosa} bold>${pieno(` ${I.stella} ${titolo}`, w - 2)}<//><//>
    ${righe.map((r, i) => html`<${Text} key=${i} color=${C.gesso}>${pieno(' ' + r, w - 2)}<//>`)}
    <${Cliccabile} azione=${azioni.chiudi}><${Text} color=${C.grigio}>${pieno(' ' + piede, w - 2)}<//><//>
  <//>`;
}

// ---------- STRUMENTI: i programmi esterni che le IA sanno comandare ----------
// A sinistra una griglia di tessere (una per strumento, col colore del suo stato); a destra la scheda
// completa dello strumento scelto, con i pulsanti e le ultime azioni.

const WT = 30; // larghezza di una tessera
const HT = 6; // altezza di una tessera
export const larghezzaGriglia = (w) => Math.max(WT + 4, Math.min(Math.floor(w * 0.56), w - 44));
export const colonneStrumenti = (w) => Math.max(1, Math.floor((larghezzaGriglia(w) - 4) / (WT + 1)));

const oraBreve = (t) => new Date(t).toTimeString().slice(0, 5);

// lo stato di uno strumento in parole e colore
export function statoStrumento(s) {
  if (s.problemi?.length) return { testo: `${I.avviso} da configurare`, col: C.giallo };
  if (s.acceso === true) return { testo: '■ acceso', col: C.verde };
  if (s.acceso === false) return { testo: '□ spento', col: C.grigio };
  return { testo: '◇ sempre pronto', col: C.ciano };
}
const COLORE_PERMESSI = { libero: C.verde, conferma: C.giallo, lettura: C.ciano };

function TesseraStrumento({ s, scelto, azione }) {
  const st = statoStrumento(s);
  const dentro = WT - 4;
  const testa = `${s.icona} ${s.nome.toUpperCase()}`;
  const tasto = s.tasto ? `alt+${s.tasto}` : '';
  const ultima = s.usi?.ultime?.[0];
  const spenta = s.altroProgetto;
  return html`<${Cliccabile} azione=${azione} width=${WT} height=${HT} marginRight=${1} flexShrink=${0}>
    <${Box} flexDirection="column" width=${WT} height=${HT} borderStyle=${scelto ? 'double' : 'round'} borderColor=${scelto ? C.rosa : spenta ? C.scuro : st.col} paddingX=${1}>
      <${Text} wrap="truncate-end"><${Text} color=${spenta ? C.grigio : scelto ? C.rosa : C.gesso} bold>${testa.slice(0, dentro - tasto.length - 1).padEnd(dentro - tasto.length)}<//><${Text} color=${C.grigio}>${tasto}<//><//>
      <${Text} color=${st.col} wrap="truncate-end">${st.testo}${s.stato?.tipo === 'porta' ? html`<${Text} color=${C.scuro}> · porta ${s.stato.porta}<//>` : ''}<//>
      <${Text} color=${spenta ? C.scuro : C.gesso} wrap="truncate-end">${spenta ? 'per altri progetti' : `${s.usi?.oggi || 0} ${s.usi?.oggi === 1 ? 'uso' : 'usi'} oggi`}<//>
      <${Text} color=${C.grigio} wrap="truncate-end">${ultima ? `${oraBreve(ultima.t)} ${ultima.cosa || ultima.chi}` : 'mai usato'}<//>
    <//>
  <//>`;
}

export function PaginaStrumenti({ h, w, lista, sel, progetto, tick, azioni }) {
  const wG = larghezzaGriglia(w);
  const col = colonneStrumenti(w);
  const s = lista[sel];
  const righeGriglia = [];
  for (let i = 0; i < lista.length; i += col) righeGriglia.push(lista.slice(i, i + col).map((x, k) => ({ x, i: i + k })));
  const visibili = Math.max(1, Math.floor((h - 3) / HT));
  const rigaSel = Math.floor(sel / col);
  const primaRiga = Math.max(0, Math.min(righeGriglia.length - visibili, rigaSel - visibili + 1));
  const accesi = lista.filter((x) => x.acceso === true).length;
  const Pulsante = ({ testo, colore, azione }) => html`<${Box} marginRight=${1}><${Cliccabile} azione=${azione}><${Text} color="#000000" backgroundColor=${colore} bold> ${testo} <//><//><//>`;
  const wD = w - wG - 2;
  const st = s ? statoStrumento(s) : null;
  const contesto = s ? avvolgiParole(String(s.contesto || '').split('\n'), Math.max(10, wD - 4)) : [];
  const ultime = s?.usi?.ultime || [];
  // quante righe restano per contesto e azioni, così il pannello non sfora mai
  const fisse = 14 + (s?.problemi?.length ? s.problemi.length + 2 : 0);
  const spazio = Math.max(2, h - 2 - fisse);
  const nCont = Math.min(contesto.length, Math.max(1, Math.floor(spazio / 2)));
  const nUlt = Math.max(1, spazio - nCont - 2);
  return html`<${Box} height=${h}>
    <${Pannello} titolo=${`${I.strumenti} STRUMENTI`} nota=${`${accesi}/${lista.length} accesi · ←→↑↓ scegli · Alt+lettera da ogni pagina`} width=${wG} height=${h} flexShrink=${0} colore=${C.viola}>
      ${lista.length === 0
        ? html`<${Neuroni} w=${wG - 4} h=${Math.max(2, h - 3)} tick=${tick} testo="nessuno strumento: le schede stanno in ~/.config/kortex/strumenti" />`
        : righeGriglia.slice(primaRiga, primaRiga + visibili).map((r, k) => html`<${Box} key=${k} height=${HT}>${r.map(({ x, i }) => html`<${TesseraStrumento} key=${x.id} s=${x} scelto=${i === sel} azione=${() => azioni?.strumento(i)} />`)}<//>`)}
    <//>
    <${Pannello} titolo=${s ? `${s.icona} ${s.nome.toUpperCase()}` : 'SCHEDA'} nota=${s ? `@${s.id}${progetto ? ' · progetto ' + progetto : ''}` : ''} colore=${st ? st.col : C.ciano} flexGrow=${1} height=${h}>
      ${!s ? html`<${Text} color=${C.grigio}>scegli uno strumento<//>` : html`<${Box} flexDirection="column">
        <${Text} color=${C.gesso} wrap="truncate-end">${s.descrizione || '—'}<//>
        <${Text}> <//>
        <${Text} wrap="truncate-end"><${Text} color=${C.grigio}>stato      <//><${Text} color=${st.col} bold>${st.testo}<//><${Text} color=${C.scuro}>${s.stato?.tipo === 'porta' ? `  porta ${s.stato.porta} su ${s.stato.host || 'localhost'}` : ''}<//><//>
        <${Text} wrap="truncate-end"><${Text} color=${C.grigio}>permessi   <//><${Text} color=${COLORE_PERMESSI[s.permessi] || C.gesso}>${s.permessi}<//><${Text} color=${C.scuro}>${s.permessi === 'lettura' ? '  le IA possono solo guardare' : s.permessi === 'libero' ? '  le IA lavorano senza chiedere' : '  le IA chiedono prima di cambiare'}<//><//>
        <${Text} wrap="truncate-end"><${Text} color=${C.grigio}>richiamo   <//><${Text} color=${C.ciano}>@${s.id}<//><${Text} color=${C.grigio}> nella richiesta${s.tasto ? ` · Alt+${s.tasto} apre questa scheda` : ''}<//><//>
        <${Text} wrap="truncate-end"><${Text} color=${C.grigio}>progetti   <//><${Text} color=${C.gesso}>${s.progetti?.length ? s.progetti.join(', ') : 'tutti'}<//><//>
        <${Text} wrap="truncate-end"><${Text} color=${C.grigio}>collegamento <//><${Text} color=${C.gesso}>${s.mcp?.command ? accorcia(`${s.mcp.command} ${(s.mcp.args || []).join(' ')}`, Math.max(10, wD - 18)) : 'nessuno (solo contesto)'}<//><//>
        <${Text} wrap="truncate-end"><${Text} color=${C.grigio}>scheda     <//><${Text} color=${C.scuro}>${accorcia(s.percorso || '', Math.max(10, wD - 16))}<//><//>
        ${s.problemi?.length ? html`<${Box} flexDirection="column">
          <${Text}> <//>
          <${Text} color=${C.giallo} bold>DA SISTEMARE<//>
          ${s.problemi.map((p, i) => html`<${Text} key=${i} color=${C.giallo} wrap="truncate-end">${I.avviso} ${p}<//>`)}
        <//>` : null}
        <${Text}> <//>
        <${Box} height=${1}>
          <${Pulsante} testo=${wD < 60 ? '▸ USA' : '▸ USA (INVIO)'} colore=${C.ciano} azione=${() => azioni?.usaStrumento(sel)} />
          ${s.avvia ? html`<${Pulsante} testo=${wD < 60 ? '▲ AVVIA' : '▲ AVVIA (Ctrl+A)'} colore=${C.verde} azione=${() => azioni?.avviaStrumento(sel)} />` : null}
          <${Pulsante} testo="⊙ CONTROLLA" colore=${C.viola} azione=${() => azioni?.controllaStrumenti()} />
        <//>
        <${Text}> <//>
        <${Text} color=${C.ciano} bold>COSA SANNO LE IA<//>
        ${contesto.length ? contesto.slice(0, nCont).map((r, i) => html`<${Text} key=${i} color=${C.gesso} wrap="truncate-end">${r || ' '}<//>`) : html`<${Text} color=${C.grigio}>niente di speciale<//>`}
        ${contesto.length > nCont ? html`<${Text} color=${C.scuro}>… (il resto nella scheda)<//>` : null}
        <${Text}> <//>
        <${Text} color=${C.ciano} bold>ULTIME AZIONI<//>
        ${ultime.length ? ultime.slice(0, nUlt).map((u, i) => html`<${Text} key=${i} wrap="truncate-end"><${Text} color=${C.grigio}>${oraBreve(u.t)} <//><${Text} color=${C.rosa}>${u.chi} <//><${Text} color=${C.gesso}>${u.cosa}<//><//>`) : html`<${Text} color=${C.grigio}>ancora niente: scrivi qui sotto cosa far fare a ${s.nome}<//>`}
      <//>`}
    <//>
  <//>`;
}
