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


def _events(res):
    return [__import__("json").loads(line) for line in res.text.splitlines() if line.strip()]


def test_stream_reports_every_stage_in_order_then_the_same_result(client):
    audio = wav_bytes(plucked_notes())
    files = {"file": ("song.wav", audio, "audio/wav")}
    res = client.post("/analyze/file/stream", files=files, headers=AUTH)
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("application/x-ndjson")
    events = _events(res)
    stages = [e["stage"] for e in events if e["type"] == "stage"]
    # A short take has no sections, so it skips the scan; the rest arrive in order.
    assert stages == [s for s in main.STAGES if s not in ("scanning", "sections")]
    indexes = [e["index"] for e in events if e["type"] == "stage"]
    assert indexes == sorted(indexes) and indexes == [main.STAGES.index(s) for s in stages]
    assert events[-1]["type"] == "result"
    plain = client.post("/analyze/file", files={"file": ("song.wav", audio, "audio/wav")}, headers=AUTH).json()
    assert events[-1]["data"] == plain


def test_stream_reports_failures_in_band(client):
    res = client.post("/analyze/file/stream", files={"file": ("x.wav", b"not audio", "audio/wav")}, headers=AUTH)
    assert res.status_code == 200
    events = _events(res)
    assert events[0] == {"type": "stage", "stage": "decoding", "index": 0, "total": len(main.STAGES)}
    assert events[-1] == {"type": "error", "status": 422, "detail": "Could not decode audio file."}


def test_stream_requires_the_engine_key(client):
    res = client.post("/analyze/file/stream", files={"file": ("x.wav", b"x", "audio/wav")})
    assert res.status_code == 401
