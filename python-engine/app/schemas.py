from typing import Optional
from pydantic import BaseModel, Field


class AnalyzeRequest(BaseModel):
    audio_url: str = Field(..., description="Publicly fetchable URL to the audio file")


class RawFeatures(BaseModel):
    """
    Raw numeric features pulled straight out of Librosa. These are real
    measurements, not guesses — everything downstream in heuristics.py
    that turns these into "amp family" / "pedal" labels IS a guess,
    built on top of these numbers.
    """
    brightness: float          # normalized spectral centroid, 0-1
    warmth: float               # low/mid energy ratio, 0-1
    saturation: float           # spectral flatness proxy for harmonic distortion, 0-1
    compression: float          # inverse crest factor, 0-1 (higher = more compressed)
    dynamic_range_db: float
    attack_ms: float            # average onset rise time
    sustain_s: float            # average note decay time
    percussive_ratio: float     # 0-1, harmonic vs percussive energy split
    tempo_bpm: Optional[float] = None
    estimated_reverb_tail_s: float
    modulation_rate_hz: Optional[float] = None  # detected amplitude LFO, if any (chorus/tremolo signal)


class EffectEstimate(BaseModel):
    name: str
    confidence: float  # 0-1, heuristic confidence — not a calibrated probability


class ToneProfile(BaseModel):
    gain_percent: int
    eq: dict  # {"bass": int, "mid": int, "treble": int}, 0-100
    amp_family: str
    cabinet: str
    pickup_position: str
    effects_chain: list[EffectEstimate]
    playing_style_tags: list[str]
    match_confidence: int  # 0-100, overall heuristic confidence — deliberately not called a "match score" against a real gear database, since there isn't one


class AnalyzeResponse(BaseModel):
    raw_features: RawFeatures
    tone_profile: ToneProfile