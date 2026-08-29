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
  const firmwareText = spec.firmware.files.map((file) => file.contents).join("\n");
  for (const pin of spec.circuit.pins) {
    if (/power|ground/i.test(pin.mode)) continue;
    const pinNumber = pin.boardPin.replace(/\D/g, "");
    if (pin.firmwareSymbol && !firmwareText.includes(pin.firmwareSymbol)) {
      findings.push(`Firmware does not use circuit symbol ${pin.firmwareSymbol} for ${pin.boardPin}.`);
    }
    if (pinNumber && !firmwareText.includes(pinNumber)) {
      findings.push(`Firmware does not reference circuit pin ${pin.boardPin}.`);
    }
  }

  if (spec.firmware.target !== spec.circuit.board.platformioEnv) {
    findings.push(`Firmware target ${spec.firmware.target} does not match circuit target ${spec.circuit.board.platformioEnv}.`);
  }

  const projectText = JSON.stringify({ hardware: spec.hardware, circuit: spec.circuit }).toLowerCase();
  const usesLightResistor = /ldr|photocell|photoresistor/.test(projectText);
  if (usesLightResistor) {
    if (!spec.hardware.bom.some((part) => /resistor/.test(part.item.toLowerCase()))) {
      findings.push("The light-sensor voltage divider resistor is missing as a separate BOM item.");
    }
    if (!spec.circuit.components.some((part) => /resistor/.test(`${part.type} ${part.label}`.toLowerCase()))) {
      findings.push("The light-sensor voltage divider resistor is missing from circuit components.");
    }
    const connections = spec.circuit.connections
      .map((connection) => `${connection.from} ${connection.to} ${connection.signal} ${connection.note || ""}`)
      .join(" ")
      .toLowerCase()
      .replaceAll("3.3v", "3v3");
    if (!connections.includes("3v3") || !connections.includes("gnd") || !connections.includes("gpio34")) {
      findings.push("Light-sensor wiring must explicitly include ESP32 3V3 and GND connections.");
    }
  }

  if (spec.hardware.selectedMcu.toLowerCase().includes("esp32")) {
    if (spec.circuit.board.logicVoltage !== "3.3V") {
      findings.push("ESP32 circuit logic voltage must be exactly 3.3V.");
    }
  }

  if (firmwareText.includes("Serial.") && !spec.circuit.protocols.some((protocol) => /serial/i.test(protocol))) {
    findings.push("Firmware uses Serial but the circuit protocols do not declare USB serial.");
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
  const modelOutput = await completeStructured(model, SupervisorResultSchema, [
    { role: "system", content: supervisorPrompt },
    { role: "user", content: JSON.stringify(supervisorInput, null, 2) }
  ], fallback);
  const compileSucceeded = spec.verification.verified && spec.verification.logs.some((log) => /Sketch uses|SUCCESS/i.test(log));
  const isNonFatalDiscovery = (finding: string) => compileSucceeded && /discovery builtin:.*not found/i.test(finding);
  const modelFindings = modelOutput.findings.filter((finding) => !isNonFatalDiscovery(finding));
  const modelCorrections = modelOutput.correctionsNeeded.filter((finding) => !isNonFatalDiscovery(finding));
  const findings = [...new Set([...deterministic, ...modelFindings])];
  const correctionsNeeded = [...new Set([...deterministic, ...modelCorrections])];
  const output: SupervisorResult = {
    verified: spec.verification.verified && deterministic.length === 0 && modelCorrections.length === 0,
    findings: findings.length ? findings : ["Hardware, wiring, firmware, and Daytona verification are consistent."],
    correctionsNeeded
  };
  return { output, provider: model.provider };
}
