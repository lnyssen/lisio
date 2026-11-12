// Outil de mesure, hors suite : node tests/perf-chargement.cjs index.html 5
// Donne la médiane de FCP, DOMContentLoaded, chargement et temps de script (ms), HTML servi en gzip.
// Mesure de chargement : HTML servi en gzip, réseau « 4G lente » et processeur ralenti 4× (téléphone moyen).
const http = require("http"), zlib = require("zlib"), fs = require("fs");
const { chromium } = require("playwright") ;
const file = process.argv[2], runs = +(process.argv[3] || 3);
const gz = zlib.gzipSync(fs.readFileSync(file), { level: 9 });
const srv = http.createServer((q, r) => { if (q.url === "/" || q.url.startsWith("/?") || q.url.startsWith("/#")) { r.writeHead(200, { "content-type": "text/html; charset=utf-8", "content-encoding": "gzip" }); r.end(gz); } else { r.writeHead(404); r.end(); } }).listen(0);
(async () => {
  const port = srv.address().port, b = await chromium.launch(), out = [];
  for (let i = 0; i < runs; i++) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); await ctx.route(/fonts\.(googleapis|gstatic)|jsdelivr/, r => r.abort());
    const p = await ctx.newPage(), cdp = await ctx.newCDPSession(p);
    await cdp.send("Network.enable"); await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 }); await cdp.send("Performance.enable");
    await p.addInitScript(() => { try { localStorage.setItem("lisio-home", "off"); localStorage.setItem("lisio-welcome", "1"); } catch (e) {} });
    const t0 = Date.now(); await p.goto(`http://127.0.0.1:${port}/`, { waitUntil: "load" }); const load = Date.now() - t0;
    await p.waitForTimeout(1500);
    const nav = await p.evaluate(() => { const n = performance.getEntriesByType("navigation")[0], fcp = performance.getEntriesByName("first-contentful-paint")[0]; let lt = 0; return { dcl: Math.round(n.domContentLoadedEventEnd), fcp: fcp ? Math.round(fcp.startTime) : null, size: n.encodedBodySize }; });
    const m = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map(x => [x.name, x.value]));
    out.push({ ...nav, load, script: Math.round(m.ScriptDuration * 1000), task: Math.round(m.TaskDuration * 1000), layout: Math.round(m.LayoutDuration * 1000) });
    await ctx.close();
  }
  await b.close(); srv.close();
  const med = k => out.map(o => o[k]).sort((a, b) => a - b)[Math.floor(out.length / 2)];
  console.log(JSON.stringify({ file, gz: gz.length, fcp: med("fcp"), dcl: med("dcl"), load: med("load"), script: med("script"), task: med("task"), layout: med("layout") }));
})();
