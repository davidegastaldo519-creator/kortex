#!/usr/bin/env bash
# Installa KORTEX su questa macchina: PC Linux (Lubuntu, Ubuntu) o Termux (telefono, tablet).
# Si può rilanciare quante volte vuoi: non rompe niente.
set -e
cd "$(dirname "$0")"
QUI="$(pwd)"

if [ -n "$TERMUX_VERSION" ]; then
  MACCHINA="Termux"
  DEST="$PREFIX/bin"
else
  MACCHINA="Linux"
  DEST="$HOME/.local/bin"
fi
echo "== Installazione su $MACCHINA =="

if ! command -v node > /dev/null; then
  echo "Node.js non trovato."
  if [ "$MACCHINA" = "Termux" ]; then
    echo "Installalo con:  pkg install nodejs"
  else
    echo "Installalo seguendo README.md (sezione Node.js), poi rilancia questo script."
  fi
  exit 1
fi

V=$(node -p 'process.versions.node.split(".")[0]')
if [ "$V" -lt 18 ]; then
  echo "Serve Node.js 18 o superiore: hai la $V. Vedi README.md."
  exit 1
fi
echo "Node.js $(node --version): ok"

echo "== Dipendenze =="
npm install --omit=dev --no-audit --no-fund

chmod +x bin/kortex.js
mkdir -p "$DEST"
ln -sf "$QUI/bin/kortex.js" "$DEST/kortex"
echo "Comando 'kortex' collegato in $DEST"

if [ "$MACCHINA" = "Linux" ]; then
  case ":$PATH:" in
    *":$DEST:"*) ;;
    *)
      echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.bashrc"
      echo "Aggiunto $DEST al PATH: apri un terminale NUOVO prima di usare kortex."
      ;;
  esac
fi

echo
echo "Fatto. Prova:"
echo "  kortex --check     (quali IA trova su questa macchina)"
echo "  kortex             (apre l'interfaccia nella cartella in cui ti trovi)"
