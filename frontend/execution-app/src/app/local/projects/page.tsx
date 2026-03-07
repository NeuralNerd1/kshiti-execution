"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getLocalProjects, createLocalProject, LocalProject } from "@/services/projectService";

function LocalProjectsContent() {
    const { loading, authenticated, user, logout } = useAuth();
    const router = useRouter();

    const [projects, setProjects] = useState<LocalProject[]>([]);
    const [fetching, setFetching] = useState(true);
    const [error, setError] = useState("");

    const [showCreate, setShowCreate] = useState(false);
    const [name, setName] = useState("");
    const [desc, setDesc] = useState("");
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        if (!loading && authenticated && user?.user_type === "LOCAL") {
            fetchProjects();
        } else if (!loading && user?.user_type === "COMPANY") {
            // Company users shouldn't be here
            router.replace("/");
        }
    }, [loading, authenticated, user, router]);

    async function fetchProjects() {
        setFetching(true);
        try {
            const data = await getLocalProjects();
            setProjects(data);
        } catch (err: any) {
            setError(err.message || "Failed to load projects");
        } finally {
            setFetching(false);
        }
    }

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        setCreating(true);
        setError("");
        try {
            await createLocalProject(name, desc);
            setShowCreate(false);
            setName("");
            setDesc("");
            fetchProjects();
        } catch (err: any) {
            setError(err.message || "Failed to create project");
        } finally {
            setCreating(false);
        }
    }

    if (loading || fetching) {
        return (
            <div className="loading-screen">
                <div className="spinner-primary" style={{ width: 32, height: 32 }} />
            </div>
        );
    }

    return (
        <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
            {/* Top Navigation - No Sidebar! */}
            <header style={{
                background: "#fff",
                borderBottom: "1px solid var(--border)",
                padding: "16px 40px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between"
            }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a" }}>
                    Execution Platform <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>/ Local Hub</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                    <div className="user-header">
                        {user?.plan && <span className={`plan-badge ${user.plan.toLowerCase()}`}>{user.plan}</span>}
                        <div className="avatar">
                            {user?.display_name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || "U"}
                        </div>
                    </div>
                    <button onClick={logout} className="btn btn-ghost" style={{ padding: "8px 16px", color: "var(--error)" }}>
                        Sign Out
                    </button>
                </div>
            </header>

            <main style={{ padding: "40px", maxWidth: 1200, margin: "0 auto" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32 }}>
                    <div>
                        <h1 className="page-title">Your Local Projects</h1>
                        <p className="page-subtitle">Standalone automation workspaces powered by {user?.plan} plan features.</p>
                    </div>
                    <button onClick={() => setShowCreate(!showCreate)} className="btn btn-primary">
                        {showCreate ? "Cancel Creation" : "+ New Project"}
                    </button>
                </div>

                {error && <div className="error-msg" style={{ marginBottom: 24 }}>{error}</div>}

                {showCreate && (
                    <div className="card" style={{ marginBottom: 32, padding: "24px 32px" }}>
                        <h3 style={{ marginTop: 0, marginBottom: 20 }}>Create standalone project</h3>
                        <form onSubmit={handleCreate} style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 2fr auto" }}>
                            <div>
                                <label className="input-label">Project Name</label>
                                <input
                                    type="text" className="input-field" placeholder="e.g. Acme Backend Tests"
                                    value={name} onChange={(e) => setName(e.target.value)} required autoFocus
                                />
                            </div>
                            <div>
                                <label className="input-label">Short Description</label>
                                <input
                                    type="text" className="input-field" placeholder="Optional context"
                                    value={desc} onChange={(e) => setDesc(e.target.value)}
                                />
                            </div>
                            <div style={{ display: "flex", alignItems: "flex-end" }}>
                                <button type="submit" className="btn btn-primary" disabled={creating}>
                                    {creating ? "Saving..." : "Create"}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                <div className="projects-grid">
                    {projects.length === 0 && !showCreate && (
                        <div style={{
                            gridColumn: "1 / -1", textAlign: "center", padding: "64px 20px",
                            background: "#fff", borderRadius: "12px", border: "1px dashed var(--border-hover)"
                        }}>
                            <div style={{ color: "var(--text-muted)", marginBottom: 16 }}>No local projects found.</div>
                            <button onClick={() => setShowCreate(true)} className="btn btn-ghost">Create your first project</button>
                        </div>
                    )}
                    {projects.map(p => (
                        <div
                            key={p.id}
                            className="project-card"
                            onClick={() => router.push(`/local/projects/${p.id}/dashboard`)}
                        >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                                <div style={{
                                    width: 40, height: 40, background: "var(--primary-light)",
                                    color: "var(--primary)", borderRadius: 8, display: "flex",
                                    alignItems: "center", justifyContent: "center", fontWeight: 700
                                }}>
                                    {p.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="status-dot" title="Project Available" />
                            </div>
                            <div className="project-card-title">{p.name}</div>
                            <div className="project-card-desc">
                                {p.description || "No description provided."}
                            </div>
                            <div style={{ marginTop: 24, fontSize: 13, color: "var(--primary)", fontWeight: 600 }}>
                                Enter Workspace &rarr;
                            </div>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}

export default function LocalProjectsPage() {
    return (
        <Suspense fallback={
            <div className="loading-screen">
                <div className="spinner-primary" style={{ width: 32, height: 32 }} />
            </div>
        }>
            <LocalProjectsContent />
        </Suspense>
    );
}
