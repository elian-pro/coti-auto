"""
zebra_evaluation_builder.py
============================
Generador de PDF para evaluaciones de diagnóstico comercial Zebra.

Uso básico:
    from zebra_evaluation_builder import generate_evaluation_pdf

    with open("evaluacion.json", "r") as f:
        eval_data = json.load(f)

    generate_evaluation_pdf(
        evaluation_data=eval_data,
        output_path="evaluacion_cordelia.pdf",
        logo_path="zebra_logo_white.png",  # opcional
    )

Input esperado:
    evaluation_data debe ser el dict producido por el prompt evaluador v2.3
    (Formato 2 — JSON estructurado). Ver README_EVALUATION_BUILDER.md
    para el schema completo.

Dependencias:
    pip install weasyprint --break-system-packages

Autor: Zebra High Performance Marketing
Versión: 1.1 (alineado a prompt evaluador v2.3)

Cambios v1.0 → v1.1:
    - Pesos por eje actualizados: A=30 (antes 50), B=30 (antes 25), C=40 (antes 25)
    - Subdimensiones recalibradas: A.1=15, A.2=9, A.3=6, B.2=10, B.3=10, B.4=5,
      C.1=9, C.2=9, C.3=14, C.4=8
"""

import base64
import json
from pathlib import Path
from typing import Any
from weasyprint import HTML, CSS


# ============================================================
# UTILIDADES
# ============================================================

def _safe(value: Any, default: str = "—") -> str:
    """Devuelve el valor como string, o un default si es None/vacío."""
    if value is None or value == "" or value == []:
        return default
    return str(value)


def _bool_to_es(value: Any, default: str = "—") -> str:
    """Convierte boolean a 'Sí' / 'No' en español."""
    if value is True:
        return "Sí"
    if value is False:
        return "No"
    return default


def _logo_to_base64(logo_path: str | None) -> str:
    """Convierte el logo a base64 para embeberlo en el HTML."""
    if not logo_path or not Path(logo_path).exists():
        return ""
    with open(logo_path, "rb") as f:
        encoded = base64.b64encode(f.read()).decode("utf-8")
    # Detectar tipo de imagen (jpg/png)
    ext = Path(logo_path).suffix.lower().lstrip(".")
    if ext == "jpg":
        ext = "jpeg"
    return f"data:image/{ext};base64,{encoded}"


def _status_class(status: str) -> str:
    """Mapea un status de auditoría a una clase CSS de color."""
    status = (status or "").lower()
    if status in ("respondida_con_evidencia", "respondida", "posicion_clara"):
        return "status-ok"
    if status in ("inferible", "ambigua", "parcial"):
        return "status-partial"
    if status in ("imposible", "insuficiente_evidencia", "insuficiente"):
        return "status-fail"
    return "status-partial"


def _status_label(status: str) -> str:
    """Mapea un status a su etiqueta legible en español."""
    mapping = {
        "respondida_con_evidencia": "Respondida",
        "respondida": "Respondida",
        "posicion_clara": "Clara",
        "inferible": "Inferible",
        "ambigua": "Ambigua",
        "parcial": "Parcial",
        "imposible": "Imposible",
        "insuficiente_evidencia": "Insuficiente",
        "insuficiente": "Insuficiente",
    }
    return mapping.get((status or "").lower(), status or "—")


def _verdict_from_score(score: int) -> tuple[str, str]:
    """Devuelve (etiqueta_legible, clase_CSS) según el score."""
    if score < 60:
        return ("No cotizar", "verdict-no")
    if score < 75:
        return ("Llenar gaps", "verdict-gaps")
    if score < 90:
        return ("Cotizar", "verdict-ok")
    return ("Excelente", "verdict-excellent")


# ============================================================
# CSS — Estilo Zebra
# ============================================================

CSS_STYLES = """
@page {
    size: letter;
    margin: 1.6cm 1.4cm 1.8cm 1.4cm;
    @bottom-left {
        content: "Zebra · Evaluación de Diagnóstico — " string(client-name);
        font-family: 'Helvetica', sans-serif;
        font-size: 8pt;
        color: #888;
    }
    @bottom-right {
        content: "Página " counter(page) " de " counter(pages);
        font-family: 'Helvetica', sans-serif;
        font-size: 8pt;
        color: #888;
    }
}

@page:first {
    margin: 0;
    @bottom-left { content: none; }
    @bottom-right { content: none; }
}

* { box-sizing: border-box; }

body {
    font-family: 'Helvetica', 'Arial', sans-serif;
    font-size: 10pt;
    line-height: 1.5;
    color: #1a1a1a;
    margin: 0;
    padding: 0;
}

/* string-set para el footer */
h1.cover-title { string-set: client-name content(); }

/* ============== PORTADA ============== */
.cover {
    background: #0a0a0a;
    color: #fff;
    height: 100vh;
    width: 100%;
    padding: 3cm 2.5cm 2cm 2.5cm;
    page-break-after: always;
    position: relative;
}

.cover-logo {
    height: 0.9cm;
    margin-bottom: 1.5cm;
    display: block;
}

.cover-top {
    border-bottom: 4px solid #F9D626;
    padding-bottom: 1cm;
}

.cover-eyebrow {
    font-size: 10pt;
    letter-spacing: 4px;
    color: #F9D626;
    text-transform: uppercase;
    font-weight: 700;
    margin-bottom: 0.6cm;
}

.cover-title {
    font-size: 42pt;
    font-weight: 800;
    line-height: 1.05;
    margin: 0;
    color: #fff;
}

.cover-subtitle {
    font-size: 14pt;
    font-weight: 400;
    color: #cccccc;
    margin-top: 0.5cm;
    line-height: 1.3;
}

table.cover-meta {
    width: 100%;
    margin-top: 1.2cm;
    border-collapse: collapse;
}

table.cover-meta td {
    width: 50%;
    padding: 0.3cm 1cm 0.3cm 0;
    vertical-align: top;
    border: none;
}

.cover-meta .label {
    color: #888;
    font-size: 8.5pt;
    letter-spacing: 1px;
    text-transform: uppercase;
    display: block;
    margin-bottom: 4px;
}

.cover-meta .value {
    color: #fff;
    font-size: 12pt;
    font-weight: 600;
}

.cover-score-block {
    background: #F9D626;
    color: #0a0a0a;
    padding: 1.2cm 1.5cm;
    margin-top: 1cm;
    overflow: hidden;
}

.cover-score-number {
    font-size: 80pt;
    font-weight: 900;
    line-height: 0.9;
    float: left;
}

.cover-score-info {
    float: right;
    text-align: right;
    padding-top: 0.5cm;
}

.cover-score-info .out-of {
    font-size: 16pt;
    color: #555;
    font-weight: 600;
}

.cover-score-info .verdict {
    font-size: 14pt;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    margin-top: 0.3cm;
}

.cover-footer {
    color: #aaa;
    font-size: 9pt;
    border-top: 1px solid #333;
    padding-top: 0.5cm;
    margin-top: 1.5cm;
    clear: both;
}

.cover-footer strong { color: #F9D626; }

/* ============== SECCIONES ============== */
.section-header {
    background: #0a0a0a;
    color: #fff;
    padding: 0.35cm 0.5cm;
    margin: 0.7cm 0 0.4cm 0;
    page-break-after: avoid;
    border-left: 6px solid #F9D626;
}

.section-number {
    color: #F9D626;
    font-size: 8.5pt;
    letter-spacing: 3px;
    font-weight: 700;
    text-transform: uppercase;
    display: block;
    margin-bottom: 1px;
}

.section-title {
    font-size: 14pt;
    font-weight: 700;
    margin: 0;
    line-height: 1.2;
}

h3 {
    font-size: 11pt;
    font-weight: 700;
    color: #0a0a0a;
    margin: 0.4cm 0 0.15cm 0;
    page-break-after: avoid;
}

p { margin: 0.15cm 0; }

/* ============== SCORING TABLE ============== */
table.scoring {
    width: 100%;
    border-collapse: collapse;
    margin: 0.3cm 0;
    font-size: 10pt;
}

table.scoring th {
    background: #0a0a0a;
    color: #F9D626;
    padding: 8px 10px;
    text-align: left;
    font-weight: 700;
    text-transform: uppercase;
    font-size: 8.5pt;
    letter-spacing: 1px;
}

table.scoring th.right { text-align: right; }

table.scoring td {
    padding: 9px 10px;
    border-bottom: 1px solid #e0e0e0;
}

table.scoring tr.total td {
    background: #F9D626;
    font-weight: 800;
    border-bottom: none;
}

table.scoring td.numeric {
    text-align: right;
    font-weight: 600;
}

/* ============== BREAKDOWN ============== */
.breakdown {
    background: #f5f5f5;
    border-left: 4px solid #F9D626;
    padding: 0.35cm 0.45cm;
    margin: 0.25cm 0;
    page-break-inside: avoid;
    font-size: 9.5pt;
}

.breakdown-title {
    font-weight: 700;
    color: #0a0a0a;
    margin-bottom: 0.2cm;
    font-size: 10.5pt;
}

table.breakdown-table {
    width: 100%;
    border-collapse: collapse;
}

table.breakdown-table tr.row td {
    padding: 6px 0 2px 0;
    border-bottom: none;
}

table.breakdown-table tr.row td.desc {
    color: #1a1a1a;
    font-weight: 600;
}

table.breakdown-table tr.row td.score {
    text-align: right;
    font-weight: 700;
    color: #0a0a0a;
    white-space: nowrap;
    width: 60px;
}

table.breakdown-table tr.comment-row td {
    padding: 0 0 8px 0;
    color: #555;
    font-size: 9pt;
    font-style: italic;
    border-bottom: 1px dotted #d0d0d0;
}

table.breakdown-table tr.comment-row:last-child td { border-bottom: none; }

/* ============== MOMENTOS PERDIDOS ============== */
.moment {
    border: 1px solid #e0e0e0;
    border-left: 6px solid #F9D626;
    background: #fafafa;
    padding: 0.45cm 0.55cm;
    margin: 0.35cm 0;
    page-break-inside: avoid;
}

.moment-number {
    background: #0a0a0a;
    color: #F9D626;
    font-weight: 800;
    font-size: 9pt;
    padding: 4px 12px;
    display: inline-block;
    margin-bottom: 0.25cm;
    letter-spacing: 1.5px;
}

.moment-title {
    font-weight: 700;
    font-size: 12pt;
    color: #0a0a0a;
    margin-bottom: 0.3cm;
    margin-top: 0.1cm;
}

.moment-field {
    margin: 0.25cm 0;
    font-size: 9.5pt;
    line-height: 1.45;
}

.moment-label {
    font-weight: 700;
    color: #0a0a0a;
    text-transform: uppercase;
    font-size: 8.5pt;
    letter-spacing: 1px;
    display: block;
    margin-bottom: 3px;
}

.moment-quote {
    background: #fff;
    border-left: 3px solid #0a0a0a;
    padding: 0.25cm 0.35cm;
    margin: 0.1cm 0;
    font-style: italic;
    color: #333;
    font-size: 9.5pt;
}

.moment-impact {
    background: #F9D626;
    padding: 0.25cm 0.35cm;
    margin-top: 0.25cm;
    font-size: 9.5pt;
    color: #0a0a0a;
}

.moment-impact .moment-label {
    color: #0a0a0a;
    display: inline;
    margin-right: 6px;
}

/* ============== DATA CARD ============== */
table.data-card {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0.2cm;
    margin: 0.3cm 0;
}

table.data-card > tbody > tr > td {
    background: #f5f5f5;
    border: 1px solid #e0e0e0;
    padding: 0;
    vertical-align: top;
    width: 50%;
}

.data-block { padding: 0.35cm 0.4cm; font-size: 9pt; }

.data-block-title {
    background: #0a0a0a;
    color: #F9D626;
    padding: 5px 10px;
    margin: -0.35cm -0.4cm 0.25cm -0.4cm;
    font-size: 8.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
}

table.data-rows { width: 100%; border-collapse: collapse; }

table.data-rows td {
    padding: 4px 0;
    border-bottom: 1px dotted #d0d0d0;
    font-size: 9pt;
    vertical-align: top;
    border-left: none;
    border-right: none;
    border-top: none;
}

table.data-rows tr:last-child td { border-bottom: none; }

table.data-rows td.key { color: #555; width: 55%; }

table.data-rows td.val {
    font-weight: 600;
    color: #0a0a0a;
    text-align: right;
}

table.data-rows td.val.missing { color: #c0392b; font-weight: 700; }

/* ============== AUDITORIAS ============== */
table.audit {
    width: 100%;
    border-collapse: collapse;
    margin: 0.2cm 0;
    font-size: 9.5pt;
}

table.audit td {
    padding: 7px 10px;
    border-bottom: 1px solid #e0e0e0;
    vertical-align: top;
}

table.audit td.label-col { color: #333; width: 75%; }

table.audit td.status-col {
    text-align: right;
    font-weight: 700;
    white-space: nowrap;
    font-size: 8.5pt;
    letter-spacing: 0.5px;
    text-transform: uppercase;
}

.status-ok { color: #1e6b22; }
.status-partial { color: #b76b00; }
.status-fail { color: #b22323; }

.status-detail {
    color: #888;
    font-weight: 400;
    font-style: italic;
    font-size: 8.5pt;
    text-transform: none;
    letter-spacing: 0;
    margin-left: 8px;
}

/* ============== PRINCIPIOS ============== */
.principle-block {
    background: #f5f5f5;
    border-left: 6px solid #F9D626;
    padding: 0.45cm 0.55cm;
    margin: 0.3cm 0;
    page-break-inside: avoid;
}

.principle-title {
    font-weight: 800;
    font-size: 12pt;
    color: #0a0a0a;
    margin-bottom: 0.2cm;
}

.principle-row { margin: 0.2cm 0; font-size: 9.5pt; line-height: 1.4; }

.principle-tag {
    display: inline-block;
    background: #0a0a0a;
    color: #F9D626;
    padding: 3px 10px;
    font-size: 8pt;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    margin-right: 6px;
}

.principle-tag.detected { background: #1e6b22; color: #fff; }
.principle-tag.missed { background: #b22323; color: #fff; }

/* ============== ERRORES ============== */
table.errors {
    width: 100%;
    border-collapse: collapse;
    font-size: 9pt;
    margin: 0.2cm 0;
}

table.errors th {
    background: #0a0a0a;
    color: #F9D626;
    padding: 7px 10px;
    text-align: left;
    font-size: 8.5pt;
    text-transform: uppercase;
    letter-spacing: 1px;
}

table.errors th.center { text-align: center; }

table.errors td {
    padding: 8px 10px;
    border-bottom: 1px solid #e0e0e0;
    vertical-align: top;
}

table.errors tr.flagged { background: #fff8d6; }

table.errors td.flag {
    font-weight: 800;
    text-align: center;
    width: 70px;
    font-size: 10pt;
}

table.errors td.flag.yes { color: #b22323; }
table.errors td.flag.no { color: #999; }

.error-detail {
    font-size: 8.5pt;
    color: #666;
    margin-top: 3px;
}

/* ============== SUFICIENCIA ============== */
table.suff-summary {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0.2cm;
    margin: 0.3cm 0;
}

table.suff-summary td {
    border: 2px solid #e0e0e0;
    padding: 0.35cm 0.4cm;
    background: #fafafa;
    width: 25%;
    vertical-align: top;
}

.suff-card-label {
    font-size: 8.5pt;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #666;
    font-weight: 700;
    margin-bottom: 6px;
}

.suff-card-value {
    font-size: 12pt;
    font-weight: 800;
    color: #0a0a0a;
    line-height: 1.2;
}

.suff-card-value.partial { color: #b76b00; }
.suff-card-value.insufficient { color: #b22323; }
.suff-card-value.sufficient { color: #1e6b22; }

ul.gap-list { list-style: none; padding: 0; margin: 0.2cm 0; }

ul.gap-list li {
    padding: 0.3cm 0.4cm;
    background: #f5f5f5;
    border-left: 4px solid #F9D626;
    margin-bottom: 0.2cm;
    font-size: 9.5pt;
    page-break-inside: avoid;
}

.gap-label { font-weight: 700; color: #0a0a0a; display: block; margin-bottom: 3px; }
.gap-why { color: #555; font-style: italic; font-size: 9pt; }

/* ============== PLAN DE MEJORA ============== */
table.plan-item {
    width: 100%;
    border-collapse: collapse;
    margin: 0.25cm 0;
    background: #f5f5f5;
    border-left: 4px solid #F9D626;
    page-break-inside: avoid;
}

table.plan-item td.priority-col {
    background: #0a0a0a;
    color: #F9D626;
    text-align: center;
    font-weight: 800;
    font-size: 22pt;
    padding: 0.35cm 0.2cm;
    width: 1.4cm;
    vertical-align: middle;
}

table.plan-item td.content-col {
    padding: 0.35cm 0.45cm;
    vertical-align: top;
}

.plan-action {
    font-weight: 700;
    color: #0a0a0a;
    font-size: 10.5pt;
    margin-bottom: 4px;
    line-height: 1.35;
}

.plan-just {
    color: #555;
    font-size: 9pt;
    font-style: italic;
    line-height: 1.4;
}

/* ============== FORTALEZAS ============== */
table.strength-item {
    width: 100%;
    border-collapse: collapse;
    background: #f5f5f5;
    border-left: 4px solid #1e6b22;
    margin-bottom: 0.2cm;
    page-break-inside: avoid;
}

table.strength-item td.num-col {
    background: #1e6b22;
    color: #fff;
    width: 1.2cm;
    text-align: center;
    font-weight: 800;
    font-size: 14pt;
    vertical-align: middle;
}

table.strength-item td.body-col {
    padding: 0.3cm 0.4cm;
    font-size: 9.5pt;
    vertical-align: middle;
}

/* ============== CIERRE ============== */
.closing {
    background: #0a0a0a;
    color: #fff;
    padding: 0.9cm 0.8cm;
    margin-top: 1cm;
    page-break-inside: avoid;
}

.closing-eyebrow {
    color: #F9D626;
    font-size: 9pt;
    letter-spacing: 3px;
    text-transform: uppercase;
    font-weight: 700;
    margin-bottom: 0.3cm;
}

.closing-title {
    font-size: 18pt;
    font-weight: 800;
    line-height: 1.2;
    margin-bottom: 0.3cm;
    color: #fff;
}

.closing-body {
    color: #cccccc;
    font-size: 10pt;
    line-height: 1.55;
}

.closing-body strong { color: #F9D626; }

/* ============== UTILITIES ============== */
.muted { color: #666; font-size: 8.5pt; font-style: italic; font-weight: 400; }

.intro-text {
    background: #f5f5f5;
    padding: 0.3cm 0.4cm;
    border-left: 4px solid #F9D626;
    margin: 0.3cm 0;
    font-size: 9.5pt;
    color: #444;
    font-style: italic;
}

.note-box {
    background: #fff8d6;
    border-left: 4px solid #F9D626;
    padding: 0.35cm 0.45cm;
    margin: 0.3cm 0;
    font-size: 9.5pt;
}

.tag-quote {
    background: #fff8d6;
    padding: 1px 6px;
    font-size: 8.5pt;
    color: #6b5300;
    font-weight: 600;
}
"""


# ============================================================
# RENDERS POR SECCIÓN
# ============================================================

def _render_cover(data: dict, logo_b64: str) -> str:
    meta = data.get("metadata", {})
    score = data.get("score_total", 0)
    verdict_label, _ = _verdict_from_score(score)

    industria_map = {
        "real_estate": "Real Estate",
        "restaurantes": "Restaurantes",
        "otra": "Otra",
    }
    industria = industria_map.get(
        meta.get("industria_detectada", "otra"),
        _safe(meta.get("industria_especifica_si_otra"), "Otra")
    )
    if meta.get("industria_detectada") == "otra" and meta.get("industria_especifica_si_otra"):
        industria = f"Otra: {meta['industria_especifica_si_otra']}"

    logo_html = (
        f'<img src="{logo_b64}" class="cover-logo" alt="Zebra">'
        if logo_b64 else ""
    )

    if data.get("notas_estructurales"):
        veredicto_op = data["notas_estructurales"]
    elif score < 60:
        veredicto_op = (
            "NO COTIZAR. La llamada no produjo información suficiente. "
            "Recontactar al prospecto antes de pasar al cotizador."
        )
    elif score < 75:
        veredicto_op = (
            "Cotización posible pero con supuestos peligrosos. "
            "Hacer follow-up para llenar gaps antes de pasar al cotizador."
        )
    elif score < 90:
        veredicto_op = "Información suficiente para construir propuesta sólida."
    else:
        veredicto_op = (
            "Diagnóstico de nivel consultor senior. "
            "Usar como caso de calibración para futuras evaluaciones."
        )

    return f"""
<div class="cover">
    {logo_html}
    <div class="cover-top">
        <div class="cover-eyebrow">Zebra · Evaluación de Diagnóstico Comercial</div>
        <h1 class="cover-title">{_safe(meta.get("cliente_prospecto"))}</h1>
        <div class="cover-subtitle">Llamada diagnóstica con {_safe(meta.get("diagnosticador"), "el diagnosticador")}</div>
    </div>

    <table class="cover-meta">
        <tr>
            <td>
                <span class="label">Diagnosticador</span>
                <span class="value">{_safe(meta.get("diagnosticador"))}</span>
            </td>
            <td>
                <span class="label">Industria detectada</span>
                <span class="value">{industria}</span>
            </td>
        </tr>
        <tr>
            <td>
                <span class="label">Duración aproximada</span>
                <span class="value">~{_safe(meta.get("duracion_aproximada_min"))} minutos</span>
            </td>
            <td>
                <span class="label">Fecha de evaluación</span>
                <span class="value">{_safe(meta.get("fecha_evaluacion"))}</span>
            </td>
        </tr>
    </table>

    <div class="cover-score-block">
        <div class="cover-score-number">{score}</div>
        <div class="cover-score-info">
            <div class="out-of">/ 100</div>
            <div class="verdict">{verdict_label}</div>
        </div>
    </div>

    <div class="cover-footer">
        <strong>Veredicto operativo:</strong> {veredicto_op}
    </div>
</div>
"""


def _render_scoring(data: dict) -> str:
    scores = data.get("scores_por_eje", {})
    a = scores.get("A_cobertura_SPIN", {})
    b = scores.get("B_calidad_SPIN", {})
    c = scores.get("C_capacidad_diagnostica", {})

    return f"""
<div class="section-header">
    <span class="section-number">01 · Scoring</span>
    <h2 class="section-title">Calificación por eje</h2>
</div>

<table class="scoring">
    <thead>
        <tr>
            <th>Eje</th>
            <th class="right">Puntos</th>
            <th class="right">Sobre</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><strong>A</strong> — Cobertura SPIN Zebra</td>
            <td class="numeric">{a.get("total", 0)}</td>
            <td class="numeric">{a.get("max", 30)}</td>
        </tr>
        <tr>
            <td><strong>B</strong> — Calidad de aplicación SPIN</td>
            <td class="numeric">{b.get("total", 0)}</td>
            <td class="numeric">{b.get("max", 30)}</td>
        </tr>
        <tr>
            <td><strong>C</strong> — Capacidad diagnóstica Zebra</td>
            <td class="numeric">{c.get("total", 0)}</td>
            <td class="numeric">{c.get("max", 40)}</td>
        </tr>
        <tr class="total">
            <td><strong>TOTAL</strong></td>
            <td class="numeric">{data.get("score_total", 0)}</td>
            <td class="numeric">100</td>
        </tr>
    </tbody>
</table>

{_render_eje_a_breakdown(a)}
{_render_eje_b_breakdown(b)}
{_render_eje_c_breakdown(c)}
"""


def _render_eje_a_breakdown(a: dict) -> str:
    a1 = a.get("A1_tronco_comun", {})
    secs = a1.get("secciones", {})
    a2 = a.get("A2_modulo_industria", {})
    a3 = a.get("A3_checklist_salida", {})

    sec_names = {
        "S1_contexto_negocio": "Sección 1 — Contexto y negocio",
        "S2_oferta_mercado": "Sección 2 — Oferta y mercado",
        "S3_operacion_comercial": "Sección 3 — Operación comercial",
        "S4_diagnostico_eliminacion": "Sección 4 — Diagnóstico por eliminación",
        "S5_capacidad_expectativas": "Sección 5 — Capacidad y expectativas",
    }

    rows = ""
    for key, name in sec_names.items():
        sec = secs.get(key, {})
        rows += f"""
        <tr class="row"><td class="desc">{name}</td><td class="score">{sec.get("puntos", 0)}/{sec.get("max", 3)}</td></tr>
        <tr class="comment-row"><td colspan="2">{_safe(sec.get("comentario"))}</td></tr>
        """

    items_obt = a3.get("items_obtenidos", []) or []
    items_falt = a3.get("items_faltantes", []) or []
    a3_text = f"{len(items_obt)} de {len(items_obt) + len(items_falt)} items obtenidos."
    if items_falt:
        a3_text += f" Faltantes: <strong>{', '.join(items_falt)}</strong>."

    return f"""
<h3>Eje A — Cobertura SPIN Zebra ({a.get("total", 0)}/{a.get("max", 30)})</h3>

<div class="breakdown">
    <div class="breakdown-title">A.1 Tronco común ({a1.get("total", 0)}/{a1.get("max", 15)})</div>
    <table class="breakdown-table">{rows}</table>
</div>

<div class="breakdown">
    <div class="breakdown-title">A.2 Módulo de industria ({a2.get("puntos", 0)}/{a2.get("max", 9)})</div>
    <p style="font-size:9.5pt; margin:0.1cm 0; color:#444;">{_safe(a2.get("comentario"))}</p>
</div>

<div class="breakdown">
    <div class="breakdown-title">A.3 Checklist de salida ({a3.get("puntos", 0)}/{a3.get("max", 6)})</div>
    <p style="font-size:9.5pt; margin:0.1cm 0; color:#444;">{a3_text}</p>
</div>
"""


def _render_eje_b_breakdown(b: dict) -> str:
    subs = b.get("subdimensiones", {})
    rows_def = [
        ("B1_situacion", "B.1 Situación", 5),
        ("B2_problema", "B.2 Problema", 10),
        ("B3_implicacion", 'B.3 Implicación &nbsp;<span class="tag-quote">El eje más crítico</span>', 10),
        ("B4_necesidad_beneficio", "B.4 Necesidad-Beneficio", 5),
    ]
    rows = ""
    for key, name, mx in rows_def:
        sub = subs.get(key, {})
        rows += f"""
        <tr class="row"><td class="desc">{name}</td><td class="score">{sub.get("puntos", 0)}/{sub.get("max", mx)}</td></tr>
        <tr class="comment-row"><td colspan="2">{_safe(sub.get("comentario"))}</td></tr>
        """

    return f"""
<h3>Eje B — Calidad de aplicación SPIN ({b.get("total", 0)}/{b.get("max", 30)})</h3>
<div class="breakdown">
    <table class="breakdown-table">{rows}</table>
</div>
"""


def _render_eje_c_breakdown(c: dict) -> str:
    subs = c.get("subdimensiones", {})
    rows_def = [
        ("C1_jalar_hilos", "C.1 Jalar hilos", 9),
        ("C2_cuantificacion", "C.2 Cuantificación", 9),
        ("C3_cuello_botella_y_suficiencia_modelo", "C.3 Cuello de botella + suficiencia para modelo", 14),
        ("C4_principios_y_errores", "C.4 Principios y errores estructurales", 8),
    ]
    rows = ""
    for key, name, mx in rows_def:
        sub = subs.get(key, {})
        rows += f"""
        <tr class="row"><td class="desc">{name}</td><td class="score">{sub.get("puntos", 0)}/{sub.get("max", mx)}</td></tr>
        <tr class="comment-row"><td colspan="2">{_safe(sub.get("comentario"))}</td></tr>
        """

    return f"""
<h3>Eje C — Capacidad diagnóstica Zebra ({c.get("total", 0)}/{c.get("max", 40)})</h3>
<div class="breakdown">
    <table class="breakdown-table">{rows}</table>
</div>
"""


def _render_momentos_perdidos(data: dict) -> str:
    momentos = data.get("momentos_perdidos", []) or []
    if not momentos:
        return ""

    items = ""
    for i, m in enumerate(momentos, start=1):
        items += f"""
<div class="moment">
    <span class="moment-number">Momento {i:02d}</span>
    <div class="moment-field">
        <span class="moment-label">Cliente dijo</span>
        <div class="moment-quote">"{_safe(m.get("cita_cliente"))}"</div>
    </div>
    <div class="moment-field">
        <span class="moment-label">Diagnosticador</span>
        {_safe(m.get("accion_diagnosticador"))}
    </div>
    <div class="moment-field">
        <span class="moment-label">Pregunta que faltó</span>
        <div class="moment-quote">"{_safe(m.get("pregunta_que_faltaba"))}"</div>
    </div>
    <div class="moment-impact">
        <span class="moment-label">Por qué importa</span>{_safe(m.get("impacto_en_cotizacion"))}
    </div>
</div>
"""

    return f"""
<div class="section-header">
    <span class="section-number">02 · Momentos perdidos</span>
    <h2 class="section-title">Puertas que el cliente abrió y no se atravesaron</h2>
</div>

<div class="intro-text">
    Cada momento muestra: lo que el cliente dijo textualmente, qué hizo el diagnosticador, la pregunta exacta que debió hacer, y por qué importa para la cotización.
</div>

{items}
"""


def _render_fortalezas(data: dict) -> str:
    fortalezas = data.get("fortalezas_observadas", []) or []
    if not fortalezas:
        return ""

    items = ""
    for i, f in enumerate(fortalezas, start=1):
        items += f"""
<table class="strength-item">
    <tr><td class="num-col">{i}</td><td class="body-col">{f}</td></tr>
</table>
"""

    return f"""
<div class="section-header">
    <span class="section-number">03 · Fortalezas</span>
    <h2 class="section-title">Lo que el diagnosticador hizo bien y debe repetir</h2>
</div>

{items}
"""


def _render_data_card(data: dict) -> str:
    dc = data.get("data_card", {})

    def row(k: str, v: Any) -> str:
        val_str = _safe(v)
        cls = "val missing" if val_str in ("—", "FALTA", "Pendiente", "PENDIENTE") else "val"
        # Si el valor original es None/vacío, mostrar como FALTA
        if v is None or v == "":
            return f'<tr><td class="key">{k}</td><td class="val missing">FALTA</td></tr>'
        return f'<tr><td class="key">{k}</td><td class="{cls}">{val_str}</td></tr>'

    def bool_row(k: str, v: Any, true_str: str = "Sí", false_str: str = "No") -> str:
        if v is True:
            return f'<tr><td class="key">{k}</td><td class="val">{true_str}</td></tr>'
        if v is False:
            return f'<tr><td class="key">{k}</td><td class="val missing">{false_str}</td></tr>'
        return f'<tr><td class="key">{k}</td><td class="val missing">FALTA</td></tr>'

    ctx = dc.get("contexto", {})
    adq = dc.get("adquisicion", {})
    fun = dc.get("funnel", {})
    eqp = dc.get("equipo_comercial", {})
    seg = dc.get("seguimiento", {})
    imp = dc.get("capacidad_implementacion", {})
    exp = dc.get("expectativas", {})
    ind = dc.get("datos_industria", {}) or {}
    re_data = ind.get("real_estate") if ind else None
    rs_data = ind.get("restaurantes") if ind else None

    # Bloque de industria condicional
    industry_block = ""
    if re_data:
        cascada = re_data.get("cascada_conversion_completa")
        cascada_val = "Completa" if cascada is True else ("Incompleta" if cascada is False else None)
        industry_block = f"""
<td>
    <div class="data-block">
        <div class="data-block-title">Real Estate</div>
        <table class="data-rows">
            {row("Unidades totales", re_data.get("unidades_totales"))}
            {row("Disponibles activas", re_data.get("disponibles_activas"))}
            {row("Unidades/operación", re_data.get("unidades_por_operacion"))}
            {row("Absorción objetivo", re_data.get("absorcion_objetivo_meses"))}
            {row("Etapa proyecto", re_data.get("etapa_proyecto"))}
            {row("Cascada conversión", cascada_val)}
        </table>
    </div>
</td>
"""
    elif rs_data:
        canal_propio = rs_data.get("canal_propio_existente")
        canal_propio_val = "Sí" if canal_propio is True else ("No" if canal_propio is False else None)
        industry_block = f"""
<td>
    <div class="data-block">
        <div class="data-block-title">Restaurantes</div>
        <table class="data-rows">
            {row("Ticket delivery", rs_data.get("ticket_delivery"))}
            {row("Margen bruto/orden", rs_data.get("margen_bruto_orden"))}
            {row("Frecuencia recurrente", rs_data.get("frecuencia_cliente_recurrente"))}
            {row("Retención típica", rs_data.get("retencion_tipica"))}
            {row("Mix de canales", rs_data.get("mix_canales"))}
            {row("Plataformas + comisión", rs_data.get("plataformas_comision"))}
            {row("Capacidad cocina", rs_data.get("capacidad_cocina"))}
            {row("Canal propio existente", canal_propio_val)}
        </table>
    </div>
</td>
"""
    else:
        industry_block = "<td></td>"

    canales = adq.get("canales_actuales", []) or []
    canales_str = ", ".join(canales) if canales else None

    return f"""
<div class="section-header">
    <span class="section-number">04 · Data Card</span>
    <h2 class="section-title">Lo que sí tienes para cotizar</h2>
</div>

<table class="data-card">
    <tr>
        <td>
            <div class="data-block">
                <div class="data-block-title">Contexto</div>
                <table class="data-rows">
                    {row("Tipo de negocio", ctx.get("tipo_negocio"))}
                    {row("Ticket promedio", ctx.get("ticket_promedio"))}
                    {row("Meta mensual", ctx.get("meta_mensual"))}
                    {row("Realidad actual", ctx.get("realidad_actual"))}
                    {row("Modelo", ctx.get("modelo_negocio"))}
                    {row("Tiempo operando", ctx.get("tiempo_operando"))}
                </table>
            </div>
        </td>
        <td>
            <div class="data-block">
                <div class="data-block-title">Adquisición</div>
                <table class="data-rows">
                    {row("Canales", canales_str)}
                    {row("% por canal", adq.get("porcentaje_por_canal"))}
                    {row("Inversión pauta", adq.get("inversion_pauta_actual"))}
                    {row("CPL aproximado", adq.get("CPL_aproximado"))}
                </table>
            </div>
        </td>
    </tr>
    <tr>
        <td>
            <div class="data-block">
                <div class="data-block-title">Funnel y conversión</div>
                <table class="data-rows">
                    {row("Leads/mes", fun.get("leads_mes"))}
                    {row("% agenda", fun.get("porcentaje_agenda"))}
                    {row("% asistencia", fun.get("porcentaje_asistencia"))}
                    {row("% cierre", fun.get("porcentaje_cierre"))}
                </table>
            </div>
        </td>
        <td>
            <div class="data-block">
                <div class="data-block-title">Equipo comercial</div>
                <table class="data-rows">
                    {row("# asesores", eqp.get("numero_asesores"))}
                    {bool_row("Roles diferenciados", eqp.get("roles_diferenciados"))}
                    {bool_row("Script", eqp.get("tiene_script"))}
                    {row("CRM", eqp.get("CRM"))}
                </table>
            </div>
        </td>
    </tr>
    <tr>
        <td>
            <div class="data-block">
                <div class="data-block-title">Seguimiento</div>
                <table class="data-rows">
                    {row("# seguimientos/lead", seg.get("numero_seguimientos"))}
                    {row("Duración", seg.get("duracion"))}
                    {bool_row("Reactivación", seg.get("tiene_reactivacion"))}
                </table>
            </div>
        </td>
        <td>
            <div class="data-block">
                <div class="data-block-title">Implementación</div>
                <table class="data-rows">
                    {bool_row("Ejecutor interno identificado", imp.get("ejecutor_interno_identificado"))}
                    {row("Apertura al cambio", imp.get("apertura_al_cambio"))}
                    {row("Presupuesto", imp.get("presupuesto"))}
                </table>
            </div>
        </td>
    </tr>
    <tr>
        <td>
            <div class="data-block">
                <div class="data-block-title">Expectativas</div>
                <table class="data-rows">
                    {row("30 días", exp.get("plazo_30_dias"))}
                    {row("90 días", exp.get("plazo_90_dias"))}
                    {row("Definición de éxito", exp.get("definicion_exito"))}
                </table>
            </div>
        </td>
        {industry_block}
    </tr>
</table>
"""


def _render_auditorias(data: dict) -> str:
    p_maestras = data.get("auditoria_8_preguntas_maestras", {}) or {}
    ejes = data.get("auditoria_4_ejes_estrategicos", {}) or {}
    operativas = data.get("auditoria_5_preguntas_operativas", {}) or {}

    maestras_labels = {
        "P1_velocidad_vs_comprension": "P1 — ¿Velocidad o comprensión?",
        "P2_equipo_puede_leads_imperfectos": "P2 — ¿Equipo puede trabajar leads imperfectos?",
        "P3_volumen_vs_precision": "P3 — ¿Volumen o precisión?",
        "P4_confianza_previa_determina_compra": "P4 — ¿Confianza previa determina la compra?",
        "P5_ticket_soporta_friccion": "P5 — ¿Ticket soporta o exige fricción?",
        "P6_duda_conversando_o_explicando": "P6 — ¿La duda se resuelve conversando o explicando?",
        "P7_mercado_commoditizado": "P7 — ¿Mercado commoditizado?",
        "P8_cuello_de_botella_real": "P8 — ¿Cuello de botella real?",
    }
    maestras_rows = ""
    for key, label in maestras_labels.items():
        status = p_maestras.get(key, "imposible")
        maestras_rows += f"""
        <tr><td class="label-col">{label}</td><td class="status-col {_status_class(status)}">{_status_label(status)}</td></tr>
        """

    ejes_labels = {
        "E1_velocidad_vs_profundidad": "E1 — Velocidad vs profundidad",
        "E2_volumen_vs_intencion": "E2 — Volumen vs intención",
        "E3_capacidad_comercial_vs_dependencia_marketing": "E3 — Capacidad comercial vs dependencia marketing",
        "E4_confianza_inmediata_vs_construida": "E4 — Confianza inmediata vs construida",
    }
    ejes_rows = ""
    for key, label in ejes_labels.items():
        eje = ejes.get(key, {}) or {}
        status = eje.get("estado", "imposible")
        comentario = eje.get("comentario", "")
        detail = f'<span class="status-detail">{comentario}</span>' if comentario else ""
        ejes_rows += f"""
        <tr><td class="label-col">{label} {detail}</td><td class="status-col {_status_class(status)}">{_status_label(status)}</td></tr>
        """

    operativas_labels = {
        "PO1_tipo_de_atencion": "PO1 — ¿Qué tipo de atención captura el negocio?",
        "PO2_que_vuelve_atencion_oportunidad": "PO2 — ¿Qué necesita pasar para volver atención en oportunidad?",
        "PO3_friccion_que_ayuda_o_estorba": "PO3 — ¿Qué fricción ayuda y cuál estorba?",
        "PO4_rol_de_ventas": "PO4 — ¿Qué rol juega ventas?",
        "PO5_que_debe_ocurrir_antes_del_contacto": "PO5 — ¿Qué debe ocurrir antes del contacto?",
    }
    op_rows = ""
    for key, label in operativas_labels.items():
        status = operativas.get(key, "imposible")
        op_rows += f"""
        <tr><td class="label-col">{label}</td><td class="status-col {_status_class(status)}">{_status_label(status)}</td></tr>
        """

    return f"""
<div class="section-header">
    <span class="section-number">05 · Auditorías estructurales</span>
    <h2 class="section-title">¿El cotizador tiene base para decidir modelo?</h2>
</div>

<h3>8 Preguntas maestras de diagnóstico</h3>
<table class="audit">{maestras_rows}</table>

<h3>4 Ejes estratégicos</h3>
<table class="audit">{ejes_rows}</table>

<h3>5 Preguntas operativas</h3>
<table class="audit">{op_rows}</table>
"""


def _render_principios(data: dict) -> str:
    p = data.get("deteccion_principios_zebra", {}) or {}
    mi = p.get("monetizacion_imperfecta", {}) or {}
    fu = p.get("friccion_util", {}) or {}
    diff = p.get("diferenciacion_authority_vs_high_intent", {}) or {}

    def principle_card(title: str, suffix: str, detected: bool | None, profundizo: bool | None,
                       cita: str | None, falto: str | None) -> str:
        det_tag = '<span class="principle-tag detected">Evidencia detectada</span>' if detected else \
                  '<span class="principle-tag" style="background:#666;color:#fff;">Sin evidencia</span>'
        if profundizo is True:
            prof_tag = '<span class="principle-tag detected">Profundizó</span>'
        elif profundizo is False:
            prof_tag = '<span class="principle-tag missed">No profundizó</span>'
        else:
            prof_tag = ""

        cita_block = ""
        if cita:
            cita_block = f"""
            <div class="principle-row">
                <strong>Cita textual del cliente:</strong>
                <div class="moment-quote" style="margin-top:5px;">"{cita}"</div>
            </div>
            """

        falto_block = ""
        if falto:
            falto_block = f"""
            <div class="principle-row">
                <strong>Qué le faltó preguntar:</strong> {falto}
            </div>
            """

        return f"""
<div class="principle-block">
    <div class="principle-title">{title} <span class="muted">{suffix}</span></div>
    <div class="principle-row">{det_tag} {prof_tag}</div>
    {cita_block}
    {falto_block}
</div>
"""

    mi_block = principle_card(
        "Monetización imperfecta",
        "(señal de Sales-First)",
        mi.get("evidencia_detectada"),
        mi.get("diagnosticador_profundizo"),
        mi.get("cita_textual"),
        mi.get("que_le_falto_preguntar"),
    )

    fu_block = principle_card(
        "Fricción útil",
        "(señal de High Intent)",
        fu.get("evidencia_detectada"),
        fu.get("diagnosticador_profundizo"),
        fu.get("cita_textual"),
        fu.get("que_le_falto_preguntar"),
    )

    # Test Authority vs High Intent
    if diff.get("aplicaba_diferenciar"):
        aplicaba_tag = '<span class="principle-tag detected">Aplicaba</span>'
    else:
        aplicaba_tag = '<span class="principle-tag" style="background:#666;color:#fff;">No aplicaba</span>'

    if diff.get("diagnosticador_hizo_test") is True:
        ejecuto_tag = '<span class="principle-tag detected">Se ejecutó</span>'
    elif diff.get("diagnosticador_hizo_test") is False:
        ejecuto_tag = '<span class="principle-tag missed">No se ejecutó</span>'
    else:
        ejecuto_tag = ""

    diff_block = f"""
<div class="principle-block">
    <div class="principle-title">Test diagnóstico Authority vs High Intent</div>
    <div class="principle-row">{aplicaba_tag} {ejecuto_tag}</div>
    <div class="principle-row">{_safe(diff.get("comentario"))}</div>
</div>
"""

    return f"""
<div class="section-header">
    <span class="section-number">06 · Detección de principios Zebra</span>
    <h2 class="section-title">Evidencia textual y respuesta del diagnosticador</h2>
</div>

{mi_block}
{fu_block}
{diff_block}
"""


def _render_errores(data: dict) -> str:
    errs = data.get("deteccion_errores_estructurales", {}) or {}
    err_defs = [
        ("E1_empezar_por_canales", "E1", "Empezar por canales antes que lógica"),
        ("E2_obsesion_con_CPL", "E2", "Obsesión con CPL aceptada sin reframe"),
        ("E3_pedir_leads_perfectos_por_ventas_debiles", "E3", "Pedir leads perfectos para tapar ventas débiles"),
        ("E4_friccion_como_maquillaje", "E4", "Fricción como maquillaje aceptada"),
        ("E5_branding_sin_captura", "E5", "Branding sin captura"),
        ("E6_homogeneidad_de_mercado", "E6", "Asumir homogeneidad del mercado"),
        ("E7_no_alinear_operacion_y_promesa", "E7", "No alinear operación y promesa"),
    ]

    rows = ""
    for key, num, title in err_defs:
        e = errs.get(key, {}) or {}
        inducido = e.get("inducido_o_aceptado", False)
        cita = e.get("cita")
        if inducido:
            row_class = ' class="flagged"'
            flag_html = '<td class="flag yes">SÍ</td>'
            title_html = f"<strong>{title}.</strong>"
            if cita:
                title_html += f'<div class="error-detail">{cita}</div>'
        else:
            row_class = ""
            flag_html = '<td class="flag no">No</td>'
            title_html = title

        rows += f"""
        <tr{row_class}>
            <td><strong>{num}</strong></td>
            <td>{title_html}</td>
            {flag_html}
        </tr>
        """

    return f"""
<div class="section-header">
    <span class="section-number">07 · Errores estructurales</span>
    <h2 class="section-title">¿La conducción de la llamada indujo errores Zebra?</h2>
</div>

<table class="errors">
    <thead>
        <tr><th style="width:40px;">#</th><th>Error</th><th class="center" style="width:80px;">Detectado</th></tr>
    </thead>
    <tbody>{rows}</tbody>
</table>
"""


def _render_suficiencia(data: dict) -> str:
    suf = data.get("suficiencia_informacional", {}) or {}

    def card_class(val: str) -> str:
        val_l = (val or "").lower()
        if val_l == "suficiente":
            return "sufficient"
        if val_l == "parcial":
            return "partial"
        return "insufficient"

    def card_label(val: str) -> str:
        return {
            "suficiente": "Suficiente",
            "parcial": "Parcial",
            "insuficiente": "Insuficiente",
            "no_aplica_todavia": "No aplica todavía",
            "audito": "Auditada",
            "acepto_sin_verificar": "Aceptada sin verificar",
            "audito_parcialmente": "Parcial",
            "trafico": "Tráfico",
            "conversion": "Conversión",
            "calificacion": "Calificación",
            "seguimiento": "Seguimiento",
            "cierre": "Cierre",
            "insuficiente_evidencia": "Insuficiente evidencia",
        }.get((val or "").lower(), val or "—")

    cuello = suf.get("cuello_de_botella_detectado", "insuficiente_evidencia")
    audito = suf.get("diagnosticador_audito_la_version", "acepto_sin_verificar")
    dom = suf.get("suficiencia_modelo_dominante", "insuficiente")
    comp = suf.get("suficiencia_modelo_complementario", "no_aplica_todavia")

    cuello_class = "insufficient" if cuello == "insuficiente_evidencia" else "sufficient"
    audito_class = "sufficient" if audito == "audito" else ("partial" if audito == "audito_parcialmente" else "insufficient")

    info_perseguir = suf.get("informacion_a_perseguir_antes_de_cotizar", []) or []
    info_items = ""
    for i, item in enumerate(info_perseguir, start=1):
        info_items += f"""
<li>
    <span class="gap-label">{i}. {_safe(item.get("dato_faltante"))}</span>
    <span class="gap-why">{_safe(item.get("por_que_impide_decidir"))}</span>
</li>
"""

    nota_block = ""
    if suf.get("nota_para_cotizador"):
        nota_block = f"""
<div class="note-box">
    <strong>Nota para el cotizador:</strong> {suf["nota_para_cotizador"]}
</div>
"""

    version_cliente = _safe(suf.get("version_del_cliente_sobre_su_problema"))
    lectura_block = f"""
<div class="intro-text">
    <strong>Versión del cliente:</strong> {version_cliente}<br><br>
    <strong>Evidencia que soporta cuello de botella:</strong> {_safe(suf.get("evidencia_que_soporta_cuello"))}
</div>
"""

    return f"""
<div class="section-header">
    <span class="section-number">08 · Suficiencia informacional para el cotizador</span>
    <h2 class="section-title">¿Hay base para decidir modelo?</h2>
</div>

<table class="suff-summary">
    <tr>
        <td>
            <div class="suff-card-label">Cuello de botella</div>
            <div class="suff-card-value {cuello_class}">{card_label(cuello)}</div>
        </td>
        <td>
            <div class="suff-card-label">Versión del cliente</div>
            <div class="suff-card-value {audito_class}">{card_label(audito)}</div>
        </td>
        <td>
            <div class="suff-card-label">Modelo dominante</div>
            <div class="suff-card-value {card_class(dom)}">{card_label(dom)}</div>
        </td>
        <td>
            <div class="suff-card-label">Modelo complementario</div>
            <div class="suff-card-value {card_class(comp)}">{card_label(comp)}</div>
        </td>
    </tr>
</table>

{lectura_block}

<h3>Información a perseguir antes de pasar al cotizador</h3>
<ul class="gap-list">{info_items}</ul>

{nota_block}
"""


def _render_plan_mejora(data: dict) -> str:
    plan = data.get("plan_de_mejora", []) or []
    if not plan:
        return ""

    items = ""
    for p in plan:
        items += f"""
<table class="plan-item">
    <tr>
        <td class="priority-col">{p.get("prioridad", "—")}</td>
        <td class="content-col">
            <div class="plan-action">{_safe(p.get("accion"))}</div>
            <div class="plan-just">{_safe(p.get("justificacion"))}</div>
        </td>
    </tr>
</table>
"""

    return f"""
<div class="section-header">
    <span class="section-number">09 · Plan de mejora</span>
    <h2 class="section-title">Para la próxima llamada</h2>
</div>

{items}
"""


def _render_cierre(data: dict) -> str:
    score = data.get("score_total", 0)

    # Síntesis automática según score
    if score >= 90:
        titulo = "Diagnóstico de nivel consultor senior."
        cuerpo = (
            "La cobertura informacional, la calidad de aplicación SPIN y la capacidad de operar bajo el marco Zebra "
            "fueron sobresalientes. Esta llamada sirve como caso de calibración para futuras evaluaciones."
        )
    elif score >= 75:
        titulo = "Cotización sólida — diagnóstico cumplido."
        cuerpo = (
            "La información capturada es suficiente para que el cotizador decida modelo con criterio. "
            "Hay áreas de mejora marcadas en el plan, pero no comprometen la cotización."
        )
    elif score >= 60:
        titulo = "Cobertura sí, profundidad no."
        cuerpo = (
            "La cobertura informacional fue razonable. La calidad de aplicación SPIN y/o la capacidad de operar bajo "
            "el marco Zebra fue débil. La transcripción puede dar la falsa sensación de éxito si el cliente colaboró "
            "bien y se comprometió con siguientes pasos. "
            "<br><br><strong>No lo fue en términos diagnósticos.</strong> Fue exitosa en relación y siguiente paso, pero "
            "la información capturada es insuficiente para que el cotizador decida modelo con criterio. "
            "<br><br><strong>Antes de pasar a cotización:</strong> follow-up con el prospecto para conseguir los datos "
            "faltantes. Con eso, la cotización pasa de adivinanza a diseño."
        )
    else:
        titulo = "La llamada no produjo información suficiente para cotizar."
        cuerpo = (
            "<strong>No cotizar todavía.</strong> Recontactar al prospecto antes de pasar al builder. "
            "Hay gaps estructurales que comprometen cualquier decisión de modelo. Revisar el plan de mejora "
            "antes de la siguiente llamada con este u otro prospecto del mismo perfil."
        )

    return f"""
<div class="closing">
    <div class="closing-eyebrow">Síntesis</div>
    <div class="closing-title">{titulo}</div>
    <div class="closing-body">{cuerpo}</div>
</div>
"""


# ============================================================
# FUNCIÓN PRINCIPAL
# ============================================================

def generate_evaluation_pdf(
    evaluation_data: dict,
    output_path: str,
    logo_path: str | None = None,
) -> str:
    """
    Genera un PDF de evaluación de diagnóstico comercial Zebra.

    Args:
        evaluation_data: dict con el JSON producido por el prompt evaluador v2.2
                         (Formato 2 — JSON estructurado). Ver README para schema.
        output_path: ruta donde guardar el PDF (ej. "evaluacion_cliente.pdf")
        logo_path: ruta opcional al logo Zebra blanco (PNG/JPG).
                   Si no se provee, la portada va sin logo.

    Returns:
        La ruta del archivo generado.

    Raises:
        ValueError: si evaluation_data no tiene los campos mínimos requeridos.
    """

    # Validación mínima
    if not isinstance(evaluation_data, dict):
        raise ValueError("evaluation_data debe ser un dict")
    if "metadata" not in evaluation_data:
        raise ValueError("evaluation_data['metadata'] es requerido")
    if "score_total" not in evaluation_data:
        raise ValueError("evaluation_data['score_total'] es requerido")

    logo_b64 = _logo_to_base64(logo_path) if logo_path else ""

    html_content = f"""<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Evaluación de Diagnóstico — {_safe(evaluation_data['metadata'].get('cliente_prospecto'))}</title>
</head>
<body>
{_render_cover(evaluation_data, logo_b64)}
{_render_scoring(evaluation_data)}
{_render_momentos_perdidos(evaluation_data)}
{_render_fortalezas(evaluation_data)}
{_render_data_card(evaluation_data)}
{_render_auditorias(evaluation_data)}
{_render_principios(evaluation_data)}
{_render_errores(evaluation_data)}
{_render_suficiencia(evaluation_data)}
{_render_plan_mejora(evaluation_data)}
{_render_cierre(evaluation_data)}
</body>
</html>
"""

    HTML(string=html_content).write_pdf(
        output_path,
        stylesheets=[CSS(string=CSS_STYLES)]
    )

    return output_path


# ============================================================
# CLI (opcional)
# ============================================================

if __name__ == "__main__":
    import argparse
    import sys

    parser = argparse.ArgumentParser(
        description="Genera un PDF de evaluación de diagnóstico comercial Zebra."
    )
    parser.add_argument("input_json", help="Ruta al archivo JSON con la evaluación")
    parser.add_argument("output_pdf", help="Ruta donde guardar el PDF")
    parser.add_argument("--logo", help="Ruta al logo Zebra blanco (opcional)", default=None)
    args = parser.parse_args()

    try:
        with open(args.input_json, "r", encoding="utf-8") as f:
            eval_data = json.load(f)

        result = generate_evaluation_pdf(
            evaluation_data=eval_data,
            output_path=args.output_pdf,
            logo_path=args.logo,
        )
        print(f"✓ PDF generado: {result}")
    except Exception as e:
        print(f"✗ Error: {e}", file=sys.stderr)
        sys.exit(1)
