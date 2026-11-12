// Lisio, garde-fou pour les développeurs : un script Node sans dépendance (lisio-check.mjs) qui relit le code d’un site
// et refuse une couleur hors du design system ou une paire texte et fond sous le seuil WCAG.
// lisioScan est sérialisée telle quelle (toString) dans le script : elle ne doit dépendre de rien d’extérieur.
// Testée par tests/devcheck.test.mjs.

// files : [{ path, text }] ; tokensCss : le lisio.css exporté par Lisio ; level : "AA" ou "AAA".
// Renvoie { errors, warnings, files, colors } ; chaque constat porte file, line, rule et message (en français).
export function lisioScan(files, tokensCss, level) {
  const need = level === "AAA" ? 7 : 4.5;
  // Jetons du mode clair : le premier :root, avant le bloc sombre.
  const light = String(tokensCss || "").split(/@media\s*\(prefers-color-scheme:\s*dark\)|:root\[data-theme="dark"\]/)[0];
  const vars = new Map(); const reVar = /--([\w-]+)\s*:\s*([^;]+);/g; let m;
  while ((m = reVar.exec(light))) vars.set(m[1], m[2].trim());
  const toHex = v => {
    v = String(v).trim().toLowerCase();
    let x = v.match(/^#([0-9a-f]{3,8})$/);
    if (x) { let h = x[1]; if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split("").map(c => c + c).join(""); else h = h.slice(0, 6); return h.length === 6 ? "#" + h.toUpperCase() : null; }
    x = v.match(/^rgba?\(\s*([\d.]+%?)[\s,]+([\d.]+%?)[\s,]+([\d.]+%?)/);
    if (x) return "#" + [x[1], x[2], x[3]].map(c => Math.round(c.endsWith("%") ? parseFloat(c) * 2.55 : +c).toString(16).padStart(2, "0")).join("").toUpperCase();
    return null;
  };
  const resolve = (v, d = 0) => { v = String(v).trim(); const r = v.match(/^var\(\s*--([\w-]+)\s*(?:,\s*([^)]+))?\)$/); if (r) { if (d > 10) return null; return vars.has(r[1]) ? resolve(vars.get(r[1]), d + 1) : r[2] ? resolve(r[2], d + 1) : null; } return toHex(v); };
  const palette = new Map(); // hex → nom de variable le plus court (la nuance plutôt que l’alias)
  for (const k of vars.keys()) { const h = resolve(`var(--${k})`); if (h && (!palette.has(h) || k.length < palette.get(h).length)) palette.set(h, k); }
  const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  const lin = c => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const lum = h => { const [r, g, b] = rgb(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const ratio = (a, b) => { const A = lum(a), B = lum(b); return (Math.max(A, B) + 0.05) / (Math.min(A, B) + 0.05); };
  const nearest = h => { let best = null, d = Infinity; const p = rgb(h); for (const [q, k] of palette) { const v = rgb(q), e = (p[0] - v[0]) ** 2 + (p[1] - v[1]) ** 2 + (p[2] - v[2]) ** 2; if (e < d) { d = e; best = k; } } return best; };
  const f2 = r => (Math.floor(r * 100) / 100).toFixed(2).replace(".", ",");
  const errors = [], warnings = []; let colors = 0;
  const lineOf = (text, i) => text.slice(0, i).split("\n").length;
  const STYLE = /\.(css|scss|sass|less|styl|vue|svelte|astro|html?)$/i;
  for (const f of files) {
    const text = f.text, ignored = new Set();
    text.split("\n").forEach((l, i) => { if (/lisio-ignore/.test(l)) ignored.add(i + 1); });
    // 1. Couleurs écrites en dur
    const reCol = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g;
    while ((m = reCol.exec(text))) {
      const line = lineOf(text, m.index); if (ignored.has(line)) continue;
      const before = text.slice(Math.max(0, m.index - 1), m.index); if (/[\w&]/.test(before)) continue; // ancre, entité HTML
      const h = toHex(m[0]); if (!h) continue; colors++;
      if (/^#([0-9a-fA-F]{4}|[0-9a-fA-F]{8})$/.test(m[0]) || /rgba\(|\/\s*0?\.\d/.test(m[0])) { if (!STYLE.test(f.path)) continue; }
      if (palette.has(h)) warnings.push({ file: f.path, line, rule: "en-dur", message: `${m[0]} est dans le design system : écrivez var(--${palette.get(h)})` });
      else (STYLE.test(f.path) ? errors : warnings).push({ file: f.path, line, rule: "hors-palette", message: `${m[0]} ne vient pas du design system${palette.size ? `, la plus proche : var(--${nearest(h)})` : ""}` });
    }
    // 2. Paires dans une même règle CSS : color et background(-color)
    if (STYLE.test(f.path)) {
      const reRule = /\{([^{}]*)\}/g;
      while ((m = reRule.exec(text))) {
        const body = m[1], c = body.match(/(?:^|[;\s])color\s*:\s*([^;!]+)/), b = body.match(/background(?:-color)?\s*:\s*([^;!]+)/);
        if (!c || !b) continue;
        const line = lineOf(text, m.index + 1 + body.indexOf(c[0].trim())); if (ignored.has(line)) continue;
        const fg = resolve(c[1]), bg = resolve(b[1].trim().split(/\s+(?![^(]*\))/)[0]);
        if (!fg || !bg) continue;
        const r = ratio(fg, bg); if (r < need) errors.push({ file: f.path, line, rule: "contraste", message: `${c[1].trim()} sur ${b[1].trim()} : ${f2(r)}:1, il faut ${String(need).replace(".", ",")}:1 (WCAG 1.4.3${level === "AAA" ? ", 1.4.6" : ""})` });
      }
    }
    // 3. Classes Tailwind text-… et bg-… sur un même élément
    const reCls = /class(?:Name)?\s*=\s*["'`{]([^"'`}]*)["'`}]/g;
    while ((m = reCls.exec(text))) {
      const cls = m[1].split(/\s+/).filter(x => !x.includes(":")), t = cls.map(x => x.match(/^text-([\w-]+)$/)).find(x => x && vars.has(x[1])), b = cls.map(x => x.match(/^bg-([\w-]+)$/)).find(x => x && vars.has(x[1]));
      if (!t || !b) continue;
      const line = lineOf(text, m.index); if (ignored.has(line)) continue;
      const r = ratio(resolve(`var(--${t[1]})`), resolve(`var(--${b[1]})`));
      if (r < need) errors.push({ file: f.path, line, rule: "contraste", message: `${t[0]} sur ${b[0]} : ${f2(r)}:1, il faut ${String(need).replace(".", ",")}:1` });
    }
  }
  return { errors, warnings, files: files.length, colors, tokens: palette.size };
}

// Le script complet à poser à la racine du dépôt : node lisio-check.mjs [dossier] [--tokens chemin/lisio.css] [--json] [--warn-only]
export function devCheckScript(level, build) {
  return `#!/usr/bin/env node
// lisio-check.mjs · garde-fou couleurs et contrastes, généré par Lisio${build ? " (" + build + ")" : ""}. Node 18 ou plus, sans dépendance.
// Usage : node lisio-check.mjs [dossier] [--tokens lisio.css] [--level AA|AAA] [--json] [--warn-only]
// Refuse (code 1) : une couleur hors du design system dans une feuille de style, une paire texte et fond sous le seuil.
// Signale : une couleur du design system écrite en dur au lieu de var(--…). Ajoutez « lisio-ignore » sur une ligne pour l’exclure.
// Test automatique partiel : il lit le code, pas la page rendue. Il ne remplace pas un audit.
/* Node */ import { readFileSync, readdirSync, statSync, existsSync } from "node:fs"; import { join, relative, basename } from "node:path";
const args = process.argv.slice(2), opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const root = args.find((a, i) => !a.startsWith("--") && !["--tokens", "--level"].includes(args[i - 1])) || ".";
const level = (opt("--level") || ${JSON.stringify(level === "AAA" ? "AAA" : "AA")}).toUpperCase();
const SKIP = new Set(["node_modules", ".git", "dist", "build", ".next", ".nuxt", ".svelte-kit", "coverage", "vendor", ".vercel", ".output"]);
const EXT = /\\.(css|scss|sass|less|styl|html?|vue|svelte|astro|jsx|tsx|js|ts|mjs)$/i;
const all = []; (function walk(d) { for (const n of readdirSync(d)) { if (SKIP.has(n)) continue; const p = join(d, n), s = statSync(p); if (s.isDirectory()) walk(p); else if (EXT.test(n) && s.size < 1e6) all.push(p); } })(root);
let tokPath = opt("--tokens"); if (!tokPath) tokPath = all.find(p => basename(p) === "lisio.css");
if (!tokPath || !existsSync(tokPath)) { console.error("lisio-check : lisio.css introuvable. Exportez-le depuis Lisio (Exporter › Livrer) ou indiquez --tokens chemin/lisio.css"); process.exit(2); }
const skipFile = p => p === tokPath || /(^|[\\\\/])(tailwind\\.config\\.[cm]?[jt]s|lisio-check\\.mjs|.*\\.min\\.(css|js))$/.test(p);
const files = all.filter(p => !skipFile(p)).map(p => ({ path: relative(process.cwd(), p), text: readFileSync(p, "utf8") }));
const scan = ${lisioScan.toString()};
const r = scan(files, readFileSync(tokPath, "utf8"), level);
if (args.includes("--json")) console.log(JSON.stringify(r, null, 2));
else {
  const gh = !!process.env.GITHUB_ACTIONS, out = (k, x) => gh ? console.log(\`::\${k} file=\${x.file},line=\${x.line},title=Lisio \${x.rule}::\${x.message}\`) : console.log(\`\${k === "error" ? "✕" : "!"} \${x.file}:\${x.line}  \${x.message}\`);
  r.errors.forEach(x => out("error", x)); r.warnings.forEach(x => out("warning", x));
  console.log(\`\\nLisio · \${r.files} fichiers, \${r.colors} couleurs lues, \${r.tokens} couleurs dans le design system, niveau \${level}.\`);
  console.log(r.errors.length ? \`\${r.errors.length} erreur(s), \${r.warnings.length} avertissement(s).\` : \`Aucune erreur. \${r.warnings.length} avertissement(s).\`);
}
process.exit(r.errors.length && !args.includes("--warn-only") ? 1 : 0);
`;
}

// Workflow GitHub Actions : lance le garde-fou à chaque push et pull request.
export const DEVCHECK_WORKFLOW = `# .github/workflows/lisio.yml · généré par Lisio
name: Lisio
on: [push, pull_request]
jobs:
  couleurs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: node lisio-check.mjs
`;
