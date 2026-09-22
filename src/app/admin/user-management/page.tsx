
import UserManagementPageContent from "./page-content";
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "User Management - Admin",
  description: "View and manage all users, roles, and token balances.",
};

export default function UserManagementPage() {
  return <UserManagementPageContent />;
}
