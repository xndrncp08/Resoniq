import io

import pytest
import soundfile as sf
from fastapi.testclient import TestClient

import main
from app.fetch import BlockedURLError, FetchError
from tests.conftest import SR, plucked_notes

SECRET = "test-engine-secret"
AUTH = {"X-Resoniq-Engine-Key": SECRET}


def wav_bytes(y):
    buf = io.BytesIO()
    sf.write(buf, y, SR, format="WAV")
    return buf.getvalue()


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("RESONIQ_ENGINE_SECRET", SECRET)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    return TestClient(main.app)


def serve(monkeypatch, audio):
    monkeypatch.setattr(main, "fetch_audio", lambda *a, **k: audio)


def test_analyze_returns_camelcase_recipe(client, monkeypatch):
    serve(monkeypatch, wav_bytes(plucked_notes()))

    res = client.post("/analyze", json={"audio_url": "https://example.com/song.wav"}, headers=AUTH)

    assert res.status_code == 200
    body = res.json()
    assert {"raw_features", "tone_profile", "recipe"} <= body.keys()
    recipe = body["recipe"]
    assert recipe["source"] == "heuristic"
    assert {"recipeDescription", "similarArtists", "confidenceScore"} <= recipe.keys()
    assert "thd_estimate" in body["raw_features"]
    for pedal in recipe["pedalboard"]:
        assert None not in pedal.values()


def test_analyze_file_upload(client):
    files = {"file": ("song.wav", wav_bytes(plucked_notes()), "audio/wav")}
    res = client.post("/analyze/file", files=files, headers=AUTH)
    assert res.status_code == 200
    assert res.json()["recipe"]["source"] == "heuristic"


def test_analyze_rejects_too_short_audio(client, monkeypatch):
    serve(monkeypatch, wav_bytes(plucked_notes()[: SR // 2]))
    res = client.post("/analyze", json={"audio_url": "https://example.com/short.wav"}, headers=AUTH)
    assert res.status_code == 422


def test_analyze_rejects_audio_over_duration_cap(client, monkeypatch):
    monkeypatch.setattr(main, "MAX_AUDIO_SECONDS", 1.5)
    files = {"file": ("long.wav", wav_bytes(plucked_notes()), "audio/wav")}  # 2.4s
    res = client.post("/analyze/file", files=files, headers=AUTH)
    assert res.status_code == 413


def test_upload_size_cap(client, monkeypatch):
    monkeypatch.setattr(main, "MAX_AUDIO_BYTES", 1000)
    files = {"file": ("big.wav", wav_bytes(plucked_notes()), "audio/wav")}
    assert client.post("/analyze/file", files=files, headers=AUTH).status_code == 413


def test_undecodable_audio_gets_generic_error(client):
    files = {"file": ("song.wav", b"definitely not audio", "audio/wav")}
    res = client.post("/analyze/file", files=files, headers=AUTH)
    assert res.status_code == 422
    assert res.json() == {"detail": "Could not decode audio file."}


@pytest.mark.parametrize("headers", [{}, {"X-Resoniq-Engine-Key": "wrong"}])
def test_requires_engine_key(client, headers):
    res = client.post("/analyze", json={"audio_url": "https://example.com/a.wav"}, headers=headers)
    assert res.status_code == 401


def test_fails_closed_without_configured_secret(monkeypatch):
    monkeypatch.delenv("RESONIQ_ENGINE_SECRET", raising=False)
    res = TestClient(main.app).post("/analyze", json={"audio_url": "https://example.com/a.wav"}, headers=AUTH)
    assert res.status_code == 503


def test_health_is_open():
    assert TestClient(main.app).get("/health").json() == {"status": "ok"}


def test_blocked_url_does_not_leak_reason(client, monkeypatch):
    def blocked(*_a, **_k):
        raise BlockedURLError("internal.example resolves to non-public address 10.0.0.5")

    monkeypatch.setattr(main, "fetch_audio", blocked)
    res = client.post("/analyze", json={"audio_url": "http://internal.example/a.wav"}, headers=AUTH)
    assert res.status_code == 400
    assert "10.0.0.5" not in res.text


def test_fetch_failure_does_not_leak_reason(client, monkeypatch):
    def failed(*_a, **_k):
        raise FetchError("connection refused by 203.0.113.9")

    monkeypatch.setattr(main, "fetch_audio", failed)
    res = client.post("/analyze", json={"audio_url": "https://example.com/a.wav"}, headers=AUTH)
    assert res.status_code == 502
    assert res.json() == {"detail": "Could not fetch audio."}


def test_startup_warm_up_runs_the_full_pipeline(monkeypatch):
    calls = []
    real = main.extract_features
    monkeypatch.setattr(main, "extract_features", lambda y, sr: calls.append(sr) or real(y, sr))
    with TestClient(main.app) as c:  # entering the context runs the lifespan
        assert c.get("/health").status_code == 200
    assert calls == [SR]
