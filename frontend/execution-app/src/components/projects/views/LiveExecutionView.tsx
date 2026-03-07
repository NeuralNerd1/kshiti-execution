"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useParams, useRouter, usePathname } from "next/navigation";
import { getRunStatus, stopExecution } from "@/services/executionService";
import { toast } from "sonner";

type LogEntry = {
  timestamp: string;
  level: string;
  message: string;
};

type StepResult = {
  id: number | string;
  name: string;
  status: string;
  durationMs: number;
  error?: string;
};

type TestCaseResult = {
  id: number | string;
  name: string;
  status: string;
  durationMs: number;
  error?: string;
  steps: StepResult[];
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
  logs: LogEntry[];
};

export default function LiveExecutionView({ params }: { params?: any }) {
  const searchParams = useSearchParams();
  const routeParams = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const runId = searchParams.get("runId");
  const projectId = routeParams?.project_id as string;
  const companySlug = routeParams?.company_slug as string;

  const basePath = pathname?.includes("/local/")
    ? `/local/projects/${projectId}`
    : `/company/${companySlug}/projects/${projectId}`;

  const [runData, setRunData] = useState<RunData | null>(null);
  const [tick, setTick] = useState(0); // forces re-render for live timer
  const [logFilter, setLogFilter] = useState("ALL");
  const [selectedTcIndex, setSelectedTcIndex] = useState(0);
  const [showStopModal, setShowStopModal] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const redirectRef = useRef<NodeJS.Timeout | null>(null);
  const hasTriggeredRedirect = useRef(false);

  // Persist active runId in localStorage
  useEffect(() => {
    if (runId && projectId) {
      localStorage.setItem(`active_run_${projectId}`, runId);
    }
  }, [runId, projectId]);

  // Clear localStorage when run completes or is stopped
  const clearActiveRun = useCallback(() => {
    if (projectId) {
      localStorage.removeItem(`active_run_${projectId}`);
    }
  }, [projectId]);

  // Poll for run status
  useEffect(() => {
    if (!runId) return;

    const pollData = async () => {
      try {
        const data = await getRunStatus(runId);
        setRunData(data);

        // Stop polling when execution is done
        if (data.status === "PASSED" || data.status === "FAILED" || data.status === "STOPPED") {
          if (pollRef.current) clearInterval(pollRef.current);
          if (timerRef.current) clearInterval(timerRef.current);
        }
      } catch (err) {
        console.error("Failed to poll run status:", err);
      }
    };

    pollData(); // Initial fetch
    pollRef.current = setInterval(pollData, 2000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [runId]);

  // Timer — tick every second to force re-render for computed elapsed time
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Compute real elapsed seconds from startTime
  const computedElapsed = (() => {
    if (!runData?.startTime) return 0;
    const start = new Date(runData.startTime).getTime();
    return Math.floor((Date.now() - start) / 1000);
  })();

  // Auto-redirect on completion (PASSED or FAILED)
  useEffect(() => {
    if (!runData) return;
    const { status } = runData;
    if ((status === "PASSED" || status === "FAILED") && !hasTriggeredRedirect.current) {
      hasTriggeredRedirect.current = true;
      clearActiveRun();

      // Start 3-second countdown
      setRedirectCountdown(3);
      let count = 3;
      const interval = setInterval(() => {
        count--;
        setRedirectCountdown(count);
        if (count <= 0) {
          clearInterval(interval);
          router.push(`${basePath}/summary-board`);
        }
      }, 1000);
      redirectRef.current = interval as unknown as NodeJS.Timeout;
    }
    return () => {
      if (redirectRef.current) clearInterval(redirectRef.current);
    };
  }, [runData?.status]);

  const handleRedirectNow = () => {
    if (redirectRef.current) clearInterval(redirectRef.current);
    router.push(`${basePath}/summary-board`);
  };

  // Stop execution handler
  const handleStopExecution = async () => {
    if (!runId) return;
    try {
      setIsStopping(true);
      await stopExecution(runId);
      clearActiveRun();
      setShowStopModal(false);
      toast.success("Execution stopped successfully.");
      router.push(`${basePath}/test-load-execute`);
    } catch (err: any) {
      console.error("Failed to stop execution:", err);
      toast.error(err.message || "Failed to stop execution");
    } finally {
      setIsStopping(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  };

  void tick; // reference tick to suppress unused warning
  const isRunning = runData?.status === "RUNNING";
  const isPending = runData?.status === "PENDING";
  const isComplete = runData?.status === "PASSED" || runData?.status === "FAILED";
  const isStopped = runData?.status === "STOPPED";

  // Compute total steps across all test cases  
  const testCasesSafe = Array.isArray(runData?.testCases) ? runData.testCases : [];
  const allSteps = testCasesSafe.flatMap((tc: any) => Array.isArray(tc?.steps) ? tc.steps : []);
  const totalSteps = allSteps.length;
  const completedSteps = allSteps.filter(s => s.status === "PASSED" || s.status === "FAILED").length;
  const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : (isRunning ? 15 : isComplete || isStopped ? 100 : 0);

  const tcCount = testCasesSafe.length;
  const passedCount = runData?.testsPassed || 0;
  const failedCount = runData?.testsFailed || 0;
  const inProgressCount = isRunning ? Math.max(0, tcCount - passedCount - failedCount) : 0;

  const selectedTc = testCasesSafe[selectedTcIndex] || null;

  const logsSafe = Array.isArray(runData?.logs) ? runData.logs : [];
  const filteredLogs = logsSafe.filter(l => {
    if (logFilter === "ALL") return true;
    return l.level === logFilter;
  });

  const levelColor = (level: string) => {
    switch (level) {
      case "ERROR": return "#ef4444";
      case "WARN": return "#f59e0b";
      case "DEBUG": return "#8b5cf6";
      case "NETWORK": return "#06b6d4";
      default: return "#10b981";
    }
  };

  const stepIcon = (status: string) => {
    switch (status) {
      case "PASSED": return <span style={{ color: "#10b981", fontSize: "18px" }}>✓</span>;
      case "FAILED": return <span style={{ color: "#ef4444", fontSize: "18px" }}>✗</span>;
      case "RUNNING": return <div className="spinner-primary" style={{ width: 16, height: 16 }} />;
      default: return <span style={{ color: "var(--text-muted)", fontSize: "16px" }}>○</span>;
    }
  };

  const getStatusColor = () => {
    if (isRunning || isPending) return { bg: "rgba(245, 158, 11, 0.15)", color: "#f59e0b", border: "rgba(245, 158, 11, 0.3)" };
    if (runData?.status === "PASSED") return { bg: "rgba(16, 185, 129, 0.15)", color: "#10b981", border: "rgba(16, 185, 129, 0.3)" };
    if (isStopped) return { bg: "rgba(107, 114, 128, 0.15)", color: "#9ca3af", border: "rgba(107, 114, 128, 0.3)" };
    return { bg: "rgba(239, 68, 68, 0.15)", color: "#ef4444", border: "rgba(239, 68, 68, 0.3)" };
  };

  const statusColors = getStatusColor();

  if (!runId) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "400px", color: "var(--text-muted)" }}>
        No execution run selected. Please trigger an execution from the Test Execution view.
      </div>
    );
  }

  return (
    <div style={{ height: "calc(100vh - 80px)", display: "flex", flexDirection: "column", gap: "0", backgroundColor: "var(--bg-primary)", borderRadius: "12px", border: "1px solid var(--border)", overflow: "hidden" }}>

      {/* ═══ TOP BANNER — Global Status ═══ */}
      <div style={{ padding: "16px 24px", background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px" }}>Suite</div>
            <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" }}>{runData?.suiteName || "Loading..."}</div>
          </div>
          <div style={{ height: "32px", width: "1px", background: "var(--border)" }} />
          <div style={{ display: "flex", gap: "16px", fontSize: "14px" }}>
            <span style={{ color: "#10b981", fontWeight: 600 }}>🟢 Passed: {passedCount}</span>
            <span style={{ color: "#ef4444", fontWeight: 600 }}>🔴 Failed: {failedCount}</span>
            {isRunning && <span style={{ color: "#f59e0b", fontWeight: 600 }}>🟡 In Progress: {inProgressCount}</span>}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {/* Stop Execution Button */}
          {(isRunning || isPending) && (
            <button
              onClick={() => setShowStopModal(true)}
              style={{
                padding: "8px 20px", borderRadius: "8px", fontSize: "13px", fontWeight: 600,
                background: "rgba(239, 68, 68, 0.1)", color: "#ef4444",
                border: "1px solid rgba(239, 68, 68, 0.3)", cursor: "pointer",
                display: "flex", alignItems: "center", gap: "8px",
                transition: "all 0.2s"
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)"; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <rect x="4" y="4" width="16" height="16" rx="2" />
              </svg>
              Stop Execution
            </button>
          )}

          {/* Status Badge */}
          <span style={{
            padding: "6px 16px", borderRadius: "20px", fontSize: "13px", fontWeight: 700,
            background: statusColors.bg, color: statusColors.color,
            border: `1px solid ${statusColors.border}`,
            animation: isRunning ? "pulse 2s infinite" : "none"
          }}>
            {runData?.status || "LOADING"}
          </span>
          {/* Timer */}
          <div style={{ fontFamily: "monospace", fontSize: "20px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "2px" }}>
            {isComplete && runData?.durationMs ? formatDuration(runData.durationMs) : formatTime(computedElapsed)}
          </div>
        </div>
      </div>

      {/* Redirect Countdown Banner */}
      {redirectCountdown !== null && (
        <div
          onClick={handleRedirectNow}
          style={{
            padding: "12px 24px", flexShrink: 0, cursor: "pointer",
            background: runData?.status === "PASSED"
              ? "linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(52, 211, 153, 0.1))"
              : "linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(248, 113, 113, 0.1))",
            borderBottom: "1px solid var(--border)",
            display: "flex", justifyContent: "center", alignItems: "center", gap: "12px",
            transition: "background 0.3s"
          }}
        >
          <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
            Execution {runData?.status === "PASSED" ? "passed" : "failed"} — Redirecting to Summary Board in {redirectCountdown}s...
          </span>
          <span style={{
            fontSize: "12px", fontWeight: 600, color: "var(--primary-light)",
            padding: "4px 12px", background: "rgba(99, 102, 241, 0.15)", borderRadius: "12px",
            border: "1px solid rgba(99, 102, 241, 0.3)"
          }}>
            Click to go now →
          </span>
        </div>
      )}

      {/* Progress Bar */}
      <div style={{ height: "4px", background: "var(--bg-secondary)", flexShrink: 0 }}>
        <div style={{
          height: "100%", width: `${progress}%`,
          background: isStopped
            ? "linear-gradient(90deg, #6b7280, #9ca3af)"
            : "linear-gradient(90deg, #6366f1, #8b5cf6, #a78bfa)",
          transition: "width 0.5s ease-in-out",
          borderRadius: "0 2px 2px 0",
          boxShadow: isRunning ? "0 0 8px rgba(99, 102, 241, 0.5)" : "none"
        }} />
      </div>

      {/* ═══ MAIN CONTENT — Split Layout ═══ */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ─── LEFT: Test Cases & Step Tracker ─── */}
        <div style={{ width: "380px", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
          {/* Test Case Tabs */}
          <div style={{ padding: "12px", borderBottom: "1px solid var(--border)", overflowY: "auto", maxHeight: "200px", flexShrink: 0 }}>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px", padding: "0 4px" }}>Test Cases ({tcCount})</div>
            {testCasesSafe.map((tc, idx) => (
              <div
                key={tc.id}
                onClick={() => setSelectedTcIndex(idx)}
                style={{
                  padding: "10px 12px", borderRadius: "8px", cursor: "pointer", marginBottom: "4px",
                  background: selectedTcIndex === idx ? "rgba(99, 102, 241, 0.1)" : "transparent",
                  border: selectedTcIndex === idx ? "1px solid rgba(99, 102, 241, 0.3)" : "1px solid transparent",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  transition: "all 0.15s"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  {stepIcon(tc.status)}
                  <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>{tc.name}</span>
                </div>
                {tc.durationMs > 0 && <span style={{ fontSize: "12px", color: "var(--text-muted)", fontFamily: "monospace" }}>{formatDuration(tc.durationMs)}</span>}
              </div>
            ))}
            {tcCount === 0 && (isRunning || isPending) && (
              <div style={{ padding: "16px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
                <div className="spinner-primary" style={{ width: 20, height: 20, margin: "0 auto 8px" }} />
                Waiting for test cases...
              </div>
            )}
          </div>

          {/* Step Tracker */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "12px" }}>
              {selectedTc ? `Steps — ${selectedTc.name}` : "Select a test case"}
            </div>
            {selectedTc && Array.isArray(selectedTc.steps) && selectedTc.steps.map((step, idx) => (
              <div key={step.id} style={{ display: "flex", gap: "12px", marginBottom: "2px" }}>
                {/* Vertical Line + Icon */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "24px" }}>
                  <div style={{ width: "24px", height: "24px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {stepIcon(step.status)}
                  </div>
                  {idx < (selectedTc.steps?.length || 0) - 1 && (
                    <div style={{
                      width: "2px", flex: 1, minHeight: "16px",
                      background: step.status === "PASSED" ? "#10b981" : step.status === "FAILED" ? "#ef4444" : "var(--border)"
                    }} />
                  )}
                </div>
                {/* Step Details */}
                <div style={{ flex: 1, paddingBottom: "12px" }}>
                  <div style={{ fontSize: "13px", fontWeight: 500, color: step.status === "FAILED" ? "#ef4444" : "var(--text-primary)" }}>
                    {step.name}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px", display: "flex", gap: "12px" }}>
                    {step.durationMs > 0 && <span>{formatDuration(step.durationMs)}</span>}
                    <span style={{ color: step.status === "PASSED" ? "#10b981" : step.status === "FAILED" ? "#ef4444" : "var(--text-muted)" }}>{step.status}</span>
                  </div>
                  {step.error && (
                    <div style={{ fontSize: "12px", color: "#fca5a5", background: "rgba(239,68,68,0.08)", padding: "6px 10px", borderRadius: "6px", marginTop: "4px", fontFamily: "monospace" }}>
                      {step.error}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {selectedTc && (!selectedTc.steps || selectedTc.steps.length === 0) && (
              <div style={{ padding: "16px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
                {isRunning ? "Steps executing..." : "No step data available."}
              </div>
            )}
          </div>
        </div>

        {/* ─── RIGHT: Live Console Logs ─── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {/* Log Header + Filters */}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
              Live Console
              {isRunning && <div className="spinner-primary" style={{ width: 12, height: 12 }} />}
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              {["ALL", "INFO", "DEBUG", "ERROR", "NETWORK"].map(level => (
                <button
                  key={level}
                  onClick={() => setLogFilter(level)}
                  style={{
                    padding: "4px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: 600,
                    border: logFilter === level ? "1px solid var(--primary)" : "1px solid var(--border)",
                    background: logFilter === level ? "rgba(99,102,241,0.15)" : "transparent",
                    color: logFilter === level ? "var(--primary-light)" : "var(--text-muted)",
                    cursor: "pointer", transition: "all 0.15s"
                  }}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          {/* Logs Stream */}
          <div
            ref={logContainerRef}
            style={{
              flex: 1, overflowY: "auto", padding: "16px", backgroundColor: "#0a0a0f",
              fontFamily: "'Fira Code', 'SF Mono', 'Monaco', monospace", fontSize: "12px", lineHeight: "20px"
            }}
          >
            {filteredLogs.length === 0 && (
              <div style={{ color: "var(--text-muted)", textAlign: "center", padding: "32px" }}>
                {isRunning ? "Waiting for logs..." : "No logs matching this filter."}
              </div>
            )}
            {filteredLogs.map((log, idx) => {
              const ts = log.timestamp ? new Date(log.timestamp).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
              return (
                <div key={idx} style={{ display: "flex", gap: "12px", padding: "2px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                  <span style={{ color: "#6b7280", minWidth: "70px", flexShrink: 0 }}>{ts}</span>
                  <span style={{
                    color: levelColor(log.level), fontWeight: 600, minWidth: "60px", flexShrink: 0,
                    textTransform: "uppercase", fontSize: "11px", paddingTop: "1px"
                  }}>
                    [{log.level}]
                  </span>
                  <span style={{ color: "#e2e8f0", wordBreak: "break-word" }}>{log.message}</span>
                </div>
              );
            })}
            {isRunning && (
              <div style={{ color: "#6366f1", padding: "4px 0", animation: "pulse 2s infinite" }}>
                █
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ STOP CONFIRMATION MODAL ═══ */}
      {showStopModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0, 0, 0, 0.7)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
        }}>
          <div style={{
            background: "var(--bg-primary)", padding: "32px", borderRadius: "16px",
            maxWidth: "420px", width: "100%", border: "1px solid var(--border)",
            boxShadow: "0 24px 48px rgba(0,0,0,0.5)", textAlign: "center"
          }}>
            <div style={{
              width: "48px", height: "48px", borderRadius: "12px",
              background: "rgba(239, 68, 68, 0.1)", display: "flex",
              alignItems: "center", justifyContent: "center", margin: "0 auto 16px"
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
            </div>
            <h2 style={{ margin: "0 0 8px 0", fontSize: "20px", color: "var(--text-primary)" }}>Stop Execution?</h2>
            <p style={{ margin: "0 0 24px 0", color: "var(--text-secondary)", fontSize: "14px", lineHeight: 1.6 }}>
              This will immediately terminate the running test execution. Any in-progress test cases will be stopped and the browser session will be closed.
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button
                onClick={() => setShowStopModal(false)}
                className="btn btn-ghost"
                disabled={isStopping}
              >
                Cancel
              </button>
              <button
                onClick={handleStopExecution}
                disabled={isStopping}
                style={{
                  padding: "10px 24px", borderRadius: "8px", fontSize: "14px", fontWeight: 600,
                  background: "#ef4444", color: "white", border: "none", cursor: "pointer",
                  opacity: isStopping ? 0.7 : 1, display: "flex", alignItems: "center", gap: "8px"
                }}
              >
                {isStopping ? (
                  <>
                    <div className="spinner-primary" style={{ width: 14, height: 14 }} />
                    Stopping...
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                      <rect x="4" y="4" width="16" height="16" rx="2" />
                    </svg>
                    Stop Execution
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
