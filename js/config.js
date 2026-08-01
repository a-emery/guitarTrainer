export const DOM = {
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
    tempoValue: document.getElementById('tempo-value'), // In bpm-display
    noteTypeButtons: document.querySelectorAll('.note-type-btn'),
    startStopBtn: document.getElementById('start-stop-btn'),
    tabs: document.querySelectorAll('.tab-btn'),
    tabContents: document.querySelectorAll('.tab-content'),
    keySelector: document.getElementById('key-selector'),
    globalControls: document.getElementById('global-controls'),
    easyModeSwitch: document.getElementById('easy-mode-switch'),
    expandControlsBtn: document.getElementById('expand-controls-btn'),
    openCheatSheetBtn: document.getElementById('open-cheat-sheet-btn'),
    cheatSheetOverlay: document.getElementById('cheat-sheet-overlay'),
    closeOverlayBtn: document.getElementById('close-overlay-btn'),
    timerEnableSwitch: document.getElementById('timer-enable-switch'),
    timerMinutesInput: document.getElementById('timer-minutes-input'),
    timerSecondsInput: document.getElementById('timer-seconds-input'),
    timerDisplay: document.getElementById('timer-display'), // In compact-display
    timerCompactDisplay: document.getElementById('timer-compact-display'),
    resetTimerBtn: document.getElementById('reset-timer-btn'),
    cheatSheetKeySelector: document.getElementById('cheat-sheet-key-selector'),
    cheatSheetList: document.getElementById('cheat-sheet-list'),
    timerCompleteOverlay: document.getElementById('timer-complete-overlay'),
    closeTimerCompleteBtn: document.getElementById('close-timer-complete-btn'),
    okTimerCompleteBtn: document.getElementById('ok-timer-complete-btn'),
};

export const CONSTANTS = {
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
export const SCHEDULER_LOOKAHEAD_MS = 25.0; // How often we check for upcoming notes
export const SCHEDULE_AHEAD_TIME_SEC = 0.1; // How far ahead to schedule audio