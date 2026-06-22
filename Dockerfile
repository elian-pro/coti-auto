# syntax=docker/dockerfile:1.7
#
# Imagen unificada: Next.js (dashboard) + FastAPI (Zebra API builder)
# Un solo contenedor, dos procesos:
#   - uvicorn  → 0.0.0.0:8080  (Python builder)
#   - node     → 0.0.0.0:3000  (Next.js)
# El dashboard llama al builder vía http://127.0.0.1:8080 (sin salto de red).

# -----------------------------------------------------------------------------
# 1. Node deps (cacheable)
# -----------------------------------------------------------------------------
FROM node:20-bookworm-slim AS node-deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi

# -----------------------------------------------------------------------------
# 2. Next.js build
# -----------------------------------------------------------------------------
FROM node:20-bookworm-slim AS node-build
WORKDIR /app
ARG BUILD_TAG=unversioned
ENV BUILD_TAG=${BUILD_TAG}
ENV NEXT_PUBLIC_BUILD_TAG=${BUILD_TAG}
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=node-deps /app/node_modules ./node_modules
COPY . .
RUN echo "Building dashboard with BUILD_TAG=${BUILD_TAG}" && npm run build

# -----------------------------------------------------------------------------
# 3. Runtime — Node 20 + Python 3 con FastAPI
# -----------------------------------------------------------------------------
FROM node:20-bookworm-slim AS runner
WORKDIR /app

ARG BUILD_TAG=unversioned
ENV BUILD_TAG=${BUILD_TAG}
ENV NEXT_PUBLIC_BUILD_TAG=${BUILD_TAG}
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV ZEBRA_API_URL=http://127.0.0.1:8080
ENV ZEBRA_OUTPUT_DIR=/tmp/zebra

# Sistema: Python + libs nativas que necesita python-docx / openpyxl / lxml
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
       python3 python3-venv python3-pip \
       libxml2 libxslt1.1 \
       ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Virtualenv para los deps Python (Debian 12 bloquea pip al sistema por PEP 668)
ENV VIRTUAL_ENV=/opt/pyenv
RUN python3 -m venv "$VIRTUAL_ENV"
ENV PATH="$VIRTUAL_ENV/bin:${PATH}"

COPY services/zebra-api/requirements.txt /tmp/req.txt
RUN pip install --no-cache-dir --upgrade pip \
  && pip install --no-cache-dir -r /tmp/req.txt \
  && python -c "import fastapi, uvicorn, docx, openpyxl; print('python deps ok')"

# Usuario no-root
RUN groupadd --system --gid 1001 nodejs \
  && useradd  --system --uid 1001 --gid 1001 --home-dir /app nextjs

# Next.js standalone
COPY --from=node-build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=node-build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=node-build --chown=nextjs:nodejs /app/public ./public

# Python service (vive en /app/python para que uvicorn lo encuentre)
COPY --chown=nextjs:nodejs services/zebra-api/ ./python/

# Script de arranque (lanza ambos procesos; si uno muere, el contenedor sale)
COPY --chown=nextjs:nodejs scripts/start.sh ./start.sh
RUN chmod +x ./start.sh

# Directorio de outputs del builder
RUN mkdir -p /tmp/zebra && chown -R nextjs:nodejs /tmp/zebra

USER nextjs
EXPOSE 3000 8080

CMD ["./start.sh"]
