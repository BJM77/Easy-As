import LoginPageContent from './page-content';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';

export const metadata: Metadata = {
  title: "Login - Just Easy",
  description: "Login to your Just Easy account.",
};

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>}>
      <LoginPageContent />
    </Suspense>
  );
}
