"""
zebra_api.py — Microservicio FastAPI para generación de propuestas Zebra.

Endpoints:
  - GET  /health           → healthcheck
  - POST /generate         → recibe proposal_data, devuelve DOCX
  - POST /generate-excel   → recibe proposal_data con calculadora_inputs, devuelve XLSX anexo

Autenticación: header X-API-Key debe coincidir con env var ZEBRA_API_KEY.

Lógica de la calculadora:
  Si el body trae `calculadora_inputs`, el API calcula `calculadora_inversion`
  y `plan_12_meses` internamente usando `zebra_investment_calc`, los inyecta
  en `proposal_data`, y deja al builder hacer su trabajo. Claude (en n8n) NO
  hace estos cálculos — solo envía los datos crudos.
"""

import logging
import os
import re
import unicodedata
import uuid
from dataclasses import asdict, is_dataclass
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse

from zebra_proposal_builder import generate_proposal
from zebra_investment_calc import (
    CalculadoraInversionInput,
    PlanInversionInput,
    calcular_inversion,
    calcular_plan_12_meses,
)
from zebra_excel_annex import generate_investment_excel


# =============================================================================
# CONFIG
# =============================================================================

API_VERSION = "2.0.0"
OUTPUT_DIR = Path(os.environ.get("ZEBRA_OUTPUT_DIR", "/tmp/zebra"))
API_KEY = os.environ.get("ZEBRA_API_KEY")

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("zebra-api")


app = FastAPI(
    title="Zebra Proposal API",
    version=API_VERSION,
    description="Microservicio para generar propuestas DOCX y anexos Excel de Zebra.",
)


# =============================================================================
# UTILS
# =============================================================================

def _check_auth(x_api_key: Optional[str]):
    """Compara el header X-API-Key con la env var. Si no hay env var, no autentica."""
    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing X-API-Key")


def _slugify(text: str) -> str:
    """Convierte un string a un slug seguro para nombres de archivo."""
    if not text:
        return "propuesta"
    # Normaliza acentos
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^a-zA-Z0-9]+", "_", text).strip("_").lower()
    return text or "propuesta"


def _dataclass_to_dict(obj: Any) -> Any:
    """Recursivamente convierte dataclasses a dicts (para inyectar en proposal_data)."""
    if is_dataclass(obj):
        return asdict(obj)
    if isinstance(obj, list):
        return [_dataclass_to_dict(x) for x in obj]
    if isinstance(obj, dict):
        return {k: _dataclass_to_dict(v) for k, v in obj.items()}
    return obj


def _build_calc_and_plan(calc_inputs: Dict[str, Any]):
    """
    Toma el dict `calculadora_inputs` que viene del JSON, construye los
    dataclasses, ejecuta la lógica y devuelve (calc_output, plan_output).
    """
    # Extraer sala_actual (va al plan, no a la calculadora)
    sala_actual = calc_inputs.get("sala_actual")

    # Filtrar los kwargs válidos para CalculadoraInversionInput
    valid_keys = {
        "unidades_totales", "ticket_promedio", "absorcion_meses",
        "tasa_cita", "tasa_asistencia", "tasa_apartado", "tasa_cierre",
        "cpl_override", "porcentaje_inversion_override",
    }
    calc_kwargs = {k: v for k, v in calc_inputs.items() if k in valid_keys and v is not None}

    # Validar requeridos
    for required in ("unidades_totales", "ticket_promedio", "absorcion_meses"):
        if required not in calc_kwargs:
            raise HTTPException(
                status_code=400,
                detail=f"calculadora_inputs.{required} es obligatorio cuando se incluye calculadora_inputs",
            )

    calc_input = CalculadoraInversionInput(**calc_kwargs)
    calc_output = calcular_inversion(calc_input)

    plan_input = PlanInversionInput(
        calculadora=calc_output,
        sala_actual=sala_actual,
    )
    plan_output = calcular_plan_12_meses(plan_input)

    return calc_output, plan_output


# =============================================================================
# ENDPOINTS
# =============================================================================

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "zebra-proposal-api",
        "version": API_VERSION,
    }


@app.post("/generate")
async def generate(request: Request, x_api_key: Optional[str] = Header(None)):
    """
    Genera el DOCX de la propuesta.

    Body: proposal_data (ver esquema del prompt v3.2 n8n).
    Si trae `calculadora_inputs`, el API ejecuta la lógica de calculadora y plan
    antes de invocar el builder.
    """
    _check_auth(x_api_key)

    try:
        body = await request.json()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Body no es JSON válido: {e}")

    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="Body debe ser un objeto JSON.")

    # Branch de diagnóstico preliminar (Claude devolvió que no tiene datos)
    if body.get("status") == "diagnostico_preliminar":
        return JSONResponse(
            status_code=200,
            content={
                "status": "diagnostico_preliminar",
                "razon": body.get("razon", ""),
                "preguntas_criticas": body.get("preguntas_criticas", []),
                "lo_que_si_entendimos": body.get("lo_que_si_entendimos", ""),
                "docx_generated": False,
            },
        )

    # Si trae calculadora_inputs → calcular y reemplazar por calculadora_inversion + plan_12_meses
    if "calculadora_inputs" in body and body["calculadora_inputs"]:
        try:
            calc_output, plan_output = _build_calc_and_plan(body["calculadora_inputs"])
            body["calculadora_inversion"] = calc_output
            body["plan_12_meses"] = plan_output
            log.info("Calculadora + plan 12 meses ejecutados correctamente.")
        except HTTPException:
            raise
        except Exception as e:
            log.exception("Error calculando calculadora/plan")
            raise HTTPException(
                status_code=400,
                detail=f"Error procesando calculadora_inputs: {e}",
            )
        # Limpieza: el builder no necesita el campo de inputs crudos
        body.pop("calculadora_inputs", None)

    # Generar nombre de archivo
    slug = body.pop("__slug__", None) or _slugify(
        body.get("subtitulo_propuesta") or body.get("cliente") or "propuesta"
    )
    filename = f"propuesta_{slug}_{uuid.uuid4().hex[:8]}.docx"
    output_path = OUTPUT_DIR / filename

    try:
        generate_proposal(body, str(output_path))
        log.info("DOCX generado: %s", output_path)
    except Exception as e:
        log.exception("Error generando DOCX")
        raise HTTPException(status_code=500, detail=f"Error generando DOCX: {e}")

    return FileResponse(
        path=str(output_path),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=filename,
    )


@app.post("/generate-excel")
async def generate_excel(request: Request, x_api_key: Optional[str] = Header(None)):
    """
    Genera el Excel anexo de Proyección de Inversión.

    Body: proposal_data con `calculadora_inputs` (obligatorio).
    El API ejecuta la lógica de calculadora y plan, y genera el Excel.
    """
    _check_auth(x_api_key)

    try:
        body = await request.json()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Body no es JSON válido: {e}")

    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="Body debe ser un objeto JSON.")

    calc_inputs = body.get("calculadora_inputs")
    if not calc_inputs:
        raise HTTPException(
            status_code=400,
            detail=(
                "calculadora_inputs es obligatorio en /generate-excel. "
                "Si Claude no lo emitió, no debiste llamar a este endpoint."
            ),
        )

    try:
        calc_output, plan_output = _build_calc_and_plan(calc_inputs)
        log.info("Calculadora + plan 12 meses ejecutados para Excel anexo.")
    except HTTPException:
        raise
    except Exception as e:
        log.exception("Error calculando calculadora/plan para Excel")
        raise HTTPException(
            status_code=400,
            detail=f"Error procesando calculadora_inputs: {e}",
        )

    slug = body.pop("__slug__", None) or _slugify(
        body.get("subtitulo_propuesta") or body.get("cliente") or "anexo"
    )
    filename = f"anexo_proyeccion_{slug}_{uuid.uuid4().hex[:8]}.xlsx"
    output_path = OUTPUT_DIR / filename

    try:
        generate_investment_excel(calc_output, plan_output, str(output_path))
        log.info("XLSX generado: %s", output_path)
    except Exception as e:
        log.exception("Error generando XLSX")
        raise HTTPException(status_code=500, detail=f"Error generando XLSX: {e}")

    return FileResponse(
        path=str(output_path),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=filename,
    )


# =============================================================================
# ENTRY POINT
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("zebra_api:app", host="0.0.0.0", port=8080, reload=False)
