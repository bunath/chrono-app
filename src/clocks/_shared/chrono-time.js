/* Outils communs aux horloges (fonctionnent hors connexion).
 *
 *  chronoNow()  -> un objet Date dont getHours()/getMinutes()/getSeconds()/... donnent
 *                  l'heure du fuseau choisi dans l'application (paramètre ?tz=… ou message).
 *  chronoFit()  -> met à l'échelle un "décor" de taille fixe pour qu'il remplisse la fenêtre.
 */
(function () {
  var tz = new URLSearchParams(location.search).get('tz') || 'local';
  var offset = 0, last = 0, fmt = null, fmtTz = null;
  var FIELDS = ['Hours', 'Minutes', 'Seconds', 'Milliseconds', 'Day', 'Date', 'Month', 'FullYear'];

  function recalc(now) {
    last = now;
    if (tz === 'local') { offset = 0; return; }
    try {
      if (fmtTz !== tz) {
        fmt = new Intl.DateTimeFormat('en-US', {
          timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
        fmtTz = tz;
      }
      var p = {};
      fmt.formatToParts(new Date(now)).forEach(function (x) { p[x.type] = x.value; });
      var wall = Date.UTC(+p.year, +p.month - 1, +p.day, (+p.hour) % 24, +p.minute, +p.second);
      offset = wall - Math.floor(now / 1000) * 1000;
    } catch (e) { offset = 0; }
  }

  window.chronoNow = function () {
    var n = Date.now();
    if (n - last > 1000) recalc(n);
    if (tz === 'local') return new Date(n);
    var d = new Date(n + offset);
    FIELDS.forEach(function (k) {
      d['get' + k] = function () { return Date.prototype['getUTC' + k].call(d); };
    });
    return d;
  };

  window.addEventListener('message', function (e) {
    if (e.data && e.data.type === 'chrono-tz') { tz = e.data.tz || 'local'; last = 0; }
  });

  window.chronoFit = function (stage, w, h, margin) {
    margin = margin || 0.94;
    var s = stage.style;
    s.position = 'fixed'; s.left = '50%'; s.top = '50%';
    s.width = w + 'px'; s.height = h + 'px';
    function fit() {
      var k = Math.min(innerWidth / w, innerHeight / h) * margin;
      s.transform = 'translate(-50%,-50%) scale(' + k + ')';
    }
    window.addEventListener('resize', fit);
    fit();
  };
})();
