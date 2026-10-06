// Prova del flusso completo senza interfaccia: utile per verificare che le IA rispondano.
// Uso:  node test/prova.mjs "richiesta"   (dentro la cartella del progetto)
import { caricaConfig } from '../src/config.js';
import { rileva } from '../src/detect.js';
import { apriStato } from '../src/state.js';
import { eseguiRichiesta } from '../src/director.js';

const config = caricaConfig();
const disponibili = await rileva(config);
const cwd = process.cwd();
const ui = {
  out: (t) => process.stdout.write(t),
  titolo: (t) => process.stdout.write(`\n\x1b[36m▌ ${t}\x1b[0m\n`),
  log: (m) => process.stdout.write(`\x1b[90m  · ${m}\x1b[0m\n`),
  ruolo: (r, s, ia) => process.stdout.write(`\x1b[35m  [${r}: ${s}${ia ? ' / ' + ia : ''}]\x1b[0m\n`),
  costo: () => {},
};
const richiesta = process.argv[2] || 'crea un file ciao.txt con un saluto';
await eseguiRichiesta({ richiesta, ctx: { config, disponibili, cwd, stato: apriStato(cwd), ui } });
