// L'OUTPUT a bolle: ogni IA parla nella sua bolla (bordo col suo colore, nome, ruolo, compito, tempo),
// i tuoi messaggi stanno in una bolla a destra, e dentro le bolle il testo è markdown formattato:
// titoli, grassetto, corsivo, `codice`, elenchi, citazioni, righe divisorie e blocchi di codice colorati.
// Il risultato è una lista di righe già pronte, ognuna fatta di pezzi { t, c, b, i, bg }.
import stringWidth from 'string-width';
import { C, COLORE_IA } from './grafica.js';

const larghezza = (s) => stringWidth(s);
// simboli che Ink e il terminale misurano diversamente: li normalizzo così i bordi restano dritti
const normalizza = (s) => s.replace(/\t/g, '  ').replace(/✔/g, '✓').replace(/✖/g, '✗').replace(/⚠/g, '△').replace(/▶/g, '▸').replace(/[​-‏️]/g, '');

// ---------- il codice colorato ----------

const PAROLE = new Set(('const let var function return if else for while do switch case break continue new class extends import from export default async await try catch finally throw typeof instanceof in of this null undefined true false ' +
  'def lambda pass yield with as elif None True False and or not is global nonlocal raise print self ' +
  'echo fi then esac done local sudo cd ls cp mv rm mkdir chmod git npm node python3 pip').split(' '));

function coloraCodice(riga, lingua) {
  const pezzi = [];
  const commento = lingua === 'py' || lingua === 'python' || lingua === 'sh' || lingua === 'bash' || lingua === 'yaml' || lingua === 'yml' ? '#' : '//';
  const re = /("(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?|`[^`]*`?)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|(\s+)|(.)/g;
  let m;
  let resto = riga;
  const ic = riga.indexOf(commento);
  let codice = riga;
  if (ic >= 0 && !/["'`]/.test(riga.slice(0, ic))) { codice = riga.slice(0, ic); resto = riga.slice(ic); } else resto = '';
  while ((m = re.exec(codice))) {
    if (m[1]) pezzi.push({ t: m[1], c: '#C3E88D' });
    else if (m[2]) pezzi.push({ t: m[2], c: '#F78C6C' });
    else if (m[3]) pezzi.push({ t: m[3], c: PAROLE.has(m[3]) ? '#C792EA' : /^[A-Z]/.test(m[3]) ? '#FFCB6B' : codice[re.lastIndex] === '(' ? '#82AAFF' : '#EEFFFF' });
    else pezzi.push({ t: m[0], c: m[4] ? '#EEFFFF' : '#89DDFF' });
  }
  if (resto) pezzi.push({ t: resto, c: '#697098', i: true });
  return pezzi;
}

// ---------- il testo in linea: **grassetto**, *corsivo*, `codice` ----------

function inLinea(testo, base) {
  const pezzi = [];
  const re = /(\*\*[^*]+\*\*|__[^_]+__)|(`[^`]+`)|(\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;
  let ultimo = 0;
  let m;
  while ((m = re.exec(testo))) {
    if (m.index > ultimo) pezzi.push({ ...base, t: testo.slice(ultimo, m.index) });
    if (m[1]) pezzi.push({ ...base, t: m[1].slice(2, -2), b: true, c: base.cForte || base.c });
    else if (m[2]) pezzi.push({ t: m[2].slice(1, -1), c: '#FFCB6B', bg: '#1E1E2A' });
    else pezzi.push({ ...base, t: m[3].slice(1, -1), i: true });
    ultimo = re.lastIndex;
  }
  if (ultimo < testo.length) pezzi.push({ ...base, t: testo.slice(ultimo) });
  return pezzi;
}

// Manda a capo una riga fatta di pezzi, rispettando le parole quando si può.
function aCapo(pezzi, w, rientro = 0) {
  const car = [];
  for (const p of pezzi) for (const ch of p.t) car.push({ ch, p });
  if (!car.length) return [[]];
  const righe = [];
  let i = 0;
  let primo = true;
  while (i < car.length) {
    const spazio = Math.max(4, w - (primo ? 0 : rientro));
    let fine = i;
    let largo = 0;
    while (fine < car.length && largo + larghezza(car[fine].ch) <= spazio) { largo += larghezza(car[fine].ch); fine++; }
    if (fine < car.length) {
      let k = fine;
      while (k > i && car[k - 1].ch !== ' ') k--;
      if (k > i + spazio / 3) fine = k;
    }
    if (fine === i) fine = i + 1;
    const riga = [];
    if (!primo && rientro) riga.push({ t: ' '.repeat(rientro) });
    for (let k = i; k < fine; k++) {
      const u = riga[riga.length - 1];
      if (u && u.p === car[k].p) u.t += car[k].ch;
      else riga.push({ ...car[k].p, p: car[k].p, t: car[k].ch });
    }
    righe.push(riga.map(({ p, ...x }) => x));
    i = fine;
    while (i < car.length && car[i].ch === ' ') i++;
    primo = false;
  }
  return righe;
}

// Il markdown di un blocco di testo → righe di pezzi, larghe al massimo w.
export function markdown(testo, w, colore = C.gesso) {
  const out = [];
  let codice = null;
  for (const grezza of normalizza(testo).split('\n')) {
    const riga = grezza.replace(/\s+$/, '');
    const recinto = riga.match(/^\s*```\s*([\w+-]*)/);
    if (recinto) {
      if (codice === null) { codice = recinto[1] || ''; out.push([{ t: ` ${codice || 'codice'} `.padEnd(Math.max(4, w), ' ').slice(0, w), c: '#697098', bg: '#16161F' }]); }
      else { codice = null; out.push([{ t: ' '.repeat(w), bg: '#16161F' }]); }
      continue;
    }
    if (codice !== null) {
      // il codice non va a capo: si taglia, con lo sfondo scuro fino al bordo
      const pezzi = coloraCodice(riga, codice);
      let largo = 0;
      const tagliati = [];
      for (const p of pezzi) { const resto = w - 1 - largo; if (resto <= 0) break; const t = [...p.t].slice(0, resto).join(''); tagliati.push({ ...p, t, bg: '#16161F' }); largo += larghezza(t); }
      out.push([{ t: ' ', bg: '#16161F' }, ...tagliati, { t: ' '.repeat(Math.max(0, w - 1 - largo)), bg: '#16161F' }]);
      continue;
    }
    let m;
    if (!riga.trim()) { out.push([]); continue; }
    if ((m = riga.match(/^(#{1,6})\s+(.*)/))) {
      const livello = m[1].length;
      const col = livello === 1 ? C.rosa : livello === 2 ? C.ciano : C.viola;
      out.push(...aCapo(inLinea(m[2].replace(/#+\s*$/, ''), { c: col, b: true }), w));
      if (livello <= 2) out.push([{ t: '─'.repeat(Math.min(w, larghezza(m[2]) + 2)), c: C.scuro }]);
      continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(riga)) { out.push([{ t: '─'.repeat(w), c: C.scuro }]); continue; }
    if ((m = riga.match(/^(\s*)([-*+]|\d+[.)])\s+(\[[ xX]\]\s+)?(.*)/))) {
      const rientro = Math.min(8, m[1].length);
      const segno = /\d/.test(m[2]) ? m[2] : rientro ? '◦' : '•';
      const spunta = m[3] ? (/x/i.test(m[3]) ? '■ ' : '□ ') : '';
      const testa = ' '.repeat(rientro) + segno + ' ' + spunta;
      out.push(...aCapo([{ t: testa, c: C.rosa }, ...inLinea(m[4], { c: colore })], w, larghezza(testa)));
      continue;
    }
    if ((m = riga.match(/^\s*>\s?(.*)/))) {
      out.push(...aCapo([{ t: '▎ ', c: C.viola }, ...inLinea(m[1], { c: C.grigio, i: true })], w, 2));
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(riga)) {
      if (/^\s*\|[\s:|-]+\|\s*$/.test(riga)) { out.push([{ t: '─'.repeat(Math.min(w, larghezza(riga.trim()))), c: C.scuro }]); continue; }
      const celle = riga.trim().slice(1, -1).split('|');
      const pezzi = [];
      celle.forEach((cella, k) => { pezzi.push({ t: k ? ' │ ' : '', c: C.scuro }); pezzi.push(...inLinea(cella.trim(), { c: colore })); });
      out.push(...aCapo(pezzi, w));
      continue;
    }
    out.push(...aCapo(inLinea(riga, { c: colore }), w));
  }
  return out;
}

// ---------- le bolle ----------

const ETICHETTA = { direttore: 'direttore', pianificatore: 'pianificatore', esecutore: 'esecutore', operatore: 'operatore', revisore: 'revisore', chat: 'chat', memorista: 'memorista', catalogatore: 'catalogatore' };
const durata = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return s >= 60 ? `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s` : `${s}s`; };
const riempi = (pezzi, w) => { const l = pezzi.reduce((a, p) => a + larghezza(p.t), 0); return l < w ? [...pezzi, { t: ' '.repeat(w - l) }] : pezzi; };

function bollaIA(m, w, nomi, spin) {
  const col = COLORE_IA[m.ia] || C.viola;
  const dentro = Math.max(10, w - 4);
  const testa = ` ${nomi[m.ia] || m.ia} · ${ETICHETTA[m.ruolo] || m.ruolo}${m.compito !== null && m.compito !== undefined ? ` · compito ${m.compito + 1}` : ''} `;
  const tempo = ` ${m.fine ? durata(m.fine - m.inizio) : spin + ' ' + durata(Date.now() - m.inizio)} `;
  const trattino = Math.max(1, w - 3 - larghezza(testa) - larghezza(tempo));
  const righe = [[{ t: '╭─', c: col }, { t: testa, c: col, b: true }, { t: '─'.repeat(trattino), c: col }, { t: tempo, c: m.fine ? C.grigio : C.rosa }, { t: '╮', c: col }]];
  // il corpo si ricalcola solo quando arriva testo nuovo
  const chiave = `${dentro}|${m.testo.length}`;
  if (!m._corpo || m._corpo.chiave !== chiave) m._corpo = { chiave, righe: markdown(m.testo.replace(/^\n+|\n+$/g, ''), dentro) };
  const corpo = m._corpo.righe;
  for (const r of corpo) righe.push([{ t: '│ ', c: col }, ...riempi(r, dentro), { t: ' │', c: col }]);
  righe.push([{ t: '╰' + '─'.repeat(Math.max(0, w - 2)) + '╯', c: col }]);
  return righe;
}

function bollaUtente(testo, w) {
  const max = Math.max(16, Math.floor(w * 0.72));
  const corpo = aCapo([{ t: testo, c: '#FFFFFF' }], max - 4);
  const largo = Math.min(max, Math.max(...corpo.map((r) => r.reduce((a, p) => a + larghezza(p.t), 0))) + 4, max);
  const sx = ' '.repeat(Math.max(0, w - Math.max(largo, 10)));
  const L = Math.max(largo, 10);
  const righe = [[{ t: sx }, { t: '╭─ tu ' + '─'.repeat(Math.max(0, L - 7)) + '╮', c: C.rosa }]];
  for (const r of corpo) righe.push([{ t: sx }, { t: '│ ', c: C.rosa }, ...riempi(r, L - 4), { t: ' │', c: C.rosa }]);
  righe.push([{ t: sx }, { t: '╰' + '─'.repeat(L - 2) + '╯', c: C.rosa }]);
  return righe;
}

// Le righe di sistema (titoli, esiti, riepilogo): colore secondo il simbolo con cui iniziano.
function rigaSistema(r, w) {
  if (r.startsWith('▌ ')) {
    const t = ` ${r.slice(2)} `;
    return [[{ t: '━━', c: C.ciano }, { t, c: C.ciano, b: true }, { t: '━'.repeat(Math.max(0, w - 2 - larghezza(t))), c: C.scuro }]];
  }
  const col = r.includes('✗') ? C.rosso : r.trimStart().startsWith('✓') ? C.verde : r.trimStart().startsWith('△') || r.startsWith('?') ? C.giallo : r.startsWith('📚') ? C.ciano : C.grigio;
  return aCapo(inLinea(r, { c: col }), w);
}

const cache = new WeakMap();

/**
 * Tutti i messaggi → le righe da mostrare.
 * messaggi: [{ tipo: 'sistema', testo } | { tipo: 'ia', ia, ruolo, compito, testo, inizio, fine }]
 */
export function impagina(messaggi, w, { nomi = {}, spin = '·', bolle = true } = {}) {
  const tutte = [];
  for (const m of messaggi) {
    const chiave = `${w}|${m.testo.length}|${m.fine || 0}|${bolle}`;
    const c = cache.get(m);
    if (c && c.chiave === chiave && m.tipo !== 'ia') { tutte.push(...c.righe); continue; }
    if (c && c.chiave === chiave && m.fine) { tutte.push(...c.righe); continue; }
    let righe = [];
    if (m.tipo === 'ia') {
      righe = bolle ? bollaIA(m, w, nomi, spin) : markdown(m.testo, w);
      if (bolle) righe.unshift([]);
    } else {
      for (const r of normalizza(m.testo).split('\n')) {
        if (bolle && r.startsWith('› ')) { righe.push([]); righe.push(...bollaUtente(r.slice(2), w)); }
        else if (!r.trim()) righe.push([]);
        else righe.push(...rigaSistema(r, w));
      }
    }
    cache.set(m, { chiave, righe });
    tutte.push(...righe);
  }
  // niente righe vuote doppie
  return tutte.filter((r, i) => r.length || (tutte[i - 1] && tutte[i - 1].length));
}
