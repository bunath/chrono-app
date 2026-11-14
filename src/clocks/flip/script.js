/* Le pen d'origine est une maquette fixe (05 47) : on la fait vivre avec l'heure (HH:MM, 24 h). */
var hh = document.getElementById('hh');
var mm = document.getElementById('mm');
var clockEl = document.querySelector('.font-mono');

function pad(n) { return ('0' + n).slice(-2); }
function update() {
  var t = chronoNow();
  var h = pad(t.getHours()), m = pad(t.getMinutes());
  if (hh.textContent !== h) hh.textContent = h;
  if (mm.textContent !== m) mm.textContent = m;
}
// Mise à l'échelle selon la fenêtre (mesure réelle, la police monospace dépend du système)
function fit() {
  clockEl.style.transform = 'none';
  var w = clockEl.offsetWidth, h = clockEl.offsetHeight + 30;
  var k = Math.min(innerWidth / w, innerHeight / h) * 0.8;
  clockEl.style.transform = 'scale(' + k + ')';
}
update();
setInterval(update, 250);
addEventListener('resize', fit);
fit();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
