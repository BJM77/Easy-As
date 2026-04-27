import JSONManagementPageContent from "./page-content";
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "JSON Management - Just Easy",
  description: "Manage and persist company-specific contract pricing JSON data.",
};

export default function JSONManagementPage() {
  return <JSONManagementPageContent />;
}
