import LiveTrackingPageContent from './page-content';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Live Track - FreightAssist.Online',
  description: 'Live track consignments by scanning QR codes.',
};

export default function LiveTrackingPage() {
  return <LiveTrackingPageContent />;
}
