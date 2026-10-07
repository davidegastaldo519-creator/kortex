import { eseguiIA } from './adapters.js';

const DOMANDA = 'Rispondi esattamente con la parola OK e nient\'altro.';

function diagnosi(id, r) {
  const e = `${r.errore || ''} ${r.testo || ''}`;
  if (r.limitato) return ['limite dell\'abbonamento raggiunto', 'aspetta che la finestra si riapra: intanto lavorano le riserve'];
  if (/chiede di fare il login|sign in|log ?in|authentic/i.test(e)) return ['non sei collegato', `esci da KORTEX, lancia  ${id}  da solo e fai il login`];
  if (/IneligibleOrProjectId/i.test(e)) return ['account Google senza quota', 'GUIDA, voce "Gemini dà errore di account": serve un progetto Google Cloud'];
  if (/unknown option|unrecognized|unexpected argument|invalid option|no such option|error: unknown/i.test(e)) return ['un\'opzione della riga di comando non esiste più in questa versione della CLI', `apri ${'~/.config/kortex/config.json'} e correggi "args" di ${id}, oppure aggiorna KORTEX`];
  if (/not found|ENOENT/i.test(e)) return ['programma non trovato', `installa ${id} oppure controlla che sia nel PATH`];
  if (/tempo scaduto/i.test(e)) return ['non ha risposto in tempo', 'rete lenta o CLI bloccata: riprova, e se continua lancia la CLI da sola'];
  if (!r.testo) return ['nessuna risposta', 'lancia la CLI da sola per vedere cosa stampa'];
  return ['risposta inattesa', `ha risposto "${(r.testo || '').slice(0, 60)}" invece di OK: probabilmente funziona lo stesso`];
}

// Interroga davvero ogni IA disponibile. Restituisce un rapporto per la riga di comando.
export async function provaTutte(config, disponibili, cwd, scrivi) {
  const righe = [];
  const attive = Object.values(disponibili).filter((d) => d.ok);
  if (!attive.length) { scrivi('Nessuna IA collegata: controlla con  kortex --check'); return; }
  scrivi(`Faccio una domanda vera a ${attive.length} IA (in sola lettura, nessun file toccato)…\n`);
  for (const d of attive) {
    const cfg = config.ia[d.id];
    const t0 = Date.now();
    const r = await eseguiIA({
      cfg, prompt: DOMANDA, cwd, sessione: null,
      extra: config.profili?.lettura?.[d.id] || [],
      modello: d.id === 'ollama' ? (cfg.modello === 'auto' ? d.modelli?.[0] : cfg.modello) : undefined,
      adddir: [], timeoutSecondi: Math.min(120, config.timeoutSecondi || 120),
    });
    const secondi = ((Date.now() - t0) / 1000).toFixed(1);
    const okVero = r.ok && /\bok\b/i.test(r.testo || '');
    if (okVero) {
      scrivi(`  \x1b[32m●\x1b[0m ${d.nome.padEnd(8)} OK in ${secondi}s${r.sessione ? '  (sessione ripresa: sì)' : ''}`);
      righe.push({ id: d.id, ok: true });
    } else {
      const [cosa, rimedio] = diagnosi(d.id, r);
      scrivi(`  \x1b[31m✖\x1b[0m ${d.nome.padEnd(8)} ${cosa} (${secondi}s)\n           → ${rimedio}${r.errore ? `\n           dettaglio: ${String(r.errore).split('\n')[0].slice(0, 160)}` : ''}`);
      righe.push({ id: d.id, ok: false });
    }
  }
  const buone = righe.filter((x) => x.ok).length;
  scrivi(`\n${buone}/${righe.length} IA rispondono. ${buone === righe.length ? 'Tutto pronto.' : 'Sistema quelle con la ✖ seguendo il rimedio indicato.'}`);
}
