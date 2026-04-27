import RegisterPageContent from './page-content';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Register - Just Easy',
  description: 'Create a new Just Easy account.',
};

export default function RegisterPage() {
  return <RegisterPageContent />;
}
