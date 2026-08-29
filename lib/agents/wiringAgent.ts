import { createModelClient } from "@/lib/nosana/client";
import { CircuitSchema, type ProjectSpec } from "@/lib/schemas/projectSpec";
import { wiringPrompt } from "./prompts";
import { fallbackCircuit } from "./fallbacks";
import { completeStructured } from "./structuredOutput";

export async function wiringAgent(idea: string, hardware: ProjectSpec["hardware"]) {
  const model = createModelClient();
  const output = await completeStructured(model, CircuitSchema, [
    { role: "system", content: wiringPrompt },
    { role: "user", content: JSON.stringify({ idea, hardware }, null, 2) }
  ], fallbackCircuit);
  return { output, provider: model.provider };
}
