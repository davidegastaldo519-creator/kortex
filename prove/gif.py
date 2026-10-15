#!/usr/bin/env python3
# Trasforma i fotogrammi ANSI in una GIF animata (via pyte + Pillow).
import sys, os, glob, pyte
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from schermo import salva_png, colore
from PIL import Image, ImageDraw, ImageFont
cartella, out, cols, rows = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
passo = int(sys.argv[5]) if len(sys.argv) > 5 else 1
scala = float(sys.argv[6]) if len(sys.argv) > 6 else 0.5
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'
cw, ch = 9, 18
f = ImageFont.truetype(FONT, 15)
screen = pyte.Screen(cols, rows); stream = pyte.ByteStream(screen)
frames = []
files = sorted(glob.glob(os.path.join(cartella, 'f*.ans')))
for i, fn in enumerate(files):
    stream.feed(open(fn, 'rb').read())
    if i % passo: continue
    img = Image.new('RGB', (cols * cw, rows * ch), (8, 8, 12))
    d = ImageDraw.Draw(img)
    for y in range(rows):
        riga = screen.buffer[y]
        for x in range(cols):
            c = riga[x]
            if not c.data or c.data == ' ':
                if c.bg not in ('default', None): d.rectangle([x*cw, y*ch, (x+1)*cw-1, (y+1)*ch-1], fill=colore(c.bg, (8,8,12)))
                continue
            fg = colore(c.fg, (220, 220, 220)); bg = colore(c.bg, (8, 8, 12))
            if bg != (8, 8, 12): d.rectangle([x*cw, y*ch, (x+1)*cw-1, (y+1)*ch-1], fill=bg)
            if c.data in '▀▄█':  # i blocchi: rettangoli pieni, così la GIF non ha righe vuote tra le celle
                if c.data == '▀': d.rectangle([x*cw, y*ch, (x+1)*cw-1, y*ch+ch//2-1], fill=fg)
                elif c.data == '▄': d.rectangle([x*cw, y*ch+ch//2, (x+1)*cw-1, (y+1)*ch-1], fill=fg)
                else: d.rectangle([x*cw, y*ch, (x+1)*cw-1, (y+1)*ch-1], fill=fg)
            else: d.text((x*cw, y*ch), c.data, font=f, fill=fg)
    if scala != 1: img = img.resize((int(cols*cw*scala), int(rows*ch*scala)), Image.LANCZOS)
    frames.append(img.quantize(colors=128, method=Image.Quantize.FASTOCTREE))
frames[0].save(out, save_all=True, append_images=frames[1:], duration=int(1000/15*passo), loop=0, optimize=False)
print(len(frames), 'fotogrammi ->', out, os.path.getsize(out)//1024, 'KB')
