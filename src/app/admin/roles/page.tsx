import RolesPageContent from "./page-content";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Roles Management - Admin",
  description: "Manage user roles and permissions.",
};

export default function RolesPage() {
  return <RolesPageContent />;
}
