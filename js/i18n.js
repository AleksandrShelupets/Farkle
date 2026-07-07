// i18n.js — локалізація (uk / en). t(key, params) повертає рядок із підстановкою {param}.
// Доступ: window.Farkle.i18n. Мова зберігається в налаштуваннях (store).
window.Farkle = window.Farkle || {};

(function () {
  'use strict';

  var DICT = {
    uk: {
      'app.title': 'FARKLE — консольна гра',
      'player.you': 'Ви',
      'player.computer': 'Комп’ютер',

      // Меню
      'menu.tagline': '// кубикова гра на ризик',
      'menu.continue': '▸ Продовжити гру',
      'menu.playAI': 'Грати проти комп’ютера',
      'menu.playSolo': 'Соло (рекорд)',
      'menu.settings': 'Налаштування',
      'menu.stats': 'Статистика',
      'menu.leaderboard': 'Рейтинг',
      'menu.rules': 'Правила',
      'menu.record': 'Соло-рекорд:',

      // Ігрова панель
      'topbar.rules': 'Правила <kbd>H</kbd>',
      'topbar.menu': 'Меню <kbd>Esc</kbd>',
      'sound.on': '🔊 Звук',
      'sound.off': '🔇 Звук',
      'btn.roll': 'Кинути <kbd>⏎</kbd>',
      'btn.reroll': 'Відкласти й кинути ще <kbd>⏎</kbd>',
      'btn.bank': 'Забанкувати <kbd>B</kbd>',
      'btn.auto': 'Вибрати очкові <kbd>A</kbd>',
      'legend': 'Гарячі клавіші: <kbd>1</kbd>–<kbd>6</kbd> вибрати / зняти кубик · <kbd>A</kbd> вибрати всі очкові · <kbd>⏎</kbd> кинути або кинути ще · <kbd>B</kbd> забанкувати · <kbd>M</kbd> звук · <kbd>H</kbd> правила · <kbd>Esc</kbd> у меню',
      'console.label': '// журнал',

      // Рендер гри
      'game.targetLabel': 'Ціль: {n}',
      'game.record': 'Рекорд: {v}',
      'game.turnPoints': 'Очки ходу: {n}',
      'game.freeDice': 'Вільних кубиків: {n}',
      'game.turnCount': 'Хід: {n}',
      'game.finalRound': '⚑ ФІНАЛЬНЕ КОЛО',
      'game.setAside': 'Відкладено: ',
      'game.pressRoll': 'Натисніть «Кинути», щоб почати хід',
      'game.lostTitle': 'Очок втрачено через Farkle',
      'count.turns': '{n} ходів',

      // Підказки
      'hint.farkle': '✗ FARKLE — жодного очка. Очки ходу згоріли.',
      'hint.choose': 'Оберіть очкові кубики (клік, клавіші 1–6 або A — вибрати всі очкові).',
      'hint.openRule': '✓ +{p}. Щоб «зайти в гру», наберіть {th} за один хід (зараз {cur}).',
      'hint.valid': '✓ Вибір: +{p} очок.',
      'hint.invalid': '✗ Недійсний вибір: усі обрані кубики мають бути очковими.',

      // Кубик (для скрінрідерів)
      'die.aria': 'Кубик {i}, значення {v}',
      'die.ariaSelected': ', обрано',

      // Перемога
      'victory.solo.banner': 'ЦІЛЬ ДОСЯГНУТА',
      'victory.solo.detail': 'Ви набрали {score} очок за {turns} ходів.',
      'victory.win.banner': 'ВИ ПЕРЕМОГЛИ',
      'victory.lose.banner': 'ПЕРЕМІГ КОМП’ЮТЕР',
      'victory.ai.detail': 'Рахунок: {human} (ви) проти {ai} (комп’ютер).',

      // Журнал
      'log.newGameAI': 'Нова гра проти комп’ютера (складність: {diff}). Ціль — {target}.',
      'log.soloMode': 'Соло-режим. Дійди до {target} за якомога менше ходів. Рекорд: {rec}.',
      'log.openRule': 'Правило «зайти з 500»: перший банк має бути ≥ 500 очок.',
      'log.opponentTurn': '— Хід суперника ({name}) —',
      'log.yourTurn': '— Ваш хід — натисніть «Кинути».',
      'log.yourTurnFinal': '— Ваш хід (ФІНАЛЬНЕ КОЛО!) — натисніть «Кинути».',
      'log.roll': 'Кидок: {dice}',
      'log.setAsideReroll': 'Відклали {dice} → банк ходу: {banked}',
      'log.hotHuman': '🔥 ГАРЯЧІ КУБИКИ! Усі шість очкові — кидаєте 6 нових.',
      'log.needOpen': 'Щоб зайти в гру, наберіть щонайменше {th} очок за один хід.',
      'log.banked': '💾 Забанковано +{gained}. Рахунок: {total}.',
      'log.reachedTarget': '⚑ {name} досяг цілі! Суперник робить останній хід.',
      'log.farkleLost': '✗ FARKLE! Згоріло {n} очок ходу.',
      'log.farkleZero': '✗ FARKLE! Очки цього ходу згоріли.',
      'log.aiRolls': 'Комп’ютер кидає: {dice}',
      'log.aiFarkleLost': '✗ Комп’ютер вибив FARKLE — згоріло {n} очок ходу.',
      'log.aiFarkleZero': '✗ Комп’ютер вибив FARKLE — очки ходу згоріли.',
      'log.aiBanks': 'Комп’ютер відкладає {dice} і банкує.',
      'log.aiReroll': 'Комп’ютер відкладає {dice} (банк ходу: {banked}) і кидає далі.',
      'log.hotAI': '🔥 Комп’ютер: ГАРЯЧІ КУБИКИ — 6 нових!',
      'log.soloDone': '🏁 Ціль {target} досягнута за {turns} ходів!',
      'log.newRecord': '🏆 Новий рекорд: {turns} ходів!',
      'log.recordStays': 'Рекорд лишається: {rec} ходів.',
      'log.winner': '🏆 Переможець: {name} ({ws} проти {ls}).',
      'log.pressEnter': 'Натисніть Enter або [Меню] для нової гри.',
      'log.soundOn': 'Звук увімкнено.',
      'log.soundOff': 'Звук вимкнено.',
      'log.resumed': '▸ Гру відновлено — продовжуйте звідти, де зупинились.',

      // Складність
      'diff.easy': 'Легко',
      'diff.normal': 'Норм',
      'diff.hard': 'Складно',

      // Статус імені
      'name.cleared': 'Ім’я очищено — ви граєте як «Ви».',
      'name.invalid': '✗ 2–16 символів: літери, цифри, пробіл, _ . -',
      'name.checking': 'Перевірка…',
      'name.saved': '✓ Ім’я збережено.',
      'name.taken': '✗ Це ім’я вже зайняте іншим гравцем — оберіть інше.',
      'name.offline': '⚠ Сервер недоступний — ім’я збережено лише локально.',
      'name.invalidServer': '✗ Некоректне ім’я.',
      'name.error': '✗ Помилка: {err}',

      // Налаштування
      'set.name': 'Ім’я гравця (для рейтингу):',
      'set.namePlaceholder': 'напр. Олег',
      'set.save': 'Зберегти',
      'set.target': 'Ціль очок:',
      'set.targetCustom': 'Власна…',
      'set.openRule': 'Правило «зайти з 500»',
      'set.difficulty': 'Складність AI:',
      'set.sound': 'Звук',
      'set.theme': 'Тема:',
      'set.language': 'Мова:',
      'set.note': 'Зміни застосовуються до наступної гри (тема, звук і мова — одразу).',
      'theme.green': 'Зелена',
      'theme.amber': 'Янтарна',
      'theme.blue': 'Синя',

      // Модалки
      'modal.close': '[ Закрити ]',
      'confirm.title': 'Підтвердження',
      'confirm.resetStats': 'Скинути всю статистику? Цю дію не можна скасувати.',
      'confirm.yes': '[ Так ]',
      'confirm.no': '[ Ні ]',
      'rules.title': 'Правила Farkle',
      'rules.p1': 'Кидаєте 6 кубиків. Після кожного кидка <b>відкладаєте щонайменше один очковий кубик</b>, потім обираєте: кинути решту ще раз (ризик) або <b>забанкувати</b> очки ходу в загальний рахунок.',
      'rules.p2': 'Якщо кидок <b>не дає жодного очка</b> — це <b class="bad">FARKLE</b>: усі очки поточного ходу згоряють, хід переходить далі.',
      'rules.p3': 'Відклали всі 6 кубиків? <b>Гарячі кубики</b> — берете 6 нових і продовжуєте хід.',
      'rules.p4': 'Перемагає той, хто перший набере цільовий рахунок. Після цього суперник отримує один останній хід, щоб обійти вас.',
      'rules.colCombo': 'Комбінація',
      'rules.colPoints': 'Очки',
      'rules.keys': 'Клавіші: <b>1–6</b> вибрати кубик · <b>A</b> вибрати очкові · <b>Enter</b> кинути / кинути ще · <b>B</b> банк · <b>Esc</b> меню.',
      'combo.one1': 'Одна 1',
      'combo.one5': 'Одна 5',
      'combo.three1': 'Три 1',
      'combo.threeOther': 'Три 2 / 3 / 4 / 5 / 6',
      'combo.four': 'Чотири однакових',
      'combo.five': 'П’ять однакових',
      'combo.six': 'Шість однакових',
      'combo.straight': 'Стріт 1-2-3-4-5-6',
      'combo.threePairs': 'Три пари',
      'combo.twoTriplets': 'Дві трійки',

      'stats.title': 'Статистика',
      'stats.reset': '[ Скинути ]',
      'stats.soloRecord': 'Соло — рекорд (ходів)',
      'stats.soloGames': 'Соло — ігор зіграно',
      'stats.bestTurn': 'Найкращий хід (очки)',
      'stats.farkles': 'Ваших Farkle',
      'stats.farklePoints': 'Очок втрачено (Farkle)',
      'stats.aiWins': 'Проти AI — перемог',
      'stats.aiLosses': 'Проти AI — поразок',
      'stats.aiGames': 'Проти AI — ігор',

      'leaderboard.title': 'Рейтинг гравців',
      'lb.tab.ai': 'Перемоги (AI)',
      'lb.tab.turn': 'Найкращий хід',
      'lb.tab.solo': 'Соло (ходів)',
      'lb.refresh': '[ Оновити ]',
      'lb.unavailable': 'Сервер рейтингу недоступний (працює лише онлайн). Перевірте з’єднання.',
      'lb.error': 'Не вдалося завантажити рейтинг ({err}).',
      'lb.loading': 'Завантаження…',
      'lb.empty': 'Поки що порожньо — зіграйте гру, щоб потрапити в рейтинг!',
      'lb.colPlayer': 'Гравець',
      'lb.colWins': 'Перемоги / ігор',
      'lb.colPoints': 'Очки',
      'lb.colTurns': 'Ходів',

      'victory.playAgain': 'Нова гра <kbd>⏎</kbd>',
      'victory.menu': 'Меню <kbd>Esc</kbd>',

      // Нові режими (атака / щоденний виклик)
      'menu.playAttack': 'Соло: атака (10 ходів)',
      'menu.playDaily': 'Щоденний виклик',
      'game.turnCountOf': 'Хід: {n}/{m}',
      'game.attackLabel': 'Атака: {m} ходів',
      'game.dailyLabel': 'Виклик дня: {m} ходів',
      'log.attackMode': 'Режим «Атака»: набери якнайбільше очок за {turns} ходів. Рекорд: {rec}.',
      'log.dailyMode': 'Щоденний виклик {date}: {turns} ходів, кубики дня однакові для всіх гравців.',
      'log.attackDone': '🏁 Фініш! {score} очок за {turns} ходів.',
      'log.attackRecord': '🏆 Новий рекорд атаки: {score}!',
      'log.attackRecordStays': 'Рекорд атаки лишається: {rec}.',
      'victory.attack.banner': 'ФІНІШ',
      'victory.attack.detail': 'Результат: {score} очок за {turns} ходів.',
      'victory.daily.banner': 'ВИКЛИК ДНЯ ЗАВЕРШЕНО',
      'recap.line': 'Найбільший хід: {big} · Ваші Farkle: {f} · Гарячі кубики: {hot}',
      'stats.attackBest': 'Атака — рекорд (очки)',
      'stats.attackGames': 'Атака — ігор',
      'stats.dailyGames': 'Щоденний виклик — ігор',
      'lb.tab.attack': 'Атака',
      'lb.tab.daily': 'Виклик дня',

      // Назви комбінацій у підказці
      'hint.combo': '✓ {name}! +{p} очок.',
      'cname.straight': 'СТРІТ 1-6',
      'cname.threePairs': 'ТРИ ПАРИ',
      'cname.twoTriplets': 'ДВІ ТРІЙКИ',
      'cname.kind': '{n}×[{f}]',

      // Досягнення
      'menu.achievements': 'Досягнення',
      'ach.title': 'Досягнення',
      'ach.unlocked': '🏆 Досягнення відкрито: {name}',
      'ach.firstWin.name': 'Перша перемога',
      'ach.firstWin.desc': 'Виграйте партію проти комп’ютера.',
      'ach.winHard.name': 'Гросмейстер',
      'ach.winHard.desc': 'Переможіть комп’ютера на складності «Складно».',
      'ach.cleanWin.name': 'Чиста гра',
      'ach.cleanWin.desc': 'Виграйте у комп’ютера, не вибивши жодного Farkle.',
      'ach.straight.name': 'Стріт!',
      'ach.straight.desc': 'Відкладіть стріт 1-2-3-4-5-6.',
      'ach.threePairs.name': 'Три пари',
      'ach.threePairs.desc': 'Відкладіть три пари одним кидком.',
      'ach.twoTriplets.name': 'Дві трійки',
      'ach.twoTriplets.desc': 'Відкладіть дві трійки одним кидком.',
      'ach.sixKind.name': 'Шість в одному',
      'ach.sixKind.desc': 'Відкладіть шість однакових кубиків.',
      'ach.turn2000.name': 'Великий куш',
      'ach.turn2000.desc': 'Забанкуйте 2000+ очок за один хід.',
      'ach.doubleHot.name': 'Подвійний вогонь',
      'ach.doubleHot.desc': 'Двічі спіймайте гарячі кубики за один хід.',
      'ach.daily1.name': 'Виклик прийнято',
      'ach.daily1.desc': 'Завершіть щоденний виклик.'
    },

    en: {
      'app.title': 'FARKLE — console game',
      'player.you': 'You',
      'player.computer': 'Computer',

      // Menu
      'menu.tagline': '// a press-your-luck dice game',
      'menu.continue': '▸ Continue game',
      'menu.playAI': 'Play vs computer',
      'menu.playSolo': 'Solo (best score)',
      'menu.settings': 'Settings',
      'menu.stats': 'Statistics',
      'menu.leaderboard': 'Leaderboard',
      'menu.rules': 'Rules',
      'menu.record': 'Solo record:',

      // Game bar
      'topbar.rules': 'Rules <kbd>H</kbd>',
      'topbar.menu': 'Menu <kbd>Esc</kbd>',
      'sound.on': '🔊 Sound',
      'sound.off': '🔇 Sound',
      'btn.roll': 'Roll <kbd>⏎</kbd>',
      'btn.reroll': 'Set aside & reroll <kbd>⏎</kbd>',
      'btn.bank': 'Bank <kbd>B</kbd>',
      'btn.auto': 'Select scoring <kbd>A</kbd>',
      'legend': 'Hotkeys: <kbd>1</kbd>–<kbd>6</kbd> pick / unpick die · <kbd>A</kbd> select all scoring · <kbd>⏎</kbd> roll or reroll · <kbd>B</kbd> bank · <kbd>M</kbd> sound · <kbd>H</kbd> rules · <kbd>Esc</kbd> menu',
      'console.label': '// log',

      // Game render
      'game.targetLabel': 'Target: {n}',
      'game.record': 'Record: {v}',
      'game.turnPoints': 'Turn points: {n}',
      'game.freeDice': 'Free dice: {n}',
      'game.turnCount': 'Turn: {n}',
      'game.finalRound': '⚑ FINAL ROUND',
      'game.setAside': 'Set aside: ',
      'game.pressRoll': 'Press “Roll” to start your turn',
      'game.lostTitle': 'Points lost to Farkle',
      'count.turns': '{n} turns',

      // Hints
      'hint.farkle': '✗ FARKLE — no scoring dice. Turn points lost.',
      'hint.choose': 'Pick scoring dice (click, keys 1–6, or A for all scoring).',
      'hint.openRule': '✓ +{p}. To get on the board, score {th} in one turn (now {cur}).',
      'hint.valid': '✓ Selection: +{p} points.',
      'hint.invalid': '✗ Invalid selection: every chosen die must score.',

      // Die (for screen readers)
      'die.aria': 'Die {i}, value {v}',
      'die.ariaSelected': ', selected',

      // Victory
      'victory.solo.banner': 'TARGET REACHED',
      'victory.solo.detail': 'You scored {score} points in {turns} turns.',
      'victory.win.banner': 'YOU WIN',
      'victory.lose.banner': 'COMPUTER WINS',
      'victory.ai.detail': 'Score: {human} (you) vs {ai} (computer).',

      // Log
      'log.newGameAI': 'New game vs computer (difficulty: {diff}). Target — {target}.',
      'log.soloMode': 'Solo mode. Reach {target} in as few turns as possible. Record: {rec}.',
      'log.openRule': '“Get in at 500” rule: your first bank must be ≥ 500 points.',
      'log.opponentTurn': '— Opponent’s turn ({name}) —',
      'log.yourTurn': '— Your turn — press “Roll”.',
      'log.yourTurnFinal': '— Your turn (FINAL ROUND!) — press “Roll”.',
      'log.roll': 'Roll: {dice}',
      'log.setAsideReroll': 'Set aside {dice} → turn bank: {banked}',
      'log.hotHuman': '🔥 HOT DICE! All six scored — roll 6 fresh dice.',
      'log.needOpen': 'To get on the board, score at least {th} points in one turn.',
      'log.banked': '💾 Banked +{gained}. Score: {total}.',
      'log.reachedTarget': '⚑ {name} reached the target! Opponent takes the last turn.',
      'log.farkleLost': '✗ FARKLE! {n} turn points lost.',
      'log.farkleZero': '✗ FARKLE! Turn points lost.',
      'log.aiRolls': 'Computer rolls: {dice}',
      'log.aiFarkleLost': '✗ Computer FARKLEd — {n} turn points lost.',
      'log.aiFarkleZero': '✗ Computer FARKLEd — turn points lost.',
      'log.aiBanks': 'Computer sets aside {dice} and banks.',
      'log.aiReroll': 'Computer sets aside {dice} (turn bank: {banked}) and rolls on.',
      'log.hotAI': '🔥 Computer: HOT DICE — 6 fresh!',
      'log.soloDone': '🏁 Target {target} reached in {turns} turns!',
      'log.newRecord': '🏆 New record: {turns} turns!',
      'log.recordStays': 'Record stays: {rec} turns.',
      'log.winner': '🏆 Winner: {name} ({ws} vs {ls}).',
      'log.pressEnter': 'Press Enter or [Menu] for a new game.',
      'log.soundOn': 'Sound on.',
      'log.soundOff': 'Sound off.',
      'log.resumed': '▸ Game resumed — pick up where you left off.',

      // Difficulty
      'diff.easy': 'Easy',
      'diff.normal': 'Normal',
      'diff.hard': 'Hard',

      // Name status
      'name.cleared': 'Name cleared — you play as “You”.',
      'name.invalid': '✗ 2–16 chars: letters, digits, space, _ . -',
      'name.checking': 'Checking…',
      'name.saved': '✓ Name saved.',
      'name.taken': '✗ This name is already taken by another player — choose another.',
      'name.offline': '⚠ Server unavailable — name saved locally only.',
      'name.invalidServer': '✗ Invalid name.',
      'name.error': '✗ Error: {err}',

      // Settings
      'set.name': 'Player name (for leaderboard):',
      'set.namePlaceholder': 'e.g. Alex',
      'set.save': 'Save',
      'set.target': 'Target score:',
      'set.targetCustom': 'Custom…',
      'set.openRule': '“Get in at 500” rule',
      'set.difficulty': 'AI difficulty:',
      'set.sound': 'Sound',
      'set.theme': 'Theme:',
      'set.language': 'Language:',
      'set.note': 'Changes apply to the next game (theme, sound & language apply instantly).',
      'theme.green': 'Green',
      'theme.amber': 'Amber',
      'theme.blue': 'Blue',

      // Modals
      'modal.close': '[ Close ]',
      'confirm.title': 'Confirm',
      'confirm.resetStats': 'Reset all statistics? This cannot be undone.',
      'confirm.yes': '[ Yes ]',
      'confirm.no': '[ No ]',
      'rules.title': 'Farkle Rules',
      'rules.p1': 'You roll 6 dice. After each roll you <b>set aside at least one scoring die</b>, then choose: reroll the rest (risk) or <b>bank</b> the turn points into your total.',
      'rules.p2': 'If a roll <b>scores nothing</b> it’s a <b class="bad">FARKLE</b>: all points from the current turn are lost and play passes on.',
      'rules.p3': 'Set all 6 dice aside? <b>Hot dice</b> — take 6 fresh dice and keep your turn going.',
      'rules.p4': 'First to reach the target score wins. After that the opponent gets one last turn to overtake you.',
      'rules.colCombo': 'Combination',
      'rules.colPoints': 'Points',
      'rules.keys': 'Keys: <b>1–6</b> pick die · <b>A</b> select scoring · <b>Enter</b> roll / reroll · <b>B</b> bank · <b>Esc</b> menu.',
      'combo.one1': 'Single 1',
      'combo.one5': 'Single 5',
      'combo.three1': 'Three 1s',
      'combo.threeOther': 'Three 2/3/4/5/6',
      'combo.four': 'Four of a kind',
      'combo.five': 'Five of a kind',
      'combo.six': 'Six of a kind',
      'combo.straight': 'Straight 1-2-3-4-5-6',
      'combo.threePairs': 'Three pairs',
      'combo.twoTriplets': 'Two triplets',

      'stats.title': 'Statistics',
      'stats.reset': '[ Reset ]',
      'stats.soloRecord': 'Solo — record (turns)',
      'stats.soloGames': 'Solo — games played',
      'stats.bestTurn': 'Best turn (points)',
      'stats.farkles': 'Your Farkles',
      'stats.farklePoints': 'Points lost (Farkle)',
      'stats.aiWins': 'Vs AI — wins',
      'stats.aiLosses': 'Vs AI — losses',
      'stats.aiGames': 'Vs AI — games',

      'leaderboard.title': 'Player leaderboard',
      'lb.tab.ai': 'Wins (AI)',
      'lb.tab.turn': 'Best turn',
      'lb.tab.solo': 'Solo (turns)',
      'lb.refresh': '[ Refresh ]',
      'lb.unavailable': 'Leaderboard server unavailable (online only). Check your connection.',
      'lb.error': 'Failed to load leaderboard ({err}).',
      'lb.loading': 'Loading…',
      'lb.empty': 'Empty for now — play a game to get on the board!',
      'lb.colPlayer': 'Player',
      'lb.colWins': 'Wins / games',
      'lb.colPoints': 'Points',
      'lb.colTurns': 'Turns',

      'victory.playAgain': 'New game <kbd>⏎</kbd>',
      'victory.menu': 'Menu <kbd>Esc</kbd>',

      // New modes (attack / daily challenge)
      'menu.playAttack': 'Solo: attack (10 turns)',
      'menu.playDaily': 'Daily challenge',
      'game.turnCountOf': 'Turn: {n}/{m}',
      'game.attackLabel': 'Attack: {m} turns',
      'game.dailyLabel': 'Daily challenge: {m} turns',
      'log.attackMode': 'Attack mode: score as much as you can in {turns} turns. Record: {rec}.',
      'log.dailyMode': 'Daily challenge {date}: {turns} turns, everyone gets the same dice today.',
      'log.attackDone': '🏁 Finished! {score} points in {turns} turns.',
      'log.attackRecord': '🏆 New attack record: {score}!',
      'log.attackRecordStays': 'Attack record stays: {rec}.',
      'victory.attack.banner': 'FINISH',
      'victory.attack.detail': 'Result: {score} points in {turns} turns.',
      'victory.daily.banner': 'DAILY CHALLENGE DONE',
      'recap.line': 'Biggest turn: {big} · Your Farkles: {f} · Hot dice: {hot}',
      'stats.attackBest': 'Attack — record (points)',
      'stats.attackGames': 'Attack — games',
      'stats.dailyGames': 'Daily challenge — games',
      'lb.tab.attack': 'Attack',
      'lb.tab.daily': 'Daily',

      // Combo names in the hint
      'hint.combo': '✓ {name}! +{p} points.',
      'cname.straight': 'STRAIGHT 1-6',
      'cname.threePairs': 'THREE PAIRS',
      'cname.twoTriplets': 'TWO TRIPLETS',
      'cname.kind': '{n}×[{f}]',

      // Achievements
      'menu.achievements': 'Achievements',
      'ach.title': 'Achievements',
      'ach.unlocked': '🏆 Achievement unlocked: {name}',
      'ach.firstWin.name': 'First victory',
      'ach.firstWin.desc': 'Win a game against the computer.',
      'ach.winHard.name': 'Grandmaster',
      'ach.winHard.desc': 'Beat the computer on Hard difficulty.',
      'ach.cleanWin.name': 'Clean sheet',
      'ach.cleanWin.desc': 'Beat the computer without a single Farkle.',
      'ach.straight.name': 'Straight!',
      'ach.straight.desc': 'Set aside a 1-2-3-4-5-6 straight.',
      'ach.threePairs.name': 'Three pairs',
      'ach.threePairs.desc': 'Set aside three pairs in one roll.',
      'ach.twoTriplets.name': 'Two triplets',
      'ach.twoTriplets.desc': 'Set aside two triplets in one roll.',
      'ach.sixKind.name': 'Six of a kind',
      'ach.sixKind.desc': 'Set aside six identical dice.',
      'ach.turn2000.name': 'Jackpot',
      'ach.turn2000.desc': 'Bank 2000+ points in a single turn.',
      'ach.doubleHot.name': 'Double fire',
      'ach.doubleHot.desc': 'Hit hot dice twice in one turn.',
      'ach.daily1.name': 'Challenge accepted',
      'ach.daily1.desc': 'Finish a daily challenge.'
    }
  };

  var lang = 'uk';

  function setLang(l) { lang = DICT[l] ? l : 'uk'; }
  function getLang() { return lang; }

  function t(key, params) {
    var table = DICT[lang] || DICT.uk;
    var s = table[key];
    if (s == null) s = (DICT.uk[key] != null ? DICT.uk[key] : key);
    if (params) {
      s = s.replace(/\{(\w+)\}/g, function (m, k) {
        return params[k] != null ? params[k] : m;
      });
    }
    return s;
  }

  window.Farkle.i18n = { setLang: setLang, getLang: getLang, t: t, langs: ['uk', 'en'] };
})();
