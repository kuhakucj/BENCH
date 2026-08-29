import { createModelClient } from "@/lib/nosana/client";
import { CircuitSchema, type ProjectSpec } from "@/lib/schemas/projectSpec";
import { wiringPrompt } from "./prompts";
import { fallbackCircuit } from "./fallbacks";
import { completeStructured } from "./structuredOutput";
import { groundingForPrompt } from "@/lib/knowledge/retrieval";
import type { GroundingBundle } from "@/lib/knowledge/schema";

export async function wiringAgent(idea: string, hardware: ProjectSpec["hardware"], corrections: string[] = [], grounding?: GroundingBundle) {
  const model = createModelClient();
  const output = await completeStructured(model, CircuitSchema, [
    { role: "system", content: wiringPrompt },
    { role: "user", content: JSON.stringify({
      idea,
      hardware,
      verifiedKnowledge: grounding ? groundingForPrompt(grounding) : undefined,
      supervisorCorrections: corrections
    }, null, 2) }
  ], fallbackCircuit);
  return { output, provider: model.provider };
}
