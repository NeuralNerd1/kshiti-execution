import { apiRequest } from "./apiClient";

export async function executeSuite(suiteData: any, configData: any, projectId: string, companySlug?: string) {
    return apiRequest<{ runId: string; status: string }>(
        `/api/execution/run`,
        {
            method: "POST",
            body: JSON.stringify({
                suite: suiteData,
                config: configData,
                projectId: projectId,
                companySlug: companySlug || "default"
            })
        }
    );
}

export async function getRunStatus(runId: string) {
    return apiRequest<any>(
        `/api/execution/run/${runId}`,
        { method: "GET" }
    );
}

export async function getProjectRuns(projectId: string) {
    return apiRequest<any[]>(
        `/api/execution/runs/${projectId}`,
        { method: "GET" }
    );
}

export async function getExecutionConfig(projectId: string) {
    return apiRequest<any>(
        `/api/execution/config/${projectId}`,
        { method: "GET" }
    );
}

export async function saveExecutionConfig(projectId: string, configData: any) {
    return apiRequest<any>(
        `/api/execution/config/${projectId}`,
        {
            method: "POST",
            body: JSON.stringify(configData)
        }
    );
}

export async function getLogsTree(projectId: string) {
    return apiRequest<any[]>(
        `/api/execution/logs/tree/${projectId}`,
        { method: "GET" }
    );
}

export async function getLogFileContent(filePath: string) {
    return apiRequest<{ path: string; content: string }>(
        `/api/execution/logs/file?path=${encodeURIComponent(filePath)}`,
        { method: "GET" }
    );
}

export async function stopExecution(runId: string) {
    return apiRequest<{ status: string; runId: string }>(
        `/api/execution/run/${runId}/stop`,
        { method: "POST" }
    );
}
