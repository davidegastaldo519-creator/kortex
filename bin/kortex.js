#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { avvia } from '../src/main.js';

avvia(process.argv.slice(2)).catch((e) => {
  process.stdout.write('\x1b[?25h\x1b[?1049l');
  console.error('Errore:', e?.message || e);
  // i dettagli completi finiscono nel registro, utili per capire cosa è successo
  try { const dir = path.join(os.homedir(), '.cache', 'kortex'); fs.mkdirSync(dir, { recursive: true }); fs.appendFileSync(path.join(dir, 'kortex.log'), `[${new Date().toISOString()}] ${e?.stack || e}\n`); } catch { /* */ }
  process.exit(1);
});
