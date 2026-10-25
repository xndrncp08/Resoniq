"""
Where a recording's sound changes.

One streaming pass reads the file in one-second blocks (memory stays flat
however long it is) and measures each second: loudness, spectral centroid,
low/mid/high band balance and spectral flatness. Those per-second numbers
are the timeline the app draws, and they're also how sections are found:

1. Novelty: compare the few seconds before each moment with the few after
   (z-scored features); peaks mark changes in level or tone colour.
2. Boundaries at the strongest peaks, at least MIN_SECTION_S apart.
3. Sections that sound alike are grouped into up to MAX_TYPES "types"
   (A, B, C, D), so a song with alternating clean verses and driven choruses
   gets two types, not eight sections each analysed separately.

This finds changes in the overall sound of the mix. It doesn't know what a
verse or a solo is, and it can't hear the guitar apart from the band.
"""

from dataclasses import dataclass, field

import numpy as np
import soundfile as sf

MIN_SECTION_S = 12
MAX_SECTIONS = 10
MAX_TYPES = 4
NOVELTY_HALF_S = 6
TIMELINE_POINTS = 600

BANDS = ((20, 250), (250, 2000), (2000, 11000))
FEATURES = ("rms_db", "centroid_hz", "low_db", "mid_db", "high_db", "flatness_db")


@dataclass
class Scan:
    seconds: np.ndarray  # (n, len(FEATURES)) one row per second
    sample_rate: int


@dataclass
class Section:
    start_s: float
    end_s: float
    type: str = "A"
    character: dict = field(default_factory=dict)


def _db(x: float) -> float:
    return float(10 * np.log10(max(x, 1e-12)))


def scan(audio: bytes | bytearray) -> Scan | None:
    """Per-second measurements over the whole file, streamed. None if libsndfile can't stream it."""
    rows = []
    try:
        with sf.SoundFile(__import__("io").BytesIO(audio)) as f:
            sr = f.samplerate
            freqs = np.fft.rfftfreq(sr, 1 / sr)
            masks = [(freqs >= lo) & (freqs < hi) for lo, hi in BANDS]
            window = np.hanning(sr).astype(np.float32)
            for block in f.blocks(blocksize=sr, dtype="float32", always_2d=True):
                y = block.mean(axis=1)
                if y.size < sr // 4:
                    break
                if y.size < sr:
                    y = np.pad(y, (0, sr - y.size))
                power = np.abs(np.fft.rfft(y * window)) ** 2
                total = float(power.sum()) + 1e-12
                ms = float(np.mean(y * y))
                active = power[1:] + 1e-12
                flat = float(np.exp(np.mean(np.log(active))) / np.mean(active))
                rows.append((
                    _db(ms),
                    float((freqs * power).sum() / total),
                    *(_db(float(power[m].sum()) / total) for m in masks),
                    _db(flat),
                ))
    except Exception:
        return None
    if not rows:
        return None
    return Scan(seconds=np.array(rows, dtype=np.float64), sample_rate=sr)


def _smooth(x: np.ndarray, width: int) -> np.ndarray:
    if x.shape[0] < width:
        return x
    k = np.ones(width) / width
    return np.stack([np.convolve(x[:, j], k, mode="same") for j in range(x.shape[1])], axis=1)


def _zscore(x: np.ndarray) -> np.ndarray:
    sd = x.std(axis=0)
    return (x - x.mean(axis=0)) / np.where(sd < 1e-9, 1, sd)


def novelty(z: np.ndarray, half: int = NOVELTY_HALF_S) -> np.ndarray:
    """How different the `half` seconds after each moment are from the `half` before."""
    n = z.shape[0]
    out = np.zeros(n)
    for t in range(half, n - half):
        out[t] = float(np.linalg.norm(z[t:t + half].mean(axis=0) - z[t - half:t].mean(axis=0)))
    return out


def boundaries(nov: np.ndarray, min_gap: int = MIN_SECTION_S, limit: int = MAX_SECTIONS - 1) -> list[int]:
    """The strongest novelty peaks, at least `min_gap` apart and from the ends."""
    n = nov.size
    if n < 2 * min_gap:
        return []
    threshold = float(nov.mean() + 0.6 * nov.std())
    peaks = [t for t in range(1, n - 1) if nov[t] >= threshold and nov[t] >= nov[t - 1] and nov[t] >= nov[t + 1]]
    chosen: list[int] = []
    for t in sorted(peaks, key=lambda t: -nov[t]):
        if t < min_gap or n - t < min_gap or any(abs(t - c) < min_gap for c in chosen):
            continue
        chosen.append(t)
        if len(chosen) >= limit:
            break
    return sorted(chosen)


def _character(rows: np.ndarray) -> dict:
    loud = rows[:, 0] > rows[:, 0].max() - 20 if rows.size else rows[:, 0] == rows[:, 0]
    use = rows[loud] if loud.any() else rows
    return {k: round(float(np.median(use[:, i])), 2) for i, k in enumerate(FEATURES)}


def sections(sc: Scan) -> list[Section]:
    """Sections with a sound type each (A = the type covering the most time)."""
    x = sc.seconds
    n = x.shape[0]
    if n < 2 * MIN_SECTION_S:
        return [Section(0, float(n), "A", _character(x))]
    z = _zscore(_smooth(x, 3))
    cuts = [0, *boundaries(novelty(z)), n]
    secs = [Section(float(a), float(b)) for a, b in zip(cuts, cuts[1:], strict=False)]
    means = [z[int(s.start_s):int(s.end_s)].mean(axis=0) for s in secs]

    # Group alike sections: greedy, joining the nearest existing type within reach.
    reach = 1.2
    centres: list[np.ndarray] = []
    weights: list[float] = []
    labels: list[int] = []
    for m, s in zip(means, secs, strict=True):
        d = [float(np.linalg.norm(m - c)) for c in centres]
        if d and min(d) < reach:
            k = int(np.argmin(d))
            w = s.end_s - s.start_s
            centres[k] = (centres[k] * weights[k] + m * w) / (weights[k] + w)
            weights[k] += w
        else:
            centres.append(m.copy())
            weights.append(s.end_s - s.start_s)
            k = len(centres) - 1
        labels.append(k)
    # Too many types: fold the smallest into its nearest neighbour.
    while len(set(labels)) > MAX_TYPES:
        live = sorted(set(labels), key=lambda k: sum(s.end_s - s.start_s for s, lab in zip(secs, labels, strict=True) if lab == k))
        small = live[0]
        others = [k for k in live if k != small]
        nearest = min(others, key=lambda k: float(np.linalg.norm(centres[k] - centres[small])))
        labels = [nearest if lab == small else lab for lab in labels]

    # Letters by total time: A is the main sound of the recording.
    order = sorted(set(labels), key=lambda k: -sum(s.end_s - s.start_s for s, lab in zip(secs, labels, strict=True) if lab == k))
    letter = {k: "ABCD"[i] for i, k in enumerate(order)}
    merged: list[Section] = []
    for s, lab in zip(secs, labels, strict=True):
        if merged and merged[-1].type == letter[lab]:
            merged[-1].end_s = s.end_s
        else:
            merged.append(Section(s.start_s, s.end_s, letter[lab]))
    for s in merged:
        s.character = _character(x[int(s.start_s):int(s.end_s)])
    return merged


def representative(secs: list[Section], kind: str, length: float, sc: Scan) -> tuple[float, float]:
    """The loudest `length` seconds inside the longest section of a type: where its sound is clearest."""
    s = max((s for s in secs if s.type == kind), key=lambda s: s.end_s - s.start_s)
    span = s.end_s - s.start_s
    if span <= length:
        return s.start_s, span
    rms = sc.seconds[int(s.start_s):int(s.end_s), 0]
    energy = np.convolve(10 ** (rms / 10), np.ones(int(length)), mode="valid")
    start = s.start_s + float(np.argmax(energy))
    return start, length


def reference(secs: list[Section]) -> dict:
    """What "loud" or "bright" is judged against: the average of the sections, so the words describe contrast."""
    return {k: float(np.mean([s.character[k] for s in secs])) for k in FEATURES}


def describe(character: dict, song: dict) -> list[str]:
    """Plain words for a section's sound relative to the others (measurements, not guesses)."""
    words = []
    level = character["rms_db"] - song["rms_db"]
    words.append("loud" if level > 2.5 else "quiet" if level < -4 else "mid-level")
    bright = character["centroid_hz"] / max(song["centroid_hz"], 1)
    words.append("bright" if bright > 1.15 else "dark" if bright < 0.85 else "balanced")
    flat = character["flatness_db"] - song["flatness_db"]
    if flat > 2.5:
        words.append("dense or saturated")
    elif flat < -3:
        words.append("clean or sparse")
    if character["low_db"] - song["low_db"] > 2:
        words.append("bass-heavy")
    return words


def timeline(sc: Scan) -> dict:
    """The per-second measurements, thinned to at most TIMELINE_POINTS for drawing."""
    n = sc.seconds.shape[0]
    step = max(1, int(np.ceil(n / TIMELINE_POINTS)))
    thinned = sc.seconds[: n - n % step].reshape(-1, step, len(FEATURES)).mean(axis=1) if n >= step else sc.seconds
    if n % step:
        thinned = np.vstack([thinned, sc.seconds[n - n % step:].mean(axis=0, keepdims=True)])
    return {"step_s": float(step), **{k: [round(float(v), 1) for v in thinned[:, i]] for i, k in enumerate(FEATURES)}}
