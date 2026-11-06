// F13 (P2) : bibliothèque de composants. Un seul registre : chaque composant dit à quoi il sert, quels tokens il utilise,
// ses états (HTML qui n'utilise que les classes du CSS exporté), ce que Lisio mesure (check : rôles) et ce qui reste
// à vérifier à la main (manual). Ajouter un composant = ajouter une entrée ici ; la page et le décompte suivent.
export const COMP_STATE_FR = { default: "Repos", hover: "Survol", focus: "Focus clavier", pressed: "Appuyé", disabled: "Désactivé", loading: "Chargement", error: "Erreur", success: "Succès", warning: "Alerte", info: "Information", current: "Page en cours", readonly: "Lecture seule", empty: "Vide" };
export const COMP_LIMITS = "Ces composants montrent vos tokens en situation. Les mesurer ne prouve pas qu’ils fonctionnent dans vos écrans : le clavier, le lecteur d’écran et le contexte restent à tester.";
const T = ' tabindex="-1"';
export const COMPONENTS = [
  { id: "button", name: "Bouton", use: "Lancer une action. Une seule action principale par écran.", tokens: ["action/default", "text/on-action", "action/hover", "action/pressed", "focus/ring", "disabled/text", "disabled/surface"],
    states: [
      { s: "default", html: `<button class="btn btn-primary t-button" type="button">Envoyer</button>`, check: ["action/default"] },
      { s: "hover", html: `<button class="btn btn-primary t-button is-hover" type="button"${T}>Envoyer</button>`, check: ["action/hover"] },
      { s: "pressed", html: `<button class="btn btn-primary t-button is-active" type="button"${T}>Envoyer</button>`, check: ["action/pressed"] },
      { s: "focus", html: `<button class="btn btn-primary t-button is-focus" type="button"${T}>Envoyer</button>`, check: ["focus/ring"], manual: "Le contour apparaît sur chaque bouton de vos écrans (2.4.7)." },
      { s: "loading", html: `<button class="btn btn-primary t-button" type="button" aria-busy="true"${T}><span class="spin" aria-hidden="true"></span>Envoi…</button>`, manual: "Le libellé change et l’attente est annoncée (4.1.3)." },
      { s: "disabled", html: `<button class="btn btn-primary t-button" type="button" disabled>Envoyer</button>`, check: ["disabled/text"], manual: "La raison est dite à côté du bouton." }
    ], limits: "Lisio mesure le texte sur le fond du bouton dans chaque état ; il ne voit pas si vos boutons ont un nom clair." },
  { id: "field", name: "Champ de formulaire", use: "Saisir une information, avec une étiquette visible au-dessus.", tokens: ["border/default", "text/default", "background/default", "focus/ring", "error/border", "error/text", "success/border", "disabled/surface"],
    states: [
      { s: "default", html: `<div class="field"><label for="cmp-f1" class="t-body-strong">Code postal</label><input id="cmp-f1" type="text" inputmode="numeric" autocomplete="postal-code"></div>`, check: ["border/default"] },
      { s: "hover", html: `<div class="field"><label for="cmp-f2" class="t-body-strong">Code postal</label><input id="cmp-f2" type="text" class="is-hover"${T}></div>`, check: ["border/default"] },
      { s: "focus", html: `<div class="field"><label for="cmp-f3" class="t-body-strong">Code postal</label><input id="cmp-f3" type="text" class="is-focus"${T} value="7501"></div>`, check: ["focus/ring"] },
      { s: "error", html: `<div class="field"><label for="cmp-f4" class="t-body-strong">Code postal</label><input id="cmp-f4" type="text" value="750" aria-invalid="true" aria-describedby="cmp-f4e"><p id="cmp-f4e" class="field-error t-caption">5 chiffres attendus, par exemple 75011.</p></div>`, check: ["error/border"], manual: "L’erreur est dite en mots et reliée au champ (3.3.1)." },
      { s: "success", html: `<div class="field"><label for="cmp-f5" class="t-body-strong">Code postal</label><input id="cmp-f5" type="text" value="75011" aria-describedby="cmp-f5s"><p id="cmp-f5s" class="field-help t-caption">✓ Code postal reconnu : Paris 11e.</p></div>`, manual: "La confirmation est dite en mots, pas seulement par une bordure verte." },
      { s: "readonly", html: `<div class="field"><label for="cmp-f6" class="t-body-strong">Code postal</label><input id="cmp-f6" type="text" value="75011" readonly></div>`, check: ["border/default"] },
      { s: "disabled", html: `<div class="field"><label for="cmp-f7" class="t-body-strong">Code postal</label><input id="cmp-f7" type="text" value="75011" disabled></div>`, check: ["disabled/surface"], manual: "La raison est dite à côté du champ." }
    ], limits: "Lisio mesure la bordure du champ (3:1) ; il ne voit pas vos messages d’erreur ni l’ordre de vos champs." },
  { id: "link", name: "Lien", use: "Aller vers une autre page ou une autre partie de la page.", tokens: ["link/default", "background/default", "focus/ring"],
    states: [
      { s: "default", html: `<a href="#" class="t-link">Voir le dossier</a>`, check: ["link/default"] },
      { s: "hover", html: `<a href="#" class="t-link is-hover"${T}>Voir le dossier</a>`, check: ["link/default"] },
      { s: "focus", html: `<a href="#" class="t-link is-focus"${T}>Voir le dossier</a>`, check: ["focus/ring"] }
    ], limits: "Le soulignement distingue le lien du texte (1.4.1). Lisio ne voit pas si le texte du lien dit où il mène (2.4.4)." },
  { id: "alert", name: "Alerte", use: "Informer d’un résultat, d’un risque ou d’une erreur, avec un titre et une sortie.", tokens: ["info/text", "info/surface", "success/text", "success/surface", "warning/text", "warning/surface", "error/text", "error/surface"],
    states: [
      { s: "info", html: `<div class="alert alert-info" role="status"><p class="alert-title t-body-strong">Nouveau</p><p class="t-body">Vous pouvez suivre vos dossiers en temps réel.</p></div>`, check: ["info/text"] },
      { s: "success", html: `<div class="alert alert-success" role="status"><p class="alert-title t-body-strong">Dossier envoyé</p><p class="t-body">Réponse sous 5 jours ouvrés.</p></div>`, check: ["success/text"] },
      { s: "warning", html: `<div class="alert alert-warning" role="status"><p class="alert-title t-body-strong">Pièce manquante</p><p class="t-body">Ajoutez un justificatif de domicile.</p></div>`, check: ["warning/text"] },
      { s: "error", html: `<div class="alert alert-error" role="alert"><p class="alert-title t-body-strong">Envoi impossible</p><p class="t-body">Vérifiez votre connexion, puis réessayez.</p></div>`, check: ["error/text"], manual: "L’alerte d’erreur est annoncée sans déplacer le focus (4.1.3)." }
    ], limits: "Chaque alerte a une icône et un titre en mots. Lisio ne voit pas quand vos alertes apparaissent ni si elles disparaissent trop vite." },
  { id: "badge", name: "Badge de statut", use: "Donner l’état d’un élément dans une liste ou un tableau.", tokens: ["info/text", "info/surface", "success/text", "success/surface", "warning/text", "warning/surface"],
    states: [
      { s: "info", html: `<span class="tag t-label st-info">En cours</span>`, check: ["info/text"] },
      { s: "success", html: `<span class="tag t-label st-success">Validé</span>`, check: ["success/text"] },
      { s: "warning", html: `<span class="tag t-label st-warning">À compléter</span>`, check: ["warning/text"] }
    ], limits: "Le statut est un mot, la couleur ne fait que l’accompagner. Le CSS exporté n’a pas encore de badge d’erreur : utilisez une alerte." },
  { id: "nav", name: "Navigation", use: "Passer d’une page à l’autre ; la page en cours est marquée autrement que par la couleur.", tokens: ["text/default", "background/default", "focus/ring"],
    states: [
      { s: "default", html: `<nav class="cmp-nav" aria-label="Exemple de menu"><div class="tpl-nav"><a href="#">Accueil</a><a href="#">Démarches</a><a href="#">Contact</a></div></nav>`, check: ["text/default"] },
      { s: "current", html: `<nav class="cmp-nav" aria-label="Exemple de menu, page en cours"><div class="tpl-nav"><a href="#"${T}>Accueil</a><a href="#" aria-current="page"${T}>Démarches</a><a href="#"${T}>Contact</a></div></nav>`, check: ["text/default"], manual: "La page en cours est soulignée et en gras, et annoncée (aria-current)." },
      { s: "focus", html: `<nav class="cmp-nav" aria-label="Exemple de menu, focus"><div class="tpl-nav"><a href="#"${T}>Accueil</a><a href="#" class="is-focus"${T}>Démarches</a><a href="#"${T}>Contact</a></div></nav>`, check: ["focus/ring"], manual: "L’ordre du focus suit l’ordre de lecture (2.4.3)." }
    ], limits: "Lisio dessine un menu simple. Un menu déroulant ou mobile demande ses propres tests au clavier et au lecteur d’écran." },
  { id: "card", name: "Carte", use: "Regrouper un contenu et son action ; elle dit aussi quand elle charge ou quand elle est vide.", tokens: ["background/default", "background/subtle", "border/subtle", "text/default", "text/muted", "link/default"],
    states: [
      { s: "default", html: `<div class="tcard"><p class="t-body-strong">Carte de séjour</p><p class="t-body mut">Mis à jour le 3 novembre.</p><a href="#" class="t-link link-arrow">Ouvrir le dossier</a></div>`, check: ["text/default", "text/muted"] },
      { s: "loading", html: `<div class="tcard" aria-busy="true"><div class="skel" aria-hidden="true"><span style="width:60%"></span><span></span><span style="width:80%"></span></div><span class="sr-only">Chargement</span></div>`, manual: "Le chargement est annoncé aux lecteurs d’écran." },
      { s: "empty", html: `<div class="tcard"><p class="t-body-strong">Aucun dossier</p><p class="t-body mut">Créez votre premier dossier en deux minutes.</p><a href="#" class="t-link link-arrow">Créer un dossier</a></div>`, check: ["text/muted"] },
      { s: "error", html: `<div class="tcard"><p class="t-body-strong">Chargement impossible</p><p class="t-body">Vérifiez votre connexion.</p><p><button class="btn btn-secondary t-button" type="button">Réessayer</button></p></div>`, check: ["text/default"], manual: "L’erreur donne une cause et une sortie." }
    ], limits: "Le filet de la carte est décoratif : son contour n’est pas exigé. Si toute la carte est cliquable, testez-la au clavier." }
];
// measure(k) → "pass" | "fail" | "na" pour un rôle. Un état : en échec si une mesure échoue, conforme si mesuré,
// non applicable si toutes ses mesures le sont, à vérifier à la main s'il n'a qu'une consigne.
export function compStatus(c, measure) {
  return c.states.map(st => { const all = (st.check || []).map(measure), r = all.filter(x => x !== "na");
    const status = r.includes("fail") ? "fail" : r.length ? "pass" : all.length ? "na" : st.manual ? "manual" : "untested";
    return { ...st, status }; });
}
export function compCounts(list) {
  return { pass: list.filter(x => x.status === "pass").length, fail: list.filter(x => x.status === "fail").length, manual: list.filter(x => x.status === "manual" || (x.manual && x.status !== "manual")).length, na: list.filter(x => x.status === "na").length };
}
