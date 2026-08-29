# BENCH

BENCH is an AI hardware engineering team that helps beginners turn physical-computing ideas into verified builds.

Describe what you want to make, and specialist Hardware Architect, Wiring Engineer, Firmware Engineer, and Supervisor agents collaborate through a canonical shared project specification. They guide the project from component selection and exact wiring through firmware generation, compilation, repair, and beginner-friendly physical assembly.

Nosana powers the open-source AI reasoning behind the specialists. Daytona gives BENCH isolated workspaces where generated firmware is written, compiled, debugged, repaired, and recompiled before a project can be marked verified.

`IDEA -> HARDWARE -> WIRING -> CODE -> VERIFY -> BUILD`

## Sponsor Infrastructure

### Nosana - AI reasoning

Nosana provides the open-source LLM inference powering BENCH's specialist engineering agents. Hardware Architect, Wiring Engineer, Firmware Engineer, and Supervisor all call the shared inference layer with different role instructions, strict structured schemas, retrieved electronics knowledge, and the current project context.

The normal application path uses `lib/nosana/client.ts`. The swappable provider configuration is in `lib/nosana/config.ts`. Qwen3 8B deployment infrastructure is committed in `nosana/qwen3-vllm.job.json` and managed through the official `@nosana/kit` SDK in `scripts/nosana.mjs`.

### Daytona - execution and verification

Daytona provides isolated development environments where generated firmware becomes a real embedded project. BENCH creates a sandbox through `@daytona/sdk`, writes the PlatformIO files, installs toolchains when required, compiles the firmware, captures compiler output, sends failures back to the Firmware Engineer, and recompiles repaired code.

BENCH only marks firmware as verified after a successful real compile and Supervisor consistency check.

```text
User idea
  |
  v
Electronics knowledge / retrieval
  |
  v
Nosana open-source LLM inference
  |
  v
Hardware Architect -> Wiring Engineer -> Firmware Engineer
  |
  v
Canonical project_spec.json
  |
  v
Daytona sandbox
  |
  v
Create project -> write files -> install dependencies -> compile
  |                                                   |
  |                                           compiler error
  |                                                   |
  |                         Nosana firmware repair <-+
  |                                                   |
  +------------------------------------------ Daytona recompile
  |
  v
Supervisor + deterministic engineering checks
  |
  v
Verified build
```

**Remove Nosana and BENCH loses its engineering reasoning layer. Remove Daytona and BENCH loses its ability to prove that generated firmware builds.**

## Generated Is Not Verified

`GENERATED != VERIFIED`

Generated firmware becomes verified only when all three conditions hold:

1. A real Daytona sandbox builds the generated project.
2. The compile command returns exit code `0`.
3. The Supervisor confirms hardware, wiring, voltage, GPIO, protocol, library, and firmware consistency.

Development fallbacks remain available for contributors without sponsor credentials, but they always preserve `verification.verified = false`. `ALLOW_MOCK_COMPILE=1` enables a clearly labeled dry run; it can never produce `READY_TO_BUILD`.

**BENCH does not ask the AI whether its code should work. It gives the AI an execution environment and makes it prove it.**

## Where The Integrations Live

- `app/api/projects/route.ts` - production orchestrator: retrieval, all specialist calls, shared spec construction, Daytona compile loop, correction routing, Supervisor, and final phase
- `lib/agents/hardwareAgent.ts` - grounded MCU comparison, BOM, power, communications, constraints, and difficulty
- `lib/agents/wiringAgent.ts` - exact structured circuit, pins, rails, protocols, resistors, and voltage warnings
- `lib/agents/firmwareAgent.ts` - PlatformIO/Arduino firmware generation and compiler-error repair
- `lib/agents/supervisorAgent.ts` - model review plus deterministic consistency and safety gates
- `lib/nosana/client.ts` - OpenAI-compatible Nosana inference call used by every specialist
- `lib/nosana/config.ts` - swappable model provider configuration and explicit development fallback
- `nosana/qwen3-vllm.job.json` - Nosana-hosted Qwen3 8B vLLM job definition
- `scripts/nosana.mjs` - `@nosana/kit` deployment lifecycle, endpoint readiness, credits, and shutdown
- `lib/daytona/client.ts` - `@daytona/sdk` sandbox creation, file upload, command execution, and cleanup
- `lib/daytona/compileLoop.ts` - create -> write -> compile -> observe -> repair -> recompile loop
- `lib/daytona/firmwareProject.ts` - generated project files and PlatformIO compile command
- `lib/daytona/arduinoFallback.ts` - real in-sandbox Arduino CLI toolchain fallback when the PlatformIO registry is unavailable
- `lib/knowledge/` - task-specific electronics retrieval, source metadata, and deterministic validation
- `knowledge/electronics.json` - reviewed structured facts for supported beginner hardware
- `lib/schemas/projectSpec.ts` - canonical project, hardware, circuit, firmware, grounding, and verification schemas
- `examples/flappy-light-controller/` - captured, genuinely Daytona-verified demo output

Legacy `.dc.html` files and `Project_Bench/` are visual prototypes. The production application path starts at `app/page.tsx` and `app/api/projects/route.ts`.

## Shared Project State

Agents do not produce disconnected chat answers. Every run builds one `ProjectSpec` containing:

- idea and lifecycle phase
- selected MCU, BOM, alternatives, power, communications, and constraints
- exact `circuit.json` components, connections, pins, protocols, and warnings
- generated firmware target, libraries, and files
- retrieved facts, sources, decisions, and deterministic knowledge checks
- Daytona compile provider, attempts, logs, and success state
- Supervisor findings and beginner build instructions

Runs are persisted under `generated/<project-id>/` as `project_spec.json`, `circuit.json`, `grounding.json`, and firmware files.

## Grounded Electronics Knowledge

BENCH does not rely solely on model memory for hardware facts. Each specialist retrieves only the relevant trusted context from a reviewed catalog, including:

- manufacturer datasheets and board documentation
- pinouts and GPIO capabilities
- operating and logic voltages
- ADC/PWM and communication support
- sensor, actuator, resistor, divider, driver, and power requirements

The LLM reasons over that context. Deterministic properties such as voltage compatibility, pin capability, ADC support, PlatformIO target, required resistors, level shifting, and wiring-to-firmware symbols are validated separately.

```text
LLM reasoning
+ trusted electronics knowledge
+ deterministic engineering checks
+ real compilation
= a build BENCH can defend
```

## Verified Example

The target prompt is:

> I want to make a Flappy Bird controller where covering a light sensor makes the bird jump.

`examples/flappy-light-controller/` contains a captured real run with:

- ESP32 DevKit v1 and LDR plus 10k resistor voltage divider
- GPIO34 analog input and 3.3 V-safe wiring
- firmware emitting `JUMP:1` / `JUMP:0` over USB serial
- seven passing deterministic knowledge checks
- successful Daytona compile on attempt one
- final phase `READY_TO_BUILD`

The full compile evidence is preserved in the example's `project_spec.json`.

## Local Setup

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Open `http://localhost:3000`.

Required production intent:

```text
MODEL_PROVIDER=nosana
NOSANA_INFERENCE_ENDPOINT=https://your-nosana-endpoint.example/v1/chat/completions
MODEL_NAME=Qwen/Qwen3-8B
DAYTONA_API_KEY=your-server-side-key
DAYTONA_API_URL=https://app.daytona.io/api
```

See `.env.example` for Nosana deployment-control settings and optional development flags. Secrets belong only in `.env.local`, which is gitignored.

## Nosana Deployment

```bash
pnpm nosana:check   # Validate auth, credits, market, and job definition
pnpm nosana:deploy  # Start Qwen3 8B, wait for readiness, and save the endpoint
pnpm nosana:status  # Inspect deployment and endpoint health
pnpm nosana:stop    # Stop GPU usage and return local development to mock mode
```

## Validate

```bash
pnpm typecheck
pnpm build
```

## Why BENCH?

Physical computing should begin with:

> What do you want to make?

not:

> Which microcontroller do you already know how to use?

BENCH combines specialist AI agents, trusted electronics knowledge, deterministic engineering checks, and real execution to give beginners one guided path from:

> I want to make this.

to:

> I made this.
