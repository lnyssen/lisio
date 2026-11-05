"""Pages publiques du site : /guide (guide de formation) et /slides (formation en diapositives).
Sources : src/docs/guide.html (export du guide) et src/docs/slides/*.html dans l’ordre de src/docs/slides.json.
"""
import json, pathlib, re, html as H

root = pathlib.Path(__file__).resolve().parent.parent
src = root / "src/docs"
FONTS = ""
GF = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&display=swap">'
ICON = (root / "src/head.html").read_text()
ICON = re.search(r'<link rel="icon"[^>]*>', ICON).group(0)
LOGO = '<svg viewBox="0 0 32 32" aria-hidden="true" width="32" height="32"><rect width="32" height="32" rx="9" fill="var(--primary)"/><circle cx="16" cy="9.6" r="4.4" fill="none" stroke="var(--primary-ink)" stroke-width="1.8"/><path d="M16 5.2a4.4 4.4 0 0 1 0 8.8z" fill="var(--accent)"/><rect x="13.2" y="16.2" width="5.6" height="10.6" rx="2.8" fill="var(--primary-ink)"/></svg>'

BASE_CSS = FONTS + """
:root{--bg:#EEF3F2;--surface:#FFFFFF;--ink:#0B2B2C;--muted:#4F6766;--hair:#D3E0DE;--primary:#0B3C3D;--primary-ink:#FFFFFF;--accent:#FF6A13;--hover:#E2ECEA;--focus:#0B3C3D;color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#061415;--surface:#0D2324;--ink:#E6F2F0;--muted:#93B3B0;--hair:#1F4546;--primary:#2DD4BF;--primary-ink:#04201E;--accent:#FF7A1A;--hover:#132E2F;--focus:#E6F2F0;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#061415;--surface:#0D2324;--ink:#E6F2F0;--muted:#93B3B0;--hair:#1F4546;--primary:#2DD4BF;--primary-ink:#04201E;--accent:#FF7A1A;--hover:#132E2F;--focus:#E6F2F0;color-scheme:dark}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font-family:"Instrument Sans","Helvetica Neue",system-ui,sans-serif;font-size:17px;line-height:1.6;font-weight:400}
a{color:inherit;text-decoration-thickness:1px;text-underline-offset:3px}a:hover{text-decoration-thickness:2px}
:focus-visible{outline:2px solid var(--focus);outline-offset:2px;border-radius:4px}
.skip{position:absolute;left:16px;top:-60px;background:var(--primary);color:var(--primary-ink);padding:10px 14px;border-radius:10px;font-weight:600;z-index:10}.skip:focus{top:12px}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.top{display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:14px clamp(16px,3vw,40px);border-bottom:1px solid var(--hair);background:var(--bg)}
.brand{display:inline-flex;align-items:center;gap:10px;font-weight:700;font-size:20px;text-decoration:none;letter-spacing:-.01em;min-height:44px}
.top nav{display:flex;gap:4px;margin-left:auto;flex-wrap:wrap}
.top nav a{display:inline-flex;align-items:center;min-height:40px;padding:0 14px;border-radius:999px;text-decoration:none;font-weight:600;font-size:15px}
.top nav a:hover{background:var(--hover)}.top nav a[aria-current="page"]{background:var(--primary);color:var(--primary-ink)}
.foot{border-top:1px solid var(--hair);padding:20px clamp(16px,3vw,40px);color:var(--muted);font-size:14px;display:flex;gap:8px 24px;flex-wrap:wrap}
"""

def shell(title, desc, current, body, css="", js=""):
    cur = ' aria-current="page"'
    nav = "".join(f'<a href="{u}"{cur if k == current else ""}>{l}</a>' for k, u, l in (("app", "/", "Ouvrir Lisio"), ("guide", "/guide", "Guide"), ("slides", "/slides", "Slides")))
    return f"""<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{H.escape(title)}</title>
<meta name="description" content="{H.escape(desc)}">
{GF}
{ICON}
<script>try{{var t=localStorage.getItem("lisio-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}}catch(e){{}}</script>
<style>{BASE_CSS}{css}</style>
</head>
<body>
<a class="skip" href="#main">Aller au contenu</a>
<header class="top"><a class="brand" href="/">{LOGO}<span>lisio</span><span class="sr-only">, retour à l’outil</span></a><nav aria-label="Pages">{nav}</nav></header>
{body}
<footer class="foot"><p style="margin:0"><b>Lisio</b> · contrastes WCAG 2.2 et design system accessible</p><p style="margin:0"><a href="https://www.w3.org/TR/WCAG22/">WCAG 2.2 (W3C)</a></p></footer>
{js}
</body>
</html>
"""

# ---------- Guide ----------
GUIDE_CSS = """
.doc{max-width:46rem;margin:0 auto;padding:clamp(24px,5vw,56px) clamp(16px,4vw,32px) 64px}
.doc h1{font-size:clamp(32px,5vw,46px);line-height:1.1;letter-spacing:-.02em;margin:0 0 8px;font-weight:700}
.doc .meta{color:var(--muted);margin:0 0 32px}
.doc h2{font-size:clamp(24px,3.2vw,30px);line-height:1.2;letter-spacing:-.01em;margin:56px 0 12px;font-weight:700;scroll-margin-top:16px}
.doc h3{font-size:20px;line-height:1.3;margin:32px 0 8px;font-weight:700;scroll-margin-top:16px}
.doc p,.doc li{max-width:70ch}.doc p{margin:0 0 14px}
.doc ul,.doc ol{padding-left:1.3em;margin:0 0 16px}.doc li p{margin:0 0 6px}
.doc strong{font-weight:600}
.doc code{font-family:"JetBrains Mono",ui-monospace,Menlo,monospace;font-size:.88em;background:var(--surface);border:1px solid var(--hair);border-radius:6px;padding:1px 5px}
.tw{overflow-x:auto;margin:8px 0 24px;border:1px solid var(--hair);border-radius:14px;background:var(--surface)}
.tw:focus-visible{outline-offset:4px}
.doc table{border-collapse:collapse;width:100%;font-size:15px;line-height:1.5}
.doc th,.doc td{text-align:left;vertical-align:top;padding:10px 14px;border-bottom:1px solid var(--hair)}
.doc tr:last-child td{border-bottom:0}.doc th{font-weight:700;background:var(--bg)}
.toc{background:var(--surface);border:1px solid var(--hair);border-radius:14px;padding:16px 20px;margin:0 0 8px}
.toc h2{font-size:15px;margin:0 0 6px;letter-spacing:0;text-transform:none}
.toc ol{margin:0;padding-left:1.3em;columns:2 16rem;column-gap:32px}.toc li{margin:2px 0;break-inside:avoid}
.cta{display:flex;gap:12px;flex-wrap:wrap;margin:0 0 32px}
.btn{display:inline-flex;align-items:center;min-height:44px;padding:0 18px;border-radius:999px;font-weight:600;text-decoration:none;border:1.5px solid var(--ink)}
.btn.p{background:var(--primary);color:var(--primary-ink);border-color:var(--primary)}
@media print{.top,.foot,.skip,.cta,.toc{display:none}body{background:#fff;color:#000}.tw{border:0}}
"""

def guide():
    g = (src / "guide.html").read_text()
    def tw(m):
        ths = re.findall(r"<th>(.*?)</th>", m.group(1))
        return f'<div class="tw" role="region" tabindex="0" aria-label="Tableau : {H.escape(", ".join(re.sub("<[^>]+>", "", t) for t in ths))}"><table>{m.group(1)}'
    g = re.sub(r"<table>(.*?</thead>)", tw, g, flags=re.S)
    g = g.replace("</table>", "</table></div>")
    g = re.sub(r'<a href="(https?://[^"]+)">', r'<a href="\1" rel="noopener">', g)
    heads = re.findall(r'<h2 id="([^"]+)">(.*?)</h2>', g)
    toc = '<nav class="toc" aria-labelledby="tocH"><h2 id="tocH">Sommaire</h2><ol>' + "".join(f'<li><a href="#{i}">{t}</a></li>' for i, t in heads) + "</ol></nav>"
    cta = '<p class="cta"><a class="btn p" href="/slides">Voir les slides de la formation</a><a class="btn" href="/#formation">S’entraîner : 10 questions</a></p>'
    i = g.index("</p>", g.index('class="meta"')) + 4
    body = f'<main id="main" class="doc">{g[:i]}{cta}{toc}{g[i:]}</main>'
    return shell("Guide de formation · Lisio", "Lisio, guide de formation : contrastes WCAG, nuances, rôles, design system, Figma et code.", "guide", body, GUIDE_CSS)

# ---------- Slides ----------
SLIDES_CSS = """
.deck{max-width:1320px;margin:0 auto;padding:clamp(16px,3vw,32px) clamp(12px,3vw,32px) 48px;display:flex;flex-direction:column;gap:16px}
.deck h1{font-size:clamp(26px,3.6vw,36px);line-height:1.15;margin:0;letter-spacing:-.01em}
.deck .lead{margin:0;color:var(--muted)}
.bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.bar button,.bar a.b{font:inherit;font-weight:600;font-size:15px;min-height:44px;padding:0 16px;border-radius:999px;border:1.5px solid var(--ink);background:var(--surface);color:var(--ink);cursor:pointer;display:inline-flex;align-items:center;gap:6px;text-decoration:none}
.bar button:hover{background:var(--hover)}.bar button:disabled{opacity:.55;cursor:default}
.bar button[aria-pressed="true"]{background:var(--primary);color:var(--primary-ink);border-color:var(--primary)}
.bar .n{font-variant-numeric:tabular-nums;font-weight:600;min-width:5.5em;text-align:center}
.bar .sp{flex:1}
.bar select{font:inherit;font-size:15px;min-height:44px;max-width:100%;border-radius:10px;border:1.5px solid var(--muted);background:var(--surface);color:var(--ink);padding:0 10px}
.stage{position:relative;width:100%;aspect-ratio:16/9;border-radius:14px;overflow:hidden;background:#0B3C3D;box-shadow:0 1px 2px rgba(11,43,44,.08),0 12px 32px rgba(11,43,44,.14)}
.stage:fullscreen{border-radius:0;background:#000;display:grid;place-items:center}
.slide{position:absolute;left:0;top:0;width:1920px;height:1080px;overflow:hidden;transform-origin:0 0;box-sizing:border-box}
.slide[hidden]{display:none!important}
.slide *{margin:0;box-sizing:border-box}.slide a{color:inherit;text-decoration:underline}
.slide aside{display:none}
.slide table{border-collapse:collapse}
.notes{background:var(--surface);border:1px solid var(--hair);border-radius:14px;padding:16px 20px}
.notes h2{font-size:15px;margin:0 0 6px}.notes p{margin:0;max-width:75ch}
.all .slide{position:relative}
.allwrap{display:flex;flex-direction:column;gap:24px}
.allwrap .stage{box-shadow:none;border:1px solid var(--hair)}
@media print{.top,.foot,.skip,.bar,.deck>h1,.deck .lead,.notes{display:none}.deck{padding:0;max-width:none}.stage{break-after:page;border-radius:0;box-shadow:none}}
"""

SLIDES_JS = r"""<script>
(function(){
const stage=document.getElementById("stage"),slides=[...stage.querySelectorAll(".slide")],N=slides.length;
const prev=document.getElementById("prev"),next=document.getElementById("next"),cnt=document.getElementById("cnt"),pick=document.getElementById("pick"),notesB=document.getElementById("notesB"),notes=document.getElementById("notes"),notesP=document.getElementById("notesP"),fsB=document.getElementById("fsB"),live=document.getElementById("live");
let i=0,showNotes=false;try{showNotes=localStorage.getItem("lisio-slide-notes")==="1"}catch(e){}
function fit(){const r=stage.getBoundingClientRect(),s=Math.min(r.width/1920,r.height/1080),dx=(r.width-1920*s)/2,dy=(r.height-1080*s)/2;slides.forEach(el=>{el.style.transform=`translate(${dx}px,${dy}px) scale(${s})`});}
function go(k,announce){i=Math.max(0,Math.min(N-1,k));slides.forEach((el,j)=>{el.hidden=j!==i});prev.disabled=i===0;next.disabled=i===N-1;cnt.textContent=`${i+1} / ${N}`;pick.value=String(i);
 const a=slides[i].querySelector("aside");notesP.textContent=a?a.textContent:"Pas de note pour cette diapositive.";notes.hidden=!showNotes;notesB.setAttribute("aria-pressed",String(showNotes));
 if(announce)live.textContent=`Diapositive ${i+1} sur ${N} : ${slides[i].getAttribute("aria-label").replace(/^\d+ sur \d+ : /,"")}`;
 history.replaceState(null,"","#"+(i+1));}
prev.addEventListener("click",()=>go(i-1,true));next.addEventListener("click",()=>go(i+1,true));
pick.addEventListener("change",()=>go(+pick.value,true));
notesB.addEventListener("click",()=>{showNotes=!showNotes;try{localStorage.setItem("lisio-slide-notes",showNotes?"1":"0")}catch(e){}go(i)});
if(stage.requestFullscreen){fsB.addEventListener("click",()=>{document.fullscreenElement?document.exitFullscreen():stage.requestFullscreen()});document.addEventListener("fullscreenchange",()=>{fsB.setAttribute("aria-pressed",String(!!document.fullscreenElement));requestAnimationFrame(fit)})}else fsB.hidden=true;
document.addEventListener("keydown",e=>{if(e.altKey||e.ctrlKey||e.metaKey)return;const t=e.target;if(t.closest&&t.closest("select,input,textarea"))return;
 if(e.key==="ArrowRight"||e.key==="PageDown"||(e.key===" "&&document.fullscreenElement)){e.preventDefault();go(i+1,true)}else if(e.key==="ArrowLeft"||e.key==="PageUp"){e.preventDefault();go(i-1,true)}else if(e.key==="Home"&&!t.closest("a,button")){go(0,true)}else if(e.key==="End"&&!t.closest("a,button")){go(N-1,true)}});
new ResizeObserver(fit).observe(stage);
const h=parseInt(location.hash.slice(1),10);go(h>=1&&h<=N?h-1:0);fit();
})();
</script>"""

def slides():
    cfg = json.loads((src / "slides.json").read_text())
    order, N, out, opts = cfg["order"], len(cfg["order"]), [], []
    for n, sid in enumerate(order, 1):
        s = (src / "slides" / f"{sid}.html").read_text().strip()
        s = s.replace("<h1", "<h2").replace("</h1>", "</h2>")
        t = re.search(r"<h2[^>]*>(.*?)</h2>", s, re.S)
        title = re.sub(r"<[^>]+>", " ", t.group(1)) if t else sid
        title = re.sub(r"\s+", " ", title).strip()
        s = re.sub(r"^<section ", f'<section class="slide" role="group" aria-roledescription="diapositive" aria-label="{n} sur {N} : {H.escape(title)}" ', s, 1)
        s = re.sub(r'<a href="(https?://[^"]+)">', r'<a href="\1" rel="noopener">', s)
        out.append(s); opts.append(f'<option value="{n-1}">{n}. {H.escape(title)}</option>')
    body = f"""<main id="main" class="deck">
<h1>{H.escape(cfg["title"])} : les slides</h1>
<p class="lead">{N} diapositives, une heure de formation dont quinze minutes d’exercice. Flèches gauche et droite pour avancer, Notes pour le texte de l’animateur. Le détail de chaque slide est dans le <a href="/guide">guide de formation</a>.</p>
<div class="bar" role="group" aria-label="Navigation dans les slides">
<button type="button" id="prev"><span aria-hidden="true">←</span> Précédente</button><span class="n" id="cnt" aria-hidden="true">1 / {N}</span><button type="button" id="next">Suivante <span aria-hidden="true">→</span></button>
<label class="sr-only" for="pick">Aller à la diapositive</label><select id="pick">{"".join(opts)}</select>
<span class="sp"></span><button type="button" id="notesB" aria-pressed="false" aria-controls="notes">Notes</button><button type="button" id="fsB" aria-pressed="false">Plein écran</button>
</div>
<p class="sr-only" id="live" aria-live="polite"></p>
<div class="stage" id="stage">
{chr(10).join(out)}
</div>
<section class="notes" id="notes" aria-labelledby="notesH" hidden><h2 id="notesH">Notes de l’animateur</h2><p id="notesP"></p></section>
</main>"""
    fonts = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400..800&family=JetBrains+Mono:wght@400;600&display=swap">'
    page = shell(f'{cfg["title"]} : slides · Lisio', "Lisio, formation en diapositives : contrastes, nuances, rôles, Figma et code.", "slides", body, SLIDES_CSS, SLIDES_JS)
    return page.replace("</head>", fonts + "\n</head>", 1)

def build():
    (root / "guide.html").write_text(guide())
    (root / "slides.html").write_text(slides())

if __name__ == "__main__":
    build()
