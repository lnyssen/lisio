figma.showUI(__html__, { width: 380, height: 560, themeColors: true, title: "Lisio : importer et vérifier" });
figma.ui.onmessage = async msg => {
  if (msg.type === "import") {
    try {
      const report = await lisioImport(msg.data, { board: msg.board });
      if (report.board) { const n = await figma.getNodeByIdAsync(report.board); if (n) figma.viewport.scrollAndZoomIntoView([n]); }
      figma.notify(`Lisio : ${report.variables} variables et ${report.styles} styles de texte importés`);
      figma.ui.postMessage({ type: "done", report });
    } catch (e) { figma.ui.postMessage({ type: "error", message: e && e.message ? e.message : String(e) }); }
  }
  if (msg.type === "audit") {
    try { figma.ui.postMessage({ type: "audit", result: lisioAudit({ level: msg.level }) }); }
    catch (e) { figma.ui.postMessage({ type: "error", message: e && e.message ? e.message : String(e) }); }
  }
  if (msg.type === "select") {
    const n = await figma.getNodeByIdAsync(msg.id);
    if (n) { figma.currentPage.selection = [n]; figma.viewport.scrollAndZoomIntoView([n]); }
  }
};
