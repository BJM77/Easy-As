
import AiModePageContent from "./page-content";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "AI Mode Diagnostic - Admin",
  description: "Verify AI Agent uptime, accuracy, and tool-calling status.",
};

export default function AiModeAdminPage() {
  return <AiModePageContent />;
}
