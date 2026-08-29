import { createModelClient } from "@/lib/nosana/client";
import type { ProjectSpec } from "@/lib/schemas/projectSpec";
import { z } from "zod";
import { supervisorPrompt } from "./prompts";
import { completeStructured } from "./structuredOutput";

export type SupervisorResult = {
  verified: boolean;
  findings: string[];
  correctionsNeeded: string[];
};

const SupervisorResultSchema = z.object({
  verified: z.boolean(),
  findings: z.array(z.string()),
  correctionsNeeded: z.array(z.string())
});

function deterministicFindings(spec: ProjectSpec): string[] {
  const findings: string[] = [];
  const sensorPin = spec.circuit.pins.find((pin) => pin.firmwareSymbol === "SENSOR_PIN");
  const firmwareText = spec.firmware.files.map((file) => file.contents).join("\n");
  if (sensorPin && !firmwareText.includes(sensorPin.boardPin.replace("GPIO", ""))) {
    findings.push(`Firmware does not appear to reference ${sensorPin.boardPin} for SENSOR_PIN.`);
  }
  if (spec.hardware.selectedMcu.toLowerCase().includes("esp32") && spec.circuit.warnings.join(" ").includes("5V")) {
    findings.push("ESP32 analog input has a 5V warning; build instructions must keep the divider on 3.3V.");
  }
  if (!spec.verification.verified) {
    findings.push("Firmware compile has not succeeded in Daytona, so the project cannot be marked verified.");
  }
  return findings;
}

export async function supervisorAgent(spec: ProjectSpec) {
  const model = createModelClient();
  const deterministic = deterministicFindings(spec);
  const fallback: SupervisorResult = {
    verified: spec.verification.verified && deterministic.every((finding) => !finding.includes("does not appear")),
    findings: deterministic.length ? deterministic : ["Hardware, wiring, firmware symbols, and PlatformIO target are internally consistent."],
    correctionsNeeded: deterministic.filter((finding) => finding.includes("does not appear"))
  };
  const supervisorInput = {
    ...spec,
    verification: {
      ...spec.verification,
      logs: spec.verification.logs.map((log) => log.slice(-2_000))
    }
  };
  const output = await completeStructured(model, SupervisorResultSchema, [
    { role: "system", content: supervisorPrompt },
    { role: "user", content: JSON.stringify(supervisorInput, null, 2) }
  ], fallback);
  return { output, provider: model.provider };
}
