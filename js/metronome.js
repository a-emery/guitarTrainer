import { State, audioContext } from './state.js';
import { SCHEDULE_AHEAD_TIME_SEC } from './config.js';
import { playSound } from './audio.js';
import { updateVisuals, handleFirstBeatUpdates } from './ui.js';

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
export function schedulerLoop() {
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