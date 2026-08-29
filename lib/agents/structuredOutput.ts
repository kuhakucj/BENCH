import type { z } from "zod";
import type { ChatMessage, ModelClient } from "@/lib/nosana/client";

export async function completeStructured<T>(
  model: ModelClient,
  schema: z.ZodType<T>,
  messages: ChatMessage[],
  fallback: T
): Promise<T> {
  const first = await model.completeJson(messages, fallback);
  const parsed = schema.safeParse(first);
  if (parsed.success) return parsed.data;

  const repaired = await model.completeJson([
    ...messages,
    { role: "assistant", content: JSON.stringify(first) },
    {
      role: "user",
      content: `Correct the JSON so it matches the required schema. Validation errors: ${JSON.stringify(parsed.error.issues)}`
    }
  ], fallback);
  return schema.parse(repaired);
}
