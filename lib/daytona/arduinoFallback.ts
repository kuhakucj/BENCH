import type { DaytonaWorkspace } from "./client";

const ARDUINO_CLI_VERSION = "1.5.1";
const ESP32_CORE_VERSION = "2.0.17";
const ESP32_INDEX_URL = "https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json";

type CommandResult = { exitCode: number; stdout: string; stderr: string };

function pruneScript() {
  return `import { readFile, writeFile } from "node:fs/promises";

const source = JSON.parse(await readFile(".daytona/full_esp32_index.json", "utf8"));
const sourcePackage = source.packages.find((item) => item.name === "esp32");
const platform = sourcePackage.platforms.find((item) => item.version === "${ESP32_CORE_VERSION}");
if (!platform) throw new Error("ESP32 core ${ESP32_CORE_VERSION} was not found in the official index.");

const compileTools = new Set(["xtensa-esp32-elf-gcc", "esptool_py", "mkspiffs", "mklittlefs"]);
platform.toolsDependencies = platform.toolsDependencies.filter(
  (dependency) => dependency.packager === "esp32" && compileTools.has(dependency.name)
);
const required = new Set(platform.toolsDependencies.map((dependency) => dependency.name + "@" + dependency.version));
sourcePackage.platforms = [platform];
sourcePackage.tools = sourcePackage.tools.filter((tool) => required.has(tool.name + "@" + tool.version));

await writeFile(
  ".daytona/package_bench_esp32_index.json",
  JSON.stringify({ packages: [sourcePackage] })
);
`;
}

async function runStep(workspace: DaytonaWorkspace, command: string, timeoutSeconds = 120): Promise<CommandResult> {
  return workspace.run(command, timeoutSeconds);
}

export function isPlatformIoRegistryFailure(log: string) {
  return [
    "HTTPClientError",
    "api.registry.platformio.org",
    "externally-managed-environment",
    "ensurepip is not available"
  ].some((marker) => log.includes(marker));
}

export async function prepareArduinoFallback(workspace: DaytonaWorkspace) {
  const base = `${workspace.rootDir}/.daytona`;
  const logs: string[] = [];
  await workspace.writeFile(".daytona/prune-index.mjs", pruneScript());
  await workspace.writeFile(".daytona/package_index.json", JSON.stringify({ packages: [] }));
  await workspace.writeFile(".daytona/library_index.json", JSON.stringify({ libraries: [] }));

  const steps: Array<[string, number?]> = [
    ["mkdir -p .daytona/bin"],
    [`curl -L --fail --retry 3 -o .daytona/arduino-cli.tar.gz https://github.com/arduino/arduino-cli/releases/download/v${ARDUINO_CLI_VERSION}/arduino-cli_${ARDUINO_CLI_VERSION}_Linux_64bit.tar.gz`, 180],
    ["tar -xzf .daytona/arduino-cli.tar.gz -C .daytona/bin arduino-cli"],
    ["mkdir -p .daytona/ctags"],
    ["curl -L --fail --retry 3 -o .daytona/ctags.tar.bz2 https://github.com/arduino/ctags/releases/download/5.8-arduino11/ctags-5.8-arduino11-x86_64-pc-linux-gnu.tar.bz2", 120],
    ["tar -xjf .daytona/ctags.tar.bz2 -C .daytona/ctags"],
    [`curl -L --fail --retry 3 -o .daytona/full_esp32_index.json ${ESP32_INDEX_URL}`, 120],
    ["node .daytona/prune-index.mjs"],
    [`mkdir -p ${workspace.rootDir}/.arduino15`],
    [`cp .daytona/package_index.json ${workspace.rootDir}/.arduino15/package_index.json`],
    [`cp .daytona/library_index.json ${workspace.rootDir}/.arduino15/library_index.json`],
    ["python3 -m pip install --user esptool==4.5.1", 180],
    [`.daytona/bin/arduino-cli core install esp32:esp32@${ESP32_CORE_VERSION} --additional-urls file://${base}/package_bench_esp32_index.json --no-overwrite --log-level info`, 600]
  ];

  for (const [command, timeout] of steps) {
    const result = await runStep(workspace, command, timeout);
    logs.push(result.stdout, result.stderr);
    if (result.exitCode !== 0) {
      return { ok: false, log: logs.filter(Boolean).join("\n") };
    }
  }

  return { ok: true, log: logs.filter(Boolean).join("\n") };
}

export async function compileWithArduino(workspace: DaytonaWorkspace, mainCpp: string) {
  const base = `${workspace.rootDir}/.daytona`;
  await workspace.writeFile(".daytona/firmware/firmware.ino", mainCpp);
  return workspace.run(
    `.daytona/bin/arduino-cli compile --fqbn esp32:esp32:esp32 --build-path .daytona/build --build-property runtime.tools.ctags.path=${base}/ctags --additional-urls file://${base}/package_bench_esp32_index.json .daytona/firmware`,
    600
  );
}
