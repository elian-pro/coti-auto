import Anthropic from "@anthropic-ai/sdk";

// Clasificación de errores de la API de Claude para dar mensajes accionables
// al operador en vez del genérico "Claude falló: ...".
export type ClaudeErrorKind =
  | "billing"     // Sin saldo / cuenta suspendida
  | "auth"        // API key inválida
  | "rate_limit"  // 429
  | "overloaded"  // 529 modelo saturado
  | "server"      // 500 lado Anthropic
  | "network"     // Fallo de red / timeout
  | "unknown";

export type ClassifiedClaudeError = {
  kind: ClaudeErrorKind;
  message: string;
  status: number;
  rawMessage?: string;
};

const BILLING_HINTS = [
  "credit balance",
  "credit_balance",
  "insufficient",
  "billing",
  "payment",
  "quota",
  "your organization has been suspended",
];

export function classifyAnthropicError(error: unknown): ClassifiedClaudeError {
  if (error instanceof Anthropic.APIError) {
    const rawMessage = error.message ?? "";
    const lower = rawMessage.toLowerCase();

    // Billing / sin saldo. Anthropic lo devuelve como 400 BadRequest con el
    // mensaje "Your credit balance is too low..." — no hay un tipo dedicado.
    if (BILLING_HINTS.some((hint) => lower.includes(hint))) {
      return {
        kind: "billing",
        message:
          "Sin saldo en la API de Anthropic. Recarga créditos en " +
          "https://console.anthropic.com/settings/billing y reintenta.",
        status: 402,
        rawMessage,
      };
    }

    if (error instanceof Anthropic.AuthenticationError) {
      return {
        kind: "auth",
        message:
          "La ANTHROPIC_API_KEY es inválida o fue revocada. Actualiza la " +
          "env var en EasyPanel y redeploya.",
        status: 401,
        rawMessage,
      };
    }

    if (error instanceof Anthropic.RateLimitError) {
      return {
        kind: "rate_limit",
        message:
          "Demasiadas peticiones a Claude ahora mismo. Espera un minuto y " +
          "reintenta.",
        status: 429,
        rawMessage,
      };
    }

    if (error.status === 529) {
      return {
        kind: "overloaded",
        message:
          "Claude está saturado en este momento (modelo sobrecargado). " +
          "Reintenta en un par de minutos.",
        status: 503,
        rawMessage,
      };
    }

    if (error instanceof Anthropic.InternalServerError) {
      return {
        kind: "server",
        message: "Anthropic tuvo un error interno. Reintenta en un rato.",
        status: 502,
        rawMessage,
      };
    }

    if (error instanceof Anthropic.APIConnectionError) {
      return {
        kind: "network",
        message:
          "No pudimos conectar con Anthropic (fallo de red o timeout). Reintenta.",
        status: 504,
        rawMessage,
      };
    }

    return {
      kind: "unknown",
      message: `Anthropic respondió ${error.status}: ${rawMessage.slice(0, 200)}`,
      status: 502,
      rawMessage,
    };
  }

  const raw = error instanceof Error ? error.message : String(error);
  return {
    kind: "unknown",
    message: `Claude falló: ${raw}`,
    status: 502,
    rawMessage: raw,
  };
}

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Falta ANTHROPIC_API_KEY. Configúrala en EasyPanel para que el endpoint pueda llamar a Claude.",
    );
  }
  client = new Anthropic({ apiKey });
  return client;
}

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-7";
const DEFAULT_MAX_TOKENS = Number.parseInt(
  process.env.ANTHROPIC_MAX_TOKENS ?? "16000",
  10,
);

export type CallClaudeArgs = {
  systemPrompt: string;
  userContent: string;
  model?: string;
  maxTokens?: number;
};

export type CallClaudeResult = {
  rawText: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
};

export async function callClaude({
  systemPrompt,
  userContent,
  model = DEFAULT_MODEL,
  maxTokens = DEFAULT_MAX_TOKENS,
}: CallClaudeArgs): Promise<CallClaudeResult> {
  const response = await getClient().messages.create({
    model,
    max_tokens: maxTokens,
    // Prompt caching: el system es ~34 KB y prácticamente nunca cambia.
    // Marcándolo como cacheable, Anthropic descuenta ~90% del costo de input
    // a partir de la segunda llamada que comparte el mismo system.
    system: [
      {
        type: "text",
        text: systemPrompt,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: userContent,
      },
    ],
  });

  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === "text",
  );
  if (!textBlock) {
    throw new Error("Claude no devolvió bloque de texto. Respuesta inesperada.");
  }

  return {
    rawText: textBlock.text,
    usage: response.usage as CallClaudeResult["usage"],
  };
}
