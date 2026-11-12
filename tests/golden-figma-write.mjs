// Réécrit tests/golden/figma-import.json (à lancer seulement si le changement est voulu, comme golden.mjs --write).
//   node tests/golden-figma-write.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { makeFigma, loadPlugin, dsJson, snapshot, ROOT } from "./figma-mock.mjs";
const F = join(ROOT, "tests", "golden", "figma-import.json"), gold = JSON.parse(readFileSync(F, "utf8")), out = {};
for (const key of Object.keys(gold)) {
  const [name, board, fam] = key.split("/"), figma = makeFigma(fam ? { families: ["Inter", fam] } : {}), p = loadPlugin(figma);
  const r = await p.get("lisioImport")(dsJson(name), { board: board === "planche" });
  out[key] = JSON.parse(JSON.stringify({ report: { variables: r.variables, created: r.created, updated: r.updated, styles: r.styles, warnings: r.warnings }, ...snapshot(figma), nodes: figma.nodes.size }));
}
writeFileSync(F, JSON.stringify(out, null, 1) + "\n"); console.log("figma-import.json réécrit :", Object.keys(out).join(", "));
