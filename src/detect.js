import { execFile } from 'node:child_process';

const prova = (cmd, args) =>
  new Promise((ok) =>
    execFile(cmd, args, { timeout: 8000 }, (err, stdout, stderr) =>
      ok(err ? null : `${stdout || ''}${stderr || ''}`.trim())
    )
  );

// Controlla quali CLI esistono davvero su questa macchina.
// Il tool lavora solo con quelle trovate: stesso programma su PC, telefono e tablet.
export async function rileva(config) {
  const esito = {};
  await Promise.all(
    Object.entries(config.ia).map(async ([id, cfg]) => {
      const v = await prova(cfg.bin, ['--version']);
      esito[id] = {
        id,
        nome: cfg.nome,
        ok: v !== null,
        versione: v ? v.split('\n')[0].slice(0, 40) : null,
        nota: v === null ? 'non installato' : null,
        limitato: false,
      };
    })
  );

  // Ollama senza modelli scaricati (o col server spento) non serve a niente.
  if (esito.ollama?.ok) {
    const lista = await prova('ollama', ['list']);
    const modelli = (lista || '')
      .split('\n')
      .slice(1)
      .map((r) => r.trim().split(/\s+/)[0])
      .filter(Boolean);
    esito.ollama.modelli = modelli;
    if (!modelli.length) {
      esito.ollama.ok = false;
      esito.ollama.nota = 'installato ma senza modelli o server spento';
    }
  }
  // Stesso ordine della configurazione, non di chi risponde per primo.
  return Object.fromEntries(Object.keys(config.ia).map((id) => [id, esito[id]]));
}
