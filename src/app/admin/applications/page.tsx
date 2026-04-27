
import ApplicationsPageContent from "./page-content";
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "Setup Applications - Admin",
  description: "Manage and export new account setup requests.",
};

export default function ApplicationsAdminPage() {
  return <ApplicationsPageContent />;
}
