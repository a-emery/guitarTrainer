import { State, audioContext } from './state.js';

async function loadAudioSample(url) {
    if (!audioContext) return null;
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return await audioContext.decodeAudioData(arrayBuffer);
}

export async function initAudio() {
    if (State.audioBuffers.accent && State.audioBuffers.standard) {
        return; // Already loaded
    }

    // Load both samples in parallel for efficiency.
    // Let this throw on failure; the error will be caught by the `startMetronome`
    // function, which will prevent the metronome from entering a broken state.
    [State.audioBuffers.accent, State.audioBuffers.standard] = await Promise.all([
        loadAudioSample('accent.wav'),
        loadAudioSample('normal.wav')
    ]);
    console.log('Audio samples loaded and decoded.');
}

export function playSound(accent, time) {
    const buffer = accent ? State.audioBuffers.accent : State.audioBuffers.standard;
    if (!buffer || !audioContext) return;
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start(time);
}