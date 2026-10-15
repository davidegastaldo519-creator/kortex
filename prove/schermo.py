#!/usr/bin/env python3
"""Banco di prova per KORTEX: lancia il programma in una pseudo-tty della misura voluta,
manda i tasti di uno scenario, ricostruisce lo schermo con pyte e lo salva come testo e PNG.

Uso:  python3 -I schermo.py --cols 190 --rows 48 --out cartella --cwd /percorso/kortex -- "0.5:SHOT avvio" "1:KEYS \\t" ...
Scenario: ogni voce è "secondi:AZIONE argomento". Azioni: SHOT nome · KEYS testo (escape \\x1b, \\t, \\r, \\x03) · WAIT
"""
import argparse, fcntl, os, pty, select, struct, sys, termios, time, signal
import pyte
from PIL import Image, ImageDraw, ImageFont

FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'
FONT_BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf'


def colore(c, predefinito):
    if c in ('default', None):
        return predefinito
    nomi = {'black': (0, 0, 0), 'red': (205, 49, 49), 'green': (13, 188, 121), 'brown': (229, 229, 16), 'blue': (36, 114, 200),
            'magenta': (188, 63, 188), 'cyan': (17, 168, 205), 'white': (229, 229, 229),
            'brightblack': (102, 102, 102), 'brightred': (241, 76, 76), 'brightgreen': (35, 209, 139), 'brightbrown': (245, 245, 67),
            'brightblue': (59, 142, 234), 'brightmagenta': (214, 112, 214), 'brightcyan': (41, 184, 219), 'brightwhite': (255, 255, 255)}
    if c in nomi:
        return nomi[c]
    try:
        return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))
    except Exception:
        return predefinito


def salva_png(screen, percorso, cw=9, ch=18):
    img = Image.new('RGB', (screen.columns * cw, screen.lines * ch), (8, 8, 12))
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype(FONT, 15)
    fb = ImageFont.truetype(FONT_BOLD, 15)
    for y in range(screen.lines):
        riga = screen.buffer[y]
        for x in range(screen.columns):
            c = riga[x]
            fg = colore(c.fg, (220, 220, 220))
            bg = colore(c.bg, (8, 8, 12))
            if c.reverse:
                fg, bg = bg, fg
            if bg != (8, 8, 12):
                d.rectangle([x * cw, y * ch, (x + 1) * cw - 1, (y + 1) * ch - 1], fill=bg)
            if c.data and c.data != ' ':
                d.text((x * cw, y * ch), c.data, font=fb if c.bold else f, fill=fg)
    img.save(percorso)


def testo(screen):
    return '\n'.join(''.join(screen.buffer[y][x].data or ' ' for x in range(screen.columns)).rstrip() for y in range(screen.lines))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--cols', type=int, default=190)
    ap.add_argument('--rows', type=int, default=48)
    ap.add_argument('--out', required=True)
    ap.add_argument('--cwd', required=True)
    ap.add_argument('--cmd', default='node bin/kortex.js')
    ap.add_argument('--env', action='append', default=[])
    ap.add_argument('--raw', default=None, help='salva qui tutti i byte scritti dal programma')
    ap.add_argument('scenario', nargs='*')
    a = ap.parse_args()
    raw = open(a.raw, 'wb') if a.raw else None
    os.makedirs(a.out, exist_ok=True)

    screen = pyte.Screen(a.cols, a.rows)
    stream = pyte.ByteStream(screen)
    pid, fd = pty.fork()
    if pid == 0:
        os.chdir(a.cwd)
        env = dict(os.environ, TERM='xterm-256color', COLORTERM='truecolor', LINES=str(a.rows), COLUMNS=str(a.cols))
        for e in a.env:
            k, v = e.split('=', 1)
            env[k] = v
        os.execvpe('/bin/sh', ['/bin/sh', '-c', a.cmd], env)
    fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack('HHHH', a.rows, a.cols, 0, 0))

    passi = []
    for s in a.scenario:
        t, resto = s.split(':', 1)
        azione, _, arg = resto.partition(' ')
        passi.append((float(t), azione, arg))
    passi.sort(key=lambda p: p[0])

    t0 = time.time()
    uscito = False
    diario = []
    i = 0
    ultimo = time.time()
    while True:
        ora = time.time() - t0
        while i < len(passi) and passi[i][0] <= ora:
            _, azione, arg = passi[i]
            i += 1
            if azione == 'SHOT':
                # aspetto un attimo di quiete (nessun dato per 70 ms), così non fotografo un fotogramma a metà
                limite = time.time() + 1.2
                while time.time() < limite:
                    r, _, _ = select.select([fd], [], [], 0.07)
                    if not r:
                        break
                    try:
                        stream.feed(os.read(fd, 65536))
                    except OSError:
                        break
                salva_png(screen, os.path.join(a.out, arg + '.png'))
                with open(os.path.join(a.out, arg + '.txt'), 'w') as f:
                    f.write(testo(screen))
                diario.append(f'{ora:6.2f}s SHOT {arg}')
            elif azione == 'KEYS':
                dati = arg.encode('utf-8').decode('unicode_escape').encode('latin-1')
                try:
                    os.write(fd, dati)
                except OSError:
                    pass
                diario.append(f'{ora:6.2f}s KEYS {arg!r}')
            elif azione == 'TYPE':
                # come una persona: un tasto alla volta
                dati = arg.encode('utf-8').decode('unicode_escape')
                for ch in dati:
                    try:
                        os.write(fd, ch.encode('utf-8'))
                    except OSError:
                        pass
                    time.sleep(0.045)
                    r, _, _ = select.select([fd], [], [], 0)
                    if r:
                        try:
                            stream.feed(os.read(fd, 65536))
                        except OSError:
                            pass
                diario.append(f'{ora:6.2f}s TYPE {arg!r}')
        if i >= len(passi):
            break
        r, _, _ = select.select([fd], [], [], 0.02)
        if r:
            try:
                dati = os.read(fd, 65536)
            except OSError:
                dati = b''
            if not dati:
                uscito = True
                diario.append(f'{time.time() - t0:6.2f}s USCITO')
                break
            if raw: raw.write(dati)
            stream.feed(dati)
    # svuota quello che resta
    for _ in range(10):
        r, _, _ = select.select([fd], [], [], 0.05)
        if not r:
            break
        try:
            dati = os.read(fd, 65536)
        except OSError:
            break
        if not dati:
            break
        stream.feed(dati)
    try:
        os.kill(pid, signal.SIGTERM)
    except OSError:
        pass
    try:
        os.waitpid(pid, os.WNOHANG)
    except OSError:
        pass
    with open(os.path.join(a.out, 'diario.txt'), 'w') as f:
        f.write('\n'.join(diario) + '\n')
    print('\n'.join(diario))
    print('uscito prima della fine' if uscito else 'ancora vivo alla fine dello scenario')


if __name__ == '__main__':
    main()
