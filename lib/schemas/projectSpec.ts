import { z } from "zod";

export const CircuitSchema = z.object({
  board: z.object({
    id: z.string(),
    name: z.string(),
    logicVoltage: z.string(),
    platformioEnv: z.string()
  }),
  components: z.array(z.object({
    id: z.string(),
    type: z.string(),
    label: z.string(),
    value: z.string().optional()
  })),
  connections: z.array(z.object({
    from: z.string(),
    to: z.string(),
    signal: z.string(),
    wireColor: z.string(),
    note: z.string().optional()
  })),
  pins: z.array(z.object({
    component: z.string(),
    pin: z.string(),
    boardPin: z.string(),
    mode: z.string(),
    firmwareSymbol: z.string().optional()
  })),
  protocols: z.array(z.string()),
  warnings: z.array(z.string())
});

export const HardwareSchema = z.object({
  selectedMcu: z.string(),
  difficulty: z.string(),
  bom: z.array(z.object({
    item: z.string(),
    qty: z.number(),
    purpose: z.string(),
    beginnerNote: z.string()
  })),
  mcuComparison: z.array(z.object({
    mcu: z.string(),
    fit: z.string(),
    rationale: z.string()
  })),
  constraints: z.array(z.string()),
  power: z.string(),
  communications: z.array(z.string())
});

export const FirmwareSchema = z.object({
  target: z.string(),
  libraries: z.array(z.string()),
  files: z.array(z.object({
    path: z.string(),
    contents: z.string()
  }))
});

export const ProjectSpecSchema = z.object({
  id: z.string(),
  idea: z.string(),
  phase: z.enum(["IDEA", "BUILD_PLAN", "VERIFICATION", "READY_TO_BUILD", "NEEDS_REPAIR"]),
  hardware: HardwareSchema,
  circuit: CircuitSchema,
  firmware: FirmwareSchema,
  verification: z.object({
    verified: z.boolean(),
    compileProvider: z.enum(["daytona", "local", "mock"]),
    attempts: z.number(),
    logs: z.array(z.string()),
    supervisorFindings: z.array(z.string())
  }),
  buildInstructions: z.array(z.string()),
  warnings: z.array(z.string())
});

export type CircuitSpec = z.infer<typeof CircuitSchema>;
export type HardwareSpec = z.infer<typeof HardwareSchema>;
export type FirmwareSpec = z.infer<typeof FirmwareSchema>;
export type ProjectSpec = z.infer<typeof ProjectSpecSchema>;

export type AgentEvent = {
  role: string;
  status: "queued" | "running" | "ok" | "error";
  message: string;
  detail?: string;
};
