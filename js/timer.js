import { DOM } from './config.js';
import { State } from './state.js';
import { updateTimerDisplay, showTimerCompletePopup } from './ui.js';

let startMetronome;
let stopMetronome;
let saveSettings;

export function initializeTimer(controls) {
    startMetronome = controls.startMetronome;
    stopMetronome = controls.stopMetronome;
    saveSettings = controls.saveSettings;
}

export function startTimer() {
    if (State.isTimerRunning) return;

    State.isTimerRunning = true;
    State.timerEndsMetronome = true; // Timer is now controlling the metronome

    // Ensure timer duration is valid
    State.timerDuration = parseInt(DOM.timerInput.value, 10);
    if (isNaN(State.timerDuration) || State.timerDuration <= 0) {
        State.timerDuration = 1; // Default to 1 minute if invalid
        DOM.timerInput.value = 1;
    }

    State.timeRemaining = State.timerDuration * 60;
    updateTimerDisplay(State.timeRemaining);

    // Start the metronome
    startMetronome();

    DOM.timerInput.disabled = true;
    DOM.startTimerBtn.disabled = true;
    DOM.stopTimerBtn.disabled = false;
    DOM.resetTimerBtn.disabled = false;

    State.timerInterval = setInterval(() => {
        State.timeRemaining--;
        updateTimerDisplay(State.timeRemaining);

        if (State.timeRemaining <= 0) {
            stopTimer(true); // Timer finished, stop metronome
            showTimerCompletePopup();
        }
    }, 1000);
    saveSettings();
}

export function stopTimer(timerFinished = false) {
    if (!State.isTimerRunning && !timerFinished) return; // Only return if not running and not a completion event

    clearInterval(State.timerInterval);
    State.isTimerRunning = false;

    DOM.timerInput.disabled = false;
    DOM.startTimerBtn.disabled = false;
    DOM.stopTimerBtn.disabled = true;
    DOM.resetTimerBtn.disabled = false;

    if (State.timerEndsMetronome) {
        stopMetronome(); // Stop the metronome if the timer started it
    }
    State.timerEndsMetronome = false; // Reset this flag
    saveSettings();
}

export function resetTimer() {
    stopTimer(false); // Stop timer if running
    const newDuration = parseInt(DOM.timerInput.value, 10) || 1;
    State.timerDuration = newDuration;
    State.timeRemaining = newDuration * 60;
    updateTimerDisplay(State.timeRemaining);
    DOM.resetTimerBtn.disabled = true; // Disable reset until timer starts again
    saveSettings();
}

export function handleTimerInputChange() {
    const newDuration = parseInt(DOM.timerInput.value, 10) || 1;
    State.timerDuration = newDuration;
    State.timeRemaining = newDuration * 60;
    updateTimerDisplay(State.timeRemaining);
    saveSettings();
}