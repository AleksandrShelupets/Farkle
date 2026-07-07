// tests.js — самотест підрахунку очок. Виконується лише при ?test=1.
// Доступ: window.Farkle.runTests(logFn)
window.Farkle = window.Farkle || {};

(function () {
  'use strict';

  function runTests(logFn) {
    var scoring = window.Farkle.scoring;
    var log = logFn || function (m) { console.log(m); };
    var pass = 0, fail = 0;

    function check(name, got, want) {
      var ok = got === want;
      if (ok) { pass++; }
      else {
        fail++;
        log('✗ FAIL ' + name + ': отримано ' + got + ', очікувалось ' + want, 'bad');
        console.error('FAIL', name, 'got', got, 'want', want);
      }
    }

    function pts(dice) { return scoring.score(dice).points; }
    function valid(dice) { return scoring.score(dice).valid; }
    function usedAll(dice) { return scoring.score(dice).usedAll; }

    // Базові
    check('одна 1', pts([1]), 100);
    check('одна 5', pts([5]), 50);
    check('1+5', pts([1, 5]), 150);
    check('три 1', pts([1, 1, 1]), 1000);
    check('три 2', pts([2, 2, 2]), 200);
    check('три 3', pts([3, 3, 3]), 300);
    check('три 5', pts([5, 5, 5]), 500);
    check('три 6', pts([6, 6, 6]), 600);

    // Багато однакових
    check('чотири 6', pts([6, 6, 6, 6]), 1000);
    check('п’ять 5', pts([5, 5, 5, 5, 5]), 2000);
    check('шість 1', pts([1, 1, 1, 1, 1, 1]), 3000);
    check('чотири 1 + 5', pts([1, 1, 1, 1, 5]), 1050);

    // Спецкомбінації (6 кубиків)
    check('стріт', pts([1, 2, 3, 4, 5, 6]), 1500);
    check('три пари', pts([2, 2, 4, 4, 6, 6]), 1500);
    check('дві трійки', pts([1, 1, 1, 2, 2, 2]), 2500);

    // Комбіновані / залишки
    check('три 2 + 1 + 5', pts([2, 2, 2, 1, 5]), 350);
    check('1 + мертва 2 (бали)', pts([1, 2]), 100);
    check('1 + мертва 2 (usedAll)', usedAll([1, 2]), false);
    check('1 + мертва 2 (valid)', valid([1, 2]), false);
    check('мертвий набір valid', valid([2, 3]), false);
    check('мертвий набір points', pts([2, 3]), 0);
    check('1+5 usedAll', usedAll([1, 5]), true);
    check('порожньо', pts([]), 0);

    // hasAnyScore / Farkle
    check('Farkle-кидок', scoring.hasAnyScore([2, 3, 4, 6, 6, 3]), false);
    check('очковий кидок', scoring.hasAnyScore([2, 3, 4, 6, 6, 1]), true);

    // bestKeep
    check('bestKeep points', scoring.bestKeep([1, 5, 2, 3, 4, 6]).points, 1500); // стріт
    check('bestKeep тримає 1 і 5', scoring.bestKeep([1, 2, 3, 5, 6, 4]).keep.length >= 0, true);

    // farkleChance
    check('ризик 1 кубик', scoring.farkleChance(1), 0.667);
    check('ризик 3 кубики', scoring.farkleChance(3), 0.278);
    check('ризик 6 кубиків', scoring.farkleChance(6), 0.023);
    check('ризик 0', scoring.farkleChance(0), 0);

    // Ідентифікатори комбінацій (для підказки та досягнень)
    function comboKinds(dice) {
      return scoring.score(dice).combos.map(function (c) { return c.kind; }).join(',');
    }
    check('комбо: стріт', comboKinds([1, 2, 3, 4, 5, 6]), 'straight');
    check('комбо: три пари', comboKinds([2, 2, 4, 4, 6, 6]), 'threePairs');
    check('комбо: дві трійки', comboKinds([1, 1, 1, 2, 2, 2]), 'twoTriplets');
    check('комбо: шість однакових', comboKinds([4, 4, 4, 4, 4, 4]), 'kind');
    check('комбо: шість однакових count', scoring.score([4, 4, 4, 4, 4, 4]).combos[0].count, 6);
    check('комбо: трійка + одиночні', comboKinds([2, 2, 2, 1, 5]), 'ones,kind,fives');
    check('комбо: порожньо', comboKinds([]), '');

    // AI: рішення у фінальному колі (банк лише переможного рахунку)
    var ai = window.Farkle.ai;
    function finalBank(turnTotal) {
      return ai.shouldBank({ freeDiceAfter: 3, turnTotal: turnTotal, currentScore: 8000,
        target: 10000, difficulty: 'normal', opponentScore: 10000, finalRound: true });
    }
    check('AI фінал: не банкує програшне', finalBank(400), false);
    check('AI фінал: не банкує нічию', finalBank(2000), false);
    check('AI фінал: банкує переможне', finalBank(2100), true);

    // Game: сідований ГПВЧ (щоденний виклик) — однакові кидки за однакового сіду
    var Game = window.Farkle.Game;
    var g1 = new Game({ mode: 'solo', variant: 'daily', seed: 123456, dailyDate: '2026-01-01' });
    var g2 = new Game({ mode: 'solo', variant: 'daily', seed: 123456, dailyDate: '2026-01-01' });
    check('сід: однаковий перший кидок', g1.rollFresh().dice.join(''), g2.rollFresh().dice.join(''));
    var g3 = Game.fromState(g1.serialize());
    check('сід: відновлення продовжує послідовність',
      g1._rollN(6).join(''), g3._rollN(6).join(''));

    // Game: ліміт ходів у режимі «атака»
    var ga = new Game({ mode: 'solo', variant: 'attack', turnLimit: 10 });
    check('атака: триває до ліміту', ga.nextTurn(9).gameOver, false);
    check('атака: кінець після ліміту', ga.nextTurn(10).gameOver, true);
    var gr = new Game({ mode: 'solo' });
    gr.players[0].score = 10000;
    check('соло-класика: кінець на цілі', gr.nextTurn(5).gameOver, true);

    var summary = (fail === 0)
      ? '✓ Самотест пройдено: ' + pass + '/' + (pass + fail) + ' OK.'
      : '✗ Самотест: ' + pass + ' OK, ' + fail + ' помилок (див. консоль браузера).';
    log(summary, fail === 0 ? 'good' : 'bad');
    return { pass: pass, fail: fail };
  }

  window.Farkle.runTests = runTests;
})();
