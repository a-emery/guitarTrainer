import { DOM } from './config.js';
import { State } from './state.js';
import { updateTimerDisplay, showTimerCompletePopup } from './ui.js';

let stopMetronome;

export function initializeTimer(controls) {
    stopMetronome = controls.stopMetronome;
}

export function activateTimer() {
    State.isTimerRunning = true;

    // Ensure timer duration is valid
    const minutes = parseInt(DOM.timerMinutesInput.value, 10) || 0;
    const seconds = parseInt(DOM.timerSecondsInput.value, 10) || 0;
    State.timerDuration = (minutes * 60) + seconds;

    if (State.timerDuration <= 0) {
        State.timerDuration = 300; // Default to 5 minutes if invalid
        DOM.timerMinutesInput.value = 5;
        DOM.timerSecondsInput.value = 0;
    }

    State.timeRemaining = State.timerDuration;
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
            // Disable the timer switch after it completes for a "one-shot" feel.
            handleTimerEnableChange(false);
            DOM.timerEnableSwitch.checked = false;
        }
    }, 1000);
}

export function deactivateTimer() {
    if (!State.isTimerRunning) return;
    clearInterval(State.timerInterval);
    State.isTimerRunning = false;
}

export function resetTimer() {
    // This can be called when the metronome is stopped.
    // It just resets the timer value.
    if (State.isRunning) return; // Don't reset while running

    const minutes = parseInt(DOM.timerMinutesInput.value, 10) || 0;
    const seconds = parseInt(DOM.timerSecondsInput.value, 10) || 0;
    const newDuration = (minutes * 60) + seconds;

    State.timerDuration = newDuration > 0 ? newDuration : 300;
    if (newDuration <= 0) {
        DOM.timerMinutesInput.value = 5;
        DOM.timerSecondsInput.value = 0;
    }
    State.timeRemaining = State.timerDuration;
    updateTimerDisplay(State.timeRemaining);
    DOM.resetTimerBtn.disabled = true;
}

export function handleTimerInputChange() {
    if (State.isTimerRunning) return; // Don't allow change while timer is active
    const minutes = parseInt(DOM.timerMinutesInput.value, 10) || 0;
    const seconds = parseInt(DOM.timerSecondsInput.value, 10) || 0;
    State.timerDuration = (minutes * 60) + seconds;
    State.timeRemaining = State.timerDuration;
    updateTimerDisplay(State.timeRemaining);
}

export function handleTimerEnableChange(isEnabled) {
    State.isTimerEnabled = isEnabled;
    DOM.timerCompactDisplay.classList.toggle('hidden', !isEnabled);
    if (isEnabled) {
        updateTimerDisplay(State.timeRemaining);
    } else {
        // When disabling, reset the countdown value to match the inputs.
        const minutes = parseInt(DOM.timerMinutesInput.value, 10) || 0;
        const seconds = parseInt(DOM.timerSecondsInput.value, 10) || 0;
        State.timerDuration = (minutes * 60) + seconds;
        State.timeRemaining = State.timerDuration;
        updateTimerDisplay(State.timeRemaining);
    }
}