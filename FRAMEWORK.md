# Cómo funciona Coti Auto

Este documento describe **qué hace el dashboard, paso por paso, en lenguaje
natural.** Sin jerga de infraestructura, sin código. Sirve para que cualquier
persona nueva del equipo entienda el sistema en 5 minutos.

Para los detalles técnicos (env vars, deploy, endpoints), ver el
[`README.md`](./README.md).

---

## En una frase

Coti Auto convierte una **junta de ventas** (que vive como Google Doc con la
transcripción o resumen) en **hasta tres documentos automáticos**:

1. Una **propuesta comercial** editable en Google Docs.
2. Una **calculadora de inversión** en Google Sheets (solo cuando aplica).
3. Un **diagnóstico** en PDF que audita cómo se hizo la llamada.

Todo con la voz de Zebra, el Design System oficial, y respetando el prompt
Zebra v3.2 (cotización) y v2.3 (evaluador).

---

## Los cinco actores

| Actor | Qué hace |
|---|---|
| **El operador** (persona) | Es quien pega la liga del Doc en el form y decide qué generar. |
| **El dashboard** (Next.js) | Orquesta todo: login, UI, orden de llamadas, subida a Drive. |
| **Claude (Anthropic)** | Lee la transcripción y produce dos JSON: uno para la propuesta y otro para el diagnóstico. |
| **El builder Python** (FastAPI + WeasyPrint) | Convierte los JSON de Claude en archivos reales: DOCX, XLSX y PDF. Vive en el mismo contenedor. |
| **Google Drive** | Guarda los archivos finales en dos carpetas compartidas: una de cotizaciones y otra de diagnósticos. |

---

## Paso a paso

### 1. El operador entra al dashboard

Abre `https://dashboard-zebra-cotis.9qd6cz.easypanel.host/`.

El **middleware** revisa si hay sesión activa:

- Si **no** hay sesión → redirige a `/login`.
- Si **sí** hay sesión → deja pasar al dashboard.

### 2. Login con Google

Si es la primera vez (o expiró), ve la pantalla de login: **"Continuar con Google"**.

Al aceptar:

1. Google pide consentimiento (una sola vez por sesión).
2. El operador otorga acceso de lectura a sus Google Docs (`drive.readonly`).
3. Google devuelve un **token de acceso** que el dashboard guarda cifrado en una cookie.
4. **Filtro de dominio**: si el correo no termina en `@zebradigital.marketing`, se rechaza el login con un mensaje claro. El resto del dashboard nunca se muestra.

Esto significa que el operador puede leer **cualquier Google Doc al que ya tiene acceso**, sin tener que compartirlo con nadie más.

### 3. El form del cotizador

Ya adentro, el operador ve el form principal con:

- **Selector de 3 botones (qué generar):**
  - `Cotización + Diagnóstico` (default, ambos en paralelo).
  - `Solo cotización` (DOCX + calculadora si aplica).
  - `Solo diagnóstico` (PDF con scoring de la llamada).
- **Nombre de la cuenta**: por ejemplo `Floresta Salvia`.
- **Liga de la junta**: URL del Google Doc con la transcripción.

Al darle al botón grande (**"Generar análisis completo"**), arranca el pipeline.

### 4. Pantalla de carga

Aparece una card con:

- Un cronómetro que sube desde `00:00`.
- Una barra de progreso.
- Un texto contextual: *"Estamos llamando a Claude para construir la propuesta y, en paralelo, auditando la llamada con el evaluador v2.3."*
- Un tiempo estimado: **2:15** para el modo completo, **1:30** para los modos individuales.

### 5. Descarga de la transcripción

El backend usa el **token OAuth del operador** para llamar a la API de Google Drive y bajar el Doc como texto plano. Ya que el operador tiene acceso, no importa si el Doc es privado.

Si la URL no es un Google Doc, o el operador no tiene acceso, se detiene con un error específico ("La cuenta no tiene permiso para leer ese Doc" o similar).

### 6. Dos llamadas a Claude en paralelo

Ahora el backend arma dos mensajes para Claude Opus:

- **Uno con el prompt Zebra v3.2** (`prompts/cotizacion/system_prompt.md`). Le pide un JSON estructurado (`proposal_data`) que describa la propuesta: modelo Zebra dominante, diagnóstico, plan de implementación, KPIs, inversión y, si aplica, la calculadora de 12 meses.
- **Uno con el prompt evaluador v2.3** (`prompts/evaluacion/system_prompt.md`). Le pide otro JSON con el scoring de la llamada bajo el marco SPIN Zebra: cobertura, calidad, capacidad diagnóstica, momentos perdidos, plan de mejora.

Ambas llamadas usan **prompt caching de Anthropic**: como el system prompt no cambia entre requests, a partir de la segunda cotización el costo de input baja ~90%.

Si el operador eligió `Solo cotización` o `Solo diagnóstico`, solo se hace **una** de las dos llamadas.

### 7. Validación estricta

Cada JSON pasa por:

1. Un **sanitizer**: quita bloques de markdown (```json), extrae solo el JSON de respuestas mixtas, reemplaza em-dashes por dos puntos (regla de estilo).
2. `jsonrepair`: si el JSON tiene comas trailing, comentarios, comillas simples o keys sin comillas, los repara automáticamente.
3. Un **schema zod** que valida los campos que el builder Python espera.

Si algo falla:

- **Cotización rompe el schema** → 422 con el detalle del campo violado.
- **Diagnóstico rompe el schema** → la cotización sigue, pero la card muestra "Diagnóstico no se generó" con la razón.

### 8. Casos especiales

- **Datos insuficientes**: si Claude concluye que la transcripción no tiene lo mínimo para cotizar (ticket, cuello de botella, capacidad operativa), devuelve un JSON con `status: "diagnostico_preliminar"` que lista las **preguntas críticas** que faltan. En ese caso no se genera ningún archivo, y el dashboard muestra: *"Recontactar antes de cotizar"* con la lista.

### 9. Tres builds en paralelo (Python)

Los JSON válidos pasan al microservicio Python interno (`http://127.0.0.1:8080`):

- `POST /generate` → convierte `proposal_data` en un **DOCX** de la propuesta usando `python-docx`. Estilo alineado al Design System (ink monocromático, sin amarillo, tipografía Inter).
- `POST /generate-excel` → convierte los inputs de la calculadora en un **XLSX** con dos hojas: la Calculadora de Inversión (con fórmulas vinculadas) y el Plan a 12 Meses.
- `POST /evaluate` → convierte el JSON del evaluador en un **PDF** de 13 páginas usando WeasyPrint. Portada con score y veredicto, breakdown por eje SPIN, momentos perdidos con cita textual, plan de mejora, cierre dinámico.

### 10. Subida a Drive

Los archivos vuelven al backend Node como binarios. El backend usa la **cuenta de servicio** (no el token del operador) para subirlos a Drive:

- **DOCX → Google Doc** en la carpeta `DRIVE_FOLDER_ID_COTIZACIONES`, con nombre `{Cliente} Propuesta`.
- **XLSX → Google Sheet** en la misma carpeta, con nombre `{Cliente} Calculadora`.
- **PDF → archivo Drive** en la carpeta `DRIVE_FOLDER_ID_EVALUACIONES`, con nombre `{Cliente} Diagnóstico.pdf`.

Cada archivo se comparte con permiso "cualquiera con el link" para que quien reciba las URLs pueda abrirlas sin más ceremonia.

### 11. La card de resultado

El operador ve una card con:

- Encabezado: `{Cliente}` (grande, semibold).
- Si hubo diagnóstico: chip con `{score}/100 · {veredicto}` (ej. `53/100 · No cotizar`).
- Botones lado a lado:
  - **Abrir cotización** → Google Doc editable.
  - **Abrir diagnóstico** → PDF de scoring.
  - **Abrir calculadora** → Google Sheet (solo si aplica).
- Link chico: "Descargar cotización en PDF".
- Botón "Nueva cotización" para volver al form.

Si Claude marcó `diagnostico_preliminar`, la card cambia por completo y muestra la razón + preguntas críticas que faltan.

### 12. Errores

Todo error se surface con:

- Código HTTP claro (400, 401, 422, 502).
- Mensaje humano de qué falló (transcripción, Claude, builder, Drive).
- `stage` que dice exactamente en qué paso.
- En el UI: banner de error en el form al reintentar.

---

## Diagrama mental

```
┌────────────────┐
│    Operador    │  ¬ sesión → redirect a /login
└────────┬───────┘
         │  Login con Google (filtro @zebradigital.marketing)
         │  Guarda cookie con access_token del usuario
         │
         │  Elige modo · pega link del Doc · da click en Generar
         ▼
┌────────────────────────────────────────────────────────────┐
│                    Dashboard (Next.js)                     │
│  1. Descarga el Doc con el token del usuario               │
│  2. Llama a Claude v3.2 (cotización) y v2.3 (eval)         │
│     ─ en paralelo si el modo lo pide                       │
│  3. Sanea + valida + repara JSON con zod y jsonrepair      │
└──┬─────────────────────────────────────────────────────────┘
   │
   │  proposal_data JSON     evaluation_data JSON
   ▼                          ▼
┌──────────────────────────────────────────────┐
│    Builder Python (mismo contenedor)         │
│  ─ /generate       → DOCX (python-docx)      │
│  ─ /generate-excel → XLSX (openpyxl)         │
│  ─ /evaluate       → PDF  (WeasyPrint)       │
└──────────────────────────┬───────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────┐
│    Google Drive (cuenta de servicio)         │
│  ─ Carpeta Cotizaciones                      │
│      {Cliente} Propuesta.gdoc                │
│      {Cliente} Calculadora.gsheet            │
│  ─ Carpeta Diagnósticos                      │
│      {Cliente} Diagnóstico.pdf               │
│  (compartidas "cualquiera con el link")      │
└──────────────────────────┬───────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────┐
│    Card de resultado con los links + score   │
└──────────────────────────────────────────────┘
```

---

## Decisiones de diseño

### Por qué OAuth por usuario, no solo cuenta de servicio

Antes: para que el dashboard leyera un Doc, había que compartirlo manualmente
con el correo de la cuenta de servicio. Friction alta y fácil de olvidar.

Ahora: cada operador se loguea con su cuenta. El backend lee el Doc con **su**
token, así que basta con que el operador ya tenga acceso al Doc (que es lo
natural: es suyo o de su equipo).

La cuenta de servicio se sigue usando para **subir** los archivos generados a
las carpetas compartidas, porque esas carpetas son de Zebra, no del operador
individual.

### Por qué un solo contenedor

En vez de tener el dashboard y el builder Python como servicios separados en
EasyPanel, viven en el mismo contenedor con dos procesos (`node` + `uvicorn`).
Menos infraestructura que operar, menos permisos que configurar, un solo
deploy por cambio.

### Por qué dos llamadas separadas a Claude

Podríamos pedirle a Claude ambos JSON en una sola llamada, pero los prompts
son muy largos y muy distintos entre sí. Separarlos permite:

- Cachear cada system prompt por separado (prompt caching de Anthropic).
- Correrlas en paralelo (`Promise.all`) → total = max(t1, t2) en vez de t1 + t2.
- Ejecutar solo una si el operador eligió modo individual.

### Por qué zod + jsonrepair

Claude a veces devuelve JSON con imperfecciones típicas de LLM (comas
trailing, comillas curly, comentarios, saltos de línea literales). Antes de
pasar al builder, corremos `jsonrepair` como red de seguridad y luego zod
valida que la forma sea la que el builder espera. Si zod falla, el operador
ve exactamente qué campo violó el schema.

### Por qué el estilo Zebra en TODO

DOCX, XLSX y PDF siguen la paleta ink monocromática y la tipografía Inter +
JetBrains Mono del Design System Kit v2.0. Sin amarillo (regla ZR‑05), sin
em‑dashes (ZR‑02), con hairline borders y KPIs como cajas ink de énfasis.
Los archivos entregados se sienten parte del sistema, no como plantillas
genéricas de PDF.

---

## Qué NO hace el dashboard

- **No decide el modelo Zebra por su cuenta.** Solo lo hace Claude siguiendo
  el prompt v3.2. El dashboard no tiene reglas de negocio.
- **No guarda historial.** Cada cotización es independiente. Si necesitas
  ver una vieja, la buscas en Drive por nombre.
- **No manda emails ni notifica.** El operador ve la card de resultado y
  desde ahí abre los archivos. Punto.
- **No hay Supabase, no hay n8n, no hay flow visual.** Todo el flujo está
  en código de este repo.

---

## Archivos clave para navegar el repo

| Ubicación | Qué contiene |
|---|---|
| `prompts/cotizacion/system_prompt.md` | El prompt Zebra v3.2 completo (cotización). |
| `prompts/cotizacion/schema.ts` | Schema zod de `proposal_data`. |
| `prompts/evaluacion/system_prompt.md` | El prompt evaluador v2.3 (diagnóstico). |
| `prompts/evaluacion/schema.ts` | Schema zod del evaluador. |
| `app/api/quote-direct/route.ts` | El orquestador principal: transcript → Claude → builder → Drive. |
| `app/HomeClient.tsx` | Los estados del form: idle → loading → done. |
| `components/QuoteForm.tsx` | Selector de modo + inputs de cuenta y liga. |
| `components/ResultCard.tsx` | Card final con botones a los archivos. |
| `services/zebra-api/zebra_proposal_builder.py` | Builder DOCX. |
| `services/zebra-api/zebra_excel_annex.py` | Builder XLSX. |
| `services/zebra-api/zebra_evaluation_builder.py` | Builder PDF de diagnóstico. |
| `auth.ts` | Configuración de NextAuth + filtro de dominio. |
| `middleware.ts` | Protege todo el dashboard salvo login/health. |
| `Dockerfile` + `scripts/start.sh` | Un contenedor, dos procesos. |
