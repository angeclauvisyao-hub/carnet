/* Tests de la synchronisation entre deux appareils, sans réseau.

       osascript -l JavaScript tests/synchro.js      (depuis la racine)

   Le réseau et le chiffrement sont vérifiés dans un vrai navigateur. Ici on
   tient ce qui ne doit jamais arriver : qu'une saisie disparaisse, qu'une
   fiche supprimée revienne, que les deux appareils ne tombent pas d'accord,
   ou que le code de verrou d'un téléphone parte sur l'autre. */

ObjC.import("Foundation");
var racine = $.NSFileManager.defaultManager.currentDirectoryPath.js + "/";
function lire(n){ return $.NSString.stringWithContentsOfFileEncodingError(racine + n, $.NSUTF8StringEncoding, null).js; }
var C = new Function(lire("calculs.js") + "\nreturn Calculs;")();

var reussis = 0, echecs = [];
function verifier(nom, attendu, obtenu){
  var a = JSON.stringify(attendu), b = JSON.stringify(obtenu);
  if (a === b) reussis++; else echecs.push(nom + "\n      attendu : " + a + "\n      obtenu  : " + b);
}
function vrai(nom, c){ verifier(nom, true, !!c); }
function copie(x){ return JSON.parse(JSON.stringify(x)); }
function ids(liste){ return liste.map(function(x){ return x.id; }); }

function carnetVide(){
  return {version:1, cree:"2026-10-13",
    comptes:[{id:1,nom:"Espèces",type:"especes",soldeInitial:0,depuis:"2026-10-01"}],
    tiers:[], mouvements:[], recurrents:[], enveloppes:[], engagements:[], participations:[],
    opportunites:[], biens:[], credits:[], pointages:[], supprimes:{},
    reglages:{cats:["Maison","Nourriture"], verrou:null, biometrie:null, dernierExport:null}};
}

/* Un appareil : son carnet, la photo du dernier enregistrement, l'époque du
   dépôt qu'il connaît. « noter » joue ce que fait l'app à chaque enregistrement. */
function Appareil(carnet){ this.d = carnet; this.photo = C.photographier(carnet); this.epoque = null; }
Appareil.prototype.noter = function(quand){
  var n = C.marquer(this.photo, this.d, quand); this.photo = C.photographier(this.d); return n; };
/* Le dépôt : une seule case, ce qu'un appareil y a posé en dernier. */
function synchroniser(app, depot){
  var t = C.tour(app.d, app.epoque, depot.donnees, depot.epoque);
  if (t.decision === "choisir") return t.decision;
  app.d = t.carnet; app.photo = C.photographier(app.d);
  if (t.decision === "envoyer") { depot.epoque = depot.epoque || "epoque-1"; }
  app.epoque = depot.epoque;
  if (t.envoyer) { depot.donnees = C.pourEnvoi(app.d); depot.envois = (depot.envois || 0) + 1; }
  return t.decision;
}

/* --------------------------------------------------------- identifiants */
var vus = {}, doublons = 0, pasEntier = 0;
for (var i = 0; i < 5000; i++) { var id = C.nouvelId(); if (vus[id]) doublons++; vus[id] = 1; if (!Number.isSafeInteger(id)) pasEntier++; }
verifier("5 000 identifiants créés d'affilée, aucun doublon", 0, doublons);
verifier("tous des entiers exacts", 0, pasEntier);

/* ------------------------------------------------------------- marquage */
var a0 = new Appareil(carnetVide());
verifier("rien n'a changé, rien n'est marqué", 0, a0.noter(1000));
a0.d.mouvements.push({id:11, date:"2026-10-13", nature:"depense", montant:-5000, cat:"Nourriture", compte:1});
verifier("une fiche créée est marquée", 1, a0.noter(2000));
verifier("avec l'instant de l'enregistrement", 2000, a0.d.mouvements[0].maj);
verifier("réenregistrer sans rien toucher ne la remarque pas", 0, a0.noter(3000));
verifier("sa date n'a pas bougé", 2000, a0.d.mouvements[0].maj);
a0.d.mouvements[0].montant = -6000;
verifier("une fiche modifiée est remarquée", 1, a0.noter(4000));
verifier("à la nouvelle date", 4000, a0.d.mouvements[0].maj);
a0.d.mouvements = [];
verifier("une suppression compte comme un changement", 1, a0.noter(5000));
verifier("et laisse une trace datée", 5000, a0.d.supprimes["mouvements:11"]);
a0.d.reglages.cats.push("Transport");
verifier("changer les catégories est un changement", 1, a0.noter(6000));
verifier("daté lui aussi", 6000, a0.d.reglages.catsMaj);
/* une modification à l'intérieur d'une fiche (une tranche d'échéancier) est vue */
a0.d.engagements.push({id:21, tiers:1, sens:"creance", objet:"Prêt", tranches:[{date:"2026-11-15", montant:1000, etat:"due"}]});
a0.noter(7000);
a0.d.engagements[0].tranches[0].etat = "payee";
verifier("payer une tranche modifie l'engagement", 1, a0.noter(8000));

/* ------------------------------------------- premier lien : qui fait foi */
verifier("dépôt vide : ce carnet devient le contenu", "envoyer", C.decision(carnetVide(), null, null, null));
verifier("carnet vierge devant un dépôt rempli : il le prend tel quel", "adopter",
  C.decision(carnetVide(), null, {mouvements:[{id:1}]}, "e1"));
var rempli = carnetVide(); rempli.mouvements.push({id:1, date:"2026-10-01", nature:"depense", montant:-1});
verifier("deux carnets remplis qui ne se connaissent pas : c'est à lui de choisir", "choisir",
  C.decision(rempli, null, {mouvements:[{id:2}]}, "e1"));
verifier("même époque : on fusionne", "fusionner", C.decision(rempli, "e1", {mouvements:[]}, "e1"));
verifier("époque changée : le dépôt a été remplacé exprès, on le prend", "adopter",
  C.decision(rempli, "e1", {mouvements:[]}, "e2"));
vrai("un carnet avec seulement des charges fixes est encore vierge",
  C.estVierge({recurrents:[{id:1}], mouvements:[]}));

/* ================================= deux appareils, un mois de va-et-vient */
var depot = {donnees:null, epoque:null};
var iphone = new Appareil(carnetVide());
iphone.d.comptes[0].soldeInitial = 250000;            // il a saisi sa caisse sur l'iPhone
iphone.d.reglages.verrou = "code-de-l-iphone";
iphone.d.reglages.biometrie = {id:"cle-face-id-iphone"};
iphone.d.tiers.push({id:101, nom:"Un proche", genre:"Proche"});
iphone.d.mouvements.push({id:201, date:"2026-10-10", tiers:101, nature:"pret", montant:-300000, compte:1});
iphone.noter(10000);

verifier("l'iPhone relie le premier : il envoie", "envoyer", synchroniser(iphone, depot));
vrai("le dépôt ne contient ni son code ni sa clé Face ID",
  depot.donnees.reglages.verrou === undefined && depot.donnees.reglages.biometrie === undefined);

var mac = new Appareil(carnetVide());                  // carnet neuf, comptes à zéro
mac.d.reglages.verrou = "code-du-mac";
verifier("le Mac, vierge, adopte le carnet du dépôt", "adopter", synchroniser(mac, depot));
verifier("il récupère le vrai solde de caisse, pas son zéro", 250000 - 300000, C.liquidites(mac.d));
verifier("et garde son propre code de verrou", "code-du-mac", mac.d.reglages.verrou);
verifier("sans recevoir la clé Face ID de l'iPhone", null, mac.d.reglages.biometrie);
verifier("adopter ne renvoie rien au dépôt", 1, depot.envois);

/* chacun note de son côté, sans se synchroniser */
iphone.d.mouvements.push({id:202, date:"2026-10-14", nature:"depense", montant:-12000, cat:"Nourriture", compte:1});
iphone.noter(20000);
mac.d.mouvements.push({id:301, date:"2026-10-15", tiers:101, nature:"remboursement_recu", montant:100000, compte:1});
mac.d.tiers[0].tel = "07 00 00 00 00";                 // il complète la fiche sur le Mac
mac.noter(21000);

verifier("le Mac synchronise : fusion", "fusionner", synchroniser(mac, depot));
verifier("l'iPhone synchronise : fusion", "fusionner", synchroniser(iphone, depot));
verifier("l'iPhone a reçu le remboursement saisi sur le Mac", [201,202,301], ids(iphone.d.mouvements));
verifier("et le téléphone complété sur le Mac", "07 00 00 00 00", iphone.d.tiers[0].tel);
synchroniser(mac, depot);
verifier("le Mac a reçu la dépense saisie sur l'iPhone", [201,202,301], ids(mac.d.mouvements));
vrai("les deux appareils ont le même carnet", C.memeContenu(iphone.d, mac.d));
verifier("le solde du proche est la somme des mouvements des DEUX appareils", 200000, C.soldeTiers(iphone.d, 101));
verifier("la caisse aussi", 250000 - 300000 - 12000 + 100000, C.liquidites(mac.d));
verifier("chacun a gardé son code", ["code-de-l-iphone","code-du-mac"], [iphone.d.reglages.verrou, mac.d.reglages.verrou]);
verifier("et l'iPhone sa clé Face ID", "cle-face-id-iphone", iphone.d.reglages.biometrie.id);

var envoisAvant = depot.envois;
synchroniser(iphone, depot); synchroniser(mac, depot); synchroniser(iphone, depot);
verifier("resynchroniser sans rien changer n'envoie rien", envoisAvant, depot.envois);

/* la même fiche modifiée des deux côtés : la plus récente gagne */
iphone.d.mouvements[1].montant = -15000; iphone.noter(30000);     // l'iPhone corrige à 15 000
mac.d.mouvements[1].montant = -13500;    mac.noter(31000);        // le Mac, plus tard, à 13 500
synchroniser(iphone, depot); synchroniser(mac, depot); synchroniser(iphone, depot);
verifier("deux corrections de la même ligne : la dernière fait foi", [-13500,-13500],
  [iphone.d.mouvements[1].montant, mac.d.mouvements[1].montant]);
iphone.d.mouvements[1].montant = -14000; iphone.noter(41000);     // cette fois l'iPhone est le dernier
mac.d.mouvements[1].montant = -99;       mac.noter(40000);
synchroniser(mac, depot); synchroniser(iphone, depot); synchroniser(mac, depot);
verifier("quel que soit l'ordre des synchronisations", [-14000,-14000],
  [iphone.d.mouvements[1].montant, mac.d.mouvements[1].montant]);

/* une suppression ne doit pas revenir */
iphone.d.mouvements = iphone.d.mouvements.filter(function(m){ return m.id !== 202; });
iphone.noter(50000);
synchroniser(iphone, depot); synchroniser(mac, depot);
verifier("supprimée sur l'iPhone, la ligne disparaît du Mac", [201,301], ids(mac.d.mouvements));
synchroniser(iphone, depot);
verifier("et ne revient pas sur l'iPhone", [201,301], ids(iphone.d.mouvements));

/* supprimée ici, modifiée là-bas APRÈS : la modification est plus récente, elle gagne */
iphone.d.tiers.push({id:102, nom:"Un associé"}); iphone.noter(60000);
synchroniser(iphone, depot); synchroniser(mac, depot);
iphone.d.tiers = iphone.d.tiers.filter(function(t){ return t.id !== 102; }); iphone.noter(61000);
mac.d.tiers.filter(function(t){ return t.id === 102; })[0].note = "À rappeler"; mac.noter(62000);
synchroniser(iphone, depot); synchroniser(mac, depot); synchroniser(iphone, depot);
verifier("une fiche retouchée après sa suppression ailleurs n'est pas perdue", [101,102], ids(iphone.d.tiers));
vrai("les deux appareils restent d'accord", C.memeContenu(iphone.d, mac.d));
/* et l'inverse : modifiée d'abord, supprimée ensuite, la suppression gagne */
mac.d.tiers.filter(function(t){ return t.id === 102; })[0].note = "Vu"; mac.noter(70000);
iphone.d.tiers = iphone.d.tiers.filter(function(t){ return t.id !== 102; }); iphone.noter(71000);
synchroniser(mac, depot); synchroniser(iphone, depot); synchroniser(mac, depot);
verifier("supprimée après la dernière retouche, elle disparaît partout", [[101],[101]], [ids(iphone.d.tiers), ids(mac.d.tiers)]);

/* catégories : la dernière liste écrite fait foi */
mac.d.reglages.cats = ["Maison","Nourriture","Carburant"]; mac.noter(80000);
synchroniser(mac, depot); synchroniser(iphone, depot);
verifier("une catégorie ajoutée sur le Mac arrive sur l'iPhone", ["Maison","Nourriture","Carburant"], iphone.d.reglages.cats);

/* remplacement volontaire du dépôt : nouvelle époque, l'autre appareil suit */
var restaure = new Appareil(carnetVide());
restaure.d.mouvements.push({id:900, date:"2026-09-01", nature:"depense", montant:-1, compte:1});
restaure.noter(90000);
depot.donnees = C.pourEnvoi(restaure.d); depot.epoque = "epoque-2";       // « ce carnet remplace le dépôt »
verifier("le Mac voit que le dépôt a été remplacé et le prend", "adopter", synchroniser(mac, depot));
verifier("son carnet est maintenant celui du dépôt", [900], ids(mac.d.mouvements));
verifier("mais toujours avec son propre code", "code-du-mac", mac.d.reglages.verrou);

/* --------------------------------------------- propriétés de la fusion */
var x = carnetVide(), y = carnetVide();
x.mouvements = [{id:1, maj:10, montant:-1}, {id:2, maj:50, montant:-2}];
y.mouvements = [{id:2, maj:40, montant:-22}, {id:3, maj:5, montant:-3}];
var fxy = C.fusionner(x, y);
verifier("la fusion garde l'union des fiches", [1,2,3], ids(fxy.mouvements));
verifier("et la version la plus récente de chacune", -2, fxy.mouvements[1].montant);
vrai("fusionner deux fois ne change rien", C.memeContenu(fxy, C.fusionner(fxy, y)));
vrai("fusionner un carnet avec lui-même ne change rien", C.memeContenu(x, C.fusionner(x, x)));
verifier("la fusion ne modifie pas ses entrées", [2, 2], [x.mouvements.length, y.mouvements.length]);
var e1 = carnetVide(), e2 = carnetVide();
e1.mouvements = [{id:7, montant:-100}]; e2.mouvements = [{id:7, montant:-200}];
verifier("à date égale, la version du dépôt est gardée", -200, C.fusionner(e1, e2).mouvements[0].montant);
vrai("l'ordre des champs ne fait pas un contenu différent",
  C.canon({a:1, b:[{x:1, y:2}]}) === C.canon({b:[{y:2, x:1}], a:1}));

/* ------------------------------------------------ le carnet se tient-il ? */
var sain = carnetVide();
sain.engagements = [{id:1, tiers:101, sens:"creance", objet:"Prêt", tranches:[
  {date:"2026-10-15", montant:100000, etat:"payee"}, {date:"2026-11-15", montant:200000, etat:"due"}]}];
sain.mouvements = [{id:1, tiers:101, nature:"pret", montant:-300000, engagement:1},
                   {id:2, tiers:101, nature:"remboursement_recu", montant:100000, engagement:1}];
verifier("un prêt dont les tranches suivent les versements est cohérent", [], C.incoherences(sain));
/* deux versements saisis sur deux appareils sans synchronisation entre les deux :
   les deux mouvements survivent, mais un seul échéancier */
var bancal = copie(sain);
bancal.mouvements.push({id:3, tiers:101, nature:"remboursement_recu", montant:50000, engagement:1});
var inc = C.incoherences(bancal);
verifier("un versement que l'échéancier n'a pas vu est signalé", 1, inc.length);
verifier("avec les deux chiffres qui ne collent pas", [150000, 100000], [inc[0].parMouvements, inc[0].parTranches]);

var sortie = "\n" + reussis + " vérifications passées";
if (echecs.length) sortie += ", " + echecs.length + " ÉCHEC(S) :\n\n  ✗ " + echecs.join("\n  ✗ ") + "\n";
else sortie += ", aucun échec.\n";
sortie;
