import { Box, Text } from 'ink';
import { html, C, COLORE_IA, SPIN, accorcia } from './grafica.js';

const RUOLI = ['direttore', 'pianificatore', 'esecutore', 'operatore', 'revisore'];
const NOME_RUOLO = { direttore: 'Direttore', pianificatore: 'Pianificatore', esecutore: 'Esecutore', operatore: 'Operatore', revisore: 'Revisore', catalogatore: 'Catalogatore', memorista: 'Memorista', chat: 'Chat' };
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
      righe.push(html`<${Text} key=${'k' + i} wrap="truncate-end"><${Text} color=${C.scuro}>${ultimo ? '└─ ' : '├─ '}<//><${Text} color=${stato[1]}>${stato[0]} <//><${Text} color=${C.ciano} bold>${i + 1}. ${accorcia(comp.titolo, larghezza - 10)}<//>${comp.dipende?.length ? html`<${Text} color=${C.scuro}>  ← ${comp.dipende.join(',')}<//>` : ''}<//>`);
      const mie = chiamate.filter((c) => c.compito === i);
      mie.forEach((c, k) => rigaChiamata(c, ultimo ? '   ' : '│  ', k === mie.length - 1));
    });
  }
  return html`<${Box} flexDirection="column" height=${altezza} overflow="hidden">${righe.slice(-altezza)}<//>`;
}

// ---------- 2. La mappa a nodi: i ruoli in fila, le IA sotto, i collegamenti che si accendono ----------

export function Mappa({ tel, ruoli, disponibili, tick, larghezza }) {
  const stretta = larghezza < 86;
  const larg = stretta ? 10 : 14;
  const ultimo = RUOLI.length - 1;
  const nodo = (id) => {
    const r = ruoli[id] || { stato: 'attesa', ia: null };
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
  const riga1 = nodi.map((n, i) => html`<${Text} key=${i}><${Text} color=${n.col} bold>${n.nome.padEnd(larg)}<//>${i < ultimo ? freccia(i) : ''}<//>`);
  const riga2 = nodi.map((n, i) => {
    const vivo = RUOLI[i] === RUOLI[attivo];
    return html`<${Text} key=${i}><${Text} color=${vivo ? C.rosa : C.scuro}>${(vivo ? (tick % 2 ? '  ▼' : '  │') : '  │').padEnd(larg + (i < ultimo ? 4 : 0))}<//><//>`;
  });
  const riga3 = nodi.map((n, i) => html`<${Text} key=${i}><${Text} color=${n.ia ? COLORE_IA[n.ia] : C.scuro} bold=${!!n.ia}>${('  ' + (n.ia ? nomeIA(disponibili, n.ia) : '—')).padEnd(larg + (i < ultimo ? 4 : 0))}<//><//>`);
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
  const colRuolo = { direttore: C.ciano, pianificatore: C.viola, esecutore: C.rosa, operatore: '#FF9F1C', revisore: C.giallo, chat: C.gesso, catalogatore: C.grigio, memorista: C.grigio };
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
    <${Text} color=${C.grigio} wrap="truncate-end">${'        '}<${Text} color=${C.ciano}>█<//> direttore  <${Text} color=${C.viola}>█<//> pianificatore  <${Text} color=${C.rosa}>█<//> esecutore  <${Text} color="#FF9F1C">█<//> operatore  <${Text} color=${C.giallo}>█<//> revisore  <${Text} color=${C.rosso}>█<//> errore<//>
  <//>`;
}

// ---------- 4. Il pannello AGENTI: richiesta, compiti, squadra, attività, coda, linea del tempo ----------
// Tutto ordinato dall'alto verso il basso come si legge un lavoro: COSA si sta facendo (i compiti e le
// loro fasi), CHI lo sta facendo (la squadra, ruolo per ruolo), COME (gli strumenti usati, in diretta),
// e QUANDO (la linea del tempo).

const COL_RUOLO = { direttore: C.ciano, pianificatore: C.viola, esecutore: C.rosa, operatore: '#FF9F1C', revisore: C.giallo, memorista: '#7FD1B9', catalogatore: '#7FD1B9', chat: C.gesso };
const SQUADRA = ['direttore', 'pianificatore', 'esecutore', 'operatore', 'revisore', 'memorista'];
const secondi = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return s >= 60 ? `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s` : `${s}s`; };
const oraDi = (t) => new Date(t).toTimeString().slice(0, 8);

function Titolo({ testo, nota, larghezza, colore = C.ciano }) {
  const resto = Math.max(0, larghezza - testo.length - (nota ? nota.length + 3 : 0) - 3);
  return html`<${Text} wrap="truncate-end"><${Text} color=${colore} bold>${testo}<//><${Text} color=${C.scuro}> ${'─'.repeat(resto)} <//>${nota ? html`<${Text} color=${C.grigio}>${nota}<//>` : ''}<//>`;
}

// Lo stato di una fase (piano, lavoro, verifica) di un compito, dalle chiamate fatte per quel compito.
function fase(chiamate, ruoli) {
  const mie = chiamate.filter((c) => ruoli.includes(c.ruolo));
  if (!mie.length) return { stato: 'vuota', n: 0 };
  const ultima = mie[mie.length - 1];
  const stato = !ultima.fine ? 'lavoro' : ultima.limitato && !ultima.ok ? 'riserva' : ultima.ok ? 'ok' : 'errore';
  return { stato, n: mie.length, ia: ultima.ia, inizio: mie[0].inizio, fine: ultima.fine };
}

function simboloFase(f, tick, saltata) {
  if (f.stato === 'lavoro') return [SPIN[tick % SPIN.length], C.rosa];
  if (f.stato === 'ok') return ['●', C.verde];
  if (f.stato === 'errore') return ['✖', C.rosso];
  if (f.stato === 'riserva') return ['⟳', C.giallo];
  return saltata ? ['–', C.scuro] : ['○', C.scuro];
}

// colonne dei compiti: icona(2) numero(3) titolo(wTitolo+1) fasi(12) chi(2+20) tempo(7)
const larghezzaTitolo = (w) => Math.max(10, Math.min(46, w - (w >= 80 ? 12 + 22 + 7 : 12 + 7) - 6));

function IntestazioneCompiti({ larghezza }) {
  const wT = larghezzaTitolo(larghezza);
  const largo = larghezza >= 80;
  const titolo = 'COMPITI';
  return html`<${Text} wrap="truncate-end"><${Text} color=${C.ciano} bold>${titolo.padEnd(wT + 6)}<//><${Text} color=${C.grigio}>P    L    V   <//>${largo ? html`<${Text} color=${C.grigio}>${'  chi'.padEnd(22)}<//>` : ''}<${Text} color=${C.grigio}>${'tempo'.padStart(7)}<//><//>`;
}

function RigaCompito({ c, i, chiamate, tick, larghezza, disponibili }) {
  const mie = chiamate.filter((x) => x.compito === i);
  const piano = fase(mie, ['pianificatore']);
  const lavoro = fase(mie, ['esecutore', 'operatore']);
  const verifica = fase(mie, ['revisore']);
  const finito = ['ok', 'avviso', 'errore', 'saltato'].includes(c.stato);
  const ICONA = { attesa: ['○', C.grigio], lavoro: [SPIN[tick % SPIN.length], C.rosa], ok: ['✔', C.verde], avviso: ['⚠', C.giallo], errore: ['✖', C.rosso], saltato: ['·', C.scuro] };
  const [ic, col] = ICONA[c.stato] || ICONA.attesa;
  const fasi = [[piano, finito && piano.stato === 'vuota'], [lavoro, false], [verifica, finito && verifica.stato === 'vuota']];
  // il filo tra una fase e l'altra si accende quando la fase prima è finita bene
  const filo = (f) => html`<${Text} color=${f.stato === 'ok' ? C.verde : C.scuro}>${f.stato === 'ok' ? '━━━' : '───'}<//>`;
  const operatore = mie.some((x) => x.ruolo === 'operatore');
  const chi = lavoro.ia ? `${nomeIA(disponibili, lavoro.ia)}${operatore ? ' (op)' : ''}${verifica.ia ? ' → ' + nomeIA(disponibili, verifica.ia) : ''}` : c.stato === 'attesa' && c.dipende?.length ? `aspetta ${c.dipende.join(',')}` : '—';
  const inizio = mie.length ? mie[0].inizio : null;
  const fine = mie.length && finito ? Math.max(...mie.map((x) => x.fine || 0)) : Date.now();
  const tempo = inizio ? secondi(fine - inizio) : '';
  const largo = larghezza >= 80;
  const wTitolo = larghezzaTitolo(larghezza);
  const titolo = (c.titolo.length > wTitolo ? c.titolo.slice(0, wTitolo - 1) + '…' : c.titolo) + (c.dipende?.length ? ` ←${c.dipende.join(',')}` : '');
  return html`<${Text} wrap="truncate-end">
    <${Text} color=${col}>${ic} <//><${Text} color=${C.ciano} bold>${String(i + 1).padStart(2)} <//>
    <${Text} color=${finito ? C.grigio : C.gesso}>${titolo.padEnd(wTitolo + 1).slice(0, wTitolo + 1)}<//>
    ${fasi.map(([f, saltata], k) => { const [s, cs] = simboloFase(f, tick, saltata); return html`<${Text} key=${k}><${Text} color=${cs}>${s}<//>${f.n > 1 ? html`<${Text} color=${C.giallo}>${f.n}<//>` : html`<${Text}> <//>`}${k < 2 ? filo(f) : ''}<//>`; })}
    ${largo ? html`<${Text} color=${lavoro.ia ? COLORE_IA[lavoro.ia] || C.gesso : C.grigio}>  ${chi.padEnd(20).slice(0, 20)}<//>` : ''}
    <${Text} color=${C.grigio}>${tempo.padStart(7)}<//>
  <//>`;
}

// Una riga per ruolo: chi lo copre, cosa sta facendo, l'ultimo strumento, e le riserve quando è fermo.
function RigaRuolo({ ruolo, chiamate, ruoli, config, disponibili, tick, larghezza }) {
  const mie = chiamate.filter((c) => c.ruolo === ruolo);
  const aperte = mie.filter((c) => !c.fine);
  const ultima = mie[mie.length - 1];
  const nome = ruolo.toUpperCase().padEnd(14);
  const catena = (config?.ruoli?.[ruolo] || []).filter((id) => disponibili[id]?.ok && !disponibili[id]?.limitato);
  let ia = aperte[0]?.ia || ultima?.ia || catena[0] || null;
  let stato, colStato, dettaglio = '';
  if (aperte.length) {
    stato = `${SPIN[tick % SPIN.length]} al lavoro`;
    colStato = C.rosa;
    const compiti = aperte.map((c) => c.compito).filter((x) => x !== null && x !== undefined);
    dettaglio = `${compiti.length ? (aperte.length > 1 ? `⇉ compiti ${compiti.map((x) => x + 1).join(',')}` : `compito ${compiti[0] + 1}`) : ''} · ${secondi(Date.now() - Math.min(...aperte.map((c) => c.inizio)))}`;
    const strum = aperte.flatMap((c) => c.strumenti).slice(-1)[0];
    if (strum) dettaglio += `  ▸ ${strum}`;
  } else if (ultima) {
    const ok = ultima.ok;
    stato = ok ? `✔ fatto ×${mie.length}` : ultima.limitato ? '⟳ al limite' : '✖ errore';
    if (ok && mie.length === 1) stato = '✔ fatto';
    colStato = ok ? C.verde : ultima.limitato ? C.giallo : C.rosso;
    dettaglio = `${secondi(mie.reduce((a, c) => a + ((c.fine || Date.now()) - c.inizio), 0))} in tutto`;
  } else if (!catena.length) {
    stato = '○ nessuna IA';
    colStato = C.rosso;
    ia = null;
  } else {
    stato = ruoli[ruolo]?.stato === 'saltato' ? '– saltato' : '○ pronto';
    colStato = C.grigio;
    dettaglio = catena.length > 1 ? `riserve: ${catena.slice(1).map((id) => nomeIA(disponibili, id)).join(' → ')}` : 'nessuna riserva';
  }
  return html`<${Text} wrap="truncate-end">
    <${Text} color=${COL_RUOLO[ruolo] || C.gesso} bold>${nome}<//>
    <${Text} color=${ia ? COLORE_IA[ia] || C.gesso : C.scuro} bold>${(ia ? nomeIA(disponibili, ia) : '—').padEnd(8)}<//>
    <${Text} color=${colStato}>${stato.padEnd(13)}<//>
    <${Text} color=${C.grigio}>${larghezza >= 60 ? dettaglio : ''}<//>
  <//>`;
}

export function PannelloAgenti({ h, w, tel, ruoli, disponibili, tick, coda = [], config }) {
  const r = tel.richiesta;
  const chiamate = r ? tel.chiamate.filter((c) => c.richiesta === r.n) : [];
  const compiti = r?.compiti || [];
  const nIA = Object.keys(disponibili).length;
  const righe = [];
  const metti = (k, el) => righe.push(html`<${Box} key=${k} height=${1}>${el}<//>`);

  // --- la richiesta ---
  if (r) {
    const durata = secondi((r.fine || Date.now()) - r.inizio);
    const insieme = chiamate.filter((c) => !c.fine && c.compito !== null && c.compito !== undefined);
    const paralleli = new Set(insieme.map((c) => c.compito)).size;
    const nota = `${r.fine ? '✔ finita in ' : '⏱ '}${durata} · ${compiti.length || '…'} compit${compiti.length === 1 ? 'o' : 'i'}${paralleli > 1 ? ` · ⇉ ${paralleli} insieme` : ''}`;
    const spazio = Math.max(10, w - nota.length - 4);
    metti('r', html`<${Text} wrap="truncate-end"><${Text} color=${r.fine ? C.verde : C.rosa} bold>▣ <//><${Text} color=${C.gesso} bold>${(r.testo.length > spazio ? r.testo.slice(0, spazio - 1) + '…' : r.testo).padEnd(spazio)}<//><${Text} color=${r.fine ? C.verde : C.ciano}>  ${nota}<//><//>`);
  } else {
    metti('r', html`<${Text} color=${C.grigio} wrap="truncate-end">▣ nessuna richiesta ancora: scrivi cosa vuoi fare nella riga › qui sotto<//>`);
  }

  // --- i compiti, con le tre fasi ---
  const hTimeline = nIA + 3;
  const hSquadra = SQUADRA.length + 1;
  const hCoda = coda.length ? Math.min(4, coda.length + 1) : 0;
  if (compiti.length || (r && !r.fine)) {
    metti('ct', html`<${IntestazioneCompiti} larghezza=${w} />`);
    if (!compiti.length) metti('c0', html`<${Text} color=${C.grigio}>  ${SPIN[tick % SPIN.length]} il direttore sta dividendo il lavoro…<//>`);
    const posto = Math.max(1, h - righe.length - hSquadra - 1 - hCoda);
    compiti.slice(0, posto).forEach((c, i) => metti('c' + i, html`<${RigaCompito} c=${c} i=${i} chiamate=${chiamate} tick=${tick} larghezza=${w} disponibili=${disponibili} />`));
    if (compiti.length && h - righe.length > hSquadra + hCoda + 6) metti('cl', html`<${Text} color=${C.scuro} wrap="truncate-end">   P piano · L lavoro (esecutore o operatore) · V verifica del revisore · ● fatto  ✖ errore  ⟳ riserva  2 = corretto due volte  ←1,2 aspetta i compiti 1 e 2<//>`);
  }

  // --- la squadra ---
  metti('st', html`<${Titolo} testo="SQUADRA" nota=${`${Object.values(disponibili).filter((d) => d.ok).length}/${nIA} IA collegate`} larghezza=${w} />`);
  for (const ruolo of SQUADRA) metti('s' + ruolo, html`<${RigaRuolo} ruolo=${ruolo} chiamate=${chiamate} ruoli=${ruoli} config=${config} disponibili=${disponibili} tick=${tick} larghezza=${w} />`);

  // --- la coda ---
  if (hCoda) {
    metti('qt', html`<${Titolo} testo=${`IN CODA (${coda.length})`} colore=${C.giallo} larghezza=${w} />`);
    coda.slice(0, hCoda - 1).forEach((q, i) => metti('q' + i, html`<${Text} color=${C.grigio} wrap="truncate-end">  ${i + 1}. ${q}<//>`));
  }

  // --- quello che resta: attività in diretta e, se c'è posto, la linea del tempo ---
  const resto = h - righe.length;
  const conTimeline = resto >= hTimeline + 4;
  const hAttivita = resto - (conTimeline ? hTimeline : 0);
  const attivita = r ? tel.attivita.filter((a) => a.t >= r.inizio) : [];
  if (hAttivita >= 2) {
    metti('at', html`<${Titolo} testo="ATTIVITÀ IN DIRETTA" nota=${attivita.length ? `${attivita.length} strumenti usati` : ''} larghezza=${w} />`);
    const vis = attivita.slice(-(hAttivita - 1));
    if (!vis.length) metti('a0', html`<${Text} color=${C.grigio} wrap="truncate-end">  ${r ? 'qui compaiono i file letti e scritti e i comandi lanciati dalle IA' : 'quando la squadra lavora, qui vedi ogni file letto o scritto e ogni comando'}<//>`);
    vis.forEach((a, k) => metti('a' + k, html`<${Text} wrap="truncate-end">
      <${Text} color=${C.scuro}>${oraDi(a.t)} <//>
      <${Text} color=${COLORE_IA[a.ia] || C.gesso} bold>${nomeIA(disponibili, a.ia).padEnd(8)}<//>
      <${Text} color=${COL_RUOLO[a.ruolo] || C.grigio}>${(a.ruolo || '').slice(0, 5).padEnd(6)}<//>
      <${Text} color=${C.grigio}>${a.compito !== null && a.compito !== undefined ? `#${a.compito + 1} ` : '   '}<//>
      <${Text} color=${C.viola}>▸ <//><${Text} color=${k === vis.length - 1 && attivita.length && Date.now() - a.t < 3000 ? '#FFFFFF' : C.gesso}>${a.testo}<//>
    <//>`));
    for (let k = vis.length || 1; k < hAttivita - 1; k++) metti('av' + k, html`<${Text}> <//>`);
  }
  if (conTimeline) {
    metti('lt', html`<${Titolo} testo="LINEA DEL TEMPO" nota="ultimi 3 minuti" larghezza=${w} />`);
    righe.push(html`<${LineaDelTempo} key="ltc" tel=${tel} disponibili=${disponibili} larghezza=${w} />`);
  }
  return html`<${Box} flexDirection="column" height=${h} overflow="hidden">${righe}<//>`;
}
