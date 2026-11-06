// Lisio, lecture du CSS exporté (F12) : catégories, variables une par une, variables seules.
// Fonctions pures, pour le CSS que Lisio produit lui-même (pas un analyseur CSS général).
// Testées par tests/css.test.mjs ; la validité réelle est vérifiée par le navigateur dans tests/e2e/export.mjs.
export const CSS_CAT_FR = [[/^Primitives/, "Couleurs (primitives)"], [/^Semantic roles/, "Rôles"], [/^Layout/, "Mise en page et espacements"], [/^Typography/, "Typographie"], [/^Accessibility/, "Règles d’accessibilité"], [/^Components/, "Composants et états"], [/^Effects/, "Effets et images"]];
const CSS_MARK = /^\/\* ===== (.+?) ===== \*\/$/gm;
// Découpe en catégories, dans l'ordre du fichier. L'en-tête (commentaire de tête) reste avec la première.
export function cssSections(css) {
  const marks = [...css.matchAll(CSS_MARK)];
  if (!marks.length) return [{ title: "Tout", label: "Tout", text: css }];
  return marks.map((m, i) => { const start = i ? m.index : 0, end = i + 1 < marks.length ? marks[i + 1].index : css.length, raw = m[1].replace(/^\d+\.\s*/, "");
    const fr = CSS_CAT_FR.find(([re]) => re.test(raw)); return { title: raw, label: fr ? fr[1] : raw, text: css.slice(start, end) }; });
}
const stripComments = css => css.replace(/\/\*[^]*?\*\//g, "");
// Arbre de blocs : { sel, decls: [[prop, value]], kids: [] }.
export function cssTree(css) {
  const src = stripComments(css), root = { sel: "", decls: [], kids: [] }, stack = [root]; let buf = "";
  for (const ch of src) {
    if (ch === "{") { const node = { sel: buf.trim().replace(/\s+/g, " "), decls: [], kids: [] }; stack[stack.length - 1].kids.push(node); stack.push(node); buf = ""; }
    else if (ch === "}") { const t = buf.trim(); if (t) pushDecl(stack[stack.length - 1], t); if (stack.length < 2) throw new Error("accolade fermante en trop"); stack.pop(); buf = ""; }
    else if (ch === ";" && stack.length > 1) { pushDecl(stack[stack.length - 1], buf.trim()); buf = ""; }
    else buf += ch;
  }
  if (stack.length !== 1) throw new Error("accolade ouvrante non fermée");
  return root.kids;
}
function pushDecl(node, t) { if (!t) return; const i = t.indexOf(":"); if (i < 1) return; node.decls.push([t.slice(0, i).trim(), t.slice(i + 1).trim()]); }
// Variables CSS, avec leur contexte (bloc et média), dans l'ordre du fichier.
export function cssVars(css) {
  const out = [], walk = (nodes, ctx) => nodes.forEach(n => { const c = [...ctx, n.sel]; n.decls.forEach(([p, v]) => { if (p.startsWith("--")) out.push({ name: p, value: v, ctx: c }); }); walk(n.kids, c); });
  walk(cssTree(css), []); return out;
}
// Le même CSS réduit aux variables : blocs sans variable retirés, contexte (média, thème) gardé.
export function cssVarsOnly(css) {
  const ser = (nodes, ind) => nodes.map(n => { const d = n.decls.filter(([p]) => p.startsWith("--")), kids = ser(n.kids, ind + "  ");
    if (!d.length && !kids) return ""; return `${ind}${n.sel} {\n${d.map(([p, v]) => `${ind}  ${p}: ${v};\n`).join("")}${kids}${ind}}\n`; }).join("");
  return ser(cssTree(css), "");
}
export const cssIdentOk = name => /^--[a-z0-9]+(-[a-z0-9]+)*$/.test(name);
// Noms uniques et stables : même liste de noms, mêmes identifiants ; un doublon reçoit -2, -3…
export function uniqueSlugs(slugs, reserved = []) {
  const used = new Set(reserved), out = [];
  for (const s of slugs) { let x = s, n = 2; while (used.has(x)) x = `${s}-${n++}`; used.add(x); out.push(x); }
  return out;
}
