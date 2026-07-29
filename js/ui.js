import { DOM, CONSTANTS } from './config.js';
import { State } from './state.js';
import { getMajorScale, getMajorScaleChord } from './music-theory.js';

export function updateFretboardDisplay() {
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