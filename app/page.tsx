"use client";

import { useState } from "react";
import type { AgentEvent, ProjectSpec } from "@/lib/schemas/projectSpec";

type Result = {
  spec: ProjectSpec;
  events: AgentEvent[];
  circuitSvg: string;
  artifactPath: string;
};

type WorkspaceView = "workspace" | "team";
type ContextView = "pinout" | "checks" | "sources";

const demoIdea = "I want to build a physical controller for Flappy Bird where covering/uncovering a light sensor controls the bird.";

const agents = [
  { role: "Knowledge Base", code: "SOURCE", task: "trusted component facts" },
  { role: "Hardware Architect", code: "ARCH", task: "board + BOM selection" },
  { role: "Wiring Engineer", code: "WIRE", task: "pin map + electrical rules" },
  { role: "Firmware Engineer", code: "FIRM", task: "PlatformIO project" },
  { role: "Daytona", code: "BUILD", task: "compile + repair loop" },
  { role: "Supervisor", code: "CHECK", task: "system verification" }
];

function latestEvent(events: AgentEvent[], role: string) {
  return [...events].reverse().find((event) => event.role === role);
}

function statusLabel(status?: AgentEvent["status"]) {
  if (status === "ok") return "DONE";
  if (status === "running") return "RUN";
  if (status === "error") return "STOP";
  return "QUEUE";
}

function AgentRail({ events, result, running }: { events: AgentEvent[]; result: Result | null; running: boolean }) {
  return (
    <aside className="agent-rail">
      <p className="rail-heading">AGENTS</p>
      <div className="agent-stack">
        {agents.map((agent) => {
          const event = latestEvent(events, agent.role);
          const status = event?.status || (running ? "queued" : undefined);
          return (
            <div className={`agent-line ${status || "idle"}`} key={agent.role}>
              <span className="state-square" />
              <div className="agent-copy">
                <div className="agent-title-row">
                  <strong>{agent.code}</strong>
                  <span>{statusLabel(status)}</span>
                </div>
                <small>{event?.message || agent.task}</small>
              </div>
            </div>
          );
        })}
      </div>

      <p className="rail-heading project-heading">PROJECT</p>
      <div className="artifact-tree">
        <div className={result ? "ready" : "pending"}><span>◇</span> project_spec.json</div>
        <div className={result ? "ready" : "pending"}><span>◇</span> circuit.json</div>
        <div className={result ? "ready" : "pending"}><span>◇</span> grounding.json</div>
        <div className={result ? "ready" : "pending"}><span>◇</span> firmware/</div>
        <div className={result ? "ready" : "pending"}><span>◇</span> web-serial-demo.html</div>
      </div>
    </aside>
  );
}

function DispatchTable({ events, running }: { events: AgentEvent[]; running: boolean }) {
  return (
    <section className="dispatch-block">
      <div className="dispatch-header">
        <strong>DISPATCH / BUILD 01</strong>
        <span>{agents.length} SPECIALISTS · {running ? "IN PROGRESS" : "SERIAL HANDOFF"}</span>
      </div>
      {agents.map((agent) => {
        const event = latestEvent(events, agent.role);
        const status = event?.status || (running ? "queued" : undefined);
        return (
          <div className={`dispatch-row ${status || "idle"}`} key={agent.role}>
            <span className="dispatch-code">{agent.code}</span>
            <div className="dispatch-task">
              <strong>{event?.message || agent.task}</strong>
              <span>{event?.detail || agent.role}</span>
            </div>
            <div className="dispatch-progress"><span /></div>
            <span className="dispatch-status">{statusLabel(status)}</span>
          </div>
        );
      })}
    </section>
  );
}

function EvidenceDetails({ spec, sourceMap }: { spec: ProjectSpec; sourceMap: Map<string, ProjectSpec["grounding"]["hardware"]["sources"][number]> }) {
  return (
    <div className="evidence-stack">
      {spec.grounding.decisions.map((decision) => (
        <details className="evidence" key={decision.id}>
          <summary>{decision.title}<span>OPEN +</span></summary>
          <p>{decision.summary}</p>
          <ul>{decision.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
          <div className="source-links">
            {decision.sourceIds.map((sourceId) => {
              const source = sourceMap.get(sourceId);
              return source ? <a key={sourceId} href={source.url} target="_blank" rel="noreferrer">{source.publisher} / {source.title}</a> : null;
            })}
          </div>
        </details>
      ))}
    </div>
  );
}

function WorkspaceOutput({ result, sourceMap }: { result: Result; sourceMap: Map<string, ProjectSpec["grounding"]["hardware"]["sources"][number]> }) {
  const { spec } = result;
  const mainFirmware = spec.firmware.files.find((file) => file.path === "src/main.cpp")?.contents;
  return (
    <div className="workspace-output">
      <section className="output-section build-plan-section">
        <div className="section-bar">
          <div><span>BUILD PLAN</span><strong>REV A</strong></div>
          <span>{spec.hardware.bom.length} PARTS · {spec.hardware.difficulty.toUpperCase()}</span>
        </div>
        <div className="spec-strip">
          <div><span>MCU</span><strong>{spec.hardware.selectedMcu}</strong></div>
          <div><span>POWER</span><strong>{spec.hardware.power}</strong></div>
          <div><span>LINK</span><strong>{spec.hardware.communications[0]}</strong></div>
        </div>
        <div className="bom-table">
          <div className="table-row table-head"><span>QTY / PART</span><span>ROLE</span><span>STATE</span></div>
          {spec.hardware.bom.map((part) => (
            <div className="table-row" key={part.item}>
              <strong>{part.qty} × {part.item}</strong>
              <span>{part.purpose}</span>
              <em>LOCKED</em>
            </div>
          ))}
        </div>
        <EvidenceDetails spec={spec} sourceMap={sourceMap} />
      </section>

      <section className="output-section implementation-section">
        <div className="section-bar">
          <div><span>FIRMWARE + ASSEMBLY</span><strong>{spec.firmware.target}</strong></div>
          <span>{spec.verification.attempts} COMPILE ATTEMPT</span>
        </div>
        <div className="implementation-grid">
          <div>
            <p className="micro-heading">SRC / MAIN.CPP</p>
            <pre className="code-block">{mainFirmware}</pre>
          </div>
          <div>
            <p className="micro-heading">PHYSICAL BUILD</p>
            <ol className="build-steps">
              {spec.buildInstructions.map((step) => <li key={step}>{step}</li>)}
            </ol>
          </div>
        </div>
      </section>
    </div>
  );
}

function TeamView({ events, running }: { events: AgentEvent[]; running: boolean }) {
  return (
    <div className="team-view">
      <div className="team-heading">
        <div><strong>TEAM</strong><span>REV A · {agents.length} SPECIALISTS · STRUCTURED HANDOFFS</span></div>
        <span className={running ? "live-label" : "quiet-label"}>{running ? "DISPATCHED" : "STANDBY"}</span>
      </div>
      <div className="orchestrator-strip">
        <div className="logo-mini">B</div>
        <div><strong>BENCH / ORCHESTRATOR</strong><span>Splits the goal, owns project_spec.json, and blocks unsafe handoffs.</span></div>
        <span>CANONICAL STATE →</span>
      </div>
      <section className="handoff-graph">
        <div className="graph-label">HANDOFF GRAPH</div>
        <div className="graph-grid">
          {agents.map((agent, index) => {
            const event = latestEvent(events, agent.role);
            const status = event?.status || (running ? "queued" : undefined);
            return (
              <div className={`graph-node ${status || "idle"}`} key={agent.role}>
                <div><strong>{agent.code}</strong><span>{statusLabel(status)}</span></div>
                <p>{agent.task}</p>
                <small>{event?.message || "awaiting project"}</small>
                {index < agents.length - 1 ? <b className="handoff-arrow">→</b> : null}
              </div>
            );
          })}
        </div>
      </section>
      <section className="timeline-block">
        <div className="graph-label">TIMELINE</div>
        {agents.map((agent) => {
          const status = latestEvent(events, agent.role)?.status;
          return (
            <div className="timeline-row" key={agent.role}>
              <span>{agent.code}</span>
              <div><i className={status || "idle"} /></div>
            </div>
          );
        })}
      </section>
      <section className="handoff-log">
        <div className="graph-label">HANDOFF LOG</div>
        {events.length === 0 ? <p>NO RUN DATA</p> : events.slice(-8).map((event, index) => (
          <div key={`${event.role}-${index}`}><span>{event.role.toUpperCase()}</span><p>{event.message}</p><em>{statusLabel(event.status)}</em></div>
        ))}
      </section>
    </div>
  );
}

function ContextRail({ result, activeTab, onTabChange }: { result: Result | null; activeTab: ContextView; onTabChange: (tab: ContextView) => void }) {
  const spec = result?.spec;
  const allSources = new Map(
    spec
      ? [spec.grounding.hardware, spec.grounding.wiring, spec.grounding.firmware, spec.grounding.supervisor]
          .flatMap((bundle) => bundle.sources)
          .map((source) => [source.id, source] as const)
      : []
  );

  return (
    <aside className="context-rail">
      <div className="context-title"><span>CONTEXT</span><strong>{activeTab.toUpperCase()}</strong><em>{spec ? "REV A" : "IDLE"}</em></div>
      <div className="context-tabs">
        {(["pinout", "checks", "sources"] as ContextView[]).map((tab) => (
          <button className={activeTab === tab ? "active" : ""} key={tab} onClick={() => onTabChange(tab)}>{tab.toUpperCase()}</button>
        ))}
      </div>

      <div className="context-content">
        {activeTab === "pinout" && (
          <>
            {result ? (
              <div className="context-svg" dangerouslySetInnerHTML={{ __html: result.circuitSvg }} />
            ) : (
              <div className="board-placeholder">
                <span className="board-port left" />
                <span className="board-port right" />
                <div><strong>ESP32</strong><small>GPIO / ADC</small></div>
                <b>3V3</b><em>GPIO34</em>
              </div>
            )}
            <div className="pin-list">
              {(spec?.circuit.pins || []).map((pin) => (
                <div key={`${pin.boardPin}-${pin.pin}`}><span className="state-square" /><strong>{pin.boardPin}</strong><p>{pin.mode} · {pin.component}</p></div>
              ))}
              {!spec && <div><span className="state-square muted" /><strong>GPIO34</strong><p>ADC1_CH6 · light input</p></div>}
            </div>
            {spec && spec.warnings.length > 0 && (
              <div className="warning-list">
                <p>PROJECT WARNINGS</p>
                {spec.warnings.slice(0, 4).map((warning) => <div key={warning}><span>△</span>{warning}</div>)}
              </div>
            )}
          </>
        )}

        {activeTab === "checks" && (
          <div className="check-list">
            {(spec?.grounding.checks || []).map((check) => (
              <details className={check.status} key={check.id}>
                <summary><span>{check.status === "pass" ? "✓" : "△"}</span>{check.message}</summary>
                <p>{check.beginnerExplanation}</p>
              </details>
            ))}
            {!spec && <p className="empty-context">NO VERIFICATION DATA</p>}
          </div>
        )}

        {activeTab === "sources" && (
          <div className="sources-list">
            {[...allSources.values()].map((source) => (
              <a key={source.id} href={source.url} target="_blank" rel="noreferrer">
                <span>{source.kind.replaceAll("-", " ")}</span>
                <strong>{source.title}</strong>
                <small>{source.publisher} ↗</small>
              </a>
            ))}
            {!spec && <p className="empty-context">NO RETRIEVED SOURCES</p>}
          </div>
        )}
      </div>

      <div className="context-metrics">
        <div><span>MCU</span><strong>{spec?.hardware.selectedMcu.replace(" DevKit v1", "") || "--"}</strong></div>
        <div><span>PINS</span><strong>{spec?.circuit.pins.length ?? "--"}</strong></div>
        <div><span>BUILD</span><strong>{spec?.phase === "READY_TO_BUILD" ? "PASS" : spec ? "HOLD" : "IDLE"}</strong></div>
      </div>
    </aside>
  );
}

export default function Home() {
  const [idea, setIdea] = useState(demoIdea);
  const [result, setResult] = useState<Result | null>(null);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>("workspace");
  const [contextView, setContextView] = useState<ContextView>("pinout");

  async function runFlow() {
    if (!idea.trim() || running) return;
    setRunning(true);
    setError("");
    setResult(null);
    setEvents([
      { role: "IDEA", status: "ok", message: "Project brief accepted" },
      { role: "Knowledge Base", status: "running", message: "Retrieving trusted electronics facts" }
    ]);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea })
      });
      const payload = await response.json();
      setEvents(payload.events || []);
      if (!response.ok) throw new Error(payload.error || "Project generation failed.");
      setResult(payload);
      setContextView("checks");
    } catch (flowError) {
      setError(flowError instanceof Error ? flowError.message : String(flowError));
    } finally {
      setRunning(false);
    }
  }

  const spec = result?.spec;
  const verified = spec?.phase === "READY_TO_BUILD";
  const sourceMap = new Map(
    spec
      ? [spec.grounding.hardware, spec.grounding.wiring, spec.grounding.firmware, spec.grounding.supervisor]
          .flatMap((bundle) => bundle.sources)
          .map((source) => [source.id, source] as const)
      : []
  );

  return (
    <main className="bench-shell">
      <header className="topbar">
        <div className="brand-lockup"><div className="logo">B</div><strong>BENCH</strong><span>v0.2</span></div>
        <div className="project-name">flappy-controller/</div>
        <div className="run-summary"><span className="state-square" />{running ? "1 RUNNING" : verified ? "1 READY" : "0 RUNNING"}<b>{spec && !verified ? "1 NEEDS REVIEW" : ""}</b></div>
        <div className="top-spacer" />
        <div className="device-status"><span className="state-square" />{spec?.hardware.selectedMcu || "ESP32 DEVKIT"}<small>{spec ? spec.circuit.board.platformioEnv : "awaiting build"}</small></div>
        <div className={`build-state ${verified ? "verified" : ""}`}>{verified ? "✓ VERIFIED" : running ? "● BUILDING" : "○ STANDBY"}</div>
        <button className="header-build" onClick={runFlow} disabled={running}>{running ? "RUNNING" : "⚡ BUILD"}</button>
      </header>

      <nav className="subnav">
        <button className={workspaceView === "workspace" ? "active" : ""} onClick={() => setWorkspaceView("workspace")}>WORKSPACE</button>
        <button className={workspaceView === "team" ? "active" : ""} onClick={() => setWorkspaceView("team")}>TEAM</button>
        <span>{workspaceView === "workspace" ? "project state / generated artifacts / verification" : "specialists / handoffs / execution order"}</span>
      </nav>

      <div className="bench-layout">
        <AgentRail events={events} result={result} running={running} />

        <section className="work-area">
          {workspaceView === "workspace" ? (
            <div className="workspace-view">
              <div className="run-strip"><span>› RUN 01 — LIGHT SENSOR → BROWSER CONTROL</span><em>{verified ? "✓ verified in Daytona" : running ? "building now" : "draft"}</em></div>

              <div className="conversation">
                <div className="message-meta">YOU · PROJECT BRIEF</div>
                <div className="user-brief">{idea}</div>
                <div className="message-meta bench-meta"><span>BENCH</span> ORCHESTRATOR</div>
                <p className="bench-response">
                  {running
                    ? "The team is retrieving trusted board facts, locking the circuit, generating firmware, and compiling it in Daytona."
                    : verified
                      ? `The ${spec?.hardware.selectedMcu} plan is electrically grounded, compiled, and ready for physical assembly.`
                      : "Ready to turn the brief into a sourced BOM, exact wiring, compiled firmware, and a supervised build plan."}
                </p>
              </div>

              <DispatchTable events={events} running={running} />
              {error && <div className="flow-error"><strong>RUN STOPPED</strong><span>{error}</span></div>}
              {result && <WorkspaceOutput result={result} sourceMap={sourceMap} />}

              <form className="command-composer" onSubmit={(event) => { event.preventDefault(); runFlow(); }}>
                <span>+</span>
                <textarea value={idea} onChange={(event) => setIdea(event.target.value)} aria-label="Describe your physical computing project" />
                <button disabled={running || !idea.trim()} aria-label="Build project">↑</button>
              </form>
            </div>
          ) : <TeamView events={events} running={running} />}
        </section>

        <ContextRail result={result} activeTab={contextView} onTabChange={setContextView} />
      </div>
    </main>
  );
}
