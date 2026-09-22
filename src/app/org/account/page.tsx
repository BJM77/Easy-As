
import AccountPageContent from "./page-content";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Organization Account - FreightAssist.Online",
  description: "Manage your business profile and subscription details.",
};

export default function AccountPage() {
  return <AccountPageContent />;
}
