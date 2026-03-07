"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { getProjectRuns } from "@/services/executionService";

type TestCaseResult = {
  id: number | string;
  name: string;
  status: string;
  durationMs: number;
  error?: string;
  steps?: any[];
};

type RunData = {
  runId: string;
  suiteName: string;
  status: string;
  startTime: string;
  endTime: string | null;
  durationMs: number;
  testsPassed: number;
  testsFailed: number;
  testCases: TestCaseResult[];
  logs: any[];
  triggeredBy?: string;
};

export default function SummaryBoardView() {
  const params = useParams();
  const projectId = params?.project_id as string;

  const [runs, setRuns] = useState<RunData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;

    async function fetchRuns() {
      try {
        setLoading(true);
        const data = await getProjectRuns(projectId);
        setRuns(data || []);
        // Auto-expand first run
        if (data && data.length > 0) {
          setExpandedRunId(data[0].runId);
        }
      } catch (err) {
        console.error("Failed to fetch runs:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchRuns();
  }, [projectId]);

  const toggleExpand = (id: string) => {
    setExpandedRunId(prev => prev === id ? null : id);
  };

  // Compute KPIs from real data
  const totalRuns = runs.length;
  const passedRuns = runs.filter(r => r.status === "PASSED").length;
  const successRate = totalRuns > 0 ? ((passedRuns / totalRuns) * 100).toFixed(1) : "0.0";
  const totalDurationMs = runs.reduce((sum, r) => sum + (r.durationMs || 0), 0);
  const avgDurationMs = totalRuns > 0 ? Math.round(totalDurationMs / totalRuns) : 0;

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}m ${secs}s`;
  };

  const formatDate = (iso: string) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" }) +
      " " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const styles: Record<string, { bg: string; color: string }> = {
      PASSED: { bg: "rgba(16, 185, 129, 0.15)", color: "#10b981" },
      FAILED: { bg: "rgba(239, 68, 68, 0.15)", color: "#ef4444" },
      RUNNING: { bg: "rgba(245, 158, 11, 0.15)", color: "#f59e0b" },
    };
    const s = styles[status] || { bg: "rgba(107, 114, 128, 0.15)", color: "var(--text-muted)" };
    return <span style={{ padding: "4px 8px", background: s.bg, color: s.color, borderRadius: "4px", fontSize: "12px", fontWeight: 600 }}>{status}</span>;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "1200px", margin: "0 auto", paddingBottom: "40px" }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: "24px", fontWeight: 600, color: "var(--text-primary)", margin: "0 0 8px 0" }}>Summary Board</h1>
        <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: "14px" }}>
          Gain insights into past and current executions. Review test case granular details, artefact recordings, and logs.
        </p>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "flex", gap: "16px" }}>
        {[
          { label: "Total Runs", value: totalRuns.toString(), icon: "📊" },
          { label: "Success Rate", value: `${successRate}%`, color: "#10b981", icon: "📈" },
          { label: "Avg. Duration", value: formatDuration(avgDurationMs), icon: "⏱️" },
          { label: "Total Test Cases Run", value: runs.reduce((s, r) => s + (r.testsPassed || 0) + (r.testsFailed || 0), 0).toString(), color: "var(--primary-light)", icon: "⚡" },
        ].map((kpi, idx) => (
          <div key={idx} style={{ flex: 1, padding: "20px", background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "12px", display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{ fontSize: "24px" }}>{kpi.icon}</div>
            <div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{kpi.label}</div>
              <div style={{ fontSize: "20px", fontWeight: 700, color: kpi.color || "var(--text-primary)" }}>{kpi.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Runs Table */}
      <div style={{ background: "var(--bg-secondary)", borderRadius: "12px", border: "1px solid var(--border)", overflow: "hidden" }}>

        {/* Table Header */}
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 2.5fr 1fr 1.5fr 1fr 1fr", padding: "16px 24px", borderBottom: "1px solid var(--border)", background: "rgba(0,0,0,0.2)", fontSize: "13px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
          <div>Run ID</div>
          <div>Test Suite</div>
          <div>Status</div>
          <div>Date</div>
          <div>Duration</div>
          <div style={{ textAlign: "right" }}>Results</div>
        </div>

        {/* Loading State */}
        {loading && (
          <div style={{ padding: "48px", textAlign: "center", color: "var(--text-muted)" }}>
            <div className="spinner-primary" style={{ width: 24, height: 24, margin: "0 auto 12px" }} />
            Loading execution history...
          </div>
        )}

        {/* Empty State */}
        {!loading && runs.length === 0 && (
          <div style={{ padding: "48px", textAlign: "center", color: "var(--text-muted)" }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 12px", display: "block", opacity: 0.5 }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            No execution runs yet. Trigger your first execution from the Test Execution view.
          </div>
        )}

        {/* Table Body */}
        {!loading && (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {runs.map(run => (
              <div key={run.runId} style={{ display: "flex", flexDirection: "column", borderBottom: "1px solid var(--border)" }}>
                {/* Main Row */}
                <div
                  onClick={() => toggleExpand(run.runId)}
                  style={{
                    display: "grid", gridTemplateColumns: "1.2fr 2.5fr 1fr 1.5fr 1fr 1fr", padding: "16px 24px",
                    background: expandedRunId === run.runId ? "rgba(255,255,255,0.02)" : "transparent",
                    alignItems: "center", cursor: "pointer", transition: "background 0.2s"
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
                  onMouseOut={(e) => e.currentTarget.style.background = expandedRunId === run.runId ? "rgba(255,255,255,0.02)" : "transparent"}
                >
                  <div style={{ fontWeight: 600, color: "var(--primary-light)", fontFamily: "monospace", fontSize: "13px" }}>{run.runId.slice(0, 20)}</div>
                  <div>
                    <div style={{ fontWeight: 500, color: "var(--text-primary)" }}>{run.suiteName}</div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>Triggered by: {run.triggeredBy || "User"}</div>
                  </div>
                  <div><StatusBadge status={run.status} /></div>
                  <div style={{ color: "var(--text-secondary)", fontSize: "14px" }}>{formatDate(run.startTime)}</div>
                  <div style={{ color: "var(--text-secondary)", fontSize: "14px", fontFamily: "monospace" }}>{formatDuration(run.durationMs || 0)}</div>
                  <div style={{ textAlign: "right", display: "flex", justifyContent: "flex-end", gap: "8px", fontSize: "13px" }}>
                    <span style={{ color: "#10b981", fontWeight: 600 }}>{run.testsPassed} P</span>
                    {(run.testsFailed || 0) > 0 && <span style={{ color: "#ef4444", fontWeight: 600 }}>{run.testsFailed} F</span>}
                    <div style={{ display: "flex", alignItems: "center", marginLeft: "12px", color: "var(--text-muted)", transform: expandedRunId === run.runId ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.3s" }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </div>
                  </div>
                </div>

                {/* Expanded Detail Panel */}
                {expandedRunId === run.runId && (
                  <div style={{ padding: "24px", background: "rgba(0,0,0,0.15)", borderTop: "1px dashed var(--border)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                      <h4 style={{ margin: 0, color: "var(--text-primary)", fontSize: "15px" }}>Test Case Results</h4>
                    </div>

                    {(!run.testCases || run.testCases.length === 0) && (
                      <div style={{ padding: "16px", color: "var(--text-muted)", fontSize: "13px", textAlign: "center" }}>
                        {run.status === "RUNNING" ? "Test cases are still executing..." : "No test case data available."}
                      </div>
                    )}

                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {(run.testCases || []).map((tc, tcIdx) => (
                        <div key={tc.id || tcIdx} style={{
                          display: "flex", flexDirection: "column",
                          background: "var(--bg-secondary)", border: "1px solid var(--border)",
                          borderRadius: "8px", overflow: "hidden"
                        }}>
                          <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                              <StatusBadge status={tc.status} />
                              <span style={{ fontWeight: 500, color: "var(--text-primary)", fontSize: "14px" }}>{tc.name}</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "24px", fontSize: "13px" }}>
                              <span style={{ color: "var(--text-muted)", fontFamily: "monospace" }}>{formatDuration(tc.durationMs || 0)}</span>
                              {(tc.steps && tc.steps.length > 0) && <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>{tc.steps.length} steps</span>}
                            </div>
                          </div>

                          {tc.error && (
                            <div style={{
                              background: "rgba(239, 68, 68, 0.05)", borderTop: "1px solid rgba(239, 68, 68, 0.2)",
                              padding: "10px 16px", fontSize: "13px", color: "#fca5a5", fontFamily: "monospace",
                              display: "flex", alignItems: "flex-start", gap: "8px"
                            }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: "2px", flexShrink: 0 }}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                              {tc.error}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
