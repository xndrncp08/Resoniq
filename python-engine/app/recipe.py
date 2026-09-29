"""
Recipe step — turns measured features + the heuristic profile into the
structured ToneRecipe the frontend renders.

With ANTHROPIC_API_KEY set, Claude writes the recipe via structured
outputs, using the heuristic profile as its starting point. Without a key,
or if the API call fails for any reason, a deterministic rules-based
recipe is returned instead, so analysis never fails because of the LLM.
Either way the result is an inferred "closest match", not a gear ID.
"""

import json
import logging
import os
from typing import Optional

import anthropic
from pydantic import ValidationError

from app.schemas import (
    AmpSettings,
    CabinetSettings,
    PedalSlot,
    RawFeatures,
    RecipeDraft,
    ToneProfile,
    ToneRecipe,
)

logger = logging.getLogger("resoniq.python-engine.recipe")

DEFAULT_MODEL = "claude-sonnet-5"
NO_EFFECTS = "No significant effects detected"

SYSTEM_PROMPT = """You turn audio measurements of a guitar recording into a starting-point tone recipe that a guitarist can dial in by ear.

The measurements come from DSP on the full mix, and the draft profile comes from a simple rules engine. Neither identifies specific gear (no dataset maps recordings to the exact amps or pedals used), so the recipe describes the closest-sounding setup, not an identification. Write in that register ("a plexi-style crunch", "closest to"), and never claim the artist used this gear.

How to read the measurements:
- Brightness: centroid_hz and rolloff_hz (higher means more top end); brightness is the centroid normalized to 0-1.
- Dynamics: dynamic_range_db is the peak-to-average ratio. Below about 8 dB reads as heavily compressed or saturated, above about 15 dB as dynamic. rms_db is overall level.
- Pick attack: a sharp attack shows as low attack_ms and high onset_strength. decay_db_per_s is how fast notes die away: fast means palm-muted or percussive, slow means compressed, saturated, or sustaining.
- Distortion: saturation (spectral flatness), harmonic_percussive_ratio, and thd_estimate. thd_estimate is measured on a full mix and clean guitars are naturally harmonic-rich, so treat it as a weak hint rather than a gain reading.
- Effects: estimated_reverb_tail_s, and modulation_rate_hz (an amplitude LFO; tremolo-like below about 2 Hz, chorus-like above).

Recipe rules:
- Start from the draft profile and change it only where the measurements clearly argue otherwise.
- Knob values are integers from 0 to 100.
- amp.family is the broad lineage (for example "Fender", "Vox", "Marshall", "Mesa/Boogie", "EVH 5150", "Boutique"). amp.model is a style description such as "Blackface Deluxe Reverb-style".
- List the pedalboard in signal-chain order with slots numbered from 1. type is one of dynamics, drive, modulation, time. Set drive only on drive pedals; set tone and level on every pedal. Name pedals as styles of widely available units (for example "Tube Screamer-style overdrive"). Leave the pedalboard empty if no effects are evident rather than padding it.
- similarArtists: 3 to 5 players known for a similar-sounding tone.
- recipeDescription: 2 to 3 sentences on what defines this tone and how to approach dialing it in."""

# Illustrative reference points per amp voicing — "sounds in this
# neighbourhood", never a claim about what these artists actually used.
# Mirrors AMP_FAMILIES in frontend/lib/tone-recipe.ts.
_AMP_FAMILIES = [
    (("fender", "blackface"), "Fender", ["John Mayer", "Cory Wong", "Mark Knopfler"]),
    (("two-rock", "boutique clean"), "Boutique clean", ["John Mayer", "Josh Kiszka", "Tom Misch"]),
    (("vox", "chime"), "Vox", ["The Edge", "Brian May", "Peter Buck"]),
    (("tweed",), "Tweed", ["Neil Young", "Billy Gibbons", "Keith Richards"]),
    (("plexi", "marshall", "jcm800"), "Marshall", ["Jimmy Page", "Slash", "Angus Young"]),
    (("5150", "rectifier", "djent", "metal"), "Modern high gain", ["Mark Tremonti", "Misha Mansoor", "Adam Jones"]),
]

_PICKUPS = {
    "bridge": "Bridge",
    "middle": "Middle",
    "neck": "Neck",
    "bridge + middle": "Bridge/Middle",
    "neck + middle": "Neck/Middle",
}


def _clamp(v: float) -> int:
    return int(max(0, min(100, round(v))))


def _pedal_type(name: str) -> str:
    # Same buckets as classifyEffect() in frontend/lib/effectConfig.ts.
    n = name.lower()
    if "compressor" in n:
        return "dynamics"
    if any(w in n for w in ("chorus", "tremolo", "phaser", "flanger", "wah")):
        return "modulation"
    if any(w in n for w in ("delay", "reverb")):
        return "time"
    return "drive"


def heuristic_recipe(features: RawFeatures, profile: ToneProfile) -> ToneRecipe:
    label = profile.amp_family.lower()
    family, artists = next(
        ((fam, arts) for keys, fam, arts in _AMP_FAMILIES if any(k in label for k in keys)),
        ("Boutique", ["Derek Trucks", "Gary Clark Jr.", "Joe Bonamassa"]),
    )
    cab = profile.cabinet
    speaker = (
        "Celestion Vintage 30-style" if "4x12" in cab
        else "Jensen C12N-style" if "1x12" in cab
        else "Celestion G12H-style"
    )
    pickup = _PICKUPS.get(profile.pickup_position, "Bridge")

    effects = [fx.name for fx in profile.effects_chain if fx.name != NO_EFFECTS]
    # Dynamics/drive before the amp, modulation/time after it.
    effects.sort(key=lambda name: _pedal_type(name) in ("modulation", "time"))
    pedals = [
        PedalSlot(
            slot=i + 1,
            name=name,
            type=_pedal_type(name),
            enabled=True,
            drive=45 if _pedal_type(name) == "drive" else None,
            tone=50,
            level=60,
        )
        for i, name in enumerate(effects)
    ]

    description = (
        f"A {profile.amp_family} voice at around {profile.gain_percent}% gain through a "
        f"{cab} cab, played on the {pickup.lower()} pickup"
        + (f" with {', '.join(e.lower() for e in effects)}." if effects else ", no obvious effects.")
    )

    return ToneRecipe(
        recipe_description=description,
        amp=AmpSettings(
            family=family,
            model=profile.amp_family,
            gain=_clamp(profile.gain_percent),
            bass=_clamp(profile.eq["bass"]),
            mids=_clamp(profile.eq["mid"]),
            treble=_clamp(profile.eq["treble"]),
            presence=_clamp(profile.eq["treble"] * 0.8 + features.brightness * 20),
        ),
        cabinet=CabinetSettings(type=cab, speaker=speaker),
        pickup=pickup,
        pedalboard=pedals,
        similar_artists=artists,
        confidence_score=_clamp(profile.match_confidence),
        source="heuristic",
    )


def _finalize(draft: RecipeDraft, confidence: int) -> ToneRecipe:
    amp = draft.amp.model_copy(
        update={k: _clamp(getattr(draft.amp, k)) for k in ("gain", "bass", "mids", "treble", "presence")}
    )
    pedals = [
        p.model_copy(
            update={
                "slot": i + 1,
                "drive": _clamp(p.drive) if p.drive is not None and p.type == "drive" else None,
                "tone": _clamp(p.tone) if p.tone is not None else None,
                "level": _clamp(p.level) if p.level is not None else None,
            }
        )
        for i, p in enumerate(draft.pedalboard)
    ]
    artists = list(dict.fromkeys(a.strip() for a in draft.similar_artists if a.strip()))[:5]
    return ToneRecipe(
        recipe_description=draft.recipe_description.strip(),
        amp=amp,
        cabinet=draft.cabinet,
        pickup=draft.pickup,
        pedalboard=pedals,
        similar_artists=artists,
        confidence_score=_clamp(confidence),
        source="llm",
    )


def _user_prompt(features: RawFeatures, profile: ToneProfile) -> str:
    return (
        "Measurements:\n"
        f"{json.dumps(features.model_dump(), indent=2)}\n\n"
        "Draft profile from the rules engine:\n"
        f"{json.dumps(profile.model_dump(), indent=2)}\n\n"
        "Write the tone recipe."
    )


def generate_recipe(
    features: RawFeatures,
    profile: ToneProfile,
    client: Optional[anthropic.Anthropic] = None,
) -> ToneRecipe:
    fallback = heuristic_recipe(features, profile)
    if client is None:
        if not os.environ.get("ANTHROPIC_API_KEY"):
            return fallback
        client = anthropic.Anthropic(timeout=120.0)

    model = os.environ.get("RESONIQ_CLAUDE_MODEL", DEFAULT_MODEL)
    try:
        response = client.messages.parse(
            model=model,
            max_tokens=16000,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": _user_prompt(features, profile)}],
            output_format=RecipeDraft,
        )
    except anthropic.RateLimitError as e:
        logger.warning("Claude rate limited (request %s); using heuristic recipe", e.request_id)
        return fallback
    except anthropic.APIStatusError as e:
        logger.error("Claude API error %s (request %s); using heuristic recipe", e.status_code, e.request_id)
        return fallback
    except anthropic.APIConnectionError:
        logger.error("Could not reach the Claude API; using heuristic recipe")
        return fallback
    except ValidationError:
        logger.exception("Claude output failed schema validation; using heuristic recipe")
        return fallback

    if response.stop_reason != "end_turn" or response.parsed_output is None:
        logger.warning("Claude stopped with %s (request %s); using heuristic recipe",
                       response.stop_reason, getattr(response, "_request_id", None))
        return fallback

    return _finalize(response.parsed_output, profile.match_confidence)
