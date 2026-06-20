// main.js — контролер: зв'язує game + ai + ui + sound + store. Завантажується останнім.
window.Farkle = window.Farkle || {};

(function () {
  'use strict';

  var Game = window.Farkle.Game;
  var ai = window.Farkle.ai;
  var scoring = window.Farkle.scoring;
  var ui = window.Farkle.ui;
  var sound = window.Farkle.sound;
  var store = window.Farkle.store;
  var net = window.Farkle.net;
  var i18n = window.Farkle.i18n;
  function t(key, params) { return i18n.t(key, params); }

  var APP_VERSION = '1.013';   // версія гри (показується у футері меню; бампай при релізі)
  var AI_DELAY = 750;          // мс між кроками ходу AI
  var FARKLE_PAUSE = 1200;

  var game = null;
  var difficulty = 'normal';
  var turnsPlayed = 0;
  var timers = [];
  var settling = false;        // true у проміжку «дія завершена → наступний хід» (банк/Farkle-пауза)

  function delay(ms, fn) { var id = setTimeout(fn, ms); timers.push(id); return id; }
  function clearTimers() {
    for (var i = 0; i < timers.length; i++) clearTimeout(timers[i]);
    timers = [];
  }

  function bestTurnsLabel() {
    return store.hasStat('solo.bestTurns') ? t('count.turns', { n: store.getStat('solo.bestTurns') }) : '—';
  }

  // ---------- Збереження прогресу ----------
  // Записати поточний стан гри (для кнопки «Продовжити» після перезавантаження / меню).
  function persist() {
    if (!game) return;
    store.saveGame({ v: 1, game: game.serialize(), difficulty: difficulty, turnsPlayed: turnsPlayed });
  }
  // Зберегти лише в «стабільному» стані: хід людини, що очікує вводу.
  // Хід AI не перезаписуємо — лишається чистий знімок зі старту його ходу (beginTurn),
  // який безпечно відтворити; перехідні стани (анімація, банк) не зберігаємо.
  function persistIfSafe() {
    if (!game || game.over || game.isAITurn() || settling) return;
    persist();
  }
  function clearSave() {
    store.clearGame();
    ui.setContinueVisible(false);
  }

  // ---------- Старт ----------
  function startGame(mode) {
    clearTimers();
    var s = store.getSettings();
    difficulty = s.difficulty;
    game = new Game({ mode: mode, target: s.target, openRule: s.openRule,
      playerName: s.playerName || t('player.you'), aiName: t('player.computer') });
    turnsPlayed = 0;
    ui.clearLog();
    ui.showGame();
    ui.setLocked(false);

    if (mode === 'ai') {
      var diffLabel = t('diff.' + difficulty);
      ui.log(t('log.newGameAI', { diff: diffLabel, target: s.target }), 'sys');
    } else {
      ui.log(t('log.soloMode', { target: s.target, rec: bestTurnsLabel() }), 'sys');
    }
    if (s.openRule) ui.log(t('log.openRule'), 'sys');
    beginTurn();
  }

  function render(extra) {
    ui.renderGame(game, Object.assign({ highscore: bestTurnsLabel() }, extra || {}));
  }

  // ---------- Хід ----------
  function beginTurn() {
    turnsPlayed++;
    runTurn();
  }

  // Тіло ходу (без лічильника) — спільне для нового ходу й відновлення збереженої гри.
  function runTurn() {
    settling = false;                // новий хід — стан знову стабільний
    ui.setLocked(game.isAITurn());
    render();
    persist();                       // чистий знімок на старті ходу
    if (game.isAITurn()) {
      ui.log(t('log.opponentTurn', { name: game.currentPlayer().name }), 'sys');
      delay(AI_DELAY, aiRoll);
    } else if (!game.rolled) {        // на старті ходу — підказка «Кинути» (не при відновленні мід-ходу)
      ui.log(game.inFinalRound() ? t('log.yourTurnFinal') : t('log.yourTurn'), 'sys');
    }
  }

  function endTurn() {
    var nt = game.nextTurn();
    if (nt.gameOver) { handleGameOver(nt.winner); return; }
    beginTurn();
  }

  function diceStr(dice) { return '[' + dice.join('] [') + ']'; }

  // ---------- Дії людини ----------
  function humanRoll() {
    if (game.isAITurn() || game.over) return;
    var res = game.rollFresh();
    sound.roll();
    ui.setLocked(true);
    ui.animateRoll(res.dice, function () {
      ui.setLocked(false);
      ui.log(t('log.roll', { dice: diceStr(res.dice) }));
      if (res.farkle) { onFarkle(); return; }
      render();
      persist();
    });
  }

  function humanReroll() {
    if (!game.canCommit()) return;
    var sel = game.selectedValues();
    var res = game.commitAndReroll();
    if (res.error) return;
    sound.select();
    ui.log(t('log.setAsideReroll', { dice: diceStr(sel), banked: res.banked }));
    if (res.hotDice) { sound.hot(); ui.log(t('log.hotHuman'), 'good'); }
    sound.roll();
    ui.setLocked(true);
    ui.animateRoll(res.dice, function () {
      ui.setLocked(false);
      ui.log(t('log.roll', { dice: diceStr(res.dice) }));
      if (res.farkle) { onFarkle(); return; }
      render();
      persist();
    });
  }

  function humanBank() {
    if (!game.canBank()) {
      if (game.canCommit() && game.openRule && !game.onBoard()) {
        ui.log(t('log.needOpen', { th: game.openThreshold }), 'bad');
      }
      return;
    }
    var res = game.commitAndBank();
    if (res.error) return;
    afterBank(res);
  }

  function afterBank(res) {
    var isHuman = !game.isAITurn();
    ui.log(t('log.banked', { gained: res.gained, total: res.newTotal }), 'good');
    sound.bank();
    if (isHuman) store.recordMax('bestSingleTurn', res.gained);
    if (res.won && game.mode === 'ai') {
      game.triggerFinalRound();
      ui.log(t('log.reachedTarget', { name: game.currentPlayer().name }), 'sys');
    }
    render();
    settling = true;
    delay(500, endTurn);
  }

  function onFarkle() {
    render({ farkle: true });
    sound.farkle();
    var lost = game.bustTurn();
    ui.log(lost > 0 ? t('log.farkleLost', { n: lost }) : t('log.farkleZero'), 'bad');
    if (!game.isAITurn()) {
      store.incStat('farkles');
      if (lost > 0) store.incStat('farklePoints', lost);
    }
    settling = true;
    delay(FARKLE_PAUSE, endTurn);
  }

  // ---------- Хід AI ----------
  function aiRoll() {
    if (!game || !game.isAITurn()) return;
    var res = game.rollFresh();
    sound.roll();
    ui.animateRoll(res.dice, function () {
      if (!game || !game.isAITurn()) return;
      ui.log(t('log.aiRolls', { dice: diceStr(res.dice) }));
      render();
      if (res.farkle) {
        render({ farkle: true });
        sound.farkle();
        var lostR = game.bustTurn();
        ui.log(lostR > 0 ? t('log.aiFarkleLost', { n: lostR }) : t('log.aiFarkleZero'), 'bad');
        settling = true;
        delay(FARKLE_PAUSE, endTurn);
        return;
      }
      delay(AI_DELAY, aiDecide);
    });
  }

  function aiDecide() {
    if (!game || !game.isAITurn()) return;
    var keep = ai.chooseKeep(game.dice, { difficulty: difficulty });
    game.selected = keep.indices.slice();
    render();
    sound.select();

    var keptVals = game.selectedValues();
    var freeAfter = game.dice.length - keep.indices.length;
    var turnTotalIfCommit = game.turnBanked + scoring.score(keptVals).points;
    var bank = ai.shouldBank({
      freeDiceAfter: freeAfter,
      turnTotal: turnTotalIfCommit,
      currentScore: game.currentPlayer().score,
      target: game.target,
      difficulty: difficulty
    });
    // Правило «зайти з 500»: якщо банк зараз недозволений — кидаємо далі.
    if (bank && !game.canBank()) bank = false;

    if (bank) {
      var rb = game.commitAndBank();
      ui.log(t('log.aiBanks', { dice: diceStr(keptVals) }));
      afterBank(rb);
    } else {
      var rr = game.commitAndReroll();
      ui.log(t('log.aiReroll', { dice: diceStr(keptVals), banked: rr.banked }));
      if (rr.hotDice) { sound.hot(); ui.log(t('log.hotAI'), 'good'); }
      sound.roll();
      ui.animateRoll(rr.dice, function () {
        if (!game || !game.isAITurn()) return;
        ui.log(t('log.roll', { dice: diceStr(rr.dice) }));
        render();
        if (rr.farkle) {
          render({ farkle: true });
          sound.farkle();
          var lostD = game.bustTurn();
          ui.log(lostD > 0 ? t('log.aiFarkleLost', { n: lostD }) : t('log.aiFarkleZero'), 'bad');
          settling = true;
          delay(FARKLE_PAUSE, endTurn);
          return;
        }
        delay(AI_DELAY, aiDecide);
      });
    }
  }

  // ---------- Кінець гри ----------
  function handleGameOver(winner) {
    clearTimers();
    clearSave();              // гра завершена — продовжувати нічого
    ui.setLocked(true);
    render();
    if (game.mode === 'solo') {
      store.incStat('solo.games');
      ui.log(t('log.soloDone', { target: game.target, turns: turnsPlayed }), 'good');
      var improved = store.recordMin('solo.bestTurns', turnsPlayed);
      ui.log(improved ? t('log.newRecord', { turns: turnsPlayed })
        : t('log.recordStays', { rec: store.getStat('solo.bestTurns') }), improved ? 'good' : 'sys');
      ui.setMenuHighscore(bestTurnsLabel());
      sound.win();
      ui.showVictory({ banner: t('victory.solo.banner'),
        detail: t('victory.solo.detail', { score: game.players[0].score, turns: turnsPlayed }) });
    } else {
      store.incStat('ai.games');
      var human = game.players[0], aiP = game.players[1];
      if (winner === 0) { store.incStat('ai.wins'); sound.win(); }
      else store.incStat('ai.losses');
      var w = game.players[winner], l = game.players[1 - winner];
      ui.log(t('log.winner', { name: w.name, ws: w.score, ls: l.score }), 'good');
      ui.showVictory({ banner: winner === 0 ? t('victory.win.banner') : t('victory.lose.banner'),
        detail: t('victory.ai.detail', { human: human.score, ai: aiP.score }) });
    }
    submitStats(); // надіслати показники в спільний рейтинг (якщо задано ім'я)
    ui.log(t('log.pressEnter'), 'sys');
  }

  // ---------- Обробники UI ----------
  function gotoMenu() {
    persistIfSafe();          // зберегти незавершену гру людини, перш ніж піти в меню
    clearTimers();
    ui.setMenuHighscore(bestTurnsLabel());
    ui.setContinueVisible(store.hasGame());
    ui.showMenu();
  }

  // ---------- Продовжити збережену гру ----------
  function continueGame() {
    var saved = store.loadGame();
    var restored = saved && saved.game ? Game.fromState(saved.game) : null;
    if (!restored || restored.over) { clearSave(); return; }

    game = restored;
    difficulty = saved.difficulty || store.getSettings().difficulty;
    turnsPlayed = saved.turnsPlayed || 0;

    // Захист: якщо збережено «застряглий» хід людини (кидок без очок) — почати хід заново.
    if (!game.isAITurn() && game.rolled && !scoring.hasAnyScore(game.dice)) {
      game._resetTurn();
    }
    // Хід AI завжди відновлюємо з чистого старту (його очки ще не зараховані).
    if (game.isAITurn()) game._resetTurn();

    clearTimers();
    ui.clearLog();
    ui.showGame();
    ui.setLocked(false);
    ui.log(t('log.resumed'), 'sys');
    runTurn();                // продовжити хід (без збільшення лічильника ходів)
  }

  function onEnter() {
    if (!game) return;
    if (game.over) { startGame(game.mode); return; }
    if (game.isAITurn()) return;
    if (!game.rolled) humanRoll();
    else if (game.canCommit()) humanReroll();
  }

  function onToggle(i) {
    if (!game || game.isAITurn() || game.over || !game.rolled) return;
    game.toggle(i);
    render();
    persist();
  }

  function onAutoSelect() {
    if (!game || game.isAITurn() || game.over || !game.rolled) return;
    var keep = ai.chooseKeep(game.dice); // жадібний — підсвічує/обирає всі очкові
    if (!keep.indices.length) return;
    game.selected = keep.indices.slice();
    sound.select();
    render();
    persist();
  }

  function onSettingChange(key, val) {
    if (key === 'playerName') { changeName(val); return; }
    store.setSetting(key, val);
    if (key === 'theme') ui.applyTheme(val);
    if (key === 'sound') { sound.setMuted(!val); ui.setSoundButton(val); }
    if (key === 'lang') { applyLanguage(val); }
  }

  // Перемкнути мову «на льоту»: оновити статичний текст і видимі динамічні написи.
  function applyLanguage(lang) {
    i18n.setLang(lang);
    ui.applyI18n();                       // увесь статичний текст
    ui.setSoundButton(store.getSettings().sound);
    ui.setMenuHighscore(bestTurnsLabel());
    if (game && !game.over) render();     // оновити поточну гру (табло, інфо ходу, підказка)
  }

  // ---------- Ім'я гравця + рейтинг ----------
  function validName(name) {
    if (name.length < 2 || name.length > 16) return false;
    try { return /^[\p{L}\p{N} _.\-]+$/u.test(name); }
    catch (e) { return /^[\wА-Яа-яЇїІіЄєҐґ .\-]+$/.test(name); } // запасний варіант
  }
  function changeName(raw) {
    var name = (raw || '').trim();
    if (name === '') {
      store.setSetting('playerName', '');
      ui.setCurrentName('');
      ui.setNameStatus(t('name.cleared'), 'sys');
      return;
    }
    if (!validName(name)) {
      ui.setNameStatus(t('name.invalid'), 'bad');
      return;
    }
    ui.setNameStatus(t('name.checking'), 'sys');
    net.register(store.getClientId(), name, function (err, data) {
      if (!err) {
        var finalName = (data && data.name) || name;
        store.setSetting('playerName', finalName);
        ui.setCurrentName(finalName);
        ui.setNameInput(finalName);
        ui.setNameStatus(t('name.saved'), 'good');
      } else if (err === 'taken') {
        ui.setNameStatus(t('name.taken'), 'bad');
        ui.setNameInput(store.getSettings().playerName || '');
      } else if (err === 'network' || err === 'unsupported') {
        store.setSetting('playerName', name); // офлайн — зберігаємо локально
        ui.setCurrentName(name);
        ui.setNameStatus(t('name.offline'), 'sys');
      } else if (err === 'invalid-name') {
        ui.setNameStatus(t('name.invalidServer'), 'bad');
      } else {
        ui.setNameStatus(t('name.error', { err: err }), 'bad');
      }
    });
  }

  function submitStats() {
    var name = store.getSettings().playerName;
    if (!name) return; // анонім — не надсилаємо
    net.submit(store.getClientId(), name, {
      bestSingleTurn: store.getStat('bestSingleTurn'),
      aiWins: store.getStat('ai.wins'),
      aiLosses: store.getStat('ai.losses'),
      aiGames: store.getStat('ai.games'),
      soloBestTurns: store.hasStat('solo.bestTurns') ? store.getStat('solo.bestTurns') : 0,
      soloGames: store.getStat('solo.games'),
      farkles: store.getStat('farkles'),
      farklePoints: store.getStat('farklePoints')
    });
  }

  function fetchLeaderboard() {
    net.list(function (err, data) {
      if (err) ui.setLeaderboard(null, err);
      else ui.setLeaderboard((data && data.players) || [], null);
    });
  }
  function openLeaderboard() {
    ui.openLeaderboard(store.getSettings().playerName || '');
    fetchLeaderboard();
  }
  function refreshLeaderboard() {
    ui.setLeaderboard(null, null); // «Завантаження…»
    fetchLeaderboard();
  }

  // Перемикач звуку в процесі гри (кнопка/клавіша M).
  function onToggleSound() {
    var on = !store.getSettings().sound;
    store.setSetting('sound', on);
    sound.setMuted(!on);
    ui.setSoundButton(on);
    if (on) sound.select(); // короткий звук-підтвердження
    ui.log(on ? t('log.soundOn') : t('log.soundOff'), 'sys');
  }

  function collectStats() {
    return [
      { label: t('stats.soloRecord'), value: store.hasStat('solo.bestTurns') ? store.getStat('solo.bestTurns') : '—' },
      { label: t('stats.soloGames'), value: store.getStat('solo.games') },
      { label: t('stats.bestTurn'), value: store.getStat('bestSingleTurn') },
      { label: t('stats.farkles'), value: store.getStat('farkles') },
      { label: t('stats.farklePoints'), value: store.getStat('farklePoints') },
      { label: t('stats.aiWins'), value: store.getStat('ai.wins') },
      { label: t('stats.aiLosses'), value: store.getStat('ai.losses') },
      { label: t('stats.aiGames'), value: store.getStat('ai.games') }
    ];
  }

  function boot() {
    ui.init({
      onContinue: continueGame,
      onPlayAI: function () { startGame('ai'); },
      onPlaySolo: function () { startGame('solo'); },
      onMenu: gotoMenu,
      onRoll: humanRoll,
      onReroll: humanReroll,
      onBank: humanBank,
      onToggle: onToggle,
      onEnter: onEnter,
      onAutoSelect: onAutoSelect,
      onPlayAgain: function () { if (game) startGame(game.mode); },
      onOpenSettings: function () { ui.renderSettings(store.getSettings()); },
      onOpenStats: function () { ui.renderStats(collectStats()); },
      onStatsReset: function () { store.resetStats(); ui.renderStats(collectStats()); ui.setMenuHighscore(bestTurnsLabel()); },
      onSettingChange: onSettingChange,
      onToggleSound: onToggleSound,
      onOpenLeaderboard: openLeaderboard,
      onLeaderboardRefresh: refreshLeaderboard
    });

    sound.init();
    var s = store.getSettings();
    i18n.setLang(s.lang);
    ui.applyI18n();                 // перекласти статичний текст під збережену мову
    ui.applyTheme(s.theme);
    sound.setMuted(!s.sound);
    ui.setSoundButton(s.sound);
    ui.setCurrentName(s.playerName || '');
    ui.setVersion(APP_VERSION);
    ui.setMenuHighscore(bestTurnsLabel());
    ui.setContinueVisible(store.hasGame());   // показати «Продовжити», якщо є збережена гра
    ui.showMenu();

    // Зберегти прогрес перед закриттям/перезавантаженням вкладки.
    window.addEventListener('beforeunload', persistIfSafe);

    // Реєстрація service worker (лише по http/https; на file:// пропускається).
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      try { navigator.serviceWorker.register('sw.js'); } catch (e) {}
    }

    // Самотест підрахунку при ?test=1
    if (/[?&]test=1\b/.test(location.search) && window.Farkle.runTests) {
      window.Farkle.runTests(ui.log);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
