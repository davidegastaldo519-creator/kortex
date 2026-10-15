# Il banco di prova di KORTEX

Strumenti per provare KORTEX **per davvero**, senza una persona davanti allo schermo. Servono Python 3 con `pyte` e `Pillow`
(`pip install pyte pillow`) e il font DejaVu Sans Mono (su Lubuntu/Ubuntu c'è già).

- `schermo.py` — lancia KORTEX in una finestra finta della misura che vuoi, manda i tasti di uno scenario e salva lo schermo come testo e PNG.
  Esempio (dalla cartella di KORTEX):
  `python3 -I prove/schermo.py --cols 190 --rows 48 --out /tmp/prova --cwd . --cmd "node bin/kortex.js --no-anim" -- "2.5:SHOT lavoro" "3:KEYS \t" "3.6:SHOT progetti" "4:KEYS \x03"`
  Azioni: `SHOT nome` (fotografa, aspettando un attimo di quiete), `KEYS testo` (manda i byte così come sono, escape tipo `\t` `\r` `\x1b` `\x03`),
  `TYPE testo` (come una persona, un tasto alla volta). Un clic del mouse si manda come `KEYS \x1b[<0;COLONNA;RIGAM` (1-based), la rotella con `\x1b[<64;…M` (su) e `\x1b[<65;…M` (giù).
- `finti/claude` e `finti/codex` — IA finte: rispondono come le vere (JSON del direttore con compiti in parallelo e dipendenze, piano, esecutore che crea davvero i file, operatore che lancia davvero i comandi, revisore, memorista) senza consumare l'abbonamento.
  Si usano mettendole davanti nel PATH: `PATH=$PWD/prove/finti:$PATH`.
- `registra-splash.mjs` + `gif.py` — registrano la schermata iniziale fotogramma per fotogramma e la trasformano in una GIF:
  `node prove/registra-splash.mjs /tmp/fotogrammi neon 190 48` poi `python3 -I prove/gif.py /tmp/fotogrammi /tmp/risveglio.gif 190 48 1 0.5`.
- `righe-lunghe.py` — dato il flusso grezzo (`--raw file` di schermo.py), trova le righe più larghe del terminale: sono quelle che fanno scorrere lo schermo di una riga (di solito un simbolo che il terminale disegna largo due celle).

Variabili utili mentre si prova: `KORTEX_DEBUG_LOG=/tmp/registro.log` (tutto il REGISTRO in un file), `KORTEX_DEBUG_TASTI=/tmp/tasti.log` (ogni tasto e ogni INVIO).
