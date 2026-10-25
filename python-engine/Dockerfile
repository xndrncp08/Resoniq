FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY main.py .

# librosa's numba kernels are compiled with cache=True. site-packages isn't
# writable for this user and a --system user has no home directory, so
# without a cache dir every librosa import fails with "no locator available".
# NUMBA_CPU_NAME=generic makes that cache portable, so kernels compiled while
# building the image are reused on whatever CPU runs it. MALLOC_ARENA_MAX
# keeps glibc from holding freed analysis buffers in per-thread arenas.
ENV NUMBA_CACHE_DIR=/app/numba-cache \
    NUMBA_CPU_NAME=generic \
    MALLOC_ARENA_MAX=2
RUN useradd --system --uid 1001 engine && mkdir -p /app/numba-cache && chown engine /app/numba-cache
USER engine
# Compile the kernels now. Measured locally: startup warm-up 9.2 s / 434 MB
# when compiling vs 2.0 s / 260 MB loading this cache. On a shared free-tier
# CPU, compiling was most of a ~4 minute cold start and most of its memory.
RUN python -c "import main; main.warm_up()"

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
