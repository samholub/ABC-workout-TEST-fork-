// Static file server for the smoke test.
//
// The spec calls for `python3 -m http.server`, but python3 is not installed
// on this machine (`python3 --version` hits the Windows Store alias stub).
// This is the same thing in the runtime we already depend on: serve the repo
// root over plain HTTP, no caching, no rewriting.
'use strict';
var http = require('http');
var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var PORT = Number(process.env.PORT || 8123);

var TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml'
};

http.createServer(function (req, res) {
  var rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/' || rel === '') rel = '/index.html';
  var abs = path.join(ROOT, rel);

  // Never serve outside the repo root.
  if (abs.indexOf(ROOT) !== 0) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  fs.readFile(abs, function (err, buf) {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(abs)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(buf);
  });
}).listen(PORT, function () {
  console.log('serving ' + ROOT + ' on http://127.0.0.1:' + PORT);
});
