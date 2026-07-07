// ai.js — евристика суперника-комп'ютера. Без DOM. Доступ: window.Farkle.ai
window.Farkle = window.Farkle || {};

(function () {
  'use strict';

  var scoring = window.Farkle.scoring;

  // Порогові профілі рішення «банк/кидок» за рівнем складності.
  // dN — мінімальні очки ходу, щоб банкувати, коли перекидати треба N кубиків.
  // Нескінченність ⇒ ніколи не банкувати на цій к-сті (кидати далі).
  var PROFILES = {
    easy:   { d4: 100,      d3: 150, d2: 100, d1: 50 },  // банкує рано, майже не пушить → слабше
    normal: { d4: Infinity, d3: 300, d2: 200, d1: 100 }, // близько до оптимуму
    hard:   { d4: Infinity, d3: 450, d2: 300, d1: 150 }  // трохи агресивніше + розумніший вибір кубиків
  };

  function countVal(arr, v) {
    var c = 0;
    for (var i = 0; i < arr.length; i++) if (arr[i] === v) c++;
    return c;
  }

  // На «Складно» — не залишати одинокі 5 (50 очок), якщо є інші очкові кубики
  // й варто перекинути ≥2 кубики (більше кубиків у грі = вищий EV).
  function smartTrim(dice, greedy) {
    if (greedy.length === dice.length) return greedy; // спец/гарячі кубики — не чіпати
    var counts = scoring.tally(dice);
    if (counts[5] === 0 || counts[5] >= 3) return greedy; // немає одиноких 5
    var trimmed = greedy.filter(function (v) { return v !== 5; });
    if (trimmed.length === 0) return greedy;             // 5 — єдині очкові
    var rerollAfter = dice.length - trimmed.length;
    return rerollAfter >= 2 ? trimmed : greedy;
  }

  // Які кубики залишити. opts.difficulty === 'hard' вмикає розумніший вибір.
  // Повертає { indices, points }.
  function chooseKeep(dice, opts) {
    opts = opts || {};
    var keepVals = scoring.bestKeep(dice).keep.slice();
    if (opts.difficulty === 'hard') keepVals = smartTrim(dice, keepVals);

    var need = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    for (var k = 0; k < keepVals.length; k++) need[keepVals[k]]++;
    var used = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

    var indices = [];
    for (var i = 0; i < dice.length; i++) {
      var d = dice[i];
      if (used[d] < need[d]) { indices.push(i); used[d]++; }
    }
    return { indices: indices, points: scoring.score(keepVals).points };
  }

  // Рішення: банкувати чи кидати ще.
  // params: { freeDiceAfter, turnTotal, currentScore, target, difficulty,
  //           opponentScore?, finalRound? }
  //   freeDiceAfter — скільки кубиків довелося б перекидати (0 ⇒ гарячі кубики).
  function shouldBank(params) {
    var free = params.freeDiceAfter;
    var turnTotal = params.turnTotal;
    var opp = (typeof params.opponentScore === 'number') ? params.opponentScore : null;

    // Фінальне коло (суперник уже досяг цілі): банк, який не виграє гру, —
    // гарантована поразка, тож банкуємо лише переможний рахунок (нічия = поразка).
    if (params.finalRound && opp !== null) {
      return params.currentScore + turnTotal > opp;
    }
    // Якщо цей хід уже приносить перемогу — фіксуємо.
    if (params.currentScore + turnTotal >= params.target) return true;
    // Гарячі кубики: беремо свіжі 6 і продовжуємо.
    if (free === 0) return false;

    // Контекст рахунку (normal/hard): суперник на фініші або великий розрив —
    // ризикуємо більше; впевнено ведемо — банкуємо раніше.
    var mult = 1;
    if (opp !== null && params.difficulty !== 'easy') {
      var lead = params.currentScore - opp;
      if (opp >= params.target - 1500 && lead < 0) mult = 1.6;
      else if (lead <= -2000) mult = 1.3;
      else if (lead >= 2000) mult = 0.75;
    }

    var p = PROFILES[params.difficulty] || PROFILES.normal;
    if (free >= 4) return turnTotal >= p.d4 * mult;
    if (free === 3) return turnTotal >= p.d3 * mult;
    if (free === 2) return turnTotal >= p.d2 * mult;
    if (free === 1) return turnTotal >= p.d1 * mult;
    return true;
  }

  window.Farkle.ai = {
    chooseKeep: chooseKeep,
    shouldBank: shouldBank
  };
})();
