// I temi cambiano i colori d'accento di tutta l'interfaccia, il gradiente del logo, il teschio e la schermata iniziale.
export const TEMI = {
  neon:     { nome: 'NEON',     brand: ['#9D4EDD', '#FF2BD6', '#00F5FF'], viola: '#9D4EDD', rosa: '#FF2BD6', ciano: '#00F5FF' },
  fuoco:    { nome: 'FUOCO',    brand: ['#9D0208', '#E85D04', '#FFBA08'], viola: '#B5361A', rosa: '#FF5400', ciano: '#FFBA08' },
  ghiaccio: { nome: 'GHIACCIO', brand: ['#3A86FF', '#8ECAE6', '#E0FBFC'], viola: '#3A86FF', rosa: '#8ECAE6', ciano: '#E0FBFC' },
  matrix:   { nome: 'MATRIX',   brand: ['#003B00', '#00FF41', '#B6FFB0'], viola: '#008F11', rosa: '#00FF41', ciano: '#B6FFB0' },
  tokyonight: { nome: 'TOKYO NIGHT', brand: ['#7AA2F7', '#BB9AF7', '#7DCFFF'], viola: '#7AA2F7', rosa: '#BB9AF7', ciano: '#7DCFFF', grigio: '#565F89', scuro: '#3B4261', gesso: '#C0CAF5', verde: '#9ECE6A', rosso: '#F7768E', giallo: '#E0AF68' },
  dracula:  { nome: 'DRACULA',  brand: ['#BD93F9', '#FF79C6', '#8BE9FD'], viola: '#BD93F9', rosa: '#FF79C6', ciano: '#8BE9FD', grigio: '#6272A4', scuro: '#44475A', gesso: '#F8F8F2', verde: '#50FA7B', rosso: '#FF5555', giallo: '#F1FA8C' },
  synthwave: { nome: 'SYNTHWAVE', brand: ['#FF2A6D', '#F9C80E', '#05D9E8'], viola: '#D1006F', rosa: '#FF2A6D', ciano: '#05D9E8', grigio: '#7A5C99', scuro: '#3D2A5C', gesso: '#F5E6FF', verde: '#72F1B8', rosso: '#FE4450', giallo: '#F9C80E' },
  vaporwave: { nome: 'VAPORWAVE', brand: ['#FF71CE', '#B967FF', '#01CDFE'], viola: '#B967FF', rosa: '#FF71CE', ciano: '#01CDFE', grigio: '#8A7FA8', scuro: '#423A5C', gesso: '#FFFBF0', verde: '#05FFA1', rosso: '#FF6B8B', giallo: '#FFFB96' },
};

// i colori neutri di base, per i temi che non li cambiano
const BASE = { grigio: '#6B6B80', scuro: '#3A3A4A', gesso: '#E8E4D0', verde: '#39FF14', rosso: '#FF3860', giallo: '#FFE66D' };

// Cambia i colori sul posto: tutti i componenti leggono C a ogni disegno, quindi il cambio è immediato.
export function applicaTema(config, C) {
  const t = TEMI[config.tema] || TEMI.neon;
  C.viola = t.viola;
  C.rosa = t.rosa;
  C.ciano = t.ciano;
  for (const k of Object.keys(BASE)) C[k] = t[k] || BASE[k];
  C.tema = TEMI[config.tema] ? config.tema : 'neon';
  config.brand.colori = [...t.brand];
  return t;
}
