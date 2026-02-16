// script.js - v1.90 (Unified & iOS Fixed)
const PI = Math.PI;

document.addEventListener('DOMContentLoaded', () => {
  const MIN_HZ = 25, MAX_HZ = 75;
  let currentHz = 49;
  let audioContext, activeOsc, activeGain, analyser, vizRAF, trackRAF, melodyTimeout, toneInterval;

  // --- iOS AUDIO HANDSHAKE ---
  const unlockAudio = () => {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') {
      audioContext.resume();
      const s = audioContext.createBufferSource();
      s.buffer = audioContext.createBuffer(1, 1, 22050);
      s.connect(audioContext.destination);
      s.start(0);
    }
    ['touchstart', 'mousedown'].forEach(ev => window.removeEventListener(ev, unlockAudio));
  };
  window.addEventListener('touchstart', unlockAudio);
  window.addEventListener('mousedown', unlockAudio);

  function getSafeContext() {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
    return audioContext;
  }

  function stopAll() {
    if (melodyTimeout) clearTimeout(melodyTimeout);
    if (toneInterval) clearInterval(toneInterval);
    if (activeOsc) { try { activeOsc.stop(); activeOsc.disconnect(); } catch(e){} activeOsc = null; }
    if (activeGain) { activeGain.disconnect(); activeGain = null; }
    if (vizRAF) cancelAnimationFrame(vizRAF);
    if (trackRAF) cancelAnimationFrame(trackRAF);
    document.body.classList.remove('active-audio');
    updateTitleText("Oobleck Dance Generator");
    const canvas = document.getElementById('waveCanvas');
    if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  }

  function updateTitleText(text) {
    document.querySelectorAll('.title-layer').forEach(el => el.textContent = text);
  }

  function syncUI(hz, label = null) {
    const displayHz = Math.round(hz);
    const pct = ((Math.max(MIN_HZ, Math.min(MAX_HZ, hz)) - MIN_HZ) / (MAX_HZ - MIN_HZ)) * 100;
    document.querySelector('.freq-title')?.style.setProperty('--title-pct', `${pct}%`);
    updateTitleText(label ? `${label} (${displayHz} Hz)` : `${displayHz} Hz`);
    document.getElementById('freqReadout').textContent = displayHz;
    const angle = -135 + ((Math.max(MIN_HZ, Math.min(MAX_HZ, hz)) - MIN_HZ) / (MAX_HZ - MIN_HZ)) * 270;
    document.querySelectorAll('.knob-indicator').forEach(i => i.style.transform = `translateX(-50%) rotate(${angle}deg)`);
  }

  // --- MODES ---
  function playSweep(start, end, label) {
    stopAll();
    const ctx = getSafeContext();
    analyser = ctx.createAnalyser();
    activeOsc = ctx.createOscillator();
    activeGain = ctx.createGain();
    activeOsc.frequency.setValueAtTime(start, ctx.currentTime);
    activeOsc.frequency.linearRampToValueAtTime(end, ctx.currentTime + 7);
    activeGain.gain.setValueAtTime(0.3, ctx.currentTime);
    activeOsc.connect(activeGain).connect(analyser).connect(ctx.destination);
    activeOsc.start(); activeOsc.stop(ctx.currentTime + 7);
    const startTime = ctx.currentTime;
    const track = () => {
      if (!activeOsc) return;
      const elapsed = ctx.currentTime - startTime;
      if (elapsed <= 7) {
        syncUI(start + (end - start) * (elapsed / 7), label);
        trackRAF = requestAnimationFrame(track);
      }
    };
    track(); startViz();
  }

  function playMelody(songId) {
    stopAll();
    const song = SONG_LIBRARY[songId];
    if (!song) return;
    const ctx = getSafeContext();
    let idx = 0;
    const next = () => {
      const note = song.notes[idx];
      analyser = ctx.createAnalyser();
      activeOsc = ctx.createOscillator();
      activeGain = ctx.createGain();
      const freq = NOTES[note.n] * Math.pow(2, (TRANSPOSE_SEMITONES + song.trim) / 12);
      syncUI(freq, song.title);
      activeOsc.frequency.setValueAtTime(freq, ctx.currentTime);
      activeGain.gain.setValueAtTime(0.3, ctx.currentTime);
      activeGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (note.d/1000));
      activeOsc.connect(activeGain).connect(analyser).connect(ctx.destination);
      activeOsc.start(); activeOsc.stop(ctx.currentTime + (note.d/1000));
      idx = (idx + 1) % song.notes.length;
      melodyTimeout = setTimeout(next, note.d);
      startViz();
    };
    next();
  }

  function startViz() {
    const canvas = document.getElementById('waveCanvas');
    if (!canvas || !analyser) return;
    const ctx = canvas.getContext('2d'), data = new Uint8Array(analyser.fftSize);
    const draw = () => {
      vizRAF = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(data);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.beginPath(); ctx.strokeStyle = '#ff3b30'; ctx.lineWidth = 3;
      for (let i = 0; i < data.length; i++) {
        const x = (i/data.length)*canvas.width, y = (data[i]/255)*canvas.height;
        i === 0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
      }
      ctx.stroke();
      let sum = 0;
      for(let i=0; i<data.length; i++) { sum += Math.abs(data[i]-128)/128; }
      document.querySelector('.freq-title')?.style.setProperty('--pulse', String((sum/data.length) * 4));
    };
    draw();
  }

  // --- BINDINGS ---
  document.getElementById('startBtn').onclick = () => {
    stopAll();
    const ctx = getSafeContext();
    analyser = ctx.createAnalyser();
    activeOsc = ctx.createOscillator();
    activeGain = ctx.createGain();
    activeOsc.frequency.setValueAtTime(currentHz, ctx.currentTime);
    activeOsc.isGen = true;
    activeGain.gain.setValueAtTime(0.3, ctx.currentTime);
    activeOsc.connect(activeGain).connect(analyser).connect(ctx.destination);
    activeOsc.start(); startViz(); syncUI(currentHz);
  };

  document.getElementById('bassDropBtn').onclick = () => playSweep(75, 25, "Bass Drop");
  document.getElementById('bassRiseBtn').onclick = () => playSweep(25, 75, "Bass Rise");
  document.getElementById('testTonesBtn').onclick = () => {
    stopAll(); const ctx = getSafeContext();
    analyser = ctx.createAnalyser(); activeOsc = ctx.createOscillator(); activeGain = ctx.createGain();
    activeOsc.type = 'sawtooth'; syncUI(2500, "Test Tones");
    toneInterval = setInterval(() => {
      const f = activeOsc.frequency.value === 2400 ? 2600 : 2400;
      activeOsc.frequency.setTargetAtTime(f, ctx.currentTime, 0.01);
      syncUI(f, "Test Tones");
    }, 250);
    activeGain.gain.value = 0.1;
    activeOsc.connect(activeGain).connect(analyser).connect(ctx.destination);
    activeOsc.start(); startViz();
  };

  document.querySelectorAll('.song-btn').forEach(b => {
    b.onclick = () => playMelody(b.id.replace('Btn', ''));
  });

  document.getElementById('stopBtn').onclick = stopAll;
  document.getElementById('vizStopBtn').onclick = stopAll;
  document.getElementById('freqDownBtn').onclick = () => { currentHz--; syncUI(currentHz); if(activeOsc?.isGen) activeOsc.frequency.value = currentHz; };
  document.getElementById('freqUpBtn').onclick = () => { currentHz++; syncUI(currentHz); if(activeOsc?.isGen) activeOsc.frequency.value = currentHz; };

  let dragging = false, knob;
  const onMove = (e) => {
    if (!dragging || !knob) return;
    const pt = e.touches ? e.touches[0] : e, r = knob.getBoundingClientRect();
    const deg = Math.atan2(pt.clientY - (r.top + r.height/2), pt.clientX - (r.left + r.width/2)) * (180/PI) + 90;
    currentHz = Math.round(MIN_HZ + ((Math.max(-135, Math.min(135, (deg > 180 ? deg-360 : deg))) + 135) / 270) * (MAX_HZ - MIN_HZ));
    syncUI(currentHz);
    if (activeOsc?.isGen) activeOsc.frequency.setTargetAtTime(currentHz, audioContext.currentTime, 0.05);
  };
  document.querySelectorAll('.knob').forEach(k => {
    k.onmousedown = () => { dragging = true; knob = k; };
    k.ontouchstart = (e) => { dragging = true; knob = k; e.preventDefault(); };
  });
  window.onmousemove = onMove; window.ontouchmove = onMove;
  window.onmouseup = () => dragging = false; window.ontouchend = () => dragging = false;

  syncUI(currentHz);
});