import type { CircuitSpec } from "@/lib/schemas/projectSpec";

export interface CircuitRenderer {
  id: string;
  render(circuit: CircuitSpec): string;
}

function connectionLines(circuit: CircuitSpec) {
  const colors: Record<string, string> = { red: "#d62828", black: "#111111", yellow: "#f2c94c", blue: "#2f80ed", green: "#219653" };
  return circuit.connections.map((connection, index) => {
    const y = 158 + index * 18;
    const color = colors[connection.wireColor] || connection.wireColor || "#555";
    return `<path d="M 250 ${y} C 340 ${y - 45}, 470 ${y + 45}, 570 ${y}" stroke="${color}" stroke-width="4" fill="none"/><text x="275" y="${y - 8}" font-size="11" fill="#222">${connection.signal}</text>`;
  }).join("");
}

export const beginnerSvgRenderer: CircuitRenderer = {
  id: "beginner-svg",
  render(circuit) {
    const pinRows = circuit.pins.map((pin, index) => {
      const y = 350 + index * 22;
      return `<text x="34" y="${y}" font-size="12" fill="#222">${pin.boardPin}</text><text x="140" y="${y}" font-size="12" fill="#222">${pin.component} ${pin.pin}</text>`;
    }).join("");

    return `<svg viewBox="0 0 840 520" width="100%" height="100%" role="img" aria-label="Beginner breadboard wiring diagram" xmlns="http://www.w3.org/2000/svg">
  <rect width="840" height="520" fill="#f8f7f3"/>
  <text x="28" y="38" font-size="22" font-weight="700" fill="#111">${circuit.board.name} wiring from circuit.json</text>
  <rect x="28" y="82" width="210" height="230" rx="8" fill="#1c2d3a"/>
  <text x="68" y="120" font-size="18" font-weight="700" fill="#fff">ESP32</text>
  <text x="68" y="146" font-size="12" fill="#ccff00">${circuit.board.logicVoltage} logic</text>
  <circle cx="64" cy="168" r="5" fill="#d62828"/><text x="78" y="172" font-size="12" fill="#fff">3V3</text>
  <circle cx="64" cy="198" r="5" fill="#111"/><text x="78" y="202" font-size="12" fill="#fff">GND</text>
  <circle cx="64" cy="228" r="5" fill="#f2c94c"/><text x="78" y="232" font-size="12" fill="#fff">GPIO34 ADC</text>
  <rect x="560" y="92" width="230" height="260" rx="8" fill="#ffffff" stroke="#c9c6bb"/>
  <text x="602" y="125" font-size="16" font-weight="700" fill="#111">Breadboard</text>
  <circle cx="618" cy="180" r="24" fill="#f5d76e" stroke="#111" stroke-width="3"/>
  <text x="595" y="223" font-size="12" fill="#111">LDR</text>
  <path d="M650 260 h80" stroke="#7d5a28" stroke-width="8"/>
  <path d="M664 250 v20 M680 250 v20 M696 250 v20" stroke="#111" stroke-width="2"/>
  <text x="650" y="292" font-size="12" fill="#111">10k resistor</text>
  ${connectionLines(circuit)}
  <rect x="28" y="328" width="770" height="152" fill="#fff" stroke="#d9d6ca"/>
  <text x="34" y="340" font-size="12" font-weight="700" fill="#111">Pin map</text>
  ${pinRows}
</svg>`;
  }
};

export function renderCircuit(circuit: CircuitSpec, renderer: CircuitRenderer = beginnerSvgRenderer) {
  return renderer.render(circuit);
}
