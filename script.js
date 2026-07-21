document.addEventListener('DOMContentLoaded', () => {
    const stringDisplay = document.getElementById('string-display');
    const noteDisplay = document.getElementById('note-display');
    const beatDots = [
        document.getElementById('beat-1'),
        document.getElementById('beat-2'),
        document.getElementById('beat-3'),
        document.getElementById('beat-4')
    ];
    const accentCaret = document.querySelector('.accent-caret');
    const tempoSlider = document.getElementById('tempo-slider');
    const tempoValue = document.getElementById('tempo-value');
    const noteTypeButtons = document.querySelectorAll('.note-type-btn');
    const startStopBtn = document.getElementById('start-stop-btn');

    let audioContext;
    let scheduler;
    let visualsTimer;
    let nextNoteTime = 0.0;
    let currentBeat = 0;
    let tempo = 120;
    let isRunning = false;
    let accentEnabled = true;
    let noteType = 'naturals';

    const notes = {
        naturals: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
        sharps: ['A#', 'C#', 'D#', 'F#', 'G#'],
        flats: ['Ab', 'Bb', 'Db', 'Eb', 'Gb'],
        all: ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#']
    };

    // --- Audio Setup ---
    function setupAudio() {
        if (audioContext) return;
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            // This is a workaround for iOS to play sound even with the mute switch on.
            const silent = audioContext.createGain();
            silent.gain.value = 0;
            const p = audioContext.createOscillator();
            p.type = 'square';
            p.connect(silent);
            silent.connect(audioContext.destination);
            p.start(0);
            p.stop(0.01);
        } catch (e) {
            console.error("Web Audio API is not supported in this browser");
        }
    }

    function playSound(time, accent) {
        if (!audioContext) return;
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);

        // Use a triangle wave and higher frequencies for a brighter, more traditional click
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(accent ? 1600.0 : 1000.0, time);
        gain.gain.setValueAtTime(1, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

        osc.start(time);
        osc.stop(time + 0.05);
    }

    // --- Metronome Logic ---
    function nextBeat() {
        const secondsPerBeat = 60.0 / tempo;
        nextNoteTime += secondsPerBeat;
        currentBeat = (currentBeat + 1) % 4;
    }

    function schedule() {
        while (nextNoteTime < audioContext.currentTime + 0.1) {
            const isFirstBeat = currentBeat === 0;
            playSound(nextNoteTime, isFirstBeat && accentEnabled);

            if (isFirstBeat) {
                updateDisplay();
            }

            updateVisuals(currentBeat, nextNoteTime);
            nextBeat();
        }
        scheduler = window.requestAnimationFrame(schedule);
    }

    function updateVisuals(beat, time) {
        visualsTimer = setTimeout(() => {
            beatDots.forEach((dot, index) => {
                dot.classList.toggle('active', index === beat);
            });
        }, (time - audioContext.currentTime) * 1000);
    }

    // --- Application Logic ---
    function updateDisplay() {
        const randomString = Math.floor(Math.random() * 6) + 1;
        const availableNotes = notes[noteType];
        const randomNote = availableNotes[Math.floor(Math.random() * availableNotes.length)];

        stringDisplay.textContent = randomString;
        noteDisplay.textContent = randomNote;
    }

    function start() {
        if (isRunning) return;
        isRunning = true;

        setupAudio();
        audioContext.resume(); // Important for autoplay policies

        currentBeat = 0; // To start on beat 1 immediately
        nextNoteTime = audioContext.currentTime;

        schedule();

        startStopBtn.textContent = 'Stop';
        startStopBtn.classList.add('running');
    }

    function stop() {
        if (!isRunning) return;
        isRunning = false;

        window.cancelAnimationFrame(scheduler);
        clearTimeout(visualsTimer);

        stringDisplay.textContent = '--';
        noteDisplay.textContent = '--';
        beatDots.forEach(dot => dot.classList.remove('active'));

        startStopBtn.textContent = 'Start';
        startStopBtn.classList.remove('running');
    }

    // --- Event Listeners ---
    startStopBtn.addEventListener('click', () => {
        if (isRunning) {
            stop();
        } else {
            start();
        }
    });

    tempoSlider.addEventListener('input', (e) => {
        tempo = e.target.value;
        tempoValue.textContent = tempo;
    });

    noteTypeButtons.forEach(button => {
        button.addEventListener('click', () => {
            noteTypeButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            noteType = button.dataset.type;
        });
    });

    beatDots[0].addEventListener('click', () => {
        accentEnabled = !accentEnabled;
        accentCaret.style.display = accentEnabled ? 'block' : 'none';
    });
});
