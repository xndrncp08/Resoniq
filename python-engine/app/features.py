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


def _thd_estimate(y_harm: np.ndarray, sr: int, n_fft: int = 4096, hop: int = 1024, n_harmonics: int = 6) -> float:
    """
    Rough total-harmonic-distortion estimate: per frame, track f0 with YIN
    on the harmonic component, then compare energy at 2f0..6f0 against f0.

    True THD needs a known pure input tone; on a finished mix with chords
    and other instruments this is only a relative indicator (a driven
    amp adds harmonics, a clean one mostly doesn't). Only the loudest half
    of frames are used, since YIN always returns a pitch, even for silence.
    """
    f0 = librosa.yin(y_harm, fmin=65, fmax=1000, sr=sr, frame_length=n_fft, hop_length=hop)
    mag = np.abs(librosa.stft(y_harm, n_fft=n_fft, hop_length=hop))
    frames = min(f0.size, mag.shape[1])
    if frames == 0:
        return 0.0
    energy = mag[:, :frames].sum(axis=0)
    loud = energy >= np.median(energy)
    bin_hz = sr / n_fft
    nyquist_bin = mag.shape[0] - 1

    def peak(frame: int, freq: float) -> float:
        b = int(round(freq / bin_hz))
        if b >= nyquist_bin:
            return 0.0
        return float(mag[max(b - 1, 0):b + 2, frame].max())

    ratios = []
    for t in np.flatnonzero(loud[:frames]):
        fundamental = peak(t, f0[t])
        if fundamental < 1e-6:
            continue
        harmonics = [peak(t, f0[t] * k) for k in range(2, n_harmonics + 1)]
        ratios.append(np.sqrt(np.sum(np.square(harmonics))) / fundamental)
    return float(np.median(ratios)) if ratios else 0.0


def extract_features(y: np.ndarray, sr: int) -> RawFeatures:
    # Trim leading/trailing silence so quiet intros/outros don't skew averages
    y_trimmed, _ = librosa.effects.trim(y, top_db=30)
    if y_trimmed.size == 0:
        y_trimmed = y

    # --- Brightness: spectral centroid, where the "center of mass" of the
    # frequency spectrum sits. Bright/distorted tones skew high; dark,
    # warm cleans skew low.
    centroid = librosa.feature.spectral_centroid(y=y_trimmed, sr=sr)[0]
    centroid_hz = float(np.mean(centroid))
    brightness = _normalize(centroid_hz, 500, 6000)

    # --- Rolloff: frequency below which 85% of the spectral energy sits.
    # Tracks how far up the "fizz" extends — high-gain and bright cleans
    # push it up, dark jazz tones and rolled-off tone knobs pull it down.
    rolloff_hz = float(np.mean(librosa.feature.spectral_rolloff(y=y_trimmed, sr=sr, roll_percent=0.85)[0]))

    # --- Warmth: ratio of energy below ~500Hz to total energy.
    stft = np.abs(librosa.stft(y_trimmed))
    freqs = librosa.fft_frequencies(sr=sr)
    low_band = stft[freqs < 500, :]
    warmth_ratio = float(np.sum(low_band) / (np.sum(stft) + 1e-9))
    warmth = _normalize(warmth_ratio, 0.05, 0.45)

    # --- Saturation proxy: spectral flatness. Distortion smears energy
    # across the spectrum (noise-like, flat); clean tones concentrate
    # energy at the fundamental + a few harmonics (peaky, low flatness).
    # Measured in dB over non-silent frames: on real recordings linear
    # flatness sits around 1e-4 (clean) to 1e-2 (high gain), so a linear
    # scale reads almost everything as zero, and gated or quiet passages
    # would drag the mean toward "clean". Checked against CC-licensed clean,
    # crunch and metal recordings (about -52, -34 and -23 dB) — a sanity
    # check of the range, not a fit to a dataset.
    frame_rms = librosa.feature.rms(y=y_trimmed)[0]
    active = frame_rms > np.max(frame_rms) * 10 ** (-30 / 20)
    flatness = librosa.feature.spectral_flatness(y=y_trimmed)[0]
    frames = min(flatness.size, active.size)
    flat_active = flatness[:frames][active[:frames]]
    flatness_db = float(np.mean(10 * np.log10(flat_active + 1e-12))) if flat_active.size else -100.0
    saturation = _normalize(flatness_db, -55.0, -15.0)

    # --- Compression: inverse crest factor (peak/RMS). Heavily
    # compressed or high-gain signals have a low crest factor (loud and
    # consistent); dynamic clean playing has a high one.
    rms = librosa.feature.rms(y=y_trimmed)[0]
    peak = float(np.max(np.abs(y_trimmed))) + 1e-9
    mean_rms = float(np.mean(rms)) + 1e-9
    crest_factor = peak / mean_rms
    compression = _normalize(1.0 / crest_factor, 1 / 20, 1 / 4)

    # Peak-to-average ratio in dB (crest factor). Kept under its original
    # field name so previously stored analyses stay valid.
    dynamic_range_db = float(20 * np.log10(crest_factor))
    rms_db = float(20 * np.log10(mean_rms))

    # --- Attack: average time from onset to local energy peak, across
    # detected onsets. Fast attack = picked/plucked/high-gain; slow
    # attack = volume swells, e-bow, heavy compression softening the pick.
    onset_env = librosa.onset.onset_strength(y=y_trimmed, sr=sr)
    onset_strength = float(np.mean(onset_env))
    onset_frames = librosa.onset.onset_detect(onset_envelope=onset_env, sr=sr, units="frames")
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

    # --- Decay speed / sustain: how fast the RMS envelope falls after
    # each note's peak, as a linear fit in dB, stopping at the next onset.
    # Measured on the frame-level RMS envelope rather than raw samples
    # (the raw waveform crosses zero every half-cycle). Fast decay =
    # percussive/palm-muted; slow = compressed, saturated, or sustaining.
    frame_s = hop_length / sr
    env_db = 20 * np.log10(np.maximum(rms, np.max(rms) * 1e-3) + 1e-12)  # floor at -60dB
    decay_rates = []
    for i, onset in enumerate(onset_frames[:40]):
        next_onset = onset_frames[i + 1] if i + 1 < onset_frames.size else rms.size
        seg = env_db[onset:min(next_onset, onset + int(2.0 / frame_s))]
        if seg.size < 4:
            continue
        peak_idx = int(np.argmax(seg[: int(0.1 / frame_s) + 1]))
        tail = seg[peak_idx:]
        if tail.size < 3:
            continue
        slope = float(np.polyfit(np.arange(tail.size) * frame_s, tail, 1)[0])
        if slope < 0:
            decay_rates.append(-slope)
    decay_db_per_s = float(np.median(decay_rates)) if decay_rates else 66.0
    sustain_s = float(min(20.0 / max(decay_db_per_s, 1e-3), 4.0))  # time to fall 20dB

    # --- Harmonic/percussive split: how much of the signal is tonal
    # (sustained pitches) vs transient (picking/strumming attack noise).
    y_harm, y_perc = librosa.effects.hpss(y_trimmed)
    harm_energy = float(np.sum(y_harm ** 2))
    perc_energy = float(np.sum(y_perc ** 2))
    percussive_ratio = perc_energy / (harm_energy + perc_energy + 1e-9)
    harmonic_percussive_ratio = float(harm_energy / (perc_energy + 1e-9))

    thd_estimate = _thd_estimate(y_harm, sr)

    # --- Tempo (informational, not used in gear heuristics directly)
    try:
        tempo, _ = librosa.beat.beat_track(y=y_trimmed, sr=sr)
        tempo_value = float(np.atleast_1d(tempo)[0])
        tempo_bpm = tempo_value if tempo_value > 0 else None
    except Exception:
        tempo_bpm = None

    # --- Reverb tail estimate: how long the RMS envelope takes to fall
    # 30dB after the last strong onset (the trim above cuts at -30dB, so
    # anything quieter is gone) — a rough proxy for reverb/room decay,
    # NOT a proper RT60 measurement (that needs an impulse response).
    tail_env = rms[onset_frames[-1]:] if onset_frames.size else rms
    if tail_env.size * frame_s > 0.1:
        peak_idx = int(np.argmax(tail_env))
        below = np.flatnonzero(tail_env[peak_idx:] < tail_env[peak_idx] * 10 ** (-30 / 20))
        frames = below[0] if below.size else tail_env.size - peak_idx
        estimated_reverb_tail_s = min(float(frames * frame_s), 4.0)
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
        centroid_hz=centroid_hz,
        rolloff_hz=rolloff_hz,
        rms_db=rms_db,
        onset_strength=onset_strength,
        decay_db_per_s=decay_db_per_s,
        harmonic_percussive_ratio=harmonic_percussive_ratio,
        thd_estimate=thd_estimate,
    )
