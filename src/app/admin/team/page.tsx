
import TeamManagementPageContent from "./page-content";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Team Management - FreightAssist.Online",
  description: "Manage your organization's users and invitations.",
};

export default function TeamPage() {
  return <TeamManagementPageContent />;
}
