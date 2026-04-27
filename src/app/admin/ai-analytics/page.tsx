
import type { Metadata } from 'next';
import AiAnalyticsPageContent from './page-content';

export const metadata: Metadata = {
  title: "AI Token Analytics - LedgerLight",
  description: "Monitor token consumption, API costs, and tenant usage statistics.",
};

export default function AiAnalyticsPage() {
  return <AiAnalyticsPageContent />;
}
