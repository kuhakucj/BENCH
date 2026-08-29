import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { hardwareAgent } from "@/lib/agents/hardwareAgent";
import { wiringAgent } from "@/lib/agents/wiringAgent";
import { firmwareAgent } from "@/lib/agents/firmwareAgent";
import { supervisorAgent } from "@/lib/agents/supervisorAgent";
import { runDaytonaCompileLoop } from "@/lib/daytona/compileLoop";
import { renderCircuit } from "@/lib/renderers/circuitRenderer";
import { ProjectSpecSchema, type AgentEvent, type ProjectSpec } from "@/lib/schemas/projectSpec";
import { buildEngineeringDecisions, retrieveKnowledge } from "@/lib/knowledge/retrieval";

export const runtime = "nodejs";

function projectId() {
  return `bench-${Date.now()}`;
}

async function persistSpec(spec: ProjectSpec) {
  const outDir = path.join(process.cwd(), "generated", spec.id);
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, "project_spec.json"), JSON.stringify(spec, null, 2));
  await writeFile(path.join(outDir, "circuit.json"), JSON.stringify(spec.circuit, null, 2));
  await writeFile(path.join(outDir, "grounding.json"), JSON.stringify(spec.grounding, null, 2));
  for (const file of spec.firmware.files) {
    const target = path.join(outDir, "firmware", file.path);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, file.contents);
  }
  return outDir;
}

export async function POST(request: Request) {
  const { idea } = await request.json();
  if (!idea || typeof idea !== "string") {
    return NextResponse.json({ error: "Idea is required." }, { status: 400 });
  }

  const events: AgentEvent[] = [
    { role: "IDEA", status: "ok", message: "Captured project goal" },
    { role: "Knowledge Base", status: "running", message: "Retrieving verified board and component facts for Hardware Architect" }
  ];

  try {
    const hardwareGrounding = retrieveKnowledge({ role: "hardware", idea });
    events.push({ role: "Knowledge Base", status: "ok", message: `Grounded Hardware Architect with ${hardwareGrounding.facts.length} facts from ${hardwareGrounding.sources.length} sources` });
    events.push({ role: "Hardware Architect", status: "running", message: "Reasoning on Nosana over retrieved hardware facts" });
    const hardware = await hardwareAgent(idea, [], hardwareGrounding);
    events.push({ role: "Hardware Architect", status: "ok", message: `Selected ${hardware.output.selectedMcu}`, detail: `provider=${hardware.provider}` });

    events.push({ role: "Knowledge Base", status: "running", message: "Retrieving pin, voltage, and divider facts for Wiring Engineer" });
    const wiringGrounding = retrieveKnowledge({ role: "wiring", idea, hardware: hardware.output });
    events.push({ role: "Knowledge Base", status: "ok", message: `Grounded Wiring Engineer with ${wiringGrounding.facts.length} safety-aware facts` });
    events.push({ role: "Wiring Engineer", status: "running", message: "Designing circuit.json from verified pin and voltage data" });
    const circuit = await wiringAgent(idea, hardware.output, [], wiringGrounding);
    events.push({ role: "Wiring Engineer", status: "ok", message: `Mapped ${circuit.output.pins.length} pin connections`, detail: `provider=${circuit.provider}` });

    events.push({ role: "Knowledge Base", status: "running", message: "Retrieving board target and firmware restrictions" });
    const firmwareGrounding = retrieveKnowledge({ role: "firmware", idea, hardware: hardware.output, circuit: circuit.output });
    events.push({ role: "Knowledge Base", status: "ok", message: `Grounded Firmware Engineer with ${firmwareGrounding.facts.length} implementation facts` });
    events.push({ role: "Firmware Engineer", status: "running", message: "Generating PlatformIO firmware from circuit.json" });
    const firmware = await firmwareAgent(idea, hardware.output, circuit.output, undefined, [], firmwareGrounding);
    events.push({ role: "Firmware Engineer", status: "ok", message: `Generated ${firmware.output.files.length} firmware files`, detail: `provider=${firmware.provider}` });

    const supervisorGrounding = retrieveKnowledge({ role: "supervisor", idea, hardware: hardware.output, circuit: circuit.output });

    const initialSpec: ProjectSpec = {
      id: projectId(),
      idea,
      phase: "VERIFICATION",
      hardware: hardware.output,
      circuit: circuit.output,
      firmware: firmware.output,
      grounding: {
        hardware: hardwareGrounding,
        wiring: wiringGrounding,
        firmware: firmwareGrounding,
        supervisor: supervisorGrounding,
        decisions: buildEngineeringDecisions(hardware.output, hardwareGrounding, wiringGrounding),
        checks: []
      },
      verification: {
        verified: false,
        compileProvider: "daytona",
        attempts: 0,
        logs: [],
        supervisorFindings: []
      },
      buildInstructions: [
        "Place the ESP32 across the center gap of the breadboard.",
        "Connect one LDR leg to ESP32 3V3.",
        "Connect the other LDR leg to GPIO34 and to one side of the 10k resistor.",
        "Connect the other side of the 10k resistor to ESP32 GND.",
        "Flash the generated PlatformIO firmware.",
        "Open the included Web Serial demo, connect to the ESP32, and cover the LDR to trigger jumps."
      ],
      warnings: [...hardware.output.constraints, ...circuit.output.warnings]
    };

    let compile = await runDaytonaCompileLoop(initialSpec, 2);
    events.push(...compile.events);

    events.push({ role: "Knowledge Base", status: "ok", message: `Supervisor received ${supervisorGrounding.facts.length} retrieved facts and deterministic engineering rules` });
    events.push({ role: "Supervisor", status: "running", message: "Checking hardware, wiring, firmware, voltage, sources, and build consistency" });
    let supervised = await supervisorAgent(compile.spec);

    if (!compile.spec.verification.verified || !supervised.output.verified) {
      const corrections = [...new Set([...supervised.output.correctionsNeeded, ...supervised.output.findings])];
      events.push({
        role: "Supervisor",
        status: "running",
        message: "Routing consistency corrections back through the specialist agents",
        detail: `provider=${supervised.provider}`
      });

      events.push({ role: "Hardware Architect", status: "running", message: "Revising BOM and power constraints from supervisor findings" });
      const revisedHardwareGrounding = retrieveKnowledge({ role: "hardware", idea });
      const revisedHardware = await hardwareAgent(idea, corrections, revisedHardwareGrounding);
      events.push({ role: "Hardware Architect", status: "ok", message: `Revised ${revisedHardware.output.selectedMcu} hardware plan`, detail: `provider=${revisedHardware.provider}` });

      events.push({ role: "Wiring Engineer", status: "running", message: "Correcting exact circuit topology from supervisor findings" });
      const revisedWiringGrounding = retrieveKnowledge({ role: "wiring", idea, hardware: revisedHardware.output });
      const revisedCircuit = await wiringAgent(idea, revisedHardware.output, corrections, revisedWiringGrounding);
      events.push({ role: "Wiring Engineer", status: "ok", message: `Revised ${revisedCircuit.output.connections.length} circuit connections`, detail: `provider=${revisedCircuit.provider}` });

      events.push({ role: "Firmware Engineer", status: "running", message: "Regenerating firmware against the corrected circuit" });
      const revisedFirmwareGrounding = retrieveKnowledge({ role: "firmware", idea, hardware: revisedHardware.output, circuit: revisedCircuit.output });
      const revisedFirmware = await firmwareAgent(idea, revisedHardware.output, revisedCircuit.output, undefined, corrections, revisedFirmwareGrounding);
      events.push({ role: "Firmware Engineer", status: "ok", message: `Regenerated ${revisedFirmware.output.files.length} firmware files`, detail: `provider=${revisedFirmware.provider}` });

      const revisedSpec: ProjectSpec = {
        ...compile.spec,
        phase: "VERIFICATION",
        hardware: revisedHardware.output,
        circuit: revisedCircuit.output,
        firmware: revisedFirmware.output,
        grounding: {
          hardware: revisedHardwareGrounding,
          wiring: revisedWiringGrounding,
          firmware: revisedFirmwareGrounding,
          supervisor: retrieveKnowledge({ role: "supervisor", idea, hardware: revisedHardware.output, circuit: revisedCircuit.output }),
          decisions: buildEngineeringDecisions(revisedHardware.output, revisedHardwareGrounding, revisedWiringGrounding),
          checks: []
        },
        verification: {
          verified: false,
          compileProvider: "daytona",
          attempts: 0,
          logs: [],
          supervisorFindings: corrections
        },
        warnings: [...revisedHardware.output.constraints, ...revisedCircuit.output.warnings]
      };

      compile = await runDaytonaCompileLoop(revisedSpec, 2);
      events.push(...compile.events);
      events.push({ role: "Supervisor", status: "running", message: "Rechecking corrected hardware, wiring, firmware, and Daytona build" });
      supervised = await supervisorAgent(compile.spec);
    }

    const finalSpec: ProjectSpec = {
      ...compile.spec,
      phase: compile.spec.verification.verified && supervised.output.verified ? "READY_TO_BUILD" : "NEEDS_REPAIR",
      verification: {
        ...compile.spec.verification,
        supervisorFindings: supervised.output.findings
      }
    };
    events.push({
      role: "Supervisor",
      status: finalSpec.phase === "READY_TO_BUILD" ? "ok" : "error",
      message: finalSpec.phase === "READY_TO_BUILD" ? "System verified" : "Build needs repair before physical assembly",
      detail: `provider=${supervised.provider}`
    });

    const artifactPath = await persistSpec(finalSpec);
    const parsed = ProjectSpecSchema.parse(finalSpec);
    return NextResponse.json({
      spec: parsed,
      events,
      circuitSvg: renderCircuit(parsed.circuit),
      artifactPath
    });
  } catch (error) {
    events.push({ role: "Supervisor", status: "error", message: "Flow stopped", detail: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Project generation failed.", events }, { status: 500 });
  }
}
