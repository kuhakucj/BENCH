import type { CircuitSpec } from "@/lib/schemas/projectSpec";

export interface CircuitRenderer {
  id: string;
  render(circuit: CircuitSpec): string;
}

function escapeXml(value: string) {
  return value.replace(/[<>&"']/g, (character) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "\"": "&quot;",
    "'": "&apos;"
  })[character] || character);
}

function connectionLines(circuit: CircuitSpec) {
  const colors: Record<string, string> = { red: "#ff6178", black: "#72727a", yellow: "#e8d84c", blue: "#58a6ff", green: "#c6ff00" };
  return circuit.connections.map((connection, index) => {
    const y = 158 + index * 18;
    const color = colors[connection.wireColor.toLowerCase()] || "#8d8d93";
    return `<path d="M 250 ${y} C 340 ${y - 45}, 470 ${y + 45}, 570 ${y}" stroke="${color}" stroke-width="3" fill="none"/><text x="275" y="${y - 8}" font-size="11" fill="#9b9ba2">${escapeXml(connection.signal)}</text>`;
  }).join("");
}

export const beginnerSvgRenderer: CircuitRenderer = {
  id: "beginner-svg",
  render(circuit) {
    const pinRows = circuit.pins.map((pin, index) => {
      const y = 350 + index * 22;
      return `<text x="34" y="${y}" font-size="12" fill="#c6ff00">${escapeXml(pin.boardPin)}</text><text x="140" y="${y}" font-size="12" fill="#b8b8bd">${escapeXml(`${pin.component} ${pin.pin}`)}</text>`;
    }).join("");

    return `<svg viewBox="0 0 840 520" width="100%" height="100%" role="img" aria-label="Beginner breadboard wiring diagram" xmlns="http://www.w3.org/2000/svg">
  <rect width="840" height="520" fill="#0b0b0d"/>
  <text x="28" y="38" font-size="20" font-weight="700" fill="#eeeeec">${escapeXml(circuit.board.name)} / CIRCUIT.JSON</text>
  <rect x="28" y="82" width="210" height="230" rx="4" fill="#131316" stroke="#3a3a40"/>
  <text x="68" y="120" font-size="18" font-weight="700" fill="#eeeeec">${escapeXml(circuit.board.name)}</text>
  <text x="68" y="146" font-size="12" fill="#c6ff00">${escapeXml(circuit.board.logicVoltage)} LOGIC</text>
  <circle cx="64" cy="168" r="5" fill="#ff6178"/><text x="78" y="172" font-size="12" fill="#d6d6d8">3V3</text>
  <circle cx="64" cy="198" r="5" fill="#72727a"/><text x="78" y="202" font-size="12" fill="#d6d6d8">GND</text>
  <circle cx="64" cy="228" r="5" fill="#e8d84c"/><text x="78" y="232" font-size="12" fill="#d6d6d8">GPIO34 ADC</text>
  <rect x="560" y="92" width="230" height="260" rx="4" fill="#101012" stroke="#34343a"/>
  <text x="602" y="125" font-size="16" font-weight="700" fill="#eeeeec">BREADBOARD</text>
  <circle cx="618" cy="180" r="24" fill="#d8c448" stroke="#c6ff00" stroke-width="2"/>
  <text x="595" y="223" font-size="12" fill="#b8b8bd">LDR</text>
  <path d="M650 260 h80" stroke="#8c632f" stroke-width="8"/>
  <path d="M664 250 v20 M680 250 v20 M696 250 v20" stroke="#eeeeec" stroke-width="2"/>
  <text x="650" y="292" font-size="12" fill="#b8b8bd">10K RESISTOR</text>
  ${connectionLines(circuit)}
  <rect x="28" y="328" width="770" height="152" fill="#101012" stroke="#34343a"/>
  <text x="34" y="340" font-size="12" font-weight="700" fill="#eeeeec">PIN MAP</text>
  ${pinRows}
</svg>`;
  }
};

export function renderCircuit(circuit: CircuitSpec, renderer: CircuitRenderer = beginnerSvgRenderer) {
  return renderer.render(circuit);
}
