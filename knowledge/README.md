# BENCH Electronics Knowledge Base

This directory is the MVP source of truth for deterministic electrical facts. It intentionally uses a small reviewed JSON catalog instead of embeddings or a vector database.

## Trust policy

1. Prefer manufacturer datasheets and official board documentation.
2. Use official toolchain documentation for compiler target identifiers.
3. Use established beginner references only when a manufacturer source does not explain the practical circuit.
4. Mark module-dependent parts explicitly instead of inventing specifications.
5. Treat voltage, pin capability, target, resistor, driver, and power checks as deterministic data, not LLM judgment.

`electronics.json` keeps machine-readable engineering values separate from beginner explanations. Every fact carries one or more source IDs. `lib/knowledge/retrieval.ts` selects only the facts relevant to an agent, and `lib/knowledge/validation.ts` checks the generated project against the structured values.

To add a component, add its source first, then its aliases, engineering fields, and role-scoped facts. A safety-critical fact must have an authoritative source and a plain-language explanation.
