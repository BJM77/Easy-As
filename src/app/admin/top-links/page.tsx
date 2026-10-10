
import TopLinksPageContent from "./page-content";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Top Links Management - Freight assist.online",
  description: "Manage external links displayed in the top banner.",
};

export default function TopLinksPage() {
  return <TopLinksPageContent />;
}
