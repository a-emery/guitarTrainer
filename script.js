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

        // By embedding the audio as Base64 data URIs, we avoid CORS issues
        // that can arise when running the app from the local filesystem (file://).
        // You will need to generate these strings from your .wav files.
        const accentWavData = 'data:audio/wav;base64,UklGRnIFAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAATElTVBoAAABJTkZPSVNGVA4AAABMYXZmNjIuMTIuMTAyAGRhdGEsBQAAAAA/IPc9QFeFapt20Xr9dnlrIVk8QW0ljwea6YLNE7XYof+URo/2kNiZP6kVvuzWGfLPDT8otj+4UhdgCGcvZ6Bg31PXQcUrJxOg+dvgcsrRtyOqOaKDoAilaK/hvmDSlOgAABsXZiyEPlNM/FQBWEJVAk3dP74u0RpqBfTv0ttQyom8VLM7r3CwzbbXwcXQkeIK9uUJ1xynLUU72kTUSe9JPEUZPC0vXR+5DW77r+mg2UfMesLOvJS70r5BxlfRT9837wAAjhDQH8sssDblPA4/Fz0uN8MtfiE3E+EDgPQU5ojZqc8QySDG/saNy3bTKN7p6t34FweqFLYgeCpVMeY0+jScMRArziF5FtUJuvwC8IHk8drr09rP+s5M0Z/Wkd6U6PnzAADdC8wWGSAwJ6IrLy3GK4onyiAAGMUNyALD923tcORd3aPYiNYn12vaFuDA5+Pw4/oUBc4OcBduHlkj5yX2JYwj2x45GBoQDAeo/Yv0TOxy5WrggN3f3IneWuIL6DfvYvcAAIAIVRAAFxQcRB9gIF0fVBx+FzIR3gn+ARn6sfJA7C7ny+NJ4rviEuUi6aDuLPVW/KQDnArLEM4VVBkpGzMbeBkcFlsRigsMBVL+yvfi8fnsXulI59TmBejB6tbu+fPT+QAAFwa0C3sQHhRnFjIXeRZNFNYQUgwSB20Bxft39tnxN+7K67bqB+u17J3vjfM++GD9nAKaBwkMoA8mEnYTfRNAEtcPbwxECJ4DzP4e+uL1XvLI70ru9+3S7sfws/Ni95P7AABdBGMIzwtqDg0QnxAaEIwOEAzUCBEFBgH4/Cv53PVC84Xxv/D58C3yQvQU93H6Hv7eAXIFnwgyCwEN8g33DRQNWgvpCOwFmAIj/8n7wPg79mH0T/MU87DzGPUw99P51PwAACEDAgZ2CFQKgAvpC4oLbAqlCFMGoQO8ANT9G/u8+N/2oPUS9Tv1GPaW95z5BPyn/lcB5wMuBgUIUQn+CQIKXwkiCGIGPwTbAWL/+/zO+gD5rPfo9r72Lvcv+K/5k/u7/QAAPgJOBBAGZwc+CIkIRQh4BzEGiASaAoYAcv5+/Mv6dfmR+Cv4Sfjn+Pn5a/sl/Qn/9gDMAm0EvwWtBikHKwe3BtQFkwQLA1UBj//W/Uf8/PoJ+nz5Xfmu+Wb6evvU/F/+AACbARYDWAROBegFHQbtBVoFcAQ/A90BYADj/nz9RfxQ+6z6Y/p5+ur6rvu4/PT9T/+wAAECLAMeBMkEIQUjBdAELQRHAy4C9ACv/3P+Vf1o/Lr7Vfs/+3n7/fvC/Lv91f4AACcBNgIdA80DOwRiBD8E1gMuA1QCVgFFADP/M/5U/aT8L/z7+wr8W/zo/Kb9if6B/34AcAFGAvMCbgOtA64DcgP+AlkCkAGvAMb/5P4X/m398Pyo/Jj8wfwg/a39X/4q/wAA0wCVATsCuQIIAyQDCwO/AkcCqwH1ADEAbf+2/hb+mP1E/R79Kf1k/cj9Uf7z/qX/WgAHAaEBHQJ1AqICowJ4AiUCrwEeAX0A1v80/6L+KP7O/Zr9j/2t/fH9Vv7V/mf/AACXACMBmQHzASwCQAIuAvgBogEyAa8AIwCX/xP/of5H/gr+7/33/SH+af7L/j//v/9BAL0AKwGEAcMB4wHkAcUBiQE1Ac0AWgDi/27/Bf+u/m3+SP5A/lX+hv7P/ir/kv8AAGwA0AAlAWYBjgGdAZABaQErAdsAfgAZALX/Vv8E/8T+mP6F/ov+qf7d/iP/dv/R/w==';
        const normalWavData = 'data:audio/wav;base64,UklGRnIFAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAATElTVBoAAABJTkZPSVNGVA4AAABMYXZmNjIuMTIuMTAyAGRhdGEsBQAAAAD3Glg0A0v7XXFszXW1eQ14/XDpZG5UW0CjKVgRmPiE4C/Kl7aVptWa0pPMkcqUlpzHqMC4usvR4Af3WQ3DIlA2JEeHVOhd6WJgY1ZfClfrSpI7vClBFgcC/O0H2//JpLuSsD+p8aXCppmrMbQawL3OaN9S8akDlhVLJgs1MUE7SslPqFHQT2FKp0EUNjYotxhPCL/3yeci2XDMP8L8uvK2Q7buuMW+fMek0rLfCe7//OMLChrTJq4xJDrcP5xCT0IEP+o4UjCoJW8ZOgyl/k7x0OS42YLQkckvxYXDnsRiyJ3O/9Yf4YHsnfjmBMsQxBtWJRYtsjLvNbA29TTbMJkqgCLzGGYOVwNI+LjtIOTt23fVBdHCzsHO+tBM1X7bQeM37PL1AADrCUITmBuTIuUnVivGLCoskSkgJRAfrRdRD2EGR/1r9DTs/uQb38jaNNh214/Ybdvq38rlxeyH9LP86QTKDPsTLBoYH4wiYySPJBMjBSCPG+oVWg8wCL8AX/lm8iLs2ubI4hbg394r3/PgHeR+6OHtAvSa+lkB8QcWDoMT/BdPG1odCh5cHV0bJxjlE8sOGAkOA/f8F/e08QjtSOmc5iDl4OTb5QHoNutQ7x70ZPnl/l8ElAlIDkcSZBV+F4EYZRgvF/AUxxHaDVsJfwSA/5j6APbr8Yfu+utd6sDpJ+qK69Xt6vCk9NT4Sf3NAS0GNwq8DZYQphLXEx4UexP5EawPsQwuCUwFOwEp/Ub5v/W78lrwt+7i7eLttO5K8JLybfW5+E38AACmAxUHJwq4DK0O8Q95ED8QSw+oDW0LtgijBVkC//69+7f4Efbm80/yXPEW8X7xjPIy9Fv27fjI+8n+zgG0BFoHoQlxC7UMYw1zDecMyAskChAIpgUDA0YAkP3/+rH4wPZA9UL00PPs85T0vvVa91X5l/sD/n8A7AIvBS4H0wgMCswKDQvNChEK4whSB3EFWAMgAeL+ufy9+gb5pPep9h32BfZi9iz3Wvjc+aH7kv2Y/5wBhgNBBbkG3gekCAQJ+QiHCLQHigYZBXEDqAHR/wP+UvzS+pP5ovgK+NH39/d5+FH5c/rS+139AP+qAEYCwgMOBRoG3AZNB2cHKwedBsQFqwRgA/MBdAD1/of9Ovwe+z76pPlW+Vb5o/k5+g/7HPxS/aT+AABYAZsCvAOuBGYF3QUPBvoFoAUGBTQENAMTAt0Aov9v/lL9WPyM+/f6nfqD+qr6Dfuo+3T8Zv1z/o7/qgC7AbQCiwM1BK0E7QTzBL8EVQS7A/cCFAIcARoAGv8p/lD9mfwM/K77hPuP+8z7OvzS/Iz9Yf5F/y8AEwHoAaQCPwOyA/kDEQT5A7QDRQOxAgECOwFqAJf/y/4R/m/97fyQ/F38VPx2/MH8MP2+/WT+G//a/5gATAHvAXkC5QIuA1EDTQMjA9UCaALgAUQBnADv/0X/pf4Y/qP9Sv0S/f38C/07/Yv99f12/gj/ov8+ANYAYgHcAT8ChgKvArkCowJvAh8CuAE+AbgAKwCe/xf/nf40/uL9qf2M/Yz9qf3g/S/+kv4E/4D/AAB+APUAYAG5AfwBKAI7AjMCEgLZAYwBLgHDAFEA3f9s/wT/qP5d/ib+Bf77/Qn+Lv5n/rL+C/9u/9b/PwCjAP8ATgGMAbgB0AHSAb8BmAFfARcBxABoAAoArP9T/wP/v/6M/mn+Wv5e/nT+nf7U/hn/Z/+7/xEAZQC0APkAMgFcAXYBfwF2AV0BNAH+AL0AdAAnAA==';

        try {
            // Load both samples in parallel for efficiency
            [State.audioBuffers.accent, State.audioBuffers.standard] = await Promise.all([
                loadAudioSample(accentWavData),
                loadAudioSample(normalWavData)
            ]);
            console.log('Audio samples loaded and decoded.');
        } catch (e) {
            console.error('Error loading audio samples:', e);
        }
    }

    function playSound(accent) {
        const buffer = accent ? State.audioBuffers.accent : State.audioBuffers.standard;
        if (!buffer || !audioContext) return;
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.start(0);
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
        // Use performance.now() for a reliable, monotonic clock that is not affected
        // by audio context suspension or system time changes.
        const drift = performance.now() - State.nextBeatTime;
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

        // Ensure audio samples are loaded before starting the metronome.
        await initAudio();

        State.isRunning = true;

        // Request a screen wake lock to keep the device awake while the metronome
        // is running. This is a progressive enhancement.
        if ('wakeLock' in navigator) {
            try {
                State.wakeLockSentinel = await navigator.wakeLock.request('screen');
            } catch (err) {
                // This can happen if the document is not visible or for other reasons.
                console.error(`${err.name}: ${err.message}`);
            }
        }

        // Reset displays and state for a clean start
        State.currentNashvilleNumber = null;
        DOM.currentNumberDisplay.textContent = '--';
        DOM.answerNumberDisplay.textContent = '--';
        DOM.answerChordDisplay.textContent = '--';

        State.currentBeat = 0;
        // Use performance.now() for a reliable, monotonic clock.
        State.nextBeatTime = performance.now();
        schedule(); // Start the timer loop

        DOM.startStopBtn.textContent = 'Stop';
        DOM.startStopBtn.classList.add('running');
    }

    function stop() {
        if (!State.isRunning) return;
        State.isRunning = false;

        clearTimeout(State.scheduler);

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

        document.addEventListener('visibilitychange', () => {
            // When the tab is hidden, stop the metronome if it's running.
            // This prevents timer drift and also releases the wake lock.
            if (document.visibilityState === 'hidden' && State.isRunning) {
                stop();
            }
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
