#!/usr/bin/env bash
# Installa KORTEX su questa macchina: PC Linux (Lubuntu/Openbox, Ubuntu/GNOME) o Termux (telefono, tablet).
# Si può rilanciare quante volte vuoi: non rompe niente e non tocca le scorciatoie che hai già.
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

  # Il desktop: Wayland (GNOME nuovo) o X11 (Lubuntu/Openbox). Su Wayland wmctrl non serve e non va suggerito.
  WAYLAND=""
  [ -n "$WAYLAND_DISPLAY" ] || [ "$XDG_SESSION_TYPE" = "wayland" ] && WAYLAND="1"

  # Apre KORTEX nella cartella ~/progetti e, all'uscita, lascia il terminale aperto lì.
  # Su X11 prova a massimizzare la finestra; su Wayland ci pensa il terminale (ptyxis --maximize).
  cat > "$DEST/kortex-avvia" << EOF
#!/usr/bin/env bash
cd "\$HOME/progetti"
if [ -n "\$DISPLAY" ] && [ -z "\$WAYLAND_DISPLAY" ]; then
  sleep 0.3
  if command -v wmctrl > /dev/null; then wmctrl -r :ACTIVE: -b remove,fullscreen; wmctrl -r :ACTIVE: -b add,maximized_vert,maximized_horz
  elif command -v xdotool > /dev/null; then xdotool getactivewindow windowsize 100% 100%; fi
fi
"$DEST/kortex"
exec bash
EOF
  chmod +x "$DEST/kortex-avvia"
  if [ -z "$WAYLAND" ] && ! command -v wmctrl > /dev/null && ! command -v xdotool > /dev/null; then
    echo "Per aprire KORTEX grande serve wmctrl:  sudo apt install -y wmctrl"
  fi

  cp "$QUI/assets/kortex.svg" "$HOME/.local/share/icons/kortex.svg"

  # Il font con le icone (Nerd Font): una volta sola. Senza, KORTEX usa simboli normali.
  if command -v fc-list > /dev/null && ! fc-list : family 2> /dev/null | grep -qi "nerd font"; then
    echo "== Font con le icone: JetBrainsMono Nerd Font =="
    CARTELLA_FONT="$HOME/.local/share/fonts/JetBrainsMonoNerd"
    mkdir -p "$CARTELLA_FONT"
    if curl -fsSL --max-time 180 -o "$CARTELLA_FONT/font.tar.xz" https://github.com/ryanoasis/nerd-fonts/releases/latest/download/JetBrainsMono.tar.xz \
       && tar -xJf "$CARTELLA_FONT/font.tar.xz" -C "$CARTELLA_FONT" 2> /dev/null; then
      rm -f "$CARTELLA_FONT/font.tar.xz"
      fc-cache -f "$HOME/.local/share/fonts" > /dev/null 2>&1 || true
      echo "Font installato"
    else
      rm -rf "$CARTELLA_FONT"
      echo "Font non scaricato (rete?): KORTEX userà i simboli normali. Riprova con kortex --aggiorna"
    fi
  fi
  # Il terminale deve usare quel font: Ptyxis (GNOME) e qterminal (Lubuntu). Il font di prima resta segnato.
  if fc-list : family 2> /dev/null | grep -qi "JetBrainsMono Nerd Font"; then
    FONT_NERD="JetBrainsMono Nerd Font"
    if command -v gsettings > /dev/null && gsettings list-keys org.gnome.Ptyxis 2> /dev/null | grep -qx font-name; then
      ATTUALE=$(gsettings get org.gnome.Ptyxis font-name 2> /dev/null)
      if ! echo "$ATTUALE" | grep -qi "nerd"; then
        mkdir -p "$HOME/.config/kortex" && echo "ptyxis font-name $ATTUALE use-system-font $(gsettings get org.gnome.Ptyxis use-system-font 2> /dev/null)" >> "$HOME/.config/kortex/font-precedente.txt"
        gsettings set org.gnome.Ptyxis use-system-font false
        gsettings set org.gnome.Ptyxis font-name "$FONT_NERD 12"
        echo "Ptyxis ora usa $FONT_NERD (il font di prima è segnato in ~/.config/kortex/font-precedente.txt)"
      fi
    fi
    QINI="$HOME/.config/qterminal.org/qterminal.ini"
    if [ -f "$QINI" ] && grep -q "^fontFamily=" "$QINI" && ! grep -qi "^fontFamily=.*nerd" "$QINI"; then
      cp "$QINI" "$QINI.bak-kortex"
      sed -i "s|^fontFamily=.*|fontFamily=$FONT_NERD|" "$QINI"
      echo "qterminal ora usa $FONT_NERD (copia della configurazione: $QINI.bak-kortex)"
    fi
  fi

  # Ogni desktop ha il suo terminale. Ptyxis (Ubuntu 24.10+/GNOME) per primo: con --maximize apre la finestra grande.
  if command -v ptyxis > /dev/null; then TERM_CMD="ptyxis --new-window --maximize -x"
  elif command -v qterminal > /dev/null; then TERM_CMD="qterminal -e"
  elif command -v gnome-terminal > /dev/null; then TERM_CMD="gnome-terminal --maximize --"
  elif command -v konsole > /dev/null; then TERM_CMD="konsole -e"
  elif command -v kgx > /dev/null; then TERM_CMD="kgx -e"
  else TERM_CMD="x-terminal-emulator -e"; fi

  printf '[Desktop Entry]\nType=Application\nName=KORTEX\nComment=La corteccia delle tue IA\nExec=%s %s/kortex-avvia\nIcon=%s/.local/share/icons/kortex.svg\nTerminal=false\nCategories=Development;\n' \
    "$TERM_CMD" "$DEST" "$HOME" > "$HOME/.local/share/applications/kortex.desktop"
  command -v update-desktop-database > /dev/null && update-desktop-database "$HOME/.local/share/applications" 2> /dev/null || true
  echo "Icona KORTEX aggiunta al menu (categoria Sviluppo), terminale: ${TERM_CMD%% *}"

  # Scorciatoia Ctrl+Alt+K su Openbox (Lubuntu): una volta sola, con copia di sicurezza.
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
    # Finestre affiancate: Ctrl+Alt+Shift + frecce = metà schermo, + INVIO = massimizza / ripristina.
    if [ -f "$CFG" ] && ! grep -q "kortex-finestre" "$CFG"; then
      cp "$CFG" "$CFG.bak-finestre"
      META='<action name="UnmaximizeFull"/><action name="MoveResizeTo">'
      sed -i "s|</keyboard>|  <!-- kortex-finestre -->\n  <keybind key=\"C-A-S-Left\">$META<x>0</x><y>0</y><width>50%</width><height>100%</height></action></keybind>\n  <keybind key=\"C-A-S-Right\">$META<x>-0</x><y>0</y><width>50%</width><height>100%</height></action></keybind>\n  <keybind key=\"C-A-S-Up\">$META<x>0</x><y>0</y><width>100%</width><height>50%</height></action></keybind>\n  <keybind key=\"C-A-S-Down\">$META<x>0</x><y>-0</y><width>100%</width><height>50%</height></action></keybind>\n  <keybind key=\"C-A-S-Return\"><action name=\"ToggleMaximize\"/></keybind>\n</keyboard>|" "$CFG"
      openbox --reconfigure 2> /dev/null || true
      echo "Finestre affiancate: Ctrl+Alt+Shift + frecce (metà schermo), Ctrl+Alt+Shift+INVIO (massimizza)"
    fi
  fi

  # Scorciatoia Ctrl+Alt+K su GNOME (Ubuntu): una scorciatoia personalizzata, aggiunta IN CODA alle tue
  # senza toccarle, e solo se non c'è già (anche fatta a mano con lo stesso nome "kortex").
  if command -v gsettings > /dev/null && [ "$XDG_CURRENT_DESKTOP" != "" ] && echo "$XDG_CURRENT_DESKTOP" | grep -qi gnome; then
    SCHEMA="org.gnome.settings-daemon.plugins.media-keys"
    BASE="/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings"
    MIA="$BASE/kortex/"
    LISTA=$(gsettings get "$SCHEMA" custom-keybindings 2> /dev/null || echo "@as []")
    if echo "$LISTA" | grep -q "kortex"; then
      echo "Scorciatoia GNOME già presente: non la tocco"
    else
      if echo "$LISTA" | grep -q "@as \[\]\|^\[\]$"; then NUOVA="['$MIA']"
      else NUOVA=$(echo "$LISTA" | sed "s|\]$|, '$MIA']|"); fi
      gsettings set "$SCHEMA" custom-keybindings "$NUOVA"
      gsettings set "$SCHEMA.custom-keybinding:$MIA" name 'KORTEX'
      gsettings set "$SCHEMA.custom-keybinding:$MIA" command 'gtk-launch kortex'
      gsettings set "$SCHEMA.custom-keybinding:$MIA" binding '<Control><Alt>k'
      echo "Scorciatoia Ctrl+Alt+K aggiunta a GNOME (apre l'icona KORTEX del menu)"
    fi
  fi
fi

if [ "$MACCHINA" = "Termux" ]; then
  echo
  echo "Su Termux:"
  echo "  - per vedere i file del telefono (foto, download) dai il permesso una volta:  termux-setup-storage"
  echo "  - Claude Code:  pkg install ripgrep && npm install -g @anthropic-ai/claude-code"
  echo "  - per i suoni:  pkg install termux-api  (e l'app Termux:API dallo store)"
  echo "  - lo schermo è piccolo: tieni il telefono in orizzontale, o usa un tablet"
fi

echo
echo "Fatto. Prova:"
echo "  kortex --check     (quali IA trova su questa macchina)"
echo "  kortex             (apre l'interfaccia nella cartella in cui ti trovi)"
[ "$MACCHINA" = "Linux" ] && echo "  oppure l'icona KORTEX nel menu, o Ctrl+Alt+K (Lubuntu e GNOME)"
