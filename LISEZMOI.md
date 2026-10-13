# Clauvi's Carnet

Carnet personnel : dépenses, charges fixes, créances, dettes, affaires et
position nette. Ce n'est pas une comptabilité, c'est un carnet qui ne
laisse rien tomber.

## Le principe

**Les données vivent dans l'appareil** (IndexedDB du navigateur). Aucun serveur ne
les détient en clair, jamais. La sauvegarde est un fichier chiffré par une phrase
de passe que seul son propriétaire connaît. Si la synchronisation est activée, un
dépôt privé reçoit une copie **chiffrée** du carnet, illisible sans cette phrase.

**Le code ne contient aucun chiffre personnel.** Il est fait pour être hébergé, donc
lisible par n'importe qui. Les charges, le salaire et les aides arrivent par
`prive/depart.json`, que git ignore.

## Les deux règles tenues par des tests

1. **Le solde d'un tiers est la somme de ses mouvements**, jamais un nombre saisi.
2. **Rien ne s'enregistre sans date** : un prêt sans échéance, un placement sans
   point prévu, une affaire sans prochaine action sont refusés. Ce qui n'a pas de
   date remonte dans la liste « À faire » de l'accueil, juste après les retards,
   avec le geste « Dater ». Une seule exception, voulue : le dû d'une affaire
   conclue peut s'enregistrer sans date (on connaît le montant avant le
   calendrier) — il reste alors dans « À faire » jusqu'à ce qu'il soit daté.

## Les objets

| Objet | Ce que c'est |
|---|---|
| Tiers | Une personne ou une société. Porte un solde calculé. |
| Mouvement | De l'argent qui bouge, daté. Peut tomber sans avoir été prévu. |
| Récurrent | Ce qui revient (loyer, salaire). Avance tout seul une fois réglé. Peut être « si je peux » : rappelé, jamais compté comme dû. |
| Enveloppe | Un plafond mensuel sans date (marché, caisse d'aides). Le plafond peut changer chaque mois. |
| Engagement | Une créance ou une dette, avec son échéancier. Le dû d'une affaire conclue (onglet Business) en est un : aucun argent ne sort à sa création, chaque tranche encaissée le réduit. |
| Participation | De l'argent placé dans une affaire. Comptée pour la mise, pas pour une valeur devinée. |
| Opportunité | Une affaire espérée : commission = base × taux. |

## Les fichiers

| Fichier | Rôle |
|---|---|
| `calculs.js` | Tous les calculs d'argent, sans écran. Testable sans navigateur. |
| `app.js` | Stockage, actions. |
| `vues.js` | Les écrans. Ne modifient rien. |
| `formulaires.js` | Les feuilles de saisie et la sauvegarde chiffrée. |
| `synchro.js` | Le transport de la synchronisation : lire le dépôt, déchiffrer, rechiffrer, renvoyer. |
| `verrou.js` | Face ID, code de secours, rideau en arrière-plan. |
| `index.html`, `sw.js`, `manifest.webmanifest` | L'app installable (PWA). |
| `depart-exemple.json` | Le format d'un fichier de départ, montants fictifs. |
| `prive/` | **Ignoré par git.** Les vraies données de départ et leur vérification. |
| `artefact/` | **Ignoré par git.** Versions à fichier unique, fabriquées. |

## Commandes

Tout se lance depuis la racine, sans rien installer (JavaScriptCore est dans macOS).

```bash
osascript -l JavaScript tests/regles.js      # les calculs
osascript -l JavaScript tests/synchro.js     # la fusion entre deux appareils
osascript -l JavaScript tests/parcours.js    # un mois d'usage joué sur les formulaires
osascript -l JavaScript prive/verifier.js    # les vraies données de départ (fichier privé)
python3 outils/fabriquer_artefact.py         # assemble les versions à fichier unique
python3 outils/deployer.py                   # tests, contrôles, envoi, vérification en ligne
```

`fabriquer_artefact.py` produit deux fichiers : `carnet.html` avec les données
privées (reste sur la machine) et `carnet-sans-donnees.html`, la seule version
publiable. La fabrication **échoue** si une donnée privée se retrouve dans la
seconde.

## Mettre à jour l'app

1. Modifier, puis changer le numéro de version **aux deux endroits** : `VERSION`
   dans `app.js` et dans `sw.js`. C'est ce numéro qui fait jeter l'ancien cache
   hors ligne du téléphone.
2. Valider dans git.
3. Lancer `python3 outils/deployer.py`. Il refait tourner les trois suites de
   tests, vérifie que les deux numéros de version concordent et qu'aucune donnée
   privée ne part, envoie, puis attend que le site serve la nouvelle version et
   la compare fichier pour fichier à celle qui a été testée. Il s'arrête au
   premier doute, avant d'avoir rien envoyé.
4. Sur le téléphone, la version affichée en bas des Réglages confirme l'arrivée.

L'envoi passe par une clé de déploiement limitée à ce seul dépôt : elle ne
donne accès à rien d'autre du compte.

Une mise à jour remplace le programme, jamais le carnet : les données sont dans
le téléphone, pas dans le code.

## Synchronisation entre appareils

Les appareils ne se parlent pas : chacun dépose et relit un seul fichier chiffré
(`carnet.chiffre.json`) dans un dépôt GitHub **privé**, distinct de celui du code.

- **Fusion fiche par fiche.** Chaque fiche porte la date de sa dernière
  modification ; la plus récente gagne. Une suppression laisse une trace datée,
  pour qu'une fiche effacée ne revienne pas de l'autre appareil.
- **Rien à marquer à la main dans le code.** À chaque enregistrement, le carnet est
  comparé à sa photo précédente (`Calculs.marquer`) : ce qui a changé est daté.
- **Propre à chaque appareil, jamais envoyé :** le code de verrou, Face ID, le jeton
  d'accès, la clé de chiffrement (gardée non extractible).
- **Premier lien.** Dépôt vide : le carnet y part. Carnet vierge devant un dépôt
  rempli : il le prend tel quel. Deux carnets remplis : l'app demande lequel fait
  foi, ou fusionne.
- **Restaurer ou effacer coupe la synchronisation**, pour ne pas vider l'autre
  appareil par ricochet. On choisit quel carnet fait foi en reliant de nouveau.
- **Limite connue.** La fusion se fait par fiche entière. Deux versements notés sur
  le même prêt depuis deux appareils, avant qu'ils se soient parlé, donnent deux
  mouvements mais un seul échéancier à jour : l'accueil le signale
  (`Calculs.incoherences`) au lieu de le corriger en silence.
- **Le dépôt grossit** d'une version par envoi (le fichier est compressé avant
  chiffrement). S'il devient trop lourd, en créer un neuf et choisir « ce carnet
  remplace le dépôt ».

Le jeton d'accès doit être limité à ce seul dépôt (Contents : lecture et écriture).
Il expire : l'app affiche alors « Jeton refusé » et il faut en saisir un nouveau.

## Sécurité : ce qui tient, ce qui ne tient pas

| Menace | Ce qui protège |
|---|---|
| Quelqu'un lit le dépôt ou l'adresse publique | Rien à lire : le code ne contient aucune donnée. |
| Téléphone perdu, verrouillé | Le chiffrement de l'iPhone. |
| Quelqu'un prend le téléphone déverrouillé | Face ID à l'ouverture de l'app, rideau en arrière-plan. |
| La sauvegarde tombe entre d'autres mains | AES-256-GCM, clé dérivée de la phrase de passe en 600 000 tours ; illisible sans elle. La synchronisation, elle, reste à 210 000 tours : en changer oblige à relier de nouveau chaque appareil. |
| Quelqu'un lit le dépôt de synchronisation | Même chiffrement : il n'y trouve qu'un fichier illisible. L'app refuse un dépôt public. |
| Le jeton de synchronisation fuit | Il ne donne accès qu'au fichier chiffré. On peut l'effacer ou l'abîmer, pas le lire : d'où la sauvegarde. |
| Un fichier piégé est chargé (départ, sauvegarde, copie du dépôt) | Tout carnet venu de l'extérieur est relu avant d'être accepté (`Calculs.defautsCarnet`) : un identifiant qui n'est pas un nombre, une date ou un montant mal formés, et rien n'entre. |
| Du code étranger s'exécute dans la page | La politique de sécurité de `index.html` ne laisse la page parler qu'à elle-même et à l'API de GitHub : ni requête, ni image, ni formulaire vers ailleurs. |
| Quelqu'un essaie des codes sur l'écran de verrou | Après cinq erreurs, une attente qui double à chaque essai, jusqu'à un quart d'heure. Le compte des erreurs survit à la fermeture de l'app. |
| Une suppression par erreur | Elle se reprend pendant huit secondes (« Annuler »), tant que le carnet n'a pas changé entre-temps. |
| Le compte de l'hébergeur est piraté | **Rien dans l'app.** Le programme servi peut être remplacé : double authentification obligatoire sur ce compte. |
| Téléphone déverrouillé branché à un ordinateur avec outils de développeur | **Rien.** Le verrou est une porte, pas un coffre. |
| Téléphone perdu sans sauvegarde | **Rien.** Les données n'existent nulle part ailleurs. |

## Ce qui est vérifié, et comment

- Les calculs, la fusion et les formulaires : par les trois suites de tests.
- La politique de sécurité : dans un vrai navigateur — l'app fonctionne, s'installe hors
  ligne, et un appel vers un autre site est bloqué.
- Le chiffrement, le stockage et le transport de la synchronisation : dans un vrai
  navigateur, contre un faux GitHub (conflit d'écriture, hors-ligne, suppressions).
- L'installation sur l'écran d'accueil et Face ID : sur un iPhone réel.
- La synchronisation contre le vrai service, entre un iPhone et un Mac : premier
  envoi, adoption par le second appareil sans écriture, puis aller-retour dans
  les deux sens, création et suppression comprises. Le fichier déposé ne contient
  que du chiffré.

## Ce qui n'est pas vérifié

- Le mode hors ligne sur iPhone (mode avion) : le service worker est actif et son
  cache complet à l'adresse définitive, mais l'essai sur l'appareil reste à faire.
