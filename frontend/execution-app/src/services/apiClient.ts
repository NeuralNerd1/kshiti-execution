type ApiError = {
    message: string;
    status: number;
};

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

/* ============================
   TOKEN HELPERS
============================ */

export function getAccessToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("exec_access_token");
}

export function setAccessToken(token: string): void {
    if (typeof window === "undefined") return;
    localStorage.setItem("exec_access_token", token);
}

export function clearAccessToken(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem("exec_access_token");
}

/* ============================
   API REQUEST (SINGLE SOURCE)
============================ */

export async function apiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const token = getAccessToken();

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(options.headers || {}),
        },
    });

    const contentType = response.headers.get("content-type");
    const data =
        contentType && contentType.includes("application/json")
            ? await response.json()
            : null;

    if (!response.ok) {
        if (response.status === 401) {
            clearAccessToken();
        }

        const error: ApiError = {
            message:
                (data && data.error) ||
                (data && data.detail) ||
                "Request failed",
            status: response.status,
        };
        throw error;
    }

    return data as T;
}
