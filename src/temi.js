// I temi cambiano i colori d'accento di tutta l'interfaccia, il gradiente del logo e l'animazione iniziale.
export const TEMI = {
  neon:     { nome: 'NEON',     brand: ['#9D4EDD', '#FF2BD6', '#00F5FF'], viola: '#9D4EDD', rosa: '#FF2BD6', ciano: '#00F5FF' },
  fuoco:    { nome: 'FUOCO',    brand: ['#9D0208', '#E85D04', '#FFBA08'], viola: '#B5361A', rosa: '#FF5400', ciano: '#FFBA08' },
  ghiaccio: { nome: 'GHIACCIO', brand: ['#3A86FF', '#8ECAE6', '#E0FBFC'], viola: '#3A86FF', rosa: '#8ECAE6', ciano: '#E0FBFC' },
  matrix:   { nome: 'MATRIX',   brand: ['#003B00', '#00FF41', '#B6FFB0'], viola: '#008F11', rosa: '#00FF41', ciano: '#B6FFB0' },
};

// Cambia i colori sul posto: tutti i componenti leggono C a ogni disegno, quindi il cambio è immediato.
export function applicaTema(config, C) {
  const t = TEMI[config.tema] || TEMI.neon;
  C.viola = t.viola;
  C.rosa = t.rosa;
  C.ciano = t.ciano;
  config.brand.colori = [...t.brand];
  return t;
}
