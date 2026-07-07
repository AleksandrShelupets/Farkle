// game.js — ядро гри Farkle: стан + машина ходу. Без DOM.
// Методи повертають об'єкти-результати; контролер (main.js) їх інтерпретує.
// Доступ: window.Farkle.Game
window.Farkle = window.Farkle || {};

(function () {
  'use strict';

  var scoring = window.Farkle.scoring;

  // mulberry32 — детермінований ГПВЧ для сідованих режимів (щоденний виклик).
  // Стан — одне 32-бітне число, тож він тривіально серіалізується у збереження гри.
  function mulberryStep(state) {
    var z = (state + 0x6D2B79F5) | 0;
    var t = Math.imul(z ^ (z >>> 15), 1 | z);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return { state: z, value: ((t ^ (t >>> 14)) >>> 0) / 4294967296 };
  }

  // opts: { mode: 'ai' | 'solo', variant?: 'race' | 'attack' | 'daily',
  //         turnLimit?: number, seed?: number, dailyDate?: string,
  //         target?: number, playerName?, aiName? }
  function Game(opts) {
    opts = opts || {};
    this.mode = opts.mode === 'solo' ? 'solo' : 'ai';
    this.variant = (this.mode === 'solo' && (opts.variant === 'attack' || opts.variant === 'daily'))
      ? opts.variant : 'race';
    this.turnLimit = this.variant === 'race' ? 0 : (opts.turnLimit || 10);
    this.dailyDate = this.variant === 'daily' ? (opts.dailyDate || '') : '';
    this.seed = (typeof opts.seed === 'number') ? (opts.seed >>> 0) : null;
    this.rngState = this.seed;
    this.target = opts.target || 10000;
    this.openRule = !!opts.openRule;        // правило «зайти з 500»
    this.openThreshold = opts.openThreshold || 500;
    this.players = this.mode === 'ai'
      ? [{ name: opts.playerName || 'Ви', score: 0, farkleLost: 0, ai: false },
         { name: opts.aiName || 'Комп’ютер', score: 0, farkleLost: 0, ai: true }]
      : [{ name: opts.playerName || 'Ви', score: 0, farkleLost: 0, ai: false }];
    this.current = 0;
    this.finalRoundFrom = -1; // індекс гравця, що запустив фінальне коло (досяг target)
    this.over = false;
    this.winner = -1;
    this._resetTurn();
  }

  Game.prototype._random = function () {
    if (this.rngState === null || this.rngState === undefined) return Math.random();
    var r = mulberryStep(this.rngState);
    this.rngState = r.state;
    return r.value;
  };
  Game.prototype._rollN = function (n) {
    var a = [];
    for (var i = 0; i < n; i++) a.push(Math.floor(this._random() * 6) + 1);
    return a;
  };

  Game.prototype._resetTurn = function () {
    this.dice = [];          // активні (вільні) кубики на столі
    this.selected = [];      // індекси обраних у dice[]
    this.setAside = [];      // значення, відкладені цього ходу (для показу)
    this.turnBanked = 0;     // очки, зафіксовані попередніми кидками цього ходу
    this.rolled = false;     // чи був хоч один кидок цього ходу
  };

  Game.prototype.currentPlayer = function () {
    return this.players[this.current];
  };

  Game.prototype.isAITurn = function () {
    return this.mode === 'ai' && this.players[this.current].ai;
  };

  // Значення обраних кубиків.
  Game.prototype.selectedValues = function () {
    var vals = [];
    for (var i = 0; i < this.selected.length; i++) {
      vals.push(this.dice[this.selected[i]]);
    }
    return vals;
  };

  // Інформація про поточний вибір.
  Game.prototype.selectionInfo = function () {
    return scoring.score(this.selectedValues());
  };

  Game.prototype.pendingPoints = function () {
    var info = this.selectionInfo();
    return info.valid ? info.points : 0;
  };

  // Очки ходу, що відображаються (зафіксовані + дійсний поточний вибір).
  Game.prototype.turnTotal = function () {
    return this.turnBanked + this.pendingPoints();
  };

  // Перший кидок ходу: 6 свіжих кубиків.
  // Повертає { dice, farkle }.
  Game.prototype.rollFresh = function () {
    this._resetTurn();
    this.dice = this._rollN(6);
    this.rolled = true;
    return { dice: this.dice.slice(), farkle: !scoring.hasAnyScore(this.dice) };
  };

  // Перемкнути вибір кубика i (лише якщо ще не зафіксований).
  Game.prototype.toggle = function (i) {
    if (i < 0 || i >= this.dice.length) return;
    var pos = this.selected.indexOf(i);
    if (pos === -1) this.selected.push(i);
    else this.selected.splice(pos, 1);
  };

  Game.prototype.clearSelection = function () {
    this.selected = [];
  };

  // Чи можна зараз відкласти й кинути ще (потрібен дійсний вибір ≥1 очкового кубика).
  Game.prototype.canCommit = function () {
    return this.rolled && this.selectionInfo().valid;
  };

  // Чи гравець уже «на дошці» (має очки).
  Game.prototype.onBoard = function () {
    return this.currentPlayer().score > 0;
  };

  // Чи можна забанкувати (з урахуванням правила «зайти з 500»).
  Game.prototype.canBank = function () {
    if (!this.canCommit()) return false;
    if (this.openRule && !this.onBoard()) {
      return (this.turnBanked + this.pendingPoints()) >= this.openThreshold;
    }
    return true;
  };

  // Відкласти обране й кинути решту. Повертає
  // { dice, farkle, hotDice, banked } або { error } якщо вибір недійсний.
  Game.prototype.commitAndReroll = function () {
    if (!this.canCommit()) return { error: true };
    var info = this.selectionInfo();
    this.turnBanked += info.points;

    var selVals = this.selectedValues();
    for (var s = 0; s < selVals.length; s++) this.setAside.push(selVals[s]);

    var remaining = this.dice.length - this.selected.length;
    var hotDice = remaining === 0;
    if (hotDice) {
      this.setAside = [];      // усі 6 використано — починаємо нову руку
      this.dice = this._rollN(6);
    } else {
      this.dice = this._rollN(remaining);
    }
    this.selected = [];
    this.rolled = true;
    return {
      dice: this.dice.slice(),
      farkle: !scoring.hasAnyScore(this.dice),
      hotDice: hotDice,
      banked: this.turnBanked
    };
  };

  // Забанкувати: зарахувати очки ходу гравцю. Повертає
  // { gained, newTotal, won } або { error }.
  Game.prototype.commitAndBank = function () {
    if (!this.canCommit()) return { error: true };
    if (this.openRule && !this.onBoard() &&
        (this.turnBanked + this.pendingPoints()) < this.openThreshold) {
      return { error: true, reason: 'need-open', need: this.openThreshold };
    }
    var gained = this.turnBanked + this.pendingPoints();
    var p = this.currentPlayer();
    p.score += gained;
    var won = p.score >= this.target;
    return { gained: gained, newTotal: p.score, won: won };
  };

  // Хід завершився без очок (Farkle) — очки ходу згорають.
  // Накопичує згорілі очки поточному гравцю й повертає, скільки втрачено.
  Game.prototype.bustTurn = function () {
    var lost = this.turnBanked;
    this.players[this.current].farkleLost += lost;
    this._resetTurn();
    return lost;
  };

  // Перейти до наступного гравця (або завершити гру в кінці фінального кола).
  // turnsUsed — скільки ходів уже зіграно (лічильник веде контролер);
  // потрібен лише режимам із лімітом ходів (атака / щоденний виклик).
  // Повертає { gameOver, winner } — winner=-1 якщо гра триває.
  Game.prototype.nextTurn = function (turnsUsed) {
    this._resetTurn();

    if (this.mode === 'solo') {
      // Атака / щоденний виклик: гра закінчується після turnLimit ходів.
      if (this.turnLimit > 0) {
        if ((turnsUsed || 0) >= this.turnLimit) {
          this.over = true; this.winner = 0;
          return { gameOver: true, winner: 0 };
        }
        return { gameOver: false, winner: -1 };
      }
      // Класичне соло: гра завершується, коли гравець досяг цілі.
      if (this.players[0].score >= this.target) {
        this.over = true; this.winner = 0;
        return { gameOver: true, winner: 0 };
      }
      return { gameOver: false, winner: -1 };
    }

    // Режим AI: фінальне коло після того, як хтось перетнув ціль.
    var next = (this.current + 1) % this.players.length;
    if (this.finalRoundFrom !== -1 && next === this.finalRoundFrom) {
      // Фінальне коло завершено — визначаємо переможця за рахунком.
      this.over = true;
      this.winner = this.players[0].score >= this.players[1].score ? 0 : 1;
      return { gameOver: true, winner: this.winner };
    }
    this.current = next;
    return { gameOver: false, winner: -1 };
  };

  // Позначити, що поточний гравець щойно досяг цілі — запускаємо фінальне коло.
  Game.prototype.triggerFinalRound = function () {
    if (this.finalRoundFrom === -1) this.finalRoundFrom = this.current;
  };

  Game.prototype.inFinalRound = function () {
    return this.finalRoundFrom !== -1;
  };

  // ---- Збереження / відновлення (для «Продовжити» після перезавантаження) ----
  // Знімок усього стану гри як простий об'єкт (можна JSON.stringify).
  Game.prototype.serialize = function () {
    return {
      mode: this.mode,
      variant: this.variant,
      turnLimit: this.turnLimit,
      dailyDate: this.dailyDate,
      seed: this.seed,
      rngState: this.rngState,
      target: this.target,
      openRule: this.openRule,
      openThreshold: this.openThreshold,
      players: this.players.map(function (p) {
        return { name: p.name, score: p.score, farkleLost: p.farkleLost, ai: p.ai };
      }),
      current: this.current,
      finalRoundFrom: this.finalRoundFrom,
      over: this.over,
      winner: this.winner,
      dice: this.dice.slice(),
      selected: this.selected.slice(),
      setAside: this.setAside.slice(),
      turnBanked: this.turnBanked,
      rolled: this.rolled
    };
  };

  // Відновити гру зі знімка. Повертає Game або null, якщо дані некоректні.
  Game.fromState = function (s) {
    if (!s || !s.players || !s.players.length) return null;
    var g = Object.create(Game.prototype);
    g.mode = s.mode === 'solo' ? 'solo' : 'ai';
    g.variant = (g.mode === 'solo' && (s.variant === 'attack' || s.variant === 'daily'))
      ? s.variant : 'race';
    g.turnLimit = g.variant === 'race' ? 0 : (Number(s.turnLimit) || 10);
    g.dailyDate = typeof s.dailyDate === 'string' ? s.dailyDate : '';
    g.seed = (typeof s.seed === 'number') ? (s.seed >>> 0) : null;
    g.rngState = (typeof s.rngState === 'number') ? (s.rngState | 0) : g.seed;
    g.target = Number(s.target) || 10000;
    g.openRule = !!s.openRule;
    g.openThreshold = Number(s.openThreshold) || 500;
    g.players = s.players.map(function (p) {
      return { name: p.name, score: Number(p.score) || 0,
               farkleLost: Number(p.farkleLost) || 0, ai: !!p.ai };
    });
    g.current = (s.current >= 0 && s.current < g.players.length) ? s.current : 0;
    g.finalRoundFrom = typeof s.finalRoundFrom === 'number' ? s.finalRoundFrom : -1;
    g.over = !!s.over;
    g.winner = typeof s.winner === 'number' ? s.winner : -1;
    g.dice = Array.isArray(s.dice) ? s.dice.slice() : [];
    g.selected = Array.isArray(s.selected) ? s.selected.slice() : [];
    g.setAside = Array.isArray(s.setAside) ? s.setAside.slice() : [];
    g.turnBanked = Number(s.turnBanked) || 0;
    g.rolled = !!s.rolled;
    return g;
  };

  window.Farkle.Game = Game;
})();
