"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken, setAccessToken } from "@/services/apiClient";
import { getSession } from "@/services/authService";
import { bridgeSSOLogin } from "@/services/bridgeService";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    async function checkAuth() {
      // 1. Check if token is passed via URL (Bridge redirect from Planning App)
      const urlParams = new URLSearchParams(window.location.search);
      const djangoToken = urlParams.get("token");

      if (djangoToken) {
        try {
          // Exchange Django Token for Execution Token via our Go Backend API
          const res = await bridgeSSOLogin(djangoToken);
          setAccessToken(res.token);
          localStorage.setItem("exec_user", JSON.stringify(res.user));

          // Clean URL
          const url = new URL(window.location.href);
          url.searchParams.delete("token");
          window.history.replaceState({}, "", url.toString());

          let redirectUrl = "/local/projects";
          const bd = res.bridge_data;
          if (bd && bd.company && bd.projects?.length > 0) {
            redirectUrl = `/company/${bd.company.slug}/projects/${bd.projects[0].id}/dashboard`;
          }

          router.replace(redirectUrl);
          return;
        } catch (err) {
          console.error("SSO Login failed", err);
          router.replace("/login");
          return;
        }
      }

      // 2. Normal flow: check existing Execution Token
      const token = getAccessToken();
      if (!token) {
        router.replace("/login");
        return;
      }

      try {
        // Authenticate with execution backend
        const session = await getSession();
        localStorage.setItem("exec_user", JSON.stringify(session.user));

        // If local user directly logs in, go to local projects grid
        router.replace("/local/projects");
      } catch (err) {
        router.replace("/login");
      }
    }

    checkAuth();
  }, [router]);

  return (
    <div className="loading-screen">
      <div className="spinner-primary" style={{ width: 32, height: 32 }} />
      <span style={{ marginTop: 12 }}>Loading execution environment...</span>
    </div>
  );
}
