// ui.js — рендер DOM, консоль-лог, кубики, ввід, модалки, теми. Уся текстівка тут.
// Доступ: window.Farkle.ui
window.Farkle = window.Farkle || {};

(function () {
  'use strict';

  var scoring = window.Farkle.scoring;
  var ai = window.Farkle.ai;
  var i18n = window.Farkle.i18n;
  function t(key, params) { return i18n.t(key, params); }

  // ASCII-обличчя кубика (3 рядки по 3 символи).
  var FACES = {
    1: ['   ', ' ● ', '   '],
    2: ['●  ', '   ', '  ●'],
    3: ['●  ', ' ● ', '  ●'],
    4: ['● ●', '   ', '● ●'],
    5: ['● ●', ' ● ', '● ●'],
    6: ['● ●', '● ●', '● ●']
  };

  var el = {};        // кеш DOM-вузлів
  var handlers = {};  // колбеки в main.js
  var locked = false; // блокування вводу (хід AI / анімація)
  var rollTimer = null, rollDone = null; // анімація кидка
  var myName = '';    // ім'я поточного гравця (для підсвічування в рейтингу)
  var lbPlayers = null, lbTab = 'ai', lbError = null; // стан рейтингу

  var reducedMotion = false;
  try {
    reducedMotion = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) { reducedMotion = false; }

  function $(id) { return document.getElementById(id); }
  function randFace() { return Math.floor(Math.random() * 6) + 1; }

  function init(h) {
    handlers = h || {};
    el.menu = $('menu');
    el.game = $('game');
    el.continueBtn = $('btn-continue');
    el.menuHs = $('menu-hs');
    el.scoreboard = $('scoreboard');
    el.target = $('target');
    el.turnInfo = $('turn-info');
    el.setaside = $('setaside');
    el.diceRow = $('dice-row');
    el.hint = $('hint');
    el.console = $('console');
    el.live = $('aria-live');
    el.rollBtn = $('btn-roll');
    el.rerollBtn = $('btn-reroll');
    el.bankBtn = $('btn-bank');
    el.autoBtn = $('btn-auto');
    el.soundBtn = $('btn-sound');
    el.soundLabel = $('sound-label');
    el.nameInput = $('set-name');
    el.nameStatus = $('name-status');
    el.lbBody = $('lb-body');
    el.lbTabs = $('lb-tabs');
    el.version = $('app-version');

    document.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-action]') : null;
      if (!btn) return;
      onAction(btn.getAttribute('data-action'), btn);
    });
    document.addEventListener('keydown', onKey);
    bindSettings();
  }

  function onAction(action, btn) {
    switch (action) {
      case 'continue': call('onContinue'); break;
      case 'play-ai': call('onPlayAI'); break;
      case 'play-solo': call('onPlaySolo'); break;
      case 'rules': openModal('rules-modal'); break;
      case 'rules-close': closeModal('rules-modal'); break;
      case 'settings': call('onOpenSettings'); break;
      case 'settings-close': closeModal('settings-modal'); break;
      case 'stats': call('onOpenStats'); break;
      case 'stats-close': closeModal('stats-modal'); break;
      case 'stats-reset': openModal('confirm-modal'); break;
      case 'confirm-yes': closeModal('confirm-modal'); call('onStatsReset'); break;
      case 'confirm-no': closeModal('confirm-modal'); break;
      case 'save-name': call('onSettingChange', 'playerName', el.nameInput ? el.nameInput.value : ''); break;
      case 'leaderboard': call('onOpenLeaderboard'); break;
      case 'lb-close': closeModal('leaderboard-modal'); break;
      case 'lb-refresh': call('onLeaderboardRefresh'); break;
      case 'lb-tab': if (btn) { lbTab = btn.getAttribute('data-lb') || 'ai'; renderLb(); } break;
      case 'menu': call('onMenu'); break;
      case 'roll': if (!locked) call('onRoll'); break;
      case 'reroll': if (!locked) call('onReroll'); break;
      case 'bank': if (!locked) call('onBank'); break;
      case 'auto-select': if (!locked) call('onAutoSelect'); break;
      case 'toggle-sound': call('onToggleSound'); break;
      case 'play-again': closeModal('victory-modal'); call('onPlayAgain'); break;
      case 'menu-from-victory': closeModal('victory-modal'); call('onMenu'); break;
    }
  }

  function isKey(e, code, lat, cyr) {
    var k = (e.key || '').toLowerCase();
    return e.code === code || k === lat || k === cyr;
  }

  function topModal() {
    var ids = ['confirm-modal', 'victory-modal', 'settings-modal', 'stats-modal', 'leaderboard-modal', 'rules-modal'];
    for (var i = 0; i < ids.length; i++) {
      var m = $(ids[i]);
      if (m && !m.classList.contains('hidden')) return ids[i];
    }
    return null;
  }

  function onKey(e) {
    var modal = topModal();
    if (modal) {
      if (e.key === 'Escape') {
        closeModal(modal);
        if (modal === 'victory-modal') call('onMenu');
        e.preventDefault();
      } else if (modal === 'victory-modal' && e.key === 'Enter') {
        closeModal(modal); call('onPlayAgain'); e.preventDefault();
      }
      return;
    }

    // На головному меню гарячі клавіші вимкнено — лише кліки/тапи.
    if (!el.menu.classList.contains('hidden')) return;

    if (el.game.classList.contains('hidden')) return; // далі — лише в грі

    if (e.key === 'Escape') { call('onMenu'); return; }
    // Звук і правила можна викликати будь-коли, навіть під час ходу суперника.
    if (isKey(e, 'KeyM', 'm', 'ь')) { call('onToggleSound'); e.preventDefault(); return; }
    if (isKey(e, 'KeyH', 'h', 'р')) { openModal('rules-modal'); e.preventDefault(); return; }
    if (locked) return;

    if (e.key >= '1' && e.key <= '6') {
      call('onToggle', parseInt(e.key, 10) - 1);
      e.preventDefault();
      return;
    }
    if (e.key === 'Enter') { call('onEnter'); e.preventDefault(); }
    else if (isKey(e, 'KeyB', 'b', 'и')) { call('onBank'); e.preventDefault(); }
    else if (isKey(e, 'KeyA', 'a', 'ф')) { call('onAutoSelect'); e.preventDefault(); }
  }

  function call(name) {
    var args = [].slice.call(arguments, 1);
    if (typeof handlers[name] === 'function') handlers[name].apply(null, args);
  }

  // ---- Екрани та модалки ----
  function closeAllModals() {
    ['confirm-modal', 'rules-modal', 'settings-modal', 'stats-modal', 'leaderboard-modal', 'victory-modal'].forEach(closeModal);
  }
  function showMenu() {
    cancelRoll();
    closeAllModals();
    el.menu.classList.remove('hidden');
    el.game.classList.add('hidden');
  }
  function showGame() {
    closeAllModals();
    el.menu.classList.add('hidden');
    el.game.classList.remove('hidden');
  }
  function openModal(id) { var m = $(id); if (m) m.classList.remove('hidden'); }
  function closeModal(id) { var m = $(id); if (m) m.classList.add('hidden'); }
  function showRules(show) { if (show) openModal('rules-modal'); else closeModal('rules-modal'); }

  function setLocked(v) { locked = v; }
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme || 'green');
  }
  function setSoundButton(on) {
    if (el.soundLabel) el.soundLabel.textContent = on ? t('sound.on') : t('sound.off');
    if (el.soundBtn) el.soundBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  // Перекласти весь статичний текст у DOM за data-i18n / data-i18n-html / data-i18n-ph.
  function applyI18n() {
    document.title = t('app.title');
    document.documentElement.setAttribute('lang', i18n.getLang());
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) nodes[i].textContent = t(nodes[i].getAttribute('data-i18n'));
    var html = document.querySelectorAll('[data-i18n-html]');
    for (var h = 0; h < html.length; h++) html[h].innerHTML = t(html[h].getAttribute('data-i18n-html'));
    var ph = document.querySelectorAll('[data-i18n-ph]');
    for (var p = 0; p < ph.length; p++) ph[p].setAttribute('placeholder', t(ph[p].getAttribute('data-i18n-ph')));
  }

  // ---- Лог ----
  function log(text, cls) {
    var div = document.createElement('div');
    div.className = 'log-line ' + (cls || '');
    div.textContent = '> ' + text;
    el.console.appendChild(div);
    while (el.console.childNodes.length > 250) {
      el.console.removeChild(el.console.firstChild);
    }
    el.console.scrollTop = el.console.scrollHeight;
    if (el.live) el.live.textContent = text; // озвучення для скрінрідерів
  }
  function clearLog() { el.console.innerHTML = ''; }

  function setMenuHighscore(v) {
    if (el.menuHs) el.menuHs.textContent = String(v);
  }
  // Показати/сховати кнопку «Продовжити» в меню.
  function setContinueVisible(show) {
    if (el.continueBtn) el.continueBtn.classList.toggle('hidden', !show);
  }
  function setVersion(v) {
    if (el.version) el.version.textContent = String(v);
  }

  // ---- Анімація кидка ----
  function cancelRoll() {
    if (rollTimer) { clearInterval(rollTimer); rollTimer = null; }
    rollDone = null;
  }
  function animateRoll(finalDice, done) {
    cancelRoll();
    if (reducedMotion || !finalDice.length) { if (done) done(); return; }
    rollDone = done;

    el.diceRow.innerHTML = '';
    var faces = [];
    for (var i = 0; i < finalDice.length; i++) {
      var cell = document.createElement('div'); cell.className = 'die-cell';
      var die = document.createElement('div'); die.className = 'die rolling';
      var pre = document.createElement('pre'); pre.className = 'die-face';
      pre.textContent = FACES[randFace()].join('\n');
      die.appendChild(pre); cell.appendChild(die);
      var key = document.createElement('div'); key.className = 'die-key';
      key.textContent = '[' + (i + 1) + ']'; cell.appendChild(key);
      el.diceRow.appendChild(cell); faces.push(pre);
    }

    var frames = 9, frame = 0;
    rollTimer = setInterval(function () {
      frame++;
      var settle = frame >= frames;
      for (var j = 0; j < faces.length; j++) {
        faces[j].textContent = FACES[settle ? finalDice[j] : randFace()].join('\n');
      }
      if (settle) {
        clearInterval(rollTimer); rollTimer = null;
        var d = rollDone; rollDone = null;
        if (d) d();
      }
    }, 45);
  }

  // ---- Рендер гри ----
  function renderGame(game, opts) {
    opts = opts || {};
    el.target.textContent = t('game.targetLabel', { n: game.target });

    // Табло.
    el.scoreboard.innerHTML = '';
    for (var i = 0; i < game.players.length; i++) {
      var p = game.players[i];
      var d = document.createElement('div');
      d.className = 'player' + (i === game.current && !game.over ? ' active' : '');
      d.textContent = p.name + ': ' + p.score;
      if (p.farkleLost > 0) {
        var lost = document.createElement('span');
        lost.className = 'player-lost';
        lost.textContent = ' ✗−' + p.farkleLost;
        lost.title = t('game.lostTitle');
        d.appendChild(lost);
      }
      el.scoreboard.appendChild(d);
    }
    if (game.mode === 'solo') {
      var hs = document.createElement('div');
      hs.className = 'player highscore';
      hs.textContent = t('game.record', { v: opts.highscore || '—' });
      el.scoreboard.appendChild(hs);
    }

    var farkleNow = opts.farkle;

    // Інфо про хід.
    var parts = [t('game.turnPoints', { n: game.turnTotal() }), t('game.freeDice', { n: game.dice.length })];
    if (game.mode === 'solo' && opts.turns) parts.push(t('game.turnCount', { n: opts.turns }));
    if (game.inFinalRound()) parts.push(t('game.finalRound'));
    el.turnInfo.textContent = parts.join('   │   ');

    // Відкладені кубики цього ходу.
    el.setaside.innerHTML = '';
    if (game.setAside.length) {
      var lbl = document.createElement('span');
      lbl.className = 'setaside-label';
      lbl.textContent = t('game.setAside');
      el.setaside.appendChild(lbl);
      el.setaside.appendChild(diceMini(game.setAside));
    }

    // Очкові кубики (для підсвічування).
    var scorable = {};
    if (game.rolled && !farkleNow && game.dice.length) {
      var idxs = ai.chooseKeep(game.dice).indices;
      for (var s = 0; s < idxs.length; s++) scorable[idxs[s]] = true;
    }

    // Активні кубики.
    el.diceRow.innerHTML = '';
    if (game.dice.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'dice-empty';
      empty.textContent = game.rolled ? '' : t('game.pressRoll');
      el.diceRow.appendChild(empty);
    }
    for (var j = 0; j < game.dice.length; j++) {
      el.diceRow.appendChild(
        makeDie(game.dice[j], j, game.selected.indexOf(j) !== -1, farkleNow, !!scorable[j])
      );
    }

    // Підказка.
    renderHint(game, farkleNow);

    // Кнопки.
    var human = !game.isAITurn() && !game.over && !locked;
    setBtn(el.rollBtn, human && !game.rolled);
    setBtn(el.rerollBtn, human && game.canCommit());
    setBtn(el.bankBtn, human && game.canBank());
    setBtn(el.autoBtn, human && game.rolled && Object.keys(scorable).length > 0);
  }

  function renderHint(game, farkleNow) {
    var info = game.selectionInfo();
    if (farkleNow) {
      el.hint.textContent = t('hint.farkle');
      el.hint.className = 'hint bad';
    } else if (game.selected.length === 0) {
      el.hint.textContent = game.rolled ? t('hint.choose') : '';
      el.hint.className = 'hint';
    } else if (info.valid && !game.canBank() && game.openRule && !game.onBoard()) {
      el.hint.textContent = t('hint.openRule', { p: info.points, th: game.openThreshold, cur: game.turnTotal() });
      el.hint.className = 'hint';
    } else if (info.valid) {
      el.hint.textContent = t('hint.valid', { p: info.points });
      el.hint.className = 'hint good';
    } else {
      el.hint.textContent = t('hint.invalid');
      el.hint.className = 'hint bad';
    }
  }

  function setBtn(btn, enabled) { if (btn) btn.disabled = !enabled; }

  function makeDie(value, index, selected, farkle, scorable) {
    var cell = document.createElement('div');
    cell.className = 'die-cell' + (scorable ? ' scorable' : '');
    cell.addEventListener('click', function () {
      if (!locked) call('onToggle', index);
    });

    var die = document.createElement('div');
    die.className = 'die' + (selected ? ' selected' : '') + (farkle ? ' farkle' : '');
    die.setAttribute('data-index', index);
    die.setAttribute('role', 'button');
    die.setAttribute('tabindex', '0');
    die.setAttribute('aria-pressed', selected ? 'true' : 'false');
    die.setAttribute('aria-label', t('die.aria', { i: index + 1, v: value }) +
      (selected ? t('die.ariaSelected') : ''));

    var face = document.createElement('pre');
    face.className = 'die-face';
    face.textContent = FACES[value].join('\n');
    die.appendChild(face);
    cell.appendChild(die);

    var key = document.createElement('div');
    key.className = 'die-key';
    key.textContent = '[' + (index + 1) + ']';
    cell.appendChild(key);

    return cell;
  }

  function diceMini(values) {
    var wrap = document.createElement('span');
    wrap.className = 'mini-dice';
    wrap.textContent = values.map(function (v) { return '[' + v + ']'; }).join(' ');
    return wrap;
  }

  // ---- Налаштування (форма) ----
  function bindSettings() {
    var t = $('set-target'), tc = $('set-target-custom');
    if (t) t.addEventListener('change', function () {
      if (t.value === 'custom') {
        tc.classList.remove('hidden');
        call('onSettingChange', 'target', parseInt(tc.value, 10) || 10000);
      } else {
        tc.classList.add('hidden');
        call('onSettingChange', 'target', parseInt(t.value, 10));
      }
    });
    if (tc) tc.addEventListener('change', function () {
      call('onSettingChange', 'target', parseInt(tc.value, 10) || 10000);
    });
    bindCtl('set-openrule', 'change', function (e) { call('onSettingChange', 'openRule', e.target.checked); });
    bindCtl('set-difficulty', 'change', function (e) { call('onSettingChange', 'difficulty', e.target.value); });
    bindCtl('set-sound', 'change', function (e) { call('onSettingChange', 'sound', e.target.checked); });
    bindCtl('set-theme', 'change', function (e) { call('onSettingChange', 'theme', e.target.value); });
    bindCtl('set-lang', 'change', function (e) { call('onSettingChange', 'lang', e.target.value); });
    // Ім'я зберігається лише за явною дією: кнопка «Зберегти» або Enter у полі.
    bindCtl('set-name', 'keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); call('onSettingChange', 'playerName', e.target.value); }
    });
  }
  function bindCtl(id, ev, fn) { var n = $(id); if (n) n.addEventListener(ev, fn); }

  function renderSettings(s) {
    if (el.nameInput) el.nameInput.value = s.playerName || '';
    setNameStatus('', '');
    var t = $('set-target'), tc = $('set-target-custom');
    if (t) {
      if (s.target === 5000 || s.target === 10000) {
        t.value = String(s.target); if (tc) tc.classList.add('hidden');
      } else {
        t.value = 'custom';
        if (tc) { tc.classList.remove('hidden'); tc.value = String(s.target); }
      }
    }
    if ($('set-openrule')) $('set-openrule').checked = !!s.openRule;
    if ($('set-difficulty')) $('set-difficulty').value = s.difficulty;
    if ($('set-sound')) $('set-sound').checked = !!s.sound;
    if ($('set-theme')) $('set-theme').value = s.theme;
    if ($('set-lang')) $('set-lang').value = s.lang || 'uk';
    openModal('settings-modal');
  }

  // ---- Статистика ----
  function renderStats(rows) {
    var tbl = $('stats-table');
    if (!tbl) return;
    tbl.innerHTML = '';
    for (var i = 0; i < rows.length; i++) {
      var tr = document.createElement('tr');
      var td1 = document.createElement('td'); td1.textContent = rows[i].label;
      var td2 = document.createElement('td'); td2.textContent = rows[i].value;
      tr.appendChild(td1); tr.appendChild(td2); tbl.appendChild(tr);
    }
    openModal('stats-modal');
  }

  // ---- Екран перемоги ----
  function showVictory(v) {
    var b = $('victory-banner'), det = $('victory-detail');
    if (b) b.textContent = v.banner;          // рамку малює CSS (.victory-banner)
    if (det) det.textContent = v.detail || '';
    openModal('victory-modal');
  }

  // ---- Ім'я гравця ----
  function setCurrentName(name) { myName = name || ''; }
  function setNameInput(name) { if (el.nameInput) el.nameInput.value = name || ''; }
  function setNameStatus(text, cls) {
    if (!el.nameStatus) return;
    el.nameStatus.textContent = text || '';
    el.nameStatus.className = 'name-status' + (cls ? ' ' + cls : '');
  }

  // ---- Рейтинг ----
  function lbMsg(text) {
    var d = document.createElement('div');
    d.className = 'lb-msg';
    d.textContent = text;
    return d;
  }
  function lbTabButtons() {
    if (!el.lbTabs) return;
    var btns = el.lbTabs.querySelectorAll('.lb-tab');
    for (var i = 0; i < btns.length; i++) {
      var on = btns[i].getAttribute('data-lb') === lbTab;
      btns[i].classList.toggle('active', on);
      btns[i].setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }
  function openLeaderboard(currentName) {
    if (currentName !== undefined) myName = currentName || '';
    lbPlayers = null; lbError = null;
    openModal('leaderboard-modal');
    renderLb(); // покаже «Завантаження…»
  }
  function setLeaderboard(players, err) {
    lbPlayers = players; lbError = err || null;
    renderLb();
  }
  function renderLb() {
    lbTabButtons();
    var box = el.lbBody;
    if (!box) return;

    if (lbError) {
      box.innerHTML = '';
      box.appendChild(lbMsg(
        (lbError === 'network' || lbError === 'unsupported')
          ? t('lb.unavailable')
          : t('lb.error', { err: lbError })));
      return;
    }
    if (lbPlayers === null) {
      box.innerHTML = '';
      box.appendChild(lbMsg(t('lb.loading')));
      return;
    }

    var list = lbPlayers.slice(), label, valFn;
    if (lbTab === 'turn') {
      label = t('lb.colPoints');
      list = list.filter(function (p) { return (p.bestSingleTurn || 0) > 0; });
      list.sort(function (a, b) { return (b.bestSingleTurn || 0) - (a.bestSingleTurn || 0); });
      valFn = function (p) { return String(p.bestSingleTurn || 0); };
    } else if (lbTab === 'solo') {
      label = t('lb.colTurns');
      list = list.filter(function (p) { return p.soloBestTurns != null; });
      list.sort(function (a, b) { return a.soloBestTurns - b.soloBestTurns; });
      valFn = function (p) { return String(p.soloBestTurns); };
    } else {
      label = t('lb.colWins');
      list = list.filter(function (p) { return (p.aiWins || 0) > 0 || (p.aiGames || 0) > 0; });
      list.sort(function (a, b) {
        return (b.aiWins || 0) - (a.aiWins || 0) || (b.bestSingleTurn || 0) - (a.bestSingleTurn || 0);
      });
      valFn = function (p) { return (p.aiWins || 0) + ' / ' + (p.aiGames || 0); };
    }

    box.innerHTML = '';
    if (!list.length) { box.appendChild(lbMsg(t('lb.empty'))); return; }

    var tbl = document.createElement('table');
    tbl.className = 'rules-table lb-table';
    var head = document.createElement('tr');
    var th1 = document.createElement('th'); th1.textContent = '#';
    var th2 = document.createElement('th'); th2.textContent = t('lb.colPlayer');
    var th3 = document.createElement('th'); th3.textContent = label;
    head.appendChild(th1); head.appendChild(th2); head.appendChild(th3);
    tbl.appendChild(head);

    var myKey = (myName || '').toLowerCase();
    for (var i = 0; i < list.length && i < 50; i++) {
      var p = list[i];
      var tr = document.createElement('tr');
      if (myKey && (p.name || '').toLowerCase() === myKey) tr.className = 'lb-me';
      var c1 = document.createElement('td'); c1.textContent = String(i + 1);
      var c2 = document.createElement('td'); c2.textContent = p.name || '—';
      var c3 = document.createElement('td'); c3.textContent = valFn(p);
      tr.appendChild(c1); tr.appendChild(c2); tr.appendChild(c3);
      tbl.appendChild(tr);
    }
    box.appendChild(tbl);
  }

  window.Farkle.ui = {
    init: init,
    applyI18n: applyI18n,
    setCurrentName: setCurrentName,
    setNameInput: setNameInput,
    setNameStatus: setNameStatus,
    openLeaderboard: openLeaderboard,
    setLeaderboard: setLeaderboard,
    showMenu: showMenu,
    showGame: showGame,
    showRules: showRules,
    openModal: openModal,
    closeModal: closeModal,
    renderGame: renderGame,
    animateRoll: animateRoll,
    log: log,
    clearLog: clearLog,
    setLocked: setLocked,
    setMenuHighscore: setMenuHighscore,
    setContinueVisible: setContinueVisible,
    setVersion: setVersion,
    applyTheme: applyTheme,
    setSoundButton: setSoundButton,
    renderSettings: renderSettings,
    renderStats: renderStats,
    showVictory: showVictory
  };
})();
