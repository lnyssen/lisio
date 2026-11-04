figma.showUI(__html__, { width: 380, height: 520, themeColors: true, title: "Lisio : importer le design system" });
figma.ui.onmessage = async msg => {
  if (msg.type !== "import") return;
  try {
    const report = await lisioImport(msg.data, { board: msg.board });
    if (report.board) { const n = await figma.getNodeByIdAsync(report.board); if (n) figma.viewport.scrollAndZoomIntoView([n]); }
    figma.notify(`Lisio : ${report.variables} variables et ${report.styles} styles de texte importés`);
    figma.ui.postMessage({ type: "done", report });
  } catch (e) { figma.ui.postMessage({ type: "error", message: e && e.message ? e.message : String(e) }); }
};
