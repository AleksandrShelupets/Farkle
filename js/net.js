// net.js — AJAX до серверного рейтингу (api/leaderboard.php). Спільне сховище — JSON-файл, без БД.
// Усі помилки повертаються через cb(err, data); гра працює і без сервера (offline / file://).
// Доступ: window.Farkle.net
window.Farkle = window.Farkle || {};

(function () {
  'use strict';

  var ENDPOINT = 'api/leaderboard.php';
  var TIMEOUT = 8000;

  function req(method, body, cb) {
    if (typeof fetch !== 'function') { cb('unsupported', null); return; }

    var opts = { method: method, headers: {}, cache: 'no-store' };
    if (body) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    var url = ENDPOINT + (method === 'GET' ? '?action=list' : '');

    var ctrl = null, timer = null, done = false;
    function finish(err, data) { if (done) return; done = true; if (timer) clearTimeout(timer); cb(err, data); }

    if (typeof AbortController !== 'undefined') {
      ctrl = new AbortController();
      opts.signal = ctrl.signal;
      timer = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, TIMEOUT);
    }

    fetch(url, opts).then(function (r) {
      return r.json().then(
        function (j) { return { status: r.status, json: j }; },
        function () { return { status: r.status, json: null }; }
      );
    }).then(function (res) {
      if (res.json && res.json.ok) finish(null, res.json);
      else finish((res.json && res.json.error) || ('http-' + res.status), res.json);
    }).catch(function () { finish('network', null); });
  }

  function list(cb) { req('GET', null, cb); }
  function register(clientId, name, cb) {
    req('POST', { action: 'register', clientId: clientId, name: name }, cb);
  }
  function submit(clientId, name, stats, cb) {
    req('POST', { action: 'submit', clientId: clientId, name: name, stats: stats }, cb || function () {});
  }

  window.Farkle.net = { list: list, register: register, submit: submit };
})();
