import { apiRequest } from "./apiClient";
import type {
    LoginPayload,
    LoginResponse,
    SessionResponse,
    ForgotPasswordPayload,
    VerifyCodePayload,
    VerifyCodeResponse,
    ResetPasswordPayload,
} from "@/types/auth";

export async function login(payload: LoginPayload): Promise<LoginResponse> {
    return apiRequest<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

export async function getSession(): Promise<SessionResponse> {
    return apiRequest<SessionResponse>("/api/auth/session", {
        method: "GET",
    });
}

export async function forgotPassword(
    payload: ForgotPasswordPayload
): Promise<{ status: string; message: string }> {
    return apiRequest("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

export async function verifyCode(
    payload: VerifyCodePayload
): Promise<VerifyCodeResponse> {
    return apiRequest<VerifyCodeResponse>("/api/auth/verify-code", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

export async function resetPassword(
    payload: ResetPasswordPayload
): Promise<{ status: string; message: string }> {
    return apiRequest("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}
