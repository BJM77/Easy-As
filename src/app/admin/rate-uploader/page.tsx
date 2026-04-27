
import RateUploaderPageContent from "./page-content";
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "Core Rate Management - Just Easy",
  description: "View and manage core TGE pricing rate data.",
};

export default function RateUploaderPage() {
  return <RateUploaderPageContent />;
}
