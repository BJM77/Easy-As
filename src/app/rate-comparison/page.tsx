import RateComparisonPageContent from "./page-content";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Compare Rates - Freight assist.online",
  description: "Compare customer-specific rates against standard spend band rates.",
};

export default function RateComparisonPage() {
  return <RateComparisonPageContent />;
}
