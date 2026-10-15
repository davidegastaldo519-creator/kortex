#!/usr/bin/env python3
# Cerca nel flusso grezzo scritto da Ink le righe più larghe del terminale (quelle che fanno scorrere lo schermo).
import re, sys, unicodedata
dati = open(sys.argv[1], 'rb').read().decode('utf-8', 'replace')
larghezza = int(sys.argv[2])
ansi = re.compile(r'\x1b\[[0-9;?]*[A-Za-z]|\x1b\][^\x07]*\x07|\x1b[=>]')
def wcw(ch):
    if unicodedata.combining(ch): return 0
    if unicodedata.east_asian_width(ch) in ('W', 'F'): return 2
    return 1
righe = ansi.sub('', dati).split('\n')
lunghe = [(i, sum(wcw(c) for c in r.rstrip('\r'))) for i, r in enumerate(righe)]
peggio = sorted(lunghe, key=lambda x: -x[1])[:5]
for i, n in peggio:
    print(n, repr(righe[i].rstrip('\r')[:160]))
print('righe totali', len(righe), 'oltre', larghezza, ':', sum(1 for _, n in lunghe if n > larghezza))
