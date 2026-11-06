"""Build both outputs from src/lisio.template.html.
- index.html (Vercel): full document, Instrument Sans and Geist Mono from Google Fonts.
- dist/artifact.html (claude.ai): fonts inlined, no document skeleton.
"""
import pathlib, re
root = pathlib.Path(__file__).resolve().parent.parent
import sys; sys.path.insert(0, str(root / "src")); from core_inline import inline_core
t = inline_core((root / "src/lisio.template.html").read_text())
# Version de Lisio pour les rapports (F11) : empreinte du code de la page, stable d'un build à l'autre tant que rien ne change.
import hashlib; t = t.replace("__LISIO_BUILD__", hashlib.sha256(t.encode()).hexdigest()[:7])
gf = (root / "src/gf.txt").read_text(); n = gf.count(";") + 1
t = t.replace("__GF__", gf).replace("__GFCOUNT__", f"{n:,}".replace(",", " "))
(root / "dist").mkdir(exist_ok=True)
(root / "dist/artifact.html").write_text(t)
cdn = "https://cdn.jsdelivr.net/npm/@carrot-kpi/switzer-font@0.1.0/files/switzer-latin-{w}-normal.woff2"
v = re.sub(r'url\(data:font/woff2;base64,[^)]*\)', "URL", t)
v = re.sub(r'(font-weight:(\d+);font-display:swap;src:)URL', lambda m: m.group(1) + f"url({cdn.format(w=m.group(2))})", v)
v = v.replace('<meta name="claude:viewport-fit-sides" content="cover">', "")
head = (root / "src/head.html").read_text()
i = v.index("</style>") + len("</style>")
(root / "index.html").write_text(head + v[:i] + "\n</head>\n<body>\n" + v[i:] + "\n</body>\n</html>\n")
# Plugin Figma : code.js = cœur + interface, puis archive servie par Vercel
import zipfile
pl = root / "figma-plugin"
# Le cœur de Lisio (contraste, seuils) est inliné dans core.js aux marqueurs /*@core:x*/ : même calcul que le site (P0-6).
(pl / "code.js").write_text(inline_core((pl / "core.js").read_text() + (pl / "main.js").read_text()))
with zipfile.ZipFile(root / "lisio-figma-plugin.zip", "w", zipfile.ZIP_DEFLATED) as z:
    for f in ("manifest.json", "code.js", "ui.html"):
        z.write(pl / f, f"lisio-figma-plugin/{f}")

import pages; pages.build()
