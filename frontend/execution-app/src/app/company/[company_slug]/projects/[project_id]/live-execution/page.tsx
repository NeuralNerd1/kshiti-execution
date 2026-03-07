import { Suspense } from "react";
import LiveExecutionView from "@/components/projects/views/LiveExecutionView";

export default function LiveExecutionPage() {
    return (
        <Suspense fallback={<div>Loading execution...</div>}>
            <LiveExecutionView />
        </Suspense>
    );
}
