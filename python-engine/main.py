import hmac
import io
import logging
import os
import json
import queue
import threading
from collections.abc import Callable, Iterator
from contextlib import asynccontextmanager
from typing import Annotated

import librosa
import numpy as np
import soundfile as sf
from fastapi import Depends, FastAPI, File, Header, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse

from app.schemas import AnalyzeRequest, AnalyzeResponse
from app.features import FEATURE_STEPS, extract_features
from app.fetch import BlockedURLError, FetchError, TooLargeError, fetch_audio
from app.heuristics import build_tone_profile
from app.recipe import generate_recipe

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("resoniq.python-engine")

MAX_AUDIO_BYTES = 50 * 1024 * 1024
MAX_AUDIO_SECONDS = float(os.environ.get("RESONIQ_MAX_AUDIO_SECONDS", 10 * 60))
FETCH_TIMEOUT_S = 30
SAMPLE_RATE = 22050
UPLOAD_CHUNK_BYTES = 1024 * 1024


def warm_up() -> None:
    """
    Decode and analyze one second of generated audio before serving traffic.

    librosa loads its submodules lazily and numba compiles (and caches) its
    kernels on first use, so a broken environment, such as an unwritable
    numba cache, would otherwise only surface inside the first request,
    where it was reported as "Could not decode audio file". Doing it here
    makes startup fail loudly instead, and takes the JIT cost off the first
    user's request.
    """
    t = np.arange(SAMPLE_RATE) / SAMPLE_RATE
    buf = io.BytesIO()
    sf.write(buf, (0.5 * np.sin(2 * np.pi * 220 * t)).astype(np.float32), SAMPLE_RATE, format="WAV")
    y, sr = librosa.load(io.BytesIO(buf.getvalue()), sr=SAMPLE_RATE, mono=True)
    build_tone_profile(extract_features(y, sr))


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if not os.environ.get("RESONIQ_ENGINE_SECRET"):
        logger.warning("RESONIQ_ENGINE_SECRET is not set; /analyze will refuse every request until it is.")
    warm_up()
    yield


# No CORS middleware: only the Next.js server calls this service, never a browser.
app = FastAPI(title="Resoniq Analysis Engine", version="0.2.0", lifespan=lifespan)


@app.exception_handler(Exception)
async def unhandled_error(_request: Request, exc: Exception):
    logger.exception("Unhandled error", exc_info=exc)
    return JSONResponse(status_code=500, content={"detail": "Internal error."})


def require_engine_key(x_resoniq_engine_key: Annotated[str | None, Header()] = None) -> None:
    """Shared secret between the Next.js server and this service. Fails closed if unset."""
    expected = os.environ.get("RESONIQ_ENGINE_SECRET")
    if not expected:
        logger.error("Rejected /analyze: RESONIQ_ENGINE_SECRET is not configured")
        raise HTTPException(status_code=503, detail="Analysis engine is not configured.")
    if not x_resoniq_engine_key or not hmac.compare_digest(x_resoniq_engine_key.encode(), expected.encode()):
        raise HTTPException(status_code=401, detail="Unauthorized.")


def _audio_duration_s(audio_bytes: bytes) -> float | None:
    """Duration from the container header, without decoding. None if libsndfile can't read it."""
    try:
        info = sf.info(io.BytesIO(audio_bytes))
    except Exception:
        return None
    return info.frames / info.samplerate if info.samplerate else None


# Stages of an analysis, in order, as reported by /analyze/file/stream.
STAGES = ("decoding", *(f"features.{s}" for s in FEATURE_STEPS), "inference", "recipe")


def analyze_bytes(audio_bytes: bytes, on_stage: Callable[[str], None] | None = None) -> AnalyzeResponse:
    """Decode, measure, infer, write the recipe. `on_stage` hears each stage as it starts (see STAGES)."""
    stage = on_stage or (lambda _name: None)
    stage("decoding")
    too_long = HTTPException(
        status_code=413, detail=f"Audio is longer than {int(MAX_AUDIO_SECONDS // 60)} minutes."
    )
    duration = _audio_duration_s(audio_bytes)
    if duration is not None and duration > MAX_AUDIO_SECONDS:
        raise too_long

    try:
        # The duration limit also bounds decoding for formats whose header
        # libsndfile couldn't read: decode one second past the cap, then check.
        y, sr = librosa.load(
            io.BytesIO(audio_bytes), sr=SAMPLE_RATE, mono=True, duration=MAX_AUDIO_SECONDS + 1
        )
    except Exception:
        logger.exception("Failed to decode audio")
        raise HTTPException(status_code=422, detail="Could not decode audio file.") from None

    if y.size > sr * MAX_AUDIO_SECONDS:
        raise too_long
    if y.size < sr * 1:  # less than 1 second of audio
        raise HTTPException(status_code=422, detail="Audio is too short to analyze.")

    raw_features = extract_features(y, sr, on_step=lambda step: stage(f"features.{step}"))
    stage("inference")
    tone_profile = build_tone_profile(raw_features)
    stage("recipe")
    recipe = generate_recipe(raw_features, tone_profile)

    return AnalyzeResponse(raw_features=raw_features, tone_profile=tone_profile, recipe=recipe)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/analyze", response_model=AnalyzeResponse, dependencies=[Depends(require_engine_key)])
def analyze(req: AnalyzeRequest):
    """Analyze audio at a public URL (SSRF-guarded, see app/fetch.py)."""
    try:
        audio_bytes = fetch_audio(req.audio_url, MAX_AUDIO_BYTES, FETCH_TIMEOUT_S)
    except BlockedURLError as e:
        logger.warning("Blocked audio_url: %s", e)
        raise HTTPException(status_code=400, detail="audio_url is not allowed.") from None
    except TooLargeError:
        raise HTTPException(status_code=413, detail="Audio file too large.") from None
    except FetchError as e:
        logger.warning("Could not fetch audio_url: %s", e)
        raise HTTPException(status_code=502, detail="Could not fetch audio.") from None
    return analyze_bytes(audio_bytes)


@app.post("/analyze/file", response_model=AnalyzeResponse, dependencies=[Depends(require_engine_key)])
def analyze_file(file: Annotated[UploadFile, File()]):
    """Analyze an uploaded audio file in one response."""
    return analyze_bytes(_read_upload(file))


def _read_upload(file: UploadFile) -> bytes:
    chunks, total = [], 0
    while chunk := file.file.read(UPLOAD_CHUNK_BYTES):
        total += len(chunk)
        if total > MAX_AUDIO_BYTES:
            raise HTTPException(status_code=413, detail="Audio file too large.")
        chunks.append(chunk)
    return b"".join(chunks)


def _stream_analysis(audio_bytes: bytes) -> Iterator[str]:
    """
    Runs the analysis on a worker thread and yields NDJSON events as it goes:
    {"type":"stage","stage":...,"index":i,"total":n} for each stage as it
    starts, then one {"type":"result","data":...} or {"type":"error",
    "status":...,"detail":...}. The HTTP status is already 200 by then, so
    failures are reported in-band, with the same safe messages as /analyze/file.
    """
    events: queue.Queue[dict | None] = queue.Queue()

    def run():
        try:
            def on_stage(name: str):
                events.put({"type": "stage", "stage": name, "index": STAGES.index(name), "total": len(STAGES)})

            result = analyze_bytes(audio_bytes, on_stage=on_stage)
            events.put({"type": "result", "data": result.model_dump(mode="json", by_alias=True)})
        except HTTPException as e:
            events.put({"type": "error", "status": e.status_code, "detail": e.detail})
        except Exception:
            logger.exception("Streaming analysis failed")
            events.put({"type": "error", "status": 500, "detail": "Internal error."})
        finally:
            events.put(None)

    threading.Thread(target=run, daemon=True).start()
    while (event := events.get()) is not None:
        yield json.dumps(event) + "\n"


@app.post("/analyze/file/stream", dependencies=[Depends(require_engine_key)])
def analyze_file_stream(file: Annotated[UploadFile, File()]):
    """Like /analyze/file, but streams real progress (NDJSON) before the result."""
    audio_bytes = _read_upload(file)
    return StreamingResponse(_stream_analysis(audio_bytes), media_type="application/x-ndjson")
