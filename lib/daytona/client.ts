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

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    let sandbox: DaytonaSandbox | undefined;
    try {
      sandbox = await daytona.create({
        language: "typescript",
        name: `bench-firmware-${Date.now()}-${attempt}`,
        autoDeleteInterval: 30
      }, { timeout: 120 });
      const activeSandbox = sandbox;
      const rootDir = await activeSandbox.getWorkDir() || "/home/daytona";

      return {
        id: activeSandbox.id,
        rootDir,
        async writeFile(path: string, contents: string) {
          await activeSandbox.fs.uploadFile(Buffer.from(contents, "utf8"), path);
        },
        async run(command: string, timeoutSeconds = 240) {
          const result = await activeSandbox.process.executeCommand(command, undefined, undefined, timeoutSeconds);
          return {
            exitCode: result.exitCode,
            stdout: result.artifacts?.stdout || result.result || "",
            stderr: ""
          };
        },
        async dispose() {
          try {
            await daytona.delete(activeSandbox, 60, true);
          } catch {
            // Keep leaked workspaces visible rather than hiding compile results behind cleanup errors.
          }
        }
      };
    } catch (error) {
      if (sandbox) {
        try {
          await daytona.delete(sandbox, 60, true);
        } catch {
          // Retry creation even if cleanup of the partial sandbox fails.
        }
      }
      const message = error instanceof Error ? `${error.message} ${(error as NodeJS.ErrnoException).code || ""}` : String(error);
      const transient = /ECONNRESET|ETIMEDOUT|fetch failed|socket hang up|network/i.test(message);
      if (!transient || attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 1_500));
    }
  }

  throw new Error("Daytona workspace creation exhausted all retries.");
}
