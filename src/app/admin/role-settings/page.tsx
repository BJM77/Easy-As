import RoleSettingsPageContent from "./page-content";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Role Settings - FreightMate",
  description: "Manage service permissions for different user roles.",
};

export default function RoleSettingsPage() {
  return <RoleSettingsPageContent />;
}
