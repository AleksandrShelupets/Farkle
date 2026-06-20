// sound.js — звукові ефекти через WebAudio (без файлів). Доступ: window.Farkle.sound
window.Farkle = window.Farkle || {};

(function () {
  'use strict';

  var ctx = null;
  var muted = false;

  function ensure() {
    if (ctx) return ctx;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    } catch (e) { ctx = null; }
    return ctx;
  }

  // Резюмувати аудіоконтекст при першому жесті (політика автоплею браузерів).
  function init() {
    var resume = function () {
      var c = ensure();
      if (c && c.state === 'suspended') { try { c.resume(); } catch (e) {} }
      document.removeEventListener('pointerdown', resume);
      document.removeEventListener('keydown', resume);
    };
    document.addEventListener('pointerdown', resume);
    document.addEventListener('keydown', resume);
  }

  function setMuted(v) { muted = !!v; }

  function tone(freq, startOffset, dur, type, peak) {
    var c = ensure();
    if (!c || muted) return;
    var t0 = c.currentTime + (startOffset || 0);
    var osc = c.createOscillator();
    var g = c.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak || 0.12, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(c.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  function noise(startOffset, dur, peak) {
    var c = ensure();
    if (!c || muted) return;
    var t0 = c.currentTime + (startOffset || 0);
    var n = Math.max(1, Math.floor(c.sampleRate * dur));
    var buf = c.createBuffer(1, n, c.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var src = c.createBufferSource(); src.buffer = buf;
    var g = c.createGain();
    g.gain.setValueAtTime(peak || 0.15, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    var f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 700;
    src.connect(f); f.connect(g); g.connect(c.destination);
    src.start(t0); src.stop(t0 + dur);
  }

  // ---- Ефекти ----
  function roll() { noise(0, 0.13, 0.18); noise(0.07, 0.1, 0.12); }
  function select() { tone(660, 0, 0.06, 'square', 0.08); }
  function bank() { tone(523, 0, 0.1, 'square', 0.1); tone(784, 0.1, 0.16, 'square', 0.1); }
  function hot() { tone(880, 0, 0.05); tone(1175, 0.07, 0.05); tone(1568, 0.14, 0.07); }
  function win() {
    var notes = [523, 659, 784, 1047];
    for (var i = 0; i < notes.length; i++) tone(notes[i], i * 0.13, 0.18, 'square', 0.1);
  }
  function farkle() {
    var c = ensure();
    if (!c || muted) return;
    var t0 = c.currentTime;
    var osc = c.createOscillator();
    var g = c.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, t0);
    osc.frequency.exponentialRampToValueAtTime(70, t0 + 0.4);
    g.gain.setValueAtTime(0.18, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45);
    osc.connect(g); g.connect(c.destination);
    osc.start(t0); osc.stop(t0 + 0.46);
  }

  window.Farkle.sound = {
    init: init,
    setMuted: setMuted,
    roll: roll,
    select: select,
    bank: bank,
    hot: hot,
    win: win,
    farkle: farkle
  };
})();
