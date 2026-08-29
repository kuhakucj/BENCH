import { z } from "zod";

export const KnowledgeRoleSchema = z.enum(["hardware", "wiring", "firmware", "supervisor"]);

export const KnowledgeSourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  publisher: z.string(),
  url: z.string().url(),
  kind: z.string()
});

const VoltageRangeSchema = z.object({
  min: z.number(),
  max: z.number(),
  nominal: z.number().optional()
});

export const EngineeringDataSchema = z.object({
  logicVoltageV: z.number().optional(),
  platformioEnv: z.string().optional(),
  verifiedPins: z.array(z.string()).optional(),
  adcPins: z.array(z.string()).optional(),
  pwmPins: z.array(z.string()).optional(),
  inputOnlyPins: z.array(z.string()).optional(),
  cautionPins: z.array(z.string()).optional(),
  excludedPins: z.array(z.string()).optional(),
  supplyVoltageV: VoltageRangeSchema.optional(),
  signalVoltageMaxV: z.number().optional(),
  requiresAnalogDivider: z.boolean().optional(),
  typicalDividerResistorOhms: z.number().optional(),
  requiresSeriesResistor: z.boolean().optional(),
  requiresDriver: z.boolean().optional(),
  requiresFlybackDiode: z.boolean().optional(),
  requiresExternalPower: z.boolean().optional()
});

export const KnowledgeFactSchema = z.object({
  id: z.string(),
  statement: z.string(),
  beginnerExplanation: z.string(),
  safetyCritical: z.boolean(),
  roles: z.array(KnowledgeRoleSchema),
  sourceIds: z.array(z.string()).min(1)
});

export const KnowledgeComponentSchema = z.object({
  id: z.string(),
  name: z.string(),
  aliases: z.array(z.string()),
  category: z.enum(["microcontroller", "sensor", "actuator", "supporting"]),
  tags: z.array(z.string()),
  engineering: EngineeringDataSchema,
  facts: z.array(KnowledgeFactSchema)
});

export const KnowledgeCatalogSchema = z.object({
  version: z.string(),
  sources: z.array(KnowledgeSourceSchema),
  components: z.array(KnowledgeComponentSchema)
});

export const RetrievedFactSchema = KnowledgeFactSchema.omit({ roles: true }).extend({
  componentId: z.string(),
  componentName: z.string(),
  category: z.string()
});

export const GroundingBundleSchema = z.object({
  role: KnowledgeRoleSchema,
  query: z.string(),
  catalogVersion: z.string(),
  componentIds: z.array(z.string()),
  facts: z.array(RetrievedFactSchema),
  sources: z.array(KnowledgeSourceSchema)
});

export const KnowledgeCheckSchema = z.object({
  id: z.string(),
  status: z.enum(["pass", "warning", "fail"]),
  message: z.string(),
  beginnerExplanation: z.string(),
  factIds: z.array(z.string()),
  sourceIds: z.array(z.string())
});

export const EngineeringDecisionSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  reasons: z.array(z.string()),
  sourceIds: z.array(z.string())
});

export const ProjectGroundingSchema = z.object({
  hardware: GroundingBundleSchema,
  wiring: GroundingBundleSchema,
  firmware: GroundingBundleSchema,
  supervisor: GroundingBundleSchema,
  decisions: z.array(EngineeringDecisionSchema),
  checks: z.array(KnowledgeCheckSchema)
});

export type KnowledgeCatalog = z.infer<typeof KnowledgeCatalogSchema>;
export type KnowledgeComponent = z.infer<typeof KnowledgeComponentSchema>;
export type KnowledgeRole = z.infer<typeof KnowledgeRoleSchema>;
export type GroundingBundle = z.infer<typeof GroundingBundleSchema>;
export type KnowledgeCheck = z.infer<typeof KnowledgeCheckSchema>;
export type EngineeringDecision = z.infer<typeof EngineeringDecisionSchema>;

