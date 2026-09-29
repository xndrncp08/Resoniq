from app.features import extract_features
from tests.conftest import SR

NORMALIZED = ("brightness", "warmth", "saturation", "compression", "percussive_ratio")


def test_normalized_features_stay_in_unit_range(clean_signal, driven_signal):
    for y in (clean_signal, driven_signal):
        f = extract_features(y, SR)
        for name in NORMALIZED:
            assert 0.0 <= getattr(f, name) <= 1.0, name


def test_clipping_reads_as_more_compressed_and_brighter(clean_signal, driven_signal):
    clean = extract_features(clean_signal, SR)
    driven = extract_features(driven_signal, SR)
    # Hard clipping flattens peaks (lower crest factor) and adds upper harmonics.
    assert driven.compression > clean.compression
    assert driven.dynamic_range_db < clean.dynamic_range_db
    assert driven.brightness > clean.brightness


def test_thd_separates_pure_and_clipped_tone():
    import numpy as np
    from app.features import _thd_estimate

    t = np.arange(SR * 2) / SR
    sine = (0.8 * np.sin(2 * np.pi * 220 * t)).astype(np.float32)
    clipped = np.clip(sine * 5, -0.8, 0.8).astype(np.float32)
    assert _thd_estimate(sine, SR) < 0.02
    assert _thd_estimate(clipped, SR) > 0.2


def test_driven_notes_decay_slower_than_clean(clean_signal, driven_signal):
    clean = extract_features(clean_signal, SR)
    driven = extract_features(driven_signal, SR)
    # The synthetic notes decay at ~35dB/s before clipping; clipping holds them up.
    assert 10 < clean.decay_db_per_s < 60
    assert driven.decay_db_per_s < clean.decay_db_per_s
    assert driven.sustain_s > clean.sustain_s


def test_spectral_features_are_ordered(clean_signal):
    f = extract_features(clean_signal, SR)
    assert 0 < f.centroid_hz < f.rolloff_hz < SR / 2
    assert f.onset_strength > 0
    assert f.harmonic_percussive_ratio > 0
