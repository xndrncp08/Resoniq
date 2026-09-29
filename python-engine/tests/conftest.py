import numpy as np
import pytest

SR = 22050


def plucked_notes(freqs=(110.0, 146.8, 196.0, 220.0), note_s=0.6, drive=0.0, sr=SR):
    """A few decaying guitar-ish notes; `drive` > 0 hard-clips them like an overdriven amp."""
    notes = []
    for f in freqs:
        t = np.arange(int(sr * note_s)) / sr
        tone = sum(np.sin(2 * np.pi * f * k * t) / k for k in (1, 2, 3))
        notes.append(tone * np.exp(-t * 4.0))
    y = np.concatenate(notes).astype(np.float32)
    y /= np.max(np.abs(y))
    if drive > 0:
        y = np.clip(y * (1 + drive * 20), -1, 1)
        y /= np.max(np.abs(y))
    return y


@pytest.fixture
def clean_signal():
    return plucked_notes()


@pytest.fixture
def driven_signal():
    return plucked_notes(drive=1.0)
