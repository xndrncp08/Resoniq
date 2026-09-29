from types import SimpleNamespace

import anthropic
import httpx
import pytest

from app.recipe import generate_recipe, heuristic_recipe
from app.schemas import RecipeDraft
from tests.test_heuristics import features
from app.heuristics import build_tone_profile

PICKUPS = {"Bridge", "Middle", "Neck", "Bridge/Middle", "Neck/Middle"}


@pytest.fixture
def inputs():
    f = features(estimated_reverb_tail_s=2.0, compression=0.7, saturation=0.8)
    return f, build_tone_profile(f)


class FakeMessages:
    def __init__(self, result=None, error=None):
        self.result, self.error, self.calls = result, error, []

    def parse(self, **kwargs):
        self.calls.append(kwargs)
        if self.error:
            raise self.error
        return self.result


def fake_client(**kwargs):
    return SimpleNamespace(messages=FakeMessages(**kwargs))


def draft(**overrides):
    base = {
        "recipeDescription": " Plexi-style crunch. ",
        "amp": {"family": "Marshall", "model": "Plexi-style", "gain": 140, "bass": 40, "mids": 70, "treble": -5, "presence": 55},
        "cabinet": {"type": "4x12 closed-back", "speaker": "Greenback-style"},
        "pickup": "Bridge",
        "pedalboard": [
            {"slot": 7, "name": "Tube Screamer-style", "type": "drive", "enabled": True, "drive": 30, "tone": 55, "level": 70},
            {"slot": 9, "name": "Plate reverb", "type": "time", "enabled": True, "drive": 50, "tone": 40, "level": 25},
        ],
        "similarArtists": ["Slash", "Slash", " Jimmy Page ", ""],
    }
    base.update(overrides)
    return RecipeDraft.model_validate(base)


def test_heuristic_recipe_matches_contract(inputs):
    recipe = heuristic_recipe(*inputs)
    data = recipe.model_dump(by_alias=True)
    assert {"recipeDescription", "amp", "cabinet", "pickup", "pedalboard", "similarArtists", "confidenceScore"} <= data.keys()
    assert data["pickup"] in PICKUPS
    assert all(0 <= data["amp"][k] <= 100 for k in ("gain", "bass", "mids", "treble", "presence"))
    assert [p["slot"] for p in data["pedalboard"]] == list(range(1, len(data["pedalboard"]) + 1))
    # modulation/time effects sit after dynamics/drive
    types = [p["type"] for p in data["pedalboard"]]
    assert types == sorted(types, key=lambda t: t in ("modulation", "time"))
    assert recipe.source == "heuristic"


def test_non_drive_pedals_omit_drive_key(inputs):
    data = heuristic_recipe(*inputs).model_dump(by_alias=True)
    for pedal in data["pedalboard"]:
        assert ("drive" in pedal) == (pedal["type"] == "drive")


def test_no_api_key_uses_heuristic(inputs, monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    assert generate_recipe(*inputs).source == "heuristic"


def test_llm_recipe_is_normalized(inputs):
    client = fake_client(result=SimpleNamespace(stop_reason="end_turn", parsed_output=draft()))
    recipe = generate_recipe(*inputs, client=client)

    assert recipe.source == "llm"
    assert recipe.amp.gain == 100 and recipe.amp.treble == 0
    assert [p.slot for p in recipe.pedalboard] == [1, 2]
    assert recipe.pedalboard[1].drive is None  # reverb has no drive knob
    assert recipe.similar_artists == ["Slash", "Jimmy Page"]
    assert recipe.recipe_description == "Plexi-style crunch."
    assert recipe.confidence_score == inputs[1].match_confidence

    call = client.messages.calls[0]
    assert call["output_format"] is RecipeDraft
    assert "Measurements" in call["messages"][0]["content"]


def test_refusal_falls_back(inputs):
    client = fake_client(result=SimpleNamespace(stop_reason="refusal", parsed_output=None))
    assert generate_recipe(*inputs, client=client).source == "heuristic"


def test_api_errors_fall_back(inputs):
    request = httpx.Request("POST", "https://api.anthropic.com/v1/messages")
    errors = [
        anthropic.APIConnectionError(request=request),
        anthropic.InternalServerError("boom", response=httpx.Response(500, request=request), body=None),
    ]
    for error in errors:
        assert generate_recipe(*inputs, client=fake_client(error=error)).source == "heuristic"
