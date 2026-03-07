"use client";

import { useAuth } from "@/hooks/useAuth";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

export default function ProjectLayout({ children, baseUrl }: { children: React.ReactNode; baseUrl: string }) {
    const { loading, authenticated, user, logout } = useAuth();
    const pathname = usePathname();
    const router = useRouter();

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="spinner-primary" style={{ width: 32, height: 32 }} />
            </div>
        );
    }

    if (!authenticated) {
        // Automatically handled by useAuth redirect.
        return null;
    }

    return (
        <div className="app-layout">
            {/* Sidebar */}
            <Sidebar baseUrl={baseUrl} />

            {/* Right Side Content wrapper */}
            <div style={{ display: "flex", flexDirection: "column", flex: 1, height: "100vh", overflow: "hidden" }}>
                <TopBar user={user} logout={logout} />

                <main className="main-content" style={{ flex: 1, overflowY: "auto", padding: "32px 40px" }}>
                    {children}
                </main>
            </div>
        </div>
    );
}
