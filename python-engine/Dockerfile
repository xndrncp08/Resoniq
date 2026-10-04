FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY main.py .

RUN useradd --system --uid 1001 engine
# librosa's numba kernels are compiled with cache=True. site-packages isn't
# writable for this user and a --system user has no home directory, so
# without a cache dir every librosa import fails with "no locator available".
ENV NUMBA_CACHE_DIR=/tmp/numba-cache
USER engine

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
