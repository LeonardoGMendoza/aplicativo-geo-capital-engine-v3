# API do Omni-EcoRescue (FastAPI). Contexto do build: a pasta backend/api.
FROM python:3.14-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements-lock.txt /tmp/requirements-lock.txt
RUN pip install --no-cache-dir -r /tmp/requirements-lock.txt
# O código importa como pacote backend.api (main.py usa imports relativos)
COPY . /app/backend/api
RUN useradd --system --no-create-home omni && chown -R omni /app
USER omni
EXPOSE 8000
CMD ["uvicorn", "backend.api.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
