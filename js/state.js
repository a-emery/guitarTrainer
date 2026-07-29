export let audioContext;

export function setAudioContext(context) {
    audioContext = context;
}

export const State = {
    scheduler: null,
    currentBeat: 0,
    tempo: 120,
    isRunning: false,
    isTimerEnabled: false,
    isTimerRunning: false,
    timerDuration: 5, // Default to 5 minutes
    timeRemaining: 0,
    timerInterval: null,
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