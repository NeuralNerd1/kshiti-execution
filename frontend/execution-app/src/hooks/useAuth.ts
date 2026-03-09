"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSession } from "@/services/authService";
import { getAccessToken, setAccessToken, clearAccessToken } from "@/services/apiClient";
import type { AuthUser } from "@/types/auth";

type AuthState = {
    loading: boolean;
    authenticated: boolean;
    user: AuthUser | null;
};

export function useAuth() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [authState, setAuthState] = useState<AuthState>({
        loading: true,
        authenticated: false,
        user: null,
    });

    const checkAuth = useCallback(async () => {
        // 1. Check for token passed via URL (from planning app redirect)
        const urlToken = searchParams.get("token");
        if (urlToken) {
            setAccessToken(urlToken);
            // Clean URL
            const url = new URL(window.location.href);
            url.searchParams.delete("token");
            window.history.replaceState({}, "", url.toString());
        }

        // 2. Check localStorage
        const token = getAccessToken();
        if (!token) {
            setAuthState({ loading: false, authenticated: false, user: null });
            router.replace("/login");
            return;
        }

        // 3. Verify with backend
        try {
            const session = await getSession();
            if (session.authenticated) {
                setAuthState({
                    loading: false,
                    authenticated: true,
                    user: session.user,
                });
            } else {
                clearAccessToken();
                setAuthState({ loading: false, authenticated: false, user: null });
                router.replace("/login");
            }
        } catch {
            clearAccessToken();
            setAuthState({ loading: false, authenticated: false, user: null });
            router.replace("/login");
        }
    }, [searchParams, router]);

    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    const logout = useCallback(() => {
        clearAccessToken();
        setAuthState({ loading: false, authenticated: false, user: null });
        router.push("/login");
    }, [router]);

    return { ...authState, logout, refresh: checkAuth };
}
