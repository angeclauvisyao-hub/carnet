#!/usr/bin/env python3
"""Mettre le carnet en ligne, en une commande, sans rien laisser passer.

    python3 outils/deployer.py

Envoyer du code est un geste qu'on ne rattrape pas : une fois public, il l'est.
Ce script fait donc, dans l'ordre, tout ce qu'il faut vérifier AVANT, et
s'arrête au premier doute :

  1. tout est validé dans git (on n'envoie pas un état à moitié fait) ;
  2. les trois suites de tests passent ;
  3. les deux numéros de version (app.js et sw.js) sont identiques ;
  4. aucune donnée privée dans ce qui part : ni fichier privé suivi par git,
     ni nom ou montant du fichier de départ dans le code, les tests ou les
     messages de commit, ni adresse personnelle comme auteur ;
  5. l'envoi ;
  6. le site sert bien la nouvelle version, fichier pour fichier.

Les mots à ne pas laisser sortir ne sont pas écrits ici — ce fichier est
public. Ils sont lus dans prive/depart.json, qui ne quitte pas la machine.
"""
import hashlib, io, json, os, re, subprocess, sys, time, urllib.request

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TESTS = ["tests/regles.js", "tests/synchro.js", "tests/parcours.js"]
SERVIS = ["index.html", "app.js", "calculs.js", "vues.js", "formulaires.js", "synchro.js",
          "verrou.js", "style.css", "sw.js", "manifest.webmanifest"]
INTERDITS_EN_LIGNE = ["depart.json", "prive/depart.json", "prive/depart.js", "artefact/carnet.html"]


def git(*args):
    return subprocess.run(["git", "-C", RACINE] + list(args), capture_output=True, text=True)


def arret(message):
    print("\n  ARRÊT : " + message + "\n  Rien n'a été envoyé." if not arret.envoye
          else "\n  ATTENTION : " + message)
    sys.exit(1)
arret.envoye = False


def etape(n, texte):
    print("%d. %s" % (n, texte))


def lire(nom):
    with io.open(os.path.join(RACINE, nom), encoding="utf-8") as f:
        return f.read()


def mots_prives():
    """Ce qui trahirait le propriétaire : les noms de ses proches, les mots en
    capitales de ses libellés (un employeur, un fournisseur), le montant de
    ses revenus fixes. Cherchés sans tenir compte de la casse : la fuite
    trouvée le premier jour était un nom de variable en minuscules."""
    chemin = os.path.join(RACINE, "prive", "depart.json")
    if not os.path.exists(chemin):
        return sorted(set(mots_ajoutes()))
    with io.open(chemin, encoding="utf-8") as f:
        d = json.load(f)
    mots = set(t["nom"] for t in d.get("tiers", []) if len(t.get("nom", "")) >= 4)
    for r in d.get("recurrents", []):
        mots.update(m for m in re.findall(r"\b[A-ZÉÈÀ]{4,}\b", r.get("libelle", "")))
        if r.get("sens") == "entree":
            n = str(r.get("montant", ""))
            if len(n) >= 5:
                mots.add(n)
                mots.add("%s %s" % (n[:-3], n[-3:]))
    mots.update(mots_ajoutes())
    return sorted(mots)


def present(mot, texte):
    """Un mot se cherche partout, même collé dans un nom de variable. Précédé
    de « = », il ne se cherche qu'en mot entier : c'est pour les prénoms
    courts, qui se cachent sinon dans « change » ou « mélange »."""
    if mot.startswith("="):
        return re.search(r"(?<![a-zà-ÿ])%s(?![a-zà-ÿ])" % re.escape(mot[1:].lower()), texte) is not None
    return mot.lower() in texte


def mots_ajoutes():
    """Les noms que le fichier de départ ne connaît pas — clients, associés,
    noms de business — notés un par ligne dans prive/mots-prives.txt. Le
    fichier est privé comme le reste du dossier : la liste des noms à cacher
    est elle-même un secret."""
    chemin = os.path.join(RACINE, "prive", "mots-prives.txt")
    if not os.path.exists(chemin):
        return []
    with io.open(chemin, encoding="utf-8") as f:
        return [l.strip() for l in f if len(l.strip()) >= 4 and not l.startswith("#")]


def empreinte(octets):
    return hashlib.sha256(octets).hexdigest()


def telecharger(url):
    req = urllib.request.Request(url, headers={"Cache-Control": "no-cache"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.status, r.read()


def code_http(url):
    try:
        return telecharger(url)[0]
    except urllib.error.HTTPError as e:
        return e.code
    except Exception:
        return 0


def main():
    etape(1, "Tout est-il validé dans git ?")
    if git("status", "--porcelain").stdout.strip():
        arret("des fichiers sont modifiés mais pas validés (git status).")
    en_attente = git("rev-list", "--count", "origin/main..HEAD").stdout.strip() or "0"
    print("   oui — %s commit(s) à envoyer" % en_attente)

    etape(2, "Les tests")
    for t in TESTS:
        r = subprocess.run(["osascript", "-l", "JavaScript", t], cwd=RACINE, capture_output=True, text=True)
        sortie = (r.stdout + r.stderr).strip()
        if r.returncode != 0 or "aucun échec" not in sortie:
            print(sortie)
            arret("%s ne passe pas." % t)
        print("   %s : %s" % (t, sortie.splitlines()[0]))

    etape(3, "Les numéros de version")
    v = [re.search(r'var VERSION = "([^"]+)"', lire(f)).group(1) for f in ("app.js", "sw.js")]
    if v[0] != v[1]:
        arret("app.js est en %s et sw.js en %s." % tuple(v))
    version = v[0]
    print("   %s partout" % version)

    etape(4, "Aucune donnée privée dans ce qui part")
    suivis = git("ls-files").stdout.split("\n")
    prives = [f for f in suivis if f.startswith(("prive/", "artefact/")) or f == "depart.json"]
    if prives:
        arret("des fichiers privés sont suivis par git : %s" % ", ".join(prives))
    mots = mots_prives()
    if not mots:
        print("   (prive/depart.json absent : contrôle des noms impossible sur cette machine)")
    trouves = []
    for f in suivis:
        chemin = os.path.join(RACINE, f)
        if not f or not os.path.isfile(chemin) or f.endswith(".png"):
            continue
        texte = lire(f).lower()
        trouves += ["%s : « %s »" % (f, m) for m in mots if present(m, texte)]
    messages = git("log", "origin/main..HEAD", "--format=%B").stdout.lower()
    trouves += ["message de commit : « %s »" % m for m in mots if present(m, messages)]
    auteurs = set(git("log", "origin/main..HEAD", "--format=%ae%n%ce").stdout.split())
    trouves += ["adresse personnelle dans un commit : %s" % a for a in auteurs
                if a and not a.endswith("@users.noreply.github.com")]
    if trouves:
        arret("données privées trouvées :\n    " + "\n    ".join(trouves))
    print("   rien trouvé (%d mots surveillés, %d fichiers)" % (len(mots), len([f for f in suivis if f])))

    etape(5, "L'envoi")
    r = git("push", "origin", "main")
    if r.returncode != 0:
        print(r.stderr.strip())
        arret("l'envoi a échoué.")
    arret.envoye = True
    print("   envoyé : " + git("log", "-1", "--format=%h %s").stdout.strip())

    etape(6, "Le site sert-il la version %s ?" % version)
    url_push = git("remote", "get-url", "origin").stdout.strip()
    m = re.search(r"[:/]([^/:]+)/([^/]+?)(?:\.git)?$", url_push)
    site = "https://%s.github.io/%s" % (m.group(1), m.group(2))
    pret = False
    for i in range(40):
        try:
            _, js = telecharger("%s/app.js?t=%d" % (site, time.time()))
            if ('var VERSION = "%s"' % version).encode() in js and empreinte(js) == empreinte(
                    open(os.path.join(RACINE, "app.js"), "rb").read()):
                pret = True
                break
        except Exception:
            pass
        time.sleep(6)
    if not pret:
        arret("le code est envoyé, mais le site ne sert pas encore la nouvelle version. "
              "Relance ce script dans quelques minutes pour revérifier.")
    differents = []
    for f in SERVIS:
        _, octets = telecharger("%s/%s?t=%d" % (site, f, time.time()))
        if empreinte(octets) != empreinte(open(os.path.join(RACINE, f), "rb").read()):
            differents.append(f)
    if differents:
        arret("le site sert des fichiers différents de ceux testés : %s" % ", ".join(differents))
    fuites = [f for f in INTERDITS_EN_LIGNE if code_http("%s/%s" % (site, f)) != 404]
    if fuites:
        arret("des fichiers privés répondent en ligne : %s" % ", ".join(fuites))
    print("   oui — %d fichiers identiques à ceux testés, aucun fichier privé en ligne" % len(SERVIS))
    print("\nEn ligne : %s  (version %s)" % (site, version))


if __name__ == "__main__":
    main()
