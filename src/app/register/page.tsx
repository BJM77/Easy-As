import RegisterPageContent from './page-content';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Register - FreightAssist.Online',
  description: 'Create a new FreightAssist.Online account.',
};

export default function RegisterPage() {
  return <RegisterPageContent />;
}
