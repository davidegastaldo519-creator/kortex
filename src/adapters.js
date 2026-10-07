import { spawn } from 'node:child_process';

const ANSI = /\x1b\[[0-9;?]*[A-Za-z]/g;
// Frasi con cui le CLI segnalano che l'abbonamento ha finito il limite.
const LIMITE = /rate.?limit|usage limit|limit reached|quota|too many requests|\b429\b|resource_exhausted/i;
// Una CLI che chiede di fare il login o una conferma non può andare avanti qui dentro.
const CHIEDE_LOGIN = /Opening authentication page|Do you want to continue\? \[Y\/n\]|Please visit the following URL|sign in|log ?in to continue|IneligibleOrProjectId/i;

const attivi = new Set();

export function fermaTutti() {
  for (const p of attivi) {
    try { p.kill('SIGTERM'); } catch { /* già chiuso */ }
  }
  attivi.clear();
}

function costruisciArgs(modello, variabili) {
  const out = [];
  for (const t of modello) {
    if (t === '{extra}') out.push(...(variabili.extra || []));
    else if (t === '{resume}') out.push(...(variabili.resume || []));
    else if (t === '{adddir}') out.push(...(variabili.adddir || []));
    else out.push(t.replace(/\{(\w+)\}/g, (_, k) => variabili[k] ?? ''));
  }
  return out.filter((a) => a !== '');
}

function descriviStrumento(input = {}) {
  const x = input.file_path || input.path || input.command || input.pattern || '';
  return x ? `  ${String(x).slice(0, 70)}` : '';
}

export function eseguiIA({ cfg, prompt, cwd, sessione, extra, modello, adddir, timeoutSecondi, onTesto, onLog }) {
  return new Promise((risolvi) => {
    const resume = sessione && cfg.resume ? cfg.resume.map((x) => x.replace('{session}', sessione)) : [];
    const args = costruisciArgs(cfg.args, { prompt, extra, resume, modello, adddir });
    const mostrati = args.map((a) => (a === prompt ? '«prompt»' : a)).join(' ');
    onLog?.(`▶ ${cfg.nome}: ${cfg.bin} ${mostrati}`.slice(0, 160));

    let proc;
    try {
      proc = spawn(cfg.bin, args, {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
      });
    } catch (e) {
      return risolvi({ ok: false, errore: e.message });
    }
    attivi.add(proc);

    let buffer = '', testo = '', errori = '', finale = null, costo = null;
    let sessioneNuova = sessione || null;
    let chiuso = false;
    let bloccato = null;
    const controllaBlocco = (t) => {
      if (bloccato || !CHIEDE_LOGIN.test(t)) return;
      bloccato = /IneligibleOrProjectId/.test(t)
        ? `${cfg.nome}: l'account non ha la quota attiva (serve un progetto Google Cloud: vedi la GUIDA, voce "Gemini")`
        : `${cfg.nome} chiede di fare il login: esci da KORTEX, lancia "${cfg.bin}" da solo e accedi`;
      try { proc.kill('SIGTERM'); } catch { /* */ }
    };

    const timer = setTimeout(() => {
      errori += '\n[tempo scaduto]';
      try { proc.kill('SIGTERM'); } catch { /* */ }
    }, (timeoutSecondi || 900) * 1000);

    proc.stdout.on('data', (d) => {
      const s = d.toString();
      if (cfg.parser !== 'claude-stream') {
        const pulito = s.replace(ANSI, '');
        controllaBlocco(pulito);
        if (bloccato) return;
        testo += pulito;
        onTesto?.(pulito);
        return;
      }
      // Claude Code: una riga JSON per evento.
      buffer += s;
      let i;
      while ((i = buffer.indexOf('\n')) >= 0) {
        const riga = buffer.slice(0, i).trim();
        buffer = buffer.slice(i + 1);
        if (!riga) continue;
        let ev;
        try { ev = JSON.parse(riga); } catch { continue; }
        if (ev.session_id) sessioneNuova = ev.session_id;
        if (ev.type === 'assistant' && Array.isArray(ev.message?.content)) {
          for (const c of ev.message.content) {
            if (c.type === 'text' && c.text) {
              testo += c.text + '\n';
              onTesto?.(c.text + '\n');
            } else if (c.type === 'tool_use') {
              onLog?.(`  ▸ ${cfg.nome} → ${c.name}${descriviStrumento(c.input)}`);
            }
          }
        }
        if (ev.type === 'result') {
          finale = typeof ev.result === 'string' ? ev.result : null;
          costo = typeof ev.total_cost_usd === 'number' ? ev.total_cost_usd : null;
          if (ev.is_error) errori += String(ev.result || 'errore');
        }
      }
    });

    proc.stderr.on('data', (d) => {
      controllaBlocco(d.toString());
      errori += d.toString().replace(ANSI, '');
      if (errori.length > 20000) errori = errori.slice(-20000);
    });

    const fine = (risultato) => {
      if (chiuso) return;
      chiuso = true;
      clearTimeout(timer);
      attivi.delete(proc);
      risolvi(risultato);
    };

    proc.on('error', (e) =>
      fine({ ok: false, errore: e.code === 'ENOENT' ? `${cfg.bin} non trovato` : e.message })
    );

    proc.on('close', (codice) => {
      const uscita = (finale ?? testo).trim();
      const limitato = LIMITE.test(errori) || (codice !== 0 && LIMITE.test(uscita));
      const ok = codice === 0 && !limitato && !bloccato && uscita.length > 0;
      const ultimaRiga = bloccato || errori.trim().split('\n').slice(-3).join(' ');
      fine({
        ok,
        testo: uscita,
        sessione: sessioneNuova,
        costo,
        codice,
        limitato,
        errore: ok ? null : ultimaRiga || (uscita ? `uscita ${codice}` : 'nessuna risposta'),
      });
    });
  });
}
