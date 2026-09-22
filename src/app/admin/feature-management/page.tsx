
import FeatureManagementPageContent from "./page-content";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Feature Management - Admin",
  description: "Configure active modules and integrations for company tenants.",
};

export default function FeatureManagementPage() {
  return <FeatureManagementPageContent />;
}
