import RunReportsPageContent from "./page-content";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Run Reports - Admin",
  description: "View and filter all user delivery runs.",
};

export default function RunReportsPage() {
  return <RunReportsPageContent />;
}
