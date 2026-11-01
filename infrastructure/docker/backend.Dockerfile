FROM python:3.14-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY backend/requirements.lock .
RUN pip install --no-cache-dir -r requirements.lock && useradd --create-home --uid 10001 app
COPY --chown=app:app backend/ .
RUN mkdir -p media staticfiles private_exports && chown -R app:app media staticfiles private_exports
USER app
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/v1/health/',timeout=4)"
CMD ["gunicorn","config.wsgi:application","--bind","0.0.0.0:8000","--workers","3","--threads","2","--timeout","60","--access-logfile","-"]
