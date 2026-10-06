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

Entra nella cartella del progetto:

```
kortex
```

| Comando | Cosa fa |
|---|---|
| `/chat X` | chat diretta con una sola IA |
| `/team` | torna alla squadra |
| `/nuova` | in chat diretta, ricomincia la conversazione |
| `/ia` | quali IA sono installate e attive |
| `/ruoli` | chi fa cosa, in ordine di riserva |
| `/stato` | diario del progetto |
| `/config` | dove sta la configurazione |
| `/pulisci` | svuota il pannello OUTPUT |
| `/esci` o Ctrl+C | esce |

Da riga di comando: `kortex --check`, `kortex --no-anim`, `kortex --aggiorna`, `kortex --versione`.

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
