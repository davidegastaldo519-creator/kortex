// Prove automatiche del riconoscimento del limite di abbonamento.
// Si lanciano con:  npm test     (oppure  node --test test/limite.test.mjs)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eLimitato } from '../src/adapters.js';

// a) la CLI è uscita bene: qualunque cosa abbia scritto, non c'è nessun limite.
test('se il comando è andato bene non c è limite', () => {
  assert.equal(eLimitato(0, '', 'Ho controllato la quota di memoria del disco.'), false);
});

// b) Codex ripete nella risposta anche la richiesta dell'utente: se dentro c'era
// scritto "rate limit" non deve bastare, perché il comando è finito bene.
test('la richiesta ripetuta non fa scattare il limite', () => {
  const uscita = [
    'Richiesta: spiegami come funziona un rate limit nelle API.',
    'Ecco la spiegazione in breve...',
  ].join('\n');
  assert.equal(eLimitato(0, '', uscita), false);
});

// c) il limite vero: la frase intera nelle ultime righe degli errori e uscita male.
test('riconosce il limite vero di abbonamento', () => {
  const errori = [
    'Starting session...',
    'Error: usage limit reached, try again in 3 hours.',
  ].join('\n');
  assert.equal(eLimitato(1, errori, ''), true);
});

// d) alcune CLI dicono solo il numero della risposta HTTP: anche quello è un limite.
test('riconosce il limite scritto come 429', () => {
  assert.equal(eLimitato(1, 'HTTP 429 Too Many Requests', ''), true);
});

// e) la parola "quota" da sola non vuol dire niente: serve la frase intera
// ("quota exceeded"). Qui le righe arrivano come elenco, e va bene uguale.
test('la parola quota da sola non è un limite', () => {
  const errori = ['Controllo in corso...', 'Nota: la quota del progetto è condivisa.'];
  assert.equal(eLimitato(1, errori, ''), false);
});

// f) un errore normale resta un errore normale, non un limite.
test('un errore qualunque non è un limite', () => {
  assert.equal(eLimitato(1, 'Errore: file non trovato', ''), false);
});

// g) si guardano solo le ultime 20 righe: un limite di una chiamata vecchia,
// rimasto in cima a un registro lungo, non deve far passare alla riserva.
test('il limite in cima a un registro lungo non conta', () => {
  const righe = ['Error: usage limit reached (chiamata di ieri)'];
  for (let i = 1; i <= 25; i++) righe.push(`riga di lavoro numero ${i}`);
  assert.equal(eLimitato(1, righe.join('\n'), ''), false);
});
