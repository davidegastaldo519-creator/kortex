#!/usr/bin/env node
import { avvia } from '../src/main.js';

avvia(process.argv.slice(2)).catch((e) => {
  process.stdout.write('\x1b[?25h\x1b[?1049l');
  console.error('Errore:', e?.message || e);
  process.exit(1);
});
