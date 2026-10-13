/* Clauvi's Carnet — état, stockage, actions.
   Les calculs d'argent sont dans calculs.js (testés sans navigateur),
   les écrans dans vues.js, les formulaires dans formulaires.js.
   Ici : où vivent les données, et ce qui se passe quand on touche l'écran. */

var Carnet = (function(){
  "use strict";
  var C = Calculs;

  /* Le numéro de version s'affiche dans les Réglages : c'est lui qui dit si
     une mise à jour est bien arrivée sur le téléphone. sw.js porte le même,
     et un test vérifie qu'ils ne divergent pas. */
  var VERSION = "1.19";

  var d = null;                       // le carnet entier, un seul objet
  /* « ouverts » retient les rubriques dépliées, écran par écran : sans ça,
     chaque enregistrement redessine l'écran et referme la rubrique dans
     laquelle on était en train de travailler. */
  var etat = {vue:"accueil", id:null, auj:C.aujourdhui(), ouverts:{}, affichee:null};

  /* ------------------------------------------------------------ stockage
     Tout tient dans un seul document JSON dans IndexedDB. À son échelle
     (quelques centaines de lignes par an) c'est plus simple qu'un schéma
     de tables, et surtout : la sauvegarde est le même objet, donc ce qui
     s'exporte est exactement ce qui est stocké, sans conversion à bugs.
     IndexedDB plutôt que localStorage parce que localStorage se fait
     effacer par le navigateur quand la place manque. */
  var NOM_BASE = "clauvis-carnet", MAGASIN = "document", CLE = "carnet";
  var base = null;

  function ouvrirBase(){
    if (base) return Promise.resolve(base);
    return new Promise(function(ok, rate){
      if (!window.indexedDB) return rate(new Error("Ce navigateur n'a pas IndexedDB."));
      var r = window.indexedDB.open(NOM_BASE, 1);
      r.onupgradeneeded = function(){ r.result.createObjectStore(MAGASIN); };
      r.onsuccess = function(){ base = r.result; ok(base); };
      r.onerror = function(){ rate(r.error); };
    });
  }
  function lireBase(cle){
    return ouvrirBase().then(function(b){
      return new Promise(function(ok, rate){
        var t = b.transaction(MAGASIN, "readonly").objectStore(MAGASIN).get(cle || CLE);
        t.onsuccess = function(){ ok(t.result || null); };
        t.onerror = function(){ rate(t.error); };
      });
    });
  }
  function ecrireBase(doc, cle){
    return ouvrirBase().then(function(b){
      return new Promise(function(ok, rate){
        var tr = b.transaction(MAGASIN, "readwrite");
        tr.objectStore(MAGASIN).put(doc, cle || CLE);
        tr.oncomplete = function(){ ok(true); };
        tr.onerror = function(){ rate(tr.error); };
      });
    });
  }

  /* Enregistrer après chaque geste. Si l'écriture échoue (navigation privée,
     place saturée), on le dit au lieu de laisser croire que c'est noté. */
  /* La « photo » du dernier enregistrement. En la comparant au carnet, on
     sait quelles fiches ont changé ou disparu, sans dépendre de chaque
     endroit du code qui modifie quelque chose (voir Calculs.marquer). */
  var photo = {};

  /* Mettre un carnet aux normes de cette version : toutes les listes
     existent, le registre des suppressions aussi, chaque comptage de caisse
     a un identifiant. Sert au chargement, à la restauration et après une
     synchronisation. */
  function normaliser(c){
    C.LISTES.forEach(function(l){ if (!c[l]) c[l] = []; });
    if (!c.supprimes) c.supprimes = {};
    if (!c.reglages) c.reglages = {};
    if (!c.reglages.cats) c.reglages.cats = [];
    c.pointages.forEach(function(p){ if (!p.id) p.id = C.nouvelId(); });
    return c;
  }

  function enregistrer(silencieux){
    d.modifie = new Date().toISOString();
    var changements = C.marquer(photo, d, Date.now());
    photo = C.photographier(d);
    if (changements && typeof Synchro !== "undefined") Synchro.noter();
    return ecrireBase(d).then(function(){
      if (!silencieux) toast("Noté");
      return true;
    }).catch(function(e){
      toast("ENREGISTREMENT IMPOSSIBLE : " + (e && e.message ? e.message : e));
      return false;
    });
  }

  /* -------------------------------------------------- données de départ
     Le code ne contient AUCUN chiffre personnel : ni salaire, ni loyer, ni
     nom. Il est fait pour être hébergé, donc lu par n'importe qui ; les
     données, elles, ne doivent jamais se trouver sur un serveur en clair.

     Les charges, le salaire et les aides arrivent par un fichier à part,
     prive/depart.json, qui reste sur la machine et que git ignore.
     Quand il est présent (window.CARNET_DEPART), le carnet neuf démarre
     avec ; sinon il démarre vide, et tout se saisit avec le bouton +.

     Une ligne marquée prochaine:"auto" reçoit sa première date à partir du
     jour de l'installation. Une ligne à prochaine:null part sans date :
     elle remonte dans « Sans date » jusqu'à ce qu'on la fixe. Le carnet
     s'applique à lui-même sa propre règle. */
  function donneesInitiales(auj, depart){
    var copie = depart ? JSON.parse(JSON.stringify(depart)) : {};
    var recurrents = (copie.recurrents || []).map(function(c){
      if (c.prochaine === "auto") c.prochaine = C.premiere(c.rythme, auj);
      return c;
    });
    var tiers = (copie.tiers || []).map(function(t){ t.cree = auj; return t; });
    return {
      version:1, cree:auj, modifie:null,
      comptes:[
        {id:1, nom:"Espèces", type:"especes", soldeInitial:0, depuis:auj},
        {id:2, nom:"Mobile money", type:"mobile", soldeInitial:0, depuis:auj},
        {id:3, nom:"Banque", type:"banque", soldeInitial:0, depuis:auj}
      ],
      tiers:tiers, mouvements:[], engagements:[], participations:[], opportunites:[],
      biens:[], credits:[], pointages:[],
      recurrents:recurrents,
      enveloppes:copie.enveloppes || [],
      reglages:{
        devise:"XOF",
        cats:["Maison","Nourriture","Aides","Scolarité","Transport","Santé",
              "Famille & social","Télécom","Affaires","Prêts","Placements","Salaire","Divers"],
        verrou:null, biometrie:null, dernierExport:null
      }
    };
  }
  function depart(){ return (typeof window !== "undefined" && window.CARNET_DEPART) || null; }

  /* --------------------------------------------------------- petits outils */
  function esc(s){
    return String(s == null ? "" : s).replace(/[&<>"]/g, function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; });
  }
  function el(id){ return document.getElementById(id); }
  var minuteurToast = null;
  function toast(msg){
    var z = el("zone-toast");
    if (!z) return;
    /* Tant qu'une annulation est proposée, un simple « Noté » ne doit pas
       venir effacer le bouton : c'est lui qu'on a besoin de voir. */
    if (annulation && Date.now() < annulation.jusque) return;
    z.innerHTML = '<div class="toast">' + esc(msg) + '</div>';
    if (minuteurToast) clearTimeout(minuteurToast);
    minuteurToast = setTimeout(function(){ z.innerHTML = ""; }, 2600);
  }

  /* -------------------------------------------------------- annulation
     Une suppression part tout de suite, et se répercute sur l'autre appareil.
     Pendant quelques secondes, on peut donc la reprendre : le carnet d'avant
     est gardé en mémoire, et un bouton le remet en place.
     Garde-fou : si le carnet a changé entre-temps (une synchronisation, une
     autre saisie), on ne restaure pas — remettre l'ancienne copie effacerait
     ce qui est arrivé depuis. */
  var DELAI_ANNULATION = 8000;
  var annulation = null;
  function instantane(){ return JSON.stringify(d); }
  function proposerAnnulation(avant, libelle){
    var apres = instantane();
    if (avant === apres) return;                       // rien n'a été supprimé (refus, erreur)
    annulation = {avant:avant, apres:apres, jusque:Date.now() + DELAI_ANNULATION};
    var z = el("zone-toast");
    if (!z) return;
    z.innerHTML = '<div class="toast avec-bouton">' + esc(libelle)
      + '<button onclick="Carnet.annuler()">Annuler</button></div>';
    if (minuteurToast) clearTimeout(minuteurToast);
    minuteurToast = setTimeout(function(){ z.innerHTML = ""; annulation = null; }, DELAI_ANNULATION);
  }
  function annuler(){
    var a = annulation, z = el("zone-toast");
    annulation = null;
    if (z) z.innerHTML = "";
    if (!a) return;
    if (Date.now() > a.jusque) return toast("Trop tard pour annuler.");
    /* « modifie » change à chaque écriture : il ne dit rien du contenu */
    var sansHeure = function(texte){ var c = JSON.parse(texte); delete c.modifie; return JSON.stringify(c); };
    if (sansHeure(instantane()) !== sansHeure(a.apres)) return toast("Le carnet a changé depuis : annulation impossible.");
    d = normaliser(JSON.parse(a.avant));
    enregistrer(true).then(function(){ rendre(); toast("Rétabli"); });
  }
  function parTiers(id){
    return (d.tiers||[]).filter(function(t){ return t.id === id; })[0] || null;
  }
  function nomTiers(id){ var t = parTiers(id); return t ? t.nom : null; }
  function parCompte(id){
    return (d.comptes||[]).filter(function(c){ return c.id === id; })[0] || null;
  }
  function nomCompte(id){ var c = parCompte(id); return c ? c.nom : "en nature"; }
  function parId(liste, id){
    return (liste||[]).filter(function(x){ return x.id === id; })[0] || null;
  }
  /* Un montant tapé au téléphone arrive avec des espaces, des points, parfois
     un « F ». On ne garde que les chiffres : 300 000 et 300.000 valent pareil. */
  function montantDe(v){
    var n = String(v == null ? "" : v).replace(/[^0-9]/g, "");
    return n === "" ? null : Number(n);
  }

  /* Le carnet est-il encore vide ? Sert à proposer les premiers gestes
     au lieu d'afficher des zéros sans rien dire. */
  function debutant(){
    return !(d.mouvements||[]).length && !C.liquidites(d);
  }

  /* ------------------------------------------------------------- rendu */
  function rendre(){
    etat.auj = C.aujourdhui();
    var zone = el("vue");
    try {
      zone.innerHTML = Vues[etat.vue] ? Vues[etat.vue]() : Vues.accueil();
    } catch (e) {
      zone.innerHTML = '<div class="bloc"><p class="objet">Cet écran n\'a pas pu s\'afficher</p>'
        + '<p class="sous-bloc">' + esc(e && e.message ? e.message : e) + '</p>'
        + '<p class="sous-bloc">Tes données ne sont pas perdues. Dis-moi ce message.</p></div>';
    }
    dessinerOnglets();
    /* On ne remonte en haut que si on a changé d'écran. Payer une charge au
       milieu d'une liste ne doit pas renvoyer tout en haut de la page. */
    var ecran = etat.vue + ":" + etat.id;
    if (ecran !== etat.affichee) { etat.affichee = ecran; window.scrollTo(0,0); }
  }

  var ONGLETS = [["accueil","◉","Accueil"],["depenses","▤","Dépenses"],["tiers","◍","Tiers"],
                 ["affaires","◆","Business"],["patrimoine","◰","Patrimoine"]];
  function dessinerOnglets(){
    el("onglets").innerHTML = ONGLETS.map(function(o){
      var actif = etat.vue === o[0] || (etat.vue === "fiche" && o[0] === "tiers");
      return '<button onclick="Carnet.aller(\'' + o[0] + '\')"'
        + (actif ? ' aria-current="page"' : '') + '><b>' + o[1] + '</b>' + o[2] + '</button>';
    }).join("");
  }
  function aller(vue){ etat.vue = vue; etat.id = null; rendre(); }
  function ouvrirTiers(id){ etat.vue = "fiche"; etat.id = id; rendre(); }

  /* ----------------------------------------------------------- actions
     Toutes les actions passent par ici : elles modifient d, enregistrent,
     puis redessinent. Aucune vue ne touche les données directement. */

  function creerTiers(nom, genre, tel, note){
    var t = {id:C.nouvelId(d.tiers), nom:nom, genre:genre || "Proche",
             tel:tel || "", note:note || "", cree:etat.auj};
    d.tiers.push(t);
    return t;
  }

  function ajouterMouvement(m){
    m.id = C.nouvelId(d.mouvements);
    var refus = C.exigeUneDate("mouvement", m);
    if (refus) { toast(refus); return null; }
    d.mouvements.push(m);
    return m;
  }

  /* Payer (ou encaisser) une ligne qui revient : on note le mouvement réel,
     puis la charge avance d'elle-même à sa prochaine date. Le montant est
     modifiable parce qu'une facture CIE n'est jamais deux fois la même. */
  function reglerRecurrent(id, montant, date, compte, avance){
    var c = parId(d.recurrents, id);
    if (!c) return;
    var sortie = c.sens !== "entree";
    var mv = ajouterMouvement({date:date, tiers:c.tiers, libelle:c.libelle,
      montant:sortie ? -Math.abs(montant) : Math.abs(montant),
      compte:compte, nature:sortie ? "depense" : "recette", cat:c.cat,
      /* Une charge fixe ne consomme aucune enveloppe ; une aide, si : son
         plafond est justement là pour être mangé. */
      fixe:!c.facultatif, recurrent:c.id});
    /* On garde la date de règlement la plus récente : rattraper après coup
       un paiement plus ancien ne doit pas faire croire que le mois en cours
       n'est plus réglé. */
    if (!c.dernierRegle || date > c.dernierRegle) c.dernierRegle = date;
    /* « avance » à false : on règle une échéance déjà passée, la prochaine
       ne bouge pas. Sans ce choix, payer la facture d'octobre le 13 ferait
       disparaître celle de novembre, et personne ne la rappellerait. */
    if (avance !== false) {
      /* On retient quelle échéance ce règlement a soldée : si on l'annule,
         c'est elle qui doit redevenir « à payer ». */
      if (mv) mv.echeanceReglee = c.prochaine || date;
      c.prochaine = C.avancer(c.rythme, c.prochaine || date);
      /* Si la date d'origine était très en retard, avancer d'un seul pas peut
         laisser la prochaine dans le passé : on rattrape jusqu'à aujourd'hui. */
      var garde = 0;
      while (c.prochaine && c.prochaine < etat.auj && garde++ < 60)
        c.prochaine = C.avancer(c.rythme, c.prochaine);
    }
    /* On dit ce qui vient de se passer dans le compte : c'est la preuve que
       la charge a bien été prise en compte, pas seulement cochée. */
    var compteTouche = parCompte(compte);
    enregistrer(true).then(function(ok){
      if (!ok) return;
      /* Court : sur un téléphone, un long message recouvre la liste qu'on
         vient de modifier. La prochaine date se lit sur la ligne elle-même. */
      var quoi = (sortie ? "−" : "+") + C.F(Math.abs(montant));
      toast(!compteTouche ? quoi + " noté · aucun compte touché"
        : mv && !C.dansLeSolde(d, mv) ? "Noté au " + C.jf(date).slice(0,5) + " · " + compteTouche.nom
            + " non touché, déjà dans son solde"
        : quoi + " sur " + compteTouche.nom + " · reste " + C.F(C.soldeCompte(d, compte)));
    });
    rendre();
  }

  /* Versement sur un engagement : le mouvement est la vérité, les tranches
     en découlent. appliquerVersement coupe une tranche en deux si le
     versement est partiel, pour que le reste dû reste exact. */
  /* L'écriture « dû » d'un business suit toujours son état :
       validé  → tout ce que portent ses tranches ;
       annoncé → seulement ce qui a déjà été encaissé (pour que celui qui a
                 payé ne se retrouve pas créancier), donc rien si rien n'est
                 rentré.
     Appelée après chaque création, modification, validation, encaissement. */
  function accorderDu(e){
    if (!C.estBusiness(e)) return;
    d.mouvements.forEach(function(m){ if (m.engagement === e.id) m.tiers = e.tiers; });
    var du = d.mouvements.filter(function(m){ return m.engagement === e.id && C.sansArgent(m); })[0];
    var cible = C.estValide(e) ? C.totalEngagement(e) : C.regleEngagement(e);
    if (cible > 0) {
      if (du) { du.montant = cible; du.libelle = "Dû — " + e.objet; }
      else ajouterMouvement({date:e.cree || etat.auj, tiers:e.tiers, libelle:"Dû — " + e.objet, montant:cible,
        compte:null, nature:"du_affaire", cat:"Affaires", engagement:e.id});
    } else if (du) d.mouvements = d.mouvements.filter(function(m){ return m !== du; });
  }
  function reglerEngagement(id, montant, date, compte){
    var e = parId(d.engagements, id);
    if (!e) return;
    var creance = e.sens === "creance";
    /* Une tranche d'affaire encaissée n'est pas un prêt qu'on me rend : elle
       se range avec le business, pas avec les prêts. */
    var business = e.origine === "business";
    ajouterMouvement({date:date, tiers:e.tiers, libelle:business ? "Encaissement — " + e.objet : e.objet,
      montant:creance ? Math.abs(montant) : -Math.abs(montant),
      compte:compte, nature:creance ? "remboursement_recu" : "remboursement_verse",
      cat:business ? "Affaires" : "Prêts", engagement:e.id});
    var trop = C.appliquerVersement(e, montant, date);
    accorderDu(e);
    if (trop > 0) toast("Versement supérieur au reste dû : " + C.F(trop) + " en trop, à vérifier.");
    enregistrer(true);
    rendre();
  }

  /* « Pas ce mois-ci » : une aide facultative qu'on ne verse pas doit avancer
     à sa prochaine date sans qu'aucun mouvement soit créé. Le carnet ne doit
     jamais laisser croire qu'un argent est sorti. */
  function passerRecurrent(id){
    var c = parId(d.recurrents, id);
    if (!c || !c.prochaine) return;
    var avant = c.prochaine;
    c.prochaine = C.avancer(c.rythme, c.prochaine);
    var garde = 0;
    while (c.prochaine && c.prochaine < etat.auj && garde++ < 60)
      c.prochaine = C.avancer(c.rythme, c.prochaine);
    enregistrer(true);
    toast("Passé sans rien verser — prochaine fois le " + C.jf(c.prochaine));
    rendre();
  }

  /* Retirer un mouvement, et défaire ce qu'il avait entraîné. Un règlement de
     charge fixe supprimé doit rendre la charge « à payer » : sa date de
     dernier règlement est recalculée d'après ce qui reste, et si ce règlement
     avait fait avancer l'échéance, elle revient en arrière — à condition que
     la charge soit exactement un pas plus loin, sinon on ne touche à rien
     plutôt que de deviner. */
  function retirerMouvement(id){
    var m = parId(d.mouvements, id);
    if (!m) return null;
    d.mouvements = d.mouvements.filter(function(x){ return x.id !== id; });
    if (m.recurrent != null) {
      var c = parId(d.recurrents, m.recurrent);
      if (c) {
        if (m.echeanceReglee && c.prochaine === C.avancer(c.rythme, m.echeanceReglee)) c.prochaine = m.echeanceReglee;
        c.dernierRegle = C.dernierReglement(d, c.id);
      }
    }
    return m;
  }
  function supprimerMouvement(id){
    if (!retirerMouvement(id)) return;
    enregistrer();
    rendre();
  }
  /* Annuler un règlement fait par erreur (ou en double) : le compte retrouve
     son argent, la charge redevient à payer. */
  function annulerReglement(id){
    var m = parId(d.mouvements, id);
    if (!m) return;
    var compte = parCompte(m.compte), comptait = C.dansLeSolde(d, m);
    retirerMouvement(id);
    enregistrer(true).then(function(ok){
      if (ok) toast("Règlement annulé" + (compte && comptait ? " · " + compte.nom + " retrouve " + C.F(Math.abs(m.montant)) : ""));
    });
    rendre();
  }

  /* Pointage des espèces : on ne corrige pas le solde en douce, on ajoute
     un mouvement « écart de caisse » daté. Un solde qui se corrige tout
     seul est un solde qui mentira la fois suivante. */
  function pointerCompte(idCompte, reel, date){
    var attendu = C.soldeCompte(d, idCompte);
    var ecart = reel - attendu;
    d.pointages.push({id:C.nouvelId(), date:date, compte:idCompte, attendu:attendu, reel:reel, ecart:ecart});
    if (ecart !== 0) {
      ajouterMouvement({date:date, tiers:null, libelle:"Écart de caisse constaté",
        montant:ecart, compte:idCompte,
        nature:ecart < 0 ? "depense" : "recette", cat:"Divers", ecart:true});
      toast(ecart < 0 ? "Écart noté : " + C.F(ecart) + " manquants"
                      : "Écart noté : " + C.F(ecart) + " en plus");
    } else toast("Le compte tombe juste");
    enregistrer(true);
    rendre();
  }

  /* Effacer ne concerne que CET appareil. On coupe d'abord la
     synchronisation : sinon l'effacement partirait vers le dépôt et viderait
     aussi l'autre appareil. */
  function supprimerTout(){
    remplacerDonnees(donneesInitiales(C.aujourdhui(), depart()))
      .then(function(){ toast("Carnet remis à zéro sur cet appareil"); });
  }

  /* Poser un carnet entier à la place de l'actuel.
       — marquer:true  : ce sont de nouvelles saisies (le fichier de départ),
         elles doivent partir vers l'autre appareil comme n'importe quelle saisie ;
       — sinon : c'est un remplacement en bloc (restauration, remise à zéro).
         Le propager fiche par fiche effacerait l'autre appareil sans prévenir,
         donc on coupe la synchronisation, et c'est en reliant de nouveau
         qu'on choisit quel carnet fait foi. */
  /* Tout carnet qui arrive de l'extérieur passe par ce contrôle. */
  function refuse(nouveau){
    var defauts = C.defautsCarnet(nouveau);
    if (!defauts.length) return false;
    toast("Carnet refusé : " + defauts[0] + ". Rien n'a été changé.");
    return true;
  }
  function remplacerDonnees(nouveau, options){
    if (refuse(nouveau)) return Promise.reject(new Error("carnet invalide"));
    d = normaliser(nouveau);
    if (options && options.marquer) return enregistrer(true).then(function(){ aller("accueil"); });
    photo = C.photographier(d);
    if (typeof Synchro !== "undefined" && Synchro.relie()) Synchro.delier(true);
    d.modifie = new Date().toISOString();
    return ecrireBase(d).then(function(){ aller("accueil"); });
  }

  /* Réservé à la synchronisation : poser le carnet fusionné sans rien
     marquer comme « modifié ici ». Les dates des fiches viennent de la
     fusion ; les remarquer ferait repartir le carnet dans l'autre sens. */
  function appliquer(nouveau){
    if (refuse(nouveau)) return Promise.resolve(false);
    d = normaliser(nouveau);
    photo = C.photographier(d);
    d.modifie = new Date().toISOString();
    return ecrireBase(d);
  }

  /* --------------------------------------------------------- démarrage */
  function demarrer(){
    el("jour").textContent = C.dateDe(C.aujourdhui())
      .toLocaleDateString("fr-FR", {weekday:"long", day:"numeric", month:"long"});
    lireBase().then(function(doc){
      d = normaliser(doc || donneesInitiales(C.aujourdhui(), depart()));
      photo = C.photographier(d);
      if (!doc) return ecrireBase(d);
    }).then(function(){
      demanderStockageDurable();
      Verrou.auDemarrage();
    }).catch(function(e){
      el("vue").innerHTML = '<div class="bloc"><p class="objet">Le carnet n\'a pas pu s\'ouvrir</p>'
        + '<p class="sous-bloc">' + esc(e && e.message ? e.message : e) + '</p>'
        + '<p class="sous-bloc">En navigation privée, le stockage est refusé : ouvre la page normalement.</p></div>';
    });
  }
  /* Par défaut, un navigateur peut vider le stockage d'un site quand la place
     manque. On demande explicitement que celui-ci soit conservé. L'iPhone
     l'accorde aux apps posées sur l'écran d'accueil ; ailleurs il peut refuser,
     et on garde la réponse pour l'afficher dans les Réglages. */
  var stockageDurable = null;
  function demanderStockageDurable(){
    try {
      if (navigator.storage && navigator.storage.persist)
        navigator.storage.persist().then(function(ok){ stockageDurable = !!ok; })
          .catch(function(){ stockageDurable = false; });
    } catch (e) { stockageDurable = false; }
  }

  function demarrerVraiment(){
    el("barre-haut").hidden = false;
    rendre();
    if (typeof Synchro !== "undefined") Synchro.auDemarrage();
    /* « toggle » ne remonte pas dans la page : on l'écoute à la capture. */
    if (typeof document.addEventListener === "function")
      document.addEventListener("toggle", function(ev){
        var t = ev.target, id = t && t.getAttribute && t.getAttribute("data-section");
        if (id) etat.ouverts[id] = !!t.open;
      }, true);
    /* Hors ligne : le service worker garde l'app disponible sans réseau.
       Il n'existe pas dans tous les contextes (aperçu, page locale), donc
       on essaie sans en faire dépendre le démarrage. */
    try {
      if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0)
        navigator.serviceWorker.register("sw.js").catch(function(){});
    } catch (e) {}
  }

  return {
    VERSION:VERSION, stockageDurable:function(){ return stockageDurable; },
    demarrer:demarrer, demarrerVraiment:demarrerVraiment, rendre:rendre,
    aller:aller, ouvrirTiers:ouvrirTiers,
    donnees:function(){ return d; }, etat:function(){ return etat; },
    donneesInitiales:donneesInitiales, remplacerDonnees:remplacerDonnees, appliquer:appliquer,
    stockLire:function(cle){ return lireBase(cle); },
    stockEcrire:function(cle, valeur){ return ecrireBase(valeur, cle); },
    enregistrer:enregistrer, toast:toast, esc:esc, el:el, montantDe:montantDe,
    parTiers:parTiers, nomTiers:nomTiers, parCompte:parCompte, nomCompte:nomCompte,
    parId:parId, debutant:debutant, creerTiers:creerTiers, ajouterMouvement:ajouterMouvement,
    reglerRecurrent:reglerRecurrent, passerRecurrent:passerRecurrent,
    reglerEngagement:reglerEngagement,
    supprimerMouvement:supprimerMouvement, annulerReglement:annulerReglement, pointerCompte:pointerCompte,
    accorderDu:accorderDu, instantane:instantane, proposerAnnulation:proposerAnnulation, annuler:annuler,
    supprimerTout:supprimerTout
  };
})();
