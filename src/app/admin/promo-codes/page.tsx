
import PromoCodesPageContent from "./page-content";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Promo Code Manager - Admin",
  description: "Generate and manage access codes for organizations.",
};

export default function PromoCodesAdminPage() {
  return <PromoCodesPageContent />;
}
