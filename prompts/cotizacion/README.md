# Cotización · Prompt Zebra v3.2

Este directorio contiene el prompt extraído del nodo `Preparar payload Claude1`
del workflow de n8n `Zebra - Cotizador Aut`. Vive aquí porque:

- Es IP de Zebra y merece versionado en git (no enterrado en un Code node).
- El endpoint `/api/quote-direct` lo carga en tiempo de build y lo pasa a
  Anthropic como `system` con `cache_control` activado (90% más barato a partir
  de la segunda llamada que comparte system).
- Cualquier cambio se hace por PR y queda auditable.

## Archivos

| Archivo | Para qué sirve |
|---|---|
| `system_prompt.md` | El prompt completo v3.2 que define rol, framework de diagnóstico, modelos Zebra, metodología de inversión, esquema JSON, reglas de output. |
| `schema.ts` | Esquema zod del JSON `proposal_data` que Claude debe devolver. Se usa para validar antes de llamar al builder. |

## Cómo se consume

```ts
import { systemPrompt } from "@/prompts/cotizacion/system_prompt";
import { proposalSchema } from "@/prompts/cotizacion/schema";

const response = await callClaude({
  system: systemPrompt,
  user: transcripcion,
});
const data = proposalSchema.parse(response); // tira si está mal
```

## Cambios respecto a la versión n8n

Mismo contenido textual. Solo se sustituyen los escapes literales del Code node
(`\\\``, `\\n`) por sus caracteres reales. El prompt en sí no se tocó.
