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
