"""Long recordings: measured on a bounded window, so memory doesn't grow with length (the production OOM)."""
import io
import threading
import time
import tracemalloc

import numpy as np
import soundfile as sf

import main
from tests.conftest import SR, plucked_notes


def track(seconds: float, loud_at: tuple[float, float] | None = None, sr: int = SR) -> np.ndarray:
    """Quiet plucked notes throughout; optionally a loud, driven stretch in the given range."""
    notes = plucked_notes(sr=sr)
    y = np.tile(notes, int(np.ceil(seconds * sr / notes.size)))[: int(seconds * sr)] * 0.1
    if loud_at:
        a, b = (int(t * sr) for t in loud_at)
        y[a:b] = np.clip(y[a:b] * 40, -1, 1)
    return y.astype(np.float32)


def encode(y: np.ndarray, fmt: str = "WAV", sr: int = SR) -> bytes:
    buf = io.BytesIO()
    sf.write(buf, y, sr, format=fmt)
    return buf.getvalue()


def test_finds_the_loudest_stretch_without_decoding_it_all():
    audio = encode(track(60, loud_at=(31, 41)))
    assert main.loudest_window_start(audio, 10) == 31


def test_window_search_falls_back_to_the_start_for_unreadable_or_short_input():
    assert main.loudest_window_start(b"not audio", 10) == 0
    assert main.loudest_window_start(encode(track(5)), 10) == 0


def test_long_recordings_are_measured_on_their_loudest_window(monkeypatch):
    monkeypatch.setattr(main, "ANALYSIS_WINDOW_S", 8)
    result = main.analyze_bytes(encode(track(40, loud_at=(20, 28)), "FLAC"))
    w = result.analysis_window
    assert (w.start_s, w.duration_s, w.total_s) == (20, 8, 40)


def test_short_recordings_are_measured_whole():
    result = main.analyze_bytes(encode(track(6)))
    assert (result.analysis_window.start_s, result.analysis_window.duration_s) == (0, 6)


def test_peak_memory_does_not_grow_with_recording_length(monkeypatch):
    monkeypatch.setattr(main, "ANALYSIS_WINDOW_S", 20)

    def peak_mb(seconds):
        audio = encode(track(seconds, loud_at=(5, 15)))
        main.analyze_bytes(audio)  # first run pays one-time allocations
        tracemalloc.start()
        main.analyze_bytes(audio)
        peak = tracemalloc.get_traced_memory()[1] / 2**20 - len(audio) / 2**20
        tracemalloc.stop()
        return peak

    short, long = peak_mb(30), peak_mb(240)
    # Before the fix this scaled with the file: ~6 MB per second of audio.
    assert long < short + 10, (short, long)


def test_analyses_run_one_at_a_time(monkeypatch):
    running, overlap = [0], [False]
    real = main.extract_features

    def tracked(*args, **kwargs):
        running[0] += 1
        overlap[0] |= running[0] > 1
        time.sleep(0.2)
        try:
            return real(*args, **kwargs)
        finally:
            running[0] -= 1

    monkeypatch.setattr(main, "extract_features", tracked)
    audio = encode(track(3))
    threads = [threading.Thread(target=main.analyze_bytes, args=(audio,)) for _ in range(3)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert not overlap[0]
