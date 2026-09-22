
import StatusPageContent from "./page-content";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "System Status - FreightAssist.Online",
  description: "Check the status of API keys and service connections.",
};

export default function StatusPage() {
  return <StatusPageContent />;
}
