// Prove automatiche degli strumenti esterni: menzioni @, argomenti MCP per Claude,
// percorsi con la ~, copia delle schede predefinite, e la scelta dell'IA quando la
// richiesta usa uno strumento (Claude per primo) con la frase in più per il revisore.
// Si lanciano con:  npm test     (oppure  node --test test/strumenti.test.mjs)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  trovaMenzioni,
  togliMenzioni,
  argomentiMcp,
  espandiPercorso,
  strumentoPerId,
  copiaSchedePredefinite,
} from '../src/strumenti.js';
import {
  candidati,
  ordinaPerStrumenti,
  promptRevisore,
  uniscoArgs,
  estraiComandiDaConfermare,
  TITOLO_CONFERMA,
} from '../src/director.js';

// La cartella di questa prova e quella delle schede che KORTEX porta con sé.
// Si ricavano dal file, così le prove funzionano da qualunque cartella si lanci npm test.
const QUI = path.dirname(fileURLToPath(import.meta.url));
const SCHEDE = path.join(QUI, '..', 'strumenti');

// a) @blender dentro una frase vera: viene riconosciuto e torna la sua scheda.
test('riconosce @blender dentro una frase', () => {
  const trovati = trovaMenzioni('fai un cubo con @blender e salva il file', SCHEDE);
  assert.equal(trovati.length, 1);
  assert.equal(trovati[0].id, 'blender');
  assert.equal(trovati[0].nome, 'Blender');
});

// b) una @ che non è uno strumento (per esempio una voce del database) si ignora,
// e in una frase con tutte e due resta solo lo strumento vero.
test('una @ sconosciuta viene ignorata', () => {
  assert.equal(trovaMenzioni('guarda @pippo per favore', SCHEDE).length, 0);
  const misti = trovaMenzioni('apri @blender e leggi @pippo', SCHEDE);
  assert.equal(misti.length, 1);
  assert.equal(misti[0].id, 'blender');
});

// c) la parola @blender sparisce dal testo e il resto resta leggibile:
// niente spazi doppi e niente spazi ai bordi.
test('togliMenzioni toglie la parola @blender e lascia il testo pulito', () => {
  const frase = 'fai un cubo con @blender e salva il file';
  const strumenti = trovaMenzioni(frase, SCHEDE);
  const pulito = togliMenzioni(frase, strumenti);
  assert.equal(pulito, 'fai un cubo con e salva il file');
  assert.equal(pulito.includes('@blender'), false);
  assert.equal(pulito.includes('  '), false);
  assert.equal(pulito, pulito.trim());
});

// d) gli argomenti che Claude riceve sulla riga di comando: il JSON si controlla
// leggendolo con JSON.parse, non confrontando stringhe (l'ordine delle chiavi
// e gli spazi non contano).
test('argomentiMcp costruisce la configurazione MCP per Claude', () => {
  const blender = strumentoPerId('blender', SCHEDE);
  assert.notEqual(blender, null);
  const argomenti = argomentiMcp([blender]);
  assert.equal(argomenti.length, 4);
  assert.equal(argomenti[0], '--mcp-config');
  assert.equal(argomenti[2], '--allowedTools');
  assert.equal(argomenti[3], 'mcp__blender');

  const conf = JSON.parse(argomenti[1]);
  const server = conf.mcpServers.blender;
  assert.ok(server, 'nella configurazione deve esserci il server blender');
  assert.equal(typeof server.command, 'string');
  assert.ok(server.command.length > 0, 'il comando non deve essere vuoto');
  assert.ok(Array.isArray(server.args), 'gli argomenti devono essere un elenco');
  // nelle schede i percorsi hanno la ~ davanti: qui devono essere già aperti
  for (const a of server.args) assert.equal(a.startsWith('~'), false);
});

// e) senza strumenti, o con uno strumento che non ha un server MCP, non si aggiunge niente.
test('senza strumenti MCP non si aggiunge nessun argomento', () => {
  assert.deepEqual(argomentiMcp([]), []);
  assert.deepEqual(argomentiMcp(null), []);
  assert.deepEqual(argomentiMcp([{ id: 'finto', nome: 'Finto' }]), []);
});

// f) la ~ all'inizio diventa la cartella di casa; tutto il resto resta com'è.
test('espandiPercorso apre solo la ~ iniziale', () => {
  assert.equal(espandiPercorso('~/roba'), path.join(os.homedir(), 'roba'));
  assert.equal(espandiPercorso('~'), os.homedir());
  assert.equal(espandiPercorso('/usr/bin/uv'), '/usr/bin/uv');
  assert.equal(espandiPercorso('run --dir ~/cosa'), 'run --dir ~/cosa');
  assert.equal(espandiPercorso('ciao~mondo'), 'ciao~mondo');
  assert.equal(espandiPercorso(undefined), undefined);
  assert.equal(espandiPercorso(7), 7);
});

// g) la copia delle schede predefinite: non deve mai sovrascrivere una scheda
// che l'utente ha già (e invece in una cartella vuota deve copiarla davvero).
// Le cartelle temporanee le crea e le cancella questa prova stessa, dentro test/.
test('copiaSchedePredefinite non sovrascrive le schede già presenti', () => {
  const mia = path.join(QUI, 'tmp-strumenti-mia');
  const vuota = path.join(QUI, 'tmp-strumenti-vuota');
  try {
    // una scheda finta con dentro una scritta riconoscibile
    fs.mkdirSync(mia, { recursive: true });
    const finta = '{"id":"blender","nome":"MIA SCHEDA DA NON TOCCARE"}';
    fs.writeFileSync(path.join(mia, 'blender.json'), finta, 'utf8');

    const copiati = copiaSchedePredefinite({ origine: SCHEDE, destinazione: mia });
    assert.equal(copiati.includes('blender.json'), false);
    const dopo = fs.readFileSync(path.join(mia, 'blender.json'), 'utf8');
    assert.ok(dopo.includes('MIA SCHEDA DA NON TOCCARE'), 'la scheda dell utente deve restare');

    // nella cartella vuota, invece, la scheda arriva
    fs.mkdirSync(vuota, { recursive: true });
    const nuovi = copiaSchedePredefinite({ origine: SCHEDE, destinazione: vuota });
    assert.ok(nuovi.includes('blender.json'), 'in una cartella vuota la scheda va copiata');
    assert.equal(fs.existsSync(path.join(vuota, 'blender.json')), true);
  } finally {
    // la pulizia avviene anche se una verifica è andata male
    fs.rmSync(mia, { recursive: true, force: true });
    fs.rmSync(vuota, { recursive: true, force: true });
  }
});

// ---------- la scelta dell'IA quando c'è uno strumento ----------

// Un contesto finto, con gli stessi elenchi di config.default.json: non lancia
// nessuna IA, serve solo a far scegliere la lista dei candidati.
function ctxFinto({ claudeOk = true, claudeLimitato = false, strumenti = false } = {}) {
  return {
    config: {
      ruoli: {
        esecutore: ['claude', 'codex'],
        operatore: ['claude', 'codex'],
        revisore: ['codex', 'claude', 'gemini', 'ollama'],
        pianificatore: ['claude', 'codex', 'gemini', 'ollama'],
      },
      ia: { claude: {}, codex: {}, gemini: {}, ollama: {} },
    },
    disponibili: {
      claude: { ok: claudeOk, limitato: claudeLimitato },
      codex: { ok: true },
      gemini: { ok: true },
      ollama: { ok: true },
    },
    // con gli strumenti, KORTEX ha già preparato gli argomenti MCP per Claude
    argsMcp: strumenti ? ['--mcp-config', '{}', '--allowedTools', 'mcp__blender'] : [],
  };
}

// h) senza strumenti l'ordine è quello di sempre: per il revisore codex resta primo.
test('senza strumenti l ordine dei candidati non cambia', () => {
  const ctx = ctxFinto();
  assert.deepEqual(candidati('revisore', ctx), ['codex', 'claude', 'gemini', 'ollama']);
  assert.deepEqual(candidati('esecutore', ctx), ['claude', 'codex']);
  assert.deepEqual(candidati('operatore', ctx), ['claude', 'codex']);
});

// i) con uno strumento MCP Claude va in testa e le altre restano in coda
// nello stesso ordine di prima, come riserva.
test('con gli strumenti claude va in testa', () => {
  const ctx = ctxFinto({ strumenti: true });
  assert.deepEqual(candidati('revisore', ctx), ['claude', 'codex', 'gemini', 'ollama']);
  assert.deepEqual(candidati('esecutore', ctx), ['claude', 'codex']);
  assert.deepEqual(candidati('operatore', ctx), ['claude', 'codex']);
});

// l) se Claude è al limite o non è installato, l'ordine resta quello di sempre
// (e Claude non compare affatto, perché il filtro lo toglie).
test('con gli strumenti ma claude al limite o assente l ordine non cambia', () => {
  const alLimite = ctxFinto({ strumenti: true, claudeLimitato: true });
  assert.deepEqual(candidati('revisore', alLimite), ['codex', 'gemini', 'ollama']);
  assert.deepEqual(candidati('esecutore', alLimite), ['codex']);

  const assente = ctxFinto({ strumenti: true, claudeOk: false });
  assert.deepEqual(candidati('revisore', assente), ['codex', 'gemini', 'ollama']);
  assert.deepEqual(candidati('operatore', assente), ['codex']);
});

// m) gli altri ruoli non cambiano mai, nemmeno con gli strumenti.
test('un ruolo diverso non cambia ordine con gli strumenti', () => {
  const ctx = ctxFinto({ strumenti: true });
  assert.deepEqual(candidati('pianificatore', ctx), ['claude', 'codex', 'gemini', 'ollama']);
  assert.deepEqual(
    ordinaPerStrumenti(['codex', 'claude'], 'direttore', true),
    ['codex', 'claude']
  );
});

// n) con gli strumenti Claude passa davanti anche a "evita" (gli occhi nuovi del
// revisore): senza strumenti invece "evita" comanda come prima.
test('con gli strumenti claude vince anche su evita', () => {
  const ctx = ctxFinto({ strumenti: true });
  assert.deepEqual(candidati('revisore', ctx, { evita: 'claude' }), ['claude', 'codex', 'gemini', 'ollama']);
  const senza = ctxFinto();
  assert.deepEqual(candidati('revisore', senza, { evita: 'codex' }), ['claude', 'gemini', 'ollama', 'codex']);
});

// o) la frase in più per il revisore compare solo quando ci sono strumenti.
test('il prompt del revisore parla dello strumento solo con gli strumenti', () => {
  const compito = { titolo: 'prova', descrizione: 'una prova' };
  const conStrumenti = promptRevisore(compito, 'riepilogo', '', true, false, true);
  const senzaStrumenti = promptRevisore(compito, 'riepilogo', '', true, false, false);
  assert.ok(conStrumenti.includes('usando lo strumento stesso'), 'con gli strumenti la frase ci deve essere');
  assert.ok(conStrumenti.includes('mcp__blender'), 'la frase nomina gli strumenti mcp__blender');
  assert.equal(senzaStrumenti.includes('usando lo strumento stesso'), false);
  assert.equal(senzaStrumenti.includes('mcp__blender'), false);
  // senza strumenti il testo è identico a quello di prima (nessun parametro passato)
  assert.equal(senzaStrumenti, promptRevisore(compito, 'riepilogo', '', true, false));
});

// ---------- 2.4.0: registro degli usi, problemi della scheda, campi nuovi ----------
import { registraUso, usiStrumento, problemiScheda, caricaStrumenti as carica240 } from '../src/strumenti.js';

test('registraUso tiene le azioni più recenti per prime e conta quelle di oggi', () => {
  const file = path.join(QUI, 'tmp-uso.json');
  try {
    registraUso('blender', { chi: 'squadra', cosa: 'crea   un tavolo' }, file);
    registraUso('blender', { chi: 'tu', cosa: 'app avviata' }, file);
    const u = usiStrumento('blender', file);
    assert.equal(u.ultime[0].cosa, 'app avviata');
    assert.equal(u.ultime[1].cosa, 'crea un tavolo');
    assert.equal(u.oggi, 2);
    assert.equal(usiStrumento('nessuno', file).oggi, 0);
  } finally { fs.rmSync(file, { force: true }); }
});

test('problemiScheda trova il programma e la cartella che mancano', () => {
  const p = problemiScheda({ nome: 'X', mcp: { command: 'programma-che-non-esiste-kortex', args: ['--directory', '/cartella/che/non/esiste'] }, avvia: 'altro-programma-inesistente --x' });
  assert.equal(p.length, 3);
  assert.deepEqual(problemiScheda({ nome: 'Y', mcp: { command: 'node', args: [] } }), []);
});

test('una scheda utente senza campi nuovi li riceve dalla predefinita senza perdere i suoi', () => {
  const mia = path.join(QUI, 'tmp-strumenti-campi');
  try {
    fs.mkdirSync(mia, { recursive: true });
    fs.writeFileSync(path.join(mia, 'blender.json'), '{"id":"blender","nome":"Il mio Blender","permessi":"lettura"}');
    const s = carica240(mia)[0];
    assert.equal(s.nome, 'Il mio Blender');
    assert.equal(s.permessi, 'lettura');
    assert.equal(s.avvia, 'blender');
    assert.equal(s.tasto, 'b');
  } finally { fs.rmSync(mia, { recursive: true, force: true }); }
});

// ---------- 2.5.0: scheda GitHub, stato di tipo comando, regole Bash ----------
import {
  statoConDettaglio,
  svuotaCacheStato,
  argomentiBash,
  BLOCCO_BASH,
  controllaStato,
} from '../src/strumenti.js';

// La scheda GitHub che KORTEX porta con sé: i campi che contano e un'icona stretta davvero.
test('la scheda github ha i campi giusti e un icona larga uno', () => {
  const gh = strumentoPerId('github', SCHEDE);
  assert.notEqual(gh, null);
  assert.equal(gh.nome, 'GitHub');
  assert.equal(gh.tasto, 'g');
  assert.equal(gh.permessi, 'conferma');
  assert.equal(gh.avvia, 'xdg-open https://github.com');
  assert.equal(gh.stato.tipo, 'comando');
  assert.equal(gh.stato.comando, 'gh auth status');
  assert.equal(gh.stato.mostra, 'gh api user -q .login');
  // l'icona deve essere un solo carattere ASCII: così il terminale e Ink la contano uguale
  assert.equal(gh.icona.length, 1);
  assert.ok(/^[\x20-\x7e]$/.test(gh.icona), 'l icona deve essere ASCII, niente simboli larghi due');
  // il contesto dice le cose che non si devono indovinare
  assert.ok(gh.contesto.includes('gh api user -q .login'));
  assert.ok(gh.contesto.includes('gh auth'));
  assert.ok(gh.contesto.includes('COMANDI DA CONFERMARE'));
  assert.ok(gh.contesto.includes('token'));
  // le regole bash ci sono in tutte e due le liste
  assert.ok(gh.bash.lettura.includes('Bash(gh repo view:*)'));
  assert.ok(gh.bash.lettura.includes('Bash(git status:*)'));
  assert.deepEqual(gh.bash.scrittura, ['Bash(gh:*)', 'Bash(git:*)']);
});

// Lo stato di tipo comando: 0 = acceso, codice diverso = spento, programma assente = sconosciuto.
test('lo stato di tipo comando legge il codice di uscita', async () => {
  const acceso = await statoConDettaglio({ stato: { tipo: 'comando', comando: 'true' } });
  assert.equal(acceso.acceso, true);
  const spento = await statoConDettaglio({ stato: { tipo: 'comando', comando: 'false' } });
  assert.equal(spento.acceso, false);
  const assente = await statoConDettaglio({ stato: { tipo: 'comando', comando: 'programma-che-non-esiste-kortex' } });
  assert.equal(assente.acceso, null);
  // una scheda senza stato, o con uno stato sbagliato, non deve mai far saltare niente
  assert.equal((await statoConDettaglio({})).acceso, null);
  assert.equal((await statoConDettaglio(null)).acceso, null);
  assert.equal((await statoConDettaglio({ stato: { tipo: 'comando' } })).acceso, null);
  assert.equal((await statoConDettaglio({ stato: { tipo: 'inventato' } })).acceso, null);
  // controllaStato dà solo il sì/no, come prima
  assert.equal(await controllaStato({ stato: { tipo: 'comando', comando: 'true' } }), true);
});

// Un comando che non finisce viene ucciso dopo tre secondi e lo strumento risulta spento.
test('un comando che non finisce vale spento', async () => {
  const inizio = Date.now();
  const r = await statoConDettaglio({ stato: { tipo: 'comando', comando: 'sleep 9' } });
  assert.equal(r.acceso, false);
  assert.ok(Date.now() - inizio < 8000, 'non deve aspettare la fine del comando');
});

// Il campo "mostra": solo la prima riga, ripulita e tagliata se è troppo lunga.
test('mostra dà la prima riga dell output, tagliata se è lunga', async () => {
  const cartella = path.join(QUI, 'tmp-stato-mostra');
  try {
    fs.mkdirSync(cartella, { recursive: true });
    fs.writeFileSync(path.join(cartella, 'aaa.txt'), '');
    fs.writeFileSync(path.join(cartella, 'bbb.txt'), '');
    const r = await statoConDettaglio({ stato: { tipo: 'comando', comando: 'true', mostra: `ls -1 ${cartella}` } });
    assert.equal(r.acceso, true);
    assert.equal(r.dettaglio, 'aaa.txt', 'solo la prima riga');

    // una riga lunghissima viene tagliata a 40 caratteri
    const lunga = path.join(QUI, 'tmp-stato-lunga');
    fs.mkdirSync(lunga, { recursive: true });
    fs.writeFileSync(path.join(lunga, 'nome-di-file-molto-molto-lungo-che-non-sta-in-una-tessera.txt'), '');
    const t = await statoConDettaglio({ stato: { tipo: 'comando', comando: 'true', mostra: `ls -1 ${lunga}` } });
    assert.equal(t.dettaglio.length, 40);
    assert.ok(t.dettaglio.endsWith('…'));
    fs.rmSync(lunga, { recursive: true, force: true });

    // se "mostra" non funziona, lo stato resta buono e il dettaglio non c'è
    const senza = await statoConDettaglio({ stato: { tipo: 'comando', comando: 'true', mostra: 'programma-che-non-esiste-kortex' } });
    assert.equal(senza.acceso, true);
    assert.equal(senza.dettaglio, undefined);
  } finally {
    fs.rmSync(cartella, { recursive: true, force: true });
  }
});

// Il risultato si tiene da parte 30 secondi: il comando non si rilancia a ogni aggiornamento,
// e CONTROLLA (svuotaCacheStato) fa rifare la prova subito.
test('il risultato resta in cache finché non si svuota', async () => {
  const cartella = path.join(QUI, 'tmp-stato-cache');
  try {
    fs.mkdirSync(cartella, { recursive: true });
    fs.writeFileSync(path.join(cartella, 'primo.txt'), '');
    const stato = { tipo: 'comando', comando: 'true', mostra: `ls -1 ${cartella}` };
    const prima = await statoConDettaglio({ stato });
    assert.equal(prima.dettaglio, 'primo.txt');

    // cambio il mondo sotto: finché la cache vale, la risposta deve restare quella di prima
    fs.rmSync(path.join(cartella, 'primo.txt'));
    fs.writeFileSync(path.join(cartella, 'dopo.txt'), '');
    const ancora = await statoConDettaglio({ stato });
    assert.equal(ancora.dettaglio, 'primo.txt', 'il comando non deve essere rilanciato');

    // svuotata la cache, la prova si rifà davvero
    svuotaCacheStato();
    const nuova = await statoConDettaglio({ stato });
    assert.equal(nuova.dettaglio, 'dopo.txt');

    // si può svuotare anche solo uno strumento, e senza niente da svuotare non si lamenta
    svuotaCacheStato({ stato });
    svuotaCacheStato('chiave-che-non-esiste');
    assert.equal((await statoConDettaglio({ stato })).dettaglio, 'dopo.txt');
  } finally {
    fs.rmSync(cartella, { recursive: true, force: true });
    svuotaCacheStato();
  }
});

// argomentiBash: la forma provata sulla CLI è una sola opzione con le regole separate da virgola.
test('argomentiBash dà le regole di lettura e la lista dei divieti', () => {
  const gh = strumentoPerId('github', SCHEDE);
  const args = argomentiBash([gh]);
  assert.equal(args.length, 4);
  assert.equal(args[0], '--allowedTools');
  assert.equal(args[2], '--disallowedTools');
  // solo lettura fra i permessi, e niente spazi dopo le virgole
  assert.ok(args[1].includes('Bash(gh repo view:*)'));
  assert.equal(args[1].includes('Bash(gh:*)'), false);
  assert.equal(args[1].includes(', '), false);
  assert.deepEqual(args[1].split(','), gh.bash.lettura);
  // la lista dei divieti è quella intera, nello stesso ordine
  assert.deepEqual(args[3].split(','), BLOCCO_BASH);
  assert.ok(args[3].includes('Bash(git push:*)'));
  assert.ok(args[3].includes('Bash(gh api --method:*)'));

  // con i permessi di sola lettura cambia niente: il recinto serve lo stesso
  const soloLettura = argomentiBash([{ ...gh, permessi: 'lettura' }]);
  assert.deepEqual(soloLettura, args);
});

test('con i permessi liberi argomentiBash non mette divieti', () => {
  const gh = strumentoPerId('github', SCHEDE);
  const args = argomentiBash([{ ...gh, permessi: 'libero' }]);
  assert.equal(args.length, 2);
  assert.equal(args[0], '--allowedTools');
  assert.equal(args.includes('--disallowedTools'), false);
  const regole = args[1].split(',');
  assert.ok(regole.includes('Bash(gh:*)'));
  assert.ok(regole.includes('Bash(git:*)'));
  assert.ok(regole.includes('Bash(git status:*)'));
  // nessuna regola ripetuta
  assert.equal(new Set(regole).size, regole.length);
});

test('senza strumenti con comandi bash non si aggiunge nessun argomento', () => {
  assert.deepEqual(argomentiBash([]), []);
  assert.deepEqual(argomentiBash(null), []);
  assert.deepEqual(argomentiBash([{ id: 'finto', nome: 'Finto' }]), []);
  // blender non ha comandi bash: solo il server MCP
  assert.deepEqual(argomentiBash([strumentoPerId('blender', SCHEDE)]), []);
});

// Chi ha già la scheda in ~/.kortex-app riceve i campi nuovi dalla predefinita, anche dentro
// "stato", senza che il suo file venga toccato.
test('una scheda utente eredita stato comando, bash e contesto dalla predefinita', () => {
  const mia = path.join(QUI, 'tmp-strumenti-github');
  try {
    fs.mkdirSync(mia, { recursive: true });
    const suo = '{"id":"github","nome":"Il mio GitHub","stato":{"comando":"true"}}';
    fs.writeFileSync(path.join(mia, 'github.json'), suo);
    const s = carica240(mia)[0];
    // quello che ha scritto lui resta suo
    assert.equal(s.nome, 'Il mio GitHub');
    assert.equal(s.stato.comando, 'true');
    // quello che gli manca arriva dalla predefinita, anche dentro "stato"
    assert.equal(s.stato.tipo, 'comando');
    assert.equal(s.stato.mostra, 'gh api user -q .login');
    assert.equal(s.tasto, 'g');
    assert.equal(s.permessi, 'conferma');
    // le regole bash arrivano dalla predefinita di oggi, che è quella stretta:
    // "gh api" non c'è più (con --method scrive) e i comandi git sono solo quelli che leggono
    assert.ok(s.bash.lettura.includes('Bash(gh repo view:*)'));
    assert.equal(s.bash.lettura.includes('Bash(gh api:*)'), false);
    assert.ok(s.contesto.includes('COMANDI DA CONFERMARE'));
    // e il suo file non è stato riscritto
    assert.equal(fs.readFileSync(path.join(mia, 'github.json'), 'utf8'), suo);
  } finally { fs.rmSync(mia, { recursive: true, force: true }); }
});

// La menzione @github: viene riconosciuta come le altre, e in una frase con due strumenti
// ognuno porta solo i suoi argomenti (il server MCP per blender, le regole Bash per github).
test('riconosce @github e tiene separati gli argomenti dei due strumenti', () => {
  const trovati = trovaMenzioni('guarda le PR con @github', SCHEDE);
  assert.equal(trovati.length, 1);
  assert.equal(trovati[0].id, 'github');
  assert.equal(trovati[0].nome, 'GitHub');

  // la parola sparisce e il testo resta leggibile
  const frase = 'guarda le PR con @github e dimmi come va';
  const pulito = togliMenzioni(frase, trovaMenzioni(frase, SCHEDE));
  assert.equal(pulito, 'guarda le PR con e dimmi come va');
  assert.equal(pulito.includes('@github'), false);
  assert.equal(pulito.includes('  '), false);
  assert.equal(pulito, pulito.trim());

  // due strumenti nella stessa frase: tornano tutti e due
  const due = trovaMenzioni('apri @blender poi controlla @github', SCHEDE);
  assert.equal(due.length, 2);
  assert.deepEqual(due.map((s) => s.id).sort(), ['blender', 'github']);
  // il server MCP lo porta solo blender
  const mcp = argomentiMcp(due);
  assert.equal(mcp[3], 'mcp__blender');
  assert.equal(mcp[3].includes('github'), false);
  assert.equal(JSON.parse(mcp[1]).mcpServers.github, undefined);
  // le regole Bash le porta solo github
  const bash = argomentiBash(due);
  assert.ok(bash[1].includes('Bash(gh repo view:*)'));
  assert.equal(bash[1].includes('blender'), false);
});

// L'unione con il profilo di permessi dell'operatore, che ha già --allowedTools Bash:
// non si perde niente di quello che c'era e non si ripete niente.
test('gli argomenti degli strumenti si uniscono al profilo dell operatore senza doppioni', () => {
  const gh = strumentoPerId('github', SCHEDE);
  const blender = strumentoPerId('blender', SCHEDE);
  // il profilo vero, letto dal file: così se cambia la prova se ne accorge
  const config = JSON.parse(fs.readFileSync(path.join(QUI, '..', 'config.default.json'), 'utf8'));
  const profilo = config.profili.operatore.claude;
  assert.deepEqual(profilo, ['--permission-mode', 'acceptEdits', '--allowedTools', 'Bash']);

  const uniti = uniscoArgs(profilo, [...argomentiMcp([gh, blender]), ...argomentiBash([gh])]);

  // --allowedTools compare una volta sola
  assert.equal(uniti.filter((x) => x === '--allowedTools').length, 1);
  const regole = uniti[uniti.indexOf('--allowedTools') + 1].split(',');
  // c'è ancora quello che il profilo permetteva, più il server MCP e le regole di lettura
  assert.ok(regole.includes('Bash'), 'la regola del profilo non si deve perdere');
  assert.ok(regole.includes('mcp__blender'));
  assert.ok(regole.includes('Bash(gh repo view:*)'));
  assert.ok(regole.includes('Bash(git status:*)'));
  // nessuna regola ripetuta
  assert.equal(new Set(regole).size, regole.length);

  // il resto del profilo resta dov'era, nello stesso ordine
  assert.equal(uniti[0], '--permission-mode');
  assert.equal(uniti[1], 'acceptEdits');
  // il server MCP c'è una volta sola e i divieti sono tutti quelli del blocco
  assert.equal(uniti.filter((x) => x === '--mcp-config').length, 1);
  assert.equal(uniti.filter((x) => x === '--disallowedTools').length, 1);
  assert.deepEqual(uniti[uniti.indexOf('--disallowedTools') + 1].split(','), BLOCCO_BASH);

  // unire due volte di seguito non aggiunge niente di nuovo
  assert.deepEqual(uniscoArgs(uniti, argomentiBash([gh])), uniti);
});

// Il blocco COMANDI DA CONFERMARE: si legge dalla risposta e non si esegue niente.
// Solo stringhe: questa prova non lancia nessun processo.
test('estraiComandiDaConfermare legge i comandi e li ripulisce', () => {
  const risposta = [
    'Ho guardato il repo.',
    '',
    '## Riepilogo',
    'Tutto a posto.',
    '',
    TITOLO_CONFERMA,
    '- gh pr create --title "prova"',
    '1. `git push origin main`',
    '```',
    '$ gh release create v1',
    '```',
    '> gh pr merge 7',
    '- gh pr create --title "prova"',
    '',
    '## Note',
    'altro testo',
  ].join('\n');

  const { comandi, testo } = estraiComandiDaConfermare(risposta);
  // nell'ordine scritto, senza le decorazioni del markdown e senza doppioni
  assert.deepEqual(comandi, [
    'gh pr create --title "prova"',
    'git push origin main',
    'gh release create v1',
    'gh pr merge 7',
  ]);
  // il testo torna senza il blocco dei comandi
  assert.equal(testo, 'Ho guardato il repo.\n\n## Riepilogo\nTutto a posto.');
  assert.equal(testo.includes(TITOLO_CONFERMA), false);
  assert.equal(testo.includes('gh pr create'), false);

  // un titolo scritto con ** o con # davanti viene riconosciuto lo stesso
  assert.deepEqual(estraiComandiDaConfermare(`**${TITOLO_CONFERMA}**\n- gh pr list`).comandi, ['gh pr list']);
  assert.deepEqual(estraiComandiDaConfermare(`## ${TITOLO_CONFERMA}\n- gh pr list`).comandi, ['gh pr list']);

  // con due blocchi vale quello in fondo
  const due = estraiComandiDaConfermare(`${TITOLO_CONFERMA}\n- primo\n\n# ${TITOLO_CONFERMA}\n- secondo`);
  assert.deepEqual(due.comandi, ['secondo']);

  // senza quel titolo non si tocca niente
  const semplice = 'solo una risposta normale\nsenza comandi in fondo';
  assert.deepEqual(estraiComandiDaConfermare(semplice), { comandi: [], testo: semplice });
  assert.deepEqual(estraiComandiDaConfermare(''), { comandi: [], testo: '' });
  assert.deepEqual(estraiComandiDaConfermare(null), { comandi: [], testo: '' });
  assert.deepEqual(estraiComandiDaConfermare(undefined), { comandi: [], testo: '' });

  // un blocco senza comandi dentro torna vuoto, e il titolo resta un titolo
  assert.deepEqual(estraiComandiDaConfermare(`testo\n${TITOLO_CONFERMA}\n\n## Fine\ngh pr list`).comandi, []);
});

// ---------- la lista dei permessi vera: riga di comando ripulita, permesso più stretto,
// ---------- solo Claude e eredità della lista di lettura nuova ----------
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import {
  permessoBash,
  bashStretto,
  regoleLetturaStrumenti,
  spezzaRegole,
  ripulisciArgsClaude,
  messaggioServeClaude,
  DIVIETO_AUTH,
  BASH_GITHUB,
  BASH_GITHUB_2_5_0,
} from '../src/strumenti.js';

// I profili di permessi veri, letti da config.default.json: se cambiano, le prove se ne accorgono.
const CONFIG_VERO = JSON.parse(fs.readFileSync(path.join(QUI, '..', 'config.default.json'), 'utf8'));
const profiloVero = (nome) => CONFIG_VERO.profili[nome].claude;

// La scheda github vera con il permesso che serve alla prova (la scheda su disco non si tocca).
const ghCon = (permessi) => ({ ...strumentoPerId('github', SCHEDE), permessi });
// Uno strumento finto con una regola riconoscibile: serve a provare che le regole di chi non è
// nella richiesta non finiscono nella lista dei permessi.
const strumentoFinto = (permessi = 'lettura') => ({
  id: 'finto',
  nome: 'Finto',
  permessi,
  bash: { lettura: ['Bash(echo soloilfinto:*)'], scrittura: ['Bash(echo:*)'] },
});

// La riga di comando di Claude come la costruisce `argsDiRuolo` in src/director.js:
// profilo del ruolo + argomenti degli strumenti, e poi la ripulitura.
function argsClaudeCome(profilo, strumenti) {
  const dagliStrumenti = uniscoArgs(argomentiMcp(strumenti), argomentiBash(strumenti));
  return ripulisciArgsClaude(uniscoArgs(profilo, dagliStrumenti), strumenti);
}
// Il valore che sta subito dopo un'opzione (la posizione vera, non una ricerca nel testo).
const valoreDi = (args, opzione) => {
  const i = args.indexOf(opzione);
  return i < 0 ? null : args[i + 1];
};
const quante = (args, voce) => args.filter((a) => a === voce).length;

// 1) In lettura e in conferma: niente salto dei permessi, niente "Bash" nuda fra i permessi,
// e i ruoli che scrivono conservano --permission-mode acceptEdits.
test('in lettura e conferma la riga di Claude perde il salto dei permessi e la Bash nuda', () => {
  for (const permessi of ['lettura', 'conferma']) {
    const strumenti = [ghCon(permessi)];
    for (const profilo of ['prudente', 'totale', 'operatore']) {
      const args = argsClaudeCome(profiloVero(profilo), strumenti);
      const dove = `${profilo}/${permessi}`;
      // il salto dei permessi non ci deve essere: è lui che spegne il rifiuto d'ufficio
      assert.equal(args.includes('--dangerously-skip-permissions'), false, `salto permessi in ${dove}`);
      // la voce Bash nuda darebbe tutto lo strumento Bash: non ci deve essere
      const regole = spezzaRegole(valoreDi(args, '--allowedTools'));
      assert.equal(regole.includes('Bash'), false, `Bash nuda in ${dove}`);
      assert.ok(regole.length > 0, `in ${dove} le regole di lettura ci devono essere`);
      // i ruoli che scrivono devono poter ancora modificare i file del progetto
      assert.equal(quante(args, '--permission-mode'), 1, `--permission-mode una volta sola in ${dove}`);
      assert.equal(args[args.indexOf('--permission-mode') + 1], 'acceptEdits', `acceptEdits in ${dove}`);
      // e il divieto su gh auth c'è sempre
      assert.ok(spezzaRegole(valoreDi(args, '--disallowedTools')).includes(DIVIETO_AUTH), `gh auth in ${dove}`);
    }
    // il revisore (profilo "verifica") non scrive: nessun --permission-mode aggiunto,
    // ma la Bash nuda che aveva nel profilo sparisce comunque
    const verifica = argsClaudeCome(profiloVero('verifica'), strumenti);
    assert.deepEqual(profiloVero('verifica'), ['--allowedTools', 'Bash']);
    assert.equal(spezzaRegole(valoreDi(verifica, '--allowedTools')).includes('Bash'), false);
    assert.equal(verifica.includes('--permission-mode'), false);
  }
});

// 2) --allowedTools ha esattamente le regole di lettura degli strumenti della richiesta
// più le loro voci mcp__: niente di più e niente di meno (confronto d'insieme).
test('in lettura --allowedTools ha solo le regole di lettura degli strumenti della richiesta', () => {
  const gh = ghCon('lettura');
  const blender = strumentoPerId('blender', SCHEDE);
  const args = argsClaudeCome(profiloVero('operatore'), [gh, blender]);
  const regole = spezzaRegole(valoreDi(args, '--allowedTools'));

  // quello che la richiesta porta davvero: le regole di lettura della scheda più mcp__blender
  const atteso = [...gh.bash.lettura, 'mcp__blender'];
  assert.deepEqual(regole, atteso);
  assert.deepEqual(regole, regoleLetturaStrumenti([gh, blender]));
  // una sola occorrenza dell'opzione, e nessuna regola ripetuta
  assert.equal(quante(args, '--allowedTools'), 1);
  assert.equal(new Set(regole).size, regole.length);
  // niente regole di scrittura e niente Bash nuda
  assert.equal(regole.includes('Bash(gh:*)'), false);
  assert.equal(regole.includes('Bash(git:*)'), false);
  assert.equal(regole.includes('Bash'), false);

  // le regole di uno strumento che non è nella richiesta non ci entrano
  const finto = strumentoFinto();
  assert.ok(regoleLetturaStrumenti([finto]).includes('Bash(echo soloilfinto:*)'));
  assert.equal(regole.includes('Bash(echo soloilfinto:*)'), false);

  // con il solo github (nessun server MCP) non compare nessuna voce mcp__
  const soloGh = spezzaRegole(valoreDi(argsClaudeCome(profiloVero('prudente'), [gh]), '--allowedTools'));
  assert.deepEqual(soloGh, gh.bash.lettura);
  assert.equal(soloGh.some((r) => r.startsWith('mcp__')), false);
});

// 3) Due strumenti con permessi diversi nella stessa richiesta: vince il più stretto,
// in qualunque ordine siano elencati.
test('con due strumenti vince il permesso più stretto, in qualunque ordine', () => {
  const coppie = [
    [['lettura', 'libero'], 'lettura'],
    [['libero', 'lettura'], 'lettura'],
    [['conferma', 'libero'], 'conferma'],
    [['libero', 'conferma'], 'conferma'],
    [['lettura', 'conferma'], 'lettura'],
    [['conferma', 'lettura'], 'lettura'],
  ];
  for (const [permessi, atteso] of coppie) {
    const strumenti = [ghCon(permessi[0]), { ...strumentoFinto(permessi[1]), id: 'finto' }];
    const r = permessoBash(strumenti);
    assert.equal(r.permesso, atteso, `${permessi.join(' + ')} deve dare ${atteso}`);
    assert.equal(r.strumenti.length, 2);
    assert.equal(bashStretto(strumenti), atteso !== 'libero');
  }
  // un permesso scritto in un modo che non conosciamo vale conferma, come la riserva delle schede
  assert.equal(permessoBash([ghCon('inventato'), strumentoFinto('libero')]).permesso, 'conferma');
  // due strumenti liberi restano liberi, e senza comandi bash non c'è nessun permesso
  assert.equal(permessoBash([ghCon('libero'), strumentoFinto('libero')]).permesso, 'libero');
  assert.deepEqual(permessoBash([strumentoPerId('blender', SCHEDE)]), { strumenti: [], permesso: null });
  assert.equal(bashStretto([]), false);
});

// 4) Con il permesso libero la riga non si ripulisce, ma il divieto su gh auth c'è comunque
// e i divieti che c'erano già non si perdono.
test('con il permesso libero resta il divieto su gh auth senza perdere gli altri', () => {
  const gh = ghCon('libero');
  // il profilo dell'autonomia totale: qui il salto dei permessi resta, perché l'ha scelto l'utente
  const args = argsClaudeCome(profiloVero('totale'), [gh]);
  assert.ok(args.includes('--dangerously-skip-permissions'));
  assert.equal(quante(args, '--disallowedTools'), 1);
  assert.deepEqual(spezzaRegole(valoreDi(args, '--disallowedTools')), [DIVIETO_AUTH]);
  // le regole di scrittura ci sono: con "libero" la lista dei permessi non viene riscritta
  const regole = spezzaRegole(valoreDi(args, '--allowedTools'));
  assert.ok(regole.includes('Bash(gh:*)'));
  assert.ok(regole.includes('Bash(git:*)'));

  // partendo da divieti che c'erano già, nessuno si perde e gh auth si aggiunge in fondo
  const conDivieti = ripulisciArgsClaude(
    ['--dangerously-skip-permissions', '--disallowedTools', BLOCCO_BASH.join(',')],
    [gh]
  );
  assert.deepEqual(spezzaRegole(valoreDi(conDivieti, '--disallowedTools')), [...BLOCCO_BASH, DIVIETO_AUTH]);
  assert.equal(quante(conDivieti, '--disallowedTools'), 1);

  // con uno strumento libero e uno in conferma vale il più stretto: tornano tutti i divieti
  const misti = argsClaudeCome(profiloVero('operatore'), [gh, strumentoFinto('conferma')]);
  assert.deepEqual(spezzaRegole(valoreDi(misti, '--disallowedTools')), [...BLOCCO_BASH, DIVIETO_AUTH]);
  assert.equal(misti.includes('--dangerously-skip-permissions'), false);

  // e il divieto non si ripete se c'era già
  const giaDentro = ripulisciArgsClaude(['--disallowedTools', DIVIETO_AUTH], [gh]);
  assert.deepEqual(spezzaRegole(valoreDi(giaDentro, '--disallowedTools')), [DIVIETO_AUTH]);
});

// 5) Con uno strumento Bash in lettura o conferma i ruoli che toccano lo strumento hanno
// un solo candidato: Claude. Nessuna riserva su codex o sulle altre IA.
function ctxConBash(permessi, { claudeOk = true, claudeLimitato = false } = {}) {
  const ctx = ctxFinto({ claudeOk, claudeLimitato, strumenti: true });
  ctx.strumenti = [ghCon(permessi)];
  return ctx;
}

test('con uno strumento bash stretto i ruoli dello strumento hanno solo claude', () => {
  for (const permessi of ['lettura', 'conferma']) {
    const ctx = ctxConBash(permessi);
    for (const ruolo of ['esecutore', 'operatore', 'revisore']) {
      assert.deepEqual(candidati(ruolo, ctx), ['claude'], `${ruolo} con ${permessi}`);
    }
    // nemmeno "evita" o "preferisci" possono tirare dentro un'altra IA
    assert.deepEqual(candidati('revisore', ctx, { evita: 'claude' }), ['claude']);
    assert.deepEqual(candidati('revisore', ctx, { preferisci: 'codex' }), ['claude']);
    // chi legge soltanto non cambia: il direttore e il pianificatore restano come sempre
    assert.deepEqual(candidati('pianificatore', ctx), ['claude', 'codex', 'gemini', 'ollama']);

    // senza Claude il compito si ferma: nessun candidato, nessun ripiego
    for (const senza of [ctxConBash(permessi, { claudeLimitato: true }), ctxConBash(permessi, { claudeOk: false })]) {
      for (const ruolo of ['esecutore', 'operatore', 'revisore']) {
        assert.deepEqual(candidati(ruolo, senza), [], `${ruolo} senza claude con ${permessi}`);
      }
    }
  }

  // con il permesso libero, invece, le riserve tornano: Claude davanti e le altre dietro
  const libero = ctxConBash('libero');
  assert.deepEqual(candidati('revisore', libero), ['claude', 'codex', 'gemini', 'ollama']);
  assert.deepEqual(candidati('esecutore', libero), ['claude', 'codex']);
  assert.deepEqual(candidati('esecutore', ctxConBash('libero', { claudeOk: false })), ['codex']);
});

// Il messaggio di stop: quello di src/strumenti.js, nomina lo strumento che ha imposto la regola.
test('il messaggio di stop nomina lo strumento che richiede Claude', () => {
  const gh = ghCon('lettura');
  assert.equal(
    messaggioServeClaude([gh]),
    'GitHub in lettura/conferma richiede Claude, riprova quando torna disponibile'
  );
  // con due strumenti li nomina tutti e due, e senza nomi usa la frase di riserva
  assert.equal(
    messaggioServeClaude([gh, strumentoFinto()]),
    'GitHub, Finto in lettura/conferma richiede Claude, riprova quando torna disponibile'
  );
  assert.equal(
    messaggioServeClaude([]),
    'lo strumento in lettura/conferma richiede Claude, riprova quando torna disponibile'
  );
  assert.equal(messaggioServeClaude(null), messaggioServeClaude([]));
});

// La chat diretta con una IA diversa da Claude si ferma con lo stesso messaggio.
// La chat vera si prova in un processo a parte con una HOME finta, così il registro degli usi
// e la configurazione dell'utente non vengono toccati; con "claude" non si prova, perché
// lancerebbe davvero la CLI.
test('la chat diretta con un altra IA si ferma e dice che serve Claude', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'kortex-chat-'));
  try {
    const schede = path.join(base, 'strumenti');
    fs.mkdirSync(schede);
    // la scheda vera, ma con uno stato che non lancia gh: il permesso lo decide la prova
    const scheda = (permessi) => fs.writeFileSync(
      path.join(schede, 'github.json'),
      JSON.stringify({ id: 'github', nome: 'GitHub', permessi, stato: { tipo: 'comando', comando: 'true' } })
    );
    const figlio = path.join(base, 'prova-chat.mjs');
    const director = pathToFileURL(path.join(QUI, '..', 'src', 'director.js')).href;
    fs.writeFileSync(figlio, [
      `import { chatDiretta } from ${JSON.stringify(director)};`,
      'const [cartella, id] = process.argv.slice(2);',
      'const ctx = {',
      "  config: { ia: { claude: {}, codex: {}, gemini: {}, ollama: {} }, autonomia: 'prudente', profili: {}, ruoli: {} },",
      '  disponibili: { claude: { ok: true }, codex: { ok: true }, gemini: { ok: true }, ollama: { ok: true } },',
      '  ui: { out() {}, log() {} },',
      '  stato: { sessione: () => null, salvaSessione() {} },',
      '  cwd: process.cwd(),',
      '  cartellaStrumenti: cartella,',
      '};',
      "const r = await chatDiretta({ id, messaggio: 'guarda le PR con @github', ctx, storia: [] });",
      'process.stdout.write(JSON.stringify({ ok: r.ok, errore: r.errore, strumenti: (ctx.strumenti || []).map((s) => s.id) }));',
    ].join('\n'));

    const atteso = messaggioServeClaude([strumentoPerId('github', SCHEDE)]);
    const chiama = (id) => JSON.parse(execFileSync(process.execPath, [figlio, schede, id], {
      env: { ...process.env, HOME: base },
      encoding: 'utf8',
    }));

    scheda('lettura');
    for (const id of ['codex', 'gemini', 'ollama']) {
      const r = chiama(id);
      assert.deepEqual(r.strumenti, ['github'], `${id}: lo strumento deve essere riconosciuto`);
      assert.equal(r.ok, false, `${id} non deve poter lavorare`);
      assert.equal(r.errore, atteso, `${id}: il messaggio di stop`);
    }
    scheda('conferma');
    const conferma = chiama('codex');
    assert.equal(conferma.ok, false);
    assert.equal(conferma.errore, atteso);

    // la HOME finta ha ricevuto lei il registro degli usi: quella vera non è stata toccata
    assert.equal(fs.existsSync(path.join(base, '.config', 'kortex', 'strumenti-uso.json')), true);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

// 6) L'eredità della lista di lettura nuova: chi si porta dietro quella della 2.5.0 riceve
// la nuova, chi l'ha modificata resta com'è. Nessun file dell'utente viene mai riscritto.
test('il bash della 2.5.0 diventa la lista nuova, quello modificato dall utente resta suo', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'kortex-eredita-'));
  const cartellaCon = (nome, scheda, file = 'github.json') => {
    const dove = path.join(base, nome);
    fs.mkdirSync(dove, { recursive: true });
    fs.writeFileSync(path.join(dove, file), JSON.stringify(scheda));
    return dove;
  };
  try {
    // la copia nel codice e la scheda su disco devono restare identiche
    assert.deepEqual(strumentoPerId('github', SCHEDE).bash, BASH_GITHUB);

    // (a) scheda utente con il bash identico alla predefinita 2.5.0: riceve la lista nuova
    const vecchia = cartellaCon('vecchia', { id: 'github', nome: 'Il mio GitHub', bash: BASH_GITHUB_2_5_0 });
    const a = carica240(vecchia)[0];
    assert.deepEqual(a.bash, BASH_GITHUB);
    assert.equal(a.bash.lettura.includes('Bash(gh api:*)'), false, 'gh api deve sparire');
    for (const r of [
      'Bash(git branch --show-current)',
      'Bash(git branch --list:*)',
      'Bash(git remote -v)',
      'Bash(git remote get-url:*)',
    ]) assert.ok(a.bash.lettura.includes(r), `manca ${r}`);
    assert.equal(a.bash.lettura.includes('Bash(git branch:*)'), false);
    assert.equal(a.bash.lettura.includes('Bash(git remote:*)'), false);
    // il resto della scheda resta suo
    assert.equal(a.nome, 'Il mio GitHub');

    // le stesse regole in un altro ordine (e con un doppione) contano come "non toccate da lui"
    const rimescolata = cartellaCon('rimescolata', {
      id: 'github',
      bash: {
        lettura: [...BASH_GITHUB_2_5_0.lettura].reverse().concat('Bash(gh api:*)'),
        scrittura: ['Bash(git:*)', 'Bash(gh:*)'],
      },
    });
    assert.deepEqual(carica240(rimescolata)[0].bash, BASH_GITHUB);

    // (b) scheda con il bash modificato dall'utente: resta identica, parola per parola
    const sua = {
      lettura: [...BASH_GITHUB_2_5_0.lettura, 'Bash(gh gist list:*)'],
      scrittura: ['Bash(gh:*)', 'Bash(git:*)'],
    };
    const mia = cartellaCon('mia', { id: 'github', nome: 'Il mio GitHub', bash: sua });
    assert.deepEqual(carica240(mia)[0].bash, sua);

    // anche una lista più corta della 2.5.0 è una scelta sua e resta com'è
    const corta = { lettura: ['Bash(git status:*)'], scrittura: ['Bash(gh:*)', 'Bash(git:*)'] };
    assert.deepEqual(carica240(cartellaCon('corta', { id: 'github', bash: corta }))[0].bash, corta);

    // e la lista nuova, quando ce l'ha già, non viene toccata
    assert.deepEqual(carica240(cartellaCon('nuova', { id: 'github', bash: BASH_GITHUB }))[0].bash, BASH_GITHUB);

    // (c) lo scambio vale solo per la scheda github: un altro strumento resta com'è
    const altro = cartellaCon('altro', { id: 'blender', bash: BASH_GITHUB_2_5_0 }, 'blender.json');
    assert.deepEqual(carica240(altro)[0].bash, BASH_GITHUB_2_5_0);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});
