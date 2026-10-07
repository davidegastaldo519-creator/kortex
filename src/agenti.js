import { Box, Text } from 'ink';
import { html, C, COLORE_IA, SPIN, accorcia } from './grafica.js';

const RUOLI = ['direttore', 'pianificatore', 'esecutore', 'revisore'];
const NOME_RUOLO = { direttore: 'Direttore', pianificatore: 'Pianificatore', esecutore: 'Esecutore', revisore: 'Revisore', chat: 'Chat' };
const durata = (c) => `${Math.max(1, Math.round(((c.fine || Date.now()) - c.inizio) / 1000))}s`;
const nomeIA = (disponibili, id) => disponibili[id]?.nome || id;

function esitoChiamata(c, tick) {
  if (!c.fine) return [SPIN[tick % SPIN.length], C.rosa];
  if (c.limitato) return ['⟳', C.giallo];
  return c.ok ? ['✔', C.verde] : ['✖', C.rosso];
}

// ---------- 1. L'albero: richiesta → compiti → ruoli → strumenti ----------

export function Albero({ tel, disponibili, tick, larghezza, altezza }) {
  const r = tel.richiesta;
  const righe = [];
  if (!r) {
    righe.push(html`<${Text} key="v" color=${C.grigio}>nessuna richiesta ancora: scrivi cosa vuoi fare nella riga › a destra<//>`);
  } else {
    const chiamate = tel.chiamate.filter((c) => c.richiesta === r.n);
    righe.push(html`<${Text} key="r" wrap="truncate-end"><${Text} color=${C.ciano} bold>▣ <//><${Text} color=${C.gesso}>${accorcia(r.testo, larghezza - 4)}<//><//>`);
    const rigaChiamata = (c, prefisso, ultimo) => {
      const [ic, col] = esitoChiamata(c, tick);
      righe.push(html`<${Text} key=${'c' + c.inizio + c.ia + c.ruolo} wrap="truncate-end">
        <${Text} color=${C.scuro}>${prefisso}${ultimo ? '└─ ' : '├─ '}<//>
        <${Text} color=${col}>${ic} <//>
        <${Text} color=${C.gesso}>${(NOME_RUOLO[c.ruolo] || c.ruolo).padEnd(14)}<//>
        <${Text} color=${COLORE_IA[c.ia] || C.grigio} bold>${nomeIA(disponibili, c.ia).padEnd(8)}<//>
        <${Text} color=${C.grigio}>${durata(c)}<//>
      <//>`);
      const sotto = prefisso + (ultimo ? '   ' : '│  ');
      c.strumenti.slice(-4).forEach((s, k, arr) => {
        righe.push(html`<${Text} key=${'s' + c.inizio + k} wrap="truncate-end"><${Text} color=${C.scuro}>${sotto}${k === arr.length - 1 ? '└─ ' : '├─ '}<//><${Text} color=${C.viola}>▸ <//><${Text} color=${C.grigio}>${accorcia(s, larghezza - sotto.length - 6)}<//><//>`);
      });
    };
    const direttore = chiamate.filter((c) => c.ruolo === 'direttore');
    direttore.forEach((c) => rigaChiamata(c, '', r.compiti.length === 0));
    r.compiti.forEach((comp, i) => {
      const ultimo = i === r.compiti.length - 1;
      const stato = { attesa: ['○', C.grigio], lavoro: [SPIN[tick % SPIN.length], C.rosa], ok: ['✔', C.verde], avviso: ['⚠', C.giallo], errore: ['✖', C.rosso] }[comp.stato] || ['○', C.grigio];
      righe.push(html`<${Text} key=${'k' + i} wrap="truncate-end"><${Text} color=${C.scuro}>${ultimo ? '└─ ' : '├─ '}<//><${Text} color=${stato[1]}>${stato[0]} <//><${Text} color=${C.ciano} bold>${i + 1}. ${accorcia(comp.titolo, larghezza - 10)}<//><//>`);
      const mie = chiamate.filter((c) => c.compito === i);
      mie.forEach((c, k) => rigaChiamata(c, ultimo ? '   ' : '│  ', k === mie.length - 1));
    });
  }
  return html`<${Box} flexDirection="column" height=${altezza} overflow="hidden">${righe.slice(-altezza)}<//>`;
}

// ---------- 2. La mappa a nodi: i ruoli in fila, le IA sotto, i collegamenti che si accendono ----------

export function Mappa({ tel, ruoli, disponibili, tick, larghezza }) {
  const stretta = larghezza < 70;
  const larg = stretta ? 11 : 15;
  const nodo = (id) => {
    const r = ruoli[id];
    const nome = (stretta ? id.slice(0, 7) : id).toUpperCase();
    const col = r.stato === 'lavoro' ? C.rosa : r.stato === 'ok' ? C.verde : r.stato === 'errore' ? C.rosso : r.stato === 'saltato' ? C.scuro : C.grigio;
    const lampeggia = r.stato === 'lavoro' && tick % 2 === 0;
    return { nome: (lampeggia ? '▶' : '▪') + ' ' + nome, col, ia: r.ia };
  };
  const nodi = RUOLI.map(nodo);
  const attivo = RUOLI.findIndex((id) => ruoli[id].stato === 'lavoro');
  const freccia = (i) => {
    // il collegamento verso il ruolo attivo pulsa: i segmenti scorrono
    const vivo = attivo === i + 1 || (attivo < 0 && ruoli[RUOLI[i + 1]]?.stato === 'ok');
    const base = '─'.repeat(3);
    if (!vivo) return html`<${Text} color=${C.scuro}>${base}▶<//>`;
    const pos = tick % 3;
    const seg = [...base].map((ch, k) => (k === pos ? '═' : ch)).join('');
    return html`<${Text} color=${C.ciano}>${seg}▶<//>`;
  };
  const riga1 = nodi.map((n, i) => html`<${Text} key=${i}><${Text} color=${n.col} bold>${n.nome.padEnd(larg)}<//>${i < 3 ? freccia(i) : ''}<//>`);
  const riga2 = nodi.map((n, i) => {
    const vivo = RUOLI[i] === RUOLI[attivo];
    return html`<${Text} key=${i}><${Text} color=${vivo ? C.rosa : C.scuro}>${(vivo ? (tick % 2 ? '  ▼' : '  │') : '  │').padEnd(larg + (i < 3 ? 4 : 0))}<//><//>`;
  });
  const riga3 = nodi.map((n, i) => html`<${Text} key=${i}><${Text} color=${n.ia ? COLORE_IA[n.ia] : C.scuro} bold=${!!n.ia}>${('  ' + (n.ia ? nomeIA(disponibili, n.ia) : '—')).padEnd(larg + (i < 3 ? 4 : 0))}<//><//>`);
  return html`<${Box} flexDirection="column">
    <${Text}>${riga1}<//>
    <${Text}>${riga2}<//>
    <${Text}>${riga3}<//>
  <//>`;
}

// ---------- 3. La linea del tempo: una corsia per IA ----------

// Raggruppa le celle dello stesso colore: pochi elementi da disegnare invece di cento.
function tratti(celle) {
  const out = [];
  for (let x = 0; x < celle.length; x++) {
    const c = celle[x];
    const col = c ? c.col : C.scuro;
    const ch = c ? (c.aperto && x === celle.length - 1 ? '▶' : '█') : '·';
    const ultimo = out[out.length - 1];
    if (ultimo && ultimo.col === col) ultimo.testo += ch;
    else out.push({ col, testo: ch });
  }
  return out;
}

export function LineaDelTempo({ tel, disponibili, larghezza, secondi = 180 }) {
  const ora = Date.now();
  const larg = Math.max(10, larghezza - 10);
  const inizioFinestra = ora - secondi * 1000;
  const scala = larg / (secondi * 1000);
  const colonna = (t) => Math.max(0, Math.min(larg - 1, Math.floor((t - inizioFinestra) * scala)));
  const colRuolo = { direttore: C.ciano, pianificatore: C.viola, esecutore: C.rosa, revisore: C.giallo, chat: C.gesso };
  const corsie = Object.values(disponibili).map((d) => {
    const celle = Array(larg).fill(null);
    for (const c of tel.chiamate) {
      if (c.ia !== d.id || (c.fine && c.fine < inizioFinestra)) continue;
      const a = colonna(c.inizio);
      const b = colonna(c.fine || ora);
      for (let x = a; x <= b; x++) celle[x] = { col: c.ok === false ? C.rosso : colRuolo[c.ruolo] || C.gesso, aperto: !c.fine };
    }
    return { d, celle };
  });
  const asse = ('-' + secondi + 's').padEnd(larg - 4) + 'ora';
  return html`<${Box} flexDirection="column">
    ${corsie.map(({ d, celle }) => html`<${Text} key=${d.id}>
      <${Text} color=${d.ok ? COLORE_IA[d.id] : C.scuro} bold>${d.nome.padEnd(8)}<//>
      ${tratti(celle).map((t, k) => html`<${Text} key=${k} color=${t.col}>${t.testo}<//>`)}
    <//>`)}
    <${Text} color=${C.grigio}>${'        '}${asse}<//>
    <${Text} color=${C.grigio}>${'        '}<${Text} color=${C.ciano}>█<//> direttore  <${Text} color=${C.viola}>█<//> pianificatore  <${Text} color=${C.rosa}>█<//> esecutore  <${Text} color=${C.giallo}>█<//> revisore  <${Text} color=${C.rosso}>█<//> errore<//>
  <//>`;
}
