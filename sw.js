// Bumped alongside index.html's APP_VERSION -- no build step, so the two
// files each carry their own literal copy of the number instead of sharing
// a symbol. tests/gate.js fails the build if they disagree or if index.html
// changed without this number moving.
var APP_VERSION = 72;
var CACHE_NAME = 'abc-workout-v' + APP_VERSION;
// Spoken-cue clips (audio/) live in their own cache so a version bump does
// not throw them away; bump this name only when the clips are re-recorded.
var AUDIO_CACHE = 'abc-audio-1';
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      var local = cache.addAll(['./', './index.html']);
      var cdn = [
        'https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js'
      ].map(function(url) {
        // Row 59: if the CDN is unreachable, carry the previous version's copy
        // forward, since activate deletes the old cache.
        var carry = function() {
          return caches.match(url).then(function(old) { if (old) return cache.put(url, old); });
        };
        return fetch(new Request(url, { mode: 'cors' })).then(function(r) {
          if (r.ok) return cache.put(url, r);
          return carry();
        }).catch(carry);
      });
      return local.then(function() { return Promise.all(cdn); });
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(name) { return name !== CACHE_NAME && name !== AUDIO_CACHE; })
          .map(function(name) { return caches.delete(name); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function(event) {
  var url = event.request.url;
  if (event.request.mode === 'navigate') {
    // Network first, so a deploy is live on the next open. Row 60: on a weak
    // connection serve the cached page after 3s and let the network response
    // refresh the cache in the background. Only an ok, same-origin response is
    // cached (row 13: never a captive portal's page).
    var net = fetch(event.request).then(function(response) {
      if (response.ok && response.type === 'basic') {
        var copy = response.clone();
        caches.open(CACHE_NAME).then(function(cache) { cache.put(event.request, copy); });
      }
      return response;
    });
    event.waitUntil(net.catch(function() {}));
    var fromNet = net.then(function(response) {
      if (response.ok) return response;
      return caches.match(event.request).then(function(cached) { return cached || response; });
    }).catch(function() {
      return caches.match(event.request).then(function(cached) {
        return cached || new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
      });
    });
    var slow = new Promise(function(resolve) {
      setTimeout(function() {
        caches.match(event.request).then(function(cached) { if (cached) resolve(cached); });
      }, 3000);
    });
    event.respondWith(Promise.race([fromNet, slow]));
    return;
  }
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;
      return fetch(event.request).then(function(response) {
        if (!response || response.status !== 200) return response;
        if (url.indexOf('/audio/') !== -1 && url.indexOf(self.location.origin) === 0) {
          var aclone = response.clone();
          caches.open(AUDIO_CACHE).then(function(cache) { cache.put(event.request, aclone); });
          return response;
        }
        if (url.indexOf('fonts.gstatic.com') !== -1 ||
            url.indexOf('cdnjs.cloudflare.com') !== -1) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(function() {
        return new Response('Offline', {
          status: 503, statusText: 'Service Unavailable'
        });
      });
    })
  );
});
