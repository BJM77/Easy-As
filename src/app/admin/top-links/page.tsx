
import TopLinksPageContent from "./page-content";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Top Links Management - Just Easy",
  description: "Manage external links displayed in the top banner.",
};

export default function TopLinksPage() {
  return <TopLinksPageContent />;
}
