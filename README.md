# Coti Auto · Zebra Dashboard

Dashboard en blanco y negro (estilo zebra) para disparar cotizaciones automáticas
a partir de una junta de Google Drive.

- Stack: **Next.js 15 (App Router) + Tailwind CSS**.
- UI: formulario → pantalla de carga zebra → tarjeta de resultado con links al
  **PDF** y al **Google Docs** que responde el flujo de n8n.
- Integración: el backend hace `POST` al webhook de n8n (evita CORS).
- Deploy: imagen Docker multi-stage pensada para **EasyPanel**.

## Variables de entorno

| Variable              | Descripción                                                  | Default                                                                                                             |
|-----------------------|--------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------|
| `N8N_WEBHOOK_URL`     | URL del webhook de n8n que genera el PDF.                    | `https://n8n-n8n.9qd6cz.easypanel.host/webhook/85a05e12-43a0-449e-9c8a-3e1df24b4769`                                |
| `WEBHOOK_TIMEOUT_MS`  | Timeout (ms) esperando la respuesta del webhook.             | `300000` (5 min)                                                                                                    |

## Desarrollo local

```bash
npm install
npm run dev
# http://localhost:3000
```

## Contrato con n8n

El dashboard envía al webhook un JSON:

```json
{
  "account": "Zebra Corp",
  "meeting_url": "https://drive.google.com/...",
  "link": "https://drive.google.com/...",
  "source": "coti-auto-dashboard"
}
```

Se espera que el último nodo de n8n responda un JSON con los enlaces. Se aceptan
varias formas (arrays / `json` wrapper de n8n) y los siguientes alias:

- PDF: `pdf_url`, `pdfUrl`, `pdf`, `pdf_link`, `pdfLink`, `file_url`, `fileUrl`.
- Docs: `docs_url`, `docsUrl`, `doc_url`, `docUrl`, `document_url`, `documentUrl`, `google_docs`, `googleDocs`.

Ejemplo mínimo:

```json
{
  "pdf_url": "https://.../cotizacion.pdf",
  "docs_url": "https://docs.google.com/document/d/.../edit"
}
```

## Despliegue en EasyPanel

1. En EasyPanel crea un **App** de tipo *Dockerfile* apuntando a este repo y a la
   rama `claude/zebra-quotes-dashboard-j8Pvj` (o al branch por defecto una vez
   fusionado).
2. EasyPanel detectará el `Dockerfile`. Publica el puerto **3000**.
3. (Opcional) Configura `N8N_WEBHOOK_URL` y `WEBHOOK_TIMEOUT_MS` como variables
   de entorno si quieres apuntar a otro webhook o aumentar el timeout.
4. Deploy. El contenedor expone `GET /api/health` para healthchecks.
