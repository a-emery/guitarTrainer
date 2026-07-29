import { CONSTANTS } from './config.js';

export function getMajorScale(rootNote) {
    const scale = [];
    const flatKeys = ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb'];
    const useFlatScale = flatKeys.includes(rootNote);
    const chromaticScale = useFlatScale
        ? CONSTANTS.FLAT_CHROMATIC_SCALE
        : CONSTANTS.SHARP_CHROMATIC_SCALE;

    const startIndex = chromaticScale.indexOf(rootNote);

    if (startIndex === -1) {
        console.error(`Root note ${rootNote} not found in chosen chromatic scale.`);
        return [];
    };

    for (const interval of CONSTANTS.MAJOR_SCALE_INTERVALS) {
        const noteIndex = (startIndex + interval) % 12;
        scale.push(chromaticScale[noteIndex]);
    }
    return scale;
}

export function getMajorScaleChord(note, degree) {
    // In a major key, the 2nd, 3rd, and 6th degrees are minor.
    if ([2, 3, 6].includes(degree)) {
        return note + 'm';
    }
    // The 7th degree is diminished.
    if (degree === 7) {
        return note + '°';
    }
    return note; // Major chord (or just the root note)
}