"use client";

import ProjectLayout from "@/components/layout/ProjectLayout";
import { useParams } from "next/navigation";

export default function LocalProjectLayout({ children }: { children: React.ReactNode }) {
    const params = useParams();
    // Pass the base structural URL path so the Sidebar links work correctly
    const baseUrl = `/local/projects/${params.project_id}`;

    return (
        <ProjectLayout baseUrl={baseUrl}>
            {children}
        </ProjectLayout>
    );
}
