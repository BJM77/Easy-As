
import AdminSurchargesPageContent from "./page-content";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Manage Surcharges - Admin",
  description: "View and update fuel and security surcharges globally.",
};

export default function AdminSurchargesPage() {
  return <AdminSurchargesPageContent />;
}
