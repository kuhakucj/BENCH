import { createModelClient } from "@/lib/nosana/client";
import { FirmwareSchema, type ProjectSpec } from "@/lib/schemas/projectSpec";
import { firmwarePrompt } from "./prompts";
import { fallbackFirmware } from "./fallbacks";
import { completeStructured } from "./structuredOutput";
import { groundingForPrompt } from "@/lib/knowledge/retrieval";
import type { GroundingBundle } from "@/lib/knowledge/schema";

export async function firmwareAgent(
  idea: string,
  hardware: ProjectSpec["hardware"],
  circuit: ProjectSpec["circuit"],
  compilerError?: string,
  corrections: string[] = [],
  grounding?: GroundingBundle
) {
  const model = createModelClient();
  const output = await completeStructured(model, FirmwareSchema, [
    { role: "system", content: firmwarePrompt },
    { role: "user", content: JSON.stringify({
      idea,
      hardware,
      circuit,
      compilerError,
      verifiedKnowledge: grounding ? groundingForPrompt(grounding) : undefined,
      supervisorCorrections: corrections
    }, null, 2) }
  ], fallbackFirmware);
  return { output, provider: model.provider };
}
