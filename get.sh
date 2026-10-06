#!/usr/bin/env bash
# KORTEX — installazione e aggiornamento a una riga:
#   curl -fsSL https://raw.githubusercontent.com/davidegastaldo519-creator/kortex/main/get.sh | bash
# Funziona su PC Linux e su Termux. Rilanciarlo aggiorna all'ultima versione.
set -e
REPO="davidegastaldo519-creator/kortex"
DIR="$HOME/.kortex-app"

echo "== KORTEX — da github.com/$REPO =="

MANCA=""
command -v git > /dev/null || MANCA="$MANCA git"
command -v node > /dev/null || MANCA="$MANCA nodejs"
if [ -n "$MANCA" ]; then
  echo "Mancano:$MANCA"
  if [ -n "$TERMUX_VERSION" ]; then
    echo "Installa con:  pkg install$MANCA"
  else
    echo "Istruzioni: https://github.com/$REPO#installazione"
  fi
  exit 1
fi

if [ -d "$DIR/.git" ]; then
  echo "Già installato: aggiorno all'ultima versione"
  git -C "$DIR" pull --ff-only
else
  git clone --depth 1 "https://github.com/$REPO.git" "$DIR"
fi

bash "$DIR/install.sh"
