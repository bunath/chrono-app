/* Version sans Vue.js : même rendu, aucune bibliothèque externe (hors connexion). */
var week = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM'];
var timeEl = document.getElementById('time');
var dateEl = document.getElementById('date');

function zeroPadding(num, digit) {
  var zero = '';
  for (var i = 0; i < digit; i++) zero += '0';
  return (zero + num).slice(-digit);
}
function updateTime() {
  var cd = chronoNow();
  timeEl.textContent = zeroPadding(cd.getHours(), 2) + ':' + zeroPadding(cd.getMinutes(), 2) + ':' + zeroPadding(cd.getSeconds(), 2);
  dateEl.textContent = zeroPadding(cd.getFullYear(), 4) + '-' + zeroPadding(cd.getMonth() + 1, 2) + '-' + zeroPadding(cd.getDate(), 2) + ' ' + week[cd.getDay()];
}
setInterval(updateTime, 250);
updateTime();
chronoFit(document.getElementById('stage'), 520, 150, 0.9);
