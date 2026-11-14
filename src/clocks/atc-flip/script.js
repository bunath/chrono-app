/* ATC Vintage Radio Flip Clock — portage hors connexion.
 * La partie « radio » (bouton + lecteur audio) du pen d'origine a été retirée. */

function setGroup(prefix, count, value) {
  var outgoing = (value - 1 + count) % count;
  for (var i = 0; i < count; i++) {
    var el = document.getElementById(prefix + '-' + i);
    var cls = 'number';
    if (i === value) cls += ' is-active';
    else if (i === outgoing) cls += ' outgoing';
    if (el.className !== cls) el.className = cls;
  }
}

var ampmEl = document.getElementById('ampm');
var secondsEl = document.getElementById('seconds');
secondsEl.style.animationPlayState = 'running';

// Le tambour des secondes est une animation CSS : on la recale sur l'heure réelle
// au démarrage et dès qu'elle dérive (page masquée puis réaffichée, par exemple).
function syncSeconds(force) {
  var t = chronoNow();
  var s = t.getSeconds() + t.getMilliseconds() / 1000;
  var a = secondsEl.getAnimations ? secondsEl.getAnimations()[0] : null;
  if (!a) return;
  var cur = ((a.currentTime || 0) / 1000) % 60;
  var diff = Math.abs(cur - s);
  diff = Math.min(diff, 60 - diff);
  if (force || diff > 0.5) a.currentTime = s * 1000;
}

function tick() {
  var t = chronoNow();
  var h = t.getHours(), m = t.getMinutes();
  var ampm = h >= 12 ? 'pm' : 'am';
  h = h % 12;
  h = h ? h : 12;                       // 0 h -> 12
  var hh = ('0' + h).slice(-2), mm = ('0' + m).slice(-2);
  setGroup('minutes-dizaines', 6, +mm[0]);
  setGroup('minutes-unites', 10, +mm[1]);
  setGroup('hours-dizaines', 2, +hh[0]);
  setGroup('hours-unites', 10, +hh[1]);
  var label = '<span>' + ampm + '</span>';
  if (ampmEl.innerHTML !== label) ampmEl.innerHTML = label;
  syncSeconds(false);
}

// L'unité de mesure suit la fenêtre (carte ou plein écran) : tout le décor est proportionnel.
function fitUnit() {
  var u = Math.max(2, Math.min(innerWidth / 92, innerHeight / 44));
  document.documentElement.style.setProperty('--u', u + 'px');
}
fitUnit();
addEventListener('resize', fitUnit);

tick();
syncSeconds(true);
setInterval(tick, 250);
document.addEventListener('visibilitychange', function () { syncSeconds(true); });
