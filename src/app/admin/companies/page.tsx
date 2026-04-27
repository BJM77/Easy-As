
import CompaniesPageContent from "./page-content";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Company Management - Admin",
  description: "Manage SaaS tenants, branding, and billing.",
};

export default function CompaniesAdminPage() {
  return <CompaniesPageContent />;
}
