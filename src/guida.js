// Il manuale di KORTEX, mostrato nella pagina GUIDA.
// Righe che iniziano con "# " sono titoli, con "- " punti elenco.
export const GUIDA = `
# COS'È KORTEX
KORTEX fa lavorare insieme più intelligenze artificiali sullo stesso progetto: Claude Code, Codex, Gemini e Ollama. Usa le CLI già installate e collegate ai tuoi abbonamenti, quindi niente chiavi API e niente costi a consumo.
Tu scrivi cosa vuoi ottenere. Lui divide il lavoro, lo assegna all'IA più adatta, lo fa controllare da un'altra, e tiene un diario per ricordarsi tutto la volta dopo.

# LE CINQUE PAGINE
Si cambia pagina con TAB (avanti) e SHIFT+TAB (indietro). ESC torna sempre a LAVORO.
- LAVORO: dove scrivi le richieste e guardi le IA lavorare. A sinistra la squadra con i cervelli delle IA, a destra la lista dei compiti con il loro stato.
- TERMINALE: in alto il registro completo di tutto quello che fanno le IA, filtrabile; in basso una shell vera per lanciare comandi senza uscire da KORTEX.
- CONTROLLO: la plancia della macchina. Regoli ogni parametro, scegli una mappatura, guardi i grafici in tempo reale.
- STUDIO: la lavagna. Ci trovi il ragionamento dell'ultima richiesta — piano, passi, verdetto — e i tuoi appunti.
- GUIDA: questa pagina.

# ALLEGARE FILE E FOTO
Le IA possono leggere qualunque file o immagine che alleghi. Tre modi:
- TRASCINA il file nella finestra del terminale: compare nella barra allegati sopra la riga di scrittura.
- /allega apre un selettore: scrivi una parte del nome, ↑↓ per scegliere, INVIO per allegare. Cerca nel progetto, in Download, Immagini, Scrivania e Documenti. Puoi anche scrivere /allega seguito dal percorso.
- CTRL+O fa uno screenshot con Flameshot: selezioni la zona e si allega da solo.
Gli allegati vengono copiati nella cartella .kortex/allegati del progetto e partono con la richiesta successiva. /allegati li elenca, /togli 2 toglie il secondo, /togli tutti li toglie tutti.

# IL TERMINALE
- REGISTRO: ogni evento ha l'ora, l'IA col suo colore, il ruolo, un simbolo e il testo. ▶ avvio, ▸ strumento usato, ✔ finito, ✖ errore, ⟳ passaggio alla riserva.
- CTRL+F cambia il filtro: tutti, una sola IA, solo gli errori.
- SHELL: scrivi un comando e premi INVIO, come in un terminale normale. ↑↓ richiamano i comandi precedenti, cd cambia cartella, clear pulisce.
- CTRL+C ferma il comando in corso. CTRL+L sposta lo scorrimento tra registro e shell.
- Programmi interattivi come nano, top o ssh qui non funzionano: aprili in un terminale normale.

# I CERVELLI DELLE IA
Ogni IA ha un cervello col suo colore: Claude arancio, Codex verde, Gemini blu, Ollama grigio. Quando pensa si accende e ci corre sopra un'onda di luce; da ferma respira piano; rosso lampeggiante vuol dire che ha finito il limite dell'abbonamento; spento vuol dire non collegata.

# I TASTI
- TAB / SHIFT+TAB: pagina successiva / precedente
- FRECCIA SU / GIÙ: scorre il testo (nella plancia: sceglie il parametro)
- PAG SU / PAG GIÙ: scorre di una pagina intera
- FRECCIA SINISTRA / DESTRA: nella plancia, cambia il valore del parametro
- 1 2 3 4 5: nella plancia, applica una mappatura
- ESC: torna a LAVORO (nel selettore file: lo chiude)
- CTRL+O: screenshot da allegare
- CTRL+F e CTRL+L: nella pagina TERMINALE, filtro del registro e fuoco
- CTRL+C: ferma il comando della shell; se non ce n'è nessuno, esce

# I COMANDI
Si scrivono nella barra in basso, iniziano con la barra /.
- /chat claude (o codex, gemini, ollama): parli con una sola IA, che ricorda la conversazione
- /team: torni alla squadra
- /nuova: in chat diretta, ricomincia da zero
- /mappa 3: applica la mappatura numero 3 senza andare nella plancia
- /nota testo: scrive un appunto sulla lavagna dello STUDIO, salvato nel progetto
- /ia: quali IA sono installate e attive
- /ruoli: chi fa cosa, in ordine di riserva
- /stato: il diario del progetto
- /allega: selettore file da allegare (o /allega percorso)
- /allegati: elenca gli allegati pronti
- /togli N: toglie un allegato (/togli tutti per tutti)
- /screenshot: come CTRL+O
- /pulisci: svuota l'output
- /esci: esce

# COME LAVORA LA SQUADRA
- DIRETTORE: legge la richiesta e il diario, divide il lavoro in compiti, sceglie l'esecutore per ognuno.
- PIANIFICATORE: per ogni compito scrive un piano a passi. Legge i file, non li tocca.
- ESECUTORE: fa il lavoro vero sui file del progetto.
- REVISORE: controlla. Se trova un errore concreto, l'esecutore corregge.
Le correzioni riprendono la stessa conversazione e ricevono solo le note del revisore: niente si ripete da capo.
Il revisore ha una regola: se non riesce a vedere qualcosa, non è un errore di chi ha lavorato.

# LE MAPPATURE
Sono regolazioni pronte, dalla più leggera alla più profonda. Cambiano compiti, piano, revisione, correzioni e tempo massimo tutti insieme.
- 1 LAMPO: domande, ritocchi di una riga. Niente piano, niente revisione.
- 2 AGILE: piccole modifiche su un file. Revisione sì, piano no.
- 3 STANDARD: il lavoro di tutti i giorni. Tutto acceso, una correzione.
- 4 ACCURATO: funzioni nuove su più file. Due correzioni.
- 5 PROFONDO: progetti interi. Fino a otto compiti e tre correzioni.
Se cambi un parametro a mano, la mappatura diventa PERSONALIZZATA. L'autonomia non viene mai cambiata da una mappatura: quella la decidi solo tu.

# LA RISERVA AUTOMATICA
Ogni ruolo ha un'IA titolare e delle riserve. Se la titolare finisce il limite dell'abbonamento o va in errore, KORTEX passa da solo alla successiva e lo scrive nel LOG. Nella plancia vedi chi è al limite.

# I GRAFICI DELLA PLANCIA
- CPU e RAM: quanto sta lavorando il computer, ultimi 60 secondi.
- PENSIERI: quanti pezzi di risposta e strumenti usati arrivano dalle IA ogni secondo. È il battito della squadra.
- CONNESSIONI: un cavo per ogni IA. L'impulso che corre lungo il cavo vuol dire che quell'IA sta lavorando adesso.
- TABELLA: chiamate fatte, riuscite, fallite, tempo medio e valore indicativo di ogni IA.

# I COSTI
Il numero in dollari NON è una spesa. Claude Code riporta quanto costerebbe il lavoro a prezzi API anche quando usi l'abbonamento a prezzo fisso. Pagheresti davvero solo se sul computer ci fosse una chiave API impostata.
Il limite vero degli abbonamenti sono i messaggi per finestra di tempo. Una richiesta in mappatura STANDARD ne usa circa quattro o cinque.

# LA MEMORIA DEL PROGETTO
Ogni progetto ha una cartella nascosta .kortex con il diario (STATO.md), le conversazioni da riprendere e i tuoi appunti. Conviene aggiungerla al .gitignore del progetto.

# PROBLEMI COMUNI
- Un'IA ha il pallino vuoto: non è installata o non è collegata. Lancia il suo comando da solo (claude, codex, gemini) e fai il login.
- Gemini dà errore di account: il login Google è riuscito ma la quota gratuita non è attiva su quell'account.
- Una correzione non parte: controlla il parametro Correzioni massime nella plancia.
- L'interfaccia è lenta: metti Animazioni su LEGGERA o SPENTA.
- Per aggiornare KORTEX: esci e scrivi kortex --aggiorna.

# IDEATO E FORGIATO DA GASTY
Architetto di intelligenze, costruttore di mondi.
`.trim().split('\n');
