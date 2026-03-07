import { apiRequest } from "./apiClient";

export type LocalProject = {
    id: number;
    user_id: number;
    name: string;
    description: string;
};

export async function getLocalProjects(): Promise<LocalProject[]> {
    const res = await apiRequest<{ projects: LocalProject[] }>("/api/local/projects", {
        method: "GET",
    });
    return res.projects || [];
}

export async function createLocalProject(
    name: string,
    description: string
): Promise<{ id: number; name: string; description: string }> {
    return apiRequest("/api/local/projects", {
        method: "POST",
        body: JSON.stringify({ name, description }),
    });
}
