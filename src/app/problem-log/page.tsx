import ActivityLogPageContent from "./page-content";
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';

export const metadata: Metadata = {
  title: "Activity Log - Just Easy",
  description: "Log and track freight problems and sales leads.",
};

function LoadingFallback() {
  return (
    <div className="flex justify-center items-center h-[50vh]">
      <Loader2 className="h-16 w-16 animate-spin text-primary" />
    </div>
  );
}

export default function ProblemLogPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ActivityLogPageContent />
    </Suspense>
  );
}
