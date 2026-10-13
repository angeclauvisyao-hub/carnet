/* Parcours complet : un mois d'usage, joué sur l'app entière sans navigateur.

       osascript -l JavaScript tests/parcours.js      (depuis la racine)

   tests/regles.js vérifie les calculs. Ici on vérifie que les FORMULAIRES
   enregistrent bien ce qu'ils annoncent : qu'un prêt crée sa créance, qu'une
   charge payée avance, qu'une aide passée ne fait sortir aucun argent, et
   que rien ne s'enregistre sans date. Le DOM est remplacé par un faux qui
   relit le HTML des feuilles, pour partir des vraies valeurs par défaut. */

ObjC.import("Foundation");
var racine = $.NSFileManager.defaultManager.currentDirectoryPath.js + "/";
function lire(n){ return $.NSString.stringWithContentsOfFileEncodingError(racine + n, $.NSUTF8StringEncoding, null).js; }

/* ------------------------------------------------------------ faux DOM */
var noeuds = {};
function decoder(s){ return String(s).replace(/&quot;/g,'"').replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&"); }
function relireFeuille(html){
  Object.keys(noeuds).forEach(function(k){ if (k.indexOf("f-") === 0 || k === "erreur-feuille") delete noeuds[k]; });
  var m, re = /<input id="(f-[^"]+)"([^>]*)>/g;
  while ((m = re.exec(html))) {
    var val = /value="([^"]*)"/.exec(m[2]);
    noeud(m[1]).value = val ? decoder(val[1]) : "";
  }
  re = /<textarea[^>]*id="(f-[^"]+)"[^>]*>([^<]*)<\/textarea>/g;
  while ((m = re.exec(html))) noeud(m[1]).value = decoder(m[2]);
  re = /<select id="(f-[^"]+)"[^>]*>([\s\S]*?)<\/select>/g;      // avec ou sans onchange
  while ((m = re.exec(html))) {
    var choisi = /<option value="([^"]*)" selected>/.exec(m[2]) || /<option value="([^"]*)"/.exec(m[2]);
    noeud(m[1]).value = choisi ? decoder(choisi[1]) : "";
  }
}
function noeud(id){
  if (!noeuds[id]) {
    var n = {id:id, value:"", textContent:"", hidden:false, _html:"",
      addEventListener:function(){}, focus:function(){}, select:function(){},
      querySelector:function(){ return {addEventListener:function(){}, querySelector:function(){ return null; },
                                        type:"text", focus:function(){}}; }};
    Object.defineProperty(n, "innerHTML", {
      get:function(){ return this._html; },
      set:function(h){ this._html = h; if (id === "couche") relireFeuille(h); }
    });
    noeuds[id] = n;
  }
  return noeuds[id];
}
var document = {getElementById:noeud, createElement:function(){ return {click:function(){}, remove:function(){}}; },
                body:{appendChild:function(){}, style:{}}, hidden:false, addEventListener:function(){}};
var demande = {result:{createObjectStore:function(){}, transaction:function(){
  return {objectStore:function(){ return {get:function(){ return {}; }, put:function(){}}; }}; }}};
var defilements = [];
var window = {indexedDB:{open:function(){ return demande; }}, scrollY:0,
              scrollTo:function(x, y){ defilements.push(y); window.scrollY = y; }};
window.self = window.top = window;
var navigator = {userAgent:"iPhone"}, location = {protocol:"file:"};
function setTimeout(){ return 0; } function clearTimeout(){}
/* Ce que le navigateur fournit et que JavaScriptCore seul n'a pas. */
var ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function btoa(b){ var o = "", i = 0; while (i < b.length){ var c1 = b.charCodeAt(i++), c2 = b.charCodeAt(i++), c3 = b.charCodeAt(i++);
  o += ALPHA[c1>>2] + ALPHA[((c1&3)<<4)|(c2>>4)] + (isNaN(c2) ? "=" : ALPHA[((c2&15)<<2)|(c3>>6)]) + (isNaN(c3) ? "=" : ALPHA[c3&63]); } return o; }
function atob(s){ s = s.replace(/=+$/, ""); var o = "", bits = 0, n = 0;
  for (var i = 0; i < s.length; i++){ bits = (bits<<6) | ALPHA.indexOf(s[i]); n += 6; if (n >= 8){ n -= 8; o += String.fromCharCode((bits>>n)&255); } } return o; }
var crypto = {getRandomValues:function(u){ for (var i = 0; i < u.length; i++) u[i] = (i*37+11) & 255; return u; }};
/* Une fausse promesse qui répond tout de suite : le banc d'essai n'a pas de
   boucle d'événements, et on veut voir le résultat de Face ID dans la foulée. */
function reponse(valeur, echec){
  return {then:function(ok){ if (!echec) { ok(valeur); } return this; },
          catch:function(ko){ if (echec) ko(valeur); return this; }};
}

var AUJ = "2026-10-13";
var code = lire("calculs.js") + "\nCalculs.aujourdhui = function(){ return '" + AUJ + "'; };\n"
  + lire("app.js") + "\n" + lire("vues.js") + "\n" + lire("formulaires.js") + "\n" + lire("synchro.js")
  + "\n" + lire("verrou.js")
  + "\nreturn {C:Calculs, Carnet:Carnet, Vues:Vues, F:Formulaires, V:Verrou, S:Synchro};";
var M = new Function("document","window","navigator","location","setTimeout","clearTimeout","atob","btoa","crypto", code)
  (document, window, navigator, location, setTimeout, clearTimeout, atob, btoa, crypto);
var C = M.C, Carnet = M.Carnet, Vues = M.Vues, Fo = M.F, Ve = M.V, Sy = M.S;

var reussis = 0, echecs = [];
function verifier(nom, attendu, obtenu){
  var a = JSON.stringify(attendu), b = JSON.stringify(obtenu);
  if (a === b) reussis++; else echecs.push(nom + "\n      attendu : " + a + "\n      obtenu  : " + b);
}
function vrai(nom, c){ verifier(nom, true, !!c); }
function saisir(champs){ Object.keys(champs).forEach(function(k){ noeud("f-" + k).value = String(champs[k]); }); }
function erreurAffichee(){ return (noeuds["erreur-feuille"] && noeuds["erreur-feuille"]._html) || ""; }
function feuilleOuverte(){ return noeud("couche")._html !== ""; }
function toutesLesVues(){
  return ["accueil","depenses","tiers","affaires","patrimoine","reglages"].map(function(v){
    try { var h = Vues[v](); return h && h.length > 50 ? "" : v + " vide"; }
    catch (e) { return v + " : " + e; } }).filter(Boolean);
}

/* ============================================================ premier jour
   Le parcours tourne sur un jeu d'essai fictif (tests/depart-essai.json) :
   aucun chiffre personnel ne doit se trouver dans un fichier versionné. Les
   vraies données de départ sont vérifiées à part, par prive/verifier.js. */
var ESSAI = JSON.parse(lire("tests/depart-essai.json"));
verifier("sans fichier de départ, le carnet démarre vide",
  [0,0,0], (function(){ var v = Carnet.donneesInitiales(AUJ, null);
    return [v.recurrents.length, v.tiers.length, v.enveloppes.length]; })());
Carnet.remplacerDonnees(Carnet.donneesInitiales(AUJ, ESSAI));
var d = Carnet.donnees();

verifier("aucun mouvement inventé au départ", 0, d.mouvements.length);
verifier("aucune affaire inventée au départ", 0, d.engagements.length + d.participations.length + d.opportunites.length);
verifier("les tiers du fichier de départ, et eux seuls", ["Un parent","Un enfant"], d.tiers.map(function(t){ return t.nom; }));
var parLib = function(l){ return d.recurrents.filter(function(c){ return c.libelle === l; })[0]; };
verifier("le fichier de départ n'est pas modifié par le carnet", "auto", ESSAI.recurrents[0].prochaine);
verifier("une ligne « auto » reçoit sa première date : le 10 est passé", "2026-11-10", parLib("Salaire").prochaine);
verifier("une ligne « auto » dont le jour est devant", "2026-10-15", parLib("Internet").prochaine);
verifier("certains mois seulement", "2026-11-15", parLib("Scolarité").prochaine);
verifier("deux fois par mois", "2026-10-20", parLib("Aide à un parent").prochaine);
verifier("une ligne sans date reste sans date", null, parLib("Eau").prochaine);
verifier("elle remonte donc dans « Sans date »", 1, C.sansDate(d).length);
verifier("les six écrans s'affichent sur un carnet neuf", [], toutesLesVues());
vrai("l'accueil propose les premiers gestes", Vues.accueil().indexOf("Le carnet est prêt") >= 0);

var tv0 = C.trainDeVie(d, AUJ);
verifier("fixes mensuels : loyer + électricité + internet", 110000, tv0.mensuels);
verifier("enveloppes : maison + caisse d'aides", 112000, tv0.enveloppes);
verifier("les aides ne sont pas comptées deux fois", 222000, tv0.courant);
vrai("le carnet annonce que le salaire ne couvre pas le train de vie", tv0.ecart < 0);

/* =================================================== dire ce qu'on a en caisse */
Fo.comptes();
saisir({solde1:"50 000", solde2:"120000", solde3:"400.000"});
Fo.majComptes();
verifier("trois écritures de montant, un seul résultat", 570000, C.liquidites(d));
verifier("poser un solde de départ ne crée aucun mouvement", 0, d.mouvements.length);
vrai("la feuille s'est refermée", !feuilleOuverte());

/* ============================================= une dépense non programmée */
var netteAvant = C.patrimoine(d).nette;
Fo.nouveau(null, "depense");
verifier("la date proposée est aujourd'hui", AUJ, noeud("f-date").value);
saisir({montant:"15 000", libelle:"Marché", cat:"Nourriture"});
Fo.enregistrerNouveau("depense");
verifier("la dépense est notée", 1, d.mouvements.length);
verifier("elle sort de la caisse", 555000, C.liquidites(d));
verifier("elle mange l'enveloppe maison", 15000, C.consommeEnveloppe(d, d.enveloppes[0], AUJ));
verifier("elle appauvrit vraiment", -15000, C.patrimoine(d).nette - netteAvant);

Fo.nouveau(null, "depense");
saisir({montant:"", libelle:"Sans montant"});
Fo.enregistrerNouveau("depense");
vrai("une dépense sans montant est refusée", erreurAffichee().indexOf("montant") >= 0);
verifier("et rien n'est enregistré", 1, d.mouvements.length);
Fo.fermer();

/* ================================================ une recette non programmée */
Fo.nouveau(null, "recette");
saisir({montant:"75000", libelle:"Vente d'un vieux portable", compte:"1"});
Fo.enregistrerNouveau("recette");
verifier("la recette imprévue entre en caisse", 630000, C.liquidites(d));
verifier("elle est comptée comme entrée non programmée", 75000, C.imprevus(d, AUJ).entrees);

Fo.nouveau(null, "depense");
saisir({montant:"22000", libelle:"Réparation voiture", cat:"Transport"});
Fo.enregistrerNouveau("depense");
verifier("une dépense hors enveloppe est un imprévu", 22000, C.imprevus(d, AUJ).sorties);

/* =========================================== payer une charge qui revient */
var internet = parLib("Internet");
verifier("internet tombe le 15 octobre", "2026-10-15", internet.prochaine);
Fo.agir("recurrent", internet.id, null);
verifier("le montant habituel est proposé", "10000", noeud("f-montant").value);
saisir({montant:"17 500"});
Fo.reglerRecurrent(internet.id);
verifier("la charge payée avance d'elle-même", "2026-11-15", internet.prochaine);
var dernier = d.mouvements[d.mouvements.length-1];
verifier("le montant réel est noté, pas le montant habituel", -17500, dernier.montant);
vrai("le mouvement est marqué charge fixe", dernier.fixe === true);
verifier("une charge fixe ne mange aucune enveloppe", 15000, C.consommeEnveloppe(d, d.enveloppes[0], AUJ));

/* ================================================= les aides : pas une dette */
var aideParent = parLib("Aide à un parent"), aideEnfant = parLib("Aide à un enfant");
verifier("prochaine aide au parent : le 20", "2026-10-20", aideParent.prochaine);
var rvAvant = C.resteAVivre(d, AUJ);
vrai("une aide facultative n'est pas dans ce qui doit sortir",
  C.agenda(d).filter(function(x){ return x.titre === "Aide à un parent"; })[0].genre === "aide");
verifier("la caisse d'aides est réservée dans le reste à vivre", 52000,
  C.montantEnveloppe(d.enveloppes[1], AUJ) - C.consommeEnveloppe(d, d.enveloppes[1], AUJ));

Fo.agir("recurrent", aideParent.id, null);
saisir({montant:"20000"});
Fo.reglerRecurrent(aideParent.id);
verifier("l'aide versée avance au 5 du mois suivant", "2026-11-05", aideParent.prochaine);
verifier("elle mange la caisse d'aides", 20000, C.consommeEnveloppe(d, d.enveloppes[1], AUJ));
verifier("verser une aide réservée ne change pas le reste à vivre", rvAvant.reste, C.resteAVivre(d, AUJ).reste);
verifier("la fiche du parent garde la trace", 1, d.mouvements.filter(function(m){ return m.tiers === 1; }).length);

var nbAvant = d.mouvements.length, liqAvant = C.liquidites(d);
Fo.agir("recurrent", aideEnfant.id, null);
Fo.passer(aideEnfant.id);
verifier("« pas ce mois-ci » ne crée aucun mouvement", nbAvant, d.mouvements.length);
verifier("et ne fait sortir aucun argent", liqAvant, C.liquidites(d));
verifier("mais la date avance", "2026-12-05", aideEnfant.prochaine);

/* il décide de mettre plus dans la caisse ce mois-ci */
Fo.enveloppe(2);
saisir({mois:"150 000"});
Fo.majEnveloppe(2);
verifier("le plafond de ce mois est 150 000", 150000, C.montantEnveloppe(d.enveloppes[1], AUJ));
verifier("le montant habituel n'a pas bougé", 52000, d.enveloppes[1].montant);
verifier("le mois prochain repart sur le montant habituel", 52000, C.montantEnveloppe(d.enveloppes[1], "2026-11-03"));

/* ============================================= dater la ligne restée sans date */
var ligneSansDate = parLib("Eau");
Fo.agir("recurrent", ligneSansDate.id, null);          // sans date : ouvre la fiche à corriger
saisir({prochaine:""});
Fo.majRecurrent(ligneSansDate.id);
vrai("la ligne ne peut pas être enregistrée sans date", erreurAffichee().indexOf("prochaine") >= 0);
saisir({prochaine:"2026-12-10"});
Fo.majRecurrent(ligneSansDate.id);
verifier("une fois datée, « Sans date » est vide", 0, C.sansDate(d).length);

/* =================================================== un prêt, en trois fois */
var netteAvantPret = C.patrimoine(d).nette;
Fo.nouveau(null, "pret");
saisir({"tiers-nouveau":"Un emprunteur", montant:"300 000", libelle:"Dépannage stock", nb:"3", pas:"1", echeance:""});
Fo.enregistrerNouveau("pret");
vrai("un prêt sans date de remboursement est refusé", erreurAffichee().indexOf("sans date") >= 0);
verifier("et aucun engagement n'est créé", 0, d.engagements.length);
/* Le refus arrive après la création du tiers : on vérifie qu'on ne le crée pas deux fois. */
saisir({"tiers-nouveau":"", echeance:"2026-11-15"});
var emprunteurs = d.tiers.filter(function(t){ return t.nom === "Un emprunteur"; });
saisir({tiers:String(emprunteurs.length ? emprunteurs[0].id : "")});
Fo.enregistrerNouveau("pret");
verifier("le prêt daté crée un engagement", 1, d.engagements.length);
verifier("l'emprunteur n'existe qu'une fois", 1, d.tiers.filter(function(t){ return t.nom === "Un emprunteur"; }).length);
var idK = d.tiers.filter(function(t){ return t.nom === "Un emprunteur"; })[0].id;
verifier("trois tranches de 100 000", [100000,100000,100000], d.engagements[0].tranches.map(function(t){ return t.montant; }));
verifier("échelonnées de mois en mois", ["2026-11-15","2026-12-15","2027-01-15"], d.engagements[0].tranches.map(function(t){ return t.date; }));
verifier("son solde est la somme de ses mouvements", 300000, C.soldeTiers(d, idK));
verifier("prêter ne change pas la position nette", netteAvantPret, C.patrimoine(d).nette);

/* ============================================ il rembourse, pas tout à fait */
Fo.nouveau(idK, "remboursement_recu");
saisir({engagement:String(d.engagements[0].id), montant:"60 000"});
Fo.enregistrerNouveau("remboursement_recu");
verifier("le solde baisse du versement", 240000, C.soldeTiers(d, idK));
verifier("le reste dû de l'engagement suit", 240000, C.resteEngagement(d.engagements[0]));
verifier("solde du tiers et reste dû racontent la même histoire", C.soldeTiers(d, idK), C.resteEngagement(d.engagements[0]));
verifier("le total prêté n'a pas changé", 300000, C.totalEngagement(d.engagements[0]));

/* =================================================== une mise dans une affaire */
Fo.nouveau(null, "placement");
saisir({"tiers-nouveau":"Un associé", objet:"Lot fer à béton", montant:"500 000", part:"40 %", point:""});
Fo.enregistrerNouveau("placement");
vrai("un placement sans date de point est refusé", erreurAffichee().indexOf("point") >= 0);
verifier("et aucune participation n'est créée", 0, d.participations.length);
var associes = d.tiers.filter(function(t){ return t.nom === "Un associé"; });
saisir({"tiers-nouveau":"", tiers:String(associes.length ? associes[0].id : ""), point:"2026-11-01"});
var netteAvantMise = C.patrimoine(d).nette;
Fo.enregistrerNouveau("placement");
verifier("la mise datée crée la participation", 1, d.participations.length);
verifier("placer ne change pas la position nette", netteAvantMise, C.patrimoine(d).nette);
verifier("la mise est à l'actif", 500000, C.patrimoine(d).mises);

/* un bénéfice enrichit, un retrait de mise déplace seulement l'argent */
var p = d.participations[0];
Fo.agir("participation", p.id, null);
saisir({montant:"120 000", genre:"benefice", point:"2026-12-01"});
var netteAvantPart = C.patrimoine(d).nette;
Fo.pointParticipation(p.id);
verifier("un bénéfice augmente la position nette", 120000, C.patrimoine(d).nette - netteAvantPart);
verifier("la mise reste entière à l'actif", 500000, C.patrimoine(d).mises);
Fo.agir("participation", p.id, null);
saisir({montant:"200 000", genre:"retrait", point:"2027-01-05"});
var netteAvantRetrait = C.patrimoine(d).nette;
Fo.pointParticipation(p.id);
verifier("un retrait de mise ne change pas la position nette", netteAvantRetrait, C.patrimoine(d).nette);
verifier("mais la mise à l'actif diminue", 300000, C.patrimoine(d).mises);
Fo.agir("participation", p.id, null);
saisir({montant:"0", point:""});
Fo.pointParticipation(p.id);
vrai("un point sans prochaine date est refusé", erreurAffichee().indexOf("prochain point") >= 0);
Fo.fermer();

/* ====================================================== une affaire apportée */
Fo.opportunite(null, null);
saisir({objet:"Parc 24 postes", base:"12 400 000", taux:"5", proba:"60", action:"Rappeler le DG", date:""});
Fo.majOpportunite(null);
vrai("une affaire sans prochaine action datée est refusée", erreurAffichee().indexOf("oublie") >= 0);
saisir({date:"2026-10-16"});
Fo.majOpportunite(null);
verifier("l'affaire datée est suivie", 1, d.opportunites.length);
verifier("la commission est calculée", 620000, C.commission(d.opportunites[0]));

/* ============================================================ compter la caisse */
/* Le prêt et la mise ont été imputés aux espèces sans que la caisse ait été
   assez déclarée : le carnet affiche un solde négatif, ce qui est impossible
   pour des billets. Il doit le dire. */
vrai("le carnet signale des espèces négatives", C.comptesImpossibles(d).length === 1);
vrai("et l'accueil le montre", Vues.accueil().indexOf("c'est impossible") >= 0);
Fo.pointer();
saisir({compte:"1", reel:"35 500"});
var nbMvt = d.mouvements.length;
Fo.majPointage();
verifier("le compte tombe sur le montant compté", 35500, C.soldeCompte(d, 1));
verifier("l'anomalie disparaît une fois la caisse comptée", 0, C.comptesImpossibles(d).length);
verifier("l'écart est une ligne visible, pas une correction muette", nbMvt + 1, d.mouvements.length);
vrai("la ligne s'appelle écart de caisse", d.mouvements[d.mouvements.length-1].ecart === true);

/* ============================================================ modifier, supprimer */
var loyer = parLib("Loyer");
Fo.recurrent(loyer.id);
saisir({montant:"320 000"});
Fo.majRecurrent(loyer.id);
verifier("le loyer est modifiable à la main", 320000, loyer.montant);

Fo.tiers(idK);
Fo.supprimerTiers(idK);
vrai("on ne supprime pas un tiers qui doit encore de l'argent", erreurAffichee().indexOf("solde") >= 0);
verifier("l'emprunteur est toujours là", 1, d.tiers.filter(function(t){ return t.id === idK; }).length);
Fo.fermer();

/* ================================================ charger un fichier de départ */
Fo.importer();
saisir({texte:JSON.stringify(ESSAI), phrase:""});
Fo.lancerImport();
vrai("un fichier de départ est refusé sur un carnet qui a déjà des mouvements",
  erreurAffichee().indexOf("carnet vide") >= 0);
vrai("et les mouvements sont toujours là", d.mouvements.length > 5);
saisir({texte:"ceci n'est pas du JSON"});
Fo.lancerImport();
vrai("un texte quelconque est refusé proprement", erreurAffichee().indexOf("n'est pas un fichier") >= 0);
Fo.fermer();

/* ================================================================ fin du mois */
verifier("après un mois d'usage, tous les écrans s'affichent", [], toutesLesVues());
Carnet.ouvrirTiers(idK);
vrai("la fiche de l'emprunteur s'affiche avec son solde", Vues.fiche().indexOf(C.F(240000)) >= 0);
verifier("rien sans date à la fin du parcours", 0, C.sansDate(d).length);
var pf = C.patrimoine(d);
verifier("position nette = actif − passif", pf.actif - pf.passif, pf.nette);
verifier("le total des créances est la somme des soldes positifs", 240000, pf.creances);

/* ==================================================================== le verrou
   Ce qui est joué ici : les décisions du verrou et l'enchaînement des écrans,
   avec un faux appareil. Ce qui ne peut pas l'être : le vrai Face ID, qui
   n'existe que sur le téléphone. */
function drapeaux(octet){ var u = new Uint8Array(37); u[32] = octet; return u; }
verifier("visage vérifié : le drapeau 0x04 est exigé", true, Ve.proprietaireVerifie(drapeaux(0x05)));
verifier("une simple présence (toucher l'écran) ne suffit pas", false, Ve.proprietaireVerifie(drapeaux(0x01)));
verifier("une réponse tronquée est refusée", false, Ve.proprietaireVerifie(new Uint8Array(10)));
verifier("une réponse absente est refusée", false, Ve.proprietaireVerifie(null));
verifier("59 secondes en arrière-plan : on ne redemande pas", false, Ve.doitRedemander(0, 59000));
verifier("60 secondes : on redemande", true, Ve.doitRedemander(0, 60000));
verifier("jamais passé en arrière-plan : rien à redemander", false, Ve.doitRedemander(null, 999999));

verifier("le carnet d'essai n'a pas de verrou", false, Ve.actif());
noeud("verrou").hidden = true;                 // comme dans index.html : <div id="verrou" hidden>
Ve.auDemarrage();
verifier("sans verrou, l'app s'ouvre directement, rideau levé", true, noeud("verrou").hidden);
vrai("les Réglages demandent d'abord un code", (Carnet.aller("reglages"), Vues.reglages()).indexOf("Mets d'abord un code") >= 0);
Ve.activerBiometrie();
verifier("Face ID ne s'active pas sans code de secours", null, d.reglages.biometrie || null);

/* Un code est posé (on écrit l'empreinte directement : le hachage est du
   ressort du navigateur). Le faux appareil accepte l'enregistrement. */
d.reglages.verrou = "empreinte-de-test";
navigator.credentials = {
  create:function(){ return reponse({rawId:new Uint8Array([1,2,3,4,5,6,7,8])}); },
  get:function(){ return reponse({response:{authenticatorData:drapeaux(0x05)}}); }
};
Ve.activerBiometrie();
vrai("avec un code, Face ID s'enregistre", d.reglages.biometrie && d.reglages.biometrie.id === btoa("\x01\x02\x03\x04\x05\x06\x07\x08"));
vrai("le verrou est actif", Ve.actif());

/* Passage en arrière-plan : le rideau tombe tout de suite. */
var horloge = 1000000;
var vraiDateNow = Date.now; Date.now = function(){ return horloge; };
Carnet.aller("accueil");
document.hidden = true; Ve.surVisibilite();
verifier("en arrière-plan, le rideau est tiré", false, noeud("verrou").hidden);
vrai("et il ne montre aucun chiffre", noeud("verrou")._html.indexOf(" F<") < 0 && noeud("verrou")._html.indexOf("f-verrou") < 0);
horloge += 20000; document.hidden = false; Ve.surVisibilite();
verifier("retour après 20 secondes : le carnet se rouvre seul", true, noeud("verrou").hidden);

/* Longue absence : Face ID est demandé, et le visage reconnu ouvre. */
document.hidden = true; Ve.surVisibilite();
horloge += 5 * 60000; document.hidden = false; Ve.surVisibilite();
verifier("retour après 5 minutes, visage reconnu : ouvert", true, noeud("verrou").hidden);

/* Même absence, mais l'appareil ne confirme pas que c'est lui. */
navigator.credentials.get = function(){ return reponse({response:{authenticatorData:drapeaux(0x01)}}); };
document.hidden = true; Ve.surVisibilite();
horloge += 5 * 60000; document.hidden = false; Ve.surVisibilite();
verifier("visage non confirmé : le carnet reste fermé", false, noeud("verrou").hidden);
vrai("le code de secours est proposé", noeud("verrou")._html.indexOf("f-verrou") >= 0);
vrai("et le bouton Face ID aussi", noeud("verrou")._html.indexOf("Déverrouiller avec Face ID") >= 0);

/* L'utilisateur annule, ou l'appareil refuse. */
navigator.credentials.get = function(){ return reponse(new Error("annulé"), true); };
Ve.demanderBiometrie();
verifier("Face ID annulé : toujours fermé", false, noeud("verrou").hidden);
navigator.credentials.get = function(){ throw new Error("pas de biométrie"); };
Ve.demanderBiometrie();
verifier("Face ID en panne : toujours fermé, sans planter", false, noeud("verrou").hidden);
navigator.credentials.get = function(){ return reponse(null); };
Ve.demanderBiometrie();
verifier("réponse vide de l'appareil : toujours fermé", false, noeud("verrou").hidden);

Ve.ouvrir();
Fo.verrou(); Fo.retirerVerrou();
verifier("retirer le code retire aussi Face ID", [null, null], [d.reglages.verrou, d.reglages.biometrie]);
verifier("plus de verrou", false, Ve.actif());
Date.now = vraiDateNow;

/* ============================================== ce que l'app prépare pour la synchro
   Le transport est testé dans un navigateur. Ici : l'app date-t-elle bien ses
   saisies et garde-t-elle la trace de ses suppressions, sans qu'on le lui
   demande à chaque endroit ? */
verifier("sans réseau ni chiffrement, la synchronisation se dit indisponible", false, Sy.possible());
verifier("et l'appareil n'est pas relié", false, Sy.relie());
vrai("les Réglages le disent au lieu de proposer un bouton qui échouerait",
  (Carnet.aller("reglages"), Vues.reglages()).indexOf("Indisponible ici") >= 0);
Fo.nouveau(null, "depense");
saisir({montant:"7 000", libelle:"Essai de datation", cat:"Nourriture"});
Fo.enregistrerNouveau("depense");
var datee = d.mouvements[d.mouvements.length - 1];
vrai("une dépense notée par le + porte sa date de modification", typeof datee.maj === "number" && datee.maj > 0);
vrai("son identifiant est unique entre appareils (grand entier exact)", Number.isSafeInteger(datee.id) && datee.id > 1e15);
var majAvant = datee.maj, autre = d.mouvements[0], majAutre = autre.maj;
Fo.mouvement(datee.id);
saisir({montant:"7 500"});
Fo.majMouvement(datee.id);
vrai("la modifier la redate", datee.maj >= majAvant && datee.montant === -7500);
verifier("sans toucher à la date des autres lignes", majAutre, autre.maj);
Fo.mouvement(datee.id);
Fo.supprimerMouvement(datee.id);
vrai("la supprimer laisse une trace pour l'autre appareil", d.supprimes["mouvements:" + datee.id] > 0);
verifier("et elle n'est plus dans le carnet", 0, d.mouvements.filter(function(m){ return m.id === datee.id; }).length);
vrai("ce qui part au dépôt ne contient ni code ni clé Face ID",
  (function(){ d.reglages.verrou = "x"; d.reglages.biometrie = {id:"y"}; var e = C.pourEnvoi(d);
    d.reglages.verrou = null; d.reglages.biometrie = null;
    return e.reglages.verrou === undefined && e.reglages.biometrie === undefined; })());
verifier("le carnet d'essai reste cohérent après tout le parcours", [], C.incoherences(d));

/* ============================================ le bouton « Effectuée » des charges
   Dans la liste des charges fixes, chaque ligne datée porte un bouton qui la
   marque payée : le compte choisi est débité, la charge avance à sa
   prochaine date, et le carnet dit ce qu'il a fait. */
var chargeE = parLib("Électricité"), salaireE = parLib("Salaire"), aideE = parLib("Aide à un parent");
var pageDep = Vues.depenses();
vrai("une charge datée porte le bouton Effectuée",
  pageDep.indexOf("Formulaires.agir('recurrent'," + chargeE.id + ",null)\">Effectuée</button>") >= 0);
vrai("un revenu fixe porte le bouton Reçu",
  pageDep.indexOf("Formulaires.agir('recurrent'," + salaireE.id + ",null)\">Reçu</button>") >= 0);
/* L'aide au parent a déjà été envoyée ce mois-ci plus haut dans le parcours :
   elle porte la mention verte. L'autre aide, passée sans versement, garde son bouton. */
vrai("une aide déjà envoyée ce mois-ci porte la mention verte",
  pageDep.indexOf("Formulaires.reglement(" + aideE.id + ")\">✓ Envoyée le ") >= 0);
vrai("une aide « si je peux » pas encore envoyée porte le bouton Envoyée",
  pageDep.indexOf("Formulaires.agir('recurrent'," + parLib("Aide à un enfant").id + ",null)\">Envoyée</button>") >= 0);
vrai("toucher le nom ouvre toujours le réglage de la charge",
  pageDep.indexOf('class="zone" onclick="Formulaires.recurrent(' + chargeE.id + ')"') >= 0);
vrai("aucun bouton n'est imbriqué dans un autre bouton",
  !/<button[^>]*class="ligne[^>]*>(?:(?!<\/button>)[\s\S])*<button/.test(pageDep));
var sansDateE = {id:C.nouvelId(), libelle:"Charge sans date", sens:"sortie", montant:1000, cat:"Divers",
                 tiers:null, compte:1, rythme:{type:"mensuel", jour:3}, prochaine:null};
d.recurrents.push(sansDateE);
vrai("une charge sans date ne propose pas Effectuée mais À dater",
  (function(h){ return h.indexOf("Formulaires.agir('recurrent'," + sansDateE.id) < 0
    && h.indexOf('onclick="Formulaires.recurrent(' + sansDateE.id + ')">À dater</button>') >= 0; })(Vues.depenses()));
d.recurrents.pop();

var compteDebite = 3, soldeAvantE = C.soldeCompte(d, compteDebite), echeanceE = chargeE.prochaine;
var autreCompte = C.soldeCompte(d, 1), nbMvtE = d.mouvements.length;
Fo.agir("recurrent", chargeE.id, null);
vrai("la feuille propose le compte de la charge, avec son solde",
  noeud("f-compte").value === String(chargeE.compte) && noeud("couche")._html.indexOf(C.F(soldeAvantE)) >= 0);
verifier("et le montant habituel", String(chargeE.montant), noeud("f-montant").value);
/* L'échéance est dans 28 jours : en touchant « Effectuée » aujourd'hui, on
   règle presque sûrement celle d'avant. Le carnet le suppose, propose la date
   de cette échéance passée, et ne fait pas sauter celle de novembre. */
vrai("la prochaine échéance est encore loin", C.jours(AUJ, echeanceE) > 10);
verifier("le carnet suppose alors une échéance déjà passée", "passee", noeud("f-echeance").value);
verifier("et propose sa vraie date, le 10 octobre", "2026-10-10", noeud("f-date").value);
/* Le compte a été ouvert le 13 : son solde tenait déjà compte de ce qui a été
   payé le 10. Noter cette dépense ne doit pas la retirer une seconde fois. */
vrai("la feuille annonce que le compte ne sera pas touché",
  noeud("info-debit").textContent.indexOf("ne sera pas touché") >= 0);
saisir({montant:"23 500", compte:String(compteDebite)});
Fo.reglerRecurrent(chargeE.id);
verifier("payée avant l'ouverture du compte : le solde n'est pas touché", soldeAvantE, C.soldeCompte(d, compteDebite));
verifier("les autres comptes ne bougent pas", autreCompte, C.soldeCompte(d, 1));
verifier("la dépense est quand même notée, à sa date", [nbMvtE + 1, "2026-10-10", -23500],
  [d.mouvements.length, d.mouvements[d.mouvements.length - 1].date, d.mouvements[d.mouvements.length - 1].montant]);
vrai("elle compte dans les dépenses d'octobre",
  -d.mouvements.filter(function(m){ return m.nature === "depense" && m.date >= "2026-10-01" && m.date <= "2026-10-31"; })
     .reduce(function(t,m){ return t + m.montant; }, 0) >= 23500);
vrai("la ligne du mois dit qu'elle est déjà dans le solde", Vues.depenses().indexOf("déjà dans le solde") >= 0);
verifier("l'échéance à venir n'a pas sauté", echeanceE, chargeE.prochaine);
vrai("elle est toujours dans l'agenda", C.agenda(d).some(function(x){ return x.titre === "Électricité" && x.date === echeanceE; }));
/* La même échéance passée, mais payée aujourd'hui : là, le compte est débité. */
Fo.agir("recurrent", chargeE.id, null);
saisir({date:AUJ, montant:"1 000", compte:String(compteDebite)});
Fo.infoDebit(chargeE.id);
vrai("payée aujourd'hui, la feuille annonce le débit", noeud("info-debit").textContent.indexOf("sera débité") >= 0);
Fo.reglerRecurrent(chargeE.id);
verifier("une dépense d'après l'ouverture débite le compte", soldeAvantE - 1000, C.soldeCompte(d, compteDebite));
verifier("sans faire sauter l'échéance à venir", echeanceE, chargeE.prochaine);
soldeAvantE = C.soldeCompte(d, compteDebite);
/* S'il choisit de régler celle de novembre en avance, elle avance. */
Fo.agir("recurrent", chargeE.id, null);
saisir({echeance:"prochaine"});
Fo.echeanceChoisie(chargeE.id);
verifier("choisir la prochaine remet la date à aujourd'hui", AUJ, noeud("f-date").value);
saisir({montant:"20000"});
Fo.reglerRecurrent(chargeE.id);
vrai("réglée en avance sur demande, la charge avance", chargeE.prochaine > echeanceE);
verifier("et le compte est débité", soldeAvantE - 20000, C.soldeCompte(d, compteDebite));
/* Une échéance proche ou en retard est celle qu'on règle, sans avoir à choisir. */
Fo.agir("recurrent", parLib("Loyer").id, null);
var prochePourTest = parLib("Loyer"); var sauvegardeDate = prochePourTest.prochaine;
Fo.fermer(); prochePourTest.prochaine = "2026-10-15";
Fo.agir("recurrent", prochePourTest.id, null);
verifier("une échéance dans deux jours est proposée par défaut", "prochaine", noeud("f-echeance").value);
Fo.fermer(); prochePourTest.prochaine = "2026-10-01";
Fo.agir("recurrent", prochePourTest.id, null);
verifier("une échéance en retard aussi", "prochaine", noeud("f-echeance").value);
Fo.fermer(); prochePourTest.prochaine = sauvegardeDate;
/* Réglée pour le mois : mention verte, plus de montant rouge ni de bouton. */
function ligneDe(html, id){
  var debut = html.indexOf('class="zone" onclick="Formulaires.recurrent(' + id + ')"');
  var avant = html.lastIndexOf('<div class="ligne', debut), apres = html.indexOf('</span></div>', debut);
  return html.slice(avant, apres);
}
var ligneReglee = ligneDe(Vues.depenses(), chargeE.id);
vrai("la charge est réglée pour ce mois", C.regleeCeMois(chargeE, AUJ));
vrai("la ligne porte la mention verte avec la date", ligneReglee.indexOf('class="reglee"') >= 0
  && ligneReglee.indexOf("Réglée le " + C.jf(AUJ).slice(0,5)) >= 0);
vrai("son montant rouge a disparu", ligneReglee.indexOf("montant moins") < 0 && ligneReglee.indexOf(C.F(chargeE.montant)) < 0);
vrai("et son bouton Effectuée aussi", ligneReglee.indexOf(">Effectuée<") < 0);
vrai("une charge pas encore réglée garde son montant rouge et son bouton",
  (function(l){ return l.indexOf("montant moins") >= 0 && l.indexOf(">Effectuée<") >= 0 && l.indexOf('class="reglee"') < 0; })
  (ligneDe(Vues.depenses(), parLib("Loyer").id)));
/* Le 1er du mois suivant, tout revient : montant rouge et bouton. */
Carnet.etat().auj = "2026-11-01";
var ligneNovembre = ligneDe(Vues.depenses(), chargeE.id);
vrai("le 1er du mois suivant, le montant rouge réapparaît",
  ligneNovembre.indexOf("montant moins") >= 0 && ligneNovembre.indexOf(C.F(chargeE.montant)) >= 0);
vrai("avec son bouton Effectuée, et sans la mention verte",
  ligneNovembre.indexOf(">Effectuée<") >= 0 && ligneNovembre.indexOf('class="reglee"') < 0);
Carnet.etat().auj = AUJ;
vrai("et les trois dépenses apparaissent dans les lignes du mois, marquées charge fixe",
  d.mouvements.filter(function(m){ return m.libelle === "Électricité" && m.fixe === true; }).length === 3);
/* un revenu déjà reçu avant l'ouverture ne gonfle pas le compte non plus */
var salaireAvant = C.soldeCompte(d, salaireE.compte), prochainSalaire = salaireE.prochaine;
Fo.agir("recurrent", salaireE.id, null);
verifier("le salaire d'octobre est proposé au 10", "2026-10-10", noeud("f-date").value);
Fo.reglerRecurrent(salaireE.id);
verifier("déjà reçu avant l'ouverture : le compte n'est pas crédité une seconde fois", salaireAvant, C.soldeCompte(d, salaireE.compte));
verifier("et le salaire de novembre est toujours attendu", prochainSalaire, salaireE.prochaine);
vrai("mais il compte dans les entrées du mois",
  d.mouvements.some(function(m){ return m.nature === "recette" && m.date === "2026-10-10" && m.fixe === true; }));
vrai("le salaire reçu s'affiche en vert « Reçu le », sans son montant",
  (function(l){ return l.indexOf("Reçu le 10/10") >= 0 && l.indexOf("montant plus") < 0; })(ligneDe(Vues.depenses(), salaireE.id)));
/* rattraper ensuite un paiement plus ancien ne défait pas l'état du mois */
var regleAvant = chargeE.dernierRegle;
Fo.agir("recurrent", chargeE.id, null);
saisir({echeance:"passee", date:"2026-09-10", montant:"19000"});
Fo.reglerRecurrent(chargeE.id);
verifier("noter après coup un paiement de septembre ne recule pas la date de règlement", regleAvant, chargeE.dernierRegle);
vrai("la charge reste réglée pour le mois", C.regleeCeMois(chargeE, AUJ));

/* ================================================ la page du dessous ne défile pas
   Une feuille ouverte fige la page derrière elle, à l'endroit où elle était,
   et la remet exactement là en se fermant. */
window.scrollY = 340;
Fo.nouveau(null, "depense");
verifier("feuille ouverte : la page du dessous est épinglée", ["fixed", "-340px"], [document.body.style.position, document.body.style.top]);
Fo.nouveau(null, "recette");                       // changer de nature rouvre la feuille
verifier("changer de nature ne perd pas la position mémorisée", "-340px", document.body.style.top);
Fo.fermer();
verifier("feuille fermée : la page est libérée", ["", ""], [document.body.style.position, document.body.style.top]);
verifier("et revient exactement où elle était", 340, defilements[defilements.length - 1]);
Fo.tiers(); Fo.majTiers(null);                     // refus (pas de nom) : la feuille reste ouverte
verifier("un refus de saisie laisse la page épinglée", "fixed", document.body.style.position);
Fo.fermer();
verifier("libérée de nouveau", "", document.body.style.position);
window.scrollY = 0;
/* Un seul conteneur qui défile, plein écran : l'écran de saisie lui-même.
   Si la feuille redevient un conteneur de défilement à l'intérieur d'un voile
   fixe, l'iPhone la bloquera de nouveau derrière le clavier. */
var cssPlat = lire("style.css").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\n\s*/g, "");
vrai("c'est l'écran de saisie qui défile", /\.voile\{[^}]*overflow-y:auto/.test(cssPlat));
vrai("et il ne transmet pas son défilement à la page", /\.voile\{[^}]*overscroll-behavior:contain/.test(cssPlat));
vrai("la feuille, elle, ne défile pas à l'intérieur", !/\.feuille\{[^}]*overflow/.test(cssPlat) && !/\.feuille\{[^}]*max-height/.test(cssPlat));
/* le clavier ne sort pas tout seul sur un écran tactile */
var focus = 0, vraiQS = noeud("couche").querySelector;
noeud("couche").querySelector = function(){ return {addEventListener:function(){}, style:{},
  querySelector:function(){ return {type:"text", focus:function(){ focus++; }}; }}; };
Fo.tiers(); Fo.fermer();
verifier("avec une souris, le curseur est placé d'office dans le premier champ", 1, focus);
window.matchMedia = function(q){ return {matches:q.indexOf("coarse") >= 0}; };
Fo.tiers(); Fo.fermer();
verifier("sur un écran tactile, non : le clavier ne sort pas tout seul", 1, focus);
delete window.matchMedia;
/* l'écran de saisie se cale sur la zone visible au-dessus du clavier */
var voileStyle = {};
noeud("couche").querySelector = function(sel){ return sel === ".voile" ? {style:voileStyle}
  : {addEventListener:function(){}, querySelector:function(){ return null; }}; };
window.visualViewport = {offsetTop:0, height:470};
Fo.tiers();
verifier("clavier sorti : l'écran de saisie prend la hauteur visible", ["0px","470px"], [voileStyle.top, voileStyle.height]);
window.visualViewport = {offsetTop:120, height:470};
Fo.ajusterAuClavier();
verifier("et suit la page si l'iPhone l'a décalée", ["120px","470px"], [voileStyle.top, voileStyle.height]);
Fo.fermer(); delete window.visualViewport; noeud("couche").querySelector = vraiQS;

/* ============================================================ sur grand écran
   Le téléphone reste la référence : la mise en page du Mac vit dans une seule
   règle, à partir de 900 px, et ne touche à rien en dessous. */
var css = lire("style.css");
vrai("la mise en page du Mac est isolée dans une règle à partir de 900 px", /@media \(min-width:900px\)/.test(css));
vrai("avant cette règle, rien ne parle de colonnes : le téléphone n'est pas touché",
  css.slice(0, css.indexOf("@media (min-width:900px)")).indexOf(".col-tete") < 0);
vrai("les écrans à chiffres clés posent leurs deux colonnes",
  ["accueil","depenses","affaires","patrimoine"].every(function(v){
    var h = Vues[v](); return h.indexOf('class="colonnes"') >= 0 && h.indexOf('class="col-tete"') < h.indexOf('class="col-corps"'); }));
vrai("les chiffres clés sont dans la première colonne, les rubriques dans la seconde",
  (function(h){ var c = h.indexOf('class="col-corps"'); return h.indexOf('class="resume"') < c && h.indexOf('<details class="section') > c; })(Vues.accueil()));
/* sur un téléphone, les rubriques de l'accueil restent fermées ; sur un Mac, elles s'ouvrent */
vrai("sur un téléphone, l'accueil garde ses rubriques fermées", !/data-section="accueil\.avenir" open/.test(Vues.accueil()));
window.matchMedia = function(q){ return {matches:q.indexOf("900px") >= 0}; };
vrai("sur un grand écran, elles s'ouvrent d'elles-mêmes", /data-section="accueil\.avenir" open/.test(Vues.accueil()));
vrai("mais pas celles des autres onglets", !/data-section="depenses\.lignes" open/.test(Vues.depenses()));
Carnet.etat().ouverts["accueil.avenir"] = false;
vrai("et une rubrique qu'on referme reste fermée", !/data-section="accueil\.avenir" open/.test(Vues.accueil()));
Carnet.etat().ouverts = {}; delete window.matchMedia;

/* ============================================ tout chiffre s'ouvre, rien ne se paie deux fois
   Un total qu'on ne peut pas ouvrir est un total qu'on ne peut pas vérifier :
   « Sorti ce mois » doit montrer ses lignes. Et la mention verte d'une charge
   réglée ne doit plus mener à la feuille de paiement. */
var pageD = Vues.depenses();
vrai("« Sorti ce mois » s'ouvre sur ses lignes",
  /data-section="depenses\.sorti"[\s\S]*?<div class="r-corps"><div class="liste">/.test(pageD));
vrai("« Entré ce mois » aussi", /data-section="depenses\.entre"[\s\S]*?<div class="r-corps">/.test(pageD));
(function(){
  var debut = pageD.indexOf('data-section="depenses.sorti"'), fin = pageD.indexOf('data-section="depenses.entre"');
  var bloc = pageD.slice(debut, fin);
  var lignes = (bloc.match(/class="ligne"/g) || []).length;
  var attendues = d.mouvements.filter(function(m){ return m.nature === "depense" && m.date >= "2026-10-01" && m.date <= "2026-10-31"; });
  verifier("il liste exactement les dépenses qui font le total", attendues.length, lignes);
  vrai("chaque ligne ouvre sa correction", attendues.every(function(m){ return bloc.indexOf("Formulaires.mouvement(" + m.id + ")") >= 0; }));
})();
var pageA = Vues.accueil();
vrai("sur l'accueil, « Ce que j'ai » s'ouvre compte par compte",
  /data-section="accueil\.caisse"[\s\S]*?<div class="r-corps"><div class="rang fin">/.test(pageA));

/* la mention verte ouvre le règlement, pas le paiement */
var loyerD = parLib("Loyer"), banqueD = C.soldeCompte(d, loyerD.compte), echeanceD = loyerD.prochaine;
loyerD.prochaine = "2026-10-15";                              // une échéance proche : elle sera soldée et avancera
Fo.agir("recurrent", loyerD.id, null);
vrai("première fois : aucune alerte de doublon", noeud("couche")._html.indexOf("Déjà réglé ce mois-ci") < 0);
Fo.reglerRecurrent(loyerD.id);
var mvLoyer = d.mouvements[d.mouvements.length - 1];
verifier("le loyer est réglé, la banque débitée", banqueD - loyerD.montant, C.soldeCompte(d, loyerD.compte));
verifier("le règlement retient l'échéance qu'il a soldée", "2026-10-15", mvLoyer.echeanceReglee);
vrai("la mention verte mène au règlement, plus à la feuille de paiement",
  ligneDe(Vues.depenses(), loyerD.id).indexOf('onclick="Formulaires.reglement(' + loyerD.id + ')"') >= 0
  && ligneDe(Vues.depenses(), loyerD.id).indexOf("Formulaires.agir(") < 0);
Fo.reglement(loyerD.id);
vrai("cette feuille montre le règlement et permet de l'annuler",
  noeud("couche")._html.indexOf("Annuler ce règlement") >= 0 && noeud("couche")._html.indexOf(C.F(loyerD.montant)) >= 0);
vrai("elle n'a ni champ de montant ni bouton Payé : la toucher ne paie rien",
  noeud("couche")._html.indexOf('id="f-montant"') < 0 && noeud("couche")._html.indexOf(">Payé<") < 0);
Fo.fermer();
/* s'il insiste et paie une seconde fois, il est prévenu en rouge */
Fo.agir("recurrent", loyerD.id, null);
vrai("un second paiement est annoncé comme tel", noeud("couche")._html.indexOf("Déjà réglé ce mois-ci") >= 0);
saisir({echeance:"passee", date:AUJ});
Fo.reglerRecurrent(loyerD.id);
var doublon = d.mouvements[d.mouvements.length - 1];
verifier("le doublon est bien compté deux fois, comme dans la vraie vie", banqueD - 2 * loyerD.montant, C.soldeCompte(d, loyerD.compte));
Fo.reglement(loyerD.id);
vrai("la feuille signale deux règlements pour la même ligne", noeud("couche")._html.indexOf("2 règlements ce mois-ci") >= 0);
/* annuler le doublon : l'argent revient, la charge reste réglée par le premier */
Fo.annulerReglement(doublon.id);
verifier("annuler le doublon rend l'argent au compte", banqueD - loyerD.montant, C.soldeCompte(d, loyerD.compte));
vrai("la charge reste réglée par le premier paiement", C.regleeCeMois(loyerD, AUJ));
/* annuler aussi le premier : tout revient comme avant */
Fo.annulerReglement(mvLoyer.id);
verifier("annuler le règlement rend tout l'argent", banqueD, C.soldeCompte(d, loyerD.compte));
verifier("l'échéance soldée redevient à payer", "2026-10-15", loyerD.prochaine);
vrai("et la ligne retrouve son montant rouge et son bouton", !C.regleeCeMois(loyerD, AUJ)
  && ligneDe(Vues.depenses(), loyerD.id).indexOf(">Effectuée<") >= 0);
/* supprimer la ligne depuis « Sorti ce mois » fait la même chose */
Fo.agir("recurrent", loyerD.id, null); Fo.reglerRecurrent(loyerD.id);
var mvLoyer2 = d.mouvements[d.mouvements.length - 1];
Fo.mouvement(mvLoyer2.id); Fo.supprimerMouvement(mvLoyer2.id);
vrai("supprimer le mouvement remet aussi la charge à payer", !C.regleeCeMois(loyerD, AUJ) && loyerD.prochaine === "2026-10-15");
loyerD.prochaine = echeanceD;

/* ====================================================== l'essentiel d'abord
   Chaque écran s'ouvre sur ses chiffres clés et une ligne par rubrique ; le
   détail est replié. « Première vue » = ce qu'on voit sans rien toucher : on
   retire le contenu des rubriques et on mesure ce qui reste. Le carnet est
   ici plein d'un mois de saisies : c'est là qu'un écran déborde. */
function premiereVue(html){
  return html.replace(/<div class="s-corps">[\s\S]*?<\/div><\/details>/g, "</details>")
             .replace(/<div class="r-corps">[\s\S]*?<\/div><\/details>/g, "</details>");
}
function texteVisible(html){ return premiereVue(html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(); }
function compter(html, motif){ return (premiereVue(html).match(motif) || []).length; }
var ECRANS = {accueil:Vues.accueil(), depenses:Vues.depenses(), affaires:Vues.affaires(),
              patrimoine:Vues.patrimoine(), reglages:Vues.reglages()};
Object.keys(ECRANS).forEach(function(nom){
  var h = ECRANS[nom];
  verifier(nom + " : aucune liste dépliée à l'ouverture", 0, compter(h, /class="(liste|bilan|cats)"/g));
  verifier(nom + " : aucune carte de détail à l'ouverture", 0, compter(h, /class="bloc"/g));
  vrai(nom + " : au plus trois chiffres clés", compter(h, /class="rang"/g) <= 3);
  vrai(nom + " : au plus six rubriques", compter(h, /<details class="section/g) <= 6);
  /* L'accueil est un tableau de bord : il porte en plus ses quatre tuiles et
     cinq suggestions au plus. Son plafond est plus haut, mais il en a un. */
  vrai(nom + " : la première vue tient en peu de mots (" + texteVisible(h).length + " caractères)",
    texteVisible(h).length <= (nom === "accueil" ? 700 : 330));
});
/* ------------------------------------------------ l'accueil, tableau de bord
   Ce que j'ai, un chiffre par onglet, puis quoi faire — dans cet ordre. */
var vA = premiereVue(ECRANS.accueil);
vrai("l'accueil dit d'abord ce que j'ai", texteVisible(ECRANS.accueil).indexOf("Ce que j'ai") >= 0);
verifier("puis une tuile par onglet, qui y mène", ["depenses","tiers","affaires","patrimoine"],
  (vA.match(/class="tuile" onclick="Carnet\.aller\('([a-z]+)'\)"/g) || []).map(function(t){ return /'([a-z]+)'/.exec(t)[1]; }));
var avA = C.avancementFixes(d, AUJ);
vrai("puis les revenus et les charges fixes du mois, avec leur total",
  texteVisible(ECRANS.accueil).indexOf("Revenus fixes du mois") > 0 && texteVisible(ECRANS.accueil).indexOf("Charges fixes du mois") > 0
  && vA.indexOf(">" + C.F(avA.revenus.prevu) + "</b>") > 0 && vA.indexOf(">" + C.F(avA.charges.prevu) + "</b>") > 0);
vrai("chacun dit « tout est là » ou son taux, sans rien toucher",
  [[avA.revenus, "perçu"], [avA.charges, "réglé"]].every(function(p){
    return texteVisible(ECRANS.accueil).indexOf(p[0].complet ? "tout est " + p[1] : p[1] + " à " + p[0].taux + " %") > 0; }));
vrai("et s'ouvre sur ses lignes, pour agir sur place",
  /data-section="accueil\.charges"[\s\S]*?<div class="r-corps"><div class="liste">/.test(ECRANS.accueil));
vrai("puis quoi faire, après les tuiles", vA.indexOf('class="tuiles"') < vA.indexOf("À faire") && vA.indexOf("À faire") > 0);
vrai("cinq suggestions au plus à l'ouverture", compter(ECRANS.accueil, /class="ligne suggestion"/g) <= 5);
var sugA = C.suggestions(d, AUJ, {debutant:Carnet.debutant()});
verifier("le compteur « À faire » dit le vrai nombre, replié compris", sugA.length,
  Number(/À faire <span class="pastille">(\d+)</.exec(ECRANS.accueil)[1]));
verifier("toutes les suggestions sont dans la page, visibles ou repliées", sugA.length,
  (ECRANS.accueil.match(/class="ligne suggestion"/g) || []).length);
vrai("les suggestions sont rangées par urgence",
  sugA.every(function(x, k){ return k === 0 || sugA[k-1].rang <= x.rang; }));
vrai("chaque suggestion porte un verbe et un geste qui existe",
  sugA.every(function(x){ return x.verbe && x.ref && x.ref.type; })
  && (ECRANS.accueil.match(/onclick="(Formulaires|Carnet)\.[A-Za-z]+\(/g) || []).every(function(o){
       var m = /(Formulaires|Carnet)\.([A-Za-z]+)/.exec(o); return typeof (m[1] === "Carnet" ? Carnet : Fo)[m[2]] === "function"; }));
vrai("ce qui n'a pas de date remonte dans « À faire », avec le verbe « Dater »",
  C.sansDate(d).length === sugA.filter(function(x){ return x.verbe === "Dater"; }).length);
vrai("le détail n'a pas disparu, il est replié : les lignes sont toujours dans la page",
  ECRANS.depenses.indexOf('class="liste"') >= 0 && ECRANS.patrimoine.indexOf('class="bilan"') >= 0);
/* une rubrique ouverte le reste après un enregistrement */
Carnet.etat().ouverts["depenses.lignes"] = true;
vrai("une rubrique dépliée le reste quand l'écran se redessine",
  /data-section="depenses\.lignes" open/.test(Vues.depenses()));
vrai("et les autres restent fermées", !/data-section="depenses\.charges" open/.test(Vues.depenses()));
Carnet.etat().ouverts = {};

/* ============================================================ l'iPhone ne zoome pas
   Safari sur iPhone agrandit la page dès qu'on touche un champ dont le texte
   fait moins de 16 px, et la laisse décalée. On relit la feuille de style :
   toute règle qui vise un champ de saisie et fixe une taille doit être à 16
   ou plus, et aucune ne doit se contenter d'hériter (« font:inherit »). */
var regles = lire("style.css").replace(/\/\*[\s\S]*?\*\//g, "").split("}").map(function(r){
  var i = r.indexOf("{"); return i < 0 ? null : {cible:r.slice(0, i).trim(), corps:r.slice(i + 1)}; }).filter(Boolean);
var champs = regles.filter(function(r){ return /(^|[\s,.>])(input|select|textarea)\b|\.secret\b/.test(r.cible); });
vrai("la feuille de style a bien des règles pour les champs de saisie", champs.length >= 3);
verifier("aucun champ de saisie sous 16 px", [],
  champs.filter(function(r){ var m = /font-size:\s*([\d.]+)px/.exec(r.corps); return m && Number(m[1]) < 16; })
        .map(function(r){ return r.cible; }));
verifier("aucun champ n'hérite sa taille de son étiquette", [],
  champs.filter(function(r){ return /font:\s*inherit/.test(r.corps); }).map(function(r){ return r.cible; }));
vrai("les champs ordinaires fixent explicitement 16 px",
  champs.some(function(r){ return /\.champ input/.test(r.cible) && /font-size:\s*16px/.test(r.corps); }));

/* La version affichée et celle du cache hors ligne doivent être la même :
   sinon une mise à jour arrive sans que l'ancien cache soit vidé. */
verifier("app.js et sw.js portent le même numéro de version",
  Carnet.VERSION, (/var VERSION = "([^"]+)"/.exec(lire("sw.js")) || [])[1]);
vrai("tous les fichiers de l'app sont dans le cache hors ligne",
  ["calculs.js","app.js","vues.js","formulaires.js","synchro.js","verrou.js","style.css","index.html"]
    .every(function(f){ return lire("sw.js").indexOf('"' + f + '"') >= 0; }));
vrai("le cache hors ligne ne touche pas aux échanges avec le dépôt",
  lire("sw.js").indexOf("origin !== self.location.origin") >= 0);
vrai("index.html charge tous les fichiers de l'app",
  ["calculs.js","app.js","vues.js","formulaires.js","synchro.js","verrou.js"]
    .every(function(f){ return lire("index.html").indexOf('src="' + f + '"') >= 0; }));

/* Sur un carnet neuf et vide, le même fichier se charge sans phrase de passe,
   et ce qu'on avait déjà dit avoir en caisse est conservé. */
Carnet.remplacerDonnees(Carnet.donneesInitiales(AUJ, null));
var vide = Carnet.donnees();
vide.comptes[0].soldeInitial = 25000;
verifier("le carnet sans fichier n'a aucune ligne qui revient", 0, vide.recurrents.length);
vrai("l'accueil propose alors de charger un fichier de départ",
  Vues.accueil().indexOf("fichier de départ") >= 0);
Fo.importer();
saisir({texte:JSON.stringify(ESSAI), phrase:""});
Fo.lancerImport();
var charge = Carnet.donnees();
verifier("le fichier de départ charge ses huit lignes", 8, charge.recurrents.length);
verifier("et ses deux enveloppes", 2, charge.enveloppes.length);
verifier("la caisse déjà déclarée est conservée", 25000, C.liquidites(charge));
verifier("les dates « auto » sont calculées au chargement", "2026-10-15",
  charge.recurrents.filter(function(c){ return c.libelle === "Internet"; })[0].prochaine);

/* ============================================= le bouton + suit l'écran
   Il propose ce qu'on ajoute dans l'onglet où l'on est, pas la même liste
   partout. L'accueil garde la saisie générale. */
function menuDe(vue){ Carnet.aller(vue); Fo.plus(); var h = noeud("couche")._html; Fo.fermer(); return h; }
var mDep = menuDe("depenses");
vrai("sur Dépenses, le + propose une dépense, une entrée, une charge fixe, un revenu fixe",
  ["Nouvelle dépense","Nouvelle entrée d&#39;argent","Nouvelle charge fixe","Nouveau revenu fixe"]
    .every(function(t){ return mDep.indexOf(t) >= 0 || mDep.indexOf(t.replace("&#39;","'")) >= 0; }));
vrai("et rien d'autre : ni tiers, ni affaire, ni la question « Quoi ? »",
  mDep.indexOf("Nouveau tiers") < 0 && mDep.indexOf("Affaire à suivre") < 0 && mDep.indexOf('id="f-nature"') < 0);
vrai("sur Tiers, il propose un tiers et les prêts",
  (function(h){ return h.indexOf("Nouveau tiers") >= 0 && h.indexOf("Je prête") >= 0 && h.indexOf("Nouvelle dépense") < 0; })(menuDe("tiers")));
vrai("sur Business, un business, une commission espérée, une mise, une part",
  (function(h){ return h.indexOf("Ajouter dans Business") >= 0 && h.indexOf("Formulaires.affaire()") >= 0
    && h.indexOf("Commission espérée") >= 0 && h.indexOf("Mise dans une affaire") >= 0 && h.indexOf("Nouveau tiers") < 0; })(menuDe("affaires")));
vrai("sur Patrimoine, un bien, un crédit, un compte",
  (function(h){ return h.indexOf("Nouveau terrain") >= 0 && h.indexOf("Nouveau véhicule") >= 0 && h.indexOf("Autre bien") >= 0
    && h.indexOf("Nouveau crédit") >= 0 && h.indexOf("Nouveau compte") >= 0; })(menuDe("patrimoine")));
vrai("sur l'accueil, la saisie générale, prête pour la dépense du jour",
  (function(h){ return h.indexOf('id="f-nature"') >= 0 && h.indexOf('id="f-montant"') >= 0; })(menuDe("accueil")));
Carnet.ouvrirTiers(charge.tiers[0].id);
Fo.plus();
vrai("sur la fiche d'un tiers, les prêts portent déjà son nom",
  noeud("couche")._html.indexOf("Formulaires.nouveau(" + charge.tiers[0].id + ",'pret',true)") >= 0);
Fo.fermer();

Carnet.aller("depenses");
Fo.nouveau(null, "depense", true);
vrai("la feuille ouverte depuis le menu porte son nom et ne redemande pas « Quoi ? »",
  noeud("couche")._html.indexOf("<h3>Nouvelle dépense</h3>") >= 0 && noeud("couche")._html.indexOf('id="f-nature"') < 0);
saisir({montant:"4 000", libelle:"Taxi"});
var avantMenu = charge.mouvements.length;
Fo.enregistrerNouveau("depense");
verifier("et elle enregistre bien la dépense", [avantMenu + 1, -4000],
  [charge.mouvements.length, charge.mouvements[charge.mouvements.length - 1].montant]);

/* ================================================ ce qui est réglé descend */
function rangDans(html, rubrique, a, b){
  var p0 = html.indexOf('data-section="' + rubrique + '"');
  return html.indexOf(a, p0) < html.indexOf(b, p0);
}
var loyerFile = charge.recurrents.filter(function(c){ return c.libelle === "Loyer"; })[0];
vrai("avant d'être réglé, le loyer passe devant la scolarité (il tombe plus tôt)",
  rangDans(Vues.depenses(), "depenses.charges", "Loyer", "Scolarité"));
Carnet.reglerRecurrent(loyerFile.id, loyerFile.montant, "2026-10-05", charge.comptes[0].id, false);
vrai("une fois réglé, il descend en bas de la liste des charges",
  rangDans(Vues.depenses(), "depenses.charges", "Scolarité", "Loyer"));
vrai("la rubrique dit combien il en reste à payer", /depenses\.charges[\s\S]{0,200}à payer/.test(Vues.depenses()));

/* =========================================================== bilan du mois */
var bilanFin = C.bilanDuMois(charge, AUJ), vueDep = Vues.depenses();
var depMois = -charge.mouvements.filter(function(m){ return m.nature === "depense" && m.date.slice(0,7) === AUJ.slice(0,7); })
  .reduce(function(s2, m){ return s2 + m.montant; }, 0);
verifier("le bilan retombe sur « Sorti ce mois »", depMois, bilanFin.sorti);
verifier("le loyer réglé est en « fait » des charges, le taxi dans le reste des sorties", [80000, 4000],
  [bilanFin.charges.fait, bilanFin.enveloppes.fait + bilanFin.horsPrevision]);
verifier("charges prévues en octobre : loyer, électricité, internet", 110000, bilanFin.charges.prevu);
vrai("l'écran Dépenses montre le bilan, prévu contre fait",
  vueDep.indexOf("Bilan du mois") >= 0 && vueDep.indexOf("<th>Prévu</th><th>Fait</th>") >= 0);
vrai("les phrases grises d'avant ont disparu", vueDep.indexOf("Train de vie :") < 0 && vueDep.indexOf("Imprévu ce mois") < 0);
vrai("le bilan dit en clair si le mois est couvert", /class="verdict (plus|moins)"/.test(vueDep));
/* Le tableau du bilan a failli s'appeler comme le bloc du Patrimoine : ses
   règles écrasaient les siennes. Un nom de classe n'a qu'un seul propriétaire. */
vrai("le tableau du bilan a son propre nom de classe, distinct du bloc du Patrimoine",
  vueDep.indexOf('<table class="prevu-fait">') >= 0 && Vues.patrimoine().indexOf('class="prevu-fait"') < 0
  && !/\.bilan (th|td|thead)/.test(lire("style.css")));
verifier("index.html : le + ouvre le menu de l'écran", true, lire("index.html").indexOf('onclick="Formulaires.plus()"') >= 0);

/* ================================================ l'onglet Tiers : deux listes
   Qui me doit, à qui je dois. Les bénéficiaires d'aides n'y figurent pas. */
var vueT = Vues.tiers();
vrai("sans prêt ni dette, l'onglet Tiers ne liste personne",
  vueT.indexOf("Un parent") < 0 && vueT.indexOf("Un enfant") < 0);
vrai("il dit les deux choses qu'on vient y chercher", vueT.indexOf("On me doit") >= 0 && vueT.indexOf("Je dois") > vueT.indexOf("On me doit"));
vrai("et le dit quand il n'y a rien", vueT.indexOf("Personne ne te doit") >= 0 && vueT.indexOf("Tu ne dois d'argent à personne") >= 0);
Fo.personnes();
vrai("les personnes sans argent en jeu restent accessibles, hors de l'onglet",
  noeud("couche")._html.indexOf("Un parent") >= 0 && noeud("couche")._html.indexOf("Un enfant") >= 0);
Fo.fermer();
var parent = charge.tiers.filter(function(t){ return t.nom === "Un parent"; })[0];
var enfant = charge.tiers.filter(function(t){ return t.nom === "Un enfant"; })[0];
Fo.nouveau(parent.id, "pret", true);
saisir({montant:"30 000", libelle:"Dépannage", nb:"1", pas:"1", echeance:"2026-10-20"});
Fo.enregistrerNouveau("pret");
Fo.nouveau(enfant.id, "avance_recue", true);
saisir({montant:"12 000", libelle:"Avance", nb:"1", pas:"1", echeance:"2026-10-09"});
Fo.enregistrerNouveau("avance_recue");
vueT = Vues.tiers();
vrai("un prêt fait apparaître la personne sous « On me doit », avec le montant et l'échéance",
  (function(){ var a1 = vueT.indexOf("On me doit"), b1 = vueT.indexOf("Je dois"), p1 = vueT.indexOf("Un parent");
    return p1 > a1 && p1 < b1 && vueT.slice(a1, b1).indexOf("+" + C.F(30000)) > 0 && vueT.slice(a1, b1).indexOf("échéance : dans 7 j") > 0; })());
vrai("une avance reçue la met sous « Je dois », et le retard se voit",
  (function(){ var b1 = vueT.indexOf("Je dois"), bloc = vueT.slice(b1);
    return bloc.indexOf("Un enfant") > 0 && bloc.indexOf("−" + C.F(12000)) > 0 && bloc.indexOf("en retard de 4 j") > 0 && bloc.indexOf('class="bande retard"') > 0; })());
vrai("les totaux sont en tête de chaque liste",
  vueT.indexOf('<span class="total plus">' + C.F(30000) + '</span>') > 0 && vueT.indexOf('<span class="total moins">' + C.F(12000) + '</span>') > 0);

/* ======================================================== Business
   Les cinq formes de business réelles, jouées avec des noms fictifs :
   montant annoncé pas encore validé avec une étape ; montant validé avec une
   première tranche datée ; une partie déjà reçue avant le carnet ; un dû
   attendu à une date ; le reste d'une vente. */
vrai("l'onglet s'appelle Business", lire("app.js").indexOf('["affaires","◆","Business"]') > 0
  && Vues.accueil().indexOf('<span class="t-nom">Business</span>') > 0);
var liqB = C.liquidites(charge), netteB = C.patrimoine(charge).nette, engsB = charge.engagements.length;
function parNom(n){ return charge.tiers.filter(function(t){ return t.nom === n; })[0]; }
function parObjet(o){ return charge.engagements.filter(function(e){ return e.objet === o; })[0]; }
Carnet.aller("affaires");
Fo.affaire();
verifier("personne n'est présélectionné : on choisit avec qui", "", noeud("f-tiers").value);
saisir({objet:"Appli usine", montant:"6 000 000"});
Fo.creerAffaire();
vrai("un business sans personne ni société est refusé", erreurAffichee().indexOf("avec qui") >= 0);
saisir({"tiers-nouveau":"Une usine", genre:"Société", montant:""});
Fo.creerAffaire();
vrai("un business sans montant est refusé", erreurAffichee().indexOf("montant") >= 0);
verifier("un refus ne crée ni business ni tiers", [engsB, undefined], [charge.engagements.length, parNom("Une usine")]);

/* 1 — montant annoncé, pas encore validé, une étape cette semaine */
saisir({montant:"6 000 000", valide:"non", etape:"Livrer la bêta", etapedate:"2026-10-16"});
Fo.creerAffaire();
var usine = parObjet("Appli usine");
verifier("le business annoncé s'enregistre, avec sa société", [false, "Société", 6000000],
  [usine.valide, parNom("Une usine").genre, C.totalBusiness(usine)]);
verifier("il ne change ni la caisse, ni ce qu'on me doit, ni la position nette", [liqB, 0, netteB],
  [C.liquidites(charge), C.soldeTiers(charge, usine.tiers), C.patrimoine(charge).nette]);

/* 2 — validé, à plusieurs, première tranche vendredi, le reste sans date */
Fo.affaire();
saisir({objet:"Chantier", "tiers-nouveau":"Un associé", avec:"un second", montant:"1 000 000", premier:"500 000", echeance:"2026-10-16"});
Fo.creerAffaire();
var chantier = parObjet("Chantier");
verifier("une première tranche datée, le reste à dater", [["2026-10-16",500000],[null,500000]],
  chantier.tranches.map(function(t){ return [t.date, t.montant]; }));
verifier("les autres personnes de l'affaire sont gardées", "un second", chantier.avecAussi);

/* 3 — une partie déjà reçue avant le carnet */
Fo.affaire();
saisir({objet:"Appli coop", "tiers-nouveau":"Une coopérative", genre:"Société", montant:"2 000 000", recu:"700 000", recunote:"200 000 mobile money, 500 000 chèque"});
Fo.creerAffaire();
var coop = parObjet("Appli coop");
verifier("ce qui est déjà reçu ne rentre pas une seconde fois en caisse", liqB, C.liquidites(charge));
verifier("il reste une tranche du solde, à dater", [[null,1300000]], coop.tranches.map(function(t){ return [t.date, t.montant]; }));
verifier("total, reçu, reste", [2000000, 700000, 1300000], [C.totalBusiness(coop), C.recuBusiness(coop), C.resteEngagement(coop)]);
Fo.affaire();
saisir({objet:"Trop", "tiers-nouveau":"X", montant:"100", recu:"200"});
Fo.creerAffaire();
vrai("recevoir plus que le total est refusé", erreurAffichee().indexOf("dépasse") >= 0);
Fo.fermer();

/* 4 et 5 — la même personne, deux business */
Fo.affaire();
saisir({objet:"Affaire à venir", "tiers-nouveau":"Un partenaire", montant:"300 000", echeance:"2026-11-30"});
Fo.creerAffaire();
Fo.affaire();
saisir({objet:"Vente d'un ordinateur", tiers:String(parNom("Un partenaire").id), montant:"400 000", recu:"300 000"});
Fo.creerAffaire();
verifier("deux business avec la même personne : elle me doit la somme des deux restes", 400000,
  C.soldeTiers(charge, parNom("Un partenaire").id));
verifier("et elle n'existe qu'une fois", 1, charge.tiers.filter(function(t){ return t.nom === "Un partenaire"; }).length);

/* l'onglet */
var bizP = C.business(charge), vueB = Vues.affaires();
verifier("à encaisser, annoncé, déjà encaissé", [1000000 + 1300000 + 300000 + 100000, 6000000, 700000 + 300000],
  [bizP.aEncaisser, bizP.annonce, bizP.encaisse]);
verifier("la position nette ne compte que le validé", netteB + 2700000, C.patrimoine(charge).nette);
function replie(html, id){
  var m = new RegExp('data-section="' + id.replace(/\./g, "\\.") + '"[^>]*>[\\s\\S]*?<div class="r-corps">([\\s\\S]*?)</div></details>').exec(html);
  return m ? m[1] : "";
}
verifier("à l'ouverture, trois chiffres et aucun business affiché", [3, 0, 0],
  [compter(vueB, /class="rang"/g), compter(vueB, /Formulaires\.business\(/g), compter(vueB, /class="bloc"/g)]);
vrai("les trois chiffres s'appellent comme il les appelle",
  ["Opportunités validées", "Opportunités", "Déjà encaissé"].every(function(t){ return texteVisible(vueB).indexOf(t) >= 0; })
  && vueB.indexOf("Annoncé") < 0 && vueB.indexOf("À encaisser") < 0);
var validees = replie(vueB, "affaires.validees"), ouvertes = replie(vueB, "affaires.opportunites-ouvertes"), encaissees = replie(vueB, "affaires.encaisse");
verifier("toucher « Opportunités validées » montre les quatre business validés", 4, (validees.match(/Formulaires\.business\(/g) || []).length);
vrai("toucher « Opportunités » montre celui qui ne l'est pas encore",
  (ouvertes.match(/Formulaires\.business\(/g) || []).length === 1 && ouvertes.indexOf("Appli usine") > 0 && validees.indexOf("Appli usine") < 0);
vrai("toucher « Déjà encaissé » montre d'où vient l'argent reçu",
  (encaissees.match(/Formulaires\.business\(/g) || []).length === 2 && encaissees.indexOf("Appli coop") > 0
  && encaissees.indexOf(C.F(700000)) > 0 && encaissees.indexOf("sur " + C.F(2000000)) > 0);
vrai("le plus proche d'abord : la tranche de vendredi avant celle de fin novembre, ce qui n'a pas de date après",
  validees.indexOf("Chantier") < validees.indexOf("Affaire à venir") && validees.indexOf("Affaire à venir") < validees.indexOf("Appli coop"));
vrai("chaque ligne dit avec qui et ce qui vient",
  validees.indexOf("Un associé et un second · " + C.F(500000) + " attendus · dans 3 j") > 0
  && ouvertes.indexOf("Une usine · Livrer la bêta · dans 3 j") > 0 && validees.indexOf("Une coopérative · date à fixer") > 0);
vrai("les rubriques vides (commissions, participations) ne prennent pas de place",
  vueB.indexOf("Commissions espérées") < 0 && vueB.indexOf("Participations") < 0);
vrai("l'onglet Tiers range les business validés dans « On me doit », pas l'annoncé",
  (function(h){ var bloc = h.slice(h.indexOf("On me doit"), h.indexOf("Je dois"));
    return bloc.indexOf("Une coopérative") > 0 && bloc.indexOf("Un associé") > 0 && bloc.indexOf("Une usine") < 0; })(Vues.tiers()));

/* l'accueil */
var sugB = C.suggestions(charge, AUJ);
vrai("l'accueil rappelle l'étape et la tranche de la semaine",
  sugB.some(function(x){ return x.genre === "etape" && x.detail.indexOf("dans 3 j") >= 0 && x.verbe === "Avancer"; })
  && sugB.some(function(x){ return x.verbe === "Encaisser" && x.montant === 500000; }));
verifier("et propose de dater le reste en une seule ligne, après ce qui tombe cette semaine", [1, "à dater, comme 2 autres business", true],
  (function(l){ var dt = l.filter(function(x){ return x.ref.type === "echeancier"; });
    return [dt.length, dt[0].detail, l.indexOf(dt[0]) > l.indexOf(l.filter(function(x){ return x.verbe === "Encaisser"; })[0])]; })(sugB));
vrai("le business annoncé ne range pas sa société parmi les « soldés »",
  !C.situationTiers(charge).soldes.some(function(o){ return o.t.nom === "Une usine"; }));
vrai("le dû n'est pas compté comme une entrée du mois",
  Vues.depenses().indexOf("Dû — ") < 0 && C.bilanDuMois(charge, AUJ).autresEntrees === 12000);

/* la fiche d'un business */
Fo.business(coop.id);
vrai("la fiche dit d'où vient ce qui est déjà reçu",
  (function(h){ return h.indexOf("reçus avant le carnet : 200 000 mobile money, 500 000 chèque") > 0
    && h.indexOf("Encaisser") > 0 && h.indexOf("Modifier") > 0; })(noeud("couche")._html));
vrai("la fiche permet de corriger le nom de la personne, sans passer par un autre onglet",
  noeud("couche")._html.indexOf("Formulaires.tiers(" + coop.tiers + ")") > 0 && noeud("couche")._html.indexOf("Corriger le nom de Une coopérative") > 0);
Fo.tiers(coop.tiers);
saisir({nom:"Une coopérative agricole"});
Fo.majTiers(coop.tiers);
vrai("et le nom corrigé se retrouve partout : Business et Tiers",
  replie(Vues.affaires(), "affaires.validees").indexOf("Une coopérative agricole") > 0 && Vues.tiers().indexOf("Une coopérative agricole") > 0
  && charge.tiers.filter(function(t){ return t.nom.indexOf("Une coopérative") === 0; }).length === 1);
Fo.tiers(coop.tiers); saisir({nom:"Une coopérative"}); Fo.majTiers(coop.tiers);
Fo.business(usine.id);
vrai("celle d'un business annoncé le dit, et propose de le valider",
  noeud("couche")._html.indexOf("pas encore validé") > 0 && noeud("couche")._html.indexOf("Formulaires.validerBusiness(" + usine.id + ")") > 0);
Fo.validerBusiness(usine.id);
verifier("une fois validé, on me le doit", [true, 6000000, netteB + 8700000],
  [usine.valide, C.soldeTiers(charge, usine.tiers), C.patrimoine(charge).nette]);
Fo.engagement(usine.id);
saisir({valide:"non"});
Fo.majEngagement(usine.id);
verifier("on peut revenir en arrière : annoncé de nouveau, plus rien n'est dû", [false, 0], [usine.valide, C.soldeTiers(charge, usine.tiers)]);

/* on apprend les dates et les vrais montants */
Fo.engagement(chantier.id);
vrai("la feuille est celle d'un business, et permet d'ajouter une tranche",
  noeud("couche")._html.indexOf("Modifier le business") > 0 && noeud("couche")._html.indexOf("Ajouter une tranche") > 0);
saisir({d1:"2026-11-20", m1:"300 000", d2:"", m2:"200 000"});
Fo.majEngagement(chantier.id);
verifier("la seconde tranche est datée et coupée en deux", [["2026-10-16",500000],["2026-11-20",300000],[null,200000]],
  chantier.tranches.map(function(t){ return [t.date, t.montant]; }));
verifier("le dû suit l'échéancier", 1000000, C.soldeTiers(charge, chantier.tiers));

/* la première tranche tombe, par mobile money */
Fo.agir("engagement", chantier.id, 0);
saisir({montant:"500 000", date:AUJ, compte:"2"});
Fo.reglerEngagement(chantier.id);
verifier("la tranche encaissée entre sur le compte choisi et réduit le dû", [liqB + 500000, 500000, 500000],
  [C.liquidites(charge), C.soldeTiers(charge, chantier.tiers), C.resteEngagement(chantier)]);
verifier("elle est rangée avec le business, pas avec les prêts", ["Affaires", 2],
  (function(m){ return [m.cat, m.compte]; })(charge.mouvements.filter(function(m){ return m.engagement === chantier.id && m.nature === "remboursement_recu"; })[0]));
verifier("rien ne cloche entre l'échéancier et les mouvements", 0, C.incoherences(charge).length);

/* un business annoncé qui paie quand même un acompte : personne ne devient créancier */
Fo.agir("engagement", usine.id, 0);
saisir({montant:"1 000 000", date:AUJ});
Fo.reglerEngagement(usine.id);
verifier("un acompte sur un business pas encore validé ne crée aucune dette à l'envers", 0, C.soldeTiers(charge, usine.tiers));

/* un business abandonné : ce qui a été encaissé reste, le reste n'est plus dû */
Fo.supprimerAffaire(chantier.id);
verifier("supprimer le business efface ce qui restait dû, pas ce qui a été encaissé", [0, liqB + 1500000, undefined],
  [C.soldeTiers(charge, chantier.tiers), C.liquidites(charge), parObjet("Chantier")]);

/* ====================================================== Patrimoine
   L'argent d'un côté, les biens de l'autre. Un terrain se décrit par son
   emplacement et son document, un véhicule par sa marque et sa plaque. */
var pAvant = C.patrimoine(charge);
Fo.bien(null, "terrain");
vrai("la feuille d'un terrain demande où il est et quel document",
  (function(h){ return h.indexOf("Situation géographique") > 0 && h.indexOf("Type de document") > 0
    && h.indexOf("Titre foncier") > 0 && h.indexOf("Plaque") < 0; })(noeud("couche")._html));
saisir({lieu:"", montant:"8 000 000"});
Fo.majBien(null);
vrai("un terrain sans emplacement est refusé", erreurAffichee().indexOf("où il se trouve") >= 0);
saisir({lieu:"Une ville, lot 12", document:"Attestation villageoise", superficie:"600 m²"});
Fo.majBien(null);
Fo.bien(null, "vehicule");
vrai("celle d'un véhicule demande la marque et la plaque",
  (function(h){ return h.indexOf("Marque et modèle") > 0 && h.indexOf("Plaque d'immatriculation") > 0
    && h.indexOf("Situation géographique") < 0; })(noeud("couche")._html));
saisir({marque:"Une berline", plaque:"1234 ab 01", montant:"3 500 000"});
Fo.majBien(null);
Fo.bien(null, "autre");
saisir({nom:"Du matériel", montant:"500 000"});
Fo.majBien(null);
verifier("trois biens, chacun avec sa nature et ses renseignements",
  [["terrain","Terrain — Une ville, lot 12","Attestation villageoise · 600 m²"],["vehicule","Une berline","plaque 1234 AB 01"],["autre","Du matériel","valeur estimée"]],
  charge.biens.map(function(b){ return [b.type, C.nomBien(b), C.detailBien(b)]; }));
var pApres = C.patrimoine(charge);
verifier("les biens montent la position nette, pas l'argent", [12000000, 0, 12000000],
  [pApres.biens - pAvant.biens, pApres.argent - pAvant.argent, pApres.nette - pAvant.nette]);
verifier("argent + biens = tout ce que j'ai", pApres.actif, pApres.argent + pApres.biens);
var vueP = Vues.patrimoine();
verifier("à l'ouverture : l'argent, les biens, ce que je dois — et rien de déplié", [3, 0],
  [compter(vueP, /class="rang"/g), compter(vueP, /class="(liste|bilan)"/g)]);
vrai("l'argent et les biens sont deux lignes distinctes, chacune avec son total",
  texteVisible(vueP).indexOf("Argent") > 0 && texteVisible(vueP).indexOf("Biens") > texteVisible(vueP).indexOf("Argent")
  && premiereVue(vueP).indexOf(">" + C.F(pApres.argent) + "</b>") > 0 && premiereVue(vueP).indexOf(">" + C.F(pApres.biens) + "</b>") > 0);
var detailB = replie(vueP, "patrimoine.biens");
vrai("le détail des biens les range par nature, avec leurs renseignements",
  detailB.indexOf("Terrains") > 0 && detailB.indexOf("Véhicules") > detailB.indexOf("Terrains")
  && detailB.indexOf("Attestation villageoise · 600 m²") > 0 && detailB.indexOf("plaque 1234 AB 01") > 0);
vrai("le détail de l'argent ne contient aucun bien",
  replie(vueP, "patrimoine.argent").indexOf("Sur mes comptes") > 0 && replie(vueP, "patrimoine.argent").indexOf("Terrain") < 0);
/* modifier : changer de nature garde la valeur, et oublie les anciens renseignements */
var materiel = charge.biens[2];
Fo.bien(materiel.id);
verifier("la feuille d'un bien s'ouvre sur sa nature et sa valeur", ["autre", "500000"], [noeud("f-type").value, noeud("f-montant").value]);
Fo.bien(materiel.id, "vehicule", true);
verifier("changer de nature garde la valeur tapée", "500000", noeud("f-montant").value);
saisir({marque:"Une moto", plaque:"77 cd 02"});
Fo.majBien(materiel.id);
verifier("le bien change de nature sans se dédoubler", [3, "vehicule", "Une moto", "plaque 77 CD 02"],
  [charge.biens.length, materiel.type, C.nomBien(materiel), C.detailBien(materiel)]);
/* un bien d'avant, sans nature, reste lisible */
verifier("un bien enregistré avant les natures s'affiche tel quel", ["autre", "Vieux terrain", "valeur estimée"],
  (function(b){ return [C.typeBien(b), C.nomBien(b), C.detailBien(b)]; })({id:1, nom:"Vieux terrain", montant:1000}));

/* ================================================ le code de verrou fait attendre */
verifier("quatre erreurs : on peut encore essayer", 0, Ve.attente(4, 1000, 1000));
verifier("cinq erreurs : trente secondes", 30000, Ve.attente(5, 1000, 1000));
verifier("le temps déjà attendu compte", 10000, Ve.attente(5, 1000, 21000));
verifier("une fois le délai passé, on peut réessayer", 0, Ve.attente(5, 1000, 31000));
verifier("chaque erreur de plus double l'attente", [60000, 120000], [Ve.attente(6, 0, 0), Ve.attente(7, 0, 0)]);
verifier("sans jamais dépasser un quart d'heure", 900000, Ve.attente(40, 0, 0));
Carnet.donnees().reglages.verrou = "une-empreinte";
Carnet.donnees().reglages.verrouEssais = {n:6, quand:Date.now()};
Ve.exiger();
noeud("f-verrou").value = "1234";
Ve.essayerCode();
vrai("pendant l'attente, le code n'est même pas examiné",
  noeud("msg-verrou").textContent.indexOf("Trop d'erreurs") === 0 && noeud("verrou").hidden === false && noeud("f-verrou").value === "");
Ve.ouvrir();
verifier("le propriétaire entré, les erreurs sont oubliées", null, Carnet.donnees().reglages.verrouEssais);
Carnet.donnees().reglages.verrou = null;

/* ============================================== une suppression se reprend */
function toastAffiche(){ return noeud("zone-toast")._html; }
var avantSup = Carnet.donnees(), cible = avantSup.mouvements[avantSup.mouvements.length - 1], nbMv = avantSup.mouvements.length;
Fo.supprimerMouvement(cible.id);
verifier("la ligne est supprimée tout de suite", nbMv - 1, Carnet.donnees().mouvements.length);
vrai("et un bouton propose de la reprendre", toastAffiche().indexOf("Ligne supprimée") > 0 && toastAffiche().indexOf('onclick="Carnet.annuler()"') > 0);
Carnet.toast("Noté");
vrai("un simple « Noté » ne fait pas disparaître le bouton", toastAffiche().indexOf("Carnet.annuler()") > 0);
Carnet.annuler();
verifier("« Annuler » remet la ligne, la même", [nbMv, true],
  [Carnet.donnees().mouvements.length, Carnet.donnees().mouvements.some(function(m){ return m.id === cible.id && m.montant === cible.montant; })]);
verifier("et retire la trace de suppression : l'autre appareil ne l'effacera pas", undefined,
  Carnet.donnees().supprimes["mouvements:" + cible.id]);
vrai("la ligne rétablie est datée d'après sa suppression, pour gagner à la fusion",
  Carnet.donnees().mouvements.filter(function(m){ return m.id === cible.id; })[0].maj >= (cible.maj || 0));
verifier("le bouton a disparu", -1, toastAffiche().indexOf("Carnet.annuler()"));
/* si le carnet a changé entre-temps, on ne restaure pas l'ancienne copie */
Fo.supprimerMouvement(cible.id);
Carnet.ajouterMouvement({date:AUJ, libelle:"Entre-temps", montant:-100, compte:1, nature:"depense", cat:"Divers"});
Carnet.enregistrer(true);
Carnet.annuler();
verifier("une saisie faite entre-temps bloque l'annulation, et rien n'est perdu", [nbMv, true],
  [Carnet.donnees().mouvements.length, Carnet.donnees().mouvements.some(function(m){ return m.libelle === "Entre-temps"; })]);
/* une suppression refusée ne propose rien */
noeud("zone-toast").innerHTML = "";
var debiteur = Carnet.donnees().tiers.filter(function(t){ return C.soldeTiers(Carnet.donnees(), t.id) !== 0; })[0];
Fo.tiers(debiteur.id);
Fo.supprimerTiers(debiteur.id);
vrai("une suppression refusée ne propose aucune annulation",
  erreurAffichee().indexOf("solde") >= 0 && toastAffiche().indexOf("Carnet.annuler()") < 0);
Fo.fermer();
/* toutes les suppressions passent par là */
vrai("chaque suppression de l'app est annulable",
  ["supprimerMouvement","supprimerTiers","supprimerRecurrent","supprimerEnveloppe","supprimerSimple","supprimerAffaire"]
    .every(function(n){ return new RegExp(n + ':annulable\\(').test(lire("formulaires.js")); }));

/* ================================================= un fichier piégé est refusé */
var piege = {recurrents:[{id:"1);window.PIRATE=1;//", libelle:"Loyer", sens:"sortie", montant:1000, cat:"Maison",
  rythme:{type:"mensuel", jour:5}, prochaine:"auto"}], tiers:[{id:"9);PIRATE2()//", nom:"X"}]};
var avantPiege = JSON.stringify(Carnet.donnees());
Carnet.remplacerDonnees(JSON.parse(JSON.stringify(piege))).catch(function(){});
verifier("un carnet piégé n'entre pas, même en passant derrière les formulaires", avantPiege, JSON.stringify(Carnet.donnees()));
Carnet.appliquer(JSON.parse(JSON.stringify(piege)));
verifier("ni par la synchronisation", avantPiege, JSON.stringify(Carnet.donnees()));
Carnet.remplacerDonnees(Carnet.donneesInitiales(AUJ, null));
Fo.importer();
saisir({texte:JSON.stringify(piege), phrase:""});
Fo.lancerImport();
vrai("le formulaire d'import le dit clairement", erreurAffichee().indexOf("pas sûr à charger") >= 0 && erreurAffichee().indexOf("identifiant invalide") > 0);
verifier("et le carnet reste vide", 0, Carnet.donnees().recurrents.length);
vrai("aucun identifiant piégé n'arrive dans un bouton",
  (Vues.depenses() + Vues.accueil() + Vues.tiers()).indexOf("PIRATE") < 0);
Fo.fermer();
saisir({texte:JSON.stringify(ESSAI), phrase:""}); Fo.importer(); saisir({texte:JSON.stringify(ESSAI), phrase:""});
Fo.lancerImport();
verifier("un fichier de départ sain se charge toujours", 8, Carnet.donnees().recurrents.length);

/* ====================================================== ce que la page autorise */
var politique = (/Content-Security-Policy" content="([^"]+)"/.exec(lire("index.html")) || [])[1] || "";
vrai("la page déclare à qui elle a le droit de parler", politique.indexOf("default-src 'self'") === 0);
vrai("seulement à elle-même et à GitHub", /connect-src 'self' https:\/\/api\.github\.com(;|$)/.test(politique));
vrai("aucun formulaire ni objet vers l'extérieur", politique.indexOf("form-action 'none'") > 0 && politique.indexOf("object-src 'none'") > 0);
vrai("la synchronisation ne parle à aucun autre site que celui autorisé",
  (lire("synchro.js").match(/https?:\/\/[a-z0-9.-]+/g) || []).every(function(u){ return u === "https://api.github.com" || u === "https://github.com"; }));
verifier("les sauvegardes sont dérivées avec 600 000 tours", true, /var ITERATIONS = 600000;/.test(lire("formulaires.js")));
vrai("et une ancienne sauvegarde se relit avec son propre nombre de tours", lire("formulaires.js").indexOf("iterations:p.iterations || ITERATIONS") > 0);

var sortie = "\n" + reussis + " vérifications passées";
if (echecs.length) sortie += ", " + echecs.length + " ÉCHEC(S) :\n\n  ✗ " + echecs.join("\n  ✗ ") + "\n";
else sortie += ", aucun échec.\n";
sortie;
