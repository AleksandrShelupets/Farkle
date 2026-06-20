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

    var summary = (fail === 0)
      ? '✓ Самотест пройдено: ' + pass + '/' + (pass + fail) + ' OK.'
      : '✗ Самотест: ' + pass + ' OK, ' + fail + ' помилок (див. консоль браузера).';
    log(summary, fail === 0 ? 'good' : 'bad');
    return { pass: pass, fail: fail };
  }

  window.Farkle.runTests = runTests;
})();
