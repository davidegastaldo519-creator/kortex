import fs from 'node:fs';
import path from 'node:path';
import { DIR_CONFIG } from './config.js';

// Le preferenze valgono in tutti i progetti: come vuoi che si lavori, cosa evitare.
const FILE_PREFERENZE = path.join(DIR_CONFIG, 'preferenze.md');

export function preferenze() {
  try {
    return fs.readFileSync(FILE_PREFERENZE, 'utf8').split('\n').map((r) => r.replace(/^-\s*/, '').trim()).filter((r) => r && !r.startsWith('#'));
  } catch {
    return [];
  }
}

function salvaPreferenze(lista) {
  fs.mkdirSync(DIR_CONFIG, { recursive: true });
  fs.writeFileSync(FILE_PREFERENZE, '# Preferenze di lavoro (valgono in tutti i progetti)\n' + lista.map((p) => `- ${p}`).join('\n') + '\n');
}

export function ricorda(testo) {
  const t = testo.trim();
  const lista = preferenze();
  if (!t || lista.some((p) => p.toLowerCase() === t.toLowerCase())) return false;
  salvaPreferenze([...lista, t]);
  return true;
}

export function dimentica(n) {
  const lista = preferenze();
  const via = lista[n - 1];
  if (!via) return null;
  salvaPreferenze(lista.filter((_, i) => i !== n - 1));
  return via;
}

export const percorsoPreferenze = () => FILE_PREFERENZE;

export function bloccoPreferenze() {
  const l = preferenze();
  return l.length ? `\nPREFERENZE DI LAVORO DELL'UTENTE (valgono sempre, rispettale):\n${l.map((p) => '- ' + p).join('\n')}\n` : '';
}
