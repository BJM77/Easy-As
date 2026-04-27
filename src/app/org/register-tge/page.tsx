
import RegisterTGEPageContent from "./page-content";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "TGE Account Registration - Just Easy",
  description: "Record new account setup information for Team Global Express.",
};

export default function RegisterTGEPage() {
  return <RegisterTGEPageContent />;
}
