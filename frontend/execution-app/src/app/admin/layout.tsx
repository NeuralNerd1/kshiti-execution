"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [hasSecret, setHasSecret] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const secret = localStorage.getItem("exec_admin_secret");
    if (!secret && pathname !== "/admin") {
      router.replace("/admin");
    } else {
      setHasSecret(!!secret);
    }
    setLoading(false);
  }, [pathname, router]);

  if (loading) return null;

  if (!hasSecret && pathname === "/admin") {
    return <>{children}</>;
  }

  function handleLogout() {
    localStorage.removeItem("exec_admin_secret");
    router.replace("/admin");
  }

  return (
    <div className="app-layout" style={{ background: "#f8fafc" }}>
      <aside className="sidebar" style={{ width: 260, background: "#fff", borderRight: "1px solid #e2e8f0" }}>
        <div className="sidebar-logo" style={{ color: "#0f172a", background: "none", WebkitTextFillColor: "initial", paddingLeft: 12 }}>
          Admin Panel
        </div>
        <nav className="sidebar-nav">
          <Link href="/admin/users" style={{ textDecoration: "none" }}>
            <div className={`sidebar-item ${pathname === "/admin/users" ? "active" : ""}`}>
              Users
            </div>
          </Link>
          <Link href="/admin/plans" style={{ textDecoration: "none" }}>
            <div className={`sidebar-item ${pathname === "/admin/plans" ? "active" : ""}`}>
              Plans & Perks
            </div>
          </Link>
        </nav>
        <div style={{ flex: 1 }} />
        <div className="sidebar-nav" style={{ marginTop: "auto" }}>
          <div className="sidebar-item" onClick={handleLogout} style={{ color: "var(--error)" }}>
            Sign Out Admin
          </div>
        </div>
      </aside >
      <main className="main-content" style={{ padding: "40px" }}>
        {children}
      </main>
    </div >
  );
}
