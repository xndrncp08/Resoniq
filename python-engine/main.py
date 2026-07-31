import io
import logging

import librosa
import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.schemas import AnalyzeRequest, AnalyzeResponse
from app.features import extract_features
from app.heuristics import build_tone_profile

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("resoniq.python-engine")

app = FastAPI(title="Resoniq Analysis Engine", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten to the Next.js app's origin in production
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

MAX_AUDIO_BYTES = 50 * 1024 * 1024
FETCH_TIMEOUT_S = 30


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest):
    try:
        resp = requests.get(req.audio_url, timeout=FETCH_TIMEOUT_S, stream=True)
        resp.raise_for_status()
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Could not fetch audio: {e}")

    content_length = resp.headers.get("content-length")
    if content_length and int(content_length) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="Audio file too large.")

    audio_bytes = resp.content
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="Audio file too large.")

    try:
        y, sr = librosa.load(io.BytesIO(audio_bytes), sr=22050, mono=True)
    except Exception as e:
        logger.exception("Failed to decode audio")
        raise HTTPException(status_code=422, detail=f"Could not decode audio file: {e}")

    if y.size < sr * 1:  # less than 1 second of audio
        raise HTTPException(status_code=422, detail="Audio is too short to analyze.")

    raw_features = extract_features(y, sr)
    tone_profile = build_tone_profile(raw_features)

    return AnalyzeResponse(raw_features=raw_features, tone_profile=tone_profile)