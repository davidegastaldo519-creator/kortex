# MIGLIORAMENTI PER KORTEX

Analisi del 15 ottobre 2026, fatta leggendo il codice vero del progetto.

Questo documento è **solo un'analisi**: nessun file di codice è stato toccato. Ogni proposta dice cosa
cambia, perché serve, quali file andrebbero aperti, quanto è difficile e quanto rischia di sporcare il
disegno dell'interfaccia. Non sono comprese la schermata iniziale, `src/schermo.js` e i bordi dei riquadri.
Dentro ogni gruppo le proposte sono in ordine: prima le facili e tranquille, poi le più impegnative.

---

## GRUPPO A — errori e punti fragili da correggere

### 1. Togliere le emoji dall'interfaccia

**Cosa cambia:** le quattro emoji usate nei testi (libro, graffetta, fumetto, lente) spariscono e al loro posto vanno le icone di `src/icone.js`, larghe una colonna.

**Perché serve:** sono gli unici simboli larghi 2 colonne rimasti nel programma, e sono proprio quelli che
la regola dei simboli vieta. Il caso peggiore è la riga di scrittura: davanti al testo che scrivi c'è
l'emoji della lente quando è aperto il selettore (`src/ui.js` riga 1117), e il cursore finisce spostato di una colonna
rispetto a dove si vede. Le altre compaiono nelle notifiche a comparsa e nella riga degli allegati, dove
il riempimento di spazi è calcolato con `string-width`: il conto torna per la libreria ma non per il
terminale. In più `src/markdown.js` colora di ciano le righe che iniziano con l'emoji del libro, quindi il colore va
cambiato insieme al simbolo, altrimenti quelle righe diventano grigie.

**File da toccare:** `src/ui.js` (righe 314, 405, 436, 548, 553, 558, 705, 748, 750, 798, 1117), `src/pagine.js` (riga 42), `src/grafica.js` (righe 266 e 310), `src/markdown.js` (riga 185), `src/icone.js` (una voce nuova per "database" e "allegato", se servono).

**Difficoltà:** facile

**Rischio grafico:** basso

### 2. Il REGISTRO non distingue più gli strumenti usati dalle IA

**Cosa cambia:** la funzione che riconosce il tipo di evento viene corretta, così le righe degli strumenti tornano a distinguersi dagli avvii delle CLI.

**Perché serve:** in `src/ui.js` riga 51 la stessa prova viene fatta due volte di seguito: la prima
decide "avvio" e la seconda, identica, non verrà mai raggiunta, quindi il tipo "strumento" non viene
assegnato a nessun evento. Il risultato è che nella scheda REGISTRO ogni file letto o scritto da un'IA
ha lo stesso simbolo e lo stesso colore dell'avvio di una CLI, e il filtro per capire cosa sta davvero
facendo la squadra perde metà del suo valore. La differenza vera, nel testo che arriva, è il rientro:
le righe di avvio iniziano a colonna zero, quelle degli strumenti sono rientrate di due spazi.

**File da toccare:** `src/ui.js` (riga 51), `src/pagine.js` (righe 108-111, dove i tipi diventano simbolo e colore).

**Difficoltà:** facile

**Rischio grafico:** basso

### 3. Il revisore non vede i file già messi in stage

**Cosa cambia:** il confronto delle modifiche passa da `git diff` a `git diff HEAD`, così comprende anche i file che sono già stati aggiunti con `git add`.

**Perché serve:** `diffProgetto` in `src/state.js` (riga 113, il comando alla riga 120) e `diffColorato` (riga 126, il comando alla riga 131) chiedono a git
solo le modifiche non ancora aggiunte. Se l'esecutore, durante il lavoro, fa un `git add` (lo fanno
spesso le CLI quando preparano un commit), il revisore riceve "RIEPILOGO MODIFICHE: (nessuna)" e giudica
un lavoro che non vede, e la scheda DIFF mostra lo schermo vuoto anche se i file sono stati riscritti.
Con `HEAD` si vede tutto quello che è cambiato dall'ultimo salvataggio, in stage o no. Serve il ripiego
per il caso di un progetto git appena creato, senza nessun commit: là `HEAD` non esiste ancora e si
torna al comando di adesso.

**File da toccare:** `src/state.js` (righe 113-155).

**Difficoltà:** facile

**Rischio grafico:** basso

### 4. Il piano del direttore si perde se nella risposta ci sono altre parentesi graffe

**Cosa cambia:** il JSON si cerca contando le parentesi aperte e chiuse, provando più candidati, invece di prendere tutto quello che sta tra la prima graffa e l'ultima.

**Perché serve:** `estraiJson` in `src/director.js` (riga 190) prende il testo dalla prima `{` fino
all'ultima `}` e prova a leggerlo. Basta che l'IA scriva una frase di accompagnamento con un esempio
tra graffe, o un blocco di codice dopo il JSON, e il pezzo catturato non è più JSON valido: la lettura
fallisce, i compiti non ci sono e KORTEX ripiega su "lavoro sulla richiesta intera" (riga 278), cioè
perde tutta la divisione del lavoro e il parallelo. Lo stesso vale per la domanda di `/chiedi`, per la
scheda del catalogatore e per il lavoro del memorista, che usano la stessa funzione. Un lettore che
scorre il testo tenendo il conto delle graffe e prova ogni blocco bilanciato, dall'ultimo al primo,
costa poche righe e rende il flusso molto più stabile.

**File da toccare:** `src/director.js` (righe 188-215).

**Difficoltà:** media

**Rischio grafico:** basso

### 5. Le operazioni di rete del database bloccano tutto lo schermo

**Cosa cambia:** collegamento a GitHub, scaricamento di una pagina web e clonazione del database diventano lavori in sottofondo, con un avviso quando finiscono.

**Perché serve:** tre comandi usano ancora la versione sincrona dei comandi esterni, e mentre lavorano
KORTEX è completamente fermo: non si muove niente, i tasti non rispondono, le IA che stanno scrivendo
non vengono lette. `/db github` chiama `collegaGithub` (`src/database.js` riga 223), che può restare
fino a due minuti dentro `gh repo create` (riga 233); `/db aggiungi` con un indirizzo web chiama
`aggiungiUrl` (riga 120) con un `curl` da trenta secondi; `/db scarica` clona tutto il database
(`scaricaDaGithub`, riga 249). La
sincronizzazione normale è già stata portata in sottofondo (`sincronizzaAsync`, riga 347): questi tre
pezzi vanno portati allo stesso modo, scrivendo nell'OUTPUT prima "sto lavorando" e poi l'esito.

**File da toccare:** `src/database.js` (righe 120-131, 223-253), `src/ui.js` (righe 538-556, i comandi `/db`).

**Difficoltà:** media

**Rischio grafico:** basso

---

## GRUPPO B — funzioni nuove utili per lavorare ogni giorno

### 6. Comando `/log`: leggere il registro di servizio senza uscire da KORTEX

**Cosa cambia:** un comando nuovo mostra nell'OUTPUT le ultime righe del file `~/.cache/kortex/kortex.log`.

**Perché serve:** tutto quello che non deve comparire a schermo finisce in quel file: gli errori interni,
le scritture sbagliate di qualche libreria, il messaggio completo quando KORTEX muore (`bin/kortex.js`
riga 11 e `nelLog` in `src/ui.js` riga 1144). Oggi però, per leggerlo, bisogna uscire dal programma e
aprire un terminale normale: proprio nel momento in cui una cosa non funziona, l'informazione utile è
la più scomoda da raggiungere. Il comando può mostrare le ultime 40 righe con `/log` e azzerare il file
con `/log pulisci`, che è utile quando diventa grande.

**File da toccare:** `src/ui.js` (nella parte dei comandi `/`, intorno alla riga 610), `src/guida.js`, `CHANGELOG.md`, `README.md`.

**Difficoltà:** facile

**Rischio grafico:** basso

### 7. Comando `/esporta`: la chat in un file Markdown leggibile

**Cosa cambia:** la chat aperta viene salvata come file Markdown dentro il progetto, con richieste, risposte e punti di ripristino.

**Perché serve:** le chat esistono già e sono complete (`src/progetti.js`, righe 81-101: ogni messaggio
con autore, testo, ora e l'identificativo dell'istantanea), ma vivono in `.kortex/chat/*.json`, cioè in
un formato che si legge solo da dentro KORTEX. Chi lavora ogni giorno ha bisogno di portarsi fuori il
riepilogo di una sessione: per allegarlo a un messaggio, per rileggerlo sul telefono, per metterlo nel
database come nota. Il lavoro è piccolo perché i dati e la cartella degli allegati ci sono già, e si
può riusare `riassuntoChat` per la versione breve.

**File da toccare:** `src/progetti.js` (accanto a `riassuntoChat`, riga 104), `src/ui.js` (comandi `/`), `src/guida.js`, `CHANGELOG.md`, `README.md`.

**Difficoltà:** facile

**Rischio grafico:** basso

### 8. Comando `/annulla`: tornare a com'era prima dell'ultima richiesta

**Cosa cambia:** un comando solo riporta tutti i file al punto di ripristino scattato prima dell'ultima richiesta.

**Perché serve:** il punto di ripristino viene già scattato da solo prima di ogni richiesta e il suo
identificativo è già in mano all'interfaccia (`src/ui.js` riga 741, poi tenuto in `revisione.prima`).
Però per tornare indietro oggi bisogna scrivere `/ripristina` per vedere l'elenco, leggere il codice
giusto in mezzo agli altri e riscriverlo: tre passaggi in un momento in cui di solito si ha fretta,
perché la squadra ha appena fatto un pasticcio. Con `/annulla` il codice lo mette KORTEX, e la risposta
può ricordare che anche l'annullamento è reversibile, perché `ripristina` scatta prima un'istantanea di
sicurezza (`src/progetti.js` riga 155).

**File da toccare:** `src/ui.js` (comandi `/`, accanto al caso `ripristina` riga 611), `src/guida.js`, `CHANGELOG.md`, `README.md`.

**Difficoltà:** facile

**Rischio grafico:** basso

### 9. Le frecce ↑↓ richiamano le richieste precedenti anche nella riga delle IA

**Cosa cambia:** nella riga `›` le frecce su e giù ripescano le richieste già scritte, come fa già la riga `$` del terminale.

**Perché serve:** il terminale tiene la sua cronologia e la fa scorrere con le frecce (`src/ui.js`
righe 1042-1049, elenco riempito in `src/terminale.js` riga 68), ma la riga dove si parla alle IA no: una
richiesta lunga da ripetere con una parola cambiata va riscritta da capo. Succede continuamente,
perché è il modo normale di correggere il tiro dopo un lavoro andato a metà. Le richieste sono già
salvate nella chat del progetto, quindi la cronologia si può riempire anche con quelle delle sessioni
precedenti. Va fatta attenzione a un punto: nella pagina LAVORO le frecce oggi scorrono l'OUTPUT, e
nella scheda DIFF scelgono il file; la cronologia deve valere solo quando il cursore è sulla riga `›`
e c'è già qualcosa scritto o la cronologia viene chiesta da riga vuota.

**File da toccare:** `src/ui.js` (righe 1028-1053 per i tasti, e lo stato della riga di scrittura), `src/guida.js`, `CHANGELOG.md`, `README.md`.

**Difficoltà:** media

**Rischio grafico:** basso

### 10. Cercare una parola dentro l'OUTPUT

**Cosa cambia:** una ricerca sul testo già scritto nell'OUTPUT, che evidenzia i risultati e salta da uno all'altro.

**Perché serve:** dopo mezz'ora di lavoro l'OUTPUT contiene centinaia di righe: il nome di un file
citato dal revisore, il comando che l'operatore ha lanciato, l'errore visto venti minuti prima si
ritrovano solo scorrendo a mano. I messaggi sono tutti in memoria e già impaginati riga per riga
(`src/markdown.js`, funzione `impagina` riga 195), quindi i dati per cercare ci sono tutti: servono una
riga di ricerca, l'evidenziazione dei pezzi trovati e due tasti per andare al risultato seguente o
precedente. È la proposta più delicata del gruppo: aggiunge uno stato nuovo all'impaginazione, tocca
la cache delle righe e cambia i colori dei pezzi, quindi va provata con un giro completo
dell'interfaccia (cambio pagina, cambio scheda, finestra ridimensionata).

**File da toccare:** `src/markdown.js` (righe 189-218, la cache e i pezzi), `src/pagine.js` (la scheda OUTPUT), `src/ui.js` (tasti e stato della ricerca), `src/guida.js`, `CHANGELOG.md`, `README.md`.

**Difficoltà:** difficile

**Rischio grafico:** alto

---

## GRUPPO C — velocità e pulizia del codice

### 11. La pagina STUDIO rilegge cinque file dal disco a ogni fotogramma

**Cosa cambia:** i dati della pagina STUDIO vengono tenuti in una memoria di appoggio e riletti solo quando cambiano davvero.

**Perché serve:** in `src/ui.js` riga 1073, ogni volta che la pagina viene disegnata, vengono lette da
capo cinque cose dal disco: le preferenze, il riassunto del progetto, le soluzioni (che aprono e
leggono l'intero indice del database), il diario e gli appunti. La pagina si ridisegna ogni 250
millisecondi, e ogni 120 mentre la squadra lavora: sono circa quaranta letture di file al secondo
mentre le IA stanno già usando il disco. Le pagine PROGETTI e DATABASE hanno già la soluzione giusta
(`datiProgetti` riga 355 e `datiDb` riga 366, con una chiave che dice quando ricalcolare): basta fare
lo stesso, aggiornando la chiave quando arriva un evento della memoria.

**File da toccare:** `src/ui.js` (righe 350-372 per lo schema già usato, riga 1073 per la pagina STUDIO).

**Difficoltà:** facile

**Rischio grafico:** basso

### 12. L'indice del database viene riletto e ri-analizzato a ogni domanda

**Cosa cambia:** `indice()` tiene in memoria l'elenco già letto e lo rilegge solo se il file è cambiato sul disco.

**Perché serve:** `indice()` in `src/database.js` (riga 28) apre `indice.json` e lo analizza da zero a
ogni chiamata, e viene chiamata da quasi tutto: i conteggi delle categorie, la ricerca, le menzioni
`@`, le soluzioni, l'elenco degli orfani, la tavolozza (che ne prende 300 voci alla volta) e il
guardiano, che la interroga per ogni file che compare nella cartella. Con un database di qualche
centinaio di voci il file arriva a qualche megabyte di testo, e viene riletto decine di volte per ogni
richiesta. Confrontare la data di modifica del file prima di rileggerlo è una decina di righe e non
cambia niente per chi chiama; l'unico punto a cui stare attenti è svuotare la memoria di appoggio
dentro `salvaIndice` (riga 32) e dopo una sincronizzazione con GitHub.

**File da toccare:** `src/database.js` (righe 28-41, e il punto di salvataggio alla riga 32).

**Difficoltà:** facile

**Rischio grafico:** basso

### 13. Il terminale ricalcola l'andata a capo di tutte le righe a ogni fotogramma

**Cosa cambia:** le righe già mandate a capo vengono conservate, e la larghezza si misura con `string-width` invece che contando i caratteri.

**Perché serve:** in `src/pagine.js` riga 115 il pannello TERMINALE scorre tutte le righe della
sessione (fino a 3000, vedi `src/ui.js` riga 490) e per ognuna rifà il taglio alla larghezza del
pannello, a ogni singolo ridisegno, anche quando non è arrivato niente di nuovo e anche quando si
stanno guardando solo le ultime venti righe. Conviene tenere il risultato accanto alla sessione e
rifarlo solo quando arrivano righe nuove o quando cambia la larghezza. Nello stesso punto c'è un
secondo difetto: `avvolgi` in `src/grafica.js` (riga 27) taglia contando i caratteri con `.length`,
non le colonne con `string-width`, quindi l'uscita di un comando che contiene simboli larghi sballa
il conto delle colonne proprio nel pannello più pieno di testo che arriva da fuori.

**File da toccare:** `src/pagine.js` (righe 113-130), `src/grafica.js` (righe 26-33), `src/terminale.js` (righe 58-68, dove vive lo stato della sessione con la sua cronologia).

**Difficoltà:** media

**Rischio grafico:** basso

### 14. Le istantanee git fermano l'interfaccia a ogni richiesta

**Cosa cambia:** i punti di ripristino e il confronto dei file vengono fatti senza bloccare il disegno, e il conto dei file cambiati si fa una volta sola.

**Perché serve:** `istantanea()` (`src/progetti.js` riga 133) usa la versione sincrona di git, con un
tempo massimo di 60 secondi (`gitIstantanee`, riga 114), e viene chiamata due volte per ogni richiesta, prima e dopo
(`src/ui.js` righe 741 e 774): su un progetto grande il `git add -A` di tutta la cartella tiene fermo
tutto lo schermo. Lo stesso comando viene rifatto da `cambiatiDa` per contare i file toccati (riga 776)
e di nuovo dalla scheda DIFF, che si aggiorna ogni 2,5 secondi mentre la squadra lavora (`datiDiff`,
righe 373-385): tre giri dello stesso lavoro pesante. Passando alla versione asincrona di git e
riusando il conto già fatto, le pause spariscono senza cambiare niente di quello che si vede.

**File da toccare:** `src/progetti.js` (righe 112-195), `src/ui.js` (righe 373-385, 741, 774-776).

**Difficoltà:** media

**Rischio grafico:** basso

### 15. Prove automatiche per le funzioni che non disegnano niente

**Cosa cambia:** una cartella di prove che gira con `node --test`, senza interfaccia e senza nessuna dipendenza nuova.

**Perché serve:** oggi l'unica prova è `test/prova.mjs`, che per funzionare ha bisogno delle IA vere,
quindi di abbonamento e di tempo: in pratica non si lancia quasi mai. Intanto il programma è pieno di
funzioni pure, facilissime da provare e facilissime da rompere senza accorgersene: la lettura del JSON
del direttore e dell'esito del revisore (`src/director.js` righe 190-215), il markdown e la
normalizzazione dei simboli (`src/markdown.js`), la ricerca nel database e le menzioni `@`
(`src/database.js` righe 176-206), il conto del carburante (`src/uso.js` riga 69), la fusione della
configurazione (`unisci` in `src/config.js` riga 11) e il taglio del testo alla larghezza giusta. Venti prove
brevi su queste funzioni fanno da rete di sicurezza per quasi tutte le altre proposte di questo
documento, e `node --test` è già dentro Node: niente da installare.

**File da toccare:** nuova cartella `test/` con i file di prova, `package.json` (una voce in più in `scripts`), `README.md`.

**Difficoltà:** media

**Rischio grafico:** basso
