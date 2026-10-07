import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { DIR_CONFIG } from './config.js';

export const CARTELLA_PROGETTI = path.join(os.homedir(), 'kortex-progetti');
const FILE_REGISTRO = path.join(DIR_CONFIG, 'progetti.json');
const ora = () => new Date().toISOString();
const pulisciNome = (n) => n.trim().replace(/[^\w\-. àèéìòùÀÈÉÌÒÙ]/g, '-').replace(/\s+/g, '-').slice(0, 60);

// ---------- registro dei progetti (quali sono e dove stanno) ----------

export function elencoProgetti() {
  try {
    const l = JSON.parse(fs.readFileSync(FILE_REGISTRO, 'utf8'));
    return l.filter((p) => fs.existsSync(p.percorso)).sort((a, b) => (b.ultimo || '').localeCompare(a.ultimo || ''));
  } catch {
    return [];
  }
}

function salvaRegistro(lista) {
  fs.mkdirSync(DIR_CONFIG, { recursive: true });
  fs.writeFileSync(FILE_REGISTRO, JSON.stringify(lista, null, 2));
}

export function registraProgetto({ nome, percorso, descrizione = '' }) {
  const lista = elencoProgetti().filter((p) => p.percorso !== percorso);
  const voce = { nome, percorso, descrizione, creato: ora(), ultimo: ora() };
  salvaRegistro([voce, ...lista]);
  fs.mkdirSync(path.join(percorso, '.kortex'), { recursive: true });
  fs.writeFileSync(path.join(percorso, '.kortex', 'progetto.json'), JSON.stringify({ nome, descrizione, creato: voce.creato }, null, 2));
  return voce;
}

export function creaProgetto(nome, descrizione = '') {
  const cartella = path.join(CARTELLA_PROGETTI, pulisciNome(nome));
  if (fs.existsSync(cartella)) throw new Error(`esiste già una cartella ${cartella}`);
  fs.mkdirSync(cartella, { recursive: true });
  fs.writeFileSync(path.join(cartella, 'README.md'), `# ${nome}\n\n${descrizione}\n`);
  return registraProgetto({ nome, percorso: cartella, descrizione });
}

export function importaProgetto(percorso, nome) {
  const p = path.resolve(percorso.replace(/^~/, os.homedir()));
  if (!fs.existsSync(p) || !fs.statSync(p).isDirectory()) throw new Error(`cartella non trovata: ${p}`);
  return registraProgetto({ nome: nome || path.basename(p), percorso: p });
}

export function toccaProgetto(percorso) {
  const lista = elencoProgetti();
  const v = lista.find((p) => p.percorso === percorso);
  if (v) { v.ultimo = ora(); salvaRegistro(lista); }
}

export function dimenticaProgetto(percorso) {
  salvaRegistro(elencoProgetti().filter((p) => p.percorso !== percorso));
}

export function progettoDi(percorso) {
  return elencoProgetti().find((p) => p.percorso === percorso) || null;
}

// ---------- chat di un progetto ----------

const dirChat = (cwd) => path.join(cwd, '.kortex', 'chat');

export function elencoChat(cwd) {
  try {
    return fs.readdirSync(dirChat(cwd))
      .filter((f) => f.endsWith('.json'))
      .map((f) => { try { return JSON.parse(fs.readFileSync(path.join(dirChat(cwd), f), 'utf8')); } catch { return null; } })
      .filter(Boolean)
      .sort((a, b) => (b.ultimo || '').localeCompare(a.ultimo || ''));
  } catch {
    return [];
  }
}

export function creaChat(cwd, titolo = 'Nuova chat') {
  fs.mkdirSync(dirChat(cwd), { recursive: true });
  const id = Date.now().toString(36);
  const chat = { id, titolo, creata: ora(), ultimo: ora(), messaggi: [] };
  salvaChat(cwd, chat);
  return chat;
}

export function salvaChat(cwd, chat) {
  fs.mkdirSync(dirChat(cwd), { recursive: true });
  chat.ultimo = ora();
  fs.writeFileSync(path.join(dirChat(cwd), chat.id + '.json'), JSON.stringify(chat, null, 2));
}

export function caricaChat(cwd, id) {
  try { return JSON.parse(fs.readFileSync(path.join(dirChat(cwd), id + '.json'), 'utf8')); } catch { return null; }
}

export function eliminaChat(cwd, id) {
  try { fs.unlinkSync(path.join(dirChat(cwd), id + '.json')); } catch { /* */ }
}

// La conversazione precedente, in forma breve, da dare al direttore.
export function riassuntoChat(chat, massimo = 6) {
  if (!chat?.messaggi?.length) return '';
  return chat.messaggi
    .slice(-massimo * 2)
    .map((m) => `${m.chi === 'utente' ? 'UTENTE' : 'KORTEX'}: ${String(m.testo).slice(0, 600)}`)
    .join('\n');
}

// ---------- punti di ripristino: un archivio git nascosto, separato dal git del progetto ----------

function gitIstantanee(cwd, args, opzioni = {}) {
  const dir = path.join(cwd, '.kortex', 'istantanee.git');
  return execFileSync('git', ['--git-dir=' + dir, '--work-tree=' + cwd, ...args], {
    cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000, ...opzioni,
  });
}

function preparaIstantanee(cwd) {
  const dir = path.join(cwd, '.kortex', 'istantanee.git');
  if (fs.existsSync(dir)) return;
  fs.mkdirSync(path.join(cwd, '.kortex'), { recursive: true });
  execFileSync('git', ['init', '-q', '--bare', dir], { stdio: 'ignore' });
  fs.mkdirSync(path.join(dir, 'info'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'info', 'exclude'), '.kortex/\nnode_modules/\n.git/\n*.log\n');
  gitIstantanee(cwd, ['config', 'user.email', 'kortex@locale']);
  gitIstantanee(cwd, ['config', 'user.name', 'KORTEX']);
}

// Fotografa i file del progetto. Restituisce l'identificativo dell'istantanea (o null se non c'era niente da salvare).
export function istantanea(cwd, etichetta) {
  try {
    preparaIstantanee(cwd);
    gitIstantanee(cwd, ['add', '-A', '--', '.']);
    gitIstantanee(cwd, ['commit', '-q', '--allow-empty', '-m', etichetta]);
    return gitIstantanee(cwd, ['rev-parse', '--short', 'HEAD']).trim();
  } catch (e) {
    return null;
  }
}

export function elencoIstantanee(cwd, quante = 30) {
  try {
    return gitIstantanee(cwd, ['log', `-${quante}`, '--format=%h|%ci|%s'])
      .trim().split('\n').filter(Boolean)
      .map((r) => { const [id, data, ...s] = r.split('|'); return { id, data: data.slice(0, 16), etichetta: s.join('|') }; });
  } catch {
    return [];
  }
}

// Riporta i file a un'istantanea. Prima ne scatta una di sicurezza, così anche il ripristino è reversibile.
export function ripristina(cwd, id) {
  const sicurezza = istantanea(cwd, `prima del ripristino a ${id}`);
  // i file nati dopo quell'istantanea vanno tolti, altrimenti il progetto non torna davvero com'era
  const nuovi = gitIstantanee(cwd, ['diff', '--name-only', '--diff-filter=A', id, 'HEAD']).trim().split('\n').filter(Boolean);
  gitIstantanee(cwd, ['checkout', '-q', id, '--', '.']);
  for (const f of nuovi) { try { fs.rmSync(path.join(cwd, f), { force: true }); } catch { /* */ } }
  istantanea(cwd, `ripristinato a ${id}`);
  return { sicurezza, rimossi: nuovi.length };
}
