# Coti Auto · Zebra Monorepo

Dashboard (Next.js 15 + Tailwind) + microservicio builder (FastAPI + python-docx +
openpyxl) en un **mismo repo y un mismo contenedor**. Pensado para EasyPanel.

```
coti-auto/
├── app/, components/, lib/, prompts/      ← Next.js (Coti Auto)
├── services/zebra-api/                    ← Python FastAPI (Zebra API)
│   ├── zebra_api.py
│   ├── zebra_proposal_builder.py
│   ├── zebra_investment_calc.py
│   ├── zebra_excel_annex.py
│   ├── requirements.txt
│   └── zebra_logo.png
├── scripts/start.sh                       ← lanza uvicorn (:8080) + node (:3000)
└── Dockerfile                             ← Node 20 + Python 3 multi-stage
```

## Cómo corre el contenedor

Un solo contenedor con dos procesos:

- `uvicorn zebra_api:app` en `0.0.0.0:8080` (Python builder).
- `node server.js` (Next.js standalone) en `0.0.0.0:3000`.

El dashboard llama al builder vía `http://127.0.0.1:8080` (sin salto de red).
Si cualquiera de los dos procesos muere, `start.sh` mata al otro y el contenedor
sale con su exit code → EasyPanel/Docker reinicia limpio.

## Endpoints

| Ruta | Servicio | Estado | Qué hace |
|---|---|---|---|
| `POST /api/quote` | Next.js | Producción | Proxy al webhook de n8n. Devuelve `docs_url`, opcional `sheets_url`, `pdf_url`. |
| `POST /api/quote-direct` | Next.js | **Fase 2 (en pruebas)** | Hace todo en código: baja la transcripción, llama a Claude con prompt v3.2 cacheado, valida JSON, llama al builder local, devuelve DOCX (+ XLSX si aplica) en base64. |
| `GET  /api/health` | Next.js | Producción | `{ "status": "ok" }`. |
| `POST :8080/generate` | FastAPI | Producción | Recibe `proposal_data`, devuelve DOCX. Auth opcional vía `X-API-Key`. |
| `POST :8080/generate-excel` | FastAPI | Producción | Recibe `proposal_data` con `calculadora_inputs`, devuelve XLSX. |
| `GET  :8080/health` | FastAPI | Producción | Healthcheck del builder. |

## Variables de entorno

### Next.js (dashboard)

| Variable | Default | Notas |
|---|---|---|
| `N8N_WEBHOOK_URL` | (el actual) | URL del webhook de n8n. Usado por `/api/quote` (legacy). |
| `WEBHOOK_TIMEOUT_MS` | `300000` | Timeout esperando a n8n. |
| `ANTHROPIC_API_KEY` | _(sin default)_ | Clave de Anthropic. Necesaria para `/api/quote-direct`. |
| `ANTHROPIC_MODEL` | `claude-opus-4-7` | Modelo de Claude. |
| `ANTHROPIC_MAX_TOKENS` | `16000` | Tope de tokens de salida. |
| `ZEBRA_API_URL` | `http://127.0.0.1:8080` | Host del builder. Default = mismo contenedor. |
| `ZEBRA_API_TIMEOUT_MS` | `60000` | Timeout del builder. |
| `ZEBRA_API_KEY` | _(opcional)_ | Si se setea, se envía como `X-API-Key`. |
| `NEXT_PUBLIC_DRIVE_FOLDER_URL` | la carpeta de Drive | Botón "Carpeta" del header. |
| `BUILD_TAG` / `NEXT_PUBLIC_BUILD_TAG` | `dev` | Tag visible en el footer. |

### FastAPI (builder, en el mismo contenedor)

| Variable | Default | Notas |
|---|---|---|
| `ZEBRA_OUTPUT_DIR` | `/tmp/zebra` | Dónde guarda DOCX/XLSX antes de servirlos. |
| `ZEBRA_API_KEY` | _(opcional)_ | Si se setea, el endpoint exige `X-API-Key` que coincida. |

## Desarrollo local

### Solo el dashboard (más rápido)

```bash
cp .env.example .env.local
npm install
npm run dev          # http://localhost:3000
```

`/api/quote-direct` necesitará un builder corriendo en `ZEBRA_API_URL`. En dev
lo más simple es correr el Python en paralelo:

### Builder en paralelo

```bash
cd services/zebra-api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn zebra_api:app --reload --port 8080
```

### Todo unificado en Docker

```bash
docker build -t coti-auto .
docker run --rm -p 3000:3000 -p 8080:8080 \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  coti-auto
```

## Despliegue en EasyPanel (modo unificado, recomendado)

1. **Una sola App** tipo *Dockerfile*, apuntando a este repo, rama
   `claude/zebra-quotes-dashboard-j8Pvj`.
2. **Build path:** `/` (raíz).
3. **Domains/Proxy:** publica el puerto **3000** (el dashboard).
4. **Environment:** al menos `ANTHROPIC_API_KEY`. Opcionalmente `ZEBRA_API_KEY`
   si quieres autenticar el builder interno.
5. **(Opcional)** si quieres que `n8n` también pueda llamar al builder:
   publica el puerto **8080** con su propio dominio. Sin esto, el builder solo
   es accesible desde el mismo contenedor.
6. **Implementar** (no Restart). Una vez verde, puedes apagar el servicio
   standalone `zebra-api` viejo si quedaba aparte.

## Migración n8n → código (Fase 2)

El endpoint `/api/quote-direct` ya implementa los pasos 1-7 del flujo n8n:

- Descarga la transcripción del Doc.
- Llama a Claude con el prompt v3.2 cacheado.
- Valida con zod (rechaza JSON mal formado con `422 + schema_issues`).
- Llama al builder local.
- Devuelve los binarios.

Lo que falta para apagar n8n:

- Subida a Drive con cuenta de servicio (Fase 2.1).
- Log en Supabase (Fase 2.2).
- Wiring del frontend para usar `/api/quote-direct` por default.

## Cómo probar `/api/quote-direct`

```bash
curl -sS http://localhost:3000/api/quote-direct \
  -H 'content-type: application/json' \
  -d '{"account":"Floresta Salvia","meeting_url":"https://docs.google.com/document/d/<ID>/edit"}' \
  | jq '{status, slug, docx: .docx.filename, xlsx: .xlsx.filename, usage}'
```

Para guardar el DOCX:

```bash
curl -sS ... | jq -r '.docx.base64' | base64 -d > cotizacion.docx
```

Errores claros que puede devolver:

- `400 stage=parse_url` → la URL no es un Google Doc reconocible.
- `400 stage=fetch` → el Doc no está compartido como "cualquiera con el link".
- `422 stage=schema_validate` → Claude rompió el esquema; el body trae
  `schema_issues` con los campos que fallaron.
- `502 Claude falló` → cualquier error de Anthropic.
- `502 Builder falló` → uvicorn no respondió en `ZEBRA_API_URL`.
