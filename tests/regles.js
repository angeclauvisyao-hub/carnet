/* Tests des règles du carnet. Ils tournent sans navigateur et sans rien
   installer : JavaScriptCore est livré avec macOS.

       osascript -l JavaScript tests/regles.js

   Ce qui est testé ici est ce qui ne doit jamais casser en silence :
   le solde d'un tiers, l'interdiction d'enregistrer sans date, et le
   réarmement automatique des charges qui reviennent. */

ObjC.import("Foundation");

function lire(chemin){
  return $.NSString.stringWithContentsOfFileEncodingError(chemin, $.NSUTF8StringEncoding, null).js;
}
/* À lancer depuis la racine du projet. */
var racine = $.NSFileManager.defaultManager.currentDirectoryPath.js + "/";
var C = new Function(lire(racine + "calculs.js") + "\nreturn Calculs;")();

var reussis = 0, echecs = [];
function verifier(nom, attendu, obtenu){
  var a = JSON.stringify(attendu), b = JSON.stringify(obtenu);
  if (a === b) { reussis++; }
  else echecs.push(nom + "\n      attendu : " + a + "\n      obtenu  : " + b);
}
function vrai(nom, condition){ verifier(nom, true, !!condition); }

/* ------------------------------------------------------- solde d'un tiers */
var d1 = {
  tiers:[{id:1,nom:"Un proche"},{id:2,nom:"Un fournisseur"}],
  mouvements:[
    {id:1,date:"2026-09-05",tiers:1,nature:"pret",montant:-600000},
    {id:2,date:"2026-09-12",tiers:1,nature:"remboursement_recu",montant:150000},
    {id:3,date:"2026-10-02",tiers:2,nature:"depense",montant:-80000,cat:"Affaires"},
    {id:4,date:"2026-10-03",tiers:2,nature:"avance_recue",montant:120000}
  ]
};
verifier("un prêt moins un remboursement donne le reste dû", 450000, C.soldeTiers(d1,1));
verifier("une dépense chez un fournisseur ne crée aucune dette", -120000, C.soldeTiers(d1,2));
verifier("total des créances", 450000, C.creances(d1));
verifier("total des dettes", 120000, C.dettes(d1));
verifier("un tiers sans mouvement est à zéro", 0, C.soldeTiers(d1,99));

/* le solde est bien la SOMME des mouvements, pas un champ saisi : on ajoute
   un remboursement et le solde doit bouger de lui-même */
d1.mouvements.push({id:5,date:"2026-10-15",tiers:1,nature:"remboursement_recu",montant:225000});
verifier("ajouter un remboursement baisse le solde sans y toucher", 225000, C.soldeTiers(d1,1));

/* ------------------------------------------------------- rien sans date */
vrai("un engagement sans tranche est refusé",
  C.exigeUneDate("engagement", {tranches:[]}));
vrai("une tranche sans date est refusée",
  C.exigeUneDate("engagement", {tranches:[{date:"2026-11-15",montant:1},{date:null,montant:1}]}));
verifier("un engagement entièrement daté passe", null,
  C.exigeUneDate("engagement", {tranches:[{date:"2026-11-15",montant:1}]}));
vrai("une participation sans point est refusée", C.exigeUneDate("participation", {mise:100}));
vrai("une affaire sans prochaine action est refusée", C.exigeUneDate("opportunite", {base:1,taux:5}));
vrai("un récurrent sans prochaine date est refusé", C.exigeUneDate("recurrent", {montant:1}));
verifier("une dépense du jour n'a rien à fixer", null,
  C.exigeUneDate("mouvement", {date:"2026-10-13",montant:-5000}));
vrai("un mouvement sans date est refusé", C.exigeUneDate("mouvement", {montant:-5000}));

/* --------------------------------------------- les charges qui reviennent */
verifier("mensuel le 10 : octobre pousse novembre", "2026-11-10",
  C.avancer({type:"mensuel",jour:10}, "2026-10-10"));
verifier("mensuel le 31 : février n'a pas de 31", "2026-02-28",
  C.avancer({type:"mensuel",jour:31}, "2026-01-31"));
verifier("décembre pousse janvier de l'année suivante", "2027-01-05",
  C.avancer({type:"mensuel",jour:5}, "2026-12-05"));
verifier("trimestriel : septembre pousse décembre", "2026-12-21",
  C.avancer({type:"trimestriel",jour:21}, "2026-09-21"));
verifier("scolarité : septembre pousse novembre", "2026-11-15",
  C.avancer({type:"mois",mois:[9,11,12],jour:15}, "2026-09-15"));
verifier("scolarité : novembre pousse décembre", "2026-12-15",
  C.avancer({type:"mois",mois:[9,11,12],jour:15}, "2026-11-15"));
verifier("scolarité : décembre repart en septembre prochain", "2027-09-15",
  C.avancer({type:"mois",mois:[9,11,12],jour:15}, "2026-12-15"));
verifier("annuel", "2027-03-01", C.avancer({type:"annuel",jour:1}, "2026-03-01"));

verifier("première occurrence : le 10 est passé, on vise novembre", "2026-11-10",
  C.premiere({type:"mensuel",jour:10}, "2026-10-13"));
verifier("première occurrence : le 15 est encore devant", "2026-10-15",
  C.premiere({type:"mensuel",jour:15}, "2026-10-13"));
verifier("première occurrence de la scolarité après le 13 octobre", "2026-11-15",
  C.premiere({type:"mois",mois:[9,11,12],jour:15}, "2026-10-13"));

/* -------------------------------------------------- tranches et versements */
verifier("répartir 600 000 en 3", [200000,200000,200000], C.repartir(600000,3));
verifier("aucun franc ne disparaît dans l'arrondi", [33333,33333,33334], C.repartir(100000,3));
verifier("la somme des tranches fait toujours le total", 100000,
  C.repartir(100000,7).reduce(function(a,b){ return a+b; },0));
verifier("un seul versement", [50000], C.repartir(50000,1));

verifier("échéancier mensuel à partir du 15 novembre",
  ["2026-11-15","2026-12-15","2027-01-15"],
  C.tranches(300000,3,"2026-11-15",1).map(function(t){ return t.date; }));
verifier("échéancier tous les 3 mois",
  ["2026-11-15","2027-02-15"],
  C.tranches(200000,2,"2026-11-15",3).map(function(t){ return t.date; }));

var eng = {id:1,sens:"creance",objet:"Prêt",tranches:[
  {date:"2026-10-15",montant:225000,etat:"due"},
  {date:"2026-11-15",montant:225000,etat:"due"}]};
verifier("un versement exact solde la tranche", 0, C.appliquerVersement(eng,225000,"2026-10-15"));
verifier("il reste la deuxième tranche", 225000, C.resteEngagement(eng));
verifier("la tranche réglée est marquée payée", "payee", eng.tranches[0].etat);

var eng2 = {id:2,sens:"creance",objet:"Prêt",tranches:[{date:"2026-10-15",montant:225000,etat:"due"}]};
verifier("un versement partiel ne solde pas tout", 0, C.appliquerVersement(eng2,100000,"2026-10-20"));
verifier("le reste dû reste exact après un versement partiel", 125000, C.resteEngagement(eng2));
verifier("et la part réglée est connue", 100000, C.regleEngagement(eng2));
verifier("le total de l'engagement ne change pas", 225000, C.totalEngagement(eng2));

var eng3 = {id:3,sens:"dette",objet:"Dette",tranches:[{date:"2026-10-01",montant:50000,etat:"due"}]};
verifier("un trop-perçu est rendu au lieu d'être absorbé", 20000,
  C.appliquerVersement(eng3,70000,"2026-10-13"));

/* ------------------------------------------------------------ enveloppes */
var d2 = {
  comptes:[{id:1,nom:"Espèces",soldeInitial:200000}],
  enveloppes:[{id:1,libelle:"Maison",cats:["Nourriture","Maison"],montant:100000}],
  mouvements:[
    {id:1,date:"2026-10-05",nature:"depense",montant:-300000,cat:"Maison",fixe:true,compte:1},
    {id:2,date:"2026-10-07",nature:"depense",montant:-14000,cat:"Nourriture",compte:1},
    {id:3,date:"2026-10-12",nature:"depense",montant:-15000,cat:"Nourriture",compte:1},
    {id:4,date:"2026-09-30",nature:"depense",montant:-20000,cat:"Nourriture",compte:1},
    {id:5,date:"2026-10-09",nature:"depense",montant:-25000,cat:"Transport",compte:1}
  ]
};
verifier("le loyer ne mange pas l'enveloppe du marché", 29000,
  C.consommeEnveloppe(d2, d2.enveloppes[0], "2026-10-13"));
verifier("le mois précédent ne compte pas", 20000,
  C.consommeEnveloppe(d2, d2.enveloppes[0], "2026-09-15"));
verifier("reste de l'enveloppe", 71000, C.resteEnveloppes(d2, "2026-10-13"));
verifier("une enveloppe dépassée ne devient pas négative dans le reste à vivre", 0,
  C.resteEnveloppes({enveloppes:[{id:1,cats:["X"],montant:10000}],
    mouvements:[{date:"2026-10-02",nature:"depense",montant:-18000,cat:"X"}]}, "2026-10-13"));

/* --------------------------------------------------------------- comptes */
verifier("solde d'un compte = départ + mouvements", 200000-300000-14000-15000-20000-25000,
  C.soldeCompte(d2, 1));
verifier("un mouvement en nature ne touche aucun compte", 50000,
  C.soldeCompte({comptes:[{id:1,soldeInitial:50000}],
    mouvements:[{date:"2026-10-01",nature:"depense",montant:-9000,compte:null}]}, 1));

/* Le solde d'ouverture est la vérité à sa date. */
var dOuv = {comptes:[{id:1,nom:"Banque",type:"banque",soldeInitial:500000,depuis:"2026-10-13"}],
  mouvements:[
    {id:1,date:"2026-10-05",nature:"depense",montant:-300000,cat:"Maison",compte:1,fixe:true},
    {id:2,date:"2026-10-13",nature:"depense",montant:-20000,cat:"Nourriture",compte:1},
    {id:3,date:"2026-10-20",nature:"depense",montant:-15000,cat:"Télécom",compte:1,fixe:true}]};
verifier("une dépense d'avant l'ouverture du compte ne touche pas au solde", 500000 - 20000 - 15000, C.soldeCompte(dOuv, 1));
verifier("elle n'est pas « dans le solde »", false, C.dansLeSolde(dOuv, dOuv.mouvements[0]));
verifier("une dépense du jour de l'ouverture compte", true, C.dansLeSolde(dOuv, dOuv.mouvements[1]));
verifier("une dépense d'après compte", true, C.dansLeSolde(dOuv, dOuv.mouvements[2]));
verifier("un mouvement sans compte n'est dans aucun solde", false, C.dansLeSolde(dOuv, {date:"2026-10-20",compte:null}));
verifier("un compte sans date d'ouverture compte tout", 100000 - 300000,
  C.soldeCompte({comptes:[{id:1,soldeInitial:100000}], mouvements:[{date:"2020-01-01",montant:-300000,compte:1}]}, 1));
/* mais elle reste une dépense du mois : le loyer d'octobre est bien sorti en octobre */
verifier("elle compte toujours dans les dépenses du mois", 335000,
  -dOuv.mouvements.filter(function(m){ return m.nature === "depense" && m.date >= "2026-10-01" && m.date <= "2026-10-31"; })
    .reduce(function(s,m){ return s + m.montant; }, 0));
verifier("et le reste à vivre part du solde non touché", 500000 - 20000 - 15000, C.resteAVivre(dOuv, "2026-10-21").liquidites);

/* réglée pour le mois : visible jusqu'au 1er du mois suivant */
var loyerR = {dernierRegle:"2026-10-05", prochaine:"2026-11-05", rythme:{type:"mensuel",jour:5}};
verifier("réglé le 5 octobre : réglée le 13 octobre", true, C.regleeCeMois(loyerR, "2026-10-13"));
verifier("encore réglée le 31 octobre", true, C.regleeCeMois(loyerR, "2026-10-31"));
verifier("le 1er novembre, elle redevient à payer", false, C.regleeCeMois(loyerR, "2026-11-01"));
verifier("jamais réglée : à payer", false, C.regleeCeMois({prochaine:"2026-11-05"}, "2026-10-13"));
verifier("réglée le mois dernier seulement : à payer", false,
  C.regleeCeMois({dernierRegle:"2026-09-05", prochaine:"2026-10-05"}, "2026-10-13"));
verifier("deux fois par mois, premier versement fait : il en reste un, pas réglée", false,
  C.regleeCeMois({dernierRegle:"2026-10-05", prochaine:"2026-10-20"}, "2026-10-13"));
verifier("deux fois par mois, les deux faits : réglée", true,
  C.regleeCeMois({dernierRegle:"2026-10-20", prochaine:"2026-11-05"}, "2026-10-21"));
verifier("trimestrielle réglée ce mois : réglée jusqu'à la fin du mois", true,
  C.regleeCeMois({dernierRegle:"2026-10-02", prochaine:"2027-01-02"}, "2026-10-13"));
verifier("et à payer de nouveau le mois suivant, même si l'échéance est loin", false,
  C.regleeCeMois({dernierRegle:"2026-10-02", prochaine:"2027-01-02"}, "2026-11-01"));
verifier("une échéance en retard n'est jamais « réglée »", false,
  C.regleeCeMois({dernierRegle:"2026-10-02", prochaine:"2026-10-10"}, "2026-10-13"));

/* les règlements d'une charge se retrouvent dans les mouvements */
var dReg = {mouvements:[
  {id:1,date:"2026-09-05",recurrent:2,montant:-300000},
  {id:2,date:"2026-10-05",recurrent:2,montant:-300000},
  {id:3,date:"2026-10-13",recurrent:2,montant:-300000},
  {id:4,date:"2026-10-10",recurrent:3,montant:-50000},
  {id:5,date:"2026-10-12",montant:-15000}]};
verifier("les règlements du mois d'une charge, dans l'ordre", [2,3],
  C.reglementsDuMois(dReg, 2, "2026-10-13").map(function(m){ return m.id; }));
verifier("pas ceux des autres charges ni des autres mois", [4], C.reglementsDuMois(dReg, 3, "2026-10-13").map(function(m){ return m.id; }));
verifier("aucun règlement : liste vide", [], C.reglementsDuMois(dReg, 9, "2026-10-13"));
verifier("le dernier règlement est le mouvement le plus récent", "2026-10-13", C.dernierReglement(dReg, 2));
verifier("jamais réglée : rien", null, C.dernierReglement(dReg, 9));

/* reculer : l'échéance d'avant */
verifier("mensuel : novembre recule à octobre", "2026-10-10", C.reculer({type:"mensuel",jour:10}, "2026-11-10"));
verifier("mensuel le 31 : mars recule à fin février", "2026-02-28", C.reculer({type:"mensuel",jour:31}, "2026-03-31"));
verifier("janvier recule à décembre de l'année d'avant", "2025-12-05", C.reculer({type:"mensuel",jour:5}, "2026-01-05"));
verifier("trimestriel", "2026-09-21", C.reculer({type:"trimestriel",jour:21}, "2026-12-21"));
verifier("certains mois : novembre recule à septembre", "2026-09-15", C.reculer({type:"mois",mois:[9,11,12],jour:15}, "2026-11-15"));
verifier("certains mois : septembre recule à décembre d'avant", "2025-12-15", C.reculer({type:"mois",mois:[9,11,12],jour:15}, "2026-09-15"));
verifier("deux fois par mois : le 20 recule au 5", "2026-10-05", C.reculer({type:"bimensuel",jours:[5,20]}, "2026-10-20"));
verifier("deux fois par mois : le 5 recule au 20 du mois d'avant", "2026-10-20", C.reculer({type:"bimensuel",jours:[5,20]}, "2026-11-05"));
verifier("annuel", "2025-03-01", C.reculer({type:"annuel",jour:1}, "2026-03-01"));
vrai("reculer puis avancer revient au point de départ",
  [{type:"mensuel",jour:10},{type:"trimestriel",jour:21},{type:"mois",mois:[9,11,12],jour:15},{type:"bimensuel",jours:[5,20]}]
    .every(function(ry){ var o = C.premiere(ry, "2026-10-13"); return C.avancer(ry, C.reculer(ry, o)) === o; }));

verifier("des espèces négatives sont signalées", [{id:1,nom:"Espèces",solde:-9000}],
  C.comptesImpossibles({comptes:[{id:1,nom:"Espèces",type:"especes",soldeInitial:0}],
    mouvements:[{date:"2026-10-01",nature:"depense",montant:-9000,compte:1}]}));
verifier("un découvert bancaire n'est pas une anomalie", [],
  C.comptesImpossibles({comptes:[{id:1,nom:"Banque",type:"banque",soldeInitial:0}],
    mouvements:[{date:"2026-10-01",nature:"depense",montant:-9000,compte:1}]}));

/* ------------------------------------------------------------ imprévus */
verifier("dépense hors enveloppe = imprévu, charge fixe = non, recette comptée",
  {sorties:25000, entrees:0, nb:1}, C.imprevus(d2, "2026-10-13"));
verifier("une recette non programmée est comptée",
  {sorties:0, entrees:75000, nb:1},
  C.imprevus({enveloppes:[],mouvements:[
    {date:"2026-10-11",nature:"recette",montant:75000,cat:"Autre"},
    {date:"2026-10-10",nature:"recette",montant:200000,cat:"Salaire",fixe:true}]}, "2026-10-13"));

/* ------------------------------------------- aides : une caisse, pas une dette
   Une aide « selon mes entrées, pas obligatoire » doit être rappelée sans
   jamais être présentée comme due. Montants fictifs. */
verifier("deux fois par mois : le 5 pousse le 20", "2026-10-20",
  C.avancer({type:"bimensuel",jours:[5,20]}, "2026-10-05"));
verifier("deux fois par mois : le 20 pousse le 5 du mois suivant", "2026-11-05",
  C.avancer({type:"bimensuel",jours:[5,20]}, "2026-10-20"));
verifier("deux fois par mois : décembre passe à janvier", "2027-01-05",
  C.avancer({type:"bimensuel",jours:[5,20]}, "2026-12-20"));
verifier("première occurrence bimensuelle après le 13", "2026-10-20",
  C.premiere({type:"bimensuel",jours:[5,20]}, "2026-10-13"));
verifier("libellé du rythme", "deux fois par mois, le 5 et le 20",
  C.libelleRythme({type:"bimensuel",jours:[5,20]}));

var dAide = {
  comptes:[{id:1,soldeInitial:500000}],
  enveloppes:[{id:1,libelle:"Aides",cats:["Aides"],montant:52000}],
  recurrents:[
    {id:1,libelle:"Un parent",sens:"sortie",montant:20000,cat:"Aides",facultatif:true,
     rythme:{type:"bimensuel",jours:[5,20]},prochaine:"2026-10-20"},
    {id:2,libelle:"Loyer",sens:"sortie",montant:80000,cat:"Maison",
     rythme:{type:"mensuel",jour:5},prochaine:"2026-11-05"}
  ],
  mouvements:[]
};
var agAide = C.agenda(dAide);
var ligneAide = agAide.filter(function(x){ return x.titre === "Un parent"; })[0];
verifier("une aide facultative entre dans l'agenda", 2, agAide.length);
verifier("mais elle n'est pas classée comme à payer", "aide", ligneAide.genre);
verifier("elle ne compte pas dans ce qui doit sortir", false, C.aSortir(ligneAide));
vrai("elle est bien reconnue comme aide", C.estAide(ligneAide));
verifier("elle ne pèse pas sur le reste à vivre comme une dette", 0,
  C.resteAVivre(dAide, "2026-10-13").datees);

var tvAide = C.trainDeVie(dAide, "2026-10-13");
verifier("le train de vie ne compte pas deux fois l'aide", 80000, tvAide.mensuels);
verifier("la caisse d'aides est comptée une fois, par l'enveloppe", 52000, tvAide.enveloppes);
verifier("les aides souhaitées sont connues à part", 40000, tvAide.aidesSouhaitees);

/* Le mois où il peut mettre plus, il le décide : le plafond change. */
var env1 = {id:1,libelle:"Aides",cats:["Aides"],montant:52000,
  montantsParMois:{"2026-10":90000,"2026-11":30000}};
verifier("plafond décidé pour octobre", 90000, C.montantEnveloppe(env1,"2026-10-13"));
verifier("plafond décidé pour novembre", 30000, C.montantEnveloppe(env1,"2026-11-02"));
verifier("sans décision, le montant par défaut s'applique", 52000,
  C.montantEnveloppe(env1,"2026-12-01"));
verifier("le reste à vivre utilise le plafond du mois", 90000,
  C.resteEnveloppes({enveloppes:[env1],mouvements:[]}, "2026-10-13"));
verifier("le train de vie aussi", 90000,
  C.trainDeVie({enveloppes:[env1],recurrents:[]}, "2026-10-13").enveloppes);

/* Une aide versée mange la caisse (elle n'est pas marquée « fixe »),
   contrairement à une charge fixe comme le loyer. */
var dAide2 = JSON.parse(JSON.stringify(dAide));
dAide2.mouvements = [
  {date:"2026-10-05",nature:"depense",montant:-20000,cat:"Aides",compte:1},
  {date:"2026-10-05",nature:"depense",montant:-80000,cat:"Maison",fixe:true,compte:1}
];
verifier("l'aide versée consomme la caisse", 20000,
  C.consommeEnveloppe(dAide2, dAide2.enveloppes[0], "2026-10-13"));
verifier("et il reste le solde de la caisse", 32000,
  C.resteEnveloppes(dAide2, "2026-10-13"));

/* ----------------------------------------------------------- agenda */
var d3 = {
  tiers:[{id:1,nom:"Proche"}],
  comptes:[{id:1,nom:"Banque",soldeInitial:1000000}],
  recurrents:[
    {id:1,libelle:"Salaire",sens:"entree",montant:200000,rythme:{type:"mensuel",jour:10},prochaine:"2026-11-10"},
    {id:2,libelle:"Internet",sens:"sortie",montant:15000,rythme:{type:"mensuel",jour:15},prochaine:"2026-10-15"},
    {id:3,libelle:"Eau",sens:"sortie",montant:15000,rythme:{type:"trimestriel",jour:1},prochaine:null}
  ],
  engagements:[{id:1,tiers:1,sens:"creance",objet:"Prêt",tranches:[
    {date:"2026-10-09",montant:75000,etat:"due"},{date:"2026-11-15",montant:75000,etat:"due"}]}],
  participations:[{id:1,tiers:1,objet:"Placement",mise:800000,point:null}],
  opportunites:[{id:1,tiers:1,objet:"Affaire",base:1000000,taux:5,date:null}],
  enveloppes:[], mouvements:[]
};
var ag = C.agenda(d3);
verifier("l'agenda ne garde que ce qui a une date", 4, ag.length);
verifier("il est trié par date", ["2026-10-09","2026-10-15","2026-11-10","2026-11-15"],
  ag.map(function(x){ return x.date; }));
verifier("un retard est bien dans l'agenda", true, C.jours("2026-10-13", ag[0].date) < 0);
verifier("trois lignes sans date remontent", 3, C.sansDate(d3).length);
verifier("une charge sans prochaine date est signalée", "charge qui revient, aucune prochaine date",
  C.sansDate(d3)[0].detail);

/* --------------------------------------------------------- reste à vivre */
var rv = C.resteAVivre(d3, "2026-10-13");
verifier("à sortir d'ici la fin du mois : internet seul", 15000, rv.datees);
verifier("le salaire attendu ne gonfle pas le reste à vivre", 1000000-15000, rv.reste);

var d4 = JSON.parse(JSON.stringify(d3));
d4.enveloppes = [{id:1,libelle:"Maison",cats:["Nourriture"],montant:100000}];
verifier("l'enveloppe non consommée est retirée du reste à vivre", 1000000-15000-100000,
  C.resteAVivre(d4, "2026-10-13").reste);

/* ------------------------------------------------------------ patrimoine */
var d5 = {
  tiers:[{id:1},{id:2}],
  comptes:[{id:1,soldeInitial:500000}],
  mouvements:[
    {date:"2026-09-01",tiers:1,nature:"pret",montant:-200000,compte:1},
    {date:"2026-09-02",tiers:2,nature:"avance_recue",montant:120000,compte:1}
  ],
  participations:[{id:1,mise:800000,recu:300000}],
  biens:[{nom:"Terrain",montant:1000000}],
  credits:[{nom:"Véhicule",montant:400000}]
};
var p = C.patrimoine(d5);
verifier("une participation compte pour sa mise, pas pour ce qu'elle a rapporté",
  800000, p.mises);
verifier("actif", 500000-200000+120000+200000+800000+1000000, p.actif);
verifier("passif", 120000+400000, p.passif);
verifier("position nette = actif − passif", p.actif - p.passif, p.nette);

/* Prêter ne rend pas plus pauvre : l'argent passe des liquidités aux
   créances. Si un jour la position nette bouge quand on prête, c'est que
   le carnet compte deux fois ou perd une ligne. */
var avantPret = {tiers:[{id:1}], comptes:[{id:1,soldeInitial:500000}], mouvements:[]};
var apresPret = {tiers:[{id:1}], comptes:[{id:1,soldeInitial:500000}],
  mouvements:[{date:"2026-10-13",tiers:1,nature:"pret",montant:-200000,compte:1}]};
verifier("prêter ne change pas la position nette",
  C.patrimoine(avantPret).nette, C.patrimoine(apresPret).nette);
verifier("mais ça vide la caisse", 300000, C.liquidites(apresPret));
verifier("et ça remplit les créances", 200000, C.creances(apresPret));

/* Une dépense, elle, appauvrit vraiment. */
var apresDepense = {tiers:[], comptes:[{id:1,soldeInitial:500000}],
  mouvements:[{date:"2026-10-13",nature:"depense",montant:-30000,compte:1,cat:"Nourriture"}]};
verifier("une dépense baisse la position nette", -30000,
  C.patrimoine(apresDepense).nette - C.patrimoine(avantPret).nette);

/* une mise récupérée sort de l'actif : l'argent est revenu en liquidités */
verifier("mise partiellement récupérée", 500000,
  C.patrimoine({participations:[{id:1,mise:800000,miseRecuperee:300000}]}).mises);

/* ----------------------------------------------------------- train de vie */
var d6 = {recurrents:[
  {id:1,sens:"entree",montant:200000,rythme:{type:"mensuel",jour:10}},
  {id:2,sens:"sortie",montant:80000,rythme:{type:"mensuel",jour:5}},
  {id:3,sens:"sortie",montant:20000,rythme:{type:"mensuel",jour:10}},
  {id:4,sens:"sortie",montant:10000,rythme:{type:"mensuel",jour:15}},
  {id:5,sens:"sortie",montant:6000,rythme:{type:"trimestriel",jour:1}},
  {id:6,sens:"sortie",montant:30000,rythme:{type:"mois",mois:[9,11,12],jour:15}}
], enveloppes:[{id:1,montant:60000,cats:["Nourriture"]}]};
var tv = C.trainDeVie(d6, "2026-10-13");
verifier("fixes de chaque mois", 110000, tv.mensuels);
verifier("courant = fixes + enveloppes", 170000, tv.courant);
verifier("lissé : ce qui tombe 3 fois l'an et 4 fois l'an ramené au mois",
  170000 + Math.round(30000*3/12 + 6000*4/12), tv.lisse);
verifier("écart avec les revenus fixes", 200000 - tv.lisse, tv.ecart);
vrai("un revenu qui couvre le train de vie laisse un écart positif", tv.ecart > 0);
vrai("un revenu trop court est annoncé comme tel",
  C.trainDeVie({recurrents:[{sens:"entree",montant:50000,rythme:{type:"mensuel",jour:1}},
    {sens:"sortie",montant:80000,rythme:{type:"mensuel",jour:5}}],enveloppes:[]}, "2026-10-13").ecart < 0);

/* ------------------------------------------------------------- formatage */
verifier("format d'un montant, insécable", "1\u00a0250\u00a0000\u00a0F", C.F(1250000));
verifier("format d'un négatif", "\u2212450\u00a0000\u00a0F", C.F(-450000));
vrai("un montant ne contient aucune espace sécable", C.F(12400000).indexOf(" ") < 0);
verifier("date lisible", "13/10/2026", C.jf("2026-10-13"));
verifier("aujourd'hui", "aujourd'hui", C.quand("2026-10-13","2026-10-13"));
verifier("retard", "en retard de 4 j", C.quand("2026-10-09","2026-10-13"));
verifier("cette semaine", "dans 2 j", C.quand("2026-10-15","2026-10-13"));
verifier("plus tard", "15/11/2026", C.quand("2026-11-15","2026-10-13"));
verifier("commission base × taux", 620000, C.commission({base:12400000,taux:5}));
verifier("commission au forfait", 150000, C.commission({montant:150000}));

/* ---------------------------------------------------------- bilan du mois
   Prévu contre fait. Le prévu vient du rythme des lignes, pas de leur
   prochaine date : un loyer déjà réglé reste une charge du mois. */
var d7 = {
  recurrents:[
    {id:1,libelle:"Salaire",sens:"entree",montant:200000,rythme:{type:"mensuel",jour:10},prochaine:"2026-11-10"},
    {id:2,libelle:"Loyer",sens:"sortie",montant:80000,rythme:{type:"mensuel",jour:5},prochaine:"2026-11-05",dernierRegle:"2026-10-05"},
    {id:3,libelle:"Eau",sens:"sortie",montant:6000,rythme:{type:"trimestriel",jour:1},prochaine:null},
    {id:4,libelle:"Assurance",sens:"sortie",montant:9000,rythme:{type:"trimestriel",jour:1},prochaine:"2027-01-01"},
    {id:5,libelle:"Taxe",sens:"sortie",montant:12000,rythme:{type:"annuel",jour:1},prochaine:"2026-12-01"},
    {id:6,libelle:"Scolarité",sens:"sortie",montant:30000,rythme:{type:"mois",mois:[9,11,12],jour:15},prochaine:"2026-11-15"},
    {id:7,libelle:"Aide",sens:"sortie",facultatif:true,montant:10000,cat:"Aides",rythme:{type:"bimensuel",jours:[5,20]},prochaine:"2026-10-20"},
    {id:8,libelle:"Internet",sens:"sortie",montant:10000,rythme:{type:"mensuel",jour:15},prochaine:"2026-10-15"}
  ],
  enveloppes:[{id:1,montant:60000,montantsParMois:{"2026-10":50000},cats:["Nourriture"]},{id:2,montant:20000,cats:["Aides"]}],
  mouvements:[
    {id:1,date:"2026-10-05",nature:"depense",montant:-80000,fixe:true,recurrent:2,cat:"Maison"},
    {id:2,date:"2026-10-07",nature:"depense",montant:-12000,cat:"Nourriture"},
    {id:3,date:"2026-10-05",nature:"depense",montant:-10000,cat:"Aides",recurrent:7},
    {id:4,date:"2026-10-08",nature:"depense",montant:-3000,cat:"Transport"},
    {id:5,date:"2026-10-10",nature:"recette",montant:200000,fixe:true,recurrent:1},
    {id:6,date:"2026-10-11",nature:"recette",montant:15000},
    {id:7,date:"2026-10-12",nature:"avance_recue",montant:40000,tiers:1},
    {id:8,date:"2026-10-12",nature:"pret",montant:-25000,tiers:1},
    {id:9,date:"2026-09-28",nature:"depense",montant:-5000,cat:"Transport"}
  ]};
var bm = C.bilanDuMois(d7, "2026-10-13");
verifier("revenus fixes prévus", 200000, bm.revenus.prevu);
verifier("charges prévues : le loyer déjà réglé compte, la trimestrielle qui tombe ce mois aussi", 99000, bm.charges.prevu);
verifier("une trimestrielle sans date n'est pas devinée", 0, C.occurrencesDuMois(d7.recurrents[2], "2026-10-13"));
verifier("une trimestrielle datée de janvier tombe en octobre", 1, C.occurrencesDuMois(d7.recurrents[3], "2026-10-13"));
verifier("une annuelle de décembre ne tombe pas en octobre", 0, C.occurrencesDuMois(d7.recurrents[4], "2026-10-13"));
verifier("la scolarité ne tombe que ses mois à elle", [0,1], [C.occurrencesDuMois(d7.recurrents[5], "2026-10-13"), C.occurrencesDuMois(d7.recurrents[5], "2026-11-02")]);
verifier("enveloppes prévues : le plafond décidé pour le mois l'emporte", 70000, bm.enveloppes.prevu);
verifier("l'aide « si je peux » n'est pas prévue deux fois", 31000, bm.solde.prevu);
verifier("charges réglées", 80000, bm.charges.fait);
verifier("enveloppes consommées, aide comprise", 22000, bm.enveloppes.fait);
verifier("hors prévision", 3000, bm.horsPrevision);
verifier("revenus fixes reçus", 200000, bm.revenus.fait);
verifier("autres entrées : la prime et l'avance reçue", 55000, bm.autresEntrees);
verifier("le sorti du bilan est la somme des dépenses du mois", 105000, bm.sorti);
verifier("un prêt consenti n'est pas une dépense", 255000 - 105000, bm.solde.fait);
verifier("un carnet vide a un bilan à zéro", [0,0], (function(){ var z = C.bilanDuMois({}, "2026-10-13"); return [z.solde.prevu, z.solde.fait]; })());

/* La file d'attente : sans date d'abord, puis la plus pressée, le réglé en bas. */
verifier("ce qui est réglé descend en bas de la liste",
  ["Eau","Internet","Aide","Scolarité","Taxe","Assurance","Loyer"],
  C.fileDAttente(d7.recurrents.filter(function(c){ return c.sens === "sortie"; }), "2026-10-13").map(function(c){ return c.libelle; }));
verifier("le 1er du mois suivant, la ligne réglée reprend sa place dans la file",
  ["Internet","Aide","Loyer","Scolarité","Taxe","Assurance"],
  C.fileDAttente(d7.recurrents.filter(function(c){ return c.sens === "sortie" && c.prochaine; }), "2026-11-01")
    .map(function(c){ return c.libelle; }));
verifier("la file ne modifie pas la liste d'origine", "Salaire", d7.recurrents[0].libelle);

/* ----------------------------------------------- où en sont les lignes fixes
   Le coup d'œil de l'accueil : attendu, obtenu, et « tout est là » ou le taux. */
var av = C.avancementFixes(d7, "2026-10-13");
verifier("revenus fixes : le salaire reçu, tout est perçu", [200000, 200000, 100, true],
  [av.revenus.prevu, av.revenus.obtenu, av.revenus.taux, av.revenus.complet]);
verifier("charges fixes : le loyer réglé sur loyer + assurance + internet", [99000, 80000, 81, 19000, false],
  [av.charges.prevu, av.charges.obtenu, av.charges.taux, av.charges.reste, av.charges.complet]);
verifier("seules les lignes qui tombent ce mois sont listées", ["Loyer","Assurance","Internet"],
  av.charges.lignes.map(function(c){ return c.libelle; }));
(function(){
  var z = JSON.parse(JSON.stringify(d7));
  z.mouvements.push({id:30,date:"2026-10-06",nature:"depense",montant:-80000,fixe:true,recurrent:2});
  verifier("payer le loyer deux fois ne fait pas avancer les autres charges", 80000, C.avancementFixes(z, "2026-10-13").charges.obtenu);
  z.mouvements.push({id:31,date:"2026-10-12",nature:"depense",montant:-9500,fixe:true,recurrent:8});
  verifier("un paiement partiel compte pour ce qui est versé", 89500, C.avancementFixes(z, "2026-10-13").charges.obtenu);
  z.recurrents[7].dernierRegle = "2026-10-12"; z.recurrents[7].prochaine = "2026-11-15";
  verifier("une ligne réglée compte en entier, même à quelques francs près", 90000, C.avancementFixes(z, "2026-10-13").charges.obtenu);
  z.mouvements.push({id:32,date:"2026-10-12",nature:"depense",montant:-8990,fixe:true,recurrent:4});
  verifier("presque tout n'est pas tout : jamais 100 % avant la dernière ligne", [99, false],
    (function(x){ return [x.taux, x.complet]; })(C.avancementFixes(z, "2026-10-13").charges));
  z.recurrents[3].dernierRegle = "2026-10-12"; z.recurrents[3].prochaine = "2027-01-01";
  verifier("la dernière ligne réglée : tout est réglé", [100, true, 0],
    (function(x){ return [x.taux, x.complet, x.reste]; })(C.avancementFixes(z, "2026-10-13").charges));
})();
verifier("le mois suivant, tout repart de zéro", [0, false],
  (function(x){ return [x.taux, x.complet]; })(C.avancementFixes(d7, "2026-11-02").revenus));
verifier("sans ligne fixe, pas de taux inventé", [0, null, false],
  (function(x){ return [x.prevu, x.taux, x.complet]; })(C.avancementFixes({}, "2026-10-13").charges));

/* ------------------------------------------------------------ quoi faire
   Les suggestions de l'accueil : rangées par urgence, chacune avec son geste. */
var d8 = JSON.parse(JSON.stringify(d7));
d8.comptes = [{id:1,nom:"Espèces",soldeInitial:500000}];
d8.recurrents[7].prochaine = "2026-10-09";                    // Internet en retard
d8.recurrents[7].jourAConfirmer = true;
d8.engagements = [{id:1,tiers:1,sens:"creance",objet:"Prêt",tranches:[{date:"2026-10-16",montant:50000,etat:"due"}]}];
d8.pointages = [{id:1,date:"2026-10-01",compte:1}];
d8.reglages = {dernierExport:"2026-10-12"};
var sg = C.suggestions(d8, "2026-10-13");
verifier("ordre : retard, sans date, cette semaine, entretien", [1,2,3,3,4,4],
  sg.map(function(x){ return x.rang; }));
verifier("le retard d'abord, avec le verbe qui le règle", ["Internet","Payer","en retard de 4 j"], [sg[0].titre, sg[0].verbe, sg[0].detail]);
verifier("puis ce qui n'a pas de date", ["Eau","Dater"], [sg[1].titre, sg[1].verbe]);
verifier("une créance qui tombe cette semaine s'encaisse", ["Prêt","Encaisser",50000],
  (function(x){ return [x.titre, x.verbe, x.montant]; })(sg.filter(function(x){ return x.genre === "encaisser"; })[0]));
verifier("une aide « si je peux » s'envoie, elle ne se paie pas", "Envoyer",
  sg.filter(function(x){ return x.genre === "aide"; })[0].verbe);
verifier("un jour supposé est à confirmer", "Internet", sg.filter(function(x){ return x.verbe === "Confirmer"; })[0].titre);
verifier("des espèces comptées il y a plus d'une semaine sont à recompter", "comptées il y a 12 jours",
  sg.filter(function(x){ return x.verbe === "Compter"; })[0].detail);
verifier("plusieurs jours supposés ne font qu'une suggestion, qui ouvre le premier", [1, "son jour est une supposition, comme 2 autres lignes"],
  (function(){ var z = JSON.parse(JSON.stringify(d8)); z.recurrents[1].jourAConfirmer = z.recurrents[3].jourAConfirmer = true;
    var l = C.suggestions(z, "2026-10-13").filter(function(x){ return x.verbe === "Confirmer"; }); return [l.length, l[0].detail]; })());
vrai("une sauvegarde d'hier n'est pas redemandée", !sg.some(function(x){ return x.verbe === "Sauvegarder"; }));
vrai("au-delà de sept jours, rien : ce n'est pas encore à faire",
  !sg.some(function(x){ return x.titre === "Scolarité" || x.titre === "Salaire"; }));
d8.reglages.dernierExport = null;
vrai("jamais sauvegardé : c'est suggéré", C.suggestions(d8, "2026-10-13").some(function(x){ return x.detail === "jamais sauvegardé"; }));
/* ce qui cloche passe devant tout */
d8.mouvements.push({id:20,date:"2026-10-06",nature:"depense",montant:-80000,fixe:true,recurrent:2,cat:"Maison"});
verifier("une charge réglée deux fois dans le mois est signalée en tête", ["Loyer","Vérifier","réglé 2 fois ce mois-ci",0],
  (function(x){ return [x.titre, x.verbe, x.detail, x.rang]; })(C.suggestions(d8, "2026-10-13")[0]));
verifier("une aide versée deux fois par mois n'est pas un doublon", 0,
  (function(){ var z = JSON.parse(JSON.stringify(d7)); z.mouvements.push({id:21,date:"2026-10-20",nature:"depense",montant:-10000,cat:"Aides",recurrent:7});
    return C.suggestions(z, "2026-10-21", {debutant:true}).filter(function(x){ return x.genre === "doublon"; }).length; })());
d8.comptes[0].soldeInitial = 1000;
vrai("plus assez pour finir le mois : dit en tête, avec le montant",
  /^Il manque .* pour finir le mois$/.test(C.suggestions(d8, "2026-10-13")[0].titre));
vrai("un carnet neuf ne « manque » de rien et n'a rien à compter",
  !C.suggestions(d8, "2026-10-13", {debutant:true}).some(function(x){ return x.genre === "manque" || x.genre === "compter" || x.genre === "sauvegarder"; }));
d8.mouvements.push({id:22,date:"2026-10-09",nature:"depense",montant:-45000,cat:"Nourriture"});
verifier("une enveloppe dépassée propose d'ajuster son plafond", "Ajuster",
  C.suggestions(d8, "2026-10-13").filter(function(x){ return x.genre === "enveloppe"; })[0].verbe);
verifier("un carnet vide n'a rien à faire", 0, C.suggestions({}, "2026-10-13", {debutant:true}).length);

/* ------------------------------------------------- qui me doit, à qui je dois
   L'onglet Tiers ne montre que les personnes avec qui de l'argent est en jeu. */
var d9 = {
  tiers:[{id:1,nom:"A"},{id:2,nom:"B"},{id:3,nom:"C"},{id:4,nom:"D"},{id:5,nom:"E"}],
  mouvements:[
    {id:1,date:"2026-09-01",tiers:1,nature:"pret",montant:-100000},
    {id:2,date:"2026-09-02",tiers:2,nature:"pret",montant:-400000},
    {id:3,date:"2026-09-03",tiers:3,nature:"avance_recue",montant:60000},
    {id:4,date:"2026-09-04",tiers:4,nature:"pret",montant:-20000},
    {id:5,date:"2026-09-20",tiers:4,nature:"remboursement_recu",montant:20000},
    {id:6,date:"2026-10-05",tiers:5,nature:"depense",montant:-40000,cat:"Aides"}
  ]};
var st = C.situationTiers(d9);
verifier("qui me doit, le plus gros d'abord", [["B",400000],["A",100000]], st.meDoivent.map(function(o){ return [o.t.nom, o.solde]; }));
verifier("à qui je dois", [["C",60000]], st.jeDois.map(function(o){ return [o.t.nom, o.solde]; }));
verifier("les totaux sont ceux des créances et des dettes", [C.creances(d9), C.dettes(d9)], [st.totalMeDoivent, st.totalJeDois]);
verifier("qui a tout remboursé est soldé, pas oublié", ["D"], st.soldes.map(function(o){ return o.t.nom; }));
verifier("qui reçoit une aide n'est ni débiteur ni créancier", ["E"], st.autres.map(function(o){ return o.t.nom; }));
verifier("personne n'est compté deux fois ni perdu", 5, st.meDoivent.length + st.jeDois.length + st.soldes.length + st.autres.length);

/* ------------------------------------------------------- le dû d'une affaire
   Une affaire conclue : on me doit, en tranches, datées ou non. Aucun argent
   ne bouge à la création. */
var d10 = {
  tiers:[{id:1,nom:"Une société"}],
  comptes:[{id:1,nom:"Banque",type:"banque",soldeInitial:100000}],
  engagements:[{id:1,tiers:1,sens:"creance",origine:"business",objet:"Fourniture",
    tranches:[{date:"2026-10-20",montant:400000,etat:"due"},{date:null,montant:300000,etat:"due"},{date:null,montant:200000,etat:"due"}]}],
  mouvements:[{id:1,date:"2026-10-13",tiers:1,nature:"du_affaire",montant:900000,compte:null,engagement:1,libelle:"Dû — Fourniture"}]};
verifier("une affaire peut s'enregistrer sans toutes ses dates", null, C.exigeUneDate("engagement", d10.engagements[0]));
vrai("un prêt, lui, exige toujours ses dates",
  !!C.exigeUneDate("engagement", {tranches:[{date:null,montant:1000,etat:"due"}]}));
verifier("un business dont tout est déjà reçu n'a plus de tranche, et c'est permis", null,
  C.exigeUneDate("engagement", {origine:"business", tranches:[]}));
verifier("le dû met la société parmi ceux qui me doivent", 900000, C.soldeTiers(d10, 1));
verifier("sans qu'aucun argent ait bougé", 100000, C.liquidites(d10));
verifier("il compte dans la position nette", 1000000, C.patrimoine(d10).nette);
verifier("mais pas dans les entrées du mois", [0, 0], (function(b){ return [b.entre, b.sorti]; })(C.bilanDuMois(d10, "2026-10-13")));
verifier("ce qui reste à encaisser sur le business", 900000, C.duBusiness(d10));
verifier("les tranches non datées sont dans « sans date »", 2, C.sansDate(d10).length);
verifier("et ne font qu'une suggestion, rangée avec l'entretien, qui ouvre l'échéancier", [["Dater","échéance à fixer",4,"echeancier"]],
  C.suggestions(d10, "2026-10-13").filter(function(x){ return x.verbe === "Dater"; })
    .map(function(x){ return [x.verbe, x.detail, x.rang, x.ref.type]; }));
vrai("ce qui tombe cette semaine passe avant un business à dater",
  (function(l){ var e = -1, dt = -1; l.forEach(function(x, k){ if (x.verbe === "Encaisser") e = k; if (x.verbe === "Dater") dt = k; }); return e >= 0 && e < dt; })(C.suggestions(d10, "2026-10-13")));
vrai("un prêt sans date, lui, reste une urgence",
  C.suggestions({tiers:[{id:1,nom:"X"}], engagements:[{id:1,tiers:1,sens:"creance",objet:"Prêt",tranches:[{date:null,montant:1000,etat:"due"}]}]},
    "2026-10-13", {debutant:true})[0].rang === 2);
vrai("la tranche datée, elle, est à encaisser cette semaine",
  C.suggestions(d10, "2026-10-13").some(function(x){ return x.verbe === "Encaisser" && x.montant === 400000; }));
/* une tranche encaissée */
C.appliquerVersement(d10.engagements[0], 400000, "2026-10-20");
d10.mouvements.push({id:2,date:"2026-10-20",tiers:1,nature:"remboursement_recu",montant:400000,compte:1,engagement:1,cat:"Affaires"});
verifier("une tranche encaissée fait baisser le dû", [500000, 500000, 500000],
  [C.soldeTiers(d10, 1), C.duBusiness(d10), C.liquidites(d10)]);
verifier("la position nette ne bouge pas : la créance est devenue de l'argent", 1000000, C.patrimoine(d10).nette);
verifier("et cette fois, c'est une entrée du mois", 400000, C.bilanDuMois(d10, "2026-10-21").autresEntrees);
verifier("l'échéancier et les mouvements tombent juste", 0, C.incoherences(d10).length);

/* --------------------------------------------- business : validé ou annoncé
   Les formes réelles : montant annoncé pas encore validé avec une étape,
   montant validé avec une tranche datée et le reste non, une partie déjà
   reçue avant le carnet. */
var d11 = {
  tiers:[{id:1,nom:"Une usine"},{id:2,nom:"Un associé"},{id:3,nom:"Une coopérative"}],
  comptes:[{id:1,nom:"Banque",type:"banque",soldeInitial:0}],
  mouvements:[
    {id:1,date:"2026-10-13",tiers:2,nature:"du_affaire",montant:1000000,compte:null,engagement:2},
    {id:2,date:"2026-10-13",tiers:3,nature:"du_affaire",montant:1300000,compte:null,engagement:3}],
  engagements:[
    {id:1,tiers:1,sens:"creance",origine:"business",objet:"Appli usine",valide:false,
     etape:"Livrer la bêta",etapeDate:"2026-10-16",tranches:[{date:null,montant:6000000,etat:"due"}]},
    {id:2,tiers:2,sens:"creance",origine:"business",objet:"Chantier",avecAussi:"un second",
     tranches:[{date:"2026-10-16",montant:500000,etat:"due"},{date:null,montant:500000,etat:"due"}]},
    {id:3,tiers:3,sens:"creance",origine:"business",objet:"Appli coop",dejaRecu:700000,dejaRecuNote:"mobile money, chèque",
     tranches:[{date:null,montant:1300000,etat:"due"}]},
    {id:4,tiers:1,sens:"creance",origine:"business",objet:"Ancien",dejaRecu:50000,tranches:[]}
  ]};
var bz = C.business(d11);
verifier("en cours, à valider, terminés", [["Chantier","Appli coop"],["Appli usine"],["Ancien"]],
  [bz.enCours, bz.aValider, bz.termines].map(function(l){ return l.map(function(e){ return e.objet; }); }));
verifier("à encaisser : seulement ce qui est validé", 2300000, bz.aEncaisser);
verifier("l'annoncé est compté à part", 6000000, bz.annonce);
verifier("déjà encaissé : ce qui a été reçu avant le carnet compte", 750000, bz.encaisse);
verifier("un montant annoncé n'est dû par personne", 0, C.soldeTiers(d11, 1));
verifier("et n'entre pas dans la position nette", 2300000, C.patrimoine(d11).nette);
verifier("le total d'un business compte ce qui a été reçu avant", [2000000, 700000, 1300000],
  [C.totalBusiness(d11.engagements[2]), C.recuBusiness(d11.engagements[2]), C.resteEngagement(d11.engagements[2])]);
verifier("la prochaine chose d'un business annoncé est son étape", ["etape","2026-10-16","Livrer la bêta"],
  (function(p){ return [p.genre, p.date, p.libelle]; })(C.prochainBusiness(d11.engagements[0])));
verifier("celle d'un business validé, sa tranche datée", ["tranche", 500000],
  (function(p){ return [p.genre, p.montant]; })(C.prochainBusiness(d11.engagements[1])));
verifier("l'agenda rappelle l'étape et la tranche, pas le montant non validé", ["etape","encaisser"],
  C.agenda(d11).map(function(x){ return x.genre; }));
verifier("à dater : les tranches validées sans date, pas le montant annoncé", ["Chantier","Appli coop"],
  C.sansDate(d11).map(function(x){ return x.titre; }));
d11.engagements[0].etapeDate = null;
verifier("un business annoncé sans étape datée remonte : plus rien ne le rappellerait", "opportunité sans étape datée",
  C.sansDate(d11).filter(function(x){ return x.titre === "Appli usine"; })[0].detail);
verifier("plusieurs business à dater : une seule ligne (deux tranches sans date, un annoncé sans étape)", ["à dater, comme 2 autres business"],
  C.suggestions(d11, "2026-10-13", {debutant:true}).filter(function(x){ return x.verbe === "Dater"; }).map(function(x){ return x.detail; }));
verifier("la suggestion d'une étape porte le verbe « Avancer » et ouvre la fiche", ["Avancer","business"],
  (function(){ d11.engagements[0].etapeDate = "2026-10-16";
    var x = C.suggestions(d11, "2026-10-13", {debutant:true}).filter(function(y){ return y.genre === "etape"; })[0];
    return [x.verbe, x.ref.type]; })());

/* ------------------------------------------------------ contrôle à l'entrée
   Un carnet venu de l'extérieur est relu avant d'être accepté : les écrans
   collent les identifiants dans le code des boutons. */
function abime(f){ var c = JSON.parse(JSON.stringify(d11)); f(c); return C.defautsCarnet(c); }
verifier("un carnet sain n'a aucun défaut", [0, 0, 0, 0], [d7, d9, d10, d11].map(function(c){ return C.defautsCarnet(c).length; }));
vrai("un identifiant qui n'est pas un nombre est refusé", abime(function(c){ c.engagements[0].id = "1);alert(1);//"; })[0].indexOf("identifiant invalide") > 0);
vrai("une référence à un tiers aussi", abime(function(c){ c.engagements[0].tiers = "2);x()//"; }).length === 1);
vrai("un montant en texte est refusé", abime(function(c){ c.mouvements[0].montant = "1;background:url(x)"; }).length === 1);
vrai("une date qui n'en est pas une est refusée", abime(function(c){ c.mouvements[0].date = "<b>hier</b>"; }).length === 1);
vrai("une tranche abîmée est refusée", abime(function(c){ c.engagements[1].tranches[0].montant = "500000"; }).length === 1);
vrai("une liste qui n'en est pas une est refusée", abime(function(c){ c.tiers = {0:{id:1}}; }).length === 1);
vrai("un rythme abîmé est refusé", C.defautsCarnet({recurrents:[{id:1, rythme:{type:"mensuel", jour:"5);x()"}}]}).length === 1);
vrai("un plafond de mois abîmé est refusé", C.defautsCarnet({enveloppes:[{id:1, montant:10, montantsParMois:{"octobre":10}}]}).length === 1);
verifier("ce qui n'est pas un carnet est refusé", [1, 1, 1], [null, [], "texte"].map(function(x){ return C.defautsCarnet(x).length; }));
verifier("« auto » n'est une date que dans un fichier de départ", [0, 1],
  [C.defautsCarnet({recurrents:[{id:1, prochaine:"auto"}]}, {depart:true}).length, C.defautsCarnet({recurrents:[{id:1, prochaine:"auto"}]}).length]);
verifier("un ancien comptage d'espèces sans identifiant reste accepté", 0, C.defautsCarnet({pointages:[{date:"2026-10-01", compte:1}]}).length);
vrai("la liste des défauts est bornée", C.defautsCarnet({tiers:new Array(60).join("x").split("").map(function(){ return {id:"x"}; })}).length <= 20);
vrai("le compte des erreurs du verrou reste dans l'appareil", C.pourEnvoi({reglages:{verrouEssais:{n:3, quand:1}, cats:[]}}).reglages.verrouEssais === undefined);

/* ----------------------------------------------------------------- bilan */
var sortie = "\n" + reussis + " vérifications passées";
if (echecs.length) sortie += ", " + echecs.length + " ÉCHEC(S) :\n\n  ✗ " + echecs.join("\n  ✗ ") + "\n";
else sortie += ", aucun échec.\n";
sortie;
