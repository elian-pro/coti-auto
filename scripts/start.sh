#!/bin/sh
# Lanza Next.js + uvicorn dentro del mismo contenedor.
# Si cualquiera de los dos procesos muere, salimos con su exit code para que
# Docker / EasyPanel reinicie el contenedor entero.

set -e

echo "[coti-auto] starting build ${BUILD_TAG:-unversioned}"
echo "[coti-auto] node     -> 0.0.0.0:${PORT:-3000}"
echo "[coti-auto] uvicorn  -> 0.0.0.0:8080 (cwd=/app/python)"

# Python builder
(
  cd /app/python
  exec uvicorn zebra_api:app --host 0.0.0.0 --port 8080 --log-level info
) &
PY_PID=$!

# Next.js standalone
node /app/server.js &
NODE_PID=$!

# Espera al primero que termine. POSIX `wait -n` evita race conditions.
wait -n "$PY_PID" "$NODE_PID"
EXIT_CODE=$?

echo "[coti-auto] one process exited with code $EXIT_CODE; tearing down siblings"
kill -TERM "$PY_PID" "$NODE_PID" 2>/dev/null || true
wait "$PY_PID" "$NODE_PID" 2>/dev/null || true

exit $EXIT_CODE
