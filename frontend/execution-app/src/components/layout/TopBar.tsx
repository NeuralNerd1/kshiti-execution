"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface TopBarProps {
    user: any;
    logout: () => void;
}

export default function TopBar({ user, logout }: TopBarProps) {
    const [menuOpen, setMenuOpen] = useState(false);
    const router = useRouter();

    const displayName = user?.display_name || user?.email || "User";
    const avatarLetter = displayName.charAt(0).toUpperCase();

    return (
        <header style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 40px",
            background: "var(--bg-secondary)",
            borderBottom: "1px solid var(--border)",
            height: "72px"
        }}>
            {/* Left side: Kshiti Name */}
            <div style={{
                fontSize: "18px",
                fontWeight: "700",
                color: "var(--text-primary)"
            }}>
                Kshiti
            </div>

            {/* Right side: User Menu */}
            <div style={{ position: "relative" }}>
                <div
                    onClick={() => setMenuOpen(!menuOpen)}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        cursor: "pointer",
                        padding: "6px 12px",
                        borderRadius: "var(--radius-sm)",
                        transition: "background 0.2s ease"
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "var(--primary-light)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                >
                    <div className="avatar">
                        {avatarLetter}
                    </div>
                    <div style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-primary)" }}>
                        {displayName}
                    </div>
                </div>

                {/* Dropdown Menu */}
                {menuOpen && (
                    <div style={{
                        position: "absolute",
                        top: "calc(100% + 8px)",
                        right: 0,
                        width: "200px",
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-sm)",
                        padding: "8px 0",
                        boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
                        zIndex: 50
                    }}>
                        <div
                            style={{ padding: "10px 16px", cursor: "pointer", fontSize: "14px", color: "var(--text-secondary)" }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--primary-light)"; e.currentTarget.style.color = "var(--text-primary)"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-secondary)"; }}
                            onClick={() => { setMenuOpen(false); /* Add route if needed */ }}
                        >
                            Profile
                        </div>
                        <div
                            style={{ padding: "10px 16px", cursor: "pointer", fontSize: "14px", color: "var(--text-secondary)" }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--primary-light)"; e.currentTarget.style.color = "var(--text-primary)"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-secondary)"; }}
                            onClick={() => { setMenuOpen(false); /* Add route if needed */ }}
                        >
                            Settings
                        </div>
                        <div style={{ height: "1px", background: "var(--border)", margin: "4px 0" }}></div>
                        <div
                            style={{ padding: "10px 16px", cursor: "pointer", fontSize: "14px", color: "var(--error)" }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                            onClick={() => { setMenuOpen(false); logout(); }}
                        >
                            Logout
                        </div>
                    </div>
                )}
            </div>
        </header>
    );
}
