// Registra la schermata iniziale fotogramma per fotogramma (tempo finto, 15 fotogrammi al secondo)
// e salva ogni fotogramma come testo ANSI: poi un altro script li trasforma in immagini e in una GIF.
import fs from 'node:fs';
import path from 'node:path';
const [,, cartella, tema = 'neon', colonne = '190', righe = '48'] = process.argv;
fs.mkdirSync(cartella, { recursive: true });
process.stdout.columns = Number(colonne);
process.stdout.rows = Number(righe);
process.stdout.isTTY = true;
process.stdin.isTTY = false;
// il tempo avanza solo quando il programma "dorme": ogni dormita = un fotogramma
let t = 0;
const veroNow = Date.now;
const base = veroNow();
Date.now = () => base + t;
const veroSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn, ms, ...a) => { if (ms >= 5 && ms <= 120) { t += 1000 / 15; return veroSetTimeout(fn, 0); } return veroSetTimeout(fn, ms, ...a); };
let n = 0;
const veroWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = (s) => { if (typeof s === 'string' && s.includes('\x1b[1;1H')) fs.writeFileSync(path.join(cartella, `f${String(n++).padStart(4, '0')}.ans`), s); return true; };
const { splash } = await import('../src/splash.js');
const { TEMI } = await import('../src/temi.js');
const brand = { nome: 'KORTEX', tagline: 'la corteccia delle tue IA', colori: [...TEMI[tema].brand] };
const rilevamento = Promise.resolve({
  claude: { nome: 'Claude', ok: true, versione: '2.1.300 (Claude Code)' },
  codex: { nome: 'Codex', ok: true, versione: 'codex-cli 0.45.0' },
  gemini: { nome: 'Gemini', ok: false, nota: 'non installato' },
  ollama: { nome: 'Ollama', ok: false, nota: 'non installato' },
});
await splash(brand, { tema, rilevamento, info: () => ({ database: 42, preferenze: 5, progetti: 7 }) });
process.stdout.write = veroWrite;
console.log(`${n} fotogrammi in ${cartella}`);
process.exit(0);
