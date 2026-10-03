import RegisterPageContent from './page-content';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Register - Freight assist.online',
  description: 'Create a new Freight assist.online account.',
};

export default function RegisterPage() {
  return <RegisterPageContent />;
}
