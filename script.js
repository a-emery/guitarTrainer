document.addEventListener('DOMContentLoaded', () => {
    // =================================================================================
    // CONSTANTS & CONFIG
    // =================================================================================

    const DOM = {
        stringDisplay: document.getElementById('string-display'),
        noteDisplay: document.getElementById('note-display'),
        currentNumberDisplay: document.getElementById('current-number-display'),
        answerNumberDisplay: document.getElementById('answer-number-display'),
        answerChordDisplay: document.getElementById('answer-chord-display'),
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
        openCheatSheetBtn: document.getElementById('open-cheat-sheet-btn'),
        cheatSheetOverlay: document.getElementById('cheat-sheet-overlay'),
        closeOverlayBtn: document.getElementById('close-overlay-btn'),
        cheatSheetKeySelector: document.getElementById('cheat-sheet-key-selector'),
        cheatSheetList: document.getElementById('cheat-sheet-list'),
        accentSound: document.getElementById('accent-sound'),
        standardSound: document.getElementById('standard-sound'),
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

    let audioContext;

    const State = {
        scheduler: null,
        currentBeat: 0,
        tempo: 120,
        isRunning: false,
        nextBeatTime: 0.0, // For self-adjusting timer
        accentEnabled: true,
        noteType: 'naturals',
        previousString: null,
        previousNote: null,
        currentKey: 'C',
        currentNashvilleNumber: null,
        previousNashvilleNumber: null,
        previousNashvilleChord: null,
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

    function populateCheatSheet(key) {
        const scale = getMajorScale(key);
        if (scale.length === 0) {
            DOM.cheatSheetList.innerHTML = '<li>Invalid Key</li>';
            return;
        }

        let listHtml = '';
        for (let i = 0; i < 7; i++) {
            const number = i + 1;
            let chord = scale[i];

            // In a major key, the 2nd, 3rd, and 6th degrees are minor.
            if ([2, 3, 6].includes(number)) {
                chord += 'm';
            }
            // The 7th degree is diminished.
            else if (number === 7) {
                chord += '°';
            }
            listHtml += `<li><span>${number}</span> <span>${chord}</span></li>`;
        }
        DOM.cheatSheetList.innerHTML = listHtml;
    }

    function handleFirstBeatUpdates() {
        const activeTabId = document.querySelector('.tab-btn.active').dataset.tab;
        if (activeTabId === 'fretboard-tab-content') {
            updateFretboardDisplay();
        } else if (activeTabId === 'numbers-tab-content') {
            updateNumbersDisplay();
        }
    }

    // =================================================================================
    // AUDIO
    // =================================================================================

    function playSound(accent) {
        const sound = accent ? DOM.accentSound : DOM.standardSound;
        sound.currentTime = 0;
        sound.play().catch(e => console.error("Error playing sound:", e));
    }

    // =================================================================================
    // METRONOME
    // =================================================================================

    // This function uses a self-adjusting timer to stay accurate.
    // It's more reliable than a simple recursive setTimeout on its own,
    // especially on mobile browsers which can throttle timers.
    function schedule() {
        if (!State.isRunning) return;

        // The core logic of a beat
        const isFirstBeat = State.currentBeat === 0;
        playSound(isFirstBeat && State.accentEnabled);
        updateVisuals(State.currentBeat);

        if (isFirstBeat) {
            handleFirstBeatUpdates();
        }

        // Advance beat counter for the next beat
        State.currentBeat = (State.currentBeat + 1) % 4;

        // The self-adjusting part
        const interval = (60 / State.tempo) * 1000;
        const drift = (audioContext.currentTime * 1000) - State.nextBeatTime;
        State.nextBeatTime += interval;

        // The new timeout is the interval minus the drift.
        State.scheduler = setTimeout(schedule, interval - drift);
    }

    function updateVisuals(beat) {
        DOM.beatDots.forEach((dot, index) => {
            dot.classList.toggle('active', index === beat);
        });
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
                State.previousNashvilleChord = scale[State.previousNashvilleNumber - 1];
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

            let displayChord = State.previousNashvilleChord;
            // In a major key, the 2nd, 3rd, and 6th degrees are minor.
            if ([2, 3, 6].includes(State.previousNashvilleNumber)) {
                displayChord += 'm';
            }
            // The 7th degree is diminished.
            else if (State.previousNashvilleNumber === 7) {
                displayChord += '°';
            }

            DOM.answerChordDisplay.textContent = displayChord;
        }
    }

    function switchTab(tabId) {
        // Deactivate all tabs and content
        DOM.tabs.forEach(t => t.classList.remove('active'));
        DOM.tabContents.forEach(c => c.classList.remove('active'));

        // Activate the new tab and its content
        const tabToActivate = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
        const contentToActivate = document.getElementById(tabId);

        if (tabToActivate && contentToActivate) {
            tabToActivate.classList.add('active');
            contentToActivate.classList.add('active');
        } else {
            // Fallback to the first tab if the saved one is invalid
            DOM.tabs[0].classList.add('active');
            DOM.tabContents[0].classList.add('active');
            console.warn(`Could not find tab with id: ${tabId}. Defaulting to first tab.`);
        }
    }

    // =================================================================================
    // APPLICATION CONTROL
    // =================================================================================

    async function start() {
        if (State.isRunning) return;

        // Create/resume AudioContext on first user gesture. This is crucial for
        // autoplay policies and getting a reliable high-resolution timer.
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        // If the context was suspended by the browser, we need to wait for it to
        // resume before we can get an accurate currentTime.
        if (audioContext.state === 'suspended') {
            await audioContext.resume().catch(e => console.error("AudioContext resume failed:", e));
        }

        State.isRunning = true;

        // Reset displays and state for a clean start
        State.currentNashvilleNumber = null;
        DOM.currentNumberDisplay.textContent = '--';
        DOM.answerNumberDisplay.textContent = '--';
        DOM.answerChordDisplay.textContent = '--';

        State.currentBeat = 0;
        // Set the time for the first beat to be "now". By awaiting resume(), we
        // ensure currentTime is accurate.
        State.nextBeatTime = audioContext.currentTime * 1000;
        schedule(); // Start the timer loop

        DOM.startStopBtn.textContent = 'Stop';
        DOM.startStopBtn.classList.add('running');
    }

    function stop() {
        if (!State.isRunning) return;
        State.isRunning = false;

        clearTimeout(State.scheduler);

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
                start(); // No need to await here, let it run
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
                // Stop the metronome and reset state before switching tabs
                stop();

                // Also reset the answer displays, which stop() preserves for review
                DOM.answerNumberDisplay.textContent = '--';
                DOM.answerChordDisplay.textContent = '--';

                const tabId = tab.dataset.tab;
                switchTab(tabId);

                // Update URL with query parameter without reloading the page
                const url = new URL(window.location);
                url.searchParams.set('tab', tabId);
                history.pushState({}, '', url);
            });
        });

        DOM.openCheatSheetBtn.addEventListener('click', () => {
            // Sync the overlay's key selector with the main one and populate
            DOM.cheatSheetKeySelector.value = State.currentKey;
            populateCheatSheet(State.currentKey);
            DOM.cheatSheetOverlay.classList.remove('hidden');
        });

        DOM.closeOverlayBtn.addEventListener('click', () => {
            DOM.cheatSheetOverlay.classList.add('hidden');
        });

        // Also close overlay if clicking on the background
        DOM.cheatSheetOverlay.addEventListener('click', (e) => {
            if (e.target === DOM.cheatSheetOverlay) {
                DOM.cheatSheetOverlay.classList.add('hidden');
            }
        });

        DOM.cheatSheetKeySelector.addEventListener('change', (e) => {
            populateCheatSheet(e.target.value);
        });
    }

    function init() {
        bindEventListeners();

        // Check for tab in URL on page load and switch to it
        const urlParams = new URLSearchParams(window.location.search);
        const tabId = urlParams.get('tab');
        if (tabId) {
            switchTab(tabId);
        }
    }

    init();
});
