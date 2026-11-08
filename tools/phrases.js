// Builds the list of spoken-cue clips (key -> text) from the app's own data.
// Used by tools/make-audio.py; re-run both when exercises, form cues, rep
// targets or rest options change. Keys must match clipKey helpers in index.html.
'use strict';
var x = require('../tests/extract.js');
var html = x.readIndex();
var src = x.inlineScript(html, 2);
var sec3 = x.sliceBetween(src, /^\/\/ 3\. /, /^\/\/ 4\. /, 'section 3');
var api = new Function(sec3.replace(/^\/\/ =+$/gm, '') + '\nreturn {SESSIONS:SESSIONS,FORM_CUES:FORM_CUES};')();
function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
function sayReps(r) { return String(r || '').replace(/(\d+)-(\d+)/g, '$1 to $2').replace(/\s*yd\b/g, ' yards').replace(/\//g, ' per '); }
// How a label is said out loud, where the on-screen text reads badly.
var SPOKEN = { 'Pull-Ups / Chin-Ups': 'Pull-ups or chin-ups', 'SA Overhead Press': 'Single-arm overhead press' };
function say(lb) { return SPOKEN[lb] || lb; }
var out = {};
out['ten-seconds'] = 'Ten seconds.';
out['session-done'] = 'Session done. Tap Complete Session.';
out['voice-on'] = 'Voice on.';
for (var r = 45; r <= 180; r += 15) out['rest-' + r] = 'Rest ' + (r % 60 === 0 ? (r / 60) + (r === 60 ? ' minute.' : ' minutes.') : r + ' seconds.');
for (var w = 2.5; w <= 300; w += 2.5) out['lb-' + String(w).replace('.', '-')] = w + ' pounds.';
Object.keys(api.SESSIONS).forEach(function (sk) {
  api.SESSIONS[sk].exercises.forEach(function (ex) {
    var labels = [ex.name];
    if (ex.isCarry) labels.push(ex.name.replace('Suitcase Carry', "Farmer's Carry").replace('Carries', "Farmer's Carry"));
    labels.forEach(function (lb) {
      for (var k = 1; k <= ex.sets; k++) out['set-' + slug(lb) + '-' + k + '-of-' + ex.sets] = say(lb) + ', set ' + k + ' of ' + ex.sets + '.';
      ['first', 'next'].forEach(function (lead) {
        out[lead + '-' + slug(lb) + '-' + ex.sets + '-' + slug(ex.reps)] = (lead === 'first' ? 'First: ' : 'Next: ') + say(lb) + ', ' + ex.sets + (ex.sets === 1 ? ' set of ' : ' sets of ') + sayReps(ex.reps) + '.';
      });
    });
    out['reps-' + slug(ex.reps)] = sayReps(ex.reps) + '.';
    var fc = (api.FORM_CUES[ex.id] || [])[0];
    if (fc) out['cue-' + ex.id] = fc + '.';
  });
});
process.stdout.write(JSON.stringify(out, null, 1));
