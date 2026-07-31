FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONPATH=/app/backend

WORKDIR /app

RUN addgroup --system domix \
    && adduser --system --ingroup domix domix \
    && python -m pip install --upgrade pip \
    && python -m pip install "psycopg[binary]>=3.2,<4" "bcrypt>=4.2,<5"

COPY backend ./backend

RUN chown -R domix:domix /app

USER domix
EXPOSE 8000

HEALTHCHECK --interval=20s --timeout=5s --start-period=20s --retries=5 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=3)" || exit 1

CMD ["python", "backend/server.py", "--host", "0.0.0.0", "--port", "8000"]
