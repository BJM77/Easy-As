import VipContactsPageContent from './page-content';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'VIP Contacts - FreightAssist.Online',
  description: 'A directory of important business contacts.',
};

export default function VipContactsPage() {
  return <VipContactsPageContent />;
}
