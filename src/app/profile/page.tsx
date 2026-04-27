
import ProfilePageContent from "./page-content";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "My Profile - Just Easy",
  description: "View and manage your account details.",
};

export default function ProfilePage() {
  return <ProfilePageContent />;
}
