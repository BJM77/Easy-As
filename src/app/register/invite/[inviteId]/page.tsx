
import InviteSignupPageContent from "./page-content";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Join Team - Freight assist.online",
  description: "Accept your invitation to join a Freight assist.online organization.",
};

export default function InviteSignupPage() {
  return <InviteSignupPageContent />;
}
