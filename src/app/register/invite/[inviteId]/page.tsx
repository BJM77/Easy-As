
import InviteSignupPageContent from "./page-content";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Join Team - FreightAssist.Online",
  description: "Accept your invitation to join a FreightAssist.Online organization.",
};

export default function InviteSignupPage() {
  return <InviteSignupPageContent />;
}
