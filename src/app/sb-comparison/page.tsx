import SBComparisonPageContent from "./page-content";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "SB Comparison - FreightAssist.Online",
  description: "Compare freight rates across all spend bands for selected services.",
};

export default function SBComparisonPage() {
  return <SBComparisonPageContent />;
}
