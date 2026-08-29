import type { ProjectSpec } from "@/lib/schemas/projectSpec";

export function firmwareFiles(spec: ProjectSpec): Record<string, string> {
  return Object.fromEntries(spec.firmware.files.map((file) => [file.path, file.contents]));
}

export function platformioCommand() {
  return "python3.13 -m venv .daytona/platformio-venv && .daytona/platformio-venv/bin/pip install platformio && .daytona/platformio-venv/bin/platformio run";
}
