# Deploy de Zebra API en EasyPanel

Guía paso a paso para desplegar el microservicio en tu VPS con EasyPanel.

## 0. Qué vas a tener al final

```
VPS (EasyPanel)
 ├─ Proyecto: zebra
 │   └─ Service: zebra-api (FastAPI + Python)
 │       ├─ URL pública: https://zebra-api.tudominio.com
 │       └─ URL interna: http://zebra-api:8080 (para otros servicios del mismo proyecto)
 │
 └─ [Opcional] Service: n8n (si lo corres aquí también)
     └─ Llama a http://zebra-api:8080/generate directamente
```

## 1. Preparar los archivos

Necesitas que estos 4 archivos queden juntos en un repo de GitHub (el camino recomendado):

```
zebra-api/
 ├─ Dockerfile
 ├─ requirements.txt
 ├─ zebra_api.py
 └─ zebra_proposal_builder.py
```

Pasos:

```bash
# En tu máquina local
mkdir zebra-api && cd zebra-api
# Copiar los 4 archivos desde los que te pasé

git init
git add .
git commit -m "Initial: Zebra proposal microservice"

# Crear repo en GitHub (privado recomendado) y pushear
gh repo create zebra-api --private --source=. --remote=origin --push
# o manualmente: git remote add origin ... && git push -u origin main
```

Si no quieres usar GitHub, EasyPanel también acepta una imagen Docker pre-construida — ver sección 6.

## 2. Crear el proyecto y servicio en EasyPanel

1. **Login** en tu EasyPanel (`https://tu-vps-ip:3000` o tu dominio).
2. **Create Project** → nombre: `zebra` (o el que quieras).
3. Dentro del proyecto: **Add Service** → **App**.
4. Nombre del servicio: `zebra-api`. *Importante:* este nombre será el hostname interno (`http://zebra-api:8080`). No le pongas espacios ni mayúsculas.

## 3. Configurar el Source

En la pestaña **Source** del servicio:

- **Source Type:** `Github`
- **Owner:** tu usuario de GitHub
- **Repository:** `zebra-api`
- **Branch:** `main`
- **Build Path:** `/` (la raíz del repo)

Si tu repo es privado, EasyPanel te pedirá conectar tu cuenta de GitHub la primera vez (OAuth).

## 4. Configurar el Build

En la pestaña **Build**:

- **Builder:** `Dockerfile`
- **Dockerfile:** `Dockerfile` (default, ya está bien)

EasyPanel detectará el Dockerfile y lo usará para construir la imagen.

## 5. Configurar Environment, Domains y Deploy

### 5.1 Environment Variables (pestaña Environment)

Agregá:

```
ZEBRA_OUTPUT_DIR=/tmp/zebra
ZEBRA_API_KEY=<genera-una-random-larga-aqui>
```

**Para generar una API key fuerte** (ejecutalo en cualquier terminal):

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
```

Guardá ese valor — lo vas a necesitar en n8n.

### 5.2 Domains (pestaña Domains) — solo si n8n está FUERA del VPS

Si n8n corre en otro servidor o en n8n Cloud, necesitás que el microservicio sea accesible públicamente:

1. **Add Domain**.
2. **Host:** `zebra-api.tudominio.com` (configurá tu DNS apuntando a la IP del VPS).
3. **HTTPS:** check (EasyPanel provisiona Let's Encrypt automático).
4. **Port:** `8080` (el puerto interno del container).

Si n8n corre en el MISMO EasyPanel, podés saltarte este paso — los servicios del mismo proyecto se hablan por hostname interno sin necesidad de dominio público.

### 5.3 Mounts (pestaña Mounts) — opcional

Por default los DOCX generados viven en `/tmp/zebra` dentro del container y se borran cada vez que se reinicia. Esto está bien para el flujo normal (n8n lee el DOCX inmediatamente). Si querés persistencia:

- Type: `Volume`
- Name: `zebra-output`
- Mount Path: `/tmp/zebra`

### 5.4 Deploy

Click en **Deploy** (botón grande arriba). EasyPanel:

1. Clona tu repo de GitHub.
2. Construye la imagen Docker con el Dockerfile.
3. Inicia el container.
4. Espera a que el healthcheck dé OK.
5. Si agregaste dominio, configura el proxy y SSL.

El build tarda 1-3 minutos la primera vez (instala python-docx, fastapi, uvicorn). Redeploys posteriores son más rápidos gracias al cache.

## 6. Validar que funciona

### Desde tu máquina local (si tenés dominio público):

```bash
# Healthcheck
curl https://zebra-api.tudominio.com/health
# Esperado: {"status":"ok","service":"zebra-proposal-api","version":"1.0.0"}

# Generar un DOCX de prueba (usando proposal_grupo_indes.json)
curl -X POST https://zebra-api.tudominio.com/generate \
  -H "Content-Type: application/json" \
  -H "X-API-Key: TU-API-KEY-AQUI" \
  --data @proposal_grupo_indes.json \
  --output test.docx

# Abrí test.docx — deberías ver la propuesta Zebra.
```

### Desde dentro del VPS (sin dominio):

En EasyPanel → servicio `zebra-api` → pestaña **Console** → botón **Launcher**:

```bash
curl http://localhost:8080/health
```

### Desde otro servicio del mismo proyecto (ej: n8n):

En EasyPanel → servicio `n8n` → Console:

```bash
curl http://zebra-api:8080/health
```

Si responde OK, la red interna funciona.

## 7. Conectar n8n

Abrí el workflow `zebra_workflow_n8n_v2.json` en n8n y configurá:

### Caso A — n8n en el MISMO EasyPanel

En **Variables del workflow**:
- `ZEBRA_API_URL` = `http://zebra-api:8080`
- `ZEBRA_SYSTEM_PROMPT` = (contenido de `prompt_n8n.md`)

En el nodo **Generar DOCX (Zebra API)**:
- Agregá un header adicional: `X-API-Key` = tu API key
- O creá una credencial tipo Header Auth y asignala al nodo.

### Caso B — n8n en otro lado (Cloud u otro VPS)

Igual que A pero:
- `ZEBRA_API_URL` = `https://zebra-api.tudominio.com` (la URL pública con HTTPS).
- El resto igual.

### Credencial Anthropic (ambos casos)

En n8n → Credentials → New → Header Auth:
- Header: `x-api-key`
- Value: tu `sk-ant-api03-...`

Asignala al nodo **Claude — Generar JSON**.

## 8. Monitoreo

En EasyPanel → servicio `zebra-api`:

- **Logs:** stream en vivo del uvicorn. Vas a ver cada request (`POST /generate HTTP/1.1 200 OK`).
- **Console:** terminal dentro del container. Útil para debug.
- **Stats:** CPU y RAM del container.
- **Deployments:** historial. Podés hacer rollback a una versión anterior con un click.

## 9. Auto-deploy (opcional pero recomendado)

En **Source** → **Enable Auto Deploy**. EasyPanel crea un webhook en tu repo de GitHub. Cada `git push` a `main` dispara un rebuild + redeploy automático, sin downtime.

Útil si después querés iterar el prompt, el builder, o agregar endpoints al microservicio.

## 10. Alternativa sin GitHub: imagen Docker pre-construida

Si preferís no usar Git:

```bash
# En tu máquina local
docker build -t zebra-api:latest .
docker tag zebra-api:latest tuusuario/zebra-api:latest
docker push tuusuario/zebra-api:latest
```

En EasyPanel: **Source Type:** `Docker Image` → `tuusuario/zebra-api:latest`. Skip el paso de Build.

Menos cómodo porque cada cambio requiere rebuild local + push. GitHub es más práctico.

## Troubleshooting

| Síntoma | Causa probable | Fix |
|---|---|---|
| Build falla en `pip install lxml` | Falta libxml2 en la imagen | Ya está en el Dockerfile, verifica que estés usando el mío |
| Container arranca pero `/health` timeout | Puerto mal configurado | En EasyPanel asegurate de que el **Proxy Port** sea `8080` |
| 401 desde n8n al llamar `/generate` | Falta header `X-API-Key` o valor no coincide | Revisa la env var `ZEBRA_API_KEY` del container y el header en n8n |
| 502 Bad Gateway en el dominio público | Container crasheando. | Logs → busca el traceback. Común: módulo no instalado. |
| Build OK pero el DOCX sale sin estilo | Versión vieja de python-docx | Fijalo en `requirements.txt` a `>=1.1.0` (ya está) |
| n8n del mismo EasyPanel no alcanza `http://zebra-api:8080` | Servicios en proyectos distintos | Ponlos en el mismo proyecto de EasyPanel, o creá una network compartida |

## Costos estimados

- VPS mínimo recomendado: 2 GB RAM / 2 vCPU (ej: Hetzner CX22 ~€4/mes, DigitalOcean $12/mes).
- EasyPanel en sí es gratis (versión Community).
- El microservicio consume ~200MB RAM idle, ~400MB bajo carga.
- Si corres n8n en el mismo VPS, 2GB RAM es el mínimo cómodo; mejor 4GB.
