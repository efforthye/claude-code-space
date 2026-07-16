FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Install deps first for better layer caching.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Media root for the local storage backend (ADR 0004). Mount a volume here in
# production so generated media survives container restarts.
RUN mkdir -p /data/media
ENV MAYO_STORAGE_LOCAL_PATH=/data/media

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
