"use client";

import ProjectLayout from "@/components/layout/ProjectLayout";
import { useParams } from "next/navigation";

export default function CompanyProjectLayout({ children }: { children: React.ReactNode }) {
    const params = useParams();
    // Pass the base structural URL path so the Sidebar links work correctly
    const baseUrl = `/company/${params.company_slug}/projects/${params.project_id}`;

    return (
        <ProjectLayout baseUrl={baseUrl}>
            {children}
        </ProjectLayout>
    );
}
