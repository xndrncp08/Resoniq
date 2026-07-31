"""
Heuristics — turns measured features into a gear-flavored tone recipe.

This is a deliberately simple, transparent rules engine. It is NOT a
trained classifier and does not compare against real amp/pedal
fingerprints (no such labeled dataset of "this recording used this exact
pedal" exists publicly). Every threshold here is a reasonable-but-rough
approximation, tuned by ear/domain knowledge, not fit to data. Treat the
output as a starting point for a guitarist to dial in by ear, not a
verified match.
"""

from app.schemas import RawFeatures, ToneProfile, EffectEstimate


def _gain_bucket(saturation: float, compression: float, percussive_ratio: float) -> tuple[str, int]:
    score = saturation * 0.5 + compression * 0.3 + (1 - percussive_ratio) * 0.2
    if score < 0.25:
        return "clean", int(10 + score * 60)
    if score < 0.45:
        return "crunch", int(30 + score * 60)
    if score < 0.65:
        return "overdrive", int(45 + score * 60)
    if score < 0.85:
        return "high gain", int(60 + score * 45)
    return "distortion", int(75 + score * 30)


def _amp_family(gain_label: str, brightness: float, warmth: float) -> str:
    if gain_label == "clean":
        return "Fender-style blackface clean" if brightness > 0.5 else "Two-Rock-style boutique clean"
    if gain_label == "crunch":
        return "Vox-style British chime" if brightness > 0.55 else "tweed-style breakup"
    if gain_label == "overdrive":
        return "Marshall-style plexi crunch" if brightness > 0.5 else "boutique low-gain overdrive"
    if gain_label == "high gain":
        return "modern high-gain (5150/Rectifier family)" if brightness > 0.45 else "vintage high-gain (JCM800 family)"
    return "high-gain metal (modern djent/metal voicing)"


def _cabinet(warmth: float, brightness: float) -> str:
    if warmth > 0.6:
        return "4x12 closed-back"
    if brightness > 0.6:
        return "1x12 open-back"
    return "2x12 open-back"


def _pickup_position(brightness: float, percussive_ratio: float) -> str:
    if brightness > 0.65:
        return "bridge"
    if brightness < 0.35:
        return "neck"
    if percussive_ratio > 0.5:
        return "bridge + middle"
    return "neck + middle"


def _effects_chain(f: RawFeatures) -> list[EffectEstimate]:
    effects: list[EffectEstimate] = []

    if f.compression > 0.5:
        effects.append(EffectEstimate(name="Compressor", confidence=round(min(f.compression + 0.1, 0.9), 2)))

    if f.estimated_reverb_tail_s > 0.6:
        conf = min(0.85, 0.3 + f.estimated_reverb_tail_s / 5)
        effects.append(EffectEstimate(
            name="Hall reverb" if f.estimated_reverb_tail_s > 1.5 else "Spring reverb",
            confidence=round(conf, 2),
        ))

    if f.modulation_rate_hz is not None:
        if f.modulation_rate_hz < 2.0:
            effects.append(EffectEstimate(name="Tremolo", confidence=0.55))
        else:
            effects.append(EffectEstimate(name="Chorus", confidence=0.5))

    if f.sustain_s > 0.8 and f.compression > 0.4:
        effects.append(EffectEstimate(name="Delay", confidence=0.45))

    if not effects:
        effects.append(EffectEstimate(name="No significant effects detected", confidence=0.4))

    return effects


def _playing_style_tags(f: RawFeatures) -> list[str]:
    tags = []
    if f.attack_ms < 8:
        tags.append("sharp picking attack")
    elif f.attack_ms > 25:
        tags.append("soft/legato attack")

    if f.percussive_ratio > 0.55:
        tags.append("rhythmic/percussive")
    elif f.percussive_ratio < 0.3:
        tags.append("sustained/lead-oriented")

    if f.tempo_bpm and f.tempo_bpm > 140:
        tags.append("fast tempo")
    elif f.tempo_bpm and f.tempo_bpm < 80:
        tags.append("slow/ballad tempo")

    return tags or ["moderate playing dynamics"]


def build_tone_profile(f: RawFeatures) -> ToneProfile:
    gain_label, gain_percent = _gain_bucket(f.saturation, f.compression, f.percussive_ratio)
    amp_family = _amp_family(gain_label, f.brightness, f.warmth)

    eq = {
        "bass": int(30 + f.warmth * 60),
        "mid": int(35 + (1 - abs(f.brightness - 0.5) * 2) * 40),
        "treble": int(25 + f.brightness * 65),
    }

    ambiguity = abs(f.saturation - 0.5) + abs(f.brightness - 0.5) + abs(f.compression - 0.5)
    match_confidence = int(min(88, 45 + ambiguity * 60))

    return ToneProfile(
        gain_percent=max(1, min(100, gain_percent)),
        eq=eq,
        amp_family=amp_family,
        cabinet=_cabinet(f.warmth, f.brightness),
        pickup_position=_pickup_position(f.brightness, f.percussive_ratio),
        effects_chain=_effects_chain(f),
        playing_style_tags=_playing_style_tags(f),
        match_confidence=match_confidence,
    )