"use client";

import { useState, useEffect } from "react";
import { getAdminPlans, updateAdminPlan, AdminPlan } from "@/services/adminService";

export default function AdminPlansPage() {
    const [plans, setPlans] = useState<AdminPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [editingPlan, setEditingPlan] = useState<AdminPlan | null>(null);

    // Form state
    const [displayName, setDisplayName] = useState("");
    const [perksJson, setPerksJson] = useState("");
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        fetchPlans();
    }, []);

    async function fetchPlans() {
        try {
            const data = await getAdminPlans();
            setPlans(data);
        } catch (err: any) {
            setError(err.message || "Failed to load plans");
        } finally {
            setLoading(false);
        }
    }

    function handleEditClick(plan: AdminPlan) {
        setEditingPlan(plan);
        setDisplayName(plan.display_name);
        setIsVisible(plan.is_visible);
        setPerksJson(plan.perks_json ? JSON.stringify(plan.perks_json, null, 2) : "{}");
    }

    async function handleUpdatePlan(e: React.FormEvent) {
        e.preventDefault();
        if (!editingPlan) return;
        setError("");

        try {
            const parsedPerks = JSON.parse(perksJson);
            await updateAdminPlan(editingPlan.id, {
                display_name: displayName,
                perks_json: parsedPerks,
                is_visible: isVisible
            });
            setEditingPlan(null);
            fetchPlans();
        } catch (err: any) {
            setError(err.message || "Failed to update plan. Ensure JSON is valid.");
        }
    }

    if (loading) return <div>Loading plans...</div>;

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Plans & Perks Configuration</h1>
            </div>

            {error && <div className="error-msg" style={{ marginBottom: 16 }}>{error}</div>}

            {editingPlan && (
                <div className="card" style={{ marginBottom: 24, padding: 24, background: "#fff" }}>
                    <h3 style={{ marginTop: 0 }}>Editing: {editingPlan.plan_key} Plan</h3>
                    <form onSubmit={handleUpdatePlan} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <div>
                            <label className="input-label">Display Name</label>
                            <input
                                type="text" className="input-field"
                                value={displayName} onChange={(e) => setDisplayName(e.target.value)} required
                            />
                        </div>
                        <div>
                            <label className="input-label">Perks Configuration (Must be valid JSON)</label>
                            <textarea
                                className="input-field"
                                style={{ height: 160, fontFamily: "monospace", padding: 12 }}
                                value={perksJson} onChange={(e) => setPerksJson(e.target.value)} required
                            />
                        </div>
                        <div>
                            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                                <input
                                    type="checkbox"
                                    checked={isVisible}
                                    onChange={(e) => setIsVisible(e.target.checked)}
                                />
                                Visible to users in plan listings
                            </label>
                        </div>
                        <div style={{ display: "flex", gap: 12 }}>
                            <button type="submit" className="btn btn-primary">Save Changes</button>
                            <button type="button" onClick={() => setEditingPlan(null)} className="btn btn-ghost">Cancel</button>
                        </div>
                    </form>
                </div>
            )}

            <div className="projects-grid">
                {plans.map(p => (
                    <div key={p.id} className="project-card" style={{ background: "#fff" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                            <span className={`plan-badge ${p.plan_key.toLowerCase()}`}>{p.plan_key}</span>
                            {!p.is_visible && <span style={{ fontSize: 11, color: "var(--error)", fontWeight: 600 }}>HIDDEN</span>}
                        </div>
                        <div className="project-card-title">{p.display_name}</div>
                        <div className="project-card-desc" style={{ marginBottom: 16 }}>
                            {p.perks_json && Object.keys(p.perks_json).length > 0 ? (
                                <ul style={{ paddingLeft: 16, margin: "8px 0" }}>
                                    {Object.entries(p.perks_json).slice(0, 3).map(([key, val]: any) => (
                                        <li key={key}>{key}: {String(val)}</li>
                                    ))}
                                    {Object.keys(p.perks_json).length > 3 && <li>...</li>}
                                </ul>
                            ) : "No perks defined."}
                        </div>
                        <button onClick={() => handleEditClick(p)} className="btn btn-ghost" style={{ width: "100%" }}>
                            Edit Plan Config
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
