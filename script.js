import { DOM, SCHEDULER_LOOKAHEAD_MS } from './js/config.js';
import { State, audioContext, setAudioContext } from './js/state.js';
import { initAudio } from './js/audio.js';
import { schedulerLoop } from './js/metronome.js';
import { initializeTimer, activateTimer, deactivateTimer, resetTimer, handleTimerInputChange, handleTimerEnableChange } from './js/timer.js';
import { switchTab, populateCheatSheet, updateTimerDisplay, hideTimerCompletePopup } from './js/ui.js';

document.addEventListener('DOMContentLoaded', () => {
    // =================================================================================
    // APPLICATION CONTROL
    // =================================================================================

    async function startMetronome() {
        if (State.isRunning) return; // Metronome is already running

        // Close advanced settings panel if it's open
        DOM.globalControls.classList.remove('expanded');

        // =========================================================================
        // == AUDIO UNLOCK & CONTEXT SETUP (CRITICAL FOR IOS)
        // =========================================================================
        // The following actions MUST happen synchronously within the user's click
        // event handler, BEFORE the first `await` call. This is the only way
        // to reliably get permission to play audio and bypass the mute switch.

        // 1. Create AudioContext if it doesn't exist.
        // As a progressive enhancement, first try the modern Audio Session API.
        // This is the ideal, declarative way to handle this, but it's not supported on iOS Safari yet.
        // On supporting browsers, this may be all that's needed.
        if ('audioSession' in navigator) {
            navigator.audioSession.type = 'playback';
        }

        // If the context exists but is suspended (from tab backgrounding), it's most
        // reliable to discard it and create a new one.
        if (audioContext && audioContext.state === 'suspended') {
            console.log('Found suspended AudioContext. Discarding and creating a new one for reliability.');
            // DO NOT `await` here. Awaiting breaks the synchronous chain of trust needed for the user gesture.
            // We can fire-and-forget the close() call and proceed to create a new context immediately.
            audioContext.close();
            setAudioContext(null);
            // The audio buffers are now invalid, as they belonged to the old context. Re-initialize them.
            State.audioBuffers.accent = null;
            State.audioBuffers.standard = null;
        }

        if (!audioContext) {
            setAudioContext(new (window.AudioContext || window.webkitAudioContext)());
            console.log('New AudioContext created.');
        }

        // 2. Initiate resume. This is safe even if the context is already running.
        // We await this promise later, after the synchronous unlocks are done.
        const resumePromise = audioContext.resume();

        // 3. Play a silent sound via Web Audio API. This helps unlock the context itself.
        const buffer = audioContext.createBuffer(1, 1, 22050);
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.start(0);

        // 4. Play a silent sound via an HTML <audio> element. This is the most
        //    reliable method to bypass the iOS hardware mute switch.
        if (!State.silentAudioEl) {
            State.silentAudioEl = document.createElement('audio');
            State.silentAudioEl.setAttribute('x-webkit-airplay', 'deny');
            State.silentAudioEl.setAttribute('playsinline', '');
            State.silentAudioEl.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
            State.silentAudioEl.style.display = 'none';
            document.body.appendChild(State.silentAudioEl);
        }
        State.silentAudioEl.play().catch(() => { /* Ignore errors */ });

        // =========================================================================
        // == ASYNCHRONOUS SETUP
        // =========================================================================
        try {
            // Now that all synchronous unlocks are done, we can safely await the promises.
            await resumePromise;

            // Load the actual metronome sounds.
            await initAudio();

            // Request a screen wake lock to keep the device awake.
            if ('wakeLock' in navigator) {
                State.wakeLockSentinel = await navigator.wakeLock.request('screen');
                console.log('Screen Wake Lock is active.');
            }
        } catch (err) {
            console.error('Failed during async setup, stopping metronome.', err);
            // If any of the async setup fails (e.g., audio files don't load),
            // we should not proceed. Call stop() to reset the UI to a clean state.
            stopMetronome();
            return; // Exit the start function.
        }


        // =========================================================================
        // == START THE METRONOME
        // =========================================================================
        State.isRunning = true;

        // Reset displays and state for a clean start
        State.currentNashvilleNumber = null;
        DOM.currentNumberDisplay.textContent = '--';
        DOM.answerFretDisplay.textContent = '--';
        DOM.answerNumberDisplay.textContent = '--';
        DOM.answerChordDisplay.textContent = '--';

        State.currentBeat = 0;
        State.nextBeatTime = audioContext.currentTime;
        State.scheduler = setInterval(schedulerLoop, SCHEDULER_LOOKAHEAD_MS);

        DOM.startStopBtn.textContent = 'Stop';
        DOM.startStopBtn.classList.add('running');
    }

    function stopMetronome() {
        if (!State.isRunning) return;
        State.isRunning = false;

        deactivateTimer(); // This will only run if timer was running

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

    function bindEventListeners() {
        initializeTimer({ stopMetronome });

        DOM.startStopBtn.addEventListener('click', () => {
            if (State.isRunning) {
                stopMetronome();
            } else {
                startMetronome(); // No need to await here, let it run
            }
        });

        DOM.tempoSlider.addEventListener('input', (e) => {
            State.tempo = e.target.value;
            DOM.tempoValue.textContent = State.tempo;
        });

        DOM.noteTypeSelector.addEventListener('change', (e) => {
            State.noteType = e.target.value;
            // If metronome is running and fretboard tab is active, update display immediately
            if (State.isRunning && document.querySelector('.tab-btn.active').dataset.tab === 'fretboard-tab-content') {
                updateFretboardDisplay();
            }
        });

        DOM.instTypeSelector.addEventListener('change', (e) => {
            State.instType = e.target.value;
            // If metronome is running and fretboard tab is active, update display immediately
            if (State.isRunning && document.querySelector('.tab-btn.active').dataset.tab === 'fretboard-tab-content') {
                updateFretboardDisplay();
            }
        });

        DOM.beatDots[0].addEventListener('click', () => {
            State.accentEnabled = !State.accentEnabled;
            DOM.accentCaret.style.display = State.accentEnabled ? 'block' : 'none';
        });

        DOM.keySelector.addEventListener('change', (e) => {
            State.currentKey = e.target.value;
        });

        DOM.easyModeSwitch.addEventListener('change', (e) => {
            State.isEasyModeEnabled = e.target.checked;
        });

        DOM.tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Stop the metronome and reset state before switching tabs
                if (State.isRunning) {
                    stopMetronome();
                }

                // Also reset the answer displays, which stop() preserves for review
                DOM.answerFretDisplay.textContent = '--';
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

        // Timer Event Listeners
        DOM.timerEnableSwitch.addEventListener('change', (e) => {
            handleTimerEnableChange(e.target.checked);
        });
        DOM.resetTimerBtn.addEventListener('click', resetTimer);

        const handleInputFocus = (e) => {
            e.target.select();

            // If the timer is not already enabled, enable it.
            if (!State.isTimerEnabled) {
                DOM.timerEnableSwitch.checked = true;
                handleTimerEnableChange(true);
            }

            // Delay scrolling to allow the keyboard to animate into view.
            // Without this, the scroll might happen before the viewport has resized.
            setTimeout(() => {
                e.target.scrollIntoView({
                    block: 'center',
                });
            }, 100);
        };

        DOM.timerMinutesInput.addEventListener('change', handleTimerInputChange);
        DOM.timerMinutesInput.addEventListener('focus', handleInputFocus);
        DOM.timerSecondsInput.addEventListener('change', handleTimerInputChange);
        DOM.timerSecondsInput.addEventListener('focus', handleInputFocus);
        DOM.closeTimerCompleteBtn.addEventListener('click', hideTimerCompletePopup);
        DOM.okTimerCompleteBtn.addEventListener('click', hideTimerCompletePopup);

        DOM.expandControlsBtn.addEventListener('click', () => {
            DOM.globalControls.classList.toggle('expanded');
        });

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden' && State.isRunning) {
                // When the tab is hidden, stop the metronome if it's running.
                // This prevents timer drift and also releases the wake lock.
                stopMetronome();
            } else if (document.visibilityState === 'visible') {
                // Refresh the page when returning to the tab to ensure a clean state.
                window.location.reload();
            }
        });
    }

    function init() {
        bindEventListeners();

        // Initialize UI elements to match default state, since settings are not persisted.
        DOM.accentCaret.style.display = State.accentEnabled ? 'block' : 'none';
        DOM.easyModeSwitch.checked = State.isEasyModeEnabled;
        DOM.noteTypeSelector.value = State.noteType; // 'naturals' by default in State
        DOM.instTypeSelector.value = State.instType; // 'guitar' by default in State

        // Check for tab in URL on page load and switch to it
        const urlParams = new URLSearchParams(window.location.search);
        const tabId = urlParams.get('tab') || 'fretboard-tab-content';
        switchTab(tabId);

        // Initialize timer state and display, ensuring it's in sync with the inputs.
        const minutes = parseInt(DOM.timerMinutesInput.value, 10) || 0;
        const seconds = parseInt(DOM.timerSecondsInput.value, 10) || 0;
        const initialDuration = (minutes * 60) + seconds;

        State.isTimerEnabled = false;
        State.timerDuration = initialDuration > 0 ? initialDuration : 300;
        State.timeRemaining = State.timerDuration;

        if (initialDuration <= 0) {
            DOM.timerMinutesInput.value = 5;
            DOM.timerSecondsInput.value = 0;
        }

        DOM.timerEnableSwitch.checked = false;
        DOM.timerCompactDisplay.classList.add('hidden');
        updateTimerDisplay(State.timeRemaining);

        // Initial timer button state
        DOM.resetTimerBtn.disabled = true;
    }

    init();
});
