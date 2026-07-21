document.addEventListener('DOMContentLoaded', () => {
    const stringDisplay = document.getElementById('string-display');
    const noteDisplay = document.getElementById('note-display');
    const currentNumberDisplay = document.getElementById('current-number-display');
    const answerNumberDisplay = document.getElementById('answer-number-display');
    const answerNoteDisplay = document.getElementById('answer-note-display');
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
    const tabs = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const keySelector = document.getElementById('key-selector');

    let audioContext;
    let scheduler;
    let visualsTimer;
    let nextNoteTime = 0.0;
    let currentBeat = 0;
    let tempo = 120;
    let isRunning = false;
    let accentEnabled = true;
    let noteType = 'naturals';
    let previousString = null;
    let previousNote = null;
    let currentKey = 'C';
    let currentNashvilleNumber = null;
    let previousNashvilleNumber = null;
    let previousNashvilleNote = null;

    const notes = {
        naturals: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
        sharps: ['A#', 'C#', 'D#', 'F#', 'G#'],
        flats: ['Ab', 'Bb', 'Db', 'Eb', 'Gb'],
        all: ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'Ab', 'Bb', 'Db', 'Eb', 'Gb'],
    };

    const chromaticScale = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const keyAliases = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };

    function getMajorScale(rootNote) {
        const scale = [];
        const majorScaleIntervals = [0, 2, 4, 5, 7, 9, 11]; // Intervals in half steps

        // Handle aliases like Db -> C# for easier calculation
        const rootNoteForCalc = keyAliases[rootNote] || rootNote;
        const startIndex = chromaticScale.indexOf(rootNoteForCalc);

        if (startIndex === -1) return [];

        for (const interval of majorScaleIntervals) {
            const noteIndex = (startIndex + interval) % 12;
            scale.push(chromaticScale[noteIndex]);
        }
        return scale;
    }

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

            // On the first beat, update the active tab's display
            if (isFirstBeat) {
                const activeTabId = document.querySelector('.tab-btn.active').dataset.tab;
                if (activeTabId === 'fretboard-tab-content') {
                    updateFretboardDisplay();
                } else if (activeTabId === 'numbers-tab-content') {
                    updateNumbersDisplay();
                }
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
    function updateFretboardDisplay() {
        let newString;
        do {
            newString = Math.floor(Math.random() * 6) + 1;
        } while (newString === previousString);
        previousString = newString;

        const availableNotes = notes[noteType];
        let newNote;
        // Prevent infinite loop if only one note is possible
        if (availableNotes.length > 1) {
            do {
                newNote = availableNotes[Math.floor(Math.random() * availableNotes.length)];
            } while (newNote === previousNote);
        } else {
            newNote = availableNotes.length ? availableNotes[0] : '--';
        }
        previousNote = newNote;

        stringDisplay.textContent = newString;
        noteDisplay.textContent = newNote;
    }

    function updateNumbersDisplay() {
        // On each new measure, the "current" number becomes the "previous" one.
        if (currentNashvilleNumber !== null) {
            previousNashvilleNumber = currentNashvilleNumber;
            const scale = getMajorScale(currentKey);
            if (scale.length > 0) {
                previousNashvilleNote = scale[previousNashvilleNumber - 1];
            }
        }

        // Generate a new "current" number for the user to solve.
        let newNashvilleNumber;
        do {
            newNashvilleNumber = Math.floor(Math.random() * 7) + 1;
        } while (newNashvilleNumber === currentNashvilleNumber);
        currentNashvilleNumber = newNashvilleNumber;

        // Update the top display with the new number.
        currentNumberDisplay.textContent = currentNashvilleNumber;

        // Update the bottom "answer" displays if we have a previous number.
        if (previousNashvilleNumber !== null) {
            answerNumberDisplay.textContent = previousNashvilleNumber;

            let displayNote = previousNashvilleNote;
            // In a major key, the 2nd, 3rd, and 6th degrees are minor.
            if ([2, 3, 6].includes(previousNashvilleNumber)) {
                displayNote += 'm';
            }
            // The 7th degree is diminished.
            else if (previousNashvilleNumber === 7) {
                displayNote += '°';
            }

            answerNoteDisplay.textContent = displayNote;
        }
    }

    function start() {
        if (isRunning) return;
        isRunning = true;

        // Reset displays and state for a clean start
        currentNashvilleNumber = null;
        currentNumberDisplay.textContent = '--';
        answerNumberDisplay.textContent = '--';
        answerNoteDisplay.textContent = '--';

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

        // Clear fretboard displays and the "current" number display.
        // Leave the "answer" displays populated.
        stringDisplay.textContent = '--';
        noteDisplay.textContent = '--';
        currentNumberDisplay.textContent = '--';
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

    keySelector.addEventListener('change', (e) => {
        currentKey = e.target.value;
    });

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Deactivate all tabs and content
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            // Activate the clicked tab and its content
            tab.classList.add('active');
            const contentId = tab.dataset.tab;
            document.getElementById(contentId).classList.add('active');
        });
    });
});
