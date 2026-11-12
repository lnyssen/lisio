// Lisio, « vérifie cette page » : un favori (bookmarklet) qui mesure les vraies paires texte et fond d’une page en ligne
// et signale les couleurs qui sortent de la palette du projet. Rien ne quitte la page : aucun serveur, aucun envoi.
// lisioPageCheck est sérialisée telle quelle (toString) dans le favori : elle ne doit dépendre de rien d’extérieur.
// Testée par tests/e2e/pagecheck.mjs sur une page d’essai.

export function lisioPageCheck(cfg) {
  const ID = "lisio-pagecheck";
  const old = document.getElementById(ID); if (old) { old.remove(); return; } // deuxième clic : referme
  const need = cfg.level === "AAA" ? [7, 4.5] : [4.5, 3];
  const cv = document.createElement("canvas"); cv.width = cv.height = 1; const cx = cv.getContext("2d", { willReadFrequently: true });
  const cache = new Map();
  const rgba = c => { // toute couleur CSS calculée (rgb, oklch, color()) vers [r, g, b, a] de 0 à 255 / 0 à 1
    if (cache.has(c)) return cache.get(c);
    let v = [0, 0, 0, 0];
    if (c && c !== "transparent") { cx.clearRect(0, 0, 1, 1); cx.fillStyle = "#000"; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; v = [d[0], d[1], d[2], d[3] / 255]; }
    cache.set(c, v); return v;
  };
  const over = (top, under) => [0, 1, 2].map(i => top[i] * top[3] + under[i] * (1 - top[3])).concat(1);
  const hex = c => "#" + c.slice(0, 3).map(v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("").toUpperCase();
  const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = c => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const ratio = (a, b) => { const A = lum(a), B = lum(b); return (Math.max(A, B) + 0.05) / (Math.min(A, B) + 0.05); };
  // Fond réel derrière un élément : on remonte les ancêtres jusqu’à un fond opaque. Image ou dégradé = à vérifier.
  const bgOf = el => {
    const layers = []; let img = false;
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage && cs.backgroundImage !== "none") img = true;
      const b = rgba(cs.backgroundColor); if (b[3] > 0) { layers.push(b); if (b[3] >= 1) break; }
    }
    let c = [255, 255, 255, 1]; for (let i = layers.length - 1; i >= 0; i--) c = over(layers[i], c);
    return { c, img };
  };
  const visible = el => { const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; const cs = getComputedStyle(el); return cs.visibility !== "hidden" && cs.display !== "none" && +cs.opacity > 0.05; };
  const pal = new Set((cfg.palette || []).map(h => h.toUpperCase()));
  const near = h => { if (!pal.size || pal.has(h)) return true; const p = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); for (const q of pal) { const v = [1, 3, 5].map(i => parseInt(q.slice(i, i + 2), 16)); if (Math.abs(p[0] - v[0]) + Math.abs(p[1] - v[1]) + Math.abs(p[2] - v[2]) <= 6) return true; } return false; };
  // Textes visibles
  const seen = new Set(), pairs = new Map(), used = new Map(); let tested = 0, todo = 0;
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: n => n.nodeValue.trim().length > 1 ? 1 : 2 });
  for (let n = tw.nextNode(); n && seen.size < 4000; n = tw.nextNode()) {
    const el = n.parentElement; if (!el || seen.has(el) || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|OPTION)$/.test(el.tagName)) continue;
    seen.add(el); if (!visible(el)) continue;
    const cs = getComputedStyle(el), fgRaw = rgba(cs.color), bg = bgOf(el), fg = fgRaw[3] < 1 ? over(fgRaw, bg.c) : fgRaw;
    const size = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700, large = size >= 24 || (bold && size >= 18.66);
    const r = ratio(fg, bg.c), min = need[large ? 1 : 0], fh = hex(fg), bh = hex(bg.c);
    used.set(fh, (used.get(fh) || 0) + 1); used.set(bh, (used.get(bh) || 0) + 1);
    tested++; if (bg.img) todo++;
    const key = fh + bh + (large ? "L" : "") + (bg.img ? "I" : "");
    const p = pairs.get(key) || { fh, bh, r, min, large, img: bg.img, els: [] }; p.els.push(el); pairs.set(key, p);
  }
  const all = [...pairs.values()], fails = all.filter(p => !p.img && p.r < p.min).sort((a, b) => a.r - b.r), check = all.filter(p => p.img);
  const offPal = [...used.entries()].filter(([h]) => !near(h)).sort((a, b) => b[1] - a[1]);
  const result = { tested, pairs: all.length, fails: fails.map(p => ({ fg: p.fh, bg: p.bh, ratio: Math.floor(p.r * 100) / 100, min: p.min, large: p.large, count: p.els.length })), check: check.length, offPalette: offPal.map(([h, n]) => ({ hex: h, count: n })) };
  window.__lisioPageCheck = result;
  // Panneau (Shadow DOM : le style de la page ne le touche pas, et il ne touche pas la page)
  const host = document.createElement("div"); host.id = ID; host.style.cssText = "all:initial;position:fixed;z-index:2147483647;top:12px;right:12px;";
  const sh = host.attachShadow({ mode: "open" });
  const f2 = v => v.toFixed(2).replace(".", ",");
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const sw = h => `<span class="sw" style="background:${h}"></span>`;
  sh.innerHTML = `<style>
:host{all:initial}
.p{box-sizing:border-box;width:min(380px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto;background:#fff;color:#111;border:2px solid #111;font:14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;box-shadow:0 12px 32px rgba(0,0,0,.25)}
@media (prefers-reduced-motion:no-preference){.p{animation:in .28s cubic-bezier(.2,.8,.2,1)}@keyframes in{from{opacity:0;transform:translateX(24px)}}}
.h{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:12px 14px;background:#111;color:#fff;position:sticky;top:0}
.h b{font-size:15px}
button{font:inherit;cursor:pointer;border:2px solid #111;background:#fff;color:#111;min-height:32px;padding:2px 10px}
.h button{border-color:#fff;background:#111;color:#fff}
button:focus-visible{outline:3px solid #0B57D0;outline-offset:2px}
.s{padding:12px 14px;border-bottom:1px solid #ddd}
.k{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:0}
.k div{border:1px solid #ccc;padding:6px 8px}.k dt{font-size:12px;color:#444}.k dd{margin:0;font-size:20px;font-weight:700}
h3{font-size:13px;letter-spacing:.04em;text-transform:uppercase;margin:0 0 8px}
ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
li{display:flex;align-items:center;gap:8px}
.sw{width:18px;height:18px;flex:none;box-shadow:inset 0 0 0 1px rgba(0,0,0,.25)}
.m{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px}
.bad{color:#9B1C1C;font-weight:700}
.g{flex:1;min-width:0}
.n{font-size:12px;color:#444}
</style>
<div class="p" role="dialog" aria-label="Lisio : vérification de cette page" tabindex="-1">
<div class="h"><b>Lisio · cette page</b><button type="button" data-x aria-label="Fermer">Fermer</button></div>
<div class="s"><dl class="k"><div><dt>Textes testés</dt><dd>${tested}</dd></div><div><dt>Paires en échec</dt><dd class="${fails.length ? "bad" : ""}">${fails.length}</dd></div><div><dt>Hors palette</dt><dd>${pal.size ? offPal.length : "–"}</dd></div></dl>
<p class="n">Niveau ${cfg.level === "AAA" ? "AAA" : "AA"} · ${need[0]}:1 texte courant, ${need[1]}:1 grand texte (critère 1.4.3${cfg.level === "AAA" ? " et 1.4.6" : ""}). Test automatique partiel : il ne remplace pas un audit.</p></div>
<div class="s"><h3>À corriger</h3>${fails.length ? `<ul>${fails.slice(0, 40).map((p, i) => `<li>${sw(p.fh)}${sw(p.bh)}<span class="g"><span class="bad">${f2(Math.floor(p.r * 100) / 100)}:1</span> <span class="n">/ ${p.min}:1${p.large ? ", grand texte" : ""}</span><br><span class="m">${p.fh} sur ${p.bh}</span> <span class="n">· ${p.els.length} texte${p.els.length > 1 ? "s" : ""}</span></span><button type="button" data-f="${i}">Montrer</button></li>`).join("")}</ul>` : `<p>Aucune paire texte et fond uni sous le seuil.</p>`}</div>
${check.length ? `<div class="s"><h3>À vérifier à l’œil</h3><p class="n">${check.length} paire${check.length > 1 ? "s" : ""} sur une image ou un dégradé : Lisio ne peut pas mesurer ce fond.</p><ul>${check.slice(0, 20).map((p, i) => `<li>${sw(p.fh)}<span class="g m">${p.fh} · ${p.els.length} texte${p.els.length > 1 ? "s" : ""}</span><button type="button" data-c="${i}">Montrer</button></li>`).join("")}</ul></div>` : ""}
${pal.size ? `<div class="s"><h3>Hors palette ${esc(cfg.name ? "« " + cfg.name + " »" : "")}</h3>${offPal.length ? `<ul>${offPal.slice(0, 24).map(([h, n]) => `<li>${sw(h)}<span class="g m">${h}</span><span class="n">${n} usage${n > 1 ? "s" : ""}</span></li>`).join("")}</ul>` : `<p>Toutes les couleurs de texte et de fond viennent de la palette.</p>`}</div>` : ""}
</div>`;
  document.documentElement.appendChild(host);
  const panel = sh.querySelector(".p"); panel.focus();
  const show = els => { const el = els[0]; el.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" }); els.slice(0, 50).forEach(e => { const o = e.style.outline, oo = e.style.outlineOffset; e.style.outline = "3px solid #E11D48"; e.style.outlineOffset = "2px"; setTimeout(() => { e.style.outline = o; e.style.outlineOffset = oo; }, 2400); }); };
  sh.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; if (b.hasAttribute("data-x")) host.remove(); else if (b.dataset.f) show(fails[+b.dataset.f].els); else if (b.dataset.c) show(check[+b.dataset.c].els); });
  sh.addEventListener("keydown", e => { if (e.key === "Escape") host.remove(); });
  return result;
}

// Lien du favori pour un projet : palette (toutes les nuances et les rôles) et niveau visé, figés au moment de la copie.
export function pageCheckBookmarklet(cfg) {
  const conf = { level: cfg.level === "AAA" ? "AAA" : "AA", name: String(cfg.name || "").slice(0, 40), palette: [...new Set((cfg.palette || []).map(h => String(h).toUpperCase()))] };
  return "javascript:" + encodeURIComponent(`(${lisioPageCheck.toString()})(${JSON.stringify(conf)});void 0`);
}
