document.addEventListener('DOMContentLoaded', () => {
    // =================================================================================
    // CONSTANTS & CONFIG
    // =================================================================================

    const DOM = {
        stringDisplay: document.getElementById('string-display'),
        noteDisplay: document.getElementById('note-display'),
        currentNumberDisplay: document.getElementById('current-number-display'),
        answerNumberDisplay: document.getElementById('answer-number-display'),
        answerNoteDisplay: document.getElementById('answer-note-display'),
        beatDots: [
            document.getElementById('beat-1'),
            document.getElementById('beat-2'),
            document.getElementById('beat-3'),
            document.getElementById('beat-4')
        ],
        accentCaret: document.querySelector('.accent-caret'),
        tempoSlider: document.getElementById('tempo-slider'),
        tempoValue: document.getElementById('tempo-value'),
        noteTypeButtons: document.querySelectorAll('.note-type-btn'),
        startStopBtn: document.getElementById('start-stop-btn'),
        tabs: document.querySelectorAll('.tab-btn'),
        tabContents: document.querySelectorAll('.tab-content'),
        keySelector: document.getElementById('key-selector'),
    };

    const CONSTANTS = {
        NOTES: {
            naturals: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
            sharps: ['A#', 'C#', 'D#', 'F#', 'G#'],
            flats: ['Ab', 'Bb', 'Db', 'Eb', 'Gb'],
            all: ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'Ab', 'Bb', 'Db', 'Eb', 'Gb'],
        },
        SHARP_CHROMATIC_SCALE: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
        FLAT_CHROMATIC_SCALE:  ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'],
        MAJOR_SCALE_INTERVALS: [0, 2, 4, 5, 7, 9, 11],
    };

    // =================================================================================
    // STATE
    // =================================================================================

    const State = {
        audioContext: null,
        scheduler: null,
        visualsTimer: null,
        nextNoteTime: 0.0,
        currentBeat: 0,
        tempo: 120,
        isRunning: false,
        accentEnabled: true,
        noteType: 'naturals',
        previousString: null,
        previousNote: null,
        currentKey: 'C',
        currentNashvilleNumber: null,
        previousNashvilleNumber: null,
        previousNashvilleNote: null,
    };

    // =================================================================================
    // MUSIC THEORY UTILS
    // =================================================================================

    function getMajorScale(rootNote) {
        const scale = [];
        const flatKeys = ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb'];
        const useFlatScale = flatKeys.includes(rootNote);
        const chromaticScale = useFlatScale 
            ? CONSTANTS.FLAT_CHROMATIC_SCALE 
            : CONSTANTS.SHARP_CHROMATIC_SCALE;

        const startIndex = chromaticScale.indexOf(rootNote);

        if (startIndex === -1) {
            console.error(`Root note ${rootNote} not found in chosen chromatic scale.`);
            return [];
        };

        for (const interval of CONSTANTS.MAJOR_SCALE_INTERVALS) {
            const noteIndex = (startIndex + interval) % 12;
            scale.push(chromaticScale[noteIndex]);
        }
        return scale;
    }

    // =================================================================================
    // AUDIO
    // =================================================================================

    function setupAudio() {
        if (State.audioContext) return;
        try {
            State.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            // This is a workaround for iOS to play sound even with the mute switch on.
            const silent = State.audioContext.createGain();
            silent.gain.value = 0;
            const p = State.audioContext.createOscillator();
            p.type = 'square';
            p.connect(silent);
            silent.connect(State.audioContext.destination);
            p.start(0);
            p.stop(0.01);
        } catch (e) {
            console.error("Web Audio API is not supported in this browser");
        }
    }

    function playSound(time, accent) {
        if (!State.audioContext) return;
        const osc = State.audioContext.createOscillator();
        const gain = State.audioContext.createGain();
        osc.connect(gain);
        gain.connect(State.audioContext.destination);

        // Use a triangle wave and higher frequencies for a brighter, more traditional click
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(accent ? 1600.0 : 1000.0, time);
        gain.gain.setValueAtTime(1, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

        osc.start(time);
        osc.stop(time + 0.05);
    }

    // =================================================================================
    // METRONOME
    // =================================================================================

    function nextBeat() {
        const secondsPerBeat = 60.0 / State.tempo;
        State.nextNoteTime += secondsPerBeat;
        State.currentBeat = (State.currentBeat + 1) % 4;
    }

    function schedule() {
        while (State.nextNoteTime < State.audioContext.currentTime + 0.1) {
            const isFirstBeat = State.currentBeat === 0;
            playSound(State.nextNoteTime, isFirstBeat && State.accentEnabled);

            // On the first beat, update the active tab's display
            if (isFirstBeat) {
                const activeTabId = document.querySelector('.tab-btn.active').dataset.tab;
                if (activeTabId === 'fretboard-tab-content') {
                    updateFretboardDisplay();
                } else if (activeTabId === 'numbers-tab-content') {
                    updateNumbersDisplay();
                }
            }

            updateVisuals(State.currentBeat, State.nextNoteTime);
            nextBeat();
        }
        State.scheduler = window.requestAnimationFrame(schedule);
    }

    function updateVisuals(beat, time) {
        State.visualsTimer = setTimeout(() => {
            DOM.beatDots.forEach((dot, index) => {
                dot.classList.toggle('active', index === beat);
            });
        }, (time - State.audioContext.currentTime) * 1000);
    }

    // =================================================================================
    // UI UPDATES
    // =================================================================================

    function updateFretboardDisplay() {
        let newString;
        do {
            newString = Math.floor(Math.random() * 6) + 1;
        } while (newString === State.previousString);
        State.previousString = newString;

        const availableNotes = CONSTANTS.NOTES[State.noteType];
        let newNote;
        // Prevent infinite loop if only one note is possible
        if (availableNotes.length > 1) {
            do {
                newNote = availableNotes[Math.floor(Math.random() * availableNotes.length)];
            } while (newNote === State.previousNote);
        } else {
            newNote = availableNotes.length ? availableNotes[0] : '--';
        }
        State.previousNote = newNote;

        DOM.stringDisplay.textContent = newString;
        DOM.noteDisplay.textContent = newNote;
    }

    function updateNumbersDisplay() {
        // On each new measure, the "current" number becomes the "previous" one.
        if (State.currentNashvilleNumber !== null) {
            State.previousNashvilleNumber = State.currentNashvilleNumber;
            const scale = getMajorScale(State.currentKey);
            if (scale.length > 0) {
                State.previousNashvilleNote = scale[State.previousNashvilleNumber - 1];
            }
        }

        // Generate a new "current" number for the user to solve.
        let newNashvilleNumber;
        do {
            newNashvilleNumber = Math.floor(Math.random() * 7) + 1;
        } while (newNashvilleNumber === State.currentNashvilleNumber);
        State.currentNashvilleNumber = newNashvilleNumber;

        // Update the top display with the new number.
        DOM.currentNumberDisplay.textContent = State.currentNashvilleNumber;

        // Update the bottom "answer" displays if we have a previous number.
        if (State.previousNashvilleNumber !== null) {
            DOM.answerNumberDisplay.textContent = State.previousNashvilleNumber;

            let displayNote = State.previousNashvilleNote;
            // In a major key, the 2nd, 3rd, and 6th degrees are minor.
            if ([2, 3, 6].includes(State.previousNashvilleNumber)) {
                displayNote += 'm';
            }
            // The 7th degree is diminished.
            else if (State.previousNashvilleNumber === 7) {
                displayNote += '°';
            }

            DOM.answerNoteDisplay.textContent = displayNote;
        }
    }

    // =================================================================================
    // APPLICATION CONTROL
    // =================================================================================

    function start() {
        if (State.isRunning) return;
        State.isRunning = true;

        // Reset displays and state for a clean start
        State.currentNashvilleNumber = null;
        DOM.currentNumberDisplay.textContent = '--';
        DOM.answerNumberDisplay.textContent = '--';
        DOM.answerNoteDisplay.textContent = '--';

        setupAudio();
        State.audioContext.resume(); // Important for autoplay policies

        State.currentBeat = 0; // To start on beat 1 immediately
        State.nextNoteTime = State.audioContext.currentTime;

        schedule();

        DOM.startStopBtn.textContent = 'Stop';
        DOM.startStopBtn.classList.add('running');
    }

    function stop() {
        if (!State.isRunning) return;
        State.isRunning = false;

        window.cancelAnimationFrame(State.scheduler);
        clearTimeout(State.visualsTimer);

        // Clear fretboard displays and the "current" number display.
        // Leave the "answer" displays populated.
        DOM.stringDisplay.textContent = '--';
        DOM.noteDisplay.textContent = '--';
        DOM.currentNumberDisplay.textContent = '--';
        DOM.beatDots.forEach(dot => dot.classList.remove('active'));

        DOM.startStopBtn.textContent = 'Start';
        DOM.startStopBtn.classList.remove('running');
    }

    // =================================================================================
    // INITIALIZATION
    // =================================================================================

    function bindEventListeners() {
        DOM.startStopBtn.addEventListener('click', () => {
            if (State.isRunning) {
                stop();
            } else {
                start();
            }
        });

        DOM.tempoSlider.addEventListener('input', (e) => {
            State.tempo = e.target.value;
            DOM.tempoValue.textContent = State.tempo;
        });

        DOM.noteTypeButtons.forEach(button => {
            button.addEventListener('click', () => {
                DOM.noteTypeButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                State.noteType = button.dataset.type;
            });
        });

        DOM.beatDots[0].addEventListener('click', () => {
            State.accentEnabled = !State.accentEnabled;
            DOM.accentCaret.style.display = State.accentEnabled ? 'block' : 'none';
        });

        DOM.keySelector.addEventListener('change', (e) => {
            State.currentKey = e.target.value;
        });

        DOM.tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Deactivate all tabs and content
                DOM.tabs.forEach(t => t.classList.remove('active'));
                DOM.tabContents.forEach(c => c.classList.remove('active'));

                // Activate the clicked tab and its content
                tab.classList.add('active');
                const contentId = tab.dataset.tab;
                document.getElementById(contentId).classList.add('active');
            });
        });
    }

    function init() {
        bindEventListeners();
    }

    init();
});
