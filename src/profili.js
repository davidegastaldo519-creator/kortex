// I profili di lavoro: con un comando KORTEX si prepara per il tipo di lavoro che stai per fare.
// Un profilo cambia la mappatura, alcuni parametri, la scheda e il fuoco iniziali, e aggiunge alle IA
// una riga di contesto ("stai lavorando su un server Minecraft…"). Si sceglie con /profilo o con Ctrl+P.
import { applicaMappatura } from './parametri.js';

export const PROFILI = {
  programmatore: {
    nome: 'PROGRAMMATORE', icona: '⌘', descrizione: 'squadra completa, revisore che esegue i test, diff in primo piano',
    mappa: 3, valori: { revisoreVerifica: true, usaRevisore: true, usaPianificatore: true },
    scheda: 'diff', fuoco: 'ia', modo: null,
    contesto: 'Lavori su codice: scrivi codice pulito e commentato in italiano dove serve, e quando possibile fai verificare il risultato con un compito "comando" (test, avvio del programma).',
  },
  minecraft: {
    nome: 'MINECRAFT', icona: '◈', descrizione: 'terminale SSH sul server in primo piano, operatore per i comandi del server',
    mappa: 3, valori: { revisoreVerifica: true },
    scheda: 'agenti', fuoco: 'shell', modo: null, destinazione: /vps|server|newhorizon|minecraft|contabo|mc/i,
    contesto: 'Lavori su un server Minecraft (Paper) raggiungibile via SSH. I comandi sul server si lanciano con un compito "comando" dell\'operatore usando ssh verso la destinazione indicata; prima di riavviare il server o toccare i mondi, fai sempre una copia di sicurezza dei file che modifichi.',
  },
  studio: {
    nome: 'STUDIO', icona: '◇', descrizione: 'domande e risposte veloci: chat diretta con una sola IA, niente squadra',
    mappa: 1, valori: {}, scheda: 'output', fuoco: 'ia', modo: 'chat',
    contesto: 'Rispondi in modo chiaro e didattico, in italiano, con esempi brevi.',
  },
  creativo: {
    nome: 'CREATIVO', icona: '◆', descrizione: 'giochi e grafica: anteprime HTML in un file solo, immagini nel database',
    mappa: 3, valori: { revisoreVerifica: true }, scheda: 'agenti', fuoco: 'ia', modo: null,
    contesto: 'Lavori su giochi e grafica: quando possibile crea anteprime in un unico file HTML che si apre col browser, con colori curati e animazioni fluide; le immagini e le risorse utili salvale anche nel database di KORTEX.',
  },
};

// Applica un profilo alla configurazione. Restituisce cosa deve cambiare nell'interfaccia.
export function applicaProfilo(config, id) {
  const p = PROFILI[id];
  if (!p) return null;
  applicaMappatura(config, p.mappa - 1);
  Object.assign(config, p.valori);
  config.profilo = id;
  return p;
}

export const bloccoProfilo = (config) => {
  const p = PROFILI[config.profilo];
  return p ? `\nPROFILO DI LAVORO: ${p.nome}. ${p.contesto}\n` : '';
};
