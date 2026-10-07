import { Box, Text } from 'ink';
import path from 'node:path';
import { html, C, COLORE_IA, SPIN, Pannello, Barra, Cervello, statoCervello, avvolgi, accorcia } from './grafica.js';
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

// ---------- LAVORO ----------

export function PaginaLavoro({ h, w, righe, scorri, log, ruoli, disponibili, compiti, file, tick, massimi, tel }) {
  const mostraSx = w >= 80;
  const mostraDx = w >= 120;
  const wSx = 28;
  const wDx = 34;
  const hLog = 6;
  const hSopra = h - hLog;
  const wCentro = w - (mostraSx ? wSx : 0) - (mostraDx ? wDx : 0);
  const spin = SPIN[tick % SPIN.length];
  const tutte = avvolgi(righe, Math.max(10, wCentro - 4));
  const spazio = Math.max(1, hSopra - 3);
  massimi.lavoro = Math.max(0, tutte.length - spazio);
  const visibili = finestraBasso(tutte, spazio, scorri);
  const icona = (s) => (s === 'lavoro' ? [spin, C.rosa] : s === 'ok' ? ['●', C.verde] : s === 'errore' ? ['✖', C.rosso] : s === 'saltato' ? ['–', C.scuro] : ['○', C.grigio]);
  const iconaCompito = { attesa: ['○', C.grigio], lavoro: [spin, C.rosa], ok: ['✔', C.verde], avviso: ['⚠', C.giallo], errore: ['✖', C.rosso] };
  const testoIA = (d) => (!d.ok ? 'non collegata' : d.limitato ? 'al limite' : tel.ia[d.id]?.attivo ? `pensa · ${tel.ia[d.id].attivo}` : 'pronta');

  return html`<${Box} flexDirection="column" height=${h}>
    <${Box} height=${hSopra}>
      ${mostraSx && html`<${Pannello} titolo="SQUADRA" width=${wSx} height=${hSopra}>
        ${RUOLI.map(([id, nome]) => {
          const [ic, col] = icona(ruoli[id].stato);
          const ia = ruoli[id].ia;
          return html`<${Text} key=${id} wrap="truncate-end"><${Text} color=${col}>${ic}<//> ${nome.padEnd(14)}<${Text} color=${ia ? COLORE_IA[ia] : C.grigio}>${ruoli[id].stato === 'saltato' ? 'spento' : ia ? disponibili[ia]?.nome : '—'}<//><//>`;
        })}
        <${Text}> <//>
        ${Object.values(disponibili).map((d) => html`<${Box} key=${d.id}>
          <${Cervello} id=${d.id} stato=${statoCervello(d, tel)} tick=${tick} />
          <${Box} flexDirection="column">
            <${Text} color=${d.ok ? COLORE_IA[d.id] : C.grigio} bold>${d.nome}<//>
            <${Text} color=${d.limitato ? C.rosso : tel.ia[d.id]?.attivo ? C.rosa : C.grigio}>${testoIA(d)}<//>
          <//>
        <//>`)}
      <//>`}
      <${Pannello} titolo="OUTPUT" nota=${scorri > 0 ? `↑ ${scorri} righe più indietro — FRECCIA GIÙ per tornare in fondo` : ''} flexGrow=${1} height=${hSopra}>
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
    <${Pannello} titolo="LOG" nota="il registro completo è nella pagina TERMINALE" colore=${C.scuro} coloreTitolo=${C.grigio} height=${hLog}>
      ${log.slice(-(hLog - 3)).map((l, i) => html`<${Text} key=${i} color=${C.grigio} wrap="truncate-end">${l.ora}  ${l.testo}<//>`)}
    <//>
  <//>`;
}

// ---------- TERMINALE: registro professionale + shell vera ----------

export const FILTRI = [['tutti', 'TUTTI'], ['claude', 'Claude'], ['codex', 'Codex'], ['gemini', 'Gemini'], ['ollama', 'Ollama'], ['errori', 'ERRORI']];
const ICONA_EVENTO = {
  avvio: ['▶', C.ciano], strumento: ['▸', C.viola], fine: ['✔', C.verde], errore: ['✖', C.rosso],
  riserva: ['⟳', C.giallo], avviso: ['⚠', C.giallo], info: ['·', C.grigio],
};
const pulisci = (t) => t.replace(/^\s*[▶▸✖✔⚠⟳]\s*/, '').replace(/^(Claude|Codex|Gemini|Ollama)\s*(:|→)\s*/, '');

export function PaginaTerminale({ h, w, log, filtro, fuoco, scorriLog, shell, scorriShell, inCorso, cwdShell, massimi }) {
  const hReg = Math.max(6, Math.floor(h * 0.45));
  const hSh = h - hReg;
  const filtrati = log.filter((l) => filtro === 'tutti' || (filtro === 'errori' ? l.tipo === 'errore' || l.tipo === 'riserva' : l.ia === filtro));
  const spazioReg = Math.max(1, hReg - 5);
  massimi.registro = Math.max(0, filtrati.length - spazioReg);
  const vReg = finestraBasso(filtrati, spazioReg, scorriLog);

  const larg = Math.max(10, w - 4);
  const righeShell = [];
  for (const e of shell) for (const r of avvolgi([e.t], larg)) righeShell.push({ t: r, tipo: e.tipo });
  const spazioSh = Math.max(1, hSh - 3);
  massimi.shell = Math.max(0, righeShell.length - spazioSh);
  const vSh = finestraBasso(righeShell, spazioSh, scorriShell);
  const coloreShell = { cmd: C.ciano, err: '#FF7A90', info: C.giallo, out: C.gesso };
  const casa = process.env.HOME || '';
  const dove = cwdShell.startsWith(casa) ? '~' + cwdShell.slice(casa.length) : cwdShell;

  return html`<${Box} flexDirection="column" height=${h}>
    <${Pannello} titolo="REGISTRO" nota=${`${filtrati.length} eventi${scorriLog ? ` · ↑ ${scorriLog} più indietro` : ''}`} colore=${fuoco === 'registro' ? C.rosa : C.viola} height=${hReg}>
      <${Box} flexShrink=${0} height=${1}>
        <${Text} color=${C.grigio}>filtro  <//>
        ${FILTRI.map(([id, nome]) => html`<${Text} key=${id} color=${id === filtro ? '#000000' : COLORE_IA[id] || C.grigio} backgroundColor=${id === filtro ? C.ciano : undefined} bold=${id === filtro}> ${nome} <//>`)}
        <${Box} flexGrow=${1} />
        ${w >= 140 ? html`<${Text} color=${C.grigio}>Ctrl+F filtro · Ctrl+L sposta il fuoco · PAG SU/GIÙ scorre<//>` : null}
      <//>
      <${Text} color=${C.scuro} wrap="truncate-end">${'─'.repeat(Math.max(10, w - 6))}<//>
      ${vReg.length === 0 ? html`<${Text} color=${C.grigio}>nessun evento ancora: fai lavorare la squadra dalla pagina LAVORO<//>` : null}
      ${vReg.map((l, i) => {
        const [ic, col] = ICONA_EVENTO[l.tipo] || ICONA_EVENTO.info;
        return html`<${Text} key=${i} wrap="truncate-end">
          <${Text} color=${C.grigio}>${l.ora}  <//>
          <${Text} color=${l.ia ? COLORE_IA[l.ia] : C.grigio} bold>${(l.ia ? l.ia.toUpperCase() : 'KORTEX').padEnd(8)}<//>
          <${Text} color=${C.grigio}>${(l.ruolo || '').padEnd(14)}<//>
          <${Text} color=${col}>${ic}  <//>
          <${Text} color=${l.tipo === 'errore' ? '#FF7A90' : C.gesso}>${pulisci(l.testo)}<//>
        <//>`;
      })}
    <//>
    <${Pannello} titolo="SHELL" nota=${`${dove}  ·  comandi veri del sistema${inCorso ? ' · Ctrl+C ferma il comando' : ''}${scorriShell ? ` · ↑ ${scorriShell} più indietro` : ''}`} colore=${fuoco === 'shell' ? C.rosa : C.viola} height=${hSh}>
      ${vSh.length === 0 ? html`<${Text} color=${C.grigio}>scrivi un comando nella barra in basso e premi INVIO — ↑↓ richiamano i comandi precedenti<//>` : null}
      ${vSh.map((r, i) => html`<${Text} key=${i} color=${coloreShell[r.tipo]} bold=${r.tipo === 'cmd'} wrap="truncate-end">${r.t || ' '}<//>`)}
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
