import LiveTrackingPageContent from './page-content';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Live Track - Just Easy',
  description: 'Live track consignments by scanning QR codes.',
};

export default function LiveTrackingPage() {
  return <LiveTrackingPageContent />;
}
