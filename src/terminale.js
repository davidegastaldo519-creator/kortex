import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const SEGNO = '__KORTEX_PWD__';
const INTERATTIVI = /^(sudo\s+)?(nano|vim?|nvim|top|htop|less|more|man|ssh|mc|watch|tmux|screen)(\s|$)/;
const ANSI = /\x1b\[[0-9;?]*[A-Za-z]/g;

// Le macchine SSH che hai già configurato in ~/.ssh/config.
export function leggiSshConfig() {
  const file = path.join(os.homedir(), '.ssh', 'config');
  let testo;
  try { testo = fs.readFileSync(file, 'utf8'); } catch { return []; }
  const voci = [];
  let corrente = null;
  for (const riga of testo.split('\n')) {
    const m = riga.trim().match(/^(\w+)\s+(.+)$/i);
    if (!m) continue;
    const [, chiave, valore] = m;
    if (chiave.toLowerCase() === 'host') {
      corrente = null;
      const nome = valore.trim().split(/\s+/)[0];
      if (nome.includes('*') || nome.includes('?')) continue;
      corrente = { id: 'ssh:' + nome, nome, tipo: 'ssh', host: nome, origine: 'ssh/config' };
      voci.push(corrente);
    } else if (corrente) {
      if (chiave.toLowerCase() === 'hostname') corrente.indirizzo = valore.trim();
      if (chiave.toLowerCase() === 'user') corrente.utente = valore.trim();
      if (chiave.toLowerCase() === 'port') corrente.porta = valore.trim();
    }
  }
  return voci;
}

// L'elenco completo delle destinazioni: PC, macchine SSH (dal file e dalla configurazione), console.
export function elencoDestinazioni(config) {
  const mie = (config.destinazioni || []).map((d) => ({ id: 'ssh:' + d.nome, nome: d.nome, tipo: 'ssh', host: d.host, porta: d.porta, origine: 'kortex' }));
  const daFile = leggiSshConfig().filter((d) => !mie.some((m) => m.nome === d.nome));
  return [
    { id: 'pc', nome: 'Questo PC', tipo: 'locale', breve: 'PC' },
    ...mie,
    ...daFile,
    { id: 'python', nome: 'Python', tipo: 'repl', cmd: ['python3', '-i', '-q'], breve: 'Py' },
    { id: 'node', nome: 'Node.js', tipo: 'repl', cmd: ['node', '-i'], breve: 'Node' },
  ];
}

const virgolette = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;

// Tiene una sessione per destinazione: la cartella in cui sei, la cronologia, la console se è un REPL.
export class Sessioni {
  constructor(cwdIniziale) {
    this.stato = {};
    this.cwdIniziale = cwdIniziale;
  }

  di(dest) {
    if (!this.stato[dest.id]) {
      this.stato[dest.id] = { cwd: dest.tipo === 'locale' ? this.cwdIniziale : dest.tipo === 'ssh' ? '~' : null, storia: [], indice: -1, proc: null, repl: null, righe: [], collegata: dest.tipo !== 'ssh' };
    }
    return this.stato[dest.id];
  }

  // Esegue un comando sulla destinazione. Gli eventi arrivano via callback: out, err, info, fine.
  esegui(dest, cmd, cb) {
    const s = this.di(dest);
    s.storia = [...s.storia.filter((c) => c !== cmd), cmd].slice(-200);
    s.indice = -1;

    if (dest.tipo === 'repl') return this.eseguiRepl(dest, s, cmd, cb);

    if (cmd === 'clear' || cmd === 'pulisci') { s.righe = []; cb.fine(0); return; }
    if (INTERATTIVI.test(cmd)) {
      cb.info('⚠ programma interattivo: qui non può funzionare, aprilo in un terminale normale (Ctrl+Alt+T).');
      cb.fine(0);
      return;
    }

    // Lo script ricorda la cartella: dopo il comando stampa dove sei, così "cd" funziona anche qui.
    const dove = s.cwd === '~' || !s.cwd ? '"$HOME"' : virgolette(s.cwd);
    const script = `cd ${dove} 2>/dev/null; ${cmd}\n__KX=$?; printf '\\n${SEGNO}%s\\n' "$(pwd)"; exit $__KX`;
    let p;
    if (dest.tipo === 'locale') {
      p = spawn('bash', ['-lc', script], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, TERM: 'dumb', NO_COLOR: '1' } });
    } else {
      const args = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=12', '-o', 'ControlMaster=auto', '-o', `ControlPath=${os.tmpdir()}/kortex-ssh-%C`, '-o', 'ControlPersist=600'];
      if (dest.porta) args.push('-p', String(dest.porta));
      args.push(dest.host, script);
      p = spawn('ssh', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    }
    s.proc = p;
    let coda = '';
    p.stdout.on('data', (d) => {
      coda += d.toString();
      const i = coda.indexOf(SEGNO);
      if (i >= 0) {
        const prima = coda.slice(0, i).replace(/\n$/, '');
        if (prima) cb.out(prima);
        const dopo = coda.slice(i + SEGNO.length).split('\n')[0].trim();
        if (dopo) s.cwd = dopo;
        coda = '';
        s.collegata = true;
      } else if (coda.length > 4000 || coda.includes('\n')) {
        const ultimo = coda.lastIndexOf('\n');
        cb.out(coda.slice(0, ultimo));
        coda = coda.slice(ultimo + 1);
      }
    });
    p.stderr.on('data', (d) => {
      const t = d.toString().replace(ANSI, '');
      if (/Permission denied|Host key verification failed|Could not resolve|Connection (refused|timed out)/i.test(t)) s.collegata = false;
      cb.err(t);
    });
    p.on('error', (e) => cb.err(e.code === 'ENOENT' ? `${dest.tipo === 'ssh' ? 'ssh' : 'bash'} non trovato` : e.message));
    p.on('close', (codice, segnale) => {
      s.proc = null;
      if (coda.trim()) cb.out(coda.replace(new RegExp(SEGNO + '.*'), ''));
      if (segnale) cb.info(`· interrotto (${segnale})`);
      else if (codice === 255 && dest.tipo === 'ssh') cb.info('· connessione SSH fallita. Serve una chiave SSH già caricata su quella macchina: le password qui non si possono scrivere.');
      else if (codice) cb.info(`· uscito con codice ${codice}`);
      cb.fine(codice);
    });
  }

  eseguiRepl(dest, s, cmd, cb) {
    if (!s.repl || s.repl.exitCode !== null) {
      let p;
      try {
        p = spawn(dest.cmd[0], dest.cmd.slice(1), { stdio: ['pipe', 'pipe', 'pipe'], cwd: this.cwdIniziale, env: { ...process.env, TERM: 'dumb', NO_COLOR: '1', PYTHONUNBUFFERED: '1', NODE_NO_READLINE: '1' } });
      } catch (e) {
        cb.err(e.message); cb.fine(1); return;
      }
      s.repl = p;
      s.collegata = true;
      p.stdout.on('data', (d) => { const t = d.toString().replace(ANSI, '').replace(/^(>|>>>|\.\.\.) ?$/gm, '').replace(/\n{2,}/g, '\n'); if (t.trim()) cb.out(t); });
      p.stderr.on('data', (d) => {
        const t = d.toString().replace(ANSI, '').replace(/^(>>> |\.\.\. |> )+/gm, '').trim();
        if (t) cb.err(t);
      });
      p.on('error', (e) => { cb.err(e.code === 'ENOENT' ? `${dest.cmd[0]} non è installato` : e.message); s.repl = null; });
      p.on('close', (c) => { cb.info(`· console ${dest.nome} chiusa (${c})`); s.repl = null; s.collegata = false; });
      cb.info(`· console ${dest.nome} avviata`);
    }
    try { s.repl.stdin.write(cmd + '\n'); } catch (e) { cb.err(e.message); }
    // una console non dice quando ha finito: la riga torna libera subito
    setTimeout(() => cb.fine(0), 150);
  }

  interrompi(dest) {
    const s = this.di(dest);
    if (s.proc) { s.proc.kill('SIGINT'); return true; }
    if (s.repl) { s.repl.kill('SIGINT'); return true; }
    return false;
  }

  chiudiTutto() {
    for (const s of Object.values(this.stato)) {
      try { s.proc?.kill('SIGTERM'); } catch { /* */ }
      try { s.repl?.kill('SIGTERM'); } catch { /* */ }
    }
  }
}
