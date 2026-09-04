# Stage 1
FROM python:3.6-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN apt-get update 
RUN apt-get install -y --no-install-recommends gcc libpq-dev
RUN pip install -r requirements.txt 

# Stage 2
FROM python:3.6-slim
RUN apt-get update && apt-get install -y libpq5 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /usr/local/lib/python3.6/site-packages /usr/local/lib/python3.6/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
COPY . . 
RUN chmod +x /app/backend-container-entrypoint.sh
EXPOSE 8000
ENTRYPOINT [ "/bin/sh", "-c", "/app/backend-container-entrypoint.sh"]