import type { Metadata } from 'next';
import DashboardPageContent from './page-content';

export const metadata: Metadata = {
  title: 'Dashboard - FreightAssist.Online',
  description: 'Enterprise multi-modal freight intelligence and calculation platform.',
};

export default function DashboardPage() {
  return <DashboardPageContent />;
}
