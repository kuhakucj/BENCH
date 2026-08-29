import { createModelClient } from "@/lib/nosana/client";
import { HardwareSchema } from "@/lib/schemas/projectSpec";
import { hardwarePrompt } from "./prompts";
import { fallbackHardware } from "./fallbacks";
import { completeStructured } from "./structuredOutput";
import { groundingForPrompt } from "@/lib/knowledge/retrieval";
import type { GroundingBundle } from "@/lib/knowledge/schema";

export async function hardwareAgent(idea: string, corrections: string[] = [], grounding?: GroundingBundle) {
  const model = createModelClient();
  const output = await completeStructured(model, HardwareSchema, [
    { role: "system", content: hardwarePrompt },
    { role: "user", content: JSON.stringify({
      idea,
      verifiedKnowledge: grounding ? groundingForPrompt(grounding) : undefined,
      supervisorCorrections: corrections
    }, null, 2) }
  ], fallbackHardware);
  return { output, provider: model.provider };
}
