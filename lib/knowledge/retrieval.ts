import type { HardwareSpec, CircuitSpec } from "@/lib/schemas/projectSpec";
import { electronicsCatalog, findComponent } from "./catalog";
import type { EngineeringDecision, GroundingBundle, KnowledgeComponent, KnowledgeRole } from "./schema";

type RetrievalInput = {
  role: KnowledgeRole;
  idea: string;
  hardware?: HardwareSpec;
  circuit?: CircuitSpec;
};

function aliasMatches(text: string, alias: string) {
  const escaped = alias.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(text);
}

function addRelatedSupport(ids: Set<string>) {
  if (ids.has("ldr-photoresistor")) {
    ids.add("resistor");
    ids.add("voltage-divider");
    ids.add("breadboard");
    ids.add("jumper-wires");
  }
  if (ids.has("hc-sr04")) {
    ids.add("resistor");
    ids.add("voltage-divider");
  }
  if (ids.has("led")) ids.add("resistor");
}

function selectComponents(input: RetrievalInput) {
  const ids = new Set<string>();
  const projectText = [
    input.idea,
    input.hardware?.selectedMcu,
    ...(input.hardware?.bom.map((part) => part.item) || []),
    ...(input.circuit?.components.map((part) => `${part.type} ${part.label} ${part.value || ""}`) || [])
  ].filter(Boolean).join(" ").toLowerCase();

  if (input.role === "hardware") {
    for (const board of electronicsCatalog.components.filter((component) => component.category === "microcontroller")) {
      ids.add(board.id);
    }
  }

  for (const component of electronicsCatalog.components) {
    if ([component.name, ...component.aliases].some((alias) => aliasMatches(projectText, alias))) ids.add(component.id);
  }

  if (input.hardware) {
    const selectedBoard = findComponent(input.hardware.selectedMcu);
    if (selectedBoard) ids.add(selectedBoard.id);
    for (const part of input.hardware.bom) {
      const component = findComponent(part.item);
      if (component) ids.add(component.id);
    }
  }

  addRelatedSupport(ids);
  return electronicsCatalog.components.filter((component) => ids.has(component.id));
}

export function retrieveKnowledge(input: RetrievalInput): GroundingBundle {
  const components = selectComponents(input);
  const facts = components.flatMap((component) => component.facts
    .filter((fact) => fact.roles.includes(input.role))
    .map(({ roles: _roles, ...fact }) => ({
      ...fact,
      componentId: component.id,
      componentName: component.name,
      category: component.category
    })));
  const sourceIds = new Set(facts.flatMap((fact) => fact.sourceIds));

  return {
    role: input.role,
    query: input.idea,
    catalogVersion: electronicsCatalog.version,
    componentIds: components.map((component) => component.id),
    facts,
    sources: electronicsCatalog.sources.filter((source) => sourceIds.has(source.id))
  };
}

export function groundingForPrompt(bundle: GroundingBundle) {
  return {
    policy: "Use these retrieved facts as the source of truth. Never invent voltage, pin, protocol, target, or current data. If a needed fact is absent, state the uncertainty instead of guessing.",
    catalogVersion: bundle.catalogVersion,
    facts: bundle.facts.map((fact) => ({
      id: fact.id,
      component: fact.componentName,
      statement: fact.statement,
      safetyCritical: fact.safetyCritical,
      sourceIds: fact.sourceIds
    })),
    sources: bundle.sources.map((source) => ({ id: source.id, title: source.title, publisher: source.publisher }))
  };
}

function componentFacts(bundle: GroundingBundle, component: KnowledgeComponent | undefined) {
  if (!component) return [];
  return bundle.facts.filter((fact) => fact.componentId === component.id);
}

export function buildEngineeringDecisions(hardware: HardwareSpec, hardwareBundle: GroundingBundle, wiringBundle: GroundingBundle): EngineeringDecision[] {
  const selected = findComponent(hardware.selectedMcu);
  const boardFacts = componentFacts(hardwareBundle, selected);
  const safetyFacts = wiringBundle.facts.filter((fact) => fact.safetyCritical && fact.componentId !== selected?.id);
  const decisions: EngineeringDecision[] = [];

  if (selected && boardFacts.length) {
    decisions.push({
      id: "mcu-selection",
      title: `Why ${hardware.selectedMcu}?`,
      summary: "Bench compared supported boards using verified capabilities before asking the model to recommend one.",
      reasons: boardFacts.map((fact) => fact.beginnerExplanation),
      sourceIds: [...new Set(boardFacts.flatMap((fact) => fact.sourceIds))]
    });
  }

  if (safetyFacts.length) {
    decisions.push({
      id: "circuit-safety",
      title: "Why this wiring?",
      summary: "Safety-critical wiring choices are checked against the component catalog.",
      reasons: safetyFacts.slice(0, 4).map((fact) => fact.beginnerExplanation),
      sourceIds: [...new Set(safetyFacts.flatMap((fact) => fact.sourceIds))]
    });
  }
  return decisions;
}
