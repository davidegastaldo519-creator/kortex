import { Box, Text } from 'ink';
import path from 'node:path';
import { html, C, COLORE_IA, SPIN, Pannello, Barra, Cervello, statoCervello, avvolgi, accorcia } from './grafica.js';
import { Albero, Mappa, LineaDelTempo } from './agenti.js';
import { campiona, hex, rgbHex } from './splash.js';
import { graficoAlto } from './telemetria.js';
import { PARAMETRI, MAPPATURE, testoValore, livello } from './parametri.js';
import { GUIDA } from './guida.js';
import { FILE_CONFIG } from './config.js';

export const RUOLI = [['direttore', 'Direttore'], ['pianificatore', 'Pianificatore'], ['esecutore', 'Esecutore'], ['revisore', 'Revisore']];

function coloreRiga(r) {
  if (r.startsWith('▌')) return C.ciano;
  if (r.startsWith('› ')) return C.rosa;
  if (r.includes('✖')) return C.rosso;
  if (r.trimStart().startsWith('✔')) return C.verde;
  if (r.trimStart().startsWith('⚠')) return C.giallo;
  return undefined;
}

// La finestra visibile di un elenco lungo, ancorata in basso (offset = righe dal fondo).
function finestraBasso(righe, spazio, offset) {
  const fine = Math.max(0, righe.length - offset);
  return righe.slice(Math.max(0, fine - spazio), fine);
}

// ---------- barra allegati e selettore ----------

export function BarraAllegati({ allegati, larghezza }) {
  if (!allegati.length) return null;
  return html`<${Box} paddingX=${1} height=${1}>
    <${Text} color=${C.giallo} bold>📎 ${allegati.length} allegat${allegati.length === 1 ? 'o' : 'i'}  <//>
    <${Text} wrap="truncate-end">${allegati.map((a, i) => html`<${Text} key=${i}><${Text} color=${C.grigio}>${i + 1}<//> <${Text} color=${C.gesso}>${accorcia(path.basename(a), 28)}<//>   <//>`)}<//>
    <${Box} flexGrow=${1} />
    <${Text} color=${C.grigio}>/togli N · /togli tutti<//>
  <//>`;
}

export function PaginaSelettore({ h, w, elenco, query, sel }) {
  const spazio = Math.max(1, h - 4);
  const primo = Math.max(0, Math.min(elenco.length - spazio, sel - Math.floor(spazio / 2)));
  return html`<${Pannello} titolo="ALLEGA UN FILE" nota=${`scrivi per cercare · ↑↓ scegli · INVIO allega · ESC chiudi   (${elenco.length} file trovati)`} colore=${C.giallo} coloreTitolo=${C.giallo} height=${h}>
    <${Text} color=${C.grigio}>cerco: <${Text} color=${C.gesso} bold>${query || '(tutto)'}<//><//>
    ${elenco.length === 0 ? html`<${Text} color=${C.grigio}>nessun file corrisponde<//>` : null}
    ${elenco.slice(primo, primo + spazio).map((f, k) => {
      const i = primo + k;
      const scelto = i === sel;
      return html`<${Text} key=${f} wrap="truncate-end">
        <${Text} color=${scelto ? C.rosa : C.grigio}>${scelto ? '▶ ' : '  '}<//>
        <${Text} color=${scelto ? '#FFFFFF' : C.gesso} bold=${scelto}>${path.basename(f)}<//>
        <${Text} color=${C.grigio}>   ${accorcia(path.dirname(f), Math.max(10, w - 50))}<//>
      <//>`;
    })}
  <//>`;
}

// ---------- LAVORO: terminale a sinistra, schede a destra ----------

export const SCHEDE = [['agenti', 'AGENTI'], ['output', 'OUTPUT'], ['registro', 'REGISTRO'], ['file', 'FILE']];
export const FILTRI = [['tutti', 'TUTTI'], ['claude', 'Claude'], ['codex', 'Codex'], ['gemini', 'Gemini'], ['ollama', 'Ollama'], ['errori', 'ERRORI']];
const ICONA_EVENTO = {
  avvio: ['▶', C.ciano], strumento: ['▸', C.viola], fine: ['✔', C.verde], errore: ['✖', C.rosso],
  riserva: ['⟳', C.giallo], avviso: ['⚠', C.giallo], info: ['·', C.grigio],
};
const pulisci = (t) => t.replace(/^\s*[▶▸✖✔⚠⟳]\s*/, '').replace(/^(Claude|Codex|Gemini|Ollama)\s*(:|→)\s*/, '');

function Terminale({ h, w, destinazioni, dest, sessione, scorri, fuoco, inCorso, massimi }) {
  const righe = [];
  for (const e of sessione.righe) for (const r of avvolgi([e.t], Math.max(10, w - 4))) righe.push({ t: r, tipo: e.tipo });
  const spazio = Math.max(1, h - 5);
  massimi.shell = Math.max(0, righe.length - spazio);
  const vis = finestraBasso(righe, spazio, scorri);
  const colore = { cmd: C.ciano, err: '#FF7A90', info: C.giallo, out: C.gesso };
  const casa = process.env.HOME || '';
  const dove = sessione.cwd ? (sessione.cwd.startsWith(casa) ? '~' + sessione.cwd.slice(casa.length) : sessione.cwd) : 'console';
  const colDest = (d) => (d.tipo === 'locale' ? C.verde : d.tipo === 'ssh' ? C.ciano : C.viola);
  return html`<${Pannello} titolo="TERMINALE" nota=${`${dest.nome}${dest.host ? '  ' + dest.host : ''}${inCorso ? '  · in corso, Ctrl+C ferma' : ''}`} colore=${fuoco === 'shell' ? C.rosa : C.viola} height=${h} width=${w} flexShrink=${0}>
    <${Box} height=${1} flexShrink=${0}>
      <${Text} color=${C.grigio}>dove  <//>
      <${Text} wrap="truncate-end">${destinazioni.map((d) => html`<${Text} key=${d.id} color=${d.id === dest.id ? '#000000' : colDest(d)} backgroundColor=${d.id === dest.id ? colDest(d) : undefined} bold=${d.id === dest.id}> ${d.breve || d.nome} <//>`)}<//>
    <//>
    <${Text} color=${C.grigio} wrap="truncate-end">${sessione.collegata === false ? '✖ non collegata  ' : ''}${dove}   <${Text} color=${C.scuro}>Ctrl+D cambia macchina · /dest aggiungi nome utente@host<//><//>
    ${vis.length === 0 ? html`<${Text} color=${C.grigio}>scrivi un comando nella riga $ e premi INVIO · ↑↓ richiamano i comandi precedenti<//>` : null}
    ${vis.map((r, i) => html`<${Text} key=${i} color=${colore[r.tipo]} bold=${r.tipo === 'cmd'} wrap="truncate-end">${r.t || ' '}<//>`)}
  <//>`;
}

function SchedaAgenti({ h, w, tel, ruoli, disponibili, tick }) {
  const nIA = Object.keys(disponibili).length;
  const hLinea = nIA + 4;
  const hMappa = 4;
  const hAlbero = Math.max(3, h - hLinea - hMappa - 3);
  return html`<${Box} flexDirection="column" height=${h} overflow="hidden">
    <${Text} color=${C.ciano} bold>ALBERO DEL LAVORO<//>
    <${Albero} tel=${tel} disponibili=${disponibili} tick=${tick} larghezza=${w} altezza=${hAlbero} />
    <${Text} color=${C.ciano} bold>MAPPA DEI RUOLI<//>
    <${Mappa} tel=${tel} ruoli=${ruoli} disponibili=${disponibili} tick=${tick} larghezza=${w} />
    <${Text} color=${C.ciano} bold>LINEA DEL TEMPO<//>
    <${LineaDelTempo} tel=${tel} disponibili=${disponibili} larghezza=${w} />
  <//>`;
}

function SchedaRegistro({ h, w, log, filtro, scorri, massimi }) {
  const filtrati = log.filter((l) => filtro === 'tutti' || (filtro === 'errori' ? l.tipo === 'errore' || l.tipo === 'riserva' : l.ia === filtro));
  const spazio = Math.max(1, h - 2);
  massimi.registro = Math.max(0, filtrati.length - spazio);
  const vis = finestraBasso(filtrati, spazio, scorri);
  return html`<${Box} flexDirection="column" height=${h} overflow="hidden">
    <${Text} wrap="truncate-end">
      <${Text} color=${C.grigio}>filtro <//>
      ${FILTRI.map(([id, nome]) => html`<${Text} key=${id} color=${id === filtro ? '#000000' : COLORE_IA[id] || C.grigio} backgroundColor=${id === filtro ? C.ciano : undefined} bold=${id === filtro}> ${nome} <//>`)}
      <${Text} color=${C.scuro}>  Ctrl+F · ${filtrati.length} eventi<//>
    <//>
    ${vis.length === 0 ? html`<${Text} color=${C.grigio}>nessun evento ancora<//>` : null}
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

export function PaginaLavoro(p) {
  const { h, w, righe, scorri, log, ruoli, disponibili, compiti, file, tick, massimi, tel, scheda, fuoco, filtro } = p;
  const wTerm = Math.max(44, Math.floor(w * 0.44));
  const wDx = w - wTerm;
  const dentro = wDx - 4;
  const spin = SPIN[tick % SPIN.length];
  const iconaCompito = { attesa: ['○', C.grigio], lavoro: [spin, C.rosa], ok: ['✔', C.verde], avviso: ['⚠', C.giallo], errore: ['✖', C.rosso] };
  const testoIA = (d) => (!d.ok ? 'non collegata' : d.limitato ? 'al limite' : tel.ia[d.id]?.attivo ? `pensa · ${tel.ia[d.id].attivo}` : 'pronta');
  const hDentro = h - 4; // bordi + riga delle schede + riga delle IA
  const stretta = dentro < 96;

  let contenuto;
  if (scheda === 'output') {
    const tutte = avvolgi(righe, Math.max(10, dentro));
    massimi.lavoro = Math.max(0, tutte.length - hDentro);
    const vis = finestraBasso(tutte, hDentro, scorri);
    contenuto = html`<${Box} flexDirection="column" height=${hDentro} overflow="hidden">
      ${scorri > 0 ? html`<${Text} color=${C.giallo}>↑ ${scorri} righe più indietro — FRECCIA GIÙ per tornare in fondo<//>` : null}
      ${vis.map((r, i) => html`<${Text} key=${i} color=${coloreRiga(r)} wrap="truncate-end">${r || ' '}<//>`)}
    <//>`;
  } else if (scheda === 'registro') {
    contenuto = html`<${SchedaRegistro} h=${hDentro} w=${dentro} log=${log} filtro=${filtro} scorri=${scorri} massimi=${massimi} />`;
  } else if (scheda === 'file') {
    contenuto = html`<${Box} flexDirection="column" height=${hDentro} overflow="hidden">
      <${Text} color=${C.ciano} bold>COMPITI<//>
      ${compiti.length ? compiti.map((c, i) => { const [ic, col] = iconaCompito[c.stato] || iconaCompito.attesa; return html`<${Text} key=${i} wrap="truncate-end"><${Text} color=${col}>${ic}<//> ${i + 1}. ${c.titolo}<//>`; }) : html`<${Text} color=${C.grigio}>nessun lavoro in corso<//>`}
      <${Text}> <//>
      <${Text} color=${C.ciano} bold>FILE CAMBIATI NEL PROGETTO<//>
      ${file.map((f, i) => html`<${Text} key=${i} wrap="truncate-end" color=${f.startsWith('??') ? C.verde : f.trimStart().startsWith('M') ? C.giallo : C.grigio}>${f}<//>`)}
    <//>`;
  } else {
    contenuto = html`<${SchedaAgenti} h=${hDentro} w=${dentro} tel=${tel} ruoli=${ruoli} disponibili=${disponibili} tick=${tick} />`;
  }

  return html`<${Box} height=${h}>
    <${Terminale} h=${h} w=${wTerm} destinazioni=${p.destinazioni} dest=${p.dest} sessione=${p.sessione} scorri=${p.scorriShell} fuoco=${fuoco} inCorso=${p.inCorso} massimi=${massimi} />
    <${Box} flexDirection="column" borderStyle="round" borderColor=${fuoco === 'ia' ? C.rosa : C.viola} paddingX=${1} height=${h} flexGrow=${1} overflow="hidden">
      <${Text} wrap="truncate-end">
        ${SCHEDE.map(([id, nome]) => html`<${Text} key=${id} color=${id === scheda ? '#000000' : C.grigio} backgroundColor=${id === scheda ? C.ciano : undefined} bold=${id === scheda}> ${stretta && id !== scheda ? nome.slice(0, 3) : nome} <//>`)}
        ${!stretta ? html`<${Text} color=${C.scuro}>  Ctrl+N cambia scheda   <//>` : html`<${Text}> <//>`}
        ${RUOLI.map(([id, nome]) => { const r = ruoli[id]; const col = r.stato === 'lavoro' ? C.rosa : r.stato === 'ok' ? C.verde : r.stato === 'errore' ? C.rosso : C.scuro; return html`<${Text} key=${id} color=${col}> ${r.stato === 'lavoro' ? spin : '●'}${stretta ? '' : ' ' + nome.slice(0, 4)}<//>`; })}
      <//>
      <${Text} wrap="truncate-end">
        ${Object.values(disponibili).map((d) => html`<${Text} key=${d.id}><${Cervello} id=${d.id} stato=${statoCervello(d, tel)} tick=${tick} compatto=${true} /><${Text} color=${d.ok ? COLORE_IA[d.id] : C.grigio} bold>${d.nome}<//>${!stretta ? html`<${Text} color=${d.limitato ? C.rosso : tel.ia[d.id]?.attivo ? C.rosa : C.scuro}> ${testoIA(d)}<//>` : null}<${Text}>   <//><//>`)}
      <//>
      ${contenuto}
    <//>
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

export function PaginaControllo({ h, w, config, selezionato, tel, disponibili, tick, messaggio }) {
  const compatto = h < 34 || w < 140;
  const wSx = compatto ? Math.min(58, Math.floor(w * 0.52)) : Math.min(64, Math.floor(w * 0.46));
  const wDx = w - wSx;
  const barra = Math.max(6, wSx - 44);
  const nIA = Object.keys(disponibili).length;
  const p = PARAMETRI[selezionato];
  const mappaAttiva = MAPPATURE.findIndex((m) => m.nome === config.mappa);
  const media = (s) => (s.ok + s.errori ? (s.secondi / (s.ok + s.errori)).toFixed(0) + 's' : '—');

  const hMap = compatto ? 0 : MAPPATURE.length + 3;
  const hPar = compatto ? Math.max(5, h - 7) : Math.min(PARAMETRI.length + 3, h - hMap - 6);
  const hInfo = h - hMap - hPar;
  const visibili = Math.min(PARAMETRI.length, hPar - 3);
  const primo = Math.max(0, Math.min(PARAMETRI.length - visibili, selezionato - Math.floor(visibili / 2)));

  const hConn = nIA * 2 + 3;
  const hNum = compatto ? 0 : nIA + 5;
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
      <${Pannello} titolo="CONNESSIONI" nota=${compatto ? '' : "il cervello si accende e l'impulso corre quando l'IA pensa"} height=${hConn} flexShrink=${0}>
        ${Object.values(disponibili).map((d) => html`<${Cavo} key=${d.id} d=${d} stato=${tel.ia[d.id]} tick=${tick} larghezza=${Math.max(4, wDx - 22)} />`)}
      <//>
      ${!compatto && html`<${Pannello} titolo="SQUADRA IN NUMERI" height=${hNum} flexShrink=${0}>
        <${Text} color=${C.grigio}>${'IA'.padEnd(9)}${'chiamate'.padStart(9)}${'riuscite'.padStart(10)}${'fallite'.padStart(9)}${'media'.padStart(8)}${'valore'.padStart(9)}<//>
        ${Object.values(disponibili).map((d) => {
          const s = tel.ia[d.id];
          return html`<${Text} key=${d.id} color=${d.ok ? C.gesso : C.scuro}><${Text} color=${d.ok ? COLORE_IA[d.id] : C.scuro}>${d.nome.padEnd(9)}<//>${String(s.chiamate).padStart(9)}${String(s.ok).padStart(10)}${String(s.errori).padStart(9)}${media(s).padStart(8)}${(s.valore ? '$' + s.valore.toFixed(2) : '—').padStart(9)}<//>`;
        })}
        <${Text} color=${C.grigio} wrap="truncate-end">Le modifiche si salvano da sole in ${accorcia(FILE_CONFIG, Math.max(20, wDx - 40))}<//>
      <//>`}
    <//>
  <//>`;
}

// ---------- STUDIO: la lavagna ----------

const FORMULE = ['Idea = (Claude + Codex + Gemini)²', 'E = mc²  →  IA = KORTEX²', 'piano + revisione ≥ fortuna', 'Δ codice / Δ t → ∞'];

export function PaginaStudio({ h, w, lavagna, appunti, scorri, tick, massimi }) {
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
  const spazio = Math.max(1, h - 4);
  massimi.studio = Math.max(0, righe.length - spazio);
  const inizio = Math.min(scorri, massimi.studio);
  return html`<${Pannello} titolo="LAVAGNA" nota=${righe.length > spazio ? `↑↓ scorri  (${inizio + 1}-${Math.min(righe.length, inizio + spazio)} di ${righe.length})` : ''} colore=${C.lavagna} coloreTitolo=${C.gesso} height=${h}>
    <${Text} color=${C.gesso} italic>  ${scritta}${scritta.length < formula.length ? '▌' : ''}<//>
    ${righe.slice(inizio, inizio + spazio).map((r, i) => html`<${Text} key=${i} wrap="truncate-end" color=${r.titolo ? C.giallo : C.gesso} bold=${!!r.titolo}>${r.t || ' '}<//>`)}
  <//>`;
}

// ---------- GUIDA ----------

export function PaginaGuida({ h, w, scorri, massimi }) {
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

// ---------- PROGETTI: i tuoi progetti, le loro chat, i punti di ripristino ----------

export function PaginaProgetti({ h, w, progetti, selezione, colonna, chat, istantanee, progettoAttuale, chatAttuale }) {
  const wSx = Math.min(56, Math.floor(w * 0.4));
  const quando = (iso) => (iso ? iso.slice(0, 16).replace('T', ' ') : '');
  const p = progetti[selezione.progetto];
  const spazioChat = Math.max(2, Math.floor((h - 4) * 0.55));
  const spazioIst = Math.max(2, h - 4 - spazioChat - 3);
  const primoC = Math.max(0, Math.min(chat.length - spazioChat, selezione.chat - Math.floor(spazioChat / 2)));
  return html`<${Box} height=${h}>
    <${Pannello} titolo="PROGETTI" nota=${`${progetti.length} · INVIO apre · scrivi un nome e INVIO per crearne uno`} colore=${colonna === 'progetti' ? C.rosa : C.viola} width=${wSx} height=${h} flexShrink=${0}>
      ${progetti.length === 0 ? html`<${Text} color=${C.grigio}>nessun progetto: scrivi un nome qui sotto e premi INVIO, oppure /progetto importa percorso<//>` : null}
      ${progetti.slice(0, h - 3).map((q, i) => {
        const sel = i === selezione.progetto;
        const aperto = q.percorso === progettoAttuale;
        return html`<${Box} key=${q.percorso} flexDirection="column">
          <${Text} wrap="truncate-end"><${Text} color=${sel ? C.rosa : C.grigio}>${sel ? '▶ ' : '  '}<//><${Text} color=${aperto ? C.ciano : C.gesso} bold=${sel || aperto}>${q.nome}<//><${Text} color=${C.grigio}>${aperto ? '  ● aperto' : ''}<//><//>
          <${Text} color=${C.grigio} wrap="truncate-end">    ${q.descrizione || accorcia(q.percorso, wSx - 8)}<//>
        <//>`;
      })}
    <//>
    <${Box} flexDirection="column" flexGrow=${1}>
      <${Pannello} titolo=${p ? 'CHAT DI ' + p.nome.toUpperCase() : 'CHAT'} nota=${chat.length ? `${chat.length} · INVIO apre · /chat nuova per iniziarne una` : ''} colore=${colonna === 'chat' ? C.rosa : C.viola} height=${spazioChat + 3} flexShrink=${0}>
        ${!p ? html`<${Text} color=${C.grigio}>scegli un progetto a sinistra<//>` : chat.length === 0 ? html`<${Text} color=${C.grigio}>nessuna chat ancora: apri il progetto e scrivi la prima richiesta, oppure /chat nuova<//>` : null}
        ${chat.slice(primoC, primoC + spazioChat).map((c, k) => {
          const i = primoC + k;
          const sel = colonna === 'chat' && i === selezione.chat;
          const aperta = c.id === chatAttuale;
          return html`<${Text} key=${c.id} wrap="truncate-end"><${Text} color=${sel ? C.rosa : C.grigio}>${sel ? '▶ ' : '  '}<//><${Text} color=${aperta ? C.ciano : C.gesso} bold=${sel || aperta}>${c.titolo}<//><${Text} color=${C.grigio}>   ${c.messaggi.length} messaggi · ${quando(c.ultimo)}${aperta ? ' · ● aperta' : ''}<//><//>`;
        })}
      <//>
      <${Pannello} titolo="PUNTI DI RIPRISTINO" nota=${istantanee.length ? '/ripristina ID riporta i file a quel momento' : ''} flexGrow=${1}>
        ${istantanee.length === 0 ? html`<${Text} color=${C.grigio}>ancora nessuno: KORTEX ne scatta uno prima e uno dopo ogni richiesta<//>` : null}
        ${istantanee.slice(0, spazioIst).map((i) => html`<${Text} key=${i.id} wrap="truncate-end"><${Text} color=${C.ciano}>${i.id}<//><${Text} color=${C.grigio}>  ${i.data}  <//><${Text} color=${C.gesso}>${i.etichetta}<//><//>`)}
      <//>
    <//>
  <//>`;
}

// ---------- DATABASE: la memoria di tutti i progetti ----------

import { CATEGORIE, percorsoAssoluto } from './database.js';
const COLORE_CAT = { manuali: '#FFB84D', codice: '#3DDC97', documenti: '#4D9FFF', immagini: '#FF6EC7', note: '#FFE66D', archivio: '#9A9AB0' };

export function PaginaDatabase({ h, w, voci, categoria, query, sel, conteggi, github, pronto }) {
  const wSx = 24;
  const wDx = Math.min(70, Math.floor(w * 0.38));
  const quando = (iso) => (iso ? iso.slice(0, 10) : '');
  const v = voci[sel];
  const spazio = Math.max(2, h - 4);
  const primo = Math.max(0, Math.min(voci.length - spazio, sel - Math.floor(spazio / 2)));
  const totale = Object.values(conteggi).reduce((a, b) => a + b, 0);
  return html`<${Box} height=${h}>
    <${Pannello} titolo="CATEGORIE" nota="←→" width=${wSx} height=${h} flexShrink=${0}>
      ${[['tutte', 'TUTTE', totale], ...CATEGORIE.map((c) => [c, c.toUpperCase(), conteggi[c] || 0])].map(([id, nome, n]) => html`<${Text} key=${id}><${Text} color=${id === categoria ? '#000000' : COLORE_CAT[id] || C.gesso} backgroundColor=${id === categoria ? COLORE_CAT[id] || C.ciano : undefined} bold=${id === categoria}> ${nome.padEnd(10)}<//><${Text} color=${C.grigio}> ${String(n).padStart(4)}<//><//>`)}
      <${Text}> <//>
      <${Text} color=${C.grigio}>GitHub<//>
      <${Text} color=${github ? C.verde : C.grigio} wrap="truncate-end">${github ? '● collegato' : '○ no: /db github'}<//>
      <${Text}> <//>
      <${Text} color=${C.grigio} wrap="truncate-end">${pronto ? 'catalogatore pronto' : 'catalogatore: nessuna IA'}<//>
    <//>
    <${Pannello} titolo=${categoria === 'tutte' ? 'TUTTE LE VOCI' : categoria.toUpperCase()} nota=${`${voci.length}${query ? ` · cerco "${query}"` : ''} · ↑↓ scegli · scrivi per cercare · trascina un file per aggiungerlo`} flexGrow=${1} height=${h}>
      ${voci.length === 0 ? html`<${Text} color=${C.grigio}>${query ? 'niente corrisponde' : 'vuoto: trascina qui un file, oppure /db nota testo, /db aggiungi percorso-o-url'}<//>` : null}
      ${voci.slice(primo, primo + spazio).map((x, k) => {
        const i = primo + k;
        const s = i === sel;
        return html`<${Text} key=${x.id} wrap="truncate-end"><${Text} color=${s ? C.rosa : C.grigio}>${s ? '▶ ' : '  '}<//><${Text} color=${COLORE_CAT[x.categoria]}>■ <//><${Text} color=${s ? '#FFFFFF' : C.gesso} bold=${s}>${x.titolo}<//><${Text} color=${C.grigio}>   ${x.tag.slice(0, 4).map((t) => '#' + t).join(' ')}  ${quando(x.aggiunto)}<//><//>`;
      })}
    <//>
    <${Pannello} titolo="SCHEDA" nota=${v ? `@${v.titolo.split(' ')[0].toLowerCase()} nella richiesta la usa` : ''} colore=${C.ciano} width=${wDx} height=${h} flexShrink=${0}>
      ${!v ? html`<${Text} color=${C.grigio}>scegli una voce<//>` : html`<${Box} flexDirection="column">
        <${Text} color=${COLORE_CAT[v.categoria]} bold wrap="truncate-end">${v.titolo}<//>
        <${Text} color=${C.grigio} wrap="truncate-end">${v.categoria} · ${v.tag.map((t) => '#' + t).join(' ') || 'nessun tag'} · ${v.catalogatoDa === 'ia' ? 'scheda scritta dall\'IA' : 'scheda automatica'}<//>
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
