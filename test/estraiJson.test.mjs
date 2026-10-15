// Prove automatiche della lettura del JSON dentro le risposte delle IA.
// Si lanciano con:  npm test     (oppure  node --test test/estraiJson.test.mjs)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estraiJson } from '../src/director.js';

// a) il caso facile: nella risposta c'è solo il JSON e nient'altro.
test('legge un JSON pulito', () => {
  const testo = '{"compiti":[{"titolo":"crea il file","tipo":"modifica"}]}';
  assert.deepEqual(estraiJson(testo), {
    compiti: [{ titolo: 'crea il file', tipo: 'modifica' }],
  });
});

// b) l'IA spiega cosa sta facendo prima e saluta dopo: il JSON sta in mezzo.
test('legge il JSON con del testo prima e dopo', () => {
  const testo = [
    'Certo, ho diviso il lavoro in un compito solo.',
    '{"compiti":[{"titolo":"sistema la barra","tipo":"modifica"}]}',
    'Se vuoi posso aggiungerne altri.',
  ].join('\n');
  assert.deepEqual(estraiJson(testo), {
    compiti: [{ titolo: 'sistema la barra', tipo: 'modifica' }],
  });
});

// c) l'IA prima mostra un esempio fra graffe e solo dopo dà il risultato vero:
// deve vincere l'ultimo blocco valido, cioè quello in fondo.
test('con un esempio prima, vince il JSON vero in fondo', () => {
  const testo = [
    'Il formato che userò è questo:',
    '{"compiti":[{"titolo":"esempio","tipo":"esempio"}]}',
    'Ed ecco il risultato vero:',
    '{"compiti":[{"titolo":"vero lavoro","tipo":"comando"}]}',
  ].join('\n');
  assert.deepEqual(estraiJson(testo), {
    compiti: [{ titolo: 'vero lavoro', tipo: 'comando' }],
  });
});

// d) il JSON è dentro un blocco di codice marcato json, e fuori dal blocco
// c'è un altro oggetto fra graffe: deve vincere il contenuto del blocco.
test('legge il blocco di codice json', () => {
  const testo = [
    'Ho preparato il piano, lo trovi qui sotto.',
    '```json',
    '{"fonte":"dentro il blocco","compiti":[{"titolo":"uno"}]}',
    '```',
    'Per riferimento, lo schema vuoto è {"fonte":"fuori dal blocco"}.',
  ].join('\n');
  assert.deepEqual(estraiJson(testo), {
    fonte: 'dentro il blocco',
    compiti: [{ titolo: 'uno' }],
  });
});

// e) dentro un valore fra virgolette ci sono graffe spaiate e virgolette
// con la barra rovesciata: il conteggio delle graffe non deve sballare.
test('le graffe dentro le virgolette non sballano il conto', () => {
  const testo = 'Ecco: {"nota":"apre { e non chiude, e dice \\"ciao\\"","ok":true}';
  assert.deepEqual(estraiJson(testo), {
    nota: 'apre { e non chiude, e dice "ciao"',
    ok: true,
  });
});

// f) nella risposta non c'è nessun JSON: non si deve inventare niente.
test('senza JSON restituisce niente', () => {
  assert.equal(estraiJson('Non ho capito la richiesta, puoi rispiegarla?'), null);
});

// g) anche con la risposta vuota o mancante non deve rompersi.
test('con risposta vuota o mancante restituisce niente', () => {
  assert.equal(estraiJson(''), null);
  assert.equal(estraiJson(null), null);
  assert.equal(estraiJson(undefined), null);
});
