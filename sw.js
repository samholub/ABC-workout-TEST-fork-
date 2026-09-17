// Bumped alongside index.html's APP_VERSION -- no build step, so the two
// files each carry their own literal copy of the number instead of sharing
// a symbol. tests/gate.js fails the build if they disagree or if index.html
// changed without this number moving.
var APP_VERSION = 27;
var CACHE_NAME = 'abc-workout-v' + APP_VERSION;
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      var local = cache.addAll(['./', './index.html']);
      var cdn = [
        'https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js'
      ].map(function(url) {
        return fetch(new Request(url, { mode: 'cors' })).then(function(r) {
          if (r.ok) return cache.put(url, r);
        }).catch(function() {});
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
        names.filter(function(name) { return name !== CACHE_NAME; })
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
    event.respondWith(
      caches.open(CACHE_NAME).then(function(cache) {
        return fetch(event.request).then(function(response) {
          if (!response.ok) {
            return cache.match(event.request).then(function(cached) {
              return cached || response;
            });
          }
          if (response.type === 'basic') cache.put(event.request, response.clone());
          return response;
        }).catch(function() {
          return cache.match(event.request).then(function(cached) {
            return cached || new Response('Offline', {
              status: 503, statusText: 'Service Unavailable'
            });
          });
        });
      })
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;
      return fetch(event.request).then(function(response) {
        if (!response || response.status !== 200) return response;
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
