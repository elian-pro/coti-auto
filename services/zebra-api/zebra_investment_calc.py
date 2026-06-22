"""
zebra_investment_calc.py

Módulo de cálculos financieros para propuestas Zebra.
Implementa la calculadora de inversión por valor de proyecto y la proyección
a 12 meses con escalamiento de asesores y ventanas de conversión.

Aplicable a casos con INVENTARIO FINITO (real estate, autos, productos físicos
con stock). NO aplicar a servicios recurrentes o productos con inventario ilimitado.

Trigger de aplicación: solo si el prospecto declara los 3 datos críticos:
- Unidades totales del inventario
- Ticket promedio
- Velocidad de absorción objetivo (en meses)
"""

from typing import Optional, Dict, List, Any
from dataclasses import dataclass, field


# =============================================================================
# CONSTANTES ZEBRA — ESTÁNDARES OPERATIVOS
# =============================================================================

# % de inversión sobre valor del proyecto.
# Promedio fijo como punto de partida. Se documenta como tal en la propuesta.
PORCENTAJE_INVERSION_DEFAULT = 0.03

# CPL por banda de ticket (MXN)
CPL_PREMIUM = 450        # Ticket > $5M MXN
CPL_MEDIO = 350          # Ticket $1.5M – $5M MXN
CPL_BAJO = 250           # Ticket < $1.5M MXN

# Bandas de ticket (MXN)
UMBRAL_TICKET_PREMIUM = 5_000_000
UMBRAL_TICKET_MEDIO = 1_500_000

# Capacidad estándar Zebra
LEADS_DIA_POR_ASESOR = 4
DIAS_PROMEDIO_MES = 30.4
LEADS_MES_POR_ASESOR = LEADS_DIA_POR_ASESOR * DIAS_PROMEDIO_MES  # ≈121.6

# Crecimiento mensual de la sala de ventas (asesores nuevos por mes)
CRECIMIENTO_ASESORES_POR_MES = 2

# Sala mínima de arranque cuando el cliente no declara una existente
SALA_MINIMA_INICIAL = 2

# Benchmarks Zebra Real Estate (defaults si el cliente no declara mejores tasas)
TASA_CITA_DEFAULT = 0.20      # ≥20% agenda sobre leads
TASA_ASISTENCIA_DEFAULT = 0.30  # ≥30% asistencia sobre cita
TASA_APARTADO_DEFAULT = 0.25    # ≥25% apartado sobre asistencia
TASA_CIERRE_DEFAULT = 0.80      # ≥80% cierre sobre apartado

# Ventanas de conversión Real Estate (días)
VENTANA_CITA_DIAS = 10
VENTANA_APARTADO_DIAS = 45
VENTANA_CIERRE_DIAS = 90

# Multiplicadores de unidades por operación (mix de compra)
MULTIPLICADORES_UNIDADES = [1.0, 1.2, 1.4, 1.6]


# =============================================================================
# HELPERS DE CLASIFICACIÓN
# =============================================================================

def clasificar_ticket(ticket: float) -> str:
    """Clasifica el ticket en una banda: 'premium', 'medio', 'bajo'."""
    if ticket >= UMBRAL_TICKET_PREMIUM:
        return 'premium'
    elif ticket >= UMBRAL_TICKET_MEDIO:
        return 'medio'
    else:
        return 'bajo'


def cpl_por_ticket(ticket: float) -> int:
    """Devuelve CPL estándar Zebra según la banda de ticket."""
    banda = clasificar_ticket(ticket)
    return {'premium': CPL_PREMIUM, 'medio': CPL_MEDIO, 'bajo': CPL_BAJO}[banda]


# =============================================================================
# TABLA 1 — CALCULADORA DE INVERSIÓN
# =============================================================================

@dataclass
class CalculadoraInversionInput:
    """Inputs requeridos para la calculadora de inversión."""
    unidades_totales: int
    ticket_promedio: float
    absorcion_meses: int
    # Tasas de conversión (opcionales — usa benchmarks Zebra si se omiten)
    tasa_cita: Optional[float] = None
    tasa_asistencia: Optional[float] = None
    tasa_apartado: Optional[float] = None
    tasa_cierre: Optional[float] = None
    # Override opcional de CPL
    cpl_override: Optional[float] = None
    # Override opcional del % de inversión
    porcentaje_inversion_override: Optional[float] = None


@dataclass
class CalculadoraInversionOutput:
    """Resultados de la calculadora de inversión."""
    # Inputs efectivos (para trazabilidad)
    unidades_totales: int
    ticket_promedio: float
    absorcion_meses: int
    cpl: float
    porcentaje_inversion: float
    tasas: Dict[str, float]

    # Cálculos
    valor_proyecto: float
    cpa_estimado: float
    presupuesto_total: float
    roa: float
    unidades_objetivo_mensuales: float
    inversion_pauta_mensual: float
    leads_esperados_mensuales: int
    capacidad_max_mensual_por_asesor: int
    sala_necesaria: int
    # Eficiencia comercial esperada (cascada del funnel)
    citas_esperadas: float
    asistencias_esperadas: float
    apartados_esperados: float
    cierres_esperados: float


def calcular_inversion(inp: CalculadoraInversionInput) -> CalculadoraInversionOutput:
    """
    Aplica la lógica de ingeniería inversa de la Calculadora Zebra.
    Replica la hoja 'Calculadoras de Inversion' del Excel DEMO.
    """
    # Inputs efectivos
    cpl = inp.cpl_override if inp.cpl_override is not None else cpl_por_ticket(inp.ticket_promedio)
    pct_inv = (inp.porcentaje_inversion_override
               if inp.porcentaje_inversion_override is not None
               else PORCENTAJE_INVERSION_DEFAULT)
    tasa_cita = inp.tasa_cita if inp.tasa_cita is not None else TASA_CITA_DEFAULT
    tasa_asis = inp.tasa_asistencia if inp.tasa_asistencia is not None else TASA_ASISTENCIA_DEFAULT
    tasa_apart = inp.tasa_apartado if inp.tasa_apartado is not None else TASA_APARTADO_DEFAULT
    tasa_cierre = inp.tasa_cierre if inp.tasa_cierre is not None else TASA_CIERRE_DEFAULT

    # Cálculos principales
    valor_proyecto = inp.unidades_totales * inp.ticket_promedio
    presupuesto_total = valor_proyecto * pct_inv
    cpa_estimado = pct_inv * inp.ticket_promedio
    roa = valor_proyecto / presupuesto_total if presupuesto_total > 0 else 0
    unidades_obj_mensuales = inp.unidades_totales / inp.absorcion_meses
    inversion_pauta_mensual = presupuesto_total / inp.absorcion_meses
    leads_esperados = int(inversion_pauta_mensual / cpl)
    capacidad_max = int(LEADS_MES_POR_ASESOR)
    # ROUNDDOWN como en el Excel: floor del cociente
    sala_necesaria = max(1, leads_esperados // capacidad_max)

    # Cascada del funnel (esperada)
    citas = tasa_cita * leads_esperados
    asistencias = tasa_asis * citas
    apartados = tasa_apart * asistencias
    cierres = tasa_cierre * apartados

    return CalculadoraInversionOutput(
        unidades_totales=inp.unidades_totales,
        ticket_promedio=inp.ticket_promedio,
        absorcion_meses=inp.absorcion_meses,
        cpl=cpl,
        porcentaje_inversion=pct_inv,
        tasas={'cita': tasa_cita, 'asistencia': tasa_asis,
                'apartado': tasa_apart, 'cierre': tasa_cierre},
        valor_proyecto=valor_proyecto,
        cpa_estimado=cpa_estimado,
        presupuesto_total=presupuesto_total,
        roa=roa,
        unidades_objetivo_mensuales=unidades_obj_mensuales,
        inversion_pauta_mensual=inversion_pauta_mensual,
        leads_esperados_mensuales=leads_esperados,
        capacidad_max_mensual_por_asesor=capacidad_max,
        sala_necesaria=sala_necesaria,
        citas_esperadas=citas,
        asistencias_esperadas=asistencias,
        apartados_esperados=apartados,
        cierres_esperados=cierres,
    )


# =============================================================================
# TABLA 2 — PROYECCIÓN A 12 MESES
# =============================================================================

@dataclass
class PlanInversionInput:
    """Inputs para la proyección a 12 meses."""
    calculadora: CalculadoraInversionOutput
    # Sala actual del cliente (None si no declaró)
    sala_actual: Optional[int] = None


@dataclass
class MesProyeccion:
    """Resultados de un mes específico."""
    mes: int
    asesores_activos: int
    leads_generados: float
    inversion_pauta: float
    # Embudo potencial (sin ventanas)
    citas_potenciales: float
    asistencias_potenciales: float
    apartados_potenciales: float
    cierres_potenciales: float
    # Embudo real (con ventanas — los cierres ocurren con lag)
    citas_reales: float
    asistencias_reales: float
    apartados_reales: float
    cierres_reales: float
    # Ingresos por escenario de unidades por operación
    ingresos_por_escenario: Dict[float, float] = field(default_factory=dict)
    # Margen
    margen_por_escenario: Dict[float, float] = field(default_factory=dict)
    # ROA
    roa_por_escenario: Dict[float, float] = field(default_factory=dict)


@dataclass
class TrimestreProyeccion:
    """Resumen trimestral."""
    trimestre: int
    asesores_promedio: float
    leads_total: float
    inversion_total: float
    citas_reales: float
    asistencias_reales: float
    apartados_reales: float
    cierres_reales: float
    ingresos_por_escenario: Dict[float, float]
    margen_por_escenario: Dict[float, float]
    roa_por_escenario: Dict[float, float]


@dataclass
class PlanInversionOutput:
    meses: List[MesProyeccion]
    trimestres: List[TrimestreProyeccion]
    # Totales 12 meses
    asesores_promedio_anual: float
    leads_total_anual: float
    inversion_total_anual: float
    cierres_reales_anual: float
    ingresos_anual_por_escenario: Dict[float, float]
    margen_anual_por_escenario: Dict[float, float]
    roa_anual_por_escenario: Dict[float, float]
    # Trazabilidad de la sala
    sala_inicial: int
    sala_final: int
    sala_objetivo: int  # = sala_necesaria de la calculadora


def _construir_plan_asesores(sala_actual: Optional[int],
                              sala_objetivo: int,
                              meses: int = 12) -> List[int]:
    """
    Construye la trayectoria mes a mes de asesores activos.

    Reglas:
    - Si NO hay sala_actual → arranca en SALA_MINIMA_INICIAL (2) y crece +CRECIMIENTO_ASESORES_POR_MES (2) por mes hasta llegar a sala_objetivo. Luego se mantiene.
    - Si sala_actual >= sala_objetivo → mantiene sala_actual los 12 meses (no escalar).
    - Si sala_actual < sala_objetivo → arranca en sala_actual y crece +2 por mes hasta llegar a sala_objetivo. Luego se mantiene.
    """
    if sala_actual is None:
        inicio = SALA_MINIMA_INICIAL
    elif sala_actual >= sala_objetivo:
        return [sala_actual] * meses
    else:
        inicio = sala_actual

    plan = []
    actual = inicio
    for mes in range(meses):
        plan.append(actual)
        if actual < sala_objetivo:
            actual = min(sala_objetivo, actual + CRECIMIENTO_ASESORES_POR_MES)
    return plan


def _factor_ventana_mes_n(ventana_dias: int, n: int) -> float:
    """
    Calcula el factor de un mes 'n' (0=actual, 1=siguiente, ...) para una ventana de N días.
    Replica las fórmulas del Excel:
      mes 0: max(0, (DIAS_MES - ventana) / DIAS_MES)
      mes 1 (si ventana > DIAS_MES): max(0, min(1, (2*DIAS - ventana) / DIAS))
      mes 2 (si ventana > 2*DIAS_MES): max(0, min(1, (3*DIAS - ventana) / DIAS))
      etc.
    El factor representa qué fracción de los 'eventos generados en el mes n meses atrás'
    se materializan en el mes actual.
    """
    dias = DIAS_PROMEDIO_MES
    if n == 0:
        return max(0.0, (dias - ventana_dias) / dias)
    elif n == 1:
        if ventana_dias <= dias:
            return min(ventana_dias / dias, 1.0)
        else:
            return max(0.0, min(1.0, (2 * dias - ventana_dias) / dias))
    elif n == 2:
        if ventana_dias <= dias:
            return 0.0
        elif ventana_dias <= 2 * dias:
            return max(0.0, min(1.0, (ventana_dias - dias) / dias))
        else:
            return max(0.0, min(1.0, (3 * dias - ventana_dias) / dias))
    elif n == 3:
        if ventana_dias <= 2 * dias:
            return 0.0
        elif ventana_dias <= 3 * dias:
            return max(0.0, min(1.0, (ventana_dias - 2 * dias) / dias))
        else:
            return 0.0
    return 0.0


def _aplicar_ventana(potenciales_por_mes: List[float],
                       ventana_dias: int) -> List[float]:
    """
    Convierte una serie de eventos potenciales generados cada mes
    en una serie de eventos reales materializados cada mes,
    aplicando el lag de ventana.
    """
    n_meses = len(potenciales_por_mes)
    reales = [0.0] * n_meses
    for mes_actual in range(n_meses):
        for n_atras in range(4):  # ventanas máximas hasta 90 días = ~3 meses
            mes_origen = mes_actual - n_atras
            if mes_origen < 0:
                continue
            factor = _factor_ventana_mes_n(ventana_dias, n_atras)
            reales[mes_actual] += potenciales_por_mes[mes_origen] * factor
    return reales


def calcular_plan_12_meses(inp: PlanInversionInput) -> PlanInversionOutput:
    """
    Genera la proyección mensual y trimestral a 12 meses.
    Replica la hoja 'Plan' del Excel DEMO.
    """
    calc = inp.calculadora
    sala_objetivo = calc.sala_necesaria
    plan_asesores = _construir_plan_asesores(inp.sala_actual, sala_objetivo, meses=12)

    # Cálculo de leads e inversión por mes
    leads_por_mes = [a * LEADS_MES_POR_ASESOR for a in plan_asesores]
    inversion_por_mes = [l * calc.cpl for l in leads_por_mes]

    # Embudo potencial por mes (sin ventanas)
    citas_pot = [l * calc.tasas['cita'] for l in leads_por_mes]
    asis_pot = [c * calc.tasas['asistencia'] for c in citas_pot]
    apart_pot = [a * calc.tasas['apartado'] for a in asis_pot]
    cierr_pot = [a * calc.tasas['cierre'] for a in apart_pot]

    # Embudo real con ventanas
    citas_reales = _aplicar_ventana(citas_pot, VENTANA_CITA_DIAS)
    # Las asistencias siguen a las citas reales (proporción simple)
    asis_reales = [c * calc.tasas['asistencia'] for c in citas_reales]
    # Apartados con su propia ventana, basados en apartados potenciales
    apart_reales = _aplicar_ventana(apart_pot, VENTANA_APARTADO_DIAS)
    # Cierres con su propia ventana, basados en cierres potenciales
    cierr_reales = _aplicar_ventana(cierr_pot, VENTANA_CIERRE_DIAS)

    # Construir meses con escenarios
    meses = []
    for i in range(12):
        ingresos_esc = {}
        margen_esc = {}
        roa_esc = {}
        for mult in MULTIPLICADORES_UNIDADES:
            ingreso = cierr_reales[i] * calc.ticket_promedio * mult
            ingresos_esc[mult] = ingreso
            margen_esc[mult] = ingreso - inversion_por_mes[i]
            roa_esc[mult] = ingreso / inversion_por_mes[i] if inversion_por_mes[i] > 0 else 0

        meses.append(MesProyeccion(
            mes=i + 1,
            asesores_activos=plan_asesores[i],
            leads_generados=leads_por_mes[i],
            inversion_pauta=inversion_por_mes[i],
            citas_potenciales=citas_pot[i],
            asistencias_potenciales=asis_pot[i],
            apartados_potenciales=apart_pot[i],
            cierres_potenciales=cierr_pot[i],
            citas_reales=citas_reales[i],
            asistencias_reales=asis_reales[i],
            apartados_reales=apart_reales[i],
            cierres_reales=cierr_reales[i],
            ingresos_por_escenario=ingresos_esc,
            margen_por_escenario=margen_esc,
            roa_por_escenario=roa_esc,
        ))

    # Resúmenes trimestrales
    trimestres = []
    for q in range(4):
        meses_q = meses[q * 3:(q + 1) * 3]
        ases_prom = sum(m.asesores_activos for m in meses_q) / 3
        leads_t = sum(m.leads_generados for m in meses_q)
        inv_t = sum(m.inversion_pauta for m in meses_q)
        citas_t = sum(m.citas_reales for m in meses_q)
        asis_t = sum(m.asistencias_reales for m in meses_q)
        apart_t = sum(m.apartados_reales for m in meses_q)
        cierr_t = sum(m.cierres_reales for m in meses_q)

        ing_esc = {}
        marg_esc = {}
        roa_esc = {}
        for mult in MULTIPLICADORES_UNIDADES:
            ing_esc[mult] = sum(m.ingresos_por_escenario[mult] for m in meses_q)
            marg_esc[mult] = ing_esc[mult] - inv_t
            roa_esc[mult] = ing_esc[mult] / inv_t if inv_t > 0 else 0

        trimestres.append(TrimestreProyeccion(
            trimestre=q + 1,
            asesores_promedio=ases_prom,
            leads_total=leads_t,
            inversion_total=inv_t,
            citas_reales=citas_t,
            asistencias_reales=asis_t,
            apartados_reales=apart_t,
            cierres_reales=cierr_t,
            ingresos_por_escenario=ing_esc,
            margen_por_escenario=marg_esc,
            roa_por_escenario=roa_esc,
        ))

    # Totales anuales
    asesores_prom_anual = sum(m.asesores_activos for m in meses) / 12
    leads_anual = sum(m.leads_generados for m in meses)
    inv_anual = sum(m.inversion_pauta for m in meses)
    cierr_anual = sum(m.cierres_reales for m in meses)
    ing_anual = {mult: sum(m.ingresos_por_escenario[mult] for m in meses)
                 for mult in MULTIPLICADORES_UNIDADES}
    marg_anual = {mult: ing_anual[mult] - inv_anual for mult in MULTIPLICADORES_UNIDADES}
    roa_anual = {mult: ing_anual[mult] / inv_anual if inv_anual > 0 else 0
                  for mult in MULTIPLICADORES_UNIDADES}

    return PlanInversionOutput(
        meses=meses,
        trimestres=trimestres,
        asesores_promedio_anual=asesores_prom_anual,
        leads_total_anual=leads_anual,
        inversion_total_anual=inv_anual,
        cierres_reales_anual=cierr_anual,
        ingresos_anual_por_escenario=ing_anual,
        margen_anual_por_escenario=marg_anual,
        roa_anual_por_escenario=roa_anual,
        sala_inicial=plan_asesores[0],
        sala_final=plan_asesores[-1],
        sala_objetivo=sala_objetivo,
    )


# =============================================================================
# HELPERS DE FORMATO PARA PRESENTACIÓN
# =============================================================================

def fmt_mxn(valor: float, decimals: int = 0) -> str:
    """Formatea un número como '$1,234,567 MXN'."""
    if decimals == 0:
        return f"${valor:,.0f} MXN"
    return f"${valor:,.{decimals}f} MXN"


def fmt_short_mxn(valor: float) -> str:
    """Formatea como '$1.2M' o '$345K' o '$1,234'."""
    if valor >= 1_000_000:
        return f"${valor / 1_000_000:.1f}M"
    elif valor >= 1_000:
        return f"${valor / 1_000:.0f}K"
    else:
        return f"${valor:,.0f}"


def fmt_pct(valor: float, decimals: int = 0) -> str:
    """Formatea 0.034 → '3.4%'."""
    return f"{valor * 100:.{decimals}f}%"


def fmt_int(valor: float) -> str:
    """Formatea como entero con separador de miles."""
    return f"{int(round(valor)):,}"


def fmt_roa(valor: float) -> str:
    """Formatea ROA como '33x' o '33.5x'."""
    if valor == int(valor):
        return f"{int(valor)}x"
    return f"{valor:.1f}x"
