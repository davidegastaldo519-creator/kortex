# Le novità di KORTEX

## 2.3.0
- **Gli STRUMENTI**: i programmi di fuori diventano strumenti della squadra. Ogni strumento è una scheda .json in ~/.config/kortex/strumenti: nome, cosa sa fare, come si controlla se è acceso e quale server di strumenti avviare.
- **@blender nella richiesta**: scrivi @ e il nome dello strumento per darlo alla squadra; la parola @ sparisce dal testo prima che la richiesta parta.
- **Contesto per tutti i ruoli e MCP per Claude**: quello che lo strumento sa fare entra nel prompt di direttore, pianificatore, esecutore, operatore e revisore, e Claude riceve il server MCP sulla sua riga di comando, così può comandarlo davvero.
- **Avviso se lo strumento è spento**: prima di partire KORTEX controlla la porta dello strumento e scrive nell'OUTPUT cosa fare (per Blender basta aprirlo, il server parte da solo).
- **/strumento**: elenca gli strumenti con stato acceso o spento; **/strumento blender** mostra la scheda intera e dove sta il file.
- **La scheda di Blender**: KORTEX porta con sé la scheda già pronta di **Blender**, quindi il 3D si comanda da subito senza configurare niente; le schede che modifichi tu non vengono mai sovrascritte dagli aggiornamenti.
- **Prove automatiche degli strumenti**: con npm test si controllano le menzioni @ nella richiesta, gli argomenti MCP passati a Claude, i percorsi scritti con la ~ e la copia delle schede, che non sovrascrive mai quelle tue.

## 2.2.3
- **Niente più falsi limiti di abbonamento**: KORTEX non passa più alla riserva quando parole come "quota" o "rate limit" compaiono solo nel discorso dell'IA; guarda solo la fine di quello che ha scritto, e solo se il comando è uscito male.
- **Lettura del JSON ancora più solida**: una virgoletta spaiata prima del JSON (per esempio uno schermo "da 15 pollici" scritto con il simbolo) non manda più a monte la lettura del piano.
- **Più prove automatiche**: con npm test si controllano sia la lettura del JSON sia il riconoscimento del limite di abbonamento, in due file di prove.

## 2.2.2
- **Lettura del JSON più sicura**: nelle risposte delle IA KORTEX riconosce i blocchi di codice marcati json, non si fa confondere dalle graffe scritte dentro le virgolette e prova dall'ultimo blocco valido, così un esempio messo prima non prende il posto del risultato vero.
- **Il confronto delle modifiche vede anche i file già aggiunti**: la scheda DIFF usa git diff HEAD, quindi mostra pure i file messi nell'indice con git add; se nel progetto non c'è ancora nessun commit torna al comando di prima.
- **Le prime prove automatiche**: con npm test si controlla da solo che la lettura del JSON funzioni in tutti i casi difficili.

## 2.2.1
- **Claude non viene più fermato per sbaglio**: mentre scrive un file lungo manda segni di vita, così il guardiano del silenzio non lo crede più bloccato e non passa alla riserva senza motivo.
- **Simboli del REGISTRO**: l'avvio di una CLI (▸ ciano) e l'uso di uno strumento (◆ viola) adesso si distinguono a prima vista.

## 2.2.0
- **Tavolozza dei comandi (Ctrl+P)**: scrivi due lettere e trovi pagine, schede, temi, profili, progetti e voci del database.
- **OUTPUT a bolle**: ogni IA parla nella sua bolla col suo colore, il tempo e il compito; dentro, il testo è formattato (titoli, grassetto, elenchi, codice colorato).
- **Revisione file per file** nella scheda DIFF: INVIO accetta, Ctrl+R riporta il file com'era prima della richiesta. Anche "accetta tutto" e "rifiuta tutto".
- **Barra di stato** a blocchi colorati: modalità e profilo, ramo git, avanzamento, ora.
- **Carburante degli abbonamenti**: quanto resta di Claude e Codex nelle ultime 5 ore, con avviso sotto il 20%. Il limite si impara da solo.
- **Profili di lavoro**: Programmatore, Minecraft, Studio, Creativo (/profilo o Ctrl+P).
- **Temi nuovi**: Tokyo Night, Dracula, Synthwave e Vaporwave (con il tramonto a griglia nella schermata iniziale).
- **Icone vere** con il Nerd Font, installato da solo con kortex --aggiorna.
- **Pagina STATISTICHE**: richieste, compiti riusciti, file toccati, tempo delle IA e tempo risparmiato.
- Giro guidato al primo avvio (/tutorial) e questa finestra delle novità (/novita).
- Sui terminali stretti (telefono, finestra piccola) la barra di stato e le righe di comando si accorciano invece di uscire dal riquadro. Gli avvisi a comparsa stanno in basso a destra e non coprono più i pulsanti.
- Bordi dei riquadri sempre dritti: via i simboli che il terminale e KORTEX misuravano diversamente. Avvisi ed errori interni finiscono in ~/.cache/kortex/kortex.log invece che sullo schermo.

## 2.1.0
- Niente più sfarfallio: KORTEX riscrive solo le righe che cambiano.
- Scheda AGENTI rifatta: richiesta, compiti con le fasi, squadra, attività in diretta, coda, linea del tempo.

## 2.0.0
- Schermata iniziale "il risveglio" con il teschio in 3D vero.
- Compiti in parallelo, ruolo OPERATORE, revisore che esegue i test, coda delle richieste, /chiedi.
- Mouse, suoni, scheda DIFF, guardiano del database, preferenze condivise tra i PC, grafica piena/leggera automatica.
