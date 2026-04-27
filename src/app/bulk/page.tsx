
import BulkPageContent from "./page-content";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Bulk Calculator - Just Easy",
  description: "Calculate B2B Priority rates with special bulk logic.",
};

export default function BulkPage() {
  return (
    <div className="w-full">
      <BulkPageContent />
    </div>
  );
}
