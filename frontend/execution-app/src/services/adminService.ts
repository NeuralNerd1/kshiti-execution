import { apiRequest } from "./apiClient";

export type AdminUser = {
    id: number;
    email: string;
    display_name: string;
    plan: string;
    is_active: boolean;
    created_at: string;
};

export type AdminPlan = {
    id: number;
    plan_key: string;
    display_name: string;
    perks_json: any;
    is_visible: boolean;
};

function getHeaders() {
    const secret = typeof window !== "undefined" ? localStorage.getItem("exec_admin_secret") : "";
    return {
        "X-Admin-Secret": secret || "",
    };
}

// Users
export async function getAdminUsers(): Promise<AdminUser[]> {
    const res = await apiRequest<{ users: AdminUser[] }>("/api/admin/users", {
        method: "GET",
        headers: getHeaders(),
    });
    return res.users || [];
}

export async function createAdminUser(payload: any): Promise<AdminUser> {
    return apiRequest<AdminUser>("/api/admin/users", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload),
    });
}

export async function changeUserPassword(id: number, payload: any): Promise<any> {
    return apiRequest(`/api/admin/users/${id}/password`, {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify(payload),
    });
}

// Plans
export async function getAdminPlans(): Promise<AdminPlan[]> {
    const res = await apiRequest<{ plans: AdminPlan[] }>("/api/admin/plans", {
        method: "GET",
        headers: getHeaders(),
    });
    return res.plans || [];
}

export async function updateAdminPlan(id: number, payload: any): Promise<AdminPlan> {
    return apiRequest<AdminPlan>(`/api/admin/plans/${id}`, {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify(payload),
    });
}
