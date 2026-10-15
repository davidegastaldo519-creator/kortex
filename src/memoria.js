import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DIR_CONFIG } from './config.js';

// Le preferenze valgono in tutti i progetti: come vuoi che si lavori, cosa evitare.
// Vivono dentro il database (~/kortex-database/preferenze.md): così viaggiano con lui su GitHub
// e sono le stesse su ogni PC. La vecchia copia in ~/.config/kortex viene portata dentro una volta.
const DIR_DB = path.join(os.homedir(), 'kortex-database');
const FILE_PREFERENZE = path.join(DIR_DB, 'preferenze.md');
const FILE_VECCHIO = path.join(DIR_CONFIG, 'preferenze.md');

function leggi(file) {
  try {
    return fs.readFileSync(file, 'utf8').split('\n').map((r) => r.replace(/^-\s*/, '').trim()).filter((r) => r && !r.startsWith('#'));
  } catch {
    return [];
  }
}

function salvaPreferenze(lista) {
  fs.mkdirSync(DIR_DB, { recursive: true });
  fs.writeFileSync(FILE_PREFERENZE, '# Preferenze di lavoro (valgono in tutti i progetti, su tutti i PC)\n' + lista.map((p) => `- ${p}`).join('\n') + '\n');
}

// Porta le preferenze vecchie nel database, una volta sola, unendole a quelle già lì.
export function migraPreferenze() {
  if (!fs.existsSync(FILE_VECCHIO)) return 0;
  const vecchie = leggi(FILE_VECCHIO);
  const nuove = leggi(FILE_PREFERENZE);
  const unite = [...nuove];
  for (const p of vecchie) if (!unite.some((q) => q.toLowerCase() === p.toLowerCase())) unite.push(p);
  salvaPreferenze(unite);
  try { fs.renameSync(FILE_VECCHIO, FILE_VECCHIO + '.migrato'); } catch { /* */ }
  return vecchie.length;
}

export function preferenze() {
  return leggi(FILE_PREFERENZE);
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
