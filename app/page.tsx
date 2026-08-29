"use client";

import { useState } from "react";
import type { AgentEvent, ProjectSpec } from "@/lib/schemas/projectSpec";

type Result = {
  spec: ProjectSpec;
  events: AgentEvent[];
  circuitSvg: string;
  artifactPath: string;
};

const demoIdea = "I want to build a physical controller for Flappy Bird where covering/uncovering a light sensor controls the bird.";

const phases = ["IDEA", "MULTI-AGENT", "BUILD PLAN", "VERIFICATION", "READY TO BUILD"];

function AgentRoster({ events }: { events: AgentEvent[] }) {
  const roles = ["Hardware Architect", "Wiring Engineer", "Firmware Engineer", "Daytona", "Supervisor"];
  return (
    <div>
      <p className="section-label mono">AGENTS</p>
      {roles.map((role) => {
        const latest = [...events].reverse().find((event) => event.role === role);
        const active = latest?.status === "running";
        return (
          <div className={`agent ${active ? "active" : ""}`} key={role}>
            <div className="agent-row">
              <span className="agent-name mono">{role.toUpperCase()}</span>
              <span className="mono" style={{ color: latest?.status === "error" ? "var(--danger)" : latest?.status === "ok" ? "var(--ok)" : "var(--dim)", fontSize: 10 }}>{latest?.status || "queued"}</span>
            </div>
            <div className="agent-detail mono">{latest?.message || "waiting"}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function Home() {
  const [idea, setIdea] = useState(demoIdea);
  const [result, setResult] = useState<Result | null>(null);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [running, setRunning] = useState(false);

  async function runFlow() {
    setRunning(true);
    setResult(null);
    setEvents([{ role: "IDEA", status: "running", message: "Sending idea to BENCH" }]);
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idea })
    });
    const payload = await response.json();
    setEvents(payload.events || []);
    if (response.ok) setResult(payload);
    setRunning(false);
  }

  const spec = result?.spec;
  const verified = spec?.phase === "READY_TO_BUILD";

  return (
    <main className="app-shell">
      <div className="topbar">
        <div className="logo">B</div>
        <div className="brand">BENCH</div>
        <span className="status-pill mono"><span className="dot" /> physical-computing MVP</span>
        <div style={{ flex: 1 }} />
        <span className="status-pill mono">{verified ? "READY TO BUILD" : spec ? "NEEDS REAL VERIFICATION" : "IDEA MODE"}</span>
      </div>

      <div className="layout">
        <aside className="sidebar">
          <AgentRoster events={events} />
        </aside>

        <section className="main">
          <form className="idea-form" onSubmit={(event) => { event.preventDefault(); runFlow(); }}>
            <textarea className="idea-input" value={idea} onChange={(event) => setIdea(event.target.value)} aria-label="Describe your physical computing project" />
            <button className="run-button" disabled={running}>{running ? "RUNNING" : "BUILD"}</button>
          </form>

          <div className="steps">
            {phases.map((phase) => (
              <div className="step" key={phase}>
                <strong>{phase}</strong>
                <span>{phase === "VERIFICATION" && spec ? `${spec.verification.compileProvider}, ${spec.verification.attempts} attempt(s)` : phase === "READY TO BUILD" ? (verified ? "verified" : "locked until Daytona compile succeeds") : "structured state"}</span>
              </div>
            ))}
          </div>

          <div className="content-grid">
            <div className="panel">
              <h2>Build Plan</h2>
              {!spec && <p className="mono" style={{ color: "var(--muted)" }}>Run the demo prompt to generate a canonical project_spec.json, circuit.json, firmware, and verification state.</p>}
              {spec && (
                <div className="list">
                  <div className="item"><strong>Selected MCU</strong><small>{spec.hardware.selectedMcu}</small></div>
                  <div className="item"><strong>Difficulty</strong><small>{spec.hardware.difficulty}</small></div>
                  <div className="item"><strong>Power</strong><small>{spec.hardware.power}</small></div>
                  <div className="item"><strong>Comms</strong><small>{spec.hardware.communications.join(", ")}</small></div>
                  <h3>BOM</h3>
                  {spec.hardware.bom.map((part) => <div className="item" key={part.item}><strong>{part.qty}x {part.item}</strong><small>{part.purpose}</small></div>)}
                  <h3>MCU comparison</h3>
                  {spec.hardware.mcuComparison.map((mcu) => <div className="item" key={mcu.mcu}><strong>{mcu.mcu}</strong><small>{mcu.fit}: {mcu.rationale}</small></div>)}
                </div>
              )}
            </div>

            <div className="panel">
              <h2>Wiring Visualization</h2>
              {result ? <div className="svg-wrap" dangerouslySetInnerHTML={{ __html: result.circuitSvg }} /> : <p className="mono" style={{ color: "var(--muted)" }}>The renderer uses circuit.json as source of truth and can be replaced with Fritzing later.</p>}
            </div>
          </div>

          {spec && (
            <div className="content-grid" style={{ marginTop: 14 }}>
              <div className="panel">
                <h2>Firmware</h2>
                <div className="code">{spec.firmware.files.find((file) => file.path === "src/main.cpp")?.contents}</div>
              </div>
              <div className="panel">
                <h2>Build Instructions</h2>
                <div className="list">
                  {spec.buildInstructions.map((step, index) => <div className="item" key={step}><strong>{index + 1}</strong><small>{step}</small></div>)}
                </div>
              </div>
            </div>
          )}
        </section>

        <aside className="rightbar">
          <p className="section-label mono">LIVE ACTIVITY</p>
          <div className="activity">
            {events.map((event, index) => (
              <div className={`event ${event.status}`} key={`${event.role}-${index}`}>
                <span className="dot" />
                <div><strong>{event.role}</strong><br />{event.message}{event.detail ? <><br /><span className="warning">{event.detail}</span></> : null}</div>
              </div>
            ))}
          </div>
          {spec && (
            <>
              <p className="section-label mono" style={{ marginTop: 24 }}>SUPERVISOR</p>
              <div className="activity">
                {spec.verification.supervisorFindings.map((finding) => <div className="event" key={finding}><span className="dot" /><div>{finding}</div></div>)}
              </div>
              <p className="section-label mono" style={{ marginTop: 24 }}>ARTIFACTS</p>
              <p className="mono" style={{ color: "var(--muted)", fontSize: 12 }}>{result?.artifactPath}</p>
            </>
          )}
        </aside>
      </div>
    </main>
  );
}
