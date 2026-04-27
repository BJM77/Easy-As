import CompetitorComparisonPageContent from "./page-content";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Competitor Comparison - Just Easy",
  description: "Analyze competitor freight rates against all TGE spend bands to find the most competitive offering.",
};

export default function CompetitorComparisonPage() {
  return <CompetitorComparisonPageContent />;
}
