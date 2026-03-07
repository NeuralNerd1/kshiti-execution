"use client";

import { useState, FormEvent, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { login } from "@/services/authService";
import { getAccessToken, setAccessToken } from "@/services/apiClient";

function LoginContent() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        // If already authenticated, go to root to process redirect
        const token = getAccessToken();
        if (token) {
            router.replace("/");
        }
    }, [router]);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const res = await login({ email, password });
            setAccessToken(res.token);

            // Store user info for display
            localStorage.setItem("exec_user", JSON.stringify(res.user));

            // Since it's a direct login without ?token= passed from Planning App,
            // we default to the local projects listing.
            router.push("/local/projects");
        } catch (err: any) {
            setError(err.message || "Login failed");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="card card-elevated" style={{ padding: "40px" }}>
                    <div className="auth-header">
                        <div className="auth-logo" style={{ color: "#0f172a", background: "none", WebkitTextFillColor: "initial" }}>Kshiti</div>
                        <div className="auth-subtitle">Execution Platform</div>
                    </div>

                    <form onSubmit={handleSubmit} className="auth-form">
                        <div>
                            <label className="input-label">Email</label>
                            <input
                                id="login-email"
                                type="email"
                                className="input-field"
                                placeholder="you@company.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={loading}
                                required
                                autoFocus
                            />
                        </div>

                        <div>
                            <label className="input-label">Password</label>
                            <input
                                id="login-password"
                                type="password"
                                className="input-field"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={loading}
                                required
                            />
                        </div>

                        {error && <div className="error-msg">{error}</div>}

                        <button
                            id="login-submit"
                            type="submit"
                            className="btn btn-primary"
                            disabled={loading}
                            style={{ width: "100%", marginTop: 4, color: "#fff" }}
                        >
                            {loading ? (
                                <>
                                    <div className="spinner" />
                                    Signing in...
                                </>
                            ) : (
                                "Sign In"
                            )}
                        </button>
                    </form>

                    <div className="auth-footer">
                        <Link href="/forgot-password">Forgot password?</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense
            fallback={
                <div className="loading-screen">
                    <div className="spinner-primary" style={{ width: 32, height: 32 }} />
                </div>
            }
        >
            <LoginContent />
        </Suspense>
    );
}
