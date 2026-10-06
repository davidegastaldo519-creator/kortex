import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const CARTELLA = '.kortex';

export function git(cwd, args) {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
    });
  } catch {
    return null;
  }
}

const nostro = (riga) => riga.includes(`${CARTELLA}/`);

// Memoria del progetto: un diario leggibile e gli id delle sessioni da riprendere.
// La cartella .kortex viene creata solo al primo lavoro vero, non quando apri e basta.
export function apriStato(cwd) {
  const dir = path.join(cwd, CARTELLA);
  const fileStato = path.join(dir, 'STATO.md');
  const fileSessioni = path.join(dir, 'sessioni.json');
  let sessioni = {};
  try { sessioni = JSON.parse(fs.readFileSync(fileSessioni, 'utf8')); } catch { /* nuovo progetto */ }

  const assicura = () => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(fileStato)) {
      fs.writeFileSync(fileStato, `# Diario di progetto — ${path.basename(cwd)}\n\n`);
    }
  };

  return {
    dir,
    memoria(n = 30) {
      try {
        return fs.readFileSync(fileStato, 'utf8').trim().split('\n').slice(-n).join('\n');
      } catch {
        return '';
      }
    },
    annota(testo) {
      assicura();
      fs.appendFileSync(fileStato, testo.trimEnd() + '\n\n');
    },
    appunti() {
      try { return fs.readFileSync(path.join(dir, 'appunti.md'), 'utf8').trim().split('\n'); } catch { return []; }
    },
    annotaAppunto(testo) {
      assicura();
      const ora = new Date().toISOString().slice(0, 16).replace('T', ' ');
      fs.appendFileSync(path.join(dir, 'appunti.md'), `- [${ora}] ${testo}\n`);
    },
    sessione(ia, chiave) {
      return sessioni[ia]?.[chiave] || null;
    },
    salvaSessione(ia, chiave, id) {
      assicura();
      (sessioni[ia] ??= {})[chiave] = id;
      fs.writeFileSync(fileSessioni, JSON.stringify(sessioni, null, 2));
    },
  };
}

// Contenuto del pannello FILE.
export function righeFile(cwd) {
  const s = git(cwd, ['status', '--porcelain']);
  if (s === null) {
    try {
      const voci = fs.readdirSync(cwd).filter((f) => !f.startsWith('.')).slice(0, 40);
      return ['(nessun repo git)', ...voci.map((f) => '  ' + f)];
    } catch {
      return ['(cartella non leggibile)'];
    }
  }
  const righe = s.split('\n').filter((r) => r && !nostro(r));
  return righe.length ? righe.slice(0, 60) : ['✔ nessuna modifica'];
}

// Cosa è cambiato nel progetto: lo legge il revisore.
export function diffProgetto(cwd) {
  const stat = git(cwd, ['diff', '--stat']);
  if (stat === null) return null;
  const nuovi = (git(cwd, ['ls-files', '--others', '--exclude-standard']) || '')
    .split('\n')
    .filter((r) => r && !nostro(r))
    .join('\n');
  let diff = git(cwd, ['diff']) || '';
  if (diff.length > 8000) diff = diff.slice(0, 8000) + '\n…(diff troncato)';
  return `FILE NUOVI:\n${nuovi || '(nessuno)'}\n\nRIEPILOGO MODIFICHE:\n${stat.trim() || '(nessuna)'}\n\nDIFF:\n${diff}`;
}
