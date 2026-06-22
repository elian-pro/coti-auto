import { z } from "zod";

// Schema for the `proposal_data` object that the Zebra v3.2 cotización prompt
// must produce. Optional fields mirror the prompt's section 7.3 "campos
// opcionales que omitirás cuando no apliquen".

const itemConBullets = z.object({
  numero: z.number(),
  titulo: z.string(),
  bullets: z.array(z.string()).min(1),
});

const capa = z.object({
  nombre: z.string(),
  items: z.array(itemConBullets).min(1),
});

const arquitecturaCapas = z.object({
  modo: z.literal("capas"),
  capas: z.array(capa).min(1),
});

const arquitecturaFlat = z.object({
  modo: z.literal("flat"),
  items: z.array(itemConBullets).min(1),
});

const arquitectura = z.discriminatedUnion("modo", [
  arquitecturaCapas,
  arquitecturaFlat,
]);

export const proposalDataSchema = z.object({
  titulo_propuesta: z.string(),
  subtitulo_propuesta: z.string(),

  cliente: z.string(),
  modelo: z.string(),
  objetivo: z.string(),

  contexto: z.object({
    intro: z.string(),
    proyectos_titulo: z.string(),
    proyectos_items: z.array(z.string()),
    situacion_titulo: z.string(),
    situacion_texto: z.string(),
  }),

  diagnostico: z
    .array(
      z.object({
        titulo: z.string(),
        texto: z.string(),
      }),
    )
    .min(3)
    .max(4),

  cambio_paradigma: z.object({
    antes_titulo: z.string(),
    antes_texto: z.string(),
    despues_titulo: z.string(),
    despues_texto: z.string(),
    punchline: z.string(),
  }),

  sistema_propuesto: z.object({
    intro: z.string(),
    modelos: z
      .array(
        z.object({
          nombre: z.string(),
          descripcion: z.string(),
        }),
      )
      .min(2)
      .max(4),
  }),

  arquitectura,

  contenido: z
    .object({
      intro: z.string(),
      piezas: z.array(
        z.object({
          numero: z.number(),
          pieza: z.string(),
          funcion: z.string(),
        }),
      ),
    })
    .optional(),

  plan_implementacion: z
    .array(
      z.object({
        fase: z.string(),
        titulo: z.string(),
        actividades: z.array(z.string()),
      }),
    )
    .length(4),

  metas: z.object({
    kpis: z
      .array(
        z.object({
          valor: z.string(),
          descripcion: z.string(),
        }),
      )
      .length(3),
    escenario_base: z.object({
      titulo: z.string(),
      subtitulo: z.string(),
      bullets: z.array(z.string()),
      cierre: z.string(),
    }),
  }),

  inversion: z.object({
    setup_titulo: z.string(),
    setup_monto: z.string(),
    setup_items: z.array(z.string()),
    fee_titulo: z.string(),
    fee_monto: z.string(),
    fee_items: z.array(z.string()),
    pauta_texto: z.string(),
    pauta_fase_inicial: z.string(),
  }),

  calculadora_inputs: z
    .object({
      unidades_totales: z.number().positive(),
      ticket_promedio: z.number().positive(),
      absorcion_meses: z.number().positive(),
      sala_actual: z.number().nullable().optional(),
      tasa_cita: z.number().min(0).max(1).nullable().optional(),
      tasa_asistencia: z.number().min(0).max(1).nullable().optional(),
      tasa_apartado: z.number().min(0).max(1).nullable().optional(),
      tasa_cierre: z.number().min(0).max(1).nullable().optional(),
      cpl_override: z.number().nullable().optional(),
      porcentaje_inversion_override: z.number().nullable().optional(),
    })
    .optional(),

  genera_excel_anexo: z.boolean().optional(),

  por_que_zebra: z.object({
    agencia_normal: z.string(),
    zebra: z.string(),
    cierre: z.string(),
  }),

  cierre_final: z.array(z.string()).optional(),
  firma: z.string().optional(),
});

export type ProposalData = z.infer<typeof proposalDataSchema>;

// Branch alternativo cuando Claude detecta datos insuficientes (regla 8 del
// prompt). El wrapper original lo emite como JSON desnudo igual.
export const diagnosticoPreliminarSchema = z.object({
  status: z.literal("diagnostico_preliminar"),
  razon: z.string(),
  preguntas_criticas: z.array(z.string()).min(1),
  lo_que_si_entendimos: z.string(),
});

export type DiagnosticoPreliminar = z.infer<typeof diagnosticoPreliminarSchema>;

// Union: lo que sea que Claude responda, debe matchear uno de los dos.
export const claudeResponseSchema = z.union([
  diagnosticoPreliminarSchema,
  proposalDataSchema,
]);

export type ClaudeResponse = z.infer<typeof claudeResponseSchema>;
