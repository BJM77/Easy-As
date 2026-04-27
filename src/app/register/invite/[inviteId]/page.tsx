import InviteSignupPageContent from "./page-content";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Join Team - Just Easy",
  description: "Accept your invitation to join a Just Easy organization.",
};

export default function InviteSignupPage({ params }: { params: { inviteId: string } }) {
  // NEXT 14 Compliance: Access params synchronously.
  return <InviteSignupPageContent inviteId={params.inviteId} />;
}