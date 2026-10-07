# KORTEX — la corteccia delle tue IA

Un solo comando da terminale che fa lavorare insieme **Claude Code, Codex, Gemini CLI e Ollama** su qualunque progetto. Usa le CLI già installate, quindi i tuoi **abbonamenti**: niente chiavi API, niente costi a consumo. Gira uguale su PC Linux e su Termux (telefono e tablet).

## Installazione

Una riga, su qualunque macchina:

```
curl -fsSL https://raw.githubusercontent.com/davidegastaldo519-creator/kortex/main/get.sh | bash
```

Rilanciare la stessa riga aggiorna all'ultima versione. In alternativa: `kortex --aggiorna`.

Servono **git** e **Node.js 20 o superiore**:

- **Termux:** `pkg install git nodejs`
- **Lubuntu / Ubuntu:**

```
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
```

```
sudo apt install -y nodejs git
```

Poi apri un terminale nuovo e controlla quali IA ha trovato:

```
kortex --check
```

## La schermata iniziale

All'avvio parte un'animazione di circa 10 secondi: una rete di collegamenti che porta dati al centro, un cervello a circuiti che si accende — diverso a ogni avvio — un teschio che si forma sopra il cervello, si crepa con una scossa e accende gli occhi, scintille dalla crepa, poi il nome KORTEX e la dedica al creatore in caratteri grandi. Si salta con un tasto qualsiasi, o del tutto con `kortex --no-anim`.

Si adatta allo schermo: a tutto schermo il teschio è in scala doppia (tripla sui monitor alti) con il testo a fianco; in una finestra normale è in scala singola con il testo sotto; sul telefono parte una versione corta. L'icona nel menu e Ctrl+Alt+K aprono il terminale **a schermo intero** (serve `wmctrl`: `sudo apt install -y wmctrl`).

## Lo studio: cinque pagine

Si passa da una pagina all'altra con **TAB**. ESC riporta sempre a LAVORO.

- **LAVORO** — a sinistra il **terminale** verticale, a destra le **schede** della squadra (Ctrl+N): AGENTI con l'albero del lavoro, la mappa dei ruoli e la linea del tempo; OUTPUT; REGISTRO filtrabile (Ctrl+F); FILE. Due righe di comando in basso, `$` per il terminale e `›` per le IA, Ctrl+T per passare dall'una all'altra.
- **PROGETTI** — ogni cartella in cui lavori diventa un progetto con le sue **chat** (come in Claude): le riapri con tutta la storia e la squadra continua da lì. Prima e dopo ogni richiesta KORTEX scatta un **punto di ripristino** in un archivio nascosto separato dal tuo git: `/ripristina ID` riporta tutti i file a quel momento, e anche il ripristino si può annullare. Un nome e INVIO crea un progetto nuovo in `~/kortex-progetti`; `/progetto importa` registra una cartella esistente.
- **CONTROLLO** — la plancia: parametri con cursore e spiegazione, 5 mappature in scala crescente, grafici in tempo reale di CPU, RAM e pensieri al secondo, i cervelli e i cavi di ogni IA.
- **STUDIO** — la lavagna col ragionamento dell'ultima richiesta e i tuoi appunti (`/nota`).
- **GUIDA** — il manuale completo.

## Il terminale multi-macchina

Lavora su **questo PC**, sulle **macchine SSH** (quelle già in `~/.ssh/config` compaiono da sole; `/dest aggiungi vps root@indirizzo` ne salva altre) e su **console Python e Node.js** che restano vive tra un comando e l'altro. Ctrl+D cambia macchina, ↑↓ richiamano i comandi precedenti, `cd` si ricorda, Ctrl+C ferma il comando. Per SSH serve una chiave già caricata sulla macchina (`ssh-copy-id`): le password non si possono scrivere qui.

## Due modi di lavorare

### Squadra (predefinito)

Scrivi cosa vuoi fare. Dietro le quinte:

1. **Direttore** — divide la richiesta in compiti e per ognuno sceglie l'esecutore più adatto
2. **Pianificatore** — scrive un piano a passi (legge i file, non li modifica)
3. **Esecutore** — fa il lavoro sui file del progetto
4. **Revisore** — controlla; se trova problemi concreti, l'esecutore corregge

### Chat diretta

`/chat claude` (o `codex`, `gemini`, `ollama`) e parli con una sola IA, come se la usassi da sola. Ricorda la conversazione anche se chiudi e riapri KORTEX. `/nuova` ricomincia da zero, `/team` torna alla squadra.

## Le regole del motore

- **Le correzioni riprendono la stessa sessione** e ricevono solo le note del revisore, mai il prompt intero da capo
- **Il revisore non può bocciare per ciò che non riesce a vedere**: segnala solo errori concreti
- **A controllare è un'IA diversa** da quella che ha fatto il lavoro, quando possibile
- **Al massimo una correzione** per compito: niente giri infiniti
- **Riserva automatica**: se un'IA finisce il limite dell'abbonamento, passa da sola alla successiva
- **Memoria di progetto**: la cartella `.kortex/` contiene `STATO.md`, il diario del lavoro fatto, che il direttore legge a ogni richiesta. Aggiungila al `.gitignore`

## Uso

Sul PC l'installazione aggiunge anche l'icona **KORTEX** nel menu (categoria Sviluppo) e, su Lubuntu, la scorciatoia **Ctrl+Alt+K**: aprono KORTEX nella cartella `~/progetti`, pensata per i lavori nuovi.

Per lavorare su un progetto esistente, entra nella sua cartella:

```
kortex
```

| Comando | Cosa fa |
|---|---|
| `/chat X` | chat diretta con una sola IA |
| `/allega [file]` | selettore file da allegare, o allega il file indicato |
| `/allegati` · `/togli N` | elenca o toglie gli allegati |
| `/screenshot` | come Ctrl+O |
| `/mappa N` | applica la mappatura da 1 (LAMPO) a 5 (PROFONDO) |
| `/nota testo` | scrive un appunto sulla lavagna dello STUDIO |
| `/pagina N` | va alla pagina da 1 a 4 |
| `/scheda N` | scheda a destra da 1 a 4 |
| `/dest` | macchine del terminale: elenca, sceglie, aggiunge |
| `/progetto` | elenca, `nuovo`, `apri N`, `importa percorso`, `qui` |
| `/chat nuova` · `/chat apri N` | chat del progetto aperto |
| `/ripristina [ID]` | punti di ripristino |
| `/team` | torna alla squadra |
| `/nuova` | in chat diretta, ricomincia la conversazione |
| `/ia` | quali IA sono installate e attive |
| `/ruoli` | chi fa cosa, in ordine di riserva |
| `/stato` | diario del progetto |
| `/config` | dove sta la configurazione |
| `/pulisci` | svuota il pannello OUTPUT |
| `/esci` o Ctrl+C | esce |

Da riga di comando: `kortex --check`, `kortex --no-anim`, `kortex --aggiorna`, `kortex --versione`.

**Il numero in dollari in alto non è una spesa.** Claude Code riporta quanto costerebbe il lavoro a prezzi API, anche quando usi l'abbonamento a prezzo fisso. Pagheresti davvero solo se sul computer fosse impostata una chiave API (`ANTHROPIC_API_KEY`).

## Autonomia

In `~/.config/kortex/config.json`, la voce `"autonomia"`:

- **`prudente`** (predefinita) — Claude modifica file ma non lancia comandi; Codex scrive solo nella cartella del progetto
- **`totale`** — le IA fanno tutto senza chiedere, comandi compresi. Solo in cartelle di progetto e con un backup aggiornato

Direttore, pianificatore e revisore sono sempre in sola lettura.

## Personalizzare

Tutto in `~/.config/kortex/config.json`:

- `brand` — nome, frase e colori del gradiente
- `ruoli` — per ogni ruolo le IA in ordine di preferenza: la prima è la titolare, le altre le riserve
- `ia.<nome>.args` — i comandi esatti lanciati per ogni CLI. Se una CLI cambia le sue opzioni con un aggiornamento, si corregge qui senza toccare il codice

## Limiti noti

- Gemini e Ollama non sono esecutori in modalità prudente (non possono scrivere file)
- Codex, Gemini e Ollama non riprendono la sessione: nella chat diretta ricevono gli ultimi 6 scambi
- Il revisore vede tutto il `git diff`: conviene partire con le modifiche precedenti già in un commit
