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
  // Повертає { points, usedAll, combos } — usedAll=false, якщо є «мертві» кубики.
  // combos — список ідентифікаторів комбінацій (без текстів; UI перекладає через i18n):
  //   { kind: 'kind', face, count } — трійка й більше однакових
  //   { kind: 'ones' | 'fives', count } — поодинокі 1 / 5
  function decompose(counts) {
    var points = 0;
    var usedAll = true;
    var combos = [];
    for (var face = 1; face <= 6; face++) {
      var c = counts[face];
      if (c === 0) continue;
      if (c >= 3) {
        if (c === 6) points += 3000;
        else if (c === 5) points += 2000;
        else if (c === 4) points += 1000;
        else points += face === 1 ? 1000 : face * 100; // рівно три
        combos.push({ kind: 'kind', face: face, count: c });
      } else {
        // c === 1 або 2
        if (face === 1) { points += c * 100; combos.push({ kind: 'ones', count: c }); }
        else if (face === 5) { points += c * 50; combos.push({ kind: 'fives', count: c }); }
        else usedAll = false; // 2/3/4/6 поодинці — не очкові
      }
    }
    return { points: points, usedAll: usedAll, combos: combos };
  }

  // Спецкомбінації, можливі лише на рівно 6 кубиках.
  // Повертає { points, combo } — combo: 'straight' | 'threePairs' | 'twoTriplets' | null.
  function sixDiceSpecial(counts) {
    var distinct = 0, pairs = 0, triplets = 0, isStraight = true;
    for (var face = 1; face <= 6; face++) {
      var c = counts[face];
      if (c > 0) distinct++;
      if (c === 2) pairs++;
      if (c === 3) triplets++;
      if (c !== 1) isStraight = false;
    }
    var best = 0, combo = null;
    if (isStraight && distinct === 6) { best = 1500; combo = 'straight'; } // стріт 1-2-3-4-5-6
    if (pairs === 3 && 1500 > best) { best = 1500; combo = 'threePairs'; } // три пари
    if (triplets === 2 && 2500 > best) { best = 2500; combo = 'twoTriplets'; } // дві трійки
    return { points: best, combo: combo }; // points=0, якщо жодної спецкомбінації
  }

  // Підрахунок для набору кубиків, які гравець хоче відкласти.
  // dice — масив значень 1..6. Повертає { points, usedAll, valid, combos }.
  // valid === true ⇒ набір легальний для відкладання (усі кубики очкові, points>0).
  function score(dice) {
    if (!dice || dice.length === 0) return { points: 0, usedAll: false, valid: false, combos: [] };
    var counts = tally(dice);
    var best = decompose(counts);

    if (dice.length === 6) {
      var special = sixDiceSpecial(counts);
      // Спец виграє, якщо дає більше АБО стільки ж, але задіює всі кубики.
      if (special.points > best.points ||
          (special.points === best.points && special.points > 0 && !best.usedAll)) {
        best = { points: special.points, usedAll: true, combos: [{ kind: special.combo }] };
      }
    }

    return {
      points: best.points,
      usedAll: best.usedAll,
      valid: best.points > 0 && best.usedAll,
      combos: best.combos
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
      if (special.points >= s.points && special.points > 0) {
        return { keep: dice.slice(), points: special.points };
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
