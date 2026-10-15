// Prove automatiche degli strumenti esterni: menzioni @, argomenti MCP per Claude,
// percorsi con la ~ e copia delle schede predefinite.
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
