// Bumped alongside index.html's APP_VERSION -- no build step, so the two
// files each carry their own literal copy of the number instead of sharing
// a symbol. tests/gate.js fails the build if they disagree or if index.html
// changed without this number moving.
var APP_VERSION = 85;
var CACHE_NAME = 'abc-workout-v' + APP_VERSION;
// Spoken-cue clips (audio/) live in their own cache so a version bump does
// not throw them away; bump this name only when the clips are re-recorded.
var AUDIO_CACHE = 'abc-audio-1';
// Every clip in audio/, downloaded once in the background after install so
// cues play with no signal (row 88). tests/voice.spec.js checks this list
// matches the folder.
var CLIPS = ['cue-bss-a','cue-bss-c','cue-carry-a','cue-carry-b','cue-carry-mc','cue-ohp','cue-pullup','cue-pullup-mc','cue-pushup','cue-row','cue-sldl-b','cue-sldl-c','cue-tgu','first-bulgarian-split-squats-3-8-10-leg','first-carries-3-40-yd-side','first-farmer-s-carry-3-40-yd-side','first-pull-ups-chin-ups-3-max-reps','first-push-ups-3-8-15','first-sa-overhead-press-3-8-10-arm','first-single-arm-rows-3-8-12-arm','first-single-leg-deadlifts-3-8-10-leg','first-suitcase-carry-3-40-yd-side','first-turkish-get-up-1-5-side','lb-10','lb-100','lb-102-5','lb-105','lb-107-5','lb-110','lb-112-5','lb-115','lb-117-5','lb-12-5','lb-120','lb-122-5','lb-125','lb-127-5','lb-130','lb-132-5','lb-135','lb-137-5','lb-140','lb-142-5','lb-145','lb-147-5','lb-15','lb-150','lb-152-5','lb-155','lb-157-5','lb-160','lb-162-5','lb-165','lb-167-5','lb-17-5','lb-170','lb-172-5','lb-175','lb-177-5','lb-180','lb-182-5','lb-185','lb-187-5','lb-190','lb-192-5','lb-195','lb-197-5','lb-2-5','lb-20','lb-200','lb-202-5','lb-205','lb-207-5','lb-210','lb-212-5','lb-215','lb-217-5','lb-22-5','lb-220','lb-222-5','lb-225','lb-227-5','lb-230','lb-232-5','lb-235','lb-237-5','lb-240','lb-242-5','lb-245','lb-247-5','lb-25','lb-250','lb-252-5','lb-255','lb-257-5','lb-260','lb-262-5','lb-265','lb-267-5','lb-27-5','lb-270','lb-272-5','lb-275','lb-277-5','lb-280','lb-282-5','lb-285','lb-287-5','lb-290','lb-292-5','lb-295','lb-297-5','lb-30','lb-300','lb-32-5','lb-35','lb-37-5','lb-40','lb-42-5','lb-45','lb-47-5','lb-5','lb-50','lb-52-5','lb-55','lb-57-5','lb-60','lb-62-5','lb-65','lb-67-5','lb-7-5','lb-70','lb-72-5','lb-75','lb-77-5','lb-80','lb-82-5','lb-85','lb-87-5','lb-90','lb-92-5','lb-95','lb-97-5','next-bulgarian-split-squats-3-8-10-leg','next-carries-3-40-yd-side','next-farmer-s-carry-3-40-yd-side','next-pull-ups-chin-ups-3-max-reps','next-push-ups-3-8-15','next-sa-overhead-press-3-8-10-arm','next-single-arm-rows-3-8-12-arm','next-single-leg-deadlifts-3-8-10-leg','next-suitcase-carry-3-40-yd-side','next-turkish-get-up-1-5-side','reps-40-yd-side','reps-5-side','reps-8-10-arm','reps-8-10-leg','reps-8-12-arm','reps-8-15','reps-max-reps','rest-105','rest-120','rest-135','rest-150','rest-165','rest-180','rest-30','rest-45','rest-60','rest-75','rest-90','session-done','set-bulgarian-split-squats-1-of-3','set-bulgarian-split-squats-2-of-3','set-bulgarian-split-squats-3-of-3','set-carries-1-of-3','set-carries-2-of-3','set-carries-3-of-3','set-farmer-s-carry-1-of-3','set-farmer-s-carry-2-of-3','set-farmer-s-carry-3-of-3','set-pull-ups-chin-ups-1-of-3','set-pull-ups-chin-ups-2-of-3','set-pull-ups-chin-ups-3-of-3','set-push-ups-1-of-3','set-push-ups-2-of-3','set-push-ups-3-of-3','set-sa-overhead-press-1-of-3','set-sa-overhead-press-2-of-3','set-sa-overhead-press-3-of-3','set-single-arm-rows-1-of-3','set-single-arm-rows-2-of-3','set-single-arm-rows-3-of-3','set-single-leg-deadlifts-1-of-3','set-single-leg-deadlifts-2-of-3','set-single-leg-deadlifts-3-of-3','set-suitcase-carry-1-of-3','set-suitcase-carry-2-of-3','set-suitcase-carry-3-of-3','set-turkish-get-up-1-of-1','ten-seconds','voice-on'];
function precacheClips() {
  return caches.open(AUDIO_CACHE).then(function(cache) {
    return CLIPS.reduce(function(p, k) {
      return p.then(function() {
        var url = new URL('./audio/' + k + '.mp3', self.location).href;
        return cache.match(url, { ignoreVary: true }).then(function(hit) {
          if (hit) return;
          return fetch(url).then(function(r) { if (r.ok && r.status === 200) return cache.put(url, r); });
        }).catch(function() {});
      });
    }, Promise.resolve());
  });
}
// Audio elements ask for byte ranges (206). Answer from the cached whole
// file: the full body, or the requested slice with a 206 and Content-Range.
function rangeReply(resp, request) {
  var range = request.headers.get('range');
  if (!range) return resp;
  return resp.arrayBuffer().then(function(buf) {
    var m = /bytes=(\d*)-(\d*)/.exec(range) || [];
    var len = buf.byteLength;
    var start = m[1] ? parseInt(m[1], 10) : (m[2] ? Math.max(0, len - parseInt(m[2], 10)) : 0);
    var end = m[1] && m[2] ? Math.min(parseInt(m[2], 10), len - 1) : len - 1;
    if (start >= len) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + len } });
    return new Response(buf.slice(start, end + 1), { status: 206, headers: {
      'Content-Type': 'audio/mpeg', 'Accept-Ranges': 'bytes',
      'Content-Range': 'bytes ' + start + '-' + end + '/' + len,
      'Content-Length': String(end - start + 1) } });
  });
}
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      var local = cache.addAll([new Request('./', { cache: 'reload' }), new Request('./index.html', { cache: 'reload' })]);
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
    }).then(function() {
      return precacheClips().catch(function() {});
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
  if (url.indexOf(self.location.origin) === 0 && url.indexOf('/audio/') !== -1) {
    var clipUrl = url.split('#')[0];
    event.respondWith(caches.open(AUDIO_CACHE).then(function(cache) {
      return cache.match(clipUrl, { ignoreVary: true }).then(function(hit) {
        if (hit) return rangeReply(hit, event.request);
        return fetch(clipUrl).then(function(r) {
          if (!r.ok || r.status !== 200) return r;
          cache.put(clipUrl, r.clone());
          return rangeReply(r, event.request);
        });
      });
    }).catch(function() {
      return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
    }));
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
