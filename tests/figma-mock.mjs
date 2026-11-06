// Faux « figma » pour tester le plugin sous Node, sans Figma (P0-6).
// Ne reproduit que ce que le plugin utilise : variables, collections et modes, styles, polices, nœuds simples.
// Les nœuds sont des objets ordinaires : toute propriété peut être écrite et relue.
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FONTS = ["Regular", "Italic", "Medium", "Semi Bold", "Bold", "Bold Italic", "Extra Bold", "Black"];

export function makeFigma({ families = ["Inter"], maxModes = 20 } = {}) {
  let seq = 0; const nid = p => `${p}:${++seq}`;
  const cols = [], vars = [], text = [], grid = [], effect = [], all = new Map();
  const detach = n => { const p = n.parent; if (p && p.children) { const i = p.children.indexOf(n); if (i >= 0) p.children.splice(i, 1); } n.parent = null; };
  function node(type, props = {}) {
    const n = { id: nid(type), type, name: type, x: 0, y: 0, width: 100, height: 10, visible: true, fills: [], strokes: [], ...props };
    if (!["TEXT", "RECTANGLE"].includes(type)) n.children = n.children || [];
    Object.assign(n, {
      appendChild(c) { detach(c); c.parent = n; n.children.push(c); },
      remove() { detach(n); n.removed = true; all.delete(n.id); },
      resize(w, h) { n.width = w; n.height = h; },
      findAll(fn) { const out = []; const walk = x => (x.children || []).forEach(c => { if (fn(c)) out.push(c); walk(c); }); walk(n); return out; },
      setExplicitVariableModeForCollection() {}, setBoundVariable() {}, async setTextStyleIdAsync(id) { n.textStyleId = id; }
    });
    all.set(n.id, n); return n;
  }
  const page = node("PAGE", { name: "Page 1", backgrounds: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }], selection: [] });
  const onPage = type => () => { const n = node(type); page.appendChild(n); return n; };
  const style = (list, type) => () => { const s = { id: nid("S"), type, name: "", description: "", setBoundVariable() {}, remove() { list.splice(list.indexOf(s), 1); } }; list.push(s); return s; };
  const colOf = c => typeof c === "string" ? cols.find(x => x.id === c) : c;
  const figma = {
    mixed: Symbol("mixed"), currentPage: page, root: { children: [page] }, posted: [],
    showUI() {}, notify() {}, viewport: { scrollAndZoomIntoView() {} },
    ui: { postMessage(m) { figma.posted.push(m); }, onmessage: null },
    async listAvailableFontsAsync() { return families.flatMap(f => FONTS.map(style => ({ fontName: { family: f, style } }))); },
    async loadFontAsync() {},
    async getNodeByIdAsync(id) { return all.get(id) || null; },
    async setCurrentPageAsync(p) { figma.currentPage = p; },
    createPage() { const p = node("PAGE", { selection: [] }); figma.root.children.push(p); return p; },
    createFrame: onPage("FRAME"), createText: onPage("TEXT"), createRectangle: onPage("RECTANGLE"), createComponent: onPage("COMPONENT"),
    combineAsVariants(list, parent) { const s = node("COMPONENT_SET"); parent.appendChild(s); list.forEach(c => s.appendChild(c)); return s; },
    node, nodes: all,
    async getLocalTextStylesAsync() { return text.slice(); }, createTextStyle: style(text, "TEXT"),
    async getLocalGridStylesAsync() { return grid.slice(); }, createGridStyle: style(grid, "GRID"),
    async getLocalEffectStylesAsync() { return effect.slice(); }, createEffectStyle: style(effect, "EFFECT"),
    styles: { text, grid, effect },
    variables: {
      cols, vars,
      async getLocalVariableCollectionsAsync() { return cols.slice(); },
      async getLocalVariablesAsync(type) { return vars.filter(v => !type || v.resolvedType === type); },
      async getVariableByIdAsync(id) { return vars.find(v => v.id === id) || null; },
      createVariableCollection(name) {
        const c = { id: nid("VC"), name, modes: [{ modeId: nid("M"), name: "Mode 1" }],
          renameMode(id, n) { const m = c.modes.find(m => m.modeId === id); if (!m) throw new Error("mode inconnu"); m.name = n; },
          addMode(n) { if (c.modes.length >= maxModes) throw new Error("limite de modes atteinte"); const m = { modeId: nid("M"), name: n }, m0 = c.modes[0].modeId; c.modes.push(m);
            // Hypothèse non vérifiée dans Figma : un nouveau mode part des valeurs du premier mode, comme dans son interface.
            vars.filter(v => v.variableCollectionId === c.id && m0 in v.valuesByMode).forEach(v => { v.valuesByMode[m.modeId] = v.valuesByMode[m0]; }); return m.modeId; } };
        cols.push(c); return c;
      },
      createVariable(name, col, type) {
        const c = colOf(col), v = { id: nid("V"), name, variableCollectionId: c.id, resolvedType: type, valuesByMode: {}, scopes: ["ALL_SCOPES"], description: "", codeSyntax: {},
          setValueForMode(m, val) { v.valuesByMode[m] = val; }, setVariableCodeSyntax(p, s) { v.codeSyntax[p] = s; },
          remove() { vars.splice(vars.indexOf(v), 1); v.removed = true; } };
        vars.push(v); return v;
      },
      createVariableAlias(v) { return { type: "VARIABLE_ALIAS", id: v.id }; },
      setBoundVariableForPaint(p, f, v) { return { ...p, boundVariables: { [f]: { type: "VARIABLE_ALIAS", id: v.id } } }; }
    }
  };
  return figma;
}

// Charge code.js (tel que build.py le produit) dans un contexte isolé, avec ce faux figma.
export function loadPlugin(figma, file = join(ROOT, "figma-plugin", "code.js")) {
  const ctx = vm.createContext({ figma, __html__: "", console });
  vm.runInContext(readFileSync(file, "utf8"), ctx, { filename: "code.js" });
  return { ctx, get: name => vm.runInContext(name, ctx) };
}

export const dsJson = (name = "exemple") => JSON.parse(readFileSync(join(ROOT, "tests", "golden", name, "ds.json"), "utf8"));

// État lisible du fichier : sert à comparer avant et après, et au fichier de référence de l'import.
export function snapshot(figma) {
  const { cols, vars } = figma.variables, hex = c => "#" + [c.r, c.g, c.b].map(v => Math.round(v * 255).toString(16).padStart(2, "0")).join("").toUpperCase();
  const vname = id => { const v = vars.find(x => x.id === id); return v ? `${cols.find(c => c.id === v.variableCollectionId).name}/${v.name}` : `?${id}`; };
  const val = x => x && x.type === "VARIABLE_ALIAS" ? "→ " + vname(x.id) : x && typeof x === "object" && "r" in x ? hex(x) : x;
  return {
    collections: cols.map(c => ({ name: c.name, modes: c.modes.map(m => m.name) })),
    variables: vars.map(v => { const c = cols.find(c => c.id === v.variableCollectionId);
      return { name: `${c.name}/${v.name}`, type: v.resolvedType, scopes: v.scopes, description: v.description, web: v.codeSyntax.WEB,
        values: Object.fromEntries(c.modes.filter(m => m.modeId in v.valuesByMode).map(m => [m.name, val(v.valuesByMode[m.modeId])])) }; }),
    textStyles: figma.styles.text.map(s => ({ name: s.name, font: s.fontName, size: s.fontSize, lineHeight: s.lineHeight, letterSpacing: s.letterSpacing, textCase: s.textCase, description: s.description })),
    gridStyles: figma.styles.grid.map(s => ({ name: s.name, grids: s.layoutGrids, description: s.description })),
    effectStyles: figma.styles.effect.map(s => ({ name: s.name, effects: s.effects, description: s.description })),
    page: figma.currentPage.children.map(n => n.name)
  };
}
