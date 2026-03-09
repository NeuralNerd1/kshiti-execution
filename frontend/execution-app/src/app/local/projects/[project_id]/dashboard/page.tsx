import ProjectDashboard from "@/components/projects/ProjectDashboard";

export default function LocalProjectDashboardPage({ params }: { params: { project_id: string } }) {
    return <ProjectDashboard projectId={params.project_id} />;
}
