import CalculationsPageContent from "./page-content";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Service Calculations Auditor - Just Easy",
  description: "Detailed mathematical breakdown of every service price calculation.",
};

export default function CalculationsAuditorPage() {
  return <CalculationsPageContent />;
}
