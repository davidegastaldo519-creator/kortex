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

// Quale profilo di permessi usa una chiamata: lettura, scrittura (prudente/totale), comando (operatore), verifica (revisore).
function profiloPer(modalita, config) {
  if (modalita === 'scrittura') return config.autonomia;
  if (modalita === 'comando') return config.autonomia === 'totale' ? 'totale' : 'operatore';
  if (modalita === 'verifica') return config.revisoreVerifica === false ? 'lettura' : 'verifica';
  return 'lettura';
}

export async function eseguiRuolo(ruolo, prompt, ctx, opz = {}) {
  const { config, disponibili, ui, stato, cwd } = ctx;
  const lista = candidati(ruolo, ctx, opz);
  if (!lista.length) {
    ui.ruolo(ruolo, 'errore', null);
    return { ok: false, errore: `nessuna IA disponibile per il ruolo ${ruolo}` };
  }
  const chiave = opz.chiaveSessione || ruolo;
  const profilo = profiloPer(opz.modalita, config);
  const scrivi = opz.scrivi || ui.out;

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
      timeoutSecondi: ruolo === 'esecutore' || ruolo === 'operatore' ? config.timeoutSecondi : Math.min(config.timeoutSecondi || 600, 600),
      silenzioSecondi: config.silenzioSecondi || 300,
      onTesto: (t) => { ctx.tel?.evento(); if (opz.mostra !== false) scrivi(t); },
      onLog: (m) => { ctx.tel?.evento(); if (/^\s*▸/.test(m)) ctx.tel?.strumento(id, m.replace(/^\s*▸\s*\w+\s*→\s*/, '').trim(), opz.compito ?? null); ui.log(m, { ia: id, ruolo }); },
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

Esecutori disponibili e loro punti forti (per i compiti "codice" e "analisi"):
${esecutoriDisponibili(ctx) || '(nessuno)'}
Per i compiti "comando" lavora l'OPERATORE (${candidati('operatore', ctx).join(', ') || 'nessuno disponibile'}): un'IA con il permesso di lanciare comandi dentro la cartella del progetto.

${ctx.chatPrecedente ? `Conversazione precedente in questa chat (serve solo come contesto):\n${ctx.chatPrecedente}\n\n` : ''}${ctx.rispostaUtente ? `L'utente ha già risposto a una tua domanda: ${ctx.rispostaUtente}\n\n` : ''}Richiesta dell'utente:
${richiesta}
${bloccoAllegati(ctx)}
${ctx.chiedi ? `Se la richiesta è davvero ambigua e la risposta cambierebbe il lavoro da fare, PRIMA di dividere puoi fare UNA sola domanda a risposta multipla. In quel caso rispondi SOLO con:
{"domanda":"la domanda, breve","opzioni":["prima scelta","seconda scelta","terza scelta"]}
(da 2 a 4 opzioni brevi). Se invece è chiara, dividi subito il lavoro come descritto sotto.

` : ''}Scomponi la richiesta in compiti concreti: il MINOR numero possibile, da 1 a ${ctx.config.maxCompiti || 5}. Se la richiesta è semplice, un solo compito.
NON modificare file e NON eseguire comandi: tu pianifichi soltanto.
Per ogni compito scegli l'esecutore più adatto tra quelli disponibili.
"tipo" vale:
- "codice" se il compito crea o modifica file;
- "analisi" se serve solo leggere e rispondere;
- "comando" se bisogna ESEGUIRE qualcosa (test, build, script, installazioni, controlli di funzionamento) e riferire il risultato: lo fa l'operatore in autonomia.
"dipende" è l'elenco dei numeri dei compiti che devono essere finiti prima (1 = il primo compito dell'elenco). I compiti senza dipendenze partono IN PARALLELO: metti una dipendenza solo quando serve davvero (per esempio i test dopo il codice, o due compiti che toccano lo stesso file).

Regole sui compiti:
- Ogni compito deve creare o modificare file DENTRO la cartella del progetto, eseguire comandi lì dentro, oppure rispondere a una domanda.
- NON chiedere MAI all'utente di lanciare comandi, aprire programmi o controllare qualcosa: tutto ciò che va eseguito è un compito "comando" per l'operatore.
- NON creare compiti per aprire il browser o mostrare risultati all'utente: il lavoro finisce quando il file è pronto o il comando ha dato il suo esito.
- Un file creato da un compito deve essere completo in quello stesso compito: non dividere "crea" e "controlla che esista" in compiti separati.
- Due compiti in parallelo non devono modificare lo stesso file.

Rispondi SOLO con JSON valido, senza nessun testo prima o dopo:
{"compiti":[{"titolo":"breve","descrizione":"cosa va fatto, con tutti i dettagli necessari","tipo":"codice","esecutore":"claude","dipende":[]}]}`;

const promptPiano = (c, cwd, ctx) => `Sei il PIANIFICATORE. Cartella del progetto: ${cwd}

COMPITO: ${c.titolo}
${c.descrizione}
${bloccoAllegati(ctx)}
Puoi leggere i file del progetto per capirlo, ma NON modificarli.
Scrivi un piano numerato di massimo 8 passi concreti per ${c.tipo === 'comando' ? "l'operatore (che eseguirà comandi)" : "l'esecutore"}. Niente codice completo: solo i passi, chiari e verificabili.`;

const promptEsecutore = (c, piano, cwd, ctx) => `Sei l'ESECUTORE. Lavori nella cartella ${cwd}.

COMPITO: ${c.titolo}
${c.descrizione}
${bloccoAllegati(ctx)}
PIANO DA SEGUIRE:
${piano}

Regole:
- lavora solo dentro questa cartella e crea i file qui, mai altrove;
- non cancellare file che non hai creato tu, a meno che il compito non lo chieda esplicitamente;
- se qualcosa va eseguito o provato e non ne hai il permesso, scrivilo nel riepilogo: ci penserà l'operatore;
- alla fine scrivi un riepilogo breve: quali file hai creato o modificato e cosa hai fatto.`;

const promptOperatore = (c, piano, cwd, ctx) => `Sei l'OPERATORE. Lavori nella cartella ${cwd}. Il tuo compito è ESEGUIRE: lanciare comandi, test, script e controlli dentro questa cartella e riferire l'esito con precisione.

COMPITO: ${c.titolo}
${c.descrizione}
${bloccoAllegati(ctx)}
PIANO DA SEGUIRE:
${piano}

Regole:
- esegui DAVVERO i comandi, non limitarti a descriverli; l'utente non deve fare niente;
- resta dentro la cartella del progetto; niente comandi distruttivi (rm -rf fuori dal progetto, formattazioni, cancellazioni di massa);
- niente comandi che aspettano una risposta interattiva: usa le opzioni non interattive (-y, --yes, CI=1) quando esistono;
- se un comando fallisce, cerca di capire perché; se la soluzione è semplice e sicura (un pacchetto mancante nel progetto, un percorso sbagliato) applicala e riprova una volta;
- alla fine scrivi: i comandi lanciati, l'esito di ognuno (riuscito/fallito, con le righe importanti dell'output), e cosa hai sistemato.`;

const promptRevisore = (c, riepilogo, diff, conVerifica, parallelo) => `Sei il REVISORE. Controlla il lavoro fatto su questo compito.

COMPITO: ${c.titolo}
${c.descrizione}

RIEPILOGO DI CHI HA LAVORATO:
${riepilogo.slice(-3000)}

${diff ? `MODIFICHE AI FILE:\n${diff}` : 'Il progetto non usa git: verifica leggendo i file indicati nel riepilogo.'}

Regole importanti:
- Segnala SOLO problemi concreti e verificabili: errori, file mancanti, richieste del compito non soddisfatte.
${conVerifica ? '- Puoi LANCIARE comandi di sola verifica (i test, node file.js, python3 file.py, un controllo di sintassi) per vedere se funziona davvero: non fidarti del riepilogo. NON modificare i file.\n' : ''}${parallelo ? '- Altri compiti stanno lavorando in parallelo su altri file: nelle modifiche puoi vedere anche le loro. Giudica solo ciò che riguarda questo compito.\n' : ''}- Se non riesci a leggere o a verificare qualcosa, NON è un errore di chi ha lavorato: scrivi ESITO: OK e annota cosa non hai potuto verificare.
- Non riscrivere il lavoro e non proporre stili alternativi: non è il tuo compito.

La prima riga deve essere esattamente "ESITO: OK" oppure "ESITO: CORREGGI". Poi al massimo 5 punti brevi.`;

const promptCorrezioneBreve = (note) =>
  `Il revisore ha segnalato questi problemi. Correggi SOLO questi, non rifare il resto del lavoro:\n${note}\n\nAlla fine scrivi in breve cosa hai corretto.`;

const promptCorrezioneCompleta = (c, piano, note, cwd, ctx) =>
  `${c.tipo === 'comando' ? promptOperatore(c, piano, cwd, ctx) : promptEsecutore(c, piano, cwd, ctx)}\n\nIl lavoro è già stato fatto una volta. Il revisore ha segnalato questi problemi: correggi SOLO questi.\n${note}`;

// ---------- lettura delle risposte ----------

function estraiJson(testo) {
  const m = (testo || '').match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

function estraiCompiti(testo) {
  const j = estraiJson(testo);
  if (!j || !Array.isArray(j.compiti)) return null;
  return j.compiti
    .filter((c) => c && c.titolo)
    .map((c) => ({
      titolo: String(c.titolo).slice(0, 80),
      descrizione: String(c.descrizione || c.titolo),
      tipo: c.tipo === 'analisi' ? 'analisi' : c.tipo === 'comando' ? 'comando' : 'codice',
      esecutore: c.esecutore,
      dipende: Array.isArray(c.dipende) ? c.dipende.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n >= 1) : [],
    }));
}

function estraiDomanda(testo) {
  const j = estraiJson(testo);
  if (!j || typeof j.domanda !== 'string' || !Array.isArray(j.opzioni) || j.opzioni.length < 2) return null;
  return { testo: j.domanda.slice(0, 400), opzioni: j.opzioni.slice(0, 4).map((o) => String(o).slice(0, 120)) };
}

function leggiEsito(testo) {
  const m = (testo || '').match(/ESITO:\s*(OK|CORREGGI)/i);
  const note = (testo || '').replace(/ESITO:\s*(OK|CORREGGI)/i, '').trim();
  return { esito: m ? m[1].toUpperCase() : 'OK', note: m ? note : `(esito non chiaro) ${note}`.trim() };
}

async function revisiona(compito, esecuzione, ctx, indice, scrivi, parallelo) {
  ctx.ui.titolo(`REVISIONE — ${compito.titolo}`);
  const conVerifica = ctx.config.revisoreVerifica !== false;
  const r = await eseguiRuolo('revisore', promptRevisore(compito, esecuzione.testo, diffProgetto(ctx.cwd), conVerifica, parallelo), ctx, {
    modalita: 'verifica',
    compito: indice,
    evita: ctx.config.revisoreIndipendente === false ? null : esecuzione.ia, // occhi nuovi, se possibile
    scrivi,
  });
  if (!r.ok) return { esito: 'NON VERIFICATO', note: r.errore, ia: null };
  const v = { ...leggiEsito(r.testo), ia: r.ia };
  ctx.ui.pensiero?.('revisione', `${compito.titolo}\nESITO: ${v.esito}\n${v.note}`);
  return v;
}

// Quando più compiti scrivono insieme, ogni riga porta il numero del suo compito.
function scrittoreCompito(ui, i, attivo) {
  if (!attivo) return ui.out;
  const pre = `│${i + 1} `;
  let inizioRiga = true;
  return (t) => {
    const s = String(t);
    let out = s.replace(/\n(?=[^\n])/g, '\n' + pre);
    if (inizioRiga && s.length) out = pre + out;
    inizioRiga = s.endsWith('\n');
    ui.out(out);
  };
}

// ---------- il flusso completo ----------

export async function eseguiRichiesta({ richiesta, ctx }) {
  const { ui, config, stato } = ctx;
  const inizio = Date.now();

  ui.pensiero?.('richiesta', richiesta);
  ctx.tel?.nuovaRichiesta(richiesta);
  ui.titolo('DIRETTORE — divido il lavoro');
  let d = await eseguiRuolo('direttore', promptDirettore(richiesta, ctx), ctx, { modalita: 'lettura', mostra: false });
  let compiti = d.ok ? estraiCompiti(d.testo) : null;

  // con /chiedi il direttore può fare una domanda: la risposta entra nella richiesta e si riparte
  if (ctx.chiedi && d.ok && !compiti?.length) {
    const domanda = estraiDomanda(d.testo);
    if (domanda && ui.domanda) {
      ui.out(`? ${domanda.testo}\n${domanda.opzioni.map((o, i) => `   [${i + 1}] ${o}`).join('\n')}\n`);
      const scelta = await ui.domanda(domanda);
      ctx.rispostaUtente = scelta ? `alla domanda "${domanda.testo}" ha scelto: ${scelta}` : 'nessuna risposta: decidi tu nel modo più sensato';
      ui.out(scelta ? `   → ${scelta}\n` : '   → decide il direttore\n');
      ctx.chiedi = false;
      ui.titolo('DIRETTORE — divido il lavoro');
      d = await eseguiRuolo('direttore', promptDirettore(richiesta, ctx), ctx, { modalita: 'lettura', mostra: false });
      compiti = d.ok ? estraiCompiti(d.testo) : null;
    }
  }
  if (!compiti?.length) {
    ui.log('⚠ il direttore non ha dato un piano valido: lavoro sulla richiesta intera', { tipo: 'avviso' });
    compiti = [{ titolo: richiesta.slice(0, 60), descrizione: richiesta, tipo: 'codice', dipende: [] }];
  }
  compiti = compiti.slice(0, config.maxCompiti || 5);
  // dipendenze: solo verso compiti che esistono e vengono prima (niente cicli)
  compiti.forEach((c, i) => { c.dipende = (c.dipende || []).map((n) => n - 1).filter((j) => j >= 0 && j < i); });
  const parallelo = Math.max(1, Math.min(4, Number(config.parallelo) || 1));
  compiti.forEach((c, i) => ui.out(`  ${i + 1}. ${c.titolo}  [${c.tipo}${c.esecutore ? ' → ' + c.esecutore : ''}${c.dipende.length ? ' · dopo ' + c.dipende.map((j) => j + 1).join(',') : ''}]\n`));
  const statoCompiti = compiti.map((c) => ({ titolo: c.titolo, stato: 'attesa', dipende: c.dipende.map((j) => j + 1) }));
  const segna = (i, s) => {
    statoCompiti[i].stato = s;
    ui.compiti?.([...statoCompiti]);
    ctx.tel?.compiti(statoCompiti);
    if (s !== 'lavoro') ui.notifica?.(`${s === 'ok' ? '✔' : s === 'errore' ? '✖' : '⚠'} ${i + 1}. ${statoCompiti[i].titolo}`, s);
  };
  ui.compiti?.([...statoCompiti]);
  ui.pensiero?.('compiti', compiti.map((c, i) => `${i + 1}. ${c.titolo}${c.esecutore ? '  → ' + c.esecutore : ''}${c.tipo === 'comando' ? '  (operatore)' : ''}${c.dipende.length ? '  dopo ' + c.dipende.map((j) => j + 1).join(', ') : ''}\n   ${c.descrizione}`).join('\n'));

  const esiti = new Array(compiti.length).fill(null);
  const insieme = parallelo > 1 && compiti.length > 1;

  // un compito dall'inizio alla fine: piano → esecuzione (o comando) → revisione → correzioni
  const lavora = async (i) => {
    const c = compiti[i];
    const scrivi = scrittoreCompito(ui, i, insieme);
    ui.titolo(`COMPITO ${i + 1}/${compiti.length} — ${c.titolo}`);
    segna(i, 'lavoro');
    let testoPiano = '(nessun piano: procedi direttamente sul compito)';
    if (config.usaPianificatore !== false) {
      const piano = await eseguiRuolo('pianificatore', promptPiano(c, ctx.cwd, ctx), ctx, { modalita: 'lettura', compito: i, scrivi });
      if (piano.ok) testoPiano = piano.testo;
      ui.pensiero?.('piano', `${c.titolo}\n${testoPiano}`);
    } else {
      ui.ruolo('pianificatore', 'saltato', null);
    }

    const comando = c.tipo === 'comando';
    ui.titolo(`${comando ? 'OPERATORE' : 'ESECUZIONE'} — ${c.titolo}`);
    const chiave = `esecutore-${Date.now()}-${i}`;
    const modalita = comando ? 'comando' : c.tipo === 'codice' ? 'scrittura' : 'lettura';
    const ruolo = comando ? 'operatore' : 'esecutore';
    const prompt = comando ? promptOperatore(c, testoPiano, ctx.cwd, ctx) : promptEsecutore(c, testoPiano, ctx.cwd, ctx);
    let es = await eseguiRuolo(ruolo, prompt, ctx, { chiaveSessione: chiave, modalita, preferisci: c.esecutore, compito: i, scrivi });
    ui.aggiornaFile?.();
    if (!es.ok) {
      esiti[i] = { c, esito: 'FALLITO', note: es.errore };
      segna(i, 'errore');
      return;
    }

    let rev = { esito: 'OK', note: '(revisione disattivata)', ia: null };
    if (config.usaRevisore !== false) rev = await revisiona(c, es, ctx, i, scrivi, insieme);
    else ui.ruolo('revisore', 'saltato', null);
    let correzioni = 0;
    while (config.usaRevisore !== false && rev.esito === 'CORREGGI' && correzioni < (config.maxCorrezioni ?? 1)) {
      correzioni++;
      ui.titolo(`CORREZIONE ${correzioni} — ${c.titolo}`);
      // Se l'IA sa riprendere la sessione le mandiamo SOLO le correzioni, non il prompt intero.
      const es2 = await eseguiRuolo(ruolo, promptCorrezioneCompleta(c, testoPiano, rev.note, ctx.cwd, ctx), ctx, {
        chiaveSessione: chiave,
        riprendi: true,
        promptBreve: promptCorrezioneBreve(rev.note),
        modalita,
        preferisci: es.ia,
        compito: i,
        scrivi,
      });
      ui.aggiornaFile?.();
      if (!es2.ok) break;
      es = es2;
      rev = await revisiona(c, es, ctx, i, scrivi, insieme);
    }
    esiti[i] = { c, esito: rev.esito, note: rev.note, esecutore: es.ia, revisore: rev.ia };
    segna(i, rev.esito === 'OK' ? 'ok' : 'avviso');
  };

  // la regia: parte tutto ciò che è pronto, fino al limite di compiti insieme
  const inCorso = new Set();
  const finito = (i) => ['ok', 'avviso', 'errore', 'saltato'].includes(statoCompiti[i].stato);
  const riuscito = (i) => ['ok', 'avviso'].includes(statoCompiti[i].stato);
  while (statoCompiti.some((s) => s.stato === 'attesa') || inCorso.size) {
    const pronti = compiti.map((c, i) => i).filter((i) => statoCompiti[i].stato === 'attesa' && compiti[i].dipende.every(riuscito));
    while (inCorso.size < parallelo && pronti.length) {
      const i = pronti.shift();
      const p = lavora(i).catch((e) => { esiti[i] = { c: compiti[i], esito: 'FALLITO', note: e.message }; segna(i, 'errore'); }).finally(() => inCorso.delete(p));
      inCorso.add(p);
      if (insieme && inCorso.size > 1) ui.log(`⇉ ${inCorso.size} compiti lavorano insieme`, { tipo: 'info' });
    }
    if (!inCorso.size) {
      // nessun compito pronto: quelli in attesa hanno una dipendenza fallita
      let cambiato = false;
      compiti.forEach((c, i) => {
        if (statoCompiti[i].stato === 'attesa' && c.dipende.some((j) => finito(j) && !riuscito(j))) {
          statoCompiti[i].stato = 'saltato';
          esiti[i] = { c, esito: 'SALTATO', note: `dipende dal compito ${c.dipende.filter((j) => !riuscito(j)).map((j) => j + 1).join(', ')} che non è riuscito` };
          ui.compiti?.([...statoCompiti]);
          cambiato = true;
        }
      });
      if (!cambiato) break;
      continue;
    }
    await Promise.race(inCorso);
  }

  // ---------- riepilogo e diario ----------
  const secondi = Math.round((Date.now() - inizio) / 1000);
  const durata = secondi >= 60 ? `${Math.floor(secondi / 60)}m ${secondi % 60}s` : `${secondi}s`;
  ui.titolo('RIEPILOGO');
  const icona = { OK: '✔', CORREGGI: '⚠', FALLITO: '✖', 'NON VERIFICATO': '?', SALTATO: '·' };
  const lista = esiti.map((e, i) => e || { c: compiti[i], esito: 'FALLITO', note: 'non eseguito' });
  for (const [i, e] of lista.entries()) {
    const chi = e.esecutore ? ` (${e.esecutore}${e.revisore ? ' → ' + e.revisore : ''})` : '';
    const nota = e.esito === 'OK' ? '' : `: ${String(e.note || '').split('\n')[0].slice(0, 120)}`;
    ui.out(`  ${icona[e.esito] || '·'} ${i + 1}. ${e.c.titolo} — ${e.esito}${chi}${nota}\n`);
  }
  ui.out(`  tempo: ${durata}${insieme ? '  (compiti in parallelo)' : ''}\n`);

  const data = new Date().toISOString().slice(0, 16).replace('T', ' ');
  stato.annota(
    `## ${data} — ${richiesta.slice(0, 120)}\n` +
      lista
        .map((e) => `- [${e.esito}] ${e.c.titolo}${e.esecutore ? ` (${e.c.tipo === 'comando' ? 'operatore' : 'esecutore'}: ${e.esecutore}, revisore: ${e.revisore || '—'})` : ''}`)
        .join('\n')
  );
  return lista;
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
  return estraiJson(r.testo);
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
  const j = estraiJson(r.testo);
  if (!j) return null;
  const fatto = { riassunto: false, soluzione: null, preferenze: [] };
  if (typeof j.riassunto === 'string' && j.riassunto.trim()) { ctx.stato.salvaRiassunto(j.riassunto); fatto.riassunto = true; }
  if (j.soluzione?.titolo && j.soluzione?.testo) {
    try { fatto.soluzione = await aggiungiSoluzione({ ...j.soluzione, tag: j.soluzione.tag || [], progetto }); } catch { /* */ }
  }
  for (const p of Array.isArray(j.preferenze) ? j.preferenze.slice(0, 3) : []) if (typeof p === 'string' && ricorda(p)) fatto.preferenze.push(p);
  return fatto;
}
