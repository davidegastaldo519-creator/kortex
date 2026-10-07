import { eseguiIA } from './adapters.js';
import fs from 'node:fs';
import { diffProgetto } from './state.js';
import { DIR_DB, bloccoConoscenze, aggiungiSoluzione } from './database.js';
import { bloccoPreferenze, ricorda } from './memoria.js';

// ---------- scelta dell'IA per un ruolo, con riserva automatica ----------

function candidati(ruolo, ctx, { preferisci, evita } = {}) {
  let lista = (ctx.config.ruoli[ruolo] || []).filter(
    (id) => ctx.config.ia[id] && ctx.disponibili[id]?.ok && !ctx.disponibili[id]?.limitato
  );
  if (preferisci && lista.includes(preferisci)) lista = [preferisci, ...lista.filter((x) => x !== preferisci)];
  if (evita && lista.length > 1 && lista.includes(evita)) lista = [...lista.filter((x) => x !== evita), evita];
  return lista;
}

export async function eseguiRuolo(ruolo, prompt, ctx, opz = {}) {
  const { config, disponibili, ui, stato, cwd } = ctx;
  const lista = candidati(ruolo, ctx, opz);
  if (!lista.length) {
    ui.ruolo(ruolo, 'errore', null);
    return { ok: false, errore: `nessuna IA disponibile per il ruolo ${ruolo}` };
  }
  const chiave = opz.chiaveSessione || ruolo;
  const profilo = opz.modalita === 'scrittura' ? config.autonomia : 'lettura';

  for (const id of lista) {
    const cfg = config.ia[id];
    ui.ruolo(ruolo, 'lavoro', id);
    const chiudi = ctx.tel?.inizio(id, ruolo, opz.compito ?? null) || (() => {});
    const modello = id === 'ollama'
      ? (cfg.modello === 'auto' ? disponibili.ollama?.modelli?.[0] : cfg.modello)
      : undefined;

    const r = await eseguiIA({
      cfg,
      prompt: opz.riprendi && cfg.resume && stato.sessione(id, chiave) ? opz.promptBreve || prompt : prompt,
      cwd,
      sessione: opz.riprendi ? stato.sessione(id, chiave) : null,
      extra: config.profili?.[profilo]?.[id] || [],
      modello,
      adddir: fs.existsSync(DIR_DB) ? ['--add-dir', DIR_DB] : [],
      timeoutSecondi: ruolo === 'esecutore' ? config.timeoutSecondi : Math.min(config.timeoutSecondi || 600, 600),
      silenzioSecondi: config.silenzioSecondi || 300,
      onTesto: (t) => { ctx.tel?.evento(); if (opz.mostra !== false) ui.out(t); },
      onLog: (m) => { ctx.tel?.evento(); if (/^\s*▸/.test(m)) ctx.tel?.strumento(id, m.replace(/^\s*▸\s*\w+\s*→\s*/, '').trim()); ui.log(m, { ia: id, ruolo }); },
    });
    chiudi(r);

    if (r.ok) {
      ui.log(`✔ ${cfg.nome} ha finito (${ruolo})`, { ia: id, ruolo, tipo: 'fine' });
      if (r.sessione && opz.chiaveSessione) stato.salvaSessione(id, chiave, r.sessione);
      if (r.costo) ui.costo(r.costo);
      ui.ruolo(ruolo, 'ok', id);
      return { ...r, ia: id };
    }
    if (r.limitato) disponibili[id].limitato = true;
    ui.log(`✖ ${cfg.nome} (${ruolo}): ${r.errore}${r.limitato ? ' — limite raggiunto, passo alla riserva' : ''}`, { ia: id, ruolo, tipo: r.limitato ? 'riserva' : 'errore' });
  }
  ui.ruolo(ruolo, 'errore', null);
  return { ok: false, errore: 'tutte le IA disponibili hanno fallito' };
}

// ---------- prompt dei ruoli ----------

const bloccoAllegati = (ctx) =>
  (ctx.allegati?.length
    ? `\nFILE ALLEGATI DALL'UTENTE (dentro la cartella del progetto: leggili o guardali se servono al compito):\n${ctx.allegati.map((a) => '- ' + a).join('\n')}\n`
    : '') + bloccoConoscenze(ctx.conoscenze) + bloccoPreferenze();

function esecutoriDisponibili(ctx) {
  return candidati('esecutore', ctx)
    .map((id) => `- ${id}: ${ctx.config.ia[id].puntiForti || ''}`)
    .join('\n');
}

const promptDirettore = (richiesta, ctx) => `Sei il DIRETTORE di un gruppo di IA che lavora nella cartella di progetto: ${ctx.cwd}

Riassunto del progetto (aggiornato dal memorista):
${ctx.stato.riassunto() || '(ancora nessun riassunto)'}

Ultime voci del diario:
${ctx.stato.memoria(Math.min(15, ctx.config.memoriaRighe || 30)) || '(progetto nuovo)'}

Esecutori disponibili e loro punti forti:
${esecutoriDisponibili(ctx) || '(nessuno)'}

${ctx.chatPrecedente ? `Conversazione precedente in questa chat (serve solo come contesto):\n${ctx.chatPrecedente}\n\n` : ''}Richiesta dell'utente:
${richiesta}
${bloccoAllegati(ctx)}
Scomponi la richiesta in compiti concreti: il MINOR numero possibile, da 1 a ${ctx.config.maxCompiti || 5}. Se la richiesta è semplice, un solo compito.
NON modificare file e NON eseguire comandi: tu pianifichi soltanto.
Per ogni compito scegli l'esecutore più adatto tra quelli disponibili.
"tipo" vale "codice" se il compito crea o modifica file, "analisi" se serve solo leggere e rispondere.

Regole sui compiti:
- Ogni compito deve creare o modificare file DENTRO la cartella del progetto, oppure rispondere a una domanda.
- NON creare compiti per aprire programmi, avviare il browser, mostrare risultati o eseguire app per l'utente: quelle cose le fa lui. Se l'utente chiede di "aprire" o "vedere" qualcosa, il lavoro finisce quando il file è pronto.
- Un file creato da un compito deve essere completo in quello stesso compito: non dividere "crea" e "controlla che esista" in compiti separati.

Rispondi SOLO con JSON valido, senza nessun testo prima o dopo:
{"compiti":[{"titolo":"breve","descrizione":"cosa va fatto, con tutti i dettagli necessari","tipo":"codice","esecutore":"claude"}]}`;

const promptPiano = (c, cwd, ctx) => `Sei il PIANIFICATORE. Cartella del progetto: ${cwd}

COMPITO: ${c.titolo}
${c.descrizione}
${bloccoAllegati(ctx)}
Puoi leggere i file del progetto per capirlo, ma NON modificarli.
Scrivi un piano numerato di massimo 8 passi concreti per l'esecutore. Niente codice completo: solo i passi, chiari e verificabili.`;

const promptEsecutore = (c, piano, cwd, ctx) => `Sei l'ESECUTORE. Lavori nella cartella ${cwd}.

COMPITO: ${c.titolo}
${c.descrizione}
${bloccoAllegati(ctx)}
PIANO DA SEGUIRE:
${piano}

Regole:
- lavora solo dentro questa cartella e crea i file qui, mai altrove;
- non cancellare file che non hai creato tu, a meno che il compito non lo chieda esplicitamente;
- alla fine scrivi un riepilogo breve: quali file hai creato o modificato e cosa hai fatto.`;

const promptRevisore = (c, riepilogo, diff) => `Sei il REVISORE. Controlla il lavoro fatto su questo compito.

COMPITO: ${c.titolo}
${c.descrizione}

RIEPILOGO DELL'ESECUTORE:
${riepilogo.slice(-3000)}

${diff ? `MODIFICHE AI FILE:\n${diff}` : 'Il progetto non usa git: verifica leggendo i file indicati nel riepilogo.'}

Regole importanti:
- Segnala SOLO problemi concreti e verificabili: errori, file mancanti, richieste del compito non soddisfatte.
- Se non riesci a leggere o a verificare qualcosa, NON è un errore dell'esecutore: scrivi ESITO: OK e annota cosa non hai potuto verificare.
- Non riscrivere il lavoro e non proporre stili alternativi: non è il tuo compito.

La prima riga deve essere esattamente "ESITO: OK" oppure "ESITO: CORREGGI". Poi al massimo 5 punti brevi.`;

const promptCorrezioneBreve = (note) =>
  `Il revisore ha segnalato questi problemi. Correggi SOLO questi, non rifare il resto del lavoro:\n${note}\n\nAlla fine scrivi in breve cosa hai corretto.`;

const promptCorrezioneCompleta = (c, piano, note, cwd, ctx) =>
  `${promptEsecutore(c, piano, cwd, ctx)}\n\nIl lavoro è già stato fatto una volta. Il revisore ha segnalato questi problemi: correggi SOLO questi.\n${note}`;

// ---------- lettura delle risposte ----------

function estraiCompiti(testo) {
  const m = (testo || '').match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]);
    if (!Array.isArray(j.compiti)) return null;
    return j.compiti
      .filter((c) => c && c.titolo)
      .map((c) => ({
        titolo: String(c.titolo).slice(0, 80),
        descrizione: String(c.descrizione || c.titolo),
        tipo: c.tipo === 'analisi' ? 'analisi' : 'codice',
        esecutore: c.esecutore,
      }));
  } catch {
    return null;
  }
}

function leggiEsito(testo) {
  const m = (testo || '').match(/ESITO:\s*(OK|CORREGGI)/i);
  const note = (testo || '').replace(/ESITO:\s*(OK|CORREGGI)/i, '').trim();
  return { esito: m ? m[1].toUpperCase() : 'OK', note: m ? note : `(esito non chiaro) ${note}`.trim() };
}

async function revisiona(compito, esecuzione, ctx, indice = null) {
  ctx.ui.titolo(`REVISIONE — ${compito.titolo}`);
  const r = await eseguiRuolo('revisore', promptRevisore(compito, esecuzione.testo, diffProgetto(ctx.cwd)), ctx, {
    modalita: 'lettura',
    compito: indice,
    evita: ctx.config.revisoreIndipendente === false ? null : esecuzione.ia, // occhi nuovi, se possibile
  });
  if (!r.ok) return { esito: 'NON VERIFICATO', note: r.errore, ia: null };
  const v = { ...leggiEsito(r.testo), ia: r.ia };
  ctx.ui.pensiero?.('revisione', `${compito.titolo}\nESITO: ${v.esito}\n${v.note}`);
  return v;
}

// ---------- il flusso completo ----------

export async function eseguiRichiesta({ richiesta, ctx }) {
  const { ui, config, stato } = ctx;
  const inizio = Date.now();

  ui.pensiero?.('richiesta', richiesta);
  ctx.tel?.nuovaRichiesta(richiesta);
  ui.titolo('DIRETTORE — divido il lavoro');
  const d = await eseguiRuolo('direttore', promptDirettore(richiesta, ctx), ctx, {
    modalita: 'lettura',
    mostra: false,
  });
  let compiti = d.ok ? estraiCompiti(d.testo) : null;
  if (!compiti?.length) {
    ui.log('⚠ il direttore non ha dato un piano valido: lavoro sulla richiesta intera', { tipo: 'avviso' });
    compiti = [{ titolo: richiesta.slice(0, 60), descrizione: richiesta, tipo: 'codice' }];
  }
  compiti = compiti.slice(0, config.maxCompiti || 5);
  compiti.forEach((c, i) => ui.out(`  ${i + 1}. ${c.titolo}  [${c.tipo}${c.esecutore ? ' → ' + c.esecutore : ''}]\n`));
  const statoCompiti = compiti.map((c) => ({ titolo: c.titolo, stato: 'attesa' }));
  const segna = (i, stato) => {
    statoCompiti[i].stato = stato;
    ui.compiti?.([...statoCompiti]);
    ctx.tel?.compiti(statoCompiti);
    if (stato !== 'lavoro') ui.notifica?.(`${stato === 'ok' ? '✔' : stato === 'errore' ? '✖' : '⚠'} ${i + 1}. ${statoCompiti[i].titolo}`, stato);
  };
  ui.compiti?.([...statoCompiti]);
  ui.pensiero?.('compiti', compiti.map((c, i) => `${i + 1}. ${c.titolo}${c.esecutore ? '  → ' + c.esecutore : ''}\n   ${c.descrizione}`).join('\n'));

  const esiti = [];
  for (const [i, c] of compiti.entries()) {
    ui.titolo(`COMPITO ${i + 1}/${compiti.length} — ${c.titolo}`);

    segna(i, 'lavoro');
    let testoPiano = '(nessun piano: procedi direttamente sul compito)';
    if (config.usaPianificatore !== false) {
      const piano = await eseguiRuolo('pianificatore', promptPiano(c, ctx.cwd, ctx), ctx, { modalita: 'lettura', compito: i });
      if (piano.ok) testoPiano = piano.testo;
      ui.pensiero?.('piano', `${c.titolo}\n${testoPiano}`);
    } else {
      ui.ruolo('pianificatore', 'saltato', null);
    }

    ui.titolo(`ESECUZIONE — ${c.titolo}`);
    const chiave = `esecutore-${Date.now()}-${i}`;
    const modalita = c.tipo === 'codice' ? 'scrittura' : 'lettura';
    let es = await eseguiRuolo('esecutore', promptEsecutore(c, testoPiano, ctx.cwd, ctx), ctx, {
      chiaveSessione: chiave,
      modalita,
      preferisci: c.esecutore,
      compito: i,
    });
    ui.aggiornaFile?.();
    if (!es.ok) {
      esiti.push({ c, esito: 'FALLITO', note: es.errore });
      segna(i, 'errore');
      continue;
    }

    let rev = { esito: 'OK', note: '(revisione disattivata)', ia: null };
    if (config.usaRevisore !== false) rev = await revisiona(c, es, ctx, i);
    else ui.ruolo('revisore', 'saltato', null);
    let correzioni = 0;
    while (config.usaRevisore !== false && rev.esito === 'CORREGGI' && correzioni < (config.maxCorrezioni ?? 1)) {
      correzioni++;
      ui.titolo(`CORREZIONE ${correzioni} — ${c.titolo}`);
      // Se l'esecutore sa riprendere la sessione gli mandiamo SOLO le correzioni, non il prompt intero.
      const es2 = await eseguiRuolo('esecutore', promptCorrezioneCompleta(c, testoPiano, rev.note, ctx.cwd, ctx), ctx, {
        chiaveSessione: chiave,
        riprendi: true,
        promptBreve: promptCorrezioneBreve(rev.note),
        modalita,
        preferisci: es.ia,
        compito: i,
      });
      ui.aggiornaFile?.();
      if (!es2.ok) break;
      es = es2;
      rev = await revisiona(c, es, ctx, i);
    }
    esiti.push({ c, esito: rev.esito, note: rev.note, esecutore: es.ia, revisore: rev.ia });
    segna(i, rev.esito === 'OK' ? 'ok' : 'avviso');
  }

  // ---------- riepilogo e diario ----------
  const secondi = Math.round((Date.now() - inizio) / 1000);
  const durata = secondi >= 60 ? `${Math.floor(secondi / 60)}m ${secondi % 60}s` : `${secondi}s`;
  ui.titolo('RIEPILOGO');
  const icona = { OK: '✔', CORREGGI: '⚠', FALLITO: '✖', 'NON VERIFICATO': '?' };
  for (const [i, e] of esiti.entries()) {
    const chi = e.esecutore ? ` (${e.esecutore}${e.revisore ? ' → ' + e.revisore : ''})` : '';
    const nota = e.esito === 'OK' ? '' : `: ${String(e.note || '').split('\n')[0].slice(0, 120)}`;
    ui.out(`  ${icona[e.esito] || '·'} ${i + 1}. ${e.c.titolo} — ${e.esito}${chi}${nota}\n`);
  }
  ui.out(`  tempo: ${durata}\n`);

  const data = new Date().toISOString().slice(0, 16).replace('T', ' ');
  stato.annota(
    `## ${data} — ${richiesta.slice(0, 120)}\n` +
      esiti
        .map((e) => `- [${e.esito}] ${e.c.titolo}${e.esecutore ? ` (esecutore: ${e.esecutore}, revisore: ${e.revisore || '—'})` : ''}`)
        .join('\n')
  );
  return esiti;
}

// ---------- chat diretta con una sola IA ----------
// Le IA che sanno riprendere la sessione ricevono SOLO il messaggio nuovo.
// Alle altre passiamo gli ultimi scambi, perché da sole non ricordano niente.
export async function chatDiretta({ id, messaggio, ctx, storia }) {
  const { config, disponibili, ui, stato, cwd } = ctx;
  const cfg = config.ia[id];
  const chiaveChat = ctx.chatId ? `chat:${ctx.chatId}` : 'chat';
  const sessione = cfg.resume ? stato.sessione(id, chiaveChat) : null;
  let prompt = messaggio + bloccoAllegati(ctx);
  if (!cfg.resume && storia.length) {
    const passato = storia
      .slice(-6)
      .map((s) => `${s.chi}: ${s.testo.slice(0, 1500)}`)
      .join('\n\n');
    prompt = `Conversazione finora:\n${passato}\n\nNuovo messaggio dell'utente:\n${messaggio}${bloccoAllegati(ctx)}`;
  }
  const modello = id === 'ollama'
    ? (cfg.modello === 'auto' ? disponibili.ollama?.modelli?.[0] : cfg.modello)
    : undefined;

  const chiudi = ctx.tel?.inizio(id, 'chat') || (() => {});
  const r = await eseguiIA({
    cfg,
    prompt,
    cwd,
    sessione,
    extra: config.profili?.[config.autonomia]?.[id] || [],
    modello,
    adddir: fs.existsSync(DIR_DB) ? ['--add-dir', DIR_DB] : [],
    timeoutSecondi: config.timeoutSecondi,
    onTesto: (t) => { ctx.tel?.evento(); ui.out(t); },
    onLog: (m) => { ctx.tel?.evento(); ui.log(m, { ia: id, ruolo: 'chat' }); },
  });
  chiudi(r);
  if (r.ok) {
    if (r.sessione) stato.salvaSessione(id, chiaveChat, r.sessione);
    if (r.costo) ui.costo(r.costo);
  } else {
    if (r.limitato) disponibili[id].limitato = true;
    ui.log(`✖ ${cfg.nome}: ${r.errore}${r.limitato ? ' — limite raggiunto: scegli un\'altra IA con /chat' : ''}`, { ia: id, ruolo: 'chat', tipo: 'errore' });
  }
  return r;
}


// ---------- il catalogatore: un'IA scrive la scheda di un file del database ----------
export async function catalogaCon(ctx, { nome, estratto, percorso }) {
  const prompt = `Sei il CATALOGATORE di un database personale. Devi scrivere la scheda di questo file.
Nome del file: ${nome}
Percorso: ${percorso}
Inizio del contenuto:
${estratto || '(nessun testo leggibile)'}

Le categorie possibili sono: manuali (guide, istruzioni, documentazione), codice (script, sorgenti, configurazioni), documenti (testi, pagine web, PDF), immagini, note (appunti brevi), archivio (tutto il resto).
Rispondi SOLO con JSON valido, senza testo prima o dopo:
{"categoria":"manuali","titolo":"titolo breve e chiaro in italiano","descrizione":"una frase: cosa contiene e a cosa serve","tag":["parola1","parola2","parola3"]}`;
  const r = await eseguiRuolo('catalogatore', prompt, ctx, { modalita: 'lettura', mostra: false });
  if (!r.ok) return null;
  const m = (r.testo || '').match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}


// ---------- il memorista: aggiorna la memoria dopo ogni richiesta ----------
export async function aggiornaMemoria(ctx, { richiesta, esito, file, progetto }) {
  const prompt = `Sei il MEMORISTA del progetto "${progetto}". Aggiorni la memoria dopo ogni richiesta.

RIASSUNTO ATTUALE DEL PROGETTO:
${ctx.stato.riassunto() || '(nessuno: è il primo)'}

ULTIMA RICHIESTA DELL'UTENTE:
${richiesta}

ESITO:
${String(esito).slice(0, 2500)}

FILE CAMBIATI:
${(file || []).slice(0, 30).join('\n') || '(nessuno)'}

Compiti:
1. Riscrivi il riassunto del progetto tenendo conto di quello che è appena successo: cos'è il progetto, come è fatto (file principali), decisioni prese, cosa resta da fare. Massimo 20 righe brevi, in italiano.
2. Se in questo lavoro è emersa una SOLUZIONE riutilizzabile in altri progetti (un trucco tecnico, la correzione di un errore, un procedimento), descrivila in modo autonomo e comprensibile. Altrimenti null. Niente cose banali o valide solo qui.
3. Se l'utente nella richiesta ha espresso ESPLICITAMENTE una preferenza su come vuole che si lavori (lingua, stile, cose da evitare), riportala in una frase. Altrimenti lista vuota. Non inventare.

Rispondi SOLO con JSON valido, senza testo prima o dopo:
{"riassunto":"...","soluzione":null,"preferenze":[]}
oppure con soluzione: {"titolo":"...","testo":"...","tag":["..."]}`;
  const r = await eseguiRuolo('memorista', prompt, ctx, { modalita: 'lettura', mostra: false });
  if (!r.ok) return null;
  const m = (r.testo || '').match(/\{[\s\S]*\}/);
  if (!m) return null;
  let j;
  try { j = JSON.parse(m[0]); } catch { return null; }
  const fatto = { riassunto: false, soluzione: null, preferenze: [] };
  if (typeof j.riassunto === 'string' && j.riassunto.trim()) { ctx.stato.salvaRiassunto(j.riassunto); fatto.riassunto = true; }
  if (j.soluzione?.titolo && j.soluzione?.testo) {
    try { fatto.soluzione = await aggiungiSoluzione({ ...j.soluzione, tag: j.soluzione.tag || [], progetto }); } catch { /* */ }
  }
  for (const p of Array.isArray(j.preferenze) ? j.preferenze.slice(0, 3) : []) if (typeof p === 'string' && ricorda(p)) fatto.preferenze.push(p);
  return fatto;
}
