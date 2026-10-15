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
import { candidati, ordinaPerStrumenti, promptRevisore } from '../src/director.js';

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
