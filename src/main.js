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
    execSync('git checkout -- . && git pull --ff-only && bash install.sh', { cwd: RADICE, stdio: 'inherit' });
    console.log(`Fatto: ${config.brand.nome} ${versione()}`);
    return;
  }

  if (argv.includes('-h') || argv.includes('--aiuto')) {
    console.log(`${config.brand.nome} ${versione()} — ${config.brand.tagline}

Uso:
  kortex              apre l'interfaccia nella cartella corrente
  kortex --check      mostra quali IA sono installate su questa macchina
  kortex --prova      fa una domanda vera a ogni IA e dice cosa non va
  kortex --no-anim    salta la schermata iniziale
  kortex --leggera    grafica leggera per questa volta (niente 3D, niente neuroni)
  kortex --aggiorna   scarica l'ultima versione da GitHub
  kortex --versione   versione

Configurazione: ${FILE_CONFIG}`);
    return;
  }

  // Il rilevamento delle IA parte subito, in parallelo alla schermata iniziale: nessun tempo perso.
  const rilevamento = rileva(config);

  if (argv.includes('--prova')) {
    const d = await rilevamento;
    const { provaTutte } = await import('./prova.js');
    console.log(`\n${config.brand.nome} — prova vera delle IA\n`);
    await provaTutte(config, d, process.cwd(), (t) => process.stdout.write(t + '\n'));
    console.log('');
    return;
  }

  if (argv.includes('--check')) {
    const d = await rilevamento;
    console.log(`\n${config.brand.nome} — IA su questa macchina\n`);
    for (const x of Object.values(d)) {
      const segno = x.ok ? '\x1b[32m●\x1b[0m' : '\x1b[90m○\x1b[0m';
      const info = x.ok ? x.versione : x.nota;
      const modelli = x.modelli?.length ? `  (modelli: ${x.modelli.join(', ')})` : '';
      console.log(`  ${segno} ${x.nome.padEnd(8)} ${info || ''}${modelli}`);
    }
    console.log(`\nAutonomia: ${config.autonomia}   Parallelo: ${config.parallelo}   Configurazione: ${FILE_CONFIG}\n`);
    return;
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.error('Serve un terminale interattivo. Per un controllo veloce usa: kortex --check');
    process.exit(1);
  }

  // qualunque cosa succeda, il terminale torna normale: cursore, schermo, mouse
  process.on('exit', () => process.stdout.write('\x1b[?1006l\x1b[?1000l\x1b[0m\x1b[?25h\x1b[?1049l'));

  const { applicaTema } = await import('./temi.js');
  const { C } = await import('./grafica.js');
  const { applicaGrafica } = await import('./parametri.js');
  const { creaSuoni } = await import('./suoni.js');
  const { migraPreferenze, preferenze } = await import('./memoria.js');
  const { copiaSchedePredefinite } = await import('./strumenti.js');
  applicaTema(config, C);
  const { applicaIcone } = await import('./icone.js');
  applicaIcone(config);
  if (argv.includes('--leggera')) config.animazioni = 'leggera'; else applicaGrafica(config);
  const suoni = creaSuoni(config);
  try { migraPreferenze(); } catch { /* */ }
  // le schede degli strumenti predefiniti vanno nella cartella dell'utente, senza toccare le sue
  try { copiaSchedePredefinite(); } catch { /* */ }

  // l'interfaccia si carica mentre scorre la schermata iniziale: all'uscita è già pronta
  const caricamentoUI = import('./ui.js');
  const senzaAnimazione = argv.includes('--no-anim') || process.env.KORTEX_NO_ANIM;
  if (!senzaAnimazione) {
    const db = await import('./database.js');
    const { elencoProgetti } = await import('./progetti.js');
    const info = () => {
      try { return { database: db.indice().length, preferenze: preferenze().length, progetti: elencoProgetti().length }; } catch { return {}; }
    };
    await splash(config.brand, { tema: config.tema, rilevamento, suoni, leggera: config.animazioni !== 'piena', info, versione: versione() });
  }

  const disponibili = await rilevamento;
  const { avviaUI } = await caricamentoUI;
  await avviaUI({ config, disponibili, cwd: process.cwd(), versione: versione(), suoni });
}
