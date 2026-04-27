
import CustomerRateUploaderPageContent from "./page-content";
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "Upload Customer Rates - Just Easy",
  description: "Upload and manage custom client-specific pricing rate data.",
};

export default function CustomerRateUploaderPage() {
  return <CustomerRateUploaderPageContent />;
}
