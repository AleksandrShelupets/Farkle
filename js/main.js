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

  var APP_VERSION = '1.016';   // версія гри (показується у футері меню; бампай при релізі)
  var AI_DELAY = 750;          // мс між кроками ходу AI
  var FARKLE_PAUSE = 1200;
  var ATTACK_TURNS = 10;       // ліміт ходів у режимах «атака» та «щоденний виклик»

  // Ключі досягнень (тексти — в i18n: ach.<key>.name / ach.<key>.desc).
  var ACHIEVEMENTS = ['firstWin', 'winHard', 'cleanWin', 'straight', 'threePairs',
    'twoTriplets', 'sixKind', 'turn2000', 'doubleHot', 'daily1'];

  var game = null;
  var difficulty = 'normal';
  var turnsPlayed = 0;
  var timers = [];
  var settling = false;        // true у проміжку «дія завершена → наступний хід» (банк/Farkle-пауза)
  var gameStats = null;        // підсумок поточної партії (для рекапу та досягнень)

  function freshGameStats() {
    return { biggestTurn: 0, farkles: 0, hotDice: 0, turnHot: 0 };
  }

  function delay(ms, fn) { var id = setTimeout(fn, ms); timers.push(id); return id; }
  function clearTimers() {
    for (var i = 0; i < timers.length; i++) clearTimeout(timers[i]);
    timers = [];
  }

  function bestTurnsLabel() {
    return store.hasStat('solo.bestTurns') ? t('count.turns', { n: store.getStat('solo.bestTurns') }) : '—';
  }
  function attackBestLabel() {
    return store.hasStat('attack.bestScore') ? String(store.getStat('attack.bestScore')) : '—';
  }
  // Рекорд для табло поточного режиму (у щоденному виклику рекорд дня — в рейтингу).
  function recordLabel() {
    if (game && game.mode === 'solo' && game.variant === 'attack') return attackBestLabel();
    return bestTurnsLabel();
  }

  // Локальна дата YYYY-MM-DD — визначає «сьогоднішній» виклик і його сід.
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' +
      ('0' + (d.getMonth() + 1)).slice(-2) + '-' +
      ('0' + d.getDate()).slice(-2);
  }
  // FNV-1a: рядок → 32-бітний сід (однаковий для всіх гравців того самого дня).
  function seedFromString(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // ---------- Досягнення ----------
  function award(key) {
    if (!store.unlockAchievement(key)) return;
    ui.log(t('ach.unlocked', { name: t('ach.' + key + '.name') }), 'good');
    sound.hot();
  }
  // Перевірити відкладений набір людини на «трофейні» комбінації.
  function checkComboAchievements(vals) {
    var res = scoring.score(vals);
    if (!res.valid) return;
    for (var i = 0; i < res.combos.length; i++) {
      var c = res.combos[i];
      if (c.kind === 'straight') award('straight');
      else if (c.kind === 'threePairs') award('threePairs');
      else if (c.kind === 'twoTriplets') award('twoTriplets');
      else if (c.kind === 'kind' && c.count === 6) award('sixKind');
    }
  }
  function collectAchievements() {
    return ACHIEVEMENTS.map(function (key) {
      return {
        name: t('ach.' + key + '.name'),
        desc: t('ach.' + key + '.desc'),
        earned: store.hasAchievement(key)
      };
    });
  }

  // ---------- Збереження прогресу ----------
  // Записати поточний стан гри (для кнопки «Продовжити» після перезавантаження / меню).
  function persist() {
    if (!game) return;
    store.saveGame({ v: 1, game: game.serialize(), difficulty: difficulty,
      turnsPlayed: turnsPlayed, recap: gameStats });
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
  // variant (лише для mode==='solo'): 'race' (класика) | 'attack' | 'daily'.
  function startGame(mode, variant) {
    clearTimers();
    var s = store.getSettings();
    difficulty = s.difficulty;
    var opts = { mode: mode, target: s.target, openRule: s.openRule,
      playerName: s.playerName || t('player.you'), aiName: t('player.computer') };
    var limited = mode === 'solo' && (variant === 'attack' || variant === 'daily');
    if (limited) {
      opts.variant = variant;
      opts.turnLimit = ATTACK_TURNS;
      opts.openRule = false; // однакові правила для всіх (важливо для щоденного виклику)
      if (variant === 'daily') {
        opts.dailyDate = todayStr();
        opts.seed = seedFromString('farkle-daily-' + opts.dailyDate);
      }
    }
    game = new Game(opts);
    turnsPlayed = 0;
    gameStats = freshGameStats();
    ui.clearLog();
    ui.showGame();
    ui.setLocked(false);

    if (mode === 'ai') {
      var diffLabel = t('diff.' + difficulty);
      ui.log(t('log.newGameAI', { diff: diffLabel, target: s.target }), 'sys');
    } else if (game.variant === 'attack') {
      ui.log(t('log.attackMode', { turns: game.turnLimit, rec: attackBestLabel() }), 'sys');
    } else if (game.variant === 'daily') {
      ui.log(t('log.dailyMode', { date: game.dailyDate, turns: game.turnLimit }), 'sys');
    } else {
      ui.log(t('log.soloMode', { target: s.target, rec: bestTurnsLabel() }), 'sys');
    }
    if (game.openRule) ui.log(t('log.openRule'), 'sys');
    beginTurn();
  }

  function render(extra) {
    ui.renderGame(game, Object.assign({ highscore: recordLabel(), turns: turnsPlayed }, extra || {}));
  }

  // ---------- Хід ----------
  function beginTurn() {
    turnsPlayed++;
    if (gameStats) gameStats.turnHot = 0;
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
    var nt = game.nextTurn(turnsPlayed);
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
    checkComboAchievements(sel);
    if (res.hotDice) {
      sound.hot(); ui.log(t('log.hotHuman'), 'good');
      gameStats.hotDice++;
      gameStats.turnHot++;
      if (gameStats.turnHot >= 2) award('doubleHot');
    }
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
    var sel = game.selectedValues();
    var res = game.commitAndBank();
    if (res.error) return;
    checkComboAchievements(sel);
    afterBank(res);
  }

  function afterBank(res) {
    var isHuman = !game.isAITurn();
    ui.log(t('log.banked', { gained: res.gained, total: res.newTotal }), 'good');
    sound.bank();
    if (isHuman) {
      store.recordMax('bestSingleTurn', res.gained);
      if (res.gained > gameStats.biggestTurn) gameStats.biggestTurn = res.gained;
      if (res.gained >= 2000) award('turn2000');
    }
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
      gameStats.farkles++;
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
      difficulty: difficulty,
      opponentScore: game.players[1 - game.current].score,
      finalRound: game.inFinalRound()
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
    // Рекап партії — другий рядок на екрані перемоги.
    var recap = t('recap.line', {
      big: gameStats.biggestTurn, f: gameStats.farkles, hot: gameStats.hotDice
    });
    var submitExtra = null;

    if (game.mode === 'solo' && game.turnLimit > 0) {
      // Атака / щоденний виклик: результат — очки за фіксовану кількість ходів.
      var isDaily = game.variant === 'daily';
      var score = game.players[0].score;
      store.incStat(isDaily ? 'daily.games' : 'attack.games');
      ui.log(t('log.attackDone', { score: score, turns: game.turnLimit }), 'good');
      if (isDaily) {
        award('daily1');
        submitExtra = { dailyDate: game.dailyDate, dailyScore: score };
      } else {
        var better = store.recordMax('attack.bestScore', score);
        ui.log(better ? t('log.attackRecord', { score: score })
          : t('log.attackRecordStays', { rec: store.getStat('attack.bestScore') }), better ? 'good' : 'sys');
      }
      sound.win();
      ui.showVictory({
        banner: isDaily ? t('victory.daily.banner') : t('victory.attack.banner'),
        detail: t('victory.attack.detail', { score: score, turns: game.turnLimit }) + '\n' + recap
      });
    } else if (game.mode === 'solo') {
      store.incStat('solo.games');
      ui.log(t('log.soloDone', { target: game.target, turns: turnsPlayed }), 'good');
      var improved = store.recordMin('solo.bestTurns', turnsPlayed);
      ui.log(improved ? t('log.newRecord', { turns: turnsPlayed })
        : t('log.recordStays', { rec: store.getStat('solo.bestTurns') }), improved ? 'good' : 'sys');
      ui.setMenuHighscore(bestTurnsLabel());
      sound.win();
      ui.showVictory({ banner: t('victory.solo.banner'),
        detail: t('victory.solo.detail', { score: game.players[0].score, turns: turnsPlayed }) + '\n' + recap });
    } else {
      store.incStat('ai.games');
      var human = game.players[0], aiP = game.players[1];
      if (winner === 0) {
        store.incStat('ai.wins'); sound.win();
        award('firstWin');
        if (difficulty === 'hard') award('winHard');
        if (gameStats.farkles === 0) award('cleanWin');
      } else store.incStat('ai.losses');
      var w = game.players[winner], l = game.players[1 - winner];
      ui.log(t('log.winner', { name: w.name, ws: w.score, ls: l.score }), 'good');
      ui.showVictory({ banner: winner === 0 ? t('victory.win.banner') : t('victory.lose.banner'),
        detail: t('victory.ai.detail', { human: human.score, ai: aiP.score }) + '\n' + recap });
    }
    submitStats(submitExtra); // надіслати показники в спільний рейтинг (якщо задано ім'я)
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
    var r = saved.recap;
    gameStats = freshGameStats();
    if (r && typeof r === 'object') {
      gameStats.biggestTurn = Number(r.biggestTurn) || 0;
      gameStats.farkles = Number(r.farkles) || 0;
      gameStats.hotDice = Number(r.hotDice) || 0;
    }

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
    if (game.over) { startGame(game.mode, game.variant); return; }
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

  // extra — додаткові поля разового результату (щоденний виклик: dailyDate/dailyScore).
  function submitStats(extra) {
    var name = store.getSettings().playerName;
    if (!name) return; // анонім — не надсилаємо
    var stats = {
      bestSingleTurn: store.getStat('bestSingleTurn'),
      aiWins: store.getStat('ai.wins'),
      aiLosses: store.getStat('ai.losses'),
      aiGames: store.getStat('ai.games'),
      soloBestTurns: store.hasStat('solo.bestTurns') ? store.getStat('solo.bestTurns') : 0,
      soloGames: store.getStat('solo.games'),
      farkles: store.getStat('farkles'),
      farklePoints: store.getStat('farklePoints'),
      attackBest: store.getStat('attack.bestScore')
    };
    if (extra) for (var k in extra) if (extra.hasOwnProperty(k)) stats[k] = extra[k];
    net.submit(store.getClientId(), name, stats);
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
      { label: t('stats.aiGames'), value: store.getStat('ai.games') },
      { label: t('stats.attackBest'), value: store.hasStat('attack.bestScore') ? store.getStat('attack.bestScore') : '—' },
      { label: t('stats.attackGames'), value: store.getStat('attack.games') },
      { label: t('stats.dailyGames'), value: store.getStat('daily.games') }
    ];
  }

  function boot() {
    ui.init({
      onContinue: continueGame,
      onPlayAI: function () { startGame('ai'); },
      onPlaySolo: function () { startGame('solo'); },
      onPlayAttack: function () { startGame('solo', 'attack'); },
      onPlayDaily: function () { startGame('solo', 'daily'); },
      onMenu: gotoMenu,
      onRoll: humanRoll,
      onReroll: humanReroll,
      onBank: humanBank,
      onToggle: onToggle,
      onEnter: onEnter,
      onAutoSelect: onAutoSelect,
      onPlayAgain: function () { if (game) startGame(game.mode, game.variant); },
      onOpenSettings: function () { ui.renderSettings(store.getSettings()); },
      onOpenStats: function () { ui.renderStats(collectStats()); },
      onOpenAchievements: function () { ui.renderAchievements(collectAchievements()); },
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
