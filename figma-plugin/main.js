figma.showUI(__html__, { width: 400, height: 600, themeColors: true, title: "Lisio : importer et vérifier" });
const lisioErr = e => figma.ui.postMessage({ type: "error", message: e && e.message ? e.message : String(e) });
let lisioLast = null;
async function lisioRunAudit(level) { lisioLast = await lisioAudit({ level }); figma.ui.postMessage({ type: "audit", result: lisioLast }); }
figma.ui.onmessage = async msg => {
  if (msg.type === "import") {
    try {
      const report = await lisioImport(msg.data, { board: msg.board });
      if (msg.components) { const c = await lisioComponents(); report.components = c.skipped ? "skipped" : c.components; }
      else if (report.board) { const n = await figma.getNodeByIdAsync(report.board); if (n) figma.viewport.scrollAndZoomIntoView([n]); }
      figma.notify(`Lisio : ${report.variables} variables et ${report.styles} styles de texte importés`);
      figma.ui.postMessage({ type: "done", report });
    } catch (e) { lisioErr(e); }
  }
  if (msg.type === "components") {
    try { const c = await lisioComponents(); figma.ui.postMessage({ type: "components", result: c }); } catch (e) { lisioErr(e); }
  }
  if (msg.type === "audit") { try { await lisioRunAudit(msg.level); } catch (e) { lisioErr(e); } }
  if (msg.type === "fix" || msg.type === "fixAll") {
    try {
      const items = (lisioLast ? lisioLast.items : []).filter(x => !x.ok && x.fix && (msg.type === "fixAll" || x.id === msg.id));
      let n = 0;
      for (const x of items) if (await lisioApplyFix(x.id, x.fix)) { n++; x.ok = true; x.fixed = x.fix.name; x.fg = x.fix.hex; x.ratio = Math.floor(lisioRatio(lisioHex(x.fix.hex), lisioHex(x.bg)) * 100) / 100; }
      lisioLast.fails = Math.max(0, lisioLast.fails - n); lisioLast.fixedNow = n;
      figma.notify(`Lisio : ${n} texte${n > 1 ? "s" : ""} corrigé${n > 1 ? "s" : ""}`);
      figma.ui.postMessage({ type: "audit", result: lisioLast });
    } catch (e) { lisioErr(e); }
  }
  if (msg.type === "select") {
    const n = await figma.getNodeByIdAsync(msg.id);
    if (n) { figma.currentPage.selection = [n]; figma.viewport.scrollAndZoomIntoView([n]); }
  }
};
