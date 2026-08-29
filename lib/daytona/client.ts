export type DaytonaWorkspace = {
  id: string;
  rootDir: string;
  writeFile(path: string, contents: string): Promise<void>;
  run(command: string, timeoutSeconds?: number): Promise<{ exitCode: number; stdout: string; stderr: string }>;
  dispose(): Promise<void>;
};

type DaytonaSdkShape = {
  Daytona?: new (config?: Record<string, unknown>) => {
    create(params?: Record<string, unknown>, options?: Record<string, unknown>): Promise<DaytonaSandbox>;
    delete(sandbox: DaytonaSandbox, timeout?: number, wait?: boolean): Promise<void>;
  };
};

type DaytonaSandbox = {
  id: string;
  getWorkDir(): Promise<string | undefined>;
  fs: {
    uploadFile(file: Buffer, remotePath: string, timeout?: number): Promise<void>;
  };
  process: {
    executeCommand(
      command: string,
      cwd?: string,
      env?: Record<string, string>,
      timeout?: number
    ): Promise<{ exitCode: number; result: string; artifacts?: { stdout?: string } }>;
  };
};

export async function createDaytonaWorkspace(): Promise<DaytonaWorkspace | null> {
  if (!process.env.DAYTONA_API_KEY) return null;

  const sdk = (await import("@daytona/sdk")) as DaytonaSdkShape;
  if (!sdk.Daytona) throw new Error("@daytona/sdk did not export Daytona.");

  const config: Record<string, unknown> = {
    apiKey: process.env.DAYTONA_API_KEY,
    apiUrl: process.env.DAYTONA_API_URL
  };
  if (process.env.DAYTONA_TARGET) config.target = process.env.DAYTONA_TARGET;
  const daytona = new sdk.Daytona(config);

  const sandbox = await daytona.create({
    language: "typescript",
    name: `bench-firmware-${Date.now()}`,
    autoDeleteInterval: 30
  }, { timeout: 120 });
  const rootDir = await sandbox.getWorkDir() || "/home/daytona";

  return {
    id: sandbox.id,
    rootDir,
    async writeFile(path: string, contents: string) {
      await sandbox.fs.uploadFile(Buffer.from(contents, "utf8"), path);
    },
    async run(command: string, timeoutSeconds = 240) {
      const result = await sandbox.process.executeCommand(command, undefined, undefined, timeoutSeconds);
      return {
        exitCode: result.exitCode,
        stdout: result.artifacts?.stdout || result.result || "",
        stderr: ""
      };
    },
    async dispose() {
      try {
        await daytona.delete(sandbox, 60, true);
      } catch {
        // Keep leaked workspaces visible rather than hiding compile results behind cleanup errors.
      }
    }
  };
}
