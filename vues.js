/* Clauvi's Carnet — les écrans.
   Chaque fonction rend du HTML à partir des données et des calculs ; aucune
   ne modifie quoi que ce soit. Toute action passe par Carnet.* ou
   Formulaires.*, pour qu'on sache toujours qui écrit dans le carnet. */

var Vues = (function(){
  "use strict";
  var C = Calculs;
  function D(){ return Carnet.donnees(); }
  function auj(){ return Carnet.etat().auj; }
  var esc = function(s){ return Carnet.esc(s); };
  var F = function(n){ return C.F(n); };

  /* Une ligne de l'agenda : qui, quoi, quand, combien, et quoi faire.
     Le libellé du haut est le tiers quand il y en a un — c'est le nom
     qu'on cherche — sinon l'objet de la ligne. */
  function ligneAgenda(x){
    var nomT = x.tiers ? Carnet.nomTiers(x.tiers) : null;
    var retard = x.date && C.jours(auj(), x.date) < 0;
    var sortie = C.aSortir(x);
    /* Une aide facultative s'affiche en gris : elle sort peut-être, elle n'est
       pas due. Le rouge est réservé à ce qu'on doit vraiment. */
    var signe = x.genre === "encaisser" ? "plus" : sortie ? "moins" : "neutre";
    var prefixe = x.genre === "encaisser" ? "+" : (sortie || C.estAide(x)) ? "−" : "";
    var bande = retard ? "retard" : !x.date ? "sans-date"
      : x.genre === "charge" ? "charge" : x.genre === "encaisser" ? "entree" : "";
    /* Sur un téléphone, une étiquette à côté du montant ne laisse plus la
       place d'écrire le nom. Le nom a donc toute la ligne ; la date et la
       nature passent dessous. Seul le retard garde son étiquette, parce que
       c'est la seule chose qu'on ne doit pas pouvoir rater. */
    var nature = x.genre === "aide" ? "si je peux · " : x.genre === "point" ? "point à faire · "
      : x.genre === "action" ? "à faire · " : x.genre === "etape" ? "étape · " : "";
    return '<button class="ligne" onclick="Formulaires.agir(\'' + x.ref.type + '\',' + x.ref.id
      + ',' + (x.ref.tranche == null ? "null" : x.ref.tranche) + ')">'
      + '<i class="bande ' + bande + '"></i>'
      + '<span class="corps"><span class="nom">' + esc(nomT || x.titre) + '</span>'
      + '<span class="sous">' + esc(C.quand(x.date, auj())) + ' · ' + nature
      + esc(nomT ? x.titre : x.detail) + '</span></span>'
      + (retard ? '<span class="jeton retard">retard</span>' : '')
      + (x.montant ? '<span class="montant ' + signe + '">' + prefixe + F(x.montant) + '</span>' : '')
      + '</button>';
  }

  function listeOuVide(items, rendu, vide){
    return items.length ? '<div class="liste">' + items.map(rendu).join("") + '</div>'
                        : '<div class="vide">' + vide + '</div>';
  }

  /* ------------------------------------------------------ sections repliées
     La règle de tous les écrans : à l'ouverture, les chiffres clés et une
     ligne par rubrique avec son compteur — rien d'autre. Le détail s'ouvre au
     toucher. Un écran qui montre tout d'un coup ne montre rien : on ne voit
     plus ce qui compte au milieu du reste.
     L'état ouvert/fermé est gardé par l'app (Carnet.etat().ouverts), sinon
     chaque enregistrement refermerait la rubrique dans laquelle on travaille. */
  /* Sur un grand écran il y a la place : les rubriques de l'accueil s'ouvrent
     d'elles-mêmes (option « grand »), puisque c'est le tableau de bord. Un
     choix explicite — ouvrir ou refermer — l'emporte toujours. */
  function grandEcran(){
    return typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(min-width: 900px)").matches;
  }
  function section(id, titre, contenu, o){
    o = o || {};
    var choix = Carnet.etat().ouverts[id];
    var ouverte = choix == null ? (!!o.grand && grandEcran()) : choix;
    return '<details class="section' + (o.alerte ? ' alerte' : '') + '" data-section="' + id + '"'
      + (ouverte ? ' open' : '') + '>'
      + '<summary><span class="s-titre">' + esc(titre) + '</span>'
      + (o.resume ? '<span class="s-resume">' + o.resume + '</span>' : '')
      + (o.compteur != null ? '<span class="pastille">' + o.compteur + '</span>' : '')
      + '</summary><div class="s-corps">' + contenu + '</div></details>';
  }
  /* Deux colonnes sur grand écran : les chiffres clés à gauche, les rubriques
     à droite. Sur un téléphone, les deux se suivent simplement. La coupure
     est posée par chaque écran, juste avant sa première rubrique. */
  var COUPE = "<!--rubriques-->";
  function colonnes(h){
    var i = h.indexOf(COUPE);
    if (i < 0) return h;
    return '<div class="colonnes"><div class="col-tete">' + h.slice(0, i) + '</div>'
      + '<div class="col-corps">' + h.slice(i + COUPE.length) + '</div></div>';
  }

  /* Une ligne du résumé : un libellé, un chiffre, parfois une précision dessous. */
  function rang(libelle, montant, classe, precision){
    return '<div class="rang"><span class="lib">' + esc(libelle)
      + (precision ? '<span class="petit">' + precision + '</span>' : '') + '</span>'
      + '<b class="' + (classe || '') + '">' + montant + '</b></div>';
  }
  /* Un chiffre du résumé qu'on peut toucher pour voir de quoi il est fait.
     C'est la règle des chiffres clés : aucun ne doit être un mur. Un total
     qu'on ne peut pas ouvrir est un total qu'on ne peut pas vérifier. */
  function rangDetail(id, libelle, montant, classe, precision, contenu){
    return '<details class="rang-detail" data-section="' + id + '"' + (Carnet.etat().ouverts[id] ? ' open' : '') + '>'
      + '<summary class="rang"><span class="lib"><span class="t">' + esc(libelle) + '</span>'
      + (precision ? '<span class="petit">' + precision + '</span>' : '') + '</span>'
      + '<b class="' + (classe || '') + '">' + montant + '</b></summary>'
      + '<div class="r-corps">' + contenu + '</div></details>';
  }
  function bouton(texte, action, principal){
    return '<div class="actions"><button' + (principal ? ' class="principal"' : '') + ' onclick="' + action + '">'
      + esc(texte) + '</button></div>';
  }

  /* ----------------------------------------------------------- accueil
     Un tableau de bord : ce que j'ai, un chiffre par onglet, puis quoi faire.
     L'accueil ne répète pas les onglets, il les résume — chaque tuile y mène —
     et il dit par où commencer : les suggestions sont rangées par urgence et
     chacune porte le geste qui la règle. Cinq au plus à l'écran ; le reste
     est replié, comme partout. */
  var VUES_MAX = 5;
  function tuile(vue, nom, chiffre, classe, sous){
    return '<button class="tuile" onclick="Carnet.aller(\'' + vue + '\')"><span class="t-nom">' + nom + '</span>'
      + '<b class="' + (classe || '') + '">' + chiffre + '</b><span class="t-sous">' + sous + '</span></button>';
  }
  function actionDe(ref){
    if (ref.type === "reglement") return "Formulaires.reglement(" + ref.id + ")";
    if (ref.type === "aller") return "Carnet.aller('" + ref.id + "')";
    if (ref.type === "enveloppe") return "Formulaires.enveloppe(" + ref.id + ")";
    if (ref.type === "confirmer") return "Formulaires.recurrent(" + ref.id + ")";
    if (ref.type === "echeancier") return "Formulaires.engagement(" + ref.id + ")";
    if (ref.type === "business") return "Formulaires.business(" + ref.id + ")";
    if (ref.type === "pointer") return "Formulaires.pointer()";
    if (ref.type === "exporter") return "Formulaires.exporter()";
    return "Formulaires.agir('" + ref.type + "'," + ref.id + "," + (ref.tranche == null ? "null" : ref.tranche) + ")";
  }
  /* Une suggestion : à gauche de quoi il s'agit, à droite le montant et le
     verbe. Toute la ligne est le bouton — le verbe dit ce qui va s'ouvrir. */
  function ligneSuggestion(s){
    var nomT = s.tiers ? Carnet.nomTiers(s.tiers) : null;
    var urgent = s.rang <= 2;
    var bande = s.rang === 1 ? "retard" : urgent ? "sans-date" : s.genre === "encaisser" ? "entree"
      : s.rang === 3 ? "charge" : "";
    var signe = s.genre === "encaisser" ? "plus" : (s.genre === "charge" || s.genre === "payer") ? "moins" : "neutre";
    var prefixe = s.genre === "encaisser" ? "+" : (signe === "moins" || s.genre === "aide") ? "−" : "";
    return '<button class="ligne suggestion" onclick="' + actionDe(s.ref) + '"><i class="bande ' + bande + '"></i>'
      + '<span class="corps"><span class="nom">' + esc(nomT || s.titre) + '</span>'
      + '<span class="sous">' + esc((nomT ? s.titre + " · " : "") + s.detail
          + (s.genre === "aide" ? " · si je peux" : "")) + '</span></span>'
      + '<span class="cote">'
      + (s.montant ? '<span class="montant ' + signe + '">' + prefixe + F(s.montant) + '</span>' : '')
      + '<span class="faire' + (urgent ? ' retard' : '') + '">' + esc(s.verbe) + '</span></span></button>';
  }

  /* La mention sous un total fixe : une jauge, et « tout est perçu » en vert
     ou le taux avec ce qui reste. Elle doit se lire sans calcul. */
  function avancement(x, mot, rien){
    if (!x.prevu) return rien;
    return '<span class="jauge' + (x.complet ? ' pleine' : '') + '"><i style="width:' + x.taux + '%"></i></span>'
      + (x.complet ? '<span class="mention ok">✓ tout est ' + mot + '</span>'
                   : '<span class="mention">' + mot + ' à ' + x.taux + ' % · reste ' + F(x.reste) + '</span>');
  }

  function accueil(){
    var d = D(), a = auj();
    var rv = C.resteAVivre(d, a);
    var tout = C.agenda(d);
    var semaine = tout.filter(function(x){ var j = C.jours(a, x.date); return j >= 0 && j <= 7; });
    var avenir = tout.filter(function(x){ var j = C.jours(a, x.date); return j > 7 && j <= 30; });
    var som = function(l, f){ return l.filter(f).reduce(function(s,x){ return s + (x.montant||0); }, 0); };
    var entrant = function(x){ return x.genre === "encaisser"; };
    var h = "";

    /* Les premiers gestes, tant que le carnet n'a rien : une seule carte. */
    var sansCharges = !(d.recurrents||[]).length && !(d.mouvements||[]).length;
    if (Carnet.debutant() || sansCharges) {
      h += '<div class="bloc"><p class="objet">' + (Carnet.debutant() ? 'Le carnet est prêt, il est vide'
          : 'Tes charges fixes ne sont pas encore là') + '</p><div class="actions">'
        + (Carnet.debutant() ? '<button class="principal" onclick="Formulaires.comptes()">Ce que j\'ai en caisse</button>' : '')
        + (sansCharges ? '<button onclick="Formulaires.importer()">Charger mon fichier de départ</button>' : '')
        + '</div></div>';
    }

    /* Les anomalies passent avant tout, mais en une ligne chacune. */
    C.incoherences(d).forEach(function(i){
      h += '<button class="alerte-ligne" onclick="' + (i.tiers ? 'Carnet.ouvrirTiers(' + i.tiers + ')' : 'Carnet.aller(\'tiers\')') + '">'
        + esc(Carnet.nomTiers(i.tiers) || "Un engagement") + ' : ' + esc(i.objet) + ' ne tombe pas juste'
        + '<span class="petit">Mouvements ' + F(i.parMouvements) + ', échéancier ' + F(i.parTranches)
        + '. Ouvre la fiche pour corriger.</span></button>';
    });
    C.comptesImpossibles(d).forEach(function(c){
      h += '<button class="alerte-ligne" onclick="Formulaires.pointer()">' + esc(c.nom) + ' à ' + F(c.solde)
        + ' : c\'est impossible<span class="petit">Il manque une entrée. Touche ici et compte ce que tu as.</span></button>';
    });

    /* Ce que j'ai : le seul chiffre qui s'ouvre ici, compte par compte. */
    var dernier = (d.pointages||[]).slice(-1)[0];
    var detailCaisse = (d.comptes||[]).map(function(c){
        return '<div class="rang fin"><span class="lib">' + esc(c.nom) + '</span><b>' + F(C.soldeCompte(d, c.id)) + '</b></div>'; }).join("")
      + (rv.aSortir ? '<div class="rang fin"><span class="lib">À sortir d\'ici le ' + C.finDuMois(a).slice(8,10)
          + '<span class="petit">' + F(rv.datees) + ' de lignes datées'
          + (rv.enveloppes ? ' + ' + F(rv.enveloppes) + ' d\'enveloppes' : '') + '</span></span>'
          + '<b class="moins">' + F(rv.aSortir) + '</b></div>' : '')
      + '<p class="sous-bloc">' + (dernier ? 'Espèces comptées le ' + C.jf(dernier.date)
          + (C.jours(dernier.date, a) > 7 ? ', il y a ' + C.jours(dernier.date, a) + ' jours.' : '.')
          : 'Espèces jamais comptées.') + '</p>'
      + '<div class="actions"><button onclick="Formulaires.pointer()">J\'ai compté</button>'
      + '<button onclick="Formulaires.comptes()">Modifier</button></div>';
    /* Le coup d'œil : ce qui devait rentrer et sortir de fixe ce mois-ci, et
       où on en est. Une mention verte quand tout est là, sinon le taux. */
    var av = C.avancementFixes(d, a);
    h += '<div class="resume">'
      + rangDetail("accueil.caisse", "Ce que j'ai", F(rv.liquidites), "",
          rv.aSortir ? 'reste à vivre ' + F(rv.reste) : '', detailCaisse)
      + rangDetail("accueil.revenus", "Revenus fixes du mois", F(av.revenus.prevu), "plus",
          avancement(av.revenus, "perçu", "aucun revenu fixe ce mois"),
          listeOuVide(C.fileDAttente(av.revenus.lignes, a), ligneRecurrent, "Aucun revenu fixe attendu ce mois-ci."))
      + rangDetail("accueil.charges", "Charges fixes du mois", F(av.charges.prevu), "moins",
          avancement(av.charges, "réglé", "aucune charge fixe ce mois"),
          listeOuVide(C.fileDAttente(av.charges.lignes, a), ligneRecurrent, "Aucune charge fixe ce mois-ci."))
      + '</div>';

    /* Un chiffre par onglet. La tuile mène à l'onglet : le détail y est. */
    var bm = C.bilanDuMois(d, a), p = C.patrimoine(d);
    var aPayer = (d.recurrents||[]).filter(function(c){
      return c.sens !== "entree" && !c.facultatif && !C.regleeCeMois(c, a); }).length;
    var biz = C.business(d);
    h += '<div class="tuiles">'
      + tuile("depenses", "Dépenses", F(bm.sorti), "moins",
          'sortis ce mois · ' + (aPayer ? aPayer + ' à payer' : 'tout est réglé'))
      + tuile("tiers", "Tiers", F(p.creances), "plus", 'on me doit · je dois ' + F(p.dettes))
      + tuile("affaires", "Business", F(biz.aEncaisser), "plus",
          'opportunités validées' + (biz.annonce ? ' · ' + F(biz.annonce) + ' en opportunités' : ''))
      + tuile("patrimoine", "Patrimoine", F(p.nette), p.nette < 0 ? "moins" : "", 'position nette')
      + '</div>';

    h += COUPE;
    var sug = C.suggestions(d, a, {debutant:Carnet.debutant()});
    var pressant = sug.some(function(s){ return s.rang <= 2; });
    h += '<h2 class="titre-bloc' + (pressant ? ' alerte' : '') + '">À faire <span class="pastille">' + sug.length + '</span></h2>'
      + '<p class="sous-titre">Cette semaine : ' + F(som(semaine, entrant)) + ' attendus, '
      + F(som(semaine, C.aSortir)) + ' à payer.</p>'
      + (sug.length ? '<div class="liste a-faire">' + sug.slice(0, VUES_MAX).map(ligneSuggestion).join("") + '</div>'
                    : '<div class="vide">Rien à faire aujourd\'hui. Tout est à jour.</div>');
    if (sug.length > VUES_MAX)
      h += section("accueil.suite", sug.length - VUES_MAX > 1 ? "Les autres choses à faire" : "Une autre chose à faire",
        '<div class="liste">' + sug.slice(VUES_MAX).map(ligneSuggestion).join("") + '</div>',
        {compteur:sug.length - VUES_MAX, grand:true});
    h += section("accueil.avenir", "À venir, dans le mois",
      listeOuVide(avenir, ligneAgenda, "Rien d'autre dans les 30 jours."),
      {compteur:avenir.length, grand:true});

    return colonnes(h);
  }

  /* --------------------------------------------------------- dépenses
     Deux chiffres : ce qui est sorti, ce qui est entré. Le reste par rubrique. */
  function depenses(){
    var d = D(), a = auj();
    var debut = C.debutDuMois(a), fin = C.finDuMois(a);
    /* Le dû d'une affaire n'est pas de l'argent qui a bougé : il n'a rien à
       faire dans les entrées et les sorties du mois. */
    var mois = (d.mouvements||[]).filter(function(m){ return m.date >= debut && m.date <= fin && !C.sansArgent(m); })
      .sort(function(x,y){ return x.date < y.date ? 1 : -1; });
    var dep = mois.filter(function(m){ return m.nature === "depense"; });
    var total = -dep.reduce(function(s,m){ return s + m.montant; }, 0);
    var recettes = mois.filter(function(m){ return m.montant > 0; })
      .reduce(function(s,m){ return s + m.montant; }, 0);
    var tv = C.trainDeVie(d, auj());
    var entreesMois = mois.filter(function(m){ return m.montant > 0; });
    var h = '<div class="resume">'
      + rangDetail("depenses.sorti", "Sorti ce mois", F(total), "moins", dep.length + " dépense(s)",
          listeOuVide(dep, ligneMouvement, "Aucune dépense notée ce mois-ci.")
          + '<p class="sous-bloc">Touche une ligne pour la corriger ou la supprimer.</p>')
      + rangDetail("depenses.entre", "Entré ce mois", F(recettes), "plus", entreesMois.length + " entrée(s)",
          listeOuVide(entreesMois, ligneMouvement, "Aucune entrée notée ce mois-ci."))
      + '</div>';

    /* Le bilan remplace les phrases grises qui traînaient en bas des
       rubriques : mêmes chiffres, mais alignés, prévu contre fait. */
    var bm = C.bilanDuMois(d, a);
    h += section("depenses.bilan", "Bilan du mois", bilan(bm, tv),
      {resume:"prévu " + F(bm.solde.prevu), alerte:bm.solde.prevu < 0, grand:true});

    var resteEnv = C.resteEnveloppes(d, a);
    h += COUPE;
    h += section("depenses.enveloppes", "Enveloppes",
      ((d.enveloppes||[]).length ? (d.enveloppes||[]).map(function(e){
        var plafond = C.montantEnveloppe(e, a);
        var u = C.consommeEnveloppe(d, e, a), reste = plafond - u;
        var pct = plafond ? Math.round(u / plafond * 100) : 0;
        var decide = (e.montantsParMois || {})[a.slice(0,7)] != null;
        var allure = Math.round(Number(a.slice(8,10)) / C.joursDuMois(a) * 100);
        return '<button class="bloc" onclick="Formulaires.enveloppe(' + e.id + ')">'
          + '<div class="haut-bloc"><span class="objet">' + esc(e.libelle) + '</span>'
          + '<span class="montant ' + (reste >= 0 ? '' : 'moins') + '">' + F(reste) + '</span></div>'
          + '<div class="barre"><i style="width:' + Math.min(100, pct) + '%;background:'
          + (pct > allure ? 'var(--retard)' : 'var(--accent)') + '"></i></div>'
          + '<p class="sous-bloc">' + F(u) + ' dépensés sur ' + F(plafond)
          + (decide ? ' décidés pour ce mois' : '') + ' · ' + pct
          + ' % de l\'enveloppe pour ' + allure + ' % du mois'
          + (pct > allure ? ' — un peu vite' : '') + '</p></button>'; }).join("")
        : '<div class="vide">Aucune enveloppe. Sans elle, le reste à vivre oublie le marché.</div>')
      + bouton("Ajouter une enveloppe", "Formulaires.enveloppe()"),
      {resume:F(resteEnv) + " restants", compteur:(d.enveloppes||[]).length});

    var parCat = {};
    dep.forEach(function(m){ parCat[m.cat || "Divers"] = (parCat[m.cat || "Divers"] || 0) - m.montant; });
    var cats = Object.keys(parCat).map(function(k){ return [k, parCat[k]]; })
      .sort(function(x,y){ return y[1] - x[1]; });
    var max = cats.length ? cats[0][1] : 1;
    h += section("depenses.categories", "Où l'argent est parti",
      (cats.length ? '<div class="cats">' + cats.map(function(c){
          return '<div class="cat"><span class="lib">' + esc(c[0]) + '</span>'
            + '<span class="val">' + F(c[1]) + '</span>'
            + '<span class="piste"><i style="width:' + Math.round(c[1]/max*100) + '%"></i></span>'
            + '<span class="pc">' + Math.round(c[1]/total*100) + ' % du mois</span></div>'; }).join("") + '</div>'
        : '<div class="vide">Rien de noté ce mois-ci.</div>'),
      {compteur:cats.length});

    /* Réglé = en bas de la liste : ce qui reste à faire se lit d'abord. */
    var entrees = C.fileDAttente((d.recurrents||[]).filter(function(c){ return c.sens === "entree"; }), a);
    var sorties = C.fileDAttente((d.recurrents||[]).filter(function(c){ return c.sens !== "entree"; }), a);
    var aFaire = function(l){ return l.filter(function(c){ return !C.regleeCeMois(c, a); }).length; };
    h += section("depenses.charges", "Charges fixes",
      listeOuVide(sorties, ligneRecurrent, "Aucune charge fixe.")
      + bouton("Ajouter une charge fixe", "Formulaires.recurrent(null,\'sortie\')"),
      {resume:sorties.length ? (aFaire(sorties) ? aFaire(sorties) + " à payer" : "tout est réglé") : "",
       compteur:sorties.length});
    h += section("depenses.revenus", "Revenus fixes",
      listeOuVide(entrees, ligneRecurrent, "Aucun revenu fixe.")
      + bouton("Ajouter un revenu fixe", "Formulaires.recurrent(null,\'entree\')"),
      {resume:entrees.length ? (aFaire(entrees) ? aFaire(entrees) + " à recevoir" : "tout est reçu") : "",
       compteur:entrees.length});
    h += section("depenses.lignes", "Tous les mouvements du mois",
      listeOuVide(mois, ligneMouvement, "Rien ce mois-ci."), {compteur:mois.length});
    return colonnes(h);
  }

  /* Le bilan du mois : deux colonnes, prévu et fait, et une phrase qui dit
     le verdict en clair. Pas de pourcentage, pas de graphique : c'est un
     tableau qu'on doit pouvoir lire à voix haute. */
  function bilan(b, tv){
    var ligne = function(lib, prevu, fait){
      return '<tr><th>' + lib + '</th><td>' + (prevu == null ? '—' : F(prevu)) + '</td><td>' + F(fait) + '</td></tr>'; };
    var signe = function(n){ return n < 0 ? 'moins' : 'plus'; };
    var prevu = b.solde.prevu;
    return '<p class="verdict ' + signe(prevu) + '">'
      + (prevu < 0 ? 'Ce qui est prévu ce mois dépasse tes revenus fixes de ' + F(-prevu) + '.'
                   : 'Tes revenus fixes couvrent ce qui est prévu ce mois, avec ' + F(prevu) + ' de marge.') + '</p>'
      + '<table class="prevu-fait"><thead><tr><th></th><th>Prévu</th><th>Fait</th></tr></thead><tbody>'
      + '<tr class="groupe"><th colspan="3">Ce qui entre</th></tr>'
      + ligne("Revenus fixes", b.revenus.prevu, b.revenus.fait)
      + ligne("Autres entrées", null, b.autresEntrees)
      + '<tr class="groupe"><th colspan="3">Ce qui sort</th></tr>'
      + ligne("Charges fixes", b.charges.prevu, b.charges.fait)
      + ligne("Enveloppes", b.enveloppes.prevu, b.enveloppes.fait)
      + ligne("Hors prévision", null, b.horsPrevision)
      + '<tr class="total"><th>Solde du mois</th><td class="' + signe(prevu) + '">' + F(prevu) + '</td>'
      + '<td class="' + signe(b.solde.fait) + '">' + F(b.solde.fait) + '</td></tr>'
      + '</tbody></table>'
      + '<p class="sous-bloc">Moyenne sur l\'année, en comptant ce qui ne tombe pas tous les mois : '
      + F(tv.lisse) + ' de sorties par mois.</p>';
  }

  /* Une ligne qui revient, avec son bouton. Deux gestes différents sur la
     même ligne : toucher le nom ouvre le réglage de la charge (montant, jour,
     rythme) ; toucher « Effectuée » la marque payée, débite le compte et la
     fait avancer à sa prochaine date. Le bouton est sous le montant, pas à
     côté du nom : sur un téléphone, il ne lui prend pas sa place.

     Une fois réglée pour le mois, la ligne change d'état : plus de montant
     rouge, plus de bouton, une mention verte « Réglée le … ». D'un coup d'œil
     sur la liste, on voit ce qui reste à payer ce mois-ci. Elle redevient à
     payer le 1er du mois suivant, toute seule. */
  function ligneRecurrent(c){
    var a = auj();
    var retard = c.prochaine && C.jours(a, c.prochaine) < 0;
    var entree = c.sens === "entree";
    var reglee = C.regleeCeMois(c, a);
    var verbe = entree ? "Reçu" : c.facultatif ? "Envoyée" : "Effectuée";
    var etatRegle = (entree ? "Reçu" : c.facultatif ? "Envoyée" : "Réglée") + " le " + C.jf(c.dernierRegle || a).slice(0,5);
    var action = "Formulaires.agir(\'recurrent\'," + c.id + ",null)";
    return '<div class="ligne ligne-action' + (reglee ? ' est-reglee' : '') + '">'
      + '<i class="bande ' + (reglee ? 'entree' : !c.prochaine ? 'sans-date' : retard ? 'retard' : entree ? 'entree' : 'charge') + '"></i>'
      + '<button class="zone" onclick="Formulaires.recurrent(' + c.id + ')" aria-label="Modifier ' + esc(c.libelle) + '">'
      + '<span class="corps"><span class="nom">' + esc(c.libelle) + '</span>'
      + '<span class="sous">' + (reglee ? 'prochaine le ' + C.jf(c.prochaine).slice(0,5)
            : c.prochaine ? esc(C.quand(c.prochaine, a)) : 'aucune date')
      + (c.facultatif ? ' · si je peux' : '') + ' · ' + esc(C.libelleRythme(c.rythme))
      + (c.jourAConfirmer ? ' · jour à confirmer' : '') + '</span></span></button>'
      + '<span class="cote">'
      + (reglee
          /* La mention verte ouvre le règlement du mois — pour le voir ou
             l'annuler — et surtout PAS la feuille de paiement : la toucher
             « pour voir » payait la charge une seconde fois. */
          ? '<button class="reglee" onclick="Formulaires.reglement(' + c.id + ')">✓ ' + etatRegle + '</button>'
          : '<span class="montant ' + (entree ? 'plus' : c.facultatif ? 'neutre' : 'moins') + '">' + (entree ? '+' : '−')
            + F(c.montant) + '</span>'
            + (c.prochaine
                ? '<button class="faire' + (retard ? ' retard' : '') + '" onclick="' + action + '">' + verbe + '</button>'
                : '<button class="faire retard" onclick="Formulaires.recurrent(' + c.id + ')">À dater</button>'))
      + '</span></div>';
  }

  function ligneMouvement(m){
    var nomT = m.tiers ? Carnet.nomTiers(m.tiers) : null;
    /* Le dû d'une affaire : une écriture, pas de l'argent. Ni vert ni rouge,
       et elle ouvre l'échéancier de l'affaire. */
    if (C.sansArgent(m)) return '<button class="ligne" onclick="Formulaires.mouvement(' + m.id + ')">'
      + '<i class="bande"></i><span class="corps"><span class="nom">' + esc(m.libelle) + '</span>'
      + '<span class="sous">' + C.jf(m.date) + ' · affaire conclue' + (nomT ? ' · ' + esc(nomT) : '')
      + ' · aucun argent n\'a encore bougé</span></span>'
      + '<span class="montant neutre">' + F(Math.abs(m.montant)) + '</span></button>';
    return '<button class="ligne" onclick="Formulaires.mouvement(' + m.id + ')">'
      + '<i class="bande"></i><span class="corps">'
      + '<span class="nom">' + esc(m.libelle) + '</span>'
      + '<span class="sous">' + C.jf(m.date) + ' · ' + esc(m.cat || "Divers")
      + ' · ' + esc(Carnet.nomCompte(m.compte)) + (nomT ? ' · ' + esc(nomT) : '')
      + (m.fixe ? ' · charge fixe' : '')
      + (m.compte != null && !C.dansLeSolde(D(), m) ? ' · déjà dans le solde' : '') + '</span></span>'
      + '<span class="montant ' + (m.montant > 0 ? 'plus' : 'moins') + '">'
      + (m.montant > 0 ? '+' : '−') + F(Math.abs(m.montant)) + '</span></button>';
  }

  /* ------------------------------------------------------------- tiers
     Deux listes, et rien d'autre : qui me doit, à qui je dois. Sous chaque
     nom, la prochaine échéance — c'est elle qu'on vient chercher ici. Une
     personne sans argent en jeu (le bénéficiaire d'une aide) n'apparaît pas. */
  function tiers(){
    var d = D(), a = auj(), s = C.situationTiers(d);
    /* la première échéance datée de chaque tiers ; l'agenda est trié par date */
    var echeance = {};
    C.agenda(d).forEach(function(x){
      if (x.ref.type === "engagement" && x.tiers != null && !echeance[x.tiers]) echeance[x.tiers] = x.date; });
    var ligne = function(classe, signe){ return function(o){
      var t = o.t, e = echeance[t.id], retard = e && C.jours(a, e) < 0;
      return '<button class="ligne" onclick="Carnet.ouvrirTiers(' + t.id + ')">'
        + '<i class="bande ' + (retard ? 'retard' : '') + '"></i><span class="corps"><span class="nom">' + esc(t.nom) + '</span>'
        + '<span class="sous">' + (o.solde ? (e ? 'échéance : ' + esc(C.quand(e, a)) : 'aucune échéance datée')
                                           : esc(t.genre || "—")) + '</span></span>'
        + (o.solde ? '<span class="montant ' + classe + '">' + signe + F(o.solde) + '</span>'
                   : '<span class="jeton ok">soldé</span>') + '</button>'; }; };
    var bloc = function(titre, liste, total, classe, signe, vide){
      return '<h2 class="titre-bloc">' + titre + ' <span class="pastille">' + liste.length + '</span>'
        + '<span class="total ' + classe + '">' + F(total) + '</span></h2>'
        + listeOuVide(liste, ligne(classe, signe), vide); };
    var h = bloc("On me doit", s.meDoivent, s.totalMeDoivent, "plus", "+", "Personne ne te doit d\'argent.")
          + bloc("Je dois", s.jeDois, s.totalJeDois, "moins", "−", "Tu ne dois d\'argent à personne.");
    if (s.soldes.length)
      h += section("tiers.soldes", "Soldés", '<div class="liste">' + s.soldes.map(ligne("", "")).join("") + '</div>',
        {compteur:s.soldes.length});
    h += '<p class="note-bas">Un prêt ou une avance se note avec le +. '
      + '<button class="lien" onclick="Formulaires.personnes()">Toutes les personnes du carnet ('
      + (d.tiers||[]).length + ')</button></p>';
    return h;
  }

  /* -------------------------------------------------- fiche d'un tiers */
  function fiche(){
    var d = D(), a = auj(), t = Carnet.parTiers(Carnet.etat().id);
    if (!t) return '<div class="vide">Ce tiers n\'existe plus.</div>';
    var s = C.soldeTiers(d, t.id);
    var engs = (d.engagements||[]).filter(function(e){ return e.tiers === t.id; });
    var parts = (d.participations||[]).filter(function(p){ return p.tiers === t.id; });
    var opps = (d.opportunites||[]).filter(function(o){ return o.tiers === t.id; });
    var recs = (d.recurrents||[]).filter(function(c){ return c.tiers === t.id; });
    var mvts = (d.mouvements||[]).filter(function(m){ return m.tiers === t.id; })
      .sort(function(x,y){ return x.date < y.date ? 1 : -1; });
    var phrase = s > 0 ? "Il reste chez lui" : s < 0 ? "Je lui dois encore" : "Rien dû de part ni d'autre";
    var h = '<button class="retour" onclick="Carnet.aller(\'tiers\')">‹ Tiers</button>'
      + '<div class="entete"><h1>' + esc(t.nom) + '</h1><p class="meta">' + esc(t.genre || "—")
      + (t.tel ? ' · ' + esc(t.tel) : '') + ' · <button class="lien" onclick="Formulaires.tiers('
      + t.id + ')">modifier</button></p></div>';

    h += '<div class="solde"><span class="phrase">' + phrase + '</span>'
      + '<span class="gros" style="color:' + (s > 0 ? 'var(--recevoir)' : s < 0 ? 'var(--payer)' : 'inherit')
      + '">' + F(Math.abs(s)) + '</span><div class="actions">'
      + '<button class="principal" onclick="Formulaires.nouveau(' + t.id + ')">Noter un mouvement</button>'
      + '</div></div>';
    if (t.note) h += '<p class="note">' + esc(t.note) + '</p>';

    if (recs.length) {
      h += '<h2 class="titre-bloc">Lignes qui reviennent <span class="pastille">' + recs.length + '</span></h2>'
        + '<div class="liste">' + recs.map(ligneRecurrent).join("") + '</div>';
    }

    if (parts.length) {
      h += '<h2 class="titre-bloc">Participations <span class="pastille">' + parts.length + '</span></h2>';
      h += parts.map(carteParticipation).join("");
    }

    if (engs.length) {
      h += '<h2 class="titre-bloc">Engagements <span class="pastille">' + engs.length + '</span></h2>';
      h += engs.map(function(e){ return C.estBusiness(e) ? carteBusiness(e) : carteEngagement(e); }).join("");
    }

    if (opps.length) {
      h += '<h2 class="titre-bloc">Affaires espérées <span class="pastille">' + opps.length + '</span></h2>';
      h += opps.map(carteOpportunite).join("");
    }

    h += '<h2 class="titre-bloc">Mouvements <span class="pastille">' + mvts.length + '</span></h2>'
      + listeOuVide(mvts, ligneMouvement, "Aucun mouvement avec lui.");
    return h;
  }

  function carteEngagement(e){
    var a = auj();
    var reste = C.resteEngagement(e), total = C.totalEngagement(e), regle = C.regleEngagement(e);
    var pct = total ? Math.round(regle / total * 100) : 0;
    var creance = e.sens === "creance";
    return '<div class="bloc"><div class="haut-bloc"><span class="objet">' + esc(e.objet) + '</span>'
      + '<span class="montant ' + (creance ? 'plus' : 'moins') + '">' + F(reste) + '</span></div>'
      + '<div class="barre"><i style="width:' + pct + '%;background:'
      + (creance ? 'var(--recevoir)' : 'var(--payer)') + '"></i></div>'
      + '<p class="sous-bloc">' + F(regle) + ' réglés sur ' + F(total) + ' · ' + pct + ' %</p>'
      + '<ul class="tranches">' + (e.tranches||[]).map(function(tr, i){
          var retard = tr.date && C.jours(a, tr.date) < 0 && tr.etat !== "payee";
          return '<li><span class="date">' + (tr.date ? C.jf(tr.date) : "— — —") + '</span>'
            + '<span>Tranche ' + (i+1) + '</span>'
            + (tr.etat === "payee" ? '<span class="jeton ok">payée</span>'
               : retard ? '<span class="jeton retard">retard</span>'
               : tr.date ? '<span class="jeton">' + C.quand(tr.date, a) + '</span>'
               : '<span class="jeton retard">sans date</span>')
            + '<span class="montant">' + F(tr.montant) + '</span></li>'; }).join("")
      + '</ul>'
      + ((e.tranches||[]).some(function(tr){ return !tr.date && tr.etat !== "payee"; })
         ? '<p class="alerte-texte">Échéance à fixer.</p>' : '')
      + '<div class="actions">'
      + (reste ? '<button class="principal" onclick="Formulaires.agir(\'engagement\',' + e.id + ',null)">'
          + (creance ? 'Encaisser un versement' : 'Noter un paiement') + '</button>' : '')
      + '<button onclick="Formulaires.engagement(' + e.id + ')">Modifier</button></div></div>';
  }

  function carteParticipation(p){
    var a = auj();
    var net = (p.recu||0) - (p.mise||0);
    var pct = p.mise ? Math.min(100, Math.round((p.recu||0) / p.mise * 100)) : 0;
    return '<div class="bloc"><div class="haut-bloc"><span class="objet">' + esc(p.objet) + '</span>'
      + (p.part ? '<span class="jeton part">' + esc(p.part) + '</span>' : '') + '</div>'
      + (p.rythme ? '<p class="sous-bloc">' + esc(p.rythme) + '</p>' : '')
      + '<div class="barre"><i style="width:' + pct + '%"></i></div>'
      + '<p class="sous-bloc">' + F(p.recu||0) + ' reçus sur ' + F(p.mise||0) + ' mis · ' + pct + ' %</p>'
      + '<div class="paire">'
      + '<div><span>Mise</span><b>' + F(p.mise||0) + '</b></div>'
      + '<div><span>Déjà reçu</span><b>' + F(p.recu||0) + '</b></div>'
      + '<div><span>Résultat net</span><b style="color:' + (net >= 0 ? 'var(--recevoir)' : 'var(--payer)')
      + '">' + F(net) + '</b></div>'
      + '<div><span>Prochain point</span><b style="font-size:13px">'
      + (p.point ? C.jf(p.point) : "à fixer") + '</b></div></div>'
      + (p.point ? '' : '<p class="alerte-texte">Aucun point fixé : cet argent dort sans que personne ne prévienne.</p>')
      + '<div class="actions"><button class="principal" onclick="Formulaires.agir(\'participation\','
      + p.id + ',null)">Faire le point</button>'
      + '<button onclick="Formulaires.participation(' + p.id + ')">Modifier</button></div></div>';
  }

  function carteOpportunite(o){
    var a = auj(), nomT = Carnet.nomTiers(o.tiers);
    return '<div class="bloc"><div class="haut-bloc"><span class="objet">' + esc(o.objet) + '</span>'
      + '<span class="montant plus">' + F(C.commission(o)) + '</span></div>'
      + '<p class="sous-bloc">' + (nomT ? esc(nomT) + ' · ' : '')
      + (o.montant ? 'commission au forfait' : o.taux + ' % de ' + F(o.base))
      + (o.proba ? ' · ' + o.proba + ' % de chances' : '') + '</p>'
      + '<ul class="tranches"><li><span class="date">' + (o.date ? C.jf(o.date) : "— — —") + '</span>'
      + '<span>' + esc(o.action || "prochaine action") + '</span>'
      + (o.date ? '<span class="jeton">' + C.quand(o.date, a) + '</span>'
                : '<span class="jeton retard">sans date</span>') + '</li></ul>'
      + (o.date ? '' : '<p class="alerte-texte">Affaire sans prochaine action datée : c\'est comme ça qu\'on en perd.</p>')
      + '<div class="actions"><button class="principal" onclick="Formulaires.agir(\'opportunite\','
      + o.id + ',null)">Où en est-on ?</button>'
      + '<button onclick="Formulaires.opportunite(' + o.id + ')">Modifier</button></div></div>';
  }

  /* ---------------------------------------------------------- business
     Une ligne par business, comme on les a en tête : son nom, avec qui, ce
     qui reste à toucher et la prochaine chose qui doit arriver. Deux listes :
     ceux dont le montant est validé (on me le doit), ceux où il n'est encore
     qu'annoncé (rien n'est acquis). Toucher une ligne ouvre sa fiche. */
  function avecQui(e){
    return [Carnet.nomTiers(e.tiers), e.avecAussi].filter(Boolean).join(" et ");
  }
  function ligneBusiness(e){
    var a = auj(), valide = C.estValide(e), reste = C.resteEngagement(e), p = C.prochainBusiness(e);
    var retard = p && C.jours(a, p.date) < 0;
    var suite = p ? (p.genre === "etape" ? esc(p.libelle) : F(p.montant) + ' attendus') + ' · ' + esc(C.quand(p.date, a))
      : !reste ? 'tout est encaissé' : valide ? 'date à fixer' : 'aucune étape datée';
    return '<button class="ligne" onclick="Formulaires.business(' + e.id + ')">'
      + '<i class="bande ' + (retard ? 'retard' : !p && reste ? 'sans-date' : valide ? 'entree' : '') + '"></i>'
      + '<span class="corps"><span class="nom">' + esc(e.objet) + '</span>'
      + '<span class="sous">' + esc(avecQui(e) || "—") + ' · ' + suite + '</span></span>'
      + (reste ? '<span class="montant ' + (valide ? 'plus' : 'neutre') + '">' + F(reste) + '</span>'
               : '<span class="jeton ok">encaissé</span>') + '</button>';
  }
  /* La fiche d'un business : où on en est, d'où vient ce qui est reçu, ce
     qui reste tranche par tranche, et les gestes. */
  function carteBusiness(e){
    var a = auj(), valide = C.estValide(e);
    var total = C.totalBusiness(e), recu = C.recuBusiness(e), reste = C.resteEngagement(e);
    var pct = total ? Math.round(recu / total * 100) : 0;
    var encaisseIci = C.regleEngagement(e);
    return '<div class="bloc"><div class="haut-bloc"><span class="objet">'
      + esc(avecQui(e) ? 'Avec ' + avecQui(e) : e.objet) + '</span>'
      + '<span class="montant ' + (valide ? 'plus' : 'neutre') + '">' + F(reste) + '</span></div>'
      /* Un nom mal orthographié se corrige ici, une fois, et il change partout :
         dans Business, dans Tiers, dans les mouvements. */
      + (Carnet.nomTiers(e.tiers) ? '<p class="sous-bloc"><button class="lien" onclick="Formulaires.tiers(' + e.tiers + ')">Corriger le nom de '
          + esc(Carnet.nomTiers(e.tiers)) + '</button> · les autres noms et le titre se changent dans « Modifier ».</p>' : '')
      + (valide ? '' : '<p class="alerte-texte">Opportunité pas encore validée : elle ne compte pas dans ce qu\'on te doit.</p>')
      + '<div class="barre"><i style="width:' + Math.min(100, pct) + '%;background:var(--recevoir)"></i></div>'
      + '<p class="sous-bloc">' + F(recu) + ' reçus sur ' + F(total) + ' · ' + pct + ' % · reste ' + F(reste) + '</p>'
      + (e.dejaRecu ? '<p class="sous-bloc">' + F(e.dejaRecu) + ' reçus avant le carnet'
          + (e.dejaRecuNote ? ' : ' + esc(e.dejaRecuNote) : '') + '.'
          + (encaisseIci ? ' ' + F(encaisseIci) + ' encaissés depuis.' : '') + '</p>' : '')
      + (e.etape ? '<p class="sous-bloc"><b>Prochaine étape :</b> ' + esc(e.etape) + ' — '
          + (e.etapeDate ? esc(C.quand(e.etapeDate, a)) : 'sans date') + '</p>' : '')
      + ((e.tranches||[]).length ? '<ul class="tranches">' + e.tranches.map(function(tr, i){
          var retard = tr.date && C.jours(a, tr.date) < 0 && tr.etat !== "payee";
          return '<li><span class="date">' + (tr.date ? C.jf(tr.date) : "— — —") + '</span>'
            + '<span>Tranche ' + (i+1) + '</span>'
            + (tr.etat === "payee" ? '<span class="jeton ok">encaissée</span>'
               : retard ? '<span class="jeton retard">retard</span>'
               : tr.date ? '<span class="jeton">' + C.quand(tr.date, a) + '</span>'
               : '<span class="jeton' + (valide ? ' retard' : '') + '">' + (valide ? 'à dater' : 'à valider') + '</span>')
            + '<span class="montant">' + F(tr.montant) + '</span></li>'; }).join("") + '</ul>' : '')
      + '<div class="actions">'
      + (reste ? '<button class="principal" onclick="Formulaires.agir(\'engagement\',' + e.id + ',null)">Encaisser</button>' : '')
      + (valide ? '' : '<button onclick="Formulaires.validerBusiness(' + e.id + ')">Opportunité validée</button>')
      + '<button onclick="Formulaires.engagement(' + e.id + ')">Modifier</button></div></div>';
  }
  /* Ce qu'un business a déjà rapporté : la ligne de « Déjà encaissé ». */
  function ligneEncaisse(e){
    var recu = C.recuBusiness(e), total = C.totalBusiness(e);
    return '<button class="ligne" onclick="Formulaires.business(' + e.id + ')"><i class="bande entree"></i>'
      + '<span class="corps"><span class="nom">' + esc(e.objet) + '</span>'
      + '<span class="sous">' + esc(avecQui(e) || "—") + ' · sur ' + F(total) + '</span></span>'
      + '<span class="montant plus">' + F(recu) + '</span></button>';
  }
  /* L'onglet s'ouvre sur trois chiffres, rien d'autre : les opportunités
     validées (on me les doit), les opportunités (rien n'est encore acquis),
     ce qui est déjà encaissé. Chaque chiffre se touche pour voir les business
     qu'il contient, et chaque business pour voir sa fiche. Le détail ne
     s'affiche que quand on le demande. */
  function affaires(){
    var d = D(), b = C.business(d);
    var opps = d.opportunites || [], parts = d.participations || [];
    var nb = function(n){ return n + " business"; };
    var encaisses = (d.engagements||[]).filter(function(e){ return C.estBusiness(e) && C.recuBusiness(e) > 0; });
    var liste = function(l, rendu, vide){
      return l.length ? '<div class="liste">' + l.map(rendu).join("") + '</div>' : '<div class="vide">' + vide + '</div>'; };
    var h = '<div class="resume">'
      + rangDetail("affaires.validees", "Opportunités validées", F(b.aEncaisser), "plus", nb(b.enCours.length) + " à encaisser",
          liste(b.enCours, ligneBusiness, "Aucune opportunité validée pour l\'instant."))
      + rangDetail("affaires.opportunites-ouvertes", "Opportunités", F(b.annonce), "", nb(b.aValider.length) + " pas encore validés",
          liste(b.aValider, ligneBusiness, "Aucune opportunité en attente. Note-la avec le +."))
      + rangDetail("affaires.encaisse", "Déjà encaissé", F(b.encaisse), "", "sur " + nb(encaisses.length),
          liste(encaisses, ligneEncaisse, "Rien d\'encaissé pour l\'instant."))
      + '</div>';

    h += COUPE;
    h += '<p class="note-bas">Touche un chiffre pour voir les business qu\'il contient, puis un business pour ses tranches.</p>';
    if (b.termines.length)
      h += section("affaires.termines", "Terminés",
        '<div class="liste">' + b.termines.map(ligneBusiness).join("") + '</div>', {compteur:b.termines.length});
    /* Les deux autres formes d'affaires n'occupent une ligne que si elles existent. */
    if (opps.length)
      h += section("affaires.opportunites", "Commissions espérées",
        opps.map(carteOpportunite).join("")
        + bouton("Ajouter une commission espérée", "Formulaires.opportunite()")
        + '<p class="sous-bloc">Une commission se calcule : base de l\'affaire × taux.</p>',
        {compteur:opps.length, alerte:opps.some(function(o){ return !o.date; })});
    if (parts.length)
      h += section("affaires.participations", "Participations",
        parts.map(function(p){
          var nomT = Carnet.nomTiers(p.tiers);
          return (nomT ? '<p class="s-entete">' + esc(nomT) + '</p>' : '') + carteParticipation(p); }).join("")
        + bouton("Ajouter une participation", "Formulaires.participation()"),
        {compteur:parts.length, alerte:parts.some(function(p){ return !p.point; })});
    return colonnes(h);
  }

  /* -------------------------------------------------------- patrimoine
     Un chiffre : la position nette. Puis ce qui la compose. */
  function patrimoine(){
    var d = D();
    var p = C.patrimoine(d), tv = C.trainDeVie(d, auj());
    var l = function(nom, m, jeton, action){
      return '<' + (action ? 'button class="l" onclick="' + action + '"' : 'div class="l"') + '>'
        + '<span>' + esc(nom) + (jeton ? ' <span class="jeton">' + jeton + '</span>' : '') + '</span>'
        + '<b class="chiffre">' + F(m) + '</b></' + (action ? 'button' : 'div') + '>';
    };
    /* Trois lignes sous la position nette : l'argent, les biens, ce que je
       dois. L'argent et les biens sont séparés exprès — on ne paie pas une
       facture avec un terrain. Chacune se touche pour voir son détail. */
    var groupes = C.biensParType(d);
    var ligneBien = function(b){
      return '<button class="ligne" onclick="Formulaires.bien(' + b.id + ')"><i class="bande"></i>'
        + '<span class="corps"><span class="nom">' + esc(C.nomBien(b)) + '</span>'
        + '<span class="sous">' + esc(C.detailBien(b)) + '</span></span>'
        + '<span class="montant neutre">' + F(b.montant) + '</span></button>'; };
    var detailBiens = (groupes.length ? groupes.map(function(g){
          return '<p class="s-entete">' + g.titre + (groupes.length > 1 ? ' · ' + F(g.total) : '') + '</p>'
            + '<div class="liste">' + g.biens.map(ligneBien).join("") + '</div>'; }).join("")
        : '<div class="vide">Aucun bien noté. Un terrain, un véhicule : ajoute-le avec le +.</div>')
      + bouton("Ajouter un bien", "Formulaires.bien()")
      + '<p class="sous-bloc">La valeur d\'un bien est une estimation que tu saisis : c\'est la seule ligne '
      + 'du patrimoine qui n\'est pas calculée.</p>';
    var nbBiens = (d.biens||[]).length;
    var h = '<div class="position"><span class="etiquette">Position nette</span>'
      + '<span class="gros">' + F(p.nette) + '</span></div>'
      + '<div class="resume">'
      + rangDetail("patrimoine.argent", "Argent", F(p.argent), "plus", "comptes, ce qu'on me doit, placements",
          '<div class="bilan">'
          + l("Sur mes comptes", p.liquidites, null, "Formulaires.comptes()")
          + l("Ce qu'on me doit", p.creances, null, "Carnet.aller('tiers')")
          + l("Placé dans des affaires", p.mises, null, "Carnet.aller('affaires')")
          + '</div><p class="sous-bloc">Les placements comptent pour la mise, pas pour une valeur devinée.</p>')
      + rangDetail("patrimoine.biens", "Biens", F(p.biens), "", nbBiens ? nbBiens + (nbBiens > 1 ? " biens" : " bien") + ", valeur estimée" : "terrains, véhicules…",
          detailBiens)
      + rangDetail("patrimoine.dettes", "Ce que je dois", F(p.passif), "moins", "dettes et crédits",
          '<div class="bilan">'
          + l("Dettes envers des personnes", p.dettes, null, "Carnet.aller('tiers')")
          + (d.credits||[]).map(function(c){ return l(c.nom, c.montant, null, "Formulaires.credit(" + c.id + ")"); }).join("")
          + '</div>' + bouton("Ajouter un crédit", "Formulaires.credit()"))
      + '</div>';

    h += COUPE;
    h += section("patrimoine.train", "Train de vie",
      '<div class="bilan">'
      + l("Charges fixes de chaque mois", tv.mensuels)
      + l("Enveloppes", tv.enveloppes)
      + l("Lissé sur l'année", tv.lisse)
      + l("Revenus fixes", tv.entrees)
      + '</div><p class="sous-bloc" style="color:' + (tv.ecart >= 0 ? 'var(--recevoir)' : 'var(--payer)') + ';font-weight:600">'
      + (tv.ecart >= 0 ? 'Les revenus fixes couvrent le train de vie, il reste ' + F(tv.ecart) + '.'
          : 'Il manque ' + F(-tv.ecart) + ' par mois, à prendre sur le business.') + '</p>'
      + (tv.aidesSouhaitees ? '<p class="sous-bloc">Dont ' + F(tv.aidesSouhaitees) + ' d\'aides souhaitées par mois, '
          + 'réservées dans la caisse et jamais comptées comme dues.</p>' : '')
      + '<p class="sous-bloc">Rien de tout ça n\'est une dette : avant l\'échéance, rien n\'est dû.</p>',
      {resume:F(tv.courant) + " / mois", alerte:tv.ecart < 0});
    return colonnes(h);
  }

  /* ---------------------------------------------------------- réglages
     Six rubriques fermées, chacune avec son état en un mot : on voit d'un
     coup d'œil ce qui demande de l'attention, sans rien dérouler. */
  function reglages(){
    var d = D(), a = auj(), r = d.reglages;
    var h = '<button class="retour" onclick="Carnet.aller(\'accueil\')">‹ Accueil</button>'
      + '<div class="entete"><h1>Réglages</h1></div>';

    h += section("reglages.comptes", "Comptes",
      '<div class="liste">' + (d.comptes||[]).map(function(c){
        return '<div class="ligne fixe-ligne"><i class="bande"></i><span class="corps">'
          + '<span class="nom">' + esc(c.nom) + '</span>'
          + '<span class="sous">départ ' + F(c.soldeInitial) + ' le ' + C.jf(c.depuis) + '</span></span>'
          + '<span class="montant">' + F(C.soldeCompte(d, c.id)) + '</span></div>'; }).join("") + '</div>'
      + bouton("Modifier ou ajouter un compte", "Formulaires.comptes()"),
      {resume:F(C.liquidites(d))});

    h += section("reglages.categories", "Catégories",
      '<p class="sous-bloc">' + (r.cats||[]).map(esc).join(" · ") + '</p>'
      + bouton("Modifier les catégories", "Formulaires.categories()"),
      {compteur:(r.cats||[]).length});

    var ageSauv = r.dernierExport ? C.jours(r.dernierExport, a) : null;
    h += section("reglages.sauvegarde", "Sauvegarde",
      '<p class="sous-bloc">Un texte chiffré par une phrase de passe que tu choisis : même déposé sur un '
      + 'espace partagé, personne ne peut le lire sans elle. Et personne ne peut te la redonner si tu l\'oublies.</p>'
      + '<p class="sous-bloc">' + (r.dernierExport ? 'Dernière sauvegarde : ' + C.jf(r.dernierExport) + '.' : 'Jamais sauvegardé.') + '</p>'
      + '<div class="actions"><button class="principal" onclick="Formulaires.exporter()">Sauvegarder</button>'
      + '<button onclick="Formulaires.importer()">Restaurer</button></div>',
      {resume:ageSauv == null ? "jamais" : ageSauv === 0 ? "aujourd'hui" : "il y a " + ageSauv + " j",
       alerte:ageSauv == null || ageSauv > 7});

    /* La synchronisation : dire ce qui est relié, quand ça a tourné pour la
       dernière fois, et s'il reste des saisies qui ne sont pas parties. */
    var si = Synchro.infos(), se = Synchro.etat(), corpsSync, resumeSync;
    if (!Synchro.possible()) {
      resumeSync = "indisponible";
      corpsSync = '<p class="objet">Indisponible ici</p><p class="sous-bloc">La synchronisation ne fonctionne que '
        + 'dans l\'app ouverte à sa propre adresse, pas dans cette page.</p>';
    } else if (!si) {
      resumeSync = "non relié";
      corpsSync = '<p class="sous-bloc">Relié, cet appareil dépose le carnet chiffré dans un dépôt GitHub privé et y '
        + 'lit ce que tes autres appareils ont déposé. GitHub ne voit que du chiffré ; la phrase de passe ne quitte '
        + 'pas tes appareils.</p>' + bouton("Relier cet appareil", "Synchro.feuilleRelier()", true);
    } else {
      resumeSync = {ajour:"à jour", attente:"en attente", encours:"en cours", horsligne:"hors ligne",
                    erreur:"bloquée", choix:"à choisir"}[se.code] || "";
      corpsSync = '<p class="objet">Relié à ' + esc(si.depot) + '</p>'
        + '<p class="sous-bloc">' + esc(se.message || "")
        + (si.dernier ? ' Dernière synchronisation : ' + C.jf(si.dernier.slice(0,10)) + ' à '
            + esc(new Date(si.dernier).toLocaleTimeString("fr-FR", {hour:"2-digit", minute:"2-digit"})) + '.' : '') + '</p>'
        + '<p class="sous-bloc">Elle se fait toute seule à l\'ouverture et après chaque saisie. '
        + 'Le code de verrou et Face ID restent propres à chaque appareil.</p>'
        + '<div class="actions"><button class="principal" onclick="Synchro.synchroniser()">Synchroniser maintenant</button>'
        + '<button onclick="Synchro.delier()">Délier cet appareil</button></div>';
    }
    h += section("reglages.synchro", "Synchronisation", corpsSync,
      {resume:resumeSync, alerte:se.code === "erreur" || se.code === "choix"});

    /* Le verrou : Face ID quand l'appareil le permet, le code en secours.
       On dit toujours pourquoi Face ID n'est pas proposé, plutôt que de
       cacher le bouton sans explication. */
    var dispo = Verrou.disponible(), bio = Verrou.nomBiometrie();
    var corpsVerrou = '<p class="sous-bloc">Le carnet se referme après ' + Verrou.DELAI_SECONDES
      + ' secondes en arrière-plan, et son écran est masqué dans le sélecteur d\'applications.</p>'
      + '<p class="sous-bloc">C\'est une porte, pas un coffre : elle arrête celui qui prend ton téléphone '
      + 'déverrouillé. Ce qui chiffre tes données, c\'est l\'iPhone quand il est verrouillé, et la sauvegarde.</p>';
    if (!r.verrou) corpsVerrou += '<p class="sous-bloc">Mets d\'abord un code : il sert de secours si ' + bio
      + ' ne répond pas.</p>';
    else if (!r.biometrie && dispo === false) corpsVerrou += '<p class="alerte-texte">' + bio
      + ' n\'est pas disponible ici. Il le sera dans l\'app installée sur l\'écran d\'accueil, à sa propre adresse.</p>';
    corpsVerrou += '<div class="actions">'
      + (r.verrou && !r.biometrie && dispo === true
          ? '<button class="principal" onclick="Verrou.activerBiometrie()">Activer ' + bio + '</button>' : '')
      + (r.biometrie ? '<button onclick="Verrou.retirerBiometrie()">Retirer ' + bio + '</button>' : '')
      + '<button onclick="Formulaires.verrou()">' + (r.verrou ? 'Changer le code' : 'Mettre un code') + '</button>'
      + '</div>';
    h += section("reglages.verrou", "Verrou", corpsVerrou,
      {resume:r.biometrie ? bio : r.verrou ? "code" : "aucun"});

    h += section("reglages.effacer", "Effacer le carnet",
      '<p class="sous-bloc">Vide le carnet de cet appareil et coupe sa synchronisation. '
      + 'Sauvegarde d\'abord — ceci ne se défait pas.</p>'
      + '<div class="actions"><button class="danger" onclick="Formulaires.effacer()">Effacer le carnet</button></div>');

    h += '<p class="note-bas">Version de l\'app : ' + Carnet.VERSION + '. '
      + (d.mouvements||[]).length + ' mouvements, ' + (d.tiers||[]).length + ' tiers. '
      + (Carnet.stockageDurable() === true ? 'Stockage durable accordé par l\'appareil.'
        : Carnet.stockageDurable() === false ? 'Stockage durable non accordé ici : sauvegarde souvent.' : '')
      + '</p>';
    return h;
  }

  return {section:section, accueil:accueil, depenses:depenses, tiers:tiers, fiche:fiche,
    affaires:affaires, patrimoine:patrimoine, reglages:reglages,
    ligneAgenda:ligneAgenda, ligneMouvement:ligneMouvement, carteBusiness:carteBusiness,
    carteEngagement:carteEngagement, carteParticipation:carteParticipation,
    carteOpportunite:carteOpportunite};
})();
