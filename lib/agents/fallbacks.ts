import type { CircuitSpec, ProjectSpec } from "@/lib/schemas/projectSpec";

export const fallbackHardware: ProjectSpec["hardware"] = {
  selectedMcu: "ESP32 DevKit v1",
  difficulty: "Beginner",
  bom: [
    { item: "ESP32 DevKit v1", qty: 1, purpose: "Reads the light sensor and sends jump state over USB serial.", beginnerNote: "More capable than an Uno and has plenty of analog-capable pins." },
    { item: "LDR photoresistor", qty: 1, purpose: "Detects covered versus uncovered light level.", beginnerNote: "Its resistance changes with light." },
    { item: "10k ohm resistor", qty: 1, purpose: "Forms a voltage divider with the LDR.", beginnerNote: "Needed so the ESP32 can read a voltage, not just a loose sensor." },
    { item: "Breadboard", qty: 1, purpose: "No-solder prototype area.", beginnerNote: "Keeps the build reversible." },
    { item: "Jumper wires", qty: 6, purpose: "Connects the circuit.", beginnerNote: "Use red for 3.3V and black for ground." },
    { item: "USB cable", qty: 1, purpose: "Powers and programs the ESP32.", beginnerNote: "Also carries serial data to the browser bridge." }
  ],
  mcuComparison: [
    { mcu: "ESP32 DevKit v1", fit: "Best", rationale: "3.3V logic, analog input, USB serial, fast iteration, and enough room to later add BLE/Wi-Fi." },
    { mcu: "Arduino Uno", fit: "Good", rationale: "Easy analog reading, but 5V logic makes browser/modern expansion less flexible." },
    { mcu: "Arduino Nano", fit: "Good", rationale: "Small and beginner friendly, but less headroom than ESP32." },
    { mcu: "Raspberry Pi", fit: "Poor", rationale: "Overkill and lacks native analog input without extra ADC hardware." }
  ],
  constraints: ["Use only 3.3V on the ESP32 analog pin.", "GPIO34 is input-only, which is fine for an LDR signal.", "Browser control requires Web Serial or a small local bridge."],
  power: "USB powers the ESP32. The LDR divider uses ESP32 3V3 and GND.",
  communications: ["USB serial at 115200 baud", "Optional Web Serial browser bridge"]
};

export const fallbackCircuit: CircuitSpec = {
  board: { id: "esp32-devkit-v1", name: "ESP32 DevKit v1", logicVoltage: "3.3V", platformioEnv: "esp32dev" },
  components: [
    { id: "ldr1", type: "LDR", label: "Light sensor" },
    { id: "r1", type: "resistor", label: "Pulldown resistor", value: "10k ohm" },
    { id: "breadboard1", type: "breadboard", label: "Breadboard" }
  ],
  connections: [
    { from: "ESP32 3V3", to: "LDR leg A", signal: "3.3V", wireColor: "red" },
    { from: "LDR leg B", to: "GPIO34 / ADC", signal: "sensor voltage", wireColor: "yellow", note: "This junction is the analog reading point." },
    { from: "GPIO34 / ADC", to: "10k resistor leg A", signal: "voltage divider midpoint", wireColor: "yellow" },
    { from: "10k resistor leg B", to: "ESP32 GND", signal: "ground", wireColor: "black" }
  ],
  pins: [
    { component: "Light sensor divider", pin: "midpoint", boardPin: "GPIO34", mode: "analog input", firmwareSymbol: "SENSOR_PIN" },
    { component: "Divider resistor", pin: "ground side", boardPin: "GND", mode: "ground" },
    { component: "LDR", pin: "supply side", boardPin: "3V3", mode: "power" }
  ],
  protocols: ["ADC", "USB Serial"],
  warnings: ["Do not connect the divider to 5V on ESP32.", "GPIO34 cannot drive outputs; use it only as an input."]
};

export const fallbackFirmware: ProjectSpec["firmware"] = {
  target: "esp32dev",
  libraries: [],
  files: [
    {
      path: "platformio.ini",
      contents: `[env:esp32dev]
platform = espressif32
board = esp32dev
framework = arduino
monitor_speed = 115200
`
    },
    {
      path: "src/main.cpp",
      contents: `#include <Arduino.h>

const int SENSOR_PIN = 34;
const int THRESHOLD = 1800;
bool lastJump = false;

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println("BENCH_FLAPPY_READY");
}

void loop() {
  int lightValue = analogRead(SENSOR_PIN);
  bool covered = lightValue < THRESHOLD;

  if (covered != lastJump) {
    Serial.print("JUMP:");
    Serial.println(covered ? 1 : 0);
    lastJump = covered;
  }

  Serial.print("LIGHT:");
  Serial.println(lightValue);
  delay(40);
}
`
    },
    {
      path: "web-serial-demo.html",
      contents: `<!doctype html>
<html>
<body>
<button id="connect">Connect ESP32</button>
<canvas id="game" width="420" height="520"></canvas>
<script>
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let y = 260, velocity = 0, jump = false;
function draw() {
  velocity += 0.35;
  if (jump) velocity = -5.5;
  y = Math.max(20, Math.min(500, y + velocity));
  ctx.fillStyle = '#101012';
  ctx.fillRect(0, 0, 420, 520);
  ctx.fillStyle = '#ccff00';
  ctx.beginPath();
  ctx.arc(120, y, 18, 0, Math.PI * 2);
  ctx.fill();
  requestAnimationFrame(draw);
}
draw();
document.getElementById('connect').onclick = async () => {
  const port = await navigator.serial.requestPort();
  await port.open({ baudRate: 115200 });
  const reader = port.readable.pipeThrough(new TextDecoderStream()).getReader();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value.includes('JUMP:1')) jump = true;
    if (value.includes('JUMP:0')) jump = false;
  }
};
</script>
</body>
</html>`
    }
  ]
};
