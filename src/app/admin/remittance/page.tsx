import RemittancePageContent from "./page-content";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Remittance Submission - FreightAssist.Online",
  description: "Submit remittance advice for processing.",
};

export default function RemittancePage() {
  return <RemittancePageContent />;
}
