# Regole di lavoro su KORTEX

Queste sono le regole operative per qualunque intelligenza artificiale che lavora su questo
progetto. Vanno lette prima di toccare il codice e rispettate sempre.
Il file `AGENTS.md` ha lo stesso contenuto: se cambi uno, cambia anche l'altro.

## 1. Cos'è KORTEX

KORTEX è un programma da terminale che fa lavorare **insieme** più intelligenze artificiali sullo
stesso progetto: Claude Code, Codex, Gemini CLI e Ollama. Usa le CLI già installate sul computer,
quindi gli abbonamenti dell'utente: niente chiavi API e niente costi a consumo.

L'utente scrive cosa vuole ottenere. Dietro le quinte una squadra di ruoli si divide il lavoro:
**direttore** (divide i compiti), **pianificatore** (scrive il piano, non modifica niente),
**esecutore** (lavora sui file), **operatore** (lancia comandi e test), **revisore** (controlla e fa
correggere), più **catalogatore** e **memorista** che lavorano in sottofondo.
L'interfaccia è uno "studio" a sette pagine (LAVORO, PROGETTI, DATABASE, CONTROLLO, STUDIO,
STATISTICHE, GUIDA) con un terminale multi-macchina, un database condiviso in `~/kortex-database`
e una memoria di progetto nella cartella `.kortex/` del progetto.

Come si lancia:

- `kortex` — apre l'interfaccia nella cartella corrente
- `kortex --check` — dice quali IA sono installate
- `kortex --prova` — fa una domanda vera a ogni IA e spiega cosa non va
- `kortex --no-anim` — salta la schermata iniziale
- `kortex --leggera` — grafica leggera solo per questa volta
- `kortex --aggiorna` — scarica l'ultima versione da GitHub
- `kortex --versione` · `kortex --aiuto`
- in sviluppo, dentro questa cartella: `node bin/kortex.js [opzioni]`

La configurazione sta in `~/.config/kortex/config.json`, creata dal modello `config.default.json`.

### Mappa dei file

| File | A cosa serve |
|---|---|
| `bin/kortex.js` | L'eseguibile: chiama `avvia()` di `src/main.js` e, se qualcosa esplode, rimette a posto il terminale e scrive l'errore completo nel registro. |
| `src/main.js` | L'avvio: legge la configurazione, risponde alle opzioni da riga di comando (`--versione`, `--aiuto`, `--aggiorna`, `--prova`, `--check`), fa partire il rilevamento delle IA, mostra la schermata iniziale e poi apre l'interfaccia. |
| `src/config.js` | Carica e fonde `config.default.json` con `~/.config/kortex/config.json`; esporta `RADICE`, `DIR_CONFIG`, `FILE_CONFIG`. |
| `src/detect.js` | Controlla quali CLI delle IA esistono davvero su questa macchina (e se Ollama ha modelli scaricati). |
| `src/adapters.js` | Lancia una CLI come processo figlio, legge quello che scrive, riconosce i limiti di abbonamento e le richieste di login, e sa fermare tutto (`fermaTutti`, `chiudiTutto`). |
| `src/director.js` | Il motore: scelta dell'IA per ogni ruolo con riserva automatica, divisione in compiti, esecuzione anche in parallelo, revisione e correzione, chat diretta, catalogazione e aggiornamento della memoria. |
| `src/prova.js` | La prova vera di `kortex --prova`: una domanda minuscola a ogni IA, con diagnosi e rimedio. |
| `src/state.js` | La memoria del progetto: cartella `.kortex/` con `STATO.md` e `sessioni.json`, elenco dei file cambiati e `git diff` colorato. |
| `src/progetti.js` | Progetti (registro, creazione, importazione), chat di ogni progetto e punti di ripristino (istantanee, confronto, ripristino per file). |
| `src/database.js` | Il database unico `~/kortex-database`: indice, aggiunta di file, note e URL, ricerca, menzioni `@`, categorie, sincronizzazione con GitHub e il guardiano che sorveglia la cartella. |
| `src/memoria.js` | Le preferenze valide in ogni progetto e su ogni PC (`/ricorda`, `/dimentica`) e il blocco di testo da passare alle IA. |
| `src/uso.js` | Il registro dell'uso in `~/.config/kortex/uso.json`: il carburante degli abbonamenti nelle ultime 5 ore e le statistiche personali. |
| `src/telemetria.js` | Raccoglie tutto quello che succede (CPU, RAM, chiamate, compiti) e lo tiene pronto per i grafici della plancia. |
| `src/parametri.js` | I parametri della plancia con la loro spiegazione, le 5 mappature, la misura della potenza del PC e il salvataggio della configurazione. |
| `src/profili.js` | I profili di lavoro (Programmatore, Minecraft, Studio, Creativo): cambiano mappatura, parametri, scheda iniziale e contesto dato alle IA. |
| `src/temi.js` | I temi: cambiano i colori d'accento, il gradiente del logo, il teschio e la schermata iniziale. |
| `src/colori.js` | Colori e piccole utilità condivise (conversioni, gradienti, numeri casuali ripetibili, righe del logo con figlet). |
| `src/geometria.js` | La geometria dell'interfaccia condivisa tra schermata iniziale e app, così il teschio finisce esattamente dove deve. |
| `src/grafica.js` | Il cuore grafico: il binding `html` (htm + React), i colori `C`, i componenti comuni (Pannello, Barra, Gradiente, Neuroni, Cervello, TeschioGrande, Intestazione) e l'elenco delle pagine. |
| `src/teschio3d.js` | Il teschio in 3D vero: forma descritta da una funzione di distanza e disegnata col raymarching, due pixel per cella con i mezzi blocchi. |
| `src/splash.js` | La schermata iniziale "il risveglio" e la classe `Tela` su cui viene disegnata. |
| `src/emblemi.js` | Gli emblemi animati negli angoli delle pagine DATABASE e PROGETTI. |
| `src/icone.js` | Le icone: versione Nerd Font se il font c'è, altrimenti simboli normali. Tutte larghe UNA colonna. |
| `src/markdown.js` | L'OUTPUT a bolle: impaginazione dei messaggi, formattazione markdown, codice colorato e normalizzazione dei simboli che il terminale misura diversamente. |
| `src/barra.js` | La barra di stato in fondo, a blocchi colorati: modalità e profilo, ramo git, avanzamento, carburante, coda, ora. |
| `src/agenti.js` | La scheda AGENTI: albero del lavoro, mappa dei ruoli, linea del tempo e il pannello che li mette insieme. |
| `src/pagine.js` | Tutte le pagine e i pannelli (LAVORO, CONTROLLO, STUDIO, GUIDA, PROGETTI, DATABASE, STATISTICHE), la tavolozza Ctrl+P, il selettore file, la domanda del direttore e la finestra di tutorial e novità. |
| `src/schermo.js` | `SchermoStabile`: riscrive solo le righe che cambiano, così non c'è sfarfallio. Vedi la sezione 6. |
| `src/mouse.js` | Il mouse: intercetta le sequenze del terminale prima che arrivino a Ink, le trasforma in eventi, gestisce zone cliccabili e rotella. |
| `src/terminale.js` | Il terminale multi-macchina: legge `~/.ssh/config`, tiene l'elenco delle destinazioni e le sessioni vive (questo PC, SSH, Python, Node). |
| `src/suoni.js` | I suoni, sintetizzati da KORTEX stesso in `~/.cache/kortex/suoni` e suonati col lettore che c'è sul sistema. |
| `src/guida.js` | Il testo del manuale interno mostrato nella pagina GUIDA. Vedi la sezione 8. |
| `src/ui.js` | L'applicazione intera: stato, tasti, comandi `/`, impaginazione, allegati, coda; e `avviaUI()`, che fa partire Ink sullo `SchermoStabile` e dirotta le stampe nel registro. |

## 2. Tecnologia

- **Node.js** con **moduli ESM**: si usano `import` / `export`, mai `require`.
  `package.json` ha `"type": "module"`. `engines`: Node 18 o superiore (consigliato 20+).
- **Ink 5 + React 18** per l'interfaccia nel terminale.
- I componenti si scrivono con **htm**: template literal `` html`...` `` (il binding è
  `export const html = htm.bind(React.createElement)` in `src/grafica.js`).
  **MAI JSX**: non c'è nessun passaggio di compilazione, un file con JSX non parte.
- **figlet** per i titoli grandi (vedi `righeLogo` in `src/colori.js`).
- **string-width** per misurare quanto è larga una riga sullo schermo.

Dipendenze vere, lette da `package.json`:

- `figlet` ^1.7.0
- `htm` ^3.1.1
- `ink` ^5.0.1
- `ink-text-input` ^6.0.0
- `react` ^18.3.1
- `string-width` ^7.2.0

Non ce ne sono altre, e non si aggiungono dipendenze senza che Davide lo chieda.

Esempio di componente, nello stile del progetto:

```js
import { Box, Text } from 'ink';
import { html, C } from './grafica.js';

export function Titolo({ testo }) {
  return html`<${Box}><${Text} color=${C.ciano} bold>${testo}<//><//>`;
}
```

## 3. Lingua

- Tutti i **commenti nel codice** sono in italiano semplice e chiaro.
- Tutti i **testi mostrati all'utente** (interfaccia, messaggi, avvisi, guida) sono in italiano
  semplice e chiaro.
- Niente termini tecnici inutili: si spiega la cosa, non il meccanismo.
  Si dice "il lavoro è finito", non "task completed"; "non riesco a leggere il file", non
  "ENOENT". I nomi delle funzioni e delle variabili seguono lo stesso stile italiano del codice
  esistente (`eseguiRichiesta`, `riempiA`, `carburante`).

## 4. Simboli

La libreria `string-width` conta alcuni simboli **larghi 2 colonne** mentre il terminale li disegna
**larghi 1**. Il risultato è che le colonne si spostano e i riquadri si rompono.
Quei simboli sono **vietati**.

Vietati esplicitamente: `✔ ✖ ⚠ ▶ ⏳ ❓ ⚙ ⏱ ↕ ▪ ↔ ★`

Al loro posto si usano: `✓ ✗ △ ▸ » ‖ ■ □ ◆`

Tabellina di sostituzione:

| Caso | Vietato | Da usare |
|---|---|---|
| ok, fatto | `✔` | `✓` |
| errore | `✖` | `✗` |
| avviso | `⚠` | `△` |
| freccia, voce attiva | `▶` | `▸` |
| in corso | `⏳` | `»` |
| in pausa, fermo, insieme | `⏱` | `‖` |
| pieno | `▪` | `■` |
| vuoto | `▫` | `□` |
| punto elenco | `★` | `◆` |
| domanda | `❓` | `?` |
| impostazioni | `⚙` | `◆` |
| su e giù | `↕` | `↑↓` |
| sinistra e destra | `↔` | `←→` |

Altre regole sui simboli:

- Si possono usare **SOLO** simboli presenti nel font **JetBrainsMono Nerd Font** (è quello che
  l'installer mette). Se non sei sicuro che un simbolo ci sia, non usarlo.
- Niente **emoji** nell'interfaccia: sono larghe 2 e cambiano da terminale a terminale.
- Le icone passano da `src/icone.js` (`import { I } from './icone.js'`), dove ogni voce ha la
  versione Nerd Font e quella normale, **tutte larghe una colonna**.
- `src/markdown.js` ha già un `normalizza()` che sostituisce i simboli vietati nel testo che
  arriva dalle IA: se ne aggiungi uno alla lista dei vietati, aggiungilo anche là.

## 5. Niente stampe a schermo

Dentro il codice dell'interfaccia **non si scrive mai sul terminale**:

- vietati `console.log`, `console.error`, `console.warn`, `console.info`
- vietati `process.stdout.write` e `process.stderr.write`
- vietata qualunque altra scrittura diretta su stdout o stderr

Una sola riga stampata fuori da Ink fa scorrere lo schermo e rompe tutto il disegno.

Avvisi, errori e informazioni di servizio vanno nel registro:
`~/.cache/kortex/kortex.log`

Chi se ne occupa già nel progetto:

- `nelLog(...)` dentro `avviaUI()` in **`src/ui.js`** (circa riga 1144) è la funzione che scrive nel
  registro. La stessa `avviaUI()` sostituisce `console.log`, `console.error`, `console.warn` e
  `console.info` con `nelLog`, e filtra `process.stderr.write`: quindi se per sbaglio qualcosa
  stampa, finisce nel registro invece che sullo schermo. **Non toccare questo meccanismo.**
- `bin/kortex.js` scrive nello stesso file l'errore completo quando KORTEX muore.

Unica eccezione: il codice che gira **prima** dell'interfaccia e **senza** interfaccia, cioè le
risposte alle opzioni da riga di comando in `src/main.js` (`--versione`, `--aiuto`, `--check`,
`--prova`, `--aggiorna`). Là `console.log` è giusto, perché non c'è nessuno schermo da rovinare.

## 6. Lo schermo

Lo schermo è disegnato dal componente `SchermoStabile` in **`src/schermo.js`**.

Come funziona, in breve:

- Ink, a ogni aggiornamento, cancellerebbe tutte le righe e le riscriverebbe da capo: il terminale
  fa in tempo a mostrare lo schermo mezzo vuoto e l'occhio vede uno scatto.
- `SchermoStabile` è un finto `stdout` (ha `columns`, `rows`, `write`, `end`) che si mette **tra Ink
  e il terminale vero**. Ink gli passa il fotogramma finito.
- `write()` taglia via il prefisso di cancellazioni e ritorni a capo che Ink mette davanti al
  fotogramma, divide il fotogramma in righe, le confronta con quelle di prima e riscrive **solo le
  righe cambiate**, ognuna al suo posto con `\x1b[riga;1H`, tutte in **un'unica scrittura**.
- Intorno a quella scrittura mette l'aggiornamento sincronizzato (`\x1b[?2026h` … `\x1b[?2026l`):
  dove il terminale lo supporta, il fotogramma si vede solo quando è completo.
- Se arriva una pulizia dello schermo, `invalida()` svuota la memoria delle righe precedenti e il
  prossimo fotogramma viene riscritto per intero. Lo stesso avviene al ridimensionamento.
- Quello che non finisce con `\n` non è un fotogramma di Ink e passa così com'è.

**Questo file non va cambiato senza un motivo preciso**: da lui dipende tutta la stabilità del
disegno. Se lo cambi, il minimo è un giro completo dell'interfaccia (cambio pagina, cambio scheda,
ridimensionamento della finestra, apertura di una finestra sopra) per vedere che non sfarfalli e
non resti sporco niente.

## 7. Riquadri in posizione assoluta

Un riquadro disegnato in posizione assoluta (`<${Box} position="absolute" ...>`) **non cancella ciò
che sta sotto**: si sovrappone solo dove c'è un carattere. Dove la riga del riquadro è più corta
della sua larghezza, si vede il contenuto vecchio che c'era prima.

**Regola pratica**: ogni riga di testo dentro un riquadro in posizione assoluta va riempita di spazi
fino alla larghezza prevista del riquadro. La larghezza si misura con `string-width`, non con
`.length` (i colori ANSI e i caratteri larghi falserebbero il conto).

Nel progetto il riempimento esiste già:

- `pieno(testo, n)` in `src/pagine.js` (riga 639), usato dalla finestra di tutorial e novità
- `riempiA(testo, n)` in `src/ui.js` (riga 49), usato dalle notifiche a comparsa

```js
import stringWidth from 'string-width';

// riempie di spazi fino a n colonne
const pieno = (t, n) => { const s = String(t); const l = stringWidth(s); return l >= n ? s : s + ' '.repeat(n - l); };

// un riquadro assoluto largo w: ogni riga arriva fino al bordo (w - 2 = dentro i bordi)
return html`<${Box} position="absolute" marginTop=${3} marginLeft=${4} width=${w} height=${righe.length + 2}
  flexDirection="column" borderStyle="round" borderColor=${C.rosa}>
  ${righe.map((r, i) => html`<${Text} key=${i} color=${C.gesso}>${pieno(' ' + r, w - 2)}<//>`)}
<//>`;
```

Senza `pieno()` la riga `' ciao'` lascerebbe scoperte tutte le colonne dopo la "o", e là si
vedrebbe la pagina sotto.

Vale anche la regola gemella: il testo dentro un riquadro **non deve mai andare a capo da solo**
(sfonderebbe il bordo). Si taglia prima, con `tagliaA()` in `src/ui.js` oppure con
`wrap="truncate-end"` sul `Text`.

## 8. Documentare ogni funzione nuova

Ogni nuova funzionalità va descritta in **tutti** questi posti, nella stessa modifica:

1. **`src/guida.js`** — la guida interna mostrata nella pagina GUIDA. Il formato è semplice: le
   righe che iniziano con `# ` sono titoli, quelle con `- ` punti elenco. Si aggiunge la voce nella
   sezione giusta (o una sezione nuova), e se la funzione ha un comando o un tasto va anche nelle
   sezioni `# I TASTI` e `# I COMANDI`.
2. **`CHANGELOG.md`** — nella sezione della **prossima versione**, in cima al file, nello stile
   delle voci già presenti (una riga per novità, il nome della cosa in grassetto).
3. **`README.md`** — nella sezione pertinente, e nella tabella dei comandi se c'è un comando nuovo.
4. **`package.json`** — se la versione cambia, va aggiornato il campo `version`.
   La versione mostrata dall'interfaccia e dalla barra viene letta da lì, e la finestra delle novità
   cerca in `CHANGELOG.md` la sezione `## <versione>`: i due numeri devono combaciare.

Se una funzione nuova aggiunge una voce di configurazione, va messa anche in
`config.default.json`.

## 9. Controlli prima di dire finito

Obbligatori, e devono finire **tutti senza errori**:

1. `node --check <file>` su **ogni** file toccato, per esempio:

   ```
   node --check src/pagine.js
   ```

2. ```
   node bin/kortex.js --versione
   ```

Finché questi due controlli non passano, il lavoro non è finito e non si dice che è finito.
Se un controllo dà errore, va riportato con il suo messaggio, non nascosto.

Utile in più, quando ha senso: `node bin/kortex.js --check` e `node bin/kortex.js --aiuto`
(partono senza interfaccia e quindi si possono lanciare in sicurezza).

## 10. Limiti di lavoro

- Si lavora **solo dentro `/home/gasty/kortex`**.
- **Mai toccare `~/.kortex-app`**: è l'installazione in uso.
- **Mai eseguire `git push`**: le modifiche le pubblica Davide dopo averle provate.
- `git add` e `git commit` si fanno **solo se richiesto esplicitamente**.
- Non si cancellano file che non si sono creati, se non è il compito a chiederlo.
- Se qualcosa va eseguito o provato e non se ne ha il permesso, va scritto nel riepilogo finale:
  ci pensa l'operatore.
