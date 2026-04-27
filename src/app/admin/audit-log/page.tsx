import type { Metadata } from 'next';
import AuditLogPageContent from './page-content';

export const metadata: Metadata = {
  title: "System Audit Trail - LedgerLight",
  description: "Monitor administrative actions and security events across the platform.",
};

export default function AuditLogPage() {
  return <AuditLogPageContent />;
}
