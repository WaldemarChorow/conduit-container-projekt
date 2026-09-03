# Conduit Container

Description:
In this project, you'll learn how to containerize a full-stack web application consisting of a Django backend and a corresponding Angular client. The container setup can be executed using `docker-compose.yaml` to simplify container management.

## Project Purpose

In this project, users will learn how to containerize legacy projects to keep them running.

The application is fully containerized and executable with Compose — the whole stack can be started with a single `docker compose up -d`.

This task demonstrates the challenges a DevSecOps engineer might face in their daily work, such as running a legacy Django project (built for Python 3.6 / Django 1.10) inside a modern container setup, and wiring together a database, a backend and a frontend so they can talk to each other reliably.

## Table of Contents

- [Description](#conduit-container)
- [Project Purpose](#project-purpose)
- [Repository Structure](#repository-structure)
- [Quickstart](#quickstart)
  - [Prerequisites](#prerequisites)
  - [Steps](#steps)
- [Usage](#usage)
  - [Environment Variables](#environment-variables)
  - [Ports](#ports)
  - [Rebuilding After Changes](#rebuilding-after-changes)
  - [Persisting Data](#persisting-data)
  - [Viewing and Saving Logs](#viewing-and-saving-logs)
- [Testing / Verification](#testing--verification)
- [Known Issues](#known-issues)

## Repository Structure

```
.
├── conduit-backend/         # Django REST API (Python 3.6, Gunicorn, PostgreSQL)
│   ├── Dockerfile           # Multi-stage build (builder + runtime)
│   ├── backend-container-entrypoint.sh
│   └── ...
├── conduit-frontend/        # Angular 17 client, served by nginx
│   ├── Dockerfile           # Multi-stage build (node builder + nginx runtime)
│   ├── nginx.conf           # Serves the app and reverse-proxies /api to the backend
│   └── ...
├── docker-compose.yaml      # Wires up db, backend and frontend
├── .env.example              # Template for the required environment variables
└── README.md
```

## Quickstart

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (or a Docker-compatible runtime such as [OrbStack](https://orbstack.dev/) on macOS)
- Docker Compose v2 (bundled with modern Docker installs — check with `docker compose version`)
- `git`, to clone this repository

You do **not** need to install Python, Node.js, Angular CLI or PostgreSQL locally — everything runs inside containers.

### Steps

1. Clone the repository:
   ```bash
   git clone <this-repository-url>
   cd conduit-container-project
   ```

2. Create your own `.env` file from the provided template:
   ```bash
   cp .env.example .env
   ```
   Open `.env` and adjust the values if needed (see [Environment Variables](#environment-variables) below). The defaults work out of the box for a local test run.

3. Build and start all three containers (database, backend, frontend):
   ```bash
   docker compose up --build -d
   ```
   The first run will take a while, since it needs to build both images and download the PostgreSQL image. Subsequent starts are much faster.

4. Check that all three containers are running:
   ```bash
   docker compose ps
   ```
   You should see `postgres_db`, `conduit-backend` and `conduit-frontend`, all `Up`.

5. Open the app in your browser:
   ```
   http://localhost:8080
   ```
   You should see the Conduit homepage. It will show "No articles are here... yet." — that's expected, the database starts empty. Sign up for an account to try writing an article.

6. To stop everything:
   ```bash
   docker compose down
   ```
   (Add `-v` if you also want to delete the database volume and start fresh next time — see [Persisting Data](#persisting-data).)

## Usage

### Environment Variables

All configuration is passed via environment variables, read from the `.env` file in the project root (never commit your real `.env` — only `.env.example` is tracked in git). Docker Compose reads `.env` automatically as long as it sits next to `docker-compose.yaml`.

| Variable            | Used by         | Description                                                                                     | Example                |
|----------------------|-----------------|---------------------------------------------------------------------------------------------------|-------------------------|
| `POSTGRES_DB`        | db, backend     | Name of the PostgreSQL database to create/use.                                                    | `conduit_database`      |
| `POSTGRES_USER`      | db, backend     | PostgreSQL username.                                                                               | `myuser`                |
| `POSTGRES_PASSWORD`  | db, backend     | PostgreSQL password. Change this for anything beyond local testing.                                | `changeme`               |
| `SECRET_KEY_DB`      | backend         | Django's `SECRET_KEY`, used for cryptographic signing (sessions, CSRF tokens, etc.). Use a long, random value in production. | `mysecretkey`            |
| `DEBUG_VALUE`        | backend         | Set to `True` to enable Django's debug mode (verbose error pages). **Must be `False` in production.** | `True`                  |
| `DJANGO_PORT`        | backend         | Host port the backend is published on (maps to container port 8000).                              | `8000`                  |
| `ALLOWED_HOSTS_DB`   | backend         | Comma-separated list of hostnames Django will accept requests for (Django's `ALLOWED_HOSTS`). Must include the backend's service name (`conduit-backend`, as used by nginx) and `localhost` (for direct access). | `conduit-backend,localhost` |

`HOST_DB` and `PORT_DB` (the database host/port the backend connects to) are **not** part of `.env` — they are hardcoded in `docker-compose.yaml` (`HOST_DB: db`, `PORT_DB: 5432`) because they describe the internal container network, not something a user should need to change. `db` is the service name of the PostgreSQL container; Docker Compose automatically makes it resolvable as a hostname from the other containers.

### Ports

| Service            | Container port | Host port           | URL                          |
|---------------------|-----------------|----------------------|-------------------------------|
| `conduit-frontend`  | 80 (nginx)      | `8080`               | http://localhost:8080         |
| `conduit-backend`   | 8000 (Gunicorn) | `${DJANGO_PORT}`     | http://localhost:8000         |
| `db` (PostgreSQL)   | 5432            | not published        | only reachable from other containers |

To change the frontend's host port, edit the `ports:` line under `conduit-frontend` in `docker-compose.yaml` (e.g. `"9090:80"`). To change the backend's host port, just change `DJANGO_PORT` in `.env` — no need to touch `docker-compose.yaml`.

The frontend serves the compiled Angular app and forwards every request starting with `/api` to the backend container (see `conduit-frontend/nginx.conf`). This means the browser always talks to a single host (`localhost:8080`), which also works unchanged once the app is deployed to a real server.

### Rebuilding After Changes

- If you only change values in `.env` or `docker-compose.yaml`, a restart is enough:
  ```bash
  docker compose up -d
  ```
- If you change any file that gets copied into an image (backend Python code, `requirements.txt`, frontend source code, either `Dockerfile`, `nginx.conf`, the entrypoint script), you **must** rebuild, otherwise the container keeps running the old code:
  ```bash
  docker compose up --build -d
  ```

### Persisting Data

PostgreSQL data is stored in a named Docker volume (`postgres_data`), defined at the bottom of `docker-compose.yaml`. This means your database survives `docker compose down` and container restarts — the data lives on your machine's disk, independent of the container's lifecycle.

To wipe the database completely and start fresh:
```bash
docker compose down -v
```
The `-v` flag also removes the named volume.

### Viewing and Saving Logs

To follow logs live:
```bash
docker compose logs -f conduit-backend
```
(replace `conduit-backend` with `conduit-frontend` or `postgres_db` as needed, or omit the service name to see all of them).

To save a container's logs to a file for later inspection:
```bash
docker logs conduit-backend > backend-logs.txt
```

All three services are configured with `restart: unless-stopped`, so if a container crashes it will be restarted automatically by Docker.

## Testing / Verification

Before considering the setup done, verify the following:

1. **The frontend is reachable.**
   ```bash
   curl -I http://localhost:8080
   ```
   Expect `HTTP/1.1 200 OK`. Opening `http://localhost:8080` in a browser should show the Conduit homepage.

2. **The backend serves real data through the frontend's reverse proxy**, not just directly.
   ```bash
   curl http://localhost:8080/api/articles
   ```
   Expect a JSON response like `{"articles": [], "articlesCount": 0}` — this confirms nginx is correctly forwarding `/api` requests to the backend container.

3. **The backend runs a production WSGI server, not Django's dev server.**
   ```bash
   docker compose logs conduit-backend | grep -i gunicorn
   ```
   You should see lines like `Starting gunicorn` and `Listening at: http://0.0.0.0:8000`. There should be no mention of `Watching for file changes` (that would indicate `manage.py runserver`, which this project intentionally avoids).

4. **Data actually loads when navigating the app.** In the browser, sign up for an account, create an article, and confirm it shows up on the homepage and in your profile. Open the browser's DevTools → Network tab while doing this to see the underlying `/api/...` requests succeed with `200`/`201` status codes.

5. **Containers restart automatically after a crash.** All services are configured with `restart: unless-stopped`. This means Docker restarts a container on its own if the process inside it exits unexpectedly (e.g. Gunicorn crashing due to a bug). It does **not** restart a container that was deliberately stopped by a human or a tool (`docker stop` / `docker kill`) — that distinction is exactly what "unless stopped" means. In other words: running `docker kill conduit-backend` is expected to leave it stopped (`docker compose ps` will simply not list it as running), and that is correct, intended behavior, not something to "fix" by restarting it manually.

6. **Data survives a restart.** Create an article, then run `docker compose down` followed by `docker compose up -d` (without `-v`, so the volume is kept). The article should still be there — confirming the PostgreSQL volume is working (see [Persisting Data](#persisting-data)).

## Known Issues

- `conduit-frontend/src/index.html` references an external stylesheet (`//demo.productionready.io/main.css`) from the original RealWorld demo project. This external resource currently returns a 404 and is unrelated to this project's own backend/frontend/database setup — it only affects some of the original demo's base styling, not the app's functionality (API calls, routing, articles, etc. all work independently of it).
