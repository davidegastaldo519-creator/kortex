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

## Lo studio: quattro pagine

Si passa da una pagina all'altra con **TAB** (e SHIFT+TAB per tornare indietro). ESC riporta sempre a LAVORO.

- **LAVORO** — scrivi le richieste e guardi la squadra lavorare. A sinistra chi sta facendo cosa, al centro l'output (scorrevole con le frecce e PAG SU/GIÙ), a destra i compiti spuntati man mano e i file cambiati.
- **CONTROLLO** — la plancia della macchina. Ogni parametro ha il suo cursore (↑↓ per scegliere, ←→ per regolare) e una spiegazione. Cinque **mappature** pronte in scala crescente (tasti 1-5): LAMPO, AGILE, STANDARD, ACCURATO, PROFONDO. Grafici in tempo reale di CPU, RAM e *pensieri al secondo*, i cavi animati verso ogni IA e la tabella con chiamate, riuscite, fallite e tempi. Le modifiche si salvano da sole.
- **STUDIO** — la lavagna: ci trovi scritto il ragionamento dell'ultima richiesta (piano del direttore, passi del pianificatore, verdetti del revisore) e i tuoi appunti, che scrivi con `/nota testo` e restano nel progetto.
- **GUIDA** — il manuale completo, scorrevole: tasti, comandi, mappature, parametri, problemi comuni.

L'intestazione resta sempre in alto: il teschio in miniatura con gli occhi che pulsano, il nome in gradiente animato, la mappatura attiva, l'autonomia e lo stato della squadra.

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
| `/mappa N` | applica la mappatura da 1 (LAMPO) a 5 (PROFONDO) |
| `/nota testo` | scrive un appunto sulla lavagna dello STUDIO |
| `/pagina N` | va alla pagina da 1 a 4 |
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
