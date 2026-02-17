document.addEventListener('DOMContentLoaded', () => {
    const MIN_HZ = 25, MAX_HZ = 75;
    let currentHz = 49;
    let audioCtx, activeOsc, activeGain, analyser, vizRAF, melodyTimeout;

    // --- Audio Handshake (Fixes Laptop Issue) ---
    function initAudio() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') audioCtx.resume();
        return audioCtx;
    }

    function stopAll() {
        if (melodyTimeout) clearTimeout(melodyTimeout);
        if (activeOsc) { try { activeOsc.stop(); } catch(e){} activeOsc = null; }
        if (vizRAF) cancelAnimationFrame(vizRAF);
        document.querySelectorAll('.key-active, .playing').forEach(el => el.classList.remove('key-active', 'playing'));
        const canvas = document.getElementById('waveCanvas');
        if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
        syncUI(currentHz, "Oobleck Dance Station");
    }

    function syncUI(hz, label = null) {
        const displayHz = hz.toFixed(1);
        const pct = ((hz - MIN_HZ) / (MAX_HZ - MIN_HZ)) * 100;
        document.getElementById('oobleckTitle').style.setProperty('--pct', `${pct}%`);
        document.querySelectorAll('.title-layer').forEach(el => el.textContent = label ? label : `${displayHz} Hz`);
        document.getElementById('freqReadout').textContent = Math.round(hz);
        document.getElementById('sweepReadout').textContent = displayHz;
        
        const angle = -135 + (pct / 100) * 270;
        document.querySelector('.knob-indicator').style.transform = `translateX(-50%) rotate(${angle}deg)`;
    }

    // --- Core Sound Engine ---
    function playTone(freq, duration = null) {
        const ctx = initAudio();
        stopAll();
        activeOsc = ctx.createOscillator();
        activeGain = ctx.createGain();
        analyser = ctx.createAnalyser();

        activeOsc.frequency.setValueAtTime(freq, ctx.currentTime);
        activeGain.gain.setValueAtTime(0.3, ctx.currentTime);
        
        activeOsc.connect(activeGain).connect(analyser).connect(ctx.destination);
        activeOsc.start();
        if (duration) {
            activeGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (duration/1000));
            activeOsc.stop(ctx.currentTime + (duration/1000));
        }
        startViz();
    }

    // --- Sweep Logic (Release to Play) ---
    const sweepSlider = document.getElementById('sweepSlider');
    sweepSlider.addEventListener('input', (e) => syncUI(parseFloat(e.target.value)));
    sweepSlider.addEventListener('change', (e) => {
        const start = parseFloat(e.target.value);
        const end = start + 10;
        const ctx = initAudio();
        playTone(start);
        activeOsc.frequency.linearRampToValueAtTime(end, ctx.currentTime + 7);
        activeGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 7);
        activeOsc.stop(ctx.currentTime + 7.1);
    });

    // --- Song Logic ---
    function setupSongs() {
        const grid = document.getElementById('songGrid');
        Object.keys(SONG_LIBRARY).forEach(id => {
            const btn = document.createElement('button');
            btn.className = 'song-btn';
            btn.innerText = SONG_LIBRARY[id].title;
            btn.onclick = () => {
                stopAll();
                btn.classList.add('playing');
                playMelody(id);
            };
            grid.appendChild(btn);
        });
    }

    async function playMelody(id) {
        const song = SONG_LIBRARY[id];
        for (const note of song.notes) {
            const freq = NOTES[note.n] * Math.pow(2, (TRANSPOSE_SEMITONES + song.trim) / 12);
            if (freq > 0) {
                playTone(freq, note.d);
                syncUI(freq, song.title);
            }
            await new Promise(r => melodyTimeout = setTimeout(r, note.d));
        }
        document.querySelectorAll('.playing').forEach(b => b.classList.remove('playing'));
    }

    // --- Keyboard Builder ---
    function setupKeyboard() {
        const piano = document.getElementById('piano');
        const keyboardNotes = [
            {f: 24.5, t: 'white'}, {f: 25.9, t: 'black'}, {f: 27.5, t: 'white'},
            {f: 29.1, t: 'black'}, {f: 30.8, t: 'white'}, {f: 32.7, t: 'white'},
            {f: 34.6, t: 'black'}, {f: 36.7, t: 'white'}
        ];
        keyboardNotes.forEach(n => {
            const key = document.createElement('div');
            key.className = n.t + '-key';
            key.onmousedown = key.ontouchstart = (e) => {
                e.preventDefault();
                playTone(n.f);
                key.classList.add('key-active');
                syncUI(n.f);
            };
            key.onmouseup = key.ontouchend = stopAll;
            piano.appendChild(key);
        });
    }

    // --- Visualizer ---
    function startViz() {
        const canvas = document.getElementById('waveCanvas');
        const ctx = canvas.getContext('2d');
        const buffer = new Uint8Array(analyser.fftSize);
        const draw = () => {
            vizRAF = requestAnimationFrame(draw);
            analyser.getByteTimeDomainData(buffer);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.beginPath(); ctx.strokeStyle = '#ff3b30'; ctx.lineWidth = 2;
            for(let i=0; i<buffer.length; i++) {
                const x = (i/buffer.length)*canvas.width;
                const y = (buffer[i]/255)*canvas.height;
                i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
            }
            ctx.stroke();
        };
        draw();
    }

    // --- Bindings ---
    window.switchMode = (mode) => {
        stopAll();
        document.querySelectorAll('.mode-panel').forEach(p => p.classList.remove('active'));
        document.getElementById(mode + '-ui').classList.add('active');
    };
    document.getElementById('panicBtn').onclick = stopAll;
    document.getElementById('freqUpBtn').onclick = () => { currentHz++; syncUI(currentHz); };
    document.getElementById('freqDownBtn').onclick = () => { currentHz--; syncUI(currentHz); };
    document.getElementById('tonePlayBtn').onmousedown = () => playTone(currentHz);
    document.getElementById('tonePlayBtn').onmouseup = stopAll;

    setupSongs();
    setupKeyboard();
    syncUI(currentHz);
});