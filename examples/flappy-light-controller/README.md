# Flappy Bird Light Controller

User idea:

> I want to make a Flappy Bird controller where covering a light sensor makes the bird jump.

This directory is a captured output from a real BENCH run on August 29, 2026. The run selected an ESP32 DevKit v1, grounded the design against trusted ESP32 and photocell documentation, produced an LDR plus 10k resistor voltage divider on GPIO34, generated PlatformIO firmware, and compiled it successfully in a Daytona sandbox.

## Result

- Final phase: `READY_TO_BUILD`
- Compile provider: `daytona`
- Compile attempts: `1`
- Deterministic knowledge checks: `7 passed, 0 failed`
- Supervisor: hardware, wiring, firmware symbols, and PlatformIO target were consistent

## Artifacts

- `project_spec.json` - canonical shared state, compile log, grounding, and supervisor result
- `circuit.json` - exact components, point-to-point connections, GPIO mapping, and warnings
- `grounding.json` - retrieved facts, source metadata, engineering decisions, and deterministic checks
- `firmware/platformio.ini` - ESP32 PlatformIO target
- `firmware/src/main.cpp` - firmware emitting `JUMP:1` and `JUMP:0` over USB serial
- `firmware/web-serial-demo.html` - browser-side physical controller demo

The compile result is preserved in `project_spec.json`; no verification state was fabricated for this example.
