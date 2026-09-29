import pytest

from app.heuristics import build_tone_profile
from app.schemas import RawFeatures


def features(**overrides):
    base = dict(
        brightness=0.5, warmth=0.5, saturation=0.5, compression=0.5, dynamic_range_db=12.0,
        attack_ms=12.0, sustain_s=0.5, percussive_ratio=0.4, tempo_bpm=110.0,
        estimated_reverb_tail_s=0.3, modulation_rate_hz=None,
    )
    base.update(overrides)
    return RawFeatures(**base)


def test_clean_features_map_to_clean_amp():
    profile = build_tone_profile(features(saturation=0.05, compression=0.1, percussive_ratio=0.7))
    assert "clean" in profile.amp_family
    assert profile.gain_percent < 35


def test_saturated_features_map_to_high_gain():
    profile = build_tone_profile(features(saturation=0.95, compression=0.9, percussive_ratio=0.1))
    assert profile.gain_percent > 70
    assert "gain" in profile.amp_family


@pytest.mark.parametrize("sat", [0.0, 0.3, 0.6, 1.0])
def test_profile_values_are_bounded(sat):
    profile = build_tone_profile(features(saturation=sat))
    assert 1 <= profile.gain_percent <= 100
    assert all(0 <= v <= 100 for v in profile.eq.values())
    assert 0 <= profile.match_confidence <= 100
    assert profile.effects_chain


def test_long_reverb_tail_is_detected():
    profile = build_tone_profile(features(estimated_reverb_tail_s=2.0))
    assert any("reverb" in fx.name.lower() for fx in profile.effects_chain)
