// store.js — збереження налаштувань та статистики у localStorage (безпечно).
// Доступ: window.Farkle.store
window.Farkle = window.Farkle || {};

(function () {
  'use strict';

  var PREFIX = 'farkle.';
  var DEFAULTS = {
    target: 10000,
    openRule: false,
    difficulty: 'normal', // 'easy' | 'normal' | 'hard'
    sound: true,
    theme: 'green',       // 'green' | 'amber' | 'blue'
    playerName: '',       // ім'я для рейтингу (порожнє = анонім «Ви»)
    lang: 'uk'            // 'uk' | 'en'
  };

  // Перелік ключів статистики (для скидання та обходу).
  var STAT_KEYS = [
    'solo.bestTurns', 'solo.games', 'bestSingleTurn',
    'farkles', 'farklePoints', 'ai.wins', 'ai.losses', 'ai.games'
  ];

  function readRaw(key) {
    try { return localStorage.getItem(PREFIX + key); } catch (e) { return null; }
  }
  function writeRaw(key, val) {
    try { localStorage.setItem(PREFIX + key, val); } catch (e) {}
  }
  function removeRaw(key) {
    try { localStorage.removeItem(PREFIX + key); } catch (e) {}
  }

  // ---- Налаштування ----
  function getSettings() {
    var s = {};
    for (var k in DEFAULTS) {
      if (!DEFAULTS.hasOwnProperty(k)) continue;
      var raw = readRaw('settings.' + k);
      if (raw === null) { s[k] = DEFAULTS[k]; continue; }
      if (typeof DEFAULTS[k] === 'boolean') s[k] = raw === 'true';
      else if (typeof DEFAULTS[k] === 'number') s[k] = parseInt(raw, 10) || DEFAULTS[k];
      else s[k] = raw;
    }
    return s;
  }
  function setSetting(key, val) {
    writeRaw('settings.' + key, String(val));
  }

  // ---- Статистика ----
  function getStat(key) {
    var raw = readRaw('stat.' + key);
    return raw === null ? 0 : (parseInt(raw, 10) || 0);
  }
  function hasStat(key) { return readRaw('stat.' + key) !== null; }
  function setStat(key, val) { writeRaw('stat.' + key, String(val)); }
  function incStat(key, by) {
    var v = getStat(key) + (by === undefined ? 1 : by);
    setStat(key, v);
    return v;
  }
  // Зберегти, якщо нове значення менше (рекорд-мінімум). true, якщо оновлено.
  function recordMin(key, val) {
    var cur = readRaw('stat.' + key);
    if (cur === null || val < parseInt(cur, 10)) { setStat(key, val); return true; }
    return false;
  }
  // Зберегти, якщо нове значення більше (рекорд-максимум).
  function recordMax(key, val) {
    var cur = readRaw('stat.' + key);
    if (cur === null || val > parseInt(cur, 10)) { setStat(key, val); return true; }
    return false;
  }
  function resetStats() {
    for (var i = 0; i < STAT_KEYS.length; i++) removeRaw('stat.' + STAT_KEYS[i]);
  }

  // ---- Збережена гра (для кнопки «Продовжити») ----
  var GAME_KEY = 'savedGame';
  function saveGame(obj) {
    try { writeRaw(GAME_KEY, JSON.stringify(obj)); } catch (e) {}
  }
  function loadGame() {
    var raw = readRaw(GAME_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }
  function clearGame() { removeRaw(GAME_KEY); }
  function hasGame() { return readRaw(GAME_KEY) !== null; }

  // ---- Ідентифікатор браузера (для «власності» імені в рейтингу; не авторизація) ----
  function genId() {
    try {
      if (window.crypto && window.crypto.getRandomValues) {
        var a = new Uint8Array(16);
        window.crypto.getRandomValues(a);
        var s = '';
        for (var i = 0; i < a.length; i++) s += ('0' + a[i].toString(16)).slice(-2);
        return s;
      }
    } catch (e) {}
    return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
  }
  function getClientId() {
    var raw = readRaw('clientId');
    if (raw && /^[A-Za-z0-9_-]{6,64}$/.test(raw)) return raw;
    var id = genId();
    writeRaw('clientId', id);
    return id;
  }

  window.Farkle.store = {
    DEFAULTS: DEFAULTS,
    getSettings: getSettings,
    setSetting: setSetting,
    getStat: getStat,
    hasStat: hasStat,
    setStat: setStat,
    incStat: incStat,
    recordMin: recordMin,
    recordMax: recordMax,
    resetStats: resetStats,
    saveGame: saveGame,
    loadGame: loadGame,
    clearGame: clearGame,
    hasGame: hasGame,
    getClientId: getClientId
  };
})();
