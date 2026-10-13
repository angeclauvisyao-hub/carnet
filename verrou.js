/* Clauvi's Carnet — le verrou : Face ID, code de secours, rideau.

   Ce que ce fichier fait : il empêche quelqu'un qui tient le téléphone
   DÉVERROUILLÉ d'ouvrir le carnet. Face ID d'abord, le code en secours, et
   un rideau qui tombe dès que l'app passe en arrière-plan.

   Ce qu'il ne fait pas, et il faut le savoir : il ne chiffre pas les données.
   C'est une porte, pas un coffre. Ce qui chiffre, c'est l'iPhone lui-même
   quand il est verrouillé, et la sauvegarde exportée. Il n'y a pas de serveur
   pour vérifier la signature de Face ID : on demande à l'appareil de
   reconnaître son propriétaire et on lit sa réponse. Contre un curieux qui
   prend le téléphone posé sur la table, c'est exactement ce qu'il faut.
   Contre quelqu'un qui branche le téléphone déverrouillé à un ordinateur
   avec des outils de développeur, ça ne suffit pas — rien de local ne suffit. */

var Verrou = (function(){
  "use strict";

  var DELAI_SECONDES = 60;   // temps en arrière-plan toléré sans redemander
  var disponible = null;     // Face ID utilisable ici ? null tant qu'on ne sait pas
  var cacheDepuis = null;    // instant où l'app est passée en arrière-plan
  var demarre = false;       // l'app a-t-elle déjà été ouverte une fois ?
  var enCours = false;       // une demande Face ID est-elle déjà affichée ?

  function el(i){ return document.getElementById(i); }
  function R(){ return Carnet.donnees().reglages; }
  function actif(){ var r = R(); return !!(r && (r.verrou || r.biometrie)); }
  function nomBiometrie(){
    return /iPhone|iPad|iPod/.test((typeof navigator !== "undefined" && navigator.userAgent) || "")
      ? "Face ID" : "la biométrie de l'appareil";
  }

  /* ------------------------------------------------------------ outils */
  function b64(buf){
    var o = "", u = new Uint8Array(buf);
    for (var i = 0; i < u.length; i++) o += String.fromCharCode(u[i]);
    return btoa(o);
  }
  function deB64(s){
    var b = atob(s), u = new Uint8Array(b.length);
    for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
    return u;
  }
  function alea(n){ return crypto.getRandomValues(new Uint8Array(n)); }
  function empreinte(code){
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode("carnet:" + code))
      .then(function(b){ return b64(b); });
  }

  /* ----------------------------------------------- décisions (testées)
     Les deux seules décisions de sécurité du fichier sont des fonctions
     pures, pour qu'un test les tienne sans téléphone. */

  /* L'appareil répond avec un bloc d'octets dont le 33e porte des drapeaux.
     Le bit 0x04 (« user verified ») dit que le visage, l'empreinte ou le code
     de l'appareil a bien été vérifié — pas seulement qu'on a touché l'écran
     (bit 0x01). On exige 0x04 : une simple présence ne suffit pas. */
  function proprietaireVerifie(donneesAuthentificateur){
    if (!donneesAuthentificateur) return false;
    var u = new Uint8Array(donneesAuthentificateur);
    return u.length > 32 && (u[32] & 0x04) === 0x04;
  }

  /* Revenir d'un coup d'œil à un SMS ne doit pas redemander le visage ;
     revenir après une réunion, si. */
  function doitRedemander(cacheDepuisMs, maintenantMs){
    return cacheDepuisMs != null && (maintenantMs - cacheDepuisMs) >= DELAI_SECONDES * 1000;
  }

  /* Un code à quatre chiffres se devine en essayant : après cinq erreurs,
     on fait attendre, et de plus en plus — 30 secondes, puis le double à
     chaque nouvelle erreur, jusqu'à un quart d'heure. Le compte des erreurs
     est gardé dans l'appareil : fermer et rouvrir l'app ne le remet pas à zéro.
     Rend le temps restant à attendre, en millisecondes (0 = on peut essayer). */
  var ESSAIS_LIBRES = 5;
  function attente(erreurs, derniereMs, maintenantMs){
    if (!erreurs || erreurs < ESSAIS_LIBRES) return 0;
    var duree = Math.min(15 * 60, 30 * Math.pow(2, erreurs - ESSAIS_LIBRES)) * 1000;
    return Math.max(0, (derniereMs || 0) + duree - maintenantMs);
  }
  function enClair(ms){
    var s = Math.ceil(ms / 1000);
    return s < 60 ? s + " s" : Math.ceil(s / 60) + " min";
  }

  /* -------------------------------------------------- disponibilité
     Face ID passe par WebAuthn, qui exige une vraie adresse en HTTPS et
     refuse de marcher dans une page affichée à l'intérieur d'une autre.
     On pose la question à l'appareil plutôt que de deviner. */
  function sonder(){
    try {
      if (typeof window === "undefined" || !window.PublicKeyCredential
          || !navigator.credentials || !window.isSecureContext) { disponible = false; return; }
      if (window.self !== window.top) { disponible = false; return; }
      window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then(function(oui){ disponible = !!oui; if (Carnet.etat().vue === "reglages") Carnet.rendre(); })
        .catch(function(){ disponible = false; });
    } catch (e) { disponible = false; }
  }

  /* ----------------------------------------------------------- Face ID */
  function activerBiometrie(){
    if (!R().verrou) return Carnet.toast("Mets d'abord un code : il sert de secours.");
    navigator.credentials.create({publicKey:{
      challenge:alea(32),
      rp:{name:"Clauvi's Carnet"},
      user:{id:alea(16), name:"carnet", displayName:"Mon carnet"},
      pubKeyCredParams:[{type:"public-key", alg:-7}, {type:"public-key", alg:-257}],
      authenticatorSelection:{authenticatorAttachment:"platform", userVerification:"required",
                              residentKey:"preferred"},
      timeout:60000, attestation:"none"
    }}).then(function(cred){
      if (!cred || !cred.rawId) throw new Error("L'appareil n'a rien renvoyé.");
      R().biometrie = {id:b64(cred.rawId), depuis:Calculs.aujourdhui()};
      return Carnet.enregistrer(true);
    }).then(function(){
      Carnet.toast(nomBiometrie() + " activé");
      Carnet.rendre();
    }).catch(function(e){
      Carnet.toast("Activation abandonnée" + (e && e.name === "NotAllowedError" ? "" : " : " + (e && e.message || e)));
    });
  }
  function retirerBiometrie(){
    R().biometrie = null;
    Carnet.enregistrer(true).then(function(){ Carnet.toast("Face ID retiré, le code reste"); Carnet.rendre(); });
  }

  function demanderBiometrie(){
    var b = R().biometrie;
    if (!b || enCours) return;
    enCours = true;
    message("Regarde ton téléphone…");
    var demande;
    /* Une erreur ici (appareil sans biométrie, donnée abîmée) ne doit jamais
       ouvrir le carnet ni le planter : on reste fermé, le code reste là. */
    try {
      demande = navigator.credentials.get({publicKey:{
        challenge:alea(32),
        allowCredentials:[{type:"public-key", id:deB64(b.id), transports:["internal"]}],
        userVerification:"required", timeout:60000
      }});
    } catch (e) {
      enCours = false;
      return message("Face ID ne répond pas ici. Entre ton code.");
    }
    demande.then(function(a){
      enCours = false;
      if (a && a.response && proprietaireVerifie(a.response.authenticatorData)) return ouvrir();
      message("L'appareil n'a pas confirmé que c'est toi. Utilise le code.");
    }).catch(function(){
      /* Refus, annulation, ou Safari qui exige un geste : dans tous les cas
         on reste fermé, et le bouton comme le code restent disponibles. */
      enCours = false;
      message("Touche le bouton pour réessayer, ou entre ton code.");
    });
  }

  /* -------------------------------------------------------------- écran */
  function message(texte){ var m = el("msg-verrou"); if (m) m.textContent = texte; }

  function exiger(){
    var r = R(), z = el("verrou");
    z.hidden = false;
    z.innerHTML = '<div class="verrou"><h1>Clauvi\'s Carnet</h1>'
      + (r.biometrie ? '<button class="bouton-verrou" onclick="Verrou.demanderBiometrie()">Déverrouiller avec '
          + nomBiometrie() + '</button>' : '')
      + (r.verrou ? '<input id="f-verrou" type="password" inputmode="numeric" autocomplete="off" '
          + 'placeholder="code" onkeydown="if(event.key===\'Enter\')Verrou.essayerCode()">'
          + '<button class="bouton-verrou second" onclick="Verrou.essayerCode()">Ouvrir avec le code</button>' : '')
      + '<p id="msg-verrou">' + (r.biometrie ? '' : 'Entre ton code.') + '</p></div>';
    if (r.biometrie) demanderBiometrie();
    else { try { el("f-verrou").focus(); } catch (e) {} }
  }

  function essayerCode(){
    var champ = el("f-verrou");
    if (!champ) return;
    var r = R(), e = r.verrouEssais || {n:0, quand:0};
    var reste = attente(e.n, e.quand, Date.now());
    if (reste > 0) { champ.value = ""; return message("Trop d'erreurs. Nouvel essai dans " + enClair(reste) + "."); }
    empreinte(champ.value).then(function(h){
      if (h === r.verrou) return ouvrir();
      r.verrouEssais = {n:e.n + 1, quand:Date.now()};
      Carnet.enregistrer(true);
      var suite = attente(r.verrouEssais.n, r.verrouEssais.quand, Date.now());
      message(suite > 0 ? "Code faux. Nouvel essai dans " + enClair(suite) + "." : "Code faux. Réessaie.");
      champ.value = "";
    });
  }

  function ouvrir(){
    var z = el("verrou");
    z.innerHTML = ""; z.hidden = true;
    cacheDepuis = null; enCours = false;
    /* le propriétaire est entré : on oublie les erreurs passées */
    if (R().verrouEssais) { R().verrouEssais = null; Carnet.enregistrer(true); }
    if (!demarre) { demarre = true; Carnet.demarrerVraiment(); }
  }

  /* Le rideau : dès que l'app passe derrière une autre, on cache l'écran.
     iOS photographie les apps pour le sélecteur d'applications — sans rideau,
     tes soldes resteraient lisibles dans cette vignette. */
  function rideau(){
    var z = el("verrou");
    z.hidden = false;
    z.innerHTML = '<div class="verrou"><h1>Clauvi\'s Carnet</h1></div>';
  }
  function surVisibilite(){
    if (!Carnet.donnees() || !actif() || !demarre) return;
    if (document.hidden) { cacheDepuis = Date.now(); rideau(); return; }
    if (doitRedemander(cacheDepuis, Date.now())) exiger();
    else ouvrir();
  }

  /* Appelé une fois au lancement, quand les données sont lues. */
  function auDemarrage(){
    sonder();
    if (typeof document.addEventListener === "function")
      document.addEventListener("visibilitychange", surVisibilite);
    if (actif()) exiger();
    else { demarre = true; Carnet.demarrerVraiment(); }
  }

  return {
    auDemarrage:auDemarrage, actif:actif, exiger:exiger, ouvrir:ouvrir,
    demanderBiometrie:demanderBiometrie, essayerCode:essayerCode,
    activerBiometrie:activerBiometrie, retirerBiometrie:retirerBiometrie,
    empreinte:empreinte, nomBiometrie:nomBiometrie,
    disponible:function(){ return disponible; },
    proprietaireVerifie:proprietaireVerifie, doitRedemander:doitRedemander, attente:attente,
    DELAI_SECONDES:DELAI_SECONDES, surVisibilite:surVisibilite
  };
})();
