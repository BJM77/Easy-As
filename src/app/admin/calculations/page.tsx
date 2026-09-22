import CalculationsPageContent from "./page-content";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Service Calculations Auditor - FreightAssist.Online",
  description: "Detailed mathematical breakdown of every service price calculation.",
};

export default function CalculationsAuditorPage() {
  return <CalculationsPageContent />;
}
