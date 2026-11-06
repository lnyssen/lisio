"""Inline src/core/*.mjs into the template at /*@core:name*/ markers.
The modules stay importable by Node tests; in the page they become plain declarations
inside the app's IIFE: the leading `export ` is removed, nothing else changes."""
import pathlib, re
CORE = pathlib.Path(__file__).resolve().parent / "core"

def inline_core(t):
    def sub(m):
        src = (CORE / f"{m.group(1)}.mjs").read_text()
        # Only sibling core imports are allowed: they are inlined earlier in the same scope, so the line is dropped.
        src = re.sub(r'^import \{[^}]*\} from "\./[a-z0-9-]+\.mjs";\n', '', src, flags=re.M)
        if re.search(r'^\s*import\b', src, re.M): raise SystemExit(f"core/{m.group(1)}.mjs: only sibling core imports allowed")
        return re.sub(r'^export ', '', src, flags=re.M).rstrip("\n")
    out = re.sub(r'/\*@core:([a-z0-9-]+)\*/', sub, t)
    if "export " in out and re.search(r'^export ', out, re.M): raise SystemExit("export left in page")
    # Garde-fou : un nom déclaré deux fois au premier niveau (module du cœur et page) casse toute la page.
    seen, dup = set(), set()
    for name in re.findall(r'^(?:const|let|var|function|async function) ([A-Za-z_$][\w$]*)', out, re.M):
        (dup if name in seen else seen).add(name)
    if dup: raise SystemExit("nom déclaré deux fois au premier niveau : " + ", ".join(sorted(dup)))
    return out
