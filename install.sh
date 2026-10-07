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

  # Apre KORTEX a schermo intero nella cartella ~/progetti e, all'uscita, lascia il terminale aperto lì.
  cat > "$DEST/kortex-avvia" << EOF
#!/usr/bin/env bash
cd "\$HOME/progetti"
if [ -n "\$DISPLAY" ]; then
  sleep 0.3
  if command -v wmctrl > /dev/null; then wmctrl -r :ACTIVE: -b add,fullscreen
  elif command -v xdotool > /dev/null; then xdotool getactivewindow key F11; fi
fi
"$DEST/kortex"
if [ -n "\$DISPLAY" ] && command -v wmctrl > /dev/null; then wmctrl -r :ACTIVE: -b remove,fullscreen; fi
exec bash
EOF
  chmod +x "$DEST/kortex-avvia"
  if ! command -v wmctrl > /dev/null && ! command -v xdotool > /dev/null; then
    echo "Per aprire KORTEX a schermo intero serve wmctrl:  sudo apt install -y wmctrl"
  fi

  cp "$QUI/assets/kortex.svg" "$HOME/.local/share/icons/kortex.svg"

  # Ogni desktop ha il suo terminale: Lubuntu qterminal, Ubuntu gnome-terminal.
  if command -v qterminal > /dev/null; then TERM_CMD="qterminal -e"
  elif command -v gnome-terminal > /dev/null; then TERM_CMD="gnome-terminal --"
  elif command -v konsole > /dev/null; then TERM_CMD="konsole -e"
  else TERM_CMD="x-terminal-emulator -e"; fi

  printf '[Desktop Entry]\nType=Application\nName=KORTEX\nComment=La corteccia delle tue IA\nExec=%s %s/kortex-avvia\nIcon=%s/.local/share/icons/kortex.svg\nTerminal=false\nCategories=Development;\n' \
    "$TERM_CMD" "$DEST" "$HOME" > "$HOME/.local/share/applications/kortex.desktop"
  echo "Icona KORTEX aggiunta al menu (categoria Sviluppo)"

  # Scorciatoia Ctrl+Alt+K: solo su Openbox (Lubuntu), una volta sola, con copia di sicurezza.
  # (Super+K non va: su Lubuntu il tasto Windows lo prende il menu di LXQt.)
  if pgrep -x openbox > /dev/null; then
    CFG=$(ps -o args= -C openbox | grep -o -- '--config-file [^ ]*' | cut -d' ' -f2)
    CFG=${CFG:-$HOME/.config/openbox/rc.xml}
    # Chi aveva la vecchia Super+K passa a Ctrl+Alt+K.
    if [ -f "$CFG" ] && grep -q 'key="W-k"><action name="Execute"><command>[^<]*kortex-avvia' "$CFG"; then
      sed -i 's|key="W-k"\(><action name="Execute"><command>[^<]*kortex-avvia\)|key="C-A-k"\1|' "$CFG"
      openbox --reconfigure 2> /dev/null || true
      echo "Scorciatoia spostata su Ctrl+Alt+K"
    fi
    if [ -f "$CFG" ] && ! grep -q kortex-avvia "$CFG"; then
      cp "$CFG" "$CFG.bak-kortex"
      sed -i "s|</keyboard>|  <keybind key=\"C-A-k\"><action name=\"Execute\"><command>$TERM_CMD $DEST/kortex-avvia</command></action></keybind>\n</keyboard>|" "$CFG"
      openbox --reconfigure 2> /dev/null || true
      echo "Scorciatoia Ctrl+Alt+K aggiunta"
    fi
  fi
fi

if [ "$MACCHINA" = "Termux" ]; then
  echo
  echo "Su Termux:"
  echo "  - per vedere i file del telefono (foto, download) dai il permesso una volta:  termux-setup-storage"
  echo "  - Gemini CLI si installa con:  npm install -g @google/gemini-cli"
  echo "  - Claude Code:  pkg install ripgrep && npm install -g @anthropic-ai/claude-code"
  echo "  - lo schermo è piccolo: tieni il telefono in orizzontale, o usa un tablet"
fi

echo
echo "Fatto. Prova:"
echo "  kortex --check     (quali IA trova su questa macchina)"
echo "  kortex             (apre l'interfaccia nella cartella in cui ti trovi)"
[ "$MACCHINA" = "Linux" ] && echo "  oppure l'icona KORTEX nel menu, o Ctrl+Alt+K se il desktop è Lubuntu"
