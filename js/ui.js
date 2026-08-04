import { DOM, CONSTANTS } from './config.js';
import { State } from './state.js';
import { getMajorScale, getMajorScaleChord } from './music-theory.js';

/**
 * Calculates the lowest fret number for a given note on a given string.
 * String 1 is high E, String 6 is low E.
 * @param {number} stringNumber The guitar string (1-6).
 * @param {string} note The name of the note (e.g., 'C#', 'Bb').
 * @returns {number|string} The fret number, or '--' if not found.
 */
function getFretForNote(stringNumber, note) {
    // Standard tuning: 1=E, 2=B, 3=G, 4=D, 5=A, 6=E
    const openStringNotes = { 1: 'E', 2: 'B', 3: 'G', 4: 'D', 5: 'A', 6: 'E' };
    const chromaticScale = {
        'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5,
        'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
    };

    const openNote = openStringNotes[stringNumber];
    if (!openNote || chromaticScale[note] === undefined) {
        return '--';
    }

    const noteValue = chromaticScale[note];
    const openNoteValue = chromaticScale[openNote];

    let fret = noteValue - openNoteValue;
    if (fret < 0) {
        fret += 12;
    }
    return fret;
}

export function updateFretboardDisplay() {
    // The "answer" is whatever was in the state from the previous beat.
    if (State.previousNote !== null && State.previousString !== null) {
        // getFretForNote uses standard numbering (1=high E) which is what we store in state
        const fret = getFretForNote(State.previousString, State.previousNote);
        DOM.answerFretDisplay.textContent = fret;
    }

    // Now, generate a new question.
    // The internal logic still uses standard numbering (1=high E, 6=low E).
    let minString = 1; // High E (standard guitar numbering)
    let maxString = 6; // Low E (standard guitar numbering)

    if (State.instType === 'bass') {
        // Bass typically has 4 strings. If we map to guitar strings:
        // Bass E (lowest) -> Guitar String 6
        // Bass A          -> Guitar String 5
        // Bass D          -> Guitar String 4
        // Bass G (highest) -> Guitar String 3
        minString = 3; // Corresponds to G string on guitar
        maxString = 6; // Corresponds to low E string on guitar
    }

    let actualNewString;
    do {
        actualNewString = Math.floor(Math.random() * (maxString - minString + 1)) + minString;
    } while (actualNewString === State.previousString);

    const availableNotes = CONSTANTS.NOTES[DOM.noteTypeSelector.value];
    let newNote;
    if (availableNotes.length > 1) {
        do {
            newNote = availableNotes[Math.floor(Math.random() * availableNotes.length)];
        } while (newNote === State.previousNote);
    } else {
        newNote = availableNotes.length ? availableNotes[0] : '--';
    }
    // Update the main display with the new question.
    // Display the flipped string number (1=low E, 6=high E)
    DOM.stringDisplay.textContent = 7 - actualNewString;
    // Finally, save the new question to the state for the next cycle.
    // We store the *actual* string number, not the displayed one.
    State.previousString = actualNewString;
    State.previousNote = newNote;
}

export function updateNumbersDisplay() {
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
    if (State.isEasyModeEnabled) {
        const easyNumbers = [1, 4, 5, 6];
        do {
            newNashvilleNumber = easyNumbers[Math.floor(Math.random() * easyNumbers.length)];
        } while (newNashvilleNumber === State.currentNashvilleNumber);
    } else {
        do {
            newNashvilleNumber = Math.floor(Math.random() * 7) + 1;
        } while (newNashvilleNumber === State.currentNashvilleNumber);
    }
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

export function switchTab(tabId) {
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

export function populateCheatSheet(key) {
    const scale = getMajorScale(key);
    if (scale.length === 0) {
        DOM.cheatSheetList.innerHTML = '<li>Invalid Key</li>';
        return;
    }

    let listHtml = '';
    for (let i = 0; i < 7; i++) {
        const number = i + 1;
        const chord = getMajorScaleChord(scale[i], number);
        listHtml += `<li><span>${number}</span> <span>${chord}</span></li>`;
    }
    DOM.cheatSheetList.innerHTML = listHtml;
}

export function updateVisuals(beat) {
    DOM.beatDots.forEach((dot, index) => {
        dot.classList.toggle('active', index === beat);
    });
}

export function handleFirstBeatUpdates() {
    const activeTabId = document.querySelector('.tab-btn.active').dataset.tab;
    if (activeTabId === 'fretboard-tab-content') {
        updateFretboardDisplay();
    } else if (activeTabId === 'numbers-tab-content') {
        updateNumbersDisplay();
    }
}

export function updateTimerDisplay(timeInSeconds) {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = timeInSeconds % 60;
    DOM.timerDisplay.textContent =
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function showTimerCompletePopup() {
    DOM.timerCompleteOverlay.classList.remove('hidden');
}

export function hideTimerCompletePopup() {
    DOM.timerCompleteOverlay.classList.add('hidden');
}