/* Clauvi's Carnet — calculs purs, sans DOM.
   Tout ce qui compte de l'argent vit ici, et pour une raison : ce fichier
   tourne sans navigateur (voir tests/regles.js), donc les deux règles non
   négociables — le solde d'un tiers est la somme de ses mouvements, et rien
   ne s'enregistre sans date — sont tenues par des tests en un seul endroit.
   L'écran (app.js) ne fait que montrer ce que ce fichier calcule. */

var Calculs = (function(){
  "use strict";

  /* ---------------------------------------------------------------- dates
     Les dates sont des chaînes "AAAA-MM-JJ" : comparables avec < et >,
     lisibles dans la sauvegarde, et insensibles au fuseau. Quand il faut
     vraiment un objet Date, on se place à midi : à minuit, un décalage
     d'une heure fait changer de jour. */

  function iso(d){
    var m = String(d.getMonth()+1), j = String(d.getDate());
    return d.getFullYear() + "-" + (m.length<2?"0":"") + m + "-" + (j.length<2?"0":"") + j;
  }
  function dateDe(s){ return new Date(s + "T12:00:00"); }
  function aujourdhui(){ return iso(new Date()); }
  function jours(de, a){ return Math.round((dateDe(a) - dateDe(de)) / 86400000); }
  function debutDuMois(s){ return s.slice(0,8) + "01"; }
  function finDuMois(s){
    var d = dateDe(s), f = new Date(d.getFullYear(), d.getMonth()+1, 0, 12);
    return iso(f);
  }
  function joursDuMois(s){ return Number(finDuMois(s).slice(8,10)); }

  /* Le 31 janvier + 1 mois ne peut pas être le 31 février : on retombe sur le
     dernier jour du mois, comme le fait un bailleur. */
  function ajouterMois(s, n, jourVoulu){
    var d = dateDe(s);
    var cible = new Date(d.getFullYear(), d.getMonth() + n, 1, 12);
    var dernier = new Date(cible.getFullYear(), cible.getMonth()+1, 0, 12).getDate();
    var j = Math.min(jourVoulu || d.getDate(), dernier);
    return iso(new Date(cible.getFullYear(), cible.getMonth(), j, 12));
  }

  /* Rythmes acceptés, un seul champ pour tous les cas réels :
       {type:"mensuel",     jour:10}                  le 10 de chaque mois
       {type:"trimestriel", jour:15}                  tous les 3 mois
       {type:"annuel",      jour:15, mois:[1]}        une fois l'an
       {type:"mois", mois:[9,11,12], jour:15}         seulement ces mois-là
       {type:"bimensuel", jours:[5,20]}               deux fois par mois
     « mois » est en numéros humains : 1 = janvier. */
  var PAS = {mensuel:1, trimestriel:3, annuel:12};

  /* Avancer : une occurrence payée pousse la suivante. C'est ce qui fait
     qu'une charge fixe se réarme sans qu'on y pense. */
  function avancer(rythme, occurrence){
    if (!rythme || !occurrence) return null;
    if (rythme.type === "mois") return prochainMoisListe(rythme, occurrence);
    if (rythme.type === "bimensuel") return prochainJourListe(rythme, occurrence);
    return ajouterMois(occurrence, PAS[rythme.type] || 1, rythme.jour);
  }

  function prochainMoisListe(rythme, depuis){
    var liste = (rythme.mois || []).slice().sort(function(a,b){ return a-b; });
    if (!liste.length) return null;
    var d = dateDe(depuis), an = d.getFullYear(), moisActuel = d.getMonth()+1;
    for (var i=0;i<liste.length;i++) if (liste[i] > moisActuel) return jourDans(an, liste[i], rythme.jour);
    return jourDans(an+1, liste[0], rythme.jour);
  }
  /* Deux fois par mois : on passe au jour suivant de la liste, et quand il
     n'y en a plus, au premier jour du mois d'après. */
  function prochainJourListe(rythme, depuis){
    var jours = (rythme.jours || []).slice().sort(function(a,b){ return a-b; });
    if (!jours.length) return null;
    var d = dateDe(depuis), an = d.getFullYear(), mois = d.getMonth()+1, j = d.getDate();
    for (var i=0;i<jours.length;i++) if (jours[i] > j) return jourDans(an, mois, jours[i]);
    return mois === 12 ? jourDans(an+1, 1, jours[0]) : jourDans(an, mois+1, jours[0]);
  }

  function jourDans(an, mois, jour){
    var dernier = new Date(an, mois, 0, 12).getDate();
    return iso(new Date(an, mois-1, Math.min(jour||1, dernier), 12));
  }

  /* Reculer : l'occurrence d'avant. Sert à dater une échéance déjà passée
     (le loyer d'octobre, quand la prochaine du carnet est celle de novembre). */
  function reculer(rythme, occurrence){
    if (!rythme || !occurrence) return null;
    var d = dateDe(occurrence), an = d.getFullYear(), mois = d.getMonth()+1, jour = d.getDate();
    if (rythme.type === "mois") {
      var liste = (rythme.mois || []).slice().sort(function(a,b){ return a-b; });
      if (!liste.length) return null;
      for (var i = liste.length-1; i >= 0; i--) if (liste[i] < mois) return jourDans(an, liste[i], rythme.jour);
      return jourDans(an-1, liste[liste.length-1], rythme.jour);
    }
    if (rythme.type === "bimensuel") {
      var jours = (rythme.jours || []).slice().sort(function(a,b){ return a-b; });
      if (!jours.length) return null;
      for (var k = jours.length-1; k >= 0; k--) if (jours[k] < jour) return jourDans(an, mois, jours[k]);
      return mois === 1 ? jourDans(an-1, 12, jours[jours.length-1]) : jourDans(an, mois-1, jours[jours.length-1]);
    }
    return ajouterMois(occurrence, -(PAS[rythme.type] || 1), rythme.jour);
  }

  /* Une ligne est « réglée pour ce mois » quand on l'a réglée ce mois-ci ET
     qu'elle n'a plus rien à payer d'ici la fin du mois. La seconde condition
     compte : une aide versée deux fois par mois n'est pas réglée après le
     premier versement, il reste celui du 20.
     Le 1er du mois suivant, la première condition tombe d'elle-même : la
     ligne redevient à payer, sans que personne ait rien à remettre à zéro. */
  function regleeCeMois(c, auj){
    if (!c || !c.dernierRegle) return false;
    if (c.dernierRegle.slice(0,7) !== auj.slice(0,7)) return false;
    return !c.prochaine || c.prochaine > finDuMois(auj);
  }

  /* Les règlements d'une ligne qui revient, retrouvés dans les mouvements.
     C'est d'eux que tout découle : la date du dernier règlement n'est pas un
     champ qu'on entretient, c'est le mouvement le plus récent — supprimer un
     règlement fait donc redevenir la charge « à payer » sans rien à corriger. */
  function reglementsDuMois(d, idRecurrent, auj){
    var mois = auj.slice(0,7);
    return (d.mouvements||[]).filter(function(m){
      return m.recurrent === idRecurrent && m.date.slice(0,7) === mois; })
      .sort(function(a,b){ return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  }
  function dernierReglement(d, idRecurrent){
    return (d.mouvements||[]).reduce(function(max, m){
      return (m.recurrent === idRecurrent && (!max || m.date > max)) ? m.date : max; }, null);
  }

  /* Première occurrence strictement après une date : sert à initialiser un
     récurrent sans inventer un historique de paiements. */
  function premiere(rythme, apres){
    if (!rythme) return null;
    if (rythme.type === "mois") return prochainMoisListe(rythme, apres);
    if (rythme.type === "bimensuel") return prochainJourListe(rythme, apres);
    var d = dateDe(apres);
    var cand = jourDans(d.getFullYear(), d.getMonth()+1, rythme.jour);
    var pas = PAS[rythme.type] || 1;
    var garde = 0;
    while (cand <= apres && garde++ < 60) cand = ajouterMois(cand, pas, rythme.jour);
    return cand;
  }

  function libelleRythme(r){
    if (!r) return "ponctuel";
    var MOIS = ["janvier","février","mars","avril","mai","juin","juillet",
                "août","septembre","octobre","novembre","décembre"];
    if (r.type === "mensuel") return "chaque mois, le " + r.jour;
    if (r.type === "bimensuel") return "deux fois par mois, le " + (r.jours||[]).join(" et le ");
    if (r.type === "trimestriel") return "tous les 3 mois";
    if (r.type === "annuel") return "une fois par an";
    if (r.type === "mois") {
      var noms = (r.mois||[]).map(function(m){ return MOIS[m-1]; });
      var fin = noms.length > 1 ? noms.slice(0,-1).join(", ") + " et " + noms[noms.length-1] : noms[0];
      return fin + ", le " + r.jour;
    }
    return "ponctuel";
  }

  /* ------------------------------------------------------------- soldes
     La règle : le solde d'un tiers est la somme de ses mouvements,
     jamais un nombre saisi à la main. Seules ces quatre natures déplacent
     une dette ; une dépense chez un fournisseur n'en crée aucune.
     +1 = il me doit davantage, -1 = je lui dois davantage. */
  /* « du_affaire » : ce qu'une affaire conclue me doit. C'est une écriture
     sans argent — rien n'est sorti ni entré, quelqu'un me doit simplement
     quelque chose — mais c'est bien un mouvement : la règle « le solde d'un
     tiers est la somme de ses mouvements » tient toujours. Chaque tranche
     encaissée le fait redescendre, comme un remboursement. */
  var EFFET_SOLDE = {pret:1, avance_recue:-1, remboursement_recu:-1, remboursement_verse:1, du_affaire:1};
  function sansArgent(m){ return m.nature === "du_affaire"; }
  /* ------------------------------------------------------------ business
     Un business, c'est : un nom, quelqu'un en face (une personne, une
     société, parfois plusieurs), un montant, ce qui a déjà été reçu, ce qui
     reste — en tranches datées ou non — et souvent une prochaine étape.

     Deux états changent tout :
       validé  — le montant est convenu : on me le doit, il compte dans ce
                 qu'on me doit et dans la position nette ;
       annoncé — on en a parlé, rien n'est signé : il s'affiche à part et ne
                 compte nulle part. Compter comme acquis un montant pas
                 encore validé, c'est se mentir sur sa situation.
     Ce qui a été reçu avant le carnet (dejaRecu) est une information : cet
     argent est déjà dans les soldes saisis, on ne le fait pas rentrer deux fois. */
  function estBusiness(e){ return !!e && e.origine === "business"; }
  function estValide(e){ return e.valide !== false; }
  function totalBusiness(e){ return (e.dejaRecu||0) + totalEngagement(e); }
  function recuBusiness(e){ return (e.dejaRecu||0) + regleEngagement(e); }
  /* Ce qui reste à encaisser sur les business validés. */
  function duBusiness(d){
    return (d.engagements||[]).reduce(function(s, e){
      return estBusiness(e) && estValide(e) ? s + resteEngagement(e) : s; }, 0);
  }
  /* La prochaine chose datée d'un business : une tranche attendue (si le
     montant est validé) ou une étape à franchir. */
  function prochainBusiness(e){
    var r = null;
    if (estValide(e)) (e.tranches||[]).forEach(function(t){
      if (t.etat !== "payee" && t.date && (!r || t.date < r.date)) r = {date:t.date, montant:t.montant, genre:"tranche"}; });
    if (e.etape && e.etapeDate && (!r || e.etapeDate < r.date))
      r = {date:e.etapeDate, montant:null, genre:"etape", libelle:e.etape};
    return r;
  }
  /* Tous les business, rangés par état ; dans chaque groupe, le plus proche
     d'abord, ceux qui n'ont aucune date à la fin. */
  function business(d){
    var r = {enCours:[], aValider:[], termines:[], aEncaisser:0, annonce:0, encaisse:0};
    (d.engagements||[]).forEach(function(e){
      if (!estBusiness(e)) return;
      var reste = resteEngagement(e);
      r.encaisse += recuBusiness(e);
      if (!estValide(e)) { r.aValider.push(e); r.annonce += reste; }
      else if (reste > 0) { r.enCours.push(e); r.aEncaisser += reste; }
      else r.termines.push(e);
    });
    var parDate = function(x, y){
      var px = prochainBusiness(x), py = prochainBusiness(y);
      var dx = px ? px.date : "9999", dy = py ? py.date : "9999";
      return dx < dy ? -1 : dx > dy ? 1 : 0; };
    r.enCours.sort(parDate); r.aValider.sort(parDate);
    return r;
  }

  function soldeTiers(d, idTiers){
    return (d.mouvements || []).reduce(function(s, m){
      var e = EFFET_SOLDE[m.nature];
      return (m.tiers === idTiers && e) ? s + e * Math.abs(m.montant) : s;
    }, 0);
  }
  function creances(d){
    return (d.tiers||[]).reduce(function(s,t){ var x = soldeTiers(d,t.id); return x>0 ? s+x : s; }, 0);
  }
  function dettes(d){
    return (d.tiers||[]).reduce(function(s,t){ var x = soldeTiers(d,t.id); return x<0 ? s-x : s; }, 0);
  }

  /* L'onglet Tiers répond à deux questions : qui me doit, à qui je dois.
     Une personne n'y figure donc que si de l'argent est en jeu entre nous.
     Celle qui a tout remboursé passe dans « soldés » (son histoire reste
     consultable) ; celle qui n'a jamais rien dû ni prêté — le bénéficiaire
     d'une aide, un partenaire d'affaire — n'a rien à y faire : elle reste
     dans le carnet, pas dans cette liste. */
  function situationTiers(d){
    var r = {meDoivent:[], jeDois:[], soldes:[], autres:[], totalMeDoivent:0, totalJeDois:0};
    (d.tiers||[]).forEach(function(t){
      var s = soldeTiers(d, t.id);
      if (s > 0) { r.meDoivent.push({t:t, solde:s}); r.totalMeDoivent += s; }
      else if (s < 0) { r.jeDois.push({t:t, solde:-s}); r.totalJeDois -= s; }
      else if ((d.mouvements||[]).some(function(m){ return m.tiers === t.id && EFFET_SOLDE[m.nature]; })
            || (d.engagements||[]).some(function(e){
                 /* un business seulement annoncé n'a jamais rien fait devoir à personne */
                 return e.tiers === t.id && !(estBusiness(e) && !estValide(e)); })) r.soldes.push({t:t, solde:0});
      else r.autres.push({t:t, solde:0});
    });
    var gros = function(x, y){ return y.solde - x.solde; };
    r.meDoivent.sort(gros); r.jeDois.sort(gros);
    return r;
  }

  /* --------------------------------------------------------- engagements */
  function resteEngagement(e){
    return (e.tranches||[]).reduce(function(s,t){ return t.etat === "payee" ? s : s + t.montant; }, 0);
  }
  function regleEngagement(e){
    return (e.tranches||[]).reduce(function(s,t){ return t.etat === "payee" ? s + t.montant : s; }, 0);
  }
  function totalEngagement(e){
    return (e.tranches||[]).reduce(function(s,t){ return s + t.montant; }, 0);
  }

  /* Répartir un total en n tranches sans perdre un franc : on arrondit au
     franc et la dernière tranche prend le reste. Un échéancier dont la somme
     des tranches ne fait pas le total est un échéancier qui mentira un jour. */
  function repartir(total, n){
    n = Math.max(1, Math.round(n || 1));
    var base = Math.floor(total / n), r = [];
    for (var i=0;i<n-1;i++) r.push(base);
    r.push(total - base * (n-1));
    return r;
  }

  /* Construire les tranches d'un échéancier : n versements, le premier à une
     date donnée, puis tous les « pas » mois. */
  function tranches(total, n, premiereDate, pasMois){
    var parts = repartir(total, n), r = [], date = premiereDate;
    for (var i=0;i<parts.length;i++){
      r.push({date:date, montant:parts[i], etat:"due"});
      date = date ? ajouterMois(date, pasMois || 1, Number(date.slice(8,10))) : null;
    }
    return r;
  }

  /* Appliquer un versement sur un engagement, des échéances les plus anciennes
     aux plus récentes. Un versement partiel coupe la tranche en deux : la part
     réglée et ce qui reste dû à la même date. Le reste dû reste donc exact,
     au lieu d'être « à peu près payé ». Rend ce qui n'a pas pu être imputé. */
  function appliquerVersement(e, montant, dateVersement){
    var reste = Math.abs(montant);
    var dues = [];
    (e.tranches||[]).forEach(function(t, i){ if (t.etat !== "payee") dues.push(i); });
    dues.sort(function(a,b){
      var da = e.tranches[a].date || "9999-12-31", db = e.tranches[b].date || "9999-12-31";
      return da < db ? -1 : da > db ? 1 : 0;
    });
    for (var k=0;k<dues.length && reste > 0;k++){
      var t = e.tranches[dues[k]];
      if (reste >= t.montant) {
        reste -= t.montant;
        t.etat = "payee"; t.paye = dateVersement;
      } else {
        var restant = t.montant - reste;
        t.montant = reste; t.etat = "payee"; t.paye = dateVersement;
        e.tranches.splice(dues[k] + 1, 0, {date:t.date, montant:restant, etat:"due"});
        reste = 0;
      }
    }
    return reste; // trop-perçu : à signaler plutôt qu'à absorber
  }

  /* ------------------------------------------------------------- comptes
     Un compte porte un solde de départ daté ; son solde d'aujourd'hui est ce
     départ plus tous les mouvements passés dessus. Rien n'est corrigé en
     douce : un comptage qui ne colle pas ajoute un mouvement « écart ». */
  /* Le solde saisi à l'ouverture d'un compte est la vérité À SA DATE : il
     tient déjà compte de tout ce qui a été payé avant. Un mouvement daté
     d'avant l'ouverture ne le change donc pas — sinon, noter le loyer
     d'octobre après avoir saisi sa caisse le retirerait une seconde fois.
     Le mouvement existe quand même : il compte dans les dépenses du mois et
     dans l'historique, il ne touche simplement pas au solde. */
  function dansLeSolde(d, m){
    if (m.compte == null) return false;
    var c = (d.comptes||[]).filter(function(x){ return x.id === m.compte; })[0];
    return !!c && !(c.depuis && m.date < c.depuis);
  }
  function soldeCompte(d, idCompte){
    var c = (d.comptes||[]).filter(function(x){ return x.id === idCompte; })[0];
    if (!c) return 0;
    return (d.mouvements||[]).reduce(function(s,m){
      return (m.compte === idCompte && !(c.depuis && m.date < c.depuis)) ? s + m.montant : s;
    }, c.soldeInitial || 0);
  }
  /* Des espèces ou un portefeuille mobile ne peuvent pas être négatifs : si le
     carnet le dit, c'est qu'il manque une entrée ou que la dépense a été
     imputée au mauvais compte. On le signale au lieu de l'afficher comme un
     chiffre normal. Une banque, elle, peut être à découvert. */
  function comptesImpossibles(d){
    return (d.comptes||[]).filter(function(c){
      return c.type !== "banque" && soldeCompte(d, c.id) < 0; })
      .map(function(c){ return {id:c.id, nom:c.nom, solde:soldeCompte(d, c.id)}; });
  }
  function liquidites(d){
    return (d.comptes||[]).reduce(function(s,c){ return s + soldeCompte(d, c.id); }, 0);
  }

  /* ---------------------------------------------------------- enveloppes
     « Les dépenses de la maison, environ 100 000 par mois » n'a pas de date :
     cet argent fuit tous les jours. Une dépense issue d'une charge fixe ne la
     consomme pas, sinon le loyer mangerait l'enveloppe du marché. */
  /* Le plafond d'une enveloppe peut changer d'un mois à l'autre : une caisse
     d'aides dépend de ce qui a été encaissé. Le montant par défaut sert
     tant que rien n'a été décidé pour le mois en cours. */
  function montantEnveloppe(env, dansLeMois){
    var parMois = env.montantsParMois || {};
    var cle = dansLeMois.slice(0,7);
    return parMois[cle] == null ? env.montant : parMois[cle];
  }

  function consommeEnveloppe(d, env, dansLeMois){
    var a = debutDuMois(dansLeMois), b = finDuMois(dansLeMois);
    return -(d.mouvements||[]).reduce(function(s,m){
      if (m.nature !== "depense" || m.fixe) return s;
      if ((env.cats||[]).indexOf(m.cat) < 0) return s;
      return (m.date >= a && m.date <= b) ? s + m.montant : s;
    }, 0);
  }
  function resteEnveloppes(d, dansLeMois){
    return (d.enveloppes||[]).reduce(function(s,e){
      return s + Math.max(0, montantEnveloppe(e, dansLeMois) - consommeEnveloppe(d, e, dansLeMois));
    }, 0);
  }

  /* ---------------------------------------------------------- l'imprévu
     Rien n'oblige à programmer quoi que ce soit : une dépense ou une recette
     peut tomber sans avoir été prévue, et s'enregistre seule par le bouton +.
     On la compte quand même à part — « imprévu » n'est pas « invisible » :
     une dépense hors enveloppe et hors charge fixe, une entrée qui ne vient
     d'aucun récurrent. C'est souvent là que part l'argent qu'on ne retrouve
     pas, et c'est souvent là qu'arrive celui qu'on oublie d'avoir reçu. */
  function catsPrevues(d){
    var s = [];
    (d.enveloppes||[]).forEach(function(e){ (e.cats||[]).forEach(function(c){
      if (s.indexOf(c) < 0) s.push(c); }); });
    return s;
  }
  function imprevus(d, dansLeMois){
    var a = debutDuMois(dansLeMois), b = finDuMois(dansLeMois), prevues = catsPrevues(d);
    var sorties = 0, entrees = 0, nb = 0;
    (d.mouvements||[]).forEach(function(m){
      if (m.date < a || m.date > b || m.fixe) return;
      if (m.nature === "depense" && prevues.indexOf(m.cat) < 0) { sorties -= m.montant; nb++; }
      if (m.nature === "recette") { entrees += m.montant; nb++; }
    });
    return {sorties:sorties, entrees:entrees, nb:nb};
  }

  /* --------------------------------------------------------------- agenda
     Une seule liste pour quatre sources de dates : récurrents, échéances
     d'engagement, points de participation, prochaines actions d'affaire.
     Ce qui n'a pas de date ne peut pas y entrer : c'est le rôle de sansDate. */
  function agenda(d){
    var r = [];
    (d.recurrents||[]).forEach(function(c){
      if (!c.prochaine) return;
      r.push({date:c.prochaine, tiers:c.tiers, montant:c.montant,
              genre:c.sens === "entree" ? "encaisser" : c.facultatif ? "aide" : "charge",
              titre:c.libelle, detail:libelleRythme(c.rythme),
              ref:{type:"recurrent", id:c.id}});
    });
    (d.engagements||[]).forEach(function(e){
      /* La prochaine étape d'un business (livrer, relancer, signer) : elle se
         rappelle comme une échéance, tant que le business n'est pas soldé. */
      if (estBusiness(e) && e.etape && e.etapeDate && (!estValide(e) || resteEngagement(e) > 0))
        r.push({date:e.etapeDate, tiers:e.tiers, montant:null, genre:"etape", titre:e.objet, detail:e.etape,
                ref:{type:"business", id:e.id}});
      /* Tant que le montant n'est pas validé, rien n'est attendu. */
      if (estBusiness(e) && !estValide(e)) return;
      (e.tranches||[]).forEach(function(t, i){
        if (t.etat === "payee" || !t.date) return;
        r.push({date:t.date, tiers:e.tiers, montant:t.montant,
                genre:e.sens === "creance" ? "encaisser" : "payer",
                titre:e.objet,
                detail:(e.tranches.length>1 ? "tranche "+(i+1)+"/"+e.tranches.length : "échéance"),
                ref:{type:"engagement", id:e.id, tranche:i}});
      });
    });
    (d.participations||[]).forEach(function(p){
      if (!p.point) return;
      r.push({date:p.point, tiers:p.tiers, montant:null, genre:"point",
              titre:p.objet, detail:p.attendu || "point à faire",
              ref:{type:"participation", id:p.id}});
    });
    (d.opportunites||[]).forEach(function(o){
      if (!o.date) return;
      r.push({date:o.date, tiers:o.tiers, montant:commission(o), genre:"action",
              titre:o.objet, detail:o.action || "prochaine action",
              ref:{type:"opportunite", id:o.id}});
    });
    return r.sort(function(a,b){ return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  }

  /* Le bloc qui doit rester vide. Une dette, un placement ou une affaire
     sans prochaine date ne se rappelle à personne : c'est comme ça qu'on
     les perd, et c'est la seule maladie que ce carnet soigne vraiment. */
  function sansDate(d){
    var r = [];
    (d.recurrents||[]).forEach(function(c){
      if (!c.prochaine) r.push({titre:c.libelle, detail:"charge qui revient, aucune prochaine date",
        tiers:c.tiers, montant:c.montant, ref:{type:"recurrent", id:c.id}});
    });
    (d.engagements||[]).forEach(function(e){
      /* Un business pas encore validé n'a pas d'échéance à dater — mais s'il
         n'a pas non plus de prochaine étape datée, plus rien ne le rappelle. */
      if (estBusiness(e) && !estValide(e)) {
        if (!e.etapeDate) r.push({titre:e.objet, detail:"opportunité sans étape datée",
          tiers:e.tiers, montant:resteEngagement(e), ref:{type:"engagement", id:e.id, tranche:null}});
        return;
      }
      (e.tranches||[]).forEach(function(t,i){
        if (t.etat !== "payee" && !t.date) r.push({titre:e.objet, detail:"échéance à fixer",
          tiers:e.tiers, montant:t.montant, ref:{type:"engagement", id:e.id, tranche:i}});
      });
    });
    (d.participations||[]).forEach(function(p){
      if (!p.point) r.push({titre:p.objet, detail:"placement sans point prévu",
        tiers:p.tiers, montant:p.mise, ref:{type:"participation", id:p.id}});
    });
    (d.opportunites||[]).forEach(function(o){
      if (!o.date) r.push({titre:o.objet, detail:"affaire sans prochaine action",
        tiers:o.tiers, montant:commission(o), ref:{type:"opportunite", id:o.id}});
    });
    return r;
  }

  /* Ce qui doit sortir : une dette ou une charge. Une aide facultative n'est
     pas une dette — son argent est déjà réservé dans la caisse d'aides, et la
     compter ici la réserverait deux fois en plus de la faire passer pour due. */
  function aSortir(x){ return x.genre === "payer" || x.genre === "charge"; }
  function estAide(x){ return x.genre === "aide"; }

  /* Ce que j'ai, moins tout ce qui doit sortir d'ici la fin du mois (retards
     compris), moins ce qui reste à manger sur les enveloppes. Les rentrées
     espérées ne sont pas comptées : on ne dépense pas une promesse. */
  function resteAVivre(d, auj){
    var fin = finDuMois(auj);
    var datees = agenda(d).filter(function(x){ return aSortir(x) && x.date <= fin; })
                          .reduce(function(s,x){ return s + x.montant; }, 0);
    var env = resteEnveloppes(d, auj);
    var liq = liquidites(d);
    return {liquidites:liq, datees:datees, enveloppes:env,
            aSortir:datees + env, reste:liq - datees - env};
  }

  function commission(o){
    if (!o) return 0;
    if (o.montant) return o.montant;                 // forfait convenu
    return Math.round((o.base||0) * (o.taux||0) / 100); // base x taux
  }

  /* ---------------------------------------------------------- patrimoine
     Les participations comptent pour la mise placée, pas pour une valeur
     devinée : la position nette doit rester vérifiable ligne à ligne. */
  function patrimoine(d){
    var liq = liquidites(d);
    var cre = creances(d);
    var mises = (d.participations||[]).reduce(function(s,p){ return s + (p.mise||0) - (p.miseRecuperee||0); }, 0);
    var biens = (d.biens||[]).reduce(function(s,b){ return s + b.montant; }, 0);
    var det = dettes(d);
    var cred = (d.credits||[]).reduce(function(s,c){ return s + c.montant; }, 0);
    var actif = liq + cre + mises + biens, passif = det + cred;
    /* « argent » : ce qui est de l'argent ou le redevient tout seul (comptes,
       ce qu'on me doit, mises placées). Les biens sont à part : un terrain ne
       paie pas le loyer, et sa valeur est une estimation. */
    return {liquidites:liq, creances:cre, mises:mises, biens:biens, argent:liq + cre + mises,
            dettes:det, credits:cred, actif:actif, passif:passif, nette:actif - passif};
  }

  /* ---------------------------------------------------------------- biens
     Un bien a une nature, et chaque nature ses renseignements : un terrain
     se reconnaît à son emplacement et au papier qui le prouve, un véhicule à
     sa marque et à sa plaque. Le nom affiché se déduit de là — on ne demande
     pas deux fois la même chose. */
  var TYPES_BIEN = [["terrain","Terrain"],["vehicule","Véhicule"],["autre","Autre bien"]];
  function typeBien(b){ return b.type === "terrain" || b.type === "vehicule" ? b.type : "autre"; }
  function nomBien(b){
    var t = typeBien(b);
    if (t === "terrain") return b.lieu ? "Terrain — " + b.lieu : (b.nom || "Terrain");
    if (t === "vehicule") return b.marque || b.nom || "Véhicule";
    return b.nom || "Bien";
  }
  function detailBien(b){
    var t = typeBien(b);
    if (t === "terrain") return [b.document || "document non précisé", b.superficie].filter(Boolean).join(" · ");
    if (t === "vehicule") return b.plaque ? "plaque " + b.plaque : "plaque non précisée";
    return "valeur estimée";
  }
  /* Les biens par nature, dans l'ordre des natures ; les natures vides sont omises. */
  function biensParType(d){
    return TYPES_BIEN.map(function(t){
      var liste = (d.biens||[]).filter(function(b){ return typeBien(b) === t[0]; });
      return {type:t[0], titre:t[0] === "terrain" ? "Terrains" : t[0] === "vehicule" ? "Véhicules" : "Autres biens",
              biens:liste, total:liste.reduce(function(s, b){ return s + (b.montant||0); }, 0)};
    }).filter(function(g){ return g.biens.length; });
  }

  /* Train de vie : les fixes de chaque mois, plus les enveloppes, plus ce qui
     ne tombe pas tous les mois ramené au mois. Comparé aux entrées fixes, il
     dit en un chiffre si le salaire tient la maison. */
  function trainDeVie(d, auj){
    var mensuels = 0, lissables = 0;
    (d.recurrents||[]).forEach(function(c){
      if (c.sens !== "sortie" || !c.rythme) return;
      /* Les aides facultatives sont déjà dans la caisse d'aides : les ajouter
         ici réserverait le même argent deux fois. */
      if (c.facultatif) return;
      if (c.rythme.type === "bimensuel") { mensuels += c.montant * (c.rythme.jours||[]).length; return; }
      if (c.rythme.type === "mensuel") mensuels += c.montant;
      else if (c.rythme.type === "trimestriel") lissables += c.montant * 4 / 12;
      else if (c.rythme.type === "annuel") lissables += c.montant / 12;
      else if (c.rythme.type === "mois") lissables += c.montant * (c.rythme.mois||[]).length / 12;
    });
    var moisCourant = auj || aujourdhui();
    var env = (d.enveloppes||[]).reduce(function(s,e){
      return s + montantEnveloppe(e, moisCourant); }, 0);
    var aides = (d.recurrents||[]).reduce(function(s,c){
      if (c.sens !== "sortie" || !c.facultatif) return s;
      var fois = c.rythme && c.rythme.type === "bimensuel" ? (c.rythme.jours||[]).length : 1;
      return s + c.montant * fois; }, 0);
    var entrees = (d.recurrents||[]).reduce(function(s,c){
      return c.sens === "entree" ? s + c.montant : s; }, 0);
    var lisse = Math.round(mensuels + env + lissables);
    return {mensuels:mensuels, enveloppes:env, lissables:Math.round(lissables),
            courant:mensuels + env, lisse:lisse, entrees:entrees, ecart:entrees - lisse,
            aidesSouhaitees:aides};
  }

  /* ------------------------------------------------------ bilan du mois
     Une seule question : ce mois-ci, qu'est-ce qui était prévu, et qu'est-ce
     qui s'est réellement passé ? Deux colonnes, les mêmes lignes.

     « Prévu » vient du rythme de chaque ligne, pas de sa prochaine date : un
     loyer déjà réglé (sa prochaine date est le mois suivant) reste une charge
     de ce mois. « Fait » vient des mouvements, et d'eux seuls.

     Les deux totaux de la colonne « Fait » sont exactement « Entré ce mois »
     et « Sorti ce mois » affichés au-dessus : un bilan qui ne retombe pas sur
     les chiffres d'à côté ne s'explique pas. */
  function occurrencesDuMois(c, auj){
    var r = c.rythme;
    if (!r) return 0;
    if (r.type === "mensuel") return 1;
    if (r.type === "bimensuel") return (r.jours||[]).length;
    var mois = Number(auj.slice(5,7));
    if (r.type === "mois") return (r.mois||[]).indexOf(mois) >= 0 ? 1 : 0;
    /* Trimestriel, annuel : seule la prochaine date dit sur quels mois ça
       tombe. Sans date, on ne devine pas — la ligne est déjà dans « Sans date ». */
    if (!c.prochaine) return 0;
    var pas = PAS[r.type] || 1;
    var ecart = (Number(c.prochaine.slice(0,4)) - Number(auj.slice(0,4))) * 12
              + Number(c.prochaine.slice(5,7)) - mois;
    return ((ecart % pas) + pas) % pas === 0 ? 1 : 0;
  }
  function bilanDuMois(d, auj){
    var a = debutDuMois(auj), b = finDuMois(auj), prevues = catsPrevues(d);
    var r = {revenus:{prevu:0, fait:0}, charges:{prevu:0, fait:0}, enveloppes:{prevu:0, fait:0},
             autresEntrees:0, horsPrevision:0};
    (d.mouvements||[]).forEach(function(m){
      if (m.date < a || m.date > b || sansArgent(m)) return;
      if (m.nature === "depense") {
        if (m.fixe) r.charges.fait -= m.montant;
        else if (prevues.indexOf(m.cat) >= 0) r.enveloppes.fait -= m.montant;
        else r.horsPrevision -= m.montant;
      }
      else if (m.montant > 0) {
        if (m.nature === "recette" && m.fixe) r.revenus.fait += m.montant;
        else r.autresEntrees += m.montant;
      }
    });
    (d.recurrents||[]).forEach(function(c){
      /* Une aide « si je peux » sort de la caisse d'aides, qui est une
         enveloppe : la compter ici la prévoirait deux fois. */
      if (c.facultatif) return;
      var prevu = c.montant * occurrencesDuMois(c, auj);
      if (c.sens === "entree") r.revenus.prevu += prevu; else r.charges.prevu += prevu;
    });
    (d.enveloppes||[]).forEach(function(e){ r.enveloppes.prevu += montantEnveloppe(e, auj); });
    r.entre = r.revenus.fait + r.autresEntrees;
    r.sorti = r.charges.fait + r.enveloppes.fait + r.horsPrevision;
    r.solde = {prevu:r.revenus.prevu - r.charges.prevu - r.enveloppes.prevu, fait:r.entre - r.sorti};
    return r;
  }

  /* Où en sont les lignes fixes du mois : combien était attendu, combien est
     déjà là. C'est le coup d'œil de l'accueil — « tout est perçu », « réglé
     à 82 % ».
     On compte par ligne, pas sur le total : une ligne réglée compte pour
     tout son montant prévu, même si la facture a fait quelques francs de
     moins. Sinon on resterait à 99 % pour toujours, et « tout est réglé »
     n'apparaîtrait jamais. À l'inverse, payer une ligne deux fois ne fait
     pas avancer les autres. */
  function avancementFixes(d, auj){
    var r = {revenus:{prevu:0, obtenu:0, lignes:[]}, charges:{prevu:0, obtenu:0, lignes:[]}};
    (d.recurrents||[]).forEach(function(c){
      if (c.facultatif) return;
      var prevu = c.montant * occurrencesDuMois(c, auj);
      if (!prevu) return;
      var fait = reglementsDuMois(d, c.id, auj).reduce(function(s, m){ return s + Math.abs(m.montant); }, 0);
      var cote = c.sens === "entree" ? r.revenus : r.charges;
      cote.prevu += prevu;
      cote.obtenu += regleeCeMois(c, auj) ? prevu : Math.min(fait, prevu);
      cote.lignes.push(c);
    });
    [r.revenus, r.charges].forEach(function(x){
      x.reste = x.prevu - x.obtenu;
      x.complet = x.prevu > 0 && x.reste <= 0;
      /* 100 % est réservé à « complet » : un arrondi ne doit pas l'annoncer trop tôt. */
      x.taux = !x.prevu ? null : x.complet ? 100 : Math.min(99, Math.round(x.obtenu / x.prevu * 100));
    });
    return r;
  }

  /* La file d'attente des lignes qui reviennent : ce qui reste à faire en
     haut, la plus pressée d'abord (une ligne sans date passe devant, c'est
     une anomalie à traiter) ; ce qui est réglé pour le mois descend en bas.
     On lit la liste de haut en bas et on s'arrête à la première ligne verte. */
  function fileDAttente(liste, auj){
    return (liste||[]).map(function(c, i){ return {c:c, i:i, faite:regleeCeMois(c, auj) ? 1 : 0}; })
      .sort(function(x, y){
        if (x.faite !== y.faite) return x.faite - y.faite;
        var dx = x.c.prochaine || "", dy = y.c.prochaine || "";
        if (dx !== dy) return dx < dy ? -1 : 1;
        return x.i - y.i; })
      .map(function(x){ return x.c; });
  }

  /* ---------------------------------------------------------- quoi faire
     Le tableau de bord ne se contente pas de montrer : il dit par quoi
     commencer. Une suggestion = une chose précise, avec le geste qui la
     règle. L'ordre est celui de l'urgence, pas celui des onglets :
       0 — ce qui cloche (plus assez pour finir le mois, payé deux fois)
       1 — ce qui est en retard
       2 — ce qui n'a pas de date, donc que personne ne rappellera
       3 — ce qui tombe dans les sept jours, une enveloppe dépassée
       4 — l'entretien du carnet (confirmer un jour, compter, sauvegarder)
     Rien d'autre n'y entre : une suggestion qu'on ne peut pas exécuter d'un
     toucher est un reproche, pas une aide. */
  var VERBES = {charge:"Payer", payer:"Payer", encaisser:"Encaisser", aide:"Envoyer",
                point:"Faire le point", action:"Suivre", etape:"Avancer"};
  function suggestions(d, auj, o){
    o = o || {};
    var r = [];
    function de(x, rang, verbe, detail){
      return {rang:rang, genre:x.genre || "sans-date", titre:x.titre, tiers:x.tiers || null, detail:detail,
              montant:x.montant || null, date:x.date || null, verbe:verbe, ref:x.ref};
    }
    /* Un carnet où rien n'a encore été déclaré en caisse « manque » de tout :
       ce n'est pas une alerte, c'est un carnet neuf. */
    if (!o.debutant) {
      var rv = resteAVivre(d, auj);
      if (rv.reste < 0) r.push({rang:0, genre:"manque", titre:"Il manque " + F(-rv.reste) + " pour finir le mois",
        tiers:null, detail:"ce que tu as, moins ce qui doit encore sortir d'ici le " + jf(finDuMois(auj)).slice(0,5),
        montant:null, date:null, verbe:"Voir", ref:{type:"aller", id:"depenses"}});
    }
    (d.recurrents||[]).forEach(function(c){
      var n = reglementsDuMois(d, c.id, auj).length;
      if (n > Math.max(1, occurrencesDuMois(c, auj))) r.push({rang:0, genre:"doublon", titre:c.libelle, tiers:null,
        detail:"réglé " + n + " fois ce mois-ci", montant:null, date:null, verbe:"Vérifier",
        ref:{type:"reglement", id:c.id}});
    });
    agenda(d).forEach(function(x){
      var j = jours(auj, x.date);
      if (j < 0) r.push(de(x, 1, VERBES[x.genre] || "Voir", quand(x.date, auj)));
      else if (j <= 7) r.push(de(x, 3, VERBES[x.genre] || "Voir", quand(x.date, auj)));
    });
    /* Dater une échéance, c'est ouvrir l'échéancier — pas la feuille d'encaissement. */
    /* Les tranches non datées d'un même échéancier ne font qu'une suggestion :
       une affaire en trois tranches sans date, c'est une chose à faire, pas trois. */
    var echeanciers = {}, bizADater = [];
    sansDate(d).forEach(function(x){
      var s = de(x, 2, "Dater", x.detail);
      if (x.ref.type !== "engagement") { r.push(s); return; }
      /* Un business sans date n'est pas une anomalie — on connaît souvent le
         montant avant le calendrier. Il ne passe donc pas devant ce qui tombe
         cette semaine : il descend avec l'entretien, en une seule ligne pour
         tous. Un prêt sans date, lui, reste une urgence. */
      var eng = (d.engagements||[]).filter(function(e){ return e.id === x.ref.id; })[0];
      if (estBusiness(eng)) {
        if (!bizADater.some(function(b){ return b.id === eng.id; })) bizADater.push({id:eng.id, titre:x.titre, detail:x.detail});
        return;
      }
      var deja = echeanciers[x.ref.id];
      if (deja) {
        deja.montant += x.montant || 0; deja.nb++;
        deja.detail = deja.nb + " tranches à dater";
        return;
      }
      s.ref = {type:"echeancier", id:x.ref.id}; s.nb = 1; s.montant = x.montant || 0;
      echeanciers[x.ref.id] = s;
      r.push(s);
    });
    (d.enveloppes||[]).forEach(function(e){
      var trop = consommeEnveloppe(d, e, auj) - montantEnveloppe(e, auj);
      if (trop > 0) r.push({rang:3, genre:"enveloppe", titre:"Enveloppe " + e.libelle, tiers:null,
        detail:"dépassée de " + F(trop), montant:null, date:null, verbe:"Ajuster", ref:{type:"enveloppe", id:e.id}});
    });
    if (bizADater.length) r.push({rang:4, genre:"sans-date", titre:bizADater[0].titre, tiers:null,
      detail:bizADater.length === 1 ? bizADater[0].detail
        : "à dater, comme " + (bizADater.length - 1) + (bizADater.length > 2 ? " autres business" : " autre business"),
      montant:null, date:null, verbe:"Dater", ref:{type:"echeancier", id:bizADater[0].id}});
    /* Les jours supposés : une seule suggestion pour tous, qui ouvre le
       premier. Cinq lignes « Confirmer » d'affilée noieraient le reste, et
       chaque jour confirmé fait passer la suggestion au suivant. */
    var supposes = (d.recurrents||[]).filter(function(c){ return c.jourAConfirmer; });
    if (supposes.length) r.push({rang:4, genre:"confirmer", titre:supposes[0].libelle, tiers:null,
      detail:"son jour est une supposition" + (supposes.length > 1 ? ", comme " + (supposes.length - 1)
        + (supposes.length > 2 ? " autres lignes" : " autre ligne") : ""),
      montant:null, date:null, verbe:"Confirmer", ref:{type:"confirmer", id:supposes[0].id}});
    if (!o.debutant) {
      var pt = (d.pointages||[]).slice(-1)[0], agePt = pt ? jours(pt.date, auj) : null;
      if (agePt == null || agePt > 7) r.push({rang:4, genre:"compter", titre:"Compter tes espèces", tiers:null,
        detail:agePt == null ? "jamais comptées" : "comptées il y a " + agePt + " jours", montant:null, date:null,
        verbe:"Compter", ref:{type:"pointer"}});
      var ex = (d.reglages||{}).dernierExport, ageEx = ex ? jours(ex, auj) : null;
      if (ageEx == null || ageEx > 7) r.push({rang:4, genre:"sauvegarder", titre:"Sauvegarder le carnet", tiers:null,
        detail:ageEx == null ? "jamais sauvegardé" : "dernière sauvegarde il y a " + ageEx + " jours", montant:null,
        date:null, verbe:"Sauvegarder", ref:{type:"exporter"}});
    }
    /* Tri stable par urgence : à l'intérieur d'un rang, l'ordre d'arrivée
       (l'agenda est déjà trié par date) est conservé. */
    return r.map(function(s, i){ s._i = i; return s; })
      .sort(function(x, y){ return x.rang - y.rang || x._i - y._i; })
      .map(function(s){ delete s._i; return s; });
  }

  /* ====================================================== synchronisation
     Deux appareils, un seul carnet. Aucun serveur ne fusionne à notre place :
     c'est ce fichier qui le fait, et c'est pour ça qu'il est testé.

     Trois idées, pas plus :
       — chaque fiche porte « maj », l'instant de sa dernière modification ;
         à la fusion, la plus récente gagne, fiche par fiche ;
       — une fiche supprimée laisse une trace datée dans « supprimes », sinon
         elle reviendrait de l'autre appareil comme si de rien n'était ;
       — le verrou, Face ID et la date de sauvegarde sont propres à l'appareil
         et ne voyagent jamais. */

  var LISTES = ["tiers","mouvements","recurrents","enveloppes","engagements","participations",
                "opportunites","biens","credits","comptes","pointages"];
  var REGLAGES_LOCAUX = ["verrou","biometrie","dernierExport","verrouEssais"];

  /* ------------------------------------------------- contrôle à l'entrée
     Un carnet qui arrive de l'extérieur — fichier de départ, sauvegarde
     restaurée, copie du dépôt — est relu avant d'être accepté. Les écrans
     collent les identifiants dans le code de leurs boutons : un identifiant
     qui ne serait pas un nombre deviendrait du code exécuté au toucher. On
     refuse donc tout ce qui n'a pas exactement la forme attendue, plutôt que
     d'essayer de le réparer. Rend la liste des défauts ; vide = carnet sain. */
  var FORME_DATE = /^\d{4}-\d{2}-\d{2}$/;
  var CHAMPS_REF = ["tiers","compte","engagement","recurrent","participation"];
  var CHAMPS_NOMBRE = ["montant","mise","recu","miseRecuperee","base","taux","proba","soldeInitial","dejaRecu"];
  var CHAMPS_DATE = ["date","prochaine","dernierRegle","echeanceReglee","point","etapeDate","cree","depuis","paye"];
  function defautsCarnet(c, options){
    var r = [], depart = !!(options && options.depart);
    function nombre(x){ return typeof x === "number" && isFinite(x); }
    function date(x){ return x == null || x === "" || (typeof x === "string" && FORME_DATE.test(x)); }
    if (!c || typeof c !== "object" || Array.isArray(c)) return ["ce n'est pas un carnet"];
    LISTES.forEach(function(l){
      if (c[l] == null) return;
      if (!Array.isArray(c[l])) { r.push(l + " : ce n'est pas une liste"); return; }
      c[l].forEach(function(x, i){
        var ou = l + " n°" + (i + 1);
        if (!x || typeof x !== "object" || Array.isArray(x)) { r.push(ou + " : illisible"); return; }
        /* un comptage d'espèces ancien peut ne pas avoir d'identifiant : il en reçoit un au chargement */
        if (!(l === "pointages" && x.id == null) && !nombre(x.id)) r.push(ou + " : identifiant invalide");
        CHAMPS_REF.forEach(function(k){ if (x[k] != null && !nombre(x[k])) r.push(ou + " : « " + k + " » invalide"); });
        CHAMPS_NOMBRE.forEach(function(k){ if (x[k] != null && !nombre(x[k])) r.push(ou + " : « " + k + " » n'est pas un nombre"); });
        CHAMPS_DATE.forEach(function(k){
          /* dans un fichier de départ, « auto » demande au carnet de calculer la première date */
          if (depart && k === "prochaine" && x[k] === "auto") return;
          if (!date(x[k])) r.push(ou + " : date « " + k + " » invalide"); });
        if (x.tranches != null) {
          if (!Array.isArray(x.tranches)) r.push(ou + " : échéancier illisible");
          else x.tranches.forEach(function(t){
            if (!t || typeof t !== "object" || !nombre(t.montant) || !date(t.date) || !date(t.paye)) r.push(ou + " : tranche invalide"); });
        }
        if (x.montantsParMois != null) {
          if (typeof x.montantsParMois !== "object" || Array.isArray(x.montantsParMois)) r.push(ou + " : plafonds illisibles");
          else Object.keys(x.montantsParMois).forEach(function(k){
            if (!/^\d{4}-\d{2}$/.test(k) || !nombre(x.montantsParMois[k])) r.push(ou + " : plafond du mois invalide"); });
        }
        if (x.rythme != null) {
          var y = x.rythme, listes = (y.jours || []).concat(y.mois || []);
          if (typeof y !== "object" || (y.jour != null && !nombre(y.jour)) || !Array.isArray(y.jours || [])
              || !Array.isArray(y.mois || []) || !listes.every(nombre)) r.push(ou + " : rythme invalide");
        }
      });
    });
    return r.slice(0, 20);
  }

  /* Texte stable d'une valeur : mêmes données, même texte, quel que soit
     l'ordre dans lequel les champs ont été écrits. */
  function canon(x){
    if (x === null || typeof x !== "object") return JSON.stringify(x === undefined ? null : x);
    if (Array.isArray(x)) return "[" + x.map(canon).join(",") + "]";
    return "{" + Object.keys(x).sort().filter(function(k){ return x[k] !== undefined; })
      .map(function(k){ return JSON.stringify(k) + ":" + canon(x[k]); }).join(",") + "}";
  }
  function empreinteFiche(x){
    var c = {};
    Object.keys(x).forEach(function(k){ if (k !== "maj") c[k] = x[k]; });
    return canon(c);
  }

  /* Photographier le carnet, puis comparer à la photo d'avant : c'est ainsi
     qu'on sait ce qui a changé, sans avoir à le noter à chaque endroit du
     code qui modifie quelque chose. Un oubli y serait une perte de données
     silencieuse ; la comparaison, elle, ne peut rien oublier. */
  function photographier(d){
    var p = {};
    LISTES.forEach(function(l){
      (d[l]||[]).forEach(function(x){ p[l + ":" + x.id] = empreinteFiche(x); });
    });
    p["@cats"] = canon((d.reglages||{}).cats || []);
    return p;
  }
  function marquer(photoAvant, d, maintenant){
    var n = 0, vus = {};
    if (!d.supprimes) d.supprimes = {};
    LISTES.forEach(function(l){
      (d[l]||[]).forEach(function(x){
        var cle = l + ":" + x.id;
        vus[cle] = true;
        if (photoAvant[cle] !== empreinteFiche(x)) { x.maj = maintenant; n++; }
        if (d.supprimes[cle]) delete d.supprimes[cle];
      });
    });
    Object.keys(photoAvant).forEach(function(cle){
      if (cle.charAt(0) !== "@" && !vus[cle]) { d.supprimes[cle] = maintenant; n++; }
    });
    if (photoAvant["@cats"] !== undefined && photoAvant["@cats"] !== canon((d.reglages||{}).cats || [])) {
      d.reglages.catsMaj = maintenant; n++;
    }
    return n;
  }

  /* Fusionner sans rien perdre. Ne modifie aucun des deux carnets.
     À égalité de date, c'est la version du dépôt qui est gardée : les deux
     appareils prennent ainsi la même décision, et aucun ne renvoie l'autre. */
  function fusionner(local, distant){
    var f = JSON.parse(JSON.stringify(local));
    var sup = {};
    [local.supprimes || {}, distant.supprimes || {}].forEach(function(s){
      Object.keys(s).forEach(function(k){ sup[k] = Math.max(sup[k] || 0, s[k]); });
    });
    LISTES.forEach(function(l){
      var parId = {}, ordre = [];
      (distant[l]||[]).forEach(function(x){ parId[x.id] = x; ordre.push(x.id); });
      (local[l]||[]).forEach(function(x){
        var autre = parId[x.id];
        if (!autre) ordre.push(x.id);
        if (!autre || (x.maj || 0) > (autre.maj || 0)) parId[x.id] = x;
      });
      f[l] = ordre.map(function(id){ return JSON.parse(JSON.stringify(parId[id])); })
        .filter(function(x){
          var t = sup[l + ":" + x.id];
          return !(t && t >= (x.maj || 0));
        })
        .sort(function(a,b){ return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });
    });
    f.supprimes = sup;
    var rl = local.reglages || {}, rd = distant.reglages || {};
    f.reglages = JSON.parse(JSON.stringify(rl));
    if (rd.cats && (rd.catsMaj || 0) >= (rl.catsMaj || 0)) {
      f.reglages.cats = rd.cats.slice();
      /* On ne crée pas le champ s'il n'existait pas : un champ vide de plus
         ferait croire que le carnet a changé, et provoquerait un envoi. */
      if (rd.catsMaj != null) f.reglages.catsMaj = rd.catsMaj;
    }
    f.version = Math.max(local.version || 1, distant.version || 1);
    f.cree = (local.cree && distant.cree) ? (local.cree < distant.cree ? local.cree : distant.cree)
                                           : (local.cree || distant.cree);
    return f;
  }

  /* Ce qui part vers le dépôt : tout le carnet, moins ce qui appartient à
     l'appareil. Le code de verrou d'un téléphone n'a rien à faire sur l'autre,
     et une clé Face ID n'existe que sur l'appareil qui l'a créée. */
  function pourEnvoi(d){
    var c = JSON.parse(JSON.stringify(d));
    delete c.modifie;
    if (c.reglages) REGLAGES_LOCAUX.forEach(function(k){ delete c.reglages[k]; });
    return c;
  }
  /* Prendre le carnet du dépôt tel quel, en gardant les réglages de l'appareil. */
  function adopter(local, distant){
    var c = JSON.parse(JSON.stringify(distant));
    if (!c.reglages) c.reglages = {};
    REGLAGES_LOCAUX.forEach(function(k){
      c.reglages[k] = (local.reglages || {})[k] === undefined ? null : local.reglages[k];
    });
    return c;
  }
  function memeContenu(a, b){ return canon(pourEnvoi(a)) === canon(pourEnvoi(b)); }

  /* Un carnet « vierge » n'a jamais rien noté : s'il rejoint un dépôt qui
     existe déjà, il doit le prendre tel quel. Le fusionner ferait gagner ses
     comptes à zéro sur les vrais soldes de l'autre appareil. */
  function estVierge(d){
    return !(d.mouvements||[]).length && !(d.engagements||[]).length
        && !(d.participations||[]).length && !(d.opportunites||[]).length;
  }

  /* Que faire en arrivant devant le dépôt ? Une seule décision, testée :
       "envoyer"  le dépôt est vide, ce carnet en devient le contenu ;
       "adopter"  le dépôt a été volontairement remplacé (autre époque), ou ce
                  carnet est vierge : on prend celui du dépôt ;
       "fusionner" cas normal, les deux ont la même histoire. */
  function decision(local, epoqueLocale, distant, epoqueDistante){
    if (!distant) return "envoyer";
    if (!epoqueLocale) return estVierge(local) ? "adopter" : "choisir";
    if (epoqueLocale !== epoqueDistante) return "adopter";
    return "fusionner";
  }

  /* Un tour de synchronisation, sans le réseau : à partir de ce carnet et de
     ce que contient le dépôt, dire quel carnet garder et s'il faut renvoyer
     quelque chose. Le réseau et le chiffrement sont autour (synchro.js) ; la
     décision est ici, où un test peut la tenir. */
  function tour(local, epoqueLocale, distant, epoqueDistante){
    var dec = decision(local, epoqueLocale, distant, epoqueDistante);
    if (dec === "envoyer") return {decision:dec, carnet:local, envoyer:true};
    if (dec === "choisir") return {decision:dec, carnet:local, envoyer:false};
    if (dec === "adopter") return {decision:dec, carnet:adopter(local, distant), envoyer:false};
    var f = fusionner(local, distant);
    return {decision:dec, carnet:f, envoyer:!memeContenu(f, distant)};
  }

  /* Après une fusion, vérifier que le carnet se tient encore. Deux versements
     notés sur le même prêt depuis deux appareils, sans synchronisation entre
     les deux, donnent deux mouvements mais un seul échéancier à jour : le
     solde (somme des mouvements) et le reste dû (tranches) ne racontent plus
     la même histoire. On ne corrige pas en douce, on le signale. */
  function incoherences(d){
    var r = [];
    (d.engagements||[]).forEach(function(e){
      var parMouvements = (d.mouvements||[]).reduce(function(s,m){
        return (m.engagement === e.id && (m.nature === "remboursement_recu" || m.nature === "remboursement_verse"))
          ? s + Math.abs(m.montant) : s; }, 0);
      var parTranches = regleEngagement(e);
      if (parMouvements !== parTranches)
        r.push({type:"engagement", id:e.id, tiers:e.tiers, objet:e.objet,
                parMouvements:parMouvements, parTranches:parTranches});
    });
    return r;
  }

  /* ------------------------------------------------------- la règle de date
     Appelée avant tout enregistrement. Une dépense du jour n'a rien à fixer ;
     dès qu'il y a une suite attendue, la date est obligatoire. */
  function exigeUneDate(type, objet){
    if (type === "engagement") {
      var t = (objet.tranches||[]);
      /* Un business fait exception : on sait souvent ce qu'on va toucher
         bien avant de savoir quand. Il s'enregistre donc sans date — mais il
         ne disparaît pas pour autant : ce qui n'est pas daté remonte dans
         « À faire » jusqu'à ce qu'on le date. Il peut même n'avoir aucune
         tranche, quand tout a déjà été reçu. */
      if (objet.origine === "business") return null;
      if (!t.length) return "Un engagement sans échéance n'est pas un engagement.";
      for (var i=0;i<t.length;i++) if (!t[i].date)
        return "Tranche " + (i+1) + " sans date : une promesse sans date est une promesse oubliée.";
    }
    if (type === "participation" && !objet.point)
      return "Sans date de prochain point, ce placement disparaît de l'écran.";
    if (type === "opportunite" && !objet.date)
      return "Sans prochaine action datée, l'affaire s'oublie.";
    if (type === "recurrent" && !objet.prochaine)
      return "Dis-moi quand tombe la prochaine, sinon elle n'apparaîtra jamais.";
    if (type === "mouvement" && !objet.date)
      return "Un mouvement sans date ne peut pas être classé.";
    return null;
  }

  /* Un identifiant doit être unique sur TOUS les appareils : deux téléphones
     qui numérotent chacun « 12 » leur douzième mouvement se marcheraient
     dessus à la synchronisation. On part de l'heure à la milliseconde, avec un
     décalage au hasard pour que deux appareils qui créent une fiche au même
     instant ne tombent pas sur le même numéro. Sur un même appareil, chaque
     identifiant est strictement plus grand que le précédent : aucun doublon
     possible, même en créant mille fiches d'un coup.
     Le résultat reste un entier exact (bien en dessous de 2^53). */
  var dernierId = 0;
  function nouvelId(){
    var base = Date.now() * 1000 + Math.floor(Math.random() * 1000);
    dernierId = base > dernierId ? base : dernierId + 1;
    return dernierId;
  }

  /* Formatage : le franc CFA n'a pas de centimes. Les séparateurs sont des
     espaces insécables ordinaires (U+00A0) : un montant ne doit jamais être
     coupé en deux lignes — « 247 / 500 F » se lit comme deux nombres. On écarte
     en revanche l'espace fine (U+202F) que renvoient certaines locales : elle
     n'a pas la largeur d'un chiffre et casse l'alignement des colonnes.
     Les caractères sont écrits en \u.... pour rester visibles à la relecture. */
  function F(n){
    var v = Math.round(Math.abs(n||0)).toLocaleString("fr-FR").replace(/[\s\u202f\u00a0]/g, "\u00a0");
    return (n < 0 ? "\u2212" : "") + v + "\u00a0F";
  }
  function jf(s){ return s ? s.slice(8,10) + "/" + s.slice(5,7) + "/" + s.slice(0,4) : "—"; }
  function quand(s, auj){
    if (!s) return "aucune date";
    var j = jours(auj, s);
    if (j === 0) return "aujourd'hui";
    if (j === 1) return "demain";
    if (j < 0) return "en retard de " + (-j) + " j";
    if (j <= 7) return "dans " + j + " j";
    return jf(s);
  }

  return {iso:iso, dateDe:dateDe, aujourdhui:aujourdhui, jours:jours,
    debutDuMois:debutDuMois, finDuMois:finDuMois, joursDuMois:joursDuMois,
    ajouterMois:ajouterMois, avancer:avancer, reculer:reculer, premiere:premiere, libelleRythme:libelleRythme,
    regleeCeMois:regleeCeMois, reglementsDuMois:reglementsDuMois, dernierReglement:dernierReglement,
    EFFET_SOLDE:EFFET_SOLDE, soldeTiers:soldeTiers, creances:creances, dettes:dettes,
    repartir:repartir, tranches:tranches, appliquerVersement:appliquerVersement,
    resteEngagement:resteEngagement, regleEngagement:regleEngagement, totalEngagement:totalEngagement,
    soldeCompte:soldeCompte, dansLeSolde:dansLeSolde, liquidites:liquidites, comptesImpossibles:comptesImpossibles,
    consommeEnveloppe:consommeEnveloppe, resteEnveloppes:resteEnveloppes,
    montantEnveloppe:montantEnveloppe, estAide:estAide,
    agenda:agenda, sansDate:sansDate, imprevus:imprevus, catsPrevues:catsPrevues, aSortir:aSortir, resteAVivre:resteAVivre,
    commission:commission, patrimoine:patrimoine, trainDeVie:trainDeVie,
    occurrencesDuMois:occurrencesDuMois, bilanDuMois:bilanDuMois, fileDAttente:fileDAttente,
    suggestions:suggestions, avancementFixes:avancementFixes, situationTiers:situationTiers,
    TYPES_BIEN:TYPES_BIEN, typeBien:typeBien, nomBien:nomBien, detailBien:detailBien, biensParType:biensParType,
    defautsCarnet:defautsCarnet,
    sansArgent:sansArgent, duBusiness:duBusiness, estBusiness:estBusiness, estValide:estValide,
    totalBusiness:totalBusiness, recuBusiness:recuBusiness, prochainBusiness:prochainBusiness, business:business,
    exigeUneDate:exigeUneDate, nouvelId:nouvelId, F:F, jf:jf, quand:quand,
    LISTES:LISTES, canon:canon, photographier:photographier, marquer:marquer,
    fusionner:fusionner, pourEnvoi:pourEnvoi, adopter:adopter, memeContenu:memeContenu,
    estVierge:estVierge, decision:decision, tour:tour, incoherences:incoherences};
})();

if (typeof module !== "undefined" && module.exports) module.exports = Calculs;
