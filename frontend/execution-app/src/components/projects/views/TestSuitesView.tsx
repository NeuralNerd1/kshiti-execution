"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { getProjectSnapshot } from "@/services/bridgeService";
import { toast } from "sonner";

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

export default function TestSuitesView() {
  const params = useParams();
  const projectId = params?.project_id as string;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [suites, setSuites] = useState<TestSuite[]>([]);

  // Maps to quickly look up test case details by ID
  const [globalCases, setGlobalCases] = useState<Record<number, TestCaseDetail>>({});
  const [localCases, setLocalCases] = useState<Record<number, TestCaseDetail>>({});

  const [selectedSuite, setSelectedSuite] = useState<TestSuite | null>(null);
  const [viewingTestCase, setViewingTestCase] = useState<TestCaseRef | null>(null);

  useEffect(() => {
    if (!projectId) return;

    async function fetchData() {
      try {
        setLoading(true);
        const data = await getProjectSnapshot(projectId);

        // Parse test suites
        const loadedSuites: TestSuite[] = data.test_suites || [];
        setSuites(loadedSuites);

        // Build lookup maps for fast access
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

        if (loadedSuites.length > 0) {
          setSelectedSuite(loadedSuites[0]);
        }
      } catch (err: any) {
        console.error("Failed to load project snapshot:", err);
        const msg = err.message || "Failed to load test suites.";
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [projectId]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "400px" }}>
        <div className="spinner-primary" style={{ width: 32, height: 32 }} />
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

  // Helper to get case details
  const getCaseDetail = (ref: TestCaseRef): TestCaseDetail | null => {
    if (ref.type === "LOCAL") return localCases[ref.id] || null;
    return globalCases[ref.id] || null;
  };

  return (
    <div style={{ display: "flex", gap: "24px", height: "calc(100vh - 120px)" }}>

      {/* Left Pane: Suites List */}
      <div className="card" style={{ width: "350px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "24px 24px 16px 24px", borderBottom: "1px solid var(--border)" }}>
          <h3 style={{ margin: 0, fontSize: "18px", color: "var(--text-primary)" }}>Test Suites</h3>
          <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "var(--text-muted)" }}>
            {suites.length} Suites available
          </p>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
          {suites.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "20px" }}>
              No test suites found.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {suites.map((suite) => (
                <div
                  key={suite.id}
                  onClick={() => {
                    setSelectedSuite(suite);
                    setViewingTestCase(null); // Reset detail view on suite change
                  }}
                  style={{
                    padding: "16px",
                    borderRadius: "8px",
                    background: selectedSuite?.id === suite.id ? "var(--primary-light)" : "var(--bg-secondary)",
                    border: `1px solid ${selectedSuite?.id === suite.id ? "var(--primary)" : "var(--border)"}`,
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                    <div style={{ fontWeight: 600, color: selectedSuite?.id === suite.id ? "var(--primary)" : "var(--text-primary)" }}>
                      {suite.name}
                    </div>
                    <span style={{ fontSize: "11px", padding: "2px 6px", borderRadius: "4px", background: "var(--bg-primary)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                      {suite.test_case_ids?.length || 0} cases
                    </span>
                  </div>
                  <div style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "12px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {suite.description || "No description provided."}
                  </div>

                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {suite.tags?.map((tag, idx) => (
                      <span key={idx} style={{ fontSize: "11px", padding: "2px 8px", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", borderRadius: "12px", color: "var(--text-secondary)" }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Pane: Selected Suite Details */}
      <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {viewingTestCase ? (
          (() => {
            const tc = getCaseDetail(viewingTestCase);
            if (!tc) return <div style={{ padding: 32 }}>Failed to load details.</div>;

            const renderItem = (item: any, index?: number) => {
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

            return (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto", padding: "32px", color: "var(--text-primary)" }}>
                <div style={{ paddingBottom: "16px", borderBottom: "1px solid var(--border)", marginBottom: "24px" }}>
                  <button onClick={() => setViewingTestCase(null)} style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)", padding: "6px 12px", borderRadius: "8px", fontSize: "12px", marginBottom: "16px", cursor: "pointer" }}>
                    &larr; Back to Suite
                  </button>
                  <h2 style={{ margin: "0 0 8px 0", fontSize: "24px", color: "var(--text-primary)" }}>{tc.name}</h2>
                  {tc.description && <p style={{ margin: 0, fontSize: "14px", color: "var(--text-muted)" }}>{tc.description}</p>}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px" }}>
                    <strong style={{ display: "block", color: "var(--primary-light)", fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>Pre Conditions</strong>
                    <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                      {(tc.pre_conditions || []).map((p: any, i: number) => <li key={i} style={{ listStyle: "none", marginLeft: "-18px" }}>{renderItem(p, i)}</li>)}
                      {(!tc.pre_conditions || tc.pre_conditions.length === 0) && <li style={{ listStyle: "none", marginLeft: "-18px", color: "var(--text-muted)", fontStyle: "italic" }}>None</li>}
                    </ul>
                  </div>

                  <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px" }}>
                    <strong style={{ display: "block", color: "var(--primary-light)", fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>Steps</strong>
                    <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                      {(tc.steps || []).map((s: any, i: number) => <li key={i} style={{ listStyle: "none", marginLeft: "-18px" }}>{renderItem(s, i)}</li>)}
                      {(!tc.steps || tc.steps.length === 0) && <li style={{ listStyle: "none", marginLeft: "-18px", color: "var(--text-muted)", fontStyle: "italic" }}>None</li>}
                    </ul>
                  </div>

                  <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px" }}>
                    <strong style={{ display: "block", color: "var(--primary-light)", fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>Expected Outcomes</strong>
                    <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                      {(tc.expected_outcomes || []).map((o: any, i: number) => <li key={i} style={{ listStyle: "none", marginLeft: "-18px" }}>{renderItem(o, i)}</li>)}
                      {(!tc.expected_outcomes || tc.expected_outcomes.length === 0) && <li style={{ listStyle: "none", marginLeft: "-18px", color: "var(--text-muted)", fontStyle: "italic" }}>None</li>}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })()
        ) : selectedSuite ? (
          <>
            {/* Header Details */}
            <div style={{ padding: "32px", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: "var(--primary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                  </svg>
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: "24px", color: "var(--text-primary)" }}>{selectedSuite.name}</h2>
                  <div style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px" }}>
                    Created on {new Date(selectedSuite.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                {selectedSuite.description || "No description provided."}
              </p>
            </div>

            {/* Test Cases List */}
            <div style={{ flex: 1, overflowY: "auto", padding: "32px" }}>
              <h4 style={{ margin: "0 0 20px 0", fontSize: "16px", color: "var(--text-primary)" }}>Included Test Cases</h4>

              {(!selectedSuite.test_case_ids || selectedSuite.test_case_ids.length === 0) ? (
                <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", background: "var(--bg-secondary)", borderRadius: "8px", border: "1px dashed var(--border)" }}>
                  This suite does not contain any test cases yet.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {selectedSuite.test_case_ids.map((ref, idx) => {
                    const tc = getCaseDetail(ref);
                    return (
                      <div key={`${ref.type}-${ref.id}-${idx}`} style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "16px",
                        background: "var(--bg-secondary)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px"
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                            <span style={{
                              fontSize: "10px",
                              fontWeight: 600,
                              letterSpacing: "0.5px",
                              color: ref.type === "GLOBAL" ? "#3b82f6" : "#10b981",
                              background: ref.type === "GLOBAL" ? "rgba(59, 130, 246, 0.1)" : "rgba(16, 185, 129, 0.1)",
                              padding: "4px 8px",
                              borderRadius: "4px",
                              border: `1px solid ${ref.type === "GLOBAL" ? "rgba(59, 130, 246, 0.2)" : "rgba(16, 185, 129, 0.2)"}`
                            }}>
                              {ref.type}
                            </span>
                            <span style={{ fontSize: "15px", fontWeight: 500, color: "var(--text-primary)" }}>
                              {tc ? tc.name : `Unknown Test Case (ID: ${ref.id})`}
                            </span>
                          </div>
                          <div style={{ fontSize: "13px", color: "var(--text-muted)", paddingLeft: "12px", borderLeft: "2px solid var(--border-hover)", marginLeft: "4px" }}>
                            {tc?.description || "No description available."}
                          </div>
                        </div>
                        <div style={{ paddingLeft: "24px" }}>
                          <button
                            className="btn btn-ghost"
                            style={{ fontSize: "13px" }}
                            onClick={() => setViewingTestCase(ref)}
                          >
                            View Details &rarr;
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", color: "var(--text-muted)" }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, marginBottom: "16px" }}>
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            <div>Select a test suite from the left to view details</div>
          </div>
        )}
      </div>
    </div>
  );
}
