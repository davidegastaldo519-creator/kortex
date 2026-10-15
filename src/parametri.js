import fs from 'node:fs';
import os from 'node:os';
import { FILE_CONFIG } from './config.js';

// Ogni parametro della plancia: cosa regola e perché, in parole semplici.
export const PARAMETRI = [
  {
    chiave: 'autonomia', nome: 'Autonomia', tipo: 'scelta', valori: ['prudente', 'totale'],
    spiega: 'PRUDENTE: le IA modificano i file del progetto ma non lanciano comandi. TOTALE: fanno tutto da sole, comandi compresi (npm install, script...). Usa TOTALE solo in cartelle di progetto e con un backup.',
  },
  {
    chiave: 'parallelo', nome: 'Compiti in parallelo', tipo: 'numero', min: 1, max: 4, passo: 1,
    spiega: 'Quanti compiti possono lavorare INSIEME quando non dipendono l\'uno dall\'altro, su IA diverse o sulla stessa. 1 = uno alla volta. Più in parallelo = più veloce, ma sull\'HP a 2 core pesa.',
  },
  {
    chiave: 'maxCompiti', nome: 'Compiti massimi', tipo: 'numero', min: 1, max: 8, passo: 1,
    spiega: 'In quanti pezzi al massimo il direttore può dividere una richiesta. Pochi = più veloce. Tanti = lavori grandi fatti con ordine.',
  },
  {
    chiave: 'usaPianificatore', nome: 'Pianificatore', tipo: 'sino',
    spiega: 'Se acceso, prima di lavorare un\'IA scrive un piano a passi. Rende il lavoro più ordinato ma costa una chiamata in più per compito.',
  },
  {
    chiave: 'usaRevisore', nome: 'Revisione', tipo: 'sino',
    spiega: 'Se accesa, un\'IA controlla il lavoro fatto. È il secondo paio d\'occhi: spegnila solo per cose banali.',
  },
  {
    chiave: 'revisoreVerifica', nome: 'Revisore esegue test', tipo: 'sino',
    spiega: 'Se acceso, il revisore può LANCIARE i test o il programma per verificare davvero (node file.js, python3, npm test). Non modifica mai i file. Spento = controlla solo leggendo.',
  },
  {
    chiave: 'revisoreIndipendente', nome: 'Revisore diverso', tipo: 'sino',
    spiega: 'Se acceso, a controllare è un\'IA diversa da chi ha fatto il lavoro, quando possibile. Un errore si vede meglio con occhi nuovi.',
  },
  {
    chiave: 'maxCorrezioni', nome: 'Correzioni massime', tipo: 'numero', min: 0, max: 3, passo: 1,
    spiega: 'Quante volte l\'esecutore può correggere dopo una bocciatura del revisore. 0 = nessuna correzione, 3 = insiste finché è giusto.',
  },
  {
    chiave: 'timeoutSecondi', nome: 'Tempo massimo per IA', tipo: 'numero', min: 60, max: 1800, passo: 60, unita: 's',
    spiega: 'Dopo quanti secondi una chiamata viene interrotta e si passa alla riserva. Alzalo per lavori lunghi.',
  },
  {
    chiave: 'silenzioSecondi', nome: 'Silenzio massimo', tipo: 'numero', min: 60, max: 900, passo: 60, unita: 's',
    spiega: 'Se un\'IA non scrive niente per questo tempo, KORTEX la considera bloccata e passa alla riserva. Protegge dalle CLI rimaste appese a una domanda che nessuno vede. Direttore, pianificatore e revisore hanno comunque al massimo 10 minuti: solo l\'esecutore può lavorare a lungo.',
  },
  {
    chiave: 'memoriaRighe', nome: 'Memoria del direttore', tipo: 'numero', min: 10, max: 100, passo: 10, unita: ' righe',
    spiega: 'Quante righe del diario di progetto legge il direttore prima di decidere. Più memoria = più contesto, ma prompt più lunghi.',
  },
  {
    chiave: 'grafica', nome: 'Grafica', tipo: 'scelta', valori: ['auto', 'piena', 'leggera', 'spenta'],
    spiega: 'AUTO misura il PC all\'avvio e sceglie da sola. PIENA: teschio 3D, neuroni, transizioni. LEGGERA: tutto fermo tranne l\'essenziale, lascia la CPU alle IA. SPENTA: nessuna animazione.',
  },
  {
    chiave: 'suoni', nome: 'Suoni', tipo: 'sino',
    spiega: 'Suoni brevi quando un compito finisce, quando arriva una notifica o un errore, e nella schermata iniziale. Li crea KORTEX stesso. /suoni li accende e spegne al volo.',
  },
  {
    chiave: 'mouse', nome: 'Mouse', tipo: 'sino',
    spiega: 'Clic su pagine, schede, voci e pulsanti; rotella per scorrere. Con il mouse acceso, per selezionare testo nel terminale tieni premuto SHIFT mentre trascini.',
  },
  {
    chiave: 'tema', nome: 'Tema di colore', tipo: 'scelta', valori: ['neon', 'fuoco', 'ghiaccio', 'matrix', 'tokyonight', 'dracula', 'synthwave', 'vaporwave'],
    spiega: 'I colori di tutto KORTEX: interfaccia, logo e animazione iniziale. NEON viola e ciano, FUOCO rosso e oro, GHIACCIO azzurro e bianco, MATRIX verde, TOKYO NIGHT blu notte, DRACULA viola e rosa, SYNTHWAVE tramonto anni 80, VAPORWAVE pastello.',
  },
  {
    chiave: 'memoriaAutomatica', nome: 'Memoria automatica', tipo: 'sino',
    spiega: 'Dopo ogni richiesta il MEMORISTA aggiorna il riassunto del progetto, salva nel database le soluzioni riutilizzabili e registra le preferenze che hai espresso. Costa una chiamata in più, fatta in sottofondo.',
  },
  { chiave: 'titolare.direttore', ruolo: 'direttore', nome: 'Titolare Direttore', tipo: 'titolare', spiega: 'Quale IA divide il lavoro. Le altre restano come riserva, in ordine.' },
  { chiave: 'titolare.pianificatore', ruolo: 'pianificatore', nome: 'Titolare Pianificatore', tipo: 'titolare', spiega: 'Quale IA scrive i piani. Le altre restano come riserva.' },
  { chiave: 'titolare.esecutore', ruolo: 'esecutore', nome: 'Titolare Esecutore', tipo: 'titolare', spiega: 'Quale IA scrive davvero i file. Solo Claude e Codex possono farlo.' },
  { chiave: 'titolare.operatore', ruolo: 'operatore', nome: 'Titolare Operatore', tipo: 'titolare', spiega: 'Quale IA lancia comandi, test e script dentro il progetto quando il direttore crea un compito "comando".' },
  { chiave: 'titolare.revisore', ruolo: 'revisore', nome: 'Titolare Revisore', tipo: 'titolare', spiega: 'Quale IA controlla il lavoro. Meglio se diversa dall\'esecutore.' },
  { chiave: 'titolare.memorista', ruolo: 'memorista', nome: 'Titolare Memorista', tipo: 'titolare', spiega: 'Quale IA aggiorna la memoria dopo ogni richiesta. Gemini va benissimo: è un lavoro di riassunto.' },
];

// Mappature pronte, dalla più leggera alla più profonda.
export const MAPPATURE = [
  { nome: 'LAMPO', uso: 'domande, ritocchi di una riga', valori: { maxCompiti: 1, parallelo: 1, usaPianificatore: false, usaRevisore: false, maxCorrezioni: 0, timeoutSecondi: 300 } },
  { nome: 'AGILE', uso: 'piccole modifiche, un file', valori: { maxCompiti: 2, parallelo: 2, usaPianificatore: false, usaRevisore: true, maxCorrezioni: 0, timeoutSecondi: 600 } },
  { nome: 'STANDARD', uso: 'il lavoro di tutti i giorni', valori: { maxCompiti: 3, parallelo: 2, usaPianificatore: true, usaRevisore: true, maxCorrezioni: 1, timeoutSecondi: 900 } },
  { nome: 'ACCURATO', uso: 'funzioni nuove, più file', valori: { maxCompiti: 5, parallelo: 2, usaPianificatore: true, usaRevisore: true, maxCorrezioni: 2, timeoutSecondi: 1200 } },
  { nome: 'PROFONDO', uso: 'progetti interi, riorganizzazioni', valori: { maxCompiti: 8, parallelo: 3, usaPianificatore: true, usaRevisore: true, maxCorrezioni: 3, timeoutSecondi: 1800 } },
];

export function leggi(config, p) {
  if (p.tipo === 'titolare') return config.ruoli[p.ruolo]?.[0] ?? '—';
  return config[p.chiave];
}

export function testoValore(config, p) {
  const v = leggi(config, p);
  if (p.tipo === 'sino') return v ? 'SÌ' : 'NO';
  if (p.tipo === 'numero') return `${v}${p.unita || ''}`;
  if (p.tipo === 'titolare') return config.ia[v]?.nome || v;
  return String(v).toUpperCase();
}

// Quanto è "pieno" il cursore, da 0 a 1.
export function livello(config, p) {
  const v = leggi(config, p);
  if (p.tipo === 'numero') return (v - p.min) / (p.max - p.min);
  if (p.tipo === 'sino') return v ? 1 : 0;
  if (p.tipo === 'scelta') return p.valori.length > 1 ? p.valori.indexOf(v) / (p.valori.length - 1) : 1;
  return 1;
}

export function cambia(config, p, verso) {
  if (p.tipo === 'numero') {
    config[p.chiave] = Math.max(p.min, Math.min(p.max, (config[p.chiave] ?? p.min) + verso * p.passo));
  } else if (p.tipo === 'sino') {
    config[p.chiave] = !config[p.chiave];
  } else if (p.tipo === 'scelta') {
    const i = p.valori.indexOf(config[p.chiave]);
    config[p.chiave] = p.valori[(i + verso + p.valori.length) % p.valori.length];
  } else if (p.tipo === 'titolare') {
    const l = config.ruoli[p.ruolo];
    if (l?.length > 1) config.ruoli[p.ruolo] = verso > 0 ? [...l.slice(1), l[0]] : [l[l.length - 1], ...l.slice(0, -1)];
  }
  config.mappa = 'PERSONALIZZATA';
  if (p.chiave === 'grafica') applicaGrafica(config);
}

export function applicaMappatura(config, i) {
  const m = MAPPATURE[i];
  if (!m) return null;
  Object.assign(config, m.valori);
  config.mappa = m.nome;
  return m;
}

// Misura quanto è veloce il PC (una volta per avvio) e decide la grafica effettiva.
let potenzaMisurata = null;
export function misuraPotenza() {
  if (potenzaMisurata !== null) return potenzaMisurata;
  // tre giri, vale il migliore: il primo paga la compilazione del codice, non la velocità del PC
  let ms = Infinity;
  let acc = 0;
  for (let giro = 0; giro < 3; giro++) {
    const t0 = performance.now();
    for (let i = 0; i < 400000; i++) acc += Math.sqrt(i * 0.37 + 1) * Math.sin(i * 0.001);
    ms = Math.min(ms, performance.now() - t0);
  }
  const core = os.cpus().length || 1;
  potenzaMisurata = { ms, core, lento: ms > 9 || (core <= 2 && ms > 6.5), acc };
  return potenzaMisurata;
}

// config.grafica è la scelta dell'utente (auto/piena/leggera/spenta); config.animazioni è quella effettiva che il codice legge.
export function applicaGrafica(config) {
  const scelta = ['auto', 'piena', 'leggera', 'spenta'].includes(config.grafica) ? config.grafica : 'auto';
  config.grafica = scelta;
  if (scelta === 'auto') config.animazioni = process.env.TERMUX_VERSION || misuraPotenza().lento ? 'leggera' : 'piena';
  else config.animazioni = scelta;
  return config.animazioni;
}

export function salvaConfig(config) {
  try {
    fs.writeFileSync(FILE_CONFIG, JSON.stringify(config, null, 2));
    return true;
  } catch {
    return false;
  }
}
