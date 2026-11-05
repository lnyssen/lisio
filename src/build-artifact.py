"""Rebuild the claude.ai artifact version (fonts inlined) from the template."""
import base64, pathlib, sys
here = pathlib.Path(__file__).parent
sys.path.insert(0, str(here)); from core_inline import inline_core
t = inline_core((here / "lisio.template.html").read_text())
gf = (here / "gf.txt").read_text(); n = gf.count(";") + 1
out = t.replace("__GF__", gf).replace("__GFCOUNT__", f"{n:,}".replace(",", " "))
pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "artifact.html").write_text(out)
