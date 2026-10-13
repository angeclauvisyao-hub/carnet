/* Service worker : garde l'app utilisable sans réseau.
   Il ne met en cache que le code de l'app — jamais les données, qui vivent
   dans IndexedDB et ne sortent pas du téléphone. Le nom du cache porte une
   version : au déploiement suivant, l'ancien est supprimé d'un coup. */
var VERSION = "1.19";            // le même numéro que dans app.js
var CACHE = "carnet-" + VERSION;
var FICHIERS = ["./", "index.html", "style.css", "calculs.js", "app.js", "vues.js",
                "formulaires.js", "synchro.js", "verrou.js", "manifest.webmanifest",
                "icones/icone-192.png", "icones/icone-512.png"];

self.addEventListener("install", function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(FICHIERS); })
    .then(function(){ return self.skipWaiting(); }));
});
self.addEventListener("activate", function(e){
  e.waitUntil(caches.keys().then(function(noms){
    return Promise.all(noms.filter(function(n){ return n !== CACHE; })
      .map(function(n){ return caches.delete(n); }));
  }).then(function(){ return self.clients.claim(); }));
});
/* Réseau d'abord pour avoir le code à jour, cache en secours quand il n'y a
   pas de réseau. Jamais l'inverse : une app figée sur une vieille version
   qui calcule mal est pire qu'une app qui ne s'ouvre pas. */
self.addEventListener("fetch", function(e){
  if (e.request.method !== "GET") return;
  /* Seulement les fichiers de l'app. Les échanges de synchronisation avec
     GitHub ne doivent jamais passer par le cache : relire une vieille copie
     du dépôt ferait fusionner avec le passé. */
  if (new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request).then(function(r){
      var copie = r.clone();
      caches.open(CACHE).then(function(c){ c.put(e.request, copie); }).catch(function(){});
      return r;
    }).catch(function(){ return caches.match(e.request); })
  );
});
