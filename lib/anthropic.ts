import Anthropic from "@anthropic-ai/sdk";

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
