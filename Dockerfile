# Base image: Debian with Python 3.14, matching requires-python in pyproject.toml.
# "slim" leaves out compilers and docs, so the image is much smaller.
FROM python:3.14-slim

# Copy the uv program from uv's official image into /bin, so we can run `uv`.
# Use the same version as `uv --version` on your laptop.
COPY --from=ghcr.io/astral-sh/uv:0.11.30 /uv /uvx /bin/

# Settings for uv and Python inside the container:
#   UV_COMPILE_BYTECODE=1  precompile .pyc files, so the app starts faster
#   UV_LINK_MODE=copy      copy packages into the venv, needed inside Docker
#   UV_PYTHON_DOWNLOADS=never  use the image's Python, never download another
#   UV_NO_PROGRESS=1       no progress bars cluttering the build log
#   PYTHONUNBUFFERED=1     print logs immediately, so `docker logs` shows them live
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    UV_NO_PROGRESS=1 \
    PYTHONUNBUFFERED=1

# Every following command runs inside /app in the image.
WORKDIR /app

# Install dependencies BEFORE copying your code. Docker caches each step,
# so when you only change code, this slow step is reused instead of rerun.
# --locked: install exactly what's in uv.lock, and fail if it's out of date with pyproject.toml
# --no-install-project: install only the libraries, not your project itself
# --no-dev: skip development-only packages
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-install-project --no-dev

# Copy only the folders the app needs to run.
COPY app ./app
COPY static ./static
COPY templates ./templates

# Create a normal user so the app doesn't run as root (safer if it's ever compromised),
# and create the folders for the audit database and uploads, owned by that user.
RUN useradd --create-home appuser \
    && mkdir -p /app/data /app/uploads \
    && chown -R appuser:appuser /app/data /app/uploads
USER appuser

# Put the venv's programs (uvicorn, python) first on PATH, so `uvicorn` runs from the venv.
ENV PATH="/app/.venv/bin:$PATH"

# Documents that the app listens on port 8000. It doesn't open the port by itself.
EXPOSE 8000

# The command that runs when the container starts.
# --host 0.0.0.0 makes the server reachable from outside the container; 127.0.0.1 wouldn't be.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]