import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const qui = path.dirname(fileURLToPath(import.meta.url));
export const RADICE = path.join(qui, '..');
export const DIR_CONFIG = path.join(os.homedir(), '.config', 'kortex');
export const FILE_CONFIG = path.join(DIR_CONFIG, 'config.json');

function unisci(base, sopra) {
  if (sopra === undefined) return base;
  if (Array.isArray(base) || Array.isArray(sopra)) return sopra;
  if (base && sopra && typeof base === 'object' && typeof sopra === 'object') {
    const out = { ...base };
    for (const k of Object.keys(sopra)) out[k] = unisci(base[k], sopra[k]);
    return out;
  }
  return sopra;
}

export function caricaConfig() {
  const predefinita = JSON.parse(fs.readFileSync(path.join(RADICE, 'config.default.json'), 'utf8'));
  if (!fs.existsSync(FILE_CONFIG)) {
    fs.mkdirSync(DIR_CONFIG, { recursive: true });
    fs.writeFileSync(FILE_CONFIG, JSON.stringify(predefinita, null, 2));
    return predefinita;
  }
  try {
    return unisci(predefinita, JSON.parse(fs.readFileSync(FILE_CONFIG, 'utf8')));
  } catch (e) {
    console.error(`Attenzione: ${FILE_CONFIG} non è JSON valido (${e.message}). Uso i valori predefiniti.`);
    return predefinita;
  }
}
