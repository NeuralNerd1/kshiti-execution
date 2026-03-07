"use client";

export default function ReportsView({ params }: { params?: any }) {
  return (
    <div style={{ height: "calc(100vh - 40px)", display: "flex", flexDirection: "column", gap: "16px", backgroundColor: "var(--bg-primary)", padding: "16px", borderRadius: "12px", border: "1px solid var(--border)", overflow: "hidden", position: "relative" }}>

      {/* Disabled Overlay */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "16px" }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--primary-light)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
        <h2 style={{ color: "var(--text-primary)", margin: 0, fontSize: "20px" }}>Reports Disabled</h2>
        <p style={{ color: "var(--text-muted)", maxWidth: "400px", textAlign: "center", margin: 0, fontSize: "14px" }}>
          The Enterprise Reports dashboard is currently disabled for this release iteration pending analytical database aggregation.
        </p>
      </div>
    </div>
  );
}
