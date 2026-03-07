"use client";

import { useState, useEffect } from "react";
import { getAdminUsers, createAdminUser, changeUserPassword, AdminUser } from "@/services/adminService";

export default function AdminUsersPage() {
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // New user form state
    const [showAdd, setShowAdd] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [plan, setPlan] = useState("FREE");

    useEffect(() => {
        fetchUsers();
    }, []);

    async function fetchUsers() {
        try {
            const data = await getAdminUsers();
            setUsers(data);
        } catch (err: any) {
            setError(err.message || "Failed to load users");
        } finally {
            setLoading(false);
        }
    }

    async function handleAddUser(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        try {
            await createAdminUser({ email, password, display_name: name, plan });
            setShowAdd(false);
            setEmail("");
            setPassword("");
            setName("");
            fetchUsers();
        } catch (err: any) {
            setError(err.message || "Failed to create user");
        }
    }

    async function handleChangePassword(id: number) {
        const newPass = prompt("Enter new password for this user:");
        if (!newPass) return;
        try {
            await changeUserPassword(id, { new_password: newPass });
            alert("Password updated");
        } catch (err: any) {
            alert("Error: " + (err.message || "Update failed"));
        }
    }

    if (loading) return <div>Loading users...</div>;

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Execution Users</h1>
                <button onClick={() => setShowAdd(!showAdd)} className="btn btn-primary">
                    {showAdd ? "Cancel" : "Add Local User"}
                </button>
            </div>

            {error && <div className="error-msg" style={{ marginBottom: 16 }}>{error}</div>}

            {showAdd && (
                <div className="card" style={{ marginBottom: 24, padding: 24, background: "#fff" }}>
                    <h3 style={{ marginTop: 0 }}>Create New Execution User</h3>
                    <form onSubmit={handleAddUser} style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr" }}>
                        <input
                            type="email" className="input-field" placeholder="Email"
                            value={email} onChange={(e) => setEmail(e.target.value)} required
                        />
                        <input
                            type="password" className="input-field" placeholder="Password"
                            value={password} onChange={(e) => setPassword(e.target.value)} required
                        />
                        <input
                            type="text" className="input-field" placeholder="Display Name (Optional)"
                            value={name} onChange={(e) => setName(e.target.value)}
                        />
                        <select className="input-field" value={plan} onChange={(e) => setPlan(e.target.value)}>
                            <option value="FREE">FREE</option>
                            <option value="ADVANCE">ADVANCE</option>
                            <option value="COMPANY">COMPANY</option>
                        </select>
                        <div style={{ gridColumn: "1 / -1" }}>
                            <button type="submit" className="btn btn-primary">Create User</button>
                        </div>
                    </form>
                </div>
            )}

            <div className="card" style={{ padding: 0, overflow: "hidden", background: "#fff" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 14 }}>
                    <thead style={{ background: "var(--bg-input)", color: "var(--text-secondary)" }}>
                        <tr>
                            <th style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>ID</th>
                            <th style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>Email</th>
                            <th style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>Name</th>
                            <th style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>Plan</th>
                            <th style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.length === 0 ? (
                            <tr><td colSpan={5} style={{ padding: 16, textAlign: "center" }}>No local users found</td></tr>
                        ) : (
                            users.map(u => (
                                <tr key={u.id} style={{ borderBottom: "1px solid var(--border)" }}>
                                    <td style={{ padding: "12px 16px", color: "var(--text-secondary)" }}>{u.id}</td>
                                    <td style={{ padding: "12px 16px", fontWeight: 500 }}>{u.email}</td>
                                    <td style={{ padding: "12px 16px" }}>{u.display_name || "—"}</td>
                                    <td style={{ padding: "12px 16px" }}>
                                        <span className={`plan-badge ${u.plan.toLowerCase()}`}>{u.plan}</span>
                                    </td>
                                    <td style={{ padding: "12px 16px" }}>
                                        <button onClick={() => handleChangePassword(u.id)} className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: 12 }}>
                                            Change Pass
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
