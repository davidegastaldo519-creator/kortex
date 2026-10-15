// I suoni di KORTEX: brevi, in stile cyberpunk, sintetizzati da KORTEX stesso (nessun file da scaricare).
// I file WAV vengono creati una volta in ~/.cache/kortex/suoni e suonati con il lettore che c'è:
// pw-play, paplay, aplay, play (sox), ffplay, oppure termux-media-player sul telefono.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';

const DIR = path.join(os.homedir(), '.cache', 'kortex', 'suoni');
const FREQ = 22050;
const VERSIONE_SUONI = 2; // alzare quando cambia una ricetta: i file vengono rigenerati

const dec = (t, k) => Math.exp(-t * k);
const rumore = () => Math.random() * 2 - 1;

// Ogni ricetta restituisce l'ampiezza (-1..1) al tempo t, e dichiara la sua durata.
const RICETTE = {
  // due colpi sordi, come un cuore
  battito: { durata: 0.42, f: (t) => {
    const colpo = (t0, forza) => (t < t0 ? 0 : Math.sin(2 * Math.PI * 52 * (t - t0)) * dec(t - t0, 22) * forza + rumore() * dec(t - t0, 60) * 0.05 * forza);
    return colpo(0, 0.9) + colpo(0.17, 0.6);
  } },
  // un ronzio elettrico che cresce e tremola
  ronzio: { durata: 0.9, f: (t) => {
    const inviluppo = Math.min(1, t / 0.25) * (t > 0.65 ? (0.9 - t) / 0.25 : 1);
    const tremolo = 0.7 + 0.3 * Math.sin(2 * Math.PI * 9 * t);
    const saw = (f) => 2 * ((t * f) % 1) - 1;
    return (saw(68) * 0.35 + saw(136) * 0.2 + Math.sin(2 * Math.PI * 272 * t) * 0.1) * inviluppo * tremolo * 0.6;
  } },
  // il colpo del risveglio: un tonfo basso con un bagliore acuto
  colpo: { durata: 0.55, f: (t) => rumore() * dec(t, 28) * 0.5 + Math.sin(2 * Math.PI * 80 * t) * dec(t, 9) * 0.8 + Math.sin(2 * Math.PI * 1760 * t) * dec(t, 14) * 0.15 },
  // il martello sull'incudine: metallo che vibra
  forgia: { durata: 0.4, f: (t) => (Math.sin(2 * Math.PI * 1180 * t) * 0.35 + Math.sin(2 * Math.PI * 1890 * t) * 0.25 + Math.sin(2 * Math.PI * 2640 * t) * 0.18 + Math.sin(2 * Math.PI * 3470 * t) * 0.12) * dec(t, 11) + rumore() * dec(t, 70) * 0.35 },
  // compito riuscito: due note che salgono
  ok: { durata: 0.34, f: (t) => (t < 0.15 ? Math.sin(2 * Math.PI * 660 * t) * dec(t, 10) : Math.sin(2 * Math.PI * 990 * t) * dec(t - 0.15, 9)) * 0.45 },
  // errore: una sega che scende
  errore: { durata: 0.5, f: (t) => { const f = 320 - t * 300; return (2 * ((t * f) % 1) - 1) * 0.3 * dec(t, 4) * (t > 0.4 ? (0.5 - t) / 0.1 : 1); } },
  // una notifica discreta
  notifica: { durata: 0.22, f: (t) => Math.sin(2 * Math.PI * 1320 * t) * dec(t, 18) * 0.35 + Math.sin(2 * Math.PI * 1980 * t) * dec(t, 25) * 0.12 },
  // il clic di un tasto
  click: { durata: 0.045, f: (t) => rumore() * dec(t, 120) * 0.25 + Math.sin(2 * Math.PI * 2400 * t) * dec(t, 90) * 0.15 },
  // la richiesta è finita: un accordo che si apre
  fine: { durata: 0.9, f: (t) => (Math.sin(2 * Math.PI * 440 * t) + Math.sin(2 * Math.PI * 554 * t) * (t > 0.12 ? 1 : 0) + Math.sin(2 * Math.PI * 659 * t) * (t > 0.24 ? 1 : 0)) * dec(t, 3.2) * 0.22 },
};

function creaWav(ricetta) {
  const n = Math.floor(ricetta.durata * FREQ);
  const dati = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    const t = i / FREQ;
    let v = ricetta.f(t);
    // dissolvenza in coda: niente "clic" alla fine
    const coda = ricetta.durata - t;
    if (coda < 0.02) v *= coda / 0.02;
    if (t < 0.003) v *= t / 0.003;
    dati.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(v * 32767 * 0.9))), i * 2);
  }
  const testa = Buffer.alloc(44);
  testa.write('RIFF', 0); testa.writeUInt32LE(36 + dati.length, 4); testa.write('WAVE', 8);
  testa.write('fmt ', 12); testa.writeUInt32LE(16, 16); testa.writeUInt16LE(1, 20); testa.writeUInt16LE(1, 22);
  testa.writeUInt32LE(FREQ, 24); testa.writeUInt32LE(FREQ * 2, 28); testa.writeUInt16LE(2, 32); testa.writeUInt16LE(16, 34);
  testa.write('data', 36); testa.writeUInt32LE(dati.length, 40);
  return Buffer.concat([testa, dati]);
}

function esiste(cmd) {
  try { execFileSync('sh', ['-c', `command -v ${cmd}`], { stdio: 'ignore' }); return true; } catch { return false; }
}

// Il lettore disponibile su questa macchina, cercato una volta sola.
let lettore;
function trovaLettore() {
  if (lettore !== undefined) return lettore;
  lettore = null;
  const candidati = process.env.TERMUX_VERSION
    ? [['termux-media-player', ['play']]]
    : [['pw-play', []], ['paplay', []], ['aplay', ['-q']], ['play', ['-q']], ['ffplay', ['-nodisp', '-autoexit', '-loglevel', 'quiet']], ['afplay', []]];
  for (const [cmd, args] of candidati) if (esiste(cmd)) { lettore = { cmd, args }; break; }
  return lettore;
}

export function creaSuoni(config) {
  let attivi = config.suoni !== false;
  let pronti = false;
  const prepara = () => {
    if (pronti) return;
    pronti = true;
    try {
      fs.mkdirSync(DIR, { recursive: true });
      const marca = path.join(DIR, `v${VERSIONE_SUONI}`);
      if (!fs.existsSync(marca)) {
        for (const [nome, r] of Object.entries(RICETTE)) fs.writeFileSync(path.join(DIR, nome + '.wav'), creaWav(r));
        fs.writeFileSync(marca, '');
      }
    } catch { /* senza cartella niente suoni, ma KORTEX va avanti */ }
  };
  let ultimo = 0;
  return {
    get attivi() { return attivi; },
    get lettore() { return trovaLettore()?.cmd || null; },
    cartella: DIR,
    cambia(v) { attivi = !!v; config.suoni = attivi; },
    suona(nome) {
      if (!attivi || !RICETTE[nome]) return false;
      const l = trovaLettore();
      if (!l) return false;
      prepara();
      // due suoni nello stesso istante si pestano: ne lascio passare uno ogni 30 ms
      const ora = Date.now();
      if (ora - ultimo < 30 && nome !== 'battito') return false;
      ultimo = ora;
      try {
        const p = spawn(l.cmd, [...l.args, path.join(DIR, nome + '.wav')], { stdio: 'ignore', detached: true });
        p.on('error', () => {});
        p.unref();
        return true;
      } catch { return false; }
    },
  };
}

export const NOMI_SUONI = Object.keys(RICETTE);
