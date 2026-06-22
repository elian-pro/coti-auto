# Coti Auto · Zebra Dashboard

Dashboard interno de Zebra (Next.js 15 + Tailwind, tema light alineado al
Design System Kit) para disparar la generación automática de cotizaciones a
partir de una junta de Drive.

## Endpoints actuales

| Ruta | Estado | Qué hace |
|---|---|---|
| `POST /api/quote` | **Producción** | Proxy al webhook de n8n (`N8N_WEBHOOK_URL`). Devuelve `docs_url`, opcional `sheets_url` (calculadora) y `pdf_url`. |
| `POST /api/quote-direct` | **Fase 2 (en pruebas)** | Hace todo en código: descarga la transcripción del Doc, llama a Claude con el prompt v3.2 cacheado, valida con zod, llama al microservicio `zebra-api`, devuelve el DOCX (y XLSX si aplica) en base64. Aún sin subida a Drive. |
| `GET  /api/health` | Producción | `{ "status": "ok" }`. |

## Variables de entorno

### Modo n8n (default)

| Variable | Descripción | Default |
|---|---|---|
| `N8N_WEBHOOK_URL` | Webhook del workflow `Zebra - Cotizador Aut`. | El webhook actual en EasyPanel. |
| `WEBHOOK_TIMEOUT_MS` | Timeout esperando la respuesta. | `300000` (5 min). |

### Modo directo (Fase 2)

| Variable | Descripción | Default |
|---|---|---|
| `ANTHROPIC_API_KEY` | Clave de la API de Anthropic. | (sin default — obligatoria) |
| `ANTHROPIC_MODEL` | Modelo a usar. | `claude-opus-4-7` |
| `ANTHROPIC_MAX_TOKENS` | Tope de tokens de salida. | `16000` |
| `ZEBRA_API_URL` | Host interno del microservicio que genera DOCX/XLSX. | `http://zebra-api:8080` |
| `ZEBRA_API_TIMEOUT_MS` | Timeout del builder. | `60000` |

### UI

| Variable | Descripción |
|---|---|
| `NEXT_PUBLIC_DRIVE_FOLDER_URL` | Carpeta de Drive que muestra el botón del header. |
| `BUILD_TAG` / `NEXT_PUBLIC_BUILD_TAG` | Tag visible en el footer. Útil para confirmar deploys. |

## Migración n8n → código (Fase 2)

El flujo de n8n hoy:

1. Webhook recibe `{ account, link }`.
2. Markdown to Google Docs convierte el Doc a markdown.
3. Code node arma payload con un system prompt de ~34 KB (Zebra v3.2).
4. Llama a Claude (Opus 4.7, max_tokens 8000, timeout 120 s).
5. Parse JSON con tolerancia a fences.
6. `POST http://zebra-api:8080/generate` → DOCX.
7. Si `tieneExcel` → `POST /generate-excel` → XLSX → convertir a Sheet.
8. Subir a Drive, compartir público, log en Supabase, devolver URLs.

La Fase 2 mueve los pasos 1‑5 (y opcionalmente 6‑7) al backend Node, dejando
únicamente la subida a Drive + Supabase en n8n hasta que terminemos la
integración con cuenta de servicio.

- Prompt extraído y modularizado en `prompts/cotizacion/` (versionable en git).
- Schema zod en `prompts/cotizacion/schema.ts` valida la respuesta de Claude
  antes de pasarla al builder. Si Claude se sale del schema, el endpoint
  devuelve `422` con `schema_issues` para debug.
- Em‑dash (`—`) se sanitiza a `:` en código por si Claude se lo brinca.
- `prompt caching` de Anthropic activado (`cache_control: ephemeral` en el
  system) → ~90% menos costo de input a partir de la segunda llamada.

### Cómo probar `/api/quote-direct`

```bash
curl -sS https://dashboard-zebra-cotis.9qd6cz.easypanel.host/api/quote-direct \
  -H 'content-type: application/json' \
  -d '{"account":"Floresta Salvia","meeting_url":"https://docs.google.com/document/d/<ID>/edit"}' \
  | jq '. | {status, docx: .docx.filename, xlsx: .xlsx.filename, usage}'
```

El Google Doc debe estar compartido como **cualquiera con el link** para que el
backend pueda descargarlo sin cuenta de servicio (esa parte llega en Fase 2.1).

Para guardar el DOCX:

```bash
curl -sS ... | jq -r '.docx.base64' | base64 -d > cotizacion.docx
```

## Desarrollo local

```bash
cp .env.example .env.local   # llena las claves
npm install
npm run dev                  # http://localhost:3000
```

## Despliegue en EasyPanel

1. Crea un **App** tipo *Dockerfile* apuntando a este repo y a la rama
   `claude/zebra-quotes-dashboard-j8Pvj`.
2. Publica el puerto **3000**.
3. Configura al menos `ANTHROPIC_API_KEY` si vas a usar el modo directo.
4. **Implementar** (no solo Restart): EasyPanel reconstruye la imagen y recrea
   el contenedor.
