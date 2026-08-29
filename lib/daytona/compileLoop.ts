import type { AgentEvent, ProjectSpec } from "@/lib/schemas/projectSpec";
import { firmwareAgent } from "@/lib/agents/firmwareAgent";
import { createDaytonaWorkspace } from "./client";
import { firmwareFiles, platformioCommand } from "./firmwareProject";
import { compileWithArduino, isPlatformIoRegistryFailure, prepareArduinoFallback } from "./arduinoFallback";

export type CompileLoopResult = {
  spec: ProjectSpec;
  events: AgentEvent[];
};

async function writeFirmware(workspace: Awaited<ReturnType<typeof createDaytonaWorkspace>>, files: Record<string, string>) {
  if (!workspace) return;
  for (const [path, contents] of Object.entries(files)) {
    await workspace.writeFile(path, contents);
  }
}

export async function runDaytonaCompileLoop(initialSpec: ProjectSpec, maxAttempts = 2): Promise<CompileLoopResult> {
  const events: AgentEvent[] = [];
  const spec = structuredClone(initialSpec) as ProjectSpec;

  events.push({ role: "Daytona", status: "running", message: "Creating isolated firmware workspace" });
  const workspace = await createDaytonaWorkspace();

  if (!workspace) {
    const mockAllowed = process.env.ALLOW_MOCK_COMPILE === "1";
    events.push({
      role: "Daytona",
      status: mockAllowed ? "ok" : "error",
      message: mockAllowed ? "Daytona credentials missing; demo dry run completed without verified build" : "Daytona credentials missing; real compile skipped",
      detail: "Set DAYTONA_API_KEY to enable real sandbox creation and PlatformIO compilation."
    });
    spec.verification = {
      verified: false,
      compileProvider: mockAllowed ? "mock" : "daytona",
      attempts: 0,
      logs: ["No Daytona credentials were configured. This is not a verified firmware build."],
      supervisorFindings: []
    };
    return { spec, events };
  }

  try {
    spec.verification.compileProvider = "daytona";
    let useArduinoFallback = false;
    let arduinoReady = false;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      events.push({ role: "Daytona", status: "running", message: `Writing firmware files, attempt ${attempt}` });
      await writeFirmware(workspace, firmwareFiles(spec));

      let result;
      const logs: string[] = [];
      if (!useArduinoFallback) {
        events.push({ role: "Daytona", status: "running", message: "Installing PlatformIO and compiling firmware" });
        result = await workspace.run(platformioCommand(), 300);
        logs.push(result.stdout, result.stderr);
        useArduinoFallback = result.exitCode !== 0 && isPlatformIoRegistryFailure(logs.join("\n"));
      }

      if (useArduinoFallback) {
        events.push({ role: "Daytona", status: "running", message: "PlatformIO registry unavailable; preparing Arduino CLI fallback" });
        if (!arduinoReady) {
          const setup = await prepareArduinoFallback(workspace);
          logs.push(setup.log);
          arduinoReady = setup.ok;
        }
        result = arduinoReady
          ? await compileWithArduino(workspace, spec.firmware.files.find((file) => file.path === "src/main.cpp")?.contents || "")
          : { exitCode: 1, stdout: "Arduino CLI fallback setup failed.", stderr: "" };
        logs.push(result.stdout, result.stderr);
      }

      const log = logs.filter(Boolean).join("\n");
      spec.verification.logs.push(log);
      spec.verification.attempts = attempt;

      if (result && result.exitCode === 0) {
        spec.verification.verified = true;
        events.push({
          role: "Daytona",
          status: "ok",
          message: useArduinoFallback ? "Arduino CLI build succeeded in Daytona" : "PlatformIO build succeeded in Daytona",
          detail: workspace.id
        });
        return { spec, events };
      }

      events.push({ role: "Daytona", status: "error", message: "Compilation failed; sending compiler output back to Firmware Engineer", detail: log.slice(0, 600) });
      const repaired = await firmwareAgent(spec.idea, spec.hardware, spec.circuit, log, [], spec.grounding.firmware);
      spec.firmware = repaired.output;
      events.push({ role: "Firmware Engineer", status: "running", message: "Repairing firmware from Daytona compiler output" });
    }

    spec.verification.verified = false;
    events.push({ role: "Daytona", status: "error", message: "Compile loop ended without a successful build" });
    return { spec, events };
  } finally {
    await workspace.dispose();
  }
}
