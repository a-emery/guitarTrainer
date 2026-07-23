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
        cheatSheetList: document.getElementById('cheat-sheet-list')
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
    const SCHEDULER_LOOKAHEAD_MS = 25.0; // How often we check for upcoming notes
    const SCHEDULE_AHEAD_TIME_SEC = 0.1; // How far ahead to schedule audio

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
        wakeLockSentinel: null,
        audioBuffers: {
            accent: null,
            standard: null
        },
        silentAudioEl: null,
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

    function getMajorScaleChord(note, degree) {
        // In a major key, the 2nd, 3rd, and 6th degrees are minor.
        if ([2, 3, 6].includes(degree)) {
            return note + 'm';
        }
        // The 7th degree is diminished.
        if (degree === 7) {
            return note + '°';
        }
        return note; // Major chord (or just the root note)
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
            const chord = getMajorScaleChord(scale[i], number);
            listHtml += `<li><span>${number}</span> <span>${getMajorScaleChord(scale[i], number)}</span></li>`;
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

    async function loadAudioSample(url) {
        if (!audioContext) return null;
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        return await audioContext.decodeAudioData(arrayBuffer);
    }

    async function initAudio() {
        if (State.audioBuffers.accent && State.audioBuffers.standard) {
            return; // Already loaded
        }

        try {
            // Load both samples in parallel for efficiency
            [State.audioBuffers.accent, State.audioBuffers.standard] = await Promise.all([
                loadAudioSample('accent.wav'),
                loadAudioSample('normal.wav')
            ]);
            console.log('Audio samples loaded and decoded.');
        } catch (e) {
            console.error('Error loading audio samples:', e);
        }
    }

    function playSound(accent, time) {
        const buffer = accent ? State.audioBuffers.accent : State.audioBuffers.standard;
        if (!buffer || !audioContext) return;
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.start(time);
    }

    // =================================================================================
    // METRONOME
    // =================================================================================

    /**
     * Schedules the visual updates (beat dots, display changes) to sync with the
     * precise timing of the Web Audio API.
     */
    function scheduleVisualUpdate(beat, time) {
        const visualDelay = (time - audioContext.currentTime) * 1000;
        setTimeout(() => {
            // Don't run if the metronome was stopped since this was scheduled
            if (!State.isRunning) return;
            updateVisuals(beat);
            if (beat === 0) {
                handleFirstBeatUpdates();
            }
        }, visualDelay);
    }

    /**
     * The core scheduler loop. It runs on a frequent interval and schedules
     * audio and visual events in advance, relying on the highly accurate
     * AudioContext clock.
     */
    function schedulerLoop() {
        const interval = 60.0 / State.tempo;
        // Check for notes that need to be scheduled in the immediate future
        while (State.nextBeatTime < audioContext.currentTime + SCHEDULE_AHEAD_TIME_SEC) {
            const isFirstBeat = State.currentBeat === 0;
            // Schedule the audio to play at a precise time
            playSound(isFirstBeat && State.accentEnabled, State.nextBeatTime);
            // Schedule the corresponding visual update
            scheduleVisualUpdate(State.currentBeat, State.nextBeatTime);

            // Advance the clock and beat counter for the next iteration
            State.nextBeatTime += interval;
            State.currentBeat = (State.currentBeat + 1) % 4;
        }
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

            const displayChord = getMajorScaleChord(State.previousNashvilleChord, State.previousNashvilleNumber);
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

        // =========================================================================
        // == AUDIO UNLOCK & CONTEXT SETUP (CRITICAL FOR IOS)
        // =========================================================================
        // The following actions MUST happen synchronously within the user's click
        // event handler, BEFORE the first `await` call. This is the only way
        // to reliably get permission to play audio and bypass the mute switch.

        // 1. Create AudioContext if it doesn't exist.
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log('New AudioContext created.');
        }

        // 2. Play a silent sound via Web Audio to unlock the context.
        const buffer = audioContext.createBuffer(1, 1, 22050);
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.start(0);

        // 3. Play a silent sound via an <audio> element to elevate the audio session
        //    and bypass the hardware mute switch.
        if (!State.silentAudioEl) {
            State.silentAudioEl = document.createElement('audio');
            State.silentAudioEl.setAttribute('x-webkit-airplay', 'deny');
            State.silentAudioEl.setAttribute('playsinline', '');
            State.silentAudioEl.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
            State.silentAudioEl.style.display = 'none';
            document.body.appendChild(State.silentAudioEl);
        }
        // This play() call is the crucial part for the mute switch.
        State.silentAudioEl.play().catch(() => { /* Ignore errors */ });

        // =========================================================================
        // == ASYNCHRONOUS SETUP
        // =========================================================================
        // Now that the synchronous unlock is done, we can proceed with async tasks.

        // Resume the context if it was suspended (e.g., from tab backgrounding).
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }

        // Load the actual metronome sounds.
        await initAudio();

        // Request a screen wake lock to keep the device awake.
        if ('wakeLock' in navigator) {
            try {
                State.wakeLockSentinel = await navigator.wakeLock.request('screen');
                console.log('Screen Wake Lock is active.');
            } catch (err) {
                console.error(`Wake Lock request failed: ${err.name}, ${err.message}`);
            }
        }

        // =========================================================================
        // == START THE METRONOME
        // =========================================================================
        State.isRunning = true;

        // Reset displays and state for a clean start
        State.currentNashvilleNumber = null;
        DOM.currentNumberDisplay.textContent = '--';
        DOM.answerNumberDisplay.textContent = '--';
        DOM.answerChordDisplay.textContent = '--';

        State.currentBeat = 0;
        State.nextBeatTime = audioContext.currentTime;
        State.scheduler = setInterval(schedulerLoop, SCHEDULER_LOOKAHEAD_MS);

        DOM.startStopBtn.textContent = 'Stop';
        DOM.startStopBtn.classList.add('running');
    }

    function stop() {
        if (!State.isRunning) return;
        State.isRunning = false;

        clearInterval(State.scheduler);

        // Release the screen wake lock if it was acquired.
        if (State.wakeLockSentinel) {
            State.wakeLockSentinel.release().catch(() => {}); // Errors can be safely ignored.
            State.wakeLockSentinel = null;
        }

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

    function saveSettings() {
        const settings = {
            tempo: State.tempo,
            noteType: State.noteType,
            accentEnabled: State.accentEnabled,
            currentKey: State.currentKey
        };
        localStorage.setItem('guitarTrainerSettings', JSON.stringify(settings));
    }

    function loadSettings() {
        const savedSettings = localStorage.getItem('guitarTrainerSettings');
        if (!savedSettings) return;

        const settings = JSON.parse(savedSettings);

        // Tempo (default to 120)
        State.tempo = settings.tempo || 120;
        DOM.tempoSlider.value = State.tempo;
        DOM.tempoValue.textContent = State.tempo;

        // Note Type (default to naturals)
        State.noteType = settings.noteType || 'naturals';
        DOM.noteTypeButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === State.noteType);
        });

        // Accent (default to true)
        State.accentEnabled = settings.accentEnabled !== false;
        DOM.accentCaret.style.display = State.accentEnabled ? 'block' : 'none';

        // Key (default to C)
        State.currentKey = settings.currentKey || 'C';
        DOM.keySelector.value = State.currentKey;
    }

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
            saveSettings();
        });

        DOM.noteTypeButtons.forEach(button => {
            button.addEventListener('click', () => {
                DOM.noteTypeButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                State.noteType = button.dataset.type;
                saveSettings();
            });
        });

        DOM.beatDots[0].addEventListener('click', () => {
            State.accentEnabled = !State.accentEnabled;
            DOM.accentCaret.style.display = State.accentEnabled ? 'block' : 'none';
            saveSettings();
        });

        DOM.keySelector.addEventListener('change', (e) => {
            State.currentKey = e.target.value;
            saveSettings();
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

        document.addEventListener('visibilitychange', () => {
            // When the tab is hidden, stop the metronome if it's running.
            // This prevents timer drift and also releases the wake lock.
            if (document.visibilityState === 'hidden' && State.isRunning) {
                stop();
            }
        });
    }

    function init() {
        loadSettings();
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
