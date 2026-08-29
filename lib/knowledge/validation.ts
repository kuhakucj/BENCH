import type { ProjectSpec } from "@/lib/schemas/projectSpec";
import { findComponent, getComponent } from "./catalog";
import type { KnowledgeCheck } from "./schema";

function check(
  id: string,
  status: KnowledgeCheck["status"],
  message: string,
  beginnerExplanation: string,
  factIds: string[] = [],
  sourceIds: string[] = []
): KnowledgeCheck {
  return { id, status, message, beginnerExplanation, factIds, sourceIds };
}

function parseVoltage(value: string) {
  const match = value.match(/[0-9]+(?:\.[0-9]+)?/);
  return match ? Number(match[0]) : undefined;
}

function projectText(spec: ProjectSpec) {
  return JSON.stringify({ hardware: spec.hardware, circuit: spec.circuit }).toLowerCase();
}

function hasComponent(spec: ProjectSpec, componentId: string) {
  const text = projectText(spec);
  const component = getComponent(componentId);
  return Boolean(component && [component.name, ...component.aliases].some((alias) => text.includes(alias.toLowerCase())));
}

export function runKnowledgeChecks(spec: ProjectSpec): KnowledgeCheck[] {
  const checks: KnowledgeCheck[] = [];
  const board = findComponent(spec.hardware.selectedMcu) || getComponent(spec.circuit.board.id);
  const circuitText = JSON.stringify({
    board: spec.circuit.board,
    components: spec.circuit.components,
    connections: spec.circuit.connections,
    pins: spec.circuit.pins
  }).toLowerCase().replaceAll("3.3v", "3v3");

  checks.push(check(
    "grounding-present",
    spec.grounding.supervisor.facts.length > 0 && spec.grounding.supervisor.sources.length > 0 ? "pass" : "fail",
    `${spec.grounding.supervisor.facts.length} relevant facts from ${spec.grounding.supervisor.sources.length} trusted sources were available to the supervisor.`,
    "Bench checked this project against retrieved documentation instead of relying only on model memory."
  ));

  if (!board || board.category !== "microcontroller") {
    checks.push(check("known-board", "fail", `No reviewed board record matches ${spec.hardware.selectedMcu}.`, "Bench cannot verify pins or voltage for an unknown board."));
    return checks;
  }

  checks.push(check("known-board", "pass", `${spec.hardware.selectedMcu} matched knowledge component ${board.id}.`, "The selected board has reviewed voltage, pin, and toolchain data."));

  if (board.engineering.logicVoltageV !== undefined) {
    const circuitVoltage = parseVoltage(spec.circuit.board.logicVoltage);
    const matches = circuitVoltage === board.engineering.logicVoltageV;
    checks.push(check(
      "logic-voltage",
      matches ? "pass" : "fail",
      matches
        ? `Circuit logic voltage ${spec.circuit.board.logicVoltage} matches the verified ${board.engineering.logicVoltageV} V board value.`
        : `Circuit logic voltage ${spec.circuit.board.logicVoltage} conflicts with the verified ${board.engineering.logicVoltageV} V board value.`,
      matches ? "The signal voltage matches the board." : "Stop before wiring: the plan uses the wrong logic voltage.",
      board.id === "esp32-devkit-v1" ? ["esp32-logic-voltage"] : [],
      board.id === "esp32-devkit-v1" ? ["espressif-esp32-datasheet"] : []
    ));
  }

  if (board.engineering.platformioEnv) {
    const targetMatches = spec.circuit.board.platformioEnv === board.engineering.platformioEnv
      && spec.firmware.target === board.engineering.platformioEnv;
    checks.push(check(
      "platformio-target",
      targetMatches ? "pass" : "fail",
      targetMatches
        ? `Circuit and firmware use verified PlatformIO target ${board.engineering.platformioEnv}.`
        : `Expected PlatformIO target ${board.engineering.platformioEnv}, received circuit=${spec.circuit.board.platformioEnv} and firmware=${spec.firmware.target}.`,
      targetMatches ? "The compiler is configured for the selected board." : "The code may compile for the wrong board until this target is corrected."
    ));
  }

  for (const pin of spec.circuit.pins) {
    if (/power|ground/i.test(pin.mode)) continue;
    const boardPin = pin.boardPin.toUpperCase().replaceAll(" ", "");
    const known = board.engineering.verifiedPins?.includes(boardPin) ?? false;
    checks.push(check(
      `pin-${boardPin.toLowerCase()}`,
      known ? "pass" : "fail",
      known ? `${boardPin} is a verified usable pin on ${board.name}.` : `${boardPin} is not in the reviewed usable-pin list for ${board.name}.`,
      known ? "Bench verified this pin assignment against the board record." : "Bench will not approve a pin it cannot verify."
    ));

    if (/analog|adc/i.test(pin.mode)) {
      const isAdc = board.engineering.adcPins?.includes(boardPin) ?? false;
      checks.push(check(
        `adc-${boardPin.toLowerCase()}`,
        isAdc ? "pass" : "fail",
        isAdc ? `${boardPin} is verified for ADC input.` : `${boardPin} is not a verified ADC input on ${board.name}.`,
        isAdc ? "This pin can measure the sensor voltage." : "Move the sensor signal to a documented analog input.",
        boardPin === "GPIO34" ? ["esp32-gpio34"] : [],
        boardPin === "GPIO34" ? ["espressif-esp32-datasheet", "espressif-esp32-gpio"] : []
      ));
    }

    if (/output|pwm/i.test(pin.mode) && board.engineering.inputOnlyPins?.includes(boardPin)) {
      checks.push(check(
        `input-only-${boardPin.toLowerCase()}`,
        "fail",
        `${boardPin} is input-only but the circuit assigns output mode.`,
        "Choose another pin before connecting an LED, buzzer, servo, or motor driver.",
        boardPin === "GPIO34" ? ["esp32-gpio34"] : [],
        boardPin === "GPIO34" ? ["espressif-esp32-gpio"] : []
      ));
    }
  }

  if (hasComponent(spec, "ldr-photoresistor")) {
    const bomHasResistor = spec.hardware.bom.some((part) => /resistor/i.test(part.item));
    const circuitHas10k = spec.circuit.components.some((part) => /resistor/i.test(`${part.type} ${part.label}`) && /10k|10000/i.test(part.value || part.label));
    const hasPowerAndGround = circuitText.includes("gnd") && (circuitText.includes("3v3") || circuitText.includes("5v"));
    const unsafeFiveVolt = board.engineering.logicVoltageV === 3.3 && circuitText.includes("5v");
    const dividerOk = bomHasResistor && circuitHas10k && hasPowerAndGround && !unsafeFiveVolt;
    checks.push(check(
      "ldr-divider",
      dividerOk ? "pass" : "fail",
      dividerOk
        ? "The LDR uses a documented 10k voltage divider tied to board-safe power and ground."
        : "The LDR divider is missing a 10k resistor, explicit rails, or uses an unsafe 5 V signal.",
      dividerOk ? "The sensor can now produce a safe changing voltage." : "Do not power the circuit until the LDR divider is corrected.",
      ["ldr-divider", "ldr-rail-selection"],
      ["adafruit-photocell", ...(board.id === "esp32-devkit-v1" ? ["espressif-esp32-datasheet"] : [])]
    ));
  }

  if (hasComponent(spec, "hc-sr04") && (board.engineering.logicVoltageV || 5) < 5) {
    const hasDivider = /divider|level shifter|level-shifter/.test(circuitText)
      || spec.circuit.components.filter((part) => /resistor/i.test(`${part.type} ${part.label}`)).length >= 2;
    checks.push(check(
      "ultrasonic-echo-level",
      hasDivider ? "pass" : "fail",
      hasDivider ? "The 5 V HC-SR04 Echo path includes level reduction for the 3.3 V board." : "The HC-SR04 Echo path can reach 5 V but no level reduction is present.",
      hasDivider ? "The board input is protected." : "Add a two-resistor divider or a logic-level shifter before connecting Echo.",
      ["hcsr04-electrical", "hcsr04-esp32-divider"],
      ["sparkfun-hcsr04", "espressif-esp32-datasheet"]
    ));
  }

  if (hasComponent(spec, "led")) {
    const hasSeriesResistor = spec.hardware.bom.some((part) => /resistor/i.test(part.item))
      && spec.circuit.components.some((part) => /resistor/i.test(`${part.type} ${part.label}`));
    checks.push(check(
      "led-resistor",
      hasSeriesResistor ? "pass" : "fail",
      hasSeriesResistor ? "The external LED includes a current-limiting resistor." : "The external LED has no current-limiting resistor.",
      hasSeriesResistor ? "The resistor protects the LED and GPIO." : "Add a series resistor before powering the LED.",
      ["led-series-resistor"],
      ["arduino-built-in-examples"]
    ));
  }

  if (hasComponent(spec, "dc-motor")) {
    const hasDriver = /driver|transistor|mosfet|h-bridge/.test(projectText(spec));
    const hasProtection = /flyback|diode|protected driver/.test(projectText(spec));
    checks.push(check(
      "motor-driver",
      hasDriver && hasProtection ? "pass" : "fail",
      hasDriver && hasProtection ? "The DC motor uses a driver stage with flyback protection." : "The DC motor plan is missing a driver stage or flyback protection.",
      hasDriver && hasProtection ? "The GPIO controls the driver instead of powering the motor." : "Never connect the motor directly to a GPIO pin.",
      ["motor-driver", "motor-flyback"],
      ["sparkfun-dc-motors", "adafruit-dc-motors"]
    ));
  }

  if (hasComponent(spec, "sg90-servo")) {
    const mentionsExternalPower = /external|separate.*power|4.8v|4.8 v/.test(projectText(spec));
    checks.push(check(
      "servo-power",
      mentionsExternalPower ? "pass" : "warning",
      mentionsExternalPower ? "The SG90 plan identifies its 4.8 V power requirement." : "The SG90 plan should state its separate 4.8 V power requirement explicitly.",
      "Servo power should not be guessed from the GPIO connector.",
      ["sg90-power"],
      ["towerpro-sg90"]
    ));
  }

  return checks;
}

export function failedKnowledgeChecks(checks: KnowledgeCheck[]) {
  return checks.filter((item) => item.status === "fail");
}
