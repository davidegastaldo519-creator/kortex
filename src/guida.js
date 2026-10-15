// Il manuale di KORTEX, mostrato nella pagina GUIDA.
// Righe che iniziano con "# " sono titoli, con "- " punti elenco.
export const GUIDA = `
# COS'È KORTEX
KORTEX fa lavorare insieme più intelligenze artificiali sullo stesso progetto: Claude Code, Codex, Gemini e Ollama. Usa le CLI già installate e collegate ai tuoi abbonamenti, quindi niente chiavi API e niente costi a consumo.
Tu scrivi cosa vuoi ottenere. Lui divide il lavoro, lo assegna all'IA più adatta, lo fa controllare da un'altra, e tiene un diario per ricordarsi tutto la volta dopo.

# LE OTTO PAGINE
Si cambia pagina con TAB (avanti) e SHIFT+TAB (indietro). ESC torna sempre a LAVORO.
- LAVORO: a sinistra il terminale, a destra le schede della squadra. Due righe di comando in basso: $ per il terminale, › per le IA. CTRL+T sposta il cursore dall'una all'altra.
- PROGETTI: i tuoi progetti, le chat di ognuno e i punti di ripristino.
- DATABASE: la memoria di tutti i progetti: manuali, codice, documenti, immagini, note. Le IA la consultano da sole.
- CONTROLLO: la plancia della macchina. Regoli ogni parametro, scegli una mappatura, guardi i grafici in tempo reale.
- STUDIO: la lavagna. Ci trovi il ragionamento dell'ultima richiesta — piano, passi, verdetto — e i tuoi appunti.
- STATISTICHE: il tuo lavoro in numeri: richieste, compiti riusciti, file toccati, tempo delle IA, tempo risparmiato, carburante di ogni abbonamento e gli ultimi 14 giorni.
- GUIDA: questa pagina.
- STRUMENTI: i programmi di fuori che le IA sanno comandare (Blender e quelli che aggiungi). A sinistra una tessera per strumento, col colore del suo stato; a destra la scheda completa con i pulsanti.

# LE SCHEDE DI LAVORO
A destra, CTRL+N le fa girare (o /scheda 1..5, o un clic sul nome):
- AGENTI: il quadro della squadra, dall'alto in basso. La RICHIESTA con il tempo e quanti compiti lavorano insieme. I COMPITI, uno per riga, con le tre fasi P (piano), L (lavoro dell'esecutore o dell'operatore) e V (verifica del revisore): ● fatto, ✗ errore, » riserva, un numero se è stata corretta più volte, ←1,2 se aspetta altri compiti; poi chi l'ha fatto e quanto ci ha messo. La SQUADRA, un ruolo per riga: quale IA lo copre, cosa sta facendo, su quale compito, l'ultimo strumento usato, e quando è fermo le riserve pronte. L'ATTIVITÀ IN DIRETTA: ogni file letto o scritto e ogni comando lanciato, con ora, IA, ruolo e compito. La CODA delle richieste in attesa e, se c'è posto, la LINEA DEL TEMPO.
- OUTPUT: una BOLLA per ogni IA che parla, col suo colore, il ruolo, il compito e il tempo; dentro, il testo è formattato (titoli, grassetto, elenchi, tabelle, codice colorato). /bolle off torna al testo semplice.
- REGISTRO: ogni evento con ora, IA col suo colore, ruolo e simbolo. ▸ avvio della CLI, ◆ uso di uno strumento, ✓ finito, ✗ errore, » riserva, ‖ compiti in parallelo. CTRL+F cambia il filtro.
- DIFF: la REVISIONE file per file. A sinistra i file cambiati dall'ultima richiesta, a destra le modifiche del file scelto (verde aggiunte, rosso tolte). FRECCIA SU/GIÙ sceglie il file, INVIO lo accetta, CTRL+R lo riporta com'era prima della richiesta. I pulsanti in alto fanno anche "accetta tutto" e "rifiuta tutto". Funziona anche senza git, grazie ai punti di ripristino.
- FILE: i compiti in corso, con le dipendenze, e i file cambiati nel progetto.
Sopra le schede c'è la fila delle IA con i loro cervelli e cosa stanno facendo.

# IL MOUSE
Si può cliccare quasi tutto: le pagine in alto, le schede, le macchine del terminale, i progetti e le chat (un clic sceglie, un secondo clic apre), le categorie e le voci del database, i parametri della plancia (◂ e ▸ regolano, le mappature si applicano), i file nel selettore, le opzioni di una domanda del direttore, la ✕ sugli allegati. La rotella scorre il pannello su cui sta il puntatore.
- Con il mouse acceso, per selezionare del testo nel terminale tieni premuto SHIFT mentre trascini. Oppure /mouse off (e /mouse on per riaccenderlo). Anche dalla plancia.

# LA CODA DELLE RICHIESTE
Mentre la squadra lavora la riga › resta libera: scrivi la richiesta successiva e INVIO, e si mette in coda. Parte da sola appena finisce quella in corso. La vedi nella scheda AGENTI e nell'intestazione ("in coda 2"). /coda la elenca, /coda svuota la cancella.

# LA DOMANDA DEL DIRETTORE
Di solito il direttore decide da solo. Se scrivi /chiedi davanti alla richiesta, può farti UNA domanda a risposta multipla quando la richiesta è davvero ambigua (per esempio: "in che linguaggio?"). Compare nel pannello di destra: rispondi con il numero (1-4) o con un clic; ESC lascia decidere a lui. La risposta entra nella richiesta e il lavoro parte.

# I SUONI
Suoni brevi, creati da KORTEX stesso: il battito, il ronzio e il colpo nella schermata iniziale; una nota quando un compito riesce, una discesa quando fallisce, un accordo quando la richiesta è finita, un bip per le notifiche, un clic cambiando pagina. Servono pw-play, paplay, aplay, play (sox) o ffplay; su Termux l'app Termux:API. /suoni off li spegne, /suoni on li riaccende (anche dalla plancia). I file stanno in ~/.cache/kortex/suoni.

# LA GRAFICA PIENA E LEGGERA
All'avvio KORTEX misura quanto è veloce il PC e sceglie da solo: PIENA (teschio in 3D nell'intestazione, neuroni negli spazi vuoti, transizioni tra le pagine, occhi che seguono l'IA che pensa) oppure LEGGERA (teschio fermo, niente neuroni, niente transizioni: tutta la CPU alle IA). /grafica piena, /grafica leggera, /grafica spenta forzano la scelta e la salvano; /grafica auto torna alla misura automatica. Da riga di comando, kortex --leggera vale per una volta sola. Anche dalla plancia (Grafica).

# IL TERMINALE
È a sinistra nella pagina LAVORO e lavora su più macchine. CTRL+D cambia destinazione (o /dest N):
- QUESTO PC: comandi normali, cd compreso, con la cartella che si ricorda.
- SSH: le macchine che hai già in ~/.ssh/config compaiono da sole. Per aggiungerne una: /dest aggiungi vps root@indirizzo (porta facoltativa). Serve una chiave SSH già caricata su quella macchina: le password qui non si possono scrivere. Per caricarla una volta: ssh-copy-id utente@indirizzo da un terminale normale.
- PYTHON e NODE.JS: console vive. Quello che definisci resta in memoria tra un comando e l'altro.
- ↑↓ richiamano i comandi precedenti di quella destinazione. CTRL+C ferma il comando in corso. clear pulisce.
- Programmi interattivi come nano, top o ssh a mano qui non funzionano: aprili in un terminale normale.

# LA MEMORIA
KORTEX ricorda su tre livelli, e li vedi tutti nella pagina STUDIO, a destra, nella MAPPA DELLA MEMORIA:
- PREFERENZE: come vuoi che si lavori, in tutti i progetti. /ricorda testo per aggiungerne una, /dimentica N per toglierla. Il memorista le aggiunge da solo quando ne esprimi una in una richiesta ("d'ora in poi…"). Vivono nel DATABASE (~/kortex-database/preferenze.md): con GitHub collegato sono le stesse su tutti i PC, senza fare niente.
- RIASSUNTO DEL PROGETTO: cos'è, com'è fatto, cosa resta da fare. Il memorista lo riscrive dopo ogni richiesta e il direttore lo legge prima di dividere il lavoro.
- SOLUZIONI IMPARATE: quando in un lavoro esce un trucco o la soluzione a un errore che serve anche altrove, il memorista la salva nel DATABASE (categoria note, tag #soluzione). Così la ritrovi negli altri progetti.
Il memorista lavora in sottofondo dopo ogni richiesta e non ti blocca. Si spegne dalla plancia (Memoria automatica). /memoria ti dice dove stanno i file.

# I PROGETTI
Ogni cartella in cui lavori diventa un progetto: KORTEX la registra alla prima richiesta e ci salva dentro le chat (cartella .kortex/chat). Nella pagina PROGETTI:
- a sinistra l'elenco dei progetti: ↑↓ scegli, INVIO apre (il terminale e le IA si spostano in quella cartella)
- a destra le chat del progetto scelto: FRECCIA DESTRA per passarci, ↑↓ scegli, INVIO riapre quella chat con tutta la sua storia, e la squadra continua da lì
- scrivi un nome nella riga in basso e INVIO: crea un progetto nuovo in ~/kortex-progetti
- /progetto importa /percorso registra una cartella che hai già; /progetto apri N apre il numero N; /chat nuova inizia una chat pulita nel progetto aperto

# IL DATABASE
È una cartella unica, ~/kortex-database, divisa in categorie: manuali, codice, documenti, immagini, note, archivio. Dentro ci metti tutto quello che vuoi che le IA sappiano: manuali di programmi, codice da riusare, documenti, pagine web, appunti.
Come aggiungere:
- trascina un file nella pagina DATABASE
- /db aggiungi percorso, oppure /db aggiungi https://indirizzo (scarica la pagina)
- /db nota testo dell'appunto
Ogni cosa aggiunta viene catalogata da un'IA (il CATALOGATORE, di solito Gemini): sceglie la categoria, scrive titolo, descrizione e tag. Tu correggi quando serve: /db sposta ID categoria, /db tag ID parole, /db titolo ID nuovo titolo, /db togli ID (finisce in archivio/.cestino).
Come lo usano le IA:
- DA SOLE: a ogni richiesta KORTEX cerca nel database le voci che c'entrano (titolo, tag, descrizione, contenuto) e le passa alle IA con percorso ed estratto. Lo vedi nell'output: "dal database: …".
- SU RICHIESTA: scrivi @blender o @ID nella richiesta per obbligarle a usare una voce precisa; @manuali per tutta una categoria. Nella pagina DATABASE, INVIO su una voce ti prepara la riga con il suo @.
Il GUARDIANO: KORTEX sorveglia la cartella del database. Un file che compare lì dentro (scritto da un'IA, copiato a mano, arrivato da GitHub) viene catalogato da solo pochi secondi dopo; all'avvio una scansione sistema quello che è arrivato a KORTEX chiuso. /db scansiona la lancia a mano.
Copia su GitHub: /db github crea un repository privato kortex-database e lo carica; su una macchina nuova /db scarica tuo-utente lo riporta giù. Da lì in poi KORTEX sincronizza da solo in sottofondo: scarica le novità all'avvio, carica dopo ogni cosa nuova (voci, preferenze, soluzioni) e all'uscita. /db sync lo fa subito. Così hai la stessa memoria su PC, Lenovo e tablet.

# GLI STRUMENTI
Gli strumenti sono i programmi di fuori che le IA possono comandare da sole: Blender per il 3D, e domani quello che aggiungi tu. Ogni strumento è una scheda .json in ~/.config/kortex/strumenti: dice come si chiama, cosa sa fare, come si controlla se è acceso e quale server di strumenti (MCP) va avviato. Se vuoi tenere le schede altrove, scrivi la cartella in "cartellaStrumenti" nella configurazione.
- /strumento elenca quelli che hai, con icona, nome, tasto e stato: ■ acceso, □ spento, ? non si può sapere
- /strumento blender mostra la scheda intera e il percorso del file, così la puoi correggere
- @blender dentro la richiesta dà quello strumento alla squadra: la parola @ sparisce dal testo, il contesto dello strumento entra nel prompt di tutti i ruoli e Claude riceve il server MCP sulla sua riga di comando
- Con uno strumento nella richiesta, esecutore, operatore e revisore vanno a Claude: è l'unica CLI che riceve il server MCP, quindi l'unica che può comandare davvero il programma. Le altre IA restano di riserva e tornano in prima fila se Claude non c'è o ha finito il carburante.
- Con uno strumento attivo il revisore controlla il risultato dentro lo strumento stesso (per Blender: legge la scena con gli strumenti mcp__blender), non solo i file sul disco.
LA PAGINA STRUMENTI (8, o /strumenti, o Alt+lettera da qualunque pagina):
- ogni tessera mostra stato (verde acceso, grigio spento, giallo da configurare, azzurro sempre pronto), quante volte l'hai usato oggi, l'ultima azione e il tasto Alt
- FRECCE scelgono lo strumento, un clic lo sceglie, un secondo clic lo usa
- INVIO con la riga vuota porta @nome nella riga delle IA di LAVORO; se invece scrivi qualcosa e premi INVIO, parte subito una richiesta con quello strumento
- CTRL+A (o il pulsante AVVIA) apre il programma, se la scheda ha il campo "avvia"
- DA SISTEMARE elenca cosa manca (il programma del collegamento, la sua cartella, il programma da avviare): KORTEX lo cerca da solo ogni 30 secondi, o subito con CONTROLLA
- gli strumenti che nella scheda hanno "progetti" diversi da quello aperto restano in fondo, spenti
- nella barra in basso il blocco con la chiave inglese dice quanti strumenti sono accesi
Se lo strumento risulta spento, KORTEX lo scrive nell'OUTPUT prima di partire: per Blender basta aprirlo, il server parte da solo.
La prima volta KORTEX copia le schede che porta con sé; le tue non vengono mai sovrascritte dagli aggiornamenti.

# I PUNTI DI RIPRISTINO
Prima e dopo ogni richiesta KORTEX fotografa i file del progetto in un archivio nascosto (.kortex/istantanee.git), separato dal tuo git: la tua storia non viene toccata.
- /ripristina mostra gli ultimi punti; /ripristina ID riporta tutti i file a quel momento, togliendo anche quelli creati dopo
- Prima di ripristinare scatta un punto di sicurezza, quindi anche il ripristino si può annullare: il comando per farlo te lo scrive lui
- Nella pagina PROGETTI li vedi elencati con data ed etichetta

# ALLEGARE FILE E FOTO
Le IA possono leggere qualunque file o immagine che alleghi. Tre modi:
- TRASCINA il file nella finestra del terminale mentre il cursore è nella riga ›: compare nella barra allegati.
- /allega apre un selettore: scrivi una parte del nome, ↑↓ per scegliere, INVIO per allegare. Cerca nel progetto, in Download, Immagini, Scrivania e Documenti.
- CTRL+O fa uno screenshot con Flameshot: selezioni la zona e si allega da solo.
Gli allegati vengono copiati nella cartella .kortex/allegati del progetto e partono con la richiesta successiva. /allegati li elenca, /togli 2 toglie il secondo, /togli tutti li toglie tutti.

# LA GRAFICA
- TEMI: neon, fuoco, ghiaccio, matrix. Dalla plancia (Tema di colore) o con /tema. Cambiano interfaccia, logo e animazione iniziale.
- EMBLEMI: nell'angolo del DATABASE c'è un cervello in un barattolo, nell'angolo dei PROGETTI una mappa stellare. Si accendono solo quando succede qualcosa: le bolle salgono quando le IA leggono o scrivono nel database, la luce corre tra le stelle quando apri un progetto o salvi un punto di ripristino.
- BARRA DI AVANZAMENTO: mentre la squadra lavora, la riga in fondo mostra quanto manca, il compito in corso, chi sta lavorando e da quanto.
- NOTIFICHE: in alto a destra compaiono per qualche secondo quando un compito finisce, quando finisce la richiesta e quando il memorista impara qualcosa. A fine richiesta arriva anche una notifica di sistema, così la vedi pure se stai lavorando in un'altra finestra.
- TRANSIZIONI: cambiando pagina una banda di luce attraversa lo schermo. Con Animazioni SPENTA sparisce.

# LE FINESTRE
KORTEX si apre grande ma in una finestra normale: puoi stringerla, spostarla, affiancarla. Si ridisegna da solo alla misura nuova.
- CTRL+ALT+SHIFT + FRECCIA SINISTRA o DESTRA: metà schermo
- CTRL+ALT+SHIFT + FRECCIA SU o GIÙ: metà alta o bassa
- CTRL+ALT+SHIFT+INVIO: massimizza o ripristina
Valgono per qualunque finestra, non solo KORTEX: utile per tenere affiancati KORTEX e il browser, o due KORTEX su progetti diversi.

# I CERVELLI DELLE IA
Ogni IA ha un cervello col suo colore: Claude arancio, Codex verde, Gemini blu, Ollama grigio. Quando pensa si accende e ci corre sopra un'onda di luce; da ferma respira piano; rosso lampeggiante vuol dire che ha finito il limite dell'abbonamento; spento vuol dire non collegata.

# NIENTE SFARFALLIO
KORTEX riscrive sullo schermo solo le righe che cambiano, tutte in un colpo, e chiede al terminale di mostrare il fotogramma solo quando è completo. Se un terminale molto vecchio mostra qualcosa di strano, /grafica leggera riduce gli aggiornamenti al minimo.

# LA SCHERMATA INIZIALE
Il risveglio: il battito del cuore, le onde cerebrali, il cervello a circuiti che si accende, il teschio in 3D vero (calcolato al momento, con luce e ombre) che si forma e apre gli occhi, KORTEX che si assembla dai frammenti, la firma forgiata a caldo, l'accensione dei sistemi con lo stato delle IA, del database e della memoria, e il teschio che rimpicciolisce fino all'intestazione mentre le pagine si disegnano. Cambia col tema: stelle (NEON), fiamme (FUOCO), neve (GHIACCIO), pioggia di caratteri (MATRIX). Un tasto qualsiasi la salta; kortex --no-anim la toglie; sul telefono c'è una versione corta.

# I TASTI
- TAB / SHIFT+TAB: pagina successiva / precedente
- CTRL+T: cursore nel terminale ($) oppure nelle IA (›)
- CTRL+N: scheda successiva a destra
- CTRL+D: macchina successiva del terminale
- FRECCIA SU / GIÙ: scorre il testo (nella plancia: sceglie il parametro)
- PAG SU / PAG GIÙ: scorre di una pagina intera
- FRECCIA SINISTRA / DESTRA: nella plancia, cambia il valore del parametro
- 1 2 3 4 5: nella plancia, applica una mappatura
- ESC: torna a LAVORO (nel selettore file: lo chiude)
- CTRL+O: screenshot da allegare
- CTRL+F: filtro del registro
- CTRL+K: mentre la squadra lavora, salta l'IA che sta lavorando adesso e passa alla riserva (utile se la vedi ferma da troppo)
- CTRL+P: la TAVOLOZZA dei comandi: scrivi due lettere e trovi pagine, schede, temi, profili, mappature, progetti, chat, comandi e voci del database
- CTRL+R: nella scheda DIFF, riporta il file scelto com'era
- CTRL+C: ferma il comando della shell; se non ce n'è nessuno, esce

# I COMANDI
Si scrivono nella barra in basso, iniziano con la barra /.
- /chiedi richiesta: come una richiesta normale, ma il direttore può farti una domanda prima
- /coda · /coda svuota: le richieste in attesa
- /grafica auto | piena | leggera | spenta · /suoni on | off · /mouse on | off
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
- /dest: elenca le macchine del terminale; /dest 2 ne sceglie una; /dest aggiungi nome utente@host la salva
- /scheda N: scheda a destra da 1 a 5
- /progetto: elenca; /progetto nuovo nome · /progetto apri N · /progetto importa percorso · /progetto qui
- /chat nuova [titolo] · /chat apri N: le chat del progetto
- /ripristina [ID]: punti di ripristino
- /db: tutti i comandi del database (/db scansiona cataloga i file arrivati da soli)
- /strumento · /strumento blender: gli strumenti esterni e il loro stato (nella richiesta: @blender)
- /strumenti: apre la pagina STRUMENTI
- /tema neon | fuoco | ghiaccio | matrix | tokyonight | dracula | synthwave | vaporwave: colori di tutto KORTEX
- /profilo programmatore | minecraft | studio | creativo: prepara KORTEX per quel tipo di lavoro (/profilo da solo li elenca)
- /statistiche: apre la pagina STATISTICHE
- /bolle on | off: OUTPUT a bolle o testo semplice
- /icone auto | on | off: icone del Nerd Font o simboli normali
- /novita · /tutorial: riapre le novità della versione o il giro guidato
- /ricorda testo · /dimentica N · /memoria: la memoria
- /pulisci: svuota l'output
- /esci: esce

# LA BARRA DI STATO
L'ultima riga, a blocchi colorati: a sinistra la modalità (SQUADRA o CHAT) e il profilo, il ramo git con quanti file sono cambiati (±3), lo stato del lavoro con la barra di avanzamento. In mezzo un consiglio, o cosa sta facendo la squadra. A destra il CARBURANTE di ogni IA, quante richieste sono in coda e l'ora.

# IL CARBURANTE
Gli abbonamenti contano l'uso a finestre di 5 ore. KORTEX conta le chiamate a ogni IA nelle ultime 5 ore e le confronta con un limite: all'inizio è una STIMA (la ~ accanto alla barra), poi la prima volta che un'IA si ferma davvero per limite raggiunto KORTEX si segna il numero giusto e da lì usa quello. Sotto il 20% ti avvisa; quando un'IA è a secco lavora la riserva. Puoi fissare i limiti a mano in config.json, voce "limiti5h" (esempio: {"claude": 200}).

# I PROFILI
Un profilo prepara tutto per un tipo di lavoro, con /profilo o con CTRL+P:
- PROGRAMMATORE: squadra completa, revisore che esegue i test, scheda DIFF in primo piano.
- MINECRAFT: terminale sul server SSH in primo piano, l'operatore lancia i comandi del server e fa sempre una copia prima di toccare i file.
- STUDIO: chat diretta con una sola IA, risposte chiare e didattiche.
- CREATIVO: giochi e grafica, anteprime HTML in un file solo, immagini salvate nel database.

# LE ICONE
Con il font JetBrainsMono Nerd Font KORTEX usa icone vere e le frecce della barra. kortex --aggiorna lo installa da solo e lo imposta nel terminale (il font di prima è salvato in ~/.config/kortex/font-precedente.txt). Senza il font usa simboli normali. /icone off le spegne.

# COME LAVORA LA SQUADRA
- DIRETTORE: legge la richiesta e il diario, divide il lavoro in compiti, sceglie chi li fa e dice quali compiti dipendono da quali.
- PIANIFICATORE: per ogni compito scrive un piano a passi. Legge i file, non li tocca.
- ESECUTORE: fa il lavoro vero sui file del progetto (compiti "codice" e "analisi").
- OPERATORE: lancia comandi, test, script e installazioni dentro la cartella del progetto e riferisce l'esito (compiti "comando"). Il direttore non chiede mai a te di lanciare qualcosa: lo dà all'operatore. Ha il permesso di eseguire comandi anche in autonomia PRUDENTE, ma solo dentro il progetto.
- REVISORE: controlla. Può lanciare i test o il programma per verificare davvero (Revisore esegue test, nella plancia): non si fida del riepilogo. Se trova un errore concreto, chi ha lavorato corregge.
I compiti che non dipendono l'uno dall'altro partono IN PARALLELO, fino al numero scelto nella plancia (Compiti in parallelo): due esecutori su due file diversi insieme, poi i test quando tutti e due hanno finito. Nell'albero le dipendenze sono segnate con ← e i numeri dei compiti da aspettare.
Le correzioni riprendono la stessa conversazione e ricevono solo le note del revisore: niente si ripete da capo.
Il revisore ha una regola: se non riesce a vedere qualcosa, non è un errore di chi ha lavorato.

# LE MAPPATURE
Sono regolazioni pronte, dalla più leggera alla più profonda. Cambiano compiti, parallelo, piano, revisione, correzioni e tempo massimo tutti insieme.
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

# LE PROVE AUTOMATICHE
- KORTEX ha delle prove che controllano da sole le parti più delicate del motore: la lettura del JSON dentro le risposte delle IA (blocchi di codice marcati json, graffe scritte dentro le virgolette, esempi messi prima del risultato vero), il riconoscimento del limite di abbonamento (per non passare alla riserva senza motivo) e gli strumenti (le menzioni @, gli argomenti MCP passati a Claude, i percorsi scritti con la ~, la copia delle schede che non sovrascrive mai le tue, e la scelta dell'IA quando c'è uno strumento, cioè Claude per primo con le altre di riserva).
- Si lanciano da un terminale normale, dentro la cartella del progetto KORTEX (non dell'installazione): npm test. Se finisce con "fail 0" va tutto bene.

# PROBLEMI COMUNI
- Un'IA ha il pallino vuoto: non è installata o non è collegata. Lancia il suo comando da solo (claude, codex, gemini) e fai il login.
- Gemini dice "chiede di fare il login": esci da KORTEX, lancia gemini da solo in un terminale e accedi con Google.
- Gemini dà errore di account (IneligibleOrProjectId): il tuo account Google non ha la quota gratuita attiva da sola e vuole un progetto Google Cloud. Si sistema una volta: vai su console.cloud.google.com, crea un progetto (nome a piacere) e copia il suo ID; nel menu APIs cerca "Gemini for Google Cloud" e attivala; poi in un terminale normale scrivi: echo 'export GOOGLE_CLOUD_PROJECT=il-tuo-id' >> ~/.bashrc  e riapri il terminale. Rilancia gemini da solo per verificare.
- Una correzione non parte: controlla il parametro Correzioni massime nella plancia.
- L'interfaccia è lenta: metti Animazioni su LEGGERA o SPENTA.
- La barra di avanzamento è ferma da molto: la riga in fondo dice quale IA sta lavorando e da quanto. Se è troppo, CTRL+K la salta. KORTEX comunque considera bloccata un'IA che non scrive niente per 5 minuti (Silenzio massimo, nella plancia) e passa da solo alla riserva; direttore, pianificatore e revisore hanno al massimo 10 minuti.
- Una CLI chiede una conferma (per esempio Gemini: "ti fidi di questa cartella?"): dentro KORTEX non si può rispondere. Lancia quella CLI da sola nella cartella del progetto, rispondi una volta, e da lì in poi non lo chiede più.
- Il PC arranca con la grafica piena: /grafica leggera (o kortex --leggera per una volta). Con due compiti in parallelo anche le IA pesano di più: nella plancia metti Compiti in parallelo a 1.
- Il mouse non risponde: il terminale deve supportare il mouse (qterminal, Ptyxis, GNOME Terminal, Konsole lo fanno). Se il testo non si seleziona più: SHIFT+trascina, oppure /mouse off.
- Non si sente niente: /suoni mostra quale lettore ha trovato; su Lubuntu basta  sudo apt install -y pulseaudio-utils  (paplay) o alsa-utils (aplay).
- Per aggiornare KORTEX: esci e scrivi kortex --aggiorna.
- Per capire cosa non va con una IA: esci e scrivi kortex --prova. Fa una domanda vera a ognuna e ti dice il rimedio.
- Nella plancia, la colonna "ultime 5h" conta le chiamate a ogni IA nella finestra in cui gli abbonamenti misurano l'uso: se si avvicina al limite diventa gialla, al limite rossa.

# IDEATO E FORGIATO DA GASTY
Architetto di intelligenze, costruttore di mondi.
`.trim().split('\n');
