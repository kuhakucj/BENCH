# BENCH Physical Computing Agent

One-day hackathon MVP for a beginner-focused AI platform that takes a physical-computing idea from natural language to a verified build plan:

`IDEA -> visible multi-agent activity -> BUILD PLAN -> VERIFICATION -> READY TO BUILD`

The existing static `.dc.html` design files are preserved as visual references. The working MVP is now a Next.js app.

## Grounded Electronics Knowledge

BENCH does not ask the model to recall electrical specifications from memory. A reviewed MVP catalog in `knowledge/electronics.json` contains structured board voltage, PlatformIO target, verified pin, ADC/PWM, divider, power, and driver facts with source metadata. It covers the supported beginner set: ESP32, Uno, Nano, Pico, LDR, ultrasonic, button, potentiometer, TMP36, PIR, LED, buzzer, SG90, DC motor, and common supporting parts.

`lib/knowledge/retrieval.ts` selects only the facts needed by each specialist. `lib/knowledge/validation.ts` then checks safety-critical values deterministically. Failed voltage, pin, ADC, target, divider, LED-resistor, ultrasonic-level, or motor-driver checks block `READY TO BUILD`, regardless of what the LLM says.

```text
USER IDEA
  -> role-specific knowledge retrieval
  -> Nosana specialist reasons over retrieved facts
  -> canonical project_spec.json
  -> Daytona compile and repair
  -> deterministic knowledge checks + Supervisor
  -> READY TO BUILD
```

The UI keeps this beginner-friendly: important choices expose collapsed `Why this?` explanations and direct source links, while detailed knowledge checks stay inspectable in the activity rail.

## Sponsor Infrastructure

### Nosana - AI Compute

Nosana hosts the open-source LLM that powers the specialist hardware engineering agents. The same Qwen3 8B-compatible endpoint is used with different system prompts for:

- `lib/agents/hardwareAgent.ts`
- `lib/agents/wiringAgent.ts`
- `lib/agents/firmwareAgent.ts`
- `lib/agents/supervisorAgent.ts`

The model layer is swappable through `lib/nosana/client.ts` and `lib/nosana/config.ts`. Nosana deployment infrastructure is committed as `nosana/qwen3-vllm.job.json` and managed by `scripts/nosana.mjs` through the official `@nosana/kit` SDK. It deploys Qwen3 8B behind vLLM's OpenAI-compatible API, checks `/v1/models`, and writes the resulting inference URL to the local server environment.

The Nosana account key is used only by the server-side deployment controls. It is deliberately separate from the optional inference bearer token and is never sent to the model endpoint. Without a live endpoint, the app uses deterministic demo fallback data and clearly labels the provider as `mock`.

### Daytona - Agent Computers

Daytona gives the AI engineering workflow an isolated execution environment where firmware can be created, compiled, observed, repaired, and recompiled.

The Daytona path lives in:

- `lib/daytona/client.ts`
- `lib/daytona/firmwareProject.ts`
- `lib/daytona/arduinoFallback.ts`
- `lib/daytona/compileLoop.ts`

The firmware verification loop is:

```text
USER IDEA
  |
  v
NOSANA Qwen3 8B on vLLM
  |
  v
Hardware Agent -> Wiring Agent -> Firmware Agent
  |
  v
DAYTONA SANDBOX
  |
  v
Create -> Write files -> Compile with PlatformIO
                         |
                         +-> If its registry is unavailable, compile with the
                             pinned GitHub-hosted Arduino/ESP32 toolchain
                         |
                         v
                    Observe errors
  |
  v
Firmware Agent repairs code when needed
  |
  v
DAYTONA recompiles
  |
  v
NOSANA Supervisor
  |
  v
VERIFIED BUILD
  |
  v
HUMAN BUILDS PHYSICAL PROJECT
```

If Daytona is removed, the app loses its real firmware compile and repair loop. It will not display `READY TO BUILD` unless the compile state is verified.

If Nosana is removed, the app loses its specialist AI engineering team. The local fallback is only for demos and development without credentials.

## Canonical Project State

Every run produces a canonical `project_spec.json` under `generated/<project-id>/` plus:

- `circuit.json`
- `grounding.json` with role-specific evidence, sources, decisions, and deterministic checks
- generated PlatformIO firmware files
- verification logs and supervisor findings

The shared spec includes project description, MCU selection, BOM, voltage notes, pin assignments, protocols, libraries, wiring, firmware target, build status, warnings, and verification results.

## Demo Prompt

```text
I want to build a physical controller for Flappy Bird where covering/uncovering a light sensor controls the bird.
```

Expected result:

- ESP32 DevKit v1 recommendation
- LDR + 10k resistor voltage divider
- GPIO34 analog input wiring
- Arduino/PlatformIO firmware emitting `JUMP:1` and `JUMP:0` over serial
- beginner build instructions
- browser-game control through the generated Web Serial demo

## Wiring Visualization

Fritzing can export views through its desktop application, but reliable fully headless server-side generation inside a Linux automation sandbox is not dependable enough for the MVP path. The app therefore uses `lib/renderers/circuitRenderer.ts`, a replaceable renderer interface backed by `circuit.json`.

The current renderer supports the known beginner set needed for the demo and is structured so a later Fritzing renderer can replace it without changing agent outputs.

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```text
MODEL_PROVIDER=nosana
NOSANA_INFERENCE_ENDPOINT=https://your-nosana-endpoint.example/v1/chat/completions
NOSANA_INFERENCE_API_KEY=
MODEL_NAME=Qwen/Qwen3-8B

NOSANA_CONTROL_API_KEY=
NOSANA_DEPLOYMENT_ID=
NOSANA_MARKET=CA5pMpqkYFKtme7K31pNB1s62X2SdhEv1nN9RdxKCpuQ
NOSANA_TIMEOUT_MINUTES=120

DAYTONA_API_KEY=
DAYTONA_API_URL=https://app.daytona.io/api
# Optional. Blank uses the organization's default region.
DAYTONA_TARGET=

ALLOW_MOCK_COMPILE=1
```

Important: `ALLOW_MOCK_COMPILE=1` keeps local demos moving when credentials are absent, but it does not create a verified build.

## Nosana Deployment

The lifecycle is explicit so the GPU is not left running accidentally:

```bash
# Read-only: validate authentication, credits, market, and job definition
pnpm nosana:check

# Create a draft, start it, wait for Qwen, and save its inference URL
pnpm nosana:deploy

# Publish a corrected job definition as a new deployment revision
pnpm nosana:update

# Inspect deployment, endpoint health, and remaining credits
pnpm nosana:status

# Stop the GPU service when the demo is finished
pnpm nosana:stop
```

`nosana:deploy` updates `.env.local`; restart the Next.js process afterward. Agent activity should then report `provider=nosana` for all four specialist calls. `nosana:stop` returns `MODEL_PROVIDER` to `mock` so the local app remains usable without calling a stopped endpoint.

## Run

```bash
pnpm install
pnpm dev
```

Then open `http://localhost:3000`.

## Validate

```bash
pnpm typecheck
pnpm build
```
