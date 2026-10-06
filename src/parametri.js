import fs from 'node:fs';
import { FILE_CONFIG } from './config.js';

// Ogni parametro della plancia: cosa regola e perché, in parole semplici.
export const PARAMETRI = [
  {
    chiave: 'autonomia', nome: 'Autonomia', tipo: 'scelta', valori: ['prudente', 'totale'],
    spiega: 'PRUDENTE: le IA modificano i file del progetto ma non lanciano comandi. TOTALE: fanno tutto da sole, comandi compresi (npm install, script...). Usa TOTALE solo in cartelle di progetto e con un backup.',
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
    chiave: 'memoriaRighe', nome: 'Memoria del direttore', tipo: 'numero', min: 10, max: 100, passo: 10, unita: ' righe',
    spiega: 'Quante righe del diario di progetto legge il direttore prima di decidere. Più memoria = più contesto, ma prompt più lunghi.',
  },
  {
    chiave: 'animazioni', nome: 'Animazioni', tipo: 'scelta', valori: ['piena', 'leggera', 'spenta'],
    spiega: 'Quanto si muove l\'interfaccia. Su un PC lento, LEGGERA o SPENTA lasciano più CPU alle IA.',
  },
  { chiave: 'titolare.direttore', ruolo: 'direttore', nome: 'Titolare Direttore', tipo: 'titolare', spiega: 'Quale IA divide il lavoro. Le altre restano come riserva, in ordine.' },
  { chiave: 'titolare.pianificatore', ruolo: 'pianificatore', nome: 'Titolare Pianificatore', tipo: 'titolare', spiega: 'Quale IA scrive i piani. Le altre restano come riserva.' },
  { chiave: 'titolare.esecutore', ruolo: 'esecutore', nome: 'Titolare Esecutore', tipo: 'titolare', spiega: 'Quale IA scrive davvero i file. Solo Claude e Codex possono farlo.' },
  { chiave: 'titolare.revisore', ruolo: 'revisore', nome: 'Titolare Revisore', tipo: 'titolare', spiega: 'Quale IA controlla il lavoro. Meglio se diversa dall\'esecutore.' },
];

// Mappature pronte, dalla più leggera alla più profonda.
export const MAPPATURE = [
  { nome: 'LAMPO', uso: 'domande, ritocchi di una riga', valori: { maxCompiti: 1, usaPianificatore: false, usaRevisore: false, maxCorrezioni: 0, timeoutSecondi: 300 } },
  { nome: 'AGILE', uso: 'piccole modifiche, un file', valori: { maxCompiti: 2, usaPianificatore: false, usaRevisore: true, maxCorrezioni: 0, timeoutSecondi: 600 } },
  { nome: 'STANDARD', uso: 'il lavoro di tutti i giorni', valori: { maxCompiti: 3, usaPianificatore: true, usaRevisore: true, maxCorrezioni: 1, timeoutSecondi: 900 } },
  { nome: 'ACCURATO', uso: 'funzioni nuove, più file', valori: { maxCompiti: 5, usaPianificatore: true, usaRevisore: true, maxCorrezioni: 2, timeoutSecondi: 1200 } },
  { nome: 'PROFONDO', uso: 'progetti interi, riorganizzazioni', valori: { maxCompiti: 8, usaPianificatore: true, usaRevisore: true, maxCorrezioni: 3, timeoutSecondi: 1800 } },
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
}

export function applicaMappatura(config, i) {
  const m = MAPPATURE[i];
  if (!m) return null;
  Object.assign(config, m.valori);
  config.mappa = m.nome;
  return m;
}

export function salvaConfig(config) {
  try {
    fs.writeFileSync(FILE_CONFIG, JSON.stringify(config, null, 2));
    return true;
  } catch {
    return false;
  }
}
