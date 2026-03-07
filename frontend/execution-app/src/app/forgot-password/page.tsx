"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { forgotPassword } from "@/services/authService";

export default function ForgotPasswordPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            await forgotPassword({ email });
            setSuccess(true);
            // Store email for verify-code page
            sessionStorage.setItem("reset_email", email);
            setTimeout(() => {
                router.push("/verify-code");
            }, 2000);
        } catch (err: any) {
            setError(err.message || "Something went wrong");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="card card-elevated" style={{ padding: "40px" }}>
                    <div className="auth-header">
                        <div className="auth-logo">Kshiti</div>
                        <div className="auth-subtitle">Reset your password</div>
                    </div>

                    {success ? (
                        <div className="success-msg" style={{ textAlign: "center" }}>
                            ✓ If your email is registered, you'll receive a 6-digit code.
                            <br />
                            Redirecting...
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="auth-form">
                            <div>
                                <label className="input-label">Email address</label>
                                <input
                                    id="forgot-email"
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

                            {error && <div className="error-msg">{error}</div>}

                            <button
                                id="forgot-submit"
                                type="submit"
                                className="btn btn-primary"
                                disabled={loading}
                                style={{ width: "100%" }}
                            >
                                {loading ? (
                                    <>
                                        <div className="spinner" />
                                        Sending...
                                    </>
                                ) : (
                                    "Send Reset Code"
                                )}
                            </button>
                        </form>
                    )}

                    <div className="auth-footer">
                        <Link href="/login">← Back to login</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
