import { createModelClient } from "@/lib/nosana/client";
import { FirmwareSchema, type ProjectSpec } from "@/lib/schemas/projectSpec";
import { firmwarePrompt } from "./prompts";
import { fallbackFirmware } from "./fallbacks";
import { completeStructured } from "./structuredOutput";

export async function firmwareAgent(idea: string, hardware: ProjectSpec["hardware"], circuit: ProjectSpec["circuit"], compilerError?: string) {
  const model = createModelClient();
  const output = await completeStructured(model, FirmwareSchema, [
    { role: "system", content: firmwarePrompt },
    { role: "user", content: JSON.stringify({ idea, hardware, circuit, compilerError }, null, 2) }
  ], fallbackFirmware);
  return { output, provider: model.provider };
}
