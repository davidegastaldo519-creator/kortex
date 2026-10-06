import fs from 'node:fs';
import path from 'node:path';
import { caricaConfig, FILE_CONFIG, RADICE } from './config.js';
import { rileva } from './detect.js';
import { splash } from './splash.js';

const versione = () => JSON.parse(fs.readFileSync(path.join(RADICE, 'package.json'), 'utf8')).version;

export async function avvia(argv) {
  const config = caricaConfig();

  if (argv.includes('-v') || argv.includes('--versione')) {
    console.log(`${config.brand.nome} ${versione()}`);
    return;
  }

  if (argv.includes('--aggiorna')) {
    if (!fs.existsSync(path.join(RADICE, '.git'))) {
      console.log('Questa copia non viene da GitHub: reinstallala con il comando a una riga per poterla aggiornare.');
      return;
    }
    const { execSync } = await import('node:child_process');
    console.log(`Aggiorno ${config.brand.nome} da GitHub…`);
    execSync('git pull --ff-only && npm install --omit=dev --no-audit --no-fund', { cwd: RADICE, stdio: 'inherit' });
    console.log(`Fatto: ${config.brand.nome} ${versione()}`);
    return;
  }

  if (argv.includes('-h') || argv.includes('--aiuto')) {
    console.log(`${config.brand.nome} ${versione()} — ${config.brand.tagline}

Uso:
  kortex              apre l'interfaccia nella cartella corrente
  kortex --check      mostra quali IA sono installate su questa macchina
  kortex --no-anim    salta il logo animato
  kortex --aggiorna   scarica l'ultima versione da GitHub
  kortex --versione   versione

Configurazione: ${FILE_CONFIG}`);
    return;
  }

  // Il rilevamento delle IA parte subito, in parallelo al logo: nessun tempo perso.
  const rilevamento = rileva(config);

  if (argv.includes('--check')) {
    const d = await rilevamento;
    console.log(`\n${config.brand.nome} — IA su questa macchina\n`);
    for (const x of Object.values(d)) {
      const segno = x.ok ? '\x1b[32m●\x1b[0m' : '\x1b[90m○\x1b[0m';
      const info = x.ok ? x.versione : x.nota;
      const modelli = x.modelli?.length ? `  (modelli: ${x.modelli.join(', ')})` : '';
      console.log(`  ${segno} ${x.nome.padEnd(8)} ${info || ''}${modelli}`);
    }
    console.log(`\nAutonomia: ${config.autonomia}   Configurazione: ${FILE_CONFIG}\n`);
    return;
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.error('Serve un terminale interattivo. Per un controllo veloce usa: kortex --check');
    process.exit(1);
  }

  process.on('exit', () => process.stdout.write('\x1b[?25h\x1b[?1049l'));

  const senzaAnimazione = argv.includes('--no-anim') || process.env.KORTEX_NO_ANIM;
  if (!senzaAnimazione) await splash(config.brand);

  const disponibili = await rilevamento;
  const { avviaUI } = await import('./ui.js');
  await avviaUI({ config, disponibili, cwd: process.cwd() });
}
