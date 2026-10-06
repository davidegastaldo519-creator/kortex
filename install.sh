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
      if ! grep -q 'HOME/.local/bin' "$HOME/.bashrc" 2> /dev/null; then
        echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.bashrc"
      fi
      echo "Aggiunto $DEST al PATH: apri un terminale NUOVO prima di usare kortex."
      ;;
  esac
fi

# ---------- solo PC: lanciatore, icona nel menu, scorciatoia ----------
if [ "$MACCHINA" = "Linux" ]; then
  echo "== Lanciatore e icona =="
  mkdir -p "$HOME/progetti" "$HOME/.local/share/icons" "$HOME/.local/share/applications"

  # Apre KORTEX nella cartella ~/progetti e, all'uscita, lascia il terminale aperto lì.
  printf '#!/usr/bin/env bash\ncd "$HOME/progetti"\n"%s/kortex"\nexec bash\n' "$DEST" > "$DEST/kortex-avvia"
  chmod +x "$DEST/kortex-avvia"

  cp "$QUI/assets/kortex.svg" "$HOME/.local/share/icons/kortex.svg"

  # Ogni desktop ha il suo terminale: Lubuntu qterminal, Ubuntu gnome-terminal.
  if command -v qterminal > /dev/null; then TERM_CMD="qterminal -e"
  elif command -v gnome-terminal > /dev/null; then TERM_CMD="gnome-terminal --"
  elif command -v konsole > /dev/null; then TERM_CMD="konsole -e"
  else TERM_CMD="x-terminal-emulator -e"; fi

  printf '[Desktop Entry]\nType=Application\nName=KORTEX\nComment=La corteccia delle tue IA\nExec=%s %s/kortex-avvia\nIcon=%s/.local/share/icons/kortex.svg\nTerminal=false\nCategories=Development;\n' \
    "$TERM_CMD" "$DEST" "$HOME" > "$HOME/.local/share/applications/kortex.desktop"
  echo "Icona KORTEX aggiunta al menu (categoria Sviluppo)"

  # Scorciatoia Super+K: solo su Openbox (Lubuntu), una volta sola, con copia di sicurezza.
  if pgrep -x openbox > /dev/null; then
    CFG=$(ps -o args= -C openbox | grep -o -- '--config-file [^ ]*' | cut -d' ' -f2)
    CFG=${CFG:-$HOME/.config/openbox/rc.xml}
    if [ -f "$CFG" ] && ! grep -q kortex-avvia "$CFG"; then
      cp "$CFG" "$CFG.bak-kortex"
      sed -i "s|</keyboard>|  <keybind key=\"W-k\"><action name=\"Execute\"><command>$TERM_CMD $DEST/kortex-avvia</command></action></keybind>\n</keyboard>|" "$CFG"
      openbox --reconfigure 2> /dev/null || true
      echo "Scorciatoia Super+K aggiunta"
    fi
  fi
fi

echo
echo "Fatto. Prova:"
echo "  kortex --check     (quali IA trova su questa macchina)"
echo "  kortex             (apre l'interfaccia nella cartella in cui ti trovi)"
[ "$MACCHINA" = "Linux" ] && echo "  oppure l'icona KORTEX nel menu, o Super+K se il desktop è Lubuntu"
