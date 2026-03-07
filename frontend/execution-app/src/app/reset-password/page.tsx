"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { resetPassword } from "@/services/authService";

export default function ResetPasswordPage() {
    const router = useRouter();
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [resetToken, setResetToken] = useState("");

    useEffect(() => {
        const token = sessionStorage.getItem("reset_token");
        if (!token) {
            router.replace("/forgot-password");
            return;
        }
        setResetToken(token);
    }, [router]);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();

        if (password.length < 6) {
            setError("Password must be at least 6 characters");
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        setLoading(true);
        setError("");

        try {
            await resetPassword({ reset_token: resetToken, new_password: password });
            setSuccess(true);
            sessionStorage.removeItem("reset_token");
            sessionStorage.removeItem("reset_email");
            setTimeout(() => {
                router.push("/login");
            }, 2000);
        } catch (err: any) {
            setError(err.message || "Password reset failed");
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
                        <div className="auth-subtitle">Create a new password</div>
                    </div>

                    {success ? (
                        <div className="success-msg" style={{ textAlign: "center" }}>
                            ✓ Password updated successfully!
                            <br />
                            Redirecting to login...
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="auth-form">
                            <div>
                                <label className="input-label">New Password</label>
                                <input
                                    id="new-password"
                                    type="password"
                                    className="input-field"
                                    placeholder="Min. 6 characters"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={loading}
                                    required
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="input-label">Confirm Password</label>
                                <input
                                    id="confirm-password"
                                    type="password"
                                    className="input-field"
                                    placeholder="Repeat your password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    disabled={loading}
                                    required
                                />
                            </div>

                            {error && <div className="error-msg">{error}</div>}

                            <button
                                id="reset-submit"
                                type="submit"
                                className="btn btn-primary"
                                disabled={loading}
                                style={{ width: "100%" }}
                            >
                                {loading ? (
                                    <>
                                        <div className="spinner" />
                                        Updating...
                                    </>
                                ) : (
                                    "Update Password"
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
