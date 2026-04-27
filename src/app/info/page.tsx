import InfoHubPageContent from "./page-content";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Info Hub - Just Easy",
  description: "A quick-reference wiki for service details, surcharges, and zone definitions.",
};

export default function InfoHubPage() {
  return <InfoHubPageContent />;
}
