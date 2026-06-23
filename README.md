# Coti Auto · Zebra

Dashboard de cotizaciones automáticas para Zebra. **Todo en un solo
contenedor**: Next.js (UI + orquestación) + FastAPI (builder DOCX/XLSX) +
Google Drive directo. **Sin n8n. Sin Supabase.**

```
coti-auto/
├── app/, components/, lib/, prompts/      ← Next.js (dashboard + orquestador)
├── services/zebra-api/                    ← Python FastAPI (builder)
│   ├── zebra_api.py
│   ├── zebra_proposal_builder.py
│   ├── zebra_investment_calc.py
│   ├── zebra_excel_annex.py
│   └── requirements.txt
├── scripts/start.sh                       ← lanza uvicorn (:8080) + node (:3000)
└── Dockerfile                             ← Node 20 + Python 3 multi-stage
```

## Flujo end-to-end

```
Formulario web
   │  POST /api/quote-direct { account, meeting_url }
   ▼
1. Descargar Google Doc como texto (cuenta de servicio o export público)
2. Llamar a Claude (prompt v3.2 cacheado en system) → JSON
3. Validar JSON con schema zod (proposal_data o diagnostico_preliminar)
4. Llamar al builder Python local (127.0.0.1:8080) → DOCX (+ XLSX si aplica)
5. Subir a Drive con la SA → Google Doc + Google Sheet, share público
6. Devolver { docs_url, sheets_url, pdf_url } al frontend
```

## Endpoints

| Ruta | Qué hace |
|---|---|
| `POST /api/quote-direct` | Flujo completo. Devuelve `{ docs_url, sheets_url?, pdf_url }`. |
| `POST /api/quote` | Alias retro-compatible: re-emite a `/api/quote-direct`. |
| `GET  /api/health` | `{ "status": "ok" }`. |
| `POST :8080/generate` | Builder Python directo (uso interno). |
| `POST :8080/generate-excel` | Builder Python directo (uso interno). |

## Variables de entorno

### Obligatorias

| Variable | Para qué |
|---|---|
| `ANTHROPIC_API_KEY` | Clave de Anthropic. |
| `GOOGLE_SA_JSON` | JSON completo de la cuenta de servicio (1 línea, escapes en `private_key`). |

### Recomendadas

| Variable | Default | Notas |
|---|---|---|
| `DRIVE_FOLDER_ID` | `1d7Uj4dMx4USMNum-lkD_2w33OAeQgkCD` | ID de la carpeta de Drive de cotizaciones. |
| `ANTHROPIC_MODEL` | `claude-opus-4-7` | Modelo de Claude. |
| `ANTHROPIC_MAX_TOKENS` | `16000` | Tope de tokens de salida. |
| `ZEBRA_API_URL` | `http://127.0.0.1:8080` | Builder local. Solo cambia si separas servicios. |
| `ZEBRA_API_KEY` | _(vacío)_ | Si se setea, el builder exige `X-API-Key`. |
| `NEXT_PUBLIC_DRIVE_FOLDER_URL` | la carpeta | Botón "Carpeta" del header. |
| `BUILD_TAG` / `NEXT_PUBLIC_BUILD_TAG` | `dev` | Tag visible en el footer. |

## Setup de la cuenta de servicio Google

1. Ve a [Google Cloud Console → IAM → Cuentas de servicio](https://console.cloud.google.com/iam-admin/serviceaccounts).
2. **Crear cuenta de servicio**. Nombre sugerido: `coti-auto`.
3. Crea una **clave JSON** y descárgala.
4. Habilita la **Google Drive API** en el proyecto.
5. Comparte la carpeta de Drive (`1d7Uj4dMx4USMNum...`) con el `client_email`
   de la SA, en modo **Editor**.
6. (Opcional) Comparte también los Google Docs de las juntas con el `client_email`
   de la SA en modo Lector si quieres soporte de docs privados.
7. En EasyPanel → servicio → Environment:
   - `GOOGLE_SA_JSON` = el JSON completo (una sola línea, con `\n` literales en
     `private_key`).
   - `DRIVE_FOLDER_ID` = el ID de la carpeta.

## Desarrollo local

```bash
cp .env.example .env.local       # rellena claves
npm install
npm run dev                      # http://localhost:3000
```

El builder Python en paralelo (otra terminal):

```bash
cd services/zebra-api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn zebra_api:app --reload --port 8080
```

O todo unificado con Docker:

```bash
docker build -t coti-auto .
docker run --rm -p 3000:3000 \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -e GOOGLE_SA_JSON="$(cat sa.json)" \
  coti-auto
```

## Despliegue en EasyPanel

1. **Una sola App** tipo *Dockerfile*, apuntando a este repo y a la rama
   `claude/zebra-quotes-dashboard-j8Pvj`.
2. **Build path:** `/` (raíz).
3. **Domains/Proxy:** publica el puerto **3000**.
4. **Environment:** al menos `ANTHROPIC_API_KEY` + `GOOGLE_SA_JSON`.
5. **Implementar** (no Restart).
6. Verifica logs:
   ```
   [coti-auto] starting build <tag>
   [coti-auto] node     -> 0.0.0.0:3000
   [coti-auto] uvicorn  -> 0.0.0.0:8080 (cwd=/app/python)
   INFO:     Uvicorn running on http://0.0.0.0:8080
    ▲ Next.js 15.5.15
    ✓ Ready in ...ms
   ```
7. Una vez verde, **apaga los servicios viejos** de EasyPanel:
   `zebra-api` standalone y `n8n` (si solo se usaba para este flujo).

## Errores posibles

| Status | Significado |
|---|---|
| `400 stage=parse_url` | El meeting_url no es un Google Doc reconocible. |
| `400 stage=fetch` | El Doc no es accesible para la SA ni público. |
| `422 stage=schema_validate` + `schema_issues` | Claude rompió el schema; el body trae qué campo falló. |
| `502 Claude falló` | Error de Anthropic. |
| `502 Builder falló` | uvicorn no respondió. |
| `502 Subida a Drive falló` | La SA no tiene permiso sobre la carpeta o la API está deshabilitada. |
