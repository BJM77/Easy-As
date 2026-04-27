import type { Metadata } from 'next';
import QuoteLogsPageContent from './page-content';

export const metadata: Metadata = {
  title: "Quote History Log - Admin",
  description: "Monitor global freight calculation history.",
};

export default function QuoteLogsPage() {
  return <QuoteLogsPageContent />;
}