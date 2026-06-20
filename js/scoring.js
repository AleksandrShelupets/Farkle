// scoring.js — ядро підрахунку очок Farkle. Чисті функції, без DOM.
// Доступ: window.Farkle.scoring
window.Farkle = window.Farkle || {};

(function () {
  'use strict';

  // Порахувати частоти граней (індекси 1..6).
  function tally(dice) {
    var c = [0, 0, 0, 0, 0, 0, 0];
    for (var i = 0; i < dice.length; i++) c[dice[i]]++;
    return c;
  }

  // Загальна декомпозиція (n-of-a-kind + поодинокі 1 та 5).
  // Повертає { points, usedAll } — usedAll=false, якщо є «мертві» кубики.
  function decompose(counts) {
    var points = 0;
    var usedAll = true;
    for (var face = 1; face <= 6; face++) {
      var c = counts[face];
      if (c === 0) continue;
      if (c >= 3) {
        if (c === 6) points += 3000;
        else if (c === 5) points += 2000;
        else if (c === 4) points += 1000;
        else points += face === 1 ? 1000 : face * 100; // рівно три
      } else {
        // c === 1 або 2
        if (face === 1) points += c * 100;
        else if (face === 5) points += c * 50;
        else usedAll = false; // 2/3/4/6 поодинці — не очкові
      }
    }
    return { points: points, usedAll: usedAll };
  }

  // Спецкомбінації, можливі лише на рівно 6 кубиках.
  function sixDiceSpecial(counts) {
    var distinct = 0, pairs = 0, triplets = 0, isStraight = true;
    for (var face = 1; face <= 6; face++) {
      var c = counts[face];
      if (c > 0) distinct++;
      if (c === 2) pairs++;
      if (c === 3) triplets++;
      if (c !== 1) isStraight = false;
    }
    var best = 0;
    if (isStraight && distinct === 6) best = Math.max(best, 1500); // стріт 1-2-3-4-5-6
    if (pairs === 3) best = Math.max(best, 1500);                  // три пари
    if (triplets === 2) best = Math.max(best, 2500);               // дві трійки
    return best; // 0, якщо жодної спецкомбінації
  }

  // Підрахунок для набору кубиків, які гравець хоче відкласти.
  // dice — масив значень 1..6. Повертає { points, usedAll, valid }.
  // valid === true ⇒ набір легальний для відкладання (усі кубики очкові, points>0).
  function score(dice) {
    if (!dice || dice.length === 0) return { points: 0, usedAll: false, valid: false };
    var counts = tally(dice);
    var best = decompose(counts);

    if (dice.length === 6) {
      var special = sixDiceSpecial(counts);
      // Спец виграє, якщо дає більше АБО стільки ж, але задіює всі кубики.
      if (special > best.points || (special === best.points && special > 0 && !best.usedAll)) {
        best = { points: special, usedAll: true };
      }
    }

    return {
      points: best.points,
      usedAll: best.usedAll,
      valid: best.points > 0 && best.usedAll
    };
  }

  // Чи містить кидок хоч одну очкову можливість (інакше — Farkle).
  function hasAnyScore(dice) {
    return score(dice).points > 0;
  }

  // Ймовірність Farkle (прогоріти) для кидка n кубиків — для індикатора ризику.
  function farkleChance(n) {
    var table = { 1: 0.667, 2: 0.444, 3: 0.278, 4: 0.157, 5: 0.077, 6: 0.023 };
    if (n <= 0) return 0;
    if (n > 6) n = 6;
    return table[n];
  }

  // Жадібний найкращий набір для відкладання: тримаємо всі очкові кубики.
  // Повертає { keep: [значення], points }.
  function bestKeep(dice) {
    var counts = tally(dice);

    // На 6 кубиках спецкомбінація може бути вигіднішою за жадібну суму.
    if (dice.length === 6) {
      var s = score(dice);
      var special = sixDiceSpecial(counts);
      if (special >= s.points && special > 0) {
        return { keep: dice.slice(), points: special };
      }
    }

    var keep = [];
    for (var face = 1; face <= 6; face++) {
      var c = counts[face];
      if (c >= 3) {
        for (var k = 0; k < c; k++) keep.push(face);
      } else if (face === 1 || face === 5) {
        for (var j = 0; j < c; j++) keep.push(face);
      }
    }
    return { keep: keep, points: score(keep).points };
  }

  window.Farkle.scoring = {
    score: score,
    hasAnyScore: hasAnyScore,
    bestKeep: bestKeep,
    farkleChance: farkleChance,
    tally: tally
  };
})();
