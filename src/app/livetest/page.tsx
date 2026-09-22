import LiveTestPageContent from "./page-content";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Live Test - FreightAssist.Online',
  description: 'Live track consignments and test new route planning features.',
};

export default function LiveTestPage() {
  return <LiveTestPageContent />;
}
