#!/usr/bin/env python3
"""Assemble l'app en un seul fichier, pour la publier et l'ouvrir au téléphone.

L'app est écrite en plusieurs fichiers (calculs, app, vues, formulaires) parce
que c'est comme ça qu'on la relit et qu'on la teste. Mais une page publiée seule
n'a droit ni au service worker ni aux fichiers voisins : on l'aplatit donc en
un fichier unique. Un seul code source, deux cibles, aucune divergence possible.

    python3 outils/fabriquer_artefact.py
"""
import io, json, os

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Deux sorties. La première embarque les données de départ : elle reste sur la
# machine. La seconde n'en contient aucune : c'est la seule qui peut être publiée.
SORTIE = os.path.join(RACINE, "artefact", "carnet.html")
SORTIE_PUBLIABLE = os.path.join(RACINE, "artefact", "carnet-sans-donnees.html")
JS = ["calculs.js", "app.js", "vues.js", "formulaires.js", "synchro.js", "verrou.js"]


def lire(nom):
    with io.open(os.path.join(RACINE, nom), encoding="utf-8") as f:
        return f.read()


def donnees_privees():
    """Les données de départ privées, si elles sont sur cette machine.

    Elles vont dans deux fichiers que git ignore : prive/depart.js (lu par
    index.html en local) et la version à fichier unique, qui n'est publiée que
    comme page privée. Le code versionné, lui, n'en contient aucune.
    """
    chemin = os.path.join(RACINE, "prive", "depart.json")
    if not os.path.exists(chemin):
        return None
    with io.open(chemin, encoding="utf-8") as f:
        brut = json.load(f)
    js = u"window.CARNET_DEPART = %s;\n" % json.dumps(brut, ensure_ascii=False)
    with io.open(os.path.join(RACINE, "prive", "depart.js"), "w", encoding="utf-8") as f:
        f.write(js)
    return js


def fabriquer(avec_donnees=True, sortie=SORTIE):
    css = lire("style.css")
    prive = donnees_privees() if avec_donnees else None
    scripts = "\n".join("/* ===== %s ===== */\n%s" % (n, lire(n)) for n in JS)
    if prive:
        scripts = u"/* ===== données de départ privées ===== */\n" + prive + scripts
    # Le corps reprend index.html sans son squelette : la page publiée reçoit
    # le sien (charset, viewport, marges de sécurité) au moment de la mise en ligne.
    page = u"""<title>Clauvi's Carnet</title>
<style>
%s
</style>

<header class="haut" id="barre-haut" hidden>
  <b>Clauvi's Carnet</b>
  <span class="jour" id="jour"></span>
  <button class="pastille-synchro" id="etat-synchro" hidden onclick="Carnet.aller('reglages')"></button>
  <button class="lien" onclick="Carnet.aller('reglages')" aria-label="Réglages">⚙</button>
</header>
<main class="ecran" id="vue"></main>
<button class="plus-rond" onclick="Formulaires.nouveau()" aria-label="Noter quelque chose">+</button>
<nav class="onglets" id="onglets" aria-label="Écrans"></nav>
<div id="couche"></div>
<div id="verrou" hidden></div>
<div id="zone-toast" aria-live="polite"></div>

<script>
%s
Carnet.demarrer();
</script>
""" % (css, scripts)
    with io.open(sortie, "w", encoding="utf-8") as f:
        f.write(page)
    return page


def verifier_publiable(page):
    """Refuse de laisser sortir une page qui contiendrait une donnée privée.

    On ne se fie pas à la bonne volonté : chaque libellé et chaque nom du
    fichier privé est cherché dans la page publiable. Un seul trouvé, et la
    fabrication échoue.
    """
    chemin = os.path.join(RACINE, "prive", "depart.json")
    if not os.path.exists(chemin):
        return []
    with io.open(chemin, encoding="utf-8") as f:
        brut = json.load(f)
    mots = [t["nom"] for t in brut.get("tiers", [])]
    mots += [r["libelle"] for r in brut.get("recurrents", []) if len(r["libelle"]) > 8]
    mots += [e["note"] for e in brut.get("enveloppes", []) if e.get("note")]
    return [m for m in mots if m in page] + (
        ["window.CARNET_DEPART ="] if "window.CARNET_DEPART =" in page else [])


if __name__ == "__main__":
    public = fabriquer(avec_donnees=False, sortie=SORTIE_PUBLIABLE)
    fuites = verifier_publiable(public)
    if fuites:
        os.remove(SORTIE_PUBLIABLE)
        raise SystemExit(u"ARRÊT : la page publiable contient des données privées : %s" % fuites)
    print(u"artefact/carnet-sans-donnees.html écrit : %d caractères — aucune donnée privée, publiable"
          % len(public))
    p = fabriquer()
    print(u"artefact/carnet.html écrit : %d caractères, %d lignes"
          % (len(p), p.count("\n") + 1))
    print(u"données de départ privées : %s"
          % (u"incluses — ce fichier ne se publie qu'en page privée"
             if u"window.CARNET_DEPART =" in p else u"absentes, l'app démarre vide"))
