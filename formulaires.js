/* Clauvi's Carnet — les feuilles de saisie.
   Une feuille monte du bas, on remplit, on valide. Deux principes :
   — rien ne s'enregistre si la règle de date n'est pas tenue (calculs.js),
   — rien ne se ferme par accident quand on a déjà tapé quelque chose. */

var Formulaires = (function(){
  "use strict";
  var C = Calculs;
  function D(){ return Carnet.donnees(); }
  function auj(){ return Carnet.etat().auj; }
  var esc = function(s){ return Carnet.esc(s); };
  var el = function(i){ return Carnet.el(i); };
  var F = function(n){ return C.F(n); };
  var modifie = false;

  /* ------------------------------------------------------ ouvrir / fermer */
  /* Figer la page derrière une feuille ouverte. Sur iPhone, sans ça, le
     doigt qui fait défiler la feuille entraîne la page du dessous dès que la
     feuille arrive en bout de course — on croit faire défiler le formulaire
     et c'est l'écran derrière qui part. Interdire le défilement ne suffit pas
     dans Safari : il faut épingler la page à sa position, puis l'y remettre
     en fermant. */
  var fondFige = false, defilementFige = 0;
  function figerFond(){
    var b = typeof document !== "undefined" && document.body;
    if (fondFige || !b || !b.style) return;
    defilementFige = window.scrollY || window.pageYOffset || 0;
    b.style.position = "fixed"; b.style.top = (-defilementFige) + "px";
    b.style.left = "0"; b.style.right = "0"; b.style.width = "100%";
    fondFige = true;
  }
  function libererFond(){
    var b = typeof document !== "undefined" && document.body;
    if (!fondFige || !b || !b.style) return;
    b.style.position = ""; b.style.top = ""; b.style.left = ""; b.style.right = ""; b.style.width = "";
    fondFige = false;
    window.scrollTo(0, defilementFige);
  }

  function ouvrir(titre, intro, corps, boutons){
    modifie = false;
    figerFond();
    el("couche").innerHTML =
      '<div class="voile" onclick="Formulaires.toucheVoile(event)">'
      + '<div class="feuille" role="dialog" aria-label="' + esc(titre) + '" onclick="event.stopPropagation()">'
      + '<h3>' + esc(titre) + '</h3>'
      + (intro ? '<p class="intro">' + intro + '</p>' : '')
      + corps
      + '<div id="erreur-feuille"></div>'
      + '<div class="fin">' + boutons + '</div>'
      + '</div></div>';
    var f = el("couche").querySelector(".feuille");
    f.addEventListener("input", function(){ modifie = true; });
    /* Sur un écran tactile, on ne place PAS le curseur d'office : le clavier
       sortirait tout seul et recouvrirait la moitié de la feuille avant même
       qu'on ait lu ce qu'elle demande. Il sort quand on touche un champ.
       Avec une souris et un vrai clavier, le curseur d'office fait gagner un clic. */
    var tactile = typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    var premier = f.querySelector("input,select,textarea");
    if (!tactile && premier && premier.type !== "date") { try { premier.focus(); } catch(e){} }
    ajusterAuClavier();
  }
  /* Caler l'écran de saisie sur ce qui est réellement visible. Quand le
     clavier de l'iPhone sort, la page ne rétrécit pas : le bas de la feuille
     reste derrière lui, hors d'atteinte, et rien ne permet d'y faire défiler.
     On donne donc à l'écran de saisie la hauteur exacte de la zone visible :
     tout ce qu'il contient redevient atteignable au doigt. */
  function ajusterAuClavier(){
    var c = el("couche"), v = c && c.querySelector && c.querySelector(".voile");
    var vv = typeof window !== "undefined" && window.visualViewport;
    if (!v || !v.style || !vv) return;
    v.style.top = vv.offsetTop + "px";
    v.style.height = vv.height + "px";
  }
  if (typeof window !== "undefined" && window.visualViewport && window.visualViewport.addEventListener) {
    window.visualViewport.addEventListener("resize", ajusterAuClavier);
    window.visualViewport.addEventListener("scroll", ajusterAuClavier);
  }
  function toucheVoile(ev){
    if (ev.target !== ev.currentTarget) return;
    if (modifie) Carnet.toast("Touche Annuler pour abandonner ta saisie");
    else fermer();
  }
  function fermer(){ el("couche").innerHTML = ""; modifie = false; libererFond(); }
  function erreur(msg){
    var z = el("erreur-feuille");
    if (z) z.innerHTML = '<div class="erreur">' + esc(msg) + '</div>';
  }
  var ANNULER = '<button onclick="Formulaires.fermer()">Annuler</button>';
  function valider(action, texte){
    return '<button class="principal" onclick="' + action + '">' + (texte || "Enregistrer") + '</button>';
  }

  /* ------------------------------------------------------------- champs */
  function cMontant(cle, libelle, valeur, gros){
    return '<label class="champ' + (gros ? ' gros-montant' : '') + '">' + esc(libelle)
      + '<input id="f-' + cle + '" inputmode="numeric" autocomplete="off" value="'
      + (valeur == null ? "" : String(valeur)) + '" placeholder="0"></label>';
  }
  function cTexte(cle, libelle, valeur, aide, placeholder){
    return '<label class="champ">' + esc(libelle)
      + '<input id="f-' + cle + '" type="text" autocomplete="off" value="' + esc(valeur || "")
      + '" placeholder="' + esc(placeholder || "") + '">'
      + (aide ? '<span class="aide">' + esc(aide) + '</span>' : '') + '</label>';
  }
  function cNote(cle, libelle, valeur){
    return '<label class="champ">' + esc(libelle)
      + '<textarea id="f-' + cle + '">' + esc(valeur || "") + '</textarea></label>';
  }
  function cDate(cle, libelle, valeur, aide){
    return '<label class="champ">' + esc(libelle)
      + '<input id="f-' + cle + '" type="date" value="' + (valeur || "") + '">'
      + (aide ? '<span class="aide">' + esc(aide) + '</span>' : '') + '</label>';
  }
  function cNombre(cle, libelle, valeur, aide){
    return '<label class="champ">' + esc(libelle)
      + '<input id="f-' + cle + '" type="number" min="1" step="1" value="'
      + (valeur == null ? "" : valeur) + '">'
      + (aide ? '<span class="aide">' + esc(aide) + '</span>' : '') + '</label>';
  }
  function cListe(cle, libelle, options, valeur, aide){
    return '<label class="champ">' + esc(libelle) + '<select id="f-' + cle + '">'
      + options.map(function(o){
          return '<option value="' + esc(o[0]) + '"'
            + (String(o[0]) === String(valeur) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join("")
      + '</select>' + (aide ? '<span class="aide">' + esc(aide) + '</span>' : '') + '</label>';
  }
  /* Un tiers se choisit dans la liste, ou se crée en tapant un nom : pas
     besoin de sortir de la feuille pour créer la personne. */
  /* « vide » : le texte de la ligne sans choix, quand il faut un tiers mais
     qu'aucun ne doit être présélectionné — sinon le premier de la liste par
     ordre alphabétique se retrouve choisi sans qu'on l'ait voulu. */
  function cTiers(cle, valeur, libelle, facultatif, vide){
    var opts = [];
    if (facultatif || vide) opts.push(["", vide || "— aucun (le marché n'a pas de nom) —"]);
    (D().tiers||[]).slice().sort(function(a,b){ return a.nom.localeCompare(b.nom); })
      .forEach(function(t){ opts.push([t.id, t.nom]); });
    return cListe(cle, libelle || "Tiers", opts, valeur == null ? "" : valeur)
      + cTexte(cle + "-nouveau", "…ou un nouveau nom", "", "Rempli, il crée le tiers et remplace le choix ci-dessus", "Prénom Nom");
  }
  function cCat(cle, valeur){
    var opts = (D().reglages.cats||[]).map(function(c){ return [c, c]; });
    return cListe(cle, "Catégorie", opts, valeur || opts[0] && opts[0][0])
      + cTexte(cle + "-nouvelle", "…ou une nouvelle catégorie", "", null, "Ex. Carburant");
  }
  function cCompte(cle, valeur, libelle){
    var opts = (D().comptes||[]).map(function(c){ return [c.id, c.nom]; });
    opts.push(["", "En nature (aucun compte)"]);
    return cListe(cle, libelle || "Payé / reçu par", opts, valeur == null ? "" : valeur);
  }
  function cRythme(prefixe, r){
    r = r || {type:"mensuel", jour:1};
    return cListe(prefixe + "-type", "Rythme", [
        ["mensuel","Chaque mois"], ["bimensuel","Deux fois par mois"],
        ["trimestriel","Tous les 3 mois"],
        ["annuel","Une fois par an"], ["mois","Seulement certains mois"]], r.type)
      + '<div class="deux-champs">'
      + cNombre(prefixe + "-jour", "Le jour", r.jour || 1)
      + cTexte(prefixe + "-jours", "Les deux jours (si deux fois par mois)",
          (r.jours||[]).join(","), null, "5,20")
      + '</div>'
      + cTexte(prefixe + "-mois", "Mois concernés (si « certains mois »)",
          (r.mois||[]).join(","), "En chiffres : 9,11,12 pour septembre, novembre, décembre", "9,11,12");
  }

  /* ------------------------------------------------------------ lecture */
  function v(cle){ var e = el("f-" + cle); return e ? e.value : null; }
  function mt(cle){ return Carnet.montantDe(v(cle)); }
  function lireTiers(cle){
    var nouveau = (v(cle + "-nouveau") || "").trim();
    if (nouveau) return Carnet.creerTiers(nouveau).id;
    var val = v(cle);
    return val === "" || val == null ? null : Number(val);
  }
  function lireCat(cle){
    var nouvelle = (v(cle + "-nouvelle") || "").trim();
    if (nouvelle) {
      if ((D().reglages.cats||[]).indexOf(nouvelle) < 0) D().reglages.cats.push(nouvelle);
      return nouvelle;
    }
    return v(cle);
  }
  function lireCompte(cle){
    var val = v(cle);
    return val === "" || val == null ? null : Number(val);
  }
  function lireRythme(prefixe){
    var type = v(prefixe + "-type");
    var r = {type:type, jour:Number(v(prefixe + "-jour") || 1)};
    if (type === "mois") {
      r.mois = (v(prefixe + "-mois") || "").split(",")
        .map(function(x){ return Number(String(x).trim()); })
        .filter(function(n){ return n >= 1 && n <= 12; });
    }
    if (type === "bimensuel") {
      r.jours = (v(prefixe + "-jours") || "").split(",")
        .map(function(x){ return Number(String(x).trim()); })
        .filter(function(n){ return n >= 1 && n <= 31; })
        .sort(function(a,b){ return a-b; });
    }
    return r;
  }

  /* ============================================================ le « + »
     La nature se choisit en haut et reste visible : on voit tout ce que le
     carnet sait noter, et on change d'avis sans fermer. Dépense et recette
     d'abord, parce que la plupart des lignes tombent sans avoir été prévues. */
  var NATURES = [
    ["depense", "Dépense", "Un achat, le marché, une facture"],
    ["recette", "Recette", "Une entrée, même non prévue"],
    ["pret", "Je prête", "Il devra me rembourser"],
    ["avance_recue", "On m'avance", "Je devrai rendre"],
    ["remboursement_recu", "Remboursement reçu", "Sur un prêt que j'ai fait"],
    ["remboursement_verse", "Remboursement versé", "Sur ce que je dois"],
    ["placement", "Mise dans une affaire", "Part d'affaire, parts de société"],
    ["part", "Part / dividende reçu", "Ce que l'affaire rapporte"],
    ["recurrent", "Charge ou revenu qui revient", "Loyer, facture, salaire"],
    ["opportunite", "Affaire à suivre", "Commission espérée"]
  ];

  /* ------------------------------------------------------- le bouton +
     Il propose ce qu'on ajoute DANS l'écran où l'on est : sur Dépenses, une
     dépense, une entrée, une charge ou un revenu fixe ; sur Tiers, un tiers,
     un prêt, un remboursement. Proposer partout la même liste de dix choses
     obligeait à chercher la bonne à chaque fois. L'accueil, lui, garde la
     saisie générale : c'est de là qu'on note la dépense du jour, au plus court. */
  var TITRES = {depense:"Nouvelle dépense", recette:"Nouvelle entrée d'argent", pret:"Je prête",
    avance_recue:"On m'avance", remboursement_recu:"Remboursement reçu",
    remboursement_verse:"Remboursement versé", placement:"Mise dans une affaire",
    part:"Part ou dividende reçu"};
  function menuDuPlus(vue, tiersId){
    var n = function(nature, aide){
      return [TITRES[nature], aide, "Formulaires.nouveau(" + (tiersId == null ? "null" : tiersId) + ",'" + nature + "',true)"]; };
    var prets = [n("pret", "Il devra me rembourser"), n("avance_recue", "Je devrai rendre"),
                 n("remboursement_recu", "Sur un prêt que j'ai fait"), n("remboursement_verse", "Sur ce que je dois")];
    if (vue === "depenses") return ["Ajouter dans Dépenses", [
      n("depense", "Un achat, le marché, une facture"),
      n("recette", "Une recette, même non prévue"),
      ["Nouvelle charge fixe", "Ce qui revient : loyer, facture, scolarité", "Formulaires.recurrent(null,'sortie')"],
      ["Nouveau revenu fixe", "Ce qui revient : salaire, loyer perçu", "Formulaires.recurrent(null,'entree')"]]];
    if (vue === "tiers") return ["Ajouter dans Tiers",
      [["Nouveau tiers", "Une personne ou une société", "Formulaires.tiers()"]].concat(prets)];
    if (vue === "fiche") return [Carnet.nomTiers(tiersId) || "Ce tiers", prets.concat([
      ["Nouveau business", "Ce qui doit me revenir sur une affaire avec lui", "Formulaires.affaire(" + tiersId + ")"]])];
    if (vue === "affaires") return ["Ajouter dans Business", [
      ["Nouveau business", "Avec qui, combien, ce qui est déjà reçu, ce qui reste", "Formulaires.affaire()"],
      ["Commission espérée", "Un pourcentage sur une affaire apportée", "Formulaires.opportunite()"],
      n("placement", "Part d'affaire, parts de société"),
      n("part", "Ce qu'une affaire rapporte")]];
    if (vue === "patrimoine") return ["Ajouter dans Patrimoine", [
      ["Nouveau terrain", "Où il se trouve, quel document", "Formulaires.bien(null,'terrain')"],
      ["Nouveau véhicule", "Marque, plaque", "Formulaires.bien(null,'vehicule')"],
      ["Autre bien", "Matériel, maison, boutique", "Formulaires.bien(null,'autre')"],
      ["Nouveau crédit", "Crédit véhicule, prêt bancaire", "Formulaires.credit()"],
      ["Nouveau compte", "Wave, Orange Money, une autre banque", "Formulaires.comptes()"]]];
    return null;
  }
  function plus(){
    var e = Carnet.etat(), menu = menuDuPlus(e.vue, e.vue === "fiche" ? e.id : null);
    if (!menu) return nouveau();
    ouvrir(menu[0], null, '<div class="liste menu">' + menu[1].map(function(c){
        return '<button class="ligne" onclick="' + c[2] + '"><span class="corps">'
          + '<span class="nom">' + esc(c[0]) + '</span><span class="sous">' + esc(c[1]) + '</span></span>'
          + '<span class="chevron">›</span></button>'; }).join("") + '</div>', ANNULER);
  }

  /* « direct » : on arrive du menu d'un écran, le choix est déjà fait. La
     feuille porte alors son nom (« Nouvelle dépense ») et ne repose pas la
     question « Quoi ? ». */
  function nouveau(tiersId, nature, direct){
    nature = nature || "depense";
    if (nature === "recurrent") return recurrent(null, "sortie");
    if (nature === "opportunite") return opportunite(null, tiersId);
    /* Un menu natif plutôt qu'une grille de dix boutons : sur un téléphone,
       le montant doit être visible sans défiler. La dépense du marché se note
       en trois gestes, et les dix natures restent à un tap. */
    var choix = '<label class="champ">Quoi ?<select id="f-nature" onchange="Formulaires.nouveau('
      + (tiersId == null ? "null" : tiersId) + ',this.value)">'
      + NATURES.map(function(n){
          return '<option value="' + n[0] + '"' + (n[0] === nature ? ' selected' : '') + '>'
            + esc(n[1] + " — " + n[2]) + '</option>'; }).join("")
      + '</select></label>';
    var corps = (direct ? "" : choix) + corpsNature(nature, tiersId);
    ouvrir(direct ? (TITRES[nature] || "Noter quelque chose") : "Noter quelque chose", null, corps,
      ANNULER + valider("Formulaires.enregistrerNouveau('" + nature + "')", "Noter"));
  }

  function corpsNature(nature, tiersId){
    var a = auj(), h = "";
    if (nature === "depense" || nature === "recette") {
      h += cMontant("montant", nature === "depense" ? "Montant de la dépense (XOF)" : "Montant reçu (XOF)", null, true)
        + cTexte("libelle", "C'était quoi ?", "", null, nature === "depense" ? "Marché, carburant…" : "Prime, vente…")
        + cCat("cat", nature === "recette" ? "Divers" : null)
        + cCompte("compte", (D().comptes[0]||{}).id)
        + cDate("date", "Date", a)
        + cTiers("tiers", tiersId, "Tiers (facultatif)", true);
    }
    if (nature === "pret" || nature === "avance_recue") {
      var pret = nature === "pret";
      h += cTiers("tiers", tiersId, pret ? "À qui je prête" : "Qui m'avance")
        + cMontant("montant", "Montant (XOF)", null, true)
        + cTexte("libelle", "Objet", "", null, pret ? "Prêt stock, dépannage…" : "Avance reçue")
        + cCompte("compte", (D().comptes[0]||{}).id)
        + cDate("date", "Date de l'opération", a)
        + '<div class="deux-champs">' + cNombre("nb", "Nombre de versements", 1)
        + cNombre("pas", "Tous les combien de mois", 1) + '</div>'
        + cDate("echeance", pret ? "Premier remboursement attendu le" : "Premier remboursement promis le", "",
            "Obligatoire : une promesse sans date est une promesse oubliée.");
    }
    if (nature === "remboursement_recu" || nature === "remboursement_verse") {
      var recu = nature === "remboursement_recu";
      var sens = recu ? "creance" : "dette";
      var engs = (D().engagements||[]).filter(function(e){
        return e.sens === sens && C.resteEngagement(e) > 0; });
      var opts = [["", "— aucun engagement enregistré —"]].concat(engs.map(function(e){
        return [e.id, (Carnet.nomTiers(e.tiers) || "?") + " — " + e.objet + " (reste " + F(C.resteEngagement(e)) + ")"]; }));
      h += cListe("engagement", recu ? "Sur quel prêt ?" : "Sur quelle dette ?", opts, "")
        + cMontant("montant", "Montant versé (XOF)", null, true)
        + cCompte("compte", (D().comptes[0]||{}).id)
        + cDate("date", "Date", a)
        + cTiers("tiers", tiersId, "Tiers (si aucun engagement choisi)", true);
    }
    if (nature === "placement") {
      h += cTiers("tiers", tiersId, "Avec qui / quelle société")
        + cTexte("objet", "L'affaire", "", null, "Lot de fer à béton, parts SARL…")
        + cMontant("montant", "Ce que je mets (XOF)", null, true)
        + cTexte("part", "Ma part", "", "Ce qui me revient sur le résultat", "40 %")
        + cTexte("rythme", "Comment ça rapporte", "", null, "Au résultat de chaque lot")
        + cCompte("compte", (D().comptes[0]||{}).id)
        + cDate("date", "Date de la mise", a)
        + cDate("point", "Prochain point le", "",
            "Obligatoire : sans date de point, un placement disparaît de l'écran.");
    }
    if (nature === "part") {
      var parts = (D().participations||[]);
      if (!parts.length) return '<div class="vide">Aucune participation enregistrée. '
        + 'Note d\'abord une mise dans une affaire.</div>';
      h += cListe("participation", "De quelle affaire ?", parts.map(function(p){
            return [p.id, (Carnet.nomTiers(p.tiers) || "?") + " — " + p.objet]; }), parts[0].id)
        + cMontant("montant", "Montant reçu (XOF)", null, true)
        + cListe("genre", "C'est quoi ?", [
            ["benefice", "Un bénéfice (ma mise reste dans l'affaire)"],
            ["retrait", "Je retire une partie de ma mise"]], "benefice")
        + cCompte("compte", (D().comptes[0]||{}).id)
        + cDate("date", "Date", a)
        + cDate("point", "Prochain point le", "", "Obligatoire : sinon l'affaire sort de l'écran.");
    }
    return h;
  }

  function enregistrerNouveau(nature){
    var d = D(), a = auj();
    try {
      if (nature === "depense" || nature === "recette") {
        var m = mt("montant");
        if (!m) return erreur("Il manque le montant.");
        var sortie = nature === "depense";
        Carnet.ajouterMouvement({date:v("date") || a, tiers:lireTiers("tiers"),
          libelle:(v("libelle") || "").trim() || (sortie ? "Dépense" : "Recette"),
          montant:sortie ? -m : m, compte:lireCompte("compte"),
          nature:nature, cat:lireCat("cat")});
      }
      else if (nature === "pret" || nature === "avance_recue") {
        var pret = nature === "pret", mm = mt("montant"), ech = v("echeance");
        if (!mm) return erreur("Il manque le montant.");
        var idT = lireTiers("tiers");
        if (!idT) return erreur(pret ? "Dis-moi à qui tu prêtes." : "Dis-moi qui t'avance.");
        var tranches = C.tranches(mm, Number(v("nb") || 1), ech, Number(v("pas") || 1));
        var eng = {id:C.nouvelId(d.engagements), tiers:idT, sens:pret ? "creance" : "dette",
          objet:(v("objet") || "").trim() || (v("libelle") || "").trim() || (pret ? "Prêt" : "Avance reçue"),
          cree:a, tranches:tranches};
        var refus = C.exigeUneDate("engagement", eng);
        if (refus) return erreur(refus);
        d.engagements.push(eng);
        Carnet.ajouterMouvement({date:v("date") || a, tiers:idT, libelle:eng.objet,
          montant:pret ? -mm : mm, compte:lireCompte("compte"),
          nature:pret ? "pret" : "avance_recue", cat:"Prêts", engagement:eng.id});
      }
      else if (nature === "remboursement_recu" || nature === "remboursement_verse") {
        var m2 = mt("montant");
        if (!m2) return erreur("Il manque le montant.");
        var idEng = v("engagement");
        if (idEng) { fermer(); Carnet.reglerEngagement(Number(idEng), m2, v("date") || a, lireCompte("compte")); return; }
        var idT2 = lireTiers("tiers");
        if (!idT2) return erreur("Choisis un engagement, ou au moins le tiers concerné.");
        var recu = nature === "remboursement_recu";
        Carnet.ajouterMouvement({date:v("date") || a, tiers:idT2,
          libelle:recu ? "Remboursement reçu" : "Remboursement versé",
          montant:recu ? m2 : -m2, compte:lireCompte("compte"), nature:nature, cat:"Prêts"});
      }
      else if (nature === "placement") {
        var m3 = mt("montant");
        if (!m3) return erreur("Il manque la mise.");
        var idT3 = lireTiers("tiers");
        if (!idT3) return erreur("Dis-moi avec qui.");
        var p = {id:C.nouvelId(d.participations), tiers:idT3,
          objet:(v("objet") || "").trim() || "Participation", part:(v("part") || "").trim(),
          rythme:(v("rythme") || "").trim(), mise:m3, recu:0, miseRecuperee:0,
          point:v("point") || null, attendu:"Point à faire", cree:a};
        var refus3 = C.exigeUneDate("participation", p);
        if (refus3) return erreur(refus3);
        d.participations.push(p);
        Carnet.ajouterMouvement({date:v("date") || a, tiers:idT3, libelle:"Mise — " + p.objet,
          montant:-m3, compte:lireCompte("compte"), nature:"placement",
          cat:"Placements", participation:p.id});
      }
      else if (nature === "part") {
        var m4 = mt("montant");
        if (!m4) return erreur("Il manque le montant reçu.");
        var part = Carnet.parId(d.participations, Number(v("participation")));
        if (!part) return erreur("Choisis l'affaire.");
        if (!v("point")) return erreur(C.exigeUneDate("participation", {}));
        var retrait = v("genre") === "retrait";
        part.recu = (part.recu || 0) + m4;
        if (retrait) part.miseRecuperee = (part.miseRecuperee || 0) + m4;
        part.point = v("point");
        Carnet.ajouterMouvement({date:v("date") || a, tiers:part.tiers,
          libelle:(retrait ? "Retrait de mise — " : "Part reçue — ") + part.objet,
          montant:m4, compte:lireCompte("compte"), nature:"part",
          cat:"Affaires", participation:part.id});
      }
    } catch (e) { return erreur("Erreur : " + (e && e.message ? e.message : e)); }
    fermer();
    Carnet.enregistrer();
    Carnet.rendre();
  }

  /* ------------------------------------------- modifier un mouvement */
  function mouvement(id){
    var m = Carnet.parId(D().mouvements, id);
    if (!m) return;
    /* Le dû d'une affaire se corrige dans son échéancier : le modifier ici
       le désaccorderait de ses tranches. */
    if (C.sansArgent(m) && Carnet.parId(D().engagements, m.engagement)) return engagement(m.engagement);
    var horsSolde = m.compte != null && !C.dansLeSolde(D(), m);
    var corps = (horsSolde ? '<p class="intro">Cette ligne date d\'avant l\'ouverture de son compte : elle compte '
        + 'dans le mois, mais ne change pas le solde, qui en tenait déjà compte.</p>' : '')
      + cMontant("montant", "Montant (XOF)", Math.abs(m.montant), true)
      + cTexte("libelle", "Libellé", m.libelle)
      + cCat("cat", m.cat) + cCompte("compte", m.compte) + cDate("date", "Date", m.date)
      + cTiers("tiers", m.tiers, "Tiers", true)
      + '<p class="intro">Nature : ' + esc(m.nature) + (m.fixe ? " · issue d'une charge fixe" : "")
      + (m.ecart ? " · écart de caisse constaté" : "") + '</p>';
    ouvrir("Modifier la ligne", null, corps,
      '<button class="danger" onclick="Formulaires.supprimerMouvement(' + id + ')">Supprimer</button>'
      + ANNULER + valider("Formulaires.majMouvement(" + id + ")"));
  }
  function majMouvement(id){
    var m = Carnet.parId(D().mouvements, id), mm = mt("montant");
    if (!mm) return erreur("Il manque le montant.");
    var signe = m.montant < 0 ? -1 : 1;
    m.montant = signe * mm;
    m.libelle = (v("libelle") || "").trim() || m.libelle;
    m.cat = lireCat("cat"); m.compte = lireCompte("compte");
    m.date = v("date") || m.date; m.tiers = lireTiers("tiers");
    fermer(); Carnet.enregistrer(); Carnet.rendre();
  }
  function supprimerMouvement(id){ fermer(); Carnet.supprimerMouvement(id); }

  /* ------------------------------------------------------------- tiers */
  function tiers(id){
    var t = id ? Carnet.parId(D().tiers, id) : null;
    var genres = ["Proche","Famille","Partenaire","Client","Fournisseur","Société","Bailleur","École","Autre"];
    var corps = cTexte("nom", "Nom", t ? t.nom : "", null, "Personne ou société")
      + cListe("genre", "Genre", genres.map(function(g){ return [g,g]; }), t ? t.genre : "Proche")
      + cTexte("tel", "Téléphone", t ? t.tel : "", null, "07 00 00 00 00")
      + cNote("note", "Ce qu'il faut se rappeler", t ? t.note : "");
    ouvrir(t ? "Modifier " + t.nom : "Nouveau tiers", null, corps,
      (t ? '<button class="danger" onclick="Formulaires.supprimerTiers(' + id + ')">Supprimer</button>' : "")
      + ANNULER + valider("Formulaires.majTiers(" + (id || "null") + ")"));
  }
  /* Toutes les personnes du carnet, y compris celles que l'onglet Tiers ne
     montre pas parce qu'aucun argent n'est en jeu avec elles. C'est d'ici
     qu'on les renomme ou qu'on les supprime. */
  function personnes(){
    var d = D(), liste = (d.tiers||[]).slice().sort(function(x, y){ return x.nom.localeCompare(y.nom); });
    ouvrir("Personnes du carnet", "Celles avec qui aucun argent n'est en jeu ne sont pas dans l'onglet Tiers.",
      (liste.length ? '<div class="liste menu">' + liste.map(function(t){
          var s = C.soldeTiers(d, t.id);
          return '<button class="ligne" onclick="Formulaires.fermer();Carnet.ouvrirTiers(' + t.id + ')"><span class="corps">'
            + '<span class="nom">' + esc(t.nom) + '</span><span class="sous">'
            + (s > 0 ? 'me doit ' + C.F(s) : s < 0 ? 'je lui dois ' + C.F(-s) : 'rien en cours') + '</span></span>'
            + '<span class="chevron">›</span></button>'; }).join("") + '</div>'
        : '<div class="vide">Personne pour l\'instant.</div>'),
      '<button onclick="Formulaires.fermer()">Fermer</button>'
      + '<button class="principal" onclick="Formulaires.tiers()">Nouvelle personne</button>');
  }
  function majTiers(id){
    var nom = (v("nom") || "").trim();
    if (!nom) return erreur("Il faut un nom.");
    var t = id ? Carnet.parId(D().tiers, id) : null;
    if (!t) { t = Carnet.creerTiers(nom); }
    t.nom = nom; t.genre = v("genre"); t.tel = (v("tel") || "").trim(); t.note = v("note") || "";
    fermer(); Carnet.enregistrer(); Carnet.rendre();
  }
  /* On ne supprime pas un tiers qui porte encore de l'argent : ça effacerait
     une dette ou une créance sans laisser de trace. */
  function supprimerTiers(id){
    var d = D();
    if (C.soldeTiers(d, id) !== 0) return erreur("Son solde n'est pas à zéro : ce tiers porte encore de l'argent.");
    if ((d.mouvements||[]).some(function(m){ return m.tiers === id; }))
      return erreur("Des mouvements lui sont rattachés. Garde-le, il raconte ton histoire.");
    d.tiers = d.tiers.filter(function(t){ return t.id !== id; });
    fermer(); Carnet.enregistrer(); Carnet.aller("tiers");
  }

  /* ----------------------------------------------- lignes qui reviennent */
  function recurrent(id, sens){
    var d = D(), c = id ? Carnet.parId(d.recurrents, id) : null;
    sens = c ? c.sens : (sens || "sortie");
    var corps = cTexte("libelle", "Libellé", c ? c.libelle : "", null, "Loyer, CIE, salaire…")
      + cMontant("montant", "Montant (XOF)", c ? c.montant : null, true)
      + cListe("sens", "Sens", [["sortie","Ça sort (charge)"],["entree","Ça rentre (revenu)"]], sens)
      + cListe("facultatif", "C'est dû ou c'est selon ?", [
          ["non","C'est dû — le reste à vivre le retient"],
          ["oui","Si je peux — ça dépend de mes entrées"]],
          c && c.facultatif ? "oui" : "non")
      + cCat("cat", c ? c.cat : null)
      + cRythme("r", c ? c.rythme : null)
      + cDate("prochaine", "Prochaine échéance", c ? c.prochaine : "",
          "Obligatoire : sans elle, la ligne n'apparaît jamais à l'écran.")
      + cCompte("compte", c ? c.compte : (d.comptes[0]||{}).id)
      + cTiers("tiers", c ? c.tiers : null, "Tiers (facultatif)", true);
    var boutons = (c ? '<button class="danger" onclick="Formulaires.supprimerRecurrent(' + id + ')">Supprimer</button>' : "")
      + ANNULER + valider("Formulaires.majRecurrent(" + (id || "null") + ")");
    ouvrir(c ? c.libelle : (sens === "entree" ? "Nouveau revenu fixe" : "Nouvelle charge fixe"),
      c && c.jourAConfirmer ? "Le jour de cette ligne est une supposition : confirme-le." : null,
      corps, boutons);
  }
  function majRecurrent(id){
    var d = D();
    var lib = (v("libelle") || "").trim(), m = mt("montant");
    if (!lib) return erreur("Il faut un libellé.");
    if (!m) return erreur("Il manque le montant.");
    var objet = {libelle:lib, montant:m, sens:v("sens"), cat:lireCat("cat"),
      facultatif:v("facultatif") === "oui",
      rythme:lireRythme("r"), prochaine:v("prochaine") || null,
      compte:lireCompte("compte"), tiers:lireTiers("tiers")};
    var refus = C.exigeUneDate("recurrent", objet);
    if (refus) return erreur(refus);
    if (objet.rythme.type === "mois" && !(objet.rythme.mois||[]).length)
      return erreur("Dis-moi quels mois, séparés par des virgules. Exemple : 9,11,12");
    if (objet.rythme.type === "bimensuel" && (objet.rythme.jours||[]).length < 2)
      return erreur("Donne les deux jours du mois, séparés par une virgule. Exemple : 5,20");
    var c = id ? Carnet.parId(d.recurrents, id) : null;
    if (c) { for (var k in objet) c[k] = objet[k]; c.jourAConfirmer = false; }
    else { objet.id = C.nouvelId(d.recurrents); d.recurrents.push(objet); }
    fermer(); Carnet.enregistrer(); Carnet.rendre();
  }
  function supprimerRecurrent(id){
    var d = D();
    d.recurrents = d.recurrents.filter(function(c){ return c.id !== id; });
    fermer(); Carnet.enregistrer(); Carnet.rendre();
  }

  /* -------------------------------------------------------- enveloppes */
  function enveloppe(id){
    var d = D(), e = id ? Carnet.parId(d.enveloppes, id) : null;
    var corps = cTexte("libelle", "Libellé", e ? e.libelle : "", null, "Dépenses de la maison")
      + cMontant("montant", "Prévu par mois (XOF)", e ? e.montant : null, true)
      + cMontant("mois", "Plafond pour ce mois-ci", e ? C.montantEnveloppe(e, auj()) : null)
      + cTexte("cats", "Catégories couvertes", e ? (e.cats||[]).join(", ") : "",
          "Séparées par des virgules. Les dépenses de ces catégories mangent l'enveloppe.",
          "Nourriture, Maison")
      + cNote("note", "Note", e ? e.note : "")
      + '<p class="intro">Une enveloppe n\'a pas de date : c\'est de l\'argent qui part tous les jours. '
      + 'Le reste à vivre retire ce qui n\'a pas encore été dépensé dessus.</p>';
    ouvrir(e ? e.libelle : "Nouvelle enveloppe", null, corps,
      (e ? '<button class="danger" onclick="Formulaires.supprimerEnveloppe(' + id + ')">Supprimer</button>' : "")
      + ANNULER + valider("Formulaires.majEnveloppe(" + (id || "null") + ")"));
  }
  function majEnveloppe(id){
    var d = D(), lib = (v("libelle") || "").trim(), m = mt("montant");
    if (!lib) return erreur("Il faut un libellé.");
    if (!m) return erreur("Il manque le montant prévu.");
    var cats = (v("cats") || "").split(",").map(function(x){ return x.trim(); })
      .filter(function(x){ return x; });
    if (!cats.length) return erreur("Dis-moi quelles catégories cette enveloppe couvre.");
    cats.forEach(function(c){ if (d.reglages.cats.indexOf(c) < 0) d.reglages.cats.push(c); });
    var e = id ? Carnet.parId(d.enveloppes, id) : null;
    if (!e) { e = {id:C.nouvelId(d.enveloppes), montantsParMois:{}}; d.enveloppes.push(e); }
    e.libelle = lib; e.montant = m; e.cats = cats; e.note = v("note") || "";
    /* Le plafond du mois est stocké à part : il change d'un mois à l'autre
       sans toucher au montant habituel. */
    var duMois = mt("mois");
    if (!e.montantsParMois) e.montantsParMois = {};
    if (duMois != null && duMois !== m) e.montantsParMois[auj().slice(0,7)] = duMois;
    else if (duMois === m) delete e.montantsParMois[auj().slice(0,7)];
    fermer(); Carnet.enregistrer(); Carnet.rendre();
  }
  function supprimerEnveloppe(id){
    var d = D();
    d.enveloppes = d.enveloppes.filter(function(e){ return e.id !== id; });
    fermer(); Carnet.enregistrer(); Carnet.rendre();
  }

  /* ------------------------------------------------------------ comptes */
  function comptes(){
    var d = D();
    var corps = (d.comptes||[]).map(function(c){
      return '<div class="deux-champs">'
        + cTexte("nom" + c.id, "Compte", c.nom)
        + cMontant("solde" + c.id, "Solde aujourd'hui", C.soldeCompte(d, c.id))
        + '</div>'; }).join("")
      + '<p class="intro">Le solde que tu saisis est la vérité à sa date : ce que tu noteras ensuite avec une '
      + 'date antérieure (un loyer déjà payé) comptera dans le mois sans le retirer une seconde fois. '
      + 'Si tu corriges un solde plus tard, le carnet note l\'écart au lieu de réécrire ton historique.</p>'
      + cTexte("nouveau", "Ajouter un compte", "", null, "Wave, Orange Money, NSIA…");
    ouvrir("Mes comptes", "Ce que tu as, compte par compte.", corps,
      ANNULER + valider("Formulaires.majComptes()"));
  }
  function majComptes(){
    var d = D(), a = auj();
    (d.comptes||[]).forEach(function(c){
      var nom = (v("nom" + c.id) || "").trim();
      if (nom) c.nom = nom;
      var voulu = mt("solde" + c.id);
      if (voulu == null) return;
      var actuel = C.soldeCompte(d, c.id);
      if (voulu !== actuel) {
        /* Premier remplissage : le carnet est vide, autant poser le solde de
           départ plutôt que d'inventer un écart le jour de l'installation. */
        if (!(d.mouvements||[]).some(function(m){ return m.compte === c.id; })) {
          c.soldeInitial = voulu; c.depuis = a;
        } else Carnet.pointerCompte(c.id, voulu, a);
      }
    });
    var nouveau = (v("nouveau") || "").trim();
    if (nouveau) d.comptes.push({id:C.nouvelId(d.comptes), nom:nouveau, type:"autre",
      soldeInitial:0, depuis:a});
    fermer(); Carnet.enregistrer(); Carnet.rendre();
  }

  function pointer(){
    var d = D();
    var corps = cListe("compte", "Quel compte ?", (d.comptes||[]).map(function(c){
        return [c.id, c.nom + " — carnet : " + F(C.soldeCompte(d, c.id))]; }), (d.comptes[0]||{}).id)
      + cMontant("reel", "Combien y a-t-il réellement ?", null, true)
      + cDate("date", "Date du comptage", auj())
      + '<p class="intro">Si ça ne colle pas, le carnet n\'efface rien : il ajoute une ligne '
      + '« écart de caisse » à cette date. Tu ne saisis pas chaque achat au marché, tu comptes '
      + 'ce qui reste.</p>';
    ouvrir("Compter ce que j'ai", null, corps, ANNULER + valider("Formulaires.majPointage()", "Enregistrer le comptage"));
  }
  function majPointage(){
    var reel = mt("reel");
    if (reel == null) return erreur("Dis-moi combien tu as compté.");
    var id = Number(v("compte")), date = v("date") || auj();
    fermer(); Carnet.pointerCompte(id, reel, date);
  }

  /* ----------------------------------------------- biens, crédits, cats */
  /* Un bien : sa nature d'abord, puis les renseignements propres à cette
     nature. Changer de nature redessine la feuille en gardant la valeur déjà
     tapée. */
  var DOCUMENTS_TERRAIN = ["ACD (arrêté de concession définitive)", "Titre foncier", "Certificat foncier",
    "Attestation villageoise", "Lettre d'attribution", "Acte de vente notarié", "Aucun document pour l'instant", "Autre"];
  function bien(id, type, reprise){
    var d = D(), b = id ? Carnet.parId(d.biens, id) : null;
    /* « reprise » : on vient de changer de nature, la valeur déjà tapée est gardée */
    var valeur = reprise ? mt("montant") : (b ? b.montant : null);
    type = type || (b ? C.typeBien(b) : "terrain");
    var o = b || {};
    var corps = '<label class="champ">Nature<select id="f-type" onchange="Formulaires.bien('
      + (id || "null") + ',this.value,true)">' + C.TYPES_BIEN.map(function(t){
          return '<option value="' + t[0] + '"' + (t[0] === type ? ' selected' : '') + '>' + esc(t[1]) + '</option>'; }).join("")
      + '</select></label>';
    if (type === "terrain")
      corps += cTexte("lieu", "Situation géographique", o.lieu || "", "Ville, quartier, lot, îlot : de quoi le retrouver.", "Bingerville, lot 214 îlot 18")
        + cListe("document", "Type de document", DOCUMENTS_TERRAIN.map(function(x){ return [x, x]; })
            .concat(o.document && DOCUMENTS_TERRAIN.indexOf(o.document) < 0 ? [[o.document, o.document]] : []),
            o.document || "Aucun document pour l'instant")
        + cTexte("superficie", "Superficie (facultatif)", o.superficie || "", null, "600 m²");
    else if (type === "vehicule")
      corps += cTexte("marque", "Marque et modèle", o.marque || "", null, "Toyota Corolla")
        + cTexte("plaque", "Plaque d'immatriculation", o.plaque || "", null, "1234 AB 01");
    else
      corps += cTexte("nom", "Libellé", o.nom || "", null, "Matériel, maison, boutique…");
    corps += cMontant("montant", "Valeur estimée (XOF)", valeur, true)
      + '<p class="intro">C\'est la seule ligne du patrimoine que tu estimes à la main.</p>';
    ouvrir(b ? C.nomBien(b) : "Nouveau bien", null, corps,
      (b ? '<button class="danger" onclick="Formulaires.supprimerSimple(\'biens\',' + id + ')">Supprimer</button>' : "")
      + ANNULER + valider("Formulaires.majBien(" + (id || "null") + ")"));
  }
  function majBien(id){
    var d = D(), type = v("type") || "autre", m = mt("montant");
    var texte = function(k){ return (v(k) || "").trim(); };
    var neuf = {type:type, montant:m};
    if (type === "terrain") {
      if (!texte("lieu")) return erreur("Dis-moi où il se trouve : c'est ce qui le distingue d'un autre terrain.");
      neuf.lieu = texte("lieu"); neuf.document = v("document") || ""; neuf.superficie = texte("superficie");
    } else if (type === "vehicule") {
      if (!texte("marque")) return erreur("Il manque la marque.");
      neuf.marque = texte("marque"); neuf.plaque = texte("plaque").toUpperCase();
    } else {
      if (!texte("nom")) return erreur("Il faut un libellé.");
      neuf.nom = texte("nom");
    }
    if (m == null) return erreur("Il manque la valeur estimée.");
    /* « nom » reste rempli pour tout bien : c'est ce que lisent les sauvegardes
       et les versions de l'app qui ne connaissent pas encore les natures. */
    neuf.nom = C.nomBien(neuf);
    var b = id ? Carnet.parId(d.biens, id) : null;
    if (b) { ["lieu","document","superficie","marque","plaque"].forEach(function(k){ delete b[k]; });
             for (var k in neuf) b[k] = neuf[k]; }
    else { neuf.id = C.nouvelId(d.biens); d.biens.push(neuf); }
    fermer(); Carnet.enregistrer(); Carnet.rendre();
  }
  function credit(id){ ligneSimple("credits", id, "crédit", "Crédit véhicule, prêt bancaire…"); }
  function ligneSimple(liste, id, mot, exemple){
    var d = D(), o = id ? Carnet.parId(d[liste], id) : null;
    var corps = cTexte("nom", "Libellé", o ? o.nom : "", null, exemple)
      + cMontant("montant", mot === "bien" ? "Valeur estimée (XOF)" : "Reste à payer (XOF)",
          o ? o.montant : null, true)
      + (mot === "bien" ? '<p class="intro">C\'est la seule ligne du patrimoine que tu estimes '
        + 'à la main : le carnet la marque « estimé » pour qu\'on ne la confonde pas avec un calcul.</p>' : "");
    ouvrir(o ? o.nom : "Nouveau " + mot, null, corps,
      (o ? '<button class="danger" onclick="Formulaires.supprimerSimple(\'' + liste + '\',' + id + ')">Supprimer</button>' : "")
      + ANNULER + valider("Formulaires.majSimple('" + liste + "'," + (id || "null") + ")"));
  }
  function majSimple(liste, id){
    var d = D(), nom = (v("nom") || "").trim(), m = mt("montant");
    if (!nom) return erreur("Il faut un libellé.");
    if (m == null) return erreur("Il manque le montant.");
    var o = id ? Carnet.parId(d[liste], id) : null;
    if (o) { o.nom = nom; o.montant = m; }
    else d[liste].push({id:C.nouvelId(d[liste]), nom:nom, montant:m});
    fermer(); Carnet.enregistrer(); Carnet.rendre();
  }
  function supprimerSimple(liste, id){
    var d = D();
    d[liste] = d[liste].filter(function(x){ return x.id !== id; });
    fermer(); Carnet.enregistrer(); Carnet.rendre();
  }
  function categories(){
    var d = D();
    var corps = cNote("cats", "Une catégorie par ligne", (d.reglages.cats||[]).join("\n"))
      + '<p class="intro">Retirer une catégorie ne touche pas les lignes déjà notées.</p>';
    ouvrir("Catégories", null, corps, ANNULER + valider("Formulaires.majCategories()"));
  }
  function majCategories(){
    var d = D();
    var liste = (v("cats") || "").split("\n").map(function(x){ return x.trim(); })
      .filter(function(x){ return x; });
    if (!liste.length) return erreur("Garde au moins une catégorie.");
    d.reglages.cats = liste;
    fermer(); Carnet.enregistrer(); Carnet.rendre();
  }

  /* ------------------------------------- engagements, parts, affaires */
  /* ------------------------------------------------------------ business
     Un business : un nom, quelqu'un en face, un montant validé ou seulement
     annoncé, ce qui a déjà été reçu, ce qui reste en tranches (datées ou
     non), et la prochaine étape. C'est un engagement comme un prêt — même
     échéancier, même encaissement — sauf qu'aucun argent ne sort pour le créer. */
  var ETATS_BUSINESS = [["oui","Opportunité validée — on me le doit"],["non","Opportunité — pas encore validée"]];
  function affaire(tiersId){
    var corps = cTexte("objet", "Nom du business", "", null, "Appli de gestion, vente d'un ordinateur…")
      + cTiers("tiers", tiersId, "Avec qui", false, "— choisir, ou écrire un nouveau nom —")
      + cListe("genre", "Si c'est un nouveau nom, c'est…", [["Partenaire","Une personne"],["Société","Une société"]], "Partenaire")
      + cTexte("avec", "Autres personnes dans l'affaire (facultatif)", "", null, "Prénom, prénom…")
      + cMontant("montant", "Montant total pour moi (XOF)", null, true)
      + cListe("valide", "C'est…", ETATS_BUSINESS, "oui",
          "Pas encore validée : elle s'affiche à part et ne compte pas dans ce qu'on te doit.")
      + cMontant("recu", "Déjà reçu à ce jour (XOF)", null)
      + cTexte("recunote", "Reçu comment", "", "Cet argent est déjà dans tes comptes : il ne sera pas ajouté une seconde fois.",
          "200 000 mobile money, 500 000 chèque")
      + '<div class="deux-champs">' + cMontant("premier", "Prochaine tranche", null)
      + cDate("echeance", "Attendue le", "") + '</div>'
      + '<p class="intro">Laisse vide ce que tu ne connais pas : le reste devient une tranche à dater, '
      + 'et tu ajusteras tranche par tranche ensuite.</p>'
      + '<div class="deux-champs">' + cTexte("etape", "Prochaine étape", "", null, "Livrer la bêta")
      + cDate("etapedate", "Le", "") + '</div>';
    ouvrir("Nouveau business", null, corps, ANNULER + valider("Formulaires.creerAffaire()"));
  }
  function creerAffaire(){
    var d = D(), a = auj(), total = mt("montant"), recu = mt("recu") || 0;
    if (!total) return erreur("Il manque le montant total.");
    if (recu > total) return erreur("Ce qui est déjà reçu dépasse le montant total.");
    var reste = total - recu, premier = mt("premier") || 0, date = v("echeance") || null;
    if (premier > reste) return erreur("La prochaine tranche dépasse ce qui reste à recevoir (" + F(reste) + ").");
    if (!(v("tiers-nouveau") || "").trim() && !v("tiers")) return erreur("Dis-moi avec qui : une personne ou une société.");
    var nouveauNom = (v("tiers-nouveau") || "").trim(), idT = lireTiers("tiers");
    if (nouveauNom) { var t = Carnet.parTiers(idT); if (t) t.genre = v("genre") || "Partenaire"; }
    var tranches = !reste ? []
      : premier && premier < reste ? [{date:date, montant:premier, etat:"due"}, {date:null, montant:reste - premier, etat:"due"}]
      : [{date:date, montant:reste, etat:"due"}];
    var eng = {id:C.nouvelId(d.engagements), tiers:idT, sens:"creance", origine:"business",
      objet:(v("objet") || "").trim() || "Business", avecAussi:(v("avec") || "").trim(), cree:a,
      valide:v("valide") !== "non", dejaRecu:recu, dejaRecuNote:(v("recunote") || "").trim(),
      etape:(v("etape") || "").trim(), etapeDate:v("etapedate") || null, tranches:tranches};
    d.engagements.push(eng);
    Carnet.accorderDu(eng);
    fermer(); Carnet.enregistrer(); Carnet.rendre();
  }
  /* La fiche d'un business : tout ce qu'on en sait, et les gestes. */
  function business(id){
    var e = Carnet.parId(D().engagements, id);
    if (!e) return;
    ouvrir(e.objet, null, Vues.carteBusiness(e), '<button onclick="Formulaires.fermer()">Fermer</button>');
  }
  function validerBusiness(id){
    var e = Carnet.parId(D().engagements, id);
    if (!e) return;
    e.valide = true;
    Carnet.accorderDu(e);
    fermer(); Carnet.enregistrer(); Carnet.rendre();
    Carnet.toast("Opportunité validée : " + F(C.resteEngagement(e)) + " à encaisser");
  }
  function modifierBusiness(id){
    var e = Carnet.parId(D().engagements, id), n = (e.tranches||[]).length;
    var corps = cTexte("objet", "Nom du business", e.objet)
      + cTiers("tiers", e.tiers, "Avec qui")
      + '<p class="intro">Changer ici remplace la personne par une autre. Pour corriger l\'orthographe de son nom, '
      + 'utilise « Corriger le nom » sur la fiche du business.</p>'
      + cTexte("avec", "Autres personnes dans l'affaire", e.avecAussi || "")
      + cListe("valide", "C'est…", ETATS_BUSINESS, C.estValide(e) ? "oui" : "non")
      + cMontant("recu", "Reçu avant le carnet (XOF)", e.dejaRecu || null)
      + cTexte("recunote", "Reçu comment", e.dejaRecuNote || "")
      + (e.tranches||[]).map(function(t, i){
          return '<div class="deux-champs">'
            + cDate("d" + i, "Tranche " + (i+1) + (t.etat === "payee" ? " (encaissée)" : ""), t.date || "")
            + cMontant("m" + i, "Montant", t.montant) + '</div>'; }).join("")
      + '<div class="deux-champs">' + cDate("d" + n, "Ajouter une tranche", "") + cMontant("m" + n, "Montant", null) + '</div>'
      + '<p class="intro">Total : ' + F(C.totalBusiness(e)) + ', dont ' + F(C.recuBusiness(e)) + ' reçus. '
      + 'Une date vide reste « à dater ». Un montant à 0 retire la tranche.</p>'
      + '<div class="deux-champs">' + cTexte("etape", "Prochaine étape", e.etape || "") + cDate("etapedate", "Le", e.etapeDate || "") + '</div>';
    ouvrir("Modifier le business", null, corps,
      '<button class="danger" onclick="Formulaires.supprimerAffaire(' + id + ')">Supprimer</button>'
      + ANNULER + valider("Formulaires.majBusiness(" + id + ")"));
  }
  function majBusiness(id){
    var e = Carnet.parId(D().engagements, id), n = e.tranches.length;
    var tranches = e.tranches.map(function(t, i){
      var m = mt("m" + i), c = {};
      for (var k in t) c[k] = t[k];
      c.date = v("d" + i) || null;
      if (m != null) c.montant = m;
      return c; }).filter(function(t){ return t.etat === "payee" || t.montant > 0; });
    var ajout = mt("m" + n);
    if (ajout) tranches.push({date:v("d" + n) || null, montant:ajout, etat:"due"});
    var idT = lireTiers("tiers");
    if (!idT) return erreur("Dis-moi avec qui.");
    e.objet = (v("objet") || "").trim() || e.objet;
    e.tiers = idT; e.avecAussi = (v("avec") || "").trim();
    e.valide = v("valide") !== "non";
    e.dejaRecu = mt("recu") || 0; e.dejaRecuNote = (v("recunote") || "").trim();
    e.etape = (v("etape") || "").trim(); e.etapeDate = v("etapedate") || null;
    e.tranches = tranches;
    Carnet.accorderDu(e);
    fermer(); Carnet.enregistrer(); Carnet.rendre();
  }
  function supprimerAffaire(id){
    var d = D(), e = Carnet.parId(d.engagements, id);
    if (!e) return;
    /* Ce qui a déjà été encaissé reste encaissé : le dû est ramené à ce
       montant, pour que le tiers ne se retrouve pas « créancier » de ce
       qu'il a payé. S'il n'a rien payé, l'écriture disparaît avec le business. */
    var paye = C.regleEngagement(e);
    d.mouvements = d.mouvements.filter(function(m){
      if (m.engagement !== id || !C.sansArgent(m)) return true;
      m.montant = paye; return paye > 0; });
    d.engagements = d.engagements.filter(function(x){ return x.id !== id; });
    fermer(); Carnet.enregistrer(); Carnet.rendre();
  }

  function engagement(id){
    var d = D(), e = Carnet.parId(d.engagements, id);
    if (!e) return;
    if (C.estBusiness(e)) return modifierBusiness(id);
    var corps = cTexte("objet", "Objet", e.objet)
      + (e.tranches||[]).map(function(t, i){
          return '<div class="deux-champs">'
            + cDate("d" + i, "Tranche " + (i+1) + (t.etat === "payee" ? " (payée)" : ""), t.date || "")
            + cMontant("m" + i, "Montant", t.montant) + '</div>'; }).join("")
      + '<p class="intro">Reste dû : ' + F(C.resteEngagement(e)) + ' sur ' + F(C.totalEngagement(e))
      + '. Les tranches payées gardent leur trace.</p>';
    ouvrir("Modifier l'engagement", null, corps,
      '<button class="danger" onclick="Formulaires.supprimerSimple(\'engagements\',' + id + ')">Supprimer</button>'
      + ANNULER + valider("Formulaires.majEngagement(" + id + ")"));
  }
  function majEngagement(id){
    var d = D(), e = Carnet.parId(d.engagements, id);
    if (C.estBusiness(e)) return majBusiness(id);
    /* On travaille sur une copie : un refus ne doit rien avoir changé. */
    var tranches = e.tranches.map(function(t, i){
      var date = v("d" + i), m = mt("m" + i), c = {};
      for (var k in t) c[k] = t[k];
      c.date = date || null;
      if (m != null) c.montant = m;
      return c; });
    var refus = C.exigeUneDate("engagement", {tranches:tranches});
    if (refus) return erreur(refus);
    e.objet = (v("objet") || "").trim() || e.objet;
    e.tranches = tranches;
    fermer(); Carnet.enregistrer(); Carnet.rendre();
  }
  function participation(id){
    var d = D(), p = id ? Carnet.parId(d.participations, id) : null;
    if (!id) return nouveau(null, "placement");
    var corps = cTexte("objet", "L'affaire", p.objet)
      + cTexte("part", "Ma part", p.part)
      + cTexte("rythme", "Comment ça rapporte", p.rythme)
      + cMontant("mise", "Mise totale (XOF)", p.mise)
      + cMontant("recu", "Déjà reçu (XOF)", p.recu || 0)
      + cMontant("recuperee", "Dont mise récupérée (XOF)", p.miseRecuperee || 0)
      + cTexte("attendu", "Ce qu'on attend", p.attendu)
      + cDate("point", "Prochain point le", p.point || "", "Obligatoire.");
    ouvrir("Modifier la participation", null, corps,
      '<button class="danger" onclick="Formulaires.supprimerSimple(\'participations\',' + id + ')">Supprimer</button>'
      + ANNULER + valider("Formulaires.majParticipation(" + id + ")"));
  }
  function majParticipation(id){
    var p = Carnet.parId(D().participations, id);
    p.objet = (v("objet") || "").trim() || p.objet;
    p.part = (v("part") || "").trim(); p.rythme = (v("rythme") || "").trim();
    p.mise = mt("mise") || 0; p.recu = mt("recu") || 0; p.miseRecuperee = mt("recuperee") || 0;
    p.attendu = (v("attendu") || "").trim(); p.point = v("point") || null;
    var refus = C.exigeUneDate("participation", p);
    if (refus) return erreur(refus);
    fermer(); Carnet.enregistrer(); Carnet.rendre();
  }
  function opportunite(id, tiersId){
    var d = D(), o = id ? Carnet.parId(d.opportunites, id) : null;
    var corps = cTiers("tiers", o ? o.tiers : tiersId, "Pour qui", true)
      + cTexte("objet", "L'affaire", o ? o.objet : "", null, "Parc informatique 24 postes")
      + cMontant("base", "Montant de l'affaire (XOF)", o ? o.base : null)
      + '<div class="deux-champs">'
      + cNombre("taux", "Mon taux (%)", o ? o.taux : null)
      + cNombre("proba", "Chances (%)", o ? o.proba : 50) + '</div>'
      + cMontant("montant", "…ou commission au forfait (XOF)", o ? o.montant : null)
      + cTexte("action", "Prochaine action", o ? o.action : "", null, "Rappeler le DG")
      + cDate("date", "Le", o ? o.date : "", "Obligatoire : une affaire sans prochaine action datée s'oublie.");
    ouvrir(o ? "Modifier l'affaire espérée" : "Nouvelle affaire espérée", null, corps,
      (o ? '<button class="danger" onclick="Formulaires.supprimerSimple(\'opportunites\',' + id + ')">Supprimer</button>' : "")
      + ANNULER + valider("Formulaires.majOpportunite(" + (id || "null") + ")"));
  }
  function majOpportunite(id){
    var d = D();
    var objet = {tiers:lireTiers("tiers"), objet:(v("objet") || "").trim() || "Affaire",
      base:mt("base") || 0, taux:Number(v("taux") || 0), proba:Number(v("proba") || 0),
      montant:mt("montant") || 0, action:(v("action") || "").trim() || "Prochaine action",
      date:v("date") || null};
    var refus = C.exigeUneDate("opportunite", objet);
    if (refus) return erreur(refus);
    if (!objet.montant && !(objet.base && objet.taux))
      return erreur("Donne soit un montant et un taux, soit une commission au forfait.");
    var o = id ? Carnet.parId(d.opportunites, id) : null;
    if (o) { for (var k in objet) o[k] = objet[k]; }
    else { objet.id = C.nouvelId(d.opportunites); d.opportunites.push(objet); }
    fermer(); Carnet.enregistrer(); Carnet.rendre();
  }

  /* ========================================================== agir
     Ce qui se passe quand on touche une ligne de l'agenda : la bonne
     action pour la bonne nature, sans détour par un menu. */
  function agir(type, id, tranche){
    var d = D(), a = auj();
    if (type === "business") return business(id);
    if (type === "recurrent") {
      var c = Carnet.parId(d.recurrents, id);
      if (!c) return;
      if (!c.prochaine) return recurrent(id);
      var entree = c.sens === "entree";
      /* On montre le solde de chaque compte : c'est là qu'on voit lequel va
         être débité, et s'il a de quoi payer. */
      var comptesSoldes = (d.comptes||[]).map(function(k){
        return [k.id, k.nom + " — " + F(C.soldeCompte(d, k.id))]; }).concat([["", "Aucun compte"]]);
      /* Quelle échéance règle-t-on ? Si la prochaine est encore loin, on
         suppose qu'il s'agit d'une échéance déjà passée et on ne touche pas
         à la prochaine. L'erreur inverse — faire sauter une échéance à
         venir — est celle que ce carnet existe pour empêcher.
         Une échéance passée est proposée à SA date (le loyer d'octobre, le 5
         octobre) : si elle date d'avant l'ouverture du compte, son solde
         n'est pas touché, puisqu'il en tenait déjà compte. */
      var passee = C.jours(a, c.prochaine) > 10;
      var dateDefaut = passee ? datePassee(c) : a;
      /* Déjà un règlement ce mois-ci ? On le dit en tête, en rouge : un
         second paiement s'ajoute au premier, il ne le remplace pas. */
      var dejaRegles = C.reglementsDuMois(d, c.id, a);
      var alerteDouble = dejaRegles.length
        ? '<div class="erreur">Déjà ' + (entree ? 'reçu' : 'réglé') + ' ce mois-ci : '
          + dejaRegles.map(function(m){ return F(Math.abs(m.montant)) + ' le ' + C.jf(m.date).slice(0,5); }).join(', ')
          + '. Un nouveau paiement s\'ajoutera à celui-ci.</div>' : '';
      var corps = alerteDouble
        + cMontant("montant", entree ? "Montant reçu (XOF)" : "Montant payé (XOF)", c.montant, true)
        + cListe("echeance", "Quelle échéance ?", [
            ["prochaine", "Celle du " + C.jf(c.prochaine).slice(0,5) + " (suivante : "
              + C.jf(C.avancer(c.rythme, c.prochaine)).slice(0,5) + ")"],
            ["passee", "Une déjà passée (prochaine : " + C.jf(c.prochaine).slice(0,5) + ")"]],
            passee ? "passee" : "prochaine")
        + cDate("date", entree ? "Reçu le" : "Payée le", dateDefaut)
        + cListe("compte", entree ? "Compte qui reçoit" : "Compte débité", comptesSoldes, c.compte == null ? "" : c.compte)
        + '<p class="intro" id="info-debit"></p>'
        + (c.facultatif ? '<p class="intro">Cette aide n\'est pas une dette : si tu ne peux pas ce mois-ci, '
            + '« Pas ce mois-ci » décale la date sans rien faire sortir.</p>' : '');
      ouvrir(c.libelle, null, corps,
        (c.facultatif
          ? '<button onclick="Formulaires.passer(' + id + ')">Pas ce mois-ci</button>'
          : '<button onclick="Formulaires.recurrent(' + id + ')">Modifier</button>')
        + ANNULER + valider("Formulaires.reglerRecurrent(" + id + ")",
            entree ? "Encaissé" : c.facultatif ? "Envoyé" : "Payé"));
      /* Le message sous le compte suit ce qu'on choisit : échéance, date, compte. */
      el("f-echeance").addEventListener("change", function(){ echeanceChoisie(id); });
      el("f-date").addEventListener("change", function(){ infoDebit(id); });
      el("f-compte").addEventListener("change", function(){ infoDebit(id); });
      infoDebit(id);
    }
    else if (type === "engagement") {
      var e = Carnet.parId(d.engagements, id);
      if (!e) return;
      var creance = e.sens === "creance";
      var prochaine = (e.tranches||[]).filter(function(t){ return t.etat !== "payee"; })[0];
      var corps2 = cMontant("montant", "Montant versé (XOF)",
          prochaine ? prochaine.montant : C.resteEngagement(e), true)
        + cDate("date", "Date", a) + cCompte("compte", (d.comptes[0]||{}).id)
        + '<p class="intro">' + esc(e.objet) + ' — reste ' + F(C.resteEngagement(e)) + '. '
        + 'Un versement partiel coupe la tranche en deux : le reste dû reste exact.</p>';
      ouvrir(creance ? "Encaisser de " + (Carnet.nomTiers(e.tiers) || "?")
                     : "Payer " + (Carnet.nomTiers(e.tiers) || "?"), null, corps2,
        '<button onclick="Formulaires.engagement(' + id + ')">Modifier</button>'
        + ANNULER + valider("Formulaires.reglerEngagement(" + id + ")", creance ? "Encaissé" : "Payé"));
    }
    else if (type === "participation") {
      var p = Carnet.parId(d.participations, id);
      if (!p) return;
      var corps3 = cMontant("montant", "Montant reçu (XOF) — 0 si rien", 0, true)
        + cListe("genre", "C'est quoi ?", [["benefice","Un bénéfice (ma mise reste)"],
            ["retrait","Je retire une partie de ma mise"]], "benefice")
        + cCompte("compte", (d.comptes[0]||{}).id)
        + cDate("date", "Date du point", a)
        + cTexte("attendu", "Ce qu'on attend maintenant", p.attendu, null, "Partage du lot 4")
        + cDate("point", "Prochain point le", "", "Obligatoire, même si rien n'est tombé aujourd'hui.")
        + '<p class="intro">' + esc(p.objet) + ' — mise ' + F(p.mise) + ', reçu ' + F(p.recu||0) + '.</p>';
      ouvrir("Point sur l'affaire", null, corps3,
        ANNULER + valider("Formulaires.pointParticipation(" + id + ")", "Enregistrer le point"));
    }
    else if (type === "opportunite") {
      var o = Carnet.parId(d.opportunites, id);
      if (!o) return;
      var corps4 = cListe("suite", "Où en est-on ?", [
          ["repousse","Je recale la prochaine action"],
          ["gagnee","Commission encaissée"],
          ["perdue","Affaire perdue"]], "repousse")
        + cTexte("action", "Prochaine action", o.action)
        + cDate("date", "Le", "", "Obligatoire si tu recales.")
        + cMontant("montant", "Commission encaissée (XOF)", C.commission(o))
        + cCompte("compte", (d.comptes[0]||{}).id)
        + '<p class="intro">' + esc(o.objet) + ' — espéré ' + F(C.commission(o)) + '.</p>';
      ouvrir("Suite de l'affaire", null, corps4,
        ANNULER + valider("Formulaires.suiteOpportunite(" + id + ")"));
    }
  }
  /* La date d'une échéance déjà passée : l'occurrence d'avant la prochaine,
     sans jamais tomber dans le futur. */
  function datePassee(c){
    var p = C.reculer(c.rythme, c.prochaine);
    return p && p <= auj() ? p : auj();
  }
  function echeanceChoisie(id){
    var c = Carnet.parId(D().recurrents, id);
    if (!c) return;
    el("f-date").value = v("echeance") === "passee" ? datePassee(c) : auj();
    infoDebit(id);
  }
  /* Dire avant de valider ce qui va arriver au compte. Une dépense datée
     d'avant l'ouverture du compte ne le touche pas : le solde saisi à
     l'ouverture en tenait déjà compte. */
  function infoDebit(id){
    var z = el("info-debit"), c = Carnet.parId(D().recurrents, id);
    if (!z || !c) return;
    var compte = Carnet.parCompte(lireCompte("compte")), date = v("date") || auj();
    var entree = c.sens === "entree";
    if (!compte) z.textContent = "Aucun compte ne sera touché.";
    else if (compte.depuis && date < compte.depuis)
      z.textContent = compte.nom + " ne sera pas touché : son solde, saisi le " + C.jf(compte.depuis).slice(0,5)
        + ", tient déjà compte de ce qui a été " + (entree ? "reçu" : "payé") + " avant. "
        + "La ligne sera quand même comptée dans le mois.";
    else z.textContent = compte.nom + " sera " + (entree ? "crédité" : "débité") + " de ce montant.";
  }
  function reglerRecurrent(id){
    var m = mt("montant");
    if (!m) return erreur("Il manque le montant.");
    var date = v("date") || auj(), compte = lireCompte("compte"), avance = v("echeance") !== "passee";
    fermer(); Carnet.reglerRecurrent(id, m, date, compte, avance);
  }
  function passer(id){ fermer(); Carnet.passerRecurrent(id); }

  /* Le règlement du mois d'une ligne déjà réglée : ce qui a été noté, sur
     quel compte, et le moyen de l'annuler. Ouvert par la mention verte. */
  function reglement(id){
    var d = D(), c = Carnet.parId(d.recurrents, id);
    if (!c) return;
    var faits = C.reglementsDuMois(d, id, auj());
    if (!faits.length) return agir("recurrent", id, null);
    var entree = c.sens === "entree";
    var corps = faits.map(function(m){
        var compte = Carnet.parCompte(m.compte);
        return '<div class="bloc"><div class="haut-bloc"><span class="objet">Le ' + C.jf(m.date) + '</span>'
          + '<span class="montant ' + (m.montant > 0 ? 'plus' : 'moins') + '">' + (m.montant > 0 ? '+' : '−') + F(Math.abs(m.montant)) + '</span></div>'
          + '<p class="sous-bloc">' + (compte ? esc(compte.nom)
              + (C.dansLeSolde(d, m) ? (entree ? ' — crédité' : ' — débité')
                 : ' — non touché : son solde en tenait déjà compte') : 'Aucun compte touché') + '</p>'
          + '<div class="actions"><button class="danger" onclick="Formulaires.annulerReglement(' + m.id + ')">Annuler ce règlement</button></div></div>';
      }).join("")
      + (faits.length > 1 ? '<div class="erreur">' + faits.length + ' règlements ce mois-ci pour la même ligne. '
          + 'Si c\'est une erreur, annule celui qui est en trop.</div>' : '')
      + '<p class="intro">Annuler rend l\'argent au compte et remet la ligne « à payer ».</p>';
    ouvrir(c.libelle, (entree ? "Reçu" : "Réglé") + " ce mois-ci", corps,
      '<button onclick="Formulaires.agir(\'recurrent\',' + id + ',null)">Noter un autre paiement</button>'
      + '<button class="principal" onclick="Formulaires.fermer()">Fermer</button>');
  }
  function annulerReglement(idMouvement){ fermer(); Carnet.annulerReglement(idMouvement); }
  function reglerEngagement(id){
    var m = mt("montant");
    if (!m) return erreur("Il manque le montant.");
    var date = v("date") || auj(), compte = lireCompte("compte");
    fermer(); Carnet.reglerEngagement(id, m, date, compte);
  }
  function pointParticipation(id){
    var d = D(), p = Carnet.parId(d.participations, id);
    var m = mt("montant") || 0;
    if (!v("point")) return erreur("Donne la date du prochain point : c'est tout l'intérêt.");
    if (m > 0) {
      var retrait = v("genre") === "retrait";
      p.recu = (p.recu || 0) + m;
      if (retrait) p.miseRecuperee = (p.miseRecuperee || 0) + m;
      Carnet.ajouterMouvement({date:v("date") || auj(), tiers:p.tiers,
        libelle:(retrait ? "Retrait de mise — " : "Part reçue — ") + p.objet,
        montant:m, compte:lireCompte("compte"), nature:"part", cat:"Affaires", participation:p.id});
    }
    p.attendu = (v("attendu") || "").trim() || p.attendu;
    p.point = v("point");
    fermer(); Carnet.enregistrer(); Carnet.rendre();
  }
  function suiteOpportunite(id){
    var d = D(), o = Carnet.parId(d.opportunites, id), suite = v("suite");
    if (suite === "repousse") {
      if (!v("date")) return erreur("Sans nouvelle date, l'affaire s'oublie.");
      o.action = (v("action") || "").trim() || o.action;
      o.date = v("date");
    } else if (suite === "gagnee") {
      var m = mt("montant");
      if (!m) return erreur("Il manque le montant encaissé.");
      Carnet.ajouterMouvement({date:auj(), tiers:o.tiers, libelle:"Commission — " + o.objet,
        montant:m, compte:lireCompte("compte"), nature:"recette", cat:"Affaires"});
      d.opportunites = d.opportunites.filter(function(x){ return x.id !== id; });
    } else {
      d.opportunites = d.opportunites.filter(function(x){ return x.id !== id; });
    }
    fermer(); Carnet.enregistrer(); Carnet.rendre();
  }

  /* ================================================ sauvegarde chiffrée
     AES-GCM, clé dérivée de la phrase de passe par PBKDF2-SHA256.
     La phrase ne quitte jamais le téléphone et n'est stockée nulle part :
     sans elle, le fichier est illisible, y compris par moi. */
  /* 600 000 tours : la recommandation actuelle pour PBKDF2-SHA256. Le nombre
     de tours est écrit dans chaque sauvegarde, donc celles faites avec
     l'ancien réglage (210 000) se relisent toujours. */
  var ITERATIONS = 600000;
  function b64(buf){
    var o = "", u = new Uint8Array(buf);
    for (var i = 0; i < u.length; i++) o += String.fromCharCode(u[i]);
    return btoa(o);
  }
  function deB64(s){
    var b = atob(s), u = new Uint8Array(b.length);
    for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
    return u;
  }
  function cle(phrase, sel){
    var enc = new TextEncoder();
    return crypto.subtle.importKey("raw", enc.encode(phrase), "PBKDF2", false, ["deriveKey"])
      .then(function(k){
        return crypto.subtle.deriveKey(
          {name:"PBKDF2", salt:sel, iterations:ITERATIONS, hash:"SHA-256"},
          k, {name:"AES-GCM", length:256}, false, ["encrypt","decrypt"]);
      });
  }
  function chiffrer(objet, phrase){
    var sel = crypto.getRandomValues(new Uint8Array(16));
    var iv = crypto.getRandomValues(new Uint8Array(12));
    return cle(phrase, sel).then(function(k){
      return crypto.subtle.encrypt({name:"AES-GCM", iv:iv}, k,
        new TextEncoder().encode(JSON.stringify(objet)));
    }).then(function(chiffre){
      return JSON.stringify({format:"clauvis-carnet-chiffre-1", iterations:ITERATIONS,
        sel:b64(sel), iv:b64(iv), donnees:b64(chiffre)}, null, 1);
    });
  }
  function dechiffrer(texte, phrase){
    var p = JSON.parse(texte);
    if (!p.format || p.format.indexOf("clauvis-carnet-chiffre") !== 0)
      return Promise.reject(new Error("Ce fichier n'est pas une sauvegarde du carnet."));
    var sel = deB64(p.sel), iv = deB64(p.iv);
    var enc = new TextEncoder();
    return crypto.subtle.importKey("raw", enc.encode(phrase), "PBKDF2", false, ["deriveKey"])
      .then(function(k){
        return crypto.subtle.deriveKey(
          {name:"PBKDF2", salt:sel, iterations:p.iterations || ITERATIONS, hash:"SHA-256"},
          k, {name:"AES-GCM", length:256}, false, ["decrypt"]);
      })
      .then(function(k){ return crypto.subtle.decrypt({name:"AES-GCM", iv:iv}, k, deB64(p.donnees)); })
      .then(function(clair){ return JSON.parse(new TextDecoder().decode(clair)); });
  }

  function exporter(){
    var corps = '<label class="champ">Phrase de passe'
      + '<input id="f-phrase" type="password" autocomplete="new-password" placeholder="au moins 10 caractères">'
      + '<span class="aide">Choisis-en une dont tu te souviendras : personne ne peut te la redonner, '
      + 'moi non plus. Sans elle, la sauvegarde est définitivement illisible.</span></label>'
      + '<label class="champ">Répète-la<input id="f-phrase2" type="password" autocomplete="new-password"></label>';
    ouvrir("Sauvegarder le carnet", "Un texte chiffré que tu peux garder où tu veux.",
      corps, ANNULER + valider("Formulaires.lancerExport()", "Chiffrer"));
  }
  function lancerExport(){
    var p1 = v("phrase"), p2 = v("phrase2");
    if (!p1 || p1.length < 10) return erreur("Au moins 10 caractères : c'est la seule chose qui protège tes comptes.");
    if (p1 !== p2) return erreur("Les deux phrases ne sont pas identiques.");
    chiffrer(D(), p1).then(function(texte){
      D().reglages.dernierExport = auj();
      Carnet.enregistrer(true);
      montrerSauvegarde(texte);
    }).catch(function(e){ erreur("Chiffrement impossible : " + (e && e.message ? e.message : e)); });
  }
  /* Deux chemins de sortie, parce que le téléchargement est bloqué dans
     certains contextes (page intégrée) : le fichier quand c'est possible,
     et toujours le texte, copiable à la main. */
  function montrerSauvegarde(texte){
    var corps = '<p class="intro">Chiffré. Copie ce texte dans un fichier, ou télécharge-le, '
      + 'et dépose-le où tu veux : Mac, clé USB, Nextcloud. Il est illisible sans ta phrase.</p>'
      + '<textarea class="secret" id="f-sauvegarde" readonly>' + esc(texte) + '</textarea>';
    ouvrir("Sauvegarde du " + C.jf(auj()), null, corps,
      '<button onclick="Formulaires.copierSauvegarde()">Copier</button>'
      + '<button onclick="Formulaires.telechargerSauvegarde()">Télécharger</button>'
      + '<button class="principal" onclick="Formulaires.fermer()">Terminé</button>');
    window._sauvegarde = texte;
  }
  function copierSauvegarde(){
    var t = el("f-sauvegarde");
    try {
      navigator.clipboard.writeText(window._sauvegarde).then(function(){
        Carnet.toast("Sauvegarde copiée");
      }).catch(function(){ t.select(); Carnet.toast("Copie refusée : le texte est sélectionné, fais Copier"); });
    } catch (e) { t.select(); Carnet.toast("Le texte est sélectionné, fais Copier"); }
  }
  /* Trois contextes, trois chemins :
     — page publiée dans Claude : le téléchargement direct y est interdit, la
       page doit le demander à son hôte, qui montre une confirmation ;
     — app installée ou servie par un hébergeur : lien de téléchargement normal ;
     — partout : le bouton Copier, qui marche toujours.
     L'extension est .json parce que c'est la seule que l'hôte accepte pour ce
     genre de fichier ; le contenu reste chiffré. */
  function telechargerSauvegarde(){
    var nom = "carnet-" + auj() + ".json", texte = window._sauvegarde;
    if (window.claude && typeof window.claude.use === "function") {
      window.claude.use("downloads").then(function(dl){
        if (!dl) return Carnet.toast("Téléchargement indisponible ici : utilise Copier");
        return dl.save({filename:nom, data:texte}).then(function(){
          Carnet.toast("Sauvegarde enregistrée");
        });
      }).catch(function(e){
        Carnet.toast(e && e.code === "declined"
          ? "Enregistrement annulé — le texte reste copiable"
          : "Enregistrement impossible ici : utilise Copier");
      });
      return;
    }
    try {
      var blob = new Blob([texte], {type:"application/json"});
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = nom;
      document.body.appendChild(a); a.click(); a.remove();
      Carnet.toast("Sauvegarde téléchargée");
    } catch (e) { Carnet.toast("Téléchargement refusé ici : utilise Copier"); }
  }

  function importer(){
    var corps = '<p class="intro">Choisis le fichier ou colle son texte. Une sauvegarde chiffrée '
      + 'remplace entièrement le carnet de cet appareil et coupe sa synchronisation, pour que tu '
      + 'choisisses ensuite quel carnet fait foi. Un fichier de départ (tes charges fixes, en clair) '
      + 'se charge sans phrase de passe, sur un carnet encore vide.</p>'
      + '<label class="champ">Fichier<input id="f-fichier" type="file" accept=".carnet,.json,.txt"></label>'
      + '<textarea class="secret" id="f-texte" placeholder="…ou colle ici le texte chiffré"></textarea>'
      + '<label class="champ">Phrase de passe<input id="f-phrase" type="password" autocomplete="current-password"></label>';
    ouvrir("Restaurer une sauvegarde", null, corps,
      ANNULER + valider("Formulaires.lancerImport()", "Restaurer"));
    el("f-fichier").addEventListener("change", function(ev){
      var f = ev.target.files && ev.target.files[0];
      if (!f) return;
      var r = new FileReader();
      r.onload = function(){ el("f-texte").value = r.result; Carnet.toast("Fichier lu"); };
      r.readAsText(f);
    });
  }
  /* Un fichier de départ est en clair et ne contient que des lignes qui
     reviennent : il ne se charge que sur un carnet où rien n'a encore été
     noté. Sur un carnet vivant, il effacerait des mouvements réels — pour
     ça il y a la sauvegarde chiffrée, qui reprend tout. */
  function estFichierDeDepart(o){
    return o && !o.format && !o.version && (o.recurrents || o.enveloppes || o.tiers);
  }
  function lancerImport(){
    var texte = (v("texte") || "").trim(), phrase = v("phrase");
    if (!texte) return erreur("Colle le texte de la sauvegarde, ou choisis le fichier.");
    var brut = null;
    try { brut = JSON.parse(texte); } catch (e) { return erreur("Ce texte n'est pas un fichier du carnet."); }
    if (estFichierDeDepart(brut)) {
      if ((D().mouvements || []).length)
        return erreur("Un fichier de départ ne se charge que sur un carnet vide : celui-ci a déjà des mouvements.");
      var defautsDepart = C.defautsCarnet(brut, {depart:true});
      if (defautsDepart.length) return erreur("Ce fichier n'est pas sûr à charger : " + defautsDepart[0] + ".");
      var comptes = D().comptes;
      fermer();
      var neuf = Carnet.donneesInitiales(auj(), brut);
      neuf.comptes = comptes;                       // ce qu'il a déjà dit avoir en caisse reste
      Carnet.remplacerDonnees(neuf, {marquer:true}).then(function(){ Carnet.toast("Données de départ chargées"); });
      return;
    }
    if (!phrase) return erreur("Il faut la phrase de passe.");
    dechiffrer(texte, phrase).then(function(objet){
      if (!objet || !objet.version) throw new Error("Contenu inattendu.");
      var defauts = C.defautsCarnet(objet);
      if (defauts.length) throw new Error("Contenu refusé : " + defauts[0] + ".");
      fermer();
      Carnet.remplacerDonnees(objet).then(function(){ Carnet.toast("Carnet restauré"); });
    }).catch(function(e){
      erreur("Impossible d'ouvrir : phrase fausse, ou fichier abîmé. (" 
        + (e && e.message ? e.message : e) + ")");
    });
  }

  /* ------------------------------------------------------------- verrou
     Ici, seulement la feuille qui pose ou change le code. Tout le reste —
     Face ID, l'écran de verrou, le rideau — vit dans verrou.js. */
  function verrou(){
    var actif = !!D().reglages.verrou;
    var corps = '<label class="champ">' + (actif ? "Nouveau code" : "Code à 4 chiffres ou plus")
      + '<input id="f-code" type="password" inputmode="numeric" autocomplete="off"></label>'
      + '<p class="intro">Le code est le secours de Face ID : si le visage ne passe pas, c\'est lui '
      + 'qui ouvre. Si tu l\'oublies aussi, il faudra effacer le carnet et restaurer ta sauvegarde.</p>';
    ouvrir("Code du carnet", null, corps,
      (actif ? '<button class="danger" onclick="Formulaires.retirerVerrou()">Tout retirer</button>' : "")
      + ANNULER + valider("Formulaires.majVerrou()"));
  }
  function majVerrou(){
    var code = (v("code") || "").trim();
    if (code.length < 4) return erreur("Au moins 4 chiffres.");
    Verrou.empreinte(code).then(function(h){
      D().reglages.verrou = h;
      fermer(); Carnet.enregistrer(); Carnet.rendre();
    });
  }
  /* Retirer le code retire aussi Face ID : sans secours, un visage qui ne
     passe plus enfermerait le carnet. */
  function retirerVerrou(){
    D().reglages.verrou = null;
    D().reglages.biometrie = null;
    fermer(); Carnet.enregistrer(); Carnet.rendre();
  }

  function effacer(){
    var corps = '<p class="intro">Ceci vide le carnet de CET appareil : mouvements, tiers, engagements, '
      + 'affaires. Ça ne se défait pas. La synchronisation est coupée d\'abord : l\'autre appareil '
      + 'et le dépôt ne sont pas touchés.</p>'
      + cTexte("confirme", "Écris EFFACER pour confirmer", "", null, "EFFACER");
    ouvrir("Tout effacer", null, corps,
      ANNULER + '<button class="danger" onclick="Formulaires.lancerEffacer()">Effacer</button>');
  }
  function lancerEffacer(){
    if ((v("confirme") || "").trim().toUpperCase() !== "EFFACER")
      return erreur("Écris EFFACER en entier.");
    fermer(); Carnet.supprimerTout();
  }

  /* Toute suppression peut être reprise pendant quelques secondes. On
     photographie le carnet avant, on laisse la suppression se faire, et on
     propose « Annuler » — seulement si quelque chose a vraiment été supprimé. */
  function annulable(libelle, supprimer){
    return function(){
      var avant = Carnet.instantane();
      var retour = supprimer.apply(null, arguments);
      Carnet.proposerAnnulation(avant, libelle);
      return retour;
    };
  }

  return {
    fermer:fermer, toucheVoile:toucheVoile,
    /* la mécanique des feuilles, pour les modules qui ont leurs propres formulaires */
    feuille:ouvrir, erreur:erreur, valeur:v, ANNULER:ANNULER,
    plus:plus, menuDuPlus:menuDuPlus, nouveau:nouveau, enregistrerNouveau:enregistrerNouveau,
    mouvement:mouvement, majMouvement:majMouvement, supprimerMouvement:annulable("Ligne supprimée", supprimerMouvement),
    tiers:tiers, personnes:personnes, majTiers:majTiers, supprimerTiers:annulable("Personne supprimée", supprimerTiers),
    recurrent:recurrent, majRecurrent:majRecurrent, supprimerRecurrent:annulable("Ligne fixe supprimée", supprimerRecurrent),
    enveloppe:enveloppe, majEnveloppe:majEnveloppe, supprimerEnveloppe:annulable("Enveloppe supprimée", supprimerEnveloppe),
    comptes:comptes, majComptes:majComptes, pointer:pointer, majPointage:majPointage,
    bien:bien, majBien:majBien, credit:credit, majSimple:majSimple, supprimerSimple:annulable("Supprimé", supprimerSimple),
    categories:categories, majCategories:majCategories,
    engagement:engagement, majEngagement:majEngagement,
    affaire:affaire, creerAffaire:creerAffaire, supprimerAffaire:annulable("Business supprimé", supprimerAffaire),
    business:business, validerBusiness:validerBusiness, majBusiness:majBusiness,
    participation:participation, majParticipation:majParticipation,
    opportunite:opportunite, majOpportunite:majOpportunite,
    agir:agir, reglerRecurrent:reglerRecurrent, passer:passer,
    echeanceChoisie:echeanceChoisie, infoDebit:infoDebit,
    reglement:reglement, annulerReglement:annulerReglement, ajusterAuClavier:ajusterAuClavier,
    reglerEngagement:reglerEngagement,
    pointParticipation:pointParticipation, suiteOpportunite:suiteOpportunite,
    exporter:exporter, lancerExport:lancerExport, copierSauvegarde:copierSauvegarde,
    telechargerSauvegarde:telechargerSauvegarde, importer:importer, lancerImport:lancerImport,
    verrou:verrou, majVerrou:majVerrou, retirerVerrou:retirerVerrou,
    effacer:effacer, lancerEffacer:lancerEffacer
  };
})();
