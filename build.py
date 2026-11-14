#!/usr/bin/env python3
"""Assemble src/ into page.html (artifact body), index.html (standalone site, three.js from cdnjs)
and hasta.html (fully offline single file, three.js inlined).

  python3 build.py                 # writes page.html, index.html, hasta.html next to this script
  python3 build.py path/test.html  # also writes a test copy that loads vendor/three.min.js by file URL
"""
import pathlib, sys
root = pathlib.Path(__file__).resolve().parent
src = lambda n: (root / 'src' / n).read_text()
CDN = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.min.js'
FONTS = 'https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;700&family=Geist+Mono:wght@400;500&display=swap'
head = f'''<title>Hasta</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="Strength is solved. Hands aren't. A scroll-driven look at Hasta, a concept service robot built around its hands.">
<meta name="theme-color" content="#fffdfd">
<link rel="stylesheet" href="{FONTS}">
<style>
{src('style.css')}</style>
'''
code = f"{src('core.js')}\n{src('robot.js')}\n{src('app.js')}"
def scripts(three_tag):
    return f"{three_tag}\n<script>\n{code}</script>\n"
body = src('body.html')
ext = lambda url: f'<script src="{url}"></script>'
doc = lambda three_tag: f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
{head}</head>
<body>
{body}{scripts(three_tag)}</body>
</html>
'''
(root / 'page.html').write_text(head + body + scripts(ext(CDN)))      # body-only: for publishing as a Claude artifact
(root / 'index.html').write_text(doc(ext(CDN)))                        # standalone, needs the CDN
vendor = root / 'vendor' / 'three.min.js'
if vendor.exists():
    three = vendor.read_text()
    assert '</script' not in three.lower()
    (root / 'hasta.html').write_text(doc('<script>\n' + three + '\n</script>'))   # fully offline
    if len(sys.argv) > 1:
        pathlib.Path(sys.argv[1]).write_text(doc(ext('file://' + str(vendor))))
else:
    print('vendor/three.min.js not found: skipped hasta.html. Fetch it with:\n  curl -o vendor/three.min.js ' + CDN)
print('built', (root / 'page.html').stat().st_size, 'bytes')
