"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function AdminSecretPage() {
    const router = useRouter();
    const [secret, setSecret] = useState("");

    function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (secret) {
            localStorage.setItem("exec_admin_secret", secret);
            router.push("/admin/users");
        }
    }

    return (
        <div className="auth-container" style={{ background: "#f8fafc" }}>
            <div className="auth-card">
                <div className="card" style={{ background: "#fff" }}>
                    <div className="auth-header">
                        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>Admin Access</h1>
                        <p className="auth-subtitle">Enter the generic ADMIN_SECRET</p>
                    </div>
                    <form onSubmit={handleSubmit} className="auth-form">
                        <div>
                            <input
                                type="password"
                                className="input-field"
                                placeholder="Admin Secret"
                                value={secret}
                                onChange={(e) => setSecret(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>
                            Enter Platform Admin
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
