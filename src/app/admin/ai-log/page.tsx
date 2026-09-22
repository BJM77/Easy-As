
import type { Metadata } from 'next';
import { getAiUsageLog } from '@/lib/aiUsage';
import AiLogPageContent from './page-content';
import { AiUsageEntry } from '@/lib/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "AI Usage Log - Admin",
  description: "Review historical AI token usage and estimated costs.",
};

async function fetchLogs(): Promise<AiUsageEntry[]> {
  try {
    const logs = await getAiUsageLog();
    return logs;
  } catch (error) {
    console.error("Failed to fetch AI usage logs for page:", error);
    return [];
  }
}

export default async function AiLogPage() {
  const logs = await fetchLogs();
  return <AiLogPageContent initialLogs={logs} />;
}
