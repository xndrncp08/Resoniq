import io
from types import SimpleNamespace

import soundfile as sf
from fastapi.testclient import TestClient

import main
from tests.conftest import SR, plucked_notes


def wav_bytes(y):
    buf = io.BytesIO()
    sf.write(buf, y, SR, format="WAV")
    return buf.getvalue()


def test_analyze_returns_camelcase_recipe(monkeypatch):
    audio = wav_bytes(plucked_notes())
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.setattr(
        main.requests,
        "get",
        lambda *a, **k: SimpleNamespace(raise_for_status=lambda: None, headers={}, content=audio),
    )

    res = TestClient(main.app).post("/analyze", json={"audio_url": "https://example.com/song.wav"})

    assert res.status_code == 200
    body = res.json()
    assert {"raw_features", "tone_profile", "recipe"} <= body.keys()
    recipe = body["recipe"]
    assert recipe["source"] == "heuristic"
    assert {"recipeDescription", "similarArtists", "confidenceScore"} <= recipe.keys()
    assert "thd_estimate" in body["raw_features"]
    for pedal in recipe["pedalboard"]:
        assert None not in pedal.values()


def test_analyze_rejects_too_short_audio(monkeypatch):
    audio = wav_bytes(plucked_notes()[: SR // 2])
    monkeypatch.setattr(
        main.requests,
        "get",
        lambda *a, **k: SimpleNamespace(raise_for_status=lambda: None, headers={}, content=audio),
    )
    res = TestClient(main.app).post("/analyze", json={"audio_url": "https://example.com/short.wav"})
    assert res.status_code == 422
