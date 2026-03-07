"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import { getProjectSnapshot } from "@/services/bridgeService";
import { executeSuite, getExecutionConfig, getRunStatus } from "@/services/executionService";
import { toast } from "sonner";

// --- Types ---
type TestCaseRef = {
    id: number;
    type: "LOCAL" | "GLOBAL";
};

type TestSuite = {
    id: number;
    name: string;
    description: string;
    tags: string[];
    test_case_ids: TestCaseRef[];
    status: string;
    created_at: string;
};

type TestCaseDetail = {
    id: number;
    name: string;
    description: string;
    status: string;
    tags: string[];
    type: "LOCAL" | "GLOBAL";
    pre_conditions: any[];
    steps: any[];
    expected_outcomes: any[];
};

export default function TestLoadExecuteView() {
    const params = useParams();
    const router = useRouter();
    const pathname = usePathname();
    const projectId = params?.project_id as string;
    const companySlug = params?.company_slug as string;

    const basePath = pathname?.includes("/local/")
        ? `/local/projects/${projectId}`
        : `/company/${companySlug}/projects/${projectId}`;

    const [checkingActiveRun, setCheckingActiveRun] = useState(true);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Data State
    const [suites, setSuites] = useState<TestSuite[]>([]);
    const [globalCases, setGlobalCases] = useState<Record<number, TestCaseDetail>>({});
    const [localCases, setLocalCases] = useState<Record<number, TestCaseDetail>>({});

    // UI Selection State
    const [selectedSuiteId, setSelectedSuiteId] = useState<string>("");
    const [scheduleType, setScheduleType] = useState<"NOW" | "LATER">("NOW");
    const [scheduleTime, setScheduleTime] = useState<string>("");
    const [viewingTestCase, setViewingTestCase] = useState<TestCaseRef | null>(null);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [executing, setExecuting] = useState(false);
    const [priorities, setPriorities] = useState<Record<string, string>>({});

    // Check for active execution on mount — auto-resume if running
    useEffect(() => {
        if (!projectId) { setCheckingActiveRun(false); return; }

        async function checkActiveRun() {
            try {
                const activeRunId = localStorage.getItem(`active_run_${projectId}`);
                if (activeRunId) {
                    const runData = await getRunStatus(activeRunId);
                    if (runData && (runData.status === "RUNNING" || runData.status === "PENDING")) {
                        toast.info("Resuming active execution...");
                        router.push(`${basePath}/live?runId=${activeRunId}`);
                        return;
                    } else {
                        // Run completed or not found — clear stale entry
                        localStorage.removeItem(`active_run_${projectId}`);
                    }
                }
            } catch (err) {
                // Run not found or API error — clear stale entry
                localStorage.removeItem(`active_run_${projectId}`);
            } finally {
                setCheckingActiveRun(false);
            }
        }

        checkActiveRun();
    }, [projectId]);

    useEffect(() => {
        if (!projectId || checkingActiveRun) return;

        async function fetchData() {
            try {
                setLoading(true);
                const data = await getProjectSnapshot(projectId);

                const loadedSuites: TestSuite[] = data.test_suites || [];
                setSuites(loadedSuites);

                const gMap: Record<number, TestCaseDetail> = {};
                (data.test_cases || []).forEach((tc: any) => {
                    gMap[tc.id] = { ...tc, type: "GLOBAL" };
                });
                setGlobalCases(gMap);

                const lMap: Record<number, TestCaseDetail> = {};
                (data.local_test_cases || []).forEach((tc: any) => {
                    lMap[tc.id] = { ...tc, type: "LOCAL" };
                });
                setLocalCases(lMap);

            } catch (err: any) {
                console.error("Failed to load project snapshot:", err);
                const msg = err.message || "Failed to load test suites for execution.";
                setError(msg);
                toast.error(msg);
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, [projectId, checkingActiveRun]);

    const getCaseDetail = (ref: TestCaseRef): TestCaseDetail | null => {
        if (ref.type === "LOCAL") return localCases[ref.id] || null;
        return globalCases[ref.id] || null;
    };

    const handlePriorityChange = (ref: TestCaseRef, value: string) => {
        setPriorities(prev => ({ ...prev, [`${ref.type}-${ref.id}`]: value }));
    };

    const handleExecuteClick = () => {
        if (!selectedSuiteId) {
            toast.error("Please select a test suite to execute.");
            return;
        }
        if (scheduleType === "LATER" && !scheduleTime) {
            toast.error("Please provide a time for the scheduled execution.");
            return;
        }
        setShowConfirmModal(true);
    };

    const confirmExecution = async () => {
        if (!selectedSuiteId) return;
        const suiteInfo = suites.find(s => s.id.toString() === selectedSuiteId);
        if (!suiteInfo) return;

        // Build suite data with embedded test cases
        const suiteData = {
            id: suiteInfo.id,
            name: suiteInfo.name,
            testCases: suiteInfo.test_case_ids.map(ref => {
                const tc = getCaseDetail(ref);
                if (!tc) return null;
                return {
                    id: tc.id,
                    name: tc.name,
                    pre_conditions: tc.pre_conditions || [],
                    steps: tc.steps || [],
                    expected_outcomes: tc.expected_outcomes || [],
                    configurations: (tc as any).configurations || {}
                };
            }).filter(Boolean)
        };

        let configData = {};
        try {
            const fetchedConfig = await getExecutionConfig(projectId);
            if (fetchedConfig && Object.keys(fetchedConfig).length > 0) {
                configData = fetchedConfig;
            } else {
                console.warn("No custom config found, using defaults on engine side");
            }
        } catch (err) {
            console.error("Failed to load configs before execution:", err);
            toast.error("Executing with default configurations (failed to fetch custom)");
        }

        try {
            setExecuting(true);
            setShowConfirmModal(false);
            if (scheduleType === "LATER") {
                toast.success(`Execution successfully scheduled for ${scheduleTime}!`);
                setExecuting(false);
                return;
            }

            toast.info(`Triggering execution for: ${suiteData.name}...`);
            const res = await executeSuite(suiteData, configData, projectId, companySlug);

            // Persist active run in localStorage for navigation resilience
            localStorage.setItem(`active_run_${projectId}`, res.runId);

            // Redirect to Live Execution Interface
            toast.success(`Execution started! Run ID: ${res.runId}`);
            router.push(`${basePath}/live?runId=${res.runId}`);
        } catch (err: any) {
            console.error("Execution error:", err);
            toast.error(err.message || "Failed to trigger execution");
        } finally {
            setExecuting(false);
        }
    };

    // Robust Render logic for step summaries (bullets in table)
    const renderSummaryItem = (item: any) => {
        let data = item;
        if (typeof item === 'string') {
            try { data = JSON.parse(item); } catch (e) { return item; }
        }
        if (data?.action_key || data?.action || data?.actionKey) {
            return data.action_key || data.action || data.actionKey;
        }
        if (data?.description) return data.description;
        if (data?.content) return data.content;
        if (data?.text) return data.text;
        return JSON.stringify(data);
    };

    // Robust Render logic for full details (cards in modal)
    const renderDetailItem = (item: any, index?: number) => {
        let data = item;
        if (typeof item === 'string') {
            try {
                data = JSON.parse(item);
            } catch (e) {
                return <div style={{ padding: "4px 0" }}>{item}</div>;
            }
        }

        if (data?.action_key || data?.action || data?.actionKey) {
            const actionName = data.action_key || data.action || data.actionKey;

            let params = data.parameters || data.params || {};
            if (typeof params === 'string') {
                try { params = JSON.parse(params); } catch (e) { }
            }

            // Extract configurations if they exist (usually a stringified JSON)
            const configs = data.configurations || data.step_configurations;

            const notes = data.notes || data.execution_notes || data.description;
            const paramEntries = Object.entries(params).filter(([_, v]) => v !== undefined && v !== "");

            return (
                <div style={{
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    padding: "16px",
                    marginBottom: "12px",
                    background: "rgba(255, 255, 255, 0.02)"
                }}>
                    <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "12px" }}>
                        {index !== undefined ? `${index + 1}. ` : ""}{actionName}
                    </div>

                    {configs && (
                        <div style={{
                            fontSize: "13px",
                            color: "var(--text-muted)",
                            background: "rgba(0, 0, 0, 0.2)",
                            padding: "8px 12px",
                            borderRadius: "6px",
                            marginBottom: "16px",
                            fontFamily: "monospace"
                        }}>
                            {typeof configs === 'string' ? configs : JSON.stringify(configs)}
                        </div>
                    )}

                    {notes && (
                        <div style={{
                            fontSize: "12.5px",
                            color: "var(--text-muted)",
                            background: "rgba(255, 255, 255, 0.03)",
                            padding: "6px 10px",
                            borderLeft: "2px solid var(--primary)",
                            borderRadius: "4px",
                            marginBottom: "12px",
                            fontStyle: "italic"
                        }}>
                            {typeof notes === 'string' ? notes : JSON.stringify(notes)}
                        </div>
                    )}

                    {paramEntries.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            {paramEntries.map(([key, value]) => (
                                <div key={key} style={{ display: "flex", fontSize: "13px", gap: "16px", alignItems: "baseline" }}>
                                    <span style={{ color: "var(--primary-light)", fontWeight: 500, minWidth: "120px" }}>{key}:</span>
                                    <span style={{ color: "var(--text-secondary)" }}>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            );
        }

        if (data?.description) return <div style={{ padding: "4px 0" }}>{data.description}</div>;
        if (data?.content) return <div style={{ padding: "4px 0" }}>{data.content}</div>;
        if (data?.text) return <div style={{ padding: "4px 0" }}>{data.text}</div>;
        return <div style={{ padding: "4px 0", fontSize: "12px", color: "var(--text-muted)" }}>{JSON.stringify(data)}</div>;
    };


    if (loading || checkingActiveRun) {
        return (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "400px", flexDirection: "column", gap: "12px" }}>
                <div className="spinner-primary" style={{ width: 32, height: 32 }} />
                {checkingActiveRun && <div style={{ color: "var(--text-muted)", fontSize: "13px" }}>Checking for active execution...</div>}
            </div>
        );
    }

    if (error) {
        return (
            <div className="card" style={{ padding: 32 }}>
                <div style={{ color: "var(--error)" }}>Error: {error}</div>
            </div>
        );
    }

    const selectedSuite = suites.find(s => s.id.toString() === selectedSuiteId);
    const detailedTestCase = viewingTestCase ? getCaseDetail(viewingTestCase) : null;

    return (
        <div style={{ maxWidth: "1600px", margin: "0 auto", paddingBottom: "60px", display: "flex", flexDirection: "column", gap: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: "28px", color: "var(--text-primary)", fontWeight: 700, letterSpacing: "-0.02em" }}>Test Execution</h1>
                    <p style={{ margin: "8px 0 0 0", color: "var(--text-muted)", fontSize: "15px" }}>
                        Select a test suite, configure execution schedule, set priorities, and proceed with execution.
                    </p>
                </div>
            </div>

            {/* --- TOP SECTION --- */}
            <div className="card" style={{ padding: "24px", display: "flex", gap: "48px", flexWrap: "wrap", borderTop: "4px solid var(--primary-light)" }}>
                {/* Suite Selection */}
                <div style={{ flex: "1 1 300px", minWidth: "300px" }}>
                    <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "8px" }}>Select Test Suite</label>
                    <select
                        value={selectedSuiteId}
                        onChange={(e) => setSelectedSuiteId(e.target.value)}
                        style={{ width: "100%", padding: "12px", borderRadius: "8px", background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)", fontSize: "14px", outline: "none" }}
                    >
                        <option value="" disabled>-- Select a suite --</option>
                        {suites.map(s => (
                            <option key={s.id} value={s.id.toString()}>{s.name} ({s.test_case_ids?.length || 0} cases)</option>
                        ))}
                    </select>
                </div>

                {/* Schedule Selection */}
                <div style={{ flex: "1 1 400px", minWidth: "400px" }}>
                    <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "12px" }}>Execution Schedule</label>
                    <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", color: "var(--text-secondary)" }}>
                            <input
                                type="radio"
                                name="scheduleType"
                                checked={scheduleType === "NOW"}
                                onChange={() => setScheduleType("NOW")}
                                style={{ accentColor: "var(--primary)" }}
                            />
                            Schedule For Now
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", color: "var(--text-secondary)" }}>
                            <input
                                type="radio"
                                name="scheduleType"
                                checked={scheduleType === "LATER"}
                                onChange={() => setScheduleType("LATER")}
                                style={{ accentColor: "var(--primary)" }}
                            />
                            Schedule For Later
                        </label>

                        {scheduleType === "LATER" && (
                            <input
                                type="datetime-local"
                                value={scheduleTime}
                                onChange={(e) => setScheduleTime(e.target.value)}
                                style={{ padding: "8px 12px", borderRadius: "8px", background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)", outline: "none" }}
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* --- TABULAR VIEW --- */}
            {selectedSuite && (
                <div className="card" style={{ overflow: "hidden" }}>
                    <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
                        <h3 style={{ margin: 0, fontSize: "18px", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
                            Suite: <span style={{ color: "var(--primary-light)" }}>{selectedSuite.name}</span>
                        </h3>
                    </div>

                    <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                            <thead style={{ background: "rgba(0,0,0,0.2)", borderBottom: "1px solid var(--border)", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>
                                <tr>
                                    <th style={{ padding: "16px 24px", minWidth: "200px" }}>Test Case Title</th>
                                    <th style={{ padding: "16px", minWidth: "220px" }}>Pre-conditions</th>
                                    <th style={{ padding: "16px", minWidth: "250px" }}>Steps</th>
                                    <th style={{ padding: "16px", minWidth: "220px" }}>Expected Outcomes</th>
                                    <th style={{ padding: "16px", minWidth: "150px" }}>Tags</th>
                                    <th style={{ padding: "16px", width: "140px" }}>Priority</th>
                                    <th style={{ padding: "16px", width: "120px", textAlign: "right" }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(!selectedSuite.test_case_ids || selectedSuite.test_case_ids.length === 0) ? (
                                    <tr>
                                        <td colSpan={7} style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)" }}>No test cases found in this suite.</td>
                                    </tr>
                                ) : (
                                    selectedSuite.test_case_ids.map((ref, idx) => {
                                        const tc = getCaseDetail(ref);
                                        if (!tc) return null;

                                        const priorityKey = `${ref.type}-${ref.id}`;
                                        const currentPriority = priorities[priorityKey] || "Medium";

                                        return (
                                            <tr key={`${priorityKey}-${idx}`} style={{ borderBottom: "1px solid var(--border)", background: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                                                <td style={{ padding: "16px 24px", verticalAlign: "top" }}>
                                                    <div style={{ fontWeight: 500, color: "var(--text-primary)", marginBottom: "4px" }}>{tc.name}</div>
                                                    <span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "4px", background: ref.type === "GLOBAL" ? "rgba(59, 130, 246, 0.1)" : "rgba(16, 185, 129, 0.1)", color: ref.type === "GLOBAL" ? "#3b82f6" : "#10b981", border: `1px solid ${ref.type === "GLOBAL" ? "rgba(59, 130, 246, 0.2)" : "rgba(16, 185, 129, 0.2)"}` }}>
                                                        {ref.type}
                                                    </span>
                                                </td>

                                                {/* Pre-conditions */}
                                                <td style={{ padding: "16px", verticalAlign: "top", fontSize: "13px", color: "var(--text-secondary)" }}>
                                                    <ul style={{ margin: 0, paddingLeft: "16px" }}>
                                                        {(tc.pre_conditions || []).map((p, i) => <li key={i}>{renderSummaryItem(p)}</li>)}
                                                        {(!tc.pre_conditions || tc.pre_conditions.length === 0) && <span style={{ fontStyle: "italic", color: "var(--text-muted)", marginLeft: "-16px" }}>None</span>}
                                                    </ul>
                                                </td>

                                                {/* Steps */}
                                                <td style={{ padding: "16px", verticalAlign: "top", fontSize: "13px", color: "var(--text-secondary)" }}>
                                                    <ul style={{ margin: 0, paddingLeft: "16px" }}>
                                                        {(tc.steps || []).map((s, i) => <li key={i}>{renderSummaryItem(s)}</li>)}
                                                        {(!tc.steps || tc.steps.length === 0) && <span style={{ fontStyle: "italic", color: "var(--text-muted)", marginLeft: "-16px" }}>None</span>}
                                                    </ul>
                                                </td>

                                                {/* Expected Outcomes */}
                                                <td style={{ padding: "16px", verticalAlign: "top", fontSize: "13px", color: "var(--text-secondary)" }}>
                                                    <ul style={{ margin: 0, paddingLeft: "16px" }}>
                                                        {(tc.expected_outcomes || []).map((o, i) => <li key={i}>{renderSummaryItem(o)}</li>)}
                                                        {(!tc.expected_outcomes || tc.expected_outcomes.length === 0) && <span style={{ fontStyle: "italic", color: "var(--text-muted)", marginLeft: "-16px" }}>None</span>}
                                                    </ul>
                                                </td>

                                                {/* Tags */}
                                                <td style={{ padding: "16px", verticalAlign: "top" }}>
                                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                                                        {(tc.tags || []).map((tag, i) => (
                                                            <span key={i} style={{ fontSize: "11px", padding: "2px 8px", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", borderRadius: "12px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                                                                {tag}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>

                                                {/* Priority */}
                                                <td style={{ padding: "16px", verticalAlign: "top" }}>
                                                    <select
                                                        value={currentPriority}
                                                        onChange={(e) => handlePriorityChange(ref, e.target.value)}
                                                        style={{
                                                            width: "100%", padding: "6px 8px", borderRadius: "6px", background: "var(--bg-primary)",
                                                            border: `1px solid ${currentPriority === "High" ? "var(--error)" : currentPriority === "Low" ? "var(--text-muted)" : "var(--primary)"}`,
                                                            color: "var(--text-primary)", fontSize: "13px", outline: "none"
                                                        }}
                                                    >
                                                        <option value="High">High</option>
                                                        <option value="Medium">Medium</option>
                                                        <option value="Low">Low</option>
                                                    </select>
                                                </td>

                                                {/* Actions */}
                                                <td style={{ padding: "16px", verticalAlign: "top", textAlign: "right" }}>
                                                    <button
                                                        onClick={() => setViewingTestCase(ref)}
                                                        className="btn btn-ghost"
                                                        style={{ padding: "6px 12px", fontSize: "12px", whiteSpace: "nowrap" }}
                                                    >
                                                        View Details
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* --- BOTTOM ACTION --- */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}>
                <button
                    onClick={handleExecuteClick}
                    className="btn btn-primary"
                    disabled={!selectedSuiteId}
                    style={{ padding: "14px 40px", fontSize: "16px", fontWeight: 600, display: "flex", alignItems: "center", gap: "10px", boxShadow: "0 4px 12px rgba(99, 102, 241, 0.4)" }}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                    Proceed with Execution
                </button>
            </div>


            {/* --- VIEW DETAILS MODAL --- */}
            {viewingTestCase && detailedTestCase && (
                <div style={{
                    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                    background: "rgba(0, 0, 0, 0.7)", backdropFilter: "blur(4px)",
                    display: "flex", alignItems: "center", justifyContent: "flex-end", zIndex: 1000
                }}>
                    <div style={{
                        background: "var(--bg-primary)", height: "100%", width: "600px", maxWidth: "100%",
                        borderLeft: "1px solid var(--border)", boxShadow: "-10px 0 30px rgba(0,0,0,0.5)",
                        display: "flex", flexDirection: "column"
                    }}>
                        <div style={{ padding: "24px 32px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", background: "var(--bg-secondary)" }}>
                            <div>
                                <h2 style={{ margin: "0 0 8px 0", fontSize: "22px", color: "var(--text-primary)" }}>{detailedTestCase.name}</h2>
                                <span style={{ fontSize: "12px", padding: "4px 8px", borderRadius: "4px", background: viewingTestCase.type === "GLOBAL" ? "rgba(59, 130, 246, 0.1)" : "rgba(16, 185, 129, 0.1)", color: viewingTestCase.type === "GLOBAL" ? "#3b82f6" : "#10b981", border: `1px solid ${viewingTestCase.type === "GLOBAL" ? "rgba(59, 130, 246, 0.2)" : "rgba(16, 185, 129, 0.2)"}` }}>
                                    {viewingTestCase.type} TEST CASE
                                </span>
                            </div>
                            <button onClick={() => setViewingTestCase(null)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "4px" }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                        <div style={{ flex: 1, overflowY: "auto", padding: "32px", display: "flex", flexDirection: "column", gap: "24px" }}>
                            {detailedTestCase.description && (
                                <p style={{ margin: 0, fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.6 }}>{detailedTestCase.description}</p>
                            )}
                            <div>
                                <strong style={{ display: "block", color: "var(--primary-light)", fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>Pre Conditions</strong>
                                {(detailedTestCase.pre_conditions || []).map((p: any, i: number) => <div key={i}>{renderDetailItem(p, i)}</div>)}
                                {(!detailedTestCase.pre_conditions || detailedTestCase.pre_conditions.length === 0) && <div style={{ color: "var(--text-muted)", fontStyle: "italic" }}>None</div>}
                            </div>
                            <div>
                                <strong style={{ display: "block", color: "var(--primary-light)", fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>Steps</strong>
                                {(detailedTestCase.steps || []).map((s: any, i: number) => <div key={i}>{renderDetailItem(s, i)}</div>)}
                                {(!detailedTestCase.steps || detailedTestCase.steps.length === 0) && <div style={{ color: "var(--text-muted)", fontStyle: "italic" }}>None</div>}
                            </div>
                            <div>
                                <strong style={{ display: "block", color: "var(--primary-light)", fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>Expected Outcomes</strong>
                                {(detailedTestCase.expected_outcomes || []).map((o: any, i: number) => <div key={i}>{renderDetailItem(o, i)}</div>)}
                                {(!detailedTestCase.expected_outcomes || detailedTestCase.expected_outcomes.length === 0) && <div style={{ color: "var(--text-muted)", fontStyle: "italic" }}>None</div>}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- PROCEED CONFIRMATION MODAL --- */}
            {showConfirmModal && (
                <div style={{
                    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                    background: "rgba(0, 0, 0, 0.7)", backdropFilter: "blur(4px)",
                    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
                }}>
                    <div style={{
                        background: "var(--bg-primary)", padding: "32px", borderRadius: "16px",
                        maxWidth: "400px", width: "100%", border: "1px solid var(--border)",
                        boxShadow: "0 24px 48px rgba(0,0,0,0.5)", textAlign: "center"
                    }}>
                        <h2 style={{ margin: "0 0 12px 0", fontSize: "20px", color: "var(--text-primary)" }}>Confirm Execution</h2>
                        <p style={{ margin: "0 0 24px 0", color: "var(--text-secondary)", fontSize: "14px", lineHeight: 1.5 }}>
                            You are about to execute the selected suite <strong>{scheduleType === "NOW" ? "immediately" : "at a scheduled time"}</strong>. Are you sure you want to proceed?
                        </p>
                        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
                            <button
                                onClick={() => setShowConfirmModal(false)}
                                className="btn btn-ghost"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmExecution}
                                disabled={executing}
                                className="btn btn-primary"
                            >
                                {executing ? "Executing..." : "Confirm Proceed"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
