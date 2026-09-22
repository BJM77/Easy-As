
import ManualOnboardPageContent from "./page-content";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Manual Onboarding - Admin",
  description: "Manually register new organizations and administrators.",
};

export default function ManualOnboardPage() {
  return <ManualOnboardPageContent />;
}
