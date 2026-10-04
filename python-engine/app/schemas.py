from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, model_serializer
from pydantic.alias_generators import to_camel


class AnalyzeRequest(BaseModel):
    audio_url: str = Field(..., description="Publicly fetchable URL to the audio file")


class RawFeatures(BaseModel):
    """
    Raw numeric features pulled straight out of Librosa. These are real
    measurements, not guesses — everything downstream in heuristics.py
    that turns these into "amp family" / "pedal" labels IS a guess,
    built on top of these numbers.
    """
    # Treble / brightness
    brightness: float          # normalized spectral centroid, 0-1
    warmth: float               # low/mid energy ratio, 0-1
    saturation: float           # spectral flatness proxy for harmonic distortion, 0-1
    compression: float          # inverse crest factor, 0-1 (higher = more compressed)
    dynamic_range_db: float     # peak-to-average ratio (crest factor), dB
    attack_ms: float            # average onset rise time
    sustain_s: float            # average note decay time
    percussive_ratio: float     # 0-1, harmonic vs percussive energy split
    tempo_bpm: Optional[float] = None
    estimated_reverb_tail_s: float
    modulation_rate_hz: Optional[float] = None  # detected amplitude LFO, if any (chorus/tremolo signal)

    # Added with the recipe step; defaults keep older stored analyses valid.
    centroid_hz: float = 0.0             # mean spectral centroid
    rolloff_hz: float = 0.0              # 85% spectral rolloff
    rms_db: float = 0.0                  # mean RMS level, dBFS
    onset_strength: float = 0.0          # mean onset-strength envelope (pick attack energy)
    decay_db_per_s: float = 0.0          # post-onset decay speed
    harmonic_percussive_ratio: float = 0.0  # HPSS harmonic energy / percussive energy
    thd_estimate: float = 0.0            # rough THD ratio (harmonics 2-6 vs fundamental), see features._thd_estimate


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


# --- Tone recipe: serialized in camelCase to match the frontend's ToneRecipe
# contract (frontend/types/tone.ts). Knob values are 0-100.

class _Camel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


PedalType = Literal["dynamics", "drive", "modulation", "time"]
PickupPosition = Literal["Bridge", "Middle", "Neck", "Bridge/Middle", "Neck/Middle"]


class AmpSettings(_Camel):
    family: str
    model: str
    gain: int
    bass: int
    mids: int
    treble: int
    presence: int


class CabinetSettings(_Camel):
    type: str
    speaker: str


class PedalSlot(_Camel):
    slot: int
    name: str
    type: PedalType
    enabled: bool
    drive: Optional[int] = None
    tone: Optional[int] = None
    level: Optional[int] = None

    @model_serializer(mode="wrap")
    def _drop_unset_knobs(self, handler):
        # The TS contract types these as optional (`drive?: number`), not nullable.
        return {k: v for k, v in handler(self).items() if v is not None}


class RecipeDraft(_Camel):
    """A starting-point guitar tone recipe inferred from the measurements (Claude's structured output)."""
    recipe_description: str
    amp: AmpSettings
    cabinet: CabinetSettings
    pickup: PickupPosition
    pedalboard: list[PedalSlot]
    similar_artists: list[str]


class ToneRecipe(RecipeDraft):
    confidence_score: int  # carried over from the heuristic match_confidence
    source: Literal["llm", "heuristic"]


class AnalyzeResponse(BaseModel):
    raw_features: RawFeatures
    tone_profile: ToneProfile
    recipe: ToneRecipe
