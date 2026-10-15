// La geometria dell'interfaccia, condivisa tra la schermata iniziale e l'app:
// così il teschio della schermata finisce esattamente dove sta quello dell'intestazione.
export function geometria(colonne, righe) {
  const c = Math.max(20, colonne || 80);
  const H = Math.max(16, (righe || 24) - 1);
  const grande = H >= 40 && c >= 140;
  const hTesta = grande ? 9 : 3;
  const hCorpo = H - hTesta - 1 - 3;
  const wTerm = Math.max(44, Math.floor(c * 0.44));
  // dove sta il teschio nell'intestazione (colonna, riga, larghezza, altezza)
  const teschio = grande ? { x: 1, y: 0, w: 15, h: 8 } : { x: 1, y: 0, w: 7, h: 3 };
  return { c, H, grande, hTesta, hCorpo, wTerm, teschio };
}
