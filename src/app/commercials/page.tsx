
import CommercialsPageContent from "./page-content";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Commercials - Freight assist.online",
  description: "In-depth pricing analysis and profitability tools.",
};

export default function CommercialsPage() {
  return (
    <div className="w-full">
      <CommercialsPageContent />
    </div>
  );
}
