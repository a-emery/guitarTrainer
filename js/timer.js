import { DOM } from './config.js';
import { State } from './state.js';
import { updateTimerDisplay, showTimerCompletePopup } from './ui.js';

let stopMetronome;
let saveSettings;

export function initializeTimer(controls) {
    stopMetronome = controls.stopMetronome;
    saveSettings = controls.saveSettings;
}

export function activateTimer() {
    State.isTimerRunning = true;
    DOM.timerCompactDisplay.classList.remove('hidden');

    // Ensure timer duration is valid
    State.timerDuration = parseInt(DOM.timerInput.value, 10);
    if (isNaN(State.timerDuration) || State.timerDuration <= 0) {
        State.timerDuration = 1; // Default to 1 minute if invalid
        DOM.timerInput.value = 1;
    }

    State.timeRemaining = State.timerDuration * 60;
    updateTimerDisplay(State.timeRemaining);
    DOM.resetTimerBtn.disabled = false;

    State.timerInterval = setInterval(() => {
        State.timeRemaining--;
        updateTimerDisplay(State.timeRemaining);

        if (State.timeRemaining <= 0) {
            // Timer finished on its own
            clearInterval(State.timerInterval);
            State.isTimerRunning = false;
            stopMetronome(); // This will also call deactivateTimer
            showTimerCompletePopup();
        }
    }, 1000);
}

export function deactivateTimer() {
    if (!State.isTimerRunning) return;
    clearInterval(State.timerInterval);
    State.isTimerRunning = false;
    DOM.timerCompactDisplay.classList.add('hidden');
}

export function resetTimer() {
    // This can be called when the metronome is stopped.
    // It just resets the timer value.
    if (State.isRunning) return; // Don't reset while running

    const newDuration = parseInt(DOM.timerInput.value, 10) || 1;
    State.timerDuration = newDuration;
    State.timeRemaining = newDuration * 60;
    updateTimerDisplay(State.timeRemaining);
    DOM.resetTimerBtn.disabled = true;
    saveSettings();
}

export function handleTimerInputChange() {
    if (State.isTimerRunning) return; // Don't allow change while timer is active
    const newDuration = parseInt(DOM.timerInput.value, 10) || 1;
    State.timerDuration = newDuration;
    State.timeRemaining = newDuration * 60;
    updateTimerDisplay(State.timeRemaining);
    saveSettings();
}

export function handleTimerEnableChange(isEnabled) {
    State.isTimerEnabled = isEnabled;
    DOM.timerCompactDisplay.classList.toggle('hidden', !isEnabled || !State.isRunning);
    if (isEnabled) {
        updateTimerDisplay(State.timeRemaining);
    }
    saveSettings();
}