import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export const DIR_DB = path.join(os.homedir(), 'kortex-database');
const FILE_INDICE = path.join(DIR_DB, 'indice.json');
export const CATEGORIE = ['manuali', 'codice', 'documenti', 'immagini', 'note', 'archivio'];
const ESTENSIONI_TESTO = /\.(md|txt|json|ya?ml|toml|ini|conf|cfg|csv|log|html?|css|js|mjs|ts|jsx|tsx|py|sh|bash|java|kt|c|h|cpp|rs|go|rb|php|sql|xml|sk|properties)$/i;
const ESTENSIONI_IMMAGINE = /\.(png|jpe?g|gif|webp|svg|bmp)$/i;

// ---------- struttura e indice ----------

export function prepara() {
  fs.mkdirSync(DIR_DB, { recursive: true });
  for (const c of CATEGORIE) fs.mkdirSync(path.join(DIR_DB, c), { recursive: true });
  if (!fs.existsSync(path.join(DIR_DB, 'README.md'))) {
    fs.writeFileSync(path.join(DIR_DB, 'README.md'), '# Database KORTEX\n\nLa memoria di tutti i progetti: manuali, codice, documenti, immagini, note.\nCatalogato dalle IA, consultato da sole a ogni richiesta o su richiesta con @nome.\n');
  }
  if (!fs.existsSync(FILE_INDICE)) fs.writeFileSync(FILE_INDICE, '[]');
  if (!fs.existsSync(path.join(DIR_DB, '.gitignore'))) fs.writeFileSync(path.join(DIR_DB, '.gitignore'), '.DS_Store\n*.tmp\n');
}

export function indice() {
  try { return JSON.parse(fs.readFileSync(FILE_INDICE, 'utf8')); } catch { return []; }
}

function salvaIndice(voci) {
  prepara();
  fs.writeFileSync(FILE_INDICE, JSON.stringify(voci, null, 2));
}

export const conteggi = () => {
  const n = Object.fromEntries(CATEGORIE.map((c) => [c, 0]));
  for (const v of indice()) n[v.categoria] = (n[v.categoria] || 0) + 1;
  return n;
};

// Un estratto del contenuto: è quello che le IA leggono anche quando non possono aprire il file.
export function estratto(percorso, massimo = 1500) {
  const nome = path.basename(percorso);
  try {
    if (ESTENSIONI_IMMAGINE.test(nome)) return '(immagine)';
    if (/\.pdf$/i.test(nome)) {
      try { return execFileSync('pdftotext', ['-l', '3', percorso, '-'], { encoding: 'utf8', timeout: 15000 }).slice(0, massimo); } catch { return '(PDF: installa poppler-utils per leggerne il testo)'; }
    }
    if (/\.docx$/i.test(nome)) {
      try {
        const xml = execFileSync('unzip', ['-p', percorso, 'word/document.xml'], { encoding: 'utf8', timeout: 15000 });
        return xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, massimo);
      } catch { return '(documento Word)'; }
    }
    if (ESTENSIONI_TESTO.test(nome) || !path.extname(nome)) {
      const t = fs.readFileSync(percorso, 'utf8');
      return (/\.html?$/i.test(nome) ? t.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ') : t).slice(0, massimo);
    }
  } catch { /* */ }
  return '(file binario)';
}

const categoriaPerEstensione = (nome) => {
  if (ESTENSIONI_IMMAGINE.test(nome)) return 'immagini';
  if (/\.(js|mjs|ts|jsx|tsx|py|sh|bash|java|kt|c|h|cpp|rs|go|rb|php|sql|sk)$/i.test(nome)) return 'codice';
  if (/\.(md|txt)$/i.test(nome) && /manual|guida|readme|istruz|how|tutorial/i.test(nome)) return 'manuali';
  if (/\.(pdf|docx?|odt|md|txt|html?)$/i.test(nome)) return 'documenti';
  return 'archivio';
};

// ---------- aggiungere ----------

// Copia un file nel database e lo mette nell'indice. La scheda la scrive il catalogatore (un'IA), se c'è.
export async function aggiungiFile(percorso, catalogatore, forza = {}) {
  prepara();
  const origine = path.resolve(percorso.replace(/^~/, os.homedir()));
  if (!fs.existsSync(origine) || !fs.statSync(origine).isFile()) throw new Error(`file non trovato: ${origine}`);
  const nome = path.basename(origine);
  const testo = estratto(origine, 2500);
  let scheda = null;
  if (catalogatore) {
    try { scheda = await catalogatore({ nome, estratto: testo, percorso: origine }); } catch { scheda = null; }
  }
  const categoria = forza.categoria || (CATEGORIE.includes(scheda?.categoria) ? scheda.categoria : categoriaPerEstensione(nome));
  let dest = path.join(DIR_DB, categoria, nome);
  if (fs.existsSync(dest) && dest !== origine) {
    const e = path.extname(nome);
    dest = path.join(DIR_DB, categoria, `${path.basename(nome, e)}-${Date.now() % 100000}${e}`);
  }
  if (dest !== origine) fs.copyFileSync(origine, dest);
  const voce = {
    id: Date.now().toString(36),
    titolo: forza.titolo || scheda?.titolo || nome,
    percorso: path.relative(DIR_DB, dest),
    categoria,
    tag: Array.isArray(scheda?.tag) ? scheda.tag.slice(0, 8).map(String) : [],
    descrizione: scheda?.descrizione || '',
    estratto: testo.slice(0, 1500),
    aggiunto: new Date().toISOString(),
    catalogatoDa: scheda ? 'ia' : 'estensione',
  };
  const voci = indice().filter((v) => v.percorso !== voce.percorso);
  salvaIndice([voce, ...voci]);
  return voce;
}

// Una nota scritta al volo: diventa un file Markdown in note/.
export async function aggiungiNota(testo, catalogatore) {
  prepara();
  const titolo = testo.split('\n')[0].slice(0, 50).replace(/[^\w àèéìòùÀÈÉÌÒÙ-]/g, '').trim() || 'nota';
  const nome = `${titolo.replace(/\s+/g, '-').toLowerCase()}-${Date.now().toString(36)}.md`;
  const dest = path.join(DIR_DB, 'note', nome);
  fs.writeFileSync(dest, `# ${titolo}\n\n${testo}\n`);
  return aggiungiFile(dest, catalogatore, { categoria: 'note', titolo });
}

// Scarica una pagina web e la archivia come testo.
export async function aggiungiUrl(url, catalogatore) {
  prepara();
  const html = execFileSync('curl', ['-fsSL', '--max-time', '30', '-A', 'Mozilla/5.0 KORTEX', url], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  const titolo = (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || new URL(url).hostname).trim().slice(0, 80);
  const nome = `${titolo.replace(/[^\w àèéìòùÀÈÉÌÒÙ-]/g, '').replace(/\s+/g, '-').toLowerCase() || 'pagina'}.html`;
  const dest = path.join(DIR_DB, 'documenti', nome);
  fs.writeFileSync(dest, `<!-- fonte: ${url} -->\n${html}`);
  const voce = await aggiungiFile(dest, catalogatore);
  voce.fonte = url;
  salvaIndice(indice().map((v) => (v.id === voce.id ? voce : v)));
  return voce;
}

// ---------- correggere ----------

export function sposta(id, categoria) {
  if (!CATEGORIE.includes(categoria)) throw new Error(`categoria sconosciuta: ${categoria} (${CATEGORIE.join(', ')})`);
  const voci = indice();
  const v = voci.find((x) => x.id === id || x.titolo === id);
  if (!v) throw new Error('voce non trovata');
  const da = path.join(DIR_DB, v.percorso);
  const a = path.join(DIR_DB, categoria, path.basename(v.percorso));
  if (da !== a) fs.renameSync(da, a);
  v.categoria = categoria;
  v.percorso = path.relative(DIR_DB, a);
  salvaIndice(voci);
  return v;
}

export function aggiornaVoce(id, campi) {
  const voci = indice();
  const v = voci.find((x) => x.id === id);
  if (!v) throw new Error('voce non trovata');
  Object.assign(v, campi);
  salvaIndice(voci);
  return v;
}

export function togli(id) {
  const voci = indice();
  const v = voci.find((x) => x.id === id);
  if (!v) throw new Error('voce non trovata');
  const cestino = path.join(DIR_DB, 'archivio', '.cestino');
  fs.mkdirSync(cestino, { recursive: true });
  try { fs.renameSync(path.join(DIR_DB, v.percorso), path.join(cestino, path.basename(v.percorso))); } catch { /* */ }
  salvaIndice(voci.filter((x) => x.id !== id));
  return v;
}

export const percorsoAssoluto = (v) => path.join(DIR_DB, v.percorso);

// ---------- cercare: le IA lo fanno da sole a ogni richiesta ----------

const parole = (t) => (t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/[a-z0-9][a-z0-9_-]{2,}/g) || []);
const INUTILI = new Set(['che', 'con', 'per', 'una', 'uno', 'del', 'della', 'dei', 'delle', 'nel', 'nella', 'sul', 'sulla', 'come', 'crea', 'fai', 'fare', 'file', 'the', 'and', 'for', 'questo', 'questa', 'quello', 'quella', 'tutto', 'tutti', 'anche', 'poi', 'solo', 'voglio', 'vorrei', 'puoi', 'devi']);

export function cerca(testo, quante = 3) {
  const chiavi = [...new Set(parole(testo).filter((p) => !INUTILI.has(p)))];
  if (!chiavi.length) return [];
  const punteggi = indice().map((v) => {
    const t = `${v.titolo} ${v.tag.join(' ')}`.toLowerCase();
    const d = `${v.descrizione} ${v.categoria}`.toLowerCase();
    const e = (v.estratto || '').toLowerCase();
    let p = 0;
    for (const k of chiavi) {
      if (t.includes(k)) p += 4;
      if (d.includes(k)) p += 2;
      if (e.includes(k)) p += 1;
    }
    return { v, p };
  });
  return punteggi.filter((x) => x.p >= 3).sort((a, b) => b.p - a.p).slice(0, quante).map((x) => x.v);
}

// @nome nella richiesta: obbliga a usare quella voce (o tutta una categoria).
export function menzioni(testo) {
  const trovate = [];
  const voci = indice();
  for (const m of testo.matchAll(/@([\w\-./àèéìòù]+)/g)) {
    const q = m[1].toLowerCase();
    if (CATEGORIE.includes(q)) { trovate.push(...voci.filter((v) => v.categoria === q).slice(0, 5)); continue; }
    const v = voci.find((x) => x.id === q || x.titolo.toLowerCase() === q || x.percorso.toLowerCase() === q || path.basename(x.percorso).toLowerCase() === q)
      || voci.find((x) => x.titolo.toLowerCase().includes(q) || x.percorso.toLowerCase().includes(q) || x.tag.some((t) => t.toLowerCase() === q));
    if (v) trovate.push(v);
  }
  return [...new Map(trovate.map((v) => [v.id, v])).values()];
}

// Il testo che finisce nei prompt.
export function bloccoConoscenze(voci) {
  if (!voci?.length) return '';
  return '\nCONOSCENZE DAL DATABASE (materiale utile; il percorso è assoluto, l\'estratto è l\'inizio del contenuto):\n' +
    voci.map((v) => `- ${v.titolo} [${v.categoria}] — ${percorsoAssoluto(v)}\n  ${v.descrizione || ''}\n  estratto: ${(v.estratto || '').replace(/\s+/g, ' ').slice(0, 600)}`).join('\n') + '\n';
}

// ---------- GitHub: copia privata, uguale su ogni macchina ----------

const git = (args) => execFileSync('git', args, { cwd: DIR_DB, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 });

export function statoGithub() {
  try { return git(['remote', 'get-url', 'origin']).trim(); } catch { return null; }
}

export function collegaGithub() {
  prepara();
  if (!fs.existsSync(path.join(DIR_DB, '.git'))) {
    git(['init', '-q', '-b', 'main']);
    git(['config', 'user.email', 'kortex@locale']);
    git(['config', 'user.name', 'KORTEX']);
  }
  git(['add', '-A']);
  try { git(['commit', '-q', '-m', 'database KORTEX']); } catch { /* niente da salvare */ }
  if (!statoGithub()) {
    execFileSync('gh', ['repo', 'create', 'kortex-database', '--private', '--source=.', '--push'], { cwd: DIR_DB, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 });
  } else {
    git(['push', '-u', 'origin', 'main']);
  }
  return statoGithub();
}

export function sincronizza() {
  if (!statoGithub()) throw new Error('il database non è ancora collegato a GitHub: /db github');
  git(['add', '-A']);
  try { git(['commit', '-q', '-m', `aggiornamento ${new Date().toISOString().slice(0, 16)}`]); } catch { /* niente di nuovo */ }
  try { git(['pull', '-q', '--rebase', 'origin', 'main']); } catch { /* primo giro o remoto vuoto */ }
  git(['push', '-q', 'origin', 'main']);
  return git(['log', '-1', '--format=%h %s']).trim();
}

export function scaricaDaGithub(utente) {
  if (fs.existsSync(path.join(DIR_DB, '.git'))) return sincronizza();
  execFileSync('git', ['clone', '-q', `https://github.com/${utente}/kortex-database.git`, DIR_DB], { encoding: 'utf8', timeout: 120000 });
  return 'scaricato';
}

// Una soluzione trovata lavorando: la scrive il memorista, senza bisogno del catalogatore.
export async function aggiungiSoluzione({ titolo, testo, tag = [], progetto = '' }) {
  prepara();
  const nome = `soluzione-${titolo.toLowerCase().replace(/[^\w àèéìòù-]/g, '').replace(/\s+/g, '-').slice(0, 50)}-${Date.now().toString(36)}.md`;
  const dest = path.join(DIR_DB, 'note', nome);
  fs.writeFileSync(dest, `# ${titolo}\n\n${testo}\n\n_imparata lavorando su: ${progetto || 'un progetto'}_\n`);
  const voce = await aggiungiFile(dest, null, { categoria: 'note', titolo });
  return aggiornaVoce(voce.id, { tag: [...new Set(['soluzione', ...tag.map(String)])].slice(0, 8), descrizione: testo.split('\n')[0].slice(0, 200), progetto });
}

export const soluzioni = (quante = 8) => indice().filter((v) => v.tag.includes('soluzione')).slice(0, quante);
