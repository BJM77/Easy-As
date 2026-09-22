
import AccountPageContent from "./page-content";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Organization Account - Freight assist.online",
  description: "Manage your business profile and subscription details.",
};

export default function AccountPage() {
  return <AccountPageContent />;
}
