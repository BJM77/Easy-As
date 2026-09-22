
import BrandingPageContent from "./page-content";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Company Branding - Freight assist.online",
  description: "Customize your organization's look and feel.",
};

export default function BrandingPage() {
  return <BrandingPageContent />;
}
