
import AdminActivityPulsePageContent from "./page-content";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Global Activity Pulse - Admin",
  description: "Monitor real-time organizational activity across all tenants.",
};

export default function AdminActivityPage() {
  return <AdminActivityPulsePageContent />;
}

