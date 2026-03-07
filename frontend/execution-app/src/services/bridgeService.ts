import { apiRequest } from "./apiClient";
import type { BridgeAuthResponse, AuthUser } from "@/types/auth";

export type BridgeLoginResponse = {
    token: string;
    user: AuthUser;
    bridge_data: BridgeAuthResponse;
};

export async function bridgeSSOLogin(
    djangoToken: string
): Promise<BridgeLoginResponse> {
    return apiRequest<BridgeLoginResponse>("/api/auth/bridge-login", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${djangoToken}`,
        },
    });
}

export async function getProjectSnapshot(projectId: string): Promise<any> {
    return apiRequest<any>(`/api/bridge/project-snapshot/${projectId}`, {
        method: "GET",
    });
}

