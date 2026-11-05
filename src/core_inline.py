"""Inline src/core/*.mjs into the template at /*@core:name*/ markers.
The modules stay importable by Node tests; in the page they become plain declarations
inside the app's IIFE: the leading `export ` is removed, nothing else changes."""
import pathlib, re
CORE = pathlib.Path(__file__).resolve().parent / "core"

def inline_core(t):
    def sub(m):
        src = (CORE / f"{m.group(1)}.mjs").read_text()
        if re.search(r'^\s*import\b', src, re.M): raise SystemExit(f"core/{m.group(1)}.mjs: no import allowed (inlined as is)")
        return re.sub(r'^export ', '', src, flags=re.M).rstrip("\n")
    out = re.sub(r'/\*@core:([a-z0-9-]+)\*/', sub, t)
    if "export " in out and re.search(r'^export ', out, re.M): raise SystemExit("export left in page")
    return out
