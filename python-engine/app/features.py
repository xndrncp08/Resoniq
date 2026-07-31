"""
Feature extraction — the only part of this service that measures the
actual audio rather than guessing about it.

Everything here is a legitimate, well-established DSP technique. Nothing
here identifies "gear" — that mapping happens in heuristics.py, and is
explicitly a heuristic, not a lookup against real amp/pedal fingerprints
(no such public dataset exists).
"""

import numpy as np
import librosa

from app.schemas import RawFeatures


def _normalize(value: float, low: float, high: float) -> float:
    """Clamp + rescale a raw value into 0-1 given an expected range."""
    if high == low:
        return 0.0
    return float(np.clip((value - low) / (high - low), 0.0, 1.0))


def extract_features(y: np.ndarray, sr: int) -> RawFeatures:
    # Trim leading/trailing silence so quiet intros/outros don't skew averages
    y_trimmed, _ = librosa.effects.trim(y, top_db=30)
    if y_trimmed.size == 0:
        y_trimmed = y

    # --- Brightness: spectral centroid, where the "center of mass" of the
    # frequency spectrum sits. Bright/distorted tones skew high; dark,
    # warm cleans skew low.
    centroid = librosa.feature.spectral_centroid(y=y_trimmed, sr=sr)[0]
    brightness = _normalize(float(np.mean(centroid)), 500, 6000)

    # --- Warmth: ratio of energy below ~500Hz to total energy.
    stft = np.abs(librosa.stft(y_trimmed))
    freqs = librosa.fft_frequencies(sr=sr)
    low_band = stft[freqs < 500, :]
    warmth_ratio = float(np.sum(low_band) / (np.sum(stft) + 1e-9))
    warmth = _normalize(warmth_ratio, 0.05, 0.45)

    # --- Saturation proxy: spectral flatness. Distortion smears energy
    # across the spectrum (noise-like, flat); clean tones concentrate
    # energy at the fundamental + a few harmonics (peaky, low flatness).
    flatness = librosa.feature.spectral_flatness(y=y_trimmed)[0]
    saturation = _normalize(float(np.mean(flatness)), 0.01, 0.25)

    # --- Compression: inverse crest factor (peak/RMS). Heavily
    # compressed or high-gain signals have a low crest factor (loud and
    # consistent); dynamic clean playing has a high one.
    rms = librosa.feature.rms(y=y_trimmed)[0]
    peak = float(np.max(np.abs(y_trimmed))) + 1e-9
    mean_rms = float(np.mean(rms)) + 1e-9
    crest_factor = peak / mean_rms
    compression = _normalize(1.0 / crest_factor, 1 / 20, 1 / 4)

    dynamic_range_db = float(20 * np.log10(crest_factor))

    # --- Attack: average time from onset to local energy peak, across
    # detected onsets. Fast attack = picked/plucked/high-gain; slow
    # attack = volume swells, e-bow, heavy compression softening the pick.
    onset_frames = librosa.onset.onset_detect(y=y_trimmed, sr=sr, units="frames")
    attack_times_ms = []
    hop_length = 512
    for onset in onset_frames[:40]:  # cap for speed on long files
        start = onset * hop_length
        window = y_trimmed[start:start + int(sr * 0.1)]
        if window.size < 4:
            continue
        env = np.abs(window)
        peak_idx = int(np.argmax(env))
        attack_times_ms.append((peak_idx / sr) * 1000)
    attack_ms = float(np.mean(attack_times_ms)) if attack_times_ms else 15.0

    # --- Sustain: average time for energy to decay by 20dB after each
    # onset, capped at a reasonable window.
    sustain_times = []
    for onset in onset_frames[:40]:
        start = onset * hop_length
        window = y_trimmed[start:start + int(sr * 2.0)]
        if window.size < sr * 0.05:
            continue
        env = np.abs(window)
        peak_val = np.max(env) + 1e-9
        below_threshold = np.where(env < peak_val * 0.1)[0]  # -20dB point
        if below_threshold.size:
            sustain_times.append(below_threshold[0] / sr)
    sustain_s = float(np.mean(sustain_times)) if sustain_times else 0.3

    # --- Harmonic/percussive split: how much of the signal is tonal
    # (sustained pitches) vs transient (picking/strumming attack noise).
    y_harm, y_perc = librosa.effects.hpss(y_trimmed)
    harm_energy = float(np.sum(y_harm ** 2))
    perc_energy = float(np.sum(y_perc ** 2))
    percussive_ratio = perc_energy / (harm_energy + perc_energy + 1e-9)

    # --- Tempo (informational, not used in gear heuristics directly)
    try:
        tempo, _ = librosa.beat.beat_track(y=y_trimmed, sr=sr)
        tempo_bpm = float(tempo) if tempo else None
    except Exception:
        tempo_bpm = None

    # --- Reverb tail estimate: how long energy takes to decay by 40dB
    # after the last strong onset — a rough proxy for reverb/room decay,
    # NOT a proper RT60 measurement (that needs an impulse response).
    if onset_frames.size:
        last_onset_sample = onset_frames[-1] * hop_length
        tail = y_trimmed[last_onset_sample:]
    else:
        tail = y_trimmed
    if tail.size > sr * 0.1:
        env = np.abs(tail)
        peak_val = np.max(env) + 1e-9
        below = np.where(env < peak_val * 0.01)[0]  # -40dB
        estimated_reverb_tail_s = float(below[0] / sr) if below.size else float(tail.size / sr)
        estimated_reverb_tail_s = min(estimated_reverb_tail_s, 4.0)
    else:
        estimated_reverb_tail_s = 0.3

    # --- Amplitude modulation rate: FFT of the RMS envelope itself, to
    # catch slow periodic volume modulation (tremolo/chorus-like LFOs,
    # typically 0.5-8Hz). This is a coarse signal, not a chorus detector.
    modulation_rate_hz = None
    if rms.size > 16:
        rms_centered = rms - np.mean(rms)
        env_fft = np.abs(np.fft.rfft(rms_centered))
        env_freqs = np.fft.rfftfreq(rms.size, d=hop_length / sr)
        band = (env_freqs > 0.3) & (env_freqs < 10)
        if np.any(band) and np.max(env_fft[band]) > 3 * np.median(env_fft[band] + 1e-9):
            modulation_rate_hz = float(env_freqs[band][np.argmax(env_fft[band])])

    return RawFeatures(
        brightness=brightness,
        warmth=warmth,
        saturation=saturation,
        compression=compression,
        dynamic_range_db=dynamic_range_db,
        attack_ms=attack_ms,
        sustain_s=sustain_s,
        percussive_ratio=percussive_ratio,
        tempo_bpm=tempo_bpm,
        estimated_reverb_tail_s=estimated_reverb_tail_s,
        modulation_rate_hz=modulation_rate_hz,
    )