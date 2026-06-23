import { z } from "zod";

// Schema del evaluador v2.3. Es deliberadamente PERMISIVO: validamos los
// campos top-level que el builder Python espera, dejamos nested como
// objetos/arrays con passthrough para no rechazar variantes legítimas.

const seccionPuntos = z.object({
  puntos: z.number().int().min(0),
  max: z.number().int().min(1),
  comentario: z.string().optional().default(""),
});

const ejeSubdims = z.record(z.string(), seccionPuntos);

export const evaluationSchema = z
  .object({
    metadata: z
      .object({
        cliente_prospecto: z.string(),
        diagnosticador: z.string(),
        industria_detectada: z.string(),
        industria_especifica_si_otra: z.string().nullable().optional(),
        duracion_aproximada_min: z.number().optional(),
        fecha_evaluacion: z.string().optional(),
      })
      .passthrough(),
    score_total: z.number().min(0).max(100),
    veredicto: z.enum(["no_cotizar", "llenar_gaps", "cotizar", "excelente"]),
    scores_por_eje: z
      .object({
        A_cobertura_SPIN: z.unknown(),
        B_calidad_SPIN: z.unknown(),
        C_capacidad_diagnostica: z.unknown(),
      })
      .passthrough(),
    momentos_perdidos: z.array(z.unknown()).optional().default([]),
    fortalezas_observadas: z.array(z.string()).optional().default([]),
    data_card: z.unknown().optional(),
    auditoria_8_preguntas_maestras: z.unknown().optional(),
    auditoria_4_ejes_estrategicos: z.unknown().optional(),
    auditoria_5_preguntas_operativas: z.unknown().optional(),
    deteccion_principios_zebra: z.unknown().optional(),
    deteccion_errores_estructurales: z.unknown().optional(),
    suficiencia_informacional: z.unknown().optional(),
    plan_de_mejora: z.array(z.unknown()).optional().default([]),
    notas_estructurales: z.string().nullable().optional(),
  })
  .passthrough();

export type EvaluationData = z.infer<typeof evaluationSchema>;

// Branch "no se pudo evaluar" — protocolo de cuando la transcripción no
// alcanza siquiera para un scoring honesto.
export const evaluationFallbackSchema = z.object({
  status: z.literal("evaluacion_no_aplicable"),
  razon: z.string(),
});
export type EvaluationFallback = z.infer<typeof evaluationFallbackSchema>;

export const evaluationResponseSchema = z.union([
  evaluationFallbackSchema,
  evaluationSchema,
]);
export type EvaluationResponse = z.infer<typeof evaluationResponseSchema>;
