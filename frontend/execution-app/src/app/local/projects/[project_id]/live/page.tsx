import { Suspense } from "react";
import LiveExecutionView from "@/components/projects/views/LiveExecutionView";

export default function Page() {
  return (
    <Suspense fallback={<div>Loading execution...</div>}>
      <LiveExecutionView />
    </Suspense>
  );
}
