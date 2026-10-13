/* Clauvi's Carnet — synchronisation entre appareils.

   Les appareils ne se parlent pas directement : chacun dépose et relit UN
   fichier chiffré dans un dépôt GitHub privé. GitHub ne voit que du chiffré,
   illisible sans la phrase de passe, qui ne quitte jamais les appareils.

   Ce fichier ne fait que le transport : lire le dépôt, déchiffrer, demander
   à calculs.js quoi garder (Calculs.tour), rechiffrer, renvoyer. La décision
   de fusion n'est pas ici, elle est dans calculs.js où des tests la tiennent.

   Ce qui est gardé sur l'appareil pour que ça marche, et jamais ailleurs :
     — le jeton d'accès au dépôt (il ne donne accès qu'à du chiffré) ;
     — la clé de chiffrement, sous une forme que le programme peut utiliser
       mais pas relire ni exporter (clé « non extractible ») ;
   ni l'un ni l'autre ne part dans le dépôt, ni dans la sauvegarde. */

var Synchro = (function(){
  "use strict";
  var C = Calculs;

  var CLE_LOCALE = "synchro";              // case à part dans le stockage de l'appareil
  var FICHIER = "carnet.chiffre.json";
  var API = "https://api.github.com";
  var ITERATIONS = 210000;
  var DELAI_APRES_SAISIE = 2500;           // on laisse finir une série de saisies avant d'envoyer

  var cfg = null;      // {depot, jeton, cle, sel, epoque, sha, dernier, enAttente}
  var etat = {code:"inactif", message:""};
  var tourEnCours = null;
  var minuteur = null;
  var enAttenteDeChoix = null;             // ce qu'on a lu du dépôt, en attendant qu'il choisisse

  function el(i){ return document.getElementById(i); }

  /* La synchronisation a besoin du réseau vers GitHub et du chiffrement du
     navigateur. Dans une page affichée à l'intérieur de Claude, le réseau
     vers l'extérieur est fermé : on le dit plutôt que d'échouer sans raison. */
  function possible(){
    return typeof fetch === "function" && typeof crypto !== "undefined" && !!crypto.subtle
        && !(typeof window !== "undefined" && window.claude);
  }
  function relie(){ return !!(cfg && cfg.depot && cfg.jeton && cfg.cle); }

  /* ------------------------------------------------------------- octets */
  function b64(octets){
    var o = "", u = new Uint8Array(octets);
    for (var i = 0; i < u.length; i++) o += String.fromCharCode(u[i]);
    return btoa(o);
  }
  function deB64(s){
    var b = atob(s), u = new Uint8Array(b.length);
    for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
    return u;
  }
  function alea(n){ return crypto.getRandomValues(new Uint8Array(n)); }

  /* Le carnet est du texte très répétitif : compressé, il pèse cinq à dix
     fois moins. Chaque envoi laisse une version dans le dépôt, donc moins il
     pèse, plus le dépôt reste petit longtemps. */
  function compresser(octets){
    if (typeof CompressionStream === "undefined") return Promise.resolve({octets:octets, gz:false});
    var flux = new Blob([octets]).stream().pipeThrough(new CompressionStream("gzip"));
    return new Response(flux).arrayBuffer().then(function(b){ return {octets:new Uint8Array(b), gz:true}; });
  }
  function decompresser(octets, gz){
    if (!gz) return Promise.resolve(octets);
    if (typeof DecompressionStream === "undefined")
      return Promise.reject(new Error("Ce navigateur est trop ancien pour lire le carnet du dépôt."));
    var flux = new Blob([octets]).stream().pipeThrough(new DecompressionStream("gzip"));
    return new Response(flux).arrayBuffer().then(function(b){ return new Uint8Array(b); });
  }

  /* ------------------------------------------------------- chiffrement
     La clé est dérivée une fois de la phrase de passe, puis gardée « non
     extractible » : le navigateur accepte de chiffrer avec, mais refuse de
     la montrer. La phrase, elle, n'est jamais stockée. */
  function deriver(phrase, sel){
    return crypto.subtle.importKey("raw", new TextEncoder().encode(phrase), "PBKDF2", false, ["deriveKey"])
      .then(function(k){
        return crypto.subtle.deriveKey({name:"PBKDF2", salt:sel, iterations:ITERATIONS, hash:"SHA-256"},
          k, {name:"AES-GCM", length:256}, false, ["encrypt","decrypt"]);
      });
  }
  function chiffrerFichier(donnees, cle, sel, epoque){
    var iv = alea(12);
    return compresser(new TextEncoder().encode(JSON.stringify(donnees))).then(function(c){
      return crypto.subtle.encrypt({name:"AES-GCM", iv:iv}, cle, c.octets).then(function(chiffre){
        return JSON.stringify({format:"clauvis-carnet-synchro-1", iterations:ITERATIONS,
          sel:sel, epoque:epoque, iv:b64(iv), gz:c.gz, donnees:b64(chiffre)});
      });
    });
  }
  function enTete(texte){
    var p = JSON.parse(texte);
    if (!p.format || p.format.indexOf("clauvis-carnet-synchro") !== 0)
      throw new Error("Le fichier du dépôt n'est pas un carnet.");
    return p;
  }
  function dechiffrerFichier(texte, cle){
    var p = enTete(texte);
    return crypto.subtle.decrypt({name:"AES-GCM", iv:deB64(p.iv)}, cle, deB64(p.donnees))
      .then(function(clair){ return decompresser(new Uint8Array(clair), p.gz); })
      .then(function(octets){ return {donnees:JSON.parse(new TextDecoder().decode(octets)), epoque:p.epoque}; });
  }

  /* ------------------------------------------------------------- GitHub */
  function probleme(code, message, extra){
    var e = new Error(message); e.code = code;
    if (extra) for (var k in extra) e[k] = extra[k];
    return e;
  }
  function appel(methode, chemin, corps, depot, jeton){
    return fetch(API + "/repos/" + (depot || cfg.depot) + chemin, {
      method:methode, cache:"no-store",
      headers:{"Authorization":"Bearer " + (jeton || cfg.jeton),
               "Accept":"application/vnd.github+json", "X-GitHub-Api-Version":"2022-11-28"},
      body:corps ? JSON.stringify(corps) : undefined
    }).catch(function(){ throw probleme("reseau", "Pas de réseau."); });
  }
  function refus(r){
    if (r.status === 401) return probleme("jeton", "Jeton refusé : il a expiré ou a été révoqué.");
    if (r.status === 403) return probleme("interdit", "GitHub refuse l'accès (droits du jeton, ou trop de demandes).");
    if (r.status === 404) return probleme("introuvable", "Dépôt introuvable, ou le jeton n'y a pas accès.");
    return probleme("http", "GitHub a répondu " + r.status + ".");
  }
  function lireDepot(depot, jeton){
    return appel("GET", "/contents/" + FICHIER, null, depot, jeton).then(function(r){
      if (r.status === 404) return null;                 // dépôt vide ou fichier pas encore créé
      if (!r.ok) throw refus(r);
      return r.json().then(function(j){
        if (j.content) return {texte:atob(j.content.replace(/\s/g, "")), sha:j.sha};
        /* Au-delà d'un mégaoctet, GitHub ne joint plus le contenu : on le
           redemande par son empreinte. */
        return appel("GET", "/git/blobs/" + j.sha, null, depot, jeton).then(function(r2){
          if (!r2.ok) throw refus(r2);
          return r2.json();
        }).then(function(b){ return {texte:atob(b.content.replace(/\s/g, "")), sha:j.sha}; });
      });
    });
  }
  /* « sha » est l'empreinte de la version qu'on a lue. Si quelqu'un a écrit
     entre-temps, GitHub refuse : on relit et on refusionne, on n'écrase pas. */
  function ecrireDepot(texte, sha){
    var corps = {message:"Synchronisation du carnet", content:btoa(texte)};
    if (sha) corps.sha = sha;
    return appel("PUT", "/contents/" + FICHIER, corps).then(function(r){
      if (r.status === 409 || r.status === 422) throw probleme("conflit", "Le dépôt a changé entre-temps.");
      if (!r.ok) throw refus(r);
      return r.json().then(function(j){ return j.content.sha; });
    });
  }

  /* -------------------------------------------------------- un tour
     Lire, décider, appliquer, renvoyer. Entre « décider » et « appliquer »
     il n'y a aucune attente : une saisie ne peut pas se glisser entre les
     deux et se faire écraser. Si une saisie arrive pendant l'envoi, elle
     relève le drapeau « en attente » et part au tour suivant. */
  function unTour(essai){
    return lireDepot().then(function(fichier){
      var lu = fichier ? dechiffrerFichier(fichier.texte, cfg.cle) : Promise.resolve(null);
      return lu.then(function(distant){
        var local = Carnet.donnees();
        var t = C.tour(local, cfg.epoque, distant && distant.donnees, distant && distant.epoque);
        if (t.decision === "choisir") { enAttenteDeChoix = {fichier:fichier, distant:distant}; return "choisir"; }
        var change = !C.memeContenu(local, t.carnet);
        cfg.epoque = distant ? distant.epoque : (cfg.epoque || b64(alea(9)));
        cfg.enAttente = false;
        if (change) { Carnet.appliquer(t.carnet); rafraichir(); }
        if (!t.envoyer) { cfg.sha = fichier ? fichier.sha : null; return t.decision; }
        return chiffrerFichier(C.pourEnvoi(Carnet.donnees()), cfg.cle, cfg.sel, cfg.epoque)
          .then(function(texte){ return ecrireDepot(texte, fichier && fichier.sha); })
          .then(function(sha){ cfg.sha = sha; return t.decision; })
          .catch(function(e){
            cfg.enAttente = true;
            if (e.code === "conflit" && (essai || 0) < 3) return unTour((essai || 0) + 1);
            throw e;
          });
      });
    });
  }

  function synchroniser(){
    if (!relie() || !possible()) return Promise.resolve("inactif");
    if (tourEnCours) return tourEnCours;
    if (minuteur) { clearTimeout(minuteur); minuteur = null; }
    dire("encours", "Synchronisation…");
    tourEnCours = unTour(0).then(function(decision){
      tourEnCours = null;
      if (decision === "choisir") { dire("choix", "Deux carnets différents : à toi de choisir."); return decision; }
      cfg.dernier = new Date().toISOString();
      memoriser();
      dire(cfg.enAttente ? "attente" : "ajour", cfg.enAttente ? "Des saisies attendent d'être envoyées." : "À jour.");
      if (cfg.enAttente) planifier();
      return decision;
    }).catch(function(e){
      tourEnCours = null;
      memoriser();
      if (e.code === "reseau") dire("horsligne", "Hors ligne : ce sera envoyé au retour du réseau.");
      else if (e.name === "OperationError")
        dire("erreur", "Le carnet du dépôt ne s'ouvre pas avec la clé de cet appareil. Relie-le de nouveau.");
      else dire("erreur", e.message || String(e));
      return "erreur";
    });
    return tourEnCours;
  }

  /* Appelé par l'app à chaque enregistrement qui a réellement changé quelque
     chose. On n'envoie pas tout de suite : trois dépenses notées d'affilée
     font un seul envoi. */
  function noter(){
    if (!relie()) return;
    cfg.enAttente = true;
    if (etat.code !== "encours") dire("attente", "Des saisies attendent d'être envoyées.");
    planifier();
  }
  function planifier(){
    if (minuteur) clearTimeout(minuteur);
    minuteur = setTimeout(function(){ minuteur = null; synchroniser(); }, DELAI_APRES_SAISIE);
  }

  /* ---------------------------------------------------- état affiché */
  function dire(code, message){
    etat = {code:code, message:message};
    var b = el("etat-synchro");
    if (b) {
      b.hidden = !relie() && code !== "choix";
      b.setAttribute("data-etat", code);
      b.title = message;
      b.setAttribute("aria-label", "Synchronisation : " + message);
    }
    if (Carnet.etat().vue === "reglages" && el("couche") && !el("couche").innerHTML) Carnet.rendre();
  }
  /* Redessiner l'écran quand le dépôt a apporté du nouveau — sauf si une
     feuille de saisie est ouverte : on ne lui retire pas le sol sous les pieds. */
  function rafraichir(){
    if (el("couche") && !el("couche").innerHTML && el("verrou") && el("verrou").hidden !== false) Carnet.rendre();
  }
  function memoriser(){ return Carnet.stockEcrire(CLE_LOCALE, cfg); }

  /* ------------------------------------------------- relier un appareil */
  function feuilleRelier(){
    if (!possible()) return Carnet.toast("La synchronisation ne marche que dans l'app installée.");
    var champ = function(id, libelle, type, aide, exemple){
      return '<label class="champ">' + libelle + '<input id="f-' + id + '" type="' + type
        + '" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="' + (exemple || "") + '">'
        + (aide ? '<span class="aide">' + aide + '</span>' : '') + '</label>';
    };
    Formulaires.feuille("Relier cet appareil",
      "Les deux appareils déposeront le carnet, chiffré, dans le même dépôt GitHub privé.",
      champ("depot", "Dépôt", "text", "Le nom complet du dépôt privé, tel que GitHub l'affiche.", "moncompte/mon-depot")
      + champ("jeton", "Jeton d'accès", "password",
          "Un jeton limité à ce seul dépôt, avec le droit « Contents : lecture et écriture ». C'est toi qui le saisis ; il reste dans cet appareil.")
      + champ("phrase", "Phrase de passe", "password",
          "Elle chiffre le carnet. La même sur tous tes appareils. Personne ne peut te la redonner.")
      + champ("phrase2", "Répète la phrase", "password"),
      Formulaires.ANNULER + '<button class="principal" onclick="Synchro.relier()">Relier</button>');
  }

  function relier(){
    var depot = (Formulaires.valeur("depot") || "").trim().replace(/^https:\/\/github\.com\//, "").replace(/\.git$/, "");
    var jeton = (Formulaires.valeur("jeton") || "").trim();
    var phrase = Formulaires.valeur("phrase") || "", phrase2 = Formulaires.valeur("phrase2") || "";
    if (!/^[^\/\s]+\/[^\/\s]+$/.test(depot)) return Formulaires.erreur("Le dépôt s'écrit compte/nom-du-depot.");
    if (!jeton) return Formulaires.erreur("Il manque le jeton d'accès.");
    if (phrase.length < 10) return Formulaires.erreur("Au moins 10 caractères pour la phrase : c'est elle qui protège tes comptes.");
    if (phrase !== phrase2) return Formulaires.erreur("Les deux phrases ne sont pas identiques.");
    Formulaires.erreur("Vérification du dépôt…");

    var brouillon = {depot:depot, jeton:jeton, enAttente:false, sha:null, dernier:null, epoque:null};
    appel("GET", "", null, depot, jeton).then(function(r){
      if (!r.ok) throw refus(r);
      return r.json();
    }).then(function(infos){
      /* Le fichier est chiffré, mais on refuse quand même un dépôt public :
         un carnet de comptes n'a rien à faire en vitrine, même illisible. */
      if (infos.private !== true) throw probleme("public", "Ce dépôt est public. Choisis un dépôt privé.");
      if (infos.permissions && infos.permissions.push === false)
        throw probleme("droits", "Ce jeton peut lire le dépôt mais pas y écrire.");
      return lireDepot(depot, jeton);
    }).then(function(fichier){
      if (!fichier) {
        var sel = alea(16);
        return deriver(phrase, sel).then(function(cle){
          brouillon.cle = cle; brouillon.sel = b64(sel);
          return {fichier:null, distant:null};
        });
      }
      var tete = enTete(fichier.texte);
      return deriver(phrase, deB64(tete.sel)).then(function(cle){
        brouillon.cle = cle; brouillon.sel = tete.sel;
        return dechiffrerFichier(fichier.texte, cle).then(function(distant){
          return {fichier:fichier, distant:distant};
        }, function(){ throw probleme("phrase", "Ce n'est pas la phrase de passe de ce dépôt."); });
      });
    }).then(function(lu){
      cfg = brouillon;
      var dec = C.decision(Carnet.donnees(), null, lu.distant && lu.distant.donnees, lu.distant && lu.distant.epoque);
      if (dec === "choisir") { enAttenteDeChoix = lu; return feuilleChoisir(lu.distant.donnees); }
      Formulaires.fermer();
      return memoriser().then(synchroniser).then(function(){
        Carnet.toast(dec === "adopter" ? "Appareil relié : carnet reçu du dépôt" : "Appareil relié : carnet envoyé");
        Carnet.rendre();
      });
    }).catch(function(e){
      cfg = null;
      Formulaires.erreur(e.code === "reseau" ? "Pas de réseau : réessaie quand tu es connecté." : (e.message || String(e)));
    });
  }

  /* Deux carnets remplis qui ne se connaissent pas : aucune règle ne peut
     deviner lequel fait foi. On pose la question, une fois. */
  function feuilleChoisir(distant){
    var local = Carnet.donnees();
    var resume = function(d){ return (d.mouvements||[]).length + " mouvements, " + (d.tiers||[]).length + " tiers"; };
    Formulaires.feuille("Deux carnets différents",
      "Cet appareil : " + resume(local) + ". Le dépôt : " + resume(distant) + ".",
      '<p class="intro">Lequel fait foi ?</p>'
      + '<div class="actions"><button class="principal" onclick="Synchro.choisir(\'fusionner\')">Fusionner les deux — rien n\'est perdu</button></div>'
      + '<div class="actions"><button onclick="Synchro.choisir(\'adopter\')">Le dépôt remplace ce carnet</button></div>'
      + '<div class="actions"><button onclick="Synchro.choisir(\'remplacer\')">Ce carnet remplace le dépôt</button></div>'
      + '<p class="intro">« Remplacer » efface l\'autre côté. Dans le doute, sauvegarde d\'abord, ou fusionne.</p>',
      '<button onclick="Synchro.abandonnerChoix()">Annuler</button>');
  }
  function choisir(quoi){
    var lu = enAttenteDeChoix;
    if (!lu || !cfg) return;
    enAttenteDeChoix = null;
    Formulaires.fermer();
    if (quoi === "adopter") {
      cfg.epoque = lu.distant.epoque; cfg.sha = lu.fichier.sha; cfg.enAttente = false;
      Carnet.appliquer(C.adopter(Carnet.donnees(), lu.distant.donnees));
    } else if (quoi === "remplacer") {
      /* Nouvelle « époque » : les autres appareils comprendront que le dépôt
         a été remplacé exprès, et prendront ce carnet au lieu de fusionner. */
      cfg.epoque = b64(alea(9)); cfg.enAttente = true;
      return memoriser().then(function(){
        return chiffrerFichier(C.pourEnvoi(Carnet.donnees()), cfg.cle, cfg.sel, cfg.epoque);
      }).then(function(texte){ return ecrireDepot(texte, lu.fichier.sha); })
        .then(function(sha){
          cfg.sha = sha; cfg.enAttente = false; cfg.dernier = new Date().toISOString();
          dire("ajour", "À jour."); Carnet.toast("Ce carnet a remplacé celui du dépôt");
          return memoriser();
        }).then(function(){ Carnet.rendre(); })
        .catch(function(e){ dire("erreur", e.message || String(e)); Carnet.rendre(); });
    } else {
      cfg.epoque = lu.distant.epoque;                    // même histoire désormais : le tour fusionnera
    }
    return memoriser().then(synchroniser).then(function(){
      Carnet.toast(quoi === "adopter" ? "Carnet reçu du dépôt" : "Les deux carnets sont fusionnés");
      Carnet.rendre();
    });
  }
  function abandonnerChoix(){ enAttenteDeChoix = null; cfg = null; Formulaires.fermer(); Carnet.rendre(); }

  /* Délier ne touche ni au carnet de l'appareil ni au dépôt : l'appareil
     cesse simplement d'envoyer et de recevoir. */
  function delier(silencieux){
    cfg = null; enAttenteDeChoix = null;
    if (minuteur) { clearTimeout(minuteur); minuteur = null; }
    etat = {code:"inactif", message:""};
    var b = typeof document !== "undefined" && el("etat-synchro");
    if (b) b.hidden = true;
    var p = Carnet.stockEcrire(CLE_LOCALE, null);
    if (!silencieux) { Carnet.toast("Appareil délié : le carnet reste ici, il ne se synchronise plus"); Carnet.rendre(); }
    return p;
  }

  /* ---------------------------------------------------------- démarrage */
  function auDemarrage(){
    if (!possible()) return;
    Carnet.stockLire(CLE_LOCALE).then(function(c){
      if (!c || !c.cle) return;
      cfg = c;
      dire(cfg.enAttente ? "attente" : "ajour", cfg.enAttente ? "Des saisies attendent d'être envoyées." : "À jour.");
      synchroniser();
    }).catch(function(){});
    if (typeof window.addEventListener === "function") {
      window.addEventListener("online", function(){ if (relie()) synchroniser(); });
      document.addEventListener("visibilitychange", function(){ if (!document.hidden && relie()) synchroniser(); });
    }
  }

  return {
    auDemarrage:auDemarrage, synchroniser:synchroniser, noter:noter,
    feuilleRelier:feuilleRelier, relier:relier, choisir:choisir, abandonnerChoix:abandonnerChoix,
    delier:delier, relie:relie, possible:possible,
    etat:function(){ return etat; },
    infos:function(){ return cfg ? {depot:cfg.depot, dernier:cfg.dernier, enAttente:!!cfg.enAttente} : null; },
    /* exposés pour les essais uniquement */
    _chiffrer:chiffrerFichier, _dechiffrer:dechiffrerFichier, _deriver:deriver, _cfg:function(){ return cfg; }
  };
})();
