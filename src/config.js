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
    const utente = JSON.parse(fs.readFileSync(FILE_CONFIG, 'utf8'));
    const c = unisci(predefinita, utente);
    // I comandi delle CLI e i profili cambiano con gli aggiornamenti di KORTEX: valgono quelli nuovi,
    // a meno che l'utente non abbia segnato "personalizzato": true su quella IA.
    for (const id of Object.keys(predefinita.ia)) {
      if (!utente.ia?.[id]?.personalizzato) {
        c.ia[id] = { ...c.ia[id], args: predefinita.ia[id].args, resume: predefinita.ia[id].resume, parser: predefinita.ia[id].parser };
      }
    }
    if (!utente.profiliPersonalizzati) c.profili = predefinita.profili;
    for (const r of Object.keys(predefinita.ruoli)) if (!c.ruoli[r]) c.ruoli[r] = predefinita.ruoli[r];
    c.versioneConfig = predefinita.versioneConfig;
    return c;
  } catch (e) {
    console.error(`Attenzione: ${FILE_CONFIG} non è JSON valido (${e.message}). Uso i valori predefiniti.`);
    return predefinita;
  }
}
