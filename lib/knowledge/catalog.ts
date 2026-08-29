import rawCatalog from "@/knowledge/electronics.json";
import { KnowledgeCatalogSchema, type KnowledgeComponent } from "./schema";

export const electronicsCatalog = KnowledgeCatalogSchema.parse(rawCatalog);

function normalize(value: string) {
  return value.toLowerCase().replaceAll("ohm", "").replace(/[^a-z0-9.]+/g, " ").trim();
}

export function findComponent(value: string): KnowledgeComponent | undefined {
  const normalized = normalize(value);
  return electronicsCatalog.components.find((component) => {
    const candidates = [component.id, component.name, ...component.aliases].map(normalize);
    return candidates.some((candidate) => normalized === candidate || normalized.includes(candidate) || candidate.includes(normalized));
  });
}

export function getComponent(id: string): KnowledgeComponent | undefined {
  return electronicsCatalog.components.find((component) => component.id === id);
}

