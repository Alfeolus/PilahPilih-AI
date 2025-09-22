# ---- TAHAP 1: BUILDER ----
FROM python:3.10-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y libgl1 libglib2.0-0
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip pip wheel --default-timeout=600 --wheel-dir /wheels -r requirements.txt

# ---- TAHAP 2: FINAL ----
FROM python:3.10-slim
WORKDIR /app
RUN apt-get update && apt-get install -y libgl1 libglib2.0-0
COPY --from=builder /wheels /wheels
COPY --from=builder /app/requirements.txt .

# PERUBAHAN KUNCI: Menjadikan satu baris untuk menghindari error tersembunyi
RUN pip install --no-cache-dir --no-index --find-links=/wheels -r requirements.txt && rm -rf /wheels /app/requirements.txt

COPY . .
EXPOSE 8000
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--timeout", "300", "main:app"]