"use client";

import { useState, useRef, FormEvent, useEffect, KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { verifyCode } from "@/services/authService";

export default function VerifyCodePage() {
    const router = useRouter();
    const [code, setCode] = useState(["", "", "", "", "", ""]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [email, setEmail] = useState("");
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        const storedEmail = sessionStorage.getItem("reset_email");
        if (!storedEmail) {
            router.replace("/forgot-password");
            return;
        }
        setEmail(storedEmail);
        inputRefs.current[0]?.focus();
    }, [router]);

    function handleChange(index: number, value: string) {
        if (!/^\d*$/.test(value)) return; // Only digits

        const newCode = [...code];
        newCode[index] = value.slice(-1); // Only last char
        setCode(newCode);

        // Auto-focus next input
        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    }

    function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Backspace" && !code[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    }

    function handlePaste(e: React.ClipboardEvent) {
        e.preventDefault();
        const paste = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
        const newCode = [...code];
        for (let i = 0; i < paste.length; i++) {
            newCode[i] = paste[i];
        }
        setCode(newCode);
        inputRefs.current[Math.min(paste.length, 5)]?.focus();
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        const fullCode = code.join("");
        if (fullCode.length !== 6) {
            setError("Please enter the complete 6-digit code");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const res = await verifyCode({ email, code: fullCode });
            if (res.valid && res.reset_token) {
                sessionStorage.setItem("reset_token", res.reset_token);
                router.push("/reset-password");
            } else {
                setError("Invalid or expired code");
            }
        } catch (err: any) {
            setError(err.message || "Verification failed");
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
                        <div className="auth-subtitle">
                            Enter the 6-digit code sent to
                            <br />
                            <strong style={{ color: "var(--text-primary)" }}>{email}</strong>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="auth-form">
                        <div className="code-inputs" onPaste={handlePaste}>
                            {code.map((digit, i) => (
                                <input
                                    key={i}
                                    ref={(el) => { inputRefs.current[i] = el; }}
                                    type="text"
                                    inputMode="numeric"
                                    className="code-input"
                                    value={digit}
                                    onChange={(e) => handleChange(i, e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(i, e)}
                                    maxLength={1}
                                    disabled={loading}
                                />
                            ))}
                        </div>

                        {error && <div className="error-msg">{error}</div>}

                        <button
                            id="verify-submit"
                            type="submit"
                            className="btn btn-primary"
                            disabled={loading || code.join("").length !== 6}
                            style={{ width: "100%" }}
                        >
                            {loading ? (
                                <>
                                    <div className="spinner" />
                                    Verifying...
                                </>
                            ) : (
                                "Verify Code"
                            )}
                        </button>
                    </form>

                    <div className="auth-footer">
                        <Link href="/forgot-password">Didn't receive a code? Try again</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
